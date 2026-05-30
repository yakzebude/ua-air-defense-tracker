// Edge Function: air-attack-news
// Fetches multiple Ukraine news RSS feeds, filters items related to Russian air
// attacks (missiles, drones, Shahed, air defense, strikes on UA cities) and
// returns a deduplicated JSON list. Cached in-memory for 5 minutes.

import { XMLParser } from "npm:fast-xml-parser@4.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Feeds — easily extendable. ukr.net has no stable public feed, so we use
// multiple English-language Ukrainian / Ukraine-focused sources.
const FEEDS: { url: string; source: string }[] = [
  { url: "https://kyivindependent.com/rss/", source: "Kyiv Independent" },
  { url: "https://www.pravda.com.ua/eng/rss/", source: "Ukrainska Pravda" },
  { url: "https://euromaidanpress.com/feed/", source: "Euromaidan Press" },
  { url: "https://www.ukrinform.net/rss/block-lastnews", source: "Ukrinform" },
];

// Keywords (lower-case). An item matches if title+description contain any.
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

// In-memory cache (per function instance)
let cache: { at: number; payload: { updatedAt: string; items: NewsItem[] } } | null = null;
const TTL_MS = 5 * 60 * 1000;

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

    // Support RSS 2.0 and Atom
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Return cached payload if fresh
  if (cache && Date.now() - cache.at < TTL_MS) {
    return new Response(JSON.stringify(cache.payload), {
      headers: { ...corsHeaders, "content-type": "application/json", "cache-control": "public, max-age=60" },
    });
  }

  const results = await Promise.all(FEEDS.map((f) => fetchFeed(f.url, f.source)));
  const flat = results.flat();

  // Dedupe by normalized title
  const seen = new Set<string>();
  const deduped: NewsItem[] = [];
  for (const it of flat) {
    const key = it.title.toLowerCase().replace(/\s+/g, " ").trim();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(it);
  }

  // Sort newest first, cap to 30
  deduped.sort((a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt));
  const items = deduped.slice(0, 30);

  const payload = { updatedAt: new Date().toISOString(), items };
  cache = { at: Date.now(), payload };

  return new Response(JSON.stringify(payload), {
    headers: { ...corsHeaders, "content-type": "application/json", "cache-control": "public, max-age=60" },
  });
});
