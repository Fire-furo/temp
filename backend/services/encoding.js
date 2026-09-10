/**
 * services/encoding.js -- shared by Part 3 (quantum) and Part 4 (classical)
 *
 * How a fleet plan is represented as a flat bit string. A plan has
 * N_SLOTS candidate vessels; each slot is a fixed-width block of bits:
 *
 *     [ vesselType bits | fuelType bits | speed bits ]
 *
 * Using the IDENTICAL encoding for both optimizers is what makes the
 * quantum-vs-classical benchmark fair: both decode the exact same kind
 * of bit string into the exact same kind of fleet plan.
 */
const { VESSEL_NAMES, FUEL_NAMES, SPEED_MIN_KN, SPEED_MAX_KN } = require("../data/presets");

const N_SLOTS = 4;
const VESSEL_BITS = 2; // 2 bits -> 4 values, exactly covers 4 vessel types
const FUEL_BITS = 3; // 3 bits -> 8 values, covers 5 fuel types (mod'd down)
const SPEED_BITS = 6; // 6 bits -> 64 discrete speed steps
const BITS_PER_SLOT = VESSEL_BITS + FUEL_BITS + SPEED_BITS;
const CHROMOSOME_LENGTH = N_SLOTS * BITS_PER_SLOT;

function bitsToInt(bitArray) {
  let value = 0;
  for (let i = 0; i < bitArray.length; i++) value = (value << 1) | bitArray[i];
  return value;
}

/** bits: Uint8Array/Array of 0/1, length CHROMOSOME_LENGTH -> list of slot dicts */
function decodeChromosome(bits) {
  const plan = [];
  for (let slot = 0; slot < N_SLOTS; slot++) {
    const start = slot * BITS_PER_SLOT;
    const vtBits = bits.slice(start, start + VESSEL_BITS);
    const ftBits = bits.slice(start + VESSEL_BITS, start + VESSEL_BITS + FUEL_BITS);
    const spBits = bits.slice(start + VESSEL_BITS + FUEL_BITS, start + BITS_PER_SLOT);

    const vesselType = VESSEL_NAMES[bitsToInt(vtBits) % VESSEL_NAMES.length];
    const fuelType = FUEL_NAMES[bitsToInt(ftBits) % FUEL_NAMES.length];

    const spInt = bitsToInt(spBits);
    const spMaxInt = Math.pow(2, SPEED_BITS) - 1;
    const speedKn = SPEED_MIN_KN + (spInt / spMaxInt) * (SPEED_MAX_KN - SPEED_MIN_KN);

    plan.push({ vesselType, fuelType, speedKn: Math.round(speedKn * 100) / 100 });
  }
  return plan;
}

function randomBits(length, rng) {
  const bits = new Uint8Array(length);
  for (let i = 0; i < length; i++) bits[i] = rng() < 0.5 ? 0 : 1;
  return bits;
}

module.exports = {
  N_SLOTS, VESSEL_BITS, FUEL_BITS, SPEED_BITS, BITS_PER_SLOT, CHROMOSOME_LENGTH,
  decodeChromosome, bitsToInt, randomBits,
};
