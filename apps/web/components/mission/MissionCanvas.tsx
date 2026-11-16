"use client";

/**
 * Detail scheduling adapted from lunar-navigator `web/src/scene/MovingDetail.tsx`
 * and the busy pixel-ratio path in `MoonCanvas.tsx` (Apache-2.0).
 */
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { selectedPlayback, useMission } from "@/lib/mission-state";
import { MOON_RADIUS_KM, sphericalToMe } from "@/lib/placement";
import { CameraRig } from "./CameraRig";
import { MoonGlobe } from "./MoonGlobe";
import { pickSphere } from "./pickRay";
import { SiteMarkers } from "./SiteHotspots";
import { sitePoints } from "./site-points";
import { StarOverlay } from "./StarOverlay";
import { SunLight } from "./SunLight";
import { SatelliteViz } from "./SatelliteViz";
import { RoverViz } from "./RoverViz";
import { TerrainMesh, type SeamHole } from "./TerrainMesh";
import { TimeCues } from "./TimeCues";

const REGIONAL_HOLES: readonly SeamHole[] = [
  { url: "/terrain/site01-parent.bin", featherM: 2500 },
  { url: "/terrain/mouton.bin", featherM: 4000 },
];

const PARENT_HOLES: readonly SeamHole[] = [{ url: "/terrain/site01-patch.bin", featherM: 280 }];

function fade(distance: number, inner: number, outer: number) {
  if (distance <= inner) return 1;
  if (distance >= outer) return 0;
  return 1 - (distance - inner) / (outer - inner);
}

function LodReporter({
  coarse,
  onChange,
}: {
  coarse: boolean;
  onChange: (value: { regional: number; parent: number; patch: number; mouton: number }) => void;
}) {
  const { camera } = useThree();
  const last = useRef({ regional: -1, parent: -1, patch: -1, mouton: -1 });
  const siteA = new THREE.Vector3(...sphericalToMe(222.85643000554958, -89.43890921454619, MOON_RADIUS_KM));
  const siteB = new THREE.Vector3(...sphericalToMe(31, -84.6, MOON_RADIUS_KM));
  const pole = new THREE.Vector3(0, 0, -MOON_RADIUS_KM);
  useFrame(() => {
    const next = {
      regional: fade(camera.position.distanceTo(pole), 280, 460),
      parent: fade(camera.position.distanceTo(siteA), 16, 32),
      patch: coarse ? 0 : fade(camera.position.distanceTo(siteA), 14, 26),
      mouton: fade(camera.position.distanceTo(siteB), 22, 40),
    };
    const previous = last.current;
    if (Math.abs(previous.regional - next.regional) + Math.abs(previous.parent - next.parent) + Math.abs(previous.patch - next.patch) + Math.abs(previous.mouton - next.mouton) < 0.04) {
      return;
    }
    last.current = next;
    onChange(next);
  });
  return null;
}

function BusyPixels() {
  const { camera, gl } = useThree();
  const previous = useRef(camera.position.clone());
  useFrame(() => {
    const moved = camera.position.distanceTo(previous.current);
    previous.current.copy(camera.position);
    const ratio = moved > 8 ? 1 : Math.min(window.devicePixelRatio || 1, 1.75);
    if (Math.abs(gl.getPixelRatio() - ratio) > 0.01) gl.setPixelRatio(ratio);
  });
  return null;
}

