"use client";

import { useMemo, useEffect } from "react";
import * as THREE from "three";
import { MOON_RADIUS_KM, sphericalToMe } from "@/lib/placement";
import { SITES } from "./site-points";
import { useMission, type StarNodeId } from "@/lib/mission-state";

const NODES = ["N1", "N2", "N3", "N4", "N5", "N6"] as const;

export type NodeId = StarNodeId;

export const NODE_DETAILS: Record<
  NodeId,
  {
    title: string;
    sub: string;
    role: string;
    connections: string[];
    pathway: string;
    spec: string;
  }
> = {
  N1: {
    title: "Node N1 (Point Node)",
    sub: "Ring position 0° · Positive group",
    role: "Collector node on outer 1 km radius. Connects to C (center bus) and lateral ring nodes N3 and N5.",
    connections: ["N3", "N5", "C"],
    pathway: "F_POS / Center",
    spec: "Simulated parameters: 20 m² collector area, 30% solar cell efficiency.",
  },
  N2: {
    title: "Node N2 (Point Node)",
    sub: "Ring position 60° · Negative group",
    role: "Collector node on outer 1 km radius. Connects to C (center bus) and lateral ring nodes N4 and N6.",
    connections: ["N4", "N6", "C"],
    pathway: "F_NEG / Center",
    spec: "Simulated parameters: 20 m² collector area, 30% solar cell efficiency.",
  },
  N3: {
    title: "Node N3 (Point Node)",
    sub: "Ring position 120° · Positive group",
    role: "Collector node on outer 1 km radius. Connects to C (center bus) and lateral ring nodes N1 and N5.",
    connections: ["N1", "N5", "C"],
    pathway: "F_POS / Center",
    spec: "Simulated parameters: 20 m² collector area, 30% solar cell efficiency.",
  },
  N4: {
    title: "Node N4 (Point Node)",
    sub: "Ring position 180° · Negative group",
    role: "Collector node on outer 1 km radius. Connects to C (center bus) and lateral ring nodes N2 and N6.",
    connections: ["N2", "N6", "C"],
    pathway: "F_NEG / Center",
    spec: "Simulated parameters: 20 m² collector area, 30% solar cell efficiency.",
  },
  N5: {
    title: "Node N5 (Point Node)",
    sub: "Ring position 240° · Positive group",
    role: "Collector node on outer 1 km radius. Connects to C (center bus) and lateral ring nodes N1 and N3.",
    connections: ["N1", "N3", "C"],
    pathway: "F_POS / Center",
    spec: "Simulated parameters: 20 m² collector area, 30% solar cell efficiency.",
  },
  N6: {
    title: "Node N6 (Point Node)",
    sub: "Ring position 300° · Negative group",
    role: "Collector node on outer 1 km radius. Connects to C (center bus) and lateral ring nodes N2 and N4.",
    connections: ["N2", "N4", "C"],
    pathway: "F_NEG / Center",
    spec: "Simulated parameters: 20 m² collector area, 30% solar cell efficiency.",
  },
  F_POS: {
    title: "Facility F_POS (Processing)",
    sub: "Offset position 0.35 km @ 90°",
    role: "First conceptual processing facility tied into the central hub. Associated with the positive triangle (N1-N3-N5).",
    connections: ["C"],
    pathway: "F_POS",
    spec: "Simulated parameters: 250 W operational load demand when active.",
  },
  F_NEG: {
    title: "Facility F_NEG (Processing)",
    sub: "Offset position 0.35 km @ 270°",
    role: "Second conceptual processing facility tied into the central hub. Associated with the negative triangle (N2-N4-N6).",
    connections: ["C"],
    pathway: "F_NEG",
    spec: "Simulated parameters: 250 W operational load demand when active.",
  },
  C: {
    title: "Center Bus C (Hub)",
    sub: "Site local origin (0 km elevation offset)",
    role: "Conceptual central distribution bus interconnecting all six outer ring nodes and both processing facilities.",
    connections: ["N1", "N2", "N3", "N4", "N5", "N6", "F_POS", "F_NEG"],
    pathway: "Center Hub",
    spec: "Simulated parameters: 1,500 W base load demand, 5,000 Wh battery reserve with 95% charge/discharge efficiency.",
  },
};

export const EDGE_DEFINITIONS: Array<[NodeId, NodeId, "F_POS" | "F_NEG" | "center"]> = [
  ["N1", "N3", "F_POS"],
  ["N3", "N5", "F_POS"],
  ["N5", "N1", "F_POS"],
  ["N1", "C", "center"],
  ["N3", "C", "center"],
  ["N5", "C", "center"],
  ["F_POS", "C", "F_POS"],
  ["N2", "N4", "F_NEG"],
  ["N4", "N6", "F_NEG"],
  ["N6", "N2", "F_NEG"],
  ["N2", "C", "center"],
  ["N4", "C", "center"],
  ["N6", "C", "center"],
  ["F_NEG", "C", "F_NEG"],
];

