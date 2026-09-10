import { useState } from "react";
import { api } from "../api";

export default function PredictionTab({ meta }) {
  const vesselNames = Object.keys(meta?.vesselTypes || {});
  const fuelNames = Object.keys(meta?.fuelTypes || {});
  const seaStateNames = Object.keys(meta?.seaStates || {});

  const [form, setForm] = useState({
    vesselType: "small_general_cargo",
    fuelType: "hfo",
    seaState: "moderate",
    speedKn: 16,
    distanceNm: 1200,
    cargoLoadFrac: 0.7,
  });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const update = (key) => (e) =>
    setForm((f) => ({ ...f, [key]: e.target.id === "speedkn" ? Number(e.target.value) : e.target.value }));

  async function runPredict(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const data = await api.predict(form);
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const modelMetrics = meta?.mlModel?.model_metrics;

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-1 text-lg font-semibold text-slate-800">Fuel Consumption Prediction</h2>
        <p className="mb-4 text-sm text-slate-500">
          Part 2 -- predicts fuel burn rate with the trained XGBoost model, served by the ML
          microservice. Falls back to the Part 1 physics formula if that service is unreachable.
        </p>
        <form className="space-y-4" onSubmit={runPredict}>
          <Field label="Vessel type">
            <select className="input" value={form.vesselType} onChange={update("vesselType")}>
              {vesselNames.map((v) => (
                <option key={v} value={v}>
                  {v.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Fuel type">
            <select className="input" value={form.fuelType} onChange={update("fuelType")}>
              {fuelNames.map((f) => (
                <option key={f} value={f}>
                  {f.toUpperCase()}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Sea state">
            <select className="input" value={form.seaState} onChange={update("seaState")}>
              {seaStateNames.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>
          <Field label={`Speed: ${form.speedKn} kn`}>
            <input id="speedkn" type="range" min="8" max="24" step="0.5" value={form.speedKn} onChange={update("speedKn")}
              className="w-full accent-sea-600" />
          </Field>
          <Field label={`Cargo load: ${Math.round(form.cargoLoadFrac * 100)}%`}>
            <input type="range" min="0.1" max="1.1" step="0.05" value={form.cargoLoadFrac} onChange={update("cargoLoadFrac")}
              className="w-full accent-sea-600" />
          </Field>
          <Field label="Distance (nautical miles)">
            <input type="number" className="input" value={form.distanceNm} onChange={update("distanceNm")} />
          </Field>
          <button type="submit" disabled={loading}
            className="w-full rounded-lg bg-sea-600 px-4 py-2.5 font-medium text-white transition hover:bg-sea-700 disabled:opacity-50">
            {loading ? "Predicting..." : "Predict fuel consumption"}
          </button>
        </form>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </div>

      <div className="space-y-6">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Result</h3>
          {!result && <p className="text-sm text-slate-400">Run a prediction to see results here.</p>}
          {result && (
            <div className="grid grid-cols-2 gap-4">
              <Stat label="Fuel rate" value={`${result.fuelRateTonsPerHr} t/hr`} />
              <Stat label="Travel time" value={`${result.travelHours} hr`} />
              <Stat label="Fuel burned" value={`${result.fuelTons} t`} />
              <Stat label="Cost" value={`$${result.costUsd.toLocaleString()}`} />
              <Stat label="Emissions" value={`${result.emissionsTons} t CO2e`} />
              <Stat label="Source" value={result.source === "xgboost" ? "XGBoost model" : "Physics fallback"} />
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Model performance</h3>
          {modelMetrics ? (
            <ul className="space-y-1 text-sm text-slate-600">
              <li>XGBoost R²: <b>{Number(modelMetrics.xgb_r2 ?? 0).toFixed(4)}</b></li>
              <li>XGBoost MAE: <b>{Number(modelMetrics.xgb_mae ?? 0).toFixed(4)}</b> t/hr</li>
              <li>Physics-only baseline R²: <b>{Number(modelMetrics.physics_r2 ?? 0).toFixed(4)}</b></li>
              <li className="pt-1 text-xs text-slate-400">
                Held-out test metrics from the last training run (train_model.py).
              </li>
            </ul>
          ) : (
            <p className="text-sm text-slate-400">
              Metrics not available yet -- run <code>python train_model.py</code> in ml-service/, or
              hit "retrain" from the health check.
            </p>
          )}
        </div>
      </div>
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

function Stat({ label, value }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-base font-semibold text-slate-800">{value}</div>
    </div>
  );
}
