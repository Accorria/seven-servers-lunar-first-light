"use client";

/**
 * Adapted from lunar-navigator `web/src/scene/Globe.tsx` (Apache-2.0): orbital sphere and a polar cutout.
 * Height displacement uses the SVS CGI Moon Kit encoding. It is not a horizon.
 */
import { useTexture } from "@react-three/drei";
import { type ThreeEvent } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { MOON_RADIUS_KM, sphericalToMe } from "@/lib/placement";

const VERTEX = `
  precision highp float;
  uniform sampler2D uHeight;
  varying vec3 vWorld;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec3 sampleColor = texture2D(uHeight, uv).rgb;
    float encoded = sampleColor.r * 255.0 * 256.0 + sampleColor.g * 255.0;
    float heightKm = ((encoded * 0.5) - 10000.0) / 1000.0;
    vec3 displaced = normalize(position) * (1737.4 + heightKm);
    vWorld = displaced;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
  }
`;

const FRAGMENT = `
  precision highp float;
  uniform sampler2D uColor;
  uniform vec3 uSun;
  uniform float uCut;
  varying vec3 vWorld;
  varying vec2 vUv;
  void main() {
    float latitude = degrees(asin(clamp(normalize(vWorld).z, -1.0, 1.0)));
    if (uCut > 0.5 && latitude < -76.0) discard;
    vec3 color = texture2D(uColor, vUv).rgb;
    float light = 0.34 + 0.66 * max(dot(normalize(vWorld), normalize(uSun)), 0.0);
    gl_FragColor = vec4(color * light, 1.0);
  }
`;

function buildSphere() {
  const width = 128;
  const height = 64;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let y = 0; y <= height; y += 1) {
    const latitude = 90 - (y / height) * 180;
    const v = 1 - y / height;
    for (let x = 0; x <= width; x += 1) {
      const longitude = (x / width) * 360;
      const point = sphericalToMe(longitude, latitude, MOON_RADIUS_KM);
      positions.push(...point);
      const u = ((longitude + 180) % 360) / 360;
      uvs.push(u, v);
    }
  }
  const stride = width + 1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const a = y * stride + x;
      const b = a + 1;
      const c = a + stride;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export function MoonGlobe({
  cut,
  sun,
  onClick,
}: {
  cut: boolean;
  sun: [number, number, number];
  onClick?: (event: ThreeEvent<MouseEvent>) => void;
}) {
  const [colorMap, heightMap] = useTexture(["/globe/moon-color.webp", "/globe/moon-height.png"]);
  const geometry = useMemo(buildSphere, []);
  const material = useRef<THREE.ShaderMaterial>(null);
  useLayoutEffect(() => {
    colorMap.colorSpace = THREE.SRGBColorSpace;
    colorMap.anisotropy = 8;
    heightMap.colorSpace = THREE.NoColorSpace;
    heightMap.magFilter = THREE.LinearFilter;
    heightMap.minFilter = THREE.LinearFilter;
  }, [colorMap, heightMap]);
  useLayoutEffect(() => {
    const current = material.current;
    if (!current) return;
    current.uniforms.uCut.value = cut ? 1 : 0;
    current.uniforms.uSun.value.set(sun[0], sun[1], sun[2]);
  }, [cut, sun]);
  return (
    <mesh geometry={geometry} onClick={onClick}>
      <shaderMaterial
        ref={material}
        toneMapped={false}
        uniforms={{
          uColor: { value: colorMap },
          uHeight: { value: heightMap },
          uSun: { value: new THREE.Vector3(...sun) },
          uCut: { value: cut ? 1 : 0 },
        }}
        vertexShader={VERTEX}
        fragmentShader={FRAGMENT}
      />
    </mesh>
  );
}
