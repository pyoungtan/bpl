"use client";

import { Fragment, useMemo, useRef, useState } from "react";
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
import { motion } from "framer-motion";
import {
  Backpack,
  Bookmark,
  Check,
  ChevronDown,
  GripVertical,
  Plus,
  Search,
  SlidersHorizontal,
  SquarePen,
  X,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import type { GearItem, WeightUnit } from "@/lib/types";
import { computeStats } from "@/lib/calc";
import { formatPrice, formatWeight, formatWeightSmart } from "@/lib/units";
import { cn } from "@/lib/cn";
import { useTopBar } from "../TopBar";
import { GlassButton, InkButton } from "../ui/Glass";
import { QtyStepper } from "../ui/QtyStepper";
import { TagChip } from "../ui/TagChip";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { NotePopup } from "../NotePopup";
import { GearRow } from "./GearRow";
import { GearEditorSheet } from "./GearEditorSheet";
import { AddToTripSheet } from "./AddToTripSheet";
import { CategoryManagerSheet } from "./CategoryManagerSheet";
import { PresetsSheet } from "./PresetsSheet";

export function GearShelf({
  onOpenTrip,
}: {
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
  // Per-selection pack quantity, adjusted with each selected row's stepper.
  const [packQty, setPackQty] = useState<Record<string, number>>({});
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

  // Edit mode can be abandoned: snapshot what it may change (order,
  // categories, item edits) on entry and restore it on cancel.
  const editSnapshot = useRef<Pick<
    ReturnType<typeof useAppStore.getState>,
    "gear" | "gearOrder" | "categories"
  > | null>(null);
  const [cancelEditOpen, setCancelEditOpen] = useState(false);

  function toggleEditMode() {
    if (editMode) {
      editSnapshot.current = null;
    } else {
      const { gear: g, gearOrder: o, categories: c } = useAppStore.getState();
      editSnapshot.current = { gear: g, gearOrder: o, categories: c };
    }
    setEditMode((e) => !e);
    clearSelection();
    setSwipeOpenId(null);
    setSearchOpen(false);
    setQuery("");
  }
  function cancelEdit() {
    const snap = editSnapshot.current;
    if (snap) useAppStore.setState(snap);
    editSnapshot.current = null;
    setCancelEditOpen(false);
    setEditMode(false);
    setSwipeOpenId(null);
  }

  // Screen actions live in the floating glass bar's ⋯ menu.
  useTopBar({
    searching: searchOpen,
    onSearch: () => {
      if (editMode) toggleEditMode();
      setSearchOpen((o) => !o);
      if (searchOpen) setQuery("");
    },
    menu: [
      {
        id: "edit",
        label: editMode ? "편집 완료" : "장비 편집",
        icon: editMode ? <Check size={19} /> : <SquarePen size={18} />,
        onSelect: toggleEditMode,
      },
      {
        id: "presets",
        label: "프리셋",
        icon: <Bookmark size={18} />,
        group: true,
        onSelect: () => setPresetsOpen(true),
      },
      {
        id: "categories",
        label: "대분류 추가·정렬",
        icon: <SlidersHorizontal size={18} />,
        onSelect: () => setCatMgrOpen(true),
      },
    ],
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  // Collapsed 대분류, remembered per device — tap a category header to fold
  // rarely-used groups away. Ignored while editing/searching/filtering.
  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const raw = JSON.parse(localStorage.getItem("bpl-collapsed-cats") || "[]");
      return new Set(Array.isArray(raw) ? raw.filter((x) => typeof x === "string") : []);
    } catch {
      return new Set();
    }
  });
  function toggleCatCollapsed(c: string) {
    setCollapsedCats((prev) => {
      const n = new Set(prev);
      if (n.has(c)) n.delete(c);
      else n.add(c);
      try {
        localStorage.setItem("bpl-collapsed-cats", JSON.stringify([...n]));
      } catch {
        /* ignore */
      }
      return n;
    });
  }

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
      // Seed from the gear's base quantity (e.g. 2 stakes → starts at 2).
      setPackQty((q) => (q[id] ? q : { ...q, [id]: gear[id]?.quantity || 1 }));
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
        const rest = { ...q };
        delete rest[id];
        return rest;
      });
    }
  }

  function setQty(id: string, n: number) {
    setPackQty((q) => ({ ...q, [id]: Math.max(1, n) }));
  }
  function stepperFor(id: string) {
    return selected.has(id)
      ? {
          value: packQty[id] ?? 1,
          onChange: (n: number) => setQty(id, n),
          onRemove: () => toggleSelect(id),
        }
      : undefined;
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
  }
  function applyPreset(gearIds: string[]) {
    const ids = gearIds.filter((id) => gear[id]);
    setSelected(new Set(ids));
    setPackQty(Object.fromEntries(ids.map((id) => [id, gear[id]?.quantity || 1])));
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
      <div>
      {!editMode && searchOpen && (
        <div className="px-4 pb-1 pt-1">
          <div className="flex h-11 items-center gap-2.5 rounded-full bg-fill px-4">
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
        // Bottom padding holds the tags' shadow inside the scroll strip (an
        // overflow-x container clips it). No negative margin: anything
        // overlapping that padding would paint over the shadow.
        <div className="no-scrollbar flex gap-1.5 overflow-x-auto px-4 pb-3.5 pt-2">
          <TagChip
            onClick={() => setPresetsOpen(true)}
            aria-label="프리셋"
            className="grid w-8 place-items-center px-0"
          >
            <Bookmark size={15} />
          </TagChip>
          {["all", ...chipCats].map((c) => (
            <TagChip key={c} active={c === activeCat} onClick={() => setActiveCat(c)}>
              {c === "all" ? "전체" : c}
            </TagChip>
          ))}
        </div>
      )}

      {editMode && (
        <div className="px-4 pb-1 pt-2">
          <button
            type="button"
            onClick={() => setCatMgrOpen(true)}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-fill text-[15px] font-medium text-label active:opacity-60"
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
              <GearRow gear={g} unit={unit} editMode onTap={() => {}} />
            ) : null;
          }}
        >
        {visibleGroups.map(([major, items]) => {
          const collapsible = !editMode && !q && activeCat === "all";
          const isCollapsed = collapsible && collapsedCats.has(major);
          return (
          // layout="position": sections glide to their new spot via composited
          // transforms when a category above folds. Cheap because the fold
          // itself is a display toggle on PRE-MOUNTED rows — one reflow, no
          // mount cost, then transform-only animation frames.
          <motion.section
            key={major}
            layout={collapsible ? "position" : false}
            transition={{ type: "spring", stiffness: 550, damping: 45 }}
          >
            <button
              type="button"
              onClick={collapsible ? () => toggleCatCollapsed(major) : undefined}
              disabled={!collapsible}
              aria-expanded={!isCollapsed}
              className="flex w-full touch-manipulation items-baseline justify-between px-4 pb-3 pt-6 text-left"
            >
              <span className="text-[17px] font-bold tracking-[-0.01em] text-tertiary">
                {major}
              </span>
              <span className="flex items-center gap-1 text-[13px] text-tertiary">
                {items.length}개
                {collapsible && (
                  <ChevronDown
                    size={13}
                    className={cn(
                      "transition-transform",
                      isCollapsed && "-rotate-90",
                    )}
                  />
                )}
              </span>
            </button>

            {/* Rows stay mounted; folding toggles display:none (one reflow,
                zero mount cost — a height tween reflowed ~200 rows per frame
                and conditional mounting hitched on expand). The reveal gets a
                CSS fade, and the sections below glide via the FLIP transform
                above — every animation frame is compositor-only. */}
            <div className={cn("fold-reveal", isCollapsed && "hidden")}>
            {editMode ? (
              items.map((g) => (
                <SortableGearRow
                  key={g.id}
                  id={g.id}
                  gear={g}
                  unit={unit}
                  onEdit={() => setEditor({ open: true, gear: g })}
                />
              ))
            ) : (
              items.map((g) => {
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
                      stepper={stepperFor(g.id)}
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
                    {/* Mounts instantly with a quick fade; a height animation
                        here reflowed the whole long list every frame. Sections
                        below glide via their FLIP transforms instead. */}
                    {isExpanded && addOns.length > 0 && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ duration: 0.15 }}
                        >
                          {addOns.map((a) => (
                            <AddonRow
                              key={a.id}
                              gear={a}
                              unit={unit}
                              selected={selected.has(a.id)}
                              stepper={stepperFor(a.id)}
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
                  </Fragment>
                );
              })
            )}
            </div>
          </motion.section>
          );
        })}
        </DndArea>

        {editMode && addonItems.length > 0 && (
          <section>
            <div className="flex items-baseline justify-between px-4 pb-3 pt-6">
              <span className="text-[17px] font-bold tracking-[-0.01em] text-tertiary">
                애드온
              </span>
              <span className="text-[13px] text-tertiary">{addonItems.length}개</span>
            </div>
            {addonItems.map((g) => (
              <GearRow
                key={g.id}
                gear={g}
                unit={unit}
                editMode
                onTap={() => setEditor({ open: true, gear: g })}
              />
            ))}
          </section>
        )}

        {!editMode && activeCat === "all" && hiddenItems.length > 0 && (
          <motion.section
            layout="position"
            transition={{ type: "spring", stiffness: 550, damping: 45 }}
          >
            <div className="flex items-baseline justify-between px-4 pb-3 pt-6">
              <span className="text-[17px] font-bold tracking-[-0.01em] text-tertiary">
                숨겨짐
              </span>
              <span className="text-[13px] text-tertiary">{hiddenItems.length}개</span>
            </div>
            {hiddenItems.map((g) => (
              <GearRow
                key={g.id}
                gear={g}
                unit={unit}
                onTap={() => {
                  if (swipeOpenId) setSwipeOpenId(null);
                }}
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
          </motion.section>
        )}

        {visibleGroups.length === 0 && (q || hiddenItems.length === 0) && (
          <p className="px-4 py-16 text-center text-[15px] text-secondary">
            {q ? "검색 결과가 없습니다." : "장비가 없습니다."}
          </p>
        )}
      </div>

      {/* Primary action: add gear · finish editing · pack the selection */}
      {selecting && !editMode ? (
        <>
        {/* Soft scrim so the clear-glass cancel button reads against the list */}
        <div
          aria-hidden="true"
          className="fold-reveal pointer-events-none fixed inset-x-0 bottom-0 z-40 h-44 bg-gradient-to-t from-black/[0.13] via-black/[0.05] to-transparent dark:from-black/70 dark:via-black/30"
        />
        <div
          className="pointer-events-none fixed inset-x-0 z-40 flex flex-col items-center gap-3"
          style={{ bottom: "var(--bar-bottom)" }}
        >
          <GlassButton
            onClick={clearSelection}
            aria-label="선택 해제"
            className="pointer-events-auto w-[46px]"
          >
            <X size={21} />
          </GlassButton>
          <InkButton
            onClick={() => setAddTripOpen(true)}
            aria-label={`선택한 ${selected.size}개 Trip에 담기`}
            className="pointer-events-auto"
          >
            <Backpack size={20} />
            Pack
            <span className="tabular font-medium opacity-60">
              {formatWeightSmart(selectedStats.totalG, unit)}
            </span>
          </InkButton>
        </div>
        </>
      ) : (
        <div className="fixed right-4 z-40" style={{ bottom: "var(--bar-bottom)" }}>
          {editMode ? (
            <div className="flex items-center gap-2">
              <GlassButton
                onClick={() => setCancelEditOpen(true)}
                aria-label="편집 취소"
                className="w-[46px]"
              >
                <X size={21} />
              </GlassButton>
              <InkButton onClick={toggleEditMode}>
                <Check size={20} strokeWidth={2.4} /> 완료
              </InkButton>
            </div>
          ) : (
            <InkButton size="lg" onClick={() => setEditor({ open: true, gear: null })}>
              <Plus size={22} strokeWidth={2.4} /> Add
            </InkButton>
          )}
        </div>
      )}

      {peek && (
        <NotePopup note={peek.note} priceText={peek.priceText} rect={peek.rect} />
      )}

      <ConfirmDialog
        open={cancelEditOpen}
        title="편집을 취소할까요?"
        message="이번 편집에서 바꾼 순서·분류·장비 정보가 저장되지 않아요."
        confirmLabel="편집 취소"
        cancelLabel="계속 편집"
        destructive
        onConfirm={cancelEdit}
        onCancel={() => setCancelEditOpen(false)}
      />

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
          <div className="shadow-float rounded-[20px] bg-card">
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
  stepper,
  onTap,
  onNotePeek,
  onNotePeekEnd,
}: {
  gear: GearItem;
  unit: WeightUnit;
  selected: boolean;
  stepper?: { value: number; onChange: (n: number) => void; onRemove: () => void };
  onTap: () => void;
  onNotePeek?: (rect: DOMRect) => void;
  onNotePeekEnd?: () => void;
}) {
  const start = useRef<{ x: number; y: number } | null>(null);
  const moved = useRef(false);
  const timer = useRef<number | undefined>(undefined);
  const longPressed = useRef(false);
  const btnRef = useRef<HTMLDivElement>(null);
  const sub = gear.brand ? ` · ${gear.brand}` : "";

  function clearTimer() {
    if (timer.current !== undefined) {
      clearTimeout(timer.current);
      timer.current = undefined;
    }
  }
  return (
    <div
      ref={btnRef}
      role="button"
      tabIndex={0}
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
        if (e.detail === 0) onTap(); // programmatic activation
      }}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onTap();
        }
      }}
      className={cn(
        "flex w-full cursor-pointer touch-manipulation select-none items-center gap-2.5 py-2 pl-9 pr-4 text-left outline-none transition",
        selected && "bg-selected",
      )}
    >
      <span className="min-w-0 flex-1 truncate text-[14px] text-secondary">
        {gear.name}
        {sub && <span className="text-[12px] text-tertiary">{sub}</span>}
      </span>
      {stepper && <QtyStepper {...stepper} size="sm" />}
      {/* same columns as the parent row: empty toggle slot, then weight */}
      <span className="-mr-1.5 w-6 shrink-0" />
      <span className="min-w-[52px] shrink-0 whitespace-nowrap text-right tabular text-[13px] text-tertiary">
        {formatWeight(gear.weightG, unit)}
      </span>
    </div>
  );
}

function SortableGearRow({
  id,
  gear,
  unit,
  onEdit,
}: {
  id: string;
  gear: GearItem;
  unit: WeightUnit;
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
