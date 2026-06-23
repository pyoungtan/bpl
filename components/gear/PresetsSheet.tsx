"use client";

import { useEffect, useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { formatWeightSmart } from "@/lib/units";
import { cn } from "@/lib/cn";
import { Sheet } from "../ui/Sheet";
import { Button } from "../ui/Button";

export function PresetsSheet({
  open,
  onClose,
  selectedIds,
  onApply,
}: {
  open: boolean;
  onClose: () => void;
  selectedIds: string[];
  onApply: (gearIds: string[]) => void;
}) {
  const presets = useAppStore((s) => s.presets);
  const gear = useAppStore((s) => s.gear);
  const unit = useAppStore((s) => s.displayUnit);
  const addPreset = useAppStore((s) => s.addPreset);
  const deletePreset = useAppStore((s) => s.deletePreset);

  const [name, setName] = useState("");
  useEffect(() => {
    if (open) setName("");
  }, [open]);

  const presetWeight = useMemo(
    () => (ids: string[]) =>
      ids.reduce((sum, id) => {
        const g = gear[id];
        return g ? sum + g.weightG * g.quantity : sum;
      }, 0),
    [gear],
  );

  function save() {
    if (selectedIds.length === 0) return;
    addPreset(name.trim() || `프리셋 ${presets.length + 1}`, selectedIds);
    setName("");
  }

  function apply(ids: string[]) {
    onApply(ids);
    onClose();
  }

  return (
    <Sheet open={open} onClose={onClose} title="프리셋" leftLabel="완료">
      <div className="space-y-6 px-4">
        <div>
          <h2 className="mb-1.5 px-1 text-[13px] font-medium uppercase tracking-wide text-secondary">
            현재 선택 저장
          </h2>
          {selectedIds.length > 0 ? (
            <div className="flex gap-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    save();
                  }
                }}
                placeholder={`선택한 ${selectedIds.length}개 장비`}
                className="h-11 min-w-0 flex-1 rounded-[10px] border border-separator bg-card px-3.5 text-[15px] text-label outline-none transition focus:border-tint"
              />
              <Button variant="filled" onClick={save} className="shrink-0">
                저장
              </Button>
            </div>
          ) : (
            <p className="px-1 text-[13px] leading-snug text-secondary">
              Shelf에서 장비를 선택한 뒤 프리셋으로 저장할 수 있어요.
            </p>
          )}
        </div>

        {presets.length > 0 && (
          <div>
            <h2 className="mb-1.5 px-1 text-[13px] font-medium uppercase tracking-wide text-secondary">
              내 프리셋
            </h2>
            <div className="overflow-hidden rounded-[12px] bg-card">
              {presets.map((p, i) => (
                <div
                  key={p.id}
                  className={cn(
                    "flex items-center gap-2 px-4 py-3",
                    i > 0 && "border-t border-separator",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => apply(p.gearIds)}
                    className="min-w-0 flex-1 text-left active:opacity-60"
                  >
                    <div className="truncate text-[16px] font-medium text-label">
                      {p.name}
                    </div>
                    <div className="tabular text-[13px] text-secondary">
                      {p.gearIds.length}개 · {formatWeightSmart(presetWeight(p.gearIds), unit)}
                    </div>
                  </button>
                  <Button variant="tinted" size="sm" onClick={() => apply(p.gearIds)}>
                    적용
                  </Button>
                  <button
                    type="button"
                    onClick={() => deletePreset(p.id)}
                    aria-label="프리셋 삭제"
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-red active:bg-fill"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Sheet>
  );
}
