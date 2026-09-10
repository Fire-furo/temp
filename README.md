# Fleetwake v2 -- Egreen Quanta
### SIH 26138 -- Quantum-Inspired Fuel Consumption Prediction & Green Fleet Optimization

This is a full rebuild of the original Fleetwake prototype (the Node/MERN
concept in the team guide, and the Python/Flask `fleetwake_qioa` update)
onto the stack requested for the next milestone:

- **Database:** MongoDB (via Mongoose)
- **Prediction model:** XGBoost, served by a dedicated Python microservice
- **Optimization:** the original Quantum-Inspired Evolutionary Algorithm
  (QIEA) plus a classical GA benchmark, both in Node
- **Frontend:** React + Tailwind CSS (Vite)

It still follows the exact 5-part structure from the team learning guide,
so the "who studies what" split, the judge questions, and the honesty
notes about being *quantum-inspired* (classical hardware) and trained on
*synthetic* data all still apply -- only the implementation underneath
each part changed.

## Architecture

```
fleetwake-v2/
  ml-service/    Python + FastAPI + XGBoost  -> Part 1 (physics) + Part 2 (ML)
  backend/       Node + Express + MongoDB    -> Part 3 (QIEA) + Part 4 (GA) + Part 5 (API/DB)
  frontend/      React + Vite + Tailwind     -> Part 5 (dashboard)
```

Three processes run side by side:

1. **ml-service** (port 8000) trains and serves the XGBoost fuel-prediction
   model over HTTP (`/predict`, `/meta`, `/train`).
2. **backend** (port 5050) owns the domain logic: it calls ml-service for
   fuel predictions, runs the QIEA and classical GA, talks to MongoDB for
   saved scenarios, and exposes the REST API the frontend uses.
3. **frontend** (port 5173, dev) is the React/Tailwind dashboard, proxying
   `/api/*` to the backend.

Why split ml-service out as its own process instead of doing everything in
Node: XGBoost's real implementation and ecosystem (training, evaluation,
`ColumnTransformer` preprocessing) is Python-native. Rather than reimplement
gradient boosting in JavaScript, the backend treats the model as a network
service -- the same pattern you'd use in production, and it means Part 2
(the ML person) can iterate on the model file independently of Part 3/4/5.

## Part-by-part map (for the team learning guide)

| Part | Owner focus | Where it lives now |
|---|---|---|
| **1. Domain physics model** | naval architecture / physics | `ml-service/presets.py`, `ml-service/fuel_physics.py` (admiralty coefficient formula, SFOC), mirrored in `backend/data/presets.js` + `backend/services/fuelModel.js` as the fallback |
| **2. Data-driven prediction** | applied ML | `ml-service/generate_data.py` (synthetic voyages), `ml-service/train_model.py` (XGBoost + held-out MAE/RMSE/R² vs. physics baseline), `ml-service/app.py` (serves it) |
| **3. Quantum-inspired optimizer (QIEA)** | algorithms | `backend/services/encoding.js` (shared chromosome), `backend/services/quantumOptimizer.js` |
| **4. Classical GA benchmark** | algorithms / evaluation | `backend/services/classicalGA.js`, `backend/services/fitness.js` (shared multi-objective scoring), `backend/services/benchmark.js` (multi-seed comparison) |
| **5. Full-stack integration** | web dev | `backend/server.js`, `backend/routes/api.js`, `backend/models/Scenario.js`, `backend/config/db.js`, all of `frontend/` |

The "how the parts fit together" story is unchanged: Part 1 defines what
fuel consumption means physically; Part 2 learns to predict it from data;
Parts 3 and 4 both search for the best fleet plan and both depend on
Part 2's prediction (with Part 1 as its fallback) to score candidates;
Part 5 wraps it all behind an API and dashboard.

## Running it

You need three terminals (plus MongoDB running somewhere, local or Atlas).

### 1. ML service

```bash
cd ml-service
python -m venv .venv && source .venv/bin/activate   # optional but recommended
pip install -r requirements.txt
python train_model.py          # trains XGBoost, saves fuel_xgb_model.joblib + model_metrics.json
uvicorn app:app --host 0.0.0.0 --port 8000
```

### 2. Backend

```bash
cd backend
npm install
npm run dev                    # or: npm start
```

If MongoDB isn't reachable, the backend still starts -- `/api/scenarios`
returns 503 but `/api/predict` and `/api/optimize` work normally (see
`config/db.js` for the graceful-degradation logic, same pattern as the
original guide's Part 5 section).

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open **http://127.0.0.1:5173**. The Vite dev server proxies `/api/*` to
the backend on port 5050 (see `vite.config.js`), so nothing needs a
hardcoded host.

### Optional: Docker Compose

`docker-compose.yml` at the repo root brings up MongoDB + ml-service +
backend together (`docker compose up`). Run the frontend separately with
`npm run dev` for fast iteration during the hackathon; containerize it
later for deployment if you want a single `docker compose up` demo.

### CLI smoke tests (no frontend needed)

```bash
cd backend
node scripts/testRun.js              # runs QIEA + GA once, prints fleet plans
node scripts/multiSeedBenchmark.js 10  # the honest multi-seed win-rate number
```

## API reference

| Method & path | What it does |
|---|---|
| `GET /api/health` | backend + ml-service + MongoDB liveness |
| `GET /api/meta` | vessel/fuel/sea-state presets + ML model metrics |
| `POST /api/predict` | single fuel-rate prediction (Part 2) |
| `POST /api/optimize` | run QIEA + classical GA once, return both plans + convergence history |
| `POST /api/benchmark` | multi-seed QIEA-vs-GA aggregate (win rate, avg improvement) |
| `POST /api/ml/retrain` | trigger a fresh XGBoost training run |
| `GET/POST /api/scenarios`, `GET/DELETE /api/scenarios/:id` | saved optimization runs (MongoDB) |

## Honest notes worth keeping in the presentation

- This is **quantum-inspired**, running entirely on classical hardware --
  no real quantum computer or simulator is involved. `quantumOptimizer.js`
  says so directly in its header comment.
- The rotation-gate implementation is a **simplified** version of the
  published Han-Kim lookup table (fixed-angle rotation toward the best
  known solution, rather than the full multi-case table) -- said upfront,
  it reads as informed engineering judgement, not a gap to be caught out on.
- Training data is **synthetic**, generated from the Part 1 physics
  formula plus noise -- reproducible and license-free, but not real fleet
  telemetry. `train_model.py` also prints the physics-only baseline error
  next to XGBoost's, which is a fair "why bother with ML" data point.
- **Present the multi-seed benchmark, not a single run** -- QIEA and the
  classical GA can each win individual seeds; the `/api/benchmark`
  endpoint and `multiSeedBenchmark.js` script exist specifically to give
  you a defensible aggregate number instead.

## Ideas to extend (per part, if you have time before round 2)

- **Part 1:** add a 6th fuel type (biodiesel/e-methanol) to `presets.py` /
  `presets.js`; add wind/wave *direction*, not just severity.
- **Part 2:** add SHAP feature importances to explain individual
  predictions; retrain on real logged data if/when you get access to it.
- **Part 3:** try an elitism slot that keeps the best qubit state
  untouched; plot alpha² per qubit over generations to show "collapse
  toward a solution" visually.
- **Part 4:** add a true Pareto front (cost vs. emissions) instead of the
  weighted-sum scalarization, as a stretch goal.
- **Part 5:** add auth if multiple teams need separate scenario histories;
  add a CSV export button for a fleet plan.
