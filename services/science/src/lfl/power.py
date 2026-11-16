"""Collector power and joule-conserving storage."""

from __future__ import annotations

import math
from typing import Literal

import numpy as np

CollectorMode = Literal["stationary", "tilted", "sun_tracking"]
JOULES_PER_WH = 3600.0
SOLAR_CONSTANT_W_M2 = 1361.0
SOLAR_CONSTANT_SOURCE = "nominal solar constant 1361 W/m^2, cited as a standard value pending a pinned TSIS/SORCE product"


def sun_vector(azimuth_deg: float, elevation_deg: float) -> np.ndarray:
    azimuth = math.radians(azimuth_deg)
    elevation = math.radians(elevation_deg)
    horizontal = math.cos(elevation)
    return np.array(
        [math.sin(azimuth) * horizontal, math.cos(azimuth) * horizontal, math.sin(elevation)],
        dtype=float,
    )


def panel_normal(
    mode: CollectorMode,
    sun_azimuth_deg: float,
    sun_elevation_deg: float,
    *,
    tilt_deg: float = 0.0,
    panel_azimuth_deg: float = 0.0,
    track_min_elevation_deg: float = 0.0,
) -> np.ndarray:
    if mode == "stationary":
        return np.array([0.0, 0.0, 1.0])
    if mode == "tilted":
        tilt = math.radians(tilt_deg)
        facing = math.radians(panel_azimuth_deg)
        face = np.array([math.sin(facing), math.cos(facing), 0.0])
        normal = math.cos(tilt) * np.array([0.0, 0.0, 1.0]) + math.sin(tilt) * face
        return normal / np.linalg.norm(normal)
    sun = sun_vector(sun_azimuth_deg, sun_elevation_deg)
    if sun_elevation_deg < track_min_elevation_deg or float(np.linalg.norm(sun)) == 0:
        return np.array([0.0, 0.0, 1.0])
    return sun / np.linalg.norm(sun)


def cos_incidence(
    mode: CollectorMode,
    sun_azimuth_deg: float,
    sun_elevation_deg: float,
    *,
    tilt_deg: float = 0.0,
    panel_azimuth_deg: float = 0.0,
    track_min_elevation_deg: float = 0.0,
) -> float:
    sun = sun_vector(sun_azimuth_deg, sun_elevation_deg)
    norm = float(np.linalg.norm(sun))
    if norm == 0:
        return 0.0
    normal = panel_normal(
        mode,
        sun_azimuth_deg,
        sun_elevation_deg,
        tilt_deg=tilt_deg,
        panel_azimuth_deg=panel_azimuth_deg,
        track_min_elevation_deg=track_min_elevation_deg,
    )
    return max(0.0, float(np.dot(normal, sun / norm)))


def electrical_power_w(
    sunlit: bool,
    sun_azimuth_deg: float,
    sun_elevation_deg: float,
    *,
    mode: CollectorMode = "stationary",
    area_m2: float = 1.0,
    efficiency: float = 0.3,
    tilt_deg: float = 0.0,
    panel_azimuth_deg: float = 0.0,
) -> float:
    if not sunlit:
        return 0.0
    cosine = cos_incidence(
        mode,
        sun_azimuth_deg,
        sun_elevation_deg,
        tilt_deg=tilt_deg,
        panel_azimuth_deg=panel_azimuth_deg,
    )
    return SOLAR_CONSTANT_W_M2 * area_m2 * efficiency * cosine


def energy_step(
    stored_j: float,
    capacity_j: float,
    generated_j: float,
    demand_j: float,
    loss_j: float,
    eta_charge: float,
    eta_discharge: float,
) -> dict:
    """Advance storage by one step. Unmet demand is not invented."""
    if not 0 < eta_charge <= 1 or not 0 < eta_discharge <= 1:
        raise ValueError("efficiencies must be in (0, 1]")
    if capacity_j < 0 or stored_j < -1e-9 or stored_j > capacity_j + 1e-6:
        raise ValueError("storage is outside capacity")
    need = demand_j + loss_j
    removed = 0.0
    stored_delta = 0.0
    charge_bus = 0.0
    curtail = 0.0
    if generated_j >= need:
        surplus = generated_j - need
        room = capacity_j - stored_j
        stored_delta = min(room, surplus * eta_charge)
        charge_bus = stored_delta / eta_charge if eta_charge else 0.0
        curtail = surplus - charge_bus
        delivered = demand_j
        loss_served = loss_j
        unmet = 0.0
    else:
        deficit = need - generated_j
        removed = min(stored_j, deficit / eta_discharge)
        from_battery = removed * eta_discharge
        supplied = generated_j + from_battery
        fraction = 1.0 if need == 0 else supplied / need
        delivered = demand_j * fraction
        loss_served = loss_j * fraction
        unmet = demand_j - delivered
        stored_delta = -removed
    new_stored = min(capacity_j, max(0.0, stored_j + stored_delta))
    available = generated_j + eta_discharge * removed
    used = delivered + loss_served + charge_bus
    return {
        "stored_j": new_stored,
        "delivered_j": delivered,
        "unmet_j": unmet,
        "loss_served_j": loss_served,
        "charge_bus_j": charge_bus,
        "removed_j": removed,
        "curtail_j": curtail,
        "available_j": available,
        "used_j": used,
        "balance_j": available - (used + curtail),
    }
