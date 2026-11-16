export type ChapterId = "arrive" | "turn" | "pole" | "ridge" | "horizon" | "mouton" | "network";

export type Chapter = {
  id: ChapterId;
  label: string;
  kicker: string;
  title: string;
  body: string;
  narration: string;
  goal: "globe" | "turn" | "pole" | "site_a" | "horizon" | "site_b" | "network" | "wide";
  showStar?: boolean;
  plain?: string;
};

export const CHAPTERS: Chapter[] = [
  {
    id: "arrive",
    label: "Arrive",
    kicker: "Orbit",
    title: "A NASA Moon, seen from orbit",
    body: "This is the arrival view: the colored globe from far away, before the measured ground comes in.",
    narration: "This is the arrival view: the colored globe from far away, before the measured ground comes in.",
    goal: "globe",
  },
  {
    id: "turn",
    label: "Turn",
    kicker: "Reorient",
    title: "Swing toward the south pole",
    body: "The view tilts from open orbit down toward the polar limb.",
    narration: "The view tilts from open orbit down toward the polar limb.",
    goal: "turn",
  },
  {
    id: "pole",
    label: "South pole",
    kicker: "Ground",
    title: "The south-pole ground",
    body: "This is the measured terrain south of 75° south, seen from above the pole.",
    narration: "This is the measured terrain south of 75° south, seen from above the pole.",
    goal: "wide",
  },
  {
    id: "ridge",
    label: "Ridge",
    kicker: "Site A",
    title: "The Connecting Ridge landing patch",
    body: "The close view is the 5 m patch on the ridge, where the published site sits.",
    narration: "The close view is the 5 m patch on the ridge, where the published site sits. This published site is the highest valid pixel in PGDA Site01.",
    goal: "site_a",
  },
  {
    id: "horizon",
    label: "Horizon",
    kicker: "Skyline",
    title: "Skyline and the week of light",
    body: "The camera sits low so the ridge skyline shows, and the hour moves sunlight around that horizon.",
    narration: "The camera sits low so the ridge skyline shows, and the hour moves sunlight around that horizon. The timeline is 169 hourly samples from 1 November 2026 through 8 November 2026.",
    goal: "horizon",
    plain: "Measured terrain. Gold is the Sun this hour. Cyan is Earth.",
  },
  {
    id: "mouton",
    label: "Mouton",
    kicker: "Site B",
    title: "Mons Mouton in this week’s night",
    body: "The massif is in view. For this published week the Sun stays below the local horizon.",
    narration: "The massif is in view. For this published week the Sun stays below the local horizon.",
    goal: "site_b",
  },
  {
    id: "network",
    label: "Network",
    kicker: "Proposed",
    title: "The proposed star on this site",
    body: "Six nodes sit on the selected site in a 1 km layout. The lines are a proposal, not a surveyed power run.",
    narration: "Six nodes sit on the selected site in a 1 km layout. The lines are a proposal, not a surveyed power run. Preston Jordan Jr. proposed this layout at an assumed 1 kilometer radius.",
    goal: "network",
    showStar: true,
    plain: "Proposed 1 km layout. These marks are not hardware.",
  },
];

export const PROPOSAL_NOTE = "Six marks are Preston Jordan Jr.’s proposal, about 1 km from the center. Nothing here is built.";
