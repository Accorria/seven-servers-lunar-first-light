"""MOON_ME spherical geometry and local azimuth/elevation."""

from __future__ import annotations

import numpy as np

MOON_RADIUS_KM = 1737.4


def spherical_to_me(lon_deg: float, lat_deg: float, radius_km: float) -> np.ndarray:
    lon = np.deg2rad(lon_deg)
    lat = np.deg2rad(lat_deg)
    cos_lat = np.cos(lat)
    return np.array(
        [
            radius_km * cos_lat * np.cos(lon),
            radius_km * cos_lat * np.sin(lon),
            radius_km * np.sin(lat),
        ],
        dtype=float,
    )


def me_to_spherical(position: np.ndarray) -> tuple[float, float, float]:
    vector = np.asarray(position, dtype=float)
    radius = float(np.linalg.norm(vector))
    if radius == 0:
        raise ValueError("zero position")
    lat = float(np.rad2deg(np.arcsin(np.clip(vector[2] / radius, -1.0, 1.0))))
    lon = float(np.rad2deg(np.arctan2(vector[1], vector[0]))) % 360.0
    return lon, lat, radius


def local_enu(position: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Return up, east, north. Azimuth zero is local north, clockwise toward east."""
    up = np.asarray(position, dtype=float)
    up = up / np.linalg.norm(up)
    pole = np.array([0.0, 0.0, 1.0])
    east = np.cross(pole, up)
    east_norm = float(np.linalg.norm(east))
    if east_norm < 1e-10:
        east = np.array([0.0, 1.0, 0.0])
        east = east - up * float(np.dot(east, up))
        east_norm = float(np.linalg.norm(east))
    east = east / east_norm
    north = np.cross(up, east)
    north = north / np.linalg.norm(north)
    return up, east, north


def azimuth_elevation(observer: np.ndarray, target: np.ndarray) -> tuple[float, float]:
    up, east, north = local_enu(observer)
    line = np.asarray(target, dtype=float) - np.asarray(observer, dtype=float)
    distance = float(np.linalg.norm(line))
    if distance == 0:
        raise ValueError("observer and target coincide")
    direction = line / distance
    elevation = float(np.rad2deg(np.arcsin(np.clip(float(np.dot(direction, up)), -1.0, 1.0))))
    azimuth = float(np.rad2deg(np.arctan2(float(np.dot(line, east)), float(np.dot(line, north))))) % 360.0
    return azimuth, elevation


def point_at_azimuth_elevation(
    observer: np.ndarray,
    azimuth_deg: float,
    elevation_deg: float,
    distance_km: float,
) -> np.ndarray:
    up, east, north = local_enu(observer)
    azimuth = np.deg2rad(azimuth_deg)
    elevation = np.deg2rad(elevation_deg)
    horizontal = np.sin(azimuth) * east + np.cos(azimuth) * north
    direction = np.sin(elevation) * up + np.cos(elevation) * horizontal
    return np.asarray(observer, dtype=float) + distance_km * direction


def ground_direction(observer: np.ndarray, azimuth_deg: float, range_km: float) -> np.ndarray:
    """Unit vector from the Moon center toward the ground point at a surface range."""
    up, east, north = local_enu(observer)
    azimuth = np.deg2rad(azimuth_deg)
    horizontal = np.sin(azimuth) * east + np.cos(azimuth) * north
    angle = range_km / MOON_RADIUS_KM
    direction = np.cos(angle) * up + np.sin(angle) * horizontal
    return direction / np.linalg.norm(direction)
