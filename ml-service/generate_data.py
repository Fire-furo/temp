"""
generate_data.py -- synthetic "logged voyages" dataset used to train
the Part 2 XGBoost prediction model.

The physics model (fuel_physics.py) acts as ground truth; Gaussian
noise is layered on top to imitate real logbook variance (sensor
error, unmodelled hull fouling, minor weather drift, etc). This is a
deliberate design choice -- see the team guide for the "why synthetic
data" rationale (no licensing/access issues, fully reproducible,
lets us control exactly how noisy the measurements are).
"""
import numpy as np
import pandas as pd

from presets import VESSEL_TYPES, FUEL_TYPES, SEA_STATES, VESSEL_NAMES, FUEL_NAMES, \
    SEA_STATE_NAMES, SPEED_MIN_KN, SPEED_MAX_KN
from fuel_physics import fuel_burn_rate_tons_per_hr

FEATURE_COLUMNS = [
    "vessel_type", "fuel_type", "sea_state", "speed_kn",
    "displacement", "engine_power", "cargo_load_frac", "distance_nm",
]
TARGET_COLUMN = "fuel_rate_tons_per_hr"


def generate_synthetic_data(n_samples: int = 12_000, seed: int = 42, noise_std_frac: float = 0.06) -> pd.DataFrame:
    rng = np.random.default_rng(seed)

    vessel_type = rng.choice(VESSEL_NAMES, size=n_samples)
    fuel_type = rng.choice(FUEL_NAMES, size=n_samples)
    sea_state = rng.choice(SEA_STATE_NAMES, size=n_samples, p=[0.35, 0.35, 0.22, 0.08])
    speed_kn = rng.uniform(SPEED_MIN_KN, SPEED_MAX_KN, size=n_samples)
    cargo_load_frac = rng.uniform(0.2, 1.1, size=n_samples)
    distance_nm = rng.uniform(150, 6000, size=n_samples)

    displacement = np.array([VESSEL_TYPES[v]["displacement"] for v in vessel_type], dtype=float)
    displacement *= rng.uniform(0.95, 1.05, size=n_samples)  # per-hull variance
    engine_power = np.array([VESSEL_TYPES[v]["engine_power"] for v in vessel_type], dtype=float)

    rows = []
    true_rate = np.empty(n_samples)
    for i in range(n_samples):
        true_rate[i] = fuel_burn_rate_tons_per_hr(
            vessel_type[i], fuel_type[i], speed_kn[i], sea_state[i], cargo_load_frac[i]
        )

    noisy_rate = true_rate * (1 + rng.normal(0, noise_std_frac, size=n_samples))
    noisy_rate = np.clip(noisy_rate, 0.05, None)

    df = pd.DataFrame({
        "vessel_type": vessel_type,
        "fuel_type": fuel_type,
        "sea_state": sea_state,
        "speed_kn": speed_kn,
        "displacement": displacement,
        "engine_power": engine_power,
        "cargo_load_frac": cargo_load_frac,
        "distance_nm": distance_nm,
        TARGET_COLUMN: noisy_rate,
    })
    return df


if __name__ == "__main__":
    df = generate_synthetic_data()
    df.to_csv("synthetic_voyages.csv", index=False)
    print(f"Wrote {len(df)} synthetic voyage rows -> synthetic_voyages.csv")
    print(df.describe(numeric_only=True))
