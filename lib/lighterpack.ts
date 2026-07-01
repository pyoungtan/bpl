// Parser for public LighterPack share pages (https://lighterpack.com/r/{id}).
// The share page is server-rendered HTML; each category is an <li class="lpCategory">
// with an <h2 class="lpCategoryName">, and items are <li class="lpItem"> rows carrying
// a hidden <input class="lpMG" value="…"> (weight in milligrams) — the exact weight.

export interface LpItem {
  name: string;
  brand?: string;
  weightG: number;
  quantity: number;
}
export interface LpCategory {
  category: string;
  items: LpItem[];
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  "#39": "'",
  nbsp: " ",
};

function decode(s: string): string {
  return s
    .replace(/<[^>]*>/g, " ") // strip any nested tags (links etc.)
    .replace(/&(#?\w+);/g, (_, e) => ENTITIES[e] ?? _)
    .replace(/\s+/g, " ")
    .trim();
}

function span(block: string, cls: string): string {
  const m = block.match(new RegExp(`<span class="${cls}">([\\s\\S]*?)<\\/span>`));
  return m ? decode(m[1]) : "";
}

/** Extract the share id from a full URL or a bare id. */
export function extractShareId(input: string): string | null {
  const s = (input || "").trim();
  const m = s.match(/lighterpack\.com\/r\/([A-Za-z0-9_-]+)/i);
  if (m) return m[1];
  if (/^[A-Za-z0-9_-]{4,}$/.test(s)) return s;
  return null;
}

export function parseLighterpackHtml(html: string): LpCategory[] {
  const result: LpCategory[] = [];
  const chunks = html.split('<li class="lpCategory"').slice(1);
  for (const chunk of chunks) {
    const nameM = chunk.match(/<h2 class="lpCategoryName">([\s\S]*?)<\/h2>/);
    if (!nameM) continue;
    const category = decode(nameM[1]) || "가져온 목록";
    const items: LpItem[] = [];
    const pieces = chunk.split('<li class="lpItem').slice(1);
    for (const p of pieces) {
      const name = span(p, "lpName");
      if (!name) continue;
      const brand = span(p, "lpDescription") || undefined;
      const mgM = p.match(/class="lpMG" value="(\d+)"/);
      const weightG = mgM ? Math.round(Number(mgM[1]) / 1000) : 0;
      const qtyM = p.match(/<span class="lpQtyCell[^"]*"[^>]*>\s*(\d+)\s*<\/span>/);
      const quantity = qtyM ? Math.max(1, parseInt(qtyM[1], 10) || 1) : 1;
      items.push({ name, brand, weightG, quantity });
    }
    if (items.length) result.push({ category, items });
  }
  return result;
}
