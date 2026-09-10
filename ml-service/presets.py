"""
presets.py -- Part 1 reference data (Egreen Quanta / SIH 26138)

Vessel types, fuel types, and sea-state reference data used by BOTH the
physics ground-truth model (fuel_physics.py) and the synthetic data
generator that trains the XGBoost model (train_model.py).

Swap in your team's real numbers here -- nothing downstream needs to
change, this is the single source of truth for the whole project.
"""

VESSEL_TYPES = {
    "small_general_cargo": {"displacement": 8_000,  "deadweight": 5_000,  "engine_power": 4_000,  "admiralty_coeff": 260, "teu_capacity": 350},
    "medium_bulk_carrier":  {"displacement": 22_000, "deadweight": 15_000, "engine_power": 9_000,  "admiralty_coeff": 310, "teu_capacity": 900},
    "large_bulk_carrier":   {"displacement": 48_000, "deadweight": 35_000, "engine_power": 15_000, "admiralty_coeff": 340, "teu_capacity": 1_800},
    "container_ship":       {"displacement": 34_000, "deadweight": 25_000, "engine_power": 18_000, "admiralty_coeff": 300, "teu_capacity": 2_400},
}

# fuel_type -> energy_density (MJ/kg), emissions_factor (t CO2e / t fuel),
# cost_per_ton (USD), sfoc (g/kWh) -- specific fuel oil consumption.
FUEL_TYPES = {
    "hfo":      {"energy_density": 40.5, "emissions_factor": 3.11, "cost_per_ton": 550,   "sfoc": 190},
    "lng":      {"energy_density": 50.0, "emissions_factor": 2.75, "cost_per_ton": 650,   "sfoc": 175},
    "methanol": {"energy_density": 19.9, "emissions_factor": 1.98, "cost_per_ton": 800,   "sfoc": 380},
    "ammonia":  {"energy_density": 18.6, "emissions_factor": 0.10, "cost_per_ton": 1_100, "sfoc": 410},
    "hydrogen": {"energy_density": 120.0,"emissions_factor": 0.00, "cost_per_ton": 1_400, "sfoc": 65},
}

# sea_state -> multiplicative resistance factor applied to hull resistance
SEA_STATES = {
    "calm":     {"factor": 1.00, "wave_height": 0.5, "wind_speed": 6},
    "moderate": {"factor": 1.12, "wave_height": 1.5, "wind_speed": 14},
    "rough":    {"factor": 1.30, "wave_height": 3.0, "wind_speed": 24},
    "severe":   {"factor": 1.55, "wave_height": 5.0, "wind_speed": 34},
}

SPEED_MIN_KN = 8.0
SPEED_MAX_KN = 24.0

VESSEL_NAMES = list(VESSEL_TYPES.keys())
FUEL_NAMES = list(FUEL_TYPES.keys())
SEA_STATE_NAMES = list(SEA_STATES.keys())
