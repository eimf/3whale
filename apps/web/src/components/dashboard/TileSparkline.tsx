"use client";

/** Lightweight SVG sparkline for KPI tiles. Uses values for viz only; no financial logic. */
export function TileSparkline({ values }: { values: number[] }) {
  const height = 36;
  const width = 120;
  const padding = 2;

  const effective = values.length > 0 ? values : [0];
  const max = Math.max(...effective, 1);
  const min = Math.min(...effective, 0);
  const range = max - min || 1;
  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;

  const points = effective
    .map((v, i) => {
      const x = padding + (i / (effective.length - 1 || 1)) * innerWidth;
      const y = padding + innerHeight - ((v - min) / range) * innerHeight;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg
      width={width}
      height={height}
      className="overflow-visible"
      aria-hidden
    >
      <polyline
        fill="none"
        stroke="rgba(52, 211, 153, 0.8)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}
