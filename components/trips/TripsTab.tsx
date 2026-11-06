"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDown, ArrowUp, ChevronRight, Map, Plus, Search, X } from "lucide-react";
import { useAppStore } from "@/lib/store";
import type { Trip } from "@/lib/types";
import { formatWeightSmart } from "@/lib/units";
import { formatTripRange, tripStart } from "@/lib/dates";
import { tripCompanions } from "@/lib/trips";
import { cn } from "@/lib/cn";
import { keepRowInPlace } from "@/lib/scrollAnchor";

/** "-5~12℃", a single bound like "12℃", or "" when no temps are set. */
function tempRange(low?: string, high?: string): string {
  if (low && high) return `${low}~${high}℃`;
  if (low || high) return `${low ?? high}℃`;
  return "";
}
import { useTopBar } from "../TopBar";
import { InkButton } from "../ui/Glass";
import { TagChip } from "../ui/TagChip";
import { SwipeRow, SwipeDeleteButton, SwipeHeartButton } from "../ui/SwipeRow";
import { TripDetail } from "./TripDetail";
import { TbdTag } from "./TbdTag";

type TripSort = "date" | "created" | "temp";

const SORTS: { key: TripSort; label: string }[] = [
  { key: "date", label: "Date" },
  { key: "created", label: "Created" },
  { key: "temp", label: "Temp" },
];

const SORT_KEY = "bpl-trip-sort";
const SORT_DIR_KEY = "bpl-trip-sort-dir";
type SortDir = "asc" | "desc";
/** Each sort's natural order: newest first; coldest first for Temp. */
const DEFAULT_DIR: Record<TripSort, SortDir> = { date: "desc", created: "desc", temp: "asc" };

/** A trip's temperature for sorting: the middle of its low~high range, or
 *  whichever bound it has; null without any. */
function tripTemp(t: Trip): number | null {
  const lo = parseFloat(t.tempLow ?? "");
  const hi = parseFloat(t.tempHigh ?? "");
  if (Number.isFinite(lo) && Number.isFinite(hi)) return (lo + hi) / 2;
  if (Number.isFinite(lo)) return lo;
  return Number.isFinite(hi) ? hi : null;
}
/** With: an on/off layer over any sort — each row shows who came along. */
const WITH_KEY = "bpl-trip-with";

