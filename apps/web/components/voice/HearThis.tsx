"use client";

import { useVoice } from "@/lib/voice";

export function HearThis({ id, text, label }: { id: string; text: string; label: string }) {
  const voice = useVoice();
  return (
    <button
      type="button"
      className="shrink-0 rounded border border-[var(--line)] px-2 py-1 text-xs"
      aria-label={label}
      onClick={() => {
        voice.unlock();
        void voice.speak(id, text);
      }}
    >
      Hear this
    </button>
  );
}
