export const PUBLISHED_WEEK_NOTE = "Showing the published week of 1–8 November 2026. Live recalculation is off.";

export function scienceViewLabel(view: "published" | "calculating" | "live" | "unavailable") {
  if (view === "calculating") return "Calculating";
  if (view === "live") return "Live result";
  return "Published week";
}