export function TripsTab({
  openTripId,
  onConsumeOpen,
  returnTo,
}: {
  openTripId: string | null;
  onConsumeOpen: () => void;
  /** The trip was opened from another tab (the map): going back returns
   *  there — its screen is what the swipe-back reveals — instead of to the
   *  trip list. */
  returnTo?: {
    pane: () => HTMLDivElement | null;
    go: (listScroll: number, swiped: boolean) => void;
  } | null;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const trips = useAppStore((s) => s.trips);
  // The list stays mounted (hidden) under an open trip so the detail's
  // swipe-back can reveal it, and keeps its own scroll offset.
  const listRef = useRef<HTMLDivElement>(null);
  const listScroll = useRef(0);
  const firstLayout = useRef(true);

  const open = useCallback((id: string) => {
    listScroll.current = window.scrollY;
    setActiveId(id);
  }, []);

  useEffect(() => {
    if (openTripId && trips[openTripId]) {
      setActiveId(openTripId);
      onConsumeOpen();
    }
  }, [openTripId, trips, onConsumeOpen]);

  const showDetail = Boolean(activeId && trips[activeId]);
  useLayoutEffect(() => {
    if (firstLayout.current) {
      firstLayout.current = false;
      return;
    }
    window.scrollTo(0, showDetail ? 0 : listScroll.current);
  }, [showDetail]);

  return (
    <>
      <div ref={listRef} hidden={showDetail}>
        <TripList onOpen={open} active={!showDetail} />
      </div>
      {showDetail && activeId && (
        <TripDetail
          key={activeId}
          tripId={activeId}
          onBack={(swiped) => {
            setActiveId(null);
            returnTo?.go(listScroll.current, Boolean(swiped));
          }}
          onOpenTrip={(id) => {
            setActiveId(id);
            window.scrollTo(0, 0);
          }}
          underlay={() => (returnTo ? returnTo.pane() : listRef.current)}
          underlayScroll={() => (returnTo ? 0 : listScroll.current)}
        />
      )}
    </>
  );
}

function TripList({ onOpen, active }: { onOpen: (id: string) => void; active: boolean }) {
  const trips = useAppStore((s) => s.trips);
  const tripOrder = useAppStore((s) => s.tripOrder);
  const createTrip = useAppStore((s) => s.createTrip);
  const deleteTrip = useAppStore((s) => s.deleteTrip);
  const updateTrip = useAppStore((s) => s.updateTrip);
  // ♥ in the bottom bar: only hearted trips (not remembered).
  const [favOnly, setFavOnly] = useState(false);
  const [swipeOpenId, setSwipeOpenId] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  // TBD chip: shows only the trips whose plan isn't settled (not remembered).
  const [tbdOnly, setTbdOnly] = useState(false);
  // Sort preference, remembered across sessions. Safe to read directly: the
  // list only mounts client-side (AppShell gates on hydration).
  const [sort, setSort] = useState<TripSort>(() => {
    if (typeof window === "undefined") return "created";
    const v = localStorage.getItem(SORT_KEY);
    return v === "date" || v === "temp" ? v : "created";
  });
  const [showWith, setShowWith] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(WITH_KEY) === "1";
  });
  function toggleWith() {
    const next = !showWith;
    setShowWith(next);
    try {
      localStorage.setItem(WITH_KEY, next ? "1" : "0");
    } catch {
      /* ignore */
    }
  }
  const [dir, setDir] = useState<SortDir>(() => {
    if (typeof window === "undefined") return "desc";
    const v = localStorage.getItem(SORT_DIR_KEY);
    return v === "asc" || v === "desc" ? v : DEFAULT_DIR[sort];
  });
  /** Picking a sort applies it in its natural order; picking the one already
   *  applied flips the order. */
  function changeSort(s: TripSort) {
    const next = !tbdOnly && s === sort ? (dir === "asc" ? "desc" : "asc") : DEFAULT_DIR[s];
    setSort(s);
    setDir(next);
    setTbdOnly(false);
    try {
      localStorage.setItem(SORT_KEY, s);
      localStorage.setItem(SORT_DIR_KEY, next);
    } catch {
      /* ignore */
    }
  }

  const sortedIds = useMemo(() => {
    const ids = tripOrder.filter((id) => trips[id]);
    const flip = dir === "asc" ? 1 : -1;
    // tripOrder is newest-created first
    if (sort === "created") return dir === "desc" ? ids : [...ids].reverse();
    if (sort === "temp") {
      // trips without a temperature sink to the bottom either way
      return [...ids].sort((a, b) => {
        const ta = tripTemp(trips[a]);
        const tb = tripTemp(trips[b]);
        if (ta === null && tb === null) return 0;
        if (ta === null) return 1;
        if (tb === null) return -1;
        return (ta - tb) * flip;
      });
    }
    // by date: undated trips sink to the bottom either way
    return [...ids].sort((a, b) => {
      const sa = tripStart(trips[a]) ?? "";
      const sb = tripStart(trips[b]) ?? "";
      if (!sa && !sb) return 0;
      if (!sa) return 1;
      if (!sb) return -1;
      return sa.localeCompare(sb) * flip;
    });
  }, [tripOrder, trips, sort, dir]);

  const q = query.trim().toLowerCase();
  const shownIds = useMemo(() => {
    const ids = favOnly ? sortedIds.filter((id) => trips[id].favorite) : sortedIds;
    if (!q) return ids;
    return ids.filter((id) => {
      const t = trips[id];
      return [t.name, t.place ?? "", ...tripCompanions(t)].some((v) =>
        v.toLowerCase().includes(q),
      );
    });
  }, [sortedIds, trips, q, favOnly]);
  // Settled trips first; TBD ones get their own group at the bottom.
  const plannedIds = shownIds.filter((id) => !trips[id].tbd);
  const tbdIds = shownIds.filter((id) => trips[id].tbd);
  const hasTbd = tripOrder.some((id) => trips[id]?.tbd);

  function renderRow(id: string) {
    const t = trips[id];
    return t ? (
      <TripRow
        key={id}
        trip={t}
        showCompanions={showWith}
        onOpen={() => {
          if (swipeOpenId) {
            setSwipeOpenId(null);
            return;
          }
          onOpen(id);
        }}
        onDelete={() => deleteTrip(id)}
        onToggleFavorite={() => updateTrip(id, { favorite: !t.favorite })}
        swipeOpenId={swipeOpenId}
        onSwipeOpenChange={setSwipeOpenId}
      />
    ) : null;
  }

  const chips =
    tripOrder.length === 0 ? null : (
      <div className="no-scrollbar flex gap-1.5 overflow-x-auto px-[var(--gutter)] pb-2 pt-1">
        {SORTS.map((s) => (
          <TagChip
            key={s.key}
            active={!tbdOnly && sort === s.key}
            onClick={() => changeSort(s.key)}
          >
            <span className="flex items-center gap-1">
              {s.label}
              {/* the applied sort shows its order; tap again to flip */}
              {!tbdOnly &&
                sort === s.key &&
                (dir === "asc" ? (
                  <ArrowUp size={13} strokeWidth={2.6} aria-label="오름차순" />
                ) : (
                  <ArrowDown size={13} strokeWidth={2.6} aria-label="내림차순" />
                ))}
            </span>
          </TagChip>
        ))}
        {/* not a sort: shows who came along, over whichever sort is on */}
        <TagChip active={showWith} onClick={toggleWith}>
          With
        </TagChip>
        {(hasTbd || tbdOnly) && (
          <TagChip active={tbdOnly} onClick={() => setTbdOnly((v) => !v)}>
            TBD
          </TagChip>
        )}
      </div>
    );

  useTopBar({
    // the filter chips ride in the top bar: they tuck away and come back with it
    subSlot: chips,
    subKey: chips ? `${sort}|${dir}|${showWith}|${tbdOnly}|${hasTbd}` : undefined,
    onAdd: () => onOpen(createTrip()),
    addLabel: "새 트립",
    favorite: {
      on: favOnly,
      toggle: () => {
        keepRowInPlace();
        setFavOnly((v) => !v);
        setSwipeOpenId(null);
      },
    },
    searching: searchOpen,
    onSearch: () => {
      setSearchOpen((o) => !o);
      setQuery("");
    },
    menu: [
      {
        id: "new",
        label: "새 트립",
        icon: <Plus size={20} />,
        onSelect: () => onOpen(createTrip()),
      },
      ...SORTS.map((s, i) => ({
        id: `sort-${s.key}`,
        label: s.label,
        checked: !tbdOnly && sort === s.key,
        group: i === 0,
        onSelect: () => changeSort(s.key),
      })),
      { id: "with", label: "With", checked: showWith, onSelect: toggleWith },
    ],
  }, active);

  return (
    <div className="pb-40">
      {chips && <div aria-hidden="true" className="h-[var(--bar-sub)]" />}
      {searchOpen && (
        <div className="px-[var(--gutter)] pb-1 pt-1">
          <div className="flex h-11 items-center gap-2.5 rounded-full bg-fill px-4">
            <Search size={17} className="shrink-0 text-tertiary" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="트립·장소·함께한 사람 검색…"
              className="min-w-0 flex-1 bg-transparent text-[16px] text-label outline-none placeholder:text-tertiary"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="검색 지우기"
                className="shrink-0 text-tertiary active:opacity-50"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>
      )}

      {tripOrder.length === 0 ? (
        <EmptyTrips onCreate={() => onOpen(createTrip())} />
      ) : (
        <div>
          {/* Dense flat list, like the Gear */}
          <div>
            {tbdOnly ? (
              tbdIds.map(renderRow)
            ) : (
              <>
                {plannedIds.map(renderRow)}
                {tbdIds.length > 0 && (
                  <>
                    {/* styled like a Gear category header */}
                    <h2
                      className={cn(
                        "px-[var(--gutter)] pb-3 text-[17px] font-bold tracking-[-0.01em] text-tertiary",
                        plannedIds.length > 0 ? "pt-6" : "pt-1",
                      )}
                    >
                      계획 미정
                    </h2>
                    {tbdIds.map(renderRow)}
                  </>
                )}
              </>
            )}
            {favOnly && !q && shownIds.length === 0 && (
              <p className="px-[var(--gutter)] py-12 text-center text-[15px] text-secondary">
                하트를 누른 트립이 없어요. 트립을 왼쪽으로 밀어 하트를 눌러 보세요.
              </p>
            )}
            {tbdOnly && !favOnly && !q && tbdIds.length === 0 && (
              <p className="px-[var(--gutter)] py-12 text-center text-[15px] text-secondary">
                계획 미정인 트립이 없어요.
              </p>
            )}
            {q && (tbdOnly ? tbdIds : shownIds).length === 0 && (
              <p className="px-[var(--gutter)] py-12 text-center text-[15px] text-secondary">
                검색 결과가 없습니다.
              </p>
            )}
          </div>
        </div>
      )}

    </div>
  );
}

