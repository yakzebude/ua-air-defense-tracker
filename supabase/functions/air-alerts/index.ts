// Edge Function: air-alerts
// Live air-raid alert state from alerts.in.ua IoT endpoint.
// Endpoint: GET /v1/iot/active_air_raid_alerts_by_oblast
// Returns a 27-character string. Each position maps to one oblast in the
// official alphabetical-by-Ukrainian-name order. Characters:
//   N = no alert, A = full air-raid alert, P = partial (some raions only)
// Auth: Bearer token (env ALERTS_IN_UA_TOKEN).
// Cached server-side for 30 s. Best-effort change tracking gives a
// "changedAt" per oblast since the function instance warmed.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SOURCE_URL = "https://api.alerts.in.ua/v1/iot/active_air_raid_alerts_by_oblast.json";
const ALERTS_TTL = 30 * 1000;

// Official order documented at https://devs.alerts.in.ua/ for
// /v1/iot/active_air_raid_alerts_by_oblast.json — 27 positions.
// ISO-3166-2 codes match our GeoJSON.
const ORDER: { iso: string; name: string; nameEn: string }[] = [
  { iso: "UA-43", name: "Автономна Республіка Крим", nameEn: "Crimea" },                   // 1
  { iso: "UA-07", name: "Волинська область",          nameEn: "Volyn Oblast" },             // 2
  { iso: "UA-05", name: "Вінницька область",          nameEn: "Vinnytsia Oblast" },         // 3
  { iso: "UA-12", name: "Дніпропетровська область",   nameEn: "Dnipropetrovsk Oblast" },    // 4
  { iso: "UA-14", name: "Донецька область",           nameEn: "Donetsk Oblast" },           // 5
  { iso: "UA-18", name: "Житомирська область",        nameEn: "Zhytomyr Oblast" },          // 6
  { iso: "UA-21", name: "Закарпатська область",       nameEn: "Zakarpattia Oblast" },       // 7
  { iso: "UA-23", name: "Запорізька область",         nameEn: "Zaporizhzhia Oblast" },      // 8
  { iso: "UA-26", name: "Івано-Франківська область",  nameEn: "Ivano-Frankivsk Oblast" },   // 9
  { iso: "UA-30", name: "м. Київ",                    nameEn: "Kyiv City" },                // 10
  { iso: "UA-32", name: "Київська область",           nameEn: "Kyiv Oblast" },              // 11
  { iso: "UA-35", name: "Кіровоградська область",     nameEn: "Kirovohrad Oblast" },        // 12
  { iso: "UA-09", name: "Луганська область",          nameEn: "Luhansk Oblast" },           // 13
  { iso: "UA-46", name: "Львівська область",          nameEn: "Lviv Oblast" },              // 14
  { iso: "UA-48", name: "Миколаївська область",       nameEn: "Mykolaiv Oblast" },          // 15
  { iso: "UA-51", name: "Одеська область",            nameEn: "Odesa Oblast" },             // 16
  { iso: "UA-53", name: "Полтавська область",         nameEn: "Poltava Oblast" },           // 17
  { iso: "UA-56", name: "Рівненська область",         nameEn: "Rivne Oblast" },             // 18
  { iso: "UA-40", name: "м. Севастополь",             nameEn: "Sevastopol" },               // 19
  { iso: "UA-59", name: "Сумська область",            nameEn: "Sumy Oblast" },              // 20
  { iso: "UA-61", name: "Тернопільська область",      nameEn: "Ternopil Oblast" },          // 21
  { iso: "UA-63", name: "Харківська область",         nameEn: "Kharkiv Oblast" },           // 22
  { iso: "UA-65", name: "Херсонська область",         nameEn: "Kherson Oblast" },           // 23
  { iso: "UA-68", name: "Хмельницька область",        nameEn: "Khmelnytskyi Oblast" },      // 24
  { iso: "UA-71", name: "Черкаська область",          nameEn: "Cherkasy Oblast" },          // 25
  { iso: "UA-77", name: "Чернівецька область",        nameEn: "Chernivtsi Oblast" },        // 26
  { iso: "UA-74", name: "Чернігівська область",       nameEn: "Chernihiv Oblast" },         // 27
];


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

interface Payload {
  updatedAt: string;
  source: string;
  status: "ok" | "stale" | "unauthorized" | "unavailable";
  oblasts: OblastAlert[];
  raions: never[];
  error?: string;
}

// In-memory state, kept across warm invocations.
let cache: { at: number; payload: Payload } | null = null;
const lastState = new Map<string, { state: State; since: string }>();

function charToState(c: string): State {
  if (c === "A") return "full";
  if (c === "P") return "partial";
  return "none";
}

function buildPayload(raw: string): Payload {
  const now = new Date().toISOString();
  const oblasts: OblastAlert[] = ORDER.map((o, idx) => {
    const state = charToState(raw[idx] ?? "N");
    const prev = lastState.get(o.iso);
    if (!prev || prev.state !== state) {
      lastState.set(o.iso, { state, since: now });
    }
    const changedAt = lastState.get(o.iso)!.since;
    return {
      id: o.iso,
      iso: o.iso,
      name: o.name,
      nameEn: o.nameEn,
      active: state !== "none",
      state,
      changedAt,
      types: state === "full" ? ["AIR"] : state === "partial" ? ["AIR_PARTIAL"] : [],
    };
  });
  return {
    updatedAt: now,
    source: "alerts.in.ua",
    status: "ok",
    oblasts,
    raions: [] as never[],
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
      accept: "text/plain",
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

  const raw = (await res.text()).trim();
  // The endpoint can return either a bare string or JSON-quoted ("NNAN...").
  const clean = raw.startsWith('"') ? raw.slice(1, -1) : raw;
  if (clean.length < ORDER.length) {
    throw new Error(`alerts.in.ua payload too short: ${clean.length} chars`);
  }
  return buildPayload(clean);
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
