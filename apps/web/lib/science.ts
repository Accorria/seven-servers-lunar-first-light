export type VisibilitySummary = {
  true_fraction: number;
  true_hours: number;
  longest_interior_interruption_hours: number;
  longest_window_bounded_interruption_hours: number;
};

export type SiteResult = {
  id: string;
  name: string;
  latitude_deg: number;
  longitude_deg: number;
  elevation_m: number;
  derivation: string;
  citation: string;
  dataset: string;
  dataset_sha256: string;
  frame: string;
  horizon_deg: number[];
  preview: Array<Record<string, number | string | boolean>>;
  sun_center_clear: VisibilitySummary;
  earth_center_clear: VisibilitySummary;
  any_sunlight: VisibilitySummary;
  any_earth_disk: VisibilitySummary;
};

export type Report = {
  record_hash: string;
  simulation_version: string;
  interval_utc: { start: string; stop: string };
  step_seconds: number;
  mast_height_m: number;
  method: string;
  publish_windows: boolean;
  ephemeris_consistency: Record<string, number | boolean>;
  datasets: Array<{ name: string; sha256: string; citation: string }>;
  results: SiteResult[];
  boundaries: string[];
};

export async function fetchScience<T>(livePath: string, snapshotPath: string): Promise<{ data: T; source: "live" | "published" }> {
  try {
    const response = await fetch(livePath, { cache: "no-store" });
    if (response.ok) return { data: await response.json(), source: "live" };
  } catch {
    // A failed live call stays on the published file. It is not labeled as a new run.
  }
  const snapshot = await fetch(snapshotPath);
  if (!snapshot.ok) throw new Error("Published results are unavailable");
  return { data: await snapshot.json(), source: "published" };
}

export function formatDegrees(value: number, places = 5) {
  return value.toFixed(places);
}
