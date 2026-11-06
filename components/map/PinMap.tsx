"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import { loadNaver, type NaverMaps } from "./NaverMap";
import { DEFAULT_VIEW } from "./types";

const NAVER_KEY = process.env.NEXT_PUBLIC_NAVER_MAP_KEY;
const PIN = '<div class="tw-pin" data-on><span class="tw-pin-dot"></span></div>';

/** Zoom a picked spot opens at. */
const SPOT_ZOOM = 12;

/**
 * A small map for choosing one spot: shows `pos` as a pin and reports taps
 * via `onPick`. When `pos` changes from outside (a search result), it flies
 * there. The same provider as the Map tab: Naver Maps with a key, else
 * Leaflet over greyscale OpenStreetMap tiles.
 */
export function PinMap(props: {
  pos: { lat: number; lng: number } | null;
  onPick: (lat: number, lng: number) => void;
}) {
  return NAVER_KEY ? <NaverPinMap apiKey={NAVER_KEY} {...props} /> : <LeafletPinMap {...props} />;
}

function NaverPinMap({
  apiKey,
  pos,
  onPick,
}: {
  apiKey: string;
  pos: { lat: number; lng: number } | null;
  onPick: (lat: number, lng: number) => void;
}) {
  const el = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const st = useRef<{ n: NaverMaps; map: NaverMaps; pin: NaverMaps | null } | null>(null);
  const [ready, setReady] = useState(false);
  const onPickRef = useRef(onPick);
  useEffect(() => {
    onPickRef.current = onPick;
  }, [onPick]);
  const tapped = useRef<string | null>(null);

  useEffect(() => {
    let dead = false;
    loadNaver(apiKey)
      .then((n) => {
        if (dead || !el.current) return;
        const map = new n.Map(el.current, {
          center: new n.LatLng(DEFAULT_VIEW.lat, DEFAULT_VIEW.lng),
          zoom: DEFAULT_VIEW.zoom,
          zoomControl: false,
          scaleControl: false,
          mapDataControl: false,
        });
        n.Event.addListener(map, "click", (e: { coord: { lat: () => number; lng: () => number } }) => {
          const lat = e.coord.lat();
          const lng = e.coord.lng();
          tapped.current = `${lat},${lng}`;
          onPickRef.current(lat, lng);
        });
        st.current = { n, map, pin: null };
        setReady(true);
      })
      .catch(() => {});
    return () => {
      dead = true;
      st.current?.map.destroy();
      st.current = null;
    };
  }, [apiKey]);

  // Naver pins its element to the size it was created at: size it from the box
  useEffect(() => {
    const node = box.current;
    if (!ready || !node) return;
    const fit = () =>
      st.current?.map.setSize(new st.current.n.Size(node.clientWidth, node.clientHeight));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(node);
    return () => ro.disconnect();
  }, [ready]);

  useEffect(() => {
    const s = st.current;
    if (!ready || !s) return;
    s.pin?.setMap(null);
    s.pin = null;
    if (!pos) return;
    const at = new s.n.LatLng(pos.lat, pos.lng);
    s.pin = new s.n.Marker({
      position: at,
      map: s.map,
      clickable: false,
      icon: { content: `<div class="tw-pin-wrap">${PIN}</div>`, anchor: new s.n.Point(0, 0) },
    });
    if (tapped.current === `${pos.lat},${pos.lng}`) return;
    s.map.setCenter(at);
    if (s.map.getZoom() < SPOT_ZOOM) s.map.setZoom(SPOT_ZOOM);
  }, [ready, pos]);

  return (
    <div ref={box} className="relative h-full w-full">
      <div ref={el} className="tw-map absolute inset-0" />
    </div>
  );
}

function LeafletPinMap({
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
        html: PIN,
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
