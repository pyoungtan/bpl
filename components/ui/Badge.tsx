"use client";

import { cn } from "@/lib/cn";

const tones = {
  neutral: "bg-fill text-secondary",
  orange: "bg-[color-mix(in_srgb,var(--orange)_22%,transparent)] text-orange-strong",
  blue: "bg-tint-soft text-tint",
  green: "bg-[color-mix(in_srgb,var(--green)_18%,transparent)] text-green",
};

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: keyof typeof tones;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center whitespace-nowrap rounded-[6px] px-1.5 py-0.5 text-[11px] font-semibold leading-none",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
