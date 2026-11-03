"use client";

import { useEffect, useRef, useState } from "react";
import { hapticTick } from "@/lib/haptics";
import { quietScrollTuck } from "../TopBar";

/** Finger travel per category — long enough that each step is a deliberate
 *  click rather than a glide. */
const STEP = 28;
/** Tick spacing. */
const TICK = 18;
/** How far the row gives toward the next step before it clicks over. */
const GIVE = 0.12;
/** The click: a quick move that overshoots a hair and settles. */
const SNAP = "transform 0.22s cubic-bezier(0.25, 1.6, 0.45, 1)";

/** Where the list's sections sit under the top bar: the shown tab pane's top
 *  padding, which already resolves the safe-area maths. */
function contentTop(): number {
  const pane = document.querySelector<HTMLElement>("[data-tab-pane]:not([hidden])");
  return pane ? parseFloat(getComputedStyle(pane).paddingTop) || 0 : 0;
}

/** Scroll offset right after a jump: until the list is scrolled by hand the
 *  picked category stays current, even if the page end kept it from reaching
 *  the top. */
let jumpedAt: number | null = null;

function jumpTo(cat: string) {
  const el = Array.from(document.querySelectorAll<HTMLElement>("[data-gear-cat]")).find(
    (s) => s.dataset.gearCat === cat && s.offsetParent !== null,
  );
  if (!el) return;
  // the header's own top padding (pt-6) keeps the name clear of the bar
  const y = el.getBoundingClientRect().top + window.scrollY - (contentTop() - 20);
  quietScrollTuck();
  window.scrollTo({ top: Math.max(0, y), behavior: "instant" });
  jumpedAt = window.scrollY;
}

/**
 * Gear category scrubber: a row of ticks, one per 대분류. Dragging steps
 * through the categories with a detent (and a haptic tick) per step; the
 * category you'd land on floats below as a hint, and letting go jumps the
 * list there. Tapping left/right of centre steps by the tapped distance.
 * Between scrubs it follows the list's scroll position, wordlessly.
 */
export function CategoryScrubber({ cats }: { cats: string[] }) {
  const [index, setIndex] = useState(0);
  const [raw, setRaw] = useState<number | null>(null); // fractional while dragging
  const [hint, setHint] = useState<string | null>(null);
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
    const read = () => {
      raf = 0;
      if (dragging.current) return;
      if (jumpedAt !== null) {
        if (Math.abs(window.scrollY - jumpedAt) < 4) return;
        jumpedAt = null;
      }
      const line = contentTop() + 4;
      let found = 0;
      for (const el of document.querySelectorAll<HTMLElement>("[data-gear-cat]")) {
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
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [cats]);

  useEffect(() => () => window.clearTimeout(hintTimer.current), []);

  function showHint(text: string, hold: boolean) {
    window.clearTimeout(hintTimer.current);
    setHint(text);
    if (!hold) hintTimer.current = window.setTimeout(() => setHint(null), 650);
  }

  function step(to: number) {
    const i = Math.max(0, Math.min(max, to));
    if (i !== cur) hapticTick();
    setIndex(i);
    showHint(cats[i], false);
    jumpTo(cats[i]);
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
    const i = Math.max(0, Math.min(max, Math.round(r)));
    if (i !== s.idx) {
      s.idx = i;
      hapticTick();
      setIndex(i);
    }
    setRaw(r);
    showHint(cats[i], true);
  };
  const finish = (e: React.PointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const s = st.current;
    if (e.pointerId !== s.pid) return;
    s.pid = -1;
    dragging.current = false;
    setRaw(null);
    if (cancelled) {
      setHint(null);
      return;
    }
    if (s.moved) {
      showHint(cats[s.idx], false);
      jumpTo(cats[s.idx]);
      return;
    }
    // a tap: step by however many ticks away from centre it landed
    const r = e.currentTarget.getBoundingClientRect();
    step(cur + Math.round((e.clientX - (r.left + r.width / 2)) / TICK));
  };

  // Detent: between steps the row barely gives, then snaps a whole tick.
  const pos = raw === null ? cur : cur + (raw - cur) * GIVE;

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
        className="glass relative h-11 w-[min(216px,calc(100vw-150px))] touch-pan-y select-none overflow-hidden rounded-full outline-none"
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
                  className="absolute top-0 w-[2.5px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-label transition-[height,opacity] duration-200 ease-[cubic-bezier(0.3,1.8,0.5,1)]"
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
      {/* where letting go would land */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-full mt-2 -translate-x-1/2 transition-opacity duration-200"
        style={{ opacity: hint ? 1 : 0 }}
      >
        <span className="glass-strong flex h-8 items-center whitespace-nowrap rounded-full px-3.5 text-[14px] font-semibold tracking-[0.02em] text-label">
          {/* re-keyed per step so each click pops the name in */}
          <span key={hint ?? cats[cur]} className="scrub-snap">
            {hint ?? cats[cur]}
          </span>
        </span>
      </div>
    </div>
  );
}
