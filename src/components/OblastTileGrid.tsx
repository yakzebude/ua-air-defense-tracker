import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { rampColor } from "@/lib/threat-ramp";
import oblastStatsData from "@/data/oblastStats.json";

const REFRESH_MS = 30 * 1000;

const OCCUPIED_ISOS = new Set<string>([
  "UA-43", // Crimea
  "UA-09", // Luhansk
  "UA-14", // Donetsk (large parts)
  "UA-23", // Zaporizhzhia (partial)
  "UA-65", // Kherson (partial)
]);

interface OblastStat {
  slug: string;
  alarms?: number;
  avgDuration?: string;
  longest?: string;
  explosionReports?: number;
  artilleryThreats?: number;
}
const OBLAST_STATS = oblastStatsData as {
  source: string;
  sourceUrl: string;
  asOf: string;
  periodStart: string;
  note: string;
  regions: Record<string, OblastStat>;
};

type AlertState = "none" | "partial" | "full";

interface OblastAlert {
  iso: string;
  name: string;
  nameEn: string;
  active: boolean;
  state?: AlertState;
  changedAt: string;
  types?: string[];
}

interface ApiPayload {
  updatedAt: string;
  source: string;
  status?: "ok" | "stale" | "unauthorized" | "unavailable";
  oblasts: OblastAlert[];
  stale?: boolean;
}

interface Tile {
  iso: string;
  label: string;   // 3-letter
  name: string;    // English full name
  col: number;
  row: number;
}

/**
 * Hand-positioned tile-grid map of Ukraine's 24 oblasts + the Autonomous
 * Republic of Crimea. Rough geographic correspondence (W→E, N→S) on a 7×5
 * grid — not a literal projection, but readable as Ukraine's shape.
 */
const TILES: Tile[] = [
  // Row 1 — northern border
  { iso: "UA-07", label: "VOL", name: "Volyn",        col: 2, row: 1 },
  { iso: "UA-56", label: "RIV", name: "Rivne",        col: 3, row: 1 },
  { iso: "UA-18", label: "ZHY", name: "Zhytomyr",     col: 4, row: 1 },
  { iso: "UA-32", label: "KYI", name: "Kyiv",         col: 5, row: 1 },
  { iso: "UA-74", label: "CHN", name: "Chernihiv",    col: 6, row: 1 },
  { iso: "UA-59", label: "SUM", name: "Sumy",         col: 7, row: 1 },
  // Row 2 — central belt
  { iso: "UA-46", label: "LVI", name: "Lviv",         col: 1, row: 2 },
  { iso: "UA-61", label: "TER", name: "Ternopil",     col: 2, row: 2 },
  { iso: "UA-68", label: "KHM", name: "Khmelnytskyi", col: 3, row: 2 },
  { iso: "UA-05", label: "VIN", name: "Vinnytsia",    col: 4, row: 2 },
  { iso: "UA-71", label: "CHK", name: "Cherkasy",     col: 5, row: 2 },
  { iso: "UA-53", label: "POL", name: "Poltava",      col: 6, row: 2 },
  { iso: "UA-63", label: "KHA", name: "Kharkiv",      col: 7, row: 2 },
  // Row 3 — west tip + east
  { iso: "UA-21", label: "ZAK", name: "Zakarpattia",  col: 1, row: 3 },
  { iso: "UA-26", label: "IFR", name: "Ivano-Frankivsk", col: 2, row: 3 },
  { iso: "UA-77", label: "CHV", name: "Chernivtsi",   col: 3, row: 3 },
  { iso: "UA-35", label: "KIR", name: "Kirovohrad",   col: 4, row: 3 },
  { iso: "UA-12", label: "DNI", name: "Dnipropetrovsk", col: 5, row: 3 },
  { iso: "UA-09", label: "LUH", name: "Luhansk",      col: 7, row: 3 },
  // Row 4 — south
  { iso: "UA-51", label: "ODE", name: "Odesa",        col: 3, row: 4 },
  { iso: "UA-48", label: "MYK", name: "Mykolaiv",     col: 4, row: 4 },
  { iso: "UA-65", label: "KHE", name: "Kherson",      col: 5, row: 4 },
  { iso: "UA-23", label: "ZAP", name: "Zaporizhzhia", col: 6, row: 4 },
  { iso: "UA-14", label: "DON", name: "Donetsk",      col: 7, row: 4 },
  // Row 5 — Crimea
  { iso: "UA-43", label: "CRM", name: "Crimea",       col: 5, row: 5 },
];

const fmt = (n?: number) => (n == null ? "—" : n.toLocaleString("en-US").replace(/,/g, " "));

/** Parse "HH:MM:SS" into total seconds. Used to estimate alarm-hours. */
function parseHmsToSec(s?: string): number {
  if (!s) return 0;
  const [h, m, sec] = s.split(":").map((v) => parseInt(v, 10) || 0);
  return h * 3600 + m * 60 + sec;
}

