import Papa from "papaparse";

export type RawRow = {
  time_start: string;
  time_end: string;
  model: string;
  launched: string;
  destroyed: string;
};

export type MonthPoint = {
  key: string;          // "2023-01"
  date: Date;           // first of month
  label: string;        // "Jan '23"
  launched: number;
  destroyed: number;
  rate: number;         // 0..1
};

export type Dataset = {
  months: MonthPoint[];
  totals: { launched: number; destroyed: number; rate: number };
};

const MIN = new Date(Date.UTC(2022, 9, 1)); // October 2022 — first complete month
const MAX = new Date(Date.UTC(2026, 11, 31, 23, 59, 59)); // through Dec 2026

function parseDate(s: string): Date | null {
  if (!s) return null;
  // Accept "YYYY-MM-DD" or "YYYY-MM-DD HH:MM"
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

export async function loadShahedData(url = "/data/missile_attacks_daily.csv"): Promise<Dataset> {
  const res = await fetch(url);
  const text = await res.text();

  const parsed = Papa.parse<RawRow>(text, {
    header: true,
    skipEmptyLines: true,
  });

  const buckets = new Map<string, { launched: number; destroyed: number; date: Date }>();

  // Seed every month in range so the chart has continuous x-axis,
  // capped at the current calendar month (UTC) — no future months.
  const now = new Date();
  const curY = now.getUTCFullYear();
  const curM = now.getUTCMonth();
  for (let y = 2022; y <= curY; y++) {
    const firstMonth = y === 2022 ? 9 : 0; // start October 2022
    const lastMonth = y === curY ? curM : 11;
    for (let m = firstMonth; m <= lastMonth; m++) {
      const d = new Date(Date.UTC(y, m, 1));
      buckets.set(monthKey(d), { launched: 0, destroyed: 0, date: d });
    }
  }

  const UAV_TOKENS = [
    "Shahed-136/131", "Lancet", "Orlan-10", "Orlan-30", "ZALA", "Supercam",
    "Mohajer-6", "Orion", "Forpost", "Eleron", "Granat-4", "Merlin-VR",
    "Kub", "Banderol", "Reconnaissance UAV", "Unknown UAV",
    "Молнія", "Привет-82", "Фенікс", "Картограф",
  ];
  const isUAV = (model: string) => {
    const m = model.trim();
    return UAV_TOKENS.some((tok) => {
      const escaped = tok.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp(`(^|\\s|\\b)${escaped}(\\b|\\s|$)`).test(m);
    });
  };

  for (const row of parsed.data) {
    if (!row || !row.model) continue;
    if (!isUAV(row.model)) continue;

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
