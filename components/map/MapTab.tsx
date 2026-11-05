"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Maximize2 } from "lucide-react";
import { useAppStore } from "@/lib/store";
import type { Trip } from "@/lib/types";
import { formatTripRange, tripStart } from "@/lib/dates";
import { formatWeightSmart } from "@/lib/units";
import { useTopBar } from "../TopBar";
import { LeafletMap } from "./LeafletMap";
import { NaverMap } from "./NaverMap";
import type { MapPoint } from "./types";

/** With a Naver Maps key the map is Naver's; without one, Leaflet + CARTO. */
const NAVER_KEY = process.env.NEXT_PUBLIC_NAVER_MAP_KEY;

/** A trip whose place hasn't been looked up yet (or changed since). Older
 *  data with coordinates but no record of what they were found for counts as
 *  located. */
function needsGeo(t: Trip): boolean {
  const q = t.place?.trim();
  if (!q) return false;
  if (t.geoQ === q) return false;
  return !(t.geoQ === undefined && t.lat != null && t.lng != null);
}

type Hit = { lat: number; lng: number } | null;
/** Per-session answers, so several trips at one place cost one lookup. */
const geoCache = new Map<string, Hit>();

async function geocode(q: string): Promise<Hit | "error"> {
  const cached = geoCache.get(q);
  if (cached !== undefined) return cached;
  try {
    const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
    if (res.status === 404) {
      geoCache.set(q, null);
      return null;
    }
    if (!res.ok) return "error";
    const j = (await res.json()) as { lat: number; lng: number };
    const hit = { lat: j.lat, lng: j.lng };
    geoCache.set(q, hit);
    return hit;
  } catch {
    return "error";
  }
}

/**
 * While the Map tab shows, look up trips' places one at a time (Nominatim
 * allows ~1 request/s) and cache the coordinates on each trip. A network
 * failure stops the run; the next visit tries again.
 */
function useGeocodeTrips(active: boolean, placesSig: string) {
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!active) return;
    let stop = false;
    (async () => {
      const tried = new Set<string>();
      for (;;) {
        if (stop) return;
        const t = Object.values(useAppStore.getState().trips).find(
          (x) => needsGeo(x) && !tried.has(x.id),
        );
        if (!t) return;
        tried.add(t.id);
        setBusy(true);
        const q = (t.place ?? "").trim();
        const wasCached = geoCache.has(q);
        const hit = await geocode(q);
        if (hit === "error") return;
        useAppStore
          .getState()
          .updateTrip(t.id, hit ? { lat: hit.lat, lng: hit.lng, geoQ: q } : { lat: undefined, lng: undefined, geoQ: q });
        if (!wasCached) await new Promise((r) => setTimeout(r, 1100));
      }
    })().finally(() => {
      if (!stop) setBusy(false);
    });
    return () => {
      stop = true;
      setBusy(false);
    };
  }, [active, placesSig]);
  return busy;
}

/** South Korea, simplified: the mainland's outline and Jeju (traced from
 *  real coordinates, drawn like the other line icons). */
function KoreaIcon() {
  return (
    <svg
      width={24}
      height={24}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M7.6 5.1L10 3.9L14.6 1.6L15.6 3.4L17.6 6.5L18.9 10.2L19.4 12.2L18.8 14.5L17.4 16L14.8 17L11.6 17.8L7.8 19.1L6.2 17.8L7 15.7L7.3 13.3L5.8 9.7L7.2 8.2L7.7 6.3Z" />
      <ellipse cx="7" cy="22.2" rx="1.6" ry="0.85" />
    </svg>
  );
}

