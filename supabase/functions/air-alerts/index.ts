// Edge Function: air-alerts
// Fetches current air-raid alert state from the official ukrainealarm.com API
// (https://api.ukrainealarm.com/swagger/index.html). Requires bearer token
// stored as UKRAINEALARM_API_TOKEN secret.
//
// Returns normalized JSON: oblasts (mapped to ISO-3166-2 UA-XX) plus raions
// (rayons / districts) belonging to those oblasts. Cached per-instance.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TOKEN = Deno.env.get("UKRAINEALARM_API_TOKEN") ?? "";
const BASE = "https://api.ukrainealarm.com";

// Map Ukrainian oblast names (as returned by ukrainealarm.com /api/v3/regions)
// to ISO-3166-2 codes used by our GeoJSON. Kyiv City uses synthetic UA-30
// (marker overlay, no polygon in GeoJSON).
const NAME_TO_ISO: Record<string, string> = {
  "Вінницька область": "UA-05",
  "Волинська область": "UA-07",
  "Дніпропетровська область": "UA-12",
  "Донецька область": "UA-14",
  "Житомирська область": "UA-18",
  "Закарпатська область": "UA-21",
  "Запорізька область": "UA-23",
  "Івано-Франківська область": "UA-26",
  "Київська область": "UA-32",
  "Кіровоградська область": "UA-35",
  "Луганська область": "UA-09",
  "Львівська область": "UA-46",
  "Миколаївська область": "UA-48",
  "Одеська область": "UA-51",
  "Полтавська область": "UA-53",
  "Рівненська область": "UA-56",
  "Сумська область": "UA-59",
  "Тернопільська область": "UA-61",
  "Харківська область": "UA-63",
  "Херсонська область": "UA-65",
  "Хмельницька область": "UA-68",
  "Черкаська область": "UA-71",
  "Чернівецька область": "UA-77",
  "Чернігівська область": "UA-74",
  "Автономна Республіка Крим": "UA-43",
  "Севастополь": "UA-40",
  "м. Київ": "UA-30",
  "Київ": "UA-30",
};

interface OblastAlert {
  id: string;          // ukrainealarm regionId
  iso: string;         // ISO-3166-2
  name: string;        // Ukrainian
  nameEn: string;      // English (derived)
  active: boolean;
  changedAt: string;   // ISO timestamp
  types: string[];     // alert types (AIR, ARTILLERY, URBAN_FIGHTS, CHEMICAL, NUCLEAR, INFO)
}

interface RaionAlert {
  id: string;
  oblastIso: string;
  name: string;
  active: boolean;
  changedAt: string;
  types: string[];
}


// English names derived from ISO for tooltip display.
const ISO_TO_EN: Record<string, string> = {
  "UA-05": "Vinnytsia Oblast",
  "UA-07": "Volyn Oblast",
  "UA-12": "Dnipropetrovsk Oblast",
  "UA-14": "Donetsk Oblast",
  "UA-18": "Zhytomyr Oblast",
  "UA-21": "Zakarpattia Oblast",
  "UA-23": "Zaporizhzhia Oblast",
  "UA-26": "Ivano-Frankivsk Oblast",
  "UA-32": "Kyiv Oblast",
  "UA-35": "Kirovohrad Oblast",
  "UA-09": "Luhansk Oblast",
  "UA-46": "Lviv Oblast",
  "UA-48": "Mykolaiv Oblast",
  "UA-51": "Odesa Oblast",
  "UA-53": "Poltava Oblast",
  "UA-56": "Rivne Oblast",
  "UA-59": "Sumy Oblast",
  "UA-61": "Ternopil Oblast",
  "UA-63": "Kharkiv Oblast",
  "UA-65": "Kherson Oblast",
  "UA-68": "Khmelnytskyi Oblast",
  "UA-71": "Cherkasy Oblast",
  "UA-77": "Chernivtsi Oblast",
  "UA-74": "Chernihiv Oblast",
  "UA-43": "Crimea",
  "UA-40": "Sevastopol",
  "UA-30": "Kyiv City",
};

// Regions tree cache (changes rarely; refresh every hour).
interface RegionMeta {
  id: string;
  name: string;
  type: string;            // "State" | "District" | "Community" | ...
  parentId: string | null;
}
let regionsCache: { at: number; map: Map<string, RegionMeta> } | null = null;
const REGIONS_TTL = 60 * 60 * 1000;

