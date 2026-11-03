"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { hapticTick } from "@/lib/haptics";
import { quietScrollTuck } from "../TopBar";

/** Finger travel per category — long enough that each step is a deliberate
 *  click rather than a glide. */
const STEP = 28;
/** Extra travel (in steps) past the halfway line before a step counts. */
const HYST = 0.15;
/** Tick spacing. */
const TICK = 18;
/** The click: a quick plain ease — no overshoot, so fast scrubs stay calm. */
const SNAP = "transform 0.18s ease-out";
const noop = () => () => {};

/** What the scrubber drives: the page (a tab's list under the top bar) or a
 *  scroll area of its own (a sheet's list). */
interface Surface {
  /** Where the `[data-gear-cat]` sections live. */
  root: ParentNode;
  /** Viewport y of the line sections tuck under. */
  line: () => number;
  y: () => number;
  to: (y: number) => void;
  target: Window | HTMLElement;
}

function pageSurface(): Surface {
  const pane = document.querySelector<HTMLElement>("[data-tab-pane]:not([hidden])");
  return {
    root: pane ?? document,
    // the pane's top padding already resolves the safe-area maths
    line: () => (pane ? parseFloat(getComputedStyle(pane).paddingTop) || 0 : 0),
    y: () => window.scrollY,
    to: (y) => {
      quietScrollTuck();
      window.scrollTo({ top: Math.max(0, y), behavior: "instant" });
    },
    target: window,
  };
}

function areaSurface(el: HTMLElement): Surface {
  return {
    root: el,
    line: () => el.getBoundingClientRect().top,
    y: () => el.scrollTop,
    to: (y) => el.scrollTo({ top: Math.max(0, y), behavior: "instant" }),
    target: el,
  };
}

/** Scroll offset right after a jump: until the list is scrolled by hand the
 *  picked category stays current, even if the list's end kept it from
 *  reaching the top. */
let jumpedAt: number | null = null;

function jumpTo(sf: Surface, cat: string, lead: number) {
  const el = Array.from(sf.root.querySelectorAll<HTMLElement>("[data-gear-cat]")).find(
    (s) => s.dataset.gearCat === cat && s.offsetParent !== null,
  );
  if (!el) return;
  // `lead`: how far the section's top may sit above the line — its header's
  // own top padding keeps the name clear (of the bar and the fade under it)
  sf.to(el.getBoundingClientRect().top - sf.line() + sf.y() + lead);
  jumpedAt = sf.y();
}

/**
 * Gear category scrubber: a row of ticks, one per 대분류. Dragging steps
 * through the categories with a detent (and a haptic tick) per step; the
 * category you're on shows large in the middle of the screen, and the list
 * follows each step live. Tapping left/right of centre steps by the tapped distance.
 * Between scrubs it follows the list's scroll position, wordlessly.
 *
 * By default it drives the page; give it `scroller` to drive that scroll
 * area instead (a sheet's list), with the veil over that sheet.
 */
