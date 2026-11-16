"""Sunlight and Earth-visibility windows."""

from __future__ import annotations

import math

import numpy as np

EARTH_RADIUS_KM = 6378.137
SUN_RADIUS_KM = 695700.0


def angular_radius_deg(body_radius_km: float, range_km: float) -> float:
    if range_km <= body_radius_km:
        return 90.0
    return float(math.degrees(math.asin(body_radius_km / range_km)))


def horizon_at(horizons: np.ndarray, azimuth_deg: float) -> float:
    width = 360.0 / len(horizons)
    index = int((azimuth_deg % 360.0) / width) % len(horizons)
    return float(horizons[index])


def visibility_row(
    horizons: np.ndarray,
    sun_azimuth: float,
    sun_elevation: float,
    sun_range_km: float,
    earth_azimuth: float,
    earth_elevation: float,
    earth_range_km: float,
) -> dict:
    sun_horizon = horizon_at(horizons, sun_azimuth)
    earth_horizon = horizon_at(horizons, earth_azimuth)
    sun_limb = angular_radius_deg(SUN_RADIUS_KM, sun_range_km)
    earth_limb = angular_radius_deg(EARTH_RADIUS_KM, earth_range_km)
    return {
        "sun_azimuth_deg": sun_azimuth,
        "sun_elevation_deg": sun_elevation,
        "sun_horizon_deg": sun_horizon,
        "sun_center_clear": sun_elevation > sun_horizon,
        "any_sunlight": sun_elevation + sun_limb > sun_horizon,
        "earth_azimuth_deg": earth_azimuth,
        "earth_elevation_deg": earth_elevation,
        "earth_horizon_deg": earth_horizon,
        "earth_center_clear": earth_elevation > earth_horizon,
        "any_earth_disk": earth_elevation + earth_limb > earth_horizon,
    }


def _runs(flags: list[bool]) -> list[tuple[int, int, bool]]:
    if not flags:
        return []
    runs: list[tuple[int, int, bool]] = []
    start = 0
    current = flags[0]
    for index, flag in enumerate(flags[1:], start=1):
        if flag != current:
            runs.append((start, index, current))
            start = index
            current = flag
    runs.append((start, len(flags), current))
    return runs


def summarize_flags(flags: list[bool], step_seconds: float) -> dict:
    """Aggregate a boolean series. Edge-touching gaps are window-bounded."""
    runs = _runs(flags)
    true_windows = []
    interior_false = []
    bounded_false = []
    last = len(flags)
    for start, stop, value in runs:
        hours = (stop - start) * step_seconds / 3600.0
        record = {"start_index": start, "stop_index": stop, "duration_hours": hours}
        if value:
            true_windows.append(record)
            continue
        if start == 0 or stop == last:
            bounded_false.append(record)
        else:
            interior_false.append(record)
    true_count = sum(1 for flag in flags if flag)
    longest_interior = max((item["duration_hours"] for item in interior_false), default=0.0)
    longest_bounded = max((item["duration_hours"] for item in bounded_false), default=0.0)
    return {
        "samples": len(flags),
        "true_samples": true_count,
        "true_fraction": (true_count / len(flags)) if flags else 0.0,
        "true_hours": true_count * step_seconds / 3600.0,
        "windows": true_windows,
        "interior_interruptions": interior_false,
        "window_bounded_interruptions": bounded_false,
        "longest_interior_interruption_hours": longest_interior,
        "longest_window_bounded_interruption_hours": longest_bounded,
    }
