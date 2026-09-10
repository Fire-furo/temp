/**
 * routes/api.js -- Part 5
 *
 * Four endpoint groups, per the project spec:
 *   GET  /api/meta                presets + ML model metrics (for populating the UI)
 *   POST /api/predict             single fuel-rate prediction (Part 2, via ml-service)
 *   POST /api/optimize            run QIEA + classical GA + benchmark comparison (Parts 3+4)
 *   GET/POST/DELETE /api/scenarios  save/list/get/delete optimization runs (MongoDB)
 * Plus:
 *   GET  /api/health              liveness of backend + ml-service + Mongo
 *   POST /api/ml/retrain          trigger a retrain of the XGBoost model
 */
const express = require("express");
const router = express.Router();

const { VESSEL_TYPES, FUEL_TYPES, SEA_STATES, SPEED_MIN_KN, SPEED_MAX_KN } = require("../data/presets");
const mlClient = require("../services/mlClient");
const { runQIEA } = require("../services/quantumOptimizer");
const { runClassicalGA } = require("../services/classicalGA");
const { runMultiSeedBenchmark } = require("../services/benchmark");
const { dbIsConnected } = require("../config/db");
const Scenario = require("../models/Scenario");

function requireDb(req, res, next) {
  if (!dbIsConnected()) {
    return res.status(503).json({
      error: "MongoDB is not connected -- scenario history is unavailable right now, " +
        "but prediction and optimization are unaffected.",
    });
  }
  next();
}

// ---------------------------------------------------------------- /health
router.get("/health", async (req, res) => {
  const ml = await mlClient.healthCheck();
  res.json({ status: "ok", mongoConnected: dbIsConnected(), mlService: ml });
});

// ------------------------------------------------------------------ /meta
router.get("/meta", async (req, res) => {
  const modelMeta = await mlClient.getMeta();
  res.json({
    vesselTypes: VESSEL_TYPES,
    fuelTypes: FUEL_TYPES,
    seaStates: SEA_STATES,
    speedRangeKn: { min: SPEED_MIN_KN, max: SPEED_MAX_KN },
    mlModel: modelMeta,
    mongoConnected: dbIsConnected(),
  });
});

// --------------------------------------------------------------- /predict
router.post("/predict", async (req, res) => {
  try {
    const { vesselType, fuelType, seaState = "moderate", speedKn, cargoLoadFrac = 0.7, distanceNm = 1000 } = req.body;
    if (!VESSEL_TYPES[vesselType]) return res.status(400).json({ error: `Unknown vesselType '${vesselType}'` });
    if (!FUEL_TYPES[fuelType]) return res.status(400).json({ error: `Unknown fuelType '${fuelType}'` });
    if (typeof speedKn !== "number") return res.status(400).json({ error: "speedKn (number) is required" });

    const v = VESSEL_TYPES[vesselType];
    const row = {
      vessel_type: vesselType,
      fuel_type: fuelType,
      sea_state: seaState,
      speed_kn: speedKn,
      displacement: v.displacement,
      engine_power: v.enginePower,
      cargo_load_frac: cargoLoadFrac,
      distance_nm: distanceNm,
    };
    const { rates, source } = await mlClient.predictFuelRates([row]);
    const fuelRateTonsPerHr = rates[0];
    const travelHours = distanceNm / speedKn;
    const fuelTons = fuelRateTonsPerHr * travelHours;
    const fuelSpec = FUEL_TYPES[fuelType];

    res.json({
      fuelRateTonsPerHr: Math.round(fuelRateTonsPerHr * 10000) / 10000,
      travelHours: Math.round(travelHours * 100) / 100,
      fuelTons: Math.round(fuelTons * 1000) / 1000,
      costUsd: Math.round(fuelTons * fuelSpec.costPerTon * 100) / 100,
      emissionsTons: Math.round(fuelTons * fuelSpec.emissionsFactor * 1000) / 1000,
      source, // "xgboost" | "physics_fallback*"
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------- /optimize
router.post("/optimize", async (req, res) => {
  try {
    const body = req.body || {};
    const route = {
      cargoDemand: Number(body.cargoDemand ?? 15000),
      distanceNm: Number(body.distanceNm ?? 1200),
      deadlineHours: Number(body.deadlineHours ?? 96),
      portTimeHours: Number(body.portTimeHours ?? 6),
      seaState: body.seaState || "moderate",
    };
    const weights = {
      costWeight: Number(body.costWeight ?? 1.0),
      emissionsWeight: Number(body.emissionsWeight ?? 1.0),
      scheduleWeight: Number(body.scheduleWeight ?? 1.0),
    };
    const populationSize = Number(body.populationSize ?? 24);
    const generations = Number(body.generations ?? 40);
    const seed = Number(body.seed ?? 42);

    const [qiea, ga] = await Promise.all([
      runQIEA({ route, weights, populationSize, generations, seed }),
      runClassicalGA({ route, weights, populationSize, generations, seed }),
    ]);
    const improvementPct = ((ga.result.fitness - qiea.result.fitness) / ga.result.fitness) * 100;

    res.json({
      route,
      weights,
      quantum: qiea,
      classical: ga,
      quantumImprovementPct: Math.round(improvementPct * 100) / 100,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ------------------------------------------------------------- /benchmark
router.post("/benchmark", async (req, res) => {
  try {
    const body = req.body || {};
    const route = {
      cargoDemand: Number(body.cargoDemand ?? 15000),
      distanceNm: Number(body.distanceNm ?? 1200),
      deadlineHours: Number(body.deadlineHours ?? 96),
      portTimeHours: Number(body.portTimeHours ?? 6),
      seaState: body.seaState || "moderate",
    };
    const weights = {
      costWeight: Number(body.costWeight ?? 1.0),
      emissionsWeight: Number(body.emissionsWeight ?? 1.0),
      scheduleWeight: Number(body.scheduleWeight ?? 1.0),
    };
    const summary = await runMultiSeedBenchmark({
      route,
      weights,
      populationSize: Number(body.populationSize ?? 20),
      generations: Number(body.generations ?? 30),
      numSeeds: Number(body.numSeeds ?? 8),
    });
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------- /ml/retrain
router.post("/ml/retrain", async (req, res) => {
  try {
    const result = await mlClient.retrainModel();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ------------------------------------------------------------- /scenarios
router.get("/scenarios", requireDb, async (req, res) => {
  const scenarios = await Scenario.find().sort({ createdAt: -1 }).limit(100);
  res.json(scenarios);
});

router.get("/scenarios/:id", requireDb, async (req, res) => {
  const scenario = await Scenario.findById(req.params.id);
  if (!scenario) return res.status(404).json({ error: "Scenario not found" });
  res.json(scenario);
});

router.post("/scenarios", requireDb, async (req, res) => {
  try {
    const scenario = await Scenario.create(req.body);
    res.status(201).json(scenario);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete("/scenarios/:id", requireDb, async (req, res) => {
  const deleted = await Scenario.findByIdAndDelete(req.params.id);
  if (!deleted) return res.status(404).json({ error: "Scenario not found" });
  res.json({ deleted: true });
});

module.exports = router;
