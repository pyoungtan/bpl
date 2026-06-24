"use client";

import { useRef } from "react";
import { ChevronDown, Eye, EyeOff, SquarePen } from "lucide-react";
import type { GearItem, WeightUnit } from "@/lib/types";
import { formatWeight } from "@/lib/units";
import { cn } from "@/lib/cn";
import { Badge } from "../ui/Badge";
import { SwipeRow, SwipeDeleteButton } from "../ui/SwipeRow";

export interface SwipeActions {
  onEdit: () => void;
  onDelete: () => void;
  onToggleHidden: () => void;
  hidden: boolean;
}

export interface GearRowProps {
  gear: GearItem;
  unit: WeightUnit;
  selected?: boolean;
  onTap: () => void;
  hasAddOns?: boolean;
  expanded?: boolean;
  onToggleExpand?: () => void;
  editMode?: boolean;
  dragHandle?: React.ReactNode;
  topHairline?: boolean;
  dimmed?: boolean;
  onNotePeek?: (rect: DOMRect) => void;
  onNotePeekEnd?: () => void;
  swipeActions?: SwipeActions;
  swipeOpenId?: string | null;
  onSwipeOpenChange?: (id: string | null) => void;
}

const LONG_PRESS_MS = 420;

export function GearRow({
  gear,
  unit,
  selected,
  onTap,
  hasAddOns,
  expanded,
  onToggleExpand,
  editMode,
  dragHandle,
  topHairline,
  dimmed,
  onNotePeek,
  onNotePeekEnd,
  swipeActions,
  swipeOpenId,
  onSwipeOpenChange,
}: GearRowProps) {
  const sub = [gear.minorCategory, gear.brand].filter(Boolean).join(" · ");
  const timer = useRef<number | undefined>(undefined);
  const longPressed = useRef(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const hasSwipe = Boolean(swipeActions) && !editMode;

  function clearLongPress() {
    if (timer.current !== undefined) {
      clearTimeout(timer.current);
      timer.current = undefined;
    }
  }
  function pressStart(e: React.PointerEvent) {
    if (editMode || !onNotePeek) return;
    start.current = { x: e.clientX, y: e.clientY };
    longPressed.current = false;
    timer.current = window.setTimeout(() => {
      longPressed.current = true;
      if (btnRef.current) onNotePeek(btnRef.current.getBoundingClientRect());
    }, LONG_PRESS_MS);
  }
  function pressMove(e: React.PointerEvent) {
    if (!start.current) return;
    if (Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 8) {
      clearLongPress();
    }
  }
  function pressEnd() {
    clearLongPress();
    if (longPressed.current) onNotePeekEnd?.();
  }
  function handleTap() {
    if (longPressed.current) {
      longPressed.current = false;
      return;
    }
    onTap();
  }

  return (
    <SwipeRow
      id={gear.id}
      openId={swipeOpenId ?? null}
      onOpenChange={onSwipeOpenChange ?? (() => {})}
      swipeDisabled={!hasSwipe}
      rightWidth={112}
      leftWidth={56}
      topHairline={topHairline}
      selected={Boolean(selected) && !editMode}
      renderRight={
        swipeActions
          ? (close, rowOpen) => (
              <>
                <button
                  type="button"
                  aria-label="수정"
                  onClick={() => {
                    swipeActions.onEdit();
                    close();
                  }}
                  className="grid w-14 touch-manipulation place-items-center bg-tint text-white active:opacity-80"
                >
                  <SquarePen size={19} />
                </button>
                <SwipeDeleteButton rowOpen={rowOpen} onDelete={swipeActions.onDelete} />
              </>
            )
          : undefined
      }
      renderLeft={
        swipeActions
          ? (close) => (
              <button
                type="button"
                aria-label={swipeActions.hidden ? "숨김 해제" : "숨기기"}
                onClick={() => {
                  swipeActions.onToggleHidden();
                  close();
                }}
                className={cn(
                  "grid w-14 touch-manipulation place-items-center text-white active:opacity-80",
                  swipeActions.hidden ? "bg-tint" : "bg-[#9b958a]",
                )}
              >
                {swipeActions.hidden ? <Eye size={20} /> : <EyeOff size={20} />}
              </button>
            )
          : undefined
      }
    >
      <div
        className={cn(
          "flex items-center gap-2.5 px-4 py-2.5",
          dimmed && "opacity-45",
        )}
      >
        {editMode && dragHandle}
        <button
          ref={btnRef}
          type="button"
          onClick={handleTap}
          onPointerDown={pressStart}
          onPointerMove={pressMove}
          onPointerUp={pressEnd}
          onPointerLeave={pressEnd}
          onContextMenu={(e) => e.preventDefault()}
          className="flex min-w-0 flex-1 touch-manipulation select-none items-center text-left active:opacity-60"
        >
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-1.5">
              <span className="min-w-0 truncate text-[15px] font-semibold leading-tight text-label">
                {gear.name}
              </span>
              {gear.worn && <Badge>착용</Badge>}
              {gear.consumable && <Badge tone="orange">소모</Badge>}
            </div>
            <div className="mt-0.5 truncate text-[12.5px] leading-tight text-secondary">
              {sub || gear.majorCategory}
            </div>
          </div>
        </button>

        <span className="shrink-0 tabular text-[14px] text-secondary">
          {formatWeight(gear.weightG, unit)}
          {gear.quantity > 1 && (
            <span className="text-tertiary"> ×{gear.quantity}</span>
          )}
        </span>

        <div className="flex w-6 shrink-0 justify-end">
          {hasAddOns && !editMode && (
            <button
              type="button"
              onClick={onToggleExpand}
              aria-label="애드온 펼치기"
              className="-mr-1.5 grid h-7 w-7 touch-manipulation place-items-center rounded-full text-tint active:bg-fill"
            >
              <ChevronDown
                size={18}
                className={cn("transition-transform", expanded && "rotate-180")}
              />
            </button>
          )}
        </div>
      </div>
    </SwipeRow>
  );
}
