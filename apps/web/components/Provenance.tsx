"use client";

import { useState } from "react";
import { useMission } from "@/lib/mission-state";

export function Provenance() {
  const { report, playback } = useMission();
  const [open, setOpen] = useState(false);
  if (!report) return null;
  return (
    <div className="rounded border border-[var(--line)] bg-[var(--panel)] p-4 text-sm">
      <button type="button" className="text-[var(--cyan)]" onClick={() => setOpen((value) => !value)}>
        {open ? "Hide provenance" : "Provenance"}
      </button>
      {open && (
        <ul className="mt-3 space-y-1 text-xs">
          <li className="mono">Report SHA-256 {report.record_hash}</li>
          <li>Playback source hash {playback?.source_report_hash}</li>
          <li>Kernels and frame are named in the method. Aberration is LT+S. Radius 1737.4 km.</li>
          {report.datasets.map((item) => (
            <li key={item.sha256}>Dataset {item.name} · {item.sha256}</li>
          ))}
          <li>Horizons Sun elevation RMS {String(report.ephemeris_consistency.sun_elevation_rms_deg)}°. Publish windows: {String(report.publish_windows)}.</li>
          <li>A mock receipt is an integrity label. It is not a signature and it is not NASA approval.</li>
        </ul>
      )}
    </div>
  );
}
