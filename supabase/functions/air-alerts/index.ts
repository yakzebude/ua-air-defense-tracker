// Edge Function: air-alerts
// Fetches current air-raid alert state from the public alerts.com.ua endpoint
// (https://alerts.com.ua/api/states). No auth required, updates ~every minute.
// Returns normalized JSON: oblasts (mapped to ISO-3166-2 UA-XX). Cached 30s.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SOURCE_URL = "https://alerts.com.ua/api/states";

// alerts.com.ua state id -> ISO-3166-2 code used by our GeoJSON.
const ID_TO_ISO: Record<number, string> = {
  1: "UA-05", 2: "UA-07", 3: "UA-12", 4: "UA-14", 5: "UA-18",
  6: "UA-21", 7: "UA-23", 8: "UA-26", 9: "UA-32", 10: "UA-35",
  11: "UA-09", 12: "UA-46", 13: "UA-48", 14: "UA-51", 15: "UA-53",
  16: "UA-56", 17: "UA-59", 18: "UA-61", 19: "UA-63", 20: "UA-65",
  21: "UA-68", 22: "UA-71", 23: "UA-77", 24: "UA-74", 25: "UA-30",
};

const ISO_TO_EN: Record<string, string> = {
  "UA-05": "Vinnytsia Oblast", "UA-07": "Volyn Oblast", "UA-12": "Dnipropetrovsk Oblast",
  "UA-14": "Donetsk Oblast", "UA-18": "Zhytomyr Oblast", "UA-21": "Zakarpattia Oblast",
  "UA-23": "Zaporizhzhia Oblast", "UA-26": "Ivano-Frankivsk Oblast", "UA-32": "Kyiv Oblast",
  "UA-35": "Kirovohrad Oblast", "UA-09": "Luhansk Oblast", "UA-46": "Lviv Oblast",
  "UA-48": "Mykolaiv Oblast", "UA-51": "Odesa Oblast", "UA-53": "Poltava Oblast",
  "UA-56": "Rivne Oblast", "UA-59": "Sumy Oblast", "UA-61": "Ternopil Oblast",
  "UA-63": "Kharkiv Oblast", "UA-65": "Kherson Oblast", "UA-68": "Khmelnytskyi Oblast",
  "UA-71": "Cherkasy Oblast", "UA-77": "Chernivtsi Oblast", "UA-74": "Chernihiv Oblast",
  "UA-30": "Kyiv City",
};

interface OblastAlert {
  id: string;
  iso: string;
  name: string;
  nameEn: string;
  active: boolean;
  changedAt: string;
  types: string[];
}

interface UpstreamState {
  id: number;
  name: string;
  name_en: string;
  alert: boolean;
  changed: string;
}

const ALERTS_TTL = 30 * 1000;
let cache: { at: number; payload: unknown } | null = null;

async function loadAlerts() {
  const res = await fetch(SOURCE_URL, {
    headers: { "user-agent": "ua-airdefense-tracker.org (contact via site)" },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    throw new Error(`alerts.com.ua HTTP ${res.status}`);
  }
  const json = await res.json() as { states: UpstreamState[]; last_update?: string };

  const oblasts: OblastAlert[] = [];
  for (const s of json.states ?? []) {
    const iso = ID_TO_ISO[s.id];
    if (!iso) continue;
    oblasts.push({
      id: String(s.id),
      iso,
      name: s.name,
      nameEn: ISO_TO_EN[iso] ?? s.name_en,
      active: !!s.alert,
      changedAt: s.changed ?? new Date(0).toISOString(),
      types: s.alert ? ["AIR"] : [],
    });
  }

  return {
    updatedAt: json.last_update ?? new Date().toISOString(),
    source: "alerts.com.ua",
    oblasts,
    raions: [] as never[],
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!cache || Date.now() - cache.at > ALERTS_TTL) {
      const payload = await loadAlerts();
      cache = { at: Date.now(), payload };
    }
    return new Response(JSON.stringify(cache.payload), {
      headers: { ...corsHeaders, "content-type": "application/json", "cache-control": "public, max-age=30" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[air-alerts] ${message}`);
    if (cache) {
      return new Response(
        JSON.stringify({ ...(cache.payload as object), stale: true, error: message }),
        { headers: { ...corsHeaders, "content-type": "application/json" } },
      );
    }
    return new Response(JSON.stringify({ error: message, oblasts: [], raions: [] }), {
      status: 200,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }
});
