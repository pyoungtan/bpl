"use client";

import { useEffect, useState } from "react";
import { ChevronRight, Map, Plus, Settings } from "lucide-react";
import { useAppStore } from "@/lib/store";
import type { Trip } from "@/lib/types";
import { formatWeightSmart } from "@/lib/units";
import { ScreenHeader } from "../ScreenHeader";
import { Button } from "../ui/Button";
import { SwipeRow, SwipeDeleteButton } from "../ui/SwipeRow";
import { TripDetail } from "./TripDetail";

function formatTripDate(date?: string): string {
  if (!date) return "날짜 미정";
  const d = new Date(`${date}T00:00:00`);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

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
        <div className="px-4 pt-2">
          <div className="overflow-hidden rounded-[12px] bg-card">
            {tripOrder.map((id, i) => {
              const t = trips[id];
              return t ? (
                <TripRow
                  key={id}
                  trip={t}
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
  topHairline,
  onOpen,
  onDelete,
  swipeOpenId,
  onSwipeOpenChange,
}: {
  trip: Trip;
  topHairline: boolean;
  onOpen: () => void;
  onDelete: () => void;
  swipeOpenId: string | null;
  onSwipeOpenChange: (id: string | null) => void;
}) {
  const gear = useAppStore((s) => s.gear);
  const unit = useAppStore((s) => s.displayUnit);

  const totalG = trip.packed.reduce((sum, p) => {
    const g = gear[p.gearId];
    return g ? sum + g.weightG * p.quantity : sum;
  }, 0);

  return (
    <SwipeRow
      id={trip.id}
      openId={swipeOpenId}
      onOpenChange={onSwipeOpenChange}
      rightWidth={56}
      topHairline={topHairline}
      bgClassName="bg-card"
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
          <div className="mt-0.5 text-[13px] text-secondary">
            {formatTripDate(trip.date)}
          </div>
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
        Gear Shelf에서 장비를 골라 추가하거나, 새 트립을 만들어 기록을 남겨보세요.
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
