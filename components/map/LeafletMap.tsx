"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import {
  clusterHtml,
  clusterPoints,
  DEFAULT_VIEW,
  FIT_MAX_ZOOM,
  FIT_PAD,
  KOREA_VIEW,
  pinHtml,
  type MapViewProps,
} from "./types";

/** Keyless fallback: Leaflet over OpenStreetMap's own tiles, drawn in
 *  greyscale (inverted in dark mode) by globals.css to match the app. */
export function LeafletMap({
  points,
  selected,
  onSelect,
  active,
  fitTick,
  koreaTick,
}: MapViewProps) {
  const el = useRef<HTMLDivElement>(null);
  const st = useRef<{ L: typeof Leaflet; map: Leaflet.Map; layer: Leaflet.LayerGroup } | null>(
    null,
  );
  const [ready, setReady] = useState(false);
  /** Re-cluster when the zoom changes. */
  const [zoom, setZoom] = useState<number>(DEFAULT_VIEW.zoom);
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);
  const fitted = useRef<string | null>(null);

  useEffect(() => {
    let dead = false;
    import("leaflet").then((mod) => {
      if (dead || !el.current) return;
      const L = mod.default;
      const map = L.map(el.current, {
        zoomControl: false,
        center: [DEFAULT_VIEW.lat, DEFAULT_VIEW.lng],
        zoom: DEFAULT_VIEW.zoom,
        zoomSnap: 0.25,
      });
      map.attributionControl.setPrefix(false);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution:
          '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);
      const layer = L.layerGroup().addTo(map);
      // a tap on empty map deselects (marker taps reach the map too)
      map.on("click", (e) => {
        if ((e.originalEvent.target as Element | null)?.closest?.(".tw-pin")) return;
        onSelectRef.current(null);
      });
      map.on("zoomend", () => setZoom(map.getZoom()));
      st.current = { L, map, layer };
      setReady(true);
    });
    return () => {
      dead = true;
      st.current?.map.remove();
      st.current = null;
    };
  }, []);

  // keep the map sized to its box (it may have been created while hidden)
  useEffect(() => {
    const node = el.current;
    if (!ready || !node) return;
    const ro = new ResizeObserver(() => st.current?.map.invalidateSize());
    ro.observe(node);
    return () => ro.disconnect();
  }, [ready]);

  useEffect(() => {
    const s = st.current;
    if (!ready || !s) return;
    s.layer.clearLayers();
    const z = s.map.getZoom();
    for (const c of clusterPoints(points, (p) => s.map.project([p.lat, p.lng], z))) {
      if (c.members.length === 1) {
        const p = c.members[0];
        const on = p.key === selected;
        s.L.marker([p.lat, p.lng], {
          icon: s.L.divIcon({ className: "tw-pin-wrap", html: pinHtml(p, on), iconSize: [0, 0] }),
          keyboard: false,
          zIndexOffset: on ? 1000 : 0,
        })
          .on("click", () => onSelectRef.current(p.key))
          .addTo(s.layer);
        continue;
      }
      // a merged marker opens up: zoom to its spots
      s.L.marker([c.lat, c.lng], {
        icon: s.L.divIcon({ className: "tw-pin-wrap", html: clusterHtml(c), iconSize: [0, 0] }),
        keyboard: false,
        zIndexOffset: 500,
      })
        .on("click", () => {
          onSelectRef.current(null);
          s.map.flyToBounds(
            s.L.latLngBounds(c.members.map((m) => [m.lat, m.lng] as [number, number])),
            {
              paddingTopLeft: [FIT_PAD.side, FIT_PAD.top],
              paddingBottomRight: [FIT_PAD.side, FIT_PAD.bottom],
              duration: 0.5,
            },
          );
        })
        .addTo(s.layer);
    }
  }, [ready, points, selected, zoom]);

  // Frame every point — when first shown, when the set of spots changes, and
  // on "show all"; not on every tab switch (that would undo your panning).
  const sig = `${points.map((p) => p.key).join("|")}#${fitTick}`;
  useEffect(() => {
    const s = st.current;
    if (!ready || !s || !active) return;
    s.map.invalidateSize();
    if (fitted.current === sig) return;
    const animate = fitted.current !== null;
    fitted.current = sig;
    if (points.length === 0) return;
    s.map.fitBounds(s.L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number])), {
      paddingTopLeft: [FIT_PAD.side, FIT_PAD.top],
      paddingBottomRight: [FIT_PAD.side, FIT_PAD.bottom],
      maxZoom: FIT_MAX_ZOOM,
      animate,
    });
    // points is read through sig
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, active, sig]);

  useEffect(() => {
    const s = st.current;
    if (!ready || !s || !koreaTick) return;
    const k = KOREA_VIEW;
    // fit the coast-to-coast width, edge to edge
    const z = s.map.getBoundsZoom(
      [
        [k.lat, k.west],
        [k.lat, k.east],
      ],
      false,
      s.L.point(0, 0),
    );
    s.map.flyTo([k.lat, k.lng], z, { duration: 0.5 });
  }, [ready, koreaTick]);

  return <div ref={el} className="tw-map tw-map-tab h-full w-full" />;
}
