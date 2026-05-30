// Edge Function: air-attack-news
// Fetches multiple Ukraine news RSS feeds, filters items related to Russian air
// attacks (missiles, drones, Shahed, air defense, strikes on UA cities) and
// returns a deduplicated JSON list. Cached in-memory for 5 minutes.
// Supports optional ?lang=de|fr|uk translation via Lovable AI Gateway.

import { XMLParser } from "npm:fast-xml-parser@4.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FEEDS: { url: string; source: string }[] = [
  { url: "https://kyivindependent.com/rss/", source: "Kyiv Independent" },
  { url: "https://www.pravda.com.ua/eng/rss/", source: "Ukrainska Pravda" },
  { url: "https://euromaidanpress.com/feed/", source: "Euromaidan Press" },
  { url: "https://www.ukrinform.net/rss/block-lastnews", source: "Ukrinform" },
];

const KEYWORDS = [
  "missile", "missiles", "drone", "drones", "shahed", "ballistic", "kalibr",
  "iskander", "kinzhal", "kh-101", "air raid", "air defense", "air defence",
  "air strike", "airstrike", "attack", "strike", "kyiv", "odesa", "odessa",
  "kharkiv", "lviv", "dnipro", "zaporizhzhia", "mykolaiv", "kherson", "sumy",
];

interface NewsItem {
  id: string;
  title: string;
  url: string;
  source: string;
  publishedAt: string;
}

// Base (English) cache + per-language translation cache
const TTL_MS = 5 * 60 * 1000;
let baseCache: { at: number; items: NewsItem[] } | null = null;
const langCache = new Map<string, { at: number; items: NewsItem[] }>();

const SUPPORTED_LANGS = new Set(["en", "de", "fr", "uk"]);
const LANG_NAMES: Record<string, string> = {
  de: "German",
  fr: "French",
  uk: "Ukrainian",
};

async function sha1(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function matchesKeywords(text: string): boolean {
  const t = text.toLowerCase();
  return KEYWORDS.some((k) => t.includes(k));
}

async function fetchFeed(feedUrl: string, source: string): Promise<NewsItem[]> {
  try {
    const res = await fetch(feedUrl, {
      headers: { "user-agent": "UA-AirDefense-Tracker/1.0 (+news-ticker)" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
    const doc = parser.parse(xml);

    const rssItems = doc?.rss?.channel?.item ?? doc?.channel?.item ?? [];
    const atomEntries = doc?.feed?.entry ?? [];
    const rawItems = Array.isArray(rssItems) ? rssItems : rssItems ? [rssItems] : [];
    const rawAtom = Array.isArray(atomEntries) ? atomEntries : atomEntries ? [atomEntries] : [];

    const items: NewsItem[] = [];

    for (const it of rawItems) {
      const title = (it.title ?? "").toString().trim();
      const link = (typeof it.link === "string" ? it.link : it.link?.["@_href"] ?? "").toString().trim();
      const desc = (it.description ?? "").toString();
      const pub = (it.pubDate ?? it["dc:date"] ?? "").toString();
      if (!title || !link) continue;
      if (!matchesKeywords(title + " " + desc)) continue;
      items.push({
        id: await sha1(link),
        title,
        url: link,
        source,
        publishedAt: pub ? new Date(pub).toISOString() : new Date().toISOString(),
      });
    }

    for (const it of rawAtom) {
      const title = (it.title?.["#text"] ?? it.title ?? "").toString().trim();
      const linkRaw = Array.isArray(it.link) ? it.link[0] : it.link;
      const link = (typeof linkRaw === "string" ? linkRaw : linkRaw?.["@_href"] ?? "").toString().trim();
      const desc = (it.summary?.["#text"] ?? it.summary ?? it.content?.["#text"] ?? it.content ?? "").toString();
      const pub = (it.updated ?? it.published ?? "").toString();
      if (!title || !link) continue;
      if (!matchesKeywords(title + " " + desc)) continue;
      items.push({
        id: await sha1(link),
        title,
        url: link,
        source,
        publishedAt: pub ? new Date(pub).toISOString() : new Date().toISOString(),
      });
    }

    return items;
  } catch (_e) {
    return [];
  }
}

async function loadBase(): Promise<NewsItem[]> {
  if (baseCache && Date.now() - baseCache.at < TTL_MS) return baseCache.items;

  const results = await Promise.all(FEEDS.map((f) => fetchFeed(f.url, f.source)));
  const flat = results.flat();

  const seen = new Set<string>();
  const deduped: NewsItem[] = [];
  for (const it of flat) {
    const key = it.title.toLowerCase().replace(/\s+/g, " ").trim();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(it);
  }

  deduped.sort((a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt));
  const items = deduped.slice(0, 30);
  baseCache = { at: Date.now(), items };
  // Invalidate per-language caches when base refreshes
  langCache.clear();
  return items;
}

// Translate titles in one batched LLM call via Lovable AI Gateway.
async function translateTitles(items: NewsItem[], lang: string): Promise<NewsItem[]> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  const target = LANG_NAMES[lang];
  if (!apiKey || !target || items.length === 0) return items;

  const numbered = items.map((it, i) => `${i + 1}. ${it.title}`).join("\n");
  const prompt = `Translate each news headline to ${target}. Keep proper nouns (cities, names) as-is. Return ONLY a JSON array of strings in the same order, no commentary.\n\n${numbered}`;

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: "You are a professional news translator. Output ONLY a JSON array of translated strings." },
          { role: "user", content: prompt },
        ],
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return items;
    const data = await res.json();
    let content: string = data?.choices?.[0]?.message?.content ?? "";
    // Strip code fences if present
    content = content.replace(/```json|```/g, "").trim();
    const arr = JSON.parse(content);
    if (!Array.isArray(arr)) return items;
    return items.map((it, i) => ({
      ...it,
      title: typeof arr[i] === "string" && arr[i].trim() ? arr[i] : it.title,
    }));
  } catch (_e) {
    return items;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const langRaw = (url.searchParams.get("lang") || "en").toLowerCase().slice(0, 2);
  const lang = SUPPORTED_LANGS.has(langRaw) ? langRaw : "en";

  const base = await loadBase();

  let items = base;
  if (lang !== "en") {
    const cached = langCache.get(lang);
    if (cached && Date.now() - cached.at < TTL_MS) {
      items = cached.items;
    } else {
      items = await translateTitles(base, lang);
      langCache.set(lang, { at: Date.now(), items });
    }
  }

  const payload = { updatedAt: new Date().toISOString(), lang, items };
  return new Response(JSON.stringify(payload), {
    headers: { ...corsHeaders, "content-type": "application/json", "cache-control": "public, max-age=60" },
  });
});
