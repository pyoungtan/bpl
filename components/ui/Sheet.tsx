"use client";

import { AnimatePresence, motion, useDragControls } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";

interface SheetAction {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  prominent?: boolean;
}

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  leftLabel?: string;
  rightAction?: SheetAction;
  children: React.ReactNode;
  /** grouped = systemGroupedBackground body (default); else card. */
  grouped?: boolean;
}

export function Sheet({
  open,
  onClose,
  title,
  leftLabel = "취소",
  rightAction,
  children,
  grouped = true,
}: SheetProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const dragControls = useDragControls();
  const scrollRef = useRef<HTMLDivElement>(null);
  // How much of the viewport bottom is covered by the software keyboard, tracked
  // via the VisualViewport API. We lift the whole sheet by this amount so it
  // sits above the keyboard (not pushed off the top) and its scroll area is
  // sized to the visible region (so the bottom fields stay reachable).
  const [kbInset, setKbInset] = useState(0);

  // When a field inside the sheet gains focus, bring it into view within the
  // sheet's own scroll area. iOS doesn't reliably scroll fields above the
  // keyboard on its own, so fields low in a long form can stay hidden — the
  // user otherwise has to scroll by hand. Delay so the keyboard has animated in.
  useEffect(() => {
    if (!open) return;
    const el = scrollRef.current;
    if (!el) return;
    let timer = 0;
    const onFocusIn = (e: FocusEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t || !/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(
        () => t.scrollIntoView({ block: "center", behavior: "smooth" }),
        300,
      );
    };
    el.addEventListener("focusin", onFocusIn);
    return () => {
      window.clearTimeout(timer);
      el.removeEventListener("focusin", onFocusIn);
    };
  }, [open]);

  // Lock the document scroll while open so the page behind the sheet can't
  // drift — including when the keyboard opens for a field inside the sheet
  // (iOS then scrolls the sheet's own scroll area, not the page). Depends only
  // on `open`, so it applies once per open/close rather than on every render.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", onKey);

    // Pin the body at its current scroll offset (position:fixed) so focusing a
    // field / opening the keyboard can't scroll the page underneath — and
    // restore the exact offset on close. Plain overflow:hidden doesn't preserve
    // the position on iOS, so the shelf jumped to the top after editing.
    const body = document.body;
    const scrollY = window.scrollY;
    const prev = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
    };
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";

    return () => {
      document.removeEventListener("keydown", onKey);
      body.style.position = prev.position;
      body.style.top = prev.top;
      body.style.left = prev.left;
      body.style.right = prev.right;
      body.style.width = prev.width;
      window.scrollTo(0, scrollY);
    };
  }, [open]);

  // Track the software keyboard's height so the sheet can sit above it.
  useEffect(() => {
    if (!open) return;
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      // Bottom area of the layout viewport hidden by the keyboard.
      const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setKbInset(inset);
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      setKbInset(0);
    };
  }, [open]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-x-0 top-0 z-50 flex items-end justify-center sm:items-center"
          style={{ bottom: kbInset }}
        >
          <motion.div
            className="absolute inset-0 bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            className={cn(
              // min(…, 100%) caps the panel to the visible area above the
              // keyboard (the container shrinks by kbInset), so the top isn't
              // pushed off-screen and the bottom fields stay scrollable.
              "relative flex max-h-[min(92dvh,100%)] w-full flex-col overflow-hidden rounded-t-[14px]",
              "sm:max-w-md sm:rounded-[14px] sm:max-h-[88dvh] sm:shadow-2xl",
              // On mobile the sheet sits at the bottom; a same-colour fill below
              // the panel covers any gap that appears when the keyboard pushes
              // the sheet up, so the page never shows through. (+ a top edge shadow)
              grouped
                ? "bg-bg max-sm:shadow-[0_40vh_0_40vh_var(--bg),0_-6px_28px_rgba(0,0,0,0.16)]"
                : "bg-card max-sm:shadow-[0_40vh_0_40vh_var(--card),0_-6px_28px_rgba(0,0,0,0.16)]",
            )}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 36, stiffness: 400 }}
            // Swipe the top handle down to dismiss (mobile). dragListener is off
            // so only the handle starts a drag — the body still scrolls normally.
            drag="y"
            dragListener={false}
            dragControls={dragControls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.5 }}
            onDragEnd={(_e, info) => {
              if (info.offset.y > 120 || info.velocity.y > 600) onCloseRef.current();
            }}
          >
            <div
              className="flex shrink-0 cursor-grab touch-none justify-center pb-1 pt-2.5 active:cursor-grabbing sm:hidden"
              onPointerDown={(e) => dragControls.start(e)}
            >
              <div className="h-1 w-9 rounded-full bg-separator-opaque" />
            </div>
            <div className="grid h-12 shrink-0 grid-cols-[1fr_auto_1fr] items-center border-b border-separator px-4">
              <button
                type="button"
                onClick={onClose}
                // Fire even when a field inside the sheet is focused: don't let
                // the press steal focus / dismiss the keyboard before the click.
                onMouseDown={(e) => e.preventDefault()}
                className="justify-self-start text-[17px] text-tint active:opacity-50"
              >
                {leftLabel}
              </button>
              <h2 className="justify-self-center truncate px-2 text-[17px] font-semibold text-label">
                {title}
              </h2>
              {rightAction ? (
                <button
                  type="button"
                  onClick={rightAction.onClick}
                  onMouseDown={(e) => e.preventDefault()}
                  disabled={rightAction.disabled}
                  className={cn(
                    "justify-self-end text-[17px] text-tint active:opacity-50 disabled:opacity-40",
                    rightAction.prominent ? "font-semibold" : "font-normal",
                  )}
                >
                  {rightAction.label}
                </button>
              ) : (
                <span />
              )}
            </div>
            <div
              ref={scrollRef}
              className="grow overflow-y-auto overscroll-contain py-4"
            >
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
