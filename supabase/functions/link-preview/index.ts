// キメ友SNS: 投稿に貼られたURLの「タイトル・説明・画像」を取ってくる Edge Function
// ログイン中のメンバーだけが使える（JWT 検証あり）。
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const cache = new Map<string, { at: number; data: unknown }>();

// 内部ネットワークなど、外に見せてはいけない宛先は取りに行かない
function isSafeUrl(raw: string): URL | null {
  let u: URL;
  try { u = new URL(raw); } catch { return null; }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  if (u.port && u.port !== "80" && u.port !== "443") return null;
  const h = u.hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal") || !h.includes(".")) return null;
  if (/^\[/.test(h) || /^[0-9.]+$/.test(h)) return null; // IP アドレス直書きは不可
  if (h.endsWith(".supabase.co") || h.endsWith(".supabase.in")) return null;
  return u;
}

function pick(html: string, patterns: RegExp[]): string {
  for (const p of patterns) {
    const m = html.match(p);
    if (m?.[1]) return decode(m[1].trim());
  }
  return "";
}

function decode(s: string): string {
  return s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n));
}

function meta(name: string): RegExp[] {
  return [
    new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]+content=["']([^"']*)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${name}["']`, "i"),
  ];
}

async function fetchPage(start: URL): Promise<{ url: URL; html: string } | null> {
  let url = start;
  for (let i = 0; i < 4; i++) {
    const res = await fetch(url, {
      redirect: "manual",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; KimetomoLinkPreview/1.0)", "Accept": "text/html" },
      signal: AbortSignal.timeout(5000),
    });
    if (res.status >= 300 && res.status < 400) {
      const next = res.headers.get("location");
      const safe = next ? isSafeUrl(new URL(next, url).href) : null;
      if (!safe) return null;
      url = safe;
      continue;
    }
    if (!res.ok || !(res.headers.get("content-type") ?? "").includes("text/html")) return null;
    const reader = res.body?.getReader();
    if (!reader) return null;
    let html = "";
    const dec = new TextDecoder();
    while (html.length < 300_000) {
      const { done, value } = await reader.read();
      if (done) break;
      html += dec.decode(value, { stream: true });
      if (/<\/head>/i.test(html)) break;
    }
    reader.cancel().catch(() => {});
    return { url, html };
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { ...CORS, "Content-Type": "application/json" } });

  let raw = "";
  try { raw = String((await req.json())?.url ?? ""); } catch { return json({ error: "bad request" }, 400); }
  const target = isSafeUrl(raw);
  if (!target) return json({ error: "unsupported url" }, 400);

  const hit = cache.get(target.href);
  if (hit && Date.now() - hit.at < 6 * 3600_000) return json(hit.data);

  try {
    const page = await fetchPage(target);
    if (!page) return json({ error: "no preview" }, 404);
    const { html, url } = page;
    const title = pick(html, [...meta("og:title"), ...meta("twitter:title"), /<title[^>]*>([^<]*)<\/title>/i]).slice(0, 120);
    const description = pick(html, [...meta("og:description"), ...meta("twitter:description"), ...meta("description")]).slice(0, 200);
    let image = pick(html, [...meta("og:image"), ...meta("twitter:image")]);
    if (image) {
      try { image = new URL(image, url).href; } catch { image = ""; }
      if (!image.startsWith("https://")) image = "";
    }
    const site = pick(html, meta("og:site_name")) || url.hostname.replace(/^www\./, "");
    if (!title) return json({ error: "no preview" }, 404);
    const data = { url: url.href, title, description, image, site };
    cache.set(target.href, { at: Date.now(), data });
    if (cache.size > 500) cache.delete(cache.keys().next().value!);
    return json(data);
  } catch {
    return json({ error: "fetch failed" }, 502);
  }
});
