/**
 * services/fitness.js -- shared by Part 3 (quantum) and Part 4 (classical)
 *
 * Decodes chromosomes into fleet plans and scores them against a route.
 * This is where the ML model (Part 2) actually gets used: fuel rates
 * for every slot of every individual in the population are requested
 * in ONE batched call to the ML microservice per generation, then
 * combined with the vessel/fuel presets (Part 1) into cost, emissions,
 * capacity, and schedule-risk numbers.
 *
 * Multi-objective scoring: cost, emissions, and schedule risk are
 * combined into one fitness number via user-adjustable weights (a
 * judge raising the emissions slider should visibly shift the result
 * toward cleaner fuels). Capacity shortfall and missed deadlines are
 * enforced as large FIXED penalties regardless of the weight sliders --
 * they are hard constraints ("must not violate"), not soft trade-offs.
 */
const { VESSEL_TYPES, FUEL_TYPES } = require("../data/presets");
const { decodeChromosome, N_SLOTS } = require("./encoding");
const { predictFuelRates } = require("./mlClient");

const DEFAULT_WEIGHTS = { costWeight: 1.0, emissionsWeight: 1.0, scheduleWeight: 1.0 };

/**
 * Build the ML-service request rows for one decoded plan.
 */
function planToRows(plan, route, cargoLoads) {
  return plan.map((slot, i) => {
    const v = VESSEL_TYPES[slot.vesselType];
    return {
      vessel_type: slot.vesselType,
      fuel_type: slot.fuelType,
      sea_state: route.seaState || "moderate",
      speed_kn: slot.speedKn,
      displacement: v.displacement,
      engine_power: v.enginePower,
      cargo_load_frac: v.deadweight > 0 ? cargoLoads[i] / v.deadweight : 0,
      distance_nm: route.distanceNm,
    };
  });
}

function cargoLoadsFor(plan, cargoDemand) {
  const totalCapacity = plan.reduce((s, slot) => s + VESSEL_TYPES[slot.vesselType].deadweight, 0);
  return plan.map((slot) => {
    const dw = VESSEL_TYPES[slot.vesselType].deadweight;
    const share = totalCapacity > 0 ? dw / totalCapacity : 0;
    return Math.min(dw, cargoDemand * share);
  });
}

/**
 * Score ONE decoded plan given fuel rates already predicted for its slots.
 */
function scorePlan(plan, route, weights, fuelRates) {
  const cargoDemand = route.cargoDemand;
  const deadlineHours = route.deadlineHours;
  const portTimeHours = route.portTimeHours || 0;

  const totalCapacity = plan.reduce((s, slot) => s + VESSEL_TYPES[slot.vesselType].deadweight, 0);

  let totalCost = 0;
  let totalEmissions = 0;
  let maxTravelTime = 0;
  const assignments = [];

  plan.forEach((slot, i) => {
    const travelHours = slot.speedKn > 0 ? route.distanceNm / slot.speedKn : Infinity;
    const fuelTons = fuelRates[i] * travelHours;
    const fuelSpec = FUEL_TYPES[slot.fuelType];
    const slotCost = fuelTons * fuelSpec.costPerTon;
    const slotEmissions = fuelTons * fuelSpec.emissionsFactor;

    totalCost += slotCost;
    totalEmissions += slotEmissions;
    maxTravelTime = Math.max(maxTravelTime, travelHours + portTimeHours);

    assignments.push({
      vesselType: slot.vesselType,
      fuelType: slot.fuelType,
      speedKn: slot.speedKn,
      fuelTons: Math.round(fuelTons * 1000) / 1000,
    });
  });

  const capacityShortfall = Math.max(0, cargoDemand - totalCapacity);
  const etaOverrun = Math.max(0, maxTravelTime - deadlineHours);
  // schedule risk: how close to the deadline the slowest vessel cuts it (0 = lots of slack, 1 = exactly on time)
  const scheduleRisk = deadlineHours > 0 ? Math.max(0, Math.min(1, maxTravelTime / deadlineHours)) : 1;

  const w = { ...DEFAULT_WEIGHTS, ...weights };
  const fitness =
    w.costWeight * totalCost +
    w.emissionsWeight * totalEmissions * 100 + // bring emissions onto a $-comparable scale
    w.scheduleWeight * scheduleRisk * 2000 +
    capacityShortfall * 5000 + // hard constraint: can't carry the declared cargo
    etaOverrun * 20000; // hard constraint: misses the delivery deadline

  return {
    fitness,
    totalCostUsd: Math.round(totalCost * 100) / 100,
    totalEmissionsTons: Math.round(totalEmissions * 1000) / 1000,
    totalCapacity: Math.round(totalCapacity * 100) / 100,
    capacityShortfall: Math.round(capacityShortfall * 100) / 100,
    maxTravelTimeHours: Math.round(maxTravelTime * 100) / 100,
    scheduleRisk: Math.round(scheduleRisk * 1000) / 1000,
    assignments,
  };
}

/**
 * Evaluate a WHOLE population (array of bit arrays) in one batched ML
 * call. Returns { fitnessValues: number[], results: object[] } aligned
 * with the input population order.
 */
async function evaluatePopulation(populationBits, route, weights) {
  const plans = populationBits.map((bits) => decodeChromosome(bits));
  const cargoLoadsPerPlan = plans.map((plan) => cargoLoadsFor(plan, route.cargoDemand));

  const allRows = [];
  const sliceRanges = [];
  plans.forEach((plan, idx) => {
    const rows = planToRows(plan, route, cargoLoadsPerPlan[idx]);
    sliceRanges.push([allRows.length, allRows.length + rows.length]);
    allRows.push(...rows);
  });

  const { rates, source } = await predictFuelRates(allRows);

  const fitnessValues = new Array(plans.length);
  const results = new Array(plans.length);
  plans.forEach((plan, idx) => {
    const [start, end] = sliceRanges[idx];
    const planRates = rates.slice(start, end);
    const result = scorePlan(plan, route, weights, planRates);
    fitnessValues[idx] = result.fitness;
    results[idx] = result;
  });

  return { fitnessValues, results, source, plans };
}

module.exports = { evaluatePopulation, scorePlan, planToRows, cargoLoadsFor, N_SLOTS };
