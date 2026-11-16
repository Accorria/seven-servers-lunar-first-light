"""Convert NASA SVS CGI Moon Kit rasters into browser orbital textures.

Reads data/globe-src. Writes apps/web/public/globe. Does not run a horizon.
The color map is a visualization. Elevations in the science panels do not come from it.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "data" / "globe-src"
OUT = ROOT / "apps" / "web" / "public" / "globe"
COLOR = SRC / "lroc_color_16bit_srgb_4k.tif"
HEIGHT = SRC / "ldem_16_uint.tif"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> None:
    if not COLOR.exists() or not HEIGHT.exists():
        raise SystemExit("Moon Kit rasters are missing from data/globe-src")
    OUT.mkdir(parents=True, exist_ok=True)
    color = Image.open(COLOR).convert("RGB")
    if color.size[0] < 4096:
        raise SystemExit(f"color map is {color.size}, expected at least 4096 wide")
    color.thumbnail((4096, 2048), Image.Resampling.LANCZOS)
    color_path = OUT / "moon-color.webp"
    color.save(color_path, format="WEBP", quality=82, method=4)

    import rasterio

    with rasterio.open(HEIGHT) as dataset:
        raw = dataset.read(1)
    # Unsigned half-meters relative to radius 1,727,400 m, offset +20,000 DN.
    height_m = (raw.astype(np.float32) - 20000.0) * 0.5
    small = Image.fromarray(height_m).resize((2048, 1024), Image.Resampling.BILINEAR)
    values = np.asarray(small, dtype=np.float32)
    encoded = np.clip(np.rint((values + 10000.0) * 2.0), 0, 65535).astype(np.uint16)
    rgb = np.zeros((encoded.shape[0], encoded.shape[1], 3), dtype=np.uint8)
    rgb[:, :, 0] = (encoded >> 8).astype(np.uint8)
    rgb[:, :, 1] = (encoded & 255).astype(np.uint8)
    height_path = OUT / "moon-height.png"
    Image.fromarray(rgb, mode="RGB").save(height_path)

    document = {
        "schema": "seven-servers.lunar-globe.v1",
        "role": "orbital visualization only",
        "radius_km": 1737.4,
        "credit": "NASA Scientific Visualization Studio CGI Moon Kit, SVS 4720. Ernie Wright and Noah Petro. Color is adapted for appearance and is not a science input.",
        "color": {
            "file": "moon-color.webp",
            "width": color.size[0],
            "height": color.size[1],
            "source": "lroc_color_16bit_srgb_4k.tif",
            "source_sha256": sha256(COLOR),
            "sha256": sha256(color_path),
        },
        "height": {
            "file": "moon-height.png",
            "width": 2048,
            "height": 1024,
            "source": "ldem_16_uint.tif",
            "source_sha256": sha256(HEIGHT),
            "sha256": sha256(height_path),
            "encoding": "h_m = (R * 256 + G) * 0.5 - 10000, relative to the 1737.4 km sphere",
            "source_units": "unsigned 16-bit half-meters with DN offset +20000 from radius 1727400 m",
        },
    }
    (OUT / "globe.json").write_text(json.dumps(document, indent=2), encoding="utf-8")
    print("color", color.size, color_path.stat().st_size)
    print("height", height_path.stat().st_size)


if __name__ == "__main__":
    main()
