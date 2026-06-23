"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/cn";

export function Checkbox({
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
      role="checkbox"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={(e) => {
        e.stopPropagation();
        onChange(!checked);
      }}
      className={cn(
        "grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full border-[1.5px] transition active:scale-90",
        checked
          ? "border-tint bg-tint text-white"
          : "border-separator-opaque text-transparent",
        className,
      )}
    >
      <Check size={13} strokeWidth={3.5} />
    </button>
  );
}
