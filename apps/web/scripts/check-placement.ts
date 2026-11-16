import { inverseStereographic, sphericalToMe, stereographicXy } from "../lib/placement.ts";

const [x, y] = stereographicXy(222.85643000554958, -89.43890921454619);
if (Math.abs(x + 11572.5) > 0.01 || Math.abs(y + 12472.5) > 0.01) {
  throw new Error(`site A map ${x}, ${y}`);
}
const [lon, lat] = inverseStereographic(-11572.5, -12472.5);
if (Math.abs(lat + 89.43890921454619) > 1e-4) throw new Error(`latitude ${lat}`);
const siteB = sphericalToMe(31, -84.6, 1737.4 + 4.999);
const radius = Math.hypot(siteB[0], siteB[1], siteB[2]);
if (Math.abs(radius - (1737.4 + 4.999)) > 1e-6) throw new Error(`radius ${radius}`);
console.log("placement ok", lon.toFixed(5), lat.toFixed(5));
