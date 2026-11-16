# Data pipeline

Science inputs stay in `data/dems` and `data/kernels`. Derived views are written only under `apps/web/public`.

## Sources

`python scripts/download_data.py` reads `data/manifests/sources.json`. If a file is already present and its SHA-256 does not match, the script stops and names the file. It does not treat that file as downloaded. Moon Kit rasters are listed there and are gitignored under `data/globe-src/`.

## Globe

`python scripts/build_globe_assets.py` writes `apps/web/public/globe/moon-color.webp`, `moon-height.png`, and `globe.json`. Height encoding is `h_m = (R * 256 + G) * 0.5 - 10000`. The color map is not a science input.

## Terrain meshes

`python scripts/build_terrain_meshes.py` reads the existing LOLA grids through `lfl` and writes `apps/web/public/terrain/*.bin` plus `terrain.json`. The binary is magic `LFLM`, then vertex count, index count, float32 xyz kilometers, and uint32 indices. Original DEMs are not modified. Mons Mouton is taken from `ldem_75s_240m`.

## Playback

`python scripts/export_playback.py` reads the published report, refuses to continue if `record_hash` is not `dba4eb48f56fad5b2a7dbbc5a8cf558743f30f698d53210def97cfbef04eb2b3`, and writes `apps/web/public/results/playback.json` with 169 hourly samples. It deletes that output if the report bytes change while it runs.

## Jobs

The science service keeps job results in memory. `POST /v1/jobs` does not write `data/cache/report.json`. Same-origin browser calls go to `/api/science/*`, which proxies `SCIENCE_ORIGIN`. An empty origin returns 503 and the pages keep the published week.
