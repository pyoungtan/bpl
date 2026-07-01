"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronDown,
  ChevronLeft,
  CircleCheck,
  ListChecks,
  MapPin,
  Minus,
  Plus,
  Trash2,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import { computeStats } from "@/lib/calc";
import type { GearItem } from "@/lib/types";
import { formatWeight, formatWeightSmart } from "@/lib/units";
import { tripNights } from "@/lib/dates";
import { cn } from "@/lib/cn";
import { Donut } from "../Donut";
import { Sheet } from "../ui/Sheet";
import { SwipeRow, SwipeDeleteButton } from "../ui/SwipeRow";
import { Checkbox } from "../ui/Checkbox";
import { Badge } from "../ui/Badge";

type Mode = "none" | "check";

interface Row {
  gear: GearItem;
  quantity: number;
}

function groupByMajor(
  packed: { gearId: string; quantity: number }[],
  gear: Record<string, GearItem>,
  gearOrder: string[],
): [string, Row[]][] {
  const qtyById = new Map(packed.map((p) => [p.gearId, p.quantity]));
  const map = new Map<string, Row[]>();
  for (const id of gearOrder) {
    if (!qtyById.has(id)) continue;
    const g = gear[id];
    if (!g) continue;
    if (!map.has(g.majorCategory)) map.set(g.majorCategory, []);
    map.get(g.majorCategory)!.push({ gear: g, quantity: qtyById.get(id)! });
  }
  return [...map.entries()];
}

/** Keyless OpenStreetMap preview centred on a point, with a marker. Google
 *  refuses to be framed (X-Frame-Options), so we render OSM inline and link out
 *  to Google Maps on tap. */
