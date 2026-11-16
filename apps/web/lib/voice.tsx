"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

export type SpeechResult = "end" | "skip" | "fail" | "replaced";

type ActiveLine = { id: string; text: string };

type VoiceControls = {
  muted: boolean;
  captions: boolean;
  active: ActiveLine | null;
  held: boolean;
  setMuted: (value: boolean) => void;
  setCaptions: (value: boolean) => void;
  unlock: () => void;
  speak: (id: string, text: string) => Promise<SpeechResult>;
  pause: () => void;
  resume: () => void;
  cancel: (result?: "skip" | "replaced") => void;
  replay: () => void;
  isHeld: () => boolean;
  isActive: () => boolean;
  onceIdle: (callback: () => void) => void;
};

type Job = {
  id: string;
  text: string;
  mode: "speech" | "timer";
  remaining: number;
  deadline: number;
  timer: number | null;
  settled: boolean;
  ignoreSynthesis: boolean;
  deferredSpeak: boolean;
  utterance: SpeechSynthesisUtterance | null;
  resolve: (result: SpeechResult) => void;
};

const PREFERRED_VOICES = ["Google UK English Male", "Google US English", "Microsoft Aria", "Microsoft Guy", "Daniel", "Alex", "Samantha"];

const VoiceContext = createContext<VoiceControls | null>(null);

function lineDuration(text: string) {
  const words = text.trim().split(/\s+/).filter(Boolean).length || 1;
  return Math.max(1400, Math.round((words / 2.2) * 1000 / 0.92));
}

function pickVoice() {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) return null;

  // 1. First priority: British Male voice
  // Look for en-GB voice explicitly identified as Male or known British male voices
  const enGbVoices = voices.filter(
    (v) => v.lang.toLowerCase() === "en-gb" || v.lang.toLowerCase().startsWith("en-gb")
  );

  const maleKeywords = ["male", "guy", "daniel", "george", "oliver", "arthur", "harry"];
  const gbMale = enGbVoices.find((v) => {
    const nameLower = v.name.toLowerCase();
    return maleKeywords.some((k) => nameLower.includes(k)) && !nameLower.includes("female");
  });
  if (gbMale) return gbMale;

  // 2. Any en-GB voice
  if (enGbVoices.length > 0) return enGbVoices[0];

  // 3. Fallback to preferred voice list
  for (const name of PREFERRED_VOICES) {
    const match = voices.find((voice) => voice.name === name);
    if (match) return match;
  }

  // 4. Any English voice
  const anyEnglish = voices.find((voice) => voice.lang.toLowerCase().startsWith("en"));
  if (anyEnglish) return anyEnglish;

  // 5. System default
  return voices[0] ?? null;
}

class Speaker {
  muted = false;
  held = false;
  job: Job | null = null;
  last: ActiveLine | null = null;
  idleWaiters: Array<() => void> = [];
  onChange: () => void = () => {};

  unlock() {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.resume();
  }

  speak(id: string, text: string) {
    this.cancel("replaced");
    const spoken = text.trim();
    return new Promise<SpeechResult>((resolve) => {
      if (!spoken) {
        resolve("fail");
        return;
      }
      const job: Job = {
        id,
        text: spoken,
        mode: "timer",
        remaining: lineDuration(spoken),
        deadline: 0,
        timer: null,
        settled: false,
        ignoreSynthesis: false,
        deferredSpeak: false,
        utterance: null,
        resolve,
      };
      this.job = job;
      this.last = { id, text: spoken };
      this.held = false;
      const synthesis = typeof window === "undefined" ? null : window.speechSynthesis;
      if (this.muted || !synthesis) {
        this.armTimer(job, job.remaining);
        this.onChange();
        return;
      }
      job.mode = "speech";
      job.remaining = Math.round(lineDuration(spoken) * 2.2) + 1200;
      const utterance = new SpeechSynthesisUtterance(spoken);
      utterance.rate = 0.92;
      utterance.pitch = 1;
      const voice = pickVoice();
      if (voice) utterance.voice = voice;
      utterance.onend = () => {
        if (job.settled || job.ignoreSynthesis || job.mode === "timer") return;
        this.settle("end");
      };
      utterance.onerror = (event: SpeechSynthesisErrorEvent) => {
        if (job.settled || job.ignoreSynthesis || job.mode === "timer") return;
        // If canceled or interrupted by browser or cancel() call, settle as skip/interrupted
        if (event.error === "canceled" || event.error === "interrupted") {
          this.settle("skip");
          return;
        }
        // Fall back gracefully to visual timer duration so text remains legible and does not jump
        job.mode = "timer";
        job.utterance = null;
        this.armTimer(job, lineDuration(spoken));
      };
      job.utterance = utterance;
      this.armTimer(job, job.remaining);
      this.onChange();
      window.setTimeout(() => {
        if (job.settled) return;
        if (this.held) {
          job.deferredSpeak = true;
          return;
        }
        synthesis.resume();
        synthesis.speak(utterance);
      }, 40);
    });
  }

