// Turn a free-text place name into coordinates via OpenStreetMap's Nominatim
// service (keyless). Proxied server-side so we can set a descriptive User-Agent
// (required by Nominatim's usage policy) and avoid the browser's CORS limits.
// Reading request.url opts this GET handler into dynamic (uncached) rendering.
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.trim();
  if (!q) {
    return Response.json({ error: "장소를 입력해주세요." }, { status: 400 });
  }

  try {
    const url =
      "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&addressdetails=0&q=" +
      encodeURIComponent(q);
    const res = await fetch(url, {
      headers: {
        "user-agent":
          "Trailweight/1.0 (backpacking gear PWA; https://bpl-three-theta.vercel.app)",
        "accept-language": "ko,en",
      },
      cache: "no-store",
    });
    if (!res.ok) {
      return Response.json(
        { error: `위치를 불러오지 못했어요 (${res.status}).` },
        { status: 502 },
      );
    }
    const hits = (await res.json()) as
      | { lat?: string; lon?: string; display_name?: string }[]
      | null;
    const hit = Array.isArray(hits) ? hits[0] : null;
    if (!hit?.lat || !hit?.lon) {
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
