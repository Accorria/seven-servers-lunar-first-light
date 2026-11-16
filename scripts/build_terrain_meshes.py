"""Build browser terrain meshes from the existing LOLA DEMs.

Reads data/dems only. Writes apps/web/public/terrain. Does not modify source rasters
and does not run a horizon.
"""

from __future__ import annotations

import json
import struct
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "services" / "science" / "src"))

from lfl.analyze import SITE01_CITATION, load_grids  # noqa: E402
from lfl.dem import stereographic_xy  # noqa: E402
from lfl.frames import MOON_RADIUS_KM  # noqa: E402

OUT = ROOT / "apps" / "web" / "public" / "terrain"
SITE_A_XY = (-11572.5, -12472.5)
SITE_B_LL = (31.0, -84.6)
SKIRT_KM = 6.0


def write_mesh(path: Path, positions: np.ndarray, indices: np.ndarray) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    header = struct.pack("<4sII", b"LFLM", positions.shape[0], indices.shape[0])
    with path.open("wb") as handle:
        handle.write(header)
        handle.write(np.ascontiguousarray(positions, dtype="<f4").tobytes())
        handle.write(np.ascontiguousarray(indices, dtype="<u4").tobytes())


def surface_grid(xs: np.ndarray, ys: np.ndarray, heights: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    ny, nx = heights.shape
    radius_m = MOON_RADIUS_KM * 1000.0
    grid_x, grid_y = np.meshgrid(xs, ys)
    rho = np.hypot(grid_x, grid_y)
    delta = np.rad2deg(2.0 * np.arctan(np.divide(rho, 2.0 * radius_m, out=np.zeros_like(rho), where=rho != 0)))
    latitude = np.where(rho == 0, -90.0, delta - 90.0)
    longitude = np.rad2deg(np.arctan2(grid_x, grid_y)) % 360.0
    lat_r = np.deg2rad(latitude)
    lon_r = np.deg2rad(longitude)
    # Nodata stays out of the index. Unindexed samples sit on the reference sphere so the file has no NaN.
    radius = MOON_RADIUS_KM + np.where(np.isfinite(heights), heights, 0.0) / 1000.0
    cos_lat = np.cos(lat_r)
    positions = np.stack(
        [
            radius * cos_lat * np.cos(lon_r),
            radius * cos_lat * np.sin(lon_r),
            radius * np.sin(lat_r),
        ],
        axis=-1,
    ).reshape(-1, 3)
    valid = np.isfinite(heights)
    quad = valid[:-1, :-1] & valid[:-1, 1:] & valid[1:, :-1] & valid[1:, 1:]
    jj, ii = np.nonzero(quad)
    a = jj * nx + ii
    b = a + 1
    c = a + nx
    d = c + 1
    faces = np.stack([a, c, b, b, c, d], axis=1).reshape(-1)
    rim = np.concatenate(
        [
            np.arange(nx - 1),
            np.arange(ny - 1) * nx + (nx - 1),
            (ny - 1) * nx + np.arange(nx - 1, 0, -1),
            np.arange(ny - 1, 0, -1) * nx,
        ]
    )
    rim_pos = positions[rim]
    rim_radius = np.linalg.norm(rim_pos, axis=1, keepdims=True)
    skirt = rim_pos * ((rim_radius - SKIRT_KM) / rim_radius)
    base = positions.shape[0]
    positions = np.vstack([positions, skirt])
    m = np.arange(rim.size)
    nxt = (m + 1) % rim.size
    a_i = rim[m]
    b_i = rim[nxt]
    a2 = base + m
    b2 = base + nxt
    skirt_faces = np.stack([a_i, a2, b_i, b_i, a2, b2], axis=1).reshape(-1)
    indices = np.concatenate([faces, skirt_faces]).astype(np.uint32)
    return positions, indices


def sample_block(grid, x0: float, y0: float, x1: float, y1: float, columns: int, rows: int) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    xs = np.linspace(x0, x1, columns)
    ys = np.linspace(y0, y1, rows)
    return xs, ys, heights_at(grid, xs, ys)


def heights_at(grid, xs: np.ndarray, ys: np.ndarray) -> np.ndarray:
    columns = np.floor((xs - grid.min_x_m) / grid.pixel_m).astype(int)
    rows = np.floor((grid.max_y_m - ys) / grid.pixel_m).astype(int)
    xx, yy = np.meshgrid(columns, rows)
    valid = (xx >= 0) & (yy >= 0) & (xx < grid.heights_m.shape[1]) & (yy < grid.heights_m.shape[0])
    heights = np.full(xx.shape, np.nan, dtype=np.float64)
    heights[valid] = grid.heights_m[yy[valid], xx[valid]]
    if grid.nodata is not None:
        heights[heights == grid.nodata] = np.nan
    heights[(heights < -20000) | (heights > 20000)] = np.nan
    return heights


def stride_for(width: int, height: int, triangle_budget: int) -> int:
    stride = 1
    while ((width // stride) - 1) * ((height // stride) - 1) * 2 > triangle_budget:
        stride += 1
    return stride


def regular_from_grid(grid, stride: int, x_min: float, x_max: float, y_min: float, y_max: float) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    columns = max(2, int(round((x_max - x_min) / (grid.pixel_m * stride))) + 1)
    rows = max(2, int(round((y_max - y_min) / (grid.pixel_m * stride))) + 1)
    return sample_block(grid, x_min, y_min, x_max, y_max, columns, rows)


def entry(name: str, file_name: str, grid, stride: int, drawn_pixel_m: float, bounds: dict, note: str, triangles: int) -> dict:
    return {
        "id": name,
        "file": file_name,
        "source_path": str(grid.path.relative_to(ROOT)),
        "source_name": grid.name,
        "source_sha256": grid.sha256,
        "source_pixel_m": grid.pixel_m,
        "drawn_pixel_m": drawn_pixel_m,
        "stride": stride,
        "bounds_m": bounds,
        "frame": "MOON_ME",
        "radius_km": MOON_RADIUS_KM,
        "citation": grid.citation,
        "triangles": triangles,
        "note": note,
        "encoding": "LFLM float32 xyz kilometres, uint32 indices, skirt 6 km",
    }


def main() -> None:
    regional, site01, _site20 = load_grids()
    OUT.mkdir(parents=True, exist_ok=True)
    meshes = []

    width = regional.heights_m.shape[1] * regional.pixel_m
    height = regional.heights_m.shape[0] * regional.pixel_m
    x_min = regional.min_x_m
    y_max = regional.max_y_m
    x_max = x_min + width
    y_min = y_max - height
    columns = 768
    rows = 768
    xs, ys, heights = sample_block(regional, x_min, y_min, x_max, y_max, columns, rows)
    positions, indices = surface_grid(xs, ys, heights)
    write_mesh(OUT / "regional.bin", positions, indices)
    drawn = (x_max - x_min) / (columns - 1)
    meshes.append(
        entry(
            "regional",
            "regional.bin",
            regional,
            stride=int(round(drawn / regional.pixel_m)),
            drawn_pixel_m=drawn,
            bounds={"min_x_m": x_min, "max_x_m": x_max, "min_y_m": y_min, "max_y_m": y_max},
            note="South of 75°S from ldem_75s_240m, drawn near 1.2 km for the approach. Not a horizon.",
            triangles=int(indices.size // 3),
        )
    )

    stride = stride_for(site01.heights_m.shape[1], site01.heights_m.shape[0], 250_000)
    x0 = site01.min_x_m
    y1 = site01.max_y_m
    x1 = x0 + site01.heights_m.shape[1] * site01.pixel_m
    y0 = y1 - site01.heights_m.shape[0] * site01.pixel_m
    xs, ys, heights = regular_from_grid(site01, stride, x0, x1, y0, y1)
    positions, indices = surface_grid(xs, ys, heights)
    write_mesh(OUT / "site01-parent.bin", positions, indices)
    meshes.append(
        entry(
            "site01_parent",
            "site01-parent.bin",
            site01,
            stride=stride,
            drawn_pixel_m=site01.pixel_m * stride,
            bounds={"min_x_m": x0, "max_x_m": x1, "min_y_m": y0, "max_y_m": y1},
            note="Whole Site01 tile, decimated. The 5 m patch is the landing surface.",
            triangles=int(indices.size // 3),
        )
    )
    site01.citation = SITE01_CITATION

    center_x, center_y = SITE_A_XY
    cells = 300
    half = (cells / 2) * site01.pixel_m
    xs = center_x + (np.arange(cells + 1) - cells / 2) * site01.pixel_m
    ys = center_y + (np.arange(cells + 1) - cells / 2) * site01.pixel_m
    heights = heights_at(site01, xs, ys)
    positions, indices = surface_grid(xs, ys, heights)
    write_mesh(OUT / "site01-patch.bin", positions, indices)
    meshes.append(
        entry(
            "site01_patch",
            "site01-patch.bin",
            site01,
            stride=1,
            drawn_pixel_m=site01.pixel_m,
            bounds={
                "min_x_m": float(xs[0]),
                "max_x_m": float(xs[-1]),
                "min_y_m": float(ys[0]),
                "max_y_m": float(ys[-1]),
            },
            note="Native 5 m patch, 1.5 km across, centered on the published Site01 pixel. Panel may say 5 m LDEM.",
            triangles=int(indices.size // 3),
        )
    )

    lon, lat = SITE_B_LL
    bx, by = stereographic_xy(lon, lat)
    half_m = 20_000.0
    step = regional.pixel_m
    count = int(round((2 * half_m) / step)) + 1
    xs = bx + (np.arange(count) - (count // 2)) * step
    ys = by + (np.arange(count) - (count // 2)) * step
    heights = heights_at(regional, xs, ys)
    positions, indices = surface_grid(xs, ys, heights)
    write_mesh(OUT / "mouton.bin", positions, indices)
    meshes.append(
        entry(
            "mouton",
            "mouton.bin",
            regional,
            stride=1,
            drawn_pixel_m=regional.pixel_m,
            bounds={
                "min_x_m": float(xs[0]),
                "max_x_m": float(xs[-1]),
                "min_y_m": float(ys[0]),
                "max_y_m": float(ys[-1]),
            },
            note=(
                "Mons Mouton window at the source 240 m spacing of ldem_75s_240m. "
                "Site20 does not contain the IAU feature center and is not this surface."
            ),
            triangles=int(indices.size // 3),
        )
    )

    document = {
        "schema": "seven-servers.lunar-terrain.v1",
        "frame": "MOON_ME",
        "radius_km": MOON_RADIUS_KM,
        "visualization_only": True,
        "meshes": meshes,
    }
    (OUT / "terrain.json").write_text(json.dumps(document, indent=2), encoding="utf-8")
    total = sum(path.stat().st_size for path in OUT.glob("*.bin"))
    print(f"wrote {len(meshes)} meshes, {total / 1e6:.1f} MB")
    for item in meshes:
        print(item["id"], item["triangles"], "drawn", round(item["drawn_pixel_m"], 2), "m")


if __name__ == "__main__":
    main()
