/** One spot on the trip map: every trip whose place geocoded to it. */
export interface MapPoint {
  key: string;
  lat: number;
  lng: number;
  label: string;
  count: number;
}

export interface MapViewProps {
  points: MapPoint[];
  selected: string | null;
  onSelect: (key: string | null) => void;
  /** The tab is showing: the map re-measures (it may have been laid out
   *  while hidden) and frames the points the first time. */
  active: boolean;
  /** Bumped by the "show all" button to re-frame every point. */
  fitTick: number;
}

/** Room the floating bars take: framing keeps the points clear of them. */
export const FIT_PAD = { top: 120, bottom: 170, side: 48 };
/** Framing never zooms in past this (a single trip shouldn't fill a street). */
export const FIT_MAX_ZOOM = 12;
/** All of South Korea, before any trip has a place. */
export const DEFAULT_VIEW = { lat: 36.2, lng: 127.9, zoom: 7 };

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Marker markup shared by both map providers (styled in globals.css). */
export function pinHtml(p: MapPoint, on: boolean): string {
  return `<div class="tw-pin"${on ? " data-on" : ""}><span class="tw-pin-dot">${
    p.count > 1 ? p.count : ""
  }</span><span class="tw-pin-label">${esc(p.label)}</span></div>`;
}

/** Spots closer than this on screen merge into one marker. */
export const CLUSTER_PX = 56;

/** One marker on screen: a single spot, or several merged while zoomed out. */
export interface MapCluster {
  key: string;
  lat: number;
  lng: number;
  /** Trips in it (summed over its spots). */
  count: number;
  members: MapPoint[];
}

/**
 * Merge spots that sit within CLUSTER_PX of each other at the current zoom
 * (`px` projects a spot to screen pixels). Greedy, busiest spot first,
 * measured from each cluster's running centre (weighted by trips), which is
 * also where it's drawn. Zooming in pulls them apart
 * until every spot stands alone.
 */
export function clusterPoints(
  points: MapPoint[],
  px: (p: MapPoint) => { x: number; y: number },
): MapCluster[] {
  const seeds: { x: number; y: number; w: number; members: MapPoint[] }[] = [];
  for (const p of [...points].sort((a, b) => b.count - a.count)) {
    const at = px(p);
    const near = seeds.find((s) => Math.hypot(s.x - at.x, s.y - at.y) < CLUSTER_PX);
    if (!near) {
      seeds.push({ x: at.x, y: at.y, w: p.count, members: [p] });
      continue;
    }
    near.members.push(p);
    const w = near.w + p.count;
    near.x = (near.x * near.w + at.x * p.count) / w;
    near.y = (near.y * near.w + at.y * p.count) / w;
    near.w = w;
  }
  return seeds.map(({ members }) => {
    const count = members.reduce((n, m) => n + m.count, 0);
    return {
      key: members.map((m) => m.key).join("|"),
      lat: members.reduce((n, m) => n + m.lat * m.count, 0) / count,
      lng: members.reduce((n, m) => n + m.lng * m.count, 0) / count,
      count,
      members,
    };
  });
}

/** A merged marker: just the trip count, a little larger. */
export function clusterHtml(c: MapCluster): string {
  return `<div class="tw-pin" data-cluster><span class="tw-pin-dot">${c.count}</span></div>`;
}
