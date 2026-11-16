"""Terrain horizon from explicit points or a gridded elevation model."""

from __future__ import annotations

import numpy as np

from lfl.frames import MOON_RADIUS_KM, azimuth_elevation, ground_direction, me_to_spherical, spherical_to_me


def horizon_from_points(observer: np.ndarray, points: np.ndarray, n_bins: int = 720) -> np.ndarray:
    horizons = np.full(n_bins, -90.0, dtype=float)
    width = 360.0 / n_bins
    for point in np.asarray(points, dtype=float):
        azimuth, elevation = azimuth_elevation(observer, point)
        index = int(azimuth / width) % n_bins
        if elevation > horizons[index]:
            horizons[index] = elevation
    return horizons


def horizon_peak(horizons: np.ndarray) -> tuple[float, float]:
    index = int(np.argmax(horizons))
    azimuth = (index + 0.5) * (360.0 / len(horizons))
    return azimuth % 360.0, float(horizons[index])


def sample_horizon(
    observer: np.ndarray,
    elevation_sampler,
    *,
    n_bins: int = 720,
    max_range_km: float = 250.0,
    step_km: float = 0.24,
    min_range_km: float = 0.05,
) -> np.ndarray:
    """Maximum terrain elevation angle along each azimuth.

    elevation_sampler(lon_deg, lat_deg) returns height in meters, or None outside coverage.
    """
    horizons = np.full(n_bins, -90.0, dtype=float)
    ranges = np.arange(min_range_km, max_range_km + step_km, step_km)
    for index in range(n_bins):
        azimuth = (index + 0.5) * (360.0 / n_bins)
        best = -90.0
        for surface_range in ranges:
            direction = ground_direction(observer, azimuth, float(surface_range))
            lon, lat, _ = me_to_spherical(direction)
            height_m = elevation_sampler(lon, lat)
            if height_m is None or not np.isfinite(height_m):
                continue
            terrain = spherical_to_me(lon, lat, MOON_RADIUS_KM + float(height_m) / 1000.0)
            _, elevation = azimuth_elevation(observer, terrain)
            if elevation > best:
                best = elevation
        horizons[index] = best
    return horizons
