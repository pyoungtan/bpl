export type WeightUnit = "g" | "kg" | "oz" | "lb";

export type ThemePref = "light" | "dark" | "system";

/** A piece of gear in the master shelf. */
export interface GearItem {
  id: string;
  name: string;
  brand?: string;
  /** 대분류 — used to group the shelf and color the charts. */
  majorCategory: string;
  /** 소분류 */
  minorCategory?: string;
  /** Canonical weight of a single unit, in grams. */
  weightG: number;
  quantity: number;
  price?: number;
  /** 착용 — worn on the body, excluded from base weight. */
  worn?: boolean;
  /** 소모품 — food / fuel / water, excluded from base weight. */
  consumable?: boolean;
  url?: string;
  note?: string;
  /** Hidden from the active shelf — collected under a "숨겨짐" group. */
  hidden?: boolean;
  /** Other gear ids that travel with this item (add-ons). */
  addOnIds: string[];
}

/** A gear item packed for a trip, with the quantity taken. */
export interface PackedEntry {
  gearId: string;
  quantity: number;
}

export interface Trip {
  id: string;
  name: string;
  /** ISO date (yyyy-mm-dd). Legacy single date — kept for migration/fallback. */
  date?: string;
  /** ISO start/end dates (yyyy-mm-dd) for a date range. */
  startDate?: string;
  endDate?: string;
  memo: string;
  packed: PackedEntry[];
  /** gearIds the user has checked off as packed (gear-check mode). */
  checked: string[];
  createdAt: number;
}

/** A saved, reusable set of gear (a frequently-used combo). */
export interface Preset {
  id: string;
  name: string;
  gearIds: string[];
}

export interface AppData {
  gear: Record<string, GearItem>;
  gearOrder: string[];
  /** Ordered list of major-category (대분류) names. */
  categories: string[];
  presets: Preset[];
  trips: Record<string, Trip>;
  tripOrder: string[];
  displayUnit: WeightUnit;
  currency: string;
  theme: ThemePref;
}
