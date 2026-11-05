"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Check,
  ChevronLeft,
  Moon,
  Search,
  Settings,
  Heart,
  Plus,
  Sun,
  X,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { useAppStore } from "@/lib/store";

export type TabKey = "shelf" | "trips" | "map";

export interface TopBarMenuItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  danger?: boolean;
  checked?: boolean;
  /** Draw a separator above this item. */
  group?: boolean;
  onSelect: () => void;
}

export interface TopBarConfig {
  /** Detail screens: the search button becomes a back button and the tab
   *  switcher is replaced by the optional `center` capsule. */
  onBack?: () => void;
  center?: string;
  /** A live element for the bar's centre (e.g. the Gear category scrubber).
   *  It re-registers only when `centerKey` changes, so it should keep its own
   *  moment-to-moment state. */
  centerSlot?: React.ReactNode;
  centerKey?: string;
  /** Left glass button toggles this screen's search. */
  onSearch?: () => void;
  searching?: boolean;
  /** Left glass button with a custom action (takes precedence over search). */
  left?: { label: string; icon: React.ReactNode; onTap: () => void };
  /** More bare buttons right after the left one (e.g. the map's views). */
  leftActions?: { id: string; label: string; icon: React.ReactNode; onTap: () => void }[];
  /** Glass circle buttons placed left of the ⋯ menu. */
  actions?: { id: string; label: string; icon: React.ReactNode; onTap: () => void }[];
  menu?: TopBarMenuItem[];
  /** What the bottom bar's Add does on this screen (disabled when absent). */
  onAdd?: () => void;
  addLabel?: string;
  /** Hide the bottom bar (a mode with its own bottom actions: selection, edit). */
  hideNav?: boolean;
  /** The bottom bar's ♥ (hearted-only) toggle for this screen's list. */
  favorite?: { on: boolean; toggle: () => void };
}

type Setter = (config: TopBarConfig | null, owner: symbol, pane: TabKey) => void;
const TopBarCtx = createContext<Setter | null>(null);
/** Which tab a screen lives in. Tabs stay mounted while hidden, so the bar
 *  keeps one config per tab and shows the active tab's. */
const TopBarPaneCtx = createContext<TabKey>("shelf");
export const TopBarPane = TopBarPaneCtx.Provider;

/**
 * Register what the floating top bar shows while this screen is mounted.
 * Handlers are read through a ref, so they always see current state; the bar
 * only re-renders when something visible (labels, checks) changes.
 */
export function useTopBar(config: TopBarConfig, active = true) {
  const set = useContext(TopBarCtx);
  const pane = useContext(TopBarPaneCtx);
  const ref = useRef(config);
  ref.current = config;
  const [owner] = useState(() => Symbol("topbar"));
  const sig = JSON.stringify({
    back: Boolean(config.onBack),
    center: config.center ?? null,
    centerKey: config.centerSlot ? (config.centerKey ?? "") : null,
    search: Boolean(config.onSearch),
    searching: Boolean(config.searching),
    left: config.left?.label ?? null,
    leftActions: config.leftActions?.map((a) => [a.id, a.label]),
    actions: config.actions?.map((a) => [a.id, a.label]),
    menu: config.menu?.map((i) => [i.id, i.label, !!i.checked, !!i.danger, !!i.group]),
    add: Boolean(config.onAdd),
    addLabel: config.addLabel ?? null,
    hideNav: Boolean(config.hideNav),
    fav: config.favorite ? config.favorite.on : null,
  });
  useEffect(() => {
    if (!set) return;
    // A screen covered by another in the same tab (trip list under a trip's
    // detail) gives the bar up, and takes it back when it shows again.
    if (!active) {
      set(null, owner, pane);
      return;
    }
    const c = ref.current;
    set(
      {
        onBack: c.onBack ? () => ref.current.onBack?.() : undefined,
        center: c.center,
        centerSlot: c.centerSlot,
        onSearch: c.onSearch ? () => ref.current.onSearch?.() : undefined,
        searching: c.searching,
        left: c.left ? { ...c.left, onTap: () => ref.current.left?.onTap() } : undefined,
        leftActions: c.leftActions?.map((a) => ({
          ...a,
          onTap: () => ref.current.leftActions?.find((x) => x.id === a.id)?.onTap(),
        })),
        actions: c.actions?.map((a) => ({
          ...a,
          onTap: () => ref.current.actions?.find((x) => x.id === a.id)?.onTap(),
        })),
        menu: c.menu?.map((item) => ({
          ...item,
          onSelect: () => ref.current.menu?.find((x) => x.id === item.id)?.onSelect(),
        })),
        onAdd: c.onAdd ? () => ref.current.onAdd?.() : undefined,
        addLabel: c.addLabel,
        hideNav: c.hideNav,
        favorite: c.favorite
          ? { on: c.favorite.on, toggle: () => ref.current.favorite?.toggle() }
          : undefined,
      },
      owner,
      pane,
    );
    // sig captures every visible field
  }, [set, owner, pane, sig, active]);
  useEffect(() => () => set?.(null, owner, pane), [set, owner, pane]);
}

