export const GUEST_WELCOME = "Welcome to Seven Servers Lunar First Light. Your lunar exploration experience is ready.";

export function welcomeLine(displayName: string | null | undefined) {
  const name = displayName?.trim();
  if (!name) return GUEST_WELCOME;
  return `Welcome to Seven Servers Lunar First Light, ${name}. Your lunar exploration experience is ready.`;
}

export function clearanceLine(callsign: string) {
  return `Welcome, ${callsign}. This is a Seven Servers simulation, not a NASA authorization.`;
}

export const TUTORIAL_STEPS = [
  {
    step: 1,
    title: "Drag to Rotate",
    text: "Drag the Moon to explore the lunar surface.",
    icon: "drag",
  },
  {
    step: 2,
    title: "Zoom Terrain",
    text: "Scroll or pinch to move closer or farther away.",
    icon: "zoom",
  },
  {
    step: 3,
    title: "Access Controls",
    text: "Open Access Controls to examine lunar measurements and scientific evidence.",
    icon: "controls",
  },
  {
    step: 4,
    title: "Guided Tour",
    text: "Start the seven-chapter guided tour to explore the Moon with narration.",
    icon: "tour",
  },
] as const;

export const CONTROLS_INTRO =
  "Drag the Moon to explore the lunar surface. Scroll or pinch to zoom. Start the tour for narrated exploration, or open Access Controls to examine measurements.";

export const explanations = {
  connectingRidge: {
    id: "connecting-ridge",
    label: "Hear Connecting Ridge",
    text: "Connecting Ridge is the Shackleton–de Gerlache Connecting Ridge. This published site is the highest valid pixel in PGDA Site01, and the close view is the 5 meter patch on that ridge.",
  },
  sunCenterClear: {
    id: "sun-center-clear",
    label: "Hear Sun center-clear",
    text: "Sun center-clear means the center of the Sun is above the terrain horizon at that azimuth. It is geometric sunlight at a 2 meter mast. It is not electrical power.",
  },
  earthVisibility: {
    id: "earth-visibility",
    label: "Hear Earth visibility",
    text: "Earth visibility here is line of sight to Earth’s center above the local terrain horizon. It is not a radio link.",
  },
  timeline: {
    id: "timeline-169",
    label: "Hear the 169-hour timeline",
    text: "The timeline is 169 hourly samples from 1 November 2026 through 8 November 2026. Each step is one hour. The report preview is a shorter table and does not drive this clock.",
  },
  sixNode: {
    id: "six-node",
    label: "Hear the six-node proposal",
    text: "Preston Jordan Jr. proposed six nodes in a star layout at an assumed 1 kilometer radius. It is a proposal, not a surveyed power run. The lines are not a power flow.",
  },
  quantum: {
    id: "quantum",
    label: "Hear the quantum experiment",
    text: "The quantum panel is a Microsoft QDK simulator comparison against a classical search of 64 configurations. The recorded result claims no quantum advantage, and no hardware job was submitted.",
  },
} as const;
