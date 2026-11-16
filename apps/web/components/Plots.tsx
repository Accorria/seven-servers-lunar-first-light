"use client";

export function HorizonPlot({
  values,
  label,
  markerAzimuth,
  markerElevation,
}: {
  values: number[];
  label: string;
  markerAzimuth?: number;
  markerElevation?: number;
}) {
  const size = 320;
  const center = size / 2;
  const radius = 120;
  const points = values.map((elevation, index) => {
    const azimuth = ((index + 0.5) / values.length) * Math.PI * 2 - Math.PI / 2;
    const scaled = Math.max(8, Math.min(radius, radius * (0.55 + elevation / 20)));
    return [center + Math.cos(azimuth) * scaled, center + Math.sin(azimuth) * scaled];
  });
  const path = points.map((point, index) => `${index === 0 ? "M" : "L"}${point[0]},${point[1]}`).join(" ") + " Z";
  return (
    <figure className="rounded border border-[var(--line)] bg-black/30 p-3">
      <figcaption className="mb-2 text-sm text-[var(--gold)]">{label}</figcaption>
      <svg viewBox={`0 0 ${size} ${size}`} className="w-full">
        <circle cx={center} cy={center} r={radius} fill="none" stroke="#2a384c" />
        <path d={path} fill="rgba(143,216,223,0.18)" stroke="#8fd8df" strokeWidth="1.5" />
        <text x={center} y="28" textAnchor="middle" fill="#93a4ba" fontSize="12">N</text>
        {markerAzimuth !== undefined && markerElevation !== undefined && (
          <circle
            cx={center + Math.cos((markerAzimuth * Math.PI) / 180 - Math.PI / 2) * Math.max(8, Math.min(radius, radius * (0.55 + markerElevation / 20)))}
            cy={center + Math.sin((markerAzimuth * Math.PI) / 180 - Math.PI / 2) * Math.max(8, Math.min(radius, radius * (0.55 + markerElevation / 20)))}
            r={4}
            fill="#d7b57a"
          />
        )}
      </svg>
      <p className="text-xs text-[var(--muted)]">Radius shows terrain elevation angle by azimuth. North is up.</p>
    </figure>
  );
}

export function Timeline({
  rows,
  index,
  note = "Gold: Sun center clear. Cyan: Earth center clear.",
}: {
  rows: Array<Record<string, number | string | boolean>>;
  index?: number;
  note?: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex h-6 overflow-hidden rounded border border-[var(--line)]">
        {rows.map((row, rowIndex) => (
          <div
            key={rowIndex}
            title={String(row.utc)}
            className={row.sun_center_clear ? "flex-1 bg-[var(--gold)]" : "flex-1 bg-black"}
            style={rowIndex === index ? { outline: "1px solid white" } : undefined}
          />
        ))}
      </div>
      <div className="flex h-6 overflow-hidden rounded border border-[var(--line)]">
        {rows.map((row, rowIndex) => (
          <div
            key={rowIndex}
            title={String(row.utc)}
            className={row.earth_center_clear ? "flex-1 bg-[var(--cyan)]" : "flex-1 bg-black"}
            style={rowIndex === index ? { outline: "1px solid white" } : undefined}
          />
        ))}
      </div>
      <p className="text-xs text-[var(--muted)]">{note}</p>
    </div>
  );
}
