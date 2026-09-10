import { useEffect, useState } from "react";
import { api } from "../api";

export default function ScenarioHistoryTab({ refreshKey }) {
  const [scenarios, setScenarios] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await api.listScenarios();
      setScenarios(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  async function remove(id) {
    try {
      await api.deleteScenario(id);
      setScenarios((s) => s.filter((sc) => sc._id !== id));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Scenario History</h2>
          <p className="text-sm text-slate-500">Saved optimization runs, stored in MongoDB (Part 5).</p>
        </div>
        <button onClick={load} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50">
          Refresh
        </button>
      </div>

      {loading && <p className="text-sm text-slate-400">Loading...</p>}
      {error && (
        <p className="text-sm text-red-600">
          {error} -- if MongoDB isn't running, this tab is unavailable but prediction/optimization
          still work fine.
        </p>
      )}
      {!loading && !error && scenarios.length === 0 && (
        <p className="text-sm text-slate-400">
          No saved scenarios yet -- run an optimization on the Fleet Optimizer tab and click "Save scenario".
        </p>
      )}

      <div className="divide-y divide-slate-100">
        {scenarios.map((s) => (
          <div key={s._id} className="py-3">
            <div className="flex items-center justify-between">
              <button className="text-left" onClick={() => setExpanded(expanded === s._id ? null : s._id)}>
                <div className="font-medium text-slate-800">{s.name}</div>
                <div className="text-xs text-slate-500">
                  {new Date(s.createdAt).toLocaleString()} -- cargo {s.route?.cargoDemand}t, {s.route?.distanceNm}nm,{" "}
                  QIEA improvement {s.quantumImprovementPct}%
                </div>
              </button>
              <button onClick={() => remove(s._id)} className="text-xs text-red-500 hover:underline">
                Delete
              </button>
            </div>
            {expanded === s._id && (
              <div className="mt-3 grid gap-4 rounded-lg bg-slate-50 p-3 text-sm md:grid-cols-2">
                <AlgoSummary title="Quantum-Inspired" algo={s.quantum} />
                <AlgoSummary title="Classical GA" algo={s.classical} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function AlgoSummary({ title, algo }) {
  if (!algo) return null;
  return (
    <div>
      <div className="mb-1 font-semibold text-slate-700">{title}</div>
      <div className="text-slate-600">
        Fitness {algo.fitness?.toFixed?.(1)} -- ${algo.totalCostUsd?.toLocaleString?.()} -- {algo.totalEmissionsTons} t CO2e
      </div>
      <ul className="mt-1 space-y-0.5 text-xs text-slate-500">
        {algo.assignments?.map((a, i) => (
          <li key={i}>
            {a.vesselType?.replaceAll("_", " ")} / {a.fuelType?.toUpperCase()} @ {a.speedKn} kn -- {a.fuelTons} t
          </li>
        ))}
      </ul>
    </div>
  );
}
