"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Check, ChevronLeft, Search, Settings, X } from "lucide-react";
import { cn } from "@/lib/cn";

export type TabKey = "shelf" | "trips";

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
  /** Left glass button toggles this screen's search. */
  onSearch?: () => void;
  searching?: boolean;
  menu?: TopBarMenuItem[];
}

type Setter = (config: TopBarConfig | null, owner: symbol) => void;
const TopBarCtx = createContext<Setter | null>(null);

/**
 * Register what the floating top bar shows while this screen is mounted.
 * Handlers are read through a ref, so they always see current state; the bar
 * only re-renders when something visible (labels, checks) changes.
 */
export function useTopBar(config: TopBarConfig) {
  const set = useContext(TopBarCtx);
  const ref = useRef(config);
  ref.current = config;
  const [owner] = useState(() => Symbol("topbar"));
  const sig = JSON.stringify({
    back: Boolean(config.onBack),
    center: config.center ?? null,
    search: Boolean(config.onSearch),
    searching: Boolean(config.searching),
    menu: config.menu?.map((i) => [i.id, i.label, !!i.checked, !!i.danger, !!i.group]),
  });
  useEffect(() => {
    if (!set) return;
    const c = ref.current;
    set(
      {
        onBack: c.onBack ? () => ref.current.onBack?.() : undefined,
        center: c.center,
        onSearch: c.onSearch ? () => ref.current.onSearch?.() : undefined,
        searching: c.searching,
        menu: c.menu?.map((item) => ({
          ...item,
          onSelect: () => ref.current.menu?.find((x) => x.id === item.id)?.onSelect(),
        })),
      },
      owner,
    );
    // sig captures every visible field
  }, [set, owner, sig]);
  useEffect(() => () => set?.(null, owner), [set, owner]);
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

/** Round Liquid Glass icon button with press physics. */
export function GlassCircle({
  label,
  onTap,
  children,
  className,
}: {
  label: string;
  onTap: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  const { fxRef, handlers } = usePressFx<HTMLButtonElement>({ scale: 1.16, onTap });
  return (
    <button
      ref={fxRef}
      type="button"
      aria-label={label}
      className={cn(
        "glass press-fx grid h-11 w-11 touch-none place-items-center rounded-full text-label",
        className,
      )}
      {...handlers}
      onClick={(e) => {
        if (e.detail === 0) onTap(); // keyboard activation
      }}
    >
      <span className="g-glow" />
      {children}
    </button>
  );
}

/* ---------- Gear | Trip segmented tabs ---------- */
const TABS: { key: TabKey; label: string }[] = [
  { key: "shelf", label: "Gear" },
  { key: "trips", label: "Trip" },
];

function TabSegment({
  tab,
  onChange,
  blocked,
}: {
  tab: TabKey;
  onChange: (t: TabKey) => void;
  /** Returns true when the tap should only dismiss something (open menu). */
  blocked: () => boolean;
}) {
  const idx = Math.max(0, TABS.findIndex((t) => t.key === tab));
  const idxRef = useRef(idx);
  idxRef.current = idx;
  const segRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const d = useRef({ pid: -1, startX: 0, startPx: 0, moved: false, lifted: false, px: 0, w: 0, quiet: false });
  const prevIdx = useRef(idx);
  const [lifted, setLifted] = useState(false);

  // Items are sized to their labels, so the platter takes each item's own
  // offset and width (relative to its resting origin at the 4px inset).
  const slot = useCallback((i: number) => {
    const b = btnRefs.current[i];
    return b ? { x: b.offsetLeft - 4, w: b.offsetWidth } : { x: 0, w: 0 };
  }, []);

  const setPill = useCallback((px: number, w: number, sx = 1, sy = 1, fast = false) => {
    const p = pillRef.current;
    if (!p) return;
    d.current.px = px;
    d.current.w = w;
    p.style.setProperty("--px", `${px}px`);
    p.style.width = `${w}px`;
    p.style.setProperty("--psx", String(sx));
    p.style.setProperty("--psy", String(sy));
    p.style.transitionDuration = fast ? "0.12s, 0.12s, 0.2s, 0.2s" : "";
  }, []);

  const rest = useCallback(
    (i: number, sx = 1, sy = 1) => {
      const s = slot(i);
      setPill(s.x, s.w, sx, sy);
    },
    [slot, setPill],
  );

  useLayoutEffect(() => {
    if (prevIdx.current === idx) {
      rest(idx);
      return;
    }
    prevIdx.current = idx;
    if (d.current.quiet) {
      d.current.quiet = false;
      rest(idx);
      return;
    }
    // the platter stretches as it travels, then settles — liquid, not sliding
    rest(idx, 1.16, 0.9);
    const t = window.setTimeout(() => rest(idx), 110);
    return () => window.clearTimeout(t);
  }, [idx, rest]);

  // Label widths shift once the web font loads; keep the platter on its item.
  useEffect(() => {
    const el = segRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      if (d.current.pid === -1) rest(idxRef.current);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [rest]);

  const under = (clientX: number) => {
    let best = 0;
    let dist = Infinity;
    btnRefs.current.forEach((b, i) => {
      if (!b) return;
      const r = b.getBoundingClientRect();
      const dd = clientX < r.left ? r.left - clientX : clientX > r.right ? clientX - r.right : 0;
      if (dd < dist) {
        dist = dd;
        best = i;
      }
    });
    return best;
  };
  // Width while dragging: interpolate between the neighbouring items' widths.
  const widthAt = (px: number) => {
    const n = TABS.length;
    for (let i = 0; i < n - 1; i++) {
      const a = slot(i);
      const b = slot(i + 1);
      if (px <= b.x || i === n - 2) {
        const t = clamp((px - a.x) / Math.max(1, b.x - a.x), 0, 1);
        return a.w + (b.w - a.w) * t;
      }
    }
    return slot(0).w;
  };
  const nearest = (px: number, w: number) => {
    const c = px + w / 2;
    let best = 0;
    let dist = Infinity;
    TABS.forEach((_, i) => {
      const s = slot(i);
      const dd = Math.abs(s.x + s.w / 2 - c);
      if (dd < dist) {
        dist = dd;
        best = i;
      }
    });
    return best;
  };
  const glow = (e: React.PointerEvent, on: boolean) => {
    const el = segRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--gx", `${e.clientX - r.left}px`);
    el.style.setProperty("--gy", `${e.clientY - r.top}px`);
    el.style.setProperty("--go", on ? "1" : "0");
  };

  return (
    <div
      ref={segRef}
      role="tablist"
      aria-label="화면 전환"
      className="glass relative flex h-12 touch-none rounded-full p-1"
      onPointerDown={(e) => {
        if (blocked()) return;
        if (e.pointerType === "mouse" && e.button !== 0) return;
        const s = d.current;
        s.pid = e.pointerId;
        try {
          segRef.current?.setPointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
        s.startX = e.clientX;
        s.startPx = slot(idx).x;
        s.moved = false;
        glow(e, true);
        if (under(e.clientX) === idx) {
          // pressing the selected tab lifts its platter into a lens to drag
          s.lifted = true;
          setLifted(true);
          rest(idx, 1.08, 1.08);
        }
      }}
      onPointerMove={(e) => {
        const s = d.current;
        if (e.pointerId !== s.pid) return;
        const dx = e.clientX - s.startX;
        if (!s.moved && Math.abs(dx) > 6) s.moved = true;
        glow(e, true);
        if (!s.lifted || !s.moved) return;
        let px = s.startPx + dx;
        const min = slot(0).x;
        const max = slot(TABS.length - 1).x;
        if (px < min) px = min + (px - min) * 0.3; // rubber-band past the ends
        if (px > max) px = max + (px - max) * 0.3;
        setPill(px, widthAt(px), 1.1, 1.06, true);
      }}
      onPointerUp={(e) => {
        const s = d.current;
        if (e.pointerId !== s.pid) return;
        s.pid = -1;
        glow(e, false);
        const wasLifted = s.lifted;
        s.lifted = false;
        setLifted(false);
        let next = under(e.clientX);
        if (wasLifted && s.moved) {
          next = nearest(s.px, s.w);
          s.quiet = true; // already travelled under the finger — no stretch
        }
        if (next === idx) {
          s.quiet = false;
          rest(idx);
        } else onChange(TABS[next].key);
      }}
      onPointerCancel={(e) => {
        const s = d.current;
        s.pid = -1;
        s.lifted = false;
        setLifted(false);
        glow(e, false);
        rest(idx);
      }}
    >
      <span className="g-glow" />
      <span
        ref={pillRef}
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute left-1 top-1 z-0 h-10 rounded-full",
          lifted
            ? "bg-white/45 shadow-[0_4px_14px_rgba(0,0,0,0.12),0_0_0_0.5px_rgba(0,0,0,0.08),inset_0_1px_0.5px_rgba(255,255,255,0.95)] dark:bg-white/[0.22] dark:shadow-[0_4px_14px_rgba(0,0,0,0.4),0_0_0_0.5px_rgba(255,255,255,0.12),inset_0_1px_0_rgba(255,255,255,0.25)]"
            : "bg-black/[0.075] dark:bg-white/[0.14]",
        )}
        style={{
          transform: "translateX(var(--px, 0px)) scale(var(--psx, 1), var(--psy, 1))",
          transitionProperty: "transform, width, background-color, box-shadow",
          transitionDuration: "var(--dur-press), var(--dur-press), 0.2s, 0.2s",
          transitionTimingFunction: "var(--spring-press), var(--spring-press), ease, ease",
        }}
      />
      {TABS.map((t, i) => (
        <button
          key={t.key}
          ref={(el) => {
            btnRefs.current[i] = el;
          }}
          type="button"
          role="tab"
          aria-selected={i === idx}
          tabIndex={i === idx ? 0 : -1}
          onClick={(e) => {
            if (e.detail === 0) onChange(t.key);
          }}
          onKeyDown={(e) => {
            if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
            e.preventDefault();
            const n = clamp(idx + (e.key === "ArrowRight" ? 1 : -1), 0, TABS.length - 1);
            onChange(TABS[n].key);
          }}
          className="relative z-10 h-10 whitespace-nowrap rounded-full px-[18px] text-[17px] font-medium tracking-[-0.01em] text-label"
        >
          {t.label}
        </button>
      ))}
    </div>
  );
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
          open ? "glass-strong" : "glass",
        )}
        style={{
          width: open ? MENU_W : 44,
          height: open ? menuH : 44,
          borderRadius: open ? 30 : 22,
          transition:
            "width var(--dur-morph) var(--spring-morph), height var(--dur-morph) var(--spring-morph), border-radius var(--dur-morph) var(--spring-morph), background-color 0.3s ease, transform var(--t-dur, var(--dur-press)) var(--t-ease, var(--spring-press))",
        }}
      >
        <span className="g-glow" />
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
  const [config, setConfig] = useState<TopBarConfig | null>(null);
  const ownerRef = useRef<symbol | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const set = useCallback<Setter>((c, owner) => {
    if (c === null) {
      if (ownerRef.current === owner) {
        ownerRef.current = null;
        setConfig(null);
      }
      return;
    }
    ownerRef.current = owner;
    setConfig(c);
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
  const menu: TopBarMenuItem[] = [
    ...(config?.menu ?? []),
    {
      id: "settings",
      label: "설정",
      icon: <Settings size={19} />,
      group: Boolean(config?.menu?.length),
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
        className="pointer-events-none fixed inset-x-0 top-0 z-50 mx-auto flex max-w-2xl items-center justify-between px-4 pt-[var(--bar-top)]"
      >
        <div className="pointer-events-auto flex h-12 items-center">
          {config?.onBack ? (
            <GlassCircle
              label="뒤로"
              onTap={() => {
                if (!closeIfOpen()) config.onBack?.();
              }}
            >
              <ChevronLeft size={26} strokeWidth={2.2} className="-ml-0.5" />
            </GlassCircle>
          ) : config?.onSearch ? (
            <GlassCircle
              label={config.searching ? "검색 닫기" : "검색"}
              onTap={() => {
                if (!closeIfOpen()) config.onSearch?.();
              }}
            >
              {config.searching ? (
                <X size={22} strokeWidth={2.2} />
              ) : (
                <Search size={21} strokeWidth={2.2} />
              )}
            </GlassCircle>
          ) : (
            <span className="block w-11" aria-hidden="true" />
          )}
        </div>
        <div className="pointer-events-auto flex h-12 items-center">
          {config?.onBack ? (
            config.center ? (
              <span className="glass flex h-11 items-center rounded-full px-[18px] text-[17px] font-medium tabular tracking-[-0.01em] text-label">
                {config.center}
              </span>
            ) : null
          ) : (
            <TabSegment tab={tab} onChange={onTabChange} blocked={closeIfOpen} />
          )}
        </div>
        <div className="pointer-events-auto flex h-12 items-center">
          {menu.length > 0 ? (
            <MorphMenu items={menu} open={menuOpen} setOpen={setMenuOpen} />
          ) : (
            <span className="block w-11" aria-hidden="true" />
          )}
        </div>
      </nav>
    </TopBarCtx.Provider>
  );
}
