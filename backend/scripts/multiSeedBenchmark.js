/**
 * scripts/multiSeedBenchmark.js
 *
 * The honest Part 4 benchmarking number: runs QIEA vs classical GA
 * across several seeds and prints the win rate + average improvement,
 * instead of a single (potentially cherry-picked) seed's result.
 *
 * Run from backend/:  node scripts/multiSeedBenchmark.js
 */
require("dotenv").config();
const { runMultiSeedBenchmark } = require("../services/benchmark");

const ROUTE = { cargoDemand: 15000, distanceNm: 1200, deadlineHours: 96, portTimeHours: 6, seaState: "moderate" };
const WEIGHTS = { costWeight: 1.0, emissionsWeight: 1.0, scheduleWeight: 1.0 };

async function main() {
  const numSeeds = Number(process.argv[2] || 10);
  console.log(`Running ${numSeeds}-seed QIEA vs classical GA benchmark...`);
  const summary = await runMultiSeedBenchmark({
    route: ROUTE, weights: WEIGHTS, populationSize: 20, generations: 30, numSeeds,
  });

  console.log(`\nQIEA win rate: ${summary.qieaWinRate}`);
  console.log(`Average improvement: ${summary.avgImprovementPct}%`);
  console.log(`Best case:  seed ${summary.bestCase.seed} -> ${summary.bestCase.improvementPct}%`);
  console.log(`Worst case: seed ${summary.worstCase.seed} -> ${summary.worstCase.improvementPct}%`);
  console.log(`\n${summary.note}`);
  console.log("\nPer-seed detail:");
  summary.runs.forEach((r) =>
    console.log(`  seed=${r.seed}  qiea=${r.qieaFitness.toFixed(1)}  ga=${r.gaFitness.toFixed(1)}  ` +
      `improvement=${r.improvementPct}%  ${r.qieaWon ? "QIEA won" : "GA won"}`)
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
