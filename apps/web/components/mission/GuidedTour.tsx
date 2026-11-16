"use client";

import { useEffect, useRef, useState } from "react";
import { CHAPTERS } from "@/content/chapters";
import { useMission } from "@/lib/mission-state";
import { useVoice } from "@/lib/voice";

export function GuidedTour() {
  const { chapter, goToChapter, skipFlight, tourRunning, tourStarted, startTour, stopTour, setTourRunning, setFocus } = useMission();
  const voice = useVoice();
  const [speak, setSpeak] = useState(!voice.muted);
  const [hasSpeechSynthesis, setHasSpeechSynthesis] = useState(true);

  useEffect(() => {
    if (typeof window !== "undefined" && !window.speechSynthesis) {
      setHasSpeechSynthesis(false);
    }
  }, []);

  // Keep speak in sync with global mute
  useEffect(() => {
    if (voice.muted && speak) {
      setSpeak(false);
    }
  }, [voice.muted, speak]);

  const fallbackTimerRef = useRef<number | null>(null);
  const clearFallbackTimer = () => {
    if (fallbackTimerRef.current !== null) {
      window.clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
  };

  // Clean up tour voice and fallback timer when navigating away or unmounting
  useEffect(() => {
    return () => {
      clearFallbackTimer();
      voice.cancel("skip");
    };
  }, []);
  const runningRef = useRef(tourRunning);
  const speakRef = useRef(speak);
  const go = useRef(goToChapter);
  const lineToken = useRef(0);
  runningRef.current = tourRunning;
  speakRef.current = speak;
  go.current = goToChapter;
  const index = Math.max(0, CHAPTERS.findIndex((item) => item.id === chapter));
  const indexRef = useRef(index);
  indexRef.current = index;
  const current = CHAPTERS[index];
  const voiceRef = useRef(voice);
  voiceRef.current = voice;

  function stop() {
    clearFallbackTimer();
    setTourRunning(false);
    stopTour();
    voice.cancel("skip");
  }

  function advanceFrom(currentIndex: number) {
    clearFallbackTimer();
    if (currentIndex >= CHAPTERS.length - 1) {
      stop();
      return;
    }
    const next = CHAPTERS[currentIndex + 1];
    // Reveal interface panels for chapters that discuss ground data or site comparisons
    if (next.id === "ridge" || next.id === "horizon" || next.id === "mouton" || next.id === "network") {
      setFocus(false);
    }
    go.current(next.id, next.goal, next.showStar);
  }

  function armNarration() {
    clearFallbackTimer();
    const token = ++lineToken.current;
    const chapterNow = CHAPTERS[indexRef.current];
    const text = `${chapterNow.title}. ${chapterNow.narration}`;
    void voiceRef.current.speak(`chapter-${chapterNow.id}`, text).then((reason) => {
      if (lineToken.current !== token) return;
      if (!runningRef.current || !speakRef.current) return;

      // Normal speech completion advances smoothly to next chapter
      if (reason === "end") {
        advanceFrom(indexRef.current);
        return;
      }

      // If speech synthesis failed or was blocked, do NOT advance immediately!
      // Give the user a readable fallback duration proportional to word count
      if (reason === "fail") {
        const words = text.trim().split(/\s+/).filter(Boolean).length || 1;
        const readableMs = Math.max(5000, Math.round((words / 2.2) * 1000));
        clearFallbackTimer();
        fallbackTimerRef.current = window.setTimeout(() => {
          fallbackTimerRef.current = null;
          if (lineToken.current !== token) return;
          if (!runningRef.current || !speakRef.current) return;
          advanceFrom(indexRef.current);
        }, readableMs);
        return;
      }

      // Cancellations ("skip") or replacements ("replaced") do NOT automatically advance
    });
  }

  useEffect(() => {
    if (!tourRunning || speak) return;
    const timer = window.setTimeout(() => advanceFrom(index), 7000);
    return () => window.clearTimeout(timer);
    // advanceFrom reads the latest chapter through refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tourRunning, speak, index]);

  useEffect(() => {
    return () => {
      clearFallbackTimer();
      lineToken.current += 1;
    };
  }, [speak, index]);

  useEffect(() => {
    if (!speak || !tourRunning) return;
    if (voiceRef.current.isHeld()) {
      voiceRef.current.resume();
      return;
    }
    if (!voiceRef.current.isActive()) armNarration();
    // armNarration reads the latest chapter from refs. Pause leaves the held line in place.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speak, index, tourRunning]);

  function play() {
    voice.unlock();
    if (!voice.muted && !speakRef.current) {
      speakRef.current = true;
      setSpeak(true);
    }
    // If starting a brand new tour or tour was previously ended, start from Chapter 1
    if (!tourStarted || index >= CHAPTERS.length - 1) {
      restartTour();
      return;
    }
    // Reveal controls when resuming the tour so the visitor can follow along
    setFocus(false);
    startTour();
  }

  function restartTour() {
    clearFallbackTimer();
    voice.cancel("skip");
    const first = CHAPTERS[0];
    go.current(first.id, first.goal, first.showStar);
    setFocus(false);
    startTour();
  }

  function pause() {
    clearFallbackTimer();
    setTourRunning(false);
    voice.pause();
  }

  function toggleSpeak() {
    voice.unlock();
    const next = !speakRef.current;
    speakRef.current = next;
    setSpeak(next);
    if (!next) voice.cancel("replaced");
  }

  const narration = !speak ? "Narration off" : tourRunning && !voice.held ? "Narration playing" : tourStarted ? "Narration paused" : "Narration ready";

  return (
    <div className="rounded border border-[var(--line)] bg-black/90 p-3.5 text-sm leading-relaxed">
      <h2 className="text-base font-semibold text-[var(--gold)]">{current.title}</h2>
      <p className="mt-1.5 text-sm text-[var(--foreground)] font-normal leading-relaxed">{current.body}</p>
      <p className="mt-2 text-xs text-[var(--muted)]">
        Chapter {index + 1} of {CHAPTERS.length}
        {tourStarted ? ` · ${tourRunning ? "Tour running" : "Tour paused"}` : ""}
        {" · "}
        {!hasSpeechSynthesis ? "Speech unavailable in browser" : narration}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="flex items-center gap-1.5 rounded border border-[var(--gold)] px-2.5 py-1 text-sm font-medium text-[var(--gold)] hover:bg-[var(--gold)]/10"
          onClick={tourRunning ? pause : play}
        >
          {tourRunning ? (
            <>
              <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24">
                <rect x="6" y="4" width="4" height="16" />
                <rect x="14" y="4" width="4" height="16" />
              </svg>
              <span>Pause tour</span>
            </>
          ) : tourStarted ? (
            <>
              <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24">
                <polygon points="5,3 19,12 5,21" />
              </svg>
              <span>Resume tour</span>
            </>
          ) : (
            <>
              <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24">
                <polygon points="5,3 19,12 5,21" />
              </svg>
              <span>Play tour</span>
            </>
          )}
        </button>

        <button
          type="button"
          className={`flex items-center gap-1 rounded border px-2 py-1 text-sm transition-colors ${
            speak ? "border-[var(--gold)] text-[var(--gold)]" : "border-[var(--line)] text-[var(--muted)] hover:text-white"
          }`}
          onClick={toggleSpeak}
          title={speak ? "Mute audio narration" : "Unmute / enable audio narration"}
          aria-label={speak ? "Mute narration" : "Unmute narration"}
        >
          {speak ? (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            </svg>
          ) : (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
            </svg>
          )}
          <span className="text-xs">{speak ? "Audio on" : "Audio off"}</span>
        </button>

        {tourStarted && (
          <button type="button" className="rounded border border-[var(--line)] px-2 py-1 text-sm text-[var(--muted)] hover:text-white" onClick={stop}>
            Stop tour
          </button>
        )}
        <button
          type="button"
          className="rounded border border-[var(--line)] px-2 py-1 text-sm text-[var(--muted)] hover:text-white"
          onClick={restartTour}
          title="Restart guided tour from Chapter 1: Arrive"
        >
          Restart tour
        </button>
        <button type="button" className="rounded border border-[var(--line)] px-2 py-1 text-sm hover:text-white" onClick={() => advanceFrom(index)} disabled={index >= CHAPTERS.length - 1}>
          Next
        </button>
        <button type="button" className="rounded border border-[var(--line)] px-2 py-1 text-sm text-[var(--muted)] hover:text-white" onClick={() => skipFlight()}>
          Skip camera movement
        </button>
      </div>
      {(voice.active || voice.held) && (
        <div className="mt-2.5 flex items-center justify-between border-t border-[var(--line)] pt-2 text-xs text-[var(--muted)]">
          <span className="truncate max-w-[13rem] italic">"{voice.active?.text}"</span>
          <div className="flex gap-1.5 shrink-0">
            <button type="button" className="rounded border border-[var(--line)] px-1.5 py-0.5 hover:text-[var(--text)]" onClick={() => voice.replay()}>
              Replay
            </button>
            <button type="button" className="rounded border border-[var(--line)] px-1.5 py-0.5 hover:text-[var(--text)]" onClick={() => voice.cancel("skip")}>
              Skip
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
