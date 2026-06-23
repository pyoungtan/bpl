"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
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

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

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
              "relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[14px] shadow-2xl",
              "sm:max-w-md sm:rounded-[14px] sm:max-h-[88dvh]",
              grouped ? "bg-bg" : "bg-card",
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
