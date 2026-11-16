"use client";

import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useContext, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useMission } from "@/lib/mission-state";
import { SiteLabelContext } from "./SiteLabels";
import { sitePoints } from "./site-points";

const scratch = {
  normal: new THREE.Vector3(),
  forward: new THREE.Vector3(),
  toSite: new THREE.Vector3(),
  projected: new THREE.Vector3(),
};

export function SiteMarkers() {
  const labels = useContext(SiteLabelContext);
  const { siteId, setSiteId, focus } = useMission();
  const points = useMemo(() => sitePoints(), []);
  const meshes = useRef<Record<string, THREE.Mesh | null>>({});

  useEffect(() => {
    return () => {
      document.body.style.cursor = "";
    };
  }, []);

  useFrame(({ camera, size }) => {
    camera.getWorldDirection(scratch.forward);
    const fov = "fov" in camera ? (camera.fov * Math.PI) / 180 : Math.PI / 4;
    for (const site of points) {
      const distance = Math.max(camera.position.distanceTo(site.position), 0.2);
      const scale = (7 / Math.max(size.height, 1)) * 2 * distance * Math.tan(fov / 2);
      const mesh = meshes.current[site.id];
      if (mesh) {
        scratch.normal.copy(site.position).normalize();
        mesh.position.copy(site.position).addScaledVector(scratch.normal, scale);
        mesh.scale.setScalar(scale);
      }

      const el = labels?.current[site.id];
      if (!el) continue;
      const farSide = site.position.dot(camera.position) <= 0;
      scratch.toSite.copy(site.position).sub(camera.position);
      const behind = scratch.toSite.angleTo(scratch.forward) > Math.PI / 2;
      scratch.projected.copy(site.position).project(camera);
      const offscreen = Math.abs(scratch.projected.x) > 1.2 || Math.abs(scratch.projected.y) > 1.2 || scratch.projected.z > 1;
      const x = (scratch.projected.x * 0.5 + 0.5) * size.width;
      const y = (-scratch.projected.y * 0.5 + 0.5) * size.height;
      const rightPanel = size.width - 16 - 352;
      const leftRail = 16 + 144;
      const covered = !focus && y < size.height - 130 && (x > rightPanel - 96 || x < leftRail + 24);
      if (farSide || behind || offscreen || covered) {
        el.style.visibility = "hidden";
        continue;
      }
      el.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -130%)`;
      el.style.visibility = "visible";
    }
  });

  function select(event: ThreeEvent<MouseEvent>, id: string) {
    event.stopPropagation();
    setSiteId(id);
  }

  return (
    <group>
      {points.map((site) => (
        <mesh
          key={site.id}
          ref={(node) => {
            meshes.current[site.id] = node;
          }}
          position={site.position}
          onClick={(event) => select(event, site.id)}
          onPointerOver={(event) => {
            event.stopPropagation();
            document.body.style.cursor = "pointer";
          }}
          onPointerOut={() => {
            document.body.style.cursor = "";
          }}
        >
          <sphereGeometry args={[1, 20, 20]} />
          <meshBasicMaterial color={site.id === siteId ? "#d7b57a" : "#8fd8df"} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}
