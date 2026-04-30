import Papa from "papaparse";
import type { MonthPoint, Dataset, RawRow } from "@/lib/shahed-data";

const MIN = new Date(Date.UTC(2023, 0, 1));
const MAX = new Date(Date.UTC(2026, 2, 31, 23, 59, 59));

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

// Tokens that identify ballistic missiles or cruise missiles.
// Excludes drones (Shahed, Lancet, Orlan, ZALA, Supercam, Mohajer, Orion, Forpost, etc.),
// air-defense systems used as ground-attack (C-300/C-400 are SAMs repurposed — included as missiles),
// aerial bombs and reconnaissance UAVs.
const MISSILE_TOKENS = [
  "Ballistic Missile",
  "Intercontinental Ballistic Missile",
  "Unknown Missile",
  "Iskander-M",
  "Iskander-K",
  "KN-23",
  "Kalibr",
  "X-101/X-555",
  "X-22",
  "X-31",
  "X-31P",
  "X-31PD",
  "X-32",
  "X-35",
  "X-47 Kinzhal",
  "X-59",
  "X-59/X-69",
  "X-59MK2",
  "X-69",
  "3M22 Zircon",
  "P-800 Oniks",
  "C-300",
  "C-400",
  "C-300/C-400",
];

function isMissileModel(model: string): boolean {
  const m = model.trim();
  if (!m) return false;
  // Exclude pure drone/UAV/bomb categories explicitly.
  const exclude = [
    "Shahed",
    "Lancet",
    "Orlan",
    "ZALA",
    "Supercam",
    "Mohajer",
    "Orion",
    "Forpost",
    "Eleron",
    "Granat",
    "Merlin",
    "Banderol",
    "Kub",
    "GBU",
    "Aerial Bomb",
    "Reconnaissance UAV",
    "Unknown UAV",
    "Картограф",
    "Молнія",
    "Привет-82",
    "Фенікс",
  ];
  // If the entry contains ONLY excluded tokens, drop it.
  // We accept the row if any missile token is present.
  for (const tok of MISSILE_TOKENS) {
    // Match as whole token surrounded by start/end or " and "
    const re = new RegExp(`(^|\\b|\\s)${tok.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\b|\\s|$)`);
    if (re.test(m)) return true;
  }
  // Generic fallback
  if (/missile/i.test(m) && !exclude.some((e) => m.includes(e))) return true;
  return false;
}

export async function loadMissilesData(
  url = "/data/missile_attacks_daily.csv",
): Promise<Dataset> {
  const res = await fetch(url);
  const text = await res.text();
  const parsed = Papa.parse<RawRow>(text, { header: true, skipEmptyLines: true });

  const buckets = new Map<string, { launched: number; destroyed: number; date: Date }>();
  for (let y = 2023; y <= 2026; y++) {
    const lastMonth = y === 2026 ? 2 : 11;
    for (let m = 0; m <= lastMonth; m++) {
      const d = new Date(Date.UTC(y, m, 1));
      buckets.set(monthKey(d), { launched: 0, destroyed: 0, date: d });
    }
  }

  for (const row of parsed.data) {
    if (!row || !row.model) continue;
    if (!isMissileModel(row.model)) continue;

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
