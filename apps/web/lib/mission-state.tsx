"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import type { ChapterId } from "@/content/chapters";
import catalog from "@/content/sites.json";
import type { Report, SiteResult } from "@/lib/science";

export type ScienceView = "published" | "calculating" | "live" | "unavailable";
export type CameraGoal = "globe" | "turn" | "pole" | "site_a" | "horizon" | "site_b" | "network" | "catalog" | "wide" | "orbit";
export type StarNodeId = "N1" | "N2" | "N3" | "N4" | "N5" | "N6" | "F_POS" | "F_NEG" | "C";

export type PlaybackSample = {
  utc: string;
  sun_azimuth_deg: number;
  sun_elevation_deg: number;
  earth_azimuth_deg: number;
  earth_elevation_deg: number;
  sun_horizon_deg: number;
  earth_horizon_deg: number;
  sun_center_clear: boolean;
  earth_center_clear: boolean;
  any_sunlight: boolean;
  any_earth_disk: boolean;
  sun_unit_me: number[];
};

export type Playback = {
  schema: string;
  source_report_hash: string;
  sample_count: number;
  mast_height_m: number;
  step_seconds: number;
  sites: Array<{ id: string; name: string; samples: PlaybackSample[] }>;
};

export type CatalogSite = {
  id: string;
  name: string;
  latitude_deg: number;
  longitude_deg: number;
  analyzed: boolean;
  citation: string;
};

type LiveSite = SiteResult & { samples?: PlaybackSample[] };

type MissionState = {
  report: Report | null;
  playback: Playback | null;
  siteId: string;
  catalogId: string | null;
  timeIndex: number;
  playing: boolean;
  chapter: ChapterId;
  cameraNonce: number;
  cameraGoal: CameraGoal;
  showStar: boolean;
  scienceView: ScienceView;
  liveAvailable: boolean;
  liveSite: LiveSite | null;
  jobError: string;
  jobLabel: string;
  mastHeightM: number;
  start: string;
  stop: string;
  focus: boolean;
  setFocus: (value: boolean) => void;
  weights: { sun: number; earth: number; night: number };
  coarse: boolean;
  skipToken: number;
  tourRunning: boolean;
  tourStarted: boolean;
  tourEpoch: number;
  holdCameraRef: MutableRefObject<boolean>;
  selectedNode: StarNodeId | null;
  setSelectedNode: (node: StarNodeId | null) => void;
  resetMission: () => void;
  startTour: () => void;
  stopTour: () => void;
  setTourRunning: (value: boolean) => void;
  setSiteId: (id: string) => void;
  setCatalogId: (id: string | null) => void;
  setTimeIndex: (index: number) => void;
  setPlaying: (value: boolean) => void;
  goToChapter: (id: ChapterId, goal: CameraGoal, showStar?: boolean) => void;
  flyTo: (goal: CameraGoal) => void;
  skipFlight: () => void;
  setShowStar: (value: boolean) => void;
  setWeights: (weights: { sun: number; earth: number; night: number }) => void;
  setMastHeightM: (value: number) => void;
  setStart: (value: string) => void;
  setStop: (value: string) => void;
  runJob: (body: Record<string, unknown>, label: string) => Promise<void>;
};

const MissionContext = createContext<MissionState | null>(null);

export function useMission() {
  const value = useContext(MissionContext);
  if (!value) throw new Error("Mission state is unavailable");
  return value;
}

