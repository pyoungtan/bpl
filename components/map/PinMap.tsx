"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import { DEFAULT_VIEW } from "./types";

/** Zoom a picked spot opens at. */
const SPOT_ZOOM = 12;

/**
 * A small map for choosing one spot: shows `pos` as a pin and reports taps
 * via `onPick`. When `pos` changes from outside (a search result), it flies
 * there. Leaflet over the same greyscale OpenStreetMap tiles as the Map tab.
 */
export function PinMap({
  pos,
  onPick,
}: {
  pos: { lat: number; lng: number } | null;
  onPick: (lat: number, lng: number) => void;
}) {
  const el = useRef<HTMLDivElement>(null);
  const st = useRef<{ L: typeof Leaflet; map: Leaflet.Map; pin: Leaflet.Marker | null } | null>(
    null,
  );
  const [ready, setReady] = useState(false);
  const onPickRef = useRef(onPick);
  useEffect(() => {
    onPickRef.current = onPick;
  }, [onPick]);
  /** The last spot we placed ourselves (a tap) — no need to fly to it. */
  const tapped = useRef<string | null>(null);

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
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);
      map.on("click", (e) => {
        tapped.current = `${e.latlng.lat},${e.latlng.lng}`;
        onPickRef.current(e.latlng.lat, e.latlng.lng);
      });
      st.current = { L, map, pin: null };
      setReady(true);
    });
    return () => {
      dead = true;
      st.current?.map.remove();
      st.current = null;
    };
  }, []);

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
    s.pin?.remove();
    s.pin = null;
    if (!pos) return;
    s.pin = s.L.marker([pos.lat, pos.lng], {
      icon: s.L.divIcon({
        className: "tw-pin-wrap",
        html: '<div class="tw-pin" data-on><span class="tw-pin-dot"></span></div>',
        iconSize: [0, 0],
      }),
      keyboard: false,
      interactive: false,
    }).addTo(s.map);
    const k = `${pos.lat},${pos.lng}`;
    if (tapped.current === k) return;
    s.map.setView([pos.lat, pos.lng], Math.max(s.map.getZoom(), SPOT_ZOOM), { animate: false });
  }, [ready, pos]);

  return <div ref={el} className="tw-map h-full w-full" />;
}
