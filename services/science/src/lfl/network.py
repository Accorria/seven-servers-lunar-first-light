"""Six-point network with two distinct processing facilities."""

from __future__ import annotations

from lfl.power import energy_step

POINT_NODES = ("N1", "N2", "N3", "N4", "N5", "N6")
FACILITIES = ("F_POS", "F_NEG")
CENTER = "C"


def topology() -> dict:
    positive = ("N1", "N3", "N5")
    negative = ("N2", "N4", "N6")
    edges = []
    for group, facility in ((positive, "F_POS"), (negative, "F_NEG")):
        nodes = list(group)
        for left, right in zip(nodes, nodes[1:] + nodes[:1]):
            edges.append({"a": left, "b": right, "pathway": facility})
        for node in nodes:
            edges.append({"a": node, "b": CENTER, "pathway": "center"})
        edges.append({"a": facility, "b": CENTER, "pathway": facility})
    return {
        "point_nodes": list(POINT_NODES),
        "processing_facilities": list(FACILITIES),
        "center": CENTER,
        "edges": edges,
        "attribution": "Preston Jordan Jr., originator of the six-point Star of David concept",
        "status": "proposed architecture; electrical results are calculated from assumptions",
    }


def simulate_configuration(
    operating_mask: int,
    *,
    sunlight_fraction: float,
    hours: float,
    node_area_m2: float,
    node_efficiency: float,
    demand_w: float,
    facility_demand_w: float,
    loss_fraction: float,
    battery_wh: float,
    eta_charge: float,
    eta_discharge: float,
    facility_available: tuple[bool, bool] = (True, True),
    mode: str = "stationary",
    mean_cosine: float = 1.0,
) -> dict:
    """One configuration of the six point-nodes. Facilities stay explicit inputs."""
    from lfl.power import SOLAR_CONSTANT_W_M2

    generated_w = 0.0
    nodes = {}
    for index, name in enumerate(POINT_NODES):
        operating = bool(operating_mask & (1 << index))
        power = 0.0
        if operating:
            power = sunlight_fraction * SOLAR_CONSTANT_W_M2 * node_area_m2 * node_efficiency * mean_cosine
        generated_w += power
        nodes[name] = {"operating": operating, "power_w": power, "collector_mode": mode}
    facilities = {
        "F_POS": {"available": facility_available[0], "demand_w": facility_demand_w if facility_available[0] else 0.0},
        "F_NEG": {"available": facility_available[1], "demand_w": facility_demand_w if facility_available[1] else 0.0},
    }
    demand = demand_w + facilities["F_POS"]["demand_w"] + facilities["F_NEG"]["demand_w"]
    seconds = hours * 3600.0
    generated_j = generated_w * seconds
    demand_j = demand * seconds
    loss_j = loss_fraction * generated_j
    result = energy_step(
        stored_j=battery_wh * 3600.0 * 0.5,
        capacity_j=battery_wh * 3600.0,
        generated_j=generated_j,
        demand_j=demand_j,
        loss_j=loss_j,
        eta_charge=eta_charge,
        eta_discharge=eta_discharge,
    )
    delivered = result["delivered_j"]
    shortfall = result["unmet_j"]
    return {
        "mask": operating_mask,
        "nodes": nodes,
        "facilities": facilities,
        "center": CENTER,
        "generated_j": generated_j,
        "delivered_j": delivered,
        "shortfall_j": shortfall,
        "objective_shortfall_j": shortfall,
        "balance_j": result["balance_j"],
        "collector_mode": mode,
    }


def exhaustive(sunlight_fraction: float, **kwargs) -> dict:
    records = [simulate_configuration(mask, sunlight_fraction=sunlight_fraction, **kwargs) for mask in range(64)]
    best = min(records, key=lambda item: (item["shortfall_j"], -item["delivered_j"]))
    return {"count": 64, "best": best, "configurations": records}


def _pack(records: list[dict], *, mode: str, site_id: str | None, note: str) -> dict:
    best = min(records, key=lambda item: (item["shortfall_j"], -item["delivered_j"]))
    return {
        "count": len(records),
        "best_mask": best["mask"],
        "best_shortfall_j": best["shortfall_j"],
        "best_delivered_j": best["delivered_j"],
        "facilities": best["facilities"],
        "nodes": best["nodes"],
        "balance_j": best["balance_j"],
        "collector_mode": mode,
        "site_id": site_id,
        "tie_break": "lowest mask among equal shortfall, then higher delivered energy",
        "status": note,
        "schema": "seven-servers.lunar-visibility.v2",
    }


def exhaustive_from_samples(
    samples: list[dict],
    *,
    step_seconds: float,
    mode: str,
    site_id: str | None,
    node_area_m2: float = 20.0,
    node_efficiency: float = 0.30,
    demand_w: float = 1500.0,
    facility_demand_w: float = 250.0,
    loss_fraction: float = 0.02,
    battery_wh: float = 5000.0,
    eta_charge: float = 0.95,
    eta_discharge: float = 0.95,
    tilt_deg: float = 60.0,
    panel_azimuth_deg: float = 0.0,
    facility_available: tuple[bool, bool] = (True, True),
) -> dict:
    """Per-step collector power from published Sun samples. Edges are not a power flow."""
    from lfl.power import electrical_power_w

    if not samples:
        raise ValueError("samples are required")
    seconds = step_seconds
    generated = []
    for sample in samples:
        sunlit = bool(sample["sun_center_clear"])
        watts = electrical_power_w(
            sunlit,
            float(sample["sun_azimuth_deg"]),
            float(sample["sun_elevation_deg"]),
            mode=mode,  # type: ignore[arg-type]
            area_m2=node_area_m2,
            efficiency=node_efficiency,
            tilt_deg=tilt_deg,
            panel_azimuth_deg=panel_azimuth_deg,
        )
        generated.append(watts * seconds)
    one_node_j = float(sum(generated))
    records = []
    for mask in range(64):
        operating = bin(mask).count("1")
        generated_j = one_node_j * operating
        nodes = {}
        for index, name in enumerate(POINT_NODES):
            on = bool(mask & (1 << index))
            nodes[name] = {"operating": on, "energy_j": one_node_j if on else 0.0, "collector_mode": mode}
        facilities = {
            "F_POS": {"available": facility_available[0], "demand_w": facility_demand_w if facility_available[0] else 0.0},
            "F_NEG": {"available": facility_available[1], "demand_w": facility_demand_w if facility_available[1] else 0.0},
        }
        demand = demand_w + facilities["F_POS"]["demand_w"] + facilities["F_NEG"]["demand_w"]
        demand_j = demand * seconds * len(samples)
        loss_j = loss_fraction * generated_j
        result = energy_step(
            stored_j=battery_wh * 3600.0 * 0.5,
            capacity_j=battery_wh * 3600.0,
            generated_j=generated_j,
            demand_j=demand_j,
            loss_j=loss_j,
            eta_charge=eta_charge,
            eta_discharge=eta_discharge,
        )
        records.append(
            {
                "mask": mask,
                "nodes": nodes,
                "facilities": facilities,
                "delivered_j": result["delivered_j"],
                "shortfall_j": result["unmet_j"],
                "balance_j": result["balance_j"],
            }
        )
    return _pack(
        records,
        mode=mode,
        site_id=site_id,
        note="calculated from assumed hardware and per-step power.py incidence on the supplied Sun samples",
    )
