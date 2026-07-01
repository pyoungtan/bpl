"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  Bookmark,
  Check,
  GripVertical,
  Minus,
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
  const moveGear = useAppStore((s) => s.moveGear);
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
  // Per-selection pack quantity (default 1); only the last-selected item's
  // count is adjustable via the floating stepper.
  const [packQty, setPackQty] = useState<Record<string, number>>({});
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);
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

  // Auto-hiding top bar: hide on scroll-down, reveal on scroll-up (iOS-style).
  // Drive the transform directly on the element (with a CSS transition) so it
  // doesn't depend on React re-renders.
  const headerRef = useRef<HTMLDivElement>(null);
  const lastScroll = useRef(0);
  useEffect(() => {
    const onScroll = () => {
      const el = headerRef.current;
      if (!el) return;
      const y = window.scrollY;
      if (y < 120) el.style.transform = "translateY(0)";
      else if (y - lastScroll.current > 6) el.style.transform = "translateY(-100%)";
      else if (y - lastScroll.current < -6) el.style.transform = "translateY(0)";
      lastScroll.current = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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

  // Items designated as an add-on of another item — hidden from the normal
  // list, but gathered into one section in edit mode so they can be reached.
  const addonItems = useMemo(
    () =>
      gearOrder
        .map((id) => gear[id])
        .filter(
          (g): g is GearItem => Boolean(g) && addOnIdSet.has(g.id) && !g.hidden,
        ),
    [gear, gearOrder, addOnIdSet],
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
          .map((g) => ({ gear: g, quantity: packQty[g.id] ?? 1 })),
      ),
    [selected, gear, packQty],
  );

  function toggleSelect(id: string) {
    const willSelect = !selected.has(id);
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
    if (willSelect) {
      setLastSelectedId(id);
      setPackQty((q) => (q[id] ? q : { ...q, [id]: 1 }));
      // Selecting a row re-enables its auto-open (clears any manual collapse).
      if (collapsed.has(id)) {
        setCollapsed((prev) => {
          const n = new Set(prev);
          n.delete(id);
          return n;
        });
      }
    } else {
      setPackQty((q) => {
        const { [id]: _drop, ...rest } = q;
        return rest;
      });
      setLastSelectedId((cur) => (cur === id ? null : cur));
    }
  }

  function setLastQty(delta: number) {
    if (!lastSelectedId) return;
    setPackQty((q) => ({
      ...q,
      [lastSelectedId]: Math.max(1, (q[lastSelectedId] ?? 1) + delta),
    }));
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
    setPackQty({});
    setLastSelectedId(null);
  }
  function applyPreset(gearIds: string[]) {
    const ids = gearIds.filter((id) => gear[id]);
    setSelected(new Set(ids));
    setPackQty(Object.fromEntries(ids.map((id) => [id, 1])));
    setLastSelectedId(null);
  }
  function resolveAddOns(g: GearItem) {
    return g.addOnIds
      .map((id) => gear[id])
      .filter((x): x is GearItem => Boolean(x));
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    // One DndContext spans all categories, so `over` may live in another
    // category — moveGear reorders and adopts the target's category.
    moveGear(String(active.id), String(over.id));
  }

  const selecting = selected.size > 0;

  return (
    <div className="pb-40">
      <div
        ref={headerRef}
        className="sticky top-0 z-30 bg-bg transition-transform duration-300 ease-in-out will-change-transform"
      >
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
      </div>

      <div className="pt-1">
        <DndArea
          enabled={editMode}
          sensors={sensors}
          onDragEnd={handleDragEnd}
          sortIds={visibleGroups.flatMap(([, items]) => items.map((i) => i.id))}
          renderOverlay={(id) => {
            const g = gear[id];
            return g ? (
              <GearRow gear={g} unit={unit} editMode topHairline={false} onTap={() => {}} />
            ) : null;
          }}
        >
        {visibleGroups.map(([major, items]) => (
          <section key={major}>
            <div className="flex items-baseline justify-between px-4 pb-1 pt-5">
              <span className="text-[12px] font-bold uppercase tracking-[0.06em] text-tint">
                {major}
              </span>
              <span className="text-[12px] text-tertiary">{items.length}개</span>
            </div>

            {editMode ? (
              items.map((g, i) => (
                <SortableGearRow
                  key={g.id}
                  id={g.id}
                  gear={g}
                  unit={unit}
                  topHairline={i > 0}
                  onEdit={() => setEditor({ open: true, gear: g })}
                />
              ))
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
                      packCount={selected.has(g.id) ? packQty[g.id] ?? 1 : undefined}
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
                    <AnimatePresence initial={false}>
                      {isExpanded && addOns.length > 0 && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.24, ease: [0.22, 0.61, 0.36, 1] }}
                          className="overflow-hidden bg-[color-mix(in_srgb,var(--tint)_5%,transparent)]"
                        >
                          {addOns.map((a) => (
                            <AddonRow
                              key={a.id}
                              gear={a}
                              unit={unit}
                              selected={selected.has(a.id)}
                              packCount={
                                selected.has(a.id) ? packQty[a.id] ?? 1 : undefined
                              }
                              onTap={() => {
                                if (swipeOpenId) {
                                  setSwipeOpenId(null);
                                  return;
                                }
                                toggleSelect(a.id);
                              }}
                              onNotePeek={(rect) =>
                                setPeek({
                                  note: a.note ?? "",
                                  priceText:
                                    a.price != null
                                      ? formatPrice(a.price, currency)
                                      : null,
                                  rect,
                                })
                              }
                              onNotePeekEnd={() => setPeek(null)}
                            />
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </Fragment>
                );
              })
            )}
          </section>
        ))}
        </DndArea>

        {editMode && addonItems.length > 0 && (
          <section>
            <div className="flex items-baseline justify-between px-4 pb-1 pt-6">
              <span className="text-[12px] font-bold uppercase tracking-[0.06em] text-secondary">
                애드온
              </span>
              <span className="text-[12px] text-tertiary">{addonItems.length}개</span>
            </div>
            {addonItems.map((g, i) => (
              <GearRow
                key={g.id}
                gear={g}
                unit={unit}
                editMode
                topHairline={i > 0}
                onTap={() => setEditor({ open: true, gear: g })}
              />
            ))}
          </section>
        )}

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

      {/* Pack-quantity stepper for the most recently selected item (above GNB) */}
      {selecting && !editMode && lastSelectedId && selected.has(lastSelectedId) && gear[lastSelectedId] && (
        <div
          className="material shadow-float fixed left-1/2 z-40 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-[var(--material-border)] p-1.5"
          style={{ bottom: "calc(env(safe-area-inset-bottom) + 82px)" }}
        >
          <button
            type="button"
            aria-label="수량 감소"
            onClick={() => setLastQty(-1)}
            className="grid h-8 w-8 touch-manipulation place-items-center rounded-full bg-fill text-label active:opacity-60"
          >
            <Minus size={16} />
          </button>
          <span className="w-5 text-center tabular text-[15px] font-semibold text-label">
            {packQty[lastSelectedId] ?? 1}
          </span>
          <button
            type="button"
            aria-label="수량 증가"
            onClick={() => setLastQty(1)}
            className="grid h-8 w-8 touch-manipulation place-items-center rounded-full bg-fill text-label active:opacity-60"
          >
            <Plus size={16} />
          </button>
        </div>
      )}

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
        quantities={packQty}
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

// Wraps the gear groups in a single DndContext while editing, so a row can be
// dragged across category boundaries; passes children through otherwise.
function DndArea({
  enabled,
  sensors,
  onDragEnd,
  renderOverlay,
  sortIds,
  children,
}: {
  enabled: boolean;
  sensors: ReturnType<typeof useSensors>;
  onDragEnd: (e: DragEndEvent) => void;
  renderOverlay: (id: string) => React.ReactNode;
  sortIds: string[];
  children: React.ReactNode;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  if (!enabled) return <>{children}</>;
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={(e) => {
        setActiveId(String(e.active.id));
        // Signal PullToRefresh (and any other gesture) to stand down.
        document.body.dataset.dragging = "true";
      }}
      onDragEnd={(e) => {
        setActiveId(null);
        delete document.body.dataset.dragging;
        onDragEnd(e);
      }}
      onDragCancel={() => {
        setActiveId(null);
        delete document.body.dataset.dragging;
      }}
    >
      {/* One SortableContext spanning every category so a row reorders live and
          drops at an exact position even after crossing a category boundary. */}
      <SortableContext items={sortIds} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
      <DragOverlay dropAnimation={{ duration: 200, easing: "ease" }}>
        {activeId ? (
          <div className="shadow-float rounded-[10px] bg-card">
            {renderOverlay(activeId)}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
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
  packCount,
  onTap,
  onNotePeek,
  onNotePeekEnd,
}: {
  gear: GearItem;
  unit: WeightUnit;
  selected: boolean;
  packCount?: number;
  onTap: () => void;
  onNotePeek?: (rect: DOMRect) => void;
  onNotePeekEnd?: () => void;
}) {
  const start = useRef<{ x: number; y: number } | null>(null);
  const moved = useRef(false);
  const timer = useRef<number | undefined>(undefined);
  const longPressed = useRef(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const sub = gear.brand ? ` · ${gear.brand}` : "";

  function clearTimer() {
    if (timer.current !== undefined) {
      clearTimeout(timer.current);
      timer.current = undefined;
    }
  }
  return (
    <button
      ref={btnRef}
      type="button"
      onPointerDown={(e) => {
        start.current = { x: e.clientX, y: e.clientY };
        moved.current = false;
        longPressed.current = false;
        clearTimer();
        timer.current = window.setTimeout(() => {
          longPressed.current = true;
          if (btnRef.current) onNotePeek?.(btnRef.current.getBoundingClientRect());
        }, 420);
      }}
      onPointerMove={(e) => {
        if (
          start.current &&
          Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 10
        ) {
          moved.current = true;
          clearTimer();
        }
      }}
      onPointerUp={() => {
        clearTimer();
        if (longPressed.current) onNotePeekEnd?.();
        else if (start.current && !moved.current) onTap();
        start.current = null;
      }}
      onPointerCancel={() => {
        clearTimer();
        if (longPressed.current) onNotePeekEnd?.();
        start.current = null;
      }}
      onContextMenu={(e) => e.preventDefault()}
      onClick={(e) => {
        if (e.detail === 0) onTap(); // keyboard / programmatic activation
      }}
      className={cn(
        "flex w-full touch-manipulation select-none items-center gap-2.5 py-2.5 pl-9 pr-4 text-left transition active:opacity-60",
        selected && "bg-[color-mix(in_srgb,var(--tint)_8%,transparent)]",
      )}
    >
      <span className="min-w-0 flex-1 truncate text-[14px] text-secondary">
        {gear.name}
        {sub && <span className="text-[12px] text-tertiary">{sub}</span>}
      </span>
      {packCount != null && packCount > 1 && (
        <span className="shrink-0 tabular text-[13px] font-semibold text-tint">
          ×{packCount}
        </span>
      )}
      <span className="shrink-0 tabular text-[13px] text-tertiary">
        {formatWeight(gear.weightG, unit)}
        {gear.quantity > 1 && <span> ×{gear.quantity}</span>}
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
    // Hide the in-list row while dragging; the DragOverlay renders the floating
    // copy that follows the pointer smoothly across categories. A faint tint
    // marks the gap it will drop into.
    opacity: isDragging ? 0 : 1,
    position: "relative",
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(isDragging && "bg-tint-soft")}
    >
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
