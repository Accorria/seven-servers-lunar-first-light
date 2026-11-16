"use client";

export function Fallback({ reason }: { reason: string }) {
  return (
    <div className="flex h-full items-center justify-center bg-black/50 p-6 text-center">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-[var(--gold)]">Visualization only</p>
        <h2 className="mt-2 text-2xl">The 3D Moon is unavailable</h2>
        <p className="mt-2 max-w-md text-sm text-[var(--muted)]">{reason}</p>
        <p className="mt-3 text-sm">The published sites, the 169-hour playback, and the report hash remain on the panels.</p>
      </div>
    </div>
  );
}
