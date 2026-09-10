import { useState } from "react";
import { api } from "../api";

export default function BenchmarkTab() {
  const [numSeeds, setNumSeeds] = useState(8);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const data = await api.benchmark({
        cargoDemand: 15000, distanceNm: 1200, deadlineHours: 96, portTimeHours: 6, seaState: "moderate",
        costWeight: 1, emissionsWeight: 1, scheduleWeight: 1,
        populationSize: 20, generations: 30, numSeeds,
      });
      setSummary(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-1 text-lg font-semibold text-slate-800">Multi-seed Benchmark</h2>
        <p className="mb-4 max-w-3xl text-sm text-slate-500">
          A single run can favor either algorithm by luck of the seed. This runs QIEA vs the
          classical GA across several seeds on the same default route and reports the honest
          aggregate -- the number worth presenting to judges, not a cherry-picked single run.
        </p>
        <div className="flex items-end gap-3">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-600">Number of seeds</span>
            <input type="number" min="2" max="30" className="input w-32" value={numSeeds}
              onChange={(e) => setNumSeeds(Number(e.target.value))} />
          </label>
          <button onClick={run} disabled={loading}
            className="rounded-lg bg-sea-600 px-4 py-2.5 font-medium text-white hover:bg-sea-700 disabled:opacity-50">
            {loading ? "Running..." : "Run benchmark"}
          </button>
        </div>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </div>

      {summary && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <SummaryStat label="QIEA win rate" value={summary.qieaWinRate} />
            <SummaryStat label="Average improvement" value={`${summary.avgImprovementPct}%`} />
            <SummaryStat label="Best case" value={`${summary.bestCase.improvementPct}% (seed ${summary.bestCase.seed})`} />
          </div>
          <p className="text-sm italic text-slate-500">{summary.note}</p>

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2">Seed</th>
                  <th className="px-4 py-2">QIEA fitness</th>
                  <th className="px-4 py-2">GA fitness</th>
                  <th className="px-4 py-2">Improvement</th>
                  <th className="px-4 py-2">Winner</th>
                </tr>
              </thead>
              <tbody>
                {summary.runs.map((r) => (
                  <tr key={r.seed} className="border-t border-slate-100">
                    <td className="px-4 py-2">{r.seed}</td>
                    <td className="px-4 py-2">{r.qieaFitness.toFixed(1)}</td>
                    <td className="px-4 py-2">{r.gaFitness.toFixed(1)}</td>
                    <td className={`px-4 py-2 ${r.improvementPct >= 0 ? "text-leaf-600" : "text-red-600"}`}>
                      {r.improvementPct}%
                    </td>
                    <td className="px-4 py-2">{r.qieaWon ? "QIEA" : "Classical GA"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function SummaryStat({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-xl font-semibold text-slate-800">{value}</div>
    </div>
  );
}
