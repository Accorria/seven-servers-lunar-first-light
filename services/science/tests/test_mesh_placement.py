"""Derived mesh vertices sit on the same sphere as lfl.frames."""

from __future__ import annotations

import struct
from pathlib import Path

import numpy as np

from lfl.dem import stereographic_xy
from lfl.frames import spherical_to_me

ROOT = Path(__file__).resolve().parents[3]
PATCH = ROOT / "apps" / "web" / "public" / "terrain" / "site01-patch.bin"
MOUTON = ROOT / "apps" / "web" / "public" / "terrain" / "mouton.bin"


def _positions(path: Path) -> np.ndarray:
    blob = path.read_bytes()
    assert blob[:4] == b"LFLM"
    vertices, indices = struct.unpack_from("<II", blob, 4)
    xyz = np.frombuffer(blob, dtype="<f4", count=vertices * 3, offset=12).reshape(vertices, 3)
    assert indices > 0
    return xyz


def test_site_a_patch_contains_the_published_pixel():
    expected_xy = np.array(stereographic_xy(222.85643000554958, -89.43890921454619))
    assert abs(expected_xy[0] + 11572.5) < 1e-6
    assert abs(expected_xy[1] + 12472.5) < 1e-6
    expected = spherical_to_me(222.85643000554958, -89.43890921454619, 1737.4 + 1.9594962158203125)
    nearest = np.linalg.norm(_positions(PATCH) - expected, axis=1).min()
    assert nearest < 0.01


def test_mouton_mesh_contains_the_iau_center():
    expected = spherical_to_me(31.0, -84.6, 1737.4 + 4.999)
    nearest = np.linalg.norm(_positions(MOUTON) - expected, axis=1).min()
    assert nearest < 0.25
