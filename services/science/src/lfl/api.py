"""HTTP API for Lunar First Light."""

from __future__ import annotations

import json
import os
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from lfl.analyze import CACHE, OutsideGrid, rerun
from lfl.fingerprint import require_sha256
from lfl.jobs import get as get_job
from lfl.jobs import submit
from lfl.network import exhaustive, topology
from lfl.power import SOLAR_CONSTANT_SOURCE, SOLAR_CONSTANT_W_M2
from lfl.trust.mock_adapter import MockAttestationStore

app = FastAPI(title="Seven Servers Lunar First Light", version="0.1.0")
_origins = [
    item.strip()
    for item in os.environ.get(
        "SCIENCE_CORS",
        "http://localhost:3000,http://127.0.0.1:3000,https://seven-servers-lunar-first-light.vercel.app",
    ).split(",")
    if item.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)
STORE = MockAttestationStore(CACHE / "trust_receipts_mock.json")


class IntervalRequest(BaseModel):
    start: str = "2026-11-01T00:00:00"
    stop: str = "2026-11-08T00:00:00"
    step_seconds: float = 3600
    mast_height_m: float = Field(default=2.0, ge=0, le=50)


class AttestRequest(BaseModel):
    subject_type: str
    record_hash: str
    canonicalization: str = "accorria-canonical-json-v1"
    metadata: dict = Field(default_factory=dict)


class VerifyRequest(BaseModel):
    record_hash: str


class NetworkRequest(BaseModel):
    sunlight_fraction: float | None = Field(default=None, ge=0, le=1)
    site_id: str | None = None
    hours: float = 1
    mode: str = "stationary"
    node_area_m2: float = 20
    node_efficiency: float = 0.30
    demand_w: float = 1500
    facility_demand_w: float = 250
    loss_fraction: float = 0.02
    battery_wh: float = 5000
    eta_charge: float = 0.95
    eta_discharge: float = 0.95
    mean_cosine: float = 0.5
    facility_available: tuple[bool, bool] = (True, True)
    legacy_mean_cosine: bool = False
    samples: list[dict] | None = None
    step_seconds: float = 3600
    tilt_deg: float = 60
    panel_azimuth_deg: float = 0


def _report() -> dict:
    path = CACHE / "report.json"
    if not path.exists():
        raise HTTPException(status_code=404, detail="No computed report is cached")
    return json.loads(path.read_text(encoding="utf-8"))


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "lunar-first-light", "version": "0.1.0"}


@app.get("/v1/report")
def report() -> dict:
    return _report()


@app.post("/v1/visibility")
def visibility(body: IntervalRequest) -> dict:
    try:
        return rerun(body.start, body.stop, body.step_seconds, body.mast_height_m)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/v1/network/topology")
def network_topology() -> dict:
    return topology()


class JobRequest(BaseModel):
    kind: str
    longitude_deg: float | None = None
    latitude_deg: float | None = None
    start: str | None = None
    stop: str | None = None
    step_seconds: float | None = None
    mast_height_m: float | None = Field(default=None, ge=0, le=50)
    publish: bool = False
    sites: list[dict] | None = None
    site_id: str | None = None
    sunlight_fraction: float | None = Field(default=None, ge=0, le=1)
    samples: list[dict] | None = None
    mode: str | None = None
    hours: float | None = None
    tilt_deg: float | None = None
    panel_azimuth_deg: float | None = None
    simulate_error: bool = False
    legacy_mean_cosine: bool = False
    mean_cosine: float | None = None


@app.post("/v1/jobs", status_code=202)
def create_job(body: JobRequest) -> dict:
    payload = body.model_dump()
    try:
        return submit(payload)
    except OutsideGrid as exc:
        raise HTTPException(status_code=409, detail={"code": "outside_grid", "message": str(exc)}) from exc
    except (ValueError, KeyError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.get("/v1/jobs/{job_id}")
def read_job(job_id: str) -> dict:
    record = get_job(job_id)
    if record is None:
        raise HTTPException(status_code=404, detail="job not found")
    return record


@app.post("/v1/network/exhaustive")
def network_exhaustive(body: NetworkRequest) -> dict:
    if body.samples:
        from lfl.network import exhaustive_from_samples

        return exhaustive_from_samples(
            body.samples,
            step_seconds=body.step_seconds,
            mode=body.mode,
            site_id=body.site_id,
            tilt_deg=body.tilt_deg,
            panel_azimuth_deg=body.panel_azimuth_deg,
        )
    if body.sunlight_fraction is None:
        if not body.site_id:
            raise HTTPException(status_code=422, detail="site_id or sunlight_fraction is required")
        report = _report()
        match = next((site for site in report["results"] if site["id"] == body.site_id), None)
        if match is None:
            raise HTTPException(status_code=422, detail="site_id is not in the published report")
        fraction = float(match["sun_center_clear"]["true_fraction"])
    else:
        fraction = body.sunlight_fraction
    result = exhaustive(
        fraction,
        hours=body.hours,
        node_area_m2=body.node_area_m2,
        node_efficiency=body.node_efficiency,
        demand_w=body.demand_w,
        facility_demand_w=body.facility_demand_w,
        loss_fraction=body.loss_fraction,
        battery_wh=body.battery_wh,
        eta_charge=body.eta_charge,
        eta_discharge=body.eta_discharge,
        facility_available=body.facility_available,
        mode=body.mode,
        mean_cosine=body.mean_cosine,
    )
    best = result["best"]
    return {
        "count": result["count"],
        "best_mask": best["mask"],
        "best_shortfall_j": best["shortfall_j"],
        "best_delivered_j": best["delivered_j"],
        "facilities": best["facilities"],
        "nodes": best["nodes"],
        "balance_j": best["balance_j"],
        "solar_constant_w_m2": SOLAR_CONSTANT_W_M2,
        "solar_constant_source": SOLAR_CONSTANT_SOURCE,
        "site_id": body.site_id,
        "sunlight_fraction": fraction,
        "status": "calculated from assumed hardware parameters and the requested sunlight fraction",
    }


@app.get("/v1/research/sbsp")
def sbsp() -> dict:
    return json.loads((Path(__file__).resolve().parents[4] / "research" / "sbsp" / "parameters.json").read_text())


@app.get("/v1/research/stone")
def stone() -> dict:
    return json.loads((Path(__file__).resolve().parents[4] / "research" / "stone" / "scenario.json").read_text())


@app.get("/v1/research/quantum")
def quantum() -> dict:
    path = Path(__file__).resolve().parents[4] / "research" / "quantum" / "result.json"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Quantum comparison has not been run")
    return json.loads(path.read_text())


@app.post("/api/v1/attestations")
def attest(body: AttestRequest) -> dict:
    if body.canonicalization != "accorria-canonical-json-v1":
        raise HTTPException(status_code=422, detail="canonicalization must be accorria-canonical-json-v1")
    try:
        require_sha256(body.record_hash)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    receipt = STORE.register(body.record_hash, body.subject_type, body.metadata)
    return {"ref": receipt["ref"], "receipt": receipt}


@app.post("/api/v1/attestations/{ref}/verify")
def verify(ref: str, body: VerifyRequest) -> dict:
    try:
        return STORE.verify(ref, body.record_hash)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="receipt not found") from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.get("/api/v1/attestations/{ref}/history")
def history(ref: str) -> dict:
    try:
        return STORE.history(ref)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="receipt not found") from exc
