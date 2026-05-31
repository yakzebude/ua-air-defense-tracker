// Edge Function: air-alerts
// Fetches current air-raid alert state for all Ukrainian oblasts from the open
// alerts.com.ua API (no token required) and returns a normalized JSON list.
// In-memory cached for 60s per function instance.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Map alerts.com.ua oblast id -> ISO-3166-2 code used by our GeoJSON.
// Kyiv City (id 25) has no separate polygon; we render it as a marker overlay,
// so we map it to a synthetic "UA-30" used only by the frontend.
const OBLAST_ISO: Record<number, string> = {
  1: "UA-05",  // Vinnytsia
  2: "UA-07",  // Volyn
  3: "UA-12",  // Dnipropetrovsk
  4: "UA-14",  // Donetsk
  5: "UA-18",  // Zhytomyr
  6: "UA-21",  // Zakarpattia
  7: "UA-23",  // Zaporizhzhia
  8: "UA-26",  // Ivano-Frankivsk
  9: "UA-32",  // Kyiv Oblast
  10: "UA-35", // Kirovohrad
  11: "UA-09", // Luhansk
  12: "UA-46", // Lviv
  13: "UA-48", // Mykolaiv
  14: "UA-51", // Odesa
  15: "UA-53", // Poltava
  16: "UA-56", // Rivne
  17: "UA-59", // Sumy
  18: "UA-61", // Ternopil
  19: "UA-63", // Kharkiv
  20: "UA-65", // Kherson
  21: "UA-68", // Khmelnytskyi
  22: "UA-71", // Cherkasy
  23: "UA-77", // Chernivtsi
  24: "UA-74", // Chernihiv
  25: "UA-30", // Kyiv City (synthetic, marker only)
};

interface OblastAlert {
  id: number;
  iso: string;
  name: string;
  nameEn: string;
  active: boolean;
  changedAt: string;
}

const TTL_MS = 60 * 1000;
let cache: { at: number; payload: unknown } | null = null;

async function loadFromAlertsComUa(): Promise<{
  updatedAt: string;
  source: string;
  oblasts: OblastAlert[];
}> {
  const res = await fetch("https://alerts.com.ua/api/states", {
    headers: { "user-agent": "UA-AirDefense-Tracker/1.0" },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`alerts.com.ua HTTP ${res.status}`);
  const json = await res.json();
  const states = Array.isArray(json?.states) ? json.states : [];

  const oblasts: OblastAlert[] = states
    .map((s: Record<string, unknown>) => {
      const id = Number(s.id);
      const iso = OBLAST_ISO[id];
      if (!iso) return null;
      return {
        id,
        iso,
        name: String(s.name ?? ""),
        nameEn: String(s.name_en ?? ""),
        active: Boolean(s.alert),
        changedAt: String(s.changed ?? new Date().toISOString()),
      };
    })
    .filter((x: OblastAlert | null): x is OblastAlert => x !== null);

  return {
    updatedAt: new Date().toISOString(),
    source: "alerts.com.ua",
    oblasts,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!cache || Date.now() - cache.at > TTL_MS) {
      const payload = await loadFromAlertsComUa();
      cache = { at: Date.now(), payload };
    }
    return new Response(JSON.stringify(cache.payload), {
      headers: { ...corsHeaders, "content-type": "application/json", "cache-control": "public, max-age=30" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Serve stale cache if upstream fails
    if (cache) {
      return new Response(JSON.stringify({ ...(cache.payload as object), stale: true, error: message }), {
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ error: message, oblasts: [] }), {
      status: 200,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }
});