function osmEmbedSrc(lat: number, lng: number) {
  const d = 0.04; // bbox half-size in degrees → a regional/park-level view
  const bbox = [lng - d, lat - d, lng + d, lat + d].join(",");
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`;
}

export function TripDetail({
  tripId,
  onBack,
}: {
  tripId: string;
  onBack: () => void;
}) {
  const trip = useAppStore((s) => s.trips[tripId]);
  const gear = useAppStore((s) => s.gear);
  const gearOrder = useAppStore((s) => s.gearOrder);
  const unit = useAppStore((s) => s.displayUnit);
  const updateTrip = useAppStore((s) => s.updateTrip);
  const deleteTrip = useAppStore((s) => s.deleteTrip);
  const removeEntry = useAppStore((s) => s.removeEntryFromTrip);
  const setEntryQuantity = useAppStore((s) => s.setEntryQuantity);
  const toggleChecked = useAppStore((s) => s.toggleTripChecked);

  const [memoOpen, setMemoOpen] = useState(true);
  const [catOpen, setCatOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("none");
  const [swipeOpenId, setSwipeOpenId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [geoState, setGeoState] = useState<"idle" | "loading" | "error">("idle");
  const memoRef = useRef<HTMLTextAreaElement>(null);
  const backSwipe = useRef<{ x: number; y: number; ok: boolean } | null>(null);

  const packed = useMemo(() => trip?.packed ?? [], [trip]);
  const packedQty = useMemo(
    () => new Map(packed.map((p) => [p.gearId, p.quantity])),
    [packed],
  );
  // Add-ons that are packed AND whose parent is also packed → shown nested
  // under the parent (excluded from the top-level list), just like the shelf.
  const nestedSet = useMemo(() => {
    const s = new Set<string>();
    for (const p of packed) {
      const g = gear[p.gearId];
      if (!g) continue;
      for (const aid of g.addOnIds) if (packedQty.has(aid)) s.add(aid);
    }
    return s;
  }, [packed, packedQty, gear]);

  const groups = useMemo(
    () =>
      trip
        ? groupByMajor(
            trip.packed.filter((p) => !nestedSet.has(p.gearId)),
            gear,
            gearOrder,
          )
        : [],
    [trip, gear, gearOrder, nestedSet],
  );
  // Stats count every packed item (parents + nested add-ons). A packed add-on
  // is logically part of its parent, so its weight is credited to the parent's
  // category (not the add-on's own) in the donut + breakdown.
  const stats = useMemo(() => {
    const parentCat = new Map<string, string>();
    for (const p of packed) {
      const g = gear[p.gearId];
      if (!g) continue;
      for (const aid of g.addOnIds) {
        if (packedQty.has(aid)) parentCat.set(aid, g.majorCategory);
      }
    }
    const rows = packed
      .map((p) => {
        const g = gear[p.gearId];
        if (!g) return null;
        const cat = parentCat.get(p.gearId);
        return {
          gear:
            cat && cat !== g.majorCategory ? { ...g, majorCategory: cat } : g,
          quantity: p.quantity,
        };
      })
      .filter((r): r is { gear: GearItem; quantity: number } => Boolean(r));
    return computeStats(rows);
  }, [packed, gear, packedQty]);

  // Per-category weight totals (add-ons credited to their parent's category,
  // same as the donut) — shown under each category group in the packed list.
  const catTotals = useMemo(
    () => new Map(stats.byCategory.map((c) => [c.name, c.weightG])),
    [stats],
  );

  const memo = trip?.memo ?? "";
  useEffect(() => {
    const el = memoRef.current;
    if (el && memoOpen) {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    }
  }, [memo, memoOpen]);

  // Geocode the free-text place → coordinates (debounced), cached on the trip so
  // reopening doesn't refetch. Cleared when the place is emptied.
  const place = trip?.place ?? "";
  const geoResolvedFor = useRef<string | null>(null);
  if (geoResolvedFor.current === null) {
    geoResolvedFor.current =
      trip && trip.lat != null && trip.lng != null ? place : "";
  }
  useEffect(() => {
    const q = place.trim();
    if (!q) {
      geoResolvedFor.current = "";
      setGeoState("idle");
      const cur = useAppStore.getState().trips[tripId];
      if (cur && (cur.lat != null || cur.lng != null)) {
        updateTrip(tripId, { lat: undefined, lng: undefined });
      }
      return;
    }
    if (q === geoResolvedFor.current) return; // already have coords for this text
    const ctrl = new AbortController();
    setGeoState("loading");
    const timer = window.setTimeout(() => {
      fetch(`/api/geocode?q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
        .then(async (res) => {
          const data = await res.json();
          if (
            res.ok &&
            typeof data.lat === "number" &&
            typeof data.lng === "number"
          ) {
            geoResolvedFor.current = q;
            setGeoState("idle");
            updateTrip(tripId, { lat: data.lat, lng: data.lng });
          } else {
            setGeoState("error");
          }
        })
        .catch(() => {
          if (!ctrl.signal.aborted) setGeoState("error");
        });
    }, 700);
    return () => {
      ctrl.abort();
      window.clearTimeout(timer);
    };
  }, [place, tripId, updateTrip]);

  if (!trip) return null;

  const checkedSet = new Set(trip.checked ?? []);
  const checkedCount = (trip.checked ?? []).filter((id) =>
    trip.packed.some((p) => p.gearId === id),
  ).length;
  const isChecking = mode === "check";

  function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    deleteTrip(tripId);
    onBack();
  }

  function toggleItemExpand(id: string) {
    setExpandedItems((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function renderRow(
    g: GearItem,
    quantity: number,
    opts: {
      nested?: boolean;
      topHairline?: boolean;
      hasAddOns?: boolean;
      expanded?: boolean;
      major?: string;
    },
  ) {
    const { nested, topHairline, hasAddOns, expanded, major } = opts;
    const checked = checkedSet.has(g.id);
    const dim = isChecking && checked;
    const selected = !isChecking && selectedId === g.id;
    return (
      <Fragment key={g.id}>
      <SwipeRow
        id={g.id}
        openId={swipeOpenId}
        onOpenChange={(id) => {
          setSwipeOpenId(id);
          if (id) setSelectedId(null); // don't show swipe actions + panel at once
        }}
        swipeDisabled={isChecking}
        rightWidth={56}
        topHairline={topHairline}
        bgClassName={
          nested ? "bg-[color-mix(in_srgb,var(--tint)_6%,var(--bg))]" : "bg-bg"
        }
        renderRight={(_close, rowOpen) => (
          <SwipeDeleteButton
            rowOpen={rowOpen}
            onDelete={() => removeEntry(tripId, g.id)}
          />
        )}
      >
        <div
          onClick={
            isChecking
              ? () => toggleChecked(tripId, g.id)
              : () => setSelectedId((cur) => (cur === g.id ? null : g.id))
          }
          className={cn(
            "flex w-full items-center gap-2.5 py-2.5 text-left transition",
            nested ? "pl-9 pr-4" : "px-4",
            "cursor-pointer active:bg-fill",
            selected && "bg-fill",
            dim && "opacity-40",
          )}
        >
          {isChecking && (
            <span className="grid h-[22px] w-[22px] shrink-0 place-items-center">
              {checked ? (
                <CircleCheck size={22} className="text-tint" />
              ) : (
                <span className="h-[19px] w-[19px] rounded-full border-[1.5px] border-separator-opaque" />
              )}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-1.5">
              <span
                className={cn(
                  "min-w-0 truncate font-semibold leading-tight",
                  nested ? "text-[14px] text-secondary" : "text-[15px] text-label",
                )}
              >
                {g.name}
                {nested && g.brand && (
                  <span className="font-normal text-[12px] text-tertiary">
                    {" · "}
                    {g.brand}
                  </span>
                )}
              </span>
              {g.worn && <Badge>착용</Badge>}
              {g.consumable && <Badge tone="orange">소모</Badge>}
            </div>
            {!nested && (
              <div className="mt-0.5 truncate text-[12.5px] leading-tight text-secondary">
                {[g.minorCategory, g.brand].filter(Boolean).join(" · ") || major}
              </div>
            )}
          </div>
          <span
            className={cn(
              "shrink-0 tabular",
              nested ? "text-[13px] text-tertiary" : "text-[14px] text-secondary",
            )}
          >
            {formatWeight(g.weightG, unit)}
            {quantity > 1 && <span className="text-tertiary"> ×{quantity}</span>}
          </span>
          <div className="flex w-6 shrink-0 justify-end">
            {!nested && hasAddOns && (
              <button
                type="button"
                aria-label="애드온 펼치기"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleItemExpand(g.id);
                }}
                className="-mr-1.5 grid h-7 w-7 touch-manipulation place-items-center rounded-full text-tint active:bg-fill"
              >
                <ChevronDown
                  size={18}
                  className={cn("transition-transform", expanded && "rotate-180")}
                />
              </button>
            )}
          </div>
        </div>
      </SwipeRow>
      <AnimatePresence initial={false}>
        {selected && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden bg-fill"
          >
            <div
              className={cn(
                "flex items-center justify-between gap-3 py-2.5",
                nested ? "pl-9 pr-4" : "px-4",
              )}
            >
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  aria-label="수량 감소"
                  disabled={quantity <= 1}
                  onClick={() => setEntryQuantity(tripId, g.id, quantity - 1)}
                  className="grid h-8 w-8 place-items-center rounded-full bg-bg text-label shadow-float active:opacity-60 disabled:opacity-30"
                >
                  <Minus size={16} />
                </button>
                <span className="w-8 text-center tabular text-[16px] font-medium text-label">
                  {quantity}
                </span>
                <button
                  type="button"
                  aria-label="수량 증가"
                  onClick={() => setEntryQuantity(tripId, g.id, quantity + 1)}
                  className="grid h-8 w-8 place-items-center rounded-full bg-bg text-label shadow-float active:opacity-60"
                >
                  <Plus size={16} />
                </button>
              </div>
              <button
                type="button"
                onClick={() => {
                  removeEntry(tripId, g.id);
                  setSelectedId(null);
                }}
                className="flex items-center gap-1.5 text-[14px] font-medium text-red active:opacity-60"
              >
                <Trash2 size={16} />
                트립에서 삭제
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      </Fragment>
    );
  }

  return (
    <div className="pb-40">
      {/* Left-edge swipe-right to go back (iOS-style), below the header so it
          doesn't block the back button. */}
      <div
        className="fixed left-0 z-30 w-4"
        style={{ top: "calc(env(safe-area-inset-top) + 48px)", bottom: 0 }}
        onPointerDown={(e) => {
          backSwipe.current = { x: e.clientX, y: e.clientY, ok: true };
        }}
        onPointerMove={(e) => {
          const s = backSwipe.current;
          if (!s || !s.ok) return;
          if (Math.abs(e.clientY - s.y) > 45) s.ok = false; // vertical → cancel
        }}
        onPointerUp={(e) => {
          const s = backSwipe.current;
          backSwipe.current = null;
          if (s && s.ok && e.clientX - s.x > 70) onBack();
        }}
        onPointerCancel={() => {
          backSwipe.current = null;
        }}
      />
      <div className="material sticky top-0 z-20 flex h-12 items-center justify-between border-b border-separator pt-safe">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-0.5 pl-1.5 pr-2 text-tint active:opacity-50"
        >
          <ChevronLeft size={26} />
          <span className="text-[17px]">Trips</span>
        </button>
        {isChecking && (
          <span className="tabular text-[15px] font-medium text-secondary">
            {checkedCount}/{trip.packed.length} 챙김
          </span>
        )}
        <div className="flex items-center gap-1 pr-2">
          <button
            type="button"
            onClick={() => {
              setSwipeOpenId(null);
              setSelectedId(null);
              setMode((m) => (m === "check" ? "none" : "check"));
            }}
            aria-label="장비 점검"
            className={cn(
              "grid h-9 w-9 place-items-center rounded-full transition active:opacity-50",
              isChecking ? "bg-tint-soft text-tint" : "text-tint",
            )}
          >
            <ListChecks size={20} />
          </button>
        </div>
      </div>

      <div className="space-y-4 px-4 pt-3">
        <div className="px-1">
          <input
            value={trip.name}
            onChange={(e) => updateTrip(tripId, { name: e.target.value })}
            placeholder="트립 이름"
            className="w-full bg-transparent font-serif text-[28px] font-medium tracking-[-0.02em] text-label outline-none placeholder:text-tertiary"
          />
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px] text-secondary">
            <input
              type="date"
              aria-label="시작일"
              value={trip.startDate ?? trip.date ?? ""}
              max={trip.endDate || undefined}
              onChange={(e) =>
                updateTrip(tripId, {
                  startDate: e.target.value || undefined,
                  date: e.target.value || undefined,
                })
              }
              className="tabular bg-transparent text-secondary outline-none"
            />
            <span className="text-tertiary">~</span>
            <input
              type="date"
              aria-label="종료일"
              value={trip.endDate ?? ""}
              min={trip.startDate ?? trip.date ?? undefined}
              onChange={(e) =>
                updateTrip(tripId, { endDate: e.target.value || undefined })
              }
              className="tabular bg-transparent text-secondary outline-none"
            />
            {tripNights(trip.startDate ?? trip.date, trip.endDate) && (
              <span className="text-[13px] font-medium text-tint">
                {tripNights(trip.startDate ?? trip.date, trip.endDate)}
              </span>
            )}
          </div>
          <div className="mt-1.5 flex items-center gap-1.5">
            <MapPin size={15} className="shrink-0 text-tertiary" />
            <input
              value={trip.place ?? ""}
              onChange={(e) => updateTrip(tripId, { place: e.target.value })}
              placeholder="장소 (지도에 표시)"
              className="min-w-0 flex-1 bg-transparent text-[14px] text-secondary outline-none placeholder:text-tertiary"
            />
          </div>
        </div>

        {/* Collapsible memo — full text when expanded */}
        <div className="overflow-hidden rounded-[14px] bg-card">
          <button
            type="button"
            onClick={() => setMemoOpen((o) => !o)}
            className="flex h-12 w-full items-center justify-between px-4 active:bg-fill"
          >
            <span className="text-[15px] font-semibold text-label">메모</span>
            <ChevronDown
              size={19}
              className={cn(
                "text-tertiary transition-transform",
                !memoOpen && "-rotate-90",
              )}
            />
          </button>
          {memoOpen && (
            <div className="px-4 pb-3.5">
              <textarea
                ref={memoRef}
                value={trip.memo}
                onChange={(e) => updateTrip(tripId, { memo: e.target.value })}
                placeholder="이 트립에서 기록하고 싶은 내용을 적어두세요."
                rows={1}
                className="w-full resize-none overflow-hidden bg-transparent text-[14px] leading-relaxed text-label outline-none placeholder:text-tertiary"
              />
            </div>
          )}
        </div>

        {/* Summary — tap to expand the per-category weight breakdown */}
        <div className="overflow-hidden rounded-[14px] bg-card">
          <button
            type="button"
            onClick={() => setCatOpen((o) => !o)}
            aria-expanded={catOpen}
            className="flex w-full items-center gap-4 p-4 text-left active:bg-fill"
          >
            <div className="relative grid shrink-0 place-items-center">
              <Donut segments={stats.byCategory} size={84} stroke={12} />
              <span className="absolute tabular text-[12px] font-semibold text-label">
                {formatWeightSmart(stats.totalG, unit)}
              </span>
            </div>
            <div className="grid flex-1 grid-cols-2 gap-x-3 gap-y-2.5">
              <Stat label="베이스" value={formatWeightSmart(stats.baseG, unit)} color="var(--tint)" />
              <Stat label="착용" value={formatWeightSmart(stats.wornG, unit)} color="var(--secondary)" />
              <Stat label="소모" value={formatWeightSmart(stats.consumableG, unit)} color="var(--orange)" />
              <Stat label="총 무게" value={formatWeightSmart(stats.totalG, unit)} strong />
            </div>
            <ChevronDown
              size={18}
              className={cn(
                "shrink-0 self-center text-tertiary transition-transform",
                catOpen && "rotate-180",
              )}
            />
          </button>
          <AnimatePresence initial={false}>
            {catOpen && stats.byCategory.length > 0 && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.22, ease: "easeInOut" }}
                className="overflow-hidden"
              >
                <div className="border-t border-separator px-4 py-1.5">
                  {stats.byCategory.map((c) => {
                    const pct = stats.totalG
                      ? Math.round((c.weightG / stats.totalG) * 100)
                      : 0;
                    return (
                      <div
                        key={c.name}
                        className="flex items-center gap-2.5 py-1.5"
                      >
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: c.color }}
                        />
                        <span className="min-w-0 flex-1 truncate text-[14px] text-label">
                          {c.name}
                        </span>
                        <span className="shrink-0 tabular text-[13px] text-secondary">
                          {formatWeightSmart(c.weightG, unit)}
                        </span>
                        <span className="w-11 shrink-0 text-right tabular text-[13px] font-medium text-tint">
                          {pct}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {place.trim() && (
          <div className="overflow-hidden rounded-[14px] bg-card">
            {trip.lat != null && trip.lng != null ? (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                  place,
                )}`}
                target="_blank"
                rel="noreferrer"
                className="relative block active:opacity-90"
              >
                <iframe
                  title="지도"
                  src={osmEmbedSrc(trip.lat, trip.lng)}
                  className="pointer-events-none block h-44 w-full"
                  style={{ border: 0 }}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
                <span className="material shadow-float absolute left-2 top-2 flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-medium text-tint">
                  <MapPin size={12} /> Google 지도
                </span>
              </a>
            ) : (
              <div className="flex h-24 items-center justify-center px-4 text-center text-[13px] text-secondary">
                {geoState === "error" ? (
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                      place,
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-tint active:opacity-60"
                  >
                    위치를 찾지 못했어요 · Google 지도에서 열기
                  </a>
                ) : (
                  "위치를 찾는 중…"
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Packed gear — flat list */}
      <div className="mt-3">
        {groups.map(([major, rows]) => (
          <section key={major}>
            <div className="flex items-baseline justify-between px-4 pb-1 pt-5">
              <span className="text-[12px] font-bold uppercase tracking-[0.06em] text-tint">
                {major}
              </span>
              <span className="text-[12px] text-tertiary">{rows.length}개</span>
            </div>
            {rows.map(({ gear: g, quantity }, i) => {
              const addOns = g.addOnIds
                .filter((aid) => packedQty.has(aid))
                .map((aid) => ({ gear: gear[aid], quantity: packedQty.get(aid) ?? 1 }))
                .filter((r): r is { gear: GearItem; quantity: number } =>
                  Boolean(r.gear),
                );
              const expanded = expandedItems.has(g.id);
              return (
                <Fragment key={g.id}>
                  {renderRow(g, quantity, {
                    topHairline: i > 0,
                    hasAddOns: addOns.length > 0,
                    expanded,
                    major,
                  })}
                  {expanded &&
                    addOns.map((a) =>
                      renderRow(a.gear, a.quantity, { nested: true }),
                    )}
                </Fragment>
              );
            })}
            <div className="flex items-baseline justify-end gap-2 pb-0.5 pl-4 pr-10 pt-2">
              <span className="text-[11px] text-tertiary">합계</span>
              <span className="tabular text-[13px] font-semibold text-tint">
                {formatWeightSmart(catTotals.get(major) ?? 0, unit)}
              </span>
            </div>
          </section>
        ))}

        {groups.length === 0 && (
          <p className="px-4 py-12 text-center text-[15px] text-secondary">
            아직 챙긴 장비가 없어요. 아래에서 추가해보세요.
          </p>
        )}
      </div>

      <div className="mt-6 space-y-3 px-4">
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-[12px] bg-card text-[15px] font-medium text-tint active:opacity-60"
        >
          <Plus size={19} /> 장비 추가
        </button>
        <button
          type="button"
          onClick={handleDelete}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-[12px] bg-card text-[15px] text-red active:opacity-60"
        >
          <Trash2 size={17} />
          {confirmDelete ? "한 번 더 눌러 삭제" : "트립 삭제"}
        </button>
      </div>

      <GearPickerSheet
        open={pickerOpen}
        tripId={tripId}
        onClose={() => setPickerOpen(false)}
      />
    </div>
  );
}

function Stat({
  label,
  value,
  color,
  strong,
}: {
  label: string;
  value: string;
  color?: string;
  strong?: boolean;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-[12px] text-secondary">
        {color && (
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
        )}
        {label}
      </div>
      <div
        className={cn(
          "tabular text-label",
          strong ? "text-[17px] font-semibold" : "text-[15px] font-medium",
        )}
      >
        {value}
      </div>
    </div>
  );
}

function GearPickerSheet({
  open,
  tripId,
  onClose,
}: {
  open: boolean;
  tripId: string;
  onClose: () => void;
}) {
  const gear = useAppStore((s) => s.gear);
  const gearOrder = useAppStore((s) => s.gearOrder);
  const trip = useAppStore((s) => s.trips[tripId]);
  const unit = useAppStore((s) => s.displayUnit);
  const addEntries = useAppStore((s) => s.addEntriesToTrip);

  const [picked, setPicked] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (open) setPicked(new Set());
  }, [open]);

  const alreadyIn = useMemo(
    () => new Set(trip?.packed.map((p) => p.gearId) ?? []),
    [trip],
  );

  const groups = useMemo(() => {
    const map = new Map<string, GearItem[]>();
    for (const id of gearOrder) {
      if (alreadyIn.has(id)) continue;
      const g = gear[id];
      if (!g) continue;
      if (!map.has(g.majorCategory)) map.set(g.majorCategory, []);
      map.get(g.majorCategory)!.push(g);
    }
    return [...map.entries()];
  }, [gear, gearOrder, alreadyIn]);

  function toggle(id: string) {
    setPicked((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function add() {
    addEntries(
      tripId,
      [...picked].map((id) => ({ gearId: id, quantity: gear[id]?.quantity ?? 1 })),
    );
    onClose();
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="장비 추가"
      rightAction={{
        label: picked.size ? `추가 (${picked.size})` : "추가",
        onClick: add,
        disabled: picked.size === 0,
        prominent: true,
      }}
    >
      {groups.length === 0 ? (
        <p className="px-6 py-10 text-center text-[15px] text-secondary">
          모든 장비가 이미 이 트립에 담겨 있어요.
        </p>
      ) : (
        <div className="pb-2">
          {groups.map(([major, items]) => (
            <section key={major}>
              <div className="flex items-baseline justify-between px-4 pb-1 pt-4">
                <span className="text-[12px] font-bold uppercase tracking-[0.06em] text-tint">
                  {major}
                </span>
                <span className="text-[12px] text-tertiary">{items.length}개</span>
              </div>
              {items.map((g, i) => (
                <div
                  key={g.id}
                  className={cn(
                    "flex items-center gap-3 px-4 py-2.5",
                    i > 0 &&
                      "relative before:pointer-events-none before:absolute before:left-4 before:right-0 before:top-0 before:h-px before:bg-separator",
                  )}
                >
                  <Checkbox
                    checked={picked.has(g.id)}
                    onChange={() => toggle(g.id)}
                    aria-label={g.name}
                  />
                  <button
                    type="button"
                    onClick={() => toggle(g.id)}
                    className="flex min-w-0 flex-1 items-center text-left active:opacity-50"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[15px] font-semibold text-label">
                        {g.name}
                      </div>
                      <div className="truncate text-[12.5px] text-secondary">
                        {[g.minorCategory, g.brand].filter(Boolean).join(" · ") || major}
                      </div>
                    </div>
                  </button>
                  <span className="shrink-0 tabular text-[14px] text-secondary">
                    {formatWeight(g.weightG, unit)}
                  </span>
                </div>
              ))}
            </section>
          ))}
        </div>
      )}
    </Sheet>
  );
}