  pause() {
    const job = this.job;
    if (!job || job.settled) return;
    this.held = true;
    if (job.timer !== null) {
      window.clearTimeout(job.timer);
      job.timer = null;
      job.remaining = Math.max(200, job.deadline - Date.now());
    }
    if (job.mode === "speech" && typeof window !== "undefined") window.speechSynthesis?.pause();
    this.onChange();
  }

  resume() {
    const job = this.job;
    if (!job || job.settled) return;
    this.held = false;
    if (job.mode === "speech" && typeof window !== "undefined" && window.speechSynthesis) {
      if (job.deferredSpeak && job.utterance) {
        job.deferredSpeak = false;
        window.speechSynthesis.resume();
        window.speechSynthesis.speak(job.utterance);
      } else {
        window.speechSynthesis.resume();
      }
    }
    if (job.timer === null) this.armTimer(job, job.remaining);
    this.onChange();
  }

  silenceCurrent() {
    const job = this.job;
    if (!job || job.settled || job.mode === "timer") return;
    job.ignoreSynthesis = true;
    job.mode = "timer";
    job.utterance = null;
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
  }

  cancel(result: "skip" | "replaced" = "skip") {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    if (!this.job || this.job.settled) return;
    this.settle(result);
  }

  replay() {
    if (!this.last) return;
    void this.speak(this.last.id, this.last.text);
  }

  onceIdle(callback: () => void) {
    if (!this.job || this.job.settled) callback();
    else this.idleWaiters.push(callback);
  }

  private armTimer(job: Job, ms: number) {
    if (job.timer !== null) window.clearTimeout(job.timer);
    job.remaining = ms;
    job.deadline = Date.now() + ms;
    job.timer = window.setTimeout(() => {
      if (!job.settled) this.settle("end");
    }, ms);
  }

  private settle(result: SpeechResult) {
    const job = this.job;
    if (!job || job.settled) return;
    job.settled = true;
    job.ignoreSynthesis = true;
    if (job.timer !== null) window.clearTimeout(job.timer);
    job.timer = null;
    if (job.mode === "speech" && typeof window !== "undefined") window.speechSynthesis?.cancel();
    this.job = null;
    this.held = false;
    job.resolve(result);
    this.onChange();
    const waiters = this.idleWaiters.splice(0);
    for (const waiter of waiters) waiter();
  }
}

export function VoiceProvider({ children }: { children: React.ReactNode }) {
  const speaker = useRef<Speaker | null>(null);
  if (!speaker.current) speaker.current = new Speaker();
  const [muted, setMutedState] = useState(false);
  const [captions, setCaptionsState] = useState(true);
  const [active, setActive] = useState<ActiveLine | null>(null);
  const [held, setHeld] = useState(false);

  useEffect(() => {
    const engine = speaker.current;
    if (!engine) return;
    engine.onChange = () => {
      const job = engine.job;
      setActive(job && !job.settled ? { id: job.id, text: job.text } : null);
      setHeld(engine.held);
    };
    if (window.localStorage.getItem("lfl-muted") === "1") {
      engine.muted = true;
      setMutedState(true);
    }
    if (window.localStorage.getItem("lfl-captions") === "0") setCaptionsState(false);
    const refresh = () => {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        pickVoice();
      }
    };
    refresh();
    window.speechSynthesis?.addEventListener("voiceschanged", refresh);
    // Safari / mobile voice load trigger
    if (typeof window !== "undefined" && window.speechSynthesis?.getVoices().length === 0) {
      window.speechSynthesis.getVoices();
    }
    return () => window.speechSynthesis?.removeEventListener("voiceschanged", refresh);
  }, []);

  const setMuted = useCallback((value: boolean) => {
    const engine = speaker.current;
    if (!engine) return;
    engine.muted = value;
    if (value) engine.silenceCurrent();
    setMutedState(value);
    window.localStorage.setItem("lfl-muted", value ? "1" : "0");
  }, []);

  const setCaptions = useCallback((value: boolean) => {
    setCaptionsState(value);
    window.localStorage.setItem("lfl-captions", value ? "1" : "0");
  }, []);

  const api = useMemo<VoiceControls>(() => {
    const engine = speaker.current as Speaker;
    return {
      muted,
      captions,
      active,
      held,
      setMuted,
      setCaptions,
      unlock: () => engine.unlock(),
      speak: (id, text) => engine.speak(id, text),
      pause: () => engine.pause(),
      resume: () => engine.resume(),
      cancel: (result) => engine.cancel(result),
      replay: () => engine.replay(),
      isHeld: () => engine.held && Boolean(engine.job && !engine.job.settled),
      isActive: () => Boolean(engine.job && !engine.job.settled),
      onceIdle: (callback) => engine.onceIdle(callback),
    };
  }, [active, captions, held, muted, setCaptions, setMuted]);

  return <VoiceContext.Provider value={api}>{children}</VoiceContext.Provider>;
}

export function useVoice() {
  const value = useContext(VoiceContext);
  if (!value) throw new Error("Voice is unavailable");
  return value;
}
