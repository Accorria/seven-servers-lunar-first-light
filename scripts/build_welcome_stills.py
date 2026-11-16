"""Build the welcome stills. Does not run a horizon or a renderer.

Moon disc comes from the existing SVS 4720 color map at
apps/web/public/globe/moon-color.webp. Earth and stars are optional sources
passed on the command line. The OpenEXR master and the full Blue Marble JPEG
are not written into the web app.

  python scripts/build_welcome_stills.py \
    --earth data/welcome-src/earth-east.jpg \
    --stars-exr data/welcome-src/starmap_2020_4k_gal.exr
"""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
MOON_COLOR = ROOT / "apps" / "web" / "public" / "globe" / "moon-color.webp"
OUT = ROOT / "apps" / "web" / "public" / "welcome"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def sample_bilinear(image: np.ndarray, x: np.ndarray, y: np.ndarray) -> np.ndarray:
    height, width = image.shape[:2]
    x = np.mod(x, width)
    y = np.clip(y, 0, height - 1.001)
    x0 = np.floor(x).astype(np.int32)
    y0 = np.floor(y).astype(np.int32)
    x1 = (x0 + 1) % width
    y1 = np.minimum(y0 + 1, height - 1)
    tx = (x - x0)[..., None]
    ty = (y - y0)[..., None]
    top = image[y0, x0] * (1 - tx) + image[y0, x1] * tx
    bottom = image[y1, x0] * (1 - tx) + image[y1, x1] * tx
    return top * (1 - ty) + bottom * ty


def moon_disc(size: int = 1024) -> Image.Image:
    source = np.asarray(Image.open(MOON_COLOR).convert("RGB"), dtype=np.float32) / 255.0
    height, width = source.shape[:2]
    grid_y, grid_x = np.mgrid[0:size, 0:size]
    nx = (grid_x + 0.5) / size * 2 - 1
    ny = 1 - (grid_y + 0.5) / size * 2
    radius_sq = nx * nx + ny * ny
    nz = np.sqrt(np.clip(1 - radius_sq, 0, 1))
    longitude = np.arctan2(nx, nz)
    latitude = np.arcsin(np.clip(ny, -1, 1))
    # The color map is centered on longitude 0, matching MoonGlobe.
    pixel_x = (longitude + np.pi) / (2 * np.pi) * (width - 1)
    pixel_y = (np.pi / 2 - latitude) / np.pi * (height - 1)
    color = sample_bilinear(source, pixel_x, pixel_y)
    light = np.array([0.62, 0.34, 0.71], dtype=np.float32)
    light /= np.linalg.norm(light)
    lambert = np.clip(nx * light[0] + ny * light[1] + nz * light[2], 0, 1)
    shade = (0.18 + 0.82 * lambert) * (1 - 0.22 * np.clip(radius_sq, 0, 1))
    rgb = np.clip(color * shade[..., None], 0, 1)
    radius = np.sqrt(radius_sq)
    alpha = np.clip((1.015 - radius) / 0.03, 0, 1)
    halo = np.clip((1.06 - radius) / 0.06, 0, 1) * np.clip((radius - 0.98) / 0.04, 0, 1)
    glow = np.array([0.72, 0.7, 0.66], dtype=np.float32)
    rgb = np.clip(rgb * alpha[..., None] + glow * halo[..., None] * 0.35, 0, 1)
    alpha = np.clip(alpha + halo * 0.45, 0, 1)
    rgba = np.dstack([rgb, alpha])
    return Image.fromarray((rgba * 255).astype(np.uint8), mode="RGBA")


def earth_disc(path: Path, size: int = 1024) -> Image.Image:
    source = np.asarray(Image.open(path).convert("RGB"))
    gray = source.mean(axis=2)
    rows, cols = np.where(gray > 12)
    center_x = (cols.min() + cols.max()) / 2
    center_y = (rows.min() + rows.max()) / 2
    radius = max(cols.max() - cols.min(), rows.max() - rows.min()) / 2
    pad = radius * 0.12
    left = int(max(0, np.floor(center_x - radius - pad)))
    right = int(min(source.shape[1], np.ceil(center_x + radius + pad)))
    top = int(max(0, np.floor(center_y - radius - pad)))
    bottom = int(min(source.shape[0], np.ceil(center_y + radius + pad)))
    crop = Image.fromarray(source[top:bottom, left:right]).resize((size, size), Image.Resampling.LANCZOS)
    pixels = np.asarray(crop).astype(np.float32) / 255.0
    grid_y, grid_x = np.mgrid[0:size, 0:size]
    nx = (grid_x + 0.5) / size * 2 - 1
    ny = (grid_y + 0.5) / size * 2 - 1
    radius_map = np.sqrt(nx * nx + ny * ny)
    body = np.clip((0.985 - radius_map) / 0.02, 0, 1)
    limb = np.clip((1.045 - radius_map) / 0.07, 0, 1) * np.clip((radius_map - 0.9) / 0.08, 0, 1)
    air = np.array([0.55, 0.75, 0.95], dtype=np.float32)
    rgb = np.clip(pixels * body[..., None] + air * limb[..., None] * 0.55, 0, 1)
    alpha = np.clip(body + limb * 0.7, 0, 1)
    rgba = np.dstack([rgb, alpha])
    return Image.fromarray((rgba * 255).astype(np.uint8), mode="RGBA")


