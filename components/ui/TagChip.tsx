"use client";

import { cn } from "@/lib/cn";

/** White Liquid Glass tag like the top bar; the selected one is black ink glass. */
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
        "h-8 shrink-0 whitespace-nowrap rounded-full px-3.5 text-[14px] transition-transform active:scale-95",
        active ? "btn-ink font-semibold" : "glass glass-tag font-medium text-label",
        className,
      )}
    >
      {children}
    </button>
  );
}
