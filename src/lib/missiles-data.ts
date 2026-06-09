import Papa from "papaparse";
import type { MonthPoint, Dataset, RawRow } from "@/lib/shahed-data";

const MIN = new Date(Date.UTC(2022, 9, 1));
const MAX = new Date(Date.UTC(2026, 11, 31, 23, 59, 59));

function parseDate(s: string): Date | null {
  if (!s) return null;
  const iso = s.length <= 10 ? `${s}T00:00:00Z` : `${s.replace(" ", "T")}:00Z`;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

function monthKey(d: Date): string {
  const y = d.getUTCFullYear();
  const m = (d.getUTCMonth() + 1).toString().padStart(2, "0");
  return `${y}-${m}`;
}
function monthLabel(d: Date): string {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[d.getUTCMonth()]} '${String(d.getUTCFullYear()).slice(2)}`;
}

// ---------------------------------------------------------------------------
// Classification
//
// We split the dataset into three weapon categories:
//   - "shahed"    : Shahed-136/131 loitering munitions (handled in shahed-data.ts)
//   - "cruise"    : subsonic / supersonic cruise missiles (Kalibr, X-101, X-22, etc.)
//   - "ballistic" : ballistic missiles (Iskander-M, KN-23, Kinzhal, ICBM, etc.)
//
// A row's `model` field can list MULTIPLE weapons joined with " and " (e.g.
// "X-101/X-555 and Iskander-K"). The CSV does not break out per-weapon
// counts in those mixed rows, so we attribute the row's totals to whichever
// category (or both) is present. When a single row mixes cruise + ballistic
// weapons, its launched/destroyed counts are added to BOTH categories — this
// is the same approach used elsewhere in the project for mixed-model rows.
// ---------------------------------------------------------------------------

const BALLISTIC_TOKENS = [
  "Ballistic Missile",
  "Intercontinental Ballistic Missile",
  "Iskander-M",
  "Iskander-M/KN-23",
  "KN-23",
  "X-47 Kinzhal",
  "3M22 Zircon",
  // S-300/S-400 family used in surface-to-surface mode — quasi-ballistic
  "C-300",
  "C-400",
  "C-300/C-400",
];

const CRUISE_TOKENS = [
  "Iskander-K",
  "Kalibr",
  "X-101/X-555",
  "X-22",
  "X-32",
  "X-31",
  "X-31P",
  "X-31PD",
  "X-35",
  "X-59",
  "X-59/X-69",
  "X-59MK2",
  "X-69",
  "P-800 Oniks",
  // Generic "Unknown Missile" rows: most are cruise-type per source notes.
  "Unknown Missile",
];

