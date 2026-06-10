// Edge Function: air-alerts
// Live air-raid alert state from alerts.in.ua.
// Endpoint: GET /v1/alerts/active.json  (full alert records — oblast + raion + community level)
// We aggregate that into:
//   - oblasts[]  : 27 rows in fixed ISO order, state "full" | "partial" | "none"
//   - raions[]   : every active raion (or community/city rolled up to its raion)
// Auth: Bearer token (env ALERTS_IN_UA_TOKEN). Cached server-side for 30 s.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SOURCE_URL = "https://api.alerts.in.ua/v1/alerts/active.json";
const ALERTS_TTL = 30 * 1000;

// ISO-3166-2 codes match our GeoJSON.
const ORDER: { iso: string; name: string; nameEn: string }[] = [
  { iso: "UA-43", name: "Автономна Республіка Крим", nameEn: "Crimea" },
  { iso: "UA-07", name: "Волинська область",          nameEn: "Volyn Oblast" },
  { iso: "UA-05", name: "Вінницька область",          nameEn: "Vinnytsia Oblast" },
  { iso: "UA-12", name: "Дніпропетровська область",   nameEn: "Dnipropetrovsk Oblast" },
  { iso: "UA-14", name: "Донецька область",           nameEn: "Donetsk Oblast" },
  { iso: "UA-18", name: "Житомирська область",        nameEn: "Zhytomyr Oblast" },
  { iso: "UA-21", name: "Закарпатська область",       nameEn: "Zakarpattia Oblast" },
  { iso: "UA-23", name: "Запорізька область",         nameEn: "Zaporizhzhia Oblast" },
  { iso: "UA-26", name: "Івано-Франківська область",  nameEn: "Ivano-Frankivsk Oblast" },
  { iso: "UA-30", name: "м. Київ",                    nameEn: "Kyiv City" },
  { iso: "UA-32", name: "Київська область",           nameEn: "Kyiv Oblast" },
  { iso: "UA-35", name: "Кіровоградська область",     nameEn: "Kirovohrad Oblast" },
  { iso: "UA-09", name: "Луганська область",          nameEn: "Luhansk Oblast" },
  { iso: "UA-46", name: "Львівська область",          nameEn: "Lviv Oblast" },
  { iso: "UA-48", name: "Миколаївська область",       nameEn: "Mykolaiv Oblast" },
  { iso: "UA-51", name: "Одеська область",            nameEn: "Odesa Oblast" },
  { iso: "UA-53", name: "Полтавська область",         nameEn: "Poltava Oblast" },
  { iso: "UA-56", name: "Рівненська область",         nameEn: "Rivne Oblast" },
  { iso: "UA-40", name: "м. Севастополь",             nameEn: "Sevastopol" },
  { iso: "UA-59", name: "Сумська область",            nameEn: "Sumy Oblast" },
  { iso: "UA-61", name: "Тернопільська область",      nameEn: "Ternopil Oblast" },
  { iso: "UA-63", name: "Харківська область",         nameEn: "Kharkiv Oblast" },
  { iso: "UA-65", name: "Херсонська область",         nameEn: "Kherson Oblast" },
  { iso: "UA-68", name: "Хмельницька область",        nameEn: "Khmelnytskyi Oblast" },
  { iso: "UA-71", name: "Черкаська область",          nameEn: "Cherkasy Oblast" },
  { iso: "UA-77", name: "Чернівецька область",        nameEn: "Chernivtsi Oblast" },
  { iso: "UA-74", name: "Чернігівська область",       nameEn: "Chernihiv Oblast" },
];

const OBLAST_BY_NAME = new Map(ORDER.map((o) => [o.name, o]));

type State = "none" | "partial" | "full";

interface OblastAlert {
  id: string;
  iso: string;
  name: string;
  nameEn: string;
  active: boolean;
  state: State;
  changedAt: string;
  types: string[];
}

interface RaionAlert {
  id: string;
  oblastIso: string;
  name: string;
  active: boolean;
  changedAt: string;
  types: string[];
}

interface Payload {
  updatedAt: string;
  source: string;
  status: "ok" | "stale" | "unauthorized" | "unavailable";
  oblasts: OblastAlert[];
  raions: RaionAlert[];
  error?: string;
}

interface UpstreamAlert {
  id: number | string;
  location_title?: string;
  location_type?: string;          // "oblast" | "raion" | "hromada" | "city" | "state" ...
  started_at?: string;
  finished_at?: string | null;
  alert_type?: string;             // "air_raid" | "artillery_shelling" | ...
  location_oblast?: string;
  location_raion?: string | null;
}

let cache: { at: number; payload: Payload } | null = null;

function alertTypeToTag(t?: string): string {
  switch (t) {
    case "air_raid":           return "AIR";
    case "artillery_shelling": return "ARTILLERY";
    case "urban_fights":       return "URBAN_FIGHTS";
    case "chemical":           return "CHEMICAL";
    case "nuclear":            return "NUCLEAR";
    default:                   return "INFO";
  }
}

