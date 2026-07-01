/**
 * Fresh, crisp category palette tuned to the cream/coral Anthropic system —
 * brighter and cleaner than the earlier earth-tone set, while staying harmonious.
 * Coral (#cc785c) is intentionally excluded — it is reserved for primary CTAs.
 */
export const CATEGORY_PALETTE = [
  "#34b3a0", // aqua teal
  "#f2a93b", // marigold
  "#6a9fd4", // sky blue
  "#83c26b", // fresh green
  "#b184c8", // orchid
  "#4fc0b0", // mint
  "#f0b849", // gold
  "#7d8add", // periwinkle
  "#d98bb0", // rose
  "#9ac955", // lime
  "#58a7cf", // cerulean
  "#a9c17a", // soft olive
];

/** Deterministically map a category name to a stable palette color. */
export function colorForCategory(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) >>> 0;
  }
  return CATEGORY_PALETTE[h % CATEGORY_PALETTE.length];
}