function TripRow({
  trip,
  showCompanions,
  onOpen,
  onDelete,
  onToggleFavorite,
  swipeOpenId,
  onSwipeOpenChange,
}: {
  trip: Trip;
  /** With on → companion tags slide in under the date/temp line. */
  showCompanions: boolean;
  onOpen: () => void;
  onDelete: () => void;
  onToggleFavorite: () => void;
  swipeOpenId: string | null;
  onSwipeOpenChange: (id: string | null) => void;
}) {
  const gear = useAppStore((s) => s.gear);
  const unit = useAppStore((s) => s.displayUnit);

  const totalG =
    trip.packed.reduce((sum, p) => {
      const g = gear[p.gearId];
      return g ? sum + g.weightG * p.quantity : sum;
    }, 0) + (trip.extraWeightG ?? 0);

  return (
    <SwipeRow
      id={trip.id}
      openId={swipeOpenId}
      onOpenChange={onSwipeOpenChange}
      rightWidth={112}
      edgeBand={12}
      bgClassName="bg-bg"
      renderRight={(close, rowOpen) => (
        <>
          <SwipeHeartButton
            on={Boolean(trip.favorite)}
            onToggle={onToggleFavorite}
            onDone={close}
          />
          <SwipeDeleteButton rowOpen={rowOpen} onDelete={onDelete} />
        </>
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        // same type and spacing as a Gear row
        className="flex w-full touch-manipulation select-none items-center gap-2.5 px-[var(--gutter)] py-3 text-left active:opacity-60"
      >
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="min-w-0 truncate text-[15px] font-semibold leading-tight text-label">
              {trip.name}
            </span>
            {trip.tbd && <TbdTag />}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[12.5px] leading-tight text-secondary">
            <span>{formatTripRange(tripStart(trip))}</span>
            {tempRange(trip.tempLow, trip.tempHigh) && (
              <span className="tabular">
                · {tempRange(trip.tempLow, trip.tempHigh)}
              </span>
            )}
          </div>
          <AnimatePresence initial={false}>
            {showCompanions && tripCompanions(trip).length > 0 && (
              <motion.div
                key="with"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                className="overflow-hidden"
              >
                <div className="flex flex-wrap items-center gap-1 pt-1">
                  {tripCompanions(trip).map((name, i) => (
                    <span
                      key={`${name}-${i}`}
                      className="rounded-full bg-fill px-2 py-[1.5px] text-[12px] font-medium text-secondary"
                    >
                      {name}
                    </span>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <span className="min-w-[52px] shrink-0 whitespace-nowrap text-right tabular text-[14px] text-secondary">
          {formatWeightSmart(totalG, unit)}
        </span>
        <ChevronRight size={16} className="-ml-1 -mr-1.5 shrink-0 text-tertiary" />
      </button>
    </SwipeRow>
  );
}

function EmptyTrips({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex min-h-[55dvh] flex-col items-center justify-center px-8 text-center">
      <div className="grid h-16 w-16 place-items-center rounded-[20px] bg-fill text-label">
        <Map size={28} />
      </div>
      <h2 className="mt-4 text-[24px] font-bold tracking-[-0.02em] text-label">
        아직 트립이 없어요
      </h2>
      <p className="mt-1 max-w-[15rem] text-[15px] text-secondary">
        Gear에서 장비를 골라 추가하거나, 새 트립을 만들어 기록을 남겨보세요.
      </p>
      <InkButton onClick={onCreate} className="mt-5">
        새 트립 만들기
      </InkButton>
    </div>
  );
}
