"""The published v1 report stays byte-for-byte intact when jobs fail or are rejected."""

from __future__ import annotations

import json
import time
from pathlib import Path

from fastapi.testclient import TestClient

from lfl.analyze import CACHE
from lfl.api import app

ROOT = Path(__file__).resolve().parents[3]
REPORT = ROOT / "apps" / "web" / "public" / "results" / "report.json"
PLAYBACK = ROOT / "apps" / "web" / "public" / "results" / "playback.json"
EXPECTED = "dba4eb48f56fad5b2a7dbbc5a8cf558743f30f698d53210def97cfbef04eb2b3"
client = TestClient(app)


def _bytes() -> bytes:
    return (CACHE / "report.json").read_bytes()


def test_published_hash_and_playback_counts():
    report = json.loads(REPORT.read_text(encoding="utf-8"))
    playback = json.loads(PLAYBACK.read_text(encoding="utf-8"))
    assert report["record_hash"] == EXPECTED
    assert playback["source_report_hash"] == EXPECTED
    assert playback["sample_count"] == 169
    assert playback["sites"][0]["samples"][0]["utc"] == "2026-11-01T00:00:00"
    assert playback["sites"][0]["samples"][-1]["utc"] == "2026-11-08T00:00:00"
    counts = {}
    for site in playback["sites"]:
        counts[site["id"]] = (
            len(site["samples"]),
            sum(1 for sample in site["samples"] if sample["sun_center_clear"]),
            sum(1 for sample in site["samples"] if sample["earth_center_clear"]),
        )
    assert counts["site_a"] == (169, 169, 55)
    assert counts["site_b"] == (169, 0, 64)


def test_outside_grid_keeps_the_baseline():
    before = _bytes()
    response = client.post("/v1/jobs", json={"kind": "site", "longitude_deg": 0, "latitude_deg": -70, "mast_height_m": 2})
    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "outside_grid"
    assert _bytes() == before
    assert json.loads(REPORT.read_text(encoding="utf-8"))["record_hash"] == EXPECTED


def test_forced_worker_error_keeps_the_baseline():
    before = _bytes()
    created = client.post(
        "/v1/jobs",
        json={
            "kind": "site",
            "longitude_deg": 222.85643,
            "latitude_deg": -89.43891,
            "mast_height_m": 2,
            "simulate_error": True,
        },
    )
    assert created.status_code == 202
    record = {}
    for _ in range(40):
        record = client.get(f"/v1/jobs/{created.json()['job_id']}").json()
        if record["status"] in {"done", "error"}:
            break
        time.sleep(0.05)
    assert record["status"] == "error"
    assert record["error"]["message"] == "forced worker error"
    assert _bytes() == before


def test_network_job_requires_a_named_site():
    response = client.post("/v1/jobs", json={"kind": "network"})
    assert response.status_code == 422
