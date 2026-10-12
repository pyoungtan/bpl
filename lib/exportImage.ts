import type { GearItem, Trip, WeightUnit } from "./types";
import { formatWeight, formatWeightSmart } from "./units";

/**
 * Trip "내보내기" images, drawn straight onto a canvas (DOM-to-image
 * capture is unreliable on iOS Safari: missing fonts, blank first frames).
 * Two layouts, matching the export design canvas:
 *  - PC: 1920×1080, header + 4-column category list (name · brand · weight)
 *  - Mobile: iPhone width (402pt, rendered @3x), flowing "name weight" runs
 *    per category; the height is cut to the content, with equal top/bottom
 *    margins.
 */

export interface ExportItem {
  name: string;
  brand: string;
  weightG: number;
  qty: number;
}
export interface ExportCategory {
  name: string;
  totalG: number;
  items: ExportItem[];
}
export interface ExportData {
  categories: ExportCategory[];
  totalG: number;
  itemCount: number;
}

/** Packed gear grouped by 대분류 in the Gear order. Add-ons packed with their
 *  parent are not listed, but their weight counts toward the parent's
 *  category (as in the trip's stats); manual extra weight counts toward the
 *  total only. */
export function buildExportData(
  trip: Trip,
  gear: Record<string, GearItem>,
  gearOrder: string[],
  categories: string[],
): ExportData {
  const qty = new Map(trip.packed.map((p) => [p.gearId, p.quantity]));
  const parentCat = new Map<string, string>();
  for (const p of trip.packed) {
    const g = gear[p.gearId];
    if (!g) continue;
    for (const aid of g.addOnIds) if (qty.has(aid)) parentCat.set(aid, g.majorCategory);
  }
  const groups = new Map<string, ExportCategory>();
  const group = (name: string) => {
    let c = groups.get(name);
    if (!c) {
      c = { name, totalG: 0, items: [] };
      groups.set(name, c);
    }
    return c;
  };
  let totalG = trip.extraWeightG ?? 0;
  let itemCount = 0;
  for (const id of gearOrder) {
    const q = qty.get(id);
    const g = gear[id];
    if (q == null || !g) continue;
    const w = g.weightG * q;
    totalG += w;
    const credited = parentCat.get(id);
    if (credited) {
      group(credited).totalG += w;
      continue;
    }
    const c = group(g.majorCategory);
    c.totalG += w;
    c.items.push({ name: g.name, brand: g.brand ?? "", weightG: g.weightG, qty: q });
    itemCount++;
  }
  const rank = (name: string) => {
    const i = categories.indexOf(name);
    return i === -1 ? categories.length : i;
  };
  const list = [...groups.values()]
    .filter((c) => c.items.length > 0)
    .sort((a, b) => rank(a.name) - rank(b.name));
  return { categories: list, totalG, itemCount };
}

/* ---------------- font ---------------- */

const FAMILY = "Pretendard Variable";
let fontReady: Promise<void> | null = null;

export function loadExportFont(): Promise<void> {
  if (!fontReady) {
    fontReady = (async () => {
      const face = new FontFace(FAMILY, "url(/fonts/PretendardVariable.woff2)", {
        weight: "45 920",
        style: "normal",
      });
      await face.load();
      document.fonts.add(face);
    })().catch((e) => {
      fontReady = null;
      throw e;
    });
  }
  return fontReady;
}

/* ---------------- canvas helpers ---------------- */

type Ctx = CanvasRenderingContext2D;

function setFont(ctx: Ctx, weight: number, size: number) {
  ctx.font = `${weight} ${size}px "${FAMILY}", sans-serif`;
}

/** Width of text drawn with extra tracking (em). */
function trackedWidth(ctx: Ctx, text: string, size: number, trackEm: number) {
  if (!trackEm) return ctx.measureText(text).width;
  let w = 0;
  for (const ch of text) w += ctx.measureText(ch).width + trackEm * size;
  return w - trackEm * size;
}
function drawTracked(ctx: Ctx, text: string, x: number, y: number, size: number, trackEm: number) {
  if (!trackEm) {
    ctx.fillText(text, x, y);
    return;
  }
  let cx = x;
  for (const ch of text) {
    ctx.fillText(ch, cx, y);
    cx += ctx.measureText(ch).width + trackEm * size;
  }
}

