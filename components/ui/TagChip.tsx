"use client";

import { cn } from "@/lib/cn";

/** Flat filter chip: a soft grey fill, solid ink when selected — no glass,
 *  no outline, so it sits quietly under the bare top bar. */
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
        "h-8 shrink-0 touch-manipulation whitespace-nowrap rounded-full px-3.5 text-[13.5px] font-semibold tracking-[-0.01em] transition-[background-color,color,transform] duration-200 active:scale-95",
        active ? "bg-label text-bg" : "bg-fill text-label",
        className,
      )}
    >
      {children}
    </button>
  );
}
