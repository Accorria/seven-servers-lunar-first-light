from pathlib import Path

import pytest

from lfl.trust.mock_adapter import MockAttestationStore


def test_mock_register_verify_history(tmp_path: Path):
    store = MockAttestationStore(tmp_path / "receipts.json")
    digest = "a" * 64
    receipt = store.register(digest, "lunar_visibility_run", {"simulation_version": "0.1.0"})
    assert receipt["algorithm"] == "none"
    assert receipt["signature"] is None
    assert receipt["gate"] == "mock"
    assert "ML-DSA-65" not in str(receipt)
    assert store.verify(receipt["ref"], digest)["match"] is True
    assert store.verify(receipt["ref"], "b" * 64)["match"] is False
    history = store.history(receipt["ref"])
    assert [event["type"] for event in history["events"]][0] == "registered"
    assert history["algorithm"] == "none"


def test_mock_rejects_bad_hash(tmp_path: Path):
    store = MockAttestationStore(tmp_path / "receipts.json")
    with pytest.raises(ValueError):
        store.register("not-a-hash", "lunar_visibility_run", {})
