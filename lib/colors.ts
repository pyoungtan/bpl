/**
 * Warm, editorial category palette tuned to the cream/coral Anthropic system.
 * Coral (#cc785c) is intentionally excluded — it is reserved for primary CTAs.
 */
export const CATEGORY_PALETTE = [
  "#5db8a6", // teal
  "#e8a55a", // amber
  "#8b6f5c", // walnut
  "#6c8e7f", // sage
  "#b5654a", // terracotta
  "#5f7a8a", // slate blue
  "#9c7a8a", // dusty plum
  "#c19a6b", // tan
  "#84a98c", // muted green
  "#a98467", // khaki
  "#7b8b9a", // dusty blue
  "#c4915c", // ochre
];

/** Deterministically map a category name to a stable palette color. */
export function colorForCategory(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) >>> 0;
  }
  return CATEGORY_PALETTE[h % CATEGORY_PALETTE.length];
}
