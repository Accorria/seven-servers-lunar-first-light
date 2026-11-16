"use client";

/** Visualization of the published Moon-centered Sun direction. It does not compute a horizon. */
export function SunLight({ direction }: { direction: number[] }) {
  const [x, y, z] = direction.length === 3 ? direction : [0, 0, 1];
  return (
    <>
      <ambientLight intensity={0.25} />
      <directionalLight position={[x * 8000, y * 8000, z * 8000]} intensity={2.2} />
    </>
  );
}