function buildPayload(items: UpstreamAlert[]): Payload {
  const now = new Date().toISOString();

  // Index by oblast iso.
  const oblastState = new Map<string, { state: State; types: Set<string>; since: string }>();
  // Index raions by `${iso}::${normName}`.
  const raionMap = new Map<string, RaionAlert>();

  const norm = (s: string) =>
    s.toLowerCase().replace(/\s*район\s*$/u, "").replace(/['ʼ’`]/g, "").trim();

  for (const a of items) {
    if (a.finished_at) continue;
    const oblastName = a.location_oblast ?? "";
    const ob = OBLAST_BY_NAME.get(oblastName);
    if (!ob) continue;

    const typeTag = alertTypeToTag(a.alert_type);
    const startedAt = a.started_at ?? now;

    if (a.location_type === "oblast" || a.location_type === "state") {
      const prev = oblastState.get(ob.iso);
      const sinceFull = prev?.state === "full" ? prev.since : startedAt;
      const types = new Set(prev?.types ?? []);
      types.add(typeTag);
      oblastState.set(ob.iso, { state: "full", types, since: sinceFull });
    } else {
      // Raion / hromada / city → roll up to raion if available.
      const raionName = a.location_raion?.trim();
      if (raionName) {
        const key = `${ob.iso}::${norm(raionName)}`;
        const existing = raionMap.get(key);
        if (existing) {
          if (!existing.types.includes(typeTag)) existing.types.push(typeTag);
          if (startedAt < existing.changedAt) existing.changedAt = startedAt;
        } else {
          raionMap.set(key, {
            id: key,
            oblastIso: ob.iso,
            name: raionName,
            active: true,
            changedAt: startedAt,
            types: [typeTag],
          });
        }
      }
      // Mark oblast as at-least-partial if it isn't already full.
      const prev = oblastState.get(ob.iso);
      if (!prev || prev.state !== "full") {
        const types = new Set(prev?.types ?? []);
        types.add(typeTag === "AIR" ? "AIR_PARTIAL" : typeTag);
        oblastState.set(ob.iso, {
          state: "partial",
          types,
          since: prev?.since ?? startedAt,
        });
      }
    }
  }

  const oblasts: OblastAlert[] = ORDER.map((o) => {
    const s = oblastState.get(o.iso);
    return {
      id: o.iso,
      iso: o.iso,
      name: o.name,
      nameEn: o.nameEn,
      active: !!s,
      state: s?.state ?? "none",
      changedAt: s?.since ?? now,
      types: s ? Array.from(s.types) : [],
    };
  });

  return {
    updatedAt: now,
    source: "alerts.in.ua",
    status: "ok",
    oblasts,
    raions: Array.from(raionMap.values()),
  };
}

async function loadAlerts(): Promise<Payload> {
  const token = Deno.env.get("ALERTS_IN_UA_TOKEN");
  if (!token) {
    return {
      updatedAt: new Date().toISOString(),
      source: "alerts.in.ua",
      status: "unauthorized",
      oblasts: ORDER.map((o) => ({
        id: o.iso, iso: o.iso, name: o.name, nameEn: o.nameEn,
        active: false, state: "none", changedAt: new Date(0).toISOString(), types: [],
      })),
      raions: [],
      error: "ALERTS_IN_UA_TOKEN not configured",
    };
  }

  const res = await fetch(SOURCE_URL, {
    headers: {
      Authorization: `Bearer ${token}`,
      "user-agent": "ua-airdefense-tracker.org",
      accept: "application/json",
    },
    signal: AbortSignal.timeout(10_000),
  });

  if (res.status === 401 || res.status === 403) {
    const body = await res.text().catch(() => "");
    console.error(`[air-alerts] auth ${res.status}: ${body.slice(0, 200)}`);
    return {
      updatedAt: new Date().toISOString(),
      source: "alerts.in.ua",
      status: "unauthorized",
      oblasts: ORDER.map((o) => ({
        id: o.iso, iso: o.iso, name: o.name, nameEn: o.nameEn,
        active: false, state: "none", changedAt: new Date(0).toISOString(), types: [],
      })),
      raions: [],
      error: `alerts.in.ua HTTP ${res.status}`,
    };
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`alerts.in.ua HTTP ${res.status}: ${body.slice(0, 200)}`);
  }

  const json = (await res.json()) as { alerts?: UpstreamAlert[] };
  return buildPayload(json.alerts ?? []);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!cache || Date.now() - cache.at > ALERTS_TTL) {
      const payload = await loadAlerts();
      cache = { at: Date.now(), payload };
    }
    return new Response(JSON.stringify(cache.payload), {
      headers: {
        ...corsHeaders,
        "content-type": "application/json",
        "cache-control": "public, max-age=30",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[air-alerts] ${message}`);
    if (cache) {
      const stale: Payload = { ...cache.payload, status: "stale", error: message };
      return new Response(JSON.stringify(stale), {
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }
    return new Response(
      JSON.stringify({
        updatedAt: new Date().toISOString(),
        source: "alerts.in.ua",
        status: "unavailable",
        oblasts: [],
        raions: [],
        error: message,
      } satisfies Payload),
      { status: 200, headers: { ...corsHeaders, "content-type": "application/json" } },
    );
  }
});
