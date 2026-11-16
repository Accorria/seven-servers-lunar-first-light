"""Local mock attestation adapter.

Receipts are integrity records only. They are not ML-DSA signatures.
"""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from pathlib import Path

from lfl.fingerprint import require_sha256

FORBIDDEN = ("ML-DSA-65", "cryptographic signature", "signed")


class MockAttestationStore:
    def __init__(self, path: Path) -> None:
        self.path = path
        self.path.parent.mkdir(parents=True, exist_ok=True)
        if not self.path.exists():
            self.path.write_text("[]", encoding="utf-8")

    def _load(self) -> list[dict]:
        return json.loads(self.path.read_text(encoding="utf-8"))

    def _save(self, rows: list[dict]) -> None:
        self.path.write_text(json.dumps(rows, indent=2), encoding="utf-8")

    def register(self, record_hash: str, subject_type: str, metadata: dict) -> dict:
        digest = require_sha256(record_hash)
        now = datetime.now(timezone.utc).isoformat()
        ref = "mock_" + uuid.uuid4().hex[:16]
        receipt = {
            "ref": ref,
            "gate": "mock",
            "algorithm": "none",
            "signature": None,
            "signature_valid": False,
            "label": "Mock integrity receipt — not a cryptographic signature",
            "subject_type": subject_type,
            "record_hash": digest,
            "canonicalization": "accorria-canonical-json-v1",
            "registered_at": now,
            "metadata": metadata,
        }
        _reject_signature_claim(receipt)
        rows = self._load()
        rows.append({"receipt": receipt, "events": [{"type": "registered", "at": now, "record_hash": digest}]})
        self._save(rows)
        return receipt

    def verify(self, ref: str, record_hash: str) -> dict:
        digest = require_sha256(record_hash)
        row = self._find(ref)
        matched = row["receipt"]["record_hash"] == digest
        now = datetime.now(timezone.utc).isoformat()
        row["events"].append({"type": "verified", "at": now, "record_hash": digest, "match": matched})
        rows = self._load()
        for index, item in enumerate(rows):
            if item["receipt"]["ref"] == ref:
                rows[index] = row
        self._save(rows)
        return {
            "ref": ref,
            "match": matched,
            "signature_valid": False,
            "algorithm": "none",
            "gate": "mock",
            "label": "Mock integrity receipt — not a cryptographic signature",
        }

    def history(self, ref: str) -> dict:
        row = self._find(ref)
        return {
            "ref": ref,
            "gate": "mock",
            "algorithm": "none",
            "signature": None,
            "events": row["events"],
        }

    def _find(self, ref: str) -> dict:
        for row in self._load():
            if row["receipt"]["ref"] == ref:
                return row
        raise KeyError(ref)


def _reject_signature_claim(receipt: dict) -> None:
    blob = json.dumps(receipt)
    if receipt.get("algorithm") == "ML-DSA-65" or receipt.get("signature"):
        raise RuntimeError("mock receipt must not carry a signature")
    for phrase in ("cryptographic signature",):
        if phrase in blob.lower() and "not a cryptographic signature" not in blob.lower():
            raise RuntimeError("mock wording claims a signature")
    if "ML-DSA-65" in blob:
        raise RuntimeError(FORBIDDEN[0])
