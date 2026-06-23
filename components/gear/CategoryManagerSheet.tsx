"use client";

import { useMemo, useState } from "react";
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
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2 } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/cn";
import { Sheet } from "../ui/Sheet";
import { Button } from "../ui/Button";

export function CategoryManagerSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const categories = useAppStore((s) => s.categories);
  const gear = useAppStore((s) => s.gear);
  const addCategory = useAppStore((s) => s.addCategory);
  const renameCategoryAt = useAppStore((s) => s.renameCategoryAt);
  const moveCategory = useAppStore((s) => s.moveCategory);
  const deleteCategoryAt = useAppStore((s) => s.deleteCategoryAt);

  const [newName, setNewName] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const g of Object.values(gear)) {
      m.set(g.majorCategory, (m.get(g.majorCategory) ?? 0) + 1);
    }
    return m;
  }, [gear]);

  function addNew() {
    const n = newName.trim();
    if (!n) return;
    addCategory(n);
    setNewName("");
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    moveCategory(Number(active.id), Number(over.id));
  }

  return (
    <Sheet open={open} onClose={onClose} title="대분류 관리" leftLabel="완료">
      <div className="space-y-4 px-4">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={categories.map((_, i) => String(i))}
            strategy={verticalListSortingStrategy}
          >
            <div>
              {categories.map((c, i) => (
                <SortableCatRow
                  key={i}
                  index={i}
                  name={c}
                  count={counts.get(c) ?? 0}
                  topHairline={i > 0}
                  onRename={(v) => renameCategoryAt(i, v)}
                  onDelete={() => deleteCategoryAt(i)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        <div className="flex gap-2 pt-1">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addNew();
              }
            }}
            placeholder="새 대분류 이름"
            className="h-11 min-w-0 flex-1 rounded-[10px] bg-card px-3.5 text-[15px] text-label outline-none"
          />
          <Button variant="tinted" onClick={addNew} className="shrink-0">
            추가
          </Button>
        </div>

        <p className="px-1 text-[13px] leading-snug text-secondary">
          드래그해서 순서를 바꾸세요. 이름을 바꾸면 해당 분류의 모든 장비에
          반영되고, 장비가 들어 있는 분류는 삭제할 수 없어요.
        </p>
      </div>
    </Sheet>
  );
}

function SortableCatRow({
  index,
  name,
  count,
  topHairline,
  onRename,
  onDelete,
}: {
  index: number;
  name: string;
  count: number;
  topHairline: boolean;
  onRename: (value: string) => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: String(index) });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.8 : 1,
    position: "relative",
    zIndex: isDragging ? 10 : undefined,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative flex h-14 items-center gap-1.5 pr-1",
        isDragging && "rounded-[10px] bg-card shadow-lg",
        topHairline &&
          !isDragging &&
          "before:pointer-events-none before:absolute before:left-10 before:right-0 before:top-0 before:h-px before:bg-separator",
      )}
    >
      <button
        type="button"
        aria-label="순서 변경"
        className="grid h-9 w-9 shrink-0 cursor-grab touch-none place-items-center text-tertiary active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={20} />
      </button>
      <input
        value={name}
        onChange={(e) => onRename(e.target.value)}
        placeholder="대분류 이름"
        className="min-w-0 flex-1 bg-transparent text-[16px] text-label outline-none placeholder:text-tertiary"
      />
      <span className="shrink-0 tabular text-[13px] text-tertiary">{count}개</span>
      <button
        type="button"
        onClick={() => count === 0 && onDelete()}
        disabled={count > 0}
        aria-label="삭제"
        className={cn(
          "grid h-8 w-8 shrink-0 place-items-center rounded-full",
          count > 0 ? "text-tertiary/40" : "text-red active:bg-fill",
        )}
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
}
