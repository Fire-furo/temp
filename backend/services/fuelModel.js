/**
 * services/fuelModel.js -- Part 1
 *
 * The physics ground-truth formula, mirrored from ml-service/fuel_physics.py.
 * Used as a synchronous, dependency-free FALLBACK whenever the ML
 * microservice can't be reached, so /predict and /optimize keep
 * working (with a slightly less accurate number) instead of failing
 * outright mid-demo. See services/mlClient.js for where this is wired in.
 *
 * Admiralty Coefficient formula:
 *   Power(kW) = Displacement^(2/3) * Speed^3 / AdmiraltyCoefficient
 * Power scales with the CUBE of speed -- this is why "slow steaming"
 * is a real fuel-saving strategy, and why speed is such a sensitive
 * optimizer variable.
 */
const { VESSEL_TYPES, FUEL_TYPES, SEA_STATES } = require("../data/presets");

function requiredPowerKw(displacement, speedKn, admiraltyCoeff, seaFactor = 1.0, loadFactor = 1.0) {
  const basePower = Math.pow(displacement, 2 / 3) * Math.pow(speedKn, 3) / admiraltyCoeff;
  return basePower * seaFactor * loadFactor;
}

function fuelBurnRateTonsPerHr(vesselType, fuelType, speedKn, seaState = "moderate", cargoLoadFrac = 0.7) {
  const v = VESSEL_TYPES[vesselType];
  const f = FUEL_TYPES[fuelType];
  const s = SEA_STATES[seaState] || SEA_STATES.moderate;

  const loadFactor = 1 + 0.3 * Math.max(0, Math.min(1.5, cargoLoadFrac));
  let powerKw = requiredPowerKw(v.displacement, speedKn, v.admiraltyCoeff, s.factor, loadFactor);
  powerKw = Math.min(powerKw, v.enginePower * 1.35);

  const fuelKgPerHr = (powerKw * f.sfoc) / 1000.0;
  return fuelKgPerHr / 1000.0; // tons/hr
}

module.exports = { fuelBurnRateTonsPerHr, requiredPowerKw };