/** Estimated total alarm hours since 2022-02-24 for an oblast. */
function alarmHours(stat?: OblastStat): number {
  if (!stat?.alarms || !stat.avgDuration) return 0;
  return Math.round((stat.alarms * parseHmsToSec(stat.avgDuration)) / 3600);
}

interface Props {
  /** When true, hide page chrome and render the grid embedded inside a panel. */
  embedded?: boolean;
}

export function OblastTileGrid({ embedded = false }: Props) {
  const { t } = useTranslation();
  const [data, setData] = useState<ApiPayload | null>(null);
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

  const load = async () => {
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID as string;
      const apikey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
      const url = `https://${projectId}.functions.supabase.co/air-alerts`;
      const res = await fetch(url, {
        headers: { apikey, Authorization: `Bearer ${apikey}` },
      });
      if (!res.ok) throw new Error(String(res.status));
      const payload = (await res.json()) as ApiPayload;
      setData(payload);
      setError(false);
    } catch {
      setError(true);
    }
  };

  useEffect(() => {
    load();
    timerRef.current = window.setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, REFRESH_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const byIso = useMemo(() => {
    const m = new Map<string, OblastAlert>();
    for (const o of data?.oblasts ?? []) m.set(o.iso, o);
    return m;
  }, [data]);

  // Color scale: alarm-hours normalised across the 24 free-territory oblasts.
  const maxHours = useMemo(() => {
    let max = 0;
    for (const tile of TILES) {
      if (OCCUPIED_ISOS.has(tile.iso)) continue;
      const h = alarmHours(OBLAST_STATS.regions[tile.iso]);
      if (h > max) max = h;
    }
    return Math.max(max, 1);
  }, []);

  const isActive = (iso: string) => {
    if (OCCUPIED_ISOS.has(iso)) return false; // occupied baseline excluded
    const a = byIso.get(iso);
    if (!a) return false;
    const s = (a.state ?? (a.active ? "full" : "none")) as AlertState;
    return s === "full" || s === "partial";
  };

  const activeCount = TILES.filter((tile) => isActive(tile.iso)).length;

  const selectedTile = selected ? TILES.find((t) => t.iso === selected) : null;
  const selectedStat = selectedTile ? OBLAST_STATS.regions[selectedTile.iso] : null;
  const selectedAlert = selectedTile ? byIso.get(selectedTile.iso) : null;

  return (
    <div className={embedded ? "" : "rounded-sm border border-border bg-card p-5"}>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="src-label mb-1 flex items-center gap-2">
            <span className="relative inline-flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[hsl(var(--signal))] opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[hsl(var(--signal))]" />
            </span>
            <span>{t("tileGrid.kicker", "Oblast tile grid")}</span>
          </div>
          <h3 className="text-lg font-semibold tracking-tight md:text-xl">
            {t("tileGrid.title", "Air-raid load by oblast — analytical view")}
          </h3>
          <p className="mt-1.5 max-w-2xl text-[12.5px] leading-[1.55] text-muted-foreground">
            {t(
              "tileGrid.subtitle",
              "Equal-area tiles arranged roughly by geography. Tile colour reflects total air-alarm hours since 24 Feb 2022. Active alerts pulse red; occupied territory is fixed dark red.",
            )}
          </p>
        </div>
        <div className="flex items-center gap-3 font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="relative inline-flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[hsl(var(--signal))] opacity-70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[hsl(var(--signal))]" />
            </span>
            <span className="num text-foreground">{activeCount}</span>
            <span>{t("tileGrid.active", "active")}</span>
          </span>
          {error && <span className="text-[hsl(var(--signal-warn))]">{t("tileGrid.offline", "feed offline")}</span>}
        </div>
      </div>

      {/* Legend */}
      <div className="mb-4 flex flex-wrap items-center gap-3 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        <span>{t("tileGrid.legend", "Alarm hours since 24 Feb 2022")}:</span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-2 w-24 rounded-sm" style={{
            background: "linear-gradient(90deg, hsl(48 95% 78%), hsl(28 92% 55%), hsl(0 78% 38%))",
          }} />
          <span className="num text-foreground">0</span>
          <span>→</span>
          <span className="num text-foreground">{fmt(maxHours)}h</span>
        </span>
        <span aria-hidden className="h-3 w-px bg-border" />
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className="h-3 w-3 rounded-sm"
            style={{
              background:
                "repeating-linear-gradient(45deg, hsl(0 60% 20%), hsl(0 60% 20%) 2px, hsl(0 60% 28%) 2px, hsl(0 60% 28%) 4px)",
            }}
          />
          <span>{t("tileGrid.occupied", "occupied")}</span>
        </span>
      </div>

      <div
        className="grid gap-1.5"
        style={{
          gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
          gridTemplateRows: "repeat(5, minmax(56px, auto))",
        }}
      >
        {TILES.map((tile) => {
          const stat = OBLAST_STATS.regions[tile.iso];
          const hours = alarmHours(stat);
          const occupied = OCCUPIED_ISOS.has(tile.iso);
          const active = isActive(tile.iso);
          const t01 = Math.min(1, hours / maxHours);
          const fill = occupied
            ? undefined
            : hours > 0
              ? rampColor(t01, 0.75)
              : "hsl(var(--card))";
          const isLight = !occupied && t01 > 0.55;
          const textColor = occupied
            ? "hsl(0 0% 92%)"
            : isLight
              ? "hsl(0 0% 8%)"
              : "hsl(var(--foreground))";
          const subColor = occupied
            ? "hsl(0 0% 92% / 0.7)"
            : isLight
              ? "hsl(0 0% 8% / 0.7)"
              : "hsl(var(--muted-foreground))";
          const isSelected = selected === tile.iso;
          return (
            <button
              key={tile.iso}
              type="button"
              onClick={() => setSelected(isSelected ? null : tile.iso)}
              aria-label={`${tile.name}${active ? " — active alert" : ""}`}
              title={tile.name}
              className={`group relative flex flex-col items-start justify-between rounded-sm border p-1.5 text-left transition-all focus:outline-none focus-visible:ring-1 focus-visible:ring-foreground ${
                isSelected ? "ring-2 ring-foreground" : "ring-0"
              } ${active ? "air-alert-pulse border-[hsl(var(--signal))]" : "border-border"}`}
              style={{
                gridColumn: tile.col,
                gridRow: tile.row,
                background: occupied
                  ? "repeating-linear-gradient(45deg, hsl(0 60% 18%), hsl(0 60% 18%) 3px, hsl(0 60% 26%) 3px, hsl(0 60% 26%) 6px)"
                  : active
                    ? "hsl(var(--signal) / 0.85)"
                    : fill,
                color: active ? "hsl(0 0% 98%)" : textColor,
              }}
            >
              <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] leading-none">
                {tile.label}
              </span>
              <span
                className="num text-[13px] font-semibold leading-none"
                style={{ color: active ? "hsl(0 0% 98%)" : textColor }}
              >
                {occupied ? "—" : fmt(hours) + "h"}
              </span>
              <span
                className="font-mono text-[9px] uppercase tracking-[0.12em] leading-none"
                style={{ color: active ? "hsl(0 0% 98% / 0.9)" : subColor }}
              >
                {active ? t("tileGrid.alert", "ALERT") : occupied ? t("tileGrid.occShort", "OCC") : `${fmt(stat?.alarms)} ev`}
              </span>
            </button>
          );
        })}
      </div>

      {/* Detail panel */}
      {selectedTile && (
        <div className="mt-5 rounded-sm border border-border bg-secondary/30 p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <div>
              <div className="src-label">{selectedTile.iso}</div>
              <div className="text-lg font-semibold tracking-tight">{selectedTile.name}</div>
            </div>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="rounded-sm border border-border bg-card px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground"
            >
              {t("tileGrid.close", "Close ✕")}
            </button>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-[12.5px] sm:grid-cols-4">
            <Stat label={t("tileGrid.status", "Status")} value={
              OCCUPIED_ISOS.has(selectedTile.iso) ? t("tileGrid.statusOccupied", "Occupied / partial")
              : selectedAlert && isActive(selectedTile.iso) ? t("tileGrid.statusActive", "Active alert")
              : t("tileGrid.statusClear", "All clear")
            } />
            <Stat label={t("tileGrid.totalAlarms", "Alarms (total)")} value={fmt(selectedStat?.alarms)} />
            <Stat label={t("tileGrid.avgDuration", "Avg. duration")} value={selectedStat?.avgDuration ?? "—"} />
            <Stat label={t("tileGrid.longest", "Longest")} value={selectedStat?.longest ?? "—"} />
            <Stat label={t("tileGrid.estHours", "Est. alarm hours")} value={`${fmt(alarmHours(selectedStat))}h`} />
            <Stat label={t("tileGrid.explosions", "Explosion reports")} value={fmt(selectedStat?.explosionReports)} />
            {selectedStat?.artilleryThreats != null && (
              <Stat label={t("tileGrid.artillery", "Artillery threats")} value={fmt(selectedStat.artilleryThreats)} />
            )}
            {selectedAlert?.changedAt && (
              <Stat
                label={t("tileGrid.lastChange", "Last state change")}
                value={new Date(selectedAlert.changedAt).toISOString().slice(0, 16).replace("T", " ") + " UTC"}
              />
            )}
          </div>
        </div>
      )}

      <div className="mt-4 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        {t("tileGrid.source", "Sources: alerts.in.ua (live), air-alarms.in.ua (cumulative).")}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
      <div className="mt-0.5 num font-medium text-foreground">{value}</div>
    </div>
  );
}
