"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { useMission } from "@/lib/mission-state";
import { MOON_RADIUS_KM, sphericalToMe } from "@/lib/placement";
import { SITES } from "./site-points";

const SHOW_ON = new Set(["pole", "site_a", "horizon", "site_b", "network"]);

function enu(lonDeg: number, latDeg: number) {
  const up = new THREE.Vector3(...sphericalToMe(lonDeg, latDeg, 1)).normalize();
  const east = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 0, 1), up);
  if (east.lengthSq() < 1e-12) east.set(0, 1, 0);
  east.normalize();
  const north = new THREE.Vector3().crossVectors(up, east).normalize();
  return { up, east, north };
}

function Tick({
  lon,
  lat,
  elevKm,
  azimuth,
  elevation,
  colorAbove,
  colorBelow,
}: {
  lon: number;
  lat: number;
  elevKm: number;
  azimuth: number;
  elevation: number;
  colorAbove: string;
  colorBelow: string;
}) {
  const above = elevation >= 0;
  const geometry = useMemo(() => {
    const { up, east, north } = enu(lon, lat);
    const angle = (azimuth * Math.PI) / 180;
    const horizontal = east.clone().multiplyScalar(Math.sin(angle)).add(north.clone().multiplyScalar(Math.cos(angle)));
    const origin = new THREE.Vector3(...sphericalToMe(lon, lat, MOON_RADIUS_KM + elevKm + (above ? 0.04 : 0.015)));
    const reach = above ? 0.9 : 0.42;
    const end = origin.clone().add(horizontal.multiplyScalar(reach));
    const points = [origin, end];
    if (above) points.push(end.clone(), end.clone().add(up.multiplyScalar(0.16 + Math.min(elevation, 12) / 12 * 0.2)));
    return { line: new THREE.BufferGeometry().setFromPoints(points), head: points[points.length - 1] };
  }, [above, azimuth, elevation, elevKm, lat, lon]);
  const color = above ? colorAbove : colorBelow;
  return (
    <group>
      <lineSegments geometry={geometry.line}>
        <lineBasicMaterial color={color} toneMapped={false} />
      </lineSegments>
      <mesh position={geometry.head}>
        <sphereGeometry args={[above ? 0.045 : 0.028, 10, 8]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
    </group>
  );
}

export function TimeCues() {
  const { playback, siteId, timeIndex, cameraGoal } = useMission();
  const sample = playback?.sites.find((site) => site.id === siteId)?.samples[timeIndex];
  const place = SITES.find((site) => site.id === siteId) ?? SITES[0];
  if (!SHOW_ON.has(cameraGoal) || !sample) return null;
  return (
    <group>
      <Tick
        lon={place.lon}
        lat={place.lat}
        elevKm={place.elevKm}
        azimuth={sample.sun_azimuth_deg}
        elevation={sample.sun_elevation_deg}
        colorAbove="#e2c48a"
        colorBelow="#6a5c49"
      />
      <Tick
        lon={place.lon}
        lat={place.lat}
        elevKm={place.elevKm}
        azimuth={sample.earth_azimuth_deg}
        elevation={sample.earth_elevation_deg}
        colorAbove="#8fd8df"
        colorBelow="#3e5964"
      />
    </group>
  );
}
