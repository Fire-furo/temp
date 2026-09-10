import { useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { api } from "../api";

const DEFAULT_ROUTE = { cargoDemand: 15000, distanceNm: 1200, deadlineHours: 96, portTimeHours: 6, seaState: "moderate" };
const DEFAULT_WEIGHTS = { costWeight: 1, emissionsWeight: 1, scheduleWeight: 1 };

export default function OptimizerTab({ meta, onSaved }) {
  const seaStateNames = Object.keys(meta?.seaStates || {});
  const [route, setRoute] = useState(DEFAULT_ROUTE);
  const [weights, setWeights] = useState(DEFAULT_WEIGHTS);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [scenarioName, setScenarioName] = useState("");
  const [saveMsg, setSaveMsg] = useState(null);

  const updateRoute = (key) => (e) => setRoute((r) => ({ ...r, [key]: e.target.type === "number" ? Number(e.target.value) : e.target.value }));
  const updateWeight = (key) => (e) => setWeights((w) => ({ ...w, [key]: Number(e.target.value) }));

  async function runOptimize() {
    setLoading(true);
    setError(null);
    setSaveMsg(null);
    try {
      const data = await api.optimize({ ...route, ...weights, populationSize: 24, generations: 40 });
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function saveScenario() {
    if (!result) return;
    try {
      await api.saveScenario({
        name: scenarioName || `Scenario ${new Date().toLocaleString()}`,
        route: {
          cargoDemand: route.cargoDemand,
          distanceNm: route.distanceNm,
          deadlineHours: route.deadlineHours,
          portTimeHours: route.portTimeHours,
          seaState: route.seaState,
        },
        weights: { costWeight: weights.costWeight, emissionsWeight: weights.emissionsWeight, scheduleWeight: weights.scheduleWeight },
        quantum: toAlgoDoc(result.quantum),
        classical: toAlgoDoc(result.classical),
        quantumImprovementPct: result.quantumImprovementPct,
      });
      setSaveMsg("Saved to scenario history.");
      onSaved && onSaved();
    } catch (err) {
      setSaveMsg(`Could not save: ${err.message}`);
    }
  }

  const chartData = result
    ? result.quantum.history.map((qVal, i) => ({ gen: i, QIEA: qVal, GA: result.classical.history[i] }))
    : [];

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-1">
          <h2 className="mb-1 text-lg font-semibold text-slate-800">Fleet Optimizer</h2>
          <p className="mb-4 text-sm text-slate-500">
            Parts 3 &amp; 4 -- the quantum-inspired evolutionary algorithm and the classical GA
            benchmark, both searching the same encoded fleet-plan space.
          </p>
          <div className="space-y-3">
            <Field label="Cargo demand (t)">
              <input type="number" className="input" value={route.cargoDemand} onChange={updateRoute("cargoDemand")} />
            </Field>
            <Field label="Distance (nm)">
              <input type="number" className="input" value={route.distanceNm} onChange={updateRoute("distanceNm")} />
            </Field>
            <Field label="Deadline (hours)">
              <input type="number" className="input" value={route.deadlineHours} onChange={updateRoute("deadlineHours")} />
            </Field>
            <Field label="Port time (hours)">
              <input type="number" className="input" value={route.portTimeHours} onChange={updateRoute("portTimeHours")} />
            </Field>
            <Field label="Sea state">
              <select className="input" value={route.seaState} onChange={updateRoute("seaState")}>
                {seaStateNames.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </Field>

            <div className="pt-2">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Objective weights
              </div>
              <SliderField label={`Cost weight: ${weights.costWeight.toFixed(1)}`} value={weights.costWeight} onChange={updateWeight("costWeight")} />
              <SliderField label={`Emissions weight: ${weights.emissionsWeight.toFixed(1)}`} value={weights.emissionsWeight} onChange={updateWeight("emissionsWeight")} />
              <SliderField label={`Schedule-risk weight: ${weights.scheduleWeight.toFixed(1)}`} value={weights.scheduleWeight} onChange={updateWeight("scheduleWeight")} />
            </div>

            <button onClick={runOptimize} disabled={loading}
              className="w-full rounded-lg bg-sea-600 px-4 py-2.5 font-medium text-white transition hover:bg-sea-700 disabled:opacity-50">
              {loading ? "Optimizing..." : "Run optimization"}
            </button>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Convergence</h3>
          {!result && <p className="text-sm text-slate-400">Run an optimization to see convergence and fleet plans.</p>}
          {result && (
            <>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="gen" tick={{ fontSize: 12 }} label={{ value: "Generation", position: "insideBottom", offset: -4, fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} width={80} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="QIEA" stroke="#0f6fb8" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="GA" stroke="#f59e0b" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Lower fitness is better (it's a cost/emissions/risk score being minimized). This is a
                single seed -- see the Benchmark tab for the multi-seed win rate before presenting a number.
              </p>
            </>
          )}
        </div>
      </div>

      {result && (
        <div className="grid gap-6 md:grid-cols-2">
          <AlgorithmCard title="Quantum-Inspired (QIEA)" algo={result.quantum} accent="sea" />
          <AlgorithmCard title="Classical GA (baseline)" algo={result.classical} accent="amber" />
        </div>
      )}

      {result && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-slate-600">
              QIEA vs GA on this run:{" "}
              <b className={result.quantumImprovementPct >= 0 ? "text-leaf-600" : "text-red-600"}>
                {result.quantumImprovementPct}%
              </b>
            </span>
            <div className="ml-auto flex items-center gap-2">
              <input
                className="input w-56"
                placeholder="Scenario name"
                value={scenarioName}
                onChange={(e) => setScenarioName(e.target.value)}
              />
              <button onClick={saveScenario}
                className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900">
                Save scenario
              </button>
            </div>
          </div>
          {saveMsg && <p className="mt-2 text-sm text-slate-500">{saveMsg}</p>}
        </div>
      )}
    </div>
  );
}

function toAlgoDoc(algo) {
  return {
    algorithm: algo.algorithm,
    fitness: algo.result.fitness,
    totalCostUsd: algo.result.totalCostUsd,
    totalEmissionsTons: algo.result.totalEmissionsTons,
    totalCapacity: algo.result.totalCapacity,
    capacityShortfall: algo.result.capacityShortfall,
    maxTravelTimeHours: algo.result.maxTravelTimeHours,
    assignments: algo.result.assignments,
    convergenceHistory: algo.history,
    runtimeSeconds: algo.runtimeSeconds,
    generations: algo.generations,
    populationSize: algo.populationSize,
  };
}

function AlgorithmCard({ title, algo, accent }) {
  const accentClass = accent === "sea" ? "text-sea-600" : "text-amber-600";
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className={`mb-3 text-base font-semibold ${accentClass}`}>{title}</h3>
      <div className="mb-4 grid grid-cols-2 gap-3 text-sm">
        <Stat label="Fitness" value={algo.result.fitness.toFixed(1)} />
        <Stat label="Cost" value={`$${algo.result.totalCostUsd.toLocaleString()}`} />
        <Stat label="Emissions" value={`${algo.result.totalEmissionsTons} t`} />
        <Stat label="Runtime" value={`${algo.runtimeSeconds}s`} />
      </div>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="text-xs uppercase text-slate-400">
            <th className="pb-1">Vessel</th>
            <th className="pb-1">Fuel</th>
            <th className="pb-1">Speed</th>
            <th className="pb-1">Fuel used</th>
          </tr>
        </thead>
        <tbody>
          {algo.result.assignments.map((a, i) => (
            <tr key={i} className="border-t border-slate-100">
              <td className="py-1.5">{a.vesselType.replaceAll("_", " ")}</td>
              <td className="py-1.5 uppercase">{a.fuelType}</td>
              <td className="py-1.5">{a.speedKn} kn</td>
              <td className="py-1.5">{a.fuelTons} t</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-600">{label}</span>
      {children}
    </label>
  );
}

function SliderField({ label, value, onChange }) {
  return (
    <label className="mb-2 block">
      <span className="mb-1 block text-xs text-slate-500">{label}</span>
      <input type="range" min="0" max="3" step="0.1" value={value} onChange={onChange} className="w-full accent-sea-600" />
    </label>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-lg bg-slate-50 p-2.5">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-sm font-semibold text-slate-800">{value}</div>
    </div>
  );
}
