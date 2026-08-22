"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Map, Plus, Settings } from "lucide-react";
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
import { ScreenHeader } from "../ScreenHeader";
import { Button } from "../ui/Button";
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
  onOpenSettings,
  openTripId,
  onConsumeOpen,
}: {
  onOpenSettings: () => void;
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
  return <TripList onOpen={setActiveId} onOpenSettings={onOpenSettings} />;
}

function TripList({
  onOpen,
  onOpenSettings,
}: {
  onOpen: (id: string) => void;
  onOpenSettings: () => void;
}) {
  const trips = useAppStore((s) => s.trips);
  const tripOrder = useAppStore((s) => s.tripOrder);
  const createTrip = useAppStore((s) => s.createTrip);
  const deleteTrip = useAppStore((s) => s.deleteTrip);
  const [swipeOpenId, setSwipeOpenId] = useState<string | null>(null);
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

  return (
    <div className="pb-40">
      <ScreenHeader
        title="Trips"
        subtitle={`${tripOrder.length}개의 여행 기록`}
        trailing={
          <Button
            variant="plain"
            size="icon"
            aria-label="설정"
            onClick={onOpenSettings}
          >
            <Settings size={20} />
          </Button>
        }
      />

      {tripOrder.length === 0 ? (
        <EmptyTrips onCreate={() => onOpen(createTrip())} />
      ) : (
        <div className="pt-2">
          <div className="no-scrollbar mb-1 flex gap-1.5 overflow-x-auto px-4 pb-1">
            {SORTS.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => changeSort(s.key)}
                aria-pressed={sort === s.key}
                className={cn(
                  "h-7 shrink-0 whitespace-nowrap rounded-full px-3 text-[12.5px] font-medium transition active:opacity-60",
                  sort === s.key ? "bg-tint text-white" : "bg-fill text-secondary",
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
          {/* Dense flat list — hairline separators only, like the Inventory */}
          <div>
            {sortedIds.map((id, i) => {
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
          </div>
        </div>
      )}

      <button
        type="button"
        aria-label="새 트립"
        onClick={() => onOpen(createTrip())}
        className="shadow-float fixed right-4 z-40 grid h-14 w-14 place-items-center rounded-full bg-tint text-white transition active:scale-95"
        style={{ bottom: "calc(env(safe-area-inset-bottom) + 16px)" }}
      >
        <Plus size={26} />
      </button>
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
          <div className="truncate font-serif text-[18px] font-medium tracking-[-0.01em] text-label">
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
      <div className="grid h-16 w-16 place-items-center rounded-[18px] bg-tint-soft text-tint">
        <Map size={28} />
      </div>
      <h2 className="mt-4 font-serif text-[26px] font-medium text-label">
        아직 트립이 없어요
      </h2>
      <p className="mt-1 max-w-[15rem] text-[15px] text-secondary">
        Inventory에서 장비를 골라 추가하거나, 새 트립을 만들어 기록을 남겨보세요.
      </p>
      <button
        type="button"
        onClick={onCreate}
        className="mt-5 h-11 rounded-full bg-tint px-5 font-semibold text-white active:opacity-80"
      >
        새 트립 만들기
      </button>
    </div>
  );
}
