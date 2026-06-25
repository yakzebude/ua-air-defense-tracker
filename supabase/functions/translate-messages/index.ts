// Translate Telegram (kpszsu) messages from Ukrainian into a target language
// using the Lovable AI Gateway. Stateless, with a short in-memory cache.
//
// POST body: { lang: "en" | "de" | "fr", items: [{ id: string, text: string }] }
// Response:  { lang, translations: { [id]: string } }

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const LANG_NAMES: Record<string, string> = {
  en: "English",
  de: "German",
  fr: "French",
};

// id|lang -> { text, ts }
const cache = new Map<string, { text: string; ts: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000;

interface InItem { id: string; text: string }

async function translateBatch(items: InItem[], lang: string): Promise<Record<string, string>> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) throw new Error("LOVABLE_API_KEY missing");

  const langName = LANG_NAMES[lang] ?? "English";
  const numbered = items.map((it, i) => `[${i}] ${it.text}`).join("\n---\n");

  const system =
    `You translate short Ukrainian air-defense / military status messages into ${langName}. ` +
    `Keep emojis, hashtags, oblast names, and numbers intact. Preserve line breaks. ` +
    `Do NOT add commentary. Output ONLY a JSON array of objects {"i": <index>, "t": "<translation>"} ` +
    `in the same order as input. No prose around the JSON.`;

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: system },
        { role: "user", content: numbered },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`gateway ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  const content: string = data?.choices?.[0]?.message?.content ?? "";
  // Extract JSON array from the model output.
  const m = content.match(/\[[\s\S]*\]/);
  if (!m) throw new Error("no JSON array in model output");
  let arr: Array<{ i: number; t: string }> = [];
  try {
    arr = JSON.parse(m[0]);
  } catch {
    throw new Error("invalid JSON from model");
  }
  const out: Record<string, string> = {};
  for (const entry of arr) {
    const src = items[entry.i];
    if (src && typeof entry.t === "string") out[src.id] = entry.t.trim();
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: CORS });
  }

  try {
    const body = await req.json();
    const lang: string = body?.lang;
    const items: InItem[] = Array.isArray(body?.items) ? body.items : [];
    if (!LANG_NAMES[lang]) {
      return new Response(JSON.stringify({ error: "invalid lang" }), {
        status: 400,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }
    // Input size limits — this endpoint is public, so unbounded payloads
    // would let any caller drive unlimited AI gateway requests.
    const MAX_ITEMS = 50;
    const MAX_TEXT_LEN = 2000;
    const MAX_ID_LEN = 200;
    if (items.length > MAX_ITEMS) {
      return new Response(
        JSON.stringify({ error: `too many items (max ${MAX_ITEMS})` }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } },
      );
    }
    for (const it of items) {
      if (
        !it ||
        typeof it.id !== "string" ||
        typeof it.text !== "string" ||
        it.id.length > MAX_ID_LEN ||
        it.text.length > MAX_TEXT_LEN
      ) {
        return new Response(
          JSON.stringify({ error: "invalid item (check id/text types and lengths)" }),
          { status: 400, headers: { ...CORS, "Content-Type": "application/json" } },
        );
      }
    }
    if (items.length === 0) {
      return new Response(JSON.stringify({ lang, translations: {} }), {
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // Cache hits first
    const translations: Record<string, string> = {};
    const todo: InItem[] = [];
    const now = Date.now();
    for (const it of items) {
      const k = `${lang}|${it.id}`;
      const hit = cache.get(k);
      if (hit && now - hit.ts < CACHE_TTL) {
        translations[it.id] = hit.text;
      } else {
        todo.push(it);
      }
    }

    if (todo.length) {
      try {
        // Chunk to avoid huge prompts (max ~15 per batch).
        for (let i = 0; i < todo.length; i += 15) {
          const chunk = todo.slice(i, i + 15);
          const fresh = await translateBatch(chunk, lang);
          for (const [id, text] of Object.entries(fresh)) {
            translations[id] = text;
            cache.set(`${lang}|${id}`, { text, ts: now });
          }
        }
      } catch (e) {
        console.error("translateBatch failed:", e);
        // Partial result is still useful — return what we have plus error flag.
        return new Response(
          JSON.stringify({ lang, translations, error: String((e as Error).message ?? e) }),
          { headers: { ...CORS, "Content-Type": "application/json" } },
        );
      }
    }

    return new Response(JSON.stringify({ lang, translations }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message ?? e) }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
