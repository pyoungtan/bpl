import type { GearItem } from "./types";
import { colorForCategory } from "./colors";

export interface CategoryAgg {
  name: string;
  color: string;
  weightG: number;
}

export interface Stats {
  byCategory: CategoryAgg[];
  totalG: number;
  baseG: number;
  wornG: number;
  consumableG: number;
  totalPrice: number;
  itemCount: number;
}

export interface GearRow {
  gear: GearItem;
  quantity: number;
}

export function computeStats(rows: GearRow[]): Stats {
  const byCat = new Map<string, number>();
  let totalG = 0;
  let wornG = 0;
  let consumableG = 0;
  let totalPrice = 0;
  let itemCount = 0;

  for (const { gear, quantity } of rows) {
    const w = gear.weightG * quantity;
    totalG += w;
    itemCount += quantity;
    totalPrice += (gear.price ?? 0) * quantity;
    if (gear.worn) wornG += w;
    if (gear.consumable) consumableG += w;
    byCat.set(gear.majorCategory, (byCat.get(gear.majorCategory) ?? 0) + w);
  }

  const byCategory = [...byCat.entries()]
    .map(([name, weightG]) => ({ name, color: colorForCategory(name), weightG }))
    .sort((a, b) => b.weightG - a.weightG);

  return {
    byCategory,
    totalG,
    baseG: totalG - wornG - consumableG,
    wornG,
    consumableG,
    totalPrice,
    itemCount,
  };
}
