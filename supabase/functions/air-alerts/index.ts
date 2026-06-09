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

// Official alphabetical order (Ukrainian) of the 27 positions returned by
// the IoT endpoint. ISO-3166-2 codes match our GeoJSON.
const ORDER: { iso: string; name: string; nameEn: string }[] = [
  { iso: "UA-05", name: "Вінницька область",          nameEn: "Vinnytsia Oblast" },
  { iso: "UA-07", name: "Волинська область",          nameEn: "Volyn Oblast" },
  { iso: "UA-12", name: "Дніпропетровська область",   nameEn: "Dnipropetrovsk Oblast" },
  { iso: "UA-14", name: "Донецька область",           nameEn: "Donetsk Oblast" },
  { iso: "UA-18", name: "Житомирська область",        nameEn: "Zhytomyr Oblast" },
  { iso: "UA-21", name: "Закарпатська область",       nameEn: "Zakarpattia Oblast" },
  { iso: "UA-23", name: "Запорізька область",         nameEn: "Zaporizhzhia Oblast" },
  { iso: "UA-26", name: "Івано-Франківська область",  nameEn: "Ivano-Frankivsk Oblast" },
  { iso: "UA-32", name: "Київська область",           nameEn: "Kyiv Oblast" },
  { iso: "UA-35", name: "Кіровоградська область",     nameEn: "Kirovohrad Oblast" },
  { iso: "UA-09", name: "Луганська область",          nameEn: "Luhansk Oblast" },
  { iso: "UA-46", name: "Львівська область",          nameEn: "Lviv Oblast" },
  { iso: "UA-48", name: "Миколаївська область",       nameEn: "Mykolaiv Oblast" },
  { iso: "UA-51", name: "Одеська область",            nameEn: "Odesa Oblast" },
  { iso: "UA-53", name: "Полтавська область",         nameEn: "Poltava Oblast" },
  { iso: "UA-56", name: "Рівненська область",         nameEn: "Rivne Oblast" },
  { iso: "UA-59", name: "Сумська область",            nameEn: "Sumy Oblast" },
  { iso: "UA-61", name: "Тернопільська область",      nameEn: "Ternopil Oblast" },
  { iso: "UA-63", name: "Харківська область",         nameEn: "Kharkiv Oblast" },
  { iso: "UA-65", name: "Херсонська область",         nameEn: "Kherson Oblast" },
  { iso: "UA-68", name: "Хмельницька область",        nameEn: "Khmelnytskyi Oblast" },
  { iso: "UA-71", name: "Черкаська область",          nameEn: "Cherkasy Oblast" },
  { iso: "UA-77", name: "Чернівецька область",        nameEn: "Chernivtsi Oblast" },
  { iso: "UA-74", name: "Чернігівська область",       nameEn: "Chernihiv Oblast" },
  { iso: "UA-43", name: "АР Крим",                    nameEn: "Crimea" },
  { iso: "UA-30", name: "Київ",                       nameEn: "Kyiv City" },
  { iso: "UA-40", name: "Севастополь",                nameEn: "Sevastopol" },
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
