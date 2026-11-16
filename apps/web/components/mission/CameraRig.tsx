"use client";

/**
 * Adapted from lunar-navigator `web/src/scene/Rig.tsx` (Apache-2.0).
 * Flight stays outside the Moon: direction is slerped, radius is lerped, and the arc bows outward.
 * Orientation is quaternion-slerped. That project's ephemeris and height tiles are not used.
 */
import { OrbitControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useCatalog, useMission, type CameraGoal } from "@/lib/mission-state";
import { useVoice } from "@/lib/voice";
import { MOON_RADIUS_KM, sphericalToMe } from "@/lib/placement";
import { SITES } from "./site-points";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

const RIDGE = SITES[0];
const MOUTON = SITES[1];

type Pose = { position: THREE.Vector3; target: THREE.Vector3; up: THREE.Vector3 };

const scratch = {
  dir0: new THREE.Vector3(),
  dir1: new THREE.Vector3(),
  pos: new THREE.Vector3(),
  turn: new THREE.Quaternion(),
  step: new THREE.Quaternion(),
  look: new THREE.Matrix4(),
};

function enu(lonDeg: number, latDeg: number) {
  const up = new THREE.Vector3(...sphericalToMe(lonDeg, latDeg, 1)).normalize();
  const east = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 0, 1), up);
  if (east.lengthSq() < 1e-12) east.set(0, 1, 0);
  east.normalize();
  const north = new THREE.Vector3().crossVectors(up, east).normalize();
  return { up, east, north };
}

function sitePose(lon: number, lat: number, elevKm: number, rangeKm: number, eastScale: number): Pose {
  const { up, east } = enu(lon, lat);
  const target = new THREE.Vector3(...sphericalToMe(lon, lat, MOON_RADIUS_KM + elevKm));
  const position = target.clone().add(up.clone().multiplyScalar(rangeKm)).add(east.multiplyScalar(rangeKm * eastScale));
  return { position, target, up };
}

function horizonPose(): Pose {
  const { up, north } = enu(RIDGE.lon, RIDGE.lat);
  const target = new THREE.Vector3(...sphericalToMe(RIDGE.lon, RIDGE.lat, MOON_RADIUS_KM + RIDGE.elevKm));
  const position = target.clone().add(north.clone().multiplyScalar(11)).add(up.clone().multiplyScalar(1));
  const look = target.clone().add(north.multiplyScalar(-1.5));
  return { position, target: look, up };
}

function poseFor(goal: CameraGoal, catalogLon: number, catalogLat: number, siteId: string): Pose {
  const radius = MOON_RADIUS_KM;
  if (goal === "globe") {
    return {
      position: new THREE.Vector3(0.35 * radius, -3.3 * radius, -0.4 * radius),
      target: new THREE.Vector3(0, 0, -0.15 * radius),
      up: new THREE.Vector3(0, 0.2, 0.98).normalize(),
    };
  }
  if (goal === "turn") {
    return {
      position: new THREE.Vector3(0, -1.5 * radius, -0.99 * radius),
      target: new THREE.Vector3(0, -0.08 * radius, -0.92 * radius),
      up: new THREE.Vector3(0, -0.28, 1).normalize(),
    };
  }
  if (goal === "pole") {
    const target = new THREE.Vector3(0, 0, -radius);
    return {
      position: target.clone().add(new THREE.Vector3(12, -24, -50)),
      target,
      up: new THREE.Vector3(0, 1, 0),
    };
  }
  if (goal === "orbit") {
    // 120 km orbital overview centered over the south pole / 60 km satellite orbit
    const target = new THREE.Vector3(0, 0, -radius);
    return {
      position: new THREE.Vector3(0, -95, -radius - 85),
      target,
      up: new THREE.Vector3(0, -0.4, 0.9).normalize(),
    };
  }
  if (goal === "wide") {
    const site = siteId === "site_b" ? MOUTON : RIDGE;
    return sitePose(site.lon, site.lat, site.elevKm, 18, 0.25);
  }
  if (goal === "horizon") return horizonPose();
  if (goal === "network") {
    const site = siteId === "site_b" ? MOUTON : RIDGE;
    return sitePose(site.lon, site.lat, site.elevKm, 4.2, 0.12);
  }
  if (goal === "site_b") return sitePose(MOUTON.lon, MOUTON.lat, MOUTON.elevKm, 8.5, 0.18);
  if (goal === "site_a") return sitePose(RIDGE.lon, RIDGE.lat, RIDGE.elevKm, 4.5, 0.22);
  return sitePose(catalogLon, catalogLat, 0, 40, 0.35);
}

function clearOfSurface(position: THREE.Vector3) {
  const minimum = MOON_RADIUS_KM + 1.2;
  if (position.length() < minimum) position.setLength(minimum);
}

