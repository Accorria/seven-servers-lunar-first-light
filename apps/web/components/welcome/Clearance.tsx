"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { clearanceLine } from "@/content/narration";
import { useVoice } from "@/lib/voice";

export const CALLSIGN_KEY = "seven-servers-callsign";

const STATUS = ["Visitor record accepted.", "The published week stays where it is."];

export function Clearance({ onDone }: { onDone: () => void }) {
  const voice = useVoice();
  const [callsign, setCallsign] = useState("");
  const [name, setName] = useState("");
  const [running, setRunning] = useState(false);
  const [beat, setBeat] = useState(0);
  const finished = useRef(false);

  function finish() {
    if (finished.current) return;
    finished.current = true;
    onDone();
  }

  useEffect(() => {
    if (!running) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    voice.speak("clearance", clearanceLine(name));
    if (reduced) {
      setBeat(3);
      const done = window.setTimeout(finish, 900);
      return () => window.clearTimeout(done);
    }
    const timers = [
      window.setTimeout(() => setBeat(1), 700),
      window.setTimeout(() => setBeat(2), 1400),
      window.setTimeout(() => setBeat(3), 2000),
      window.setTimeout(finish, 2700),
    ];
    return () => timers.forEach((timer) => window.clearTimeout(timer));
    // The sequence starts once, from the name just accepted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  function begin(event: FormEvent) {
    event.preventDefault();
    const next = callsign.trim().slice(0, 24) || "Guest";
    sessionStorage.setItem(CALLSIGN_KEY, next);
    setName(next);
    setRunning(true);
    setBeat(0);
  }

  if (!running) {
    return (
      <form className="welcome-panel w-full max-w-xl text-center" onSubmit={begin}>
        <p className="text-xs uppercase tracking-[0.22em] text-[var(--gold)]">Seven Servers simulation</p>
        <h2 className="mt-2 text-2xl">Mission callsign</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">Any name is fine. This is not a NASA login, and it grants nothing.</p>
        <label className="mt-4 block text-left text-sm">
          Callsign
          <input
            className="mt-1 w-full rounded border border-[var(--line)] bg-black/40 px-2 py-2 text-base"
            maxLength={24}
            value={callsign}
            autoComplete="off"
            onChange={(event) => setCallsign(event.target.value)}
          />
        </label>
        <label className="mt-3 block text-left text-sm text-[var(--muted)]">
          Access code, optional
          <input className="mt-1 w-full rounded border border-[var(--line)] bg-black/40 px-2 py-2 text-base text-[var(--text)]" maxLength={24} autoComplete="off" />
        </label>
        <button type="submit" className="mt-5 rounded bg-[var(--gold)] px-6 py-3 text-black">
          Continue
        </button>
      </form>
    );
  }

  return (
    <div className="welcome-panel w-full max-w-xl text-center">
      <p className="text-xs uppercase tracking-[0.22em] text-[var(--gold)]">Seven Servers simulation. Not NASA authorization.</p>
      <h2 className="mt-3 text-2xl tracking-wide">INITIALIZING LUNAR MISSION...</h2>
      <div className="mx-auto mt-4 h-0.5 w-full max-w-xs overflow-hidden bg-[var(--line)]">
        <div className="clearance-bar h-full" />
      </div>
      <div className="mt-4 space-y-1 text-sm text-[var(--muted)]">
        {STATUS.slice(0, beat).map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>
      {beat >= 2 && <p className="mt-4 text-xl text-[var(--gold)]">SIMULATION ACCESS GRANTED</p>}
      {beat >= 3 && <p className="mt-2 text-lg">Welcome, {name}.</p>}
      <button type="button" className="mt-6 rounded border border-[var(--gold)] px-4 py-2 text-[var(--gold)]" onClick={finish}>
        Skip
      </button>
    </div>
  );
}
