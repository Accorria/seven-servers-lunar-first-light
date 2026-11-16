"use client";

import type { PlaybackSample } from "@/lib/mission-state";

function armStyle(degrees: number) {
  return { transform: `rotate(${degrees}deg)` };
}

function clearance(name: "Sun" | "Earth", elevation: number, clear: boolean) {
  if (elevation < 0) return `The ${name} is below the horizon.`;
  if (!clear) {
    return name === "Sun" ? "The Sun is up, and terrain blocks its center." : "Earth is up, and terrain blocks its center.";
  }
  return name === "Sun" ? "Sun center is clear of the terrain." : "Earth center is clear of the terrain.";
}

export function PlaybackDial({ sample }: { sample: PlaybackSample }) {
  const sunAzimuth = sample.sun_azimuth_deg;
  const earthAzimuth = sample.earth_azimuth_deg;
  const label = `Sun azimuth ${sunAzimuth.toFixed(1)} degrees, elevation ${sample.sun_elevation_deg.toFixed(1)} degrees. Earth azimuth ${earthAzimuth.toFixed(1)} degrees, elevation ${sample.earth_elevation_deg.toFixed(1)} degrees.`;
  return (
    <div className="relative h-28 w-28 shrink-0" role="img" aria-label={label}>
      <svg className="h-full w-full" viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r="46" fill="none" stroke="#2a384c" />
        <text x="50" y="12" textAnchor="middle" fill="#93a4ba" fontSize="8">
          N
        </text>
      </svg>
      <span className="dial-arm pointer-events-none absolute bottom-1/2 left-1/2 -ml-px h-[42%] w-0.5 bg-[var(--gold)]" style={armStyle(sunAzimuth)} />
      <span className="dial-arm pointer-events-none absolute bottom-1/2 left-1/2 -ml-px h-[28%] w-0.5 bg-[var(--cyan)]" style={armStyle(earthAzimuth)} />
      <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-lg text-[var(--gold)]">
        {sample.sun_elevation_deg.toFixed(1)}°
      </span>
    </div>
  );
}

export function visibilityLines(sample: PlaybackSample) {
  return {
    sun: clearance("Sun", sample.sun_elevation_deg, sample.sun_center_clear),
    earth: clearance("Earth", sample.earth_elevation_deg, sample.earth_center_clear),
  };
}
