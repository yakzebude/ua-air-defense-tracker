import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ComposableMap, Geographies, Geography, ZoomableGroup } from "react-simple-maps";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import oblastStatsData from "@/data/oblastStats.json";

const REFRESH_MS = 1 * 60 * 1000;
const OBLASTS_GEO = "/geo/ua-oblasts.geo.json";
const RAIONS_GEO = "/geo/ua-raions.geo.json";
// World countries (TopoJSON, ~100 KB). We render Belarus + Russia underneath
// the Ukraine oblasts so the country borders are visible in context.
const WORLD_GEO = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json";
const NEIGHBOUR_NAMES = new Set(["Belarus", "Russia"]);

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

export interface OblastAlert {
  id: number | string;
  iso: string;
  name: string;
  nameEn: string;
  active: boolean;
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
  const [selected, setSelected] = useState<{ iso: string; name: string; nameEn: string; alert?: OblastAlert } | null>(null);
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

  const activeCount = (data?.oblasts ?? []).filter((o) => o.active).length;
  const activeRaionCount = (data?.raions ?? []).length;
  const height = variant === "full" ? 640 : 420;

  // Raion layer disabled by user request — full map shows oblast-level only.
  const showRaions = false;

  return (
    <div className="relative">
      <div
        className="relative overflow-hidden rounded border border-border bg-card"
        style={{ height }}
        onMouseLeave={() => setHovered(null)}
      >
        <ComposableMap
          projection="geoMercator"
          projectionConfig={{ scale: variant === "full" ? 2400 : 1800, center: [31.5, 49] }}
          width={1000}
          height={height}
          style={{ width: "100%", height: "100%" }}
        >
          <ZoomableGroup zoom={1} minZoom={1} maxZoom={variant === "full" ? 6 : 1}>
            {/* Oblast polygons */}
            <Geographies geography={OBLASTS_GEO}>
              {({ geographies }) =>
                geographies.map((geo) => {
                  const iso = geo.properties.iso as string;
                  const name = (geo.properties.name as string) ?? iso;
                  const nameEn = (geo.properties.name_en as string) ?? name;
                  const alert = byIso.get(iso);
                  const isActive = !!alert?.active;
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
                        if (variant === "full") setSelected({ iso, name, nameEn, alert });
                      }}
                      style={{
                        default: {
                          fill: isActive ? "hsl(var(--signal) / 0.55)" : "hsl(var(--muted))",
                          stroke: "hsl(var(--background))",
                          strokeWidth: 0.6,
                          outline: "none",
                          transition: "fill 200ms ease",
                          cursor: variant === "full" ? "pointer" : "default",
                        },
                        hover: {
                          fill: isActive ? "hsl(var(--signal) / 0.75)" : "hsl(var(--muted-foreground) / 0.4)",
                          stroke: "hsl(var(--background))",
                          strokeWidth: 0.8,
                          outline: "none",
                          cursor: variant === "full" ? "pointer" : "default",
                        },
                        pressed: { fill: "hsl(var(--signal))", outline: "none" },
                      }}
                      className={isActive ? "air-alert-pulse" : undefined}
                    />
                  );
                })
              }
            </Geographies>

            {/* Raion polygons — only on full map. Drawn above oblasts so active raions stand out. */}
            {showRaions && (
              <Geographies geography={RAIONS_GEO}>
                {({ geographies }) =>
                  geographies.map((geo) => {
                    const name = geo.properties.name as string;
                    const oblastIso = geo.properties.iso as string;
                    const raion = activeRaionsByName.get(normRaion(name));
                    const isActive = !!raion;
                    return (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        onMouseEnter={(e) => {
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
                            fill: isActive ? "hsl(var(--signal) / 0.95)" : "transparent",
                            stroke: "hsl(var(--foreground) / 0.15)",
                            strokeWidth: 0.3,
                            outline: "none",
                            transition: "fill 200ms ease",
                            pointerEvents: isActive ? "auto" : "none",
                          },
                          hover: {
                            fill: isActive ? "hsl(var(--signal))" : "transparent",
                            stroke: "hsl(var(--foreground) / 0.3)",
                            strokeWidth: 0.5,
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
            {t("airAlerts.legendAlert")}
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
          {loading && <span>{t("airAlerts.loading")}</span>}
          {error && !data && (
            <span className="text-[hsl(var(--signal))]">{t("airAlerts.error")}</span>
          )}
          {data && (
            <span>
              {t("airAlerts.lastUpdate")}: {new Date(data.updatedAt).toUTCString().slice(17, 22)} UTC
              {data.stale && ` (${t("airAlerts.stale")})`}
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
            href="https://www.ukrainealarm.com"
            target="_blank"
            rel="noopener noreferrer"
            className="underline-offset-4 hover:underline"
          >
            ukrainealarm.com
          </a>
        </span>
        {showRaions && (
          <span className="text-muted-foreground/80">{t("airAlerts.threatTypeNote")}</span>
        )}
      </div>

      {/* Detail panel */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent side="right" className="font-mono">
          <SheetHeader>
            <SheetTitle>{selected?.nameEn || selected?.name}</SheetTitle>
            <SheetDescription>{selected?.name}</SheetDescription>
          </SheetHeader>
          {selected && (() => {
            const alertSel = selected.alert;
            const stat = OBLAST_STATS.regions[selected.iso];
            return (
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
                  <p className="mt-2 text-[10px] text-muted-foreground/80">
                    {t("airAlerts.threatTypeNote")}
                  </p>
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
                  <div className="src-label">
                    {t("airAlerts.statsHeading", { date: OBLAST_STATS.periodStart })}
                  </div>
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

              {(() => {
                const list = (data?.raions ?? []).filter((r) => r.oblastIso === selected.iso);
                if (!list.length) return null;
                return (
                  <div>
                    <div className="src-label mb-2">
                      {t("airAlerts.activeRaions", { count: list.length })}
                    </div>
                    <ul className="space-y-1 text-xs">
                      {list.map((r) => (
                        <li key={r.id} className="flex items-center justify-between gap-3">
                          <span className="truncate">{r.name}</span>
                          <span className="text-[hsl(var(--signal))] tabular-nums">
                            {durationLabel(r.changedAt, true)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })()}
              <div className="pt-4 border-t border-border">
                <a
                  href="https://www.ukrainealarm.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs underline underline-offset-4 hover:text-foreground"
                >
                  {t("airAlerts.openSource")} →
                </a>
              </div>
            </div>
            );
          })()}
        </SheetContent>
      </Sheet>
    </div>
  );
}

export default AirAlertsMap;
