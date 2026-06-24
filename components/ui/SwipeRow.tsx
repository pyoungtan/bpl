"use client";

import { useEffect, useRef, useState } from "react";
import { animate, motion, useMotionValue } from "framer-motion";
import { Check, Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";

type OpenState = "closed" | "right" | "left";

const spring = { type: "spring" as const, stiffness: 520, damping: 44 };

export interface SwipeRowProps {
  /** Stable id for single-open coordination within a list. */
  id: string;
  /** The currently-open row id in this list (null = none). */
  openId: string | null;
  onOpenChange: (id: string | null) => void;
  /** Width (px) of the action area revealed by swiping LEFT (anchored right). */
  rightWidth?: number;
  /** Width (px) of the action area revealed by swiping RIGHT (anchored left). */
  leftWidth?: number;
  /** Actions anchored to the right edge (revealed on swipe-left). */
  renderRight?: (close: () => void, rowOpen: boolean) => React.ReactNode;
  /** Actions anchored to the left edge (revealed on swipe-right). */
  renderLeft?: (close: () => void, rowOpen: boolean) => React.ReactNode;
  swipeDisabled?: boolean;
  topHairline?: boolean;
  selected?: boolean;
  /** Overlay class for the selection highlight (kept above the opaque body). */
  selectedClassName?: string;
  /** Opaque background of the sliding body (so actions never bleed through). */
  bgClassName?: string;
  children: React.ReactNode;
}

/**
 * Shared swipe-to-reveal row. Behaviour is identical everywhere it's used:
 * direction-aware (a reverse swipe closes instead of flipping), only one row
 * open at a time per list, tapping the open row (or starting a swipe on another)
 * cancels it, and the body stays opaque so actions never show through a
 * selected row. Only the revealed actions differ per call site.
 */
export function SwipeRow({
  id,
  openId,
  onOpenChange,
  rightWidth = 0,
  leftWidth = 0,
  renderRight,
  renderLeft,
  swipeDisabled,
  topHairline,
  selected,
  selectedClassName,
  bgClassName,
  children,
}: SwipeRowProps) {
  const RIGHT_W = rightWidth;
  const LEFT_W = leftWidth;
  const x = useMotionValue(0);
  const [open, setOpen] = useState<OpenState>("closed");
  const openRef = useRef<OpenState>("closed");
  const dragging = useRef(false);

  const swipeable = !swipeDisabled && (RIGHT_W > 0 || LEFT_W > 0);

  function setOpenState(next: OpenState) {
    openRef.current = next;
    setOpen(next);
  }

  useEffect(() => {
    if (!swipeable) {
      x.set(0);
      setOpenState("closed");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [swipeable, x]);

  // Only one row open at a time: close when another row becomes the open one.
  useEffect(() => {
    if (openId !== id && openRef.current !== "closed") {
      animate(x, 0, spring);
      setOpenState("closed");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId, id, x]);

  function close(notify = true) {
    animate(x, 0, spring);
    setOpenState("closed");
    if (notify) onOpenChange(null);
  }
  function settleOpen(dir: "right" | "left") {
    animate(x, dir === "right" ? -RIGHT_W : LEFT_W, spring);
    setOpenState(dir);
    onOpenChange(id);
  }

  return (
    <div
      className={cn(
        "relative overflow-hidden",
        topHairline &&
          "before:pointer-events-none before:absolute before:left-4 before:right-0 before:top-0 before:z-20 before:h-px before:bg-separator",
      )}
    >
      {swipeable && LEFT_W > 0 && renderLeft && (
        <div className="absolute inset-y-0 left-0 flex">
          {renderLeft(() => close(), open === "left")}
        </div>
      )}
      {swipeable && RIGHT_W > 0 && renderRight && (
        <div className="absolute inset-y-0 right-0 flex">
          {renderRight(() => close(), open === "right")}
        </div>
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
          if (openId && openId !== id) onOpenChange(null);
        }}
        onDragEnd={(_e, info) => {
          const cur = x.get();
          const v = info.velocity.x;
          if (open === "right") {
            if (cur >= -RIGHT_W * 0.6 || v > 500) close();
            else settleOpen("right");
          } else if (open === "left") {
            if (cur <= LEFT_W * 0.4 || v < -500) close();
            else settleOpen("left");
          } else {
            if (RIGHT_W > 0 && (cur <= -RIGHT_W * 0.4 || v < -500)) settleOpen("right");
            else if (LEFT_W > 0 && (cur >= LEFT_W * 0.5 || v > 500)) settleOpen("left");
            else close(false);
          }
          window.setTimeout(() => {
            dragging.current = false;
          }, 60);
        }}
        // Swallow the click that ends a drag, and let a tap on an OPEN row just
        // close it (without triggering the row's own tap handlers).
        onClickCapture={(e) => {
          if (dragging.current || openRef.current !== "closed") {
            e.stopPropagation();
            if (openRef.current !== "closed") close();
          }
        }}
        className={cn("relative", bgClassName ?? "bg-bg")}
      >
        {selected && (
          <span
            className={cn(
              "pointer-events-none absolute inset-0 z-0",
              selectedClassName ?? "bg-tint-soft shadow-[inset_3px_0_0_var(--tint)]",
            )}
          />
        )}
        <div className="relative z-10">{children}</div>
      </motion.div>
    </div>
  );
}

/**
 * Destructive action button for a SwipeRow: first tap arms (turns into a
 * check), second tap confirms. Re-arms to safe whenever the row closes.
 */
export function SwipeDeleteButton({
  rowOpen,
  onDelete,
  width = "w-14",
}: {
  rowOpen: boolean;
  onDelete: () => void;
  width?: string;
}) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!rowOpen) setArmed(false);
  }, [rowOpen]);
  return (
    <button
      type="button"
      aria-label={armed ? "삭제 확인" : "삭제"}
      onClick={() => {
        if (!armed) {
          setArmed(true);
          return;
        }
        onDelete();
      }}
      className={cn(
        "grid touch-manipulation place-items-center text-white active:opacity-80",
        width,
        armed ? "bg-[#8f2f22]" : "bg-red",
      )}
    >
      {armed ? <Check size={20} strokeWidth={2.6} /> : <Trash2 size={19} />}
    </button>
  );
}
