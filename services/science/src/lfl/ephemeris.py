"""SPICE observer ephemeris and Horizons comparison."""

from __future__ import annotations

from pathlib import Path

import numpy as np

from lfl.frames import azimuth_elevation, spherical_to_me


_FURNISHED: set[str] = set()
_SHARED: dict[str, "SpiceEphemeris"] = {}


class SpiceEphemeris:
    def __init__(self, kernel_dir: Path) -> None:
        import spiceypy as spice

        self.spice = spice
        self.loaded: list[str] = []
        for name in (
            "naif0012.tls",
            "pck00010.tpc",
            "moon_pa_de421_1900-2050.bpc",
            "moon_080317.tf",
            "de421.bsp",
        ):
            path = kernel_dir / name
            if not path.exists():
                raise FileNotFoundError(path)
            key = str(path.resolve())
            if key not in _FURNISHED:
                spice.furnsh(key)
                _FURNISHED.add(key)
            self.loaded.append(name)
        self.frame = "MOON_ME" if self._frame_ok("MOON_ME") else "IAU_MOON"

    def _frame_ok(self, frame: str) -> bool:
        try:
            self.spice.spkpos("SUN", 0.0, frame, "NONE", "MOON")
            return True
        except Exception:
            return False

    def observer(self, lon_deg: float, lat_deg: float, height_m: float) -> np.ndarray:
        radius_km = 1737.4 + height_m / 1000.0
        return spherical_to_me(lon_deg, lat_deg, radius_km)

    def body_azel(
        self,
        body: str,
        et: float,
        observer: np.ndarray,
    ) -> tuple[float, float, float]:
        position, _ = self.spice.spkpos(body, et, self.frame, "LT+S", "MOON")
        moon_to_body = np.asarray(position, dtype=float)
        azimuth, elevation = azimuth_elevation(observer, moon_to_body)
        distance = float(np.linalg.norm(moon_to_body - observer))
        return azimuth, elevation, distance

    def series(
        self,
        lon_deg: float,
        lat_deg: float,
        height_m: float,
        start_utc: str,
        stop_utc: str,
        step_seconds: float,
    ) -> list[dict]:
        observer = self.observer(lon_deg, lat_deg, height_m)
        start = self.spice.str2et(start_utc)
        stop = self.spice.str2et(stop_utc)
        rows = []
        et = start
        while et <= stop + 1e-6:
            sun_az, sun_el, sun_range = self.body_azel("SUN", et, observer)
            earth_az, earth_el, earth_range = self.body_azel("EARTH", et, observer)
            utc = self.spice.et2utc(et, "ISOC", 0)
            rows.append(
                {
                    "utc": utc,
                    "et": et,
                    "sun_azimuth_deg": sun_az,
                    "sun_elevation_deg": sun_el,
                    "sun_range_km": sun_range,
                    "earth_azimuth_deg": earth_az,
                    "earth_elevation_deg": earth_el,
                    "earth_range_km": earth_range,
                }
            )
            et += step_seconds
        return rows

    def body_unit(self, body: str, et: float) -> list[float]:
        position, _ = self.spice.spkpos(body, et, self.frame, "LT+S", "MOON")
        vector = np.asarray(position, dtype=float)
        unit = vector / np.linalg.norm(vector)
        return [float(unit[0]), float(unit[1]), float(unit[2])]


def shared_ephemeris(kernel_dir: Path) -> SpiceEphemeris:
    key = str(kernel_dir.resolve())
    if key not in _SHARED:
        _SHARED[key] = SpiceEphemeris(kernel_dir)
    return _SHARED[key]


def horizons_azel(
    lon_deg: float,
    lat_deg: float,
    height_km: float,
    command: str,
    start_utc: str,
    stop_utc: str,
    step: str,
) -> list[tuple[str, float, float]]:
    import httpx

    params = {
        "format": "json",
        "COMMAND": f"'{command}'",
        "MAKE_EPHEM": "'YES'",
        "EPHEM_TYPE": "'OBSERVER'",
        "OBJ_DATA": "'NO'",
        "CENTER": "'coord@301'",
        "COORD_TYPE": "'GEODETIC'",
        "SITE_COORD": f"'{lon_deg},{lat_deg},{height_km}'",
        "START_TIME": f"'{start_utc}'",
        "STOP_TIME": f"'{stop_utc}'",
        "STEP_SIZE": f"'{step}'",
        "QUANTITIES": "'4'",
        "ANG_FORMAT": "'DEG'",
        "CAL_FORMAT": "'CAL'",
        "TIME_DIGITS": "'SECONDS'",
    }
    response = httpx.get("https://ssd.jpl.nasa.gov/api/horizons.api", params=params, timeout=90)
    response.raise_for_status()
    text = response.json()["result"]
    table = text.split("$$SOE")[1].split("$$EOE")[0]
    rows = []
    for line in table.strip().splitlines():
        parts = line.split()
        if len(parts) < 5:
            continue
        # Date and time occupy the first tokens; azimuth and elevation are the last two numbers.
        numbers = [float(part) for part in parts if _is_float(part)]
        if len(numbers) < 2:
            continue
        azimuth, elevation = numbers[-2], numbers[-1]
        stamp = " ".join(parts[:2]) if len(parts) > 3 else parts[0]
        rows.append((stamp, azimuth, elevation))
    return rows


def _is_float(value: str) -> bool:
    try:
        float(value)
        return True
    except ValueError:
        return False
