import { useEffect, useState } from "react";
import { api } from "./api";
import StatusBadge from "./components/StatusBadge";
import PredictionTab from "./components/PredictionTab";
import OptimizerTab from "./components/OptimizerTab";
import BenchmarkTab from "./components/BenchmarkTab";
import ScenarioHistoryTab from "./components/ScenarioHistoryTab";

const TABS = [
  { id: "predict", label: "Fuel Prediction" },
  { id: "optimize", label: "Fleet Optimizer" },
  { id: "benchmark", label: "Benchmark" },
  { id: "history", label: "Scenario History" },
];

export default function App() {
  const [tab, setTab] = useState("predict");
  const [meta, setMeta] = useState(null);
  const [health, setHealth] = useState(null);
  const [historyKey, setHistoryKey] = useState(0);

  useEffect(() => {
    api.meta().then(setMeta).catch(() => setMeta(null));
    api.health().then(setHealth).catch(() => setHealth(null));
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-sea-50 to-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              Fleetwake <span className="text-sea-600">/ Egreen Quanta</span>
            </h1>
            <p className="text-xs text-slate-500">
              SIH 26138 -- Quantum-Inspired Fuel Consumption Prediction &amp; Green Fleet Optimization
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusBadge ok={!!health?.mlService?.reachable} label={health?.mlService?.reachable ? "ML service online" : "ML service offline"} />
            <StatusBadge ok={!!health?.mongoConnected} label={health?.mongoConnected ? "MongoDB connected" : "MongoDB offline"} />
          </div>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 px-6">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`rounded-t-lg px-4 py-2.5 text-sm font-medium transition ${
                tab === t.id
                  ? "border-b-2 border-sea-600 text-sea-700"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {tab === "predict" && <PredictionTab meta={meta} />}
        {tab === "optimize" && <OptimizerTab meta={meta} onSaved={() => setHistoryKey((k) => k + 1)} />}
        {tab === "benchmark" && <BenchmarkTab />}
        {tab === "history" && <ScenarioHistoryTab refreshKey={historyKey} />}
      </main>

      <footer className="mx-auto max-w-6xl px-6 pb-8 text-center text-xs text-slate-400">
        Quantum-inspired, running entirely on classical hardware. Training data is synthetic,
        generated from the Part 1 physics model.
      </footer>
    </div>
  );
}
