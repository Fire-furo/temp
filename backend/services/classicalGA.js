/**
 * services/classicalGA.js -- Part 4: classical GA benchmark baseline
 *
 * Standard binary-coded genetic algorithm -- tournament selection,
 * single-point crossover, bit-flip mutation, elitism -- run on the
 * IDENTICAL bit encoding as the QIEA (encoding.js / fitness.js), so
 * benchmark.js's quantum-vs-classical comparison is scoring both
 * algorithms on the same fitness landscape. The only thing that
 * differs between the two optimizers is the search strategy.
 */
const { CHROMOSOME_LENGTH, decodeChromosome, randomBits } = require("./encoding");
const { evaluatePopulation } = require("./fitness");

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function tournamentSelect(population, fitnessValues, rng, k = 3) {
  let winnerIdx = Math.floor(rng() * population.length);
  let winnerFitness = fitnessValues[winnerIdx];
  for (let i = 1; i < k; i++) {
    const idx = Math.floor(rng() * population.length);
    if (fitnessValues[idx] < winnerFitness) {
      winnerIdx = idx;
      winnerFitness = fitnessValues[idx];
    }
  }
  return population[winnerIdx].slice();
}

function crossover(parentA, parentB, rng) {
  const point = 1 + Math.floor(rng() * (CHROMOSOME_LENGTH - 2));
  const childA = new Uint8Array(CHROMOSOME_LENGTH);
  const childB = new Uint8Array(CHROMOSOME_LENGTH);
  for (let i = 0; i < CHROMOSOME_LENGTH; i++) {
    if (i < point) {
      childA[i] = parentA[i];
      childB[i] = parentB[i];
    } else {
      childA[i] = parentB[i];
      childB[i] = parentA[i];
    }
  }
  return [childA, childB];
}

function mutate(individual, rng, mutationRate = 0.02) {
  for (let i = 0; i < individual.length; i++) {
    if (rng() < mutationRate) individual[i] = 1 - individual[i];
  }
  return individual;
}

async function runClassicalGA({
  route,
  weights,
  populationSize = 24,
  generations = 40,
  seed = 42,
  mutationRate = 0.02,
  onGeneration = null,
}) {
  const rng = mulberry32(seed);
  let population = Array.from({ length: populationSize }, () => randomBits(CHROMOSOME_LENGTH, rng));

  let bestBits = null;
  let bestFitness = Infinity;
  let bestResult = null;
  const history = [];
  let lastSource = "unknown";

  const start = Date.now();

  for (let gen = 0; gen < generations; gen++) {
    const { fitnessValues, results, source } = await evaluatePopulation(population, route, weights);
    lastSource = source;

    let genBestIdx = 0;
    for (let i = 1; i < populationSize; i++) if (fitnessValues[i] < fitnessValues[genBestIdx]) genBestIdx = i;

    if (fitnessValues[genBestIdx] < bestFitness) {
      bestFitness = fitnessValues[genBestIdx];
      bestBits = population[genBestIdx].slice();
      bestResult = results[genBestIdx];
    }
    history.push(bestFitness);

    // Elitism: the best individual survives untouched into the next generation.
    const nextPopulation = [bestBits.slice()];
    while (nextPopulation.length < populationSize) {
      const parentA = tournamentSelect(population, fitnessValues, rng);
      const parentB = tournamentSelect(population, fitnessValues, rng);
      const [childA, childB] = crossover(parentA, parentB, rng);
      nextPopulation.push(mutate(childA, rng, mutationRate));
      if (nextPopulation.length < populationSize) nextPopulation.push(mutate(childB, rng, mutationRate));
    }
    population = nextPopulation;

    if (onGeneration) onGeneration(gen, bestFitness);
  }

  const runtimeSeconds = (Date.now() - start) / 1000;
  const bestPlan = decodeChromosome(bestBits);

  return {
    algorithm: "Classical Genetic Algorithm (baseline)",
    bestPlan,
    result: bestResult,
    history,
    runtimeSeconds: Math.round(runtimeSeconds * 1000) / 1000,
    generations,
    populationSize,
    predictionSource: lastSource,
  };
}

module.exports = { runClassicalGA };
