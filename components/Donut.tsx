"use client";

import type { CategoryAgg } from "@/lib/calc";

export function Donut({
  segments,
  size = 72,
  stroke = 11,
}: {
  segments: CategoryAgg[];
  size?: number;
  stroke?: number;
}) {
  const visible = segments.filter((s) => s.weightG > 0);
  const total = visible.reduce((sum, s) => sum + s.weightG, 0) || 1;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="shrink-0"
    >
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--fill)"
          strokeWidth={stroke}
        />
        {visible.map((s, i) => {
          const len = (s.weightG / total) * c;
          const el = (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={stroke}
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={-offset}
              strokeLinecap="butt"
            />
          );
          offset += len;
          return el;
        })}
      </g>
    </svg>
  );
}
