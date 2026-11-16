"""Classical 64-state baseline and a QDK simulation when the package runs."""

from __future__ import annotations

import json
import traceback
from pathlib import Path

from lfl.network import exhaustive

ROOT = Path(__file__).resolve().parents[2]
REPORT = ROOT / "data" / "cache" / "report.json"
OUTPUT = Path(__file__).resolve().parent / "result.json"


def classical(sunlight_fraction: float) -> dict:
    result = exhaustive(
        sunlight_fraction,
        hours=24.0,
        node_area_m2=20.0,
        node_efficiency=0.30,
        demand_w=1500.0,
        facility_demand_w=250.0,
        loss_fraction=0.02,
        battery_wh=5000.0,
        eta_charge=0.95,
        eta_discharge=0.95,
        mode="stationary",
        mean_cosine=0.5,
    )
    best = result["best"]
    return {
        "configurations": 64,
        "sunlight_fraction": sunlight_fraction,
        "best_mask": best["mask"],
        "best_shortfall_j": best["shortfall_j"],
        "best_delivered_j": best["delivered_j"],
        "objective": "minimize shortfall joules",
        "facilities_present": list(best["facilities"]),
    }


def quantum_attempt(best_mask: int, sunlight_fraction: float) -> dict:
    from lfl.network import simulate_configuration

    def score(mask: int) -> float:
        return simulate_configuration(
            mask,
            sunlight_fraction=sunlight_fraction,
            hours=24.0,
            node_area_m2=20.0,
            node_efficiency=0.30,
            demand_w=1500.0,
            facility_demand_w=250.0,
            loss_fraction=0.02,
            battery_wh=5000.0,
            eta_charge=0.95,
            eta_discharge=0.95,
            mode="stationary",
            mean_cosine=0.5,
        )["shortfall_j"]

    optimum = score(best_mask)
    try:
        import importlib.metadata

        from qdk import qsharp

        version = importlib.metadata.version("qdk")
        qsharp.eval(
            """
            operation QaoaShot(gamma : Double, beta : Double) : Int {
                use qs = Qubit[6];
                for q in qs { H(q); }
                within { for q in qs { X(q); } }
                apply { Controlled Rz(qs[0..4], (gamma, qs[5])); }
                for q in qs { Rx(beta, q); }
                mutable mask = 0;
                for i in 0..5 {
                    if MResetZ(qs[i]) == One { set mask += 1 <<< i; }
                }
                return mask;
            }
            """
        )
        smoke = qsharp.run("{ use q = Qubit(); H(q); return MResetZ(q); }", shots=8)
        shots = qsharp.run("QaoaShot(1.2, 0.4)", shots=64)
        scored = [(int(mask), score(int(mask))) for mask in shots]
        sampled_mask, sampled_objective = min(scored, key=lambda item: item[1])
        ratio = None if optimum == 0 else sampled_objective / optimum
        met = abs(sampled_objective - optimum) <= 1e-6 * max(1.0, abs(optimum))
        return {
            "status": "simulator",
            "package": "qdk",
            "version": version,
            "simulator": "sparse",
            "smoke_shots": len(smoke),
            "circuit": "p=1 QAOA, phase on the all-off state, Rx mixer, gamma=1.2, beta=0.4",
            "shots": 64,
            "sampled_mask": sampled_mask,
            "sampled_objective_shortfall_j": sampled_objective,
            "exhaustive_optimum_mask": best_mask,
            "exhaustive_optimum_shortfall_j": optimum,
            "objective_ratio_sampled_over_optimum": ratio,
            "sample_met_optimum_shortfall": met,
            "hardware_job": None,
            "advantage_claimed": False,
        }
    except Exception as exc:
        return {
            "status": "unavailable",
            "error": str(exc),
            "traceback": traceback.format_exc(limit=3),
            "sampled_objective_shortfall_j": None,
            "hardware_job": None,
            "advantage_claimed": False,
        }


def main() -> None:
    report = json.loads(REPORT.read_text(encoding="utf-8"))
    site_a = next(item for item in report["results"] if item["id"] == "site_a")
    fraction = float(site_a["sun_center_clear"]["true_fraction"])
    baseline = classical(fraction)
    quantum = quantum_attempt(int(baseline["best_mask"]), fraction)
    document = {
        "source_report_hash": report["record_hash"],
        "classical": baseline,
        "quantum": quantum,
        "note": "Hardware fields stay empty. A quantum result is shown only when this file records a completed simulator run.",
    }
    OUTPUT.write_text(json.dumps(document, indent=2), encoding="utf-8")
    print(json.dumps({"classical_best": baseline["best_mask"], "quantum_status": quantum["status"]}, indent=2))


if __name__ == "__main__":
    main()