/** Longest prefix of `text` + "…" that fits `maxW` (the text itself if it fits). */
function ellipsize(ctx: Ctx, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text;
  const chars = [...text];
  let lo = 0;
  let hi = chars.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (ctx.measureText(chars.slice(0, mid).join("") + "…").width <= maxW) lo = mid;
    else hi = mid - 1;
  }
  return lo > 0 ? chars.slice(0, lo).join("").trimEnd() + "…" : "";
}

function splitUnit(s: string): [string, string] {
  const i = s.lastIndexOf(" ");
  return i === -1 ? [s, ""] : [s.slice(0, i), s.slice(i + 1)];
}

function toBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png"),
  );
}

/** Split `heights` (in order) into `k` columns minimising the tallest one,
 *  like CSS columns fill — returns the index each column starts at. */
function balanceColumns(heights: number[], k: number, gap: number): number[] {
  const n = heights.length;
  if (n <= k) return heights.map((_, i) => i);
  const pre = [0];
  for (const h of heights) pre.push(pre[pre.length - 1] + h);
  const span = (i: number, j: number) => pre[j] - pre[i] + gap * Math.max(0, j - i - 1);
  // dp[c][j]: best max height placing the first j blocks into c columns
  const dp = Array.from({ length: k + 1 }, () => new Array(n + 1).fill(Infinity));
  const cut = Array.from({ length: k + 1 }, () => new Array(n + 1).fill(0));
  dp[0][0] = 0;
  for (let c = 1; c <= k; c++) {
    for (let j = 1; j <= n; j++) {
      for (let i = c - 1; i < j; i++) {
        const v = Math.max(dp[c - 1][i], span(i, j));
        if (v < dp[c][j]) {
          dp[c][j] = v;
          cut[c][j] = i;
        }
      }
    }
  }
  const starts: number[] = [];
  let j = n;
  for (let c = k; c >= 1; c--) {
    const i = cut[c][j];
    starts.unshift(i);
    j = i;
  }
  return starts;
}

/* ---------------- PC: 1920×1080 ---------------- */

const INK = "#111111";
const INK2 = "#2c2c2e";
const SUB = "#8e8e93";

export async function renderPcImage(data: ExportData, unit: WeightUnit): Promise<Blob> {
  await loadExportFont();
  const W = 1920;
  const BASE_H = 1080;
  const PAD_X = 80;
  const PAD_Y = 72;

  // Try the design size first; if the list is too tall, widen to 5 columns,
  // then step the type down, and as a last resort let the image grow taller.
  const attempts: { cols: number; s: number }[] = [
    { cols: 4, s: 1 },
    { cols: 5, s: 1 },
    { cols: 5, s: 0.92 },
    { cols: 5, s: 0.85 },
    { cols: 5, s: 0.78 },
  ];
  let plan: ReturnType<typeof planPc> | null = null;
  for (const a of attempts) {
    plan = planPc(data, a.cols, a.s, W - PAD_X * 2);
    if (plan.bodyTop + plan.colHeight <= BASE_H - PAD_Y) break;
  }
  const p = plan!;
  const H = Math.max(BASE_H, Math.ceil(p.bodyTop + p.colHeight + PAD_Y));

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);
  ctx.textBaseline = "alphabetic";

  // header
  const hb = PAD_Y + 30;
  ctx.fillStyle = INK;
  setFont(ctx, 700, 18);
  drawTracked(ctx, "PACK LIST", PAD_X, hb, 18, 0.2);
  setFont(ctx, 700, 30);
  const total = formatWeightSmart(data.totalG, unit);
  const totalW = ctx.measureText(total).width;
  ctx.fillText(total, W - PAD_X - totalW, hb);
  setFont(ctx, 400, 19);
  ctx.fillStyle = SUB;
  const meta = `장비 ${data.itemCount}개 · 카테고리 ${data.categories.length}개`;
  ctx.fillText(meta, W - PAD_X - totalW - 28 - ctx.measureText(meta).width, hb);

  // columns
  const s = p.s;
  for (let c = 0; c < p.columns.length; c++) {
    const x0 = PAD_X + c * (p.colW + p.colGap);
    let y = p.bodyTop;
    for (const cat of p.columns[c]) {
      // category header
      const headB = y + 17 * s;
      setFont(ctx, 700, 17 * s);
      ctx.fillStyle = INK;
      drawTracked(ctx, cat.name, x0, headB, 17 * s, 0.08);
      const t = formatWeightSmart(cat.totalG, unit);
      ctx.fillText(t, x0 + p.colW - ctx.measureText(t).width, headB);
      y += p.headH;
      for (const it of cat.items) {
        const b = y + p.rowH / 2 + 19 * s * 0.36;
        setFont(ctx, 400, 19 * s);
        const w = formatWeight(it.weightG, unit) + (it.qty > 1 ? ` ×${it.qty}` : "");
        const wW = ctx.measureText(w).width;
        ctx.fillStyle = INK2;
        ctx.fillText(w, x0 + p.colW - wW, b);
        const avail = p.colW - wW - 14 * s;
        setFont(ctx, 500, 19 * s);
        ctx.fillStyle = INK;
        const name = ellipsize(ctx, it.name, avail);
        ctx.fillText(name, x0, b);
        const nameW = ctx.measureText(name).width;
        if (it.brand && name === it.name) {
          setFont(ctx, 400, 15 * s);
          const room = avail - nameW - 8 * s;
          const brand = room > 24 * s ? ellipsize(ctx, it.brand, room) : "";
          if (brand) {
            ctx.fillStyle = SUB;
            ctx.fillText(brand, x0 + nameW + 8 * s, b);
          }
        }
        y += p.rowH;
      }
      y += p.blockGap;
    }
  }
  return toBlob(canvas);
}

