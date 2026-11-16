"""Accorria canonical JSON and SHA-256.

Matches accorria-core canonical_snapshot.canonical_bytes and sha256_hex:
UTF-8 JSON, sorted keys, separators (",", ":").
"""

from __future__ import annotations

import hashlib
import json
import re
from typing import Any

_SHA = re.compile(r"^[0-9a-f]{64}$")


def canonical_bytes(document: dict[str, Any]) -> bytes:
    body = json.dumps(document, sort_keys=True, separators=(",", ":"))
    return body.encode("utf-8")


def sha256_hex(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def record_hash(document: dict[str, Any]) -> str:
    return sha256_hex(canonical_bytes(document))


def require_sha256(value: str) -> str:
    if not _SHA.match(value or ""):
        raise ValueError("sha256 must be 64 hex characters")
    return value.lower()
