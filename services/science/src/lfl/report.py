"""Canonical scientific report."""

from __future__ import annotations

from lfl.fingerprint import record_hash


def build_report(payload: dict) -> dict:
    document = {
        "schema": "seven-servers.lunar-visibility.v1",
        "project": "Lunar First Light",
        "organization": "Seven Servers",
        "simulation_version": payload.get("simulation_version", "0.1.0"),
        "sites": payload["sites"],
        "interval_utc": payload["interval_utc"],
        "step_seconds": payload["step_seconds"],
        "mast_height_m": payload["mast_height_m"],
        "visibility_definition": "center_clear",
        "datasets": payload["datasets"],
        "kernels": payload["kernels"],
        "results": payload["results"],
        "method": payload["method"],
        "assumptions": payload.get("assumptions", []),
        "boundaries": [
            "Geometric sunlight is line-of-sight past terrain. It is not electrical power.",
            "Geometric Earth visibility is line-of-sight to Earth. It is not a radio link.",
            "A mock integrity receipt is not a cryptographic signature and is not NASA approval.",
        ],
    }
    document["record_hash"] = record_hash({key: value for key, value in document.items() if key != "record_hash"})
    return document


def render_markdown(report: dict) -> str:
    lines = [
        "# Seven Servers — Lunar First Light",
        "",
        "Research report. Not a NASA operational product and not a NASA endorsement.",
        "",
        f"Record hash: `{report['record_hash']}`",
        f"Simulation version: {report['simulation_version']}",
        f"Interval (UTC): {report['interval_utc']['start']} to {report['interval_utc']['stop']}",
        f"Step: {report['step_seconds']} seconds",
        f"Mast height: {report['mast_height_m']} m",
        "",
        "## Method",
        "",
        report["method"],
        "",
        "## Results",
        "",
    ]
    for site in report["results"]:
        lines.append(f"### {site['name']}")
        lines.append("")
        lines.append(f"- East longitude: {site.get('longitude_deg')}")
        lines.append(f"- Latitude: {site.get('latitude_deg')}")
        lines.append(f"- Elevation: {site.get('elevation_m')} m")
        lines.append(f"- Derivation: {site.get('derivation')}")
        sun = site["sun_center_clear"]
        earth = site["earth_center_clear"]
        lines.append(f"- Sun-center clear fraction: {sun['true_fraction']:.6f}")
        lines.append(f"- Longest interior sunlight interruption: {sun['longest_interior_interruption_hours']:.6f} h")
        lines.append(f"- Earth-center clear fraction: {earth['true_fraction']:.6f}")
        lines.append(f"- Longest interior Earth interruption: {earth['longest_interior_interruption_hours']:.6f} h")
        lines.append("")
    lines.append("## Datasets")
    lines.append("")
    for item in report["datasets"]:
        lines.append(f"- {item['name']} `{item['sha256']}` — {item['citation']}")
    lines.append("")
    lines.append("## Boundaries")
    lines.append("")
    for item in report["boundaries"]:
        lines.append(f"- {item}")
    lines.append("")
    return "\n".join(lines)
