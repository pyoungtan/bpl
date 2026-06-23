"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Minus, Plus, Search, Trash2, X } from "lucide-react";
import type { GearItem, WeightUnit } from "@/lib/types";
import { useAppStore } from "@/lib/store";
import { fromGrams, toGrams, WEIGHT_UNITS } from "@/lib/units";
import { cn } from "@/lib/cn";
import { Sheet } from "../ui/Sheet";
import { Segmented } from "../ui/Segmented";

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

const inputCls =
  "w-full bg-transparent text-[16px] text-label outline-none placeholder:text-tertiary";

const HAIR =
  "relative before:pointer-events-none before:absolute before:left-4 before:right-0 before:top-0 before:h-px before:bg-separator";

function FieldRow({
  label,
  divider,
  children,
}: {
  label: string;
  divider?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("px-4 py-2.5", divider && HAIR)}>
      <div className="text-[12px] font-medium text-secondary">{label}</div>
      <div className="mt-0.5">{children}</div>
    </div>
  );
}

function ChipToggle({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "h-9 rounded-full px-4 text-[14px] font-medium transition active:opacity-60",
        active ? "bg-tint text-white" : "bg-fill text-secondary",
      )}
    >
      {label}
    </button>
  );
}

export function GearEditorSheet({
  open,
  gear,
  onClose,
}: {
  open: boolean;
  gear: GearItem | null;
  onClose: () => void;
}) {
  const allGear = useAppStore((s) => s.gear);
  const gearOrder = useAppStore((s) => s.gearOrder);
  const displayUnit = useAppStore((s) => s.displayUnit);
  const currency = useAppStore((s) => s.currency);
  const addGear = useAppStore((s) => s.addGear);
  const updateGear = useAppStore((s) => s.updateGear);
  const deleteGear = useAppStore((s) => s.deleteGear);

  const isEdit = !!gear;

  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [major, setMajor] = useState("");
  const [minor, setMinor] = useState("");
  const [unit, setUnit] = useState<WeightUnit>(displayUnit);
  const [weight, setWeight] = useState("");
  const [qty, setQty] = useState(1);
  const [price, setPrice] = useState("");
  const [worn, setWorn] = useState(false);
  const [consumable, setConsumable] = useState(false);
  const [note, setNote] = useState("");
  const [url, setUrl] = useState("");
  const [addonIds, setAddonIds] = useState<string[]>([]);
  const [addonOpen, setAddonOpen] = useState(false);
  const [addonQuery, setAddonQuery] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!open) return;
    setConfirmDelete(false);
    setAddonQuery("");
    setUnit(displayUnit);
    if (gear) {
      setName(gear.name);
      setBrand(gear.brand ?? "");
      setMajor(gear.majorCategory);
      setMinor(gear.minorCategory ?? "");
      setWeight(gear.weightG ? String(round3(fromGrams(gear.weightG, displayUnit))) : "");
      setQty(gear.quantity);
      setPrice(gear.price != null ? String(gear.price) : "");
      setWorn(!!gear.worn);
      setConsumable(!!gear.consumable);
      setNote(gear.note ?? "");
      setUrl(gear.url ?? "");
      setAddonIds(gear.addOnIds.filter((id) => allGear[id]));
      setAddonOpen(gear.addOnIds.length > 0);
    } else {
      setName("");
      setBrand("");
      setMajor("");
      setMinor("");
      setWeight("");
      setQty(1);
      setPrice("");
      setWorn(false);
      setConsumable(false);
      setNote("");
      setUrl("");
      setAddonIds([]);
      setAddonOpen(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, gear]);

  const majors = useMemo(
    () => [...new Set(Object.values(allGear).map((g) => g.majorCategory))].sort(),
    [allGear],
  );
  const minors = useMemo(
    () =>
      [
        ...new Set(
          Object.values(allGear)
            .map((g) => g.minorCategory)
            .filter((m): m is string => Boolean(m)),
        ),
      ].sort(),
    [allGear],
  );

  const addonResults = useMemo(() => {
    const qq = addonQuery.trim().toLowerCase();
    if (!qq) return [];
    const exclude = new Set([gear?.id, ...addonIds].filter(Boolean) as string[]);
    return gearOrder
      .map((id) => allGear[id])
      .filter((g): g is GearItem => Boolean(g))
      .filter(
        (g) =>
          !exclude.has(g.id) &&
          (g.name.toLowerCase().includes(qq) ||
            (g.brand ?? "").toLowerCase().includes(qq)),
      )
      .slice(0, 12);
  }, [addonQuery, gearOrder, allGear, addonIds, gear]);

  function handleSave() {
    const weightG = toGrams(parseFloat(weight) || 0, unit);
    const priceNum = price.trim() === "" ? undefined : parseFloat(price) || 0;
    const patch: Partial<GearItem> = {
      name: name.trim() || "새 장비",
      brand: brand.trim() || undefined,
      majorCategory: major.trim() || "기타",
      minorCategory: minor.trim() || undefined,
      weightG,
      quantity: Math.max(1, Math.round(qty) || 1),
      price: priceNum,
      worn,
      consumable,
      note: note.trim() || undefined,
      url: url.trim() || undefined,
      addOnIds: addonIds,
    };
    if (gear) updateGear(gear.id, patch);
    else addGear(patch);
    onClose();
  }

  function handleDelete() {
    if (!gear) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    deleteGear(gear.id);
    onClose();
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={isEdit ? "장비 편집" : "장비 추가"}
      rightAction={{ label: isEdit ? "완료" : "추가", onClick: handleSave, prominent: true }}
    >
      <div className="pb-4">
        <FieldRow label="이름">
          <input
            className={inputCls}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예: Exos 48"
            autoFocus={!isEdit}
          />
        </FieldRow>
        <FieldRow label="브랜드" divider>
          <input
            className={inputCls}
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            placeholder="예: Osprey"
          />
        </FieldRow>
        <FieldRow label="대분류" divider>
          <input
            className={inputCls}
            list="major-cats"
            value={major}
            onChange={(e) => setMajor(e.target.value)}
            placeholder="예: 셸터"
          />
          <datalist id="major-cats">
            {majors.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </FieldRow>
        <FieldRow label="소분류" divider>
          <input
            className={inputCls}
            list="minor-cats"
            value={minor}
            onChange={(e) => setMinor(e.target.value)}
            placeholder="예: 텐트"
          />
          <datalist id="minor-cats">
            {minors.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </FieldRow>

        <FieldRow label="무게" divider>
          <div className="flex items-center gap-2">
            <input
              className={cn(inputCls, "tabular")}
              type="number"
              inputMode="decimal"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="0"
              min={0}
              step="any"
            />
            <Segmented
              className="shrink-0"
              value={unit}
              onChange={setUnit}
              options={WEIGHT_UNITS.map((u) => ({ value: u, label: u }))}
            />
          </div>
        </FieldRow>
        <FieldRow label="수량" divider>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              aria-label="수량 감소"
              className="grid h-8 w-8 place-items-center rounded-full bg-fill text-label active:opacity-60"
            >
              <Minus size={16} />
            </button>
            <span className="w-8 text-center tabular text-[16px] text-label">{qty}</span>
            <button
              type="button"
              onClick={() => setQty((q) => q + 1)}
              aria-label="수량 증가"
              className="grid h-8 w-8 place-items-center rounded-full bg-fill text-label active:opacity-60"
            >
              <Plus size={16} />
            </button>
          </div>
        </FieldRow>
        <FieldRow label={`가격 (${currency})`} divider>
          <input
            className={cn(inputCls, "tabular")}
            type="number"
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="선택"
            min={0}
            step="any"
          />
        </FieldRow>

        <div className={cn("px-4 py-3", HAIR)}>
          <div className="mb-2 text-[12px] font-medium text-secondary">유형</div>
          <div className="flex gap-2">
            <ChipToggle label="착용" active={worn} onClick={() => setWorn((v) => !v)} />
            <ChipToggle
              label="소모"
              active={consumable}
              onClick={() => setConsumable((v) => !v)}
            />
          </div>
        </div>

        {/* ADD-ON */}
        <button
          type="button"
          onClick={() => setAddonOpen((o) => !o)}
          className={cn(
            "flex w-full items-center justify-between px-4 py-3 active:opacity-60",
            HAIR,
          )}
        >
          <span className="text-[13px] font-bold uppercase tracking-[0.06em] text-secondary">
            ADD-ON{addonIds.length > 0 ? ` · ${addonIds.length}` : ""}
          </span>
          <ChevronDown
            size={18}
            className={cn("text-tertiary transition-transform", addonOpen && "rotate-180")}
          />
        </button>

        {addonOpen && (
          <div className="space-y-2 px-4 pb-3 pt-1">
            {addonIds.map((id) => {
              const a = allGear[id];
              if (!a) return null;
              return (
                <div key={id} className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-[15px] text-label">
                    {a.name}
                    {a.brand && <span className="text-secondary"> · {a.brand}</span>}
                  </span>
                  <button
                    type="button"
                    aria-label="애드온 제거"
                    onClick={() => setAddonIds((prev) => prev.filter((x) => x !== id))}
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-red active:bg-fill"
                  >
                    <X size={17} />
                  </button>
                </div>
              );
            })}

            <div className="flex h-10 items-center gap-2.5 rounded-[12px] bg-fill px-3.5">
              <Search size={16} className="shrink-0 text-tertiary" />
              <input
                className="min-w-0 flex-1 bg-transparent text-[15px] text-label outline-none placeholder:text-tertiary"
                value={addonQuery}
                onChange={(e) => setAddonQuery(e.target.value)}
                placeholder="장비를 검색해 애드온으로 추가"
              />
              {addonQuery && (
                <button
                  type="button"
                  aria-label="지우기"
                  onClick={() => setAddonQuery("")}
                  className="shrink-0 text-tertiary active:opacity-50"
                >
                  <X size={15} />
                </button>
              )}
            </div>

            {addonQuery.trim() &&
              (addonResults.length === 0 ? (
                <p className="px-1 py-1 text-[14px] text-secondary">
                  검색 결과가 없습니다.
                </p>
              ) : (
                <div>
                  {addonResults.map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => {
                        setAddonIds((prev) => [...prev, g.id]);
                        setAddonQuery("");
                      }}
                      className="flex w-full items-center gap-2 py-2 text-left active:opacity-60"
                    >
                      <span className="min-w-0 flex-1 truncate text-[15px] text-label">
                        {g.name}
                        {g.brand && <span className="text-secondary"> · {g.brand}</span>}
                      </span>
                      <Plus size={17} className="shrink-0 text-tint" />
                    </button>
                  ))}
                </div>
              ))}
          </div>
        )}

        <FieldRow label="메모" divider>
          <textarea
            className={cn(inputCls, "min-h-[56px] resize-none py-0.5 leading-relaxed")}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="색상, 사이즈, 비고 등 (목록에서 길게 눌러 확인)"
            rows={2}
          />
        </FieldRow>
        <FieldRow label="링크" divider>
          <input
            className={inputCls}
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://"
          />
        </FieldRow>

        {isEdit && (
          <button
            type="button"
            onClick={handleDelete}
            className={cn(
              "mt-3 flex h-12 w-full items-center justify-center gap-2 text-[15px] text-red active:opacity-60",
              HAIR,
            )}
          >
            <Trash2 size={17} />
            {confirmDelete ? "한 번 더 눌러 삭제" : "장비 삭제"}
          </button>
        )}
      </div>
    </Sheet>
  );
}
