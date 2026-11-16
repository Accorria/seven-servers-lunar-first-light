"""Build observer points, terrain horizons, and visibility from LOLA and SPICE."""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np

from lfl.dem import ElevationGrid, inverse_stereographic, load_geotiff, load_pds_image, stereographic_xy
from lfl.ephemeris import SpiceEphemeris, horizons_azel, shared_ephemeris
from lfl.frames import MOON_RADIUS_KM, spherical_to_me
from lfl.horizon import sample_horizon
from lfl.report import build_report, render_markdown
from lfl.windows import summarize_flags, visibility_row

REPO = Path(__file__).resolve().parents[4]
DATA = REPO / "data"
DEM = DATA / "dems"
KERNELS = DATA / "kernels"
CACHE = DATA / "cache"

SITE01_CITATION = (
    "Barker, M.K., et al. (2021), Improved LOLA Elevation Maps for South Pole Landing Sites, "
    "Planetary and Space Science 203, 105119. PGDA product 78, Site01 Connecting ridge, "
    "5 m/pixel, MOON_ME of DE421."
)
SITE20_CITATION = (
    "Barker, M.K., et al. (2021), PGDA product 78, Site20 Leibnitz beta plateau "
    "(Mons Mouton, formerly Leibnitz Beta), 5 m/pixel, MOON_ME of DE421."
)
IAU_MONS_MOUTON = {
    "feature": "Mons Mouton",
    "feature_id": 16070,
    "center_latitude_deg": -84.60,
    "center_longitude_east_deg": 31.00,
    "source": "USGS Gazetteer of Planetary Nomenclature, IAU feature 16070, adopted 2022-05-13",
}


def load_grids() -> tuple[ElevationGrid, ElevationGrid, ElevationGrid]:
    regional = load_pds_image(DEM / "ldem_75s_240m.img", DEM / "ldem_75s_240m.lbl")
    site_a = load_geotiff(DEM / "Site01_final_adj_5mpp_surf.tif", SITE01_CITATION)
    site_b = load_geotiff(DEM / "Site20_final_adj_5mpp_surf.tif", SITE20_CITATION)
    return regional, site_a, site_b


def observer_from_grid(grid: ElevationGrid, derivation: str, name: str, site_id: str) -> dict:
    x_m, y_m, elevation_m, row, column = grid.highest_pixel()
    lon, lat = inverse_stereographic(x_m, y_m)
    return {
        "id": site_id,
        "name": name,
        "longitude_deg": lon,
        "latitude_deg": lat,
        "elevation_m": elevation_m,
        "row": row,
        "column": column,
        "map_x_m": x_m,
        "map_y_m": y_m,
        "derivation": derivation,
        "dataset": grid.name,
        "dataset_sha256": grid.sha256,
        "frame": grid.frame,
        "citation": grid.citation,
        "vertical_datum": "meters above the 1737.4 km reference sphere",
    }


def mons_mouton_observer(regional: ElevationGrid, site20: ElevationGrid) -> dict:
    lon = IAU_MONS_MOUTON["center_longitude_east_deg"]
    lat = IAU_MONS_MOUTON["center_latitude_deg"]
    x_m, y_m = stereographic_xy(lon, lat)
    inside = site20.sample(x_m, y_m)
    if inside is not None:
        return {
            "id": "site_b",
            "name": "Mons Mouton",
            "longitude_deg": lon,
            "latitude_deg": lat,
            "elevation_m": inside,
            "map_x_m": x_m,
            "map_y_m": y_m,
            "derivation": "Site20 LDEM sample at the published IAU feature center",
            "dataset": site20.name,
            "dataset_sha256": site20.sha256,
            "frame": site20.frame,
            "citation": site20.citation,
            "vertical_datum": "meters above the 1737.4 km reference sphere",
            "feature_center": IAU_MONS_MOUTON,
        }
    regional_height = regional.sample(x_m, y_m)
    if regional_height is None:
        raise RuntimeError("IAU Mons Mouton center is outside the regional LDEM footprint")
    return {
        "id": "site_b",
        "name": "Mons Mouton",
        "longitude_deg": lon,
        "latitude_deg": lat,
        "elevation_m": regional_height,
        "map_x_m": x_m,
        "map_y_m": y_m,
        "derivation": (
            "Observer at the published IAU feature center. Site20 does not contain that center, "
            "so elevation is sampled from LDEM_75S_240M. This is not a NASA landing coordinate."
        ),
        "dataset": regional.name,
        "dataset_sha256": regional.sha256,
        "frame": regional.frame,
        "citation": regional.citation,
        "vertical_datum": "meters above the 1737.4 km reference sphere",
        "feature_center": IAU_MONS_MOUTON,
        "site20_contains_feature_center": False,
    }


