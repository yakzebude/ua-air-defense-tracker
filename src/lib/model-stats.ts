import Papa from "papaparse";
import type { RawRow } from "@/lib/shahed-data";

export interface ModelStats {
  launched: number;
  destroyed: number;
  rate: number;
}

/**
 * Compute per-model totals from the raw daily attacks CSV.
 * For rows that mix multiple weapons (joined with " and " or "/"),
 * the row's counts are attributed to every individual model token —
 * same approach as the category aggregations.
 */
export async function loadModelStats(
  url = "/data/missile_attacks_daily.csv",
): Promise<Map<string, ModelStats>> {
  const res = await fetch(url);
  const text = await res.text();
  const parsed = Papa.parse<RawRow>(text, { header: true, skipEmptyLines: true });

  const totals = new Map<string, { launched: number; destroyed: number }>();
  for (const row of parsed.data) {
    if (!row || !row.model) continue;
    const launched = parseFloat(row.launched) || 0;
    const destroyed = parseFloat(row.destroyed) || 0;
    if (!launched && !destroyed) continue;
    // Split mixed-fire rows on " and "
    const parts = row.model.split(/\s+and\s+/i).map((s) => s.trim()).filter(Boolean);
    for (const p of parts) {
      const cur = totals.get(p) ?? { launched: 0, destroyed: 0 };
      cur.launched += launched;
      cur.destroyed += destroyed;
      totals.set(p, cur);
    }
  }

  const out = new Map<string, ModelStats>();
  for (const [k, v] of totals) {
    out.set(k, {
      launched: Math.round(v.launched),
      destroyed: Math.round(v.destroyed),
      rate: v.launched > 0 ? v.destroyed / v.launched : 0,
    });
  }
  return out;
}

/**
 * Match a weapon model name from the catalog against the dataset's
 * model strings. Tries direct hit first, then sub-token matches
 * (e.g. catalog "Shahed-136" against dataset "Shahed-136/131").
 */
export function lookupModelStats(
  stats: Map<string, ModelStats>,
  catalogModel: string,
): ModelStats | null {
  if (stats.has(catalogModel)) return stats.get(catalogModel)!;
  const lc = catalogModel.toLowerCase();
  // Aggregate across all keys whose model contains the catalog token
  let agg: ModelStats | null = null;
  for (const [k, v] of stats) {
    if (k.toLowerCase().includes(lc) || lc.includes(k.toLowerCase())) {
      agg = agg
        ? {
            launched: agg.launched + v.launched,
            destroyed: agg.destroyed + v.destroyed,
            rate: 0,
          }
        : { ...v };
    }
  }
  if (agg) {
    agg.rate = agg.launched > 0 ? agg.destroyed / agg.launched : 0;
    return agg;
  }
  return null;
}
