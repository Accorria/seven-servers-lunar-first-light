"""In-memory science jobs. Results are returned to the caller and do not replace the v1 report."""

from __future__ import annotations

import json
import threading
import uuid
from pathlib import Path

from lfl.analyze import CACHE, OutsideGrid, analyze_site
from lfl.network import exhaustive, exhaustive_from_samples
from lfl.power import SOLAR_CONSTANT_SOURCE, SOLAR_CONSTANT_W_M2

JOBS: dict[str, dict] = {}
_LOCK = threading.Lock()


def _baseline_fraction(site_id: str) -> float:
    report = json.loads((CACHE / "report.json").read_text(encoding="utf-8"))
    for site in report["results"]:
        if site["id"] == site_id:
            return float(site["sun_center_clear"]["true_fraction"])
    raise KeyError(site_id)


def _network(payload: dict) -> dict:
    site_id = payload.get("site_id")
    samples = payload.get("samples")
    mode = payload.get("mode") or "stationary"
    if samples:
        return exhaustive_from_samples(
            samples,
            step_seconds=float(payload.get("step_seconds") or 3600),
            mode=mode,
            site_id=site_id,
            tilt_deg=float(payload.get("tilt_deg") or 60),
            panel_azimuth_deg=float(payload.get("panel_azimuth_deg") or 0),
        )
    if payload.get("sunlight_fraction") is None:
        if not site_id:
            raise ValueError("site_id or sunlight_fraction is required")
        fraction = _baseline_fraction(site_id)
    else:
        fraction = float(payload["sunlight_fraction"])
    legacy = bool(payload.get("legacy_mean_cosine"))
    mean_cosine = float(payload.get("mean_cosine") if payload.get("mean_cosine") is not None else (0.5 if legacy else 1.0))
    result = exhaustive(
        fraction,
        hours=float(payload.get("hours") or 24),
        mode=mode,
        mean_cosine=mean_cosine,
        node_area_m2=float(payload.get("node_area_m2") or 20),
        node_efficiency=float(payload.get("node_efficiency") or 0.30),
        demand_w=float(payload.get("demand_w") or 1500),
        facility_demand_w=float(payload.get("facility_demand_w") or 250),
        loss_fraction=float(payload.get("loss_fraction") or 0.02),
        battery_wh=float(payload.get("battery_wh") or 5000),
        eta_charge=float(payload.get("eta_charge") or 0.95),
        eta_discharge=float(payload.get("eta_discharge") or 0.95),
    )
    best = result["best"]
    return {
        "schema": "seven-servers.lunar-visibility.v2",
        "count": result["count"],
        "best_mask": best["mask"],
        "best_shortfall_j": best["shortfall_j"],
        "best_delivered_j": best["delivered_j"],
        "facilities": best["facilities"],
        "nodes": best["nodes"],
        "balance_j": best["balance_j"],
        "site_id": site_id,
        "sunlight_fraction": fraction,
        "collector_mode": mode,
        "solar_constant_w_m2": SOLAR_CONSTANT_W_M2,
        "solar_constant_source": SOLAR_CONSTANT_SOURCE,
        "tie_break": "lowest mask among equal shortfall, then higher delivered energy",
        "status": "calculated from assumed hardware parameters and the requested sunlight fraction",
    }


def _execute(payload: dict) -> dict:
    if payload.get("simulate_error"):
        raise RuntimeError("forced worker error")
    kind = payload["kind"]
    if kind == "site":
        return analyze_site(
            float(payload["longitude_deg"]),
            float(payload["latitude_deg"]),
            payload.get("start") or "2026-11-01T00:00:00",
            payload.get("stop") or "2026-11-08T00:00:00",
            float(payload.get("step_seconds") or 3600),
            float(payload.get("mast_height_m") if payload.get("mast_height_m") is not None else 2),
            publish=bool(payload.get("publish")),
        )
    if kind == "compare":
        sites = []
        for item in payload["sites"]:
            sites.append(
                analyze_site(
                    float(item["longitude_deg"]),
                    float(item["latitude_deg"]),
                    item.get("start") or payload.get("start") or "2026-11-01T00:00:00",
                    item.get("stop") or payload.get("stop") or "2026-11-08T00:00:00",
                    float(item.get("step_seconds") or payload.get("step_seconds") or 3600),
                    float(item.get("mast_height_m") if item.get("mast_height_m") is not None else payload.get("mast_height_m") or 2),
                )
            )
        return {"schema": "seven-servers.lunar-visibility.v2", "sites": sites, "baseline_preserved": True}
    if kind == "network":
        return _network(payload)
    raise ValueError(f"unknown job kind {kind}")


def _run(job_id: str, payload: dict) -> None:
    with _LOCK:
        JOBS[job_id]["status"] = "running"
    try:
        result = _execute(payload)
        with _LOCK:
            JOBS[job_id]["status"] = "done"
            JOBS[job_id]["result"] = result
    except OutsideGrid:
        with _LOCK:
            JOBS[job_id]["status"] = "error"
            JOBS[job_id]["error"] = {"code": "outside_grid", "message": "The point is outside the loaded LOLA grids."}
    except Exception as exc:  # noqa: BLE001 — the job record is the error channel
        with _LOCK:
            JOBS[job_id]["status"] = "error"
            JOBS[job_id]["error"] = {"code": "worker_error", "message": str(exc)}


def validate(payload: dict) -> None:
    kind = payload.get("kind")
    if kind not in {"site", "compare", "network"}:
        raise ValueError("kind must be site, compare, or network")
    mast = payload.get("mast_height_m")
    if mast is not None and not 0 <= float(mast) <= 50:
        raise ValueError("mast_height_m must be from 0 to 50")
    if kind == "site":
        lat = float(payload["latitude_deg"])
        lon = float(payload["longitude_deg"])
        if lat > -75 or lat < -90 or not 0 <= lon < 360:
            raise OutsideGrid("outside_grid")
    if kind == "compare":
        if not payload.get("sites"):
            raise ValueError("compare requires sites")
        for item in payload["sites"]:
            lat = float(item["latitude_deg"])
            if lat > -75 or lat < -90:
                raise OutsideGrid("outside_grid")
    if kind == "network" and payload.get("sunlight_fraction") is None and not payload.get("site_id") and not payload.get("samples"):
        raise ValueError("site_id or sunlight_fraction is required")


def submit(payload: dict) -> dict:
    validate(payload)
    job_id = uuid.uuid4().hex
    record = {"id": job_id, "status": "queued", "request": {key: value for key, value in payload.items() if key != "samples"}}
    with _LOCK:
        JOBS[job_id] = record
    threading.Thread(target=_run, args=(job_id, payload), daemon=True).start()
    return {"job_id": job_id, "status": "queued"}


def get(job_id: str) -> dict | None:
    with _LOCK:
        record = JOBS.get(job_id)
        if record is None:
            return None
        return json.loads(json.dumps(record))


def baseline_path() -> Path:
    return CACHE / "report.json"
