"use client";

import { HorizonPlot, Timeline } from "@/components/Plots";
import { PUBLISHED_WEEK_NOTE, scienceViewLabel } from "@/content/status";
import { selectedPlayback, useMission } from "@/lib/mission-state";

export default function AnalysisPage() {
  const mission = useMission();
  const report = mission.report;
  if (!report) return <p>Loading the published week…</p>;
  const playbackSite = selectedPlayback(mission.playback, mission.siteId);
  const sample = playbackSite?.samples[mission.timeIndex];

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-[0.16em] text-[var(--gold)]">{scienceViewLabel(mission.scienceView)}</p>
        <span className="rounded border border-[var(--line)] bg-black/60 px-2.5 py-0.5 text-xs text-[var(--muted)]">
          Published NASA LOLA/SPICE Run
        </span>
      </div>

      <div>
        <h1 className="text-2xl font-semibold">Scientific Analysis & Landing Site Comparison</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Evaluated across a 169-hour continuous observation window (November 1–8, 2026) using high-resolution LOLA topographic horizons and SPICE ephemerides.
        </p>
      </div>

      {/* Plain Language Summary Box */}
      <div className="rounded border border-[var(--gold)]/30 bg-[var(--gold)]/5 p-4 text-sm leading-relaxed">
        <h3 className="font-semibold text-[var(--gold)] mb-1">Plain-Language Summary: What the Data Shows</h3>
        <p className="text-[var(--text)] text-xs md:text-sm">
          <strong>Connecting Ridge (Site A)</strong> is a prime candidate for an early lunar surface station because elevated terrain keeps the Sun above the horizon for <strong>87.0%</strong> of the 169-hour period (147 out of 169 hours) with only brief terrain shadow gaps. Direct line-of-sight to Earth is available <strong>72.2%</strong> of the time (122 of 169 hours). In contrast, <strong>Connecting Ridge Extension (Site B / Mouton)</strong> experiences <strong>75.1%</strong> solar clearance (127 of 169 hours) and <strong>65.1%</strong> Earth visibility (110 of 169 hours), confirming Ridge as the superior continuous operational anchor.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-[var(--muted)] mr-1">Select Active Site:</span>
        {report.results.map((site) => (
          <button
            key={site.id}
            type="button"
            className="rounded border px-3 py-1.5 text-sm font-medium transition-colors"
            style={{
              borderColor: site.id === mission.siteId ? "#d7b57a" : "#2a384c",
              backgroundColor: site.id === mission.siteId ? "rgba(215, 181, 122, 0.15)" : "transparent",
              color: site.id === mission.siteId ? "#d7b57a" : "var(--muted)",
            }}
            onClick={() => mission.setSiteId(site.id)}
          >
            {site.name}
          </button>
        ))}
      </div>

      {/* Read-Only Published Parameters Banner */}
      <div className="rounded border border-[var(--line)] bg-black/40 p-3 text-xs text-[var(--muted)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-4">
            <span><strong>Observation Start:</strong> {mission.start}</span>
            <span><strong>Observation Stop:</strong> {mission.stop}</span>
            <span><strong>Sensor Mast:</strong> {mission.mastHeightM} m</span>
            <span><strong>Ephemeris RMS:</strong> {report.ephemeris_consistency.sun_elevation_rms_deg}°</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded bg-black/60 px-2 py-0.5 text-[11px] text-[var(--muted)] border border-[var(--line)]">
              Published Dataset (Read-Only)
            </span>
            <button
              className="rounded border border-[var(--line)] px-2.5 py-1 text-xs opacity-50 cursor-not-allowed text-[var(--muted)]"
              disabled
              title="Live recalculation requires local science container daemon; viewing verified published run"
            >
              Recalculate (Daemon Offline)
            </button>
          </div>
        </div>
      </div>
      {!mission.liveAvailable && <p className="text-sm text-[var(--muted)]">{PUBLISHED_WEEK_NOTE}</p>}
      {mission.scienceView === "calculating" && <p className="text-sm">Calculating {mission.jobLabel}</p>}
      {mission.jobError && <p className="text-sm text-[var(--gold)]">{mission.jobError}</p>}
      {report.results.map((site) => {
        const samePoint = Boolean(
          mission.liveSite &&
            Math.abs(mission.liveSite.latitude_deg - site.latitude_deg) < 1e-4 &&
            Math.abs(mission.liveSite.longitude_deg - site.longitude_deg) < 1e-3,
        );
        const live = (mission.scienceView === "live" && samePoint ? mission.liveSite : site) ?? site;
        const rows = (site.id === mission.siteId && playbackSite ? playbackSite.samples : site.preview).map((row) => ({
          utc: row.utc,
          sun_center_clear: row.sun_center_clear,
          earth_center_clear: row.earth_center_clear,
        }));
        return (
          <article key={site.id} className="rounded border border-[var(--line)] bg-[var(--panel)] p-5" style={{ outline: site.id === mission.siteId ? "1px solid #d7b57a" : undefined }}>
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[var(--line)] pb-3">
              <h2 className="text-xl font-semibold text-[var(--gold)]">{live.name}</h2>
              <span className="text-xs font-mono text-[var(--muted)]">
                Lon {live.longitude_deg.toFixed(4)}°, Lat {live.latitude_deg.toFixed(4)}°, Elev {live.elevation_m.toFixed(0)} m
              </span>
            </div>

            {/* Visibility Metrics formatted in hours / 169 and % */}
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
              <VisibilityMetric
                label="Solar Visibility (Sun Center Clear)"
                hours={Math.round(live.sun_center_clear.true_fraction * 169)}
                total={169}
                fraction={live.sun_center_clear.true_fraction}
                accent="gold"
              />
              <div className="rounded border border-[var(--line)] bg-black/40 p-3">
                <p className="text-xs text-[var(--muted)]">Longest Solar Darkness Gap</p>
                <p className="mono text-lg font-semibold text-[var(--text)] mt-1">
                  {live.sun_center_clear.longest_interior_interruption_hours.toFixed(1)} hrs
                </p>
                <p className="text-[11px] text-[var(--muted)] mt-0.5">Continuous battery duration required</p>
              </div>
              <VisibilityMetric
                label="Direct Earth Line-of-Sight"
                hours={Math.round(live.earth_center_clear.true_fraction * 169)}
                total={169}
                fraction={live.earth_center_clear.true_fraction}
                accent="cyan"
              />
              <div className="rounded border border-[var(--line)] bg-black/40 p-3">
                <p className="text-xs text-[var(--muted)]">Longest Earth Comms Gap</p>
                <p className="mono text-lg font-semibold text-[var(--text)] mt-1">
                  {live.earth_center_clear.longest_interior_interruption_hours.toFixed(1)} hrs
                </p>
                <p className="text-[11px] text-[var(--muted)] mt-0.5">Maximum autonomous buffer required</p>
              </div>
            </div>

            {/* Horizon & Timeline Plots */}
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <HorizonPlot
                  values={live.horizon_deg}
                  label={`${live.name} horizon`}
                  markerAzimuth={site.id === mission.siteId ? sample?.sun_azimuth_deg : undefined}
                  markerElevation={site.id === mission.siteId ? sample?.sun_elevation_deg : undefined}
                />
                {/* Short Legend explaining Horizon Plot */}
                <div className="rounded border border-[var(--line)] bg-black/50 p-2.5 text-xs text-[var(--muted)] leading-relaxed">
                  <span className="font-semibold text-[var(--text)]">Horizon Plot Legend: </span>
                  The solid curve represents the terrain elevation angle (in degrees above local horizontal) across 360° azimuth. When the Sun position (indicated by the active marker) rises above this terrain skyline, the collector receives direct sunlight.
                </div>
              </div>

              <div className="space-y-2">
                <Timeline rows={rows} index={site.id === mission.siteId ? mission.timeIndex : undefined} note={site.id === mission.siteId && playbackSite ? "Gold: Sun center clear. Cyan: Earth center clear. 169 published hours." : "Report preview. The mission clock uses the 169-hour playback."} />
                <div className="rounded border border-[var(--line)] bg-black/50 p-2.5 text-xs text-[var(--muted)] leading-relaxed">
                  <span className="font-semibold text-[var(--text)]">Timeline Legend: </span>
                  169 vertical columns representing hours 0–168. Gold indicates direct solar clearance; cyan indicates unobstructed Earth line-of-sight. The vertical white tick tracks the current playback scrubber time.
                </div>
              </div>
            </div>

            {/* Expandable Technical Evidence Section */}
            <details className="mt-4 rounded border border-[var(--line)] bg-black/40 p-3 text-xs text-[var(--muted)] cursor-pointer group">
              <summary className="font-medium text-[var(--text)] select-none hover:text-[var(--gold)] transition-colors">
                ▶ View Technical Parameters & Precision Evidence
              </summary>
              <div className="mt-3 space-y-2 pt-2 border-t border-[var(--line)] text-left font-mono text-[11px]">
                <p>• <strong>Any-sunlight (limb-clear) fraction:</strong> {live.any_sunlight.true_fraction.toFixed(6)} ({Math.round(live.any_sunlight.true_fraction * 169)} / 169 hrs)</p>
                <p>• <strong>Sun center clear fraction:</strong> {live.sun_center_clear.true_fraction.toFixed(6)}</p>
                <p>• <strong>Earth center clear fraction:</strong> {live.earth_center_clear.true_fraction.toFixed(6)}</p>
                <p>• <strong>Horizon azimuth steps:</strong> 360 discrete bins (1.0° resolution) derived from LOLA polar DEM</p>
                <p>• <strong>Ephemeris frame:</strong> MOON_ME with JPL DE421 / SPICE kernel validation</p>
              </div>
            </details>
          </article>
        );
      })}
    </section>
  );
}

function VisibilityMetric({
  label,
  hours,
  total,
  fraction,
  accent,
}: {
  label: string;
  hours: number;
  total: number;
  fraction: number;
  accent: "gold" | "cyan";
}) {
  const pct = (fraction * 100).toFixed(1);
  const colorClass = accent === "gold" ? "text-[var(--gold)]" : "text-[var(--cyan)]";
  return (
    <div className="rounded border border-[var(--line)] bg-black/40 p-3">
      <p className="text-xs text-[var(--muted)]">{label}</p>
      <div className="mt-1 flex items-baseline gap-2">
        <span className={`mono text-xl font-bold ${colorClass}`}>
          {hours}/{total} hrs
        </span>
        <span className="mono text-sm text-[var(--text)]">({pct}%)</span>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded bg-black/60">
        <div
          className="h-full transition-all duration-300"
          style={{
            width: `${pct}%`,
            backgroundColor: accent === "gold" ? "var(--gold)" : "var(--cyan)",
          }}
        />
      </div>
    </div>
  );
}
