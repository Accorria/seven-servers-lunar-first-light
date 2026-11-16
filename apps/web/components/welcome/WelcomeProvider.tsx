"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { useVoice } from "@/lib/voice";
import { WelcomeExperience } from "./WelcomeExperience";

const WelcomeContext = createContext<{ replay: () => void } | null>(null);

export function WelcomeProvider({ children }: { children: React.ReactNode }) {
  const voice = useVoice();
  const [replayKey, setReplayKey] = useState(0);
  const replay = useCallback(() => {
    voice.cancel("skip");
    voice.unlock();
    setReplayKey((value) => value + 1);
  }, [voice]);

  return (
    <WelcomeContext.Provider value={{ replay }}>
      {children}
      {replayKey > 0 && <WelcomeExperience key={replayKey} mode="replay" onDone={() => setReplayKey(0)} />}
    </WelcomeContext.Provider>
  );
}

export function useWelcome() {
  const value = useContext(WelcomeContext);
  if (!value) throw new Error("Welcome is unavailable");
  return value;
}
