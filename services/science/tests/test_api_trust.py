from fastapi.testclient import TestClient

from lfl.api import app

client = TestClient(app)


def test_mock_attestation_round_trip():
    digest = "ab" * 32
    created = client.post(
        "/api/v1/attestations",
        json={
            "subject_type": "lunar_visibility_run",
            "record_hash": digest,
            "canonicalization": "accorria-canonical-json-v1",
            "metadata": {"simulation_version": "0.1.0"},
        },
    )
    assert created.status_code == 200
    body = created.json()["receipt"]
    assert body["algorithm"] == "none"
    assert body["signature"] is None
    assert "ML-DSA-65" not in created.text
    ref = body["ref"]
    verified = client.post(f"/api/v1/attestations/{ref}/verify", json={"record_hash": digest})
    assert verified.json()["match"] is True
    assert verified.json()["signature_valid"] is False
    changed = client.post(f"/api/v1/attestations/{ref}/verify", json={"record_hash": "cd" * 32})
    assert changed.json()["match"] is False
    history = client.get(f"/api/v1/attestations/{ref}/history")
    assert history.json()["events"][0]["type"] == "registered"
