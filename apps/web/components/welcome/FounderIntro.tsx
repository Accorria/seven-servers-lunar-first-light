"use client";

import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { founderMedia } from "@/content/welcome";
import { useVoice } from "@/lib/voice";

export type FounderIntroHandle = {
  play: () => Promise<void>;
};

export const FounderIntro = forwardRef<FounderIntroHandle, { active: boolean; onEnded: () => void; onSkip: () => void }>(
  function FounderIntro({ active, onEnded, onSkip }, ref) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const voice = useVoice();
    const [cue, setCue] = useState("");
    const [paused, setPaused] = useState(false);
    const [silent, setSilent] = useState(false);

    useImperativeHandle(ref, () => ({
      play: async () => {
        const video = videoRef.current;
        if (!video) throw new Error("The founder film is not mounted.");
        video.currentTime = 0;
        video.muted = silent;
        await video.play();
        setPaused(false);
      },
    }));

    function bindCues() {
      const track = videoRef.current?.textTracks?.[0];
      if (!track) return;
      track.mode = "hidden";
      track.oncuechange = () => {
        const activeCue = track.activeCues?.[0] as VTTCue | undefined;
        setCue(activeCue?.text ?? "");
      };
    }

    function skip() {
      videoRef.current?.pause();
      onSkip();
    }

    return (
      <div className={active ? "w-full max-w-3xl" : "pointer-events-none absolute h-px w-px overflow-hidden opacity-0"}>
        <video
          ref={videoRef}
          className="max-h-[70dvh] w-full rounded border border-[var(--line)] bg-black"
          src={founderMedia.video}
          playsInline
          preload="auto"
          onLoadedMetadata={bindCues}
          onEnded={onEnded}
          onPlay={() => setPaused(false)}
          onPause={() => setPaused(true)}
        >
          <track kind="captions" src={founderMedia.captions} srcLang="en" label="English" />
        </video>
        {active && (
          <>
            <div className="mt-3 flex flex-wrap gap-2 text-sm">
              <button
                type="button"
                className="rounded border border-[var(--line)] px-2 py-1"
                onClick={() => {
                  const video = videoRef.current;
                  if (!video) return;
                  if (video.paused) void video.play();
                  else video.pause();
                }}
              >
                {paused ? "Play" : "Pause"}
              </button>
              <button
                type="button"
                className="rounded border border-[var(--line)] px-2 py-1"
                onClick={() => {
                  const video = videoRef.current;
                  if (!video) return;
                  video.currentTime = 0;
                  void video.play();
                }}
              >
                Replay
              </button>
              <button
                type="button"
                className="rounded border border-[var(--line)] px-2 py-1"
                onClick={() => {
                  const video = videoRef.current;
                  if (!video) return;
                  video.muted = !video.muted;
                  setSilent(video.muted);
                }}
              >
                {silent ? "Unmute" : "Mute"}
              </button>
              <button type="button" className="rounded border border-[var(--line)] px-2 py-1" onClick={() => voice.setCaptions(!voice.captions)}>
                {voice.captions ? "Captions on" : "Captions off"}
              </button>
              <button type="button" className="rounded border border-[var(--gold)] px-2 py-1 text-[var(--gold)]" onClick={skip}>
                Skip
              </button>
            </div>
            {voice.captions && cue && <p className="mt-3 text-sm text-[var(--muted)]">{cue}</p>}
          </>
        )}
      </div>
    );
  },
);
