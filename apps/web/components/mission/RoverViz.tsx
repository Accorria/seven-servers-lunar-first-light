"use client";

import { useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { MOON_RADIUS_KM, sphericalToMe } from "@/lib/placement";
import { SITES } from "./site-points";

/**
 * Lightweight 3D STONE Rover Representation.
 * Illustrative short surface traverse scenario (2.0 km assumed traverse, 250 Wh/km, 500 Wh total).
 * Does not claim a surveyed safe path or actual flight rover hardware.
 */
export function RoverViz({
  visible,
  siteId,
  playing,
  progress,
}: {
  visible: boolean;
  siteId: string;
  playing: boolean;
  progress: number; // 0 to 1
}) {
  const groupRef = useRef<THREE.Group>(null);
  const place = SITES.find((item) => item.id === siteId) ?? SITES[0];

  const { pathPoints, pathGeometry, upVector } = useMemo(() => {
    const up = new THREE.Vector3(...sphericalToMe(place.lon, place.lat, 1)).normalize();
    let east = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 0, 1), up);
    if (east.lengthSq() < 1e-12) east.set(0, 1, 0);
    east.normalize();
    const north = new THREE.Vector3().crossVectors(up, east).normalize();

    // Site base position
    const origin = new THREE.Vector3(
      ...sphericalToMe(place.lon, place.lat, MOON_RADIUS_KM + place.elevKm + 0.02)
    );

    // Illustrative 2.0 km traverse path (S-curve over 2 km total length)
    const pts: THREE.Vector3[] = [];
    const count = 50;
    const totalDistKm = 2.0;

    for (let i = 0; i <= count; i++) {
      const t = i / count;
      // Distance along traverse
      const dist = (t - 0.5) * totalDistKm; // from -1.0 km to +1.0 km relative to site center
      // Gentle curve lateral offset
      const lateral = Math.sin(t * Math.PI * 2) * 0.25;

      const pt = origin
        .clone()
        .add(north.clone().multiplyScalar(dist))
        .add(east.clone().multiplyScalar(lateral));
      pts.push(pt);
    }

    const geom = new THREE.BufferGeometry().setFromPoints(pts);
    return { pathPoints: pts, pathGeometry: geom, upVector: up };
  }, [place]);

  useFrame(() => {
    if (!visible || !groupRef.current || pathPoints.length === 0) return;
    const clampedProgress = Math.max(0, Math.min(1, progress));
    const floatIndex = clampedProgress * (pathPoints.length - 1);
    const idx = Math.floor(floatIndex);
    const frac = floatIndex - idx;

    const p1 = pathPoints[idx];
    const p2 = pathPoints[Math.min(pathPoints.length - 1, idx + 1)];
    const currentPos = p1.clone().lerp(p2, frac);

    groupRef.current.position.copy(currentPos);

    if (p1.distanceTo(p2) > 1e-5) {
      const tangent = p2.clone().sub(p1).normalize();
      const lookTarget = currentPos.clone().add(tangent);
      groupRef.current.lookAt(lookTarget);
    }
  });

  if (!visible) return null;

  return (
    <group>
      {/* Illustrative 2 km traverse line */}
      <lineSegments geometry={pathGeometry}>
        <lineBasicMaterial
          color="#d7b57a"
          transparent
          opacity={0.6}
          toneMapped={false}
        />
      </lineSegments>

      {/* Rover Model Group */}
      <group ref={groupRef}>
        {/* Main chassis */}
        <mesh position={[0, 0.03, 0]}>
          <boxGeometry args={[0.08, 0.04, 0.12]} />
          <meshStandardMaterial color="#b8c0c8" metalness={0.7} roughness={0.3} toneMapped={false} />
        </mesh>

        {/* Solar / equipment deck */}
        <mesh position={[0, 0.055, 0]}>
          <boxGeometry args={[0.075, 0.008, 0.11]} />
          <meshStandardMaterial color="#1a2b4c" roughness={0.2} metalness={0.8} />
        </mesh>

        {/* Mast and sensor head */}
        <mesh position={[0, 0.09, 0.04]}>
          <cylinderGeometry args={[0.003, 0.003, 0.07, 8]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
        <mesh position={[0, 0.125, 0.04]}>
          <boxGeometry args={[0.02, 0.012, 0.015]} />
          <meshBasicMaterial color="#00e5ff" />
        </mesh>

        {/* 6 Rocker-bogie wheels */}
        {[-0.048, 0.048].map((x) =>
          [-0.04, 0, 0.04].map((z) => (
            <mesh key={`wheel-${x}-${z}`} position={[x, 0.015, z]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.015, 0.015, 0.012, 12]} />
              <meshStandardMaterial color="#222" roughness={0.8} />
            </mesh>
          ))
        )}
      </group>
    </group>
  );
}
