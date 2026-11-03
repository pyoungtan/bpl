import { quietScrollTuck } from "@/components/TopBar";

/** Page offset of an element, ignoring transforms (layout animations would
 *  otherwise report where a row is drawn, not where it is). */
function docTop(el: HTMLElement): number {
  let y = 0;
  let n: HTMLElement | null = el;
  while (n) {
    y += n.offsetTop;
    n = n.offsetParent as HTMLElement | null;
  }
  return y;
}

/**
 * Call right before a filter toggles the list: remembers the first row under
 * the top bar — plus its neighbours, in case that row is filtered out — and
 * once React has re-rendered, scrolls so the nearest surviving row sits where
 * it was on screen. Toggling back and forth keeps your place instead of
 * jumping to the top.
 */
export function keepRowInPlace() {
  if (window.scrollY < 4) return; // at the top the list simply stays there
  const pane = document.querySelector<HTMLElement>("[data-tab-pane]:not([hidden])");
  if (!pane) return;
  const line = parseFloat(getComputedStyle(pane).paddingTop) || 0;
  const rows = Array.from(pane.querySelectorAll<HTMLElement>("[data-row-id]")).filter(
    (el) => el.offsetParent !== null,
  );
  let at = rows.findIndex((el) => docTop(el) + el.offsetHeight - window.scrollY > line);
  if (at < 0) at = rows.length - 1;
  // the anchor first, then the rows below it, then the ones above (nearest first)
  const order = [...rows.slice(at), ...rows.slice(0, at).reverse()].map((el) => ({
    id: el.dataset.rowId ?? "",
    top: docTop(el) - window.scrollY,
  }));
  requestAnimationFrame(() => {
    for (const { id, top } of order) {
      const el = pane.querySelector<HTMLElement>(`[data-row-id="${CSS.escape(id)}"]`);
      if (!el || el.offsetParent === null) continue;
      quietScrollTuck();
      window.scrollTo({ top: Math.max(0, docTop(el) - top), behavior: "instant" });
      return;
    }
  });
}
