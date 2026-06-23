"use client";

import { cn } from "@/lib/cn";

export function Toggle({
  checked,
  onChange,
  className,
  "aria-label": ariaLabel,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors duration-200",
        checked ? "bg-tint" : "bg-[rgba(120,120,128,0.32)]",
        className,
      )}
    >
      <span
        className={cn(
          "absolute left-[2px] top-[2px] h-[27px] w-[27px] rounded-full bg-white shadow-[0_2px_4px_rgba(0,0,0,0.2)] transition-transform duration-200",
          checked && "translate-x-[20px]",
        )}
      />
    </button>
  );
}