async function loadRegions(): Promise<Map<string, RegionMeta>> {
  if (regionsCache && Date.now() - regionsCache.at < REGIONS_TTL) {
    return regionsCache.map;
  }
  const res = await fetch(`${BASE}/api/v3/regions`, {
    headers: { Authorization: TOKEN },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`ukrainealarm /regions HTTP ${res.status}`);
  const json = await res.json();
  // Response shape: { states: [{ regionId, regionName, regionType, regionChildIds: [{regionId,...}] }] }
  const map = new Map<string, RegionMeta>();
  const walk = (node: Record<string, unknown>, parentId: string | null) => {
    const id = String(node.regionId ?? "");
    if (!id) return;
    map.set(id, {
      id,
      name: String(node.regionName ?? ""),
      type: String(node.regionType ?? ""),
      parentId,
    });
    const children = (node.regionChildIds ?? []) as Record<string, unknown>[];
    if (Array.isArray(children)) {
      for (const c of children) walk(c, id);
    }
  };
  const states = (json?.states ?? []) as Record<string, unknown>[];
  for (const s of states) walk(s, null);
  regionsCache = { at: Date.now(), map };
  return map;
}

// Alerts cache (60s).
const ALERTS_TTL = 60 * 1000;
let alertsCache: { at: number; payload: unknown } | null = null;

interface AlertEntry {
  regionId: string;
  regionName?: string;
  regionType?: string;
  activeAlerts?: Array<{ type?: string; lastUpdate?: string }>;
  lastUpdate?: string;
}

async function loadAlerts() {
  const regions = await loadRegions();

  const res = await fetch(`${BASE}/api/v3/alerts`, {
    headers: { Authorization: TOKEN },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`ukrainealarm /alerts HTTP ${res.status}`);
  const alerts = (await res.json()) as AlertEntry[];

  // Build set of region IDs that currently have an AIR alert.
  const activeMap = new Map<string, { since: string }>();
  for (const a of alerts) {
    const id = String(a.regionId ?? "");
    if (!id) continue;
    const isAir =
      !a.activeAlerts ||
      a.activeAlerts.length === 0 ||
      a.activeAlerts.some((x) => !x.type || x.type === "AIR" || x.type === "UNKNOWN");
    if (!isAir) continue;
    const since =
      a.activeAlerts?.find((x) => x.lastUpdate)?.lastUpdate ??
      a.lastUpdate ??
      new Date().toISOString();
    activeMap.set(id, { since });
  }

  // Oblasts: every State region in the tree.
  const oblasts: OblastAlert[] = [];
  const raions: RaionAlert[] = [];

  // Helper: find parent oblast by walking up tree until a State is found.
  const oblastIsoForRegion = (regionId: string): string | null => {
    let cur: RegionMeta | undefined = regions.get(regionId);
    while (cur) {
      if (cur.type === "State") return NAME_TO_ISO[cur.name] ?? null;
      if (!cur.parentId) return null;
      cur = regions.get(cur.parentId);
    }
    return null;
  };

  for (const meta of regions.values()) {
    if (meta.type === "State") {
      const iso = NAME_TO_ISO[meta.name];
      if (!iso) continue;
      const active = activeMap.get(meta.id);
      oblasts.push({
        id: meta.id,
        iso,
        name: meta.name,
        nameEn: ISO_TO_EN[iso] ?? meta.name,
        active: !!active,
        changedAt: active?.since ?? new Date(0).toISOString(),
      });
    } else if (meta.type === "District") {
      // Only include districts that currently have an active alert — keeps payload small.
      const active = activeMap.get(meta.id);
      if (!active) continue;
      const oblastIso = oblastIsoForRegion(meta.id);
      if (!oblastIso) continue;
      raions.push({
        id: meta.id,
        oblastIso,
        name: meta.name,
        active: true,
        changedAt: active.since,
      });
    }
  }

  return {
    updatedAt: new Date().toISOString(),
    source: "ukrainealarm.com",
    oblasts,
    raions,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (!TOKEN) {
    return new Response(
      JSON.stringify({ error: "UKRAINEALARM_API_TOKEN not configured", oblasts: [], raions: [] }),
      { status: 200, headers: { ...corsHeaders, "content-type": "application/json" } },
    );
  }

  try {
    if (!alertsCache || Date.now() - alertsCache.at > ALERTS_TTL) {
      const payload = await loadAlerts();
      alertsCache = { at: Date.now(), payload };
    }
    return new Response(JSON.stringify(alertsCache.payload), {
      headers: { ...corsHeaders, "content-type": "application/json", "cache-control": "public, max-age=30" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (alertsCache) {
      return new Response(
        JSON.stringify({ ...(alertsCache.payload as object), stale: true, error: message }),
        { headers: { ...corsHeaders, "content-type": "application/json" } },
      );
    }
    return new Response(JSON.stringify({ error: message, oblasts: [], raions: [] }), {
      status: 200,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }
});
