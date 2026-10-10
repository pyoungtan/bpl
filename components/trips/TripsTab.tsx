"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Map, Plus, Search, X } from "lucide-react";
import { useAppStore } from "@/lib/store";
import type { Trip } from "@/lib/types";
import { formatWeightSmart } from "@/lib/units";
import { formatTripRange, tripStart } from "@/lib/dates";
import { tripCompanions } from "@/lib/trips";

/** "-5~12℃", a single bound like "12℃", or "" when no temps are set. */
function tempRange(low?: string, high?: string): string {
  if (low && high) return `${low}~${high}℃`;
  if (low || high) return `${low ?? high}℃`;
  return "";
}
import { cn } from "@/lib/cn";
import { useTopBar } from "../TopBar";
import { InkButton } from "../ui/Glass";
import { SwipeRow, SwipeDeleteButton } from "../ui/SwipeRow";
import { TripDetail } from "./TripDetail";

type TripSort = "date" | "created" | "companions";

const SORTS: { key: TripSort; label: string }[] = [
  { key: "date", label: "다녀온 날짜" },
  { key: "created", label: "작성일" },
  { key: "companions", label: "함께한 사람" },
];

const SORT_KEY = "bpl-trip-sort";

export function TripsTab({
  openTripId,
  onConsumeOpen,
}: {
  openTripId: string | null;
  onConsumeOpen: () => void;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const trips = useAppStore((s) => s.trips);

  useEffect(() => {
    if (openTripId && trips[openTripId]) {
      setActiveId(openTripId);
      onConsumeOpen();
    }
  }, [openTripId, trips, onConsumeOpen]);

  if (activeId && trips[activeId]) {
    return <TripDetail tripId={activeId} onBack={() => setActiveId(null)} />;
  }
  return <TripList onOpen={setActiveId} />;
}

function TripList({ onOpen }: { onOpen: (id: string) => void }) {
  const trips = useAppStore((s) => s.trips);
  const tripOrder = useAppStore((s) => s.tripOrder);
  const createTrip = useAppStore((s) => s.createTrip);
  const deleteTrip = useAppStore((s) => s.deleteTrip);
  const [swipeOpenId, setSwipeOpenId] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  // Sort preference, remembered across sessions. Safe to read directly: the
  // list only mounts client-side (AppShell gates on hydration).
  const [sort, setSort] = useState<TripSort>(() => {
    if (typeof window === "undefined") return "created";
    const v = localStorage.getItem(SORT_KEY);
    return v === "date" || v === "companions" ? v : "created";
  });
  function changeSort(s: TripSort) {
    setSort(s);
    try {
      localStorage.setItem(SORT_KEY, s);
    } catch {
      /* ignore */
    }
  }

  const sortedIds = useMemo(() => {
    const ids = tripOrder.filter((id) => trips[id]);
    if (sort === "created") return ids; // tripOrder is newest-created first
    if (sort === "date") {
      // Most recent trip first; undated trips sink to the bottom.
      return [...ids].sort((a, b) => {
        const sa = tripStart(trips[a]) ?? "";
        const sb = tripStart(trips[b]) ?? "";
        if (!sa && !sb) return 0;
        if (!sa) return 1;
        if (!sb) return -1;
        return sb.localeCompare(sa);
      });
    }
    // 함께한 사람 가나다순; trips without companions sink to the bottom.
    return [...ids].sort((a, b) => {
      const ca = tripCompanions(trips[a]).join(", ");
      const cb = tripCompanions(trips[b]).join(", ");
      if (!ca && !cb) return 0;
      if (!ca) return 1;
      if (!cb) return -1;
      return ca.localeCompare(cb, "ko");
    });
  }, [tripOrder, trips, sort]);

  const q = query.trim().toLowerCase();
  const shownIds = useMemo(() => {
    if (!q) return sortedIds;
    return sortedIds.filter((id) => {
      const t = trips[id];
      return [t.name, t.place ?? "", ...tripCompanions(t)].some((v) =>
        v.toLowerCase().includes(q),
      );
    });
  }, [sortedIds, trips, q]);

  useTopBar({
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
        label: `${s.label} 순`,
        checked: sort === s.key,
        group: i === 0,
        onSelect: () => changeSort(s.key),
      })),
    ],
  });

  return (
    <div className="pb-40">
      {searchOpen && (
        <div className="px-4 pb-1 pt-1">
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
          <div className="no-scrollbar mb-1 flex gap-2 overflow-x-auto px-4 pb-1 pt-2">
            {SORTS.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => changeSort(s.key)}
                aria-pressed={sort === s.key}
                className={cn(
                  "h-8 shrink-0 whitespace-nowrap rounded-full px-3.5 text-[14px] font-medium transition active:opacity-60",
                  sort === s.key ? "bg-tint text-on-tint" : "bg-fill text-label",
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
          {/* Dense flat list — hairline separators only, like the Gear */}
          <div>
            {shownIds.map((id, i) => {
              const t = trips[id];
              return t ? (
                <TripRow
                  key={id}
                  trip={t}
                  showCompanions={sort === "companions"}
                  topHairline={i > 0}
                  onOpen={() => {
                    if (swipeOpenId) {
                      setSwipeOpenId(null);
                      return;
                    }
                    onOpen(id);
                  }}
                  onDelete={() => deleteTrip(id)}
                  swipeOpenId={swipeOpenId}
                  onSwipeOpenChange={setSwipeOpenId}
                />
              ) : null;
            })}
            {q && shownIds.length === 0 && (
              <p className="px-4 py-12 text-center text-[15px] text-secondary">
                검색 결과가 없습니다.
              </p>
            )}
          </div>
        </div>
      )}

      {tripOrder.length > 0 && (
        <div
          className="fixed right-4 z-40"
          style={{ bottom: "var(--bar-bottom)" }}
        >
          <InkButton onClick={() => onOpen(createTrip())}>
            <Plus size={21} strokeWidth={2.4} /> 새 트립
          </InkButton>
        </div>
      )}
    </div>
  );
}

function TripRow({
  trip,
  showCompanions,
  topHairline,
  onOpen,
  onDelete,
  swipeOpenId,
  onSwipeOpenChange,
}: {
  trip: Trip;
  /** 함께한 사람 sort active → subtitle shows companion tags instead of date/temp. */
  showCompanions: boolean;
  topHairline: boolean;
  onOpen: () => void;
  onDelete: () => void;
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
      rightWidth={56}
      topHairline={topHairline}
      bgClassName="bg-bg"
      renderRight={(_close, rowOpen) => (
        <SwipeDeleteButton rowOpen={rowOpen} onDelete={onDelete} />
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full touch-manipulation items-center gap-3 px-4 py-3 text-left transition active:bg-fill"
      >
        <div className="min-w-0 flex-1">
          <div className="truncate text-[17px] font-semibold tracking-[-0.01em] text-label">
            {trip.name}
          </div>
          {showCompanions ? (
            tripCompanions(trip).length > 0 && (
              <div className="mt-1 flex flex-wrap items-center gap-1">
                {tripCompanions(trip).map((name, i) => (
                  <span
                    key={`${name}-${i}`}
                    className="rounded-full bg-fill px-2 py-[1.5px] text-[12px] font-medium text-secondary"
                  >
                    {name}
                  </span>
                ))}
              </div>
            )
          ) : (
            <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[13px] text-tertiary">
              <span>{formatTripRange(tripStart(trip))}</span>
              {tempRange(trip.tempLow, trip.tempHigh) && (
                <span className="tabular">
                  · {tempRange(trip.tempLow, trip.tempHigh)}
                </span>
              )}
            </div>
          )}
        </div>
        <span className="shrink-0 tabular text-[15px] font-medium text-label">
          {formatWeightSmart(totalG, unit)}
        </span>
        <ChevronRight size={18} className="-mr-1 shrink-0 text-tertiary" />
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
