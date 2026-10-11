"use client";

import { useEffect, useRef } from "react";
import type { TabKey } from "./TopBar";

const ORDER: TabKey[] = ["shelf", "trips"];

/** Touches that start here keep their own gestures (chip strips, fields, drag
 *  handles) instead of paging between tabs. Swipe rows are handled below. */
const EXCLUDE = ".overflow-x-auto, input, textarea, select, [contenteditable], .touch-none";

/** Rows own a horizontal drag (their swipe actions) — except within a row's
 *  edge band (data-swipe-band px at top/bottom), the gap between rows. */
function rowOwnsTouch(t: Element, clientY: number) {
  const row = t.closest<HTMLElement>("[data-swipe-row]");
  if (!row) return false;
  const band = Number(row.dataset.swipeBand) || 0;
  if (!band) return true;
  const r = row.getBoundingClientRect();
  const y = clientY - r.top;
  return y >= band && y <= r.height - band;
}

const FROZEN_PROPS = [
  "position",
  "top",
  "left",
  "width",
  "height",
  "overflow",
  "transform",
  "transition",
  "will-change",
  "background-color",
] as const;

interface Options {
  /** Attach once the root element exists (after hydration). */
  enabled: boolean;
  rootRef: React.RefObject<HTMLElement | null>;
  panes: React.RefObject<Partial<Record<TabKey, HTMLDivElement | null>>>;
  getTab: () => TabKey;
  /** Saved scroll offset of a tab that isn't showing. */
  getScroll: (t: TabKey) => number;
  /** Switch tabs synchronously (flushSync); `fromScroll` is the outgoing
   *  tab's offset, since the page itself was pinned during the drag. */
  onCommit: (next: TabKey, fromScroll: number) => void;
}

/**
 * Horizontal swipe on non-item areas pages between the Gear and Trip tabs
 * with both real screens moving under the finger. While dragging, each pane
 * is pinned to the viewport (position:fixed) and scrolled to its own offset,
 * so the incoming screen shows exactly what it will be — not a blank page.
 */
