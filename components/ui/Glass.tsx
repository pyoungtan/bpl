"use client";

import { cn } from "@/lib/cn";
import { usePressFx } from "../TopBar";

export { GlassCircle } from "../TopBar";

/**
 * Solid black (light) / white (dark) primary capsule — the iOS 26 "prominent"
 * button — with the same swell-and-stretch press physics as the glass controls.
 */
export function InkButton({
  onClick,
  children,
  className,
  "aria-label": ariaLabel,
  disabled,
  size = "md",
}: {
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
  "aria-label"?: string;
  disabled?: boolean;
  /** "lg": the screen's primary Add action. */
  size?: "md" | "lg";
}) {
  const { fxRef, handlers } = usePressFx<HTMLButtonElement>({
    scale: 1.06,
    onTap: onClick,
    disabled: () => Boolean(disabled),
  });
  return (
    <button
      ref={fxRef}
      type="button"
      aria-label={ariaLabel}
      disabled={disabled}
      className={cn(
        "btn-ink press-fx relative isolate flex touch-none items-center justify-center gap-2.5 rounded-full font-semibold disabled:opacity-40",
        size === "lg" ? "h-[54px] px-6 text-[18px]" : "h-[46px] px-5 text-[17px]",
        className,
      )}
      style={{ "--g-glow": "rgba(255,255,255,0.28)" } as React.CSSProperties}
      {...handlers}
      onClick={(e) => {
        if (e.detail === 0) onClick();
      }}
    >
      <span className="g-glow" />
      {children}
    </button>
  );
}

/** Liquid Glass capsule/icon button (secondary floating action). */
export function GlassButton({
  onClick,
  children,
  className,
  "aria-label": ariaLabel,
}: {
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
  "aria-label"?: string;
}) {
  const { fxRef, handlers } = usePressFx<HTMLButtonElement>({ scale: 1.12, onTap: onClick });
  return (
    <button
      ref={fxRef}
      type="button"
      aria-label={ariaLabel}
      className={cn(
        "glass press-fx flex h-[46px] touch-none items-center justify-center gap-2.5 rounded-full text-label",
        className,
      )}
      {...handlers}
      onClick={(e) => {
        if (e.detail === 0) onClick();
      }}
    >
      <span className="g-glow" />
      {children}
    </button>
  );
}
