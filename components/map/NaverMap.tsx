"use client";

import { useEffect, useRef, useState } from "react";
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
  koreaTick,
}: MapViewProps & { apiKey: string }) {
  const el = useRef<HTMLDivElement>(null);
  const st = useRef<{ n: NaverMaps; map: NaverMaps; markers: NaverMaps[] } | null>(null);
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
        n.Event.addListener(map, "zoom_changed", (z: number) => setZoom(z));
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
    const proj = s.map.getProjection();
    const clusters = clusterPoints(points, (p) =>
      proj.fromCoordToOffset(new s.n.LatLng(p.lat, p.lng)),
    );
    s.markers = clusters.map((c) => {
      const single = c.members.length === 1 ? c.members[0] : null;
      const on = single?.key === selected;
      const m = new s.n.Marker({
        position: new s.n.LatLng(c.lat, c.lng),
        map: s.map,
        icon: {
          content: `<div class="tw-pin-wrap">${single ? pinHtml(single, on) : clusterHtml(c)}</div>`,
          anchor: new s.n.Point(0, 0),
        },
        zIndex: on ? 1000 : single ? 0 : 500,
      });
      s.n.Event.addListener(m, "click", () => {
        if (single) {
          onSelectRef.current(single.key);
          return;
        }
        // a merged marker opens up: zoom to its spots
        onSelectRef.current(null);
        const b = new s.n.LatLngBounds(
          new s.n.LatLng(c.members[0].lat, c.members[0].lng),
          new s.n.LatLng(c.members[0].lat, c.members[0].lng),
        );
        for (const p of c.members) b.extend(new s.n.LatLng(p.lat, p.lng));
        s.map.fitBounds(b, {
          top: FIT_PAD.top,
          bottom: FIT_PAD.bottom,
          left: FIT_PAD.side,
          right: FIT_PAD.side,
        });
      });
      return m;
    });
  }, [ready, points, selected, zoom]);

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

  useEffect(() => {
    const s = st.current;
    if (!ready || !s || !koreaTick) return;
    const k = KOREA_VIEW;
    // fit the coast-to-coast width, edge to edge, then centre
    s.map.fitBounds(
      new s.n.LatLngBounds(new s.n.LatLng(k.lat - 0.01, k.west), new s.n.LatLng(k.lat + 0.01, k.east)),
      { top: 0, bottom: 0, left: 0, right: 0 },
    );
    s.map.setCenter(new s.n.LatLng(k.lat, k.lng));
  }, [ready, koreaTick]);

  return <div ref={el} className="tw-map tw-map-tab h-full w-full" />;
}
