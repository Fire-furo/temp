"""
app.py -- Part 2 ML microservice.

A small FastAPI service that wraps the trained XGBoost pipeline
(fuel_xgb_model.joblib) and exposes it over HTTP so the Node/Express
backend (and its quantum + classical optimizers) can call it without
needing a Python runtime themselves.

Endpoints
---------
GET  /health           liveness + whether the model is loaded
GET  /meta              vessel/fuel/sea-state presets + model metrics
POST /predict           batch predict fuel_rate_tons_per_hr for N rows
POST /train              (re)train the model on fresh synthetic data

Design note: predictions are batched (a list of rows in, a list of
rates out) rather than one HTTP round-trip per row, because the
quantum-inspired optimizer and the classical GA both call this once
per candidate fleet plan per generation -- batching keeps a
20-population/60-generation run in seconds instead of minutes.

Run:
    pip install -r requirements.txt
    python train_model.py      # only needed once, or after presets.py changes
    uvicorn app:app --host 0.0.0.0 --port 8000
"""
import json
import os
import subprocess
import sys

import joblib
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from presets import VESSEL_TYPES, FUEL_TYPES, SEA_STATES, SPEED_MIN_KN, SPEED_MAX_KN
from fuel_physics import fuel_burn_rate_tons_per_hr
from generate_data import FEATURE_COLUMNS

MODEL_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fuel_xgb_model.joblib")
METRICS_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "model_metrics.json")

app = FastAPI(title="Fleetwake Fuel Prediction Service")
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
)

_model = None
_metrics = {}


def _load_model():
    global _model, _metrics
    if os.path.exists(MODEL_PATH):
        _model = joblib.load(MODEL_PATH)
    else:
        _model = None
        print(f"[ml-service] WARNING: {MODEL_PATH} not found -- falling back to the physics "
              f"formula until 'python train_model.py' is run.", file=sys.stderr)
    if os.path.exists(METRICS_PATH):
        with open(METRICS_PATH) as f:
            _metrics = json.load(f)


_load_model()


class PredictRow(BaseModel):
    vessel_type: str
    fuel_type: str
    sea_state: str = "moderate"
    speed_kn: float
    displacement: float | None = None
    engine_power: float | None = None
    cargo_load_frac: float = 0.7
    distance_nm: float = 1000.0


class PredictRequest(BaseModel):
    rows: list[PredictRow]


@app.get("/health")
def health():
    return {"status": "ok", "model_loaded": _model is not None}


@app.get("/meta")
def meta():
    return {
        "vessel_types": VESSEL_TYPES,
        "fuel_types": FUEL_TYPES,
        "sea_states": SEA_STATES,
        "speed_range_kn": {"min": SPEED_MIN_KN, "max": SPEED_MAX_KN},
        "model_metrics": _metrics,
        "model_loaded": _model is not None,
    }


def _fallback_predict(rows: list[PredictRow]) -> list[float]:
    return [
        fuel_burn_rate_tons_per_hr(r.vessel_type, r.fuel_type, r.speed_kn, r.sea_state, r.cargo_load_frac)
        for r in rows
    ]


@app.post("/predict")
def predict(req: PredictRequest):
    if not req.rows:
        return {"predictions": [], "source": "none"}

    if _model is None:
        return {"predictions": _fallback_predict(req.rows), "source": "physics_fallback"}

    try:
        records = []
        for r in req.rows:
            v = VESSEL_TYPES.get(r.vessel_type, {})
            records.append({
                "vessel_type": r.vessel_type,
                "fuel_type": r.fuel_type,
                "sea_state": r.sea_state,
                "speed_kn": r.speed_kn,
                "displacement": r.displacement or v.get("displacement", 20_000),
                "engine_power": r.engine_power or v.get("engine_power", 9_000),
                "cargo_load_frac": r.cargo_load_frac,
                "distance_nm": r.distance_nm,
            })
        df = pd.DataFrame(records)[FEATURE_COLUMNS]
        preds = _model.predict(df)
        return {"predictions": [float(p) for p in preds], "source": "xgboost"}
    except Exception as exc:  # noqa: BLE001 -- degrade gracefully rather than 500 mid-demo
        return {"predictions": _fallback_predict(req.rows), "source": "physics_fallback_error",
                "error": str(exc)}


@app.post("/train")
def train():
    """Retrain synchronously (blocks a few seconds) and reload the model."""
    result = subprocess.run(
        [sys.executable, os.path.join(os.path.dirname(os.path.abspath(__file__)), "train_model.py")],
        capture_output=True, text=True,
    )
    if result.returncode != 0:
        raise HTTPException(status_code=500, detail=result.stderr[-2000:])
    _load_model()
    return {"status": "trained", "metrics": _metrics, "log_tail": result.stdout[-1500:]}
