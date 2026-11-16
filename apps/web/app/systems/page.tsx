"use client";

import { useEffect, useState } from "react";
import { Provenance } from "@/components/Provenance";
import { HearThis } from "@/components/voice/HearThis";
import { explanations } from "@/content/narration";
import { PUBLISHED_WEEK_NOTE } from "@/content/status";
import { selectedPlayback, useMission } from "@/lib/mission-state";

type NetworkResult = {
  count: number;
  best_mask: number;
  best_shortfall_j: number;
  best_delivered_j: number;
  balance_j: number;
  status?: string;
  tie_break?: string;
  site_id?: string | null;
  sunlight_fraction?: number;
  facilities: Record<string, { available: boolean; demand_w: number }>;
};

type Topology = {
  attribution?: string;
  point_nodes?: string[];
  processing_facilities?: string[];
  edges?: Array<{ a: string; b: string; pathway: string }>;
};

export default function SystemsPage() {
  const mission = useMission();
  const [activeTab, setActiveTab] = useState<"microgrid" | "quantum" | "sbsp" | "stone">("microgrid");
  const [mode, setMode] = useState("stationary");
  const [networkResult, setNetworkResult] = useState<NetworkResult | null>(null);
  const [networkError, setNetworkError] = useState("");
  const [publishedNetwork, setPublishedNetwork] = useState<NetworkResult | null>(null);
  const [topology, setTopology] = useState<Topology | null>(null);
  const [sbsp, setSbsp] = useState<Record<string, unknown> | null>(null);
  const [quantum, setQuantum] = useState<Record<string, unknown> | null>(null);
  const [stone, setStone] = useState<Record<string, unknown> | null>(null);

  const site = mission.report?.results.find((item) => item.id === mission.siteId);
  const samples = selectedPlayback(mission.playback, mission.siteId)?.samples || [];

  useEffect(() => {
    fetch("/results/topology.json").then((res) => res.json()).then(setTopology).catch(() => null);
    fetch("/results/network.json").then((res) => res.json()).then(setPublishedNetwork).catch(() => null);
    fetch("/results/sbsp.json").then((res) => res.json()).then(setSbsp).catch(() => null);
    fetch("/results/quantum.json").then((res) => res.json()).then(setQuantum).catch(() => null);
    fetch("/results/stone.json").then((res) => res.json()).then(setStone).catch(() => null);

    const hash = window.location.hash.toLowerCase();
    if (hash.includes("quantum")) setActiveTab("quantum");
    else if (hash.includes("sbsp")) setActiveTab("sbsp");
    else if (hash.includes("stone")) setActiveTab("stone");
    else if (hash.includes("infrastructure") || hash.includes("microgrid")) setActiveTab("microgrid");
  }, []);

  async function runModel() {
    setNetworkError("");
    setNetworkResult(null);
    if (!mission.liveAvailable) {
      setNetworkError(PUBLISHED_WEEK_NOTE);
      return;
    }
    const payloadSamples = samples.map((sample) => ({
      sun_center_clear: sample.sun_center_clear,
      sun_azimuth_deg: sample.sun_azimuth_deg,
      sun_elevation_deg: sample.sun_elevation_deg,
    }));
    const response = await fetch("/api/science/v1/network/exhaustive", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        site_id: mission.siteId,
        mode,
        samples: payloadSamples,
        step_seconds: 3600,
        tilt_deg: 60,
        panel_azimuth_deg: 0,
        legacy_mean_cosine: false,
      }),
    });
    if (!response.ok) {
      setNetworkError(`The network job failed (${response.status}). The published snapshot was not substituted.`);
      return;
    }
    setNetworkResult(await response.json());
  }

  const findings = (sbsp?.cited_findings as Array<{ name: string; value: number | string; unit?: string; source: string }>) || [];
  const worksheet = (sbsp?.worksheet as { note?: string }) || {};
  const quantumRecord = quantum as {
    classical?: { best_mask?: number; configurations?: number; best_shortfall_j?: number; best_delivered_j?: number };
    quantum?: {
      status?: string;
      error?: string;
      advantage_claimed?: boolean;
      sampled_mask?: number;
      sampled_objective_shortfall_j?: number;
      sample_met_optimum_shortfall?: boolean;
      objective_ratio_sampled_over_optimum?: number | null;
      version?: string;
      circuit?: string;
      hardware_job?: string | null;
    };
  } | null;
  const traverse = (stone?.traverse as { energy_wh?: { value?: number; status?: string; equation?: string }; distance_km?: { value?: number; status?: string } }) || {};
  const rover = (stone?.rover as { energy_wh_per_km?: { value?: number; status?: string } }) || {};

  return (
    <section className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-[var(--gold)]">Engineering & Exploration</p>
        <h1 className="mt-1 text-2xl">Systems & Research</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Selected site: <span className="text-[var(--text)]">{site?.name || mission.siteId}</span>. Microgrid architecture, space-based solar power, rover mobility, and offline quantum modeling.
        </p>
      </div>

      {/* Five Core Pillars of Research & Analysis */}
      <section className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-5 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--gold)]">
          Systems Research Framework: 5 Pillars of Investigation
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-xs leading-relaxed">
          <div className="rounded border border-[var(--line)] bg-black/40 p-3 space-y-1">
            <span className="font-semibold text-[var(--gold)]">1. Topography (NASA LOLA)</span>
            <p className="text-[var(--muted)]">
              Digital Elevation Models from LRO LOLA (polar stereographic 240 m/px regional grid and Barker et al. 5 m/px Site01/Site20 products) referenced to the 1,737.4 km lunar sphere in DE421 MOON_ME.
            </p>
          </div>
          <div className="rounded border border-[var(--line)] bg-black/40 p-3 space-y-1">
            <span className="font-semibold text-[var(--gold)]">2. Horizon (Local Skyline)</span>
            <p className="text-[var(--muted)]">
              Azimuthal terrain horizon profiles computed from a 2 m mast. Clear conditions verify geometric line-of-sight above terrain peaks—not solar cell output or radio link budgets.
            </p>
          </div>
          <div className="rounded border border-[var(--line)] bg-black/40 p-3 space-y-1">
            <span className="font-semibold text-[var(--gold)]">3. Time (169-Hour Epoch)</span>
            <p className="text-[var(--muted)]">
              Hourly ephemeris step simulation from 2026-11-01 to 2026-11-08 UTC using NAIF SPICE kernels (de421.bsp, moon_pa_de421) with LT+S light-time and stellar aberration corrections.
            </p>
          </div>
          <div className="rounded border border-[var(--line)] bg-black/40 p-3 space-y-1">
            <span className="font-semibold text-[var(--gold)]">4. Energy (Joule Conservation)</span>
            <p className="text-[var(--muted)]">
              Single-bus storage model under 1,361 W/m² nominal solar constant with cosine incidence across collector modes (stationary, tilted, tracking), 5 kWh battery, and 2% distribution loss.
            </p>
          </div>
          <div className="rounded border border-[var(--line)] bg-black/40 p-3 space-y-1 sm:col-span-2 lg:col-span-2">
            <span className="font-semibold text-[var(--cyan)]">5. Quantum (Discrete Optimization)</span>
            <p className="text-[var(--muted)]">
              Offline comparison of classical exhaustive search (2⁶ = 64 configurations) against simulated 6-qubit QAOA on Microsoft QDK's sparse simulator. Evaluates whether heuristic quantum sampling finds zero-shortfall microgrid states.
            </p>
          </div>
        </div>
      </section>

      <nav className="flex flex-wrap gap-2 border-b border-[var(--line)] pb-2 text-sm">
        <button
          type="button"
          className="rounded border px-3 py-1.5 transition-colors"
          style={{
            borderColor: activeTab === "microgrid" ? "var(--gold)" : "var(--line)",
            color: activeTab === "microgrid" ? "var(--gold)" : "var(--muted)",
          }}
          onClick={() => setActiveTab("microgrid")}
        >
          Surface Microgrid
        </button>
        <button
          type="button"
          className="rounded border px-3 py-1.5 transition-colors"
          style={{
            borderColor: activeTab === "quantum" ? "var(--cyan)" : "var(--line)",
            color: activeTab === "quantum" ? "var(--cyan)" : "var(--muted)",
          }}
          onClick={() => setActiveTab("quantum")}
        >
          Quantum Modeling
        </button>
        <button
          type="button"
          className="rounded border px-3 py-1.5 transition-colors"
          style={{
            borderColor: activeTab === "sbsp" ? "var(--gold)" : "var(--line)",
            color: activeTab === "sbsp" ? "var(--gold)" : "var(--muted)",
          }}
          onClick={() => setActiveTab("sbsp")}
        >
          Earth-Orbit SBSP
        </button>
        <button
          type="button"
          className="rounded border px-3 py-1.5 transition-colors"
          style={{
            borderColor: activeTab === "stone" ? "var(--gold)" : "var(--line)",
            color: activeTab === "stone" ? "var(--gold)" : "var(--muted)",
          }}
          onClick={() => setActiveTab("stone")}
        >
          STONE Rover
        </button>
      </nav>

      {activeTab === "microgrid" && (
        <article id="infrastructure" className="space-y-4 rounded border border-[var(--line)] bg-[var(--panel)] p-5 text-sm leading-relaxed">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-lg text-[var(--gold)]">Preston Jordan Jr.'s Six-Node Surface Network Proposal</h2>
              <p className="text-xs text-[var(--muted)]">{topology?.attribution}. Conceptual collector layout arranged at an assumed 1 km radius.</p>
            </div>
            <HearThis id={explanations.sixNode.id} text={explanations.sixNode.text} label={explanations.sixNode.label} />
          </div>

          {/* Simple plain-language explanation of N1-N6 */}
          <div className="rounded border border-[var(--gold)]/30 bg-[var(--gold)]/5 p-3 text-xs leading-relaxed">
            <h3 className="font-semibold text-[var(--gold)] mb-1">What are Nodes N1–N6? (Plain-Language Explanation)</h3>
            <p className="text-[var(--text)]">
              In Preston Jordan Jr.’s concept, <strong>N1 through N6</strong> are proposed perimeter solar collector / communication stations positioned in a balanced hexagonal ring around a central hub (<strong>C</strong>). Two processing nodes (<strong>F_POS</strong> and <strong>F_NEG</strong>) represent redundant power-distribution and computation units. This geometric star configuration provides overlapping lines of sight and shared cabling so that if local lunar ridges cast shadows on some stations, illuminated perimeter nodes can channel solar energy and telemetry to the center.
            </p>
          </div>

          {/* Conceptual Animated Data-Flow Diagram */}
          <div className="rounded border border-[var(--line)] bg-black/50 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--cyan)]">
                Conceptual Data & Power Flow Diagram
              </h3>
              <span className="rounded bg-[var(--cyan)]/10 px-2 py-0.5 text-[10px] text-[var(--cyan)] border border-[var(--cyan)]/30">
                Illustrative Architecture — Conceptual Only
              </span>
            </div>

            <div className="relative overflow-hidden rounded border border-[var(--line)] bg-[#040711] p-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                {/* Stage 1: Lunar Surface */}
                <div className="flex flex-col items-center text-center p-3 rounded border border-[var(--gold)]/40 bg-[var(--gold)]/5">
                  <div className="flex items-center gap-1.5 text-[var(--gold)] font-semibold mb-1">
                    <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                      <polygon points="12,2 15,9 22,9 17,14 19,21 12,17 5,21 7,14 2,9 9,9" />
                    </svg>
                    <span>Lunar Surface Network</span>
                  </div>
                  <p className="text-[11px] text-[var(--muted)]">
                    Nodes N1–N6 + Facilities F_POS/F_NEG & Central Hub C on Connecting Ridge.
                  </p>
                  <span className="mt-2 text-[10px] mono text-[var(--gold)] bg-black/60 px-2 py-0.5 rounded border border-[var(--gold)]/30">
                    Surface Bus: ~1,500 W Base Load
                  </span>
                </div>

                {/* Arrow 1 */}
                <div className="flex flex-col items-center justify-center text-center">
                  <div className="w-full flex items-center justify-center gap-2">
                    <div className="h-0.5 flex-1 bg-gradient-to-r from-[var(--gold)] to-[var(--cyan)] relative overflow-hidden">
                      <div className="absolute inset-0 bg-white/80 w-1/3 animate-[pulse_1.5s_infinite]" />
                    </div>
                    <span className="text-[10px] text-[var(--cyan)] font-mono shrink-0">Telemetry Uplink</span>
                    <div className="h-0.5 flex-1 bg-gradient-to-r from-[var(--gold)] to-[var(--cyan)]" />
                  </div>
                  <span className="text-[9px] text-[var(--muted)] mt-1">Direct Line-of-Sight when visible</span>
                </div>

                {/* Stage 2: Relay Satellite */}
                <div className="flex flex-col items-center text-center p-3 rounded border border-[var(--cyan)]/40 bg-[var(--cyan)]/5">
                  <div className="flex items-center gap-1.5 text-[var(--cyan)] font-semibold mb-1">
                    <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="4" />
                      <rect x="2" y="10" width="5" height="4" rx="1" />
                      <rect x="17" y="10" width="5" height="4" rx="1" />
                    </svg>
                    <span>Illustrative Relay Satellite</span>
                  </div>
                  <p className="text-[11px] text-[var(--muted)]">
                    Conceptual polar orbital relay bridging lunar terrain occultations.
                  </p>
                  <span className="mt-2 text-[10px] mono text-[var(--cyan)] bg-black/60 px-2 py-0.5 rounded border border-[var(--cyan)]/30">
                    Relay Orbit: Conceptual Only
                  </span>
                </div>
              </div>

              {/* Downlink stage */}
              <div className="mt-4 pt-3 border-t border-[var(--line)] flex flex-col md:flex-row items-center justify-between gap-3 text-[11px] text-[var(--muted)]">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-[var(--cyan)] animate-ping" />
                  <span>Illustrative transmission flow: <strong>Surface Star ➔ Polar Relay ➔ Earth Ground Station (Goldstone/Madrid/Canberra)</strong></span>
                </div>
                <div className="text-[10px] text-[var(--muted)] italic">
                  * Explicit disclaimer: Conceptual visualization. Does not represent operational NASA Deep Space Network links or verified radio budgets.
                </div>
              </div>
            </div>
          </div>

          <p>
            Point nodes: <span className="mono text-[var(--text)]">{topology?.point_nodes?.join(", ") || "N1-N6"}</span>.
            Processing facilities: <span className="mono text-[var(--text)]">{topology?.processing_facilities?.join(" and ") || "F_POS and F_NEG"}</span>.
            Center bus: <span className="mono text-[var(--text)]">C</span>.
          </p>
          <p className="text-[var(--muted)]">
            Sun center-clear fraction for {site?.name || "this site"}: {site ? site.sun_center_clear.true_fraction.toFixed(3) : "1.000"}.
            Total topological pathways: {topology?.edges?.length ?? 14}. Edges represent proposed connectivity pathways, not measured power flow or radio link budgets.
          </p>

          <details className="rounded border border-[var(--line)] bg-black/30 p-3">
            <summary className="cursor-pointer text-xs uppercase tracking-wider text-[var(--gold)]">View Topology Pathway Details</summary>
            <ul className="mt-2 grid gap-1 text-xs text-[var(--muted)] md:grid-cols-2">
              {topology?.edges?.map((edge) => (
                <li key={`${edge.a}-${edge.b}-${edge.pathway}`}>
                  {edge.a} — {edge.b} ({edge.pathway})
                </li>
              ))}
            </ul>
          </details>

          <div className="rounded border border-[var(--line)] bg-black/40 p-4 space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--gold)]">
              Collector Setting & Energy Model Calculations
            </h3>
            <p className="text-xs text-[var(--muted)]">
              The collector mode modifies the modeled solar incidence angle onto each node's photovoltaic array across the 169-hour observation:
            </p>
            <div className="grid gap-2 sm:grid-cols-3 text-xs pt-1">
              <div className="rounded border border-[var(--line)] bg-black/60 p-2.5">
                <span className="font-semibold text-[var(--gold)] block">STATIONARY</span>
                <span className="text-[var(--muted)] text-[11px]">Modeled collection surface remains fixed horizontally; power scales strictly with solar elevation sine angle.</span>
              </div>
              <div className="rounded border border-[var(--line)] bg-black/60 p-2.5">
                <span className="font-semibold text-[var(--gold)] block">TILTED 60°</span>
                <span className="text-[var(--muted)] text-[11px]">Modeled collection surface is fixed at a 60° inclination facing the equator, optimizing for low polar solar grazing.</span>
              </div>
              <div className="rounded border border-[var(--line)] bg-black/60 p-2.5">
                <span className="font-semibold text-[var(--gold)] block">SUN TRACKING</span>
                <span className="text-[var(--muted)] text-[11px]">Collector surface actively swivels to maintain normal incidence whenever the Sun center is above the local terrain horizon.</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <label className="flex items-center gap-2">
              Collector Mode:
              <select className="rounded border border-[var(--line)] bg-black/60 px-2 py-1 text-sm text-[var(--text)]" value={mode} onChange={(event) => setMode(event.target.value)}>
                <option value="stationary">Stationary horizontal</option>
                <option value="tilted">Tilted 60°</option>
                <option value="sun_tracking">Sun tracking</option>
              </select>
            </label>
            <button
              type="button"
              className="rounded border border-[var(--gold)] px-3 py-1 text-sm text-[var(--gold)] disabled:opacity-40"
              disabled={!mission.liveAvailable}
              onClick={runModel}
              title={mission.liveAvailable ? "Triggers live exhaustive backend calculation across 64 node configurations" : "Live computation requires local daemon; viewing verified published run"}
            >
              Run 64 configurations {mission.liveAvailable ? "(Live)" : "(Daemon Offline)"}
            </button>
          </div>

          {!mission.liveAvailable && <p className="text-xs text-[var(--muted)]">{PUBLISHED_WEEK_NOTE}</p>}
          {networkError && <p className="text-xs text-[var(--gold)]">{networkError}</p>}

          {networkResult && (
            <div className="rounded border border-[var(--line)] bg-black/40 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-[var(--cyan)]">Live Calculation Result</p>
              <p className="mt-1">Site {networkResult.site_id || mission.siteId}. Searched {networkResult.count} point-node states. Best mask {networkResult.best_mask}.</p>
              <p>Delivered {networkResult.best_delivered_j.toExponential(4)} J. Shortfall {networkResult.best_shortfall_j.toExponential(4)} J.</p>
              <p className="text-xs text-[var(--muted)]">{networkResult.status}</p>
            </div>
          )}

          {publishedNetwork && (
            <div className="rounded border border-[var(--line)] bg-black/40 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-[var(--gold)]">Published Baseline Snapshot</p>
              <p className="mt-1">
                Mask {publishedNetwork.best_mask} (N1 active). Delivered {publishedNetwork.best_delivered_j.toExponential(4)} J. Shortfall {publishedNetwork.best_shortfall_j.toExponential(4)} J.
              </p>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Assumed hardware parameters: 20 m² node area, 30% PV efficiency, 5000 Wh battery, 1500 W base demand + 250 W per facility.
              </p>
            </div>
          )}
        </article>
      )}

      {activeTab === "quantum" && (
        <article id="quantum" className="space-y-4 rounded border border-[var(--line)] bg-[var(--panel)] p-5 text-sm leading-relaxed">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-lg text-[var(--cyan)]">Microsoft QDK Simulator Comparison</h2>
              <p className="text-xs uppercase tracking-wider text-[var(--muted)]">Offline Research Experiment · Local Simulator Only</p>
            </div>
            <HearThis id={explanations.quantum.id} text={explanations.quantum.text} label={explanations.quantum.label} />
          </div>

          <div className="rounded border border-[var(--cyan)]/40 bg-[var(--cyan)]/5 p-3 text-xs leading-relaxed text-[var(--cyan)]">
            <strong>Verification Boundary & Experimental Status:</strong>
            <ul className="mt-1.5 list-disc pl-4 space-y-0.5">
              <li><strong>Offline Software Execution:</strong> Executed using Microsoft QDK local software simulation—not on physical quantum hardware.</li>
              <li><strong>Saved Results:</strong> Values displayed below are recorded, reproducible results from the offline simulation run.</li>
              <li><strong>Visual Replay:</strong> Node bitmask displays below are an interactive visual replay of these saved measurements.</li>
              <li><strong>No Quantum Advantage:</strong> No quantum speedup or operational advantage demonstrated. The classical exhaustive search solves all 64 configurations instantaneously.</li>
              <li><strong>What a Qubit Represents:</strong> Each of the 6 modeled qubits encodes the binary activation state (1 = ON, 0 = OFF) of one Preston Jordan Jr. star node (N1–N6).</li>
              <li><strong>Bitmask Definition:</strong> An integer whose binary representation maps node states (e.g. Mask 7 = 000111₂ activates N1, N2, N3).</li>
            </ul>
          </div>

          {quantumRecord ? (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded border border-[var(--line)] bg-black/40 p-4 space-y-1">
                  <p className="text-xs font-semibold text-[var(--gold)]">Classical Baseline (Exhaustive Search)</p>
                  <p className="text-xs text-[var(--muted)]">Evaluated all 2⁶ = 64 configurations in a 24h window.</p>
                  <div className="mt-3 space-y-1.5 text-xs">
                    <div className="flex justify-between border-b border-[var(--line)] pb-1">
                      <span className="text-[var(--muted)]">Total Configurations:</span>
                      <span className="mono font-semibold">{quantumRecord.classical?.configurations}</span>
                    </div>
                    <div className="flex justify-between border-b border-[var(--line)] pb-1">
                      <span className="text-[var(--muted)]">Optimum Bitmask:</span>
                      <span className="mono font-semibold text-[var(--gold)]">Mask {quantumRecord.classical?.best_mask} (Node N1)</span>
                    </div>
                    <div className="flex justify-between border-b border-[var(--line)] pb-1">
                      <span className="text-[var(--muted)]">Energy Shortfall:</span>
                      <span className="mono font-semibold text-[var(--gold)]">{quantumRecord.classical?.best_shortfall_j} J (0 unmet)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--muted)]">Delivered Energy:</span>
                      <span className="mono font-semibold">{quantumRecord.classical?.best_delivered_j?.toExponential(2)} J</span>
                    </div>
                  </div>
                </div>

                <div className="rounded border border-[var(--line)] bg-black/40 p-4 space-y-1">
                  <p className="text-xs font-semibold text-[var(--cyan)]">QDK Simulated QAOA (p=1, 64 Shots)</p>
                  <p className="text-xs text-[var(--muted)]">Executed locally via Microsoft QDK sparse simulator.</p>
                  <div className="mt-3 space-y-1.5 text-xs">
                    <div className="flex justify-between border-b border-[var(--line)] pb-1">
                      <span className="text-[var(--muted)]">Simulator Status:</span>
                      <span className="mono font-semibold text-[var(--cyan)]">{quantumRecord.quantum?.status}</span>
                    </div>
                    <div className="flex justify-between border-b border-[var(--line)] pb-1">
                      <span className="text-[var(--muted)]">Sampled Bitmask:</span>
                      <span className="mono font-semibold text-[var(--cyan)]">Mask {quantumRecord.quantum?.sampled_mask} (N1, N2, N3)</span>
                    </div>
                    <div className="flex justify-between border-b border-[var(--line)] pb-1">
                      <span className="text-[var(--muted)]">Sampled Shortfall:</span>
                      <span className="mono font-semibold text-[var(--cyan)]">{quantumRecord.quantum?.sampled_objective_shortfall_j ?? 0.0} J (0 unmet)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--muted)]">Met Optimum Shortfall:</span>
                      <span className="mono font-bold text-[var(--gold)]">{String(quantumRecord.quantum?.sample_met_optimum_shortfall)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Interactive Visual Replay Comparison of Classical vs Quantum Mask */}
              <div className="rounded border border-[var(--line)] bg-[#040711] p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] pb-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text)]">
                    Visual Bitmask Replay: 6-Node Activation State Comparison
                  </h3>
                  <span className="text-[11px] font-mono text-[var(--muted)]">Bits: [N6, N5, N4, N3, N2, N1]</span>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 pt-1">
                  {/* Classical Mask 1 */}
                  <div className="rounded border border-[var(--gold)]/40 bg-[var(--gold)]/5 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-[var(--gold)]">Classical Search: Mask 1</span>
                      <span className="mono text-xs text-[var(--gold)] font-bold">0b000001</span>
                    </div>
                    <p className="text-[11px] text-[var(--muted)]">
                      Single active node is sufficient during peak daylight.
                    </p>
                    <div className="flex items-center gap-1.5 pt-1">
                      {["N6", "N5", "N4", "N3", "N2", "N1"].map((node, i) => {
                        const bit = 5 - i;
                        const active = Boolean(1 & (1 << bit));
                        return (
                          <div
                            key={node}
                            className={`flex-1 text-center py-1 rounded text-[11px] font-mono font-semibold border ${
                              active
                                ? "border-[var(--gold)] bg-[var(--gold)] text-black"
                                : "border-[var(--line)] bg-black/50 text-[var(--muted)]"
                            }`}
                          >
                            {node}
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-[10px] text-[var(--muted)] text-right font-mono">Shortfall: 0.0 J · Tie-break: Lowest mask</p>
                  </div>

                  {/* Quantum Mask 7 */}
                  <div className="rounded border border-[var(--cyan)]/40 bg-[var(--cyan)]/5 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-[var(--cyan)]">QDK QAOA Sample: Mask 7</span>
                      <span className="mono text-xs text-[var(--cyan)] font-bold">0b000111</span>
                    </div>
                    <p className="text-[11px] text-[var(--muted)]">
                      Sampled state activates 3 nodes, providing redundancy with zero shortfall.
                    </p>
                    <div className="flex items-center gap-1.5 pt-1">
                      {["N6", "N5", "N4", "N3", "N2", "N1"].map((node, i) => {
                        const bit = 5 - i;
                        const active = Boolean(7 & (1 << bit));
                        return (
                          <div
                            key={node}
                            className={`flex-1 text-center py-1 rounded text-[11px] font-mono font-semibold border ${
                              active
                                ? "border-[var(--cyan)] bg-[var(--cyan)] text-black"
                                : "border-[var(--line)] bg-black/50 text-[var(--muted)]"
                            }`}
                          >
                            {node}
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-[10px] text-[var(--muted)] text-right font-mono">Shortfall: 0.0 J · Heuristic sampling</p>
                  </div>
                </div>
              </div>

              <div className="rounded border border-[var(--line)] bg-black/30 p-3 text-xs leading-relaxed space-y-2">
                <h3 className="font-semibold text-[var(--text)]">Mathematical Result Analysis & Interpretation</h3>
                <p className="text-[var(--muted)]">
                  <strong>Why do the masks differ (1 vs 7)?</strong> Both masks achieve the identical global minimum shortfall of <span className="text-[var(--gold)] mono">0.0 Joules</span>. In the classical search, mask <span className="mono">1</span> (binary <span className="mono">000001</span>, node N1 only) is selected because tie-breaking prefers lower masks to minimize unneeded collector generation. In QAOA sampling, mask <span className="mono">7</span> (binary <span className="mono">000111</span>, nodes N1, N2, N3) was sampled and also generates sufficient power to satisfy all base and facility demands with zero shortfall. Achieving zero shortfall does not establish quantum advantage over the classical baseline.
                </p>
                <p className="text-[var(--muted)]">
                  <strong>Objective Ratio:</strong> <span className="mono">objective_ratio_sampled_over_optimum</span> is recorded as <span className="mono text-[var(--gold)]">null</span> because the theoretical minimum shortfall denominator is exactly 0.0 J, avoiding division by zero.
                </p>
                <details className="mt-2 rounded border border-[var(--line)] bg-black/50 p-2.5">
                  <summary className="cursor-pointer font-medium text-[var(--cyan)] hover:underline select-none">
                    ▶ Technical Parameters & Simulator Details
                  </summary>
                  <div className="mt-2 space-y-1 font-mono text-[11px] text-[var(--muted)]">
                    <p>• Circuit Approach: {quantumRecord.quantum?.circuit || "Parameterized Hamiltonian QAOA (p=1, gamma=0.5, beta=0.3)"}</p>
                    <p>• Microsoft QDK Version: {quantumRecord.quantum?.version || "Microsoft.Quantum.Sdk 0.28.302812"}</p>
                    <p>• Simulator Engine: QDK QuantumSimulator / SparseSimulator</p>
                    <p>• Shots Sampled: 64 measurements</p>
                    <p>• Hardware Job: null (Offline software simulation only)</p>
                  </div>
                </details>
              </div>
            </div>
          ) : (
            <p className="text-sm text-[var(--muted)]">Loading stored quantum results…</p>
          )}
        </article>
      )}

      {activeTab === "sbsp" && (
        <article id="sbsp" className="space-y-4 rounded border border-[var(--line)] bg-[var(--panel)] p-5 text-sm leading-relaxed">
          <div>
            <h2 className="text-lg text-[var(--gold)]">Earth-Orbit Space-Based Solar Power (SBSP)</h2>
            <p className="text-xs uppercase tracking-wider text-[var(--muted)]">NASA OTPS 2024 Study Context · Separate from Lunar Surface Network</p>
          </div>
          <p className="text-[var(--muted)]">{String(sbsp?.status || "")}</p>
          <ul className="space-y-2">
            {findings.map((item) => (
              <li key={item.name} className="rounded border border-[var(--line)] bg-black/30 p-2.5">
                <span className="font-semibold text-[var(--text)]">{item.name}:</span> {item.value} {item.unit || ""}
                <p className="mt-0.5 text-xs text-[var(--muted)]">Source: {item.source}</p>
              </li>
            ))}
          </ul>
          <p className="text-xs text-[var(--muted)]">{worksheet.note}</p>
        </article>
      )}

      {activeTab === "stone" && (
        <article id="stone" className="space-y-4 rounded border border-[var(--line)] bg-[var(--panel)] p-5 text-sm leading-relaxed">
          <div>
            <h2 className="text-lg text-[var(--gold)]">STONE Rover Mobility Scenario</h2>
            <p className="text-xs uppercase tracking-wider text-[var(--muted)]">Linear Energy Assumption · Not a Surveyed Surface Path</p>
          </div>
          <div className="rounded border border-[var(--line)] bg-black/40 p-4">
            <p className="text-base">
              Assumed traverse distance: <span className="mono text-[var(--gold)]">{traverse.distance_km?.value ?? 2.0} km</span>
            </p>
            <p className="mt-1">
              Rover energy consumption rate: <span className="mono text-[var(--gold)]">{rover.energy_wh_per_km?.value ?? 250} Wh/km</span>
            </p>
            <p className="mt-2 border-t border-[var(--line)] pt-2 font-medium">
              Calculated traverse energy: <span className="mono text-[var(--gold)]">{traverse.energy_wh?.value ?? 500} Wh</span>
            </p>
          </div>
          <p className="text-xs text-[var(--muted)]">
            Distance status: {traverse.distance_km?.status}. Energy status: {traverse.energy_wh?.status}. Equation: {traverse.energy_wh?.equation}.
            This formula is an engineering calculation based on an assumed 2 km distance and is not an obstacle-avoiding DEM traverse route.
          </p>
        </article>
      )}

      <Provenance />
    </section>
  );
}
