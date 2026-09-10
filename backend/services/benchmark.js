/**
 * services/benchmark.js -- Part 4's "prove it works" story.
 *
 * Runs the QIEA and classical GA across several seeds on the same
 * route/weights and reports the aggregate win rate and average
 * improvement -- a single seed's result isn't representative in
 * either direction, so this is the honest number to present.
 */
const { runQIEA } = require("./quantumOptimizer");
const { runClassicalGA } = require("./classicalGA");

async function runMultiSeedBenchmark({ route, weights, populationSize, generations, numSeeds = 8 }) {
  const runs = [];
  for (let s = 0; s < numSeeds; s++) {
    const seed = 1000 + s;
    const [qiea, ga] = await Promise.all([
      runQIEA({ route, weights, populationSize, generations, seed }),
      runClassicalGA({ route, weights, populationSize, generations, seed }),
    ]);
    const improvementPct = ((ga.result.fitness - qiea.result.fitness) / ga.result.fitness) * 100;
    runs.push({
      seed,
      qieaFitness: qiea.result.fitness,
      gaFitness: ga.result.fitness,
      improvementPct: Math.round(improvementPct * 100) / 100,
      qieaWon: qiea.result.fitness < ga.result.fitness,
    });
  }

  const wins = runs.filter((r) => r.qieaWon).length;
  const avgImprovement = runs.reduce((s, r) => s + r.improvementPct, 0) / runs.length;
  const best = runs.reduce((a, b) => (b.improvementPct > a.improvementPct ? b : a));
  const worst = runs.reduce((a, b) => (b.improvementPct < a.improvementPct ? b : a));

  return {
    numSeeds,
    qieaWinRate: `${wins}/${numSeeds}`,
    avgImprovementPct: Math.round(avgImprovement * 100) / 100,
    bestCase: best,
    worstCase: worst,
    runs,
    note:
      "A single seed is not representative -- present the win rate and average " +
      "across seeds, not one run's improvement percentage.",
  };
}

module.exports = { runMultiSeedBenchmark };
