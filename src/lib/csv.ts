// Tiny CSV utilities for per-panel exports and citation copy.

function escapeCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCSV(rows: Array<Record<string, unknown>>, headers?: string[]): string {
  if (!rows.length) return "";
  const cols = headers ?? Object.keys(rows[0]);
  const head = cols.map(escapeCell).join(",");
  const body = rows.map((r) => cols.map((c) => escapeCell(r[c])).join(",")).join("\n");
  return `${head}\n${body}`;
}

export function downloadCSV(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function buildCitation(panelTitle?: string): string {
  const today = new Date().toISOString().slice(0, 10);
  const base =
    "Air Force Command of the Armed Forces of Ukraine, via Petro Ivaniuk (Kaggle: Massive Missile Attacks on Ukraine), aggregated by UA Air Defense Tracker";
  const panel = panelTitle ? ` — ${panelTitle}` : "";
  return `${base}${panel}. Retrieved ${today}. https://ua-airdefense-tracker.org/`;
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
