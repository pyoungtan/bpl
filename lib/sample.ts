import type { AppData, GearItem } from "./types";

// Demo data shown to first-time visitors (no cloud login / no saved data yet).
// A small, curated set of well-known backpacking gear. The owner's real data
// lives in the cloud + local cache and is never replaced by this.

type SeedGear = Omit<GearItem, "addOnIds"> & { addOnIds?: string[] };

const gearSeed: SeedGear[] = [
  // 배낭
  { id: "g1", name: "Exos 48", brand: "Osprey", majorCategory: "배낭", minorCategory: "백패킹 배낭", weightG: 1100, quantity: 1, price: 320000 },
  { id: "g2", name: "Southwest 3400", brand: "Hyperlite", majorCategory: "배낭", minorCategory: "다이니마 배낭", weightG: 900, quantity: 1, price: 620000 },
  { id: "g3", name: "Baltoro 65", brand: "Gregory", majorCategory: "배낭", minorCategory: "백패킹 배낭", weightG: 2100, quantity: 1, price: 420000 },

  // 셸터
  { id: "g4", name: "Duplex", brand: "Zpacks", majorCategory: "셸터", minorCategory: "트레킹폴 텐트", weightG: 540, quantity: 1, price: 950000 },
  { id: "g5", name: "Copper Spur HV UL2", brand: "Big Agnes", majorCategory: "셸터", minorCategory: "자립형 텐트", weightG: 1230, quantity: 1, price: 720000, addOnIds: ["g6"] },
  { id: "g6", name: "Copper Spur 풋프린트", brand: "Big Agnes", majorCategory: "셸터", minorCategory: "풋프린트", weightG: 180, quantity: 1, price: 80000 },
  { id: "g7", name: "Hubba Hubba 2", brand: "MSR", majorCategory: "셸터", minorCategory: "자립형 텐트", weightG: 1540, quantity: 1, price: 680000 },

  // 침낭·매트
  { id: "g8", name: "NeoAir XLite", brand: "Therm-a-Rest", majorCategory: "침낭·매트", minorCategory: "에어매트", weightG: 350, quantity: 1, price: 350000 },
  { id: "g9", name: "Tensor", brand: "Nemo", majorCategory: "침낭·매트", minorCategory: "에어매트", weightG: 450, quantity: 1, price: 280000 },
  { id: "g10", name: "UltraLite", brand: "Western Mountaineering", majorCategory: "침낭·매트", minorCategory: "다운 침낭", weightG: 810, quantity: 1, price: 750000 },

  // 취사
  { id: "g11", name: "PocketRocket 2", brand: "MSR", majorCategory: "취사", minorCategory: "가스 스토브", weightG: 73, quantity: 1, price: 75000 },
  { id: "g12", name: "Flash", brand: "Jetboil", majorCategory: "취사", minorCategory: "일체형 스토브", weightG: 371, quantity: 1, price: 170000 },
  { id: "g13", name: "Titanium 750ml Pot", brand: "Toaks", majorCategory: "취사", minorCategory: "코펠", weightG: 103, quantity: 1, price: 55000 },
  { id: "g14", name: "이소가스 230", majorCategory: "취사", minorCategory: "연료", weightG: 375, quantity: 1, price: 8000, consumable: true },

  // 의류·전자
  { id: "g15", name: "Nano Puff", brand: "Patagonia", majorCategory: "의류·전자", minorCategory: "보온 자켓", weightG: 337, quantity: 1, price: 250000 },
  { id: "g16", name: "트레킹폴 (2EA)", brand: "Black Diamond", majorCategory: "의류·전자", minorCategory: "트레킹폴", weightG: 510, quantity: 1, price: 130000, worn: true },
  { id: "g17", name: "Squeeze 정수 필터", brand: "Sawyer", majorCategory: "의류·전자", minorCategory: "정수", weightG: 85, quantity: 1, price: 45000 },
  { id: "g18", name: "Actik Core", brand: "Petzl", majorCategory: "의류·전자", minorCategory: "헤드램프", weightG: 88, quantity: 1, price: 85000 },
];

const categoryOrder = ["배낭", "셸터", "침낭·매트", "취사", "의류·전자"];

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
