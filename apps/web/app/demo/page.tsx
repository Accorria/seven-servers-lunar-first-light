"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useMission } from "@/lib/mission-state";

export default function DemoPage() {
  const mission = useMission();
  const router = useRouter();
  const once = useRef(false);

  useEffect(() => {
    if (once.current) return;
    once.current = true;
    mission.startTour();
    router.replace("/mission?tour=1");
  }, [mission, router]);

  return null;
}
