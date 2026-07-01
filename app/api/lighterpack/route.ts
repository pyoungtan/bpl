import { extractShareId, parseLighterpackHtml } from "@/lib/lighterpack";

// Fetch a public LighterPack share page server-side (avoids the browser's CORS
// restriction) and return its gear list as structured JSON.
export async function POST(request: Request) {
  let body: { url?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }

  const id = extractShareId(body.url ?? "");
  if (!id) {
    return Response.json(
      { error: "LighterPack 공유 링크가 아니에요. (예: lighterpack.com/r/xxxxxx)" },
      { status: 400 },
    );
  }

  try {
    const res = await fetch(`https://lighterpack.com/r/${id}`, {
      headers: { "user-agent": "Mozilla/5.0 (Trailweight import)" },
      cache: "no-store",
    });
    if (!res.ok) {
      return Response.json(
        { error: `목록을 불러오지 못했어요 (${res.status}). 링크를 확인해주세요.` },
        { status: 502 },
      );
    }
    const html = await res.text();
    const categories = parseLighterpackHtml(html);
    if (categories.length === 0) {
      return Response.json(
        { error: "목록을 찾지 못했어요. 링크가 공개(share) 상태인지 확인해주세요." },
        { status: 422 },
      );
    }
    return Response.json({ categories });
  } catch {
    return Response.json({ error: "불러오는 중 오류가 발생했어요." }, { status: 500 });
  }
}