export function useTabSwipe({ enabled, rootRef, panes, getTab, getScroll, onCommit }: Options) {
  const opts = useRef({ panes, getTab, getScroll, onCommit });
  useEffect(() => {
    opts.current = { panes, getTab, getScroll, onCommit };
  });

  useEffect(() => {
    const root = rootRef.current;
    if (!enabled || !root) return;

    type Phase = "idle" | "pending" | "drag" | "ignore" | "settling";
    const g = {
      phase: "idle" as Phase,
      x0: 0,
      y0: 0,
      dx: 0,
      lastX: 0,
      lastT: 0,
      v: 0,
      dir: 0, // -1: finger moves left → next tab on the right; +1: the reverse
      width: 0,
      curScroll: 0,
      cur: null as HTMLDivElement | null,
      next: null as HTMLDivElement | null,
      nextKey: null as TabKey | null,
    };

    const freeze = (el: HTMLDivElement, scroll: number, rect: DOMRect) => {
      el.hidden = false;
      const s = el.style;
      s.position = "fixed";
      s.top = "0";
      s.left = `${rect.left}px`;
      s.width = `${rect.width}px`;
      s.height = `${window.innerHeight}px`;
      s.overflow = "hidden";
      s.willChange = "transform";
      s.backgroundColor = "var(--bg)";
      el.scrollTop = scroll;
    };
    const unfreeze = (el: HTMLDivElement | null) => {
      if (!el) return;
      for (const p of FROZEN_PROPS) el.style.removeProperty(p);
    };
    const paint = (dx: number) => {
      if (!g.cur) return;
      g.cur.style.transform = `translate3d(${dx}px,0,0)`;
      if (g.next) g.next.style.transform = `translate3d(${dx - g.dir * g.width}px,0,0)`;
    };

    const begin = (dir: number) => {
      const { panes: p, getTab: gt, getScroll: gs } = opts.current;
      const curKey = gt();
      const i = ORDER.indexOf(curKey) - dir; // dir -1 → index + 1
      const nextKey = ORDER[i] ?? null;
      const cur = p.current?.[curKey] ?? null;
      if (!cur) return false;
      const rect = root.getBoundingClientRect();
      g.dir = dir;
      g.width = rect.width;
      g.cur = cur;
      g.nextKey = nextKey;
      g.next = nextKey ? (p.current?.[nextKey] ?? null) : null;
      g.curScroll = window.scrollY;
      freeze(cur, g.curScroll, rect);
      if (g.next && nextKey) freeze(g.next, gs(nextKey), rect);
      return true;
    };

    const finish = (commit: boolean) => {
      const { cur, next, nextKey, curScroll } = g;
      unfreeze(cur);
      unfreeze(next);
      if (commit && nextKey) {
        opts.current.onCommit(nextKey, curScroll);
      } else {
        if (next) next.hidden = true;
        window.scrollTo(0, curScroll);
      }
      g.phase = "idle";
      g.cur = g.next = null;
      g.nextKey = null;
    };

    const settle = (commit: boolean) => {
      g.phase = "settling";
      const target = commit ? g.dir * g.width : 0;
      const ease = "transform 0.32s cubic-bezier(0.22, 0.8, 0.28, 1)";
      if (g.cur) g.cur.style.transition = ease;
      if (g.next) g.next.style.transition = ease;
      paint(target);
      window.setTimeout(() => finish(commit), 330);
    };

    const onStart = (e: TouchEvent) => {
      if (g.phase === "settling") return;
      g.phase = "idle";
      if (e.touches.length !== 1) return;
      const t = e.target as Element | null;
      const { panes: p, getTab: gt } = opts.current;
      const cur = p.current?.[gt()];
      if (!t || !cur || !cur.contains(t)) return;
      if (t.closest(EXCLUDE) || rowOwnsTouch(t, e.touches[0].clientY)) return;
      // A trip's detail screen has its own edge swipe-back; open sheets own
      // the screen.
      if (cur.querySelector("[data-no-tab-swipe]")) return;
      if (document.querySelector('[role="dialog"]')) return;
      const touch = e.touches[0];
      g.phase = "pending";
      g.x0 = g.lastX = touch.clientX;
      g.y0 = touch.clientY;
      g.lastT = e.timeStamp;
      g.dx = 0;
      g.v = 0;
    };

    const onMove = (e: TouchEvent) => {
      if (g.phase !== "pending" && g.phase !== "drag") return;
      const touch = e.touches[0];
      const dx = touch.clientX - g.x0;
      const dy = touch.clientY - g.y0;
      if (g.phase === "pending") {
        if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
        if (Math.abs(dx) > Math.abs(dy) * 1.3) {
          if (!begin(dx < 0 ? -1 : 1)) {
            g.phase = "ignore";
            return;
          }
          g.phase = "drag";
        } else {
          g.phase = "ignore";
          return;
        }
      }
      e.preventDefault();
      const dt = Math.max(1, e.timeStamp - g.lastT);
      g.v = (touch.clientX - g.lastX) / dt;
      g.lastX = touch.clientX;
      g.lastT = e.timeStamp;
      let x = dx;
      if (!g.next) x = dx * 0.25; // no tab that way: rubber-band
      else if (g.dir < 0) x = Math.min(0, Math.max(-g.width, dx));
      else x = Math.max(0, Math.min(g.width, dx));
      g.dx = x;
      paint(x);
    };

    const onEnd = () => {
      if (g.phase !== "drag") {
        if (g.phase !== "settling") g.phase = "idle";
        return;
      }
      const far = Math.abs(g.dx) > g.width * 0.33;
      const flick = g.dir < 0 ? g.v < -0.35 : g.v > 0.35;
      const reversed = g.dir < 0 ? g.v > 0.2 : g.v < -0.2;
      settle(Boolean(g.next) && (far || flick) && !reversed);
    };

    root.addEventListener("touchstart", onStart, { passive: true });
    root.addEventListener("touchmove", onMove, { passive: false });
    root.addEventListener("touchend", onEnd);
    root.addEventListener("touchcancel", onEnd);
    return () => {
      root.removeEventListener("touchstart", onStart);
      root.removeEventListener("touchmove", onMove);
      root.removeEventListener("touchend", onEnd);
      root.removeEventListener("touchcancel", onEnd);
    };
  }, [enabled, rootRef]);
}
