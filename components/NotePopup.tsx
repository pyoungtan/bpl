"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";

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
        <div className="text-[13px] leading-relaxed">
          {hasNote ? note : <span className="opacity-70">메모 없음</span>}
        </div>
        {priceText && (
          <div className="mt-1 text-[12px] tabular opacity-55">{priceText}</div>
        )}
      </motion.div>
    </div>,
    document.body,
  );
}
