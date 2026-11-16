"use client";

import { useVoice } from "@/lib/voice";

export function VoiceDock() {
  const voice = useVoice();
  return (
    <div className="rounded border border-[var(--line)] bg-black/90 p-3 text-sm">
      <div className="flex flex-wrap gap-2">
        <button type="button" className="rounded border border-[var(--line)] px-2 py-1" onClick={() => voice.replay()}>
          Replay
        </button>
        <button type="button" className="rounded border border-[var(--line)] px-2 py-1 disabled:opacity-40" disabled={!voice.active && !voice.held} onClick={() => voice.cancel("skip")}>
          Skip line
        </button>
      </div>
    </div>
  );
}