/* ---------- springs: sample a damped spring into a CSS linear() curve ---------- */
function spring(stiffness: number, damping: number) {
  const dt = 1 / 240;
  let x = 0;
  let v = 0;
  let t = 0;
  let i = 0;
  const pts = [0];
  while (t < 2.5) {
    const a = -stiffness * (x - 1) - damping * v;
    v += a * dt;
    x += v * dt;
    t += dt;
    i++;
    if (i % 4 === 0) pts.push(+x.toFixed(4));
    if (t > 0.15 && Math.abs(x - 1) < 0.0015 && Math.abs(v) < 0.02) break;
  }
  pts.push(1);
  return { easing: `linear(${pts.join(", ")})`, duration: +t.toFixed(3) };
}

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/* ---------- press physics: swell, stretch toward the finger, touch light ---------- */
interface PressOpts {
  scale?: number;
  onTap?: () => void;
  onHold?: () => void;
  onHoldMove?: (e: React.PointerEvent) => void;
  onHoldEnd?: (e: React.PointerEvent) => void;
  disabled?: () => boolean;
}

export function usePressFx<T extends HTMLElement>(opts: PressOpts) {
  const fxRef = useRef<T>(null);
  const optsRef = useRef(opts);
  optsRef.current = opts;
  const st = useRef({ pid: -1, sx: 0, sy: 0, held: false, moved: false, timer: 0 });

  const handlers = useMemo(() => {
    const setVars = (vars: Record<string, string>) => {
      const el = fxRef.current;
      if (!el) return;
      for (const k in vars) el.style.setProperty(k, vars[k]);
    };
    const glow = (e: React.PointerEvent) => {
      const el = fxRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setVars({ "--gx": `${e.clientX - r.left}px`, "--gy": `${e.clientY - r.top}px` });
    };
    const stretch = (dx: number, dy: number) => {
      const S = optsRef.current.scale ?? 1.1;
      const ax = Math.min(Math.abs(dx), 48) / 48;
      const ay = Math.min(Math.abs(dy), 48) / 48;
      setVars({
        "--sx": (S * (1 + ax * 0.1 - ay * 0.04)).toFixed(4),
        "--sy": (S * (1 + ay * 0.1 - ax * 0.04)).toFixed(4),
        "--tx": `${clamp(dx * 0.16, -8, 8).toFixed(2)}px`,
        "--ty": `${clamp(dy * 0.16, -8, 8).toFixed(2)}px`,
      });
    };
    const release = () => {
      const el = fxRef.current;
      if (!el) return;
      el.classList.remove("is-pressed");
      for (const p of ["--sx", "--sy", "--tx", "--ty"]) el.style.removeProperty(p);
      el.style.setProperty("--go", "0");
    };
    const end = (e: React.PointerEvent, cancelled: boolean) => {
      const s = st.current;
      if (e.pointerId !== s.pid) return;
      s.pid = -1;
      window.clearTimeout(s.timer);
      if (s.held) {
        s.held = false;
        if (!cancelled) optsRef.current.onHoldEnd?.(e);
        return;
      }
      release();
      if (cancelled) return;
      const el = fxRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const inside =
        e.clientX >= r.left - 24 &&
        e.clientX <= r.right + 24 &&
        e.clientY >= r.top - 24 &&
        e.clientY <= r.bottom + 24;
      if (inside) optsRef.current.onTap?.();
    };
    return {
      onPointerDown: (e: React.PointerEvent) => {
        if (optsRef.current.disabled?.()) return;
        if (e.pointerType === "mouse" && e.button !== 0) return;
        const s = st.current;
        s.pid = e.pointerId;
        try {
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
        s.sx = e.clientX;
        s.sy = e.clientY;
        s.held = false;
        s.moved = false;
        fxRef.current?.classList.add("is-pressed");
        stretch(0, 0);
        glow(e);
        setVars({ "--go": "1" });
        if (optsRef.current.onHold) {
          s.timer = window.setTimeout(() => {
            s.held = true;
            release();
            optsRef.current.onHold?.();
          }, 340);
        }
      },
      onPointerMove: (e: React.PointerEvent) => {
        const s = st.current;
        if (e.pointerId !== s.pid) return;
        if (s.held) {
          optsRef.current.onHoldMove?.(e);
          return;
        }
        const dx = e.clientX - s.sx;
        const dy = e.clientY - s.sy;
        if (!s.moved && Math.hypot(dx, dy) > 8) {
          s.moved = true;
          window.clearTimeout(s.timer);
        }
        stretch(dx, dy);
        glow(e);
      },
      onPointerUp: (e: React.PointerEvent) => end(e, false),
      onPointerCancel: (e: React.PointerEvent) => end(e, true),
    };
  }, []);

  return { fxRef, handlers };
}

/** Round Liquid Glass icon button with press physics. `plain` drops the
 *  glass: a bare icon, as in the top bar. */
export function GlassCircle({
  label,
  onTap,
  children,
  className,
  plain,
}: {
  label: string;
  onTap: () => void;
  children: React.ReactNode;
  className?: string;
  plain?: boolean;
}) {
  const { fxRef, handlers } = usePressFx<HTMLButtonElement>({ scale: 1.16, onTap });
  return (
    <button
      ref={fxRef}
      type="button"
      aria-label={label}
      className={cn(
        "press-fx grid h-11 w-11 touch-none place-items-center rounded-full text-label",
        !plain && "glass",
        className,
      )}
      {...handlers}
      onClick={(e) => {
        if (e.detail === 0) onTap(); // keyboard activation
      }}
    >
      {!plain && <span className="g-glow" />}
      {children}
    </button>
  );
}

/* ---------- bottom bar: Gear · Trip · Map | ♥ · + (Instagram-style) ---------- */
/** Tab glyphs (lucide's backpack, map and map-pin). Selected, the shape fills
 *  solid and its inner lines (and holes) are cut out of the fill instead of
 *  drawn — the stroke weight never changes. */
const TAB_GLYPHS: Record<TabKey, { shape: string[]; detail: string[]; holes?: string[] }> = {
  shelf: {
    shape: ["M4 10a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"],
    detail: ["M8 10h8", "M8 18h8", "M8 22v-6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v6"],
  },
  trips: {
    shape: [
      "M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z",
    ],
    detail: ["M15 5.764v15", "M9 3.236v15"],
  },
  map: {
    shape: [
      "M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0",
    ],
    detail: [],
    holes: ["M12 7a3 3 0 1 1 0 6a3 3 0 1 1 0-6z"],
  },
};
const BACKPACK_HANDLE = "M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2";

function TabGlyph({ k, on }: { k: TabKey; on: boolean }) {
  const mask = useId();
  const g = TAB_GLYPHS[k];
  const holes = g.holes ?? [];
  return (
    <svg
      width={26}
      height={26}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {on && (
        <mask id={mask} maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24">
          <rect width="24" height="24" fill="#fff" stroke="none" />
          {g.detail.map((d) => (
            <path key={d} d={d} stroke="#000" strokeWidth={1.7} />
          ))}
          {holes.map((d) => (
            <path key={d} d={d} fill="#000" stroke="none" />
          ))}
        </mask>
      )}
      <g mask={on ? `url(#${mask})` : undefined}>
        {g.shape.map((d) => (
          <path key={d} d={d} fill={on ? "currentColor" : "none"} />
        ))}
      </g>
      {!on && [...g.detail, ...holes].map((d) => <path key={d} d={d} />)}
      {k === "shelf" && <path d={BACKPACK_HANDLE} />}
    </svg>
  );
}

const TABS: { key: TabKey; label: string }[] = [
  { key: "shelf", label: "Gear" },
  { key: "trips", label: "Trip" },
  { key: "map", label: "Map" },
];

/** Touch light that follows the finger across the glass bar. */
function glow(e: React.PointerEvent<HTMLElement>, on: boolean) {
  const el = e.currentTarget;
  const r = el.getBoundingClientRect();
  el.style.setProperty("--gx", `${e.clientX - r.left}px`);
  el.style.setProperty("--gy", `${e.clientY - r.top}px`);
  el.style.setProperty("--go", on ? "1" : "0");
}
const glowHandlers = {
  onPointerDown: (e: React.PointerEvent<HTMLElement>) => glow(e, true),
  onPointerUp: (e: React.PointerEvent<HTMLElement>) => glow(e, false),
  onPointerCancel: (e: React.PointerEvent<HTMLElement>) => glow(e, false),
  onPointerLeave: (e: React.PointerEvent<HTMLElement>) => glow(e, false),
};

/** Press feedback: the icon sinks while held and springs back on release.
 *  The sink always completes first, so even a quick tap reads as a press. */
const PRESS_IN = 90;
const pressAnims = new WeakMap<Element, { anim: Animation; at: number }>();
function pressIcon(e: React.PointerEvent<HTMLElement>, down: boolean) {
  const icon = e.currentTarget.querySelector("[data-press]");
  if (!icon) return;
  const held = pressAnims.get(icon);
  if (down) {
    held?.anim.cancel();
    const anim = icon.animate([{ transform: "scale(1)" }, { transform: "scale(0.84)" }], {
      duration: PRESS_IN,
      easing: "ease-out",
      fill: "forwards",
    });
    pressAnims.set(icon, { anim, at: performance.now() });
    return;
  }
  if (!held) return;
  pressAnims.delete(icon);
  const out = icon.animate([{ transform: "scale(0.84)" }, { transform: "scale(1)" }], {
    duration: 240,
    delay: Math.max(0, PRESS_IN - (performance.now() - held.at)),
    easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
    fill: "forwards",
  });
  out.onfinish = () => {
    held.anim.cancel();
    out.cancel();
  };
}
const pressHandlers = {
  onPointerDown: (e: React.PointerEvent<HTMLElement>) => pressIcon(e, true),
  onPointerUp: (e: React.PointerEvent<HTMLElement>) => pressIcon(e, false),
  onPointerCancel: (e: React.PointerEvent<HTMLElement>) => pressIcon(e, false),
  onPointerLeave: (e: React.PointerEvent<HTMLElement>) => pressIcon(e, false),
};

/**
 * Floating glass capsule: the tabs (one selection platter glides between
 * them), then the screen's actions (♥, +). Scrolling down shrinks it
 * (`compact`), scrolling back restores it; `hidden` slides it away for modes
 * that bring their own bottom actions.
 */
function BottomNav({
  tab,
  compact,
  hidden,
  onTab,
  onAdd,
  addLabel,
  fav,
  favLabel,
}: {
  tab: TabKey;
  compact: boolean;
  hidden: boolean;
  onTab: (t: TabKey) => void;
  onAdd?: () => void;
  addLabel?: string;
  /** The screen's hearted-only toggle; without one the ♥ folds away. */
  fav?: { on: boolean; toggle: () => void };
  favLabel: string;
}) {
  const item =
    "relative grid h-full w-[var(--gnb-item)] touch-manipulation place-items-center rounded-full text-label outline-none transition-[width] duration-[var(--dur-morph)] ease-[var(--spring-morph)]";
  const iconWrap =
    "grid place-items-center transition-transform duration-[var(--dur-morph)] ease-[var(--spring-morph)] [[data-compact]_&]:scale-[0.9]";

  return (
    <div
      className="bottom-nav pointer-events-none fixed inset-x-0 z-50 flex justify-center"
      style={
        {
          bottom: "var(--bar-bottom)",
          // sizes live here, not in the stylesheet: without them the items
          // would collapse to their icons
          "--gnb-h": compact ? "52px" : "62px",
          "--gnb-item": compact ? "54px" : "62px",
        } as React.CSSProperties
      }
      data-compact={compact || undefined}
      data-hidden={hidden || undefined}
      inert={hidden}
    >
      <nav
        aria-label="하단 바"
        className="gnb-island glass pointer-events-auto relative flex h-[var(--gnb-h)] rounded-full p-[5px] transition-[height] duration-[var(--dur-morph)] ease-[var(--spring-morph)]"
        {...glowHandlers}
      >
        <span className="g-glow" />
        {/* one selection platter that glides between the tabs */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-[5px] left-[5px] w-[var(--gnb-item)] rounded-full bg-black/[0.075] dark:bg-white/[0.14]"
          style={{
            transform: `translateX(calc(var(--gnb-item) * ${Math.max(0, TABS.findIndex((t) => t.key === tab))}))`,
            transition:
              "transform 0.45s var(--ease-tuck), width var(--dur-morph) var(--spring-morph)",
          }}
        />
        {TABS.map((t) => {
          const on = t.key === tab;
          return (
            <button
              key={t.key}
              type="button"
              aria-label={t.label}
              aria-current={on ? "page" : undefined}
              onClick={() => onTab(t.key)}
              className={item}
              {...pressHandlers}
            >
              <span className={iconWrap}>
                <span data-press className="grid place-items-center">
                  <TabGlyph k={t.key} on={on} />
                </span>
              </span>
            </button>
          );
        })}
        {/* ♥: hearted only — filled while on; folds away where there's
            nothing to heart (a trip's own page, the map) */}
        <button
          type="button"
          aria-label={favLabel}
          aria-pressed={Boolean(fav?.on)}
          aria-hidden={!fav}
          tabIndex={fav ? undefined : -1}
          onClick={() => fav?.toggle()}
          className={cn(
            item,
            "transition-[width,opacity]",
            !fav && "pointer-events-none w-0 opacity-0",
          )}
          {...pressHandlers}
        >
          <span className={iconWrap}>
            <span data-press className="grid place-items-center">
              <Heart size={26} strokeWidth={1.8} fill={fav?.on ? "currentColor" : "none"} />
            </span>
          </span>
        </button>
        {/* plain + (drawn a touch larger: a bare cross reads small next to
            the boxed icons) */}
        <button
          type="button"
          aria-label={addLabel ?? "Add"}
          onClick={() => onAdd?.()}
          disabled={!onAdd}
          className={cn(item, "disabled:opacity-35")}
          {...pressHandlers}
        >
          <span className={iconWrap}>
            <span data-press className="grid place-items-center">
              <Plus size={30} strokeWidth={1.7} />
            </span>
          </span>
        </button>
      </nav>
    </div>
  );
}

/**
 * Scroll direction → bars. Scrolling down tucks the top bar away and shrinks
 * the bottom one; any scroll back up (or reaching the top) restores both.
 * Programmatic jumps (tab switches, sheets locking the page) don't count.
 */
let quietUntilGlobal = 0;
/** Keep the next programmatic scroll (a jump to a section) from tucking the bars. */
export function quietScrollTuck(ms = 400) {
  quietUntilGlobal = performance.now() + ms;
}

function useScrollTuck(resetKey: unknown) {
  const [tucked, setTucked] = useState(false);
  const [key, setKey] = useState(resetKey);
  if (key !== resetKey) {
    // A new screen starts with both bars out.
    setKey(resetKey);
    setTucked(false);
  }
  const st = useRef({ last: 0, acc: 0, quietUntil: 0 });

  useEffect(() => {
    const s = st.current;
    s.last = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      const dy = y - s.last;
      s.last = y;
      if (document.body.style.position === "fixed") return; // a sheet holds the page
      // At the top the bars are always out — however we got there (a jump to
      // a new screen included).
      if (y < 24) {
        s.acc = 0;
        setTucked(false);
        return;
      }
      if (performance.now() < Math.max(s.quietUntil, quietUntilGlobal)) return;
      if (Math.abs(dy) > 240) return; // scroll restore, not a gesture
      if (dy === 0) return;
      if (dy > 0 !== s.acc > 0) s.acc = 0;
      s.acc += dy;
      if (s.acc > 14) setTucked(true);
      else if (s.acc < -14) setTucked(false);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // …and the scroll offset it restores isn't a gesture.
  useEffect(() => {
    const s = st.current;
    s.quietUntil = performance.now() + 250;
    s.acc = 0;
    s.last = window.scrollY;
  }, [resetKey]);

  return tucked;
}

/* ---------- "more" button that morphs into a menu ---------- */
const MENU_W = 244;

function MorphMenu({
  items,
  open,
  setOpen,
}: {
  items: TopBarMenuItem[];
  open: boolean;
  setOpen: (o: boolean) => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const hlRef = useRef<HTMLSpanElement>(null);
  const hlItem = useRef<HTMLElement | null>(null);
  const [menuH, setMenuH] = useState(260);
  const menuPid = useRef(-1);

  useLayoutEffect(() => {
    if (listRef.current) setMenuH(listRef.current.offsetHeight);
  }, [items]);

  const showHl = (it: HTMLElement) => {
    const hl = hlRef.current;
    if (!hl || hlItem.current === it) return;
    if (!hlItem.current) {
      hl.style.transition = "opacity 0.14s ease";
      hl.style.setProperty("--hl-y", `${it.offsetTop}px`);
      void hl.offsetWidth;
      hl.style.transition = "";
    } else {
      hl.style.setProperty("--hl-y", `${it.offsetTop}px`);
    }
    hl.style.opacity = "1";
    hlItem.current = it;
  };
  const hideHl = () => {
    if (hlRef.current) hlRef.current.style.opacity = "0";
    hlItem.current = null;
  };
  const itemAt = (e: React.PointerEvent) =>
    (document.elementFromPoint(e.clientX, e.clientY)?.closest?.("[data-mi]") as HTMLElement | null) ??
    null;
  const hlAt = (e: React.PointerEvent) => {
    const it = itemAt(e);
    if (it) showHl(it);
    else hideHl();
  };
  const select = (el: HTMLElement) => {
    showHl(el);
    const id = el.dataset.mi;
    window.setTimeout(() => {
      setOpen(false);
      hideHl();
      items.find((i) => i.id === id)?.onSelect();
    }, 130);
  };

  useEffect(() => {
    if (!open) hideHl();
  }, [open]);

  const { fxRef, handlers } = usePressFx<HTMLDivElement>({
    scale: 1.16,
    disabled: () => open,
    onTap: () => setOpen(true),
    onHold: () => setOpen(true),
    onHoldMove: hlAt,
    onHoldEnd: (e) => {
      const it = itemAt(e);
      if (it) select(it);
      else hideHl();
    },
  });

  return (
    <div className="relative h-11 w-11">
      <div
        ref={fxRef}
        className={cn(
          "press-fx absolute right-0 top-0 overflow-hidden text-label",
          // a bare ⋯ in the bar; the glass only comes with the open menu
          open && "glass-strong",
        )}
        style={{
          width: open ? MENU_W : 44,
          height: open ? menuH : 44,
          borderRadius: open ? 30 : 22,
          transition:
            "width var(--dur-morph) var(--spring-morph), height var(--dur-morph) var(--spring-morph), border-radius var(--dur-morph) var(--spring-morph), background-color 0.3s ease, transform var(--t-dur, var(--dur-press)) var(--t-ease, var(--spring-press))",
        }}
      >
        {open && <span className="g-glow" />}
        <button
          type="button"
          aria-label="더보기"
          aria-haspopup="menu"
          aria-expanded={open}
          className={cn(
            "absolute right-0 top-0 z-[1] grid h-11 w-11 touch-none place-items-center transition-[opacity,transform] duration-200",
            open && "scale-60 opacity-0",
          )}
          {...handlers}
          onClick={(e) => {
            if (e.detail === 0) setOpen(true);
          }}
        >
          <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true">
            <circle cx="5" cy="12" r="1.7" />
            <circle cx="12" cy="12" r="1.7" />
            <circle cx="19" cy="12" r="1.7" />
          </svg>
        </button>
        <div
          ref={listRef}
          role="menu"
          aria-hidden={!open}
          inert={!open}
          className={cn(
            "absolute right-0 top-0 z-[2] origin-top-right touch-none py-2",
            open
              ? "pointer-events-auto scale-100 opacity-100 transition-[opacity,transform] delay-[60ms] duration-[260ms]"
              : "pointer-events-none scale-[0.94] opacity-0 transition-[opacity,transform] duration-[120ms]",
          )}
          style={{ width: MENU_W }}
          onPointerDown={(e) => {
            if (!open) return;
            menuPid.current = e.pointerId;
            try {
              (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            } catch {
              /* ignore */
            }
            hlAt(e);
          }}
          onPointerMove={(e) => {
            if (e.pointerId === menuPid.current) hlAt(e);
          }}
          onPointerUp={(e) => {
            if (e.pointerId !== menuPid.current) return;
            menuPid.current = -1;
            const it = itemAt(e);
            if (it) select(it);
            else hideHl();
          }}
          onPointerCancel={() => {
            menuPid.current = -1;
            hideHl();
          }}
          onKeyDown={(e) => {
            const els = Array.from(
              listRef.current?.querySelectorAll<HTMLElement>("[data-mi]") ?? [],
            );
            const i = els.indexOf(document.activeElement as HTMLElement);
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              const n = (i + (e.key === "ArrowDown" ? 1 : -1) + els.length) % els.length;
              els[n]?.focus();
              if (els[n]) showHl(els[n]);
            }
          }}
        >
          <span
            ref={hlRef}
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-2 top-0 z-0 h-[46px] rounded-[15px] opacity-0"
            style={{
              background: "var(--g-hl)",
              transform: "translateY(var(--hl-y, 0px))",
              transition: "transform 0.24s var(--spring-press), opacity 0.14s ease",
            }}
          />
          {items.map((it) => (
            <div key={it.id}>
              {it.group && <div className="mx-5 my-1.5 h-px bg-separator" role="separator" />}
              <button
                type="button"
                role="menuitem"
                tabIndex={-1}
                data-mi={it.id}
                onClick={(e) => {
                  if (e.detail === 0) select(e.currentTarget);
                }}
                className={cn(
                  "relative z-[1] flex h-[46px] w-full items-center gap-3.5 px-5 text-left text-[17px] outline-none",
                  it.danger ? "text-red" : "text-label",
                )}
              >
                <span className="grid w-[21px] shrink-0 place-items-center">{it.icon}</span>
                <span className="min-w-0 flex-1 truncate">{it.label}</span>
                {it.checked && <Check size={18} strokeWidth={2.4} className="shrink-0" />}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------- provider + bar ---------- */
export function TopBarProvider({
  tab,
  onTabChange,
  onOpenSettings,
  children,
}: {
  tab: TabKey;
  onTabChange: (t: TabKey) => void;
  onOpenSettings: () => void;
  children: React.ReactNode;
}) {
  const [configs, setConfigs] = useState<Partial<Record<TabKey, TopBarConfig>>>({});
  const owners = useRef<Partial<Record<TabKey, symbol>>>({});
  const [menuOpen, setMenuOpen] = useState(false);
  const config = configs[tab] ?? null;
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);
  const [systemDark, setSystemDark] = useState(false);
  useEffect(() => {
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const sync = () => setSystemDark(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  const isDark = theme === "dark" || (theme === "system" && systemDark);

  const set = useCallback<Setter>((c, owner, pane) => {
    if (c === null) {
      if (owners.current[pane] === owner) {
        delete owners.current[pane];
        setConfigs((m) => {
          const n = { ...m };
          delete n[pane];
          return n;
        });
      }
      return;
    }
    owners.current[pane] = owner;
    setConfigs((m) => ({ ...m, [pane]: c }));
  }, []);

  // Physically-sampled spring curves for the glass motion.
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!CSS.supports("transition-timing-function", "linear(0, 1)")) return;
    const root = document.documentElement;
    const m = spring(250, 21);
    const p = spring(520, 26);
    root.style.setProperty("--spring-morph", m.easing);
    root.style.setProperty("--dur-morph", `${m.duration}s`);
    root.style.setProperty("--spring-press", p.easing);
    root.style.setProperty("--dur-press", `${p.duration}s`);
  }, []);

  // A screen change closes the menu.
  useEffect(() => setMenuOpen(false), [config?.onBack, tab]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const closeIfOpen = () => {
    if (!menuOpen) return false;
    setMenuOpen(false);
    return true;
  };
  // Scrolling down tucks the top bar away and shrinks the bottom one.
  // The bars stay out while the menu is open or a search is on (its ✕ lives
  // in the bar); a new screen, or opening/closing search, starts them out.
  const searching = Boolean(config?.searching);
  const tucked =
    useScrollTuck(`${tab}|${Boolean(config?.onBack)}|${searching}`) && !menuOpen && !searching;
  useEffect(() => {
    const root = document.documentElement;
    if (tucked) root.dataset.bars = "tucked";
    else delete root.dataset.bars;
  }, [tucked]);

  // Bottom bar: another tab switches; the current one pops a detail screen
  // back to its list, or scrolls a list back to the top.
  const tapTab = (t: TabKey) => {
    if (closeIfOpen()) return;
    if (t !== tab) onTabChange(t);
    else if (config?.onBack) config.onBack();
    else window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const menu: TopBarMenuItem[] = [
    ...(config?.menu ?? []),
    {
      id: "theme",
      label: isDark ? "라이트 모드" : "다크 모드",
      icon: isDark ? <Sun size={19} /> : <Moon size={19} />,
      group: Boolean(config?.menu?.length),
      onSelect: () => setTheme(isDark ? "light" : "dark"),
    },
    {
      id: "settings",
      label: "설정",
      icon: <Settings size={19} />,
      onSelect: onOpenSettings,
    },
  ];

  return (
    <TopBarCtx.Provider value={set}>
      {children}
      <div className="scroll-edge-top" aria-hidden="true" />
      {menuOpen && (
        // A tap outside the open menu only closes it, like iOS.
        <div
          className="fixed inset-0 z-[45]"
          onPointerDown={(e) => {
            e.preventDefault();
            setMenuOpen(false);
          }}
        />
      )}
      <nav
        aria-label="상단 바"
        className="pointer-events-none fixed inset-x-0 top-0 z-50 mx-auto max-w-2xl"
      >
        {/* The tuck slides this inner row; pull-to-refresh moves the nav itself. */}
        <div
          className="top-bar-row relative flex items-center justify-between px-[var(--gutter)] pt-[var(--bar-top)]"
          data-tucked={tucked || undefined}
          inert={tucked}
        >
        <div className="pointer-events-auto -ml-2.5 flex h-12 items-center">
          {config?.onBack ? (
            <GlassCircle
              plain
              label="뒤로"
              onTap={() => {
                if (!closeIfOpen()) config.onBack?.();
              }}
            >
              <ChevronLeft size={26} strokeWidth={2.2} className="-ml-0.5" />
            </GlassCircle>
          ) : config?.left ? (
            <GlassCircle
              plain
              label={config.left.label}
              onTap={() => {
                if (!closeIfOpen()) config.left?.onTap();
              }}
            >
              {config.left.icon}
            </GlassCircle>
          ) : config?.onSearch ? (
            <GlassCircle
              plain
              label={config.searching ? "검색 닫기" : "검색"}
              onTap={() => {
                if (!closeIfOpen()) config.onSearch?.();
              }}
            >
              {config.searching ? (
                <X size={25} strokeWidth={2} />
              ) : (
                <Search size={24} strokeWidth={2} />
              )}
            </GlassCircle>
          ) : (
            <span className="block w-11" aria-hidden="true" />
          )}
          {config?.leftActions?.map((a) => (
            <GlassCircle
              plain
              key={a.id}
              label={a.label}
              onTap={() => {
                if (!closeIfOpen()) a.onTap();
              }}
            >
              {a.icon}
            </GlassCircle>
          ))}
        </div>
        {/* centred on the bar itself, whatever the side groups' widths */}
        {config?.centerSlot ? (
          <div className="pointer-events-auto absolute left-1/2 top-[var(--bar-top)] flex h-12 -translate-x-1/2 items-center">
            {config.centerSlot}
          </div>
        ) : config?.center ? (
          <div className="pointer-events-auto absolute left-1/2 top-[var(--bar-top)] flex h-12 -translate-x-1/2 items-center">
            <span className="flex h-11 items-center px-2 text-[17px] font-semibold tabular tracking-[-0.01em] text-label">
              {config.center}
            </span>
          </div>
        ) : null}
        <div className="pointer-events-auto -mr-2.5 flex h-12 items-center">
          {config?.actions?.map((a) => (
            <GlassCircle
              plain
              key={a.id}
              label={a.label}
              onTap={() => {
                if (!closeIfOpen()) a.onTap();
              }}
            >
              {a.icon}
            </GlassCircle>
          ))}
          {menu.length > 0 ? (
            <MorphMenu items={menu} open={menuOpen} setOpen={setMenuOpen} />
          ) : (
            <span className="block w-11" aria-hidden="true" />
          )}
        </div>
        </div>
      </nav>
      <BottomNav
        tab={tab}
        compact={tucked}
        hidden={Boolean(config?.hideNav)}
        onTab={tapTab}
        onAdd={
          config?.onAdd
            ? () => {
                if (!closeIfOpen()) config.onAdd?.();
              }
            : undefined
        }
        addLabel={config?.addLabel}
        fav={
          config?.favorite
            ? {
                on: config.favorite.on,
                toggle: () => {
                  if (!closeIfOpen()) config.favorite?.toggle();
                },
              }
            : undefined
        }
        favLabel={tab === "trips" ? "하트한 트립만 보기" : "하트한 장비만 보기"}
      />
    </TopBarCtx.Provider>
  );
}
