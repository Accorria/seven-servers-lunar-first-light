"use client";

import { useState } from "react";
import { explanations } from "@/content/narration";
import { PUBLISHED_WEEK_NOTE, scienceViewLabel } from "@/content/status";
import { HearThis } from "@/components/voice/HearThis";
import { useCatalog, useMission } from "@/lib/mission-state";
import { formatDegrees, type SiteResult } from "@/lib/science";

function placeSummary(id: string) {
  if (id === "site_a") return "Landing patch on the Connecting Ridge.";
  if (id === "site_b") return "The Mons Mouton massif, on the 240 m grid.";
  return "A published site from this week.";
}

export function SitePanel() {
  const mission = useMission();
  const catalog = useCatalog();
  const [query, setQuery] = useState("");
  const [longitude, setLongitude] = useState("222.85643");
  const [latitude, setLatitude] = useState("-89.43891");
  const published = mission.report?.results.find((site) => site.id === mission.siteId) || mission.report?.results[0];
  const shown: SiteResult | undefined = mission.scienceView === "live" && mission.liveSite ? mission.liveSite : published;
  const matches = catalog.filter((site) => site.name.toLowerCase().includes(query.toLowerCase()));
  const derivation = shown?.derivation || published?.derivation;
  const citation = shown?.citation || published?.citation;

  // Guided tour spotlight cue when Site A or Ridge chapter is active
  const isSpotlight = mission.tourRunning && (mission.chapter === "ridge" || mission.chapter === "pole");

  return (
    <div
      className={`space-y-2 rounded border bg-black/90 p-3 text-sm leading-relaxed transition-all duration-500 ${
        isSpotlight
          ? "border-[var(--gold)] ring-2 ring-[var(--gold)] ring-offset-2 ring-offset-black shadow-[0_0_15px_rgba(215,181,122,0.35)]"
          : "border-[var(--line)]"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs uppercase tracking-[0.16em] text-[var(--cyan)]">Site</p>
        <span className="rounded border border-[var(--gold)] px-2 py-0.5 text-xs text-[var(--gold)]">{scienceViewLabel(mission.scienceView)}</span>
      </div>
      {!shown && <p className="text-sm text-[var(--muted)]">Loading the published sites…</p>}
      {shown && (
        <>
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-lg text-[var(--gold)]">{shown.name}</h2>
            {shown.id === "site_a" && <HearThis id={explanations.connectingRidge.id} text={explanations.connectingRidge.text} label={explanations.connectingRidge.label} />}
          </div>
          <p className="text-[var(--muted)]">{placeSummary(shown.id)}</p>
          <p className="mono text-sm">
            {formatDegrees(shown.latitude_deg)}° lat, {formatDegrees(shown.longitude_deg)}° E, {shown.elevation_m.toFixed(1)} m
          </p>
          <div className="flex items-start justify-between gap-2">
            <p>Sun center-clear {shown.sun_center_clear.true_hours.toFixed(0)} h</p>
            <HearThis id={explanations.sunCenterClear.id} text={explanations.sunCenterClear.text} label={explanations.sunCenterClear.label} />
          </div>
          <div className="flex items-start justify-between gap-2">
            <p>Earth center-clear {shown.earth_center_clear.true_hours.toFixed(0)} h</p>
            <HearThis id={explanations.earthVisibility.id} text={explanations.earthVisibility.text} label={explanations.earthVisibility.label} />
          </div>
          <p className="text-[var(--muted)]">Longest interior night {shown.sun_center_clear.longest_interior_interruption_hours} h</p>
        </>
      )}
      <details className="rounded border border-[var(--line)] px-2 py-1.5">
        <summary className="cursor-pointer text-sm">Evidence</summary>
        <div className="mt-2 space-y-2">
          <label className="block text-sm text-[var(--muted)]">
            Search the catalog
            <input className="mt-1 w-full rounded border border-[var(--line)] bg-black/40 px-2 py-1 text-sm text-[var(--text)]" value={query} placeholder="Mouton" onChange={(event) => setQuery(event.target.value)} />
          </label>
          {query && (
            <ul className="space-y-1">
              {matches.map((site) => (
                <li key={site.id}>
                  <button
                    type="button"
                    className="w-full rounded border border-[var(--line)] px-2 py-1 text-left text-sm"
                    onClick={() => {
                      if (site.analyzed) mission.setSiteId(site.id);
                      else mission.setCatalogId(site.id);
                    }}
                  >
                    {site.name} · {site.analyzed ? "NASA processed, published week" : "named feature, not analyzed"}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {derivation && <p className="text-[var(--muted)]">{derivation}</p>}
          {citation && <p className="text-[var(--cyan)]">{citation}</p>}
          {published && (
            <p className="text-xs text-[var(--muted)]">
              {published.dataset} · {published.dataset_sha256.slice(0, 12)} · {published.frame}
            </p>
          )}
          {shown && <p className="text-[var(--cyan)]">{mission.scienceView === "live" ? "NASA processed · this job" : "NASA processed · published week"}</p>}
          {mission.coarse && <p className="text-[var(--muted)]">This device skips the 5 m Connecting Ridge patch. The 50 m parent and the 240 m grids remain.</p>}
          <div className="grid grid-cols-2 gap-2 text-sm">
            <input className="rounded border border-[var(--line)] bg-black/40 px-2 py-1" value={longitude} onChange={(event) => setLongitude(event.target.value)} aria-label="Longitude" />
            <input className="rounded border border-[var(--line)] bg-black/40 px-2 py-1" value={latitude} onChange={(event) => setLatitude(event.target.value)} aria-label="Latitude" />
            <input className="rounded border border-[var(--line)] bg-black/40 px-2 py-1" type="number" min={0} max={50} value={mission.mastHeightM} onChange={(event) => mission.setMastHeightM(Number(event.target.value))} aria-label="Mast height meters" />
            <input className="rounded border border-[var(--line)] bg-black/40 px-2 py-1" value={mission.start} onChange={(event) => mission.setStart(event.target.value)} aria-label="Start" />
            <input className="col-span-2 rounded border border-[var(--line)] bg-black/40 px-2 py-1" value={mission.stop} onChange={(event) => mission.setStop(event.target.value)} aria-label="Stop" />
          </div>
          <button
            type="button"
            disabled={!mission.liveAvailable}
            className="rounded border border-[var(--gold)] px-2 py-1 text-[var(--gold)] disabled:opacity-40"
            onClick={() =>
              mission.runJob(
                {
                  kind: "site",
                  longitude_deg: Number(longitude),
                  latitude_deg: Number(latitude),
                  mast_height_m: mission.mastHeightM,
                  start: mission.start,
                  stop: mission.stop,
                  step_seconds: 3600,
                },
                `${longitude}° E, ${latitude}°, mast ${mission.mastHeightM} m, ${mission.start} to ${mission.stop}`,
              )
            }
          >
            Calculate this point
          </button>
          {!mission.liveAvailable && <p className="text-[var(--muted)]">{PUBLISHED_WEEK_NOTE}</p>}
          {mission.scienceView === "calculating" && <p>Calculating {mission.jobLabel}</p>}
          {mission.jobError && <p className="text-[var(--gold)]">{mission.jobError}</p>}
          {mission.jobLabel && mission.scienceView !== "calculating" && <p className="text-[var(--muted)]">Last request: {mission.jobLabel}</p>}
        </div>
      </details>
    </div>
  );
}
