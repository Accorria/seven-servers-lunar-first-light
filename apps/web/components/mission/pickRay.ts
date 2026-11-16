/**
 * Adapted from lunar-navigator `web/src/scene/pickRay.ts` (Apache-2.0).
 * Sphere intersection only. Terrain height and horizons stay in the Python engine.
 */
import * as THREE from "three";

export function pickSphere(ray: THREE.Ray, radius: number): THREE.Vector3 | null {
  const offset = ray.origin.clone();
  const direction = ray.direction.clone().normalize();
  const b = offset.dot(direction);
  const c = offset.dot(offset) - radius * radius;
  const discriminant = b * b - c;
  if (discriminant < 0) return null;
  const root = Math.sqrt(discriminant);
  const near = -b - root;
  const far = -b + root;
  const distance = near > 0 ? near : far;
  if (distance <= 0) return null;
  return direction.multiplyScalar(distance).add(offset);
}
