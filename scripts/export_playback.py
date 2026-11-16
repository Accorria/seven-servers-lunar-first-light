"""Write the 169-hour playback file beside the published report.

Uses the cached horizon arrays and SpiceEphemeris. Does not call build_report and
does not write data/cache/report.json or apps/web/public/results/report.json.
"""

from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "services" / "science" / "src"))

from lfl.ephemeris import shared_ephemeris  # noqa: E402
from lfl.windows import horizon_at, visibility_row  # noqa: E402

REPORT = ROOT / "apps" / "web" / "public" / "results" / "report.json"
CACHE_REPORT = ROOT / "data" / "cache" / "report.json"
OUT = ROOT / "apps" / "web" / "public" / "results" / "playback.json"
KERNELS = ROOT / "data" / "kernels"
EXPECTED = "dba4eb48f56fad5b2a7dbbc5a8cf558743f30f698d53210def97cfbef04eb2b3"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> None:
    before = sha256(REPORT)
    cache_before = sha256(CACHE_REPORT) if CACHE_REPORT.exists() else None
    report = json.loads(REPORT.read_text(encoding="utf-8"))
    if report["record_hash"] != EXPECTED:
        raise SystemExit("published report hash is not the DE421 baseline")
    ephemeris = shared_ephemeris(KERNELS)
    sites = []
    for site in report["results"]:
        horizons = np.array(site["horizon_deg"], dtype=float)
        rows = ephemeris.series(
            site["longitude_deg"],
            site["latitude_deg"],
            site["elevation_m"] + float(report["mast_height_m"]),
            report["interval_utc"]["start"],
            report["interval_utc"]["stop"],
            float(report["step_seconds"]),
        )
        samples = []
        for row in rows:
            flags = visibility_row(
                horizons,
                row["sun_azimuth_deg"],
                row["sun_elevation_deg"],
                row["sun_range_km"],
                row["earth_azimuth_deg"],
                row["earth_elevation_deg"],
                row["earth_range_km"],
            )
            samples.append(
                {
                    "utc": row["utc"],
                    "et": row["et"],
                    "sun_azimuth_deg": row["sun_azimuth_deg"],
                    "sun_elevation_deg": row["sun_elevation_deg"],
                    "sun_range_km": row["sun_range_km"],
                    "earth_azimuth_deg": row["earth_azimuth_deg"],
                    "earth_elevation_deg": row["earth_elevation_deg"],
                    "earth_range_km": row["earth_range_km"],
                    "sun_horizon_deg": flags["sun_horizon_deg"],
                    "earth_horizon_deg": flags["earth_horizon_deg"],
                    "sun_center_clear": flags["sun_center_clear"],
                    "any_sunlight": flags["any_sunlight"],
                    "earth_center_clear": flags["earth_center_clear"],
                    "any_earth_disk": flags["any_earth_disk"],
                    "sun_unit_me": ephemeris.body_unit("SUN", row["et"]),
                }
            )
        if len(samples) != 169:
            raise SystemExit(f"{site['id']} has {len(samples)} samples, expected 169")
        # Guard the horizon lookup so a renamed key fails here.
        horizon_at(horizons, samples[0]["sun_azimuth_deg"])
        sites.append({"id": site["id"], "name": site["name"], "samples": samples})
    document = {
        "schema": "seven-servers.lunar-playback.v1",
        "source_report_hash": report["record_hash"],
        "interval_utc": report["interval_utc"],
        "step_seconds": report["step_seconds"],
        "sample_count": 169,
        "mast_height_m": report["mast_height_m"],
        "frame": "MOON_ME",
        "abcorr": "LT+S",
        "kernels": report["kernels"],
        "note": "Hourly scientific samples. The report preview is a 3-hour subset and is not this series.",
        "sites": sites,
    }
    OUT.write_text(json.dumps(document), encoding="utf-8")
    if sha256(REPORT) != before or (cache_before and sha256(CACHE_REPORT) != cache_before):
        OUT.unlink(missing_ok=True)
        raise SystemExit("export changed a report file")
    print("playback", OUT.stat().st_size, "bytes")


if __name__ == "__main__":
    main()