export function StarOverlay({ site }: { site: "site_a" | "site_b" }) {
  const { selectedNode, setSelectedNode } = useMission();

  useEffect(() => {
    setSelectedNode(null);
  }, [site, setSelectedNode]);

  const geometry = useMemo(() => {
    const place = SITES.find((item) => item.id === site) ?? SITES[0];
    const up = new THREE.Vector3(...sphericalToMe(place.lon, place.lat, 1)).normalize();
    const east = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 0, 1), up);
    if (east.lengthSq() < 1e-12) east.set(0, 1, 0);
    east.normalize();
    const north = new THREE.Vector3().crossVectors(up, east).normalize();
    const center = new THREE.Vector3(...sphericalToMe(place.lon, place.lat, MOON_RADIUS_KM + place.elevKm + 0.015));
    const ring = (angleDeg: number, radiusKm: number) => {
      const angle = (angleDeg * Math.PI) / 180;
      return center
        .clone()
        .add(east.clone().multiplyScalar(Math.cos(angle) * radiusKm))
        .add(north.clone().multiplyScalar(Math.sin(angle) * radiusKm));
    };
    const points: Record<NodeId, THREE.Vector3> = { C: center.clone() } as Record<NodeId, THREE.Vector3>;
    NODES.forEach((name, index) => {
      points[name] = ring(index * 60, 1);
    });
    points.F_POS = ring(90, 0.35);
    points.F_NEG = ring(270, 0.35);

    const baseLine = new THREE.BufferGeometry().setFromPoints(
      EDGE_DEFINITIONS.flatMap(([a, b]) => [points[a], points[b]])
    );
    const ground = new THREE.BufferGeometry().setFromPoints(
      Array.from({ length: 64 }, (_, index) => [ring((index / 64) * 360, 1), ring(((index + 1) / 64) * 360, 1)]).flat()
    );

    return { baseLine, ground, points };
  }, [site]);

  const highlightGeometry = useMemo(() => {
    if (!selectedNode) return null;
    const connectedEdges = EDGE_DEFINITIONS.filter(
      ([a, b]) => a === selectedNode || b === selectedNode
    );
    if (connectedEdges.length === 0) return null;
    const pts = connectedEdges.flatMap(([a, b]) => [geometry.points[a], geometry.points[b]]);
    return new THREE.BufferGeometry().setFromPoints(pts);
  }, [selectedNode, geometry.points]);

  return (
    <group>
      <lineSegments geometry={geometry.ground}>
        <lineBasicMaterial color="#d7b57a" transparent opacity={0.3} toneMapped={false} />
      </lineSegments>

      <lineSegments geometry={geometry.baseLine}>
        <lineBasicMaterial color="#d7b57a" transparent opacity={selectedNode ? 0.35 : 0.85} toneMapped={false} />
      </lineSegments>

      {highlightGeometry && (
        <lineSegments geometry={highlightGeometry}>
          <lineBasicMaterial color="#00e5ff" linewidth={2} toneMapped={false} />
        </lineSegments>
      )}

      {(Object.entries(geometry.points) as [NodeId, THREE.Vector3][]).map(([name, position]) => {
        const isSelected = selectedNode === name;
        const isConnected =
          selectedNode !== null &&
          EDGE_DEFINITIONS.some(
            ([a, b]) => (a === selectedNode && b === name) || (b === selectedNode && a === name)
          );

        return (
          <group key={name} position={position}>
            {/* Interactive 3D Sphere */}
            <mesh
              onClick={(e) => {
                e.stopPropagation();
                setSelectedNode(selectedNode === name ? null : name);
              }}
              onPointerOver={(e) => {
                e.stopPropagation();
                document.body.style.cursor = "pointer";
              }}
              onPointerOut={() => {
                document.body.style.cursor = "auto";
              }}
            >
              <sphereGeometry args={[name === "C" ? 0.08 : 0.05, 12, 10]} />
              <meshBasicMaterial
                color={
                  isSelected
                    ? "#00e5ff"
                    : isConnected
                    ? "#ffe082"
                    : name === "C"
                    ? "#d7b57a"
                    : name.startsWith("F")
                    ? "#8fd8df"
                    : "#e8eef6"
                }
                toneMapped={false}
              />
            </mesh>

            {/* Subdued outer halo ring for selected or connected nodes */}
            {(isSelected || isConnected) && (
              <mesh rotation={[Math.PI / 2, 0, 0]}>
                <ringGeometry args={[0.07, 0.09, 16]} />
                <meshBasicMaterial
                  color={isSelected ? "#00e5ff" : "#ffe082"}
                  side={THREE.DoubleSide}
                  transparent
                  opacity={0.8}
                  toneMapped={false}
                />
              </mesh>
            )}
          </group>
        );
      })}
    </group>
  );
}
