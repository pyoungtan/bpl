"use client";

import { useEffect, useRef, useState } from "react";
import { DEFAULT_VIEW, FIT_MAX_ZOOM, FIT_PAD, pinHtml, type MapViewProps } from "./types";

/* The Naver Maps JS API (v3) has no published types; only the handful of
   calls below are used. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type NaverMaps = any;

declare global {
  interface Window {
    naver?: { maps?: NaverMaps };
  }
}

let loading: Promise<NaverMaps> | null = null;
function loadNaver(key: string): Promise<NaverMaps> {
  if (window.naver?.maps) return Promise.resolve(window.naver.maps);
  loading ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(key)}`;
    s.async = true;
    s.onload = () => (window.naver?.maps ? resolve(window.naver.maps) : reject(new Error("naver")));
    s.onerror = () => {
      loading = null;
      reject(new Error("naver"));
    };
    document.head.append(s);
  });
  return loading;
}

/** Naver Maps (used when NEXT_PUBLIC_NAVER_MAP_KEY is set). Same props and
 *  behaviour as the Leaflet map. */
export function NaverMap({
  apiKey,
  points,
  selected,
  onSelect,
  active,
  fitTick,
}: MapViewProps & { apiKey: string }) {
  const el = useRef<HTMLDivElement>(null);
  const st = useRef<{ n: NaverMaps; map: NaverMaps; markers: NaverMaps[] } | null>(null);
  const [ready, setReady] = useState(false);
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);
  const fitted = useRef<string | null>(null);

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
          logoControlOptions: { position: n.Position.BOTTOM_LEFT },
        });
        n.Event.addListener(map, "click", () => onSelectRef.current(null));
        st.current = { n, map, markers: [] };
        setReady(true);
      })
      .catch(() => {});
    return () => {
      dead = true;
      st.current?.map.destroy();
      st.current = null;
    };
  }, [apiKey]);

  useEffect(() => {
    const node = el.current;
    if (!ready || !node) return;
    const ro = new ResizeObserver(() =>
      st.current?.map.setSize(new st.current.n.Size(node.clientWidth, node.clientHeight)),
    );
    ro.observe(node);
    return () => ro.disconnect();
  }, [ready]);

  useEffect(() => {
    const s = st.current;
    if (!ready || !s) return;
    for (const m of s.markers) m.setMap(null);
    s.markers = points.map((p) => {
      const on = p.key === selected;
      const m = new s.n.Marker({
        position: new s.n.LatLng(p.lat, p.lng),
        map: s.map,
        icon: { content: `<div class="tw-pin-wrap">${pinHtml(p, on)}</div>`, anchor: new s.n.Point(0, 0) },
        zIndex: on ? 1000 : 0,
      });
      s.n.Event.addListener(m, "click", () => onSelectRef.current(p.key));
      return m;
    });
  }, [ready, points, selected]);

  const sig = `${points.map((p) => p.key).join("|")}#${fitTick}`;
  useEffect(() => {
    const s = st.current;
    const node = el.current;
    if (!ready || !s || !node || !active) return;
    s.map.setSize(new s.n.Size(node.clientWidth, node.clientHeight));
    if (fitted.current === sig) return;
    fitted.current = sig;
    if (points.length === 0) return;
    const b = new s.n.LatLngBounds(
      new s.n.LatLng(points[0].lat, points[0].lng),
      new s.n.LatLng(points[0].lat, points[0].lng),
    );
    for (const p of points) b.extend(new s.n.LatLng(p.lat, p.lng));
    s.map.fitBounds(b, {
      top: FIT_PAD.top,
      bottom: FIT_PAD.bottom,
      left: FIT_PAD.side,
      right: FIT_PAD.side,
    });
    if (s.map.getZoom() > FIT_MAX_ZOOM) s.map.setZoom(FIT_MAX_ZOOM);
    // points is read through sig
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, active, sig]);

  return <div ref={el} className="tw-map h-full w-full" />;
}
