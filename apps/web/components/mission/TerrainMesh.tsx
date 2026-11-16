"use client";

/**
 * Mesh drawing adapted from lunar-navigator `web/src/scene/MoonTerrain.tsx` (Apache-2.0):
 * loaded geometry and the skirt already stored in the file.
 * Heights come from the derived LFLM meshes, not from that project's tiles or shadow march.
 * The skirt is hidden here. The bin files are not rebuilt.
 * Seams are a display composite: one regolith shade, a stereographic feather, and a radius
 * blend only inside that feather. Interior vertices keep their stored NASA radii.
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import * as THREE from "three";
import { stereographicXy } from "@/lib/placement";

const REGOLITH = "#c2b4a2";

const VERTEX = `
  varying vec3 vNormal;
  varying vec3 vWorld;
  varying vec2 vStereo;
  vec2 stereoOf(vec3 world) {
    float radius = length(world);
    vec3 dir = world / max(radius, 0.0001);
    float lat = asin(clamp(dir.z, -1.0, 1.0));
    float lon = atan(dir.y, dir.x);
    float scale = 2.0 / (1.0 - sin(lat));
    float radiusM = 1737400.0;
    return vec2(radiusM * scale * cos(lat) * sin(lon), radiusM * scale * cos(lat) * cos(lon));
  }
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vStereo = stereoOf(world.xyz);
    vec3 normalWorld = mat3(modelMatrix) * normal;
    // Stored winding faces the Moon's interior. Light the outward face.
    if (dot(normalWorld, world.xyz) < 0.0) normalWorld = -normalWorld;
    vNormal = normalize(normalWorld);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const FRAGMENT = `
  uniform vec3 uColor;
  uniform vec3 uSun;
  uniform float uOpacity;
  uniform vec4 uBounds;
  uniform float uFeatherM;
  uniform vec4 uHole0;
  uniform vec4 uHole1;
  uniform float uHoleOp0;
  uniform float uHoleOp1;
  uniform float uHoleN;
  varying vec3 vNormal;
  varying vec3 vWorld;
  varying vec2 vStereo;
  float rectMargin(vec2 xy, vec4 rect) {
    return min(min(xy.x - rect.x, rect.z - xy.x), min(xy.y - rect.y, rect.w - xy.y));
  }
  void main() {
    if (uHoleN > 0.5 && uHoleOp0 > 0.97 && rectMargin(vStereo, uHole0) >= 0.0) discard;
    if (uHoleN > 1.5 && uHoleOp1 > 0.97 && rectMargin(vStereo, uHole1) >= 0.0) discard;
    float feather = 1.0;
    if (uFeatherM > 0.0) {
      float t = clamp(rectMargin(vStereo, uBounds) / uFeatherM, 0.0, 1.0);
      feather = t * t * (3.0 - 2.0 * t);
    }
    if (feather <= 0.001) discard;
    float lambert = 0.34 + 0.66 * max(dot(normalize(vNormal), normalize(uSun)), 0.0);
    float slope = clamp(1.0 - dot(normalize(vNormal), normalize(vWorld)), 0.0, 1.0);
    float relief = mix(1.0, 0.78, smoothstep(0.02, 0.22, slope));
    gl_FragColor = vec4(uColor * relief * lambert, uOpacity * feather);
  }
`;

export type SeamHole = { url: string; featherM: number };

type Bounds = { minX: number; maxX: number; minY: number; maxY: number };

type ManifestEntry = {
  file: string;
  drawn_pixel_m: number;
  bounds_m: { min_x_m: number; max_x_m: number; min_y_m: number; max_y_m: number };
};

type RadiusGrid = {
  originX: number;
  originY: number;
  cell: number;
  columns: number;
  rows: number;
  radii: Float32Array;
};

type ParsedMesh = {
  positions: Float32Array;
  indices: Uint32Array;
  skirt: Uint8Array;
  used: Uint8Array;
  grid?: RadiusGrid;
};

type DrawState = {
  geometry: THREE.BufferGeometry;
  bounds: THREE.Vector4;
  holes: THREE.Vector4[];
};

const NO_HOLES: readonly SeamHole[] = [];
const parsedCache = new Map<string, Promise<ParsedMesh>>();
const readyUrls = new Set<string>();
const readyListeners = new Set<() => void>();
let manifestCache: Promise<Map<string, ManifestEntry>> | null = null;

function markReady(url: string, ready: boolean) {
  if (ready) readyUrls.add(url);
  else readyUrls.delete(url);
  readyListeners.forEach((listener) => listener());
}

function fileName(url: string) {
  return url.slice(url.lastIndexOf("/") + 1);
}

function smoothstep(t: number) {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

function entryBounds(entry: ManifestEntry): Bounds {
  return {
    minX: entry.bounds_m.min_x_m,
    maxX: entry.bounds_m.max_x_m,
    minY: entry.bounds_m.min_y_m,
    maxY: entry.bounds_m.max_y_m,
  };
}

function meToStereo(xKm: number, yKm: number, zKm: number): [number, number, number] {
  const radius = Math.hypot(xKm, yKm, zKm) || 1;
  const lat = (Math.asin(Math.min(1, Math.max(-1, zKm / radius))) * 180) / Math.PI;
  const lon = (Math.atan2(yKm, xKm) * 180) / Math.PI;
  const [sx, sy] = stereographicXy(lon, lat);
  return [sx, sy, radius];
}

function featherAt(x: number, y: number, bounds: Bounds, width: number) {
  if (width <= 0) return 1;
  const margin = Math.min(x - bounds.minX, bounds.maxX - x, y - bounds.minY, bounds.maxY - y);
  if (margin >= width) return 1;
  if (margin <= 0) return 0;
  return smoothstep(margin / width);
}

function innerRect(bounds: Bounds, inset: number) {
  const minX = bounds.minX + inset;
  const maxX = bounds.maxX - inset;
  const minY = bounds.minY + inset;
  const maxY = bounds.maxY - inset;
  if (minX >= maxX || minY >= maxY) return null;
  return new THREE.Vector4(minX, minY, maxX, maxY);
}

function loadManifest() {
  if (!manifestCache) {
    manifestCache = fetch("/terrain/terrain.json")
      .then((response) => {
        if (!response.ok) throw new Error("terrain manifest failed");
        return response.json();
      })
      .then((document: { meshes: ManifestEntry[] }) => {
        const map = new Map<string, ManifestEntry>();
        for (const mesh of document.meshes) map.set(mesh.file, mesh);
        return map;
      });
  }
  return manifestCache;
}

function facesOutward(positions: Float32Array, a: number, b: number, c: number) {
  const ax = positions[a * 3];
  const ay = positions[a * 3 + 1];
  const az = positions[a * 3 + 2];
  const bx = positions[b * 3] - ax;
  const by = positions[b * 3 + 1] - ay;
  const bz = positions[b * 3 + 2] - az;
  const cx = positions[c * 3] - ax;
  const cy = positions[c * 3 + 1] - ay;
  const cz = positions[c * 3 + 2] - az;
  const nx = by * cz - bz * cy;
  const ny = bz * cx - bx * cz;
  const nz = bx * cy - by * cx;
  return nx * ax + ny * ay + nz * az >= 0;
}

function directionKey(x: number, y: number, z: number, radius: number) {
  const scale = 20000;
  const safe = radius || 1;
  return `${Math.round((x / safe) * scale)},${Math.round((y / safe) * scale)},${Math.round((z / safe) * scale)}`;
}

function parseMesh(buffer: ArrayBuffer): ParsedMesh {
  const view = new DataView(buffer);
  const magic = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
  if (magic !== "LFLM") throw new Error("terrain mesh is not LFLM");
  const vertices = view.getUint32(4, true);
  const indices = view.getUint32(8, true);
  const positions = new Float32Array(new Float32Array(buffer, 12, vertices * 3));
  for (let i = 0; i < positions.length; i += 1) {
    if (!Number.isFinite(positions[i])) positions[i] = 0;
  }
  const sourceIndex = new Uint32Array(buffer, 12 + vertices * 12, indices);
  const radii = new Float32Array(vertices);
  const keys: string[] = new Array(vertices);
  const maxRadius = new Map<string, number>();
  for (let i = 0; i < vertices; i += 1) {
    const x = positions[i * 3];
    const y = positions[i * 3 + 1];
    const z = positions[i * 3 + 2];
    const radius = Math.hypot(x, y, z);
    radii[i] = radius;
    const key = directionKey(x, y, z, radius);
    keys[i] = key;
    const previous = maxRadius.get(key) ?? 0;
    if (radius > previous) maxRadius.set(key, radius);
  }
  const skirt = new Uint8Array(vertices);
  for (let i = 0; i < vertices; i += 1) {
    if (radii[i] < (maxRadius.get(keys[i]) ?? radii[i]) - 3) skirt[i] = 1;
  }
  const kept: number[] = [];
  for (let triangle = 0; triangle < indices; triangle += 3) {
    const a = sourceIndex[triangle];
    const b = sourceIndex[triangle + 1];
    const c = sourceIndex[triangle + 2];
    if (skirt[a] || skirt[b] || skirt[c]) continue;
    kept.push(a, b, c);
  }
  let inward = 0;
  const samples = Math.min(8, kept.length / 3);
  for (let sample = 0; sample < samples; sample += 1) {
    const offset = sample * 3;
    if (!facesOutward(positions, kept[offset], kept[offset + 1], kept[offset + 2])) inward += 1;
  }
  if (inward > samples / 2) {
    for (let triangle = 0; triangle < kept.length; triangle += 3) {
      const swap = kept[triangle + 1];
      kept[triangle + 1] = kept[triangle + 2];
      kept[triangle + 2] = swap;
    }
  }
  const used = new Uint8Array(vertices);
  for (let i = 0; i < kept.length; i += 1) used[kept[i]] = 1;
  return { positions, indices: new Uint32Array(kept), skirt, used };
}

function loadParsed(url: string) {
  let pending = parsedCache.get(url);
  if (!pending) {
    pending = fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error("terrain mesh failed");
        return response.arrayBuffer();
      })
      .then(parseMesh);
    parsedCache.set(url, pending);
  }
  return pending;
}

function gridAt(grid: RadiusGrid, ix: number, iy: number) {
  if (ix < 0 || iy < 0 || ix >= grid.columns || iy >= grid.rows) return undefined;
  const radius = grid.radii[iy * grid.columns + ix];
  return Number.isFinite(radius) ? radius : undefined;
}

function sampleRadius(grid: RadiusGrid, x: number, y: number) {
  const fx = (x - grid.originX) / grid.cell;
  const fy = (y - grid.originY) / grid.cell;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const tx = fx - x0;
  const ty = fy - y0;
  const corners: [number | undefined, number][] = [
    [gridAt(grid, x0, y0), (1 - tx) * (1 - ty)],
    [gridAt(grid, x0 + 1, y0), tx * (1 - ty)],
    [gridAt(grid, x0, y0 + 1), (1 - tx) * ty],
    [gridAt(grid, x0 + 1, y0 + 1), tx * ty],
  ];
  let sum = 0;
  let weight = 0;
  for (const [radius, cornerWeight] of corners) {
    if (radius === undefined || cornerWeight <= 0) continue;
    sum += radius * cornerWeight;
    weight += cornerWeight;
  }
  if (weight <= 0) return undefined;
  return sum / weight;
}

function ensureGrid(parsed: ParsedMesh, entry: ManifestEntry) {
  if (parsed.grid) return parsed.grid;
  const bounds = entryBounds(entry);
  const columns = Math.round((bounds.maxX - bounds.minX) / entry.drawn_pixel_m) + 1;
  const rows = Math.round((bounds.maxY - bounds.minY) / entry.drawn_pixel_m) + 1;
  const radii = new Float32Array(columns * rows);
  radii.fill(Number.NaN);
  const grid: RadiusGrid = {
    originX: bounds.minX,
    originY: bounds.minY,
    cell: entry.drawn_pixel_m,
    columns,
    rows,
    radii,
  };
  for (let i = 0; i < parsed.used.length; i += 1) {
    if (!parsed.used[i] || parsed.skirt[i]) continue;
    const [sx, sy, radius] = meToStereo(parsed.positions[i * 3], parsed.positions[i * 3 + 1], parsed.positions[i * 3 + 2]);
    const ix = Math.round((sx - bounds.minX) / entry.drawn_pixel_m);
    const iy = Math.round((sy - bounds.minY) / entry.drawn_pixel_m);
    if (ix < 0 || iy < 0 || ix >= columns || iy >= rows) continue;
    const slot = iy * columns + ix;
    const previous = radii[slot];
    if (!Number.isFinite(previous) || radius > previous) radii[slot] = radius;
  }
  parsed.grid = grid;
  return grid;
}

function buildGeometry(parsed: ParsedMesh, bounds: Bounds, featherM: number, coarse: RadiusGrid | null) {
  const positions = new Float32Array(parsed.positions);
  if (featherM > 0 && coarse) {
    for (let i = 0; i < parsed.used.length; i += 1) {
      if (!parsed.used[i] || parsed.skirt[i]) continue;
      const x = positions[i * 3];
      const y = positions[i * 3 + 1];
      const z = positions[i * 3 + 2];
      const [sx, sy, radius] = meToStereo(x, y, z);
      const feather = featherAt(sx, sy, bounds, featherM);
      if (feather >= 1 || radius <= 0) continue;
      const coarseRadius = sampleRadius(coarse, sx, sy);
      if (coarseRadius === undefined) continue;
      const scale = (coarseRadius * (1 - feather) + radius * feather) / radius;
      positions[i * 3] = x * scale;
      positions[i * 3 + 1] = y * scale;
      positions[i * 3 + 2] = z * scale;
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(new THREE.BufferAttribute(parsed.indices, 1));
  geometry.computeVertexNormals();
  return geometry;
}

export function TerrainMesh({
  url,
  seamUrl,
  opacity,
  sun,
  order = 0,
  bias = false,
  featherM = 0,
  holes = NO_HOLES,
  holeOpacities = [],
}: {
  url: string;
  seamUrl?: string;
  opacity: number;
  sun: [number, number, number];
  order?: number;
  bias?: boolean;
  featherM?: number;
  holes?: readonly SeamHole[];
  holeOpacities?: readonly number[];
}) {
  const [draw, setDraw] = useState<DrawState | null>(null);
  const [readyTick, setReadyTick] = useState(0);
  const material = useRef<THREE.ShaderMaterial>(null);
  const holeKey = holes.map((hole) => `${hole.url}:${hole.featherM}`).join("|");
  useEffect(() => {
    const listener = () => setReadyTick((value) => value + 1);
    readyListeners.add(listener);
    return () => {
      readyListeners.delete(listener);
    };
  }, []);
  useEffect(() => {
    let cancelled = false;
    let created: THREE.BufferGeometry | null = null;
    let handed = false;
    const requested = holes;
    loadManifest()
      .then(async (manifest) => {
        const entry = manifest.get(fileName(url));
        if (!entry) throw new Error("terrain entry missing");
        const parsed = await loadParsed(url);
        let coarse: RadiusGrid | null = null;
        if (seamUrl) {
          const seamEntry = manifest.get(fileName(seamUrl));
          if (!seamEntry) throw new Error("seam entry missing");
          coarse = ensureGrid(await loadParsed(seamUrl), seamEntry);
        }
        const holeRects: THREE.Vector4[] = [];
        for (const hole of requested) {
          const holeEntry = manifest.get(fileName(hole.url));
          if (!holeEntry) continue;
          const rect = innerRect(entryBounds(holeEntry), hole.featherM);
          if (rect) holeRects.push(rect);
        }
        if (cancelled) return null;
        const bounds = entryBounds(entry);
        created = buildGeometry(parsed, bounds, featherM, coarse);
        return { geometry: created, bounds: new THREE.Vector4(bounds.minX, bounds.minY, bounds.maxX, bounds.maxY), holes: holeRects };
      })
      .then((next) => {
        if (cancelled || !next) {
          if (!handed) created?.dispose();
          return;
        }
        handed = true;
        markReady(url, true);
        setDraw(next);
      })
      .catch(() => {
        if (!cancelled) setDraw(null);
      });
    return () => {
      cancelled = true;
      markReady(url, false);
      if (handed) created?.dispose();
      setDraw(null);
    };
    // holeKey captures the hole urls and widths. Opacities update as uniforms.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, seamUrl, featherM, holeKey]);
  const holeOpacity = (index: number) => {
    const hole = holes[index];
    if (!hole || !readyUrls.has(hole.url)) return 0;
    return holeOpacities[index] ?? 0;
  };
  useLayoutEffect(() => {
    void readyTick;
    const current = material.current;
    if (!current || !draw) return;
    current.uniforms.uSun.value.set(sun[0], sun[1], sun[2]);
    current.uniforms.uOpacity.value = opacity;
    current.uniforms.uFeatherM.value = featherM;
    current.uniforms.uBounds.value.copy(draw.bounds);
    current.uniforms.uHoleN.value = draw.holes.length;
    current.uniforms.uHoleOp0.value = holeOpacity(0);
    current.uniforms.uHoleOp1.value = holeOpacity(1);
    if (draw.holes[0]) current.uniforms.uHole0.value.copy(draw.holes[0]);
    if (draw.holes[1]) current.uniforms.uHole1.value.copy(draw.holes[1]);
  });
  if (!draw || opacity <= 0.01) return null;
  return (
    <mesh geometry={draw.geometry} renderOrder={order}>
      <shaderMaterial
        ref={material}
        transparent
        toneMapped={false}
        depthWrite={opacity > 0.97}
        polygonOffset={bias}
        polygonOffsetFactor={bias ? -1 : 0}
        polygonOffsetUnits={bias ? -1 : 0}
        uniforms={{
          uColor: { value: new THREE.Color(REGOLITH) },
          uSun: { value: new THREE.Vector3(...sun) },
          uOpacity: { value: opacity },
          uBounds: { value: draw.bounds.clone() },
          uFeatherM: { value: featherM },
          uHole0: { value: draw.holes[0]?.clone() ?? new THREE.Vector4() },
          uHole1: { value: draw.holes[1]?.clone() ?? new THREE.Vector4() },
          uHoleOp0: { value: holeOpacity(0) },
          uHoleOp1: { value: holeOpacity(1) },
          uHoleN: { value: draw.holes.length },
        }}
        vertexShader={VERTEX}
        fragmentShader={FRAGMENT}
      />
    </mesh>
  );
}