function shellPoint(from: THREE.Vector3, to: THREE.Vector3, t: number) {
  scratch.dir0.copy(from).normalize();
  scratch.dir1.copy(to).normalize();
  const angle = scratch.dir0.angleTo(scratch.dir1);
  scratch.turn.setFromUnitVectors(scratch.dir0, scratch.dir1);
  scratch.step.identity().slerp(scratch.turn, t);
  const radius = THREE.MathUtils.lerp(from.length(), to.length(), t);
  const bow = Math.sin(Math.PI * t) * angle * 80;
  return scratch.pos.copy(scratch.dir0).applyQuaternion(scratch.step).multiplyScalar(Math.max(radius + bow, MOON_RADIUS_KM + 0.8));
}

function lookQuaternion(eye: THREE.Vector3, target: THREE.Vector3, up: THREE.Vector3, out: THREE.Quaternion) {
  scratch.look.lookAt(eye, target, up);
  return out.setFromRotationMatrix(scratch.look);
}

function applyClip(camera: THREE.PerspectiveCamera) {
  const altitude = camera.position.length() - MOON_RADIUS_KM;
  const near = altitude > 500 ? 10 : Math.max(0.1, Math.min(2, altitude / 150));
  const far = altitude > 500 ? 12000 : Math.max(1200, Math.min(5000, altitude * 15));
  if (camera.near === near && camera.far === far) return;
  camera.near = near;
  camera.far = far;
  camera.updateProjectionMatrix();
}

export function CameraRig() {
  const { camera } = useThree();
  const controls = useRef<OrbitControlsImpl>(null);
  const { cameraGoal, cameraNonce, skipToken, catalogId, siteId, holdCameraRef, tourEpoch, tourRunning, setTourRunning } = useMission();
  const voice = useVoice();
  const sawCanvas = useRef(false);
  const catalog = useCatalog();
  const catalogSite = catalog.find((site) => site.id === catalogId);
  const goal = useMemo(
    () => poseFor(cameraGoal, catalogSite?.longitude_deg ?? 0, catalogSite?.latitude_deg ?? -89, siteId),
    [cameraGoal, catalogSite, siteId],
  );
  const flight = useRef({
    from: new THREE.Vector3(),
    fromUp: new THREE.Vector3(0, 0, 1),
    fromTarget: new THREE.Vector3(),
    fromQuat: new THREE.Quaternion(),
    toQuat: new THREE.Quaternion(),
    t: 1,
    active: false,
  });

  function begin(skip: boolean) {
    const next = flight.current;
    const view = camera as THREE.PerspectiveCamera;
    next.from.copy(camera.position);
    next.fromUp.copy(camera.up);
    next.fromTarget.copy(controls.current?.target ?? new THREE.Vector3());
    next.fromQuat.copy(camera.quaternion);
    lookQuaternion(goal.position, goal.target, goal.up, next.toQuat);
    next.t = skip ? 1 : 0;
    next.active = !skip;
    if (skip) {
      camera.position.copy(goal.position);
      camera.up.copy(goal.up);
      camera.lookAt(goal.target);
      applyClip(view);
      if (controls.current) {
        controls.current.target.copy(goal.target);
        controls.current.enabled = true;
        controls.current.update();
      }
    } else if (controls.current) {
      controls.current.enabled = false;
    }
  }

  useEffect(() => {
    const skip = holdCameraRef.current && sawCanvas.current;
    holdCameraRef.current = false;
    if (!sawCanvas.current) {
      sawCanvas.current = true;
      begin(false);
      return;
    }
    if (skip) return;
    begin(false);
    // A tour start sets holdCameraRef so this effect does not replay the current chapter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraNonce, cameraGoal, catalogId, siteId, tourEpoch]);

  useEffect(() => {
    if (skipToken > 0) begin(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skipToken]);

  useFrame((_, delta) => {
    const view = camera as THREE.PerspectiveCamera;
    const current = flight.current;
    if (!current.active) {
      applyClip(view);
      return;
    }
    current.t = Math.min(1, current.t + delta * 0.45);
    if (current.t >= 1) {
      current.active = false;
      camera.position.copy(goal.position);
      camera.up.copy(goal.up);
      camera.lookAt(goal.target);
      applyClip(view);
      if (controls.current) {
        controls.current.target.copy(goal.target);
        controls.current.enabled = true;
        controls.current.update();
      }
      return;
    }
    const eased = current.t * current.t * (3 - 2 * current.t);
    camera.position.copy(shellPoint(current.from, goal.position, eased));
    clearOfSurface(camera.position);
    camera.quaternion.copy(current.fromQuat).slerp(current.toQuat, eased);
    applyClip(view);
  });

  return (
    <OrbitControls
      ref={controls}
      enablePan={false}
      minDistance={2.5}
      maxDistance={MOON_RADIUS_KM * 8}
      onStart={() => {
        flight.current.active = false;
        if (tourRunning) {
          setTourRunning(false);
          voice.pause();
        }
      }}
    />
  );
}
