/**
 * models/Scenario.js -- Part 5
 *
 * Describes how a saved optimization run (route + weights + both
 * algorithms' results) is stored in MongoDB. Nested sub-schemas keep
 * each algorithm's fleet assignments and convergence history attached
 * to the scenario that produced them, so a saved run is fully
 * self-contained and replayable later without recomputation.
 */
const mongoose = require("mongoose");

const SlotSchema = new mongoose.Schema(
  {
    vesselType: String,
    fuelType: String,
    speedKn: Number,
    fuelTons: Number,
  },
  { _id: false }
);

const AlgorithmResultSchema = new mongoose.Schema(
  {
    algorithm: String,
    fitness: Number,
    totalCostUsd: Number,
    totalEmissionsTons: Number,
    totalCapacity: Number,
    capacityShortfall: Number,
    maxTravelTimeHours: Number,
    assignments: [SlotSchema],
    convergenceHistory: [Number],
    runtimeSeconds: Number,
    generations: Number,
    populationSize: Number,
  },
  { _id: false }
);

const ScenarioSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    route: {
      cargoDemand: Number,
      distanceNm: Number,
      deadlineHours: Number,
      portTimeHours: Number,
      seaState: String,
    },
    weights: {
      costWeight: Number,
      emissionsWeight: Number,
      scheduleWeight: Number,
    },
    quantum: AlgorithmResultSchema,
    classical: AlgorithmResultSchema,
    quantumImprovementPct: Number,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Scenario", ScenarioSchema);
