"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useWelcome } from "@/components/welcome/WelcomeProvider";
import { useMission } from "@/lib/mission-state";
import { useVoice } from "@/lib/voice";

const LINKS = [
  ["Mission", "/mission"],
  ["Analysis", "/analysis"],
  ["Systems & Research", "/systems"],
  ["Report", "/report"],
];

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const voice = useVoice();
  const welcome = useWelcome();
  const mission = useMission();
  const [chrome, setChrome] = useState(true);
  const [navUnlocked, setNavUnlocked] = useState(true);
  const stage = path === "/mission" || path === "/demo";
  const door = path === "/";

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("chrome") === "0") setChrome(false);
  }, []);

  // Check progressive navigation lock status
  useEffect(() => {
    // If visitor has completed tutorial/tour or visited other pages, unlocked
    const tutorialHeard = typeof window !== "undefined" && Boolean(sessionStorage.getItem("seven-servers-controls-heard"));
    // If tour has run or is past arrive, consider unlocked
    if (tutorialHeard || mission.chapter !== "arrive" || path !== "/mission") {
      setNavUnlocked(true);
    } else {
      setNavUnlocked(false);
    }
  }, [mission.chapter, mission.tourStarted, path]);

  if (!chrome) return <div className={stage || door ? "h-dvh overflow-hidden" : undefined}>{children}</div>;

  if (door) return <div className="h-dvh overflow-hidden">{children}</div>;

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <header className="relative shrink-0 border-b border-[var(--line)] bg-black/60 backdrop-blur-md z-30">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2 sm:py-3">
          <div className="flex items-center gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--gold)]">Seven Servers</p>
              <Link href="/mission" className="text-base sm:text-lg font-medium hover:text-[var(--gold)] transition-colors">
                Lunar First Light
              </Link>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 text-xs sm:text-sm">
            <button
              type="button"
              className="rounded border border-[var(--line)] px-2 py-1 text-xs text-[var(--text)] hover:text-white"
              onClick={() => voice.setMuted(!voice.muted)}
            >
              {voice.muted ? "Unmute" : "Mute"}
            </button>
            <button
              type="button"
              className="hidden rounded border border-[var(--line)] px-2 py-1 text-xs text-[var(--text)] hover:text-white sm:inline-block"
              onClick={() => voice.setCaptions(!voice.captions)}
            >
              {voice.captions ? "Captions on" : "Captions off"}
            </button>
            <button
              type="button"
              className="rounded border border-[var(--line)] px-2 py-1 text-xs text-[var(--text)] hover:border-[var(--gold)] hover:text-[var(--gold)] transition-colors"
              onClick={() => {
                voice.cancel("skip");
                sessionStorage.removeItem("seven-servers-controls-heard");
                sessionStorage.removeItem("seven-servers-callsign");
                mission.resetMission();
                welcome.replay();
              }}
            >
              Replay introduction
            </button>

            <nav className="flex flex-wrap items-center gap-1.5 sm:gap-2 pl-2 border-l border-[var(--line)] text-xs sm:text-sm">
              {LINKS.filter(([label, href]) => navUnlocked || href === "/mission").map(([label, href]) => {
                const active = path === href || (href === "/systems" && (path === "/infrastructure" || path === "/earth-quantum"));
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => {
                      if (href === "/mission") {
                        mission.resetMission();
                      }
                      voice.cancel("skip");
                    }}
                    className="rounded border px-2 py-1 transition-colors text-xs sm:text-sm"
                    style={{ borderColor: active ? "#d7b57a" : "#2a384c", color: active ? "#d7b57a" : "#c5d0de" }}
                  >
                    {label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
        {voice.captions && voice.active && (
          <div className="absolute left-0 right-0 top-full z-50 pointer-events-none bg-black/95 px-4 py-1 text-right border-b border-[var(--line)]/50 shadow-lg backdrop-blur-md">
            <p className="mx-auto max-w-6xl text-[11px] text-[var(--gold)] font-mono">{voice.active.text}</p>
          </div>
        )}
      </header>
      <main className={stage ? "min-h-0 flex-1 overflow-hidden" : "mx-auto min-h-0 w-full max-w-6xl flex-1 overflow-auto px-4 py-6"}>{children}</main>
      <footer className="shrink-0 border-t border-[var(--line)] px-4 py-3 text-center text-xs text-[var(--muted)]">
        Seven Servers research tool. Not a NASA operational system. Seven Servers credentials are not NASA credentials.
      </footer>
    </div>
  );
}
