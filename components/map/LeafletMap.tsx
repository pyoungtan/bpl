"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import { DEFAULT_VIEW, FIT_MAX_ZOOM, FIT_PAD, pinHtml, type MapViewProps } from "./types";

/** Keyless fallback: Leaflet over OpenStreetMap's own tiles, drawn in
 *  greyscale (inverted in dark mode) by globals.css to match the app. */
export function LeafletMap({ points, selected, onSelect, active, fitTick }: MapViewProps) {
  const el = useRef<HTMLDivElement>(null);
  const st = useRef<{ L: typeof Leaflet; map: Leaflet.Map; layer: Leaflet.LayerGroup } | null>(
    null,
  );
  const [ready, setReady] = useState(false);
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
        zoomSnap: 0.5,
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
    for (const p of points) {
      const on = p.key === selected;
      s.L.marker([p.lat, p.lng], {
        icon: s.L.divIcon({ className: "tw-pin-wrap", html: pinHtml(p, on), iconSize: [0, 0] }),
        keyboard: false,
        zIndexOffset: on ? 1000 : 0,
      })
        .on("click", () => onSelectRef.current(p.key))
        .addTo(s.layer);
    }
  }, [ready, points, selected]);

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

  return <div ref={el} className="tw-map tw-map-tab h-full w-full" />;
}
