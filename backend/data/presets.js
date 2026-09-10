/**
 * data/presets.js -- Part 1
 *
 * Vessel, fuel, and sea-state reference data. Kept in lockstep with
 * ml-service/presets.py -- if you change one, change the other. This
 * is used for capacity/TEU checks and as the fallback fuel formula's
 * inputs on the Node side (services/fuelModel.js); the ML service uses
 * its own copy for training the XGBoost model.
 */

const VESSEL_TYPES = {
  small_general_cargo: { displacement: 8000, deadweight: 5000, enginePower: 4000, admiraltyCoeff: 260, teuCapacity: 350 },
  medium_bulk_carrier: { displacement: 22000, deadweight: 15000, enginePower: 9000, admiraltyCoeff: 310, teuCapacity: 900 },
  large_bulk_carrier: { displacement: 48000, deadweight: 35000, enginePower: 15000, admiraltyCoeff: 340, teuCapacity: 1800 },
  container_ship: { displacement: 34000, deadweight: 25000, enginePower: 18000, admiraltyCoeff: 300, teuCapacity: 2400 },
};

const FUEL_TYPES = {
  hfo: { energyDensity: 40.5, emissionsFactor: 3.11, costPerTon: 550, sfoc: 190 },
  lng: { energyDensity: 50.0, emissionsFactor: 2.75, costPerTon: 650, sfoc: 175 },
  methanol: { energyDensity: 19.9, emissionsFactor: 1.98, costPerTon: 800, sfoc: 380 },
  ammonia: { energyDensity: 18.6, emissionsFactor: 0.10, costPerTon: 1100, sfoc: 410 },
  hydrogen: { energyDensity: 120.0, emissionsFactor: 0.0, costPerTon: 1400, sfoc: 65 },
};

const SEA_STATES = {
  calm: { factor: 1.0, waveHeight: 0.5, windSpeed: 6 },
  moderate: { factor: 1.12, waveHeight: 1.5, windSpeed: 14 },
  rough: { factor: 1.3, waveHeight: 3.0, windSpeed: 24 },
  severe: { factor: 1.55, waveHeight: 5.0, windSpeed: 34 },
};

const SPEED_MIN_KN = 8.0;
const SPEED_MAX_KN = 24.0;

const VESSEL_NAMES = Object.keys(VESSEL_TYPES);
const FUEL_NAMES = Object.keys(FUEL_TYPES);
const SEA_STATE_NAMES = Object.keys(SEA_STATES);

module.exports = {
  VESSEL_TYPES, FUEL_TYPES, SEA_STATES,
  SPEED_MIN_KN, SPEED_MAX_KN,
  VESSEL_NAMES, FUEL_NAMES, SEA_STATE_NAMES,
};