function planPc(
  data: ExportData,
  cols: number,
  s: number,
  innerW: number,
) {
  const colGap = cols === 4 ? 64 : 48;
  const colW = (innerW - colGap * (cols - 1)) / cols;
  const headH = 25 * s + 8 * s;
  const rowH = 30 * s;
  const blockGap = 30 * s;
  const heights = data.categories.map((c) => headH + rowH * c.items.length);
  const starts = balanceColumns(heights, cols, blockGap);
  const columns: ExportCategory[][] = starts.map((st, i) =>
    data.categories.slice(st, starts[i + 1] ?? data.categories.length),
  );
  const colHeight = Math.max(
    0,
    ...columns.map((col) =>
      col.reduce((h, c, i) => h + headH + rowH * c.items.length + (i > 0 ? blockGap : 0), 0),
    ),
  );
  const bodyTop = 72 + 36 + 52;
  return { cols, s, colGap, colW, headH, rowH, blockGap, columns, colHeight, bodyTop };
}

/* ---------------- Mobile: 402pt wide @3x ---------------- */

const DOT = "#c7c7cc";
const NAME = "#48484a";

export async function renderMobileImage(data: ExportData, unit: WeightUnit): Promise<Blob> {
  await loadExportFont();
  const S = 3; // device pixel ratio of the export
  const W = 402;
  const PAD_X = 22;
  const PAD_Y = 34;
  const LABEL_W = 72;
  const LABEL_GAP = 10;
  const FLOW_W = W - PAD_X * 2 - LABEL_W - LABEL_GAP;
  const LINE = 19;
  const DOT_W = 23;
  const SECTION_GAP = 11;

  const m = document.createElement("canvas").getContext("2d")!;

  type Run = { item: ExportItem; name: string; num: string; u: string; q: string; x: number; line: number };
  const sections = data.categories.map((cat) => {
    // label may wrap onto a second line in its narrow column
    setFont(m, 700, 9.5);
    const words = cat.name.split(" ");
    const labelLines: string[] = [];
    let cur = "";
    for (const w of words) {
      const next = cur ? `${cur} ${w}` : w;
      if (cur && trackedWidth(m, next, 9.5, 0.08) > LABEL_W) {
        labelLines.push(cur);
        cur = w;
      } else cur = next;
    }
    if (cur) labelLines.push(cur);

    const runs: Run[] = [];
    let x = 0;
    let line = 0;
    for (const it of cat.items) {
      const [num, u] = splitUnit(formatWeight(it.weightG, unit));
      const q = it.qty > 1 ? `×${it.qty}` : "";
      setFont(m, 500, 12);
      const numW = m.measureText(num).width;
      setFont(m, 500, 9);
      const uW = u ? 1 + m.measureText(u).width : 0;
      setFont(m, 600, 9.5);
      const qW = q ? 2 + m.measureText(q).width : 0;
      setFont(m, 400, 12);
      const fullName = m.measureText(it.name).width;
      const tail = 6 + numW + uW + qW;
      let width = fullName + tail;
      let name = it.name;
      if (x > 0 && x + DOT_W + width > FLOW_W) {
        line++;
        x = 0;
      }
      const lead = x > 0 ? DOT_W : 0;
      if (lead + width > FLOW_W) {
        name = ellipsize(m, it.name, FLOW_W - lead - tail);
        width = m.measureText(name).width + tail;
      }
      runs.push({ item: it, name, num, u, q, x: x + lead, line });
      x += lead + width;
    }
    const lines = line + 1;
    const height = Math.max(lines * LINE, 3 + labelLines.length * 12);
    return { cat, labelLines, runs, height };
  });

  const headerH = 22;
  const bodyTop = PAD_Y + headerH + 26;
  const bodyH =
    sections.reduce((h, s) => h + s.height, 0) + SECTION_GAP * Math.max(0, sections.length - 1);
  const H = Math.ceil(bodyTop + bodyH + PAD_Y);

  const canvas = document.createElement("canvas");
  canvas.width = W * S;
  canvas.height = H * S;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(S, S);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);
  ctx.textBaseline = "alphabetic";

  // header
  const hb = PAD_Y + 18;
  ctx.fillStyle = "#000000";
  setFont(ctx, 700, 11);
  drawTracked(ctx, "PACK LIST", PAD_X, hb, 11, 0.2);
  const [tNum, tUnit] = splitUnit(formatWeightSmart(data.totalG, unit));
  setFont(ctx, 500, 12);
  const tuW = ctx.measureText(tUnit).width;
  setFont(ctx, 700, 18);
  const tnW = ctx.measureText(tNum).width;
  const tx = W - PAD_X - tuW - 2 - tnW;
  ctx.fillText(tNum, tx, hb);
  setFont(ctx, 500, 12);
  ctx.fillStyle = SUB;
  ctx.fillText(tUnit, tx + tnW + 2, hb);

  // sections
  let y = bodyTop;
  const flowX = PAD_X + LABEL_W + LABEL_GAP;
  for (const sec of sections) {
    setFont(ctx, 700, 9.5);
    ctx.fillStyle = SUB;
    sec.labelLines.forEach((l, i) => drawTracked(ctx, l, PAD_X, y + 3 + 9.5 + i * 12, 9.5, 0.08));
    for (const r of sec.runs) {
      const b = y + r.line * LINE + LINE / 2 + 12 * 0.36;
      let x = flowX + r.x;
      if (r.x > 0) {
        setFont(ctx, 400, 12);
        ctx.fillStyle = DOT;
        const dw = ctx.measureText("·").width;
        ctx.fillText("·", x - DOT_W / 2 - dw / 2, b);
      }
      setFont(ctx, 400, 12);
      ctx.fillStyle = NAME;
      ctx.fillText(r.name, x, b);
      x += ctx.measureText(r.name).width + 6;
      setFont(ctx, 500, 12);
      ctx.fillStyle = "#000000";
      ctx.fillText(r.num, x, b);
      x += ctx.measureText(r.num).width;
      if (r.u) {
        setFont(ctx, 500, 9);
        ctx.fillStyle = SUB;
        ctx.fillText(r.u, x + 1, b);
        x += 1 + ctx.measureText(r.u).width;
      }
      if (r.q) {
        setFont(ctx, 600, 9.5);
        ctx.fillStyle = SUB;
        ctx.fillText(r.q, x + 2, b);
      }
    }
    y += sec.height + SECTION_GAP;
  }
  return toBlob(canvas);
}
