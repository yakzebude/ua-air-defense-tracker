// Edge Function: deepstate-frontline
// Returns the latest "occupied territory" polygons from DeepStateMap.
// Refreshed at most every 14 days; cached in Supabase storage.
//
// Endpoint (consumer): GET /functions/v1/deepstate-frontline
// Upstream: https://deepstatemap.live/api/history/last

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SOURCE_URL = "https://deepstatemap.live/api/history/last";
const BUCKET = "deepstate-cache";
const OBJECT = "frontline-latest-v3.json";
const REFRESH_AFTER_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

interface Cached {
  fetchedAt: string;
  upstreamDatetime?: string;
  features: GeoJSON.Feature[];
}

function deepStateStatus(name: string | undefined): "occupied" | "unknown" | null {
  if (!name) return false;
  // DeepStateMap encodes status in the name as "UA /// EN /// geoJSON.status.<x>"
  const lc = name.toLowerCase();
  if (lc.includes("geojson.status.occupied") || lc.includes("/// occupied")) return "occupied";
  if (lc.includes("geojson.status.unknown") || lc.includes("/// unknown status")) return "unknown";
  return null;
}

async function fetchUpstream(): Promise<Cached> {
  const res = await fetch(SOURCE_URL, {
    headers: { "user-agent": "ua-airdefense-tracker.org", accept: "application/json" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`deepstatemap ${res.status}`);
  const json = await res.json() as {
    datetime?: string;
    map?: { type: string; features: GeoJSON.Feature[] };
  };
  // Strip Z (elevation) from each [lng,lat,z] tuple — d3-geo expects [lng,lat].
  const strip2D = (coords: any): any =>
    typeof coords[0] === "number" ? [coords[0], coords[1]] : coords.map(strip2D);

  const features = (json.map?.features ?? []).map((f) => {
    const t = f.geometry?.type;
    if (t !== "Polygon" && t !== "MultiPolygon") return null;
    const name = (f.properties as { name?: string } | null)?.name;
    const status = deepStateStatus(name);
    if (!status) return null;
    return {
      type: "Feature" as const,
      geometry: {
        type: f.geometry!.type,
        // deno-lint-ignore no-explicit-any
        coordinates: strip2D((f.geometry as any).coordinates),
      } as GeoJSON.Geometry,
      properties: { status },
    };
  }).filter((feature): feature is GeoJSON.Feature => Boolean(feature));
  return {
    fetchedAt: new Date().toISOString(),
    upstreamDatetime: json.datetime,
    features,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    // Try cache first.
    let cached: Cached | null = null;
    const { data: file } = await supabase.storage.from(BUCKET).download(OBJECT);
    if (file) {
      try { cached = JSON.parse(await file.text()) as Cached; } catch { cached = null; }
    }

    const fresh = cached && (Date.now() - new Date(cached.fetchedAt).getTime() < REFRESH_AFTER_MS);

    let payload = cached;
    if (!fresh) {
      try {
        payload = await fetchUpstream();
        await supabase.storage.from(BUCKET).upload(
          OBJECT,
          new Blob([JSON.stringify(payload)], { type: "application/json" }),
          { upsert: true, contentType: "application/json" },
        );
      } catch (e) {
        // Fall back to stale cache on upstream failure.
        if (!payload) throw e;
      }
    }

    return new Response(JSON.stringify(payload), {
      headers: {
        ...corsHeaders,
        "content-type": "application/json",
        "cache-control": "public, max-age=86400",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[deepstate-frontline]", message);
    return new Response(
      JSON.stringify({ error: message, features: [] }),
      { status: 200, headers: { ...corsHeaders, "content-type": "application/json" } },
    );
  }
});
