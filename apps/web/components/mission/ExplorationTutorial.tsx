"use client";

import { useEffect, useRef, useState } from "react";
import { TUTORIAL_STEPS } from "@/content/narration";
import { useVoice } from "@/lib/voice";

export const TUTORIAL_KEY = "seven-servers-controls-heard";

export function ExplorationTutorial({
  onDismiss,
  onOpenControls,
  onStartTour,
}: {
  onDismiss: () => void;
  onOpenControls?: () => void;
  onStartTour?: () => void;
}) {
  const [currentStep, setCurrentStep] = useState(0);
  const voice = useVoice();
  const voiceRef = useRef(voice);
  voiceRef.current = voice;

  const step = TUTORIAL_STEPS[currentStep];
  const isFirstMount = useRef(true);

  // Speak each step concisely when entering step; re-triggers on step change
  useEffect(() => {
    if (!step) return;
    const v = voiceRef.current;
    v.unlock();

    // On initial mount, allow any trailing welcome speech to conclude naturally without cutting it off
    const delay = isFirstMount.current ? 400 : 50;
    if (!isFirstMount.current) {
      v.cancel("skip");
    }
    isFirstMount.current = false;

    const timer = window.setTimeout(() => {
      // If voice is currently speaking a welcome greeting, don't clobber it; wait for idle
      if (v.isActive() && v.active?.id === "welcome-greeting") {
        v.onceIdle(() => {
          void voiceRef.current.speak(`tutorial-step-${step.step}`, step.text);
        });
      } else {
        void v.speak(`tutorial-step-${step.step}`, step.text);
      }
    }, delay);
    return () => window.clearTimeout(timer);
  }, [currentStep, step]);

  // Clean up tutorial audio when unmounting
  useEffect(() => {
    return () => {
      voiceRef.current.cancel("skip");
    };
  }, []);

  const handleNext = () => {
    voice.cancel("skip");
    if (currentStep < TUTORIAL_STEPS.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      handleStartTourNow();
    }
  };

  const handleBack = () => {
    voice.cancel("skip");
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleSkip = () => {
    sessionStorage.setItem(TUTORIAL_KEY, "1");
    voice.cancel("skip");
    onDismiss();
  };

  const handleStartTourNow = () => {
    sessionStorage.setItem(TUTORIAL_KEY, "1");
    voice.cancel("skip");
    onDismiss();
    onStartTour?.();
  };

  const handleOpenControlsNow = () => {
    onOpenControls?.();
  };

  return (
    <div
      role="dialog"
      aria-label="Exploration tutorial"
      className="pointer-events-auto fixed bottom-24 left-1/2 z-40 w-[92%] max-w-sm -translate-x-1/2 rounded-xl border border-[var(--gold)]/60 bg-black/95 p-4 shadow-2xl backdrop-blur-md transition-all duration-300 md:bottom-28"
    >
      <div className="flex items-center justify-between border-b border-[var(--line)] pb-2">
        <div className="flex items-center gap-2">
          {step.icon === "drag" && (
            <svg className="h-4 w-4 text-[var(--gold)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
            </svg>
          )}
          {step.icon === "zoom" && (
            <svg className="h-4 w-4 text-[var(--gold)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
              <line x1="11" y1="8" x2="11" y2="14" />
              <line x1="8" y1="11" x2="14" y2="11" />
            </svg>
          )}
          {step.icon === "controls" && (
            <svg className="h-4 w-4 text-[var(--gold)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <line x1="9" y1="3" x2="9" y2="21" />
            </svg>
          )}
          {step.icon === "tour" && (
            <svg className="h-4 w-4 text-[var(--gold)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          )}
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--gold)]">
            Step {step.step} of 4 — {step.title}
          </span>
        </div>
        <button
          type="button"
          onClick={handleSkip}
          className="text-xs text-[var(--muted)] hover:text-white transition-colors px-1 py-0.5"
          title="Skip tutorial and keep controls accessible"
        >
          Skip
        </button>
      </div>

      <p className="mt-3 text-sm text-[var(--foreground)] leading-relaxed">
        {step.text}
      </p>

      {/* Action buttons embedded for Step 3 & Step 4 */}
      {step.step === 3 && (
        <div className="mt-3">
          <button
            type="button"
            onClick={handleOpenControlsNow}
            className="flex items-center gap-1.5 rounded border border-[var(--gold)] bg-[var(--gold)]/10 px-3 py-1.5 text-xs font-semibold text-[var(--gold)] hover:bg-[var(--gold)]/20 transition-colors shadow-sm"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <line x1="9" y1="3" x2="9" y2="21" />
            </svg>
            <span>Open Access Controls</span>
          </button>
        </div>
      )}

      {step.step === 4 && (
        <div className="mt-3">
          <button
            type="button"
            onClick={handleStartTourNow}
            className="flex items-center gap-1.5 rounded bg-[var(--gold)] px-3.5 py-1.5 text-xs font-semibold text-black hover:bg-[var(--gold)]/90 transition-colors shadow-md"
          >
            <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            <span>Start Guided Tour</span>
          </button>
        </div>
      )}

      {/* Progress Dots & Navigation */}
      <div className="mt-4 flex items-center justify-between pt-2 border-t border-[var(--line)]">
        <div className="flex gap-1.5">
          {TUTORIAL_STEPS.map((s, idx) => (
            <div
              key={s.step}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                idx === currentStep
                  ? "w-5 bg-[var(--gold)]"
                  : idx < currentStep
                  ? "w-2 bg-[var(--gold)]/50"
                  : "w-2 bg-[var(--line)]"
              }`}
            />
          ))}
        </div>

        <div className="flex items-center gap-2">
          {currentStep > 0 && (
            <button
              type="button"
              onClick={handleBack}
              className="rounded border border-[var(--line)] px-2.5 py-1 text-xs text-[var(--muted)] hover:text-white transition-colors"
            >
              Back
            </button>
          )}
          {currentStep < TUTORIAL_STEPS.length - 1 ? (
            <button
              type="button"
              onClick={handleNext}
              className="rounded bg-[var(--gold)] px-3 py-1 text-xs font-semibold text-black hover:bg-[var(--gold)]/90 transition-colors shadow"
            >
              Next
            </button>
          ) : (
            <button
              type="button"
              onClick={handleStartTourNow}
              className="rounded bg-[var(--gold)] px-3 py-1 text-xs font-semibold text-black hover:bg-[var(--gold)]/90 transition-colors shadow"
            >
              Finish & Tour
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
