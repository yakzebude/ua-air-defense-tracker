import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from "react-simple-maps";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

const REFRESH_MS = 5 * 60 * 1000;
const GEO_URL = "/geo/ua-oblasts.geo.json";
const KYIV_CITY_ISO = "UA-30";
const KYIV_CITY_COORDS: [number, number] = [30.5234, 50.4501];

export interface OblastAlert {
  id: number;
  iso: string;
  name: string;
  nameEn: string;
  active: boolean;
  changedAt: string;
}

interface ApiPayload {
  updatedAt: string;
  source: string;
  oblasts: OblastAlert[];
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

export function AirAlertsMap({ variant = "compact" }: Props) {
  const { t } = useTranslation();
  const [data, setData] = useState<ApiPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [hovered, setHovered] = useState<{ iso: string; x: number; y: number } | null>(null);
  const [selected, setSelected] = useState<OblastAlert | null>(null);
  const timerRef = useRef<number | null>(null);
  // Force-rerender every 60s so durations stay current.
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

  const kyivCity = byIso.get(KYIV_CITY_ISO);
  const activeCount = (data?.oblasts ?? []).filter((o) => o.active).length;

  const height = variant === "full" ? 640 : 420;

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
          <ZoomableGroup zoom={1} minZoom={1} maxZoom={variant === "full" ? 5 : 1}>
            <Geographies geography={GEO_URL}>
              {({ geographies }) =>
                geographies.map((geo) => {
                  const iso = geo.properties.iso as string;
                  const alert = byIso.get(iso);
                  const isActive = !!alert?.active;
                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      onMouseEnter={(e) => {
                        const rect = (e.currentTarget.ownerSVGElement as SVGSVGElement | null)
                          ?.getBoundingClientRect();
                        const cont = (e.currentTarget.closest("div") as HTMLDivElement | null)
                          ?.getBoundingClientRect();
                        setHovered({
                          iso,
                          x: e.clientX - (cont?.left ?? 0),
                          y: e.clientY - (cont?.top ?? 0),
                        });
                        void rect;
                      }}
                      onMouseMove={(e) => {
                        const cont = (e.currentTarget.closest("div") as HTMLDivElement | null)
                          ?.getBoundingClientRect();
                        setHovered({
                          iso,
                          x: e.clientX - (cont?.left ?? 0),
                          y: e.clientY - (cont?.top ?? 0),
                        });
                      }}
                      onClick={() => {
                        if (variant === "full" && alert) setSelected(alert);
                      }}
                      style={{
                        default: {
                          fill: isActive ? "hsl(var(--signal) / 0.85)" : "hsl(var(--muted))",
                          stroke: "hsl(var(--background))",
                          strokeWidth: 0.6,
                          outline: "none",
                          transition: "fill 200ms ease",
                          cursor: variant === "full" ? "pointer" : "default",
                        },
                        hover: {
                          fill: isActive ? "hsl(var(--signal))" : "hsl(var(--muted-foreground) / 0.4)",
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

            {/* Kyiv City marker — separate from Kyiv Oblast in upstream data */}
            {kyivCity && (
              <Marker
                coordinates={KYIV_CITY_COORDS}
                onMouseEnter={(e) => {
                  const cont = (e.currentTarget.closest("div") as HTMLDivElement | null)
                    ?.getBoundingClientRect();
                  setHovered({
                    iso: KYIV_CITY_ISO,
                    x: e.clientX - (cont?.left ?? 0),
                    y: e.clientY - (cont?.top ?? 0),
                  });
                }}
                onClick={() => {
                  if (variant === "full") setSelected(kyivCity);
                }}
              >
                <circle
                  r={5}
                  fill={kyivCity.active ? "hsl(var(--signal))" : "hsl(var(--foreground))"}
                  stroke="hsl(var(--background))"
                  strokeWidth={1.2}
                  className={kyivCity.active ? "air-alert-pulse" : undefined}
                  style={{ cursor: variant === "full" ? "pointer" : "default" }}
                />
              </Marker>
            )}
          </ZoomableGroup>
        </ComposableMap>

        {/* Hover tooltip */}
        {hovered && (() => {
          const o = byIso.get(hovered.iso);
          if (!o) return null;
          return (
            <div
              className="pointer-events-none absolute z-10 rounded border border-border bg-background/95 px-3 py-2 text-xs font-mono shadow-lg backdrop-blur"
              style={{
                left: Math.min(hovered.x + 12, 9999),
                top: Math.max(hovered.y - 8, 4),
                transform: "translateY(-100%)",
              }}
            >
              <div className="font-semibold text-foreground">{o.nameEn || o.name}</div>
              <div className="mt-0.5 text-muted-foreground">
                {o.active ? (
                  <>
                    <span className="text-[hsl(var(--signal))]">● {t("airAlerts.active")}</span>
                    <span className="ml-2">{durationLabel(o.changedAt, true)}</span>
                  </>
                ) : (
                  <span>{t("airAlerts.clear")}</span>
                )}
              </div>
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
      <div className="mt-1 text-[10px] font-mono text-muted-foreground">
        {t("airAlerts.source")}:{" "}
        <a
          href="https://alerts.com.ua"
          target="_blank"
          rel="noopener noreferrer"
          className="underline-offset-4 hover:underline"
        >
          alerts.com.ua
        </a>
      </div>

      {/* Detail panel */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent side="right" className="font-mono">
          <SheetHeader>
            <SheetTitle>{selected?.nameEn || selected?.name}</SheetTitle>
            <SheetDescription>{selected?.name}</SheetDescription>
          </SheetHeader>
          {selected && (
            <div className="mt-6 space-y-4 text-sm">
              <div>
                <div className="src-label mb-1">{t("airAlerts.status")}</div>
                {selected.active ? (
                  <div className="text-[hsl(var(--signal))] font-semibold">
                    ● {t("airAlerts.active")} — {durationLabel(selected.changedAt, true)}
                  </div>
                ) : (
                  <div className="text-muted-foreground">{t("airAlerts.clear")}</div>
                )}
              </div>
              <div>
                <div className="src-label mb-1">{t("airAlerts.changedAt")}</div>
                <div>{new Date(selected.changedAt).toUTCString()}</div>
              </div>
              <div className="pt-4 border-t border-border">
                <a
                  href={`https://alerts.com.ua`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs underline underline-offset-4 hover:text-foreground"
                >
                  {t("airAlerts.openSource")} →
                </a>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

export default AirAlertsMap;
