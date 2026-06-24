"use client";

import { AnimatePresence, motion } from "framer-motion";
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

    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.style.overflow;
    const prevBody = body.style.overflow;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      html.style.overflow = prevHtml;
      body.style.overflow = prevBody;
    };
  }, [open]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
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
              "relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[14px]",
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
          >
            <div className="flex shrink-0 justify-center pt-2 sm:hidden">
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
            <div className="grow overflow-y-auto overscroll-contain py-4">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