def make_sampler(grids: list[ElevationGrid]):
    def sample(lon_deg: float, lat_deg: float) -> float | None:
        x_m, y_m = stereographic_xy(lon_deg, lat_deg)
        for grid in grids:
            height = grid.sample(x_m, y_m)
            if height is not None:
                return height
        return None

    return sample


def horizon_for(observer: dict, sampler, mast_height_m: float) -> np.ndarray:
    radius_km = MOON_RADIUS_KM + (observer["elevation_m"] + mast_height_m) / 1000.0
    position = spherical_to_me(observer["longitude_deg"], observer["latitude_deg"], radius_km)
    return sample_horizon(position, sampler, n_bins=720, max_range_km=250.0, step_km=0.48, min_range_km=0.24)


def visibility_for(ephemeris: SpiceEphemeris, observer: dict, horizons: np.ndarray, mast_height_m: float, start: str, stop: str, step_seconds: float) -> dict:
    rows = ephemeris.series(
        observer["longitude_deg"],
        observer["latitude_deg"],
        observer["elevation_m"] + mast_height_m,
        start,
        stop,
        step_seconds,
    )
    records = [
        visibility_row(
            horizons,
            row["sun_azimuth_deg"],
            row["sun_elevation_deg"],
            row["sun_range_km"],
            row["earth_azimuth_deg"],
            row["earth_elevation_deg"],
            row["earth_range_km"],
        )
        | {"utc": row["utc"]}
        for row in rows
    ]
    return {
        "samples": records,
        "sun_center_clear": summarize_flags([row["sun_center_clear"] for row in records], step_seconds),
        "any_sunlight": summarize_flags([row["any_sunlight"] for row in records], step_seconds),
        "earth_center_clear": summarize_flags([row["earth_center_clear"] for row in records], step_seconds),
        "any_earth_disk": summarize_flags([row["any_earth_disk"] for row in records], step_seconds),
    }


def compare_horizons(ephemeris: SpiceEphemeris, observer: dict, mast_height_m: float) -> dict:
    start = "2026-11-01"
    stop = "2026-11-02"
    spice_rows = ephemeris.series(
        observer["longitude_deg"],
        observer["latitude_deg"],
        observer["elevation_m"] + mast_height_m,
        start,
        stop,
        3600.0,
    )
    height_km = (observer["elevation_m"] + mast_height_m) / 1000.0
    sun = horizons_azel(observer["longitude_deg"], observer["latitude_deg"], height_km, "10", start, stop, "1 h")
    earth = horizons_azel(observer["longitude_deg"], observer["latitude_deg"], height_km, "399", start, stop, "1 h")
    count = min(len(spice_rows), len(sun), len(earth))
    if count < 12:
        return {"status": "insufficient_horizons_rows", "spice": len(spice_rows), "sun": len(sun), "earth": len(earth)}
    sun_az = np.array([spice_rows[i]["sun_azimuth_deg"] - sun[i][1] for i in range(count)])
    sun_el = np.array([spice_rows[i]["sun_elevation_deg"] - sun[i][2] for i in range(count)])
    earth_el = np.array([spice_rows[i]["earth_elevation_deg"] - earth[i][2] for i in range(count)])
    earth_az = np.array([spice_rows[i]["earth_azimuth_deg"] - earth[i][1] for i in range(count)])
    sun_az = (sun_az + 180) % 360 - 180
    earth_az = (earth_az + 180) % 360 - 180
    rms = {
        "samples": count,
        "sun_azimuth_rms_deg": float(np.sqrt(np.mean(sun_az**2))),
        "sun_elevation_rms_deg": float(np.sqrt(np.mean(sun_el**2))),
        "earth_azimuth_rms_deg": float(np.sqrt(np.mean(earth_az**2))),
        "earth_elevation_rms_deg": float(np.sqrt(np.mean(earth_el**2))),
    }
    rms["within_0p05_deg"] = all(value < 0.05 for key, value in rms.items() if key.endswith("_deg"))
    return rms