export function MissionProvider({ children }: { children: React.ReactNode }) {
  const [report, setReport] = useState<Report | null>(null);
  const [playback, setPlayback] = useState<Playback | null>(null);
  const [siteId, setSiteIdState] = useState("site_a");
  const [catalogId, setCatalogId] = useState<string | null>(null);
  const [timeIndex, setTimeIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [chapter, setChapter] = useState<ChapterId>("arrive");
  const [cameraNonce, setCameraNonce] = useState(0);
  const [cameraGoal, setCameraGoal] = useState<CameraGoal>("globe");
  const [showStar, setShowStar] = useState(true);
  const [scienceView, setScienceView] = useState<ScienceView>("published");
  const [liveAvailable, setLiveAvailable] = useState(false);
  const [liveSite, setLiveSite] = useState<LiveSite | null>(null);
  const [jobError, setJobError] = useState("");
  const [jobLabel, setJobLabel] = useState("");
  const [mastHeightM, setMastHeightM] = useState(2);
  const [start, setStart] = useState("2026-11-01T00:00:00");
  const [stop, setStop] = useState("2026-11-08T00:00:00");
  const [weights, setWeights] = useState({ sun: 1, earth: 0, night: 0 });
  const [coarse, setCoarse] = useState(false);
  const [skipToken, setSkipToken] = useState(0);
  const [tourRunning, setTourRunning] = useState(false);
  const [tourStarted, setTourStarted] = useState(false);
  const [tourEpoch, setTourEpoch] = useState(0);
  const [focus, setFocus] = useState(true);
  const [selectedNode, setSelectedNode] = useState<StarNodeId | null>(null);
  const holdCameraRef = useRef(false);

  function resetMission() {
    setChapter("arrive");
    setCameraGoal("globe");
    setCameraNonce((v) => v + 1);
    setTourRunning(false);
    setTourStarted(false);
    setPlaying(false);
    setTimeIndex(0);
    setFocus(true);
    setSelectedNode(null);
    setSiteIdState("site_a");
    setCatalogId(null);
    setLiveSite(null);
    setJobError("");
    setShowStar(true);
  }

  useEffect(() => {
    fetch("/results/report.json").then((response) => response.json()).then(setReport);
    fetch("/results/playback.json").then((response) => response.json()).then(setPlayback);
    const narrow = window.innerWidth < 900;
    const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
    const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
    setCoarse(narrow || coarsePointer || (memory !== undefined && memory <= 4));
    fetch("/api/science/health")
      .then((response) => setLiveAvailable(response.ok))
      .catch(() => setLiveAvailable(false));
  }, []);

  useEffect(() => {
    if (!playing || !playback) return;
    const timer = window.setInterval(() => {
      setTimeIndex((index) => (index + 1) % playback.sample_count);
    }, 700);
    return () => window.clearInterval(timer);
  }, [playing, playback]);

  function flyTo(goal: CameraGoal) {
    setCameraGoal(goal);
    setCameraNonce((value) => value + 1);
  }

  function setSiteId(id: string) {
    setSiteIdState(id);
    setCatalogId(null);
    setLiveSite(null);
    setJobError("");
    setScienceView(liveAvailable ? "published" : "unavailable");
    flyTo(id === "site_b" ? "site_b" : "site_a");
  }

  function goToChapter(id: ChapterId, goal: CameraGoal, star = false) {
    setChapter(id);
    setShowStar(star);
    if (goal === "site_a" || goal === "horizon") setSiteIdState("site_a");
    else if (goal === "site_b") setSiteIdState("site_b");
    flyTo(goal);
  }

  async function runJob(body: Record<string, unknown>, label: string) {
    if (!liveAvailable) {
      setScienceView("unavailable");
      return;
    }
    setScienceView("calculating");
    setJobError("");
    setJobLabel(label);
    const created = await fetch("/api/science/v1/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (created.status === 409) {
      setScienceView("published");
      setJobError("outside_grid: the point is outside the loaded LOLA grids. The published week was not substituted.");
      return;
    }
    if (!created.ok) {
      setScienceView("published");
      setJobError(await created.text());
      return;
    }
    const queued = await created.json();
    for (let attempt = 0; attempt < 120; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const polled = await fetch(`/api/science/v1/jobs/${queued.job_id}`);
      const job = await polled.json();
      if (job.status === "done") {
        const result = job.result || {};
        const site = result.latitude_deg !== undefined ? result : result.site || result.sites?.[0]?.site || result.sites?.[0];
        if (site?.latitude_deg !== undefined) setLiveSite(site);
        setScienceView("live");
        setJobError("");
        return;
      }
      if (job.status === "error") {
        setScienceView("published");
        setJobError(`${job.error?.code || "error"}: ${job.error?.message || "The job failed."} The published week was not substituted.`);
        return;
      }
    }
    setScienceView("published");
    setJobError("The job did not finish. The published week was not substituted.");
  }

  const value = useMemo<MissionState>(
    () => ({
      report,
      playback,
      siteId,
      catalogId,
      timeIndex,
      playing,
      chapter,
      cameraNonce,
      skipToken,
      tourRunning,
      tourStarted,
      tourEpoch,
      focus,
      setFocus,
      holdCameraRef,
      selectedNode,
      setSelectedNode,
      resetMission,
      startTour: () => {
        holdCameraRef.current = true;
        setTourStarted(true);
        setTourRunning(true);
        setTourEpoch((value) => value + 1);
      },
      stopTour: () => {
        setTourRunning(false);
        setTourStarted(false);
      },
      setTourRunning,
      cameraGoal,
      showStar,
      scienceView: liveAvailable ? scienceView : "unavailable",
      liveAvailable,
      liveSite,
      jobError,
      jobLabel,
      mastHeightM,
      start,
      stop,
      weights,
      coarse,
      setSiteId,
      setCatalogId: (id) => {
        setCatalogId(id);
        if (id) {
          setScienceView(liveAvailable ? "published" : "unavailable");
          flyTo("catalog");
        }
      },
      setTimeIndex,
      setPlaying,
      goToChapter,
      flyTo,
      skipFlight: () => setSkipToken((value) => value + 1),
      setShowStar,
      setWeights,
      setMastHeightM,
      setStart,
      setStop,
      runJob,
    }),
    [
      report,
      playback,
      siteId,
      catalogId,
      timeIndex,
      playing,
      chapter,
      cameraNonce,
      cameraGoal,
      showStar,
      scienceView,
      liveAvailable,
      liveSite,
      jobError,
      jobLabel,
      mastHeightM,
      start,
      stop,
      weights,
      coarse,
      skipToken,
      tourRunning,
      tourStarted,
      tourEpoch,
      focus,
      selectedNode,
    ],
  );

  return <MissionContext.Provider value={value}>{children}</MissionContext.Provider>;
}

export function useCatalog(): CatalogSite[] {
  return catalog.sites as CatalogSite[];
}

export function selectedPlayback(playback: Playback | null, siteId: string) {
  return playback?.sites.find((site) => site.id === siteId) || null;
}
