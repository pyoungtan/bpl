"use client";

import { cn } from "@/lib/cn";

export interface BarSegment {
  id: string;
  weightG: number;
  color: string;
}

export function WeightBar({
  segments,
  className,
  height = 10,
}: {
  segments: BarSegment[];
  className?: string;
  height?: number;
}) {
  const visible = segments.filter((s) => s.weightG > 0);
  const total = visible.reduce((sum, s) => sum + s.weightG, 0) || 1;
  return (
    <div
      className={cn("flex w-full overflow-hidden rounded-full bg-fill", className)}
      style={{ height }}
    >
      {visible.map((s, i) => (
        <div
          key={s.id}
          className="h-full"
          style={{
            width: `${(s.weightG / total) * 100}%`,
            backgroundColor: s.color,
            boxShadow:
              i < visible.length - 1 ? "inset -1.5px 0 0 var(--card)" : undefined,
          }}
        />
      ))}
    </div>
  );
}
