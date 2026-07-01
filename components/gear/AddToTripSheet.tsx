"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/lib/store";
import type { Stats } from "@/lib/calc";
import { formatWeightSmart } from "@/lib/units";
import { Sheet } from "../ui/Sheet";
import { ListRow, ListSection } from "../ui/ListGroup";
import { TextField } from "../ui/Field";
import { Button } from "../ui/Button";
import { WeightBar } from "../WeightBar";

export function AddToTripSheet({
  open,
  gearIds,
  quantities,
  selectedStats,
  onClose,
  onAdded,
}: {
  open: boolean;
  gearIds: string[];
  quantities?: Record<string, number>;
  selectedStats: Stats;
  onClose: () => void;
  onAdded: (tripId: string) => void;
}) {
  const gear = useAppStore((s) => s.gear);
  const trips = useAppStore((s) => s.trips);
  const tripOrder = useAppStore((s) => s.tripOrder);
  const unit = useAppStore((s) => s.displayUnit);
  const createTrip = useAppStore((s) => s.createTrip);
  const addEntriesToTrip = useAppStore((s) => s.addEntriesToTrip);

  const [newName, setNewName] = useState("");
  useEffect(() => {
    if (open) setNewName("");
  }, [open]);

  const entries = gearIds
    .filter((id) => gear[id])
    .map((id) => ({ gearId: id, quantity: quantities?.[id] ?? 1 }));

  function addTo(tripId: string) {
    addEntriesToTrip(tripId, entries);
    onAdded(tripId);
  }
  function createAndAdd() {
    const id = createTrip(newName.trim() || undefined);
    addEntriesToTrip(id, entries);
    onAdded(id);
  }

  return (
    <Sheet open={open} onClose={onClose} title="Trip에 추가">
      <div className="space-y-6 px-4">
        <div className="rounded-[10px] bg-card p-4">
          <div className="flex items-baseline justify-between">
            <span className="text-[15px] text-secondary">선택한 장비</span>
            <span className="tabular text-[15px] font-medium text-label">
              {gearIds.length}개 · {formatWeightSmart(selectedStats.totalG, unit)}
            </span>
          </div>
          <WeightBar
            className="mt-3"
            segments={selectedStats.byCategory.map((c) => ({
              id: c.name,
              weightG: c.weightG,
              color: c.color,
            }))}
          />
        </div>

        <div className="px-4">
          <h2 className="mb-1.5 px-0 text-[13px] font-medium uppercase tracking-wide text-secondary">
            새 트립으로
          </h2>
          <div className="flex gap-2">
            <TextField
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="새 트립 이름 (선택)"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  createAndAdd();
                }
              }}
            />
            <Button variant="filled" onClick={createAndAdd} className="shrink-0">
              만들기
            </Button>
          </div>
        </div>

        {tripOrder.length > 0 && (
          <ListSection header="기존 트립에 추가">
            {tripOrder.map((id) => {
              const t = trips[id];
              if (!t) return null;
              return (
                <ListRow
                  key={id}
                  onClick={() => addTo(id)}
                  chevron
                  trailing={
                    <span className="tabular text-[15px] text-secondary">
                      {t.packed.length}개
                    </span>
                  }
                >
                  <span className="text-[17px] text-label">{t.name}</span>
                </ListRow>
              );
            })}
          </ListSection>
        )}
      </div>
    </Sheet>
  );
}
