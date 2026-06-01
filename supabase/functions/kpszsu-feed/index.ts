// Edge Function: kpszsu-feed
// Scrapes the public Telegram preview page of the Ukrainian Air Force Command
// channel (@kpszsu) and returns the latest threat messages tagged by type
// (drone / cruise missile / ballistic / glide bomb / all-clear / info).
//
// No auth needed — the t.me/s/<channel> page is publicly rendered HTML.
// Cached in-memory for 60s.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CHANNEL = "kpszsu";
const URL = `https://t.me/s/${CHANNEL}`;
const TTL_MS = 60 * 1000;
const MAX_MESSAGES = 25;

type ThreatTag = "drone" | "cruise" | "ballistic" | "kab" | "fast" | "all_clear" | "info";

interface FeedMessage {
  id: string;
  url: string;
  ts: string;            // ISO timestamp
  text: string;          // plain text (newlines preserved)
  tags: ThreatTag[];     // detected threat types
}

let cache: { at: number; payload: unknown } | null = null;

// Lowercased keyword → tag mapping. Matched case-insensitively against text.
const KEYWORDS: Array<[RegExp, ThreatTag]> = [
  // Drones (Shahed, Geran, UAV)
  [/бпла|шахед|shahed|герань|ударн[іи] дрон/iu, "drone"],
  // Cruise missiles
  [/крилат[іи] ракет|калібр|kalibr|х-101|x-101|х-555|x-555|х-22|x-22|х-32|x-32|х-59|x-59/iu, "cruise"],
  // Ballistic
  [/баліст|іскандер|iskander|кинджал|kinzhal|кн-23|kn-23/iu, "ballistic"],
  // Glide bombs (КАБ)
  [/каб[иі]?\b|кериван[аі] авіабомб|глайдбомб|glide bomb/iu, "kab"],
  // Fast targets — usually missiles, generic
  [/швидкісн[іи] цілі|швидкісна ціль|aerial speed|реактивн[іи]/iu, "fast"],
  // All clear
  [/відбій|all clear/iu, "all_clear"],
];

function detectTags(text: string): ThreatTag[] {
  const found = new Set<ThreatTag>();
  for (const [re, tag] of KEYWORDS) {
    if (re.test(text)) found.add(tag);
  }
  if (found.size === 0) found.add("info");
  return Array.from(found);
}

function decodeHtml(s: string): string {
  return s
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .trim();
}

async function loadFeed(): Promise<{ updatedAt: string; channel: string; messages: FeedMessage[] }> {
  const res = await fetch(URL, {
    headers: { "user-agent": "Mozilla/5.0 (UA-AirDefense-Tracker)" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`t.me HTTP ${res.status}`);
  const html = await res.text();

  // Split into per-message chunks. Each Telegram widget post starts with
  // `tgme_widget_message ` and includes a `data-post="channel/NNN"` attribute.
  const chunks = html.split(/<div class="tgme_widget_message\b/).slice(1);
  const out: FeedMessage[] = [];
  for (const raw of chunks) {
    const postMatch = raw.match(/data-post="([^"]+)"/);
    const timeMatch = raw.match(/<time[^>]*datetime="([^"]+)"/);
    const textMatch = raw.match(/<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>\s*(?:<div class="tgme_widget_message_(?:reply_markup|footer|info|metadata)|<a class="tgme_widget_message)/);
    if (!postMatch || !timeMatch || !textMatch) continue;
    const text = decodeHtml(textMatch[1]);
    if (!text) continue;
    out.push({
      id: postMatch[1],
      url: `https://t.me/${postMatch[1]}`,
      ts: timeMatch[1],
      text,
      tags: detectTags(text),
    });
  }


  // Newest last in the page → sort desc, cap.
  out.sort((a, b) => (a.ts < b.ts ? 1 : -1));
  return {
    updatedAt: new Date().toISOString(),
    channel: CHANNEL,
    messages: out.slice(0, MAX_MESSAGES),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    if (!cache || Date.now() - cache.at > TTL_MS) {
      const payload = await loadFeed();
      cache = { at: Date.now(), payload };
    }
    return new Response(JSON.stringify(cache.payload), {
      headers: { ...corsHeaders, "content-type": "application/json", "cache-control": "public, max-age=30" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (cache) {
      return new Response(
        JSON.stringify({ ...(cache.payload as object), stale: true, error: message }),
        { headers: { ...corsHeaders, "content-type": "application/json" } },
      );
    }
    return new Response(JSON.stringify({ error: message, messages: [] }), {
      status: 200,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }
});
