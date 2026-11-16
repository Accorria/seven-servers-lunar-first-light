"use client";

import { Shell } from "@/components/Shell";
import { WelcomeProvider } from "@/components/welcome/WelcomeProvider";
import { AuthProvider } from "@/lib/auth";
import { MissionProvider } from "@/lib/mission-state";
import { VoiceProvider } from "@/lib/voice";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <VoiceProvider>
        <MissionProvider>
          <WelcomeProvider>
            <Shell>{children}</Shell>
          </WelcomeProvider>
        </MissionProvider>
      </VoiceProvider>
    </AuthProvider>
  );
}
