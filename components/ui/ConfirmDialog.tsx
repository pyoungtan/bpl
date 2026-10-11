"use client";

import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";

/** Centered glass alert with a primary and a dismiss action. */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel = "취소",
  destructive = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message?: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-6">
      <div className="fold-reveal absolute inset-0 bg-black/40" onClick={onCancel} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="glass-strong relative w-full max-w-xs rounded-[32px] p-6 text-center"
      >
        <h3 className="text-[17px] font-semibold text-label">{title}</h3>
        {message && (
          <p className="mt-1.5 text-[14px] leading-relaxed text-secondary">{message}</p>
        )}
        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            onClick={onConfirm}
            className={cn(
              "h-12 rounded-full text-[16px] font-semibold transition active:scale-[0.97]",
              destructive ? "bg-red text-white" : "btn-ink",
            )}
          >
            {confirmLabel}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="h-12 rounded-full bg-fill text-[16px] font-medium text-label transition active:scale-[0.97]"
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
