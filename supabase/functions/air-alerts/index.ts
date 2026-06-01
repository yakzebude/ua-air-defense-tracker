// Edge Function: air-alerts
// Fetches current air-raid alert state from the official alerts.in.ua API.
// Docs: https://devs.alerts.in.ua/  —  endpoint /v1/alerts/active.json
// Auth: Bearer token (env ALERTS_IN_UA_TOKEN). Upstream updates ~every 60s.
// Returns normalized JSON: oblasts (mapped to ISO-3166-2 UA-XX). Cached 30s.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SOURCE_URL = "https://api.alerts.in.ua/v1/alerts/active.json";

// alerts.in.ua location_uid (string) -> ISO-3166-2 used by our GeoJSON.
// uids are the official KOATUU-derived region ids documented by alerts.in.ua.
const UID_TO_ISO: Record<string, string> = {
  "3": "UA-71",  // Cherkasy
  "4": "UA-74",  // Chernihiv
  "5": "UA-77",  // Chernivtsi
  "6": "UA-12",  // Dnipropetrovsk
  "7": "UA-14",  // Donetsk
  "8": "UA-26",  // Ivano-Frankivsk
  "9": "UA-63",  // Kharkiv
  "10": "UA-65", // Kherson
  "11": "UA-68", // Khmelnytskyi
  "12": "UA-35", // Kirovohrad
  "13": "UA-32", // Kyiv Oblast
  "14": "UA-09", // Luhansk
  "15": "UA-46", // Lviv
  "16": "UA-48", // Mykolaiv
  "17": "UA-51", // Odesa
  "18": "UA-53", // Poltava
  "19": "UA-56", // Rivne
  "20": "UA-59", // Sumy
  "21": "UA-61", // Ternopil
  "22": "UA-05", // Vinnytsia
  "23": "UA-07", // Volyn
  "24": "UA-21", // Zakarpattia
  "25": "UA-23", // Zaporizhzhia
  "26": "UA-18", // Zhytomyr
  "27": "UA-43", // Crimea
  "28": "UA-40", // Sevastopol
  "29": "UA-30", // Kyiv City
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
  "UA-30": "Kyiv City", "UA-43": "Crimea", "UA-40": "Sevastopol",
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

interface UpstreamAlert {
  id: number;
  location_uid: string;
  location_title: string;
  location_title_en?: string;
  location_type: string; // "oblast" | "raion" | "hromada" | "city" | ...
  started_at: string;
  finished_at: string | null;
  alert_type: string; // "air_raid" | "artillery_shelling" | ...
}

const ALERTS_TTL = 30 * 1000;
let cache: { at: number; payload: unknown } | null = null;

async function loadAlerts() {
  const token = Deno.env.get("ALERTS_IN_UA_TOKEN");
  if (!token) throw new Error("ALERTS_IN_UA_TOKEN not configured");

  const res = await fetch(SOURCE_URL, {
    headers: {
      Authorization: `Bearer ${token}`,
      "user-agent": "ua-airdefense-tracker.org",
    },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`alerts.in.ua HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = await res.json() as {
    alerts: UpstreamAlert[];
    meta?: { last_updated_at?: string };
  };

  // Reduce active alerts down to one record per oblast. An oblast counts as
  // active if it has an oblast-level air_raid alert OR any sub-region (raion /
  // hromada / city) within it has an active air_raid alert.
  const activeByIso = new Map<string, { changedAt: string; types: Set<string>; name: string }>();

  for (const a of json.alerts ?? []) {
    if (a.finished_at) continue; // only active
    const iso = UID_TO_ISO[String(a.location_uid)];
    // For sub-region alerts, location_uid is the sub-region's uid, not the oblast's.
    // The API also returns oblast-level alerts separately, so this still surfaces
    // every active oblast — sub-region-only activity is intentionally not aggregated
    // here to keep parity with the choropleth, but we extend with oblast_uid below.
    const oblastUid = (a as unknown as { oblast_uid?: string }).oblast_uid;
    const fallbackIso = oblastUid ? UID_TO_ISO[String(oblastUid)] : undefined;
    const targetIso = iso ?? fallbackIso;
    if (!targetIso) continue;

    const existing = activeByIso.get(targetIso);
    if (existing) {
      existing.types.add(a.alert_type);
      if (a.started_at > existing.changedAt) existing.changedAt = a.started_at;
    } else {
      activeByIso.set(targetIso, {
        changedAt: a.started_at,
        types: new Set([a.alert_type]),
        name: a.location_title,
      });
    }
  }

  const oblasts: OblastAlert[] = Object.keys(ISO_TO_EN).map((iso) => {
    const hit = activeByIso.get(iso);
    return {
      id: iso,
      iso,
      name: hit?.name ?? ISO_TO_EN[iso],
      nameEn: ISO_TO_EN[iso],
      active: !!hit,
      changedAt: hit?.changedAt ?? new Date(0).toISOString(),
      types: hit ? Array.from(hit.types).map((t) => t.toUpperCase()) : [],
    };
  });

  return {
    updatedAt: json.meta?.last_updated_at ?? new Date().toISOString(),
    source: "alerts.in.ua",
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
