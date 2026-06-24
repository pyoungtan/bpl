"use client";

import { Fragment, useMemo, useRef, useState } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowRight,
  Bookmark,
  Check,
  GripVertical,
  Plus,
  Search,
  Settings,
  SlidersHorizontal,
  SquarePen,
  X,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import type { GearItem, WeightUnit } from "@/lib/types";
import { computeStats } from "@/lib/calc";
import { formatPrice, formatWeight, formatWeightSmart } from "@/lib/units";
import { cn } from "@/lib/cn";
import { ScreenHeader } from "../ScreenHeader";
import { Button } from "../ui/Button";
import { NotePopup } from "../NotePopup";
import { GearRow } from "./GearRow";
import { GearEditorSheet } from "./GearEditorSheet";
import { AddToTripSheet } from "./AddToTripSheet";
import { CategoryManagerSheet } from "./CategoryManagerSheet";
import { PresetsSheet } from "./PresetsSheet";

export function GearShelf({
  onOpenSettings,
  onOpenTrip,
}: {
  onOpenSettings: () => void;
  onOpenTrip: (tripId: string) => void;
}) {
  const gear = useAppStore((s) => s.gear);
  const gearOrder = useAppStore((s) => s.gearOrder);
  const categories = useAppStore((s) => s.categories);
  const unit = useAppStore((s) => s.displayUnit);
  const currency = useAppStore((s) => s.currency);
  const reorderGear = useAppStore((s) => s.reorderGear);
  const deleteGear = useAppStore((s) => s.deleteGear);
  const setGearHidden = useAppStore((s) => s.setGearHidden);

  const [editMode, setEditMode] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeCat, setActiveCat] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  // Rows the user explicitly collapsed, overriding auto-open (e.g. when selected).
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [swipeOpenId, setSwipeOpenId] = useState<string | null>(null);
  const [editor, setEditor] = useState<{ open: boolean; gear: GearItem | null }>({
    open: false,
    gear: null,
  });
  const [addTripOpen, setAddTripOpen] = useState(false);
  const [catMgrOpen, setCatMgrOpen] = useState(false);
  const [presetsOpen, setPresetsOpen] = useState(false);
  const [peek, setPeek] = useState<{
    note: string;
    priceText: string | null;
    rect: DOMRect;
  } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  // Items that are an add-on of another item — hidden from the top-level list.
  const addOnIdSet = useMemo(() => {
    const set = new Set<string>();
    for (const id of gearOrder) {
      const g = gear[id];
      if (g) for (const a of g.addOnIds) set.add(a);
    }
    return set;
  }, [gear, gearOrder]);

  const allGroups = useMemo(() => {
    const byCat = new Map<string, GearItem[]>();
    for (const id of gearOrder) {
      if (addOnIdSet.has(id)) continue;
      const g = gear[id];
      if (!g || g.hidden) continue;
      if (!byCat.has(g.majorCategory)) byCat.set(g.majorCategory, []);
      byCat.get(g.majorCategory)!.push(g);
    }
    const ordered: [string, GearItem[]][] = [];
    const used = new Set<string>();
    for (const c of categories) {
      ordered.push([c, byCat.get(c) ?? []]);
      used.add(c);
    }
    for (const [c, items] of byCat) {
      if (!used.has(c)) ordered.push([c, items]);
    }
    return ordered.filter(([, items]) => items.length > 0);
  }, [gear, gearOrder, categories, addOnIdSet]);

  const chipCats = useMemo(() => allGroups.map(([c]) => c), [allGroups]);

  const hiddenItems = useMemo(
    () =>
      gearOrder
        .map((id) => gear[id])
        .filter((g): g is GearItem => Boolean(g) && Boolean(g.hidden)),
    [gear, gearOrder],
  );

  const q = query.trim().toLowerCase();
  const visibleGroups = useMemo(() => {
    return allGroups
      .filter(([m]) => activeCat === "all" || m === activeCat)
      .map(([m, items]) => {
        const filtered =
          editMode || !q
            ? items
            : items.filter(
                (g) =>
                  g.name.toLowerCase().includes(q) ||
                  (g.brand ?? "").toLowerCase().includes(q) ||
                  (g.minorCategory ?? "").toLowerCase().includes(q),
              );
        return [m, filtered] as [string, GearItem[]];
      })
      .filter(([, items]) => items.length > 0);
  }, [allGroups, activeCat, editMode, q]);

  const totals = useMemo(
    () =>
      computeStats(
        gearOrder
          .map((id) => gear[id])
          .filter((g): g is GearItem => Boolean(g) && !g.hidden)
          .map((g) => ({ gear: g, quantity: 1 })),
      ),
    [gear, gearOrder],
  );

  const selectedStats = useMemo(
    () =>
      computeStats(
        [...selected]
          .map((id) => gear[id])
          .filter((g): g is GearItem => Boolean(g))
          .map((g) => ({ gear: g, quantity: g.quantity })),
      ),
    [selected, gear],
  );

  function toggleSelect(id: string) {
    const willSelect = !selected.has(id);
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
    // Selecting a row re-enables its auto-open (clears any manual collapse).
    if (willSelect && collapsed.has(id)) {
      setCollapsed((prev) => {
        const n = new Set(prev);
        n.delete(id);
        return n;
      });
    }
  }
  function toggleExpand(id: string, currentlyExpanded: boolean) {
    if (currentlyExpanded) {
      setExpanded((prev) => {
        const n = new Set(prev);
        n.delete(id);
        return n;
      });
      setCollapsed((prev) => new Set(prev).add(id));
    } else {
      setExpanded((prev) => new Set(prev).add(id));
      setCollapsed((prev) => {
        const n = new Set(prev);
        n.delete(id);
        return n;
      });
    }
  }
  function clearSelection() {
    setSelected(new Set());
    setCollapsed(new Set());
  }
  function applyPreset(gearIds: string[]) {
    setSelected(new Set(gearIds.filter((id) => gear[id])));
  }
  function resolveAddOns(g: GearItem) {
    return g.addOnIds
      .map((id) => gear[id])
      .filter((x): x is GearItem => Boolean(x));
  }

  function handleDragEnd(major: string, event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = (allGroups.find(([m]) => m === major)?.[1] ?? []).map((g) => g.id);
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    reorderGear(major, arrayMove(ids, oldIndex, newIndex));
  }

  const selecting = selected.size > 0;

  return (
    <div className="pb-40">
      <ScreenHeader
        title="Gear Shelf"
        subtitle={
          selecting ? (
            <span className="font-medium text-tint">
              {selected.size}개 선택 · {formatWeightSmart(selectedStats.totalG, unit)}
            </span>
          ) : (
            `${totals.itemCount}개 장비 · ${formatWeightSmart(totals.totalG, unit)}`
          )
        }
        trailing={
          <>
            {!editMode && (
              <Button
                variant="plain"
                size="icon"
                aria-label="검색"
                onClick={() => {
                  setSearchOpen((o) => !o);
                  if (searchOpen) setQuery("");
                }}
              >
                <Search size={20} />
              </Button>
            )}
            <Button
              variant="plain"
              size="icon"
              aria-label={editMode ? "편집 완료" : "편집"}
              onClick={() => {
                setEditMode((e) => !e);
                clearSelection();
                setSwipeOpenId(null);
                setSearchOpen(false);
                setQuery("");
              }}
              className={cn(editMode && "bg-tint-soft")}
            >
              {editMode ? <Check size={21} /> : <SquarePen size={19} />}
            </Button>
            <Button variant="plain" size="icon" aria-label="설정" onClick={onOpenSettings}>
              <Settings size={20} />
            </Button>
          </>
        }
      />

      {!editMode && searchOpen && (
        <div className="px-4 pb-1 pt-1">
          <div className="flex h-10 items-center gap-2.5 rounded-[12px] bg-fill px-3.5">
            <Search size={17} className="shrink-0 text-tertiary" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="장비 검색…"
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

      {!editMode && chipCats.length > 0 && (
        <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-1 pt-2">
          <button
            type="button"
            onClick={() => setPresetsOpen(true)}
            aria-label="프리셋"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-tint/40 bg-tint-soft text-tint transition active:opacity-60"
          >
            <Bookmark size={15} />
          </button>
          <span className="my-1 w-px shrink-0 bg-separator" />
          {["all", ...chipCats].map((c) => {
            const active = c === activeCat;
            return (
              <button
                key={c}
                type="button"
                onClick={() => setActiveCat(c)}
                className={cn(
                  "h-8 shrink-0 whitespace-nowrap rounded-full px-3.5 text-[13px] font-medium transition active:opacity-60",
                  active ? "bg-tint text-white" : "bg-fill text-secondary",
                )}
              >
                {c === "all" ? "전체" : c}
              </button>
            );
          })}
        </div>
      )}

      {editMode && (
        <div className="px-4 pb-1 pt-2">
          <button
            type="button"
            onClick={() => setCatMgrOpen(true)}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-[12px] bg-card text-[15px] font-medium text-tint active:opacity-60"
          >
            <SlidersHorizontal size={17} /> 대분류 추가·정렬
          </button>
        </div>
      )}

      <div className="pt-1">
        {visibleGroups.map(([major, items]) => (
          <section key={major}>
            <div className="flex items-baseline justify-between px-4 pb-1 pt-5">
              <span className="text-[12px] font-bold uppercase tracking-[0.06em] text-tint">
                {major}
              </span>
              <span className="text-[12px] text-tertiary">{items.length}개</span>
            </div>

            {editMode ? (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={(e) => handleDragEnd(major, e)}
              >
                <SortableContext
                  items={items.map((i) => i.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {items.map((g, i) => (
                    <SortableGearRow
                      key={g.id}
                      id={g.id}
                      gear={g}
                      unit={unit}
                      topHairline={i > 0}
                      onEdit={() => setEditor({ open: true, gear: g })}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            ) : (
              items.map((g, i) => {
                const addOns = resolveAddOns(g);
                const autoOpen =
                  selected.has(g.id) || addOns.some((a) => selected.has(a.id));
                const isExpanded =
                  (expanded.has(g.id) || autoOpen) && !collapsed.has(g.id);
                return (
                  <Fragment key={g.id}>
                    <GearRow
                      gear={g}
                      unit={unit}
                      selected={selected.has(g.id)}
                      onTap={() => {
                        if (swipeOpenId) {
                          setSwipeOpenId(null);
                          return;
                        }
                        toggleSelect(g.id);
                      }}
                      hasAddOns={addOns.length > 0}
                      expanded={isExpanded}
                      onToggleExpand={() => toggleExpand(g.id, isExpanded)}
                      topHairline={i > 0}
                      onNotePeek={(rect) =>
                        setPeek({
                          note: g.note ?? "",
                          priceText:
                            g.price != null ? formatPrice(g.price, currency) : null,
                          rect,
                        })
                      }
                      onNotePeekEnd={() => setPeek(null)}
                      swipeActions={{
                        onEdit: () => setEditor({ open: true, gear: g }),
                        onDelete: () => deleteGear(g.id),
                        onToggleHidden: () => setGearHidden(g.id, true),
                        hidden: false,
                      }}
                      swipeOpenId={swipeOpenId}
                      onSwipeOpenChange={setSwipeOpenId}
                    />
                    {isExpanded && addOns.length > 0 && (
                      <div className="bg-[color-mix(in_srgb,var(--tint)_5%,transparent)]">
                        {addOns.map((a) => (
                          <AddonRow
                            key={a.id}
                            gear={a}
                            unit={unit}
                            selected={selected.has(a.id)}
                            onTap={() => {
                              if (swipeOpenId) {
                                setSwipeOpenId(null);
                                return;
                              }
                              toggleSelect(a.id);
                            }}
                          />
                        ))}
                      </div>
                    )}
                  </Fragment>
                );
              })
            )}
          </section>
        ))}

        {!editMode && activeCat === "all" && hiddenItems.length > 0 && (
          <section>
            <div className="flex items-baseline justify-between px-4 pb-1 pt-6">
              <span className="text-[12px] font-bold uppercase tracking-[0.06em] text-tertiary">
                숨겨짐
              </span>
              <span className="text-[12px] text-tertiary">{hiddenItems.length}개</span>
            </div>
            {hiddenItems.map((g, i) => (
              <GearRow
                key={g.id}
                gear={g}
                unit={unit}
                onTap={() => {
                  if (swipeOpenId) setSwipeOpenId(null);
                }}
                topHairline={i > 0}
                dimmed
                onNotePeek={(rect) =>
                  setPeek({
                    note: g.note ?? "",
                    priceText:
                      g.price != null ? formatPrice(g.price, currency) : null,
                    rect,
                  })
                }
                onNotePeekEnd={() => setPeek(null)}
                swipeActions={{
                  onEdit: () => setEditor({ open: true, gear: g }),
                  onDelete: () => deleteGear(g.id),
                  onToggleHidden: () => setGearHidden(g.id, false),
                  hidden: true,
                }}
                swipeOpenId={swipeOpenId}
                onSwipeOpenChange={setSwipeOpenId}
              />
            ))}
          </section>
        )}

        {visibleGroups.length === 0 && (q || hiddenItems.length === 0) && (
          <p className="px-4 py-16 text-center text-[15px] text-secondary">
            {q ? "검색 결과가 없습니다." : "장비가 없습니다."}
          </p>
        )}
      </div>

      {/* Add-gear FAB (hidden while selecting so the Trip action takes its place) */}
      {!selecting && (
        <button
          type="button"
          aria-label="장비 추가"
          onClick={() => setEditor({ open: true, gear: null })}
          className="shadow-float fixed right-4 z-40 grid h-14 w-14 place-items-center rounded-full bg-tint text-white transition active:scale-95"
          style={{ bottom: "calc(env(safe-area-inset-bottom) + 16px)" }}
        >
          <Plus size={26} />
        </button>
      )}

      {selecting && !editMode && (
        <div
          className="fixed right-4 z-40 flex items-center gap-2"
          style={{ bottom: "calc(env(safe-area-inset-bottom) + 16px)" }}
        >
          <button
            type="button"
            onClick={clearSelection}
            aria-label="선택 해제"
            className="material shadow-float grid h-14 w-14 place-items-center rounded-full border border-[var(--material-border)] text-label active:opacity-60"
          >
            <X size={20} />
          </button>
          <button
            type="button"
            onClick={() => setAddTripOpen(true)}
            aria-label={`선택한 ${selected.size}개 Trip에 추가`}
            className="shadow-float flex h-14 items-center gap-1.5 rounded-full bg-tint px-5 font-semibold text-white active:opacity-80"
          >
            <ArrowRight size={20} />
            <span className="tabular text-[17px]">{selected.size}</span>
          </button>
        </div>
      )}

      {peek && (
        <NotePopup note={peek.note} priceText={peek.priceText} rect={peek.rect} />
      )}

      <GearEditorSheet
        open={editor.open}
        gear={editor.gear}
        onClose={() => setEditor((s) => ({ ...s, open: false }))}
      />
      <AddToTripSheet
        open={addTripOpen}
        gearIds={[...selected]}
        selectedStats={selectedStats}
        onClose={() => setAddTripOpen(false)}
        onAdded={(tripId) => {
          setAddTripOpen(false);
          clearSelection();
          onOpenTrip(tripId);
        }}
      />
      <CategoryManagerSheet open={catMgrOpen} onClose={() => setCatMgrOpen(false)} />
      <PresetsSheet
        open={presetsOpen}
        onClose={() => setPresetsOpen(false)}
        selectedIds={[...selected]}
        onApply={applyPreset}
      />
    </div>
  );
}

/**
 * Add-on sub-row. Selection is handled on pointerup (with a small movement
 * guard) instead of click, so rapid successive taps on a phone are never
 * dropped or routed to the wrong row by the browser's click/double-tap logic.
 * Keyboard/synthetic clicks (detail === 0) still work via onClick.
 */
function AddonRow({
  gear,
  unit,
  selected,
  onTap,
}: {
  gear: GearItem;
  unit: WeightUnit;
  selected: boolean;
  onTap: () => void;
}) {
  const start = useRef<{ x: number; y: number } | null>(null);
  const moved = useRef(false);
  return (
    <button
      type="button"
      onPointerDown={(e) => {
        start.current = { x: e.clientX, y: e.clientY };
        moved.current = false;
      }}
      onPointerMove={(e) => {
        if (
          start.current &&
          Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 10
        ) {
          moved.current = true;
        }
      }}
      onPointerUp={() => {
        if (start.current && !moved.current) onTap();
        start.current = null;
      }}
      onPointerCancel={() => {
        start.current = null;
      }}
      onClick={(e) => {
        if (e.detail === 0) onTap(); // keyboard / programmatic activation
      }}
      className={cn(
        "flex w-full touch-manipulation select-none items-center gap-2.5 py-2.5 pl-9 pr-4 text-left transition active:opacity-60",
        selected &&
          "bg-[color-mix(in_srgb,var(--tint)_8%,transparent)] shadow-[inset_2px_0_0_var(--tint)]",
      )}
    >
      <span className="min-w-0 flex-1 truncate text-[14px] text-secondary">
        {gear.name}
      </span>
      <span className="shrink-0 tabular text-[13px] text-tertiary">
        {formatWeight(gear.weightG, unit)}
      </span>
      <span className="w-6 shrink-0" />
    </button>
  );
}

function SortableGearRow({
  id,
  gear,
  unit,
  topHairline,
  onEdit,
}: {
  id: string;
  gear: GearItem;
  unit: WeightUnit;
  topHairline: boolean;
  onEdit: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.7 : 1,
    position: "relative",
    zIndex: isDragging ? 10 : undefined,
  };
  return (
    <div ref={setNodeRef} style={style} className={cn(isDragging && "bg-card")}>
      <GearRow
        gear={gear}
        unit={unit}
        editMode
        topHairline={topHairline && !isDragging}
        onTap={onEdit}
        dragHandle={
          <button
            type="button"
            aria-label="순서 변경"
            className="grid h-6 w-6 shrink-0 cursor-grab touch-none place-items-center text-tertiary active:cursor-grabbing"
            {...attributes}
            {...listeners}
          >
            <GripVertical size={20} />
          </button>
        }
      />
    </div>
  );
}
