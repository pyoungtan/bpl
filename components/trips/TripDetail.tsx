"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronLeft,
  CircleCheck,
  ListChecks,
  Plus,
  Trash2,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import { computeStats } from "@/lib/calc";
import type { GearItem } from "@/lib/types";
import { formatWeight, formatWeightSmart } from "@/lib/units";
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
  const toggleChecked = useAppStore((s) => s.toggleTripChecked);

  const [memoOpen, setMemoOpen] = useState(true);
  const [mode, setMode] = useState<Mode>("none");
  const [swipeOpenId, setSwipeOpenId] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const memoRef = useRef<HTMLTextAreaElement>(null);

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
  // Stats count every packed item (parents + nested add-ons).
  const stats = useMemo(
    () =>
      computeStats(
        packed
          .map((p) => ({ gear: gear[p.gearId], quantity: p.quantity }))
          .filter((r): r is { gear: GearItem; quantity: number } =>
            Boolean(r.gear),
          ),
      ),
    [packed, gear],
  );

  const memo = trip?.memo ?? "";
  useEffect(() => {
    const el = memoRef.current;
    if (el && memoOpen) {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    }
  }, [memo, memoOpen]);

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
    return (
      <SwipeRow
        key={g.id}
        id={g.id}
        openId={swipeOpenId}
        onOpenChange={setSwipeOpenId}
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
          onClick={isChecking ? () => toggleChecked(tripId, g.id) : undefined}
          className={cn(
            "flex w-full items-center gap-2.5 py-2.5 text-left transition",
            nested ? "pl-9 pr-4" : "px-4",
            isChecking && "cursor-pointer active:bg-fill",
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
    );
  }

  return (
    <div className="pb-40">
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
          <input
            type="date"
            value={trip.date ?? ""}
            onChange={(e) => updateTrip(tripId, { date: e.target.value || undefined })}
            className="mt-1 bg-transparent text-[14px] text-secondary outline-none"
          />
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

        {/* Summary */}
        <div className="rounded-[14px] bg-card p-4">
          <div className="flex items-center gap-4">
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
          </div>
        </div>
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
