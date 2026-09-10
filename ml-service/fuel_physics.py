"""
fuel_physics.py -- Part 1: Domain Physics Model

The ground-truth formula that converts (vessel, speed, fuel, sea state,
load) into fuel burn, cost, and emissions per hour. This is what the
synthetic training data is generated from, and it also serves as a
transparent fallback if the trained XGBoost model can't be loaded (so
the optimizer never crashes mid-demo).

Physics used
------------
Admiralty Coefficient formula (a standard naval-architecture
approximation):

    Power (kW) = Displacement^(2/3) * Speed^3 / AdmiraltyCoefficient

Power scales with the CUBE of speed -- this is why "slow steaming" is a
real fuel-saving strategy in shipping, and why speed is such a sensitive
optimizer variable.

Specific Fuel Oil Consumption (SFOC, g/kWh) converts delivered power
into fuel mass burned per hour:

    fuel_kg_per_hr = Power(kW) * SFOC(g/kWh) / 1000

Sea state and cargo load scale hull resistance (and therefore required
power) multiplicatively on top of the calm-water admiralty estimate.
"""
from presets import VESSEL_TYPES, FUEL_TYPES, SEA_STATES


def required_power_kw(displacement: float, speed_kn: float, admiralty_coeff: float,
                       sea_factor: float = 1.0, load_factor: float = 1.0) -> float:
    """Admiralty coefficient formula: Power ~ Displacement^(2/3) * Speed^3 / Coeff."""
    base_power = (displacement ** (2 / 3)) * (speed_kn ** 3) / admiralty_coeff
    return base_power * sea_factor * load_factor


def fuel_burn_rate_tons_per_hr(vessel_type: str, fuel_type: str, speed_kn: float,
                                sea_state: str = "moderate", cargo_load_frac: float = 0.7) -> float:
    """Ground-truth fuel consumption rate in tons/hour for one vessel."""
    v = VESSEL_TYPES[vessel_type]
    f = FUEL_TYPES[fuel_type]
    s = SEA_STATES[sea_state]

    load_factor = 1 + 0.30 * max(0.0, min(1.5, cargo_load_frac))
    power_kw = required_power_kw(v["displacement"], speed_kn, v["admiralty_coeff"],
                                  sea_factor=s["factor"], load_factor=load_factor)
    power_kw = min(power_kw, v["engine_power"] * 1.35)  # can't exceed installed power by much

    fuel_kg_per_hr = power_kw * f["sfoc"] / 1000.0
    return fuel_kg_per_hr / 1000.0  # tons/hr


def evaluate_leg(vessel_type: str, fuel_type: str, speed_kn: float, distance_nm: float,
                  sea_state: str = "moderate", cargo_load_frac: float = 0.7) -> dict:
    """Fuel, cost, emissions, and travel time for one vessel doing one leg."""
    rate = fuel_burn_rate_tons_per_hr(vessel_type, fuel_type, speed_kn, sea_state, cargo_load_frac)
    travel_hours = distance_nm / speed_kn
    fuel_tons = rate * travel_hours

    f = FUEL_TYPES[fuel_type]
    return {
        "fuel_rate_tons_per_hr": round(rate, 4),
        "fuel_tons": round(fuel_tons, 3),
        "travel_hours": round(travel_hours, 2),
        "cost_usd": round(fuel_tons * f["cost_per_ton"], 2),
        "emissions_tons_co2e": round(fuel_tons * f["emissions_factor"], 3),
    }
