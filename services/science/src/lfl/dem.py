"""PDS IMG and GeoTIFF elevation readers."""

from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass
from pathlib import Path

import numpy as np

from lfl.frames import MOON_RADIUS_KM


@dataclass
class ElevationGrid:
    name: str
    path: Path
    sha256: str
    heights_m: np.ndarray
    pixel_m: float
    min_x_m: float
    max_y_m: float
    radius_km: float
    frame: str
    citation: str
    nodata: float | None = None

    def sample(self, x_m: float, y_m: float) -> float | None:
        if x_m < self.min_x_m or y_m > self.max_y_m:
            return None
        column = int((x_m - self.min_x_m) / self.pixel_m)
        row = int((self.max_y_m - y_m) / self.pixel_m)
        if row < 0 or column < 0 or row >= self.heights_m.shape[0] or column >= self.heights_m.shape[1]:
            return None
        value = float(self.heights_m[row, column])
        if self.nodata is not None and value == self.nodata:
            return None
        if not np.isfinite(value) or value < -20000 or value > 20000:
            return None
        return value

    def contains(self, x_m: float, y_m: float) -> bool:
        return self.sample(x_m, y_m) is not None

    def highest_pixel(self) -> tuple[float, float, float, int, int]:
        grid = np.array(self.heights_m, dtype=float, copy=True)
        if self.nodata is not None:
            grid[grid == self.nodata] = -np.inf
        grid[~np.isfinite(grid)] = -np.inf
        index = np.unravel_index(int(np.argmax(grid)), grid.shape)
        row, column = int(index[0]), int(index[1])
        x_m = self.min_x_m + (column + 0.5) * self.pixel_m
        y_m = self.max_y_m - (row + 0.5) * self.pixel_m
        return x_m, y_m, float(self.heights_m[row, column]), row, column


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def stereographic_xy(lon_deg: float, lat_deg: float, radius_m: float = MOON_RADIUS_KM * 1000.0) -> tuple[float, float]:
    """South-polar stereographic matching PROJ +proj=stere +lat_0=-90 +lon_0=0 +R=1737400.

    Positive Y points toward east longitude 0.
    """
    lon = np.deg2rad(lon_deg)
    lat = np.deg2rad(lat_deg)
    scale = 2.0 / (1.0 - np.sin(lat))
    x_m = radius_m * scale * np.cos(lat) * np.sin(lon)
    y_m = radius_m * scale * np.cos(lat) * np.cos(lon)
    return float(x_m), float(y_m)


def inverse_stereographic(x_m: float, y_m: float, radius_m: float = MOON_RADIUS_KM * 1000.0) -> tuple[float, float]:
    rho = float(np.hypot(x_m, y_m))
    if rho == 0:
        return 0.0, -90.0
    delta_deg = float(np.rad2deg(2.0 * np.arctan(rho / (2.0 * radius_m))))
    latitude = delta_deg - 90.0
    longitude = float(np.rad2deg(np.arctan2(x_m, y_m))) % 360.0
    return longitude, latitude


def _label_value(label: str, key: str) -> str:
    match = re.search(rf"^\s*{key}\s*=\s*(.+)$", label, flags=re.MULTILINE)
    if not match:
        raise ValueError(f"PDS label missing {key}")
    return match.group(1).strip().strip('"')


def _label_number(label: str, key: str) -> float:
    return float(_label_value(label, key).split()[0])


def load_pds_image(image_path: Path, label_path: Path) -> ElevationGrid:
    """LOLA GDR shape map. HEIGHT = DN * SCALING_FACTOR meters above the reference sphere."""
    label = label_path.read_text(encoding="utf-8", errors="replace")
    lines = int(_label_number(label, "LINES"))
    samples = int(_label_number(label, "LINE_SAMPLES"))
    scaling = _label_number(label, "SCALING_FACTOR")
    pixel = _label_number(label, "MAP_SCALE")
    sample_offset = _label_number(label, "SAMPLE_PROJECTION_OFFSET")
    line_offset = _label_number(label, "LINE_PROJECTION_OFFSET")
    radius_km = _label_number(label, "A_AXIS_RADIUS")
    sample_type = _label_value(label, "SAMPLE_TYPE")
    bits = int(_label_number(label, "SAMPLE_BITS"))
    frame = _label_value(label, "COORDINATE_SYSTEM_NAME")
    if "LSB_INTEGER" not in sample_type or bits != 16:
        raise ValueError(f"unsupported LOLA sample type {sample_type} {bits}")
    raw = np.fromfile(image_path, dtype="<i2")
    if raw.size != lines * samples:
        raise ValueError(f"{image_path.name} has {raw.size} samples, label expects {lines * samples}")
    heights = raw.reshape((lines, samples)).astype(np.float64) * scaling
    # Pixel edges for 1-based projection offsets. See PDS MAP_SCALE and offsets.
    min_x = (0.5 - sample_offset) * pixel
    max_y = (line_offset - 0.5) * pixel
    return ElevationGrid(
        name=image_path.name,
        path=image_path,
        sha256=file_sha256(image_path),
        heights_m=heights,
        pixel_m=pixel,
        min_x_m=min_x,
        max_y_m=max_y,
        radius_km=radius_km,
        frame=frame,
        citation="LRO LOLA Gridded Data Record, PDS Geosciences Node. Height is meters above the 1737.4 km reference sphere.",
    )


def load_geotiff(path: Path, citation: str) -> ElevationGrid:
    import rasterio

    with rasterio.open(path) as dataset:
        heights = dataset.read(1).astype(np.float64)
        transform = dataset.transform
        nodata = dataset.nodata
        crs = dataset.crs.to_string() if dataset.crs else "missing"
        pixel = abs(float(transform.a))
        # Affine: x = a*col + c, y = e*row + f, e is negative.
        min_x = float(transform.c)
        max_y = float(transform.f)
    return ElevationGrid(
        name=path.name,
        path=path,
        sha256=file_sha256(path),
        heights_m=heights,
        pixel_m=pixel,
        min_x_m=min_x,
        max_y_m=max_y,
        radius_km=MOON_RADIUS_KM,
        frame=crs,
        citation=citation,
        nodata=None if nodata is None else float(nodata),
    )
