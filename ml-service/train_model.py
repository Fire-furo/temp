"""
train_model.py -- Part 2: Data-Driven Fuel Prediction Model

Trains an XGBoost regressor on the synthetic voyage dataset to predict
fuel burn rate (tons/hr) from vessel + fuel + sea-state + speed +
cargo-load + distance. Categorical columns are one-hot encoded inside
a scikit-learn ColumnTransformer so the saved artifact is a full
pipeline -- predictions go in as a named DataFrame, so a missing or
misnamed feature raises a clear error instead of silently mispredicting.

Reports MAE / RMSE / R^2 on a held-out test split (not just training
fit) and also prints the physics-only baseline error for comparison,
which is a genuinely useful "why bother with ML at all" data point:
the physics formula already gets you close, but XGBoost picks up the
non-linear interactions (sea-state x load x speed) that the fixed
formula can't, and would keep improving if retrained on real logged
data with quirks the physics model doesn't capture.

Run:
    python train_model.py
"""
import time

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder
from xgboost import XGBRegressor

from generate_data import generate_synthetic_data, FEATURE_COLUMNS, TARGET_COLUMN
from fuel_physics import fuel_burn_rate_tons_per_hr

CATEGORICAL_COLUMNS = ["vessel_type", "fuel_type", "sea_state"]
NUMERIC_COLUMNS = [c for c in FEATURE_COLUMNS if c not in CATEGORICAL_COLUMNS]
MODEL_PATH = "fuel_xgb_model.joblib"
METRICS_PATH = "model_metrics.json"


def build_pipeline() -> Pipeline:
    preprocessor = ColumnTransformer([
        ("cat", OneHotEncoder(handle_unknown="ignore"), CATEGORICAL_COLUMNS),
        ("num", "passthrough", NUMERIC_COLUMNS),
    ])
    model = XGBRegressor(
        n_estimators=400,
        max_depth=6,
        learning_rate=0.05,
        subsample=0.9,
        colsample_bytree=0.9,
        reg_lambda=1.0,
        objective="reg:squarederror",
        random_state=42,
        n_jobs=-1,
    )
    return Pipeline([("preprocess", preprocessor), ("model", model)])


def physics_baseline_error(X_test: pd.DataFrame, y_test: pd.Series) -> dict:
    preds = X_test.apply(
        lambda r: fuel_burn_rate_tons_per_hr(
            r["vessel_type"], r["fuel_type"], r["speed_kn"], r["sea_state"], r["cargo_load_frac"]
        ), axis=1,
    )
    return {
        "mae": float(mean_absolute_error(y_test, preds)),
        "rmse": float(mean_squared_error(y_test, preds) ** 0.5),
        "r2": float(r2_score(y_test, preds)),
    }


def main():
    print("Generating synthetic training data...")
    df = generate_synthetic_data(n_samples=12_000)
    X = df[FEATURE_COLUMNS]
    y = df[TARGET_COLUMN]
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    print("Training XGBoost regressor...")
    start = time.perf_counter()
    pipeline = build_pipeline()
    pipeline.fit(X_train, y_train)
    train_seconds = time.perf_counter() - start

    preds = pipeline.predict(X_test)
    xgb_metrics = {
        "mae": float(mean_absolute_error(y_test, preds)),
        "rmse": float(mean_squared_error(y_test, preds) ** 0.5),
        "r2": float(r2_score(y_test, preds)),
        "train_seconds": round(train_seconds, 2),
        "n_train": len(X_train),
        "n_test": len(X_test),
    }
    physics_metrics = physics_baseline_error(X_test, y_test)

    print("\nHeld-out test performance:")
    print(f"  XGBoost         MAE={xgb_metrics['mae']:.4f}  RMSE={xgb_metrics['rmse']:.4f}  R2={xgb_metrics['r2']:.4f}")
    print(f"  Physics-only    MAE={physics_metrics['mae']:.4f}  RMSE={physics_metrics['rmse']:.4f}  R2={physics_metrics['r2']:.4f}")
    print("  (physics-only error is the noise floor we added synthetically -- XGBoost should")
    print("   land close to it on synthetic data, and would pull ahead of a fixed formula on")
    print("   real fleet telemetry with quirks the formula doesn't model.)")

    joblib.dump(pipeline, MODEL_PATH)
    pd.Series({**{f"xgb_{k}": v for k, v in xgb_metrics.items()},
               **{f"physics_{k}": v for k, v in physics_metrics.items()}}).to_json(METRICS_PATH)
    print(f"\nSaved model -> {MODEL_PATH}")
    print(f"Saved metrics -> {METRICS_PATH}")


if __name__ == "__main__":
    main()
