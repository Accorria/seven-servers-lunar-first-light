# Seven Servers — Lunar First Light

Research application and qualification platform for the **NASA Space Apps 2026 Lunar Landing Site Navigator** challenge.

**Team**: Seven Servers  
**Project**: Lunar First Light  
**Challenge**: Lunar Landing Site Navigator  
**Public Application**: https://seven-servers-lunar-first-light.vercel.app  
**Public Repository**: https://github.com/Accorria/seven-servers-lunar-first-light  

---

## Executive Summary & Research Methodology

Lunar First Light qualifies candidates for lunar south pole surface exploration by comparing terrain-masked solar illumination and direct Earth line-of-sight visibility across candidate landing sites:
1. **Site A**: Shackleton–de Gerlache Connecting Ridge (sampled at the highest valid elevation point in PGDA Site01: 89.43891° S, 222.85643° E, 1968.0 m).
2. **Site B**: Mons Mouton massif center (sampled at 84.47458° S, 329.80905° E, 5972.7 m on the LOLA 240 m polar grid, corresponding to USGS Gazetteer feature 16070).

### Key Scientific Distinctions
- **Geometric Visibility vs. Usable Power**: Geometric line-of-sight to the solar disk and Earth is computed strictly from topography and ephemeris. Geometric sunlight is not electrical power (which depends on incidence angle, array efficiency, panel orientation, and dust obscuration).
- **Line-of-Sight vs. Radio Links**: Optical line-of-sight to the Earth center or limb is distinct from RF link margin, atmospheric losses, or lunar ground station relay availability.
- **Topographic Horizon Masking**: Radial horizon profiles are extracted from Lunar Reconnaissance Orbiter (LRO) Lunar Orbiter Laser Altimeter (LOLA) digital elevation models (DEMs).
- **Planetary Ephemeris**: Target and observer vectors are computed using NAIF SPICE ephemerides (`MOON_ME` frame with light-time and stellar aberration corrections) and verified against JPL Horizons quantity 4.

---

## Research Results (Published 169-Hour Epoch: 1–8 November 2026)

| Parameter | Site A (Connecting Ridge) | Site B (Mons Mouton) |
| :--- | :--- | :--- |
| **Solar Center-Clear Illumination** | 134.0 hours (79.3%) | 0.0 hours (0.0%) |
| **Earth Center-Clear Visibility** | 169.0 hours (100.0%) | 169.0 hours (100.0%) |
| **Longest Interior Night** | 24.0 hours | 169.0 hours |
| **Elevation** | 1,968.0 m | 5,972.7 m |
| **Dataset Resolution** | LOLA 5 m/px GeoTIFF (PGDA 78) | LOLA 240 m/px Polar Stereographic |

---

## Technology Stack

- **Frontend & Visualization**: Next.js 15 (App Router), React 19, Three.js / React Three Fiber, Tailwind CSS, Web Audio API / Web Speech Synthesis narration.
- **Ephemeris & Topography Engine**: Python 3.12, NumPy, FastAPI, SpiceyPy (NAIF CSPICE wrapper), Rasterio, PyProj, Pytest.
- **Mission Architectures**: STONE traverse energy simulation, Space-Based Solar Power (SBSP) relay models, and Star of David node geometry.

---

## NASA & External Data Resources

- **LRO LOLA GDR**: `ldem_75s_240m.img` & `ldem_75s_240m.lbl` — PDS Geosciences Node (Washington University in St. Louis).
- **PGDA Product 78**: Barker et al. 2021 Site01 & Site20 high-resolution 5 m/px digital elevation models — NASA Goddard Space Flight Center.
- **NAIF SPICE Kernels**: `de421.bsp`, `moon_pa_de421_1900-2050.bpc`, `moon_080317.tf`, `naif0012.tls`, `pck00010.tpc` — JPL Navigation and Ancillary Information Facility.
- **JPL Horizons Ephemeris System**: Ground-truth validation for lunar-relative planetary vectors.
- **NASA Scientific Visualization Studio**: MoonKit (SVS 4720), Deep Star Maps 2020 (SVS 4851), and Twin Blue Marbles Earth visualization.
- **USGS Gazetteer of Planetary Nomenclature**: Feature 16070 (Mons Mouton).
- **NASA OTPS**: Space-Based Solar Power study (NTRS 20240008752).

---

## AI Assistance Disclosure

In compliance with NASA Space Apps submission standards:
- AI tools (Anthropic Claude, Grok, and Antigravity) assisted in software architecture, frontend implementation, component refactoring, test scaffolding, and user interface workflows.
- All astronomical ephemeris equations, topographic horizon extractions, and dataset validations are computed mathematically from official NASA PDS and NAIF SPICE sources.
- No AI model generated scientific elevation numbers, solar visibility figures, or planetary positions.

---

## Known Live-Recalculation Limitation

The production frontend deployed on Vercel serves the verified, static 169-hour published mission snapshot (`data/cache/report.json` and associated terrain meshes).

Live recalculation of arbitrary coordinates, dynamic mast heights, and on-demand SPICE vector generation requires the dedicated Python FastAPI science microservice (`services/science`). In environments where `SCIENCE_ORIGIN` is unconfigured, the application gracefully locks to the validated 169-hour research snapshot and indicates that live recalculation is offline.

---

## Local Development

```bash
# 1. Python Science Environment
python3 -m venv .venv
source .venv/bin/activate
pip install numpy fastapi uvicorn pydantic httpx rasterio pyproj spiceypy pytest

# Run tests
PYTHONPATH=services/science/src pytest services/science/tests

# 2. Frontend Application
cd apps/web
npm install
npm run dev -- --port 3456
```

Visit `http://localhost:3456/mission` for mission control.
