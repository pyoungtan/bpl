"use client";

import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/cn";

const THRESHOLD = 72; // px pulled (after damping) to trigger a reload
const MAX = 110;

/**
 * Pull down from the top to reload — gives a way to fetch the latest version in
 * a standalone (home-screen) PWA, where iOS otherwise resumes a cached session
 * with no visible reload control. Disabled while a sheet/modal is open.
 */
export function PullToRefresh() {
  const [refreshing, setRefreshing] = useState(false);
  const indRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const dist = useRef(0);
  const active = useRef(false);

  useEffect(() => {
    const el = () => indRef.current;
    function paint(d: number) {
      const node = el();
      if (!node) return;
      const shown = Math.min(d, MAX);
      node.style.transform = `translateY(${shown}px)`;
      node.style.opacity = String(Math.min(1, d / THRESHOLD));
      const icon = node.firstElementChild as HTMLElement | null;
      if (icon) icon.style.transform = `rotate(${shown * 2.2}deg)`;
    }
    function snapBack() {
      const node = el();
      if (node) {
        node.style.transition = "transform .25s ease, opacity .2s ease";
        node.style.transform = "translateY(0px)";
        node.style.opacity = "0";
      }
      dist.current = 0;
    }
    function blocked() {
      return (
        document.querySelector('[role="dialog"]') !== null ||
        document.body.style.overflow === "hidden" ||
        // A drag-reorder is in progress (set by the gear shelf's DndContext).
        document.body.dataset.dragging === "true"
      );
    }
    function onStart(e: TouchEvent) {
      if (e.touches.length !== 1 || window.scrollY > 2 || blocked()) {
        active.current = false;
        return;
      }
      active.current = true;
      startY.current = e.touches[0].clientY;
      dist.current = 0;
      const node = el();
      if (node) node.style.transition = "none";
    }
    function onMove(e: TouchEvent) {
      if (!active.current) return;
      // A drag-reorder can activate mid-gesture (after a few px) — cancel the
      // pull the moment it does so the page can't get pulled/reloaded.
      if (blocked()) {
        active.current = false;
        dist.current = 0;
        paint(0);
        return;
      }
      const dy = e.touches[0].clientY - startY.current;
      if (dy <= 0 || window.scrollY > 2) {
        dist.current = 0;
        paint(0);
        return;
      }
      dist.current = dy * 0.5;
      paint(dist.current);
    }
    function onEnd() {
      if (!active.current) return;
      active.current = false;
      if (dist.current >= THRESHOLD) {
        const node = el();
        if (node) {
          node.style.transition = "transform .2s ease";
          node.style.transform = `translateY(${THRESHOLD}px)`;
          node.style.opacity = "1";
        }
        setRefreshing(true);
        window.setTimeout(() => window.location.reload(), 250);
      } else {
        snapBack();
      }
    }
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: true });
    window.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[80] flex justify-center pt-safe">
      <div
        ref={indRef}
        style={{ transform: "translateY(0px)", opacity: 0 }}
        className="material shadow-float mt-1 grid h-9 w-9 place-items-center rounded-full text-tint"
      >
        <RefreshCw size={18} className={cn(refreshing && "animate-spin")} />
      </div>
    </div>
  );
}
