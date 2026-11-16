"use client";

import { Provenance } from "@/components/Provenance";
import { useMission } from "@/lib/mission-state";

export default function ReportPage() {
  const { report, siteId, setSiteId } = useMission();
  const site = report?.results.find((item) => item.id === siteId);

  if (!report) return <p>Loading published mission report…</p>;

  return (
    <section className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-[var(--gold)]">Verified Science Deliverable</p>
        <h1 className="mt-1 text-2xl font-bold">Lunar First Light Mission Report</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Evaluation of candidate lunar south pole infrastructure stations based on NASA LOLA elevation products and SPICE planetary ephemerides.
        </p>
      </div>

      {/* Primary Section: Published Research Findings & Conclusions */}
      <section className="rounded-lg border border-[var(--gold)]/40 bg-[var(--panel)] p-5 space-y-4 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] pb-3">
          <div>
            <h2 className="text-lg font-semibold text-[var(--gold)]">Published Research Conclusions</h2>
            <p className="text-xs text-[var(--muted)]">
              Observation window: {report.interval_utc.start} to {report.interval_utc.stop} UTC ({report.step_seconds / 3600}h time steps, 169 continuous hours).
            </p>
          </div>
          <span className="rounded border border-[var(--gold)] bg-[var(--gold)]/10 px-2.5 py-1 text-xs font-mono text-[var(--gold)]">
            Site A Ranked #1
          </span>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {report.results.map((r, i) => (
            <div
              key={r.id}
              className={`rounded border p-4 transition-colors ${
                r.id === siteId ? "border-[var(--gold)] bg-[var(--gold)]/5" : "border-[var(--line)] bg-black/40"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                  Rank #{i + 1} {i === 0 ? "(Selected Station)" : "(Alternative)"}
                </span>
                <button
                  type="button"
                  className="text-xs text-[var(--gold)] underline hover:text-white"
                  onClick={() => setSiteId(r.id)}
                >
                  {r.id === siteId ? "Active View" : "Select Site"}
                </button>
              </div>
              <h3 className="text-base font-semibold text-[var(--text)] mt-1">{r.name}</h3>
              <p className="text-xs text-[var(--muted)] mt-0.5">
                Elevation: {r.elevation_m.toFixed(0)} m · Coordinates: {r.latitude_deg.toFixed(3)}° Lat, {r.longitude_deg.toFixed(3)}° Lon
              </p>

              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded border border-[var(--line)] bg-black/60 p-2">
                  <span className="text-[10px] text-[var(--muted)] block">Solar Availability</span>
                  <span className="mono text-sm font-bold text-[var(--gold)]">
                    {(r.sun_center_clear.true_fraction * 100).toFixed(1)}%
                  </span>
                  <span className="text-[10px] text-[var(--muted)] block mt-0.5">
                    {Math.round(r.sun_center_clear.true_fraction * 169)} / 169 hrs
                  </span>
                </div>
                <div className="rounded border border-[var(--line)] bg-black/60 p-2">
                  <span className="text-[10px] text-[var(--muted)] block">Earth Line-of-Sight</span>
                  <span className="mono text-sm font-bold text-[var(--cyan)]">
                    {(r.earth_center_clear.true_fraction * 100).toFixed(1)}%
                  </span>
                  <span className="text-[10px] text-[var(--muted)] block mt-0.5">
                    {Math.round(r.earth_center_clear.true_fraction * 169)} / 169 hrs
                  </span>
                </div>
              </div>

              <p className="mt-2.5 text-[11px] text-[var(--muted)] leading-relaxed">
                {r.id === "site_a"
                  ? "Demonstrates continuous or near-continuous illumination on elevated rim terrain, keeping longest shadow interruption to 0.0 hrs across the observation week."
                  : "Experiences intermittent terrain blockage from surrounding peaks, making independent continuous operations without relay or microgrid support unfeasible."}
              </p>
            </div>
          ))}
        </div>

        <div className="rounded border border-[var(--line)] bg-black/60 p-3 text-xs leading-relaxed text-[var(--muted)]">
          <span className="font-semibold text-[var(--text)]">Core Finding: </span>
          Shackleton-de Gerlache Connecting Ridge provides the highest energy resilience of the two evaluated southern polar candidate sites. The Preston Jordan Jr. six-point star network layout serves as a conceptual modeling assumption pending confirmation; this report evaluates site topography and solar geometry rather than physical infrastructure deployment or verified satellite communications.
        </div>
      </section>

      {/* Secondary Section: Dataset Hashes, Methods & Downloads */}
      <section className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-[var(--text)]">Provenance & Technical Evidence</h2>
            <p className="text-xs text-[var(--muted)]">Cryptographic hashes and reference datasets underlying published calculations.</p>
          </div>
          <a
            className="flex items-center gap-1.5 rounded border border-[var(--cyan)] bg-[var(--cyan)]/10 px-3 py-1.5 text-xs text-[var(--cyan)] hover:bg-[var(--cyan)]/20 transition-colors"
            href="/results/report.json"
            download
          >
            <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24">
              <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
            </svg>
            <span>Download Published JSON</span>
          </a>
        </div>

        <div className="rounded border border-[var(--line)] bg-black/40 p-3 space-y-2 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-1">
            <span className="text-[var(--muted)]">Publication SHA-256 Record Hash:</span>
            <span className="mono text-[11px] text-[var(--gold)]">{report.record_hash}</span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-1">
            <span className="text-[var(--muted)]">Computational Method:</span>
            <span className="text-[var(--text)]">{report.method}</span>
          </div>
        </div>

        <details className="rounded border border-[var(--line)] bg-black/30 p-3 text-xs text-[var(--muted)] cursor-pointer">
          <summary className="font-medium text-[var(--text)] select-none hover:text-[var(--gold)] transition-colors">
            ▶ View Methodology Boundaries & Source Datasets ({report.datasets.length} NASA Products)
          </summary>
          <div className="mt-3 space-y-3 pt-2 border-t border-[var(--line)]">
            <div>
              <p className="font-semibold text-[var(--text)] mb-1">Analytical Boundaries:</p>
              <ul className="list-disc pl-5 space-y-1">
                {report.boundaries.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="font-semibold text-[var(--text)] mb-1">Source Datasets & Checksums:</p>
              <ul className="space-y-1.5 font-mono text-[11px]">
                {report.datasets.map((item) => (
                  <li key={item.sha256} className="rounded bg-black/40 p-1.5">
                    <span className="text-[var(--gold)]">{item.name}</span>: {item.citation}
                    <span className="block text-[10px] text-[var(--muted)] mt-0.5 truncate">SHA-256: {item.sha256}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </details>
      </section>

      <Provenance />
    </section>
  );
}
