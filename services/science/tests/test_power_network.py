import pytest

from lfl.network import exhaustive, topology
from lfl.power import cos_incidence, electrical_power_w, energy_step


def test_tracking_cosine_is_one_when_sunlit_above_horizon():
    assert cos_incidence("sun_tracking", 40.0, 15.0) == pytest.approx(1.0)
    assert cos_incidence("stationary", 0.0, 30.0) == pytest.approx(0.5)
    tilted = cos_incidence("tilted", 180.0, 20.0, tilt_deg=70.0, panel_azimuth_deg=180.0)
    assert tilted == pytest.approx(1.0, abs=1e-9)


def test_shadow_produces_no_power():
    assert electrical_power_w(False, 0.0, 40.0, mode="sun_tracking") == 0.0


def test_energy_balance_and_storage_change():
    result = energy_step(
        stored_j=1000.0,
        capacity_j=5000.0,
        generated_j=2000.0,
        demand_j=500.0,
        loss_j=100.0,
        eta_charge=0.9,
        eta_discharge=0.9,
    )
    assert result["balance_j"] == pytest.approx(0.0, abs=1e-9)
    assert result["stored_j"] - 1000.0 == pytest.approx(0.9 * result["charge_bus_j"])
    assert 0.0 <= result["stored_j"] <= 5000.0


def test_discharge_does_not_create_energy():
    result = energy_step(
        stored_j=1000.0,
        capacity_j=5000.0,
        generated_j=100.0,
        demand_j=800.0,
        loss_j=50.0,
        eta_charge=0.9,
        eta_discharge=0.8,
    )
    assert result["balance_j"] == pytest.approx(0.0, abs=1e-9)
    assert result["unmet_j"] >= 0.0
    assert result["stored_j"] == pytest.approx(1000.0 - result["removed_j"])


def test_topology_keeps_two_facilities():
    model = topology()
    assert model["processing_facilities"] == ["F_POS", "F_NEG"]
    assert len(model["point_nodes"]) == 6
    assert model["center"] == "C"


def test_exhaustive_baseline_has_64_states():
    result = exhaustive(
        0.5,
        hours=1.0,
        node_area_m2=10.0,
        node_efficiency=0.3,
        demand_w=1000.0,
        facility_demand_w=200.0,
        loss_fraction=0.02,
        battery_wh=1000.0,
        eta_charge=0.95,
        eta_discharge=0.95,
        mode="stationary",
        mean_cosine=0.5,
    )
    assert result["count"] == 64
    assert len(result["configurations"]) == 64
    assert "F_POS" in result["best"]["facilities"]
    assert "F_NEG" in result["best"]["facilities"]
