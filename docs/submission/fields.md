# NASA Space Apps submission fields

Project name: Seven Servers — Lunar First Light

Public project link: https://seven-servers-lunar-first-light.vercel.app

Guided demo: https://seven-servers-lunar-first-light.vercel.app/demo

Challenge: Lunar Landing Site Navigator

High-level summary: Lunar First Light compares terrain-masked Sun and Earth visibility at the Shackleton–de Gerlache Connecting Ridge and Mons Mouton. Horizons come from LRO LOLA elevation. Directions come from NAIF SPICE and are checked against JPL Horizons. The report separates geometry from power, radio, and future research modules.

NASA data:
- LRO LOLA GDR ldem_75s_240m, PDS Geosciences Node
- PGDA product 78, Barker et al. 2021, Site01 and Site20 GeoTIFFs
- NAIF SPICE kernels de421, moon_pa_de421, moon_080317, naif0012, pck00010
- JPL Horizons observer ephemeris API
- USGS Gazetteer of Planetary Nomenclature, Mons Mouton, feature 16070
- NASA OTPS Space-Based Solar Power study, NTRS 20240008752, quoted only in the research page

Use of AI: Cursor and Grok assisted architecture and implementation. Charts are rendered from calculated results. No AI-generated imagery is used as a scientific figure.

Demo: docs/submission/slides.html, seven slides.

References: docs/submission/references.md

Portal submit requires the founder's authenticated Space Apps session. This package is the handoff if that session is not available in the build environment.
