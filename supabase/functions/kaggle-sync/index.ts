// Edge Function: kaggle-sync
// Downloads the Kaggle dataset `piterfm/massive-missile-attacks-on-ukraine`,
// archives raw CSVs to Storage, upserts every row into `public.kaggle_rows`,
// and recomputes `public.kaggle_aggregates`.
// Triggered daily by pg_cron at 06:00 UTC; can also be invoked manually.

import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { Unzip, UnzipInflate, strFromU8 } from "npm:fflate@0.8.2";
import Papa from "npm:papaparse@5.4.1";


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const DATASET = "piterfm/massive-missile-attacks-on-ukraine";
const KAGGLE_URL = `https://www.kaggle.com/api/v1/datasets/download/${DATASET}`;
const STORAGE_BUCKET = "kaggle-raw";
const BATCH = 500;

// ---------- helpers ----------
async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function pickDate(row: Record<string, unknown>): string | null {
  const candidates = ["date", "time_start", "time", "launched_at", "started_at", "day"];
  for (const key of Object.keys(row)) {
    const lk = key.toLowerCase();
    if (candidates.includes(lk)) {
      const v = String(row[key] ?? "").trim();
      if (!v) return null;
      // Take first 10 chars if ISO-like
      const m = v.match(/^(\d{4}-\d{2}-\d{2})/);
      if (m) return m[1];
      const d = new Date(v);
      if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    }
  }
  return null;
}

async function streamKaggleCsvs(
  user: string,
  key: string,
  onCsv: (name: string, bytes: Uint8Array) => Promise<void>,
): Promise<void> {
  const auth = "Basic " + btoa(`${user}:${key}`);
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(KAGGLE_URL, {
      headers: { Authorization: auth, "User-Agent": "ua-airdefense-tracker.org" },
      redirect: "follow",
    });
    if (!res.ok) {
      if (res.status === 429 || res.status >= 500) {
        await new Promise((r) => setTimeout(r, 1500));
        continue;
      }
      const body = await res.text().catch(() => "");
      throw new Error(`Kaggle HTTP ${res.status}: ${body.slice(0, 200)}`);
    }
    if (!res.body) throw new Error("Kaggle response has no body");

    // Stream the ZIP through fflate's Unzip so we never hold the full archive
    // in memory. Each file's bytes are accumulated only while it is emitted.
    const pending: Promise<void>[] = [];
    const unzipper = new Unzip();
    unzipper.register(UnzipInflate);
    unzipper.onfile = (file) => {
      if (!file.name.toLowerCase().endsWith(".csv")) {
        // We still need to drain unsupported files to advance the stream.
        const sink: Uint8Array[] = [];
        file.ondata = (_err, _d, _final) => { /* discard */ };
        file.start();
        return;
      }
      const chunks: Uint8Array[] = [];
      file.ondata = (err, data, final) => {
        if (err) throw err;
        if (data && data.length) chunks.push(data);
        if (final) {
          let total = 0;
          for (const c of chunks) total += c.length;
          const merged = new Uint8Array(total);
          let off = 0;
          for (const c of chunks) { merged.set(c, off); off += c.length; }
          pending.push(onCsv(file.name, merged));
        }
      };
      file.start();
    };

    const reader = res.body.getReader();
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) { unzipper.push(new Uint8Array(0), true); break; }
        if (value && value.length) unzipper.push(value, false);
      }
      await Promise.all(pending);
      return;
    } catch (e) {
      lastErr = e;
      continue;
    }
  }
  throw new Error(`Kaggle download failed: ${lastErr instanceof Error ? lastErr.message : String(lastErr)}`);
}


// ---------- aggregates ----------
async function recomputeAggregates(sb: ReturnType<typeof createClient>) {
  // Clear old aggregates, then recompute from kaggle_rows.
  await sb.from("kaggle_aggregates").delete().neq("metric", "__never__");

  // Pull the rows we care about (small dataset; safe to read in one go).
  const { data: rows, error } = await sb
    .from("kaggle_rows")
    .select("source_file,data,event_date")
    .eq("source_file", "missile_attacks_daily.csv");
  if (error) throw new Error(`agg select: ${error.message}`);

  const dailyLaunched = new Map<string, number>();
  const dailyDestroyed = new Map<string, number>();
  const weaponLaunched = new Map<string, number>();
  const weaponDestroyed = new Map<string, number>();

  for (const r of rows ?? []) {
    const d = r.event_date as string | null;
    const obj = (r.data ?? {}) as Record<string, unknown>;
    // Field names in this Kaggle dataset use snake_case like `launched`, `destroyed`, `model`.
    const launched = Number(obj["launched"] ?? obj["Launched"] ?? 0) || 0;
    const destroyed = Number(obj["destroyed"] ?? obj["Destroyed"] ?? 0) || 0;
    const weapon = String(obj["model"] ?? obj["Model"] ?? obj["type"] ?? "Unknown").trim() || "Unknown";

    if (d) {
      dailyLaunched.set(d, (dailyLaunched.get(d) ?? 0) + launched);
      dailyDestroyed.set(d, (dailyDestroyed.get(d) ?? 0) + destroyed);
    }
    weaponLaunched.set(weapon, (weaponLaunched.get(weapon) ?? 0) + launched);
    weaponDestroyed.set(weapon, (weaponDestroyed.get(weapon) ?? 0) + destroyed);
  }

  const aggRows: { metric: string; bucket: string; dimensions: Record<string, unknown>; value: number }[] = [];
  for (const [k, v] of dailyLaunched) aggRows.push({ metric: "daily_launched", bucket: k, dimensions: {}, value: v });
  for (const [k, v] of dailyDestroyed) aggRows.push({ metric: "daily_destroyed", bucket: k, dimensions: {}, value: v });
  for (const [k, v] of weaponLaunched) aggRows.push({ metric: "weapon_launched", bucket: k, dimensions: {}, value: v });
  for (const [k, v] of weaponDestroyed) aggRows.push({ metric: "weapon_destroyed", bucket: k, dimensions: {}, value: v });

  // Insert in batches
  for (let i = 0; i < aggRows.length; i += 1000) {
    const slice = aggRows.slice(i, i + 1000);
    const { error: insErr } = await sb.from("kaggle_aggregates").upsert(slice, {
      onConflict: "metric,bucket,dimensions",
    });
    if (insErr) throw new Error(`agg upsert: ${insErr.message}`);
  }
}

