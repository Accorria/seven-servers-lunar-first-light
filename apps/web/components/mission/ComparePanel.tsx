"use client";

import { useMission } from "@/lib/mission-state";
import type { SiteResult } from "@/lib/science";

function term(site: SiteResult, weights: { sun: number; earth: number; night: number }) {
  const sun = site.sun_center_clear.true_fraction;
  const earth = site.earth_center_clear.true_fraction;
  const night = site.sun_center_clear.longest_interior_interruption_hours / 169;
  const total = weights.sun + weights.earth + weights.night || 1;
  const value = (weights.sun * sun + weights.earth * earth - weights.night * night) / total;
  return {
    value,
    text: `(${weights.sun} × ${sun.toFixed(3)} + ${weights.earth} × ${earth.toFixed(3)} − ${weights.night} × ${night.toFixed(3)}) / ${total} = ${value.toFixed(3)}`,
  };
}

export function ComparePanel() {
  const mission = useMission();
  const sites = mission.report?.results || [];
  const ranked = sites
    .map((site) => ({ site, ...term(site, mission.weights) }))
    .sort((a, b) => b.value - a.value);

  // Guided tour spotlight cue when Mouton chapter is active
  const isSpotlight = mission.tourRunning && mission.chapter === "mouton";

  return (
    <div
      className={`rounded border bg-black/90 p-3 text-sm leading-relaxed transition-all duration-500 ${
        isSpotlight
          ? "border-[var(--gold)] ring-2 ring-[var(--gold)] ring-offset-2 ring-offset-black shadow-[0_0_15px_rgba(215,181,122,0.35)]"
          : "border-[var(--line)]"
      }`}
    >
      <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">Score for this published week</p>
      <p className="mt-1 text-xs text-[var(--muted)]">Explainable score. Not a NASA ranking.</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          className={`rounded border px-2 py-1 text-xs font-medium transition-colors ${
            mission.weights.sun === 1 && mission.weights.earth === 0 && mission.weights.night === 0
              ? "border-[var(--gold)] bg-[var(--gold)]/20 text-[var(--gold)] shadow-sm"
              : "border-[var(--line)] text-[var(--muted)] hover:text-white"
          }`}
          onClick={() => mission.setWeights({ sun: 1, earth: 0, night: 0 })}
        >
          Power first
        </button>
        <button
          type="button"
          className={`rounded border px-2 py-1 text-xs font-medium transition-colors ${
            mission.weights.sun === 0 && mission.weights.earth === 1 && mission.weights.night === 0
              ? "border-[var(--gold)] bg-[var(--gold)]/20 text-[var(--gold)] shadow-sm"
              : "border-[var(--line)] text-[var(--muted)] hover:text-white"
          }`}
          onClick={() => mission.setWeights({ sun: 0, earth: 1, night: 0 })}
        >
          Earth first
        </button>
        <button
          type="button"
          className={`rounded border px-2 py-1 text-xs font-medium transition-colors ${
            mission.weights.sun === 1 && mission.weights.earth === 1 && mission.weights.night === 1
              ? "border-[var(--gold)] bg-[var(--gold)]/20 text-[var(--gold)] shadow-sm"
              : "border-[var(--line)] text-[var(--muted)] hover:text-white"
          }`}
          onClick={() => mission.setWeights({ sun: 1, earth: 1, night: 1 })}
        >
          Balanced
        </button>
      </div>
      <ol className="mt-2 space-y-1">
        {ranked.map((item, index) => (
          <li key={item.site.id}>
            {index + 1}. {item.site.name}
            <span className="block text-xs text-[var(--muted)]">{item.text}</span>
          </li>
        ))}
      </ol>
      <div className="mt-3 pt-2 border-t border-[var(--line)] flex flex-col gap-1.5">
        <button
          type="button"
          disabled={!mission.liveAvailable || sites.length < 2}
          className="rounded border border-[var(--gold)] px-2.5 py-1 text-xs font-semibold text-[var(--gold)] disabled:opacity-40 hover:bg-[var(--gold)]/10 transition-colors"
          onClick={() =>
            mission.runJob(
              {
                kind: "compare",
                start: mission.start,
                stop: mission.stop,
                mast_height_m: mission.mastHeightM,
                sites: sites.map((site) => ({
                  longitude_deg: site.longitude_deg,
                  latitude_deg: site.latitude_deg,
                })),
              },
              `compare ${sites.map((site) => site.name).join(" and ")} · mast ${mission.mastHeightM} m · ${mission.start} to ${mission.stop}`,
            )
          }
        >
          {mission.liveAvailable ? "Compare live" : "Compare Live (Daemon Offline)"}
        </button>
        {!mission.liveAvailable && (
          <p className="text-[10px] text-[var(--muted)]">
            Live recalculation requires the local Python science daemon. Published pre-computed week results are loaded above.
          </p>
        )}
      </div>
    </div>
  );
}
