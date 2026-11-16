"""Download the LOLA products and SPICE kernels named in the manifests."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "data" / "manifests" / "sources.json"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> None:
    sources = json.loads(MANIFEST.read_text(encoding="utf-8"))
    for item in sources:
        destination = ROOT / item["path"]
        destination.parent.mkdir(parents=True, exist_ok=True)
        if not destination.exists():
            print("download", item["url"])
            with urlopen(item["url"], timeout=120) as response, destination.open("wb") as handle:
                handle.write(response.read())
        digest = sha256(destination)
        if digest != item["sha256"]:
            raise SystemExit(
                f"existing file failed its checksum and was not accepted: {destination} has {digest}, manifest expects {item['sha256']}"
            )
        print("ok", destination.name)


if __name__ == "__main__":
    main()
