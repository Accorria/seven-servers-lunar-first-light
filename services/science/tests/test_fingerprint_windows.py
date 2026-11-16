from lfl.fingerprint import canonical_bytes, record_hash, require_sha256, sha256_hex
from lfl.windows import summarize_flags


def test_canonical_matches_accorria_form():
    document = {"b": 1, "a": {"d": 2, "c": 3}}
    assert canonical_bytes(document) == b'{"a":{"c":3,"d":2},"b":1}'
    digest = sha256_hex(canonical_bytes(document))
    assert require_sha256(digest) == digest
    assert record_hash(document) == digest


def test_hash_is_stable():
    left = {"step_seconds": 600, "sites": ["A", "B"]}
    right = {"sites": ["A", "B"], "step_seconds": 600}
    assert record_hash(left) == record_hash(right)


def test_longest_interior_gap():
    flags = [True, False, False, True, False, False, False, True]
    summary = summarize_flags(flags, 3600.0)
    assert summary["longest_interior_interruption_hours"] == 3.0
    assert summary["windows"][0]["duration_hours"] == 1.0


def test_edge_gap_is_window_bounded():
    summary = summarize_flags([False, False, True, True], 3600.0)
    assert summary["longest_interior_interruption_hours"] == 0.0
    assert summary["longest_window_bounded_interruption_hours"] == 2.0