function CatalogSky({ show }: { show: boolean }) {
  const mapRef = useRef<THREE.Texture | null>(null);
  const mesh = useRef<THREE.Mesh>(null);
  const { camera } = useThree();
  const [map, setMap] = useState<THREE.Texture | null>(null);
  useEffect(() => {
    let dropped = false;
    const loader = new THREE.TextureLoader();
    loader.load(
      "/welcome/stars.webp",
      (texture) => {
        if (dropped) {
          texture.dispose();
          return;
        }
        texture.colorSpace = THREE.SRGBColorSpace;
        mapRef.current = texture;
        setMap(texture);
      },
      undefined,
      () => {
        if (!dropped) setMap(null);
      },
    );
    return () => {
      dropped = true;
      mapRef.current?.dispose();
      mapRef.current = null;
    };
  }, []);
  useFrame(() => {
    if (mesh.current) mesh.current.position.copy(camera.position);
  });
  if (!show) return null;
  if (!map) return <color attach="background" args={["#05070c"]} />;
  return (
    <mesh ref={mesh} rotation={[Math.PI / 2, 0.4, 0]} renderOrder={-1} raycast={() => null}>
      <sphereGeometry args={[80, 48, 32]} />
      <meshBasicMaterial map={map} side={THREE.BackSide} depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

function Scene({
  coarse,
  showSatellite,
  showRover,
  roverPlaying,
  roverProgress,
}: {
  coarse: boolean;
  showSatellite: boolean;
  showRover: boolean;
  roverPlaying: boolean;
  roverProgress: number;
}) {
  const { playback, siteId, timeIndex, showStar, setSiteId, cameraGoal } = useMission();
  const sample = selectedPlayback(playback, siteId)?.samples[timeIndex];
  const sun = (sample?.sun_unit_me?.length === 3 ? sample.sun_unit_me : [0.2, -0.4, 0.9]) as [number, number, number];
  const [lod, setLod] = useState({ regional: 0, parent: 0, patch: 0, mouton: 0 });

  function pick(event: ThreeEvent<MouseEvent>) {
    const hit = pickSphere(event.ray, MOON_RADIUS_KM);
    if (!hit) return;
    const nearest = sitePoints()
      .map((site) => ({ id: site.id, distance: hit.distanceTo(site.position) }))
      .sort((a, b) => a.distance - b.distance)[0];
    if (nearest && nearest.distance < 80) setSiteId(nearest.id);
  }

  return (
    <>
      <color attach="background" args={["#020408"]} />
      <Stars radius={150} depth={50} count={3500} factor={4} saturation={0} fade speed={0.4} />
      <CatalogSky show={cameraGoal === "globe" || cameraGoal === "turn"} />
      <CameraRig />
      <BusyPixels />
      <LodReporter coarse={coarse} onChange={setLod} />
      <SunLight direction={sun} />
      <MoonGlobe cut={lod.regional > 0.9} sun={sun} onClick={pick} />
      <group onClick={pick}>
        <TerrainMesh url="/terrain/regional.bin" opacity={lod.regional} sun={sun} order={0} holes={REGIONAL_HOLES} holeOpacities={[lod.parent, lod.mouton]} />
        <TerrainMesh url="/terrain/site01-parent.bin" seamUrl="/terrain/regional.bin" opacity={lod.parent} sun={sun} order={1} bias featherM={2500} holes={PARENT_HOLES} holeOpacities={[lod.patch]} />
        <TerrainMesh url="/terrain/mouton.bin" seamUrl="/terrain/regional.bin" opacity={lod.mouton} sun={sun} order={1} bias featherM={4000} />
        <TerrainMesh url="/terrain/site01-patch.bin" seamUrl="/terrain/site01-parent.bin" opacity={lod.patch} sun={sun} order={2} bias featherM={280} />
      </group>
      <SiteMarkers />
      <TimeCues />
      {showStar && (siteId === "site_a" || siteId === "site_b") && <StarOverlay site={siteId} />}
      <SatelliteViz visible={showSatellite} siteId={siteId} />
      <RoverViz visible={showRover} siteId={siteId} playing={roverPlaying} progress={roverProgress} />
    </>
  );
}

export function MissionCanvas({
  showSatellite = false,
  showRover = false,
  roverPlaying = false,
  roverProgress = 0,
}: {
  showSatellite?: boolean;
  showRover?: boolean;
  roverPlaying?: boolean;
  roverProgress?: number;
} = {}) {
  const { coarse } = useMission();
  return (
    <Canvas
      camera={{ position: [0, -4430, 730], up: [0, 0, 1], fov: 42, near: 10, far: 12000 }}
      dpr={coarse ? 1 : [1, 1.75]}
      gl={{ antialias: !coarse, powerPreference: "high-performance" }}
    >
      <Scene
        coarse={coarse}
        showSatellite={showSatellite}
        showRover={showRover}
        roverPlaying={roverPlaying}
        roverProgress={roverProgress}
      />
    </Canvas>
  );
}
