/**
 * services/mlClient.js -- Part 2
 *
 * Thin client for the Python/FastAPI ML microservice (ml-service/app.py)
 * that wraps the trained XGBoost model. Both optimizers call
 * predictFuelRates() once per candidate fleet plan per generation, so
 * predictions are always BATCHED (one HTTP call for all slots in a
 * plan) rather than one call per slot -- this is what keeps a
 * 20-population/60-generation run in the tens of seconds instead of
 * minutes.
 *
 * Graceful degradation: if the ML service is unreachable or errors,
 * this falls back to the physics formula (services/fuelModel.js)
 * instead of throwing, so /optimize and /predict keep working through
 * a demo even if the Python process isn't running -- with a warning
 * flag on the response so the frontend can show "estimated (fallback)"
 * instead of silently pretending it's the ML prediction.
 */
const axios = require("axios");
const { fuelBurnRateTonsPerHr } = require("./fuelModel");

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://127.0.0.1:8000";
const client = axios.create({ baseURL: ML_SERVICE_URL, timeout: 8000 });

let cachedMeta = null;

async function getMeta() {
  if (cachedMeta) return cachedMeta;
  try {
    const { data } = await client.get("/meta");
    cachedMeta = data;
    return data;
  } catch (err) {
    return { model_loaded: false, error: err.message };
  }
}

function localFallback(rows) {
  return rows.map((r) =>
    fuelBurnRateTonsPerHr(r.vessel_type, r.fuel_type, r.speed_kn, r.sea_state, r.cargo_load_frac)
  );
}

/**
 * rows: [{ vessel_type, fuel_type, sea_state, speed_kn, displacement,
 *          engine_power, cargo_load_frac, distance_nm }]
 * returns: { rates: number[], source: "xgboost" | "physics_fallback" }
 */
async function predictFuelRates(rows) {
  if (!rows || rows.length === 0) return { rates: [], source: "none" };
  try {
    const { data } = await client.post("/predict", { rows });
    return { rates: data.predictions, source: data.source || "xgboost" };
  } catch (err) {
    return { rates: localFallback(rows), source: "physics_fallback_unreachable" };
  }
}

async function retrainModel() {
  const { data } = await client.post("/train");
  cachedMeta = null; // force refetch of metrics next /meta call
  return data;
}

async function healthCheck() {
  try {
    const { data } = await client.get("/health");
    return { reachable: true, ...data };
  } catch (err) {
    return { reachable: false, error: err.message };
  }
}

module.exports = { predictFuelRates, getMeta, retrainModel, healthCheck, ML_SERVICE_URL };
