/**
 * scripts/testRun.js
 *
 * Quick CLI smoke test: runs QIEA + classical GA once on a default
 * route and prints the result. Useful for the Part 3/4 hands-on
 * exercises in the team guide, and to sanity-check the pipeline
 * (encoding -> fitness -> mlClient -> ml-service) without starting
 * the full Express server.
 *
 * Run from backend/:  node scripts/testRun.js
 * (make sure ml-service is running on ML_SERVICE_URL first, or this
 *  will silently use the physics fallback -- that's fine for a smoke
 *  test, just note the "source" field in the output.)
 */
require("dotenv").config();
const { runQIEA } = require("../services/quantumOptimizer");
const { runClassicalGA } = require("../services/classicalGA");

const ROUTE = { cargoDemand: 15000, distanceNm: 1200, deadlineHours: 96, portTimeHours: 6, seaState: "moderate" };
const WEIGHTS = { costWeight: 1.0, emissionsWeight: 1.0, scheduleWeight: 1.0 };

async function main() {
  console.log("Running QIEA...");
  const qiea = await runQIEA({ route: ROUTE, weights: WEIGHTS, populationSize: 24, generations: 40, seed: 42 });
  console.log(`  fitness=${qiea.result.fitness.toFixed(2)} cost=$${qiea.result.totalCostUsd} ` +
    `emissions=${qiea.result.totalEmissionsTons}t runtime=${qiea.runtimeSeconds}s source=${qiea.predictionSource}`);
  qiea.result.assignments.forEach((a) => console.log("   ", a));

  console.log("\nRunning classical GA...");
  const ga = await runClassicalGA({ route: ROUTE, weights: WEIGHTS, populationSize: 24, generations: 40, seed: 42 });
  console.log(`  fitness=${ga.result.fitness.toFixed(2)} cost=$${ga.result.totalCostUsd} ` +
    `emissions=${ga.result.totalEmissionsTons}t runtime=${ga.runtimeSeconds}s source=${ga.predictionSource}`);
  ga.result.assignments.forEach((a) => console.log("   ", a));

  const improvement = ((ga.result.fitness - qiea.result.fitness) / ga.result.fitness) * 100;
  console.log(`\nQIEA vs GA on this single seed: ${improvement.toFixed(2)}% ` +
    `(${improvement > 0 ? "QIEA better" : "GA better"}) -- run scripts/multiSeedBenchmark.js before presenting a number.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
