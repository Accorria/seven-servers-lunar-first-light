"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { MOON_RADIUS_KM, sphericalToMe } from "@/lib/placement";
import { SITES } from "./site-points";

/**
 * Conceptual Satellite Visualization.
 * Illustrative flyby / polar relay orbit — not calculated orbital ephemeris.
 * Does not claim verified radio links or communication availability.
 */
export function SatelliteViz({
  visible,
  siteId,
}: {
  visible: boolean;
  siteId: string;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const place = SITES.find((item) => item.id === siteId) ?? SITES[0];

  // Orbit definition: Polar orbit inclined around the Moon's pole
  const orbitRadiusKm = MOON_RADIUS_KM + 60; // 60 km lunar altitude

  const orbitPath = useMemo(() => {
    const points: THREE.Vector3[] = [];
    const segments = 128;
    // An inclined circular orbit passing near south pole
    const normal = new THREE.Vector3(0.2, 0.95, 0.2).normalize();
    const u = new THREE.Vector3(1, 0, 0);
    const v = new THREE.Vector3().crossVectors(normal, u).normalize();
    u.crossVectors(v, normal).normalize();

    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      const pt = new THREE.Vector3()
        .addScaledVector(u, Math.cos(theta) * orbitRadiusKm)
        .addScaledVector(v, Math.sin(theta) * orbitRadiusKm);
      points.push(pt);
    }
    const geom = new THREE.BufferGeometry().setFromPoints(points);
    return { geom, u, v };
  }, [orbitRadiusKm]);

  // Animated satellite movement along illustrative track
  useFrame((state) => {
    if (!visible || !groupRef.current) return;
    const time = state.clock.getElapsedTime();
    // Orbital period ~ 118 minutes in reality, scaled to smooth visitor speed (~40s cycle)
    const angle = (time * 0.15) % (Math.PI * 2);
    const satPos = new THREE.Vector3()
      .addScaledVector(orbitPath.u, Math.cos(angle) * orbitRadiusKm)
      .addScaledVector(orbitPath.v, Math.sin(angle) * orbitRadiusKm);

    groupRef.current.position.copy(satPos);
    // Orient toward next position tangent
    const nextAngle = angle + 0.01;
    const nextPos = new THREE.Vector3()
      .addScaledVector(orbitPath.u, Math.cos(nextAngle) * orbitRadiusKm)
      .addScaledVector(orbitPath.v, Math.sin(nextAngle) * orbitRadiusKm);
    groupRef.current.lookAt(nextPos);
  });

  if (!visible) return null;

  return (
    <group>
      {/* Illustrative orbit trace */}
      <lineSegments geometry={orbitPath.geom}>
        <lineBasicMaterial color="#00e5ff" transparent opacity={0.35} toneMapped={false} />
      </lineSegments>
      <group ref={groupRef}>
        {/* Satellite main body */}
        <mesh>
          <boxGeometry args={[0.3, 0.3, 0.45]} />
          <meshStandardMaterial color="#c0c7d0" metalness={0.8} roughness={0.2} toneMapped={false} />
        </mesh>
        {/* Gold multi-layer insulation accent */}
        <mesh position={[0, 0.16, 0]}>
          <boxGeometry args={[0.22, 0.04, 0.35]} />
          <meshBasicMaterial color="#e5a93c" toneMapped={false} />
        </mesh>
        {/* High-gain dish antenna */}
        <mesh position={[0, 0, -0.28]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.18, 0.12, 16, 1, true]} />
          <meshStandardMaterial color="#e0e0e0" side={THREE.DoubleSide} metalness={0.5} roughness={0.4} />
        </mesh>
        {/* Solar panels (left and right wings) */}
        <group position={[0.42, 0, 0]}>
          <mesh>
            <boxGeometry args={[0.5, 0.02, 0.28]} />
            <meshStandardMaterial color="#112244" roughness={0.3} metalness={0.9} toneMapped={false} />
          </mesh>
          {/* Panel cell grid texture detail */}
          <lineSegments>
            <edgesGeometry args={[new THREE.BoxGeometry(0.5, 0.021, 0.28)]} />
            <lineBasicMaterial color="#00e5ff" transparent opacity={0.6} />
          </lineSegments>
        </group>
        <group position={[-0.42, 0, 0]}>
          <mesh>
            <boxGeometry args={[0.5, 0.02, 0.28]} />
            <meshStandardMaterial color="#112244" roughness={0.3} metalness={0.9} toneMapped={false} />
          </mesh>
          <lineSegments>
            <edgesGeometry args={[new THREE.BoxGeometry(0.5, 0.021, 0.28)]} />
            <lineBasicMaterial color="#00e5ff" transparent opacity={0.6} />
          </lineSegments>
        </group>
      </group>
    </group>
  );
}
