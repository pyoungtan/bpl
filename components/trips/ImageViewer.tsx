"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { GlassCircle } from "../TopBar";

/** Full-screen look at an exported image. A tall (mobile) image fills the
 *  width and scrolls; a wide (PC) one fits the screen. Tapping the image
 *  zooms in around the tap (pinch is off app-wide) and tapping again fits
 *  it back; tapping the backdrop or ✕ closes. */
export function ImageViewer({
  src,
  tall,
  open,
  onClose,
}: {
  src: string | null;
  tall: boolean;
  open: boolean;
  onClose: () => void;
}) {
  // false during SSR/hydration, true after — the portal needs document.body
  const mounted = useSyncExternalStore(noop, () => true, () => false);

  // Escape closes the viewer only — not the sheet underneath it.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, onClose]);

  if (!mounted) return null;
  return createPortal(
    <AnimatePresence>
      {open && src && <Viewer key={src} src={src} tall={tall} onClose={onClose} />}
    </AnimatePresence>,
    document.body,
  );
}

const noop = () => () => {};

type Zoom = { w: number; fx: number; fy: number; cx: number; cy: number };

function Viewer({ src, tall, onClose }: { src: string; tall: boolean; onClose: () => void }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [zoom, setZoom] = useState<Zoom | null>(null);

  // Keep the tapped point under the finger after the zoom changes the size.
  useLayoutEffect(() => {
    const sc = scrollRef.current;
    const img = imgRef.current;
    if (!zoom || !sc || !img) return;
    const r = img.getBoundingClientRect();
    sc.scrollLeft += r.left + zoom.fx * r.width - zoom.cx;
    sc.scrollTop += r.top + zoom.fy * r.height - zoom.cy;
  }, [zoom]);

  function tapImage(e: React.MouseEvent<HTMLImageElement>) {
    e.stopPropagation();
    if (zoom) {
      setZoom(null);
      return;
    }
    const img = e.currentTarget;
    const r = img.getBoundingClientRect();
    // never beyond the image's own pixels
    const w = Math.min(img.naturalWidth, r.width * (tall ? 2 : 3));
    if (w <= r.width + 1) return;
    setZoom({
      w,
      fx: (e.clientX - r.left) / r.width,
      fy: (e.clientY - r.top) / r.height,
      cx: e.clientX,
      cy: e.clientY,
    });
  }

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label="이미지 크게 보기"
      data-no-tab-swipe
      className="fixed inset-0 z-[60] bg-black"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div
        ref={scrollRef}
        className="absolute inset-0 overflow-auto overscroll-contain"
        onClick={onClose}
      >
        <div
          className={
            zoom
              ? "flex min-h-full min-w-full w-max items-center justify-center"
              : tall
                ? "flex min-h-full items-center justify-center py-[calc(var(--bar-top)+56px)]"
                : "flex h-full w-full items-center justify-center p-3"
          }
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            src={src}
            alt="내보내기 이미지"
            draggable={false}
            onClick={tapImage}
            style={zoom ? { width: zoom.w, maxWidth: "none" } : undefined}
            className={
              zoom
                ? "block h-auto cursor-zoom-out select-none"
                : tall
                  ? "block h-auto w-full max-w-[540px] cursor-zoom-in select-none"
                  : "block max-h-full max-w-full cursor-zoom-in select-none object-contain"
            }
          />
        </div>
      </div>
      <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-end px-4 pt-[var(--bar-top)]">
        <GlassCircle label="닫기" onTap={onClose} className="pointer-events-auto">
          <X size={22} strokeWidth={2.2} />
        </GlassCircle>
      </div>
    </motion.div>
  );
}
