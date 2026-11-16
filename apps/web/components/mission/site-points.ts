import * as THREE from "three";
import { MOON_RADIUS_KM, sphericalToMe } from "@/lib/placement";

export const SITES = [
  { id: "site_a", name: "Connecting Ridge", lon: 222.85643000554958, lat: -89.43890921454619, elevKm: 1.9595 },
  { id: "site_b", name: "Mons Mouton", lon: 31, lat: -84.6, elevKm: 4.999 },
] as const;

export function sitePoints() {
  return SITES.map((site) => ({
    ...site,
    position: new THREE.Vector3(...sphericalToMe(site.lon, site.lat, MOON_RADIUS_KM + site.elevKm)),
  }));
}
