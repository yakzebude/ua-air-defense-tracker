import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ComposableMap, Geographies, Geography, ZoomableGroup } from "react-simple-maps";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import oblastStatsData from "@/data/oblastStats.json";

const REFRESH_MS = 30 * 1000;
const OBLASTS_GEO = "/geo/ua-oblasts.geo.json";
const RAIONS_GEO = "/geo/ua-raions.geo.json";
// World countries (TopoJSON, ~100 KB). We render Belarus + Russia underneath
// the Ukraine oblasts so the country borders are visible in context.
const WORLD_GEO = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json";
const NEIGHBOUR_NAMES = new Set(["Belarus", "Russia"]);

/** Oblasts under full or substantial Russian occupation — rendered permanently
 *  in dark red. Active-alert pulsing is suppressed inside these regions. */
const OCCUPIED_ISOS = new Set<string>([
  "UA-43", // Crimea (Autonomous Republic) — occupied since 2014
  "UA-09", // Luhansk
  "UA-14", // Donetsk
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

function fmtNum(n?: number): string {
  if (n === undefined || n === null) return "—";
  return n.toLocaleString("en-US").replace(/,/g, " ");
}

export type AlertState = "none" | "partial" | "full";

export interface OblastAlert {
  id: number | string;
  iso: string;
  name: string;
  nameEn: string;
  active: boolean;
  /** Optional richer state from alerts.in.ua IoT endpoint. */
  state?: AlertState;
  changedAt: string;
  types?: string[];
}

export interface RaionAlert {
  id: string;
  oblastIso: string;
  name: string;
  active: boolean;
  changedAt: string;
  types?: string[];
}

interface ApiPayload {
  updatedAt: string;
  source: string;
  status?: "ok" | "stale" | "unauthorized" | "unavailable";
  oblasts: OblastAlert[];
  raions?: RaionAlert[];
  stale?: boolean;
  error?: string;
}

interface Props {
  variant?: "compact" | "full";
}

function durationLabel(sinceIso: string, active: boolean): string {
  if (!active) return "—";
  const ms = Date.now() - new Date(sinceIso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "—";
  const min = Math.floor(ms / 60_000);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const r = min % 60;
  return r ? `${h}h ${r}m` : `${h}h`;
}

// Normalize Ukrainian raion name for matching (strip trailing "район", whitespace, lowercase).
function normRaion(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s*район\s*$/u, "")
    .replace(/['ʼ’`]/g, "")
    .trim();
}

// Alert type chip labels. UkraineAlarm exposes coarse types only —
// drones vs cruise missiles are NOT distinguished by the upstream API.
function typeLabel(t: string, tt: (k: string) => string): string {
  switch (t) {
    case "AIR": return tt("airAlerts.types.air");
    case "ARTILLERY": return tt("airAlerts.types.artillery");
    case "URBAN_FIGHTS": return tt("airAlerts.types.urban");
    case "CHEMICAL": return tt("airAlerts.types.chemical");
    case "NUCLEAR": return tt("airAlerts.types.nuclear");
    case "INFO": return tt("airAlerts.types.info");
    default: return t;
  }
}

export function AirAlertsMap({ variant = "compact" }: Props) {
  const { t } = useTranslation();
  const [data, setData] = useState<ApiPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [hovered, setHovered] = useState<
    | { kind: "oblast"; iso: string; name: string; nameEn: string; x: number; y: number }
    | { kind: "raion"; name: string; oblastIso: string; x: number; y: number }
    | null
  >(null);
  const [selected, setSelected] = useState<
    | { kind: "oblast"; iso: string; name: string; nameEn: string; alert?: OblastAlert }
    | { kind: "raion"; name: string; oblastIso: string; raion?: RaionAlert }
    | null
  >(null);
  const timerRef = useRef<number | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    const tickTimer = window.setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(tickTimer);
  }, []);

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
    } catch (_e) {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
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

  // Index of active raions: normalized name -> alert. Used to colorize polygons.
  const activeRaionsByName = useMemo(() => {
    const m = new Map<string, RaionAlert>();
    for (const r of data?.raions ?? []) m.set(normRaion(r.name), r);
    return m;
  }, [data]);

  // Only "full" (red) alerts are surfaced. Partial/raion-level states are
  // suppressed per editorial decision — alerts.in.ua live map is the
  // authoritative reference for what counts as an active oblast alert.
  const isFullAlert = (o: OblastAlert): boolean => {
    const s = (o.state ?? (o.active ? "full" : "none")) as AlertState;
    return s === "full";
  };

  // Active count excludes occupied territories — alerts.in.ua marks occupied
  // oblasts as permanently "active" because Russian forces operate from them,
  // but for a free-Ukraine air-raid signal that creates a constant false 4-5
  // baseline. We report only alerts on free Ukrainian territory.
  const activeCount = (data?.oblasts ?? [])
    .filter(isFullAlert)
    .filter((o) => !OCCUPIED_ISOS.has(o.iso))
    .length;
  const activeRaionCount = (data?.raions ?? []).filter((r) => !OCCUPIED_ISOS.has(r.oblastIso)).length;


  // Active alerts list — full-state oblasts only, excluding occupied territories
  // (per editorial decision: occupied regions are always "under threat" by
  // definition and would dominate the live signal). Sorted alphabetically.
  const activeList = useMemo(() => {
    return (data?.oblasts ?? [])
      .filter(isFullAlert)
      .filter((o) => !OCCUPIED_ISOS.has(o.iso))
      .map((o) => ({ ...o, state: "full" as AlertState }))
      .sort((a, b) => a.nameEn.localeCompare(b.nameEn));
  }, [data]);


  const unauthorized = data?.status === "unauthorized";

  // Raion subdivisions are always drawn on the full map (thin grey borders).
  // Active raions inside non-occupied oblasts pulse red on top.
  const showRaions = variant === "full";

  // Map sizes to fill its panel. The full variant fills a fixed-height
  // container so the map and the threat feed read as equal blocks side-by-side.
  const mapHeightClass = variant === "full"
    ? "h-[460px] sm:h-[560px] lg:h-[640px]"
    : "h-[300px] sm:h-[380px] lg:h-[420px]";

  return (
    <div className="relative flex flex-col">
      <div
        className={`relative flex-1 overflow-hidden rounded border border-border bg-card ${mapHeightClass}`}
        onMouseLeave={() => setHovered(null)}
      >
        <ComposableMap
          projection="geoMercator"
          projectionConfig={{ scale: variant === "full" ? 2800 : 2200, center: [31.5, 49] }}
          width={1000}
          height={variant === "full" ? 680 : 420}
          style={{ width: "100%", height: "100%" }}
        >
          <ZoomableGroup zoom={1} minZoom={1} maxZoom={variant === "full" ? 6 : 1}>
            {/* Belarus + Russia underlay for geographic context. Drawn first so
                Ukraine oblasts sit on top and the UA border reads clearly. */}
            <Geographies geography={WORLD_GEO}>
              {({ geographies }) =>
                geographies
                  .filter((g) => NEIGHBOUR_NAMES.has(g.properties.name as string))
                  .map((geo) => (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      style={{
                        default: {
                          fill: "hsl(var(--muted) / 0.4)",
                          stroke: "hsl(var(--muted-foreground) / 0.5)",
                          strokeWidth: 0.5,
                          outline: "none",
                          pointerEvents: "none",
                        },
                        hover: { fill: "hsl(var(--muted) / 0.4)", outline: "none", pointerEvents: "none" },
                        pressed: { outline: "none" },
                      }}
                    />
                  ))
              }
            </Geographies>


            {/* Oblast polygons */}
            <Geographies geography={OBLASTS_GEO}>
              {({ geographies }) =>
                geographies.map((geo) => {
                  const iso = geo.properties.iso as string;
                  const name = (geo.properties.name as string) ?? iso;
                  const nameEn = (geo.properties.name_en as string) ?? name;
                  const alert = byIso.get(iso);
                  const rawState: AlertState = alert?.state ?? (alert?.active ? "full" : "none");
                  const state: AlertState = rawState === "full" ? "full" : "none";
                  const occupied = OCCUPIED_ISOS.has(iso);
                  // Occupied territories are rendered permanently dark red and
                  // never pulse — active-alert signalling only applies to free
                  // Ukrainian territory.
                  const isActive = state === "full" && !occupied;

                  const baseFill = occupied
                    ? "hsl(var(--occupied))"
                    : isActive
                      ? "hsl(var(--signal) / 0.65)"
                      : "hsl(var(--muted))";
                  const hoverFill = occupied
                    ? "hsl(var(--occupied))"
                    : isActive
                      ? "hsl(var(--signal) / 0.85)"
                      : "hsl(var(--muted-foreground) / 0.4)";

                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      onMouseEnter={(e) => {
                        const cont = (e.currentTarget.closest("div") as HTMLDivElement | null)
                          ?.getBoundingClientRect();
                        setHovered({
                          kind: "oblast",
                          iso, name, nameEn,
                          x: e.clientX - (cont?.left ?? 0),
                          y: e.clientY - (cont?.top ?? 0),
                        });
                      }}
                      onMouseMove={(e) => {
                        const cont = (e.currentTarget.closest("div") as HTMLDivElement | null)
                          ?.getBoundingClientRect();
                        setHovered({
                          kind: "oblast",
                          iso, name, nameEn,
                          x: e.clientX - (cont?.left ?? 0),
                          y: e.clientY - (cont?.top ?? 0),
                        });
                      }}
                      onClick={() => {
                        if (variant === "full") setSelected({ kind: "oblast", iso, name, nameEn, alert });
                      }}
                      style={{
                        default: {
                          fill: baseFill,
                          stroke: "hsl(var(--foreground) / 0.6)",
                          strokeWidth: 0.7,
                          outline: "none",
                          transition: "fill 200ms ease",
                          cursor: variant === "full" ? "pointer" : "default",
                        },
                        hover: {
                          fill: hoverFill,
                          stroke: "hsl(var(--foreground) / 0.85)",
                          strokeWidth: 0.9,
                          outline: "none",
                          cursor: variant === "full" ? "pointer" : "default",
                        },
                        pressed: { fill: baseFill, outline: "none" },
                      }}
                      className={isActive ? "air-alert-pulse" : undefined}
                    />
                  );
                })
              }
            </Geographies>

            {/* Raion subdivisions. Always drawn on the full map as thin
                borders so visitors can read alert geography at finer than
                oblast resolution. Active raions in non-occupied oblasts
                pulse red on top of their parent oblast. Raions inside
                occupied territory are skipped — those areas stay solid
                dark red. */}
            {showRaions && (
              <Geographies geography={RAIONS_GEO}>
                {({ geographies }) =>
                  geographies.map((geo) => {
                    const name = geo.properties.name as string;
                    const oblastIso = geo.properties.iso as string;
                    const occupied = OCCUPIED_ISOS.has(oblastIso);
                    const raion = activeRaionsByName.get(normRaion(name));
                    // Occupied raions never count as active alerts — even when
                    // alerts.in.ua marks them so. They render as thin light-grey
                    // subdivision borders on top of the dark-red oblast fill.
                    const isActive = !!raion && !occupied;
                    return (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        onMouseEnter={(e) => {
                          if (!isActive) return;
                          const cont = (e.currentTarget.closest("div") as HTMLDivElement | null)
                            ?.getBoundingClientRect();
                          setHovered({
                            kind: "raion",
                            name,
                            oblastIso,
                            x: e.clientX - (cont?.left ?? 0),
                            y: e.clientY - (cont?.top ?? 0),
                          });
                        }}
                        onMouseMove={(e) => {
                          if (!isActive) return;
                          const cont = (e.currentTarget.closest("div") as HTMLDivElement | null)
                            ?.getBoundingClientRect();
                          setHovered({
                            kind: "raion",
                            name,
                            oblastIso,
                            x: e.clientX - (cont?.left ?? 0),
                            y: e.clientY - (cont?.top ?? 0),
                          });
                        }}
                        style={{
                          default: {
                            fill: isActive ? "hsl(var(--signal) / 0.9)" : "transparent",
                            stroke: occupied
                              ? "hsl(0 0% 88% / 0.45)"
                              : "hsl(var(--foreground) / 0.22)",
                            strokeWidth: occupied ? 0.3 : 0.25,
                            outline: "none",
                            transition: "fill 200ms ease",
                            pointerEvents: isActive ? "auto" : "none",
                          },
                          hover: {
                            fill: isActive ? "hsl(var(--signal))" : "transparent",
                            stroke: occupied
                              ? "hsl(0 0% 88% / 0.45)"
                              : "hsl(var(--foreground) / 0.35)",
                            strokeWidth: occupied ? 0.3 : 0.4,
                            outline: "none",
                          },
                          pressed: { outline: "none" },
                        }}
                        className={isActive ? "air-alert-pulse" : undefined}
                      />
                    );
                  })
                }
              </Geographies>
            )}
          </ZoomableGroup>
        </ComposableMap>

        {/* Overlay: live active-count badge + legend, top-right of the map. */}
        {variant === "full" && (
          <div className="pointer-events-none absolute right-3 top-3 flex flex-col items-end gap-1.5">
            <div className="rounded border border-border bg-background/85 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.16em] backdrop-blur">
              <span className="text-muted-foreground">Active alerts</span>{" "}
              <span className="tabular-nums font-semibold text-foreground">{activeCount}</span>
            </div>
            <div className="flex items-center gap-2 rounded border border-border bg-background/85 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground backdrop-blur">
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-sm bg-[hsl(var(--occupied))]" /> Occupied
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-sm bg-[hsl(var(--signal))]" /> Alert
              </span>
            </div>
          </div>
        )}

        {/* Hover tooltip */}
        {hovered && (() => {
          if (hovered.kind === "oblast") {
            const o = byIso.get(hovered.iso);
            const stat = OBLAST_STATS.regions[hovered.iso];
            return (
              <div
                className="pointer-events-none absolute z-10 rounded border border-border bg-background/95 px-3 py-2 text-xs font-mono shadow-lg backdrop-blur min-w-[180px]"
                style={{ left: hovered.x + 12, top: Math.max(hovered.y - 8, 4), transform: "translateY(-100%)" }}
              >
                <div className="font-semibold text-foreground">{hovered.nameEn}</div>
                <div className="text-[10px] text-muted-foreground">{hovered.name}</div>
                <div className="mt-1 text-muted-foreground">
                  {o?.active ? (
                    <>
                      <span className="text-[hsl(var(--signal))]">● {t("airAlerts.active")}</span>
                      <span className="ml-2">{durationLabel(o.changedAt, true)}</span>
                    </>
                  ) : (
                    <span>{t("airAlerts.clear")}</span>
                  )}
                </div>
                {o?.active && o.types && o.types.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {o.types.map((tp) => (
                      <span key={tp} className="rounded bg-[hsl(var(--signal)/0.2)] px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-foreground">
                        {typeLabel(tp, t)}
                      </span>
                    ))}
                  </div>
                )}
                {stat && (
                  <div className="mt-2 pt-2 border-t border-border/60 space-y-0.5 text-[10px]">
                    <div className="flex justify-between gap-3">
                      <span className="text-muted-foreground uppercase tracking-wider">{t("airAlerts.statsAlerts")}</span>
                      <span className="tabular-nums text-foreground">{fmtNum(stat.alarms)}</span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-muted-foreground uppercase tracking-wider">{t("airAlerts.statsExplosions")}</span>
                      <span className="tabular-nums text-foreground">{fmtNum(stat.explosionReports)}</span>
                    </div>
                    {stat.artilleryThreats !== undefined && (
                      <div className="flex justify-between gap-3">
                        <span className="text-muted-foreground uppercase tracking-wider">{t("airAlerts.statsArtillery")}</span>
                        <span className="tabular-nums text-foreground">{fmtNum(stat.artilleryThreats)}</span>
                      </div>
                    )}
                    <div className="pt-1 text-[9px] text-muted-foreground/70">{t("airAlerts.statsSince", { date: OBLAST_STATS.periodStart })}</div>
                  </div>
                )}
              </div>
            );
          }
          // raion
          const r = activeRaionsByName.get(normRaion(hovered.name));
          if (!r) return null;
          return (
            <div
              className="pointer-events-none absolute z-10 rounded border border-border bg-background/95 px-3 py-2 text-xs font-mono shadow-lg backdrop-blur"
              style={{ left: hovered.x + 12, top: Math.max(hovered.y - 8, 4), transform: "translateY(-100%)" }}
            >
              <div className="font-semibold text-foreground">{r.name}</div>
              <div className="mt-0.5">
                <span className="text-[hsl(var(--signal))]">● {t("airAlerts.active")}</span>
                <span className="ml-2 text-muted-foreground">{durationLabel(r.changedAt, true)}</span>
              </div>
              {r.types && r.types.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {r.types.map((tp) => (
                    <span key={tp} className="rounded bg-[hsl(var(--signal)/0.2)] px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-foreground">
                      {typeLabel(tp, t)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-[hsl(var(--signal))]" />
            {t("airAlerts.fullAlert", { defaultValue: "Full alert" })}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-muted" />
            {t("airAlerts.legendClear")}
          </span>


          <span className="text-foreground">
            {t("airAlerts.activeNow", { count: activeCount })}
            {showRaions && activeRaionCount > 0 && (
              <span className="ml-2 text-muted-foreground">
                · {t("airAlerts.activeRaions", { count: activeRaionCount })}
              </span>
            )}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {loading && (
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[hsl(var(--signal-warn))]" />
              {t("airAlerts.loading")}
            </span>
          )}
          {error && !data && (
            <span className="inline-flex items-center gap-1.5 text-[hsl(var(--signal))]" title="Upstream alerts feed temporarily unreachable. Showing latest cached data.">
              <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--signal))]" />
              Live feed unavailable — showing cached data
            </span>
          )}
          {data && (
            <span className="inline-flex items-center gap-1.5">
              <span className={`h-1.5 w-1.5 rounded-full ${data.stale ? "bg-[hsl(var(--signal-warn))]" : "bg-[hsl(var(--signal-ok))]"}`} />
              {data.stale ? "Delayed" : "Operational"} · {t("airAlerts.lastUpdate")}: {new Date(data.updatedAt).toUTCString().slice(17, 22)} UTC
            </span>
          )}
          {variant === "compact" && (
            <Link to="/alerts" className="text-foreground underline-offset-4 hover:underline">
              {t("airAlerts.viewFull")} →
            </Link>
          )}
        </div>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-mono text-muted-foreground">
        <span>
          {t("airAlerts.source")}:{" "}
          <a
            href="https://alerts.in.ua"
            target="_blank"
            rel="noopener noreferrer"
            className="underline-offset-4 hover:underline"
          >
            alerts.in.ua
          </a>
        </span>
        {showRaions && (
          <span className="text-muted-foreground/80">{t("airAlerts.threatTypeNote")}</span>
        )}
      </div>

      {/* Detail panel */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent side="right" className="font-mono">
          {selected?.kind === "oblast" && (() => {
            const alertSel = selected.alert;
            const stat = OBLAST_STATS.regions[selected.iso];
            const raionList = (data?.raions ?? []).filter((r) => r.oblastIso === selected.iso);
            return (
              <>
                <SheetHeader>
                  <SheetTitle>{selected.nameEn || selected.name}</SheetTitle>
                  <SheetDescription>{selected.name}</SheetDescription>
                </SheetHeader>
                <div className="mt-6 space-y-4 text-sm">
                  <div>
                    <div className="src-label mb-1">{t("airAlerts.status")}</div>
                    {alertSel?.active ? (
                      <div className="text-[hsl(var(--signal))] font-semibold">
                        ● {t("airAlerts.active")} — {durationLabel(alertSel.changedAt, true)}
                      </div>
                    ) : (
                      <div className="text-muted-foreground">{t("airAlerts.clear")}</div>
                    )}
                  </div>
                  {alertSel?.active && alertSel.types && alertSel.types.length > 0 && (
                    <div>
                      <div className="src-label mb-1">{t("airAlerts.threatType")}</div>
                      <div className="flex flex-wrap gap-1.5">
                        {alertSel.types.map((tp) => (
                          <span key={tp} className="rounded bg-[hsl(var(--signal)/0.2)] px-2 py-0.5 text-[11px] uppercase tracking-wider text-foreground">
                            {typeLabel(tp, t)}
                          </span>
                        ))}
                      </div>
                      <p className="mt-2 text-[10px] text-muted-foreground/80">{t("airAlerts.threatTypeNote")}</p>
                    </div>
                  )}
                  {alertSel && (
                    <div>
                      <div className="src-label mb-1">{t("airAlerts.changedAt")}</div>
                      <div>{new Date(alertSel.changedAt).toUTCString()}</div>
                    </div>
                  )}
                  {stat && (
                    <div className="pt-4 border-t border-border space-y-2">
                      <div className="src-label">{t("airAlerts.statsHeading", { date: OBLAST_STATS.periodStart })}</div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                        <div>
                          <div className="text-muted-foreground text-[10px] uppercase tracking-wider">{t("airAlerts.statsAlerts")}</div>
                          <div className="text-base font-semibold tabular-nums">{fmtNum(stat.alarms)}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground text-[10px] uppercase tracking-wider">{t("airAlerts.statsExplosions")}</div>
                          <div className="text-base font-semibold tabular-nums">{fmtNum(stat.explosionReports)}</div>
                        </div>
                        {stat.avgDuration && (
                          <div>
                            <div className="text-muted-foreground text-[10px] uppercase tracking-wider">{t("airAlerts.statsAvgDuration")}</div>
                            <div className="tabular-nums">{stat.avgDuration}</div>
                          </div>
                        )}
                        {stat.longest && (
                          <div>
                            <div className="text-muted-foreground text-[10px] uppercase tracking-wider">{t("airAlerts.statsLongest")}</div>
                            <div className="tabular-nums">{stat.longest}</div>
                          </div>
                        )}
                        {stat.artilleryThreats !== undefined && (
                          <div className="col-span-2">
                            <div className="text-muted-foreground text-[10px] uppercase tracking-wider">{t("airAlerts.statsArtillery")}</div>
                            <div className="text-base font-semibold tabular-nums">{fmtNum(stat.artilleryThreats)}</div>
                          </div>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground/80">
                        {t("airAlerts.statsSource")}:{" "}
                        <a href={OBLAST_STATS.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 hover:text-foreground">
                          {OBLAST_STATS.source}
                        </a>
                        {" · "}
                        {t("airAlerts.statsAsOf", { date: OBLAST_STATS.asOf })}
                      </p>
                    </div>
                  )}
                  {raionList.length > 0 && (
                    <div>
                      <div className="src-label mb-2">
                        {t("airAlerts.activeRaions", { count: raionList.length })}
                      </div>
                      <ul className="space-y-1 text-xs">
                        {raionList.map((r) => (
                          <li key={r.id} className="flex items-center justify-between gap-3">
                            <button
                              type="button"
                              onClick={() => setSelected({ kind: "raion", name: r.name, oblastIso: r.oblastIso, raion: r })}
                              className="truncate text-left hover:underline underline-offset-4"
                            >
                              {r.name}
                            </button>
                            <span className="text-[hsl(var(--signal))] tabular-nums">
                              {durationLabel(r.changedAt, true)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="pt-4 border-t border-border">
                    <a href="https://alerts.in.ua" target="_blank" rel="noopener noreferrer" className="text-xs underline underline-offset-4 hover:text-foreground">
                      {t("airAlerts.openSource")} →
                    </a>
                  </div>
                </div>
              </>
            );
          })()}

          {selected?.kind === "raion" && (() => {
            const r = selected.raion;
            const parent = byIso.get(selected.oblastIso);
            return (
              <>
                <SheetHeader>
                  <SheetTitle>{selected.name}</SheetTitle>
                  <SheetDescription>
                    {parent ? `${parent.nameEn} · ${parent.name}` : selected.oblastIso}
                  </SheetDescription>
                </SheetHeader>
                <div className="mt-6 space-y-4 text-sm">
                  <div>
                    <div className="src-label mb-1">{t("airAlerts.status")}</div>
                    {r?.active ? (
                      <div className="text-[hsl(var(--signal))] font-semibold">
                        ● {t("airAlerts.active")} — {durationLabel(r.changedAt, true)}
                      </div>
                    ) : (
                      <div className="text-muted-foreground">{t("airAlerts.clear")}</div>
                    )}
                  </div>
                  {r?.active && r.types && r.types.length > 0 && (
                    <div>
                      <div className="src-label mb-1">{t("airAlerts.threatType")}</div>
                      <div className="flex flex-wrap gap-1.5">
                        {r.types.map((tp) => (
                          <span key={tp} className="rounded bg-[hsl(var(--signal)/0.2)] px-2 py-0.5 text-[11px] uppercase tracking-wider text-foreground">
                            {typeLabel(tp, t)}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {r && (
                    <div>
                      <div className="src-label mb-1">{t("airAlerts.changedAt")}</div>
                      <div>{new Date(r.changedAt).toUTCString()}</div>
                    </div>
                  )}
                  <div className="pt-4 border-t border-border">
                    <a
                      href={`https://alerts.in.ua/`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs underline underline-offset-4 hover:text-foreground"
                    >
                      {t("airAlerts.openSource")} →
                    </a>
                  </div>
                </div>
              </>
            );
          })()}
        </SheetContent>
      </Sheet>

      {/* Active alerts — inline chip strip below the map.
          Folds the former right-hand sidebar into the same block so the map
          panel itself communicates which regions are currently under alert. */}
      {variant === "full" && (
        <div className="mt-3 rounded border border-border bg-card p-3">
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <h3 className="text-[11px] font-mono uppercase tracking-[0.16em] text-foreground">
              {t("airAlerts.sidePanelTitle", { defaultValue: "Active alerts" })}
            </h3>
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground tabular-nums">
              {activeList.length} / 22
            </span>
          </div>

          {unauthorized && (
            <div className="rounded border border-[hsl(var(--signal-warn)/0.4)] bg-[hsl(var(--signal-warn)/0.08)] px-2.5 py-1.5 text-[11px] text-foreground">
              {t("airAlerts.feedUnauthorized", {
                defaultValue: "Live feed authentication failed.",
              })}
            </div>
          )}

          {!unauthorized && activeList.length === 0 && (
            <div className="rounded border border-[hsl(var(--signal-ok)/0.4)] bg-[hsl(var(--signal-ok)/0.08)] px-2.5 py-1.5 text-[11px] text-foreground">
              {t("airAlerts.noActiveAlerts", { defaultValue: "No active air-raid alerts in unoccupied territory." })}
            </div>
          )}

          {!unauthorized && activeList.length > 0 && (
            <ul className="flex flex-wrap gap-1.5">
              {activeList.map((o) => (
                <li
                  key={o.iso}
                  className="inline-flex items-center gap-1.5 rounded border border-[hsl(var(--signal)/0.45)] bg-[hsl(var(--signal)/0.10)] px-2 py-0.5 text-[11px]"
                >
                  <span className="text-foreground">{o.nameEn}</span>
                  <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
                    {durationLabel(o.changedAt, true)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export default AirAlertsMap;
