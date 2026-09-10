/**
 * api.js -- thin fetch wrapper around the backend's four endpoint
 * groups (/meta, /predict, /optimize, /scenarios) plus /benchmark and
 * /health. All requests go through the Vite dev proxy (see
 * vite.config.js) so this file never hardcodes a host.
 */
const BASE = "/api";

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request to ${path} failed (${res.status})`);
  return data;
}

export const api = {
  health: () => request("/health"),
  meta: () => request("/meta"),
  predict: (payload) => request("/predict", { method: "POST", body: JSON.stringify(payload) }),
  optimize: (payload) => request("/optimize", { method: "POST", body: JSON.stringify(payload) }),
  benchmark: (payload) => request("/benchmark", { method: "POST", body: JSON.stringify(payload) }),
  retrainModel: () => request("/ml/retrain", { method: "POST" }),
  listScenarios: () => request("/scenarios"),
  saveScenario: (payload) => request("/scenarios", { method: "POST", body: JSON.stringify(payload) }),
  getScenario: (id) => request(`/scenarios/${id}`),
  deleteScenario: (id) => request(`/scenarios/${id}`, { method: "DELETE" }),
};
