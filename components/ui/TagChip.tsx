"use client";

import { cn } from "@/lib/cn";

/**
 * White Liquid Glass tag, matching the top bar: the selected tag carries the
 * same gray inset platter as the Gear | Trip segment instead of a fill colour.
 */
export function TagChip({
  active = false,
  onClick,
  children,
  className,
  "aria-label": ariaLabel,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      aria-pressed={active}
      className={cn(
        "glass glass-tag h-8 shrink-0 whitespace-nowrap rounded-full px-3.5 text-[14px] text-label transition-transform active:scale-95",
        active ? "font-semibold" : "font-medium",
        className,
      )}
    >
      {active && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-[3px] -z-10 rounded-full bg-black/[0.075] dark:bg-white/[0.14]"
        />
      )}
      {children}
    </button>
  );
}
