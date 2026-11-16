"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { CALLSIGN_KEY } from "@/components/welcome/WelcomeExperience";
import { ChapterRail } from "./ChapterRail";
import { ComparePanel } from "./ComparePanel";
import { Fallback } from "./Fallback";
import { GuidedTour } from "./GuidedTour";
import { SiteLabelProvider, SiteLabels } from "./SiteLabels";
import { SitePanel } from "./SitePanel";
import { TimeScrubber } from "./TimeScrubber";
import { ExplorationTutorial, TUTORIAL_KEY } from "./ExplorationTutorial";
import { CHAPTERS, PROPOSAL_NOTE } from "@/content/chapters";
import { CONTROLS_INTRO } from "@/content/narration";
import { selectedPlayback, useMission, type CameraGoal } from "@/lib/mission-state";
import { useVoice } from "@/lib/voice";
import { NODE_DETAILS } from "./StarOverlay";

const MissionCanvas = dynamic(() => import("./MissionCanvas").then((mod) => mod.MissionCanvas), { ssr: false });

const TICKS = new Set<CameraGoal>(["pole", "site_a", "horizon", "site_b", "network"]);
const CONTROLS_KEY = "seven-servers-controls-heard";

export function MissionStage() {
  const {
    setShowStar,
    showStar,
    cameraGoal,
    flyTo,
    siteId,
    setSiteId,
    focus,
    setFocus,
    startTour,
    goToChapter,
    playback,
    timeIndex,
    selectedNode,
    setSelectedNode,
    cameraNonce,
    tourStarted,
    tourRunning,
    stopTour,
    setTourRunning,
  } = useMission();
  const voice = useVoice();
  const playbackSite = selectedPlayback(playback, siteId);
  const sample = playbackSite?.samples[timeIndex];
  const sunDir = sample?.sun_unit_me ?? [0, 0, 1];
  // Calculate approximate 2D projection angle of Sun in ME XY plane for compass indicator
  const sunAngleDeg = Math.round((Math.atan2(sunDir[1] ?? 0, sunDir[0] ?? 1) * 180) / Math.PI);
  const sunElevationDeg = Math.round((Math.asin(Math.max(-1, Math.min(1, sunDir[2] ?? 0))) * 180) / Math.PI * 10) / 10;
  const proposal = CHAPTERS.find((item) => item.id === "network")?.plain;
  const terrain = CHAPTERS.find((item) => item.id === "horizon")?.plain;
  const caption = showStar ? proposal : TICKS.has(cameraGoal) ? terrain : undefined;
  const [webgl, setWebgl] = useState(true);
  const [reason, setReason] = useState("");
  const [callsign, setCallsign] = useState("");
  const [showVisitor, setShowVisitor] = useState(false);
  const [showIntro, setShowIntro] = useState(false);

  // Overlays default: showStar=true in mission-state, showSatellite=true, showRover=true
  const [showSatellite, setShowSatellite] = useState(true);
  const [showRover, setShowRover] = useState(true);
  const [roverPlaying, setRoverPlaying] = useState(false);
  const [roverProgress, setRoverProgress] = useState(0.5);

  // Rover animation step
  useEffect(() => {
    if (!roverPlaying || !showRover) return;
    const interval = window.setInterval(() => {
      setRoverProgress((prev) => (prev >= 1 ? 0 : prev + 0.015));
    }, 100);
    return () => window.clearInterval(interval);
  }, [roverPlaying, showRover]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (selectedNode) {
          setSelectedNode(null);
        } else if (focus) {
          setFocus(false);
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedNode, focus, setSelectedNode, setFocus]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("tour") === "1") {
      startTour();
    }
  }, [startTour]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("nowebgl") === "1") {
      setWebgl(false);
      setReason("WebGL is turned off for this view (?nowebgl=1).");
      return;
    }
    try {
      const canvas = document.createElement("canvas");
      const ok = Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
      setWebgl(ok);
      if (!ok) setReason("This browser did not provide WebGL.");
    } catch {
      setWebgl(false);
      setReason("This browser did not provide WebGL.");
    }
  }, []);

  useEffect(() => {
    const stored = sessionStorage.getItem(CALLSIGN_KEY);
    if (!stored) return;
    setCallsign(stored);
    setShowVisitor(true);
    const timer = window.setTimeout(() => setShowVisitor(false), 4500);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (sessionStorage.getItem(TUTORIAL_KEY)) {
      setShowIntro(false);
      return;
    }
    setShowIntro(true);
  }, [cameraNonce]);

  return (
    <SiteLabelProvider>
      <div className="relative h-full overflow-hidden bg-black">
        {webgl ? (
          <MissionCanvas
            showSatellite={showSatellite}
            showRover={showRover}
            roverPlaying={roverPlaying}
            roverProgress={roverProgress}
          />
        ) : (
          <Fallback reason={reason} />
        )}
        {webgl && <SiteLabels />}
        {showVisitor && callsign && (
          <div className="visitor-fade pointer-events-auto absolute left-4 top-4 z-40 rounded border border-[var(--gold)]/60 bg-black/90 px-3 py-1.5 shadow-xl backdrop-blur-sm">
            <span className="text-[10px] uppercase tracking-wider text-[var(--gold)] block font-mono">Visitor</span>
            <span className="text-xs font-semibold text-white">{callsign}</span>
          </div>
        )}

        {/* Stable DOM Card for Selected Preston Jordan Jr. Star Node */}
        {selectedNode && NODE_DETAILS[selectedNode] && (
          <div className="fixed top-14 right-4 z-50 w-80 rounded-lg border border-[var(--cyan)]/80 bg-black/95 p-3.5 text-xs shadow-2xl backdrop-blur-md pointer-events-auto">
            <div className="flex items-start justify-between gap-2 border-b border-[var(--line)] pb-2">
              <div>
                <h4 className="font-semibold text-sm text-[var(--cyan)]">{NODE_DETAILS[selectedNode].title}</h4>
                <p className="text-[11px] text-[var(--muted)]">{NODE_DETAILS[selectedNode].sub}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedNode(null)}
                className="rounded border border-[var(--line)] px-1.5 py-0.5 text-xs text-[var(--muted)] hover:text-white hover:border-white transition-colors"
                title="Close (Esc)"
              >
                ✕
              </button>
            </div>

            <div className="mt-2.5 space-y-2 leading-relaxed text-[var(--text)]">
              <p>{NODE_DETAILS[selectedNode].role}</p>

              <div className="rounded border border-[var(--line)] bg-white/5 p-2 text-xs">
                <p className="text-[var(--gold)] font-mono text-[11px] uppercase">
                  Pathways: <span className="text-[var(--text)]">{NODE_DETAILS[selectedNode].pathway}</span>
                </p>
                <p className="mt-1 text-[11px] text-[var(--muted)]">
                  Conceptual connections:{" "}
                  <span className="font-mono text-white">{NODE_DETAILS[selectedNode].connections.join(", ")}</span>
                </p>
              </div>

              <p className="text-[11px] text-[var(--muted)] border-t border-[var(--line)] pt-2">
                {NODE_DETAILS[selectedNode].spec}
              </p>

              <p className="text-[10px] text-[var(--gold)] italic">
                Attribution: Preston Jordan Jr. Star concept. Conceptual network layout; not surveyed engineering hardware.
              </p>
            </div>
          </div>
        )}

        {/* 4-Step Exploration Tutorial */}
        {showIntro && (
          <ExplorationTutorial
            onDismiss={() => setShowIntro(false)}
            onOpenControls={() => setFocus(false)}
            onStartTour={() => {
              setFocus(false);
              goToChapter("arrive", "globe");
              startTour();
            }}
          />
        )}

        {/* Fixed position controls: Access Controls / Hide Controls */}
        <div className="fixed top-24 right-3 z-40 pointer-events-auto sm:top-16 md:top-3 md:right-3 flex items-center gap-2">
          {focus ? (
            <button
              type="button"
              className="rounded-lg border border-[var(--gold)] bg-black/95 px-3 py-1.5 text-xs font-semibold text-[var(--gold)] shadow-2xl hover:bg-[var(--gold)]/15 flex items-center gap-1.5 transition-all backdrop-blur-md"
              onClick={() => setFocus(false)}
              title="Open interface controls and inspection panels"
            >
              <svg className="h-3.5 w-3.5 text-[var(--gold)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <line x1="9" y1="3" x2="9" y2="21" />
              </svg>
              <span>Access Controls</span>
            </button>
          ) : (
            <button
              type="button"
              className="rounded-lg border border-[var(--line)] bg-black/90 px-3 py-1.5 text-xs text-[var(--text)] hover:border-[var(--gold)] hover:text-[var(--gold)] shadow-xl transition-all flex items-center gap-1.5 backdrop-blur-md"
              onClick={() => setFocus(true)}
              title="Hide controls for unobstructed Moon view (or press Escape)"
            >
              <svg className="h-3.5 w-3.5 text-[var(--muted)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
              <span>Hide Controls</span>
              <span className="hidden text-[10px] opacity-75 font-mono sm:inline">(Esc)</span>
            </button>
          )}
        </div>

        <div className={`pointer-events-none absolute inset-0 z-20 flex flex-col justify-between gap-3 p-3 ${focus ? "hidden" : ""}`}>
            <div className="flex min-h-0 flex-1 items-start justify-between gap-3">
              <div className="pointer-events-auto w-36 shrink-0 rounded border border-[var(--line)] bg-black/90 p-2">
                <ChapterRail />
              </div>
              <div className="pointer-events-auto flex h-full w-[22rem] min-h-0 flex-col gap-2 overflow-y-auto overscroll-contain [overflow-anchor:none]">
                <div className="flex justify-between items-center pr-28">
                  {/* SPICE Sun Direction Indicator */}
                  <div className="flex items-center gap-1.5 rounded border border-[var(--line)] bg-black/90 px-2 py-1 text-xs text-[var(--gold)] shadow" title={`SPICE Sun vector: az ${sunAngleDeg}°, elev ${sunElevationDeg}°`}>
                    <svg
                      className="h-3.5 w-3.5 fill-[var(--gold)] shrink-0 transition-transform duration-500"
                      style={{ transform: `rotate(${sunAngleDeg}deg)` }}
                      viewBox="0 0 24 24"
                    >
                      <polygon points="12,2 17,21 12,17 7,21" />
                    </svg>
                    <span className="text-[11px] font-mono text-[var(--gold)]">Sun {sunElevationDeg > 0 ? `+${sunElevationDeg}` : sunElevationDeg}°</span>
                  </div>
                </div>

                <GuidedTour />
                <SitePanel />
                <ComparePanel />
              </div>
            </div>
            <div className="pointer-events-auto flex shrink-0 items-end justify-between gap-3">
              <div className="max-w-xl flex-1">
                {caption && (
                  <div className="pointer-events-none mb-2 rounded border border-[var(--line)] bg-black/90 px-3 py-2 text-sm">
                    <p>{caption}</p>
                    {showStar && <p className="mt-1 text-[var(--muted)]">{PROPOSAL_NOTE}</p>}
                  </div>
                )}
                <TimeScrubber />
                <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">
                  NASA measured: LOLA elevations. NASA processed: the published week. Simulation: power, STONE, and QDK. Visualization only: globe color and the camera. Not a NASA operational product.
                </p>
              </div>
              <div className="flex flex-col items-end gap-2">
                {/* Camera View Presets */}
                <div className="flex items-center gap-1 rounded border border-[var(--line)] bg-black/90 p-1 text-xs">
                  <span className="px-1.5 text-[10px] text-[var(--muted)] uppercase font-mono">Views:</span>
                  <button
                    type="button"
                    onClick={() => flyTo("orbit")}
                    className={`rounded px-2 py-0.5 transition-colors ${
                      cameraGoal === "orbit" ? "bg-[var(--cyan)]/20 text-[var(--cyan)] border border-[var(--cyan)]" : "text-[var(--muted)] hover:text-white"
                    }`}
                    title="Orbital satellite overview (120 km view of polar orbit)"
                  >
                    Orbit
                  </button>
                  <button
                    type="button"
                    onClick={() => flyTo("wide")}
                    className={`rounded px-2 py-0.5 transition-colors ${
                      cameraGoal === "wide" ? "bg-[var(--gold)]/20 text-[var(--gold)] border border-[var(--gold)]" : "text-[var(--muted)] hover:text-white"
                    }`}
                    title="Wide orbital overview of the polar region"
                  >
                    Wide
                  </button>
                  <button
                    type="button"
                    onClick={() => flyTo(siteId === "site_b" ? "site_b" : "site_a")}
                    className={`rounded px-2 py-0.5 transition-colors ${
                      cameraGoal === "site_a" || cameraGoal === "site_b" ? "bg-[var(--gold)]/20 text-[var(--gold)] border border-[var(--gold)]" : "text-[var(--muted)] hover:text-white"
                    }`}
                    title="Site center view"
                  >
                    Site
                  </button>
                  <button
                    type="button"
                    onClick={() => flyTo("horizon")}
                    className={`rounded px-2 py-0.5 transition-colors ${
                      cameraGoal === "horizon" ? "bg-[var(--gold)]/20 text-[var(--gold)] border border-[var(--gold)]" : "text-[var(--muted)] hover:text-white"
                    }`}
                    title="Low terrain skyline view"
                  >
                    Horizon
                  </button>
                </div>

                {/* Conceptual Overlays Bar: Star / Satellite / Rover */}
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <button
                    type="button"
                    className={`rounded border px-2.5 py-1 text-xs transition-colors ${
                      showSatellite ? "border-[var(--cyan)] bg-[var(--cyan)]/20 text-[var(--cyan)]" : "border-[var(--line)] bg-black/90 text-[var(--muted)] hover:text-white"
                    }`}
                    onClick={() => setShowSatellite(!showSatellite)}
                    title="Toggle illustrative relay satellite visualization"
                  >
                    {showSatellite ? "Hide Satellite" : "Show Satellite"}
                  </button>

                  <button
                    type="button"
                    className={`rounded border px-2.5 py-1 text-xs transition-colors ${
                      showRover ? "border-[var(--gold)] bg-[var(--gold)]/20 text-[var(--gold)]" : "border-[var(--line)] bg-black/90 text-[var(--muted)] hover:text-white"
                    }`}
                    onClick={() => {
                      const next = !showRover;
                      setShowRover(next);
                      if (next) setRoverPlaying(true);
                      else setRoverPlaying(false);
                    }}
                    title="Toggle STONE rover 2.0 km traverse scenario"
                  >
                    {showRover ? "Hide STONE Rover" : "Show STONE Rover"}
                  </button>

                  <button
                    type="button"
                    className="rounded border border-[var(--gold)] bg-black/90 px-2.5 py-1 text-xs text-[var(--gold)]"
                    onClick={() => setShowStar(!showStar)}
                  >
                    {showStar ? "Hide Proposed Star" : "Show Proposed Star"}
                  </button>
                </div>

                {/* Satellite Disclaimer Banner */}
                {showSatellite && (
                  <div className="rounded border border-[var(--cyan)]/40 bg-black/95 p-2 text-right text-[11px] leading-tight text-[var(--cyan)] max-w-md shadow-lg flex items-center justify-between gap-2">
                    <span>
                      <span className="font-semibold">Conceptual satellite visualization</span> (60 km orbit) — not calculated orbital ephemeris. Does not claim verified radio links.
                    </span>
                    <button
                      type="button"
                      onClick={() => flyTo("orbit")}
                      className="shrink-0 rounded border border-[var(--cyan)] bg-[var(--cyan)]/10 px-2 py-0.5 text-[10px] text-[var(--cyan)] hover:bg-[var(--cyan)]/20 font-mono"
                      title="Fly camera to 120 km orbital overview to view satellite path"
                    >
                      Locate
                    </button>
                  </div>
                )}

                {/* Rover Controls & Research Context Banner */}
                {showRover && (
                  <div className="rounded border border-[var(--gold)]/40 bg-black/95 p-2.5 text-xs text-[var(--text)] max-w-md shadow-lg space-y-1.5">
                    <div className="flex items-center justify-between border-b border-[var(--line)] pb-1">
                      <span className="font-semibold text-[var(--gold)]">STONE Rover Mobility Scenario</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setSiteId("site_a");
                            flyTo("site_a");
                          }}
                          className="shrink-0 rounded border border-[var(--gold)] bg-[var(--gold)]/10 px-2 py-0.5 text-[10px] text-[var(--gold)] hover:bg-[var(--gold)]/20 font-mono"
                          title="Center camera on STONE Rover at Site A"
                        >
                          Locate
                        </button>
                        <button
                          type="button"
                          className="rounded border border-[var(--gold)] px-2 py-0.5 text-[10px] text-[var(--gold)] hover:bg-[var(--gold)]/10"
                          onClick={() => setRoverPlaying(!roverPlaying)}
                        >
                          {roverPlaying ? "Pause" : "Play"}
                        </button>
                        <button
                          type="button"
                          className="rounded border border-[var(--line)] px-2 py-0.5 text-[10px] text-[var(--muted)] hover:text-white"
                          onClick={() => {
                            setRoverPlaying(false);
                            setRoverProgress(0);
                          }}
                        >
                          Reset
                        </button>
                      </div>
                    </div>
                    <p className="text-[11px] text-[var(--muted)] leading-tight">
                      Illustrative representation of the research scenario: assumed 2.0 km traverse at 250 Wh/km (500 Wh total). Not a surveyed obstacle-avoiding safe path or actual hardware.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
      </div>
    </SiteLabelProvider>
  );
}
