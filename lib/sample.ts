import type { AppData, GearItem } from "./types";

// Demo data shown to first-time visitors (no cloud login / no saved data yet).
// A small, curated set of well-known backpacking gear. The owner's real data
// lives in the cloud + local cache and is never replaced by this.

type SeedGear = Omit<GearItem, "addOnIds"> & { addOnIds?: string[] };

const gearSeed: SeedGear[] = [
  { id: "g1", name: "Exos 48", brand: "Osprey", majorCategory: "배낭", minorCategory: "백패킹 배낭", weightG: 1100, quantity: 1, price: 320000 },
  { id: "g2", name: "Duplex", brand: "Zpacks", majorCategory: "셸터", minorCategory: "트레킹폴 텐트", weightG: 540, quantity: 1, price: 950000 },
  { id: "g3", name: "NeoAir XLite", brand: "Therm-a-Rest", majorCategory: "침낭·매트", minorCategory: "에어매트", weightG: 350, quantity: 1, price: 350000 },
  { id: "g4", name: "PocketRocket 2", brand: "MSR", majorCategory: "취사", minorCategory: "가스 스토브", weightG: 73, quantity: 1, price: 75000 },
];

const categoryOrder = ["배낭", "셸터", "침낭·매트", "취사"];

export function createSampleData(): AppData {
  const gear: Record<string, GearItem> = {};
  for (const g of gearSeed) gear[g.id] = { ...g, addOnIds: g.addOnIds ?? [] };
  return {
    gear,
    gearOrder: gearSeed.map((g) => g.id),
    categories: [...categoryOrder],
    presets: [],
    trips: {},
    tripOrder: [],
    displayUnit: "g",
    currency: "KRW",
    theme: "system",
  };
}
