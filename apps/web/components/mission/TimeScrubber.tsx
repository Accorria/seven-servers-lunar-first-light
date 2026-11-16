"use client";

import { explanations } from "@/content/narration";
import { HearThis } from "@/components/voice/HearThis";
import { selectedPlayback, useMission, type PlaybackSample } from "@/lib/mission-state";
import { PlaybackDial, visibilityLines } from "./PlaybackDial";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const COMPASS = ["north", "northeast", "east", "southeast", "south", "southwest", "west", "northwest"];

function formatUtc(utc: string) {
  const [date, time] = utc.split("T");
  const [year, month, day] = date.split("-");
  const clock = (time || "00:00").slice(0, 5);
  return `${Number(day)} ${MONTHS[Number(month) - 1] || month} ${year}, ${clock} UTC`;
}

function shortDate(utc: string) {
  const [date] = utc.split("T");
  const [year, month, day] = date.split("-");
  return `${Number(day)} ${MONTHS[Number(month) - 1] || month} ${year}`;
}

function compass(azimuth: number) {
  const wrapped = ((azimuth % 360) + 360) % 360;
  return COMPASS[Math.round(wrapped / 45) % 8];
}

function timeSentence(sample: PlaybackSample, siteId: string) {
  const earth = sample.earth_elevation_deg >= 0 ? "Earth is above the horizon." : "Earth is below the horizon.";
  if (siteId === "site_b") return `The Sun stays below the local horizon for this published week. ${earth}`;
  if (sample.sun_elevation_deg < 0) return `The Sun is below the horizon. ${earth}`;
  const degrees = Math.round(sample.sun_elevation_deg);
  return `The Sun is ${degrees}° up, toward the ${compass(sample.sun_azimuth_deg)}, circling the horizon. ${earth}`;
}

export function TimeScrubber() {
  const { playback, siteId, timeIndex, setTimeIndex, playing, setPlaying, tourRunning, chapter } = useMission();
  const series = selectedPlayback(playback, siteId);
  const count = series?.samples.length || playback?.sample_count || 0;
  const sample = series?.samples[timeIndex];
  if (!count) return <p className="text-xs text-[var(--muted)]">Loading the 169-hour playback…</p>;
  const visibility = sample ? visibilityLines(sample) : null;

  // Guided tour spotlight cue when Horizon chapter is active
  const isSpotlight = tourRunning && chapter === "horizon";

  return (
    <div
      className={`rounded border bg-black/90 p-3 transition-all duration-500 ${
        isSpotlight
          ? "border-[var(--gold)] ring-2 ring-[var(--gold)] ring-offset-2 ring-offset-black shadow-[0_0_15px_rgba(215,181,122,0.35)]"
          : "border-[var(--line)]"
      }`}
    >
      <div className="flex items-start gap-3">
        {sample && <PlaybackDial sample={sample} />}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="flex items-center gap-2 text-[var(--gold)]">
              {sample ? `Hour ${timeIndex + 1} of ${count} · ${shortDate(sample.utc)}` : `Hour ${timeIndex + 1} of ${count}`}
              <HearThis id={explanations.timeline.id} text={explanations.timeline.text} label={explanations.timeline.label} />
            </span>
            <button
              type="button"
              className="shrink-0 rounded border border-[var(--line)] px-2 py-1 text-xs"
              onClick={() => setPlaying(!playing)}
              title="Advance or pause the 169-hour observation timeline"
            >
              {playing ? "Pause 7-Day Timeline" : "Play 7-Day Timeline"}
            </button>
          </div>
          <p className="mt-1 text-sm">Watch how sunlight changes during this seven-day observation.</p>
          <p className="mt-1 text-sm text-[var(--muted)]">Gold needle: Sun. Cyan tick: Earth. North is up.</p>
          <input
            className="mt-2 w-full"
            type="range"
            min={0}
            max={count - 1}
            value={Math.min(timeIndex, count - 1)}
            onChange={(event) => setTimeIndex(Number(event.target.value))}
          />
          {sample && visibility && (
            <details className="mt-2 text-sm text-[var(--muted)]">
              <summary className="cursor-pointer">This hour</summary>
              <div className="mt-1 space-y-1">
                <p>
                  {formatUtc(sample.utc)}. Sun azimuth {sample.sun_azimuth_deg.toFixed(1)}° {compass(sample.sun_azimuth_deg)}. Earth azimuth {sample.earth_azimuth_deg.toFixed(1)}°, elevation {sample.earth_elevation_deg.toFixed(1)}°.
                </p>
                <p>{timeSentence(sample, siteId)}</p>
                <p>{visibility.sun}</p>
                <p>{visibility.earth}</p>
              </div>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}
