// Edge Function: kaggle-csv
// Serves the latest synced Kaggle CSV files publicly from the private
// `kaggle-raw` storage bucket. Files are written by `kaggle-sync` under
// `latest/<filename>` and refreshed once per day at 06:00 UTC.
//
// Usage: GET /functions/v1/kaggle-csv?file=missile_attacks_daily.csv

import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

// Whitelist of files we are willing to serve. Prevents path traversal and
// limits exposure to known dataset files.
const ALLOWED = new Set([
  "missile_attacks_daily.csv",
  "missiles_and_uavs.csv",
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const file = url.searchParams.get("file") ?? "missile_attacks_daily.csv";

  if (!ALLOWED.has(file)) {
    return new Response(JSON.stringify({ error: "file not allowed" }), {
      status: 400,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const { data, error } = await sb.storage.from("kaggle-raw").download(`latest/${file}`);
  if (error || !data) {
    return new Response(JSON.stringify({ error: error?.message ?? "not found" }), {
      status: 404,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  return new Response(data, {
    headers: {
      ...corsHeaders,
      "content-type": "text/csv; charset=utf-8",
      // Cache at the edge / browser for 30 min — dataset refreshes daily.
      "cache-control": "public, max-age=1800, s-maxage=1800",
    },
  });
});
