"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useVoice } from "@/lib/voice";
import { useMission } from "@/lib/mission-state";

export const CALLSIGN_KEY = "seven-servers-callsign";

const MISSION_BRIEFING =
  "Welcome to Seven Servers Lunar First Light. This mission models clean solar energy and infrastructure resilience at the lunar south pole. Using NASA LOLA elevation datasets and SPICE planetary ephemerides, we evaluate candidate landing sites for long-duration human and robotic presence.";

type Phase = "welcome" | "name" | "greeting" | "leaving";

export function WelcomeExperience({
  mode,
  onDone,
}: {
  mode: "door" | "replay";
  onDone?: () => void;
}) {
  const voice = useVoice();
  const mission = useMission();
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>("welcome");
  const [firstName, setFirstName] = useState("");
  const [welcomeGreeting, setWelcomeGreeting] = useState("");
  const [briefingOpen, setBriefingOpen] = useState(false);
  const [briefingPlaying, setBriefingPlaying] = useState(false);
  const [sky, setSky] = useState({ stars: true, earth: true, moon: true });

  const timersRef = useRef<number[]>([]);
  const clearAllTimers = () => {
    timersRef.current.forEach((t) => window.clearTimeout(t));
    timersRef.current = [];
  };
  const addTimer = (handler: () => void, ms: number) => {
    const id = window.setTimeout(handler, ms);
    timersRef.current.push(id);
    return id;
  };

  // Clean up any ongoing narration when leaving or unmounting
  useEffect(() => {
    return () => {
      clearAllTimers();
      voice.cancel("skip");
    };
  }, []);

  // Sky texture verification
  useEffect(() => {
    let ignore = false;
    const layers = [
      ["stars", "/welcome/stars.webp"],
      ["earth", "/welcome/earth-disc.webp"],
      ["moon", "/welcome/moon-disc.webp"],
    ] as const;
    for (const [key, url] of layers) {
      const image = new Image();
      image.onload = () => {
        if (!ignore && image.naturalWidth < 8) setSky((current) => ({ ...current, [key]: false }));
      };
      image.onerror = () => {
        if (!ignore) setSky((current) => ({ ...current, [key]: false }));
      };
      image.src = url;
    }
    return () => {
      ignore = true;
    };
  }, []);

  function toggleMissionBriefing() {
    voice.unlock();
    if (briefingOpen) {
      setBriefingOpen(false);
      setBriefingPlaying(false);
      voice.cancel("skip");
    } else {
      setBriefingOpen(true);
      setBriefingPlaying(true);
      void voice.speak("mission-briefing", MISSION_BRIEFING).then(() => {
        setBriefingPlaying(false);
      });
    }
  }

  function handleBeginExploration() {
    voice.cancel("skip");
    setBriefingOpen(false);
    setBriefingPlaying(false);
    setPhase("name");
  }

  function launchMission(chosenName?: string) {
    const trimmed = (chosenName ?? firstName).trim();
    const spokenGreeting = trimmed
      ? `Welcome aboard, ${trimmed}. Your lunar exploration is about to begin.`
      : "Welcome aboard. Your lunar exploration is about to begin.";

    if (trimmed) {
      sessionStorage.setItem(CALLSIGN_KEY, trimmed);
      setWelcomeGreeting(`Welcome aboard, ${trimmed}.`);
    } else {
      sessionStorage.removeItem(CALLSIGN_KEY);
      setWelcomeGreeting("Welcome aboard.");
    }

    // Stop previous voice, clear old tutorial flag, and reset mission state
    voice.cancel("skip");
    sessionStorage.removeItem("seven-servers-controls-heard");
    mission.resetMission();

    // Show the greeting phase prominently
    setPhase("greeting");

    // Speak the greeting if unmuted and speech is available
    voice.unlock();
    let spokenDone = false;
    const greetingStartTime = Date.now();
    const MIN_GREETING_VISIBLE_MS = 2200;

    const finish = () => {
      if (spokenDone) return;
      spokenDone = true;
      setPhase("leaving");
      addTimer(() => {
        router.push("/mission");
        if (mode === "replay") {
          // Keep overlay active until navigation starts, then teardown replay key
          addTimer(() => {
            onDone?.();
          }, 300);
        }
      }, 700);
    };

    // Stagger slightly so browser speech cancel doesn't swallow the new utterance
    addTimer(() => {
      void voice.speak("welcome-greeting", spokenGreeting).then(() => {
        // Ensure visitor sees the greeting for at least MIN_GREETING_VISIBLE_MS
        const elapsed = Date.now() - greetingStartTime;
        const remainingDelay = Math.max(800, MIN_GREETING_VISIBLE_MS - elapsed);
        addTimer(finish, remainingDelay);
      });
    }, 80);

    // Fallback safety timer (8.5s) in case speech synthesis fails or hangs
    addTimer(finish, 8500);
  }

  function onSubmitName(event: FormEvent) {
    event.preventDefault();
    launchMission(firstName);
  }

  const shell = (
    <div
      className={`relative h-full w-full overflow-hidden transition-opacity duration-700 select-none ${
        phase === "leaving" ? "opacity-0" : "opacity-100"
      }`}
    >
      {sky.stars && <div className="welcome-stars" aria-hidden="true" />}
      {sky.earth && (
        <img
          className="welcome-earth"
          src="/welcome/earth-disc.webp"
          alt="Earth, eastern hemisphere"
          onError={() => setSky((current) => ({ ...current, earth: false }))}
        />
      )}
      {sky.moon && (
        <img
          className="welcome-moon"
          src="/welcome/moon-disc.webp"
          alt="The Moon"
          onError={() => setSky((current) => ({ ...current, moon: false }))}
        />
      )}
      <div className="welcome-vignette" aria-hidden="true" />

      <div className="relative z-10 flex h-full flex-col justify-between">
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 px-4">
          {/* Phase 1: Welcome Screen */}
          {phase === "welcome" && (
            <div className="welcome-panel max-w-xl text-center space-y-4">
              <p className="text-xs uppercase tracking-[0.24em] text-[var(--gold)]">
                Seven Servers — Lunar First Light
              </p>
              <h1 className="text-3xl sm:text-4xl font-light text-white tracking-wide">
                Your Lunar Exploration Begins Here
              </h1>
              <p className="text-xs text-[var(--muted)] max-w-md mx-auto leading-relaxed">
                Explore candidate landing sites, 169 hours of SPICE solar geometry, and clean microgrid resilience at the lunar south pole.
              </p>

              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  type="button"
                  className="rounded bg-[var(--gold)] px-6 py-2.5 text-sm font-semibold text-black shadow-lg hover:bg-[var(--gold)]/90 transition-all hover:scale-[1.02]"
                  onClick={handleBeginExploration}
                >
                  Begin Exploration
                </button>

                <button
                  type="button"
                  className={`flex items-center gap-2 rounded border px-4 py-2.5 text-xs transition-colors ${
                    briefingOpen
                      ? "border-[var(--gold)] bg-[var(--gold)]/10 text-[var(--gold)]"
                      : "border-[var(--line)] bg-black/60 text-[var(--muted)] hover:text-white hover:border-[var(--muted)]"
                  }`}
                  onClick={toggleMissionBriefing}
                  title="Hear spoken mission briefing"
                >
                  <svg className="h-4 w-4 fill-current shrink-0" viewBox="0 0 24 24">
                    {briefingPlaying ? (
                      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                    ) : (
                      <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                    )}
                  </svg>
                  <span>{briefingPlaying ? "Pause Briefing" : briefingOpen ? "Close Briefing" : "Hear Mission Briefing"}</span>
                </button>
              </div>

              {briefingOpen && (
                <div className="mt-3 rounded border border-[var(--gold)]/30 bg-black/80 p-3 max-w-lg mx-auto text-left relative">
                  <div className="flex items-center justify-between pb-1.5 border-b border-[var(--gold)]/20 mb-2">
                    <span className="text-[10px] uppercase tracking-wider text-[var(--gold)] font-mono">Mission Briefing</span>
                    <button
                      type="button"
                      onClick={() => {
                        setBriefingOpen(false);
                        setBriefingPlaying(false);
                        voice.cancel("skip");
                      }}
                      className="text-xs text-[var(--muted)] hover:text-white transition-colors"
                      title="Close briefing"
                    >
                      ✕
                    </button>
                  </div>
                  <p className="text-xs text-[var(--foreground)] leading-relaxed italic">
                    "{MISSION_BRIEFING}"
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Phase 2: Personalized Entry */}
          {phase === "name" && (
            <div className="welcome-panel max-w-md w-full text-center space-y-4">
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--gold)]">Visitor Check-In</p>
              <h2 className="text-2xl font-light text-white">What should we call you?</h2>

              <form onSubmit={onSubmitName} className="space-y-4 pt-1">
                <div>
                  <input
                    type="text"
                    autoFocus
                    placeholder="First name"
                    value={firstName}
                    maxLength={32}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full rounded border border-[var(--line)] bg-black/80 px-4 py-2.5 text-center text-sm text-white placeholder-[var(--muted)] focus:border-[var(--gold)] focus:outline-none"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <button
                    type="submit"
                    className="w-full rounded bg-[var(--gold)] py-2.5 text-sm font-semibold text-black hover:bg-[var(--gold)]/90 transition-colors shadow-lg"
                  >
                    Launch Mission
                  </button>

                  <button
                    type="button"
                    onClick={() => launchMission("")}
                    className="text-xs text-[var(--muted)] hover:text-white transition-colors py-1"
                  >
                    Explore without a name
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Phase 3: Greeting Presentation */}
          {phase === "greeting" && (
            <div className="welcome-panel max-w-md w-full text-center space-y-3 py-6 animate-fadeIn">
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--gold)]">Visitor Initialized</p>
              <h2 className="text-3xl font-light text-white">{welcomeGreeting}</h2>
              <p className="text-sm text-[var(--muted)]">Your lunar exploration is about to begin.</p>
            </div>
          )}

          {/* Phase 4: Transition Confirmation */}
          {phase === "leaving" && (
            <div className="welcome-panel max-w-md w-full text-center space-y-3 py-6 animate-pulse">
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--gold)]">Entering Mission</p>
              <h2 className="text-3xl font-light text-white">{welcomeGreeting}</h2>
              <p className="text-sm text-[var(--muted)]">Initializing Chapter 1: Arrive…</p>
            </div>
          )}
        </div>

        <p className="welcome-credit text-center pb-3 text-[10px] text-[var(--muted)]">
          Earth: NASA, Reto Stöckli, NASA and NOAA. Moon: NASA SVS 4720. Stars: NASA/GSFC SVS 4851 and ESA/Gaia/DPAC. Decorative sky presentation.
        </p>
      </div>
    </div>
  );

  if (mode === "replay") {
    return <div className="fixed inset-0 z-50 bg-[#05070c]">{shell}</div>;
  }
  return shell;
}