function tokensInModel(model: string, tokens: string[]): boolean {
  const m = model.trim();
  if (!m) return false;
  // Sort longer tokens first so e.g. "Iskander-M/KN-23" matches before "Iskander-M".
  const sorted = [...tokens].sort((a, b) => b.length - a.length);
  for (const tok of sorted) {
    const escaped = tok.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(^|\\s|\\b)${escaped}(\\b|\\s|$)`);
    if (re.test(m)) return true;
  }
  return false;
}

function isBallistic(model: string): boolean {
  return tokensInModel(model, BALLISTIC_TOKENS);
}

function isCruise(model: string): boolean {
  return tokensInModel(model, CRUISE_TOKENS);
}

// Combined missile category (cruise OR ballistic) — kept for backward
// compatibility with existing imports of loadMissilesData().
function isAnyMissile(model: string): boolean {
  return isBallistic(model) || isCruise(model);
}

// ---------------------------------------------------------------------------
// Aggregation
// ---------------------------------------------------------------------------

function emptyBuckets() {
  const buckets = new Map<string, { launched: number; destroyed: number; date: Date }>();
  const now = new Date();
  const endY = now.getUTCFullYear();
  const endM = now.getUTCMonth(); // include current (incomplete) month in totals
  for (let y = 2022; y <= endY; y++) {
    const firstMonth = y === 2022 ? 9 : 0;
    const lastMonth = y === endY ? endM : 11;
    for (let m = firstMonth; m <= lastMonth; m++) {
      const d = new Date(Date.UTC(y, m, 1));
      buckets.set(monthKey(d), { launched: 0, destroyed: 0, date: d });
    }
  }
  return buckets;
}

function bucketsToDataset(
  buckets: Map<string, { launched: number; destroyed: number; date: Date }>,
): Dataset {
  const months: MonthPoint[] = Array.from(buckets.values())
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map((b) => ({
      key: monthKey(b.date),
      date: b.date,
      label: monthLabel(b.date),
      launched: Math.round(b.launched),
      destroyed: Math.round(b.destroyed),
      rate: b.launched > 0 ? b.destroyed / b.launched : 0,
    }));

  const totalLaunched = months.reduce((s, m) => s + m.launched, 0);
  const totalDestroyed = months.reduce((s, m) => s + m.destroyed, 0);

  return {
    months,
    totals: {
      launched: totalLaunched,
      destroyed: totalDestroyed,
      rate: totalLaunched > 0 ? totalDestroyed / totalLaunched : 0,
    },
  };
}

import { kaggleCsvUrl, STATIC_CSV_FALLBACK } from "@/lib/kaggle-csv";

async function fetchRows(url: string): Promise<RawRow[]> {
  // Prefer the daily-synced CSV; fall back to the static bundled copy.
  let text: string;
  try {
    const res = await fetch(url);
    if (res.ok) {
      text = await res.text();
    } else {
      const fb = await fetch(STATIC_CSV_FALLBACK("missile_attacks_daily.csv"));
      text = await fb.text();
    }
  } catch {
    const fb = await fetch(STATIC_CSV_FALLBACK("missile_attacks_daily.csv"));
    text = await fb.text();
  }
  const parsed = Papa.parse<RawRow>(text, { header: true, skipEmptyLines: true });
  return parsed.data;
}

function aggregate(rows: RawRow[], predicate: (model: string) => boolean): Dataset {
  const buckets = emptyBuckets();
  for (const row of rows) {
    if (!row || !row.model) continue;
    if (!predicate(row.model)) continue;

    const d = parseDate(row.time_start) ?? parseDate(row.time_end);
    if (!d) continue;
    if (d < MIN || d > MAX) continue;

    const launched = parseFloat(row.launched) || 0;
    const destroyed = parseFloat(row.destroyed) || 0;

    const key = monthKey(d);
    const b = buckets.get(key);
    if (!b) continue;
    b.launched += launched;
    b.destroyed += destroyed;
  }
  return bucketsToDataset(buckets);
}

// ---------------------------------------------------------------------------
// Public loaders
// ---------------------------------------------------------------------------

const DEFAULT_URL = kaggleCsvUrl("missile_attacks_daily.csv");

export async function loadCruiseMissilesData(url = DEFAULT_URL): Promise<Dataset> {
  const rows = await fetchRows(url);
  return aggregate(rows, isCruise);
}

export async function loadBallisticMissilesData(url = DEFAULT_URL): Promise<Dataset> {
  const rows = await fetchRows(url);
  return aggregate(rows, isBallistic);
}

/**
 * Combined cruise + ballistic missile dataset.
 * Kept for backward compatibility with existing callers.
 */
export async function loadMissilesData(url = DEFAULT_URL): Promise<Dataset> {
  const rows = await fetchRows(url);
  return aggregate(rows, isAnyMissile);
}

/**
 * Convenience loader that fetches the CSV once and returns all three datasets.
 */
export async function loadAllMissileCategories(url = DEFAULT_URL): Promise<{
  cruise: Dataset;
  ballistic: Dataset;
  combined: Dataset;
}> {
  const rows = await fetchRows(url);
  return {
    cruise: aggregate(rows, isCruise),
    ballistic: aggregate(rows, isBallistic),
    combined: aggregate(rows, isAnyMissile),
  };
}
