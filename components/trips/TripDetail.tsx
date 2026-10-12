"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { flushSync } from "react-dom";
import {
  CalendarDays,
  ChevronDown,
  CircleCheck,
  ListChecks,
  MapPin,
  Minus,
  Lock,
  LockOpen,
  Plus,
  Search,
  Share,
  Thermometer,
  Trash2,
  Users,
  Weight,
  X,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import { computeStats } from "@/lib/calc";
import type { GearItem } from "@/lib/types";
import { formatWeight, formatWeightSmart } from "@/lib/units";
import { formatTripRange, tripNights, tripStart } from "@/lib/dates";
import { tripCompanions } from "@/lib/trips";
import { cn } from "@/lib/cn";
import { Donut } from "../Donut";
import { useTopBar } from "../TopBar";
import { pinPane, unpinPane } from "../useTabSwipe";
import { InkButton } from "../ui/Glass";
import { QtyStepper } from "../ui/QtyStepper";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { ExportSheet } from "./ExportSheet";
import { RangeCalendar } from "../ui/RangeCalendar";
import { Sheet } from "../ui/Sheet";
import { SwipeRow, SwipeDeleteButton } from "../ui/SwipeRow";
import { Checkbox } from "../ui/Checkbox";
import { GearFlags } from "../ui/GearFlags";

type Mode = "none" | "check";

interface Row {
  gear: GearItem;
  quantity: number;
}

function groupByMajor(
  packed: { gearId: string; quantity: number }[],
  gear: Record<string, GearItem>,
  gearOrder: string[],
  categories: string[],
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
  // Order groups by the Gear's 대분류 order — first-occurrence order in
  // gearOrder drifts when items are reordered/moved across categories, which
  // made a category randomly sink to the bottom here. Unknown names go last,
  // keeping their relative order (sort is stable).
  const rank = (name: string) => {
    const i = categories.indexOf(name);
    return i === -1 ? categories.length : i;
  };
  return [...map.entries()].sort((a, b) => rank(a[0]) - rank(b[0]));
}

export function TripDetail({
  tripId,
  onBack,
  underlay,
  underlayScroll,
}: {
  tripId: string;
  onBack: () => void;
  /** The trip list kept mounted underneath, revealed by the swipe-back. */
  underlay?: () => HTMLDivElement | null;
  underlayScroll?: () => number;
}) {
  const trip = useAppStore((s) => s.trips[tripId]);
  const gear = useAppStore((s) => s.gear);
  const gearOrder = useAppStore((s) => s.gearOrder);
  const categories = useAppStore((s) => s.categories);
  const unit = useAppStore((s) => s.displayUnit);
  const updateTrip = useAppStore((s) => s.updateTrip);
  const deleteTrip = useAppStore((s) => s.deleteTrip);
  const removeEntry = useAppStore((s) => s.removeEntryFromTrip);
  const setEntryQuantity = useAppStore((s) => s.setEntryQuantity);
  const toggleChecked = useAppStore((s) => s.toggleTripChecked);

  const [memoOpen, setMemoOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const [calOpen, setCalOpen] = useState(false);
  const [companionDraft, setCompanionDraft] = useState("");
  // Draft for the manual extra-weight field (grams), synced per trip.
  const [extraDraft, setExtraDraft] = useState("");
  useEffect(() => {
    const t = useAppStore.getState().trips[tripId];
    setExtraDraft(t?.extraWeightG ? String(t.extraWeightG) : "");
  }, [tripId]);
  const [mode, setMode] = useState<Mode>("none");
  const [swipeOpenId, setSwipeOpenId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [pickerOpen, setPickerOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Minus at quantity 1 asks before taking the item out of the trip.
  const [removeCandidate, setRemoveCandidate] = useState<GearItem | null>(null);
  const memoRef = useRef<HTMLTextAreaElement>(null);
  const deleteBtnRef = useRef<HTMLButtonElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  useSwipeBack(rootRef, onBack, underlay, underlayScroll);

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
            categories,
          )
        : [],
    [trip, gear, gearOrder, categories, nestedSet],
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
    const s = computeStats(rows);
    // Manual extra weight joins the totals (and base weight) as its own
    // neutral-gray slice in the donut/breakdown.
    const extra = trip?.extraWeightG ?? 0;
    if (extra > 0) {
      return {
        ...s,
        totalG: s.totalG + extra,
        baseG: s.baseG + extra,
        byCategory: [
          ...s.byCategory,
          { name: "무게 추가", color: "#9b958a", weightG: extra },
        ].sort((a, b) => b.weightG - a.weightG),
      };
    }
    return s;
  }, [packed, gear, packedQty, trip?.extraWeightG]);

  // Per-category weight totals (add-ons credited to their parent's category,
  // same as the donut) — shown under each category group in the packed list.
  const catTotals = useMemo(
    () => new Map(stats.byCategory.map((c) => [c.name, c.weightG])),
    [stats],
  );

  const companions = useMemo(() => (trip ? tripCompanions(trip) : []), [trip]);

  const memo = trip?.memo ?? "";
  useEffect(() => {
    const el = memoRef.current;
    if (el && memoOpen) {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    }
  }, [memo, memoOpen]);

  const packedCount = trip?.packed.length ?? 0;
  const checkedTotal = (trip?.checked ?? []).filter((id) =>
    packedQty.has(id),
  ).length;
  useTopBar({
    onBack,
    actions: [
      {
        id: "export",
        label: "내보내기",
        icon: <Share size={20} strokeWidth={2.1} />,
        onTap: () => setExportOpen(true),
      },
    ],
    center: mode === "check" ? `${checkedTotal}/${packedCount} 챙김` : undefined,
    menu: [
      {
        id: "check",
        label: mode === "check" ? "점검 끝내기" : "장비 점검",
        icon: <ListChecks size={20} />,
        checked: mode === "check",
        onSelect: () => {
          setSwipeOpenId(null);
          setSelectedId(null);
          setMode((m) => (m === "check" ? "none" : "check"));
        },
      },
      {
        id: "memo-lock",
        label: trip?.memoLocked ? "메모 보호 해제" : "메모 보호",
        icon: trip?.memoLocked ? <LockOpen size={20} /> : <Lock size={20} />,
        onSelect: () => updateTrip(tripId, { memoLocked: !trip?.memoLocked }),
      },
      {
        id: "delete",
        label: "트립 삭제",
        icon: <Trash2 size={20} />,
        danger: true,
        group: true,
        onSelect: () => {
          setConfirmDelete(true);
          window.setTimeout(
            () =>
              deleteBtnRef.current?.scrollIntoView({
                block: "center",
                behavior: "smooth",
              }),
            50,
          );
        },
      },
    ],
  });

  if (!trip) return null;

  const checkedSet = new Set(trip.checked ?? []);
  const isChecking = mode === "check";

  function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    deleteTrip(tripId);
    onBack();
  }

  function addCompanion() {
    const name = companionDraft.trim();
    setCompanionDraft("");
    if (!name || companions.includes(name)) return;
    updateTrip(tripId, { companions: [...companions, name] });
  }
  function removeCompanion(index: number) {
    updateTrip(tripId, {
      companions: companions.filter((_, i) => i !== index),
    });
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
      hasAddOns?: boolean;
      expanded?: boolean;
      major?: string;
    },
  ) {
    const { nested, hasAddOns, expanded, major } = opts;
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
        bgClassName="bg-bg"
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
            selected && "bg-selected",
            dim && "opacity-25",
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
              <GearFlags worn={g.worn} consumable={g.consumable} />
            </div>
            {!nested && (
              <div className="mt-0.5 truncate text-[12.5px] leading-tight text-secondary">
                {[g.minorCategory, g.brand].filter(Boolean).join(" · ") || major}
              </div>
            )}
          </div>
          {selected && (
            <QtyStepper
              value={quantity}
              size={nested ? "sm" : "md"}
              onChange={(n) => setEntryQuantity(tripId, g.id, n)}
              onRemove={() => setRemoveCandidate(g)}
            />
          )}
          <div className="-mr-1.5 flex w-6 shrink-0 justify-center">
            {!nested && hasAddOns && (
              <button
                type="button"
                aria-label="애드온 펼치기"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleItemExpand(g.id);
                }}
                className="grid h-7 w-7 touch-manipulation place-items-center rounded-full text-tint active:bg-fill"
              >
                <ChevronDown
                  size={18}
                  className={cn("transition-transform", expanded && "rotate-180")}
                />
              </button>
            )}
          </div>
          <span
            className={cn(
              "min-w-[52px] shrink-0 whitespace-nowrap text-right tabular",
              nested ? "text-[13px] text-tertiary" : "text-[14px] text-secondary",
            )}
          >
            {formatWeight(g.weightG, unit)}
            {quantity > 1 && !selected && (
              <span className="text-tertiary"> ×{quantity}</span>
            )}
          </span>
        </div>
      </SwipeRow>
      </Fragment>
    );
  }

  return (
    <div ref={rootRef} data-no-tab-swipe className="min-h-dvh pb-40">
      <div className="space-y-4 px-4 pt-2">
        <div className="px-1">
          <input
            value={trip.name}
            onChange={(e) => updateTrip(tripId, { name: e.target.value })}
            placeholder="트립 이름"
            className="w-full bg-transparent text-[30px] font-bold tracking-[-0.025em] text-label outline-none placeholder:text-tertiary"
          />
          {/* Date range — tap to open the calendar; first tap = start, second = end */}
          <button
            type="button"
            onClick={() => setCalOpen((o) => !o)}
            aria-expanded={calOpen}
            className="mt-1 flex items-center gap-1.5 text-[14px] active:opacity-60"
          >
            <CalendarDays size={15} className="shrink-0 text-tertiary" />
            <span
              className={cn(
                "tabular",
                tripStart(trip) ? "text-secondary" : "text-tertiary",
              )}
            >
              {formatTripRange(tripStart(trip), trip.endDate)}
            </span>
            {tripNights(tripStart(trip), trip.endDate) && (
              <span className="text-[13px] font-medium text-tint">
                {tripNights(tripStart(trip), trip.endDate)}
              </span>
            )}
          </button>
          <AnimatePresence initial={false}>
            {calOpen && (
              <motion.div
                key="trip-cal"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.22, ease: [0.22, 0.61, 0.36, 1] }}
                className="overflow-hidden"
              >
                <div className="pt-2">
                  <RangeCalendar
                    start={tripStart(trip)}
                    end={trip.endDate}
                    onChange={(s, e) => {
                      updateTrip(tripId, {
                        startDate: s,
                        date: s,
                        endDate: e,
                      });
                      // Range complete → tuck the calendar away after a beat.
                      if (s && e) window.setTimeout(() => setCalOpen(false), 300);
                    }}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          {/* 누구와 — tag chips + inline input, same hierarchy as the date line */}
          <div className="mt-1.5 flex items-start gap-1.5">
            <Users size={15} className="mt-[4px] shrink-0 text-tertiary" />
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
              {companions.map((name, i) => (
                <span
                  key={`${name}-${i}`}
                  className="flex h-[22px] items-center gap-0.5 rounded-full bg-fill pl-2 pr-1 text-[12.5px] font-medium text-secondary"
                >
                  {name}
                  <button
                    type="button"
                    aria-label={`${name} 삭제`}
                    onClick={() => removeCompanion(i)}
                    className="grid h-[16px] w-[16px] touch-manipulation place-items-center rounded-full text-tertiary active:opacity-50"
                  >
                    <X size={11} />
                  </button>
                </span>
              ))}
              <input
                value={companionDraft}
                onChange={(e) => setCompanionDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.nativeEvent.isComposing) return; // mid-Hangul composition
                  if (e.key === "Enter" || e.key === "," || e.key === " ") {
                    e.preventDefault();
                    addCompanion();
                  } else if (
                    e.key === "Backspace" &&
                    !companionDraft &&
                    companions.length > 0
                  ) {
                    removeCompanion(companions.length - 1);
                  }
                }}
                onBlur={addCompanion}
                placeholder={companions.length ? "" : "함께한 사람"}
                enterKeyHint="done"
                className="h-[22px] min-w-[72px] flex-1 bg-transparent text-[14px] text-secondary outline-none placeholder:text-tertiary"
              />
            </div>
          </div>
          <div className="mt-1.5 flex items-center gap-1.5">
            <MapPin size={15} className="shrink-0 text-tertiary" />
            <input
              value={trip.place ?? ""}
              onChange={(e) => updateTrip(tripId, { place: e.target.value })}
              placeholder="장소"
              className="min-w-0 flex-1 bg-transparent text-[14px] text-secondary outline-none placeholder:text-tertiary"
            />
          </div>
          {/* 기온 — 최저 ~ 최고 range */}
          <div className="mt-1.5 flex items-center gap-1.5">
            <Thermometer size={15} className="shrink-0 text-tertiary" />
            <TempInput
              value={trip.tempLow ?? ""}
              placeholder="최저"
              onChange={(v) => updateTrip(tripId, { tempLow: v || undefined })}
            />
            <span className="text-[14px] text-tertiary">~</span>
            <TempInput
              value={trip.tempHigh ?? ""}
              placeholder="최고"
              onChange={(v) => updateTrip(tripId, { tempHigh: v || undefined })}
            />
            <span className="text-[14px] text-tertiary">℃</span>
          </div>
        </div>

        {/* Collapsible memo — full text when expanded */}
        <div className="overflow-hidden rounded-[24px] bg-card">
          <button
            type="button"
            onClick={() => setMemoOpen((o) => !o)}
            className="flex h-12 w-full items-center justify-between px-4 active:bg-fill"
          >
            <span className="flex items-center gap-1.5 text-[15px] font-semibold text-label">
              메모
              {trip.memoLocked && (
                <Lock size={13} strokeWidth={2.4} className="text-tertiary" aria-label="보호됨" />
              )}
            </span>
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
                // Protected memos are read-only: no caret, no keyboard.
                readOnly={trip.memoLocked}
                tabIndex={trip.memoLocked ? -1 : undefined}
                placeholder={trip.memoLocked ? "" : "이 트립에서 기록하고 싶은 내용을 적어두세요."}
                rows={1}
                className="w-full resize-none overflow-hidden bg-transparent text-[14px] leading-relaxed text-label outline-none placeholder:text-tertiary"
              />
            </div>
          )}
        </div>

        {/* Summary — tap to expand the per-category weight breakdown */}
        <div className="overflow-hidden rounded-[24px] bg-card">
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
              <Stat label="소모" value={formatWeightSmart(stats.consumableG, unit)} color="var(--tertiary)" />
              <Stat label="총 무게" value={formatWeightSmart(stats.totalG, unit)} strong />
            </div>
            <ChevronDown
              size={18}
              className={cn(
                "shrink-0 self-center text-tertiary transition-transform",
                !catOpen && "-rotate-90",
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

      </div>

      {/* Packed gear — flat list */}
      <div className="mt-3">
        {/* Manual extra weight — reflected in totals without picking gear */}
        <div className="flex items-center gap-2.5 px-4 py-2.5">
          <Weight size={16} className="shrink-0 text-tertiary" />
          <span className="min-w-0 flex-1 text-[15px] font-medium text-secondary">
            무게 추가
          </span>
          <input
            value={extraDraft}
            onChange={(e) => {
              const clean = e.target.value
                .replace(/[^\d.]/g, "")
                .replace(/(\..*)\./g, "$1")
                .slice(0, 7);
              setExtraDraft(clean);
              const n = Math.round((parseFloat(clean) || 0) * 10) / 10;
              updateTrip(tripId, { extraWeightG: n > 0 ? n : undefined });
            }}
            placeholder="0"
            inputMode="decimal"
            className="w-24 rounded-full bg-fill px-3 py-1 text-right tabular text-[14px] text-label outline-none placeholder:text-tertiary"
          />
          <span className="shrink-0 text-[14px] text-secondary">g</span>
          <span className="w-6 shrink-0" />
        </div>
        {groups.map(([major, rows]) => (
          <section key={major}>
            <div className="flex items-baseline justify-between px-4 pb-3 pt-5">
              <span className="text-[17px] font-bold tracking-[-0.01em] text-tertiary">
                {major}
              </span>
              <span className="tabular text-[13px] font-medium text-tertiary">
                {rows.length}개, {formatWeightSmart(catTotals.get(major) ?? 0, unit)}
              </span>
            </div>
            {rows.map(({ gear: g, quantity }) => {
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
          </section>
        ))}

        {groups.length === 0 && (
          <p className="px-4 py-12 text-center text-[15px] text-secondary">
            아직 챙긴 장비가 없어요. Add로 추가해보세요.
          </p>
        )}
      </div>

      <div className="mt-6 space-y-3 px-4">
        <button
          ref={deleteBtnRef}
          type="button"
          onClick={handleDelete}
          className={cn(
            "flex h-[52px] w-full items-center justify-center gap-2 rounded-full text-[17px] font-medium transition active:scale-[0.97]",
            confirmDelete ? "bg-red text-white" : "bg-fill text-red",
          )}
        >
          <Trash2 size={17} />
          {confirmDelete ? "한 번 더 눌러 삭제" : "트립 삭제"}
        </button>
      </div>

      <ConfirmDialog
        open={removeCandidate !== null}
        title="트립에서 삭제할까요?"
        message={removeCandidate ? `${removeCandidate.name}을(를) 이 트립에서 뺍니다.` : undefined}
        confirmLabel="삭제"
        destructive
        onConfirm={() => {
          if (removeCandidate) removeEntry(tripId, removeCandidate.id);
          setRemoveCandidate(null);
          setSelectedId(null);
        }}
        onCancel={() => setRemoveCandidate(null)}
      />

      <div className="fixed right-4 z-40" style={{ bottom: "var(--bar-bottom)" }}>
        <InkButton size="lg" onClick={() => setPickerOpen(true)}>
          <Plus size={22} strokeWidth={2.4} /> Add
        </InkButton>
      </div>

      <ExportSheet open={exportOpen} onClose={() => setExportOpen(false)} tripId={tripId} />

      <GearPickerSheet
        open={pickerOpen}
        tripId={tripId}
        onClose={() => setPickerOpen(false)}
      />
    </div>
  );
}

/**
 * Swipe right anywhere except item rows (or from the left edge, rows
 * included) to go back. The detail and the trip list underneath are pinned
 * to the viewport at their own scroll offsets for the gesture, so the real
 * list slides in from behind (iOS parallax) instead of a blank page.
 */
function useSwipeBack(
  rootRef: React.RefObject<HTMLDivElement | null>,
  onBack: () => void,
  underlay?: () => HTMLDivElement | null,
  underlayScroll?: () => number,
) {
  const latest = useRef({ onBack, underlay, underlayScroll });
  useEffect(() => {
    latest.current = { onBack, underlay, underlayScroll };
  });

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const EXCLUDE =
      "[data-swipe-row], .overflow-x-auto, input, textarea, select, [contenteditable], .touch-none";
    type Phase = "idle" | "pending" | "drag" | "settling";
    const g = {
      phase: "idle" as Phase,
      x0: 0,
      y0: 0,
      dx: 0,
      lastX: 0,
      lastT: 0,
      v: 0,
      width: 0,
      scroll: 0,
      list: null as HTMLDivElement | null,
    };

    const paint = (x: number) => {
      root.style.transform = `translate3d(${x}px,0,0)`;
      if (g.list) g.list.style.transform = `translate3d(${(x - g.width) * 0.3}px,0,0)`;
    };
    const begin = () => {
      const pane = root.parentElement;
      if (!pane) return false;
      const rect = pane.getBoundingClientRect();
      // content starts below the tab pane's top padding (floating bar)
      const contentTop = parseFloat(getComputedStyle(pane).paddingTop) || 0;
      g.width = rect.width;
      g.scroll = window.scrollY;
      pinPane(root, g.scroll, rect, 2, contentTop);
      root.style.boxShadow = "-8px 0 24px rgba(0,0,0,0.12)";
      g.list = latest.current.underlay?.() ?? null;
      if (g.list) pinPane(g.list, latest.current.underlayScroll?.() ?? 0, rect, 1, contentTop);
      return true;
    };
    const finish = (commit: boolean) => {
      const list = g.list;
      g.phase = "idle";
      g.list = null;
      if (commit) {
        flushSync(() => latest.current.onBack());
        unpinPane(list);
        window.scrollTo(0, latest.current.underlayScroll?.() ?? 0);
      } else {
        unpinPane(root);
        root.style.removeProperty("box-shadow");
        unpinPane(list);
        if (list) list.hidden = true;
        window.scrollTo(0, g.scroll);
      }
    };
    const settle = (commit: boolean) => {
      g.phase = "settling";
      const ease = "transform 0.3s cubic-bezier(0.22, 0.8, 0.28, 1)";
      root.style.transition = ease;
      if (g.list) g.list.style.transition = ease;
      paint(commit ? g.width : 0);
      window.setTimeout(() => finish(commit), 310);
    };

    const onStart = (e: TouchEvent) => {
      if (g.phase === "settling") return;
      g.phase = "idle";
      if (e.touches.length !== 1) return;
      const t = e.target as Element | null;
      const touch = e.touches[0];
      if (!t || !root.contains(t)) return;
      const fromEdge = touch.clientX < 24;
      if (!fromEdge && t.closest(EXCLUDE)) return;
      if (document.querySelector('[role="dialog"]')) return;
      g.phase = "pending";
      g.x0 = g.lastX = touch.clientX;
      g.y0 = touch.clientY;
      g.lastT = e.timeStamp;
      g.dx = 0;
      g.v = 0;
    };
    const onMove = (e: TouchEvent) => {
      if (g.phase !== "pending" && g.phase !== "drag") return;
      const touch = e.touches[0];
      const dx = touch.clientX - g.x0;
      const dy = touch.clientY - g.y0;
      if (g.phase === "pending") {
        if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
        if (dx > 0 && Math.abs(dx) > Math.abs(dy) * 1.3 && begin()) g.phase = "drag";
        else {
          g.phase = "idle";
          return;
        }
      }
      e.preventDefault();
      const dt = Math.max(1, e.timeStamp - g.lastT);
      g.v = (touch.clientX - g.lastX) / dt;
      g.lastX = touch.clientX;
      g.lastT = e.timeStamp;
      g.dx = Math.max(0, Math.min(g.width, dx));
      paint(g.dx);
    };
    const onEnd = () => {
      if (g.phase !== "drag") {
        if (g.phase !== "settling") g.phase = "idle";
        return;
      }
      const commit = (g.dx > g.width * 0.33 || g.v > 0.35) && g.v > -0.2;
      settle(commit);
    };

    root.addEventListener("touchstart", onStart, { passive: true });
    root.addEventListener("touchmove", onMove, { passive: false });
    root.addEventListener("touchend", onEnd);
    root.addEventListener("touchcancel", onEnd);
    return () => {
      root.removeEventListener("touchstart", onStart);
      root.removeEventListener("touchmove", onMove);
      root.removeEventListener("touchend", onEnd);
      root.removeEventListener("touchcancel", onEnd);
    };
  }, [rootRef]);
}

/** Small temperature field — free-text so a minus sign is typeable on iOS
 *  (numeric keyboards there have no "−"); sanitised to an optional leading
 *  minus + up to 3 digits. */
function TempInput({
  value,
  placeholder,
  onChange,
}: {
  value: string;
  placeholder: string;
  onChange: (v: string) => void;
}) {
  return (
    <input
      value={value}
      onChange={(e) => {
        const v = e.target.value
          .replace(/[^\d-]/g, "")
          .replace(/(?!^)-/g, "")
          .slice(0, 4);
        onChange(v);
      }}
      placeholder={placeholder}
      className="w-9 bg-transparent text-center tabular text-[14px] text-secondary outline-none placeholder:text-tertiary"
    />
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
  const categories = useAppStore((s) => s.categories);
  const trip = useAppStore((s) => s.trips[tripId]);
  const unit = useAppStore((s) => s.displayUnit);
  const addEntries = useAppStore((s) => s.addEntriesToTrip);

  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [qty, setQty] = useState<Record<string, number>>({});
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  useEffect(() => {
    if (open) {
      setPicked(new Set());
      setQty({});
      setExpandedIds(new Set());
      setCollapsedIds(new Set());
      setQuery("");
    }
  }, [open]);
  const q = query.trim().toLowerCase();

  const alreadyIn = useMemo(
    () => new Set(trip?.packed.map((p) => p.gearId) ?? []),
    [trip],
  );

  // Add-ons whose parent is also pickable nest under that parent (excluded
  // from the top level), mirroring the shelf. An add-on whose parent is
  // already packed stays at the top level so it remains reachable.
  const nestedSet = useMemo(() => {
    const s = new Set<string>();
    for (const id of gearOrder) {
      const g = gear[id];
      if (!g || alreadyIn.has(id)) continue;
      for (const aid of g.addOnIds) {
        if (gear[aid] && !alreadyIn.has(aid)) s.add(aid);
      }
    }
    return s;
  }, [gearOrder, gear, alreadyIn]);

  const groups = useMemo(() => {
    const map = new Map<string, GearItem[]>();
    const matches = (g: GearItem) =>
      [g.name, g.brand ?? "", g.minorCategory ?? "", g.majorCategory].some((v) =>
        v.toLowerCase().includes(q),
      );
    for (const id of gearOrder) {
      // Searching lists every match flat (add-ons included), unnested.
      if (alreadyIn.has(id) || (!q && nestedSet.has(id))) continue;
      const g = gear[id];
      if (!g || (q && !matches(g))) continue;
      if (!map.has(g.majorCategory)) map.set(g.majorCategory, []);
      map.get(g.majorCategory)!.push(g);
    }
    // Same Gear 대분류 order as the packed list.
    const rank = (name: string) => {
      const i = categories.indexOf(name);
      return i === -1 ? categories.length : i;
    };
    return [...map.entries()].sort((a, b) => rank(a[0]) - rank(b[0]));
  }, [gear, gearOrder, categories, alreadyIn, nestedSet, q]);

  function toggle(id: string) {
    const willPick = !picked.has(id);
    setPicked((prev) => {
      const n = new Set(prev);
      if (willPick) n.add(id);
      else n.delete(id);
      return n;
    });
    if (willPick) {
      // Seed the pack quantity from the gear's base quantity.
      setQty((q) => (q[id] ? q : { ...q, [id]: gear[id]?.quantity ?? 1 }));
      // Re-enable auto-expand of this row's add-ons.
      setCollapsedIds((s) => {
        if (!s.has(id)) return s;
        const n = new Set(s);
        n.delete(id);
        return n;
      });
    }
  }

  function step(id: string, delta: number) {
    setQty((q) => ({ ...q, [id]: Math.max(1, (q[id] ?? 1) + delta) }));
  }

  function toggleExpand(id: string, isExpanded: boolean) {
    if (isExpanded) {
      setCollapsedIds((s) => new Set(s).add(id));
      setExpandedIds((s) => {
        const n = new Set(s);
        n.delete(id);
        return n;
      });
    } else {
      setExpandedIds((s) => new Set(s).add(id));
      setCollapsedIds((s) => {
        const n = new Set(s);
        n.delete(id);
        return n;
      });
    }
  }

  function add() {
    addEntries(
      tripId,
      [...picked].map((id) => ({
        gearId: id,
        quantity: qty[id] ?? gear[id]?.quantity ?? 1,
      })),
    );
    onClose();
  }

  function renderPickRow(
    g: GearItem,
    opts: {
      nested?: boolean;
      major?: string;
      hasAddOns?: boolean;
      expanded?: boolean;
    },
  ) {
    const { nested, major, hasAddOns, expanded } = opts;
    const isPicked = picked.has(g.id);
    return (
      <div
        key={g.id}
        className={cn(
          "flex items-center gap-2.5 py-2.5",
          nested ? "pl-9 pr-4" : "px-4",
        )}
      >
        <Checkbox
          checked={isPicked}
          onChange={() => toggle(g.id)}
          aria-label={g.name}
        />
        <button
          type="button"
          onClick={() => toggle(g.id)}
          className="flex min-w-0 flex-1 items-center text-left active:opacity-50"
        >
          <div className="min-w-0 flex-1">
            <div
              className={cn(
                "truncate font-semibold",
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
            </div>
            {!nested && (
              <div className="truncate text-[12.5px] text-secondary">
                {[g.minorCategory, g.brand].filter(Boolean).join(" · ") || major}
              </div>
            )}
          </div>
        </button>
        {isPicked && (
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              aria-label="수량 감소"
              onClick={() => step(g.id, -1)}
              className="grid h-7 w-7 touch-manipulation place-items-center rounded-full bg-fill text-label active:opacity-60"
            >
              <Minus size={14} />
            </button>
            <span className="w-5 text-center tabular text-[14px] font-semibold text-label">
              {qty[g.id] ?? 1}
            </span>
            <button
              type="button"
              aria-label="수량 증가"
              onClick={() => step(g.id, 1)}
              className="grid h-7 w-7 touch-manipulation place-items-center rounded-full bg-fill text-label active:opacity-60"
            >
              <Plus size={14} />
            </button>
          </div>
        )}
        <div className="-mr-1.5 flex w-6 shrink-0 justify-center">
          {!nested && hasAddOns && (
            <button
              type="button"
              aria-label="애드온 펼치기"
              onClick={() => toggleExpand(g.id, !!expanded)}
              className="grid h-7 w-7 touch-manipulation place-items-center rounded-full text-tint active:bg-fill"
            >
              <ChevronDown
                size={17}
                className={cn("transition-transform", expanded && "rotate-180")}
              />
            </button>
          )}
        </div>
        <span
          className={cn(
            "min-w-[52px] shrink-0 whitespace-nowrap text-right tabular",
            nested ? "text-[13px] text-tertiary" : "text-[14px] text-secondary",
          )}
        >
          {formatWeight(g.weightG, unit)}
        </span>
      </div>
    );
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
      <div className="px-4 pb-1">
        <div className="flex h-11 items-center gap-2.5 rounded-full bg-fill px-4">
          <Search size={17} className="shrink-0 text-tertiary" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="장비 검색…"
            enterKeyHint="search"
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
      {groups.length === 0 ? (
        <p className="px-6 py-10 text-center text-[15px] text-secondary">
          {q ? "검색 결과가 없습니다." : "모든 장비가 이미 이 트립에 담겨 있어요."}
        </p>
      ) : (
        <div className="pb-2">
          {groups.map(([major, items]) => (
            <section key={major}>
              <div className="flex items-baseline justify-between px-4 pb-3 pt-4">
                <span className="text-[17px] font-bold tracking-[-0.01em] text-tertiary">
                  {major}
                </span>
                <span className="text-[13px] text-tertiary">{items.length}개</span>
              </div>
              {items.map((g) => {
                const addOns = q
                  ? []
                  : g.addOnIds
                      .map((aid) => gear[aid])
                      .filter(
                        (a): a is GearItem => Boolean(a) && !alreadyIn.has(a.id),
                      );
                const autoOpen =
                  picked.has(g.id) || addOns.some((a) => picked.has(a.id));
                const isExpanded =
                  (expandedIds.has(g.id) || autoOpen) && !collapsedIds.has(g.id);
                return (
                  <Fragment key={g.id}>
                    {renderPickRow(g, {
                      major,
                      hasAddOns: addOns.length > 0,
                      expanded: isExpanded,
                    })}
                    <AnimatePresence initial={false}>
                      {isExpanded && addOns.length > 0 && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{
                            duration: 0.22,
                            ease: [0.22, 0.61, 0.36, 1],
                          }}
                          className="overflow-hidden"
                        >
                          {addOns.map((a) => renderPickRow(a, { nested: true }))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </Fragment>
                );
              })}
            </section>
          ))}
        </div>
      )}
    </Sheet>
  );
}