// ---------- main ----------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const KAGGLE_USERNAME = Deno.env.get("KAGGLE_USERNAME");
  const KAGGLE_KEY = Deno.env.get("KAGGLE_KEY");

  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // Start a sync_runs row
  const { data: runRow, error: runErr } = await sb
    .from("sync_runs")
    .insert({ source: "kaggle" })
    .select("id")
    .single();
  if (runErr) {
    return new Response(JSON.stringify({ error: `sync_runs insert: ${runErr.message}` }), {
      status: 500,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }
  const runId = runRow.id as number;

  const finish = async (status: "ok" | "error", patch: Record<string, unknown>) => {
    await sb
      .from("sync_runs")
      .update({ ...patch, status, finished_at: new Date().toISOString() })
      .eq("id", runId);
  };

  try {
    if (!KAGGLE_USERNAME || !KAGGLE_KEY) {
      throw new Error("KAGGLE_USERNAME / KAGGLE_KEY not configured");
    }

    // 1. Download + unzip
    const zipBytes = await fetchKaggleZip(KAGGLE_USERNAME, KAGGLE_KEY);
    const entries = unzipSync(zipBytes);
    const csvFiles = Object.entries(entries).filter(([name]) => name.toLowerCase().endsWith(".csv"));
    if (csvFiles.length === 0) throw new Error("No CSV files in Kaggle archive");

    const today = new Date().toISOString().slice(0, 10);
    let filesProcessed = 0;
    let rowsUpserted = 0;

    // 2. Per CSV: archive + parse + upsert
    for (const [name, bytes] of csvFiles) {
      const baseName = name.split("/").pop() ?? name;

      // Archive raw bytes
      const { error: upErr } = await sb.storage
        .from(STORAGE_BUCKET)
        .upload(`${today}/${baseName}`, bytes, {
          contentType: "text/csv",
          upsert: true,
        });
      if (upErr) throw new Error(`storage upload ${baseName}: ${upErr.message}`);

      // Parse CSV
      const text = strFromU8(bytes);
      const parsed = Papa.parse<Record<string, string>>(text, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: false,
      });
      if (parsed.errors.length > 0) {
        console.warn(`[kaggle-sync] ${baseName} parse warnings: ${parsed.errors.length}`);
      }

      // Build row records with hash
      const records: { source_file: string; row_hash: string; data: Record<string, string>; event_date: string | null }[] = [];
      for (const row of parsed.data) {
        if (!row || Object.keys(row).length === 0) continue;
        const canonical = JSON.stringify(row, Object.keys(row).sort());
        const hash = await sha256(`${baseName}::${canonical}`);
        records.push({
          source_file: baseName,
          row_hash: hash,
          data: row,
          event_date: pickDate(row),
        });
      }

      // Upsert in batches
      for (let i = 0; i < records.length; i += BATCH) {
        const slice = records.slice(i, i + BATCH);
        const { error: insErr } = await sb
          .from("kaggle_rows")
          .upsert(slice, { onConflict: "source_file,row_hash", ignoreDuplicates: true });
        if (insErr) throw new Error(`kaggle_rows upsert ${baseName}: ${insErr.message}`);
      }

      rowsUpserted += records.length;
      filesProcessed += 1;
    }

    // 3. Recompute aggregates
    await recomputeAggregates(sb);

    await finish("ok", { files_processed: filesProcessed, rows_upserted: rowsUpserted });

    return new Response(
      JSON.stringify({
        ok: true,
        runId,
        filesProcessed,
        rowsUpserted,
        files: csvFiles.map(([n]) => n.split("/").pop()),
      }),
      { headers: { ...corsHeaders, "content-type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[kaggle-sync] ${message}`);
    await finish("error", { error: message });
    return new Response(JSON.stringify({ ok: false, runId, error: message }), {
      status: 500,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }
});