def run(start: str = "2026-11-01T00:00:00", stop: str = "2026-11-08T00:00:00", step_seconds: float = 3600.0, mast_height_m: float = 2.0) -> dict:
    CACHE.mkdir(parents=True, exist_ok=True)
    regional, site_a_grid, site_b_grid = load_grids()
    site_a = observer_from_grid(
        site_a_grid,
        "Highest valid pixel in the Site01 Connecting Ridge LDEM. ROI shapefile was not applied.",
        "Shackleton-de Gerlache Connecting Ridge",
        "site_a",
    )
    site_b = mons_mouton_observer(regional, site_b_grid)
    sampler = make_sampler([site_a_grid, site_b_grid, regional])
    horizons = {
        "site_a": horizon_for(site_a, sampler, mast_height_m),
        "site_b": horizon_for(site_b, sampler, mast_height_m),
    }
    ephemeris = SpiceEphemeris(KERNELS)
    consistency = compare_horizons(ephemeris, site_a, mast_height_m)
    results = []
    for site, key in ((site_a, "site_a"), (site_b, "site_b")):
        visibility = visibility_for(ephemeris, site, horizons[key], mast_height_m, start, stop, step_seconds)
        compact = {name: visibility[name] for name in ("sun_center_clear", "any_sunlight", "earth_center_clear", "any_earth_disk")}
        preview = visibility["samples"][:: max(1, len(visibility["samples"]) // 48)]
        results.append({**site, **compact, "preview": preview, "horizon_deg": horizons[key].round(4).tolist()})
    report = build_report(
        {
            "simulation_version": "0.1.0",
            "sites": [site_a, site_b],
            "interval_utc": {"start": start, "stop": stop},
            "step_seconds": step_seconds,
            "mast_height_m": mast_height_m,
            "datasets": [
                {"name": regional.name, "sha256": regional.sha256, "citation": regional.citation, "frame": regional.frame},
                {"name": site_a_grid.name, "sha256": site_a_grid.sha256, "citation": site_a_grid.citation, "frame": site_a_grid.frame},
                {"name": site_b_grid.name, "sha256": site_b_grid.sha256, "citation": site_b_grid.citation, "frame": site_b_grid.frame},
            ],
            "kernels": ephemeris.loaded,
            "results": results,
            "method": (
                "Terrain elevation angle is arcsin of the unit line of sight dotted with the local vertical. "
                "The horizon in each 0.5 degree azimuth bin is the maximum terrain elevation out to 250 km. "
                "Sun and Earth directions are SPICE LT+S vectors in the MOON_ME frame of DE421. "
                "A body center is clear when its elevation exceeds the terrain horizon at its azimuth. "
                "Center-clear is the reported window. Limb-clear is a separate column. "
                "Geometric visibility is not electrical power and is not a radio link."
            ),
            "assumptions": [
                {"name": "reference_radius_km", "value": 1737.4, "status": "cited", "source": "LOLA GDR label A_AXIS_RADIUS"},
                {"name": "horizon_step_km", "value": 0.48, "status": "assumed", "source": "two regional pixels"},
                {"name": "mast_height_m", "value": mast_height_m, "status": "scenario"},
            ],
        }
    )
    report["ephemeris_consistency"] = consistency
    report["publish_windows"] = bool(consistency.get("within_0p05_deg"))
    (CACHE / "report.json").write_text(json.dumps(report), encoding="utf-8")
    (CACHE / "report.md").write_text(render_markdown(report), encoding="utf-8")
    return report


class OutsideGrid(RuntimeError):
    """The requested point is outside the loaded LOLA grids."""


_GRIDS: tuple[ElevationGrid, ElevationGrid, ElevationGrid] | None = None


def cached_grids() -> tuple[ElevationGrid, ElevationGrid, ElevationGrid]:
    global _GRIDS
    if _GRIDS is None:
        _GRIDS = load_grids()
    return _GRIDS


def observer_at(longitude_deg: float, latitude_deg: float) -> dict:
    if latitude_deg > -75.0 or latitude_deg < -90.0:
        raise OutsideGrid("outside_grid")
    regional, site01, site20 = cached_grids()
    x_m, y_m = stereographic_xy(longitude_deg, latitude_deg)
    for grid in (site01, site20, regional):
        height = grid.sample(x_m, y_m)
        if height is None:
            continue
        return {
            "id": "custom",
            "name": "Selected location",
            "longitude_deg": longitude_deg,
            "latitude_deg": latitude_deg,
            "elevation_m": height,
            "map_x_m": x_m,
            "map_y_m": y_m,
            "derivation": "Elevation sampled from the first loaded LOLA grid that contains the point.",
            "dataset": grid.name,
            "dataset_sha256": grid.sha256,
            "frame": "MOON_ME",
            "citation": grid.citation,
            "vertical_datum": "meters above the 1737.4 km reference sphere",
        }
    raise OutsideGrid("outside_grid")


def analyze_site(
    longitude_deg: float,
    latitude_deg: float,
    start: str,
    stop: str,
    step_seconds: float,
    mast_height_m: float,
    *,
    publish: bool = False,
) -> dict:
    """Horizon and visibility for one point. Does not replace the v1 baseline file."""
    observer = observer_at(longitude_deg, latitude_deg)
    regional, site01, site20 = cached_grids()
    sampler = make_sampler([site01, site20, regional])
    horizons = horizon_for(observer, sampler, mast_height_m)
    ephemeris = shared_ephemeris(KERNELS)
    visibility = visibility_for(ephemeris, observer, horizons, mast_height_m, start, stop, step_seconds)
    compact = {name: visibility[name] for name in ("sun_center_clear", "any_sunlight", "earth_center_clear", "any_earth_disk")}
    document = {
        "schema": "seven-servers.lunar-visibility.v2",
        "baseline_preserved": True,
        "publish_windows": False,
        "parameters": {
            "longitude_deg": longitude_deg,
            "latitude_deg": latitude_deg,
            "start": start,
            "stop": stop,
            "step_seconds": step_seconds,
            "mast_height_m": mast_height_m,
        },
        "site": {**observer, **compact, "horizon_deg": horizons.round(4).tolist(), "samples": visibility["samples"]},
    }
    if publish:
        consistency = compare_horizons(ephemeris, observer, mast_height_m)
        document["ephemeris_consistency"] = consistency
        document["publish_windows"] = bool(consistency.get("within_0p05_deg"))
    return document


def rerun(start: str, stop: str, step_seconds: float, mast_height_m: float) -> dict:
    """Recompute windows without replacing data/cache/report.json."""
    cached = json.loads((CACHE / "report.json").read_text(encoding="utf-8"))
    if abs(mast_height_m - float(cached["mast_height_m"])) > 1e-9:
        sites = []
        for site in cached["sites"]:
            sites.append(
                analyze_site(
                    site["longitude_deg"],
                    site["latitude_deg"],
                    start,
                    stop,
                    step_seconds,
                    mast_height_m,
                )
            )
        payload = {"schema": "seven-servers.lunar-visibility.v2", "baseline_preserved": True, "sites": sites}
        side = CACHE / "side"
        side.mkdir(parents=True, exist_ok=True)
        (side / "rerun.json").write_text(json.dumps(payload), encoding="utf-8")
        return payload
    ephemeris = SpiceEphemeris(KERNELS)
    results = []
    for site in cached["results"]:
        horizons = np.array(site["horizon_deg"], dtype=float)
        visibility = visibility_for(ephemeris, site, horizons, mast_height_m, start, stop, step_seconds)
        compact = {name: visibility[name] for name in ("sun_center_clear", "any_sunlight", "earth_center_clear", "any_earth_disk")}
        preview = visibility["samples"][:: max(1, len(visibility["samples"]) // 48)]
        results.append({**{key: site[key] for key in site if key not in compact}, **compact, "preview": preview})
    updated = build_report(
        {
            "simulation_version": "0.1.0",
            "sites": cached["sites"],
            "interval_utc": {"start": start, "stop": stop},
            "step_seconds": step_seconds,
            "mast_height_m": mast_height_m,
            "datasets": cached["datasets"],
            "kernels": ephemeris.loaded,
            "results": results,
            "method": cached["method"],
            "assumptions": cached.get("assumptions", []),
        }
    )
    updated["ephemeris_consistency"] = cached.get("ephemeris_consistency")
    updated["publish_windows"] = bool(cached.get("publish_windows"))
    updated["baseline_preserved"] = True
    side = CACHE / "side"
    side.mkdir(parents=True, exist_ok=True)
    (side / "rerun.json").write_text(json.dumps(updated), encoding="utf-8")
    return updated
