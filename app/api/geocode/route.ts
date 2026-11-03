// Place lookups via OpenStreetMap's Nominatim service (keyless). Proxied
// server-side so we can set a descriptive User-Agent (required by Nominatim's
// usage policy) and avoid the browser's CORS limits. Reading request.url opts
// this GET handler into dynamic (uncached) rendering.
//
//   ?q=설악산          → the best match: { lat, lng, label }
//   ?q=설악산&list=1   → candidates for a search box: { results: Place[] }
//   ?lat=..&lng=..     → what's at a point (a pin dropped on the map): Place

const UA = "Trailweight/1.0 (backpacking gear PWA; https://bpl-three-theta.vercel.app)";

interface Hit {
  lat?: string;
  lon?: string;
  name?: string;
  display_name?: string;
  importance?: number;
  address?: Record<string, string>;
}

/** A short name for a hit: its own name, else the nearest named area. */
function shortName(h: Hit): string {
  const a = h.address ?? {};
  return (
    h.name ||
    a.peak ||
    a.village ||
    a.town ||
    a.suburb ||
    a.city_district ||
    a.city ||
    a.county ||
    a.state ||
    (h.display_name ?? "").split(",")[0].trim()
  );
}

async function nominatim(path: string): Promise<Response | unknown> {
  const res = await fetch(`https://nominatim.openstreetmap.org/${path}`, {
    headers: { "user-agent": UA, "accept-language": "ko,en" },
    cache: "no-store",
  });
  if (!res.ok) {
    return Response.json({ error: `위치를 불러오지 못했어요 (${res.status}).` }, { status: 502 });
  }
  return res.json();
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  try {
    const lat = Number(params.get("lat"));
    const lng = Number(params.get("lng"));
    if (params.has("lat") && Number.isFinite(lat) && Number.isFinite(lng)) {
      const data = await nominatim(
        `reverse?format=jsonv2&zoom=14&addressdetails=1&lat=${lat}&lon=${lng}`,
      );
      if (data instanceof Response) return data;
      const h = data as Hit & { error?: string };
      return Response.json({
        lat,
        lng,
        name: h.error ? "" : shortName(h),
        label: h.display_name ?? "",
      });
    }

    const q = params.get("q")?.trim();
    if (!q) {
      return Response.json({ error: "장소를 입력해주세요." }, { status: 400 });
    }
    const data = await nominatim(
      `search?format=jsonv2&limit=8&addressdetails=1&q=${encodeURIComponent(q)}`,
    );
    if (data instanceof Response) return data;
    const hits = (Array.isArray(data) ? data : []) as Hit[];
    // The first hit is often a namesake (a restaurant called "설악산" abroad,
    // a small peak sharing a national park's name): rank by importance.
    const ranked = hits
      .filter((h) => h.lat && h.lon)
      .sort((a, b) => (b.importance ?? 0) - (a.importance ?? 0));

    if (params.get("list")) {
      return Response.json({
        results: ranked.slice(0, 6).map((h) => ({
          lat: Number(h.lat),
          lng: Number(h.lon),
          name: shortName(h),
          label: h.display_name ?? "",
        })),
      });
    }
    const hit = ranked[0];
    if (!hit) {
      return Response.json({ error: "위치를 찾지 못했어요." }, { status: 404 });
    }
    return Response.json({
      lat: Number(hit.lat),
      lng: Number(hit.lon),
      label: hit.display_name ?? q,
    });
  } catch {
    return Response.json({ error: "위치를 찾는 중 오류가 발생했어요." }, { status: 500 });
  }
}
