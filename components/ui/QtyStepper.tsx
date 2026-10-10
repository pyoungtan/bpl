"use client";

import { Minus, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Compact in-row quantity control for a selected item (cart-style): at 1 the
 * minus becomes a trash icon that removes the item from the selection.
 * Swallows its own pointer/click events so the row underneath doesn't toggle.
 */
export function QtyStepper({
  value,
  onChange,
  onRemove,
  className,
}: {
  value: number;
  onChange: (n: number) => void;
  onRemove: () => void;
  className?: string;
}) {
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();
  return (
    <div
      className={cn(
        "flex h-8 shrink-0 items-center rounded-full bg-bg shadow-[0_0_0_0.5px_rgba(0,0,0,0.08),0_1px_4px_rgba(0,0,0,0.08)] dark:bg-white/[0.14] dark:shadow-none",
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
        className="grid h-8 w-8 touch-manipulation place-items-center rounded-full text-label active:opacity-50"
      >
        {value <= 1 ? <Trash2 size={15} /> : <Minus size={16} strokeWidth={2.4} />}
      </button>
      <span className="min-w-5 text-center tabular text-[15px] font-semibold text-label">
        {value}
      </span>
      <button
        type="button"
        aria-label="수량 증가"
        onClick={() => onChange(value + 1)}
        className="grid h-8 w-8 touch-manipulation place-items-center rounded-full text-label active:opacity-50"
      >
        <Plus size={16} strokeWidth={2.4} />
      </button>
    </div>
  );
}