export function MapTab({
  active,
  onOpenTrip,
}: {
  active: boolean;
  onOpenTrip: (id: string) => void;
}) {
  const trips = useAppStore((s) => s.trips);
  const tripOrder = useAppStore((s) => s.tripOrder);
  const gear = useAppStore((s) => s.gear);
  const unit = useAppStore((s) => s.displayUnit);
  const createTrip = useAppStore((s) => s.createTrip);
  const [selected, setSelected] = useState<string | null>(null);
  const [fitTick, setFitTick] = useState(0);
  const [koreaTick, setKoreaTick] = useState(0);

  const placesSig = tripOrder.map((id) => `${id}:${trips[id]?.place ?? ""}`).join("\n");
  const locating = useGeocodeTrips(active, placesSig);

  // Trips grouped by spot (several trips to one place share a marker).
  const { points, byKey } = useMemo(() => {
    const byKey = new Map<string, Trip[]>();
    const points: MapPoint[] = [];
    for (const id of tripOrder) {
      const t = trips[id];
      if (!t?.place?.trim() || t.lat == null || t.lng == null) continue;
      const key = `${t.lat.toFixed(4)},${t.lng.toFixed(4)}`;
      const list = byKey.get(key);
      if (list) list.push(t);
      else {
        byKey.set(key, [t]);
        points.push({ key, lat: t.lat, lng: t.lng, label: t.place.trim(), count: 0 });
      }
    }
    for (const p of points) p.count = byKey.get(p.key)?.length ?? 0;
    return { points, byKey };
  }, [trips, tripOrder]);
  const hasPlaces = tripOrder.some((id) => trips[id]?.place?.trim());
  const shown = selected ? (byKey.get(selected) ?? null) : null;

  useTopBar({
    // every trip in view
    left: {
      label: "전체 보기",
      icon: <Maximize2 size={22} strokeWidth={2} />,
      onTap: () => setFitTick((n) => n + 1),
    },
    // the whole country, right beside it
    leftActions: [
      {
        id: "korea",
        label: "우리나라 보기",
        icon: <KoreaIcon />,
        onTap: () => setKoreaTick((n) => n + 1),
      },
    ],
    onAdd: () => onOpenTrip(createTrip()),
    addLabel: "새 트립",
  });

  const totalG = (t: Trip) =>
    t.packed.reduce((sum, p) => {
      const g = gear[p.gearId];
      return g ? sum + g.weightG * p.quantity : sum;
    }, 0) + (t.extraWeightG ?? 0);

  const view = { points, selected, onSelect: setSelected, active, fitTick, koreaTick };

  return (
    // the map owns its drags (no pull-to-refresh; tab paging only from the
    // left-edge strip below)
    <div data-no-ptr className="fixed inset-0 z-0">
      {NAVER_KEY ? <NaverMap apiKey={NAVER_KEY} {...view} /> : <LeafletMap {...view} />}
      {/* a thin strip along the left edge, above the map: a swipe from the
          edge pages back to the Trip tab instead of panning */}
      <div aria-hidden="true" className="absolute inset-y-0 left-0 z-10 w-5" />

      {locating && (
        <div className="pointer-events-none fixed inset-x-0 top-[calc(var(--bar-top)+64px)] z-[36] flex justify-center">
          <span className="glass-strong rounded-full px-3.5 py-1.5 text-[13px] font-medium text-secondary">
            트립 장소를 찾는 중…
          </span>
        </div>
      )}

      {!hasPlaces && (
        <div className="pointer-events-none fixed inset-x-4 bottom-[calc(var(--bar-bottom)+80px)] z-[36] flex justify-center">
          <p className="glass-strong rounded-[22px] px-5 py-3.5 text-center text-[14px] leading-snug text-secondary">
            트립에 장소를 적으면 다녀온 곳이 지도에 표시돼요.
          </p>
        </div>
      )}

      {shown && (
        <div className="fixed inset-x-4 bottom-[calc(var(--bar-bottom)+76px)] z-[36] mx-auto max-w-md">
          <div className="glass-strong overflow-hidden rounded-[24px] py-2">
            <div className="px-4 pb-1 pt-1.5 text-[13px] font-semibold text-tertiary">
              {shown[0].place?.trim()}
            </div>
            <div className="max-h-[40vh] overflow-y-auto">
              {shown.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onOpenTrip(t.id)}
                  className="flex w-full touch-manipulation items-center gap-2.5 px-4 py-2.5 text-left active:opacity-60"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[15px] font-semibold leading-tight text-label">
                      {t.name}
                    </div>
                    <div className="mt-0.5 truncate text-[12.5px] leading-tight text-secondary">
                      {formatTripRange(tripStart(t))}
                    </div>
                  </div>
                  <span className="shrink-0 whitespace-nowrap tabular text-[14px] text-secondary">
                    {formatWeightSmart(totalG(t), unit)}
                  </span>
                  <ChevronRight size={16} className="-ml-1 -mr-1.5 shrink-0 text-tertiary" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
