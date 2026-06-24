"use client";

import { useEffect, useRef, useState } from "react";
import { animate, motion, useMotionValue } from "framer-motion";
import {
  Check,
  ChevronDown,
  Eye,
  EyeOff,
  SquarePen,
  Trash2,
} from "lucide-react";
import type { GearItem, WeightUnit } from "@/lib/types";
import { formatWeight } from "@/lib/units";
import { cn } from "@/lib/cn";
import { Badge } from "../ui/Badge";

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

const RIGHT_W = 112; // edit + delete
const LEFT_W = 56; // hide / unhide

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
  const dragging = useRef(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const x = useMotionValue(0);
  const [open, setOpen] = useState<"closed" | "right" | "left">("closed");
  const openRef = useRef<"closed" | "right" | "left">("closed");
  const [armedDelete, setArmedDelete] = useState(false);

  const swipeable = Boolean(swipeActions) && !editMode;
  const spring = { type: "spring" as const, stiffness: 520, damping: 44 };

  function setOpenState(next: "closed" | "right" | "left") {
    openRef.current = next;
    setOpen(next);
  }

  useEffect(() => {
    if (!swipeable) {
      x.set(0);
      setOpenState("closed");
      setArmedDelete(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [swipeable, x]);

  // Only one row open at a time: close when another row becomes the open one.
  useEffect(() => {
    if (swipeOpenId !== gear.id && openRef.current !== "closed") {
      animate(x, 0, spring);
      setOpenState("closed");
      setArmedDelete(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [swipeOpenId, gear.id, x]);

  function clearLongPress() {
    if (timer.current !== undefined) {
      clearTimeout(timer.current);
      timer.current = undefined;
    }
  }
  function pressStart() {
    if (editMode) return;
    longPressed.current = false;
    timer.current = window.setTimeout(() => {
      longPressed.current = true;
      if (btnRef.current) onNotePeek?.(btnRef.current.getBoundingClientRect());
    }, 420);
  }
  function pressEnd() {
    clearLongPress();
    if (longPressed.current) onNotePeekEnd?.();
  }

  function close(notify = true) {
    animate(x, 0, spring);
    setOpenState("closed");
    setArmedDelete(false);
    if (notify) onSwipeOpenChange?.(null);
  }
  function settleOpen(dir: "right" | "left") {
    animate(x, dir === "right" ? -RIGHT_W : LEFT_W, spring);
    setOpenState(dir);
    onSwipeOpenChange?.(gear.id);
  }

  function handleClick() {
    if (dragging.current) return;
    if (openRef.current !== "closed") {
      close();
      return;
    }
    if (longPressed.current) {
      longPressed.current = false;
      return;
    }
    onTap();
  }

  return (
    <div
      className={cn(
        "relative overflow-hidden",
        topHairline &&
          "before:pointer-events-none before:absolute before:left-4 before:right-0 before:top-0 before:z-20 before:h-px before:bg-separator",
      )}
    >
      {swipeable && (
        <>
          <div className="absolute inset-y-0 left-0 flex">
            <button
              type="button"
              aria-label={swipeActions!.hidden ? "숨김 해제" : "숨기기"}
              onClick={() => {
                swipeActions!.onToggleHidden();
                close();
              }}
              className={cn(
                "grid w-14 place-items-center text-white active:opacity-80",
                swipeActions!.hidden ? "bg-tint" : "bg-[#9b958a]",
              )}
            >
              {swipeActions!.hidden ? <Eye size={20} /> : <EyeOff size={20} />}
            </button>
          </div>
          <div className="absolute inset-y-0 right-0 flex">
            <button
              type="button"
              aria-label="수정"
              onClick={() => {
                swipeActions!.onEdit();
                close();
              }}
              className="grid w-14 place-items-center bg-tint text-white active:opacity-80"
            >
              <SquarePen size={19} />
            </button>
            <button
              type="button"
              aria-label={armedDelete ? "삭제 확인" : "삭제"}
              onClick={() => {
                if (!armedDelete) {
                  setArmedDelete(true);
                  return;
                }
                swipeActions!.onDelete();
              }}
              className={cn(
                "grid w-14 place-items-center text-white active:opacity-80",
                armedDelete ? "bg-[#8f2f22]" : "bg-red",
              )}
            >
              {armedDelete ? <Check size={20} strokeWidth={2.6} /> : <Trash2 size={19} />}
            </button>
          </div>
        </>
      )}

      <motion.div
        style={{ x }}
        drag={swipeable ? "x" : false}
        dragDirectionLock
        dragConstraints={
          open === "right"
            ? { left: -RIGHT_W, right: 0 }
            : open === "left"
              ? { left: 0, right: LEFT_W }
              : { left: -RIGHT_W, right: LEFT_W }
        }
        dragElastic={0.06}
        onDragStart={() => {
          dragging.current = true;
          clearLongPress();
          if (swipeOpenId && swipeOpenId !== gear.id) onSwipeOpenChange?.(null);
        }}
        onDragEnd={(_e, info) => {
          const cur = x.get();
          const v = info.velocity.x;
          if (open === "right") {
            // edit/delete revealed — a reverse (rightward) swipe closes it
            if (cur >= -RIGHT_W * 0.6 || v > 500) close();
            else settleOpen("right");
          } else if (open === "left") {
            // hide revealed — a reverse (leftward) swipe closes it
            if (cur <= LEFT_W * 0.4 || v < -500) close();
            else settleOpen("left");
          } else {
            if (cur <= -RIGHT_W * 0.4 || v < -500) settleOpen("right");
            else if (cur >= LEFT_W * 0.5 || v > 500) settleOpen("left");
            else close(false);
          }
          window.setTimeout(() => {
            dragging.current = false;
          }, 60);
        }}
        className="relative bg-bg"
      >
        {selected && !editMode && (
          <span className="pointer-events-none absolute inset-0 z-0 bg-tint-soft shadow-[inset_3px_0_0_var(--tint)]" />
        )}
        <div
          className={cn(
            "relative z-10 flex items-center gap-2.5 px-4 py-2.5",
            dimmed && "opacity-45",
          )}
        >
          {editMode && dragHandle}
          <button
            ref={btnRef}
            type="button"
            onClick={handleClick}
            onPointerDown={pressStart}
            onPointerUp={pressEnd}
            onPointerLeave={pressEnd}
            onContextMenu={(e) => e.preventDefault()}
            className="flex min-w-0 flex-1 select-none items-center text-left active:opacity-60"
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
                className="-mr-1.5 grid h-7 w-7 place-items-center rounded-full text-tint active:bg-fill"
              >
                <ChevronDown
                  size={18}
                  className={cn("transition-transform", expanded && "rotate-180")}
                />
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