export function CategoryScrubber({
  cats,
  scroller,
  lead = 16,
}: {
  cats: string[];
  scroller?: React.RefObject<HTMLElement | null>;
  lead?: number;
}) {
  const surface = () => (scroller?.current ? areaSurface(scroller.current) : pageSurface());
  /** With a scroller, the veil covers its sheet (viewport rect). */
  const [area, setArea] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const [index, setIndex] = useState(0);
  const [hint, setHint] = useState<string | null>(null);
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  const max = Math.max(0, cats.length - 1);
  const cur = Math.min(index, max);
  const st = useRef({ pid: -1, sx: 0, start: 0, idx: 0, moved: false });
  const dragging = useRef(false);
  const hintTimer = useRef(0);
  const catsRef = useRef(cats);
  useEffect(() => {
    catsRef.current = cats;
  }, [cats]);

  // Follow the list: the current category is the last section whose top has
  // passed under the bar.
  useEffect(() => {
    let raf = 0;
    const sf = scroller?.current ? areaSurface(scroller.current) : pageSurface();
    const read = () => {
      raf = 0;
      if (dragging.current) return;
      if (jumpedAt !== null) {
        if (Math.abs(sf.y() - jumpedAt) < 4) return;
        jumpedAt = null;
      }
      const line = sf.line() + 4;
      let found = 0;
      for (const el of sf.root.querySelectorAll<HTMLElement>("[data-gear-cat]")) {
        if (el.offsetParent === null) continue;
        if (el.getBoundingClientRect().top > line) break;
        const i = catsRef.current.indexOf(el.dataset.gearCat ?? "");
        if (i >= 0) found = i;
      }
      setIndex(found);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(read);
    };
    read();
    sf.target.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      sf.target.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [cats, scroller]);

  useEffect(() => () => window.clearTimeout(hintTimer.current), []);

  function showHint(text: string, hold: boolean) {
    window.clearTimeout(hintTimer.current);
    if (!hint && scroller?.current) {
      // the whole sheet panel (not just its list), corners and all
      const panel = scroller.current.closest<HTMLElement>("[role=dialog]") ?? scroller.current;
      const r = panel.getBoundingClientRect();
      setArea({ top: r.top, left: r.left, width: r.width, height: r.height });
    }
    setHint(text);
    if (!hold) hintTimer.current = window.setTimeout(() => setHint(null), 650);
  }

  function step(to: number) {
    const i = Math.max(0, Math.min(max, to));
    if (i !== cur) hapticTick();
    setIndex(i);
    showHint(cats[i], false);
    jumpTo(surface(), cats[i], lead);
  }

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    st.current = { pid: e.pointerId, sx: e.clientX, start: cur, idx: cur, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = st.current;
    if (e.pointerId !== s.pid) return;
    const dx = e.clientX - s.sx;
    if (!s.moved) {
      if (Math.abs(dx) < 5) return;
      s.moved = true;
      dragging.current = true;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    }
    // the ticks travel with the finger; past either end they resist
    let r = s.start - dx / STEP;
    if (r < 0) r *= 0.25;
    else if (r > max) r = max + (r - max) * 0.25;
    // Hysteresis: a step needs the finger well past the halfway line, so a
    // touch wobbling right on it can't flick back and forth.
    const i =
      Math.abs(r - s.idx) > 0.5 + HYST ? Math.max(0, Math.min(max, Math.round(r))) : s.idx;
    if (i !== s.idx) {
      s.idx = i;
      hapticTick();
      setIndex(i);
      jumpTo(surface(), cats[i], lead); // the list follows before you let go
    }
    showHint(cats[i], true);
  };
  const finish = (e: React.PointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const s = st.current;
    if (e.pointerId !== s.pid) return;
    s.pid = -1;
    dragging.current = false;
    if (cancelled) {
      setHint(null);
      return;
    }
    if (s.moved) {
      // the name was on screen the whole drag: fade the moment you let go
      window.clearTimeout(hintTimer.current);
      setHint(null);
      return;
    }
    // a tap: step by however many ticks away from centre it landed
    const r = e.currentTarget.getBoundingClientRect();
    step(cur + Math.round((e.clientX - (r.left + r.width / 2)) / TICK));
  };

  // Pure detent: the row holds still between steps and only ever moves a
  // whole tick. (Following the finger even slightly made it quiver under a
  // real touch, whose position wobbles by a pixel or two.)
  const pos = cur;

  return (
    <div className="relative">
      <div
        role="slider"
        tabIndex={0}
        aria-label="대분류 이동"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={cur}
        aria-valuetext={cats[cur]}
        className="relative h-11 w-[min(216px,calc(100vw-150px))] touch-none select-none overflow-hidden rounded-full outline-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(e) => finish(e, false)}
        onPointerCancel={(e) => finish(e, true)}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
            e.preventDefault();
            step(cur + (e.key === "ArrowRight" ? 1 : -1));
          }
        }}
      >
        <div
          className="absolute inset-0"
          style={{
            maskImage: "linear-gradient(to right, transparent 4%, #000 30%, #000 70%, transparent 96%)",
            WebkitMaskImage:
              "linear-gradient(to right, transparent 4%, #000 30%, #000 70%, transparent 96%)",
          }}
        >
          <div
            className="absolute left-1/2 top-1/2"
            style={{
              transform: `translateX(${-pos * TICK}px)`,
              transition: SNAP,
            }}
          >
            {cats.map((c, i) => {
              const on = i === cur;
              return (
                <span
                  key={c}
                  aria-hidden="true"
                  className="absolute top-0 w-[2.5px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-label transition-[height,opacity] duration-150 ease-out"
                  style={{
                    left: i * TICK,
                    height: on ? 18 : 9,
                    opacity: on ? 1 : Math.max(0.14, 0.42 - Math.abs(i - pos) * 0.05),
                  }}
                />
              );
            })}
          </div>
        </div>
      </div>
      {/* the category you're on: a faint page-coloured veil over the list
          with the name in the middle, fading out a moment after you let go.
          Under the bars (z-40), so the scrubber itself stays clear; in a
          sheet, over the whole sheet (a lighter veil). Portalled: the top bar's transforms would
          otherwise anchor it. */}
      {mounted &&
        createPortal(
          <div
            aria-hidden="true"
            className={cn(
              "pointer-events-none fixed grid place-items-center",
              scroller ? "z-[60] rounded-[32px]" : "inset-0 z-40",
            )}
            style={{
              ...(scroller ? (area ?? { top: 0, left: 0, width: 0, height: 0 }) : null),
              opacity: hint ? 1 : 0,
              // in: a soft, slightly longer ease; out: quicker and smooth
              transition: hint
                ? "opacity 0.32s cubic-bezier(0.22, 1, 0.36, 1)"
                : "opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
              // lighter over a sheet: it already sits on a dimmed page
              background: `color-mix(in srgb, var(--bg) ${scroller ? 45 : 60}%, transparent)`,
              // a touch of blur so the list recedes behind the name
              WebkitBackdropFilter: "blur(2px)",
              backdropFilter: "blur(2px)",
            }}
          >
            <span
              className="whitespace-nowrap text-[23px] font-bold tracking-[-0.01em] text-label"
              style={{
                // Space Grotesk for Latin names; Hangul falls back to the UI font
                fontFamily: "var(--font-grotesk), var(--font-sans)",
                transform: hint ? "none" : "scale(0.97)",
                transition: hint
                  ? "transform 0.32s cubic-bezier(0.22, 1, 0.36, 1)"
                  : "transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
              }}
            >
              {hint ?? cats[cur]}
            </span>
          </div>,
          document.body,
        )}
    </div>
  );
}
