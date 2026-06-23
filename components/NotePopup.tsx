"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { cn } from "@/lib/cn";

export function NotePopup({
  note,
  priceText,
  rect,
}: {
  note: string;
  priceText: string | null;
  rect: DOMRect;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const hasNote = note.trim().length > 0;
  const cx = Math.min(Math.max(rect.left + rect.width / 2, 90), window.innerWidth - 90);
  // Items near the top show the popup BELOW the row; otherwise ABOVE — so a
  // finger on the row never covers it and it stays on-screen.
  const placeBelow = rect.top < 140;
  const top = placeBelow ? rect.bottom + 10 : rect.top - 10;
  const transform = placeBelow ? "translateX(-50%)" : "translate(-50%, -100%)";

  return createPortal(
    <div
      className="pointer-events-none fixed z-[60]"
      style={{ left: cx, top, transform }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: placeBelow ? -6 : 6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.13, ease: "easeOut" }}
        className="max-w-[16rem] rounded-[12px] bg-navy px-3.5 py-2.5 text-on-dark shadow-2xl"
      >
        {priceText && (
          <div className="text-[13px] font-semibold tabular">{priceText}</div>
        )}
        {hasNote ? (
          <div className={cn("text-[13px] leading-relaxed", priceText && "mt-1 opacity-75")}>
            {note}
          </div>
        ) : (
          !priceText && <div className="text-[13px]">메모 없음</div>
        )}
      </motion.div>
    </div>,
    document.body,
  );
}
