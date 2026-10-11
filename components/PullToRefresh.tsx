"use client";

import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/cn";
import { pinPane, unpinPane } from "./useTabSwipe";

const THRESHOLD = 72; // px pulled (after damping) to trigger a reload
const MAX = 110;
const ICON = 36;

/**
 * Pull down from the top to reload — gives a way to fetch the latest version in
 * a standalone (home-screen) PWA, where iOS otherwise resumes a cached session
 * with no visible reload control. Disabled while a sheet/modal is open.
 *
 * The whole screen — floating top bar included — slides down with the finger
 * and the spinner appears in the gap above it. The visible tab pane is pinned
 * to the viewport for the gesture so its own floating buttons move with it.
 */
export function PullToRefresh() {
  const [refreshing, setRefreshing] = useState(false);
  const indRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const startX = useRef(0);
  const dist = useRef(0);
  const active = useRef(false);
  const moved = useRef<HTMLElement[]>([]);
  const pane = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const layers = () =>
      [
        pane.current,
        document.querySelector<HTMLElement>('nav[aria-label="상단 바"]'),
        document.querySelector<HTMLElement>(".scroll-edge-top"),
      ].filter((n): n is HTMLElement => Boolean(n));

    function grab() {
      if (moved.current.length) return;
      const p = document.querySelector<HTMLDivElement>("[data-tab-pane]:not([hidden])");
      if (p?.parentElement) {
        pinPane(p, window.scrollY, p.parentElement.getBoundingClientRect());
        pane.current = p;
      }
      moved.current = layers();
      for (const n of moved.current) n.style.transition = "none";
    }
    function release() {
      unpinPane(pane.current);
      pane.current = null;
      for (const n of moved.current) {
        n.style.removeProperty("transform");
        n.style.removeProperty("transition");
      }
      moved.current = [];
    }
    function paint(d: number) {
      const shown = Math.min(d, MAX);
      for (const n of moved.current) n.style.transform = `translate3d(0,${shown}px,0)`;
      const node = indRef.current;
      if (!node) return;
      // centred in the gap that opens above the bar
      node.style.transform = `translateY(${(shown - ICON) / 2}px)`;
      node.style.opacity = String(Math.min(1, d / THRESHOLD));
      const icon = node.firstElementChild as HTMLElement | null;
      if (icon) icon.style.transform = `rotate(${shown * 2.2}deg)`;
    }
    function settle(to: number, done?: () => void) {
      const ease = "transform .28s cubic-bezier(0.22, 0.8, 0.28, 1)";
      for (const n of moved.current) n.style.transition = ease;
      const node = indRef.current;
      if (node) node.style.transition = `${ease}, opacity .2s ease`;
      paint(to);
      if (node && to === 0) node.style.opacity = "0";
      if (done) window.setTimeout(done, 290);
    }
    function blocked() {
      return (
        document.querySelector('[role="dialog"]') !== null ||
        document.body.style.overflow === "hidden" ||
        document.body.style.position === "fixed" ||
        // A drag-reorder is in progress (set by the gear shelf's DndContext).
        document.body.dataset.dragging === "true"
      );
    }
    function onStart(e: TouchEvent) {
      if (e.touches.length !== 1 || window.scrollY > 2 || blocked() || moved.current.length) {
        active.current = false;
        return;
      }
      active.current = true;
      startY.current = e.touches[0].clientY;
      startX.current = e.touches[0].clientX;
      dist.current = 0;
      const node = indRef.current;
      if (node) node.style.transition = "none";
    }
    function onMove(e: TouchEvent) {
      if (!active.current) return;
      // A drag-reorder can activate mid-gesture (after a few px) — cancel the
      // pull the moment it does so the page can't get pulled/reloaded.
      const dy = e.touches[0].clientY - startY.current;
      // A sideways drag belongs to tab paging (useTabSwipe), not to the pull.
      if (!moved.current.length && Math.abs(e.touches[0].clientX - startX.current) > Math.abs(dy)) {
        active.current = false;
        return;
      }
      if (blocked() || (dy <= 0 && !moved.current.length)) {
        if (blocked()) active.current = false;
        dist.current = 0;
        if (moved.current.length) {
          paint(0);
          release();
        }
        return;
      }
      if (!moved.current.length) grab();
      dist.current = Math.max(0, dy * 0.5);
      paint(dist.current);
    }
    function onEnd() {
      if (!active.current) return;
      active.current = false;
      if (!moved.current.length) return;
      if (dist.current >= THRESHOLD) {
        settle(THRESHOLD);
        setRefreshing(true);
        window.setTimeout(() => window.location.reload(), 250);
      } else {
        settle(0, release);
      }
      dist.current = 0;
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
    <div
      className="pointer-events-none fixed inset-x-0 z-[80] flex justify-center"
      style={{ top: "var(--bar-top)" }}
    >
      <div
        ref={indRef}
        style={{ transform: `translateY(${-ICON / 2}px)`, opacity: 0 }}
        className="glass grid h-9 w-9 place-items-center rounded-full text-label"
      >
        <RefreshCw size={18} className={cn(refreshing && "animate-spin")} />
      </div>
    </div>
  );
}
