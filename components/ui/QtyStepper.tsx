"use client";

import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Compact in-row quantity control for a selected item (cart-style): minus at
 * 1 removes the item from the selection.
 * Swallows its own pointer/click events so the row underneath doesn't toggle.
 */
export function QtyStepper({
  value,
  onChange,
  onRemove,
  size = "md",
  className,
}: {
  value: number;
  onChange: (n: number) => void;
  onRemove: () => void;
  /** "sm" fits the shorter add-on rows without growing them. */
  size?: "md" | "sm";
  className?: string;
}) {
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();
  const sm = size === "sm";
  const btn = cn(
    "grid touch-manipulation place-items-center rounded-full text-label active:opacity-50",
    sm ? "h-6 w-7" : "h-8 w-8",
  );
  return (
    <div
      className={cn(
        "flex shrink-0 items-center rounded-full bg-bg shadow-[0_0_0_0.5px_rgba(0,0,0,0.08),0_1px_4px_rgba(0,0,0,0.08)] dark:bg-white/[0.14] dark:shadow-none",
        sm ? "-my-0.5 h-6" : "h-8",
        className,
      )}
      onPointerDown={stop}
      onPointerUp={stop}
      onClick={stop}
    >
      <button
        type="button"
        aria-label={value <= 1 ? "선택 해제" : "수량 감소"}
        onClick={() => (value <= 1 ? onRemove() : onChange(value - 1))}
        className={btn}
      >
        <Minus size={sm ? 14 : 16} strokeWidth={2.4} />
      </button>
      <span
        className={cn(
          "min-w-5 text-center tabular font-semibold text-label",
          sm ? "text-[13px]" : "text-[15px]",
        )}
      >
        {value}
      </span>
      <button
        type="button"
        aria-label="수량 증가"
        onClick={() => onChange(value + 1)}
        className={btn}
      >
        <Plus size={sm ? 14 : 16} strokeWidth={2.4} />
      </button>
    </div>
  );
}
