# Attribution

Lunar First Light is a Seven Servers research tool. It is not a NASA operational product, and a Seven Servers account is not a NASA credential.

## NASA measured and NASA processed

- LOLA south-polar and site DEMs are NASA Planetary Data System and Planetary Geodesy Data Archive products. Site A is the highest valid pixel in PGDA Site01. Site B elevation is sampled from `ldem_75s_240m` because the Site20 tile does not contain the IAU Mons Mouton center (USGS Gazetteer feature 16070).
- Sun and Earth directions use NAIF SPICE kernels listed in the method: `naif0012.tls`, `pck00010.tpc`, `moon_pa_de421_1900-2050.bpc`, `moon_080317.tf`, and `de421.bsp`, frame `MOON_ME`, aberration `LT+S`.
- The publish gate compares those directions with JPL Horizons quantity 4.
- Orbital color and the coarse globe height are NASA Scientific Visualization Studio CGI Moon Kit, SVS 4720, Ernie Wright and Noah Petro. Color is appearance only. It is not an input to the horizon.

## Simulation

Power, the six-node search, STONE traverse energy, and the QDK comparison use assumed hardware parameters on top of the published sunlight fraction or the published samples. The Star of David layout is Preston Jordan Jr.’s proposed architecture at an assumed 1 km radius. It is not a surveyed coordinate set. Edges are not a power flow.

## Welcome stills

These pictures are decorative. They are not inputs to the horizon, and they are not the sky for 1–8 November 2026. Sun and Earth positions on the mission view stay the published DE421 samples. Byte sizes and hashes are in `apps/web/public/welcome/welcome.json`. `scripts/build_welcome_stills.py` rebuilds them. The OpenEXR master and the full Blue Marble JPEG are not served.

- Earth disc, 161386 bytes: eastern-hemisphere Twin Blue Marble, NASA images by Reto Stöckli, based on data from NASA and NOAA. https://science.nasa.gov/resource/twin-blue-marbles/ Source file `ipcc_bluemarble_east_lrg.jpg`, encoded as `earth-disc.webp`.
- Moon disc, 60918 bytes: the existing SVS 4720 color map projected to an orthographic disc with a fixed side light. That light is not the published Sun vector.
- Star field, 92536 bytes, 1920×960: NASA/Goddard Space Flight Center Scientific Visualization Studio, Deep Star Maps 2020, galactic coordinates, from `starmap_2020_4k_gal.exr`. https://svs.gsfc.nasa.gov/4851 Gaia DR2: ESA/Gaia/DPAC. Constellation figures in that product are based on those developed for the IAU by Alan MacRobert of Sky and Telescope magazine (Roger Sinnott and Rick Fienberg). The browser file is a darkened WebP. The EXR is not in the app. The same file is a dim backdrop on Arrive and Turn only.

## Visualization only

Camera flight, globe cutout, mesh edge fade, and the busy pixel ratio are adapted from lunar-navigator (`web/src/scene/Rig.tsx`, `MoonTerrain.tsx`, `Globe.tsx`, `pickRay.ts`, `MovingDetail.tsx`, and the pixel-ratio path in `MoonCanvas.tsx`). That project is Apache-2.0 and has no NOTICE file and no per-file copyright header. The adapted files in this repo carry a header, and `apps/web/THIRD_PARTY_NOTICES.md` includes the license. Its ephemeris, horizon engine, and height tiles are not used.

OX Forge was read for interaction patterns only: chapters, a skippable tour, hotspot buttons, an overlay that can be closed, and a WebGL fallback. No OX Forge file was copied.

## Mock receipt

The Accorria mock adapter stores a label. It does not produce a signature, and it is not NASA approval.