def save_webp(image: Image.Image, path: Path, budget: int) -> None:
    quality = 82
    while quality >= 50:
        image.save(path, format="WEBP", quality=quality, method=6)
        if path.stat().st_size <= budget:
            return
        quality -= 6
    raise SystemExit(f"{path.name} is {path.stat().st_size} bytes, over {budget}")


def stars_from_exr(path: Path, destination: Path) -> None:
    if shutil.which("convert") is None:
        raise SystemExit("ImageMagick convert is required to read the OpenEXR master")
    # Tone-map in a temp PNG. The EXR itself is not copied into the web app.
    temporary = destination.with_suffix(".tone.png")
    subprocess.run(
        [
            "convert",
            str(path),
            "-resize",
            "1920x960",
            "-evaluate",
            "multiply",
            "3.2",
            "-gamma",
            "1.55",
            "-modulate",
            "78,100,100",
            "-depth",
            "8",
            str(temporary),
        ],
        check=True,
    )
    image = Image.open(temporary).convert("RGB")
    temporary.unlink(missing_ok=True)
    quality = 70
    while quality >= 40:
        image.save(destination, format="WEBP", quality=quality, method=6)
        if destination.stat().st_size <= 250 * 1024:
            return
        quality -= 6
    raise SystemExit(f"stars.webp is {destination.stat().st_size} bytes, over 250 KB")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--earth", type=Path)
    parser.add_argument("--stars-exr", type=Path)
    args = parser.parse_args()
    if not MOON_COLOR.exists():
        raise SystemExit(f"missing {MOON_COLOR}")
    OUT.mkdir(parents=True, exist_ok=True)
    moon_path = OUT / "moon-disc.webp"
    save_webp(moon_disc(), moon_path, 180 * 1024)
    record: dict[str, object] = {
        "schema": "seven-servers.welcome-stills.v1",
        "role": "decorative welcome and orbit backdrop; not a science input",
        "moon": {
            "file": "moon-disc.webp",
            "bytes": moon_path.stat().st_size,
            "sha256": sha256(moon_path),
            "source": "apps/web/public/globe/moon-color.webp",
            "credit": "NASA Scientific Visualization Studio CGI Moon Kit, SVS 4720. Ernie Wright and Noah Petro. Projected to a disc for the welcome. Not the published Sun direction.",
        },
    }
    if args.earth:
        earth_path = OUT / "earth-disc.webp"
        save_webp(earth_disc(args.earth), earth_path, 180 * 1024)
        record["earth"] = {
            "file": "earth-disc.webp",
            "bytes": earth_path.stat().st_size,
            "sha256": sha256(earth_path),
            "source_url": "https://science.nasa.gov/resource/twin-blue-marbles/",
            "source_file": "ipcc_bluemarble_east_lrg.jpg",
            "credit": "Eastern-hemisphere Twin Blue Marble. NASA images by Reto Stöckli, based on data from NASA and NOAA.",
        }
    if args.stars_exr:
        stars_path = OUT / "stars.webp"
        stars_from_exr(args.stars_exr, stars_path)
        record["stars"] = {
            "file": "stars.webp",
            "bytes": stars_path.stat().st_size,
            "width": 1920,
            "height": 960,
            "sha256": sha256(stars_path),
            "source_url": "https://svs.gsfc.nasa.gov/4851",
            "source_file": "starmap_2020_4k_gal.exr",
            "credit": "NASA/Goddard Space Flight Center Scientific Visualization Studio, Deep Star Maps 2020, galactic coordinates. Gaia DR2: ESA/Gaia/DPAC. Constellation figures based on those developed for the IAU by Alan MacRobert of Sky and Telescope (Roger Sinnott and Rick Fienberg). A picture of the catalog sky, not the lunar sky for 1–8 November 2026.",
        }
    (OUT / "welcome.json").write_text(json.dumps(record, indent=2) + "\n")
    for item in record.values():
        if isinstance(item, dict) and "bytes" in item:
            print(f"{item['file']} {item['bytes']} bytes")


if __name__ == "__main__":
    main()
