/** Display placement. Same sphere and south-polar stereographic pair as lfl.frames and lfl.dem. */

export const MOON_RADIUS_KM = 1737.4;

export function sphericalToMe(lonDeg: number, latDeg: number, radiusKm: number): [number, number, number] {
  const lon = (lonDeg * Math.PI) / 180;
  const lat = (latDeg * Math.PI) / 180;
  const cosLat = Math.cos(lat);
  return [radiusKm * cosLat * Math.cos(lon), radiusKm * cosLat * Math.sin(lon), radiusKm * Math.sin(lat)];
}

export function stereographicXy(lonDeg: number, latDeg: number, radiusM = MOON_RADIUS_KM * 1000): [number, number] {
  const lon = (lonDeg * Math.PI) / 180;
  const lat = (latDeg * Math.PI) / 180;
  const scale = 2 / (1 - Math.sin(lat));
  return [radiusM * scale * Math.cos(lat) * Math.sin(lon), radiusM * scale * Math.cos(lat) * Math.cos(lon)];
}

export function inverseStereographic(xM: number, yM: number, radiusM = MOON_RADIUS_KM * 1000): [number, number] {
  const rho = Math.hypot(xM, yM);
  if (rho === 0) return [0, -90];
  const latitude = (Math.atan(rho / (2 * radiusM)) * 2 * 180) / Math.PI - 90;
  const longitude = (Math.atan2(xM, yM) * 180) / Math.PI;
  return [(longitude + 360) % 360, latitude];
}

export function localUp(lonDeg: number, latDeg: number): [number, number, number] {
  return sphericalToMe(lonDeg, latDeg, 1);
}
