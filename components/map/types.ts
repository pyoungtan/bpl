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
