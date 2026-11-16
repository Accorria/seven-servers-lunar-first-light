# Method

Observer positions are planetocentric latitude and east longitude on a sphere of radius 1737.4 km, the LOLA GDR reference radius. Site A is the highest pixel in PGDA Site01. Site B is the IAU Mons Mouton feature center, feature 16070, latitude -84.60°, longitude 31.00° east. Site20 does not contain that center, so its elevation is sampled from LDEM_75S_240M.

Map coordinates use a south-polar stereographic projection with the scale true at the pole, central meridian 0, and radius 1737400 m. Positive Y points toward east longitude 0. This matches the Site01 and Site20 GeoTIFF projection.

The terrain elevation angle of a point is the arcsine of the unit line-of-sight dotted with the local vertical. Both positions are absolute in the MOON_ME frame, so lunar curvature is included. Each horizon bin is 0.5°. Rays extend to 250 km at 0.48 km steps. A higher-resolution site tile replaces the regional sample where the tile contains the ground point.

Sun and Earth directions are SPICE states with light-time and stellar aberration in the MOON_ME frame furnished by DE421, the DE421 lunar orientation kernel, and the Moon frame kernel. A center is clear when its elevation is greater than the terrain horizon at its azimuth. Limb clearance is reported separately using the angular radius from range.

The same kernels, step, mast height, and center-clear definition are used for both sites. A gap that touches the requested interval boundary is window-bounded. An interior gap is the interruption metric.

Agreement with JPL Horizons observer azimuth and elevation, quantity 4, at the same geodetic site, is an acceptance gate of 0.05° RMS before windows are marked publishable.

Collector power, battery joules, Earth-orbit efficiencies, and STONE traverse energy are separate engineering calculations with explicit assumed parameters.

The published report hash covers the v1 document. The 169 hourly samples live in a sibling playback file that records that hash and does not replace it. A new coordinate, mast, or date range is a v2 job. Its result is labeled live only after the worker finishes. A rejected point, a worker error, or a missing science service leaves the published week in place and says so. The browser does not march horizons or call SPICE.

Orbital color and the coarse globe height are the SVS CGI Moon Kit, for appearance. Site terrain in the view is a derived mesh of the same LOLA grids the Python sampler uses. The mesh is not a second visibility engine.
