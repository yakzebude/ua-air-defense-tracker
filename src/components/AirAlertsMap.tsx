import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from "react-simple-maps";
import { geoCentroid } from "d3-geo";
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

/** Short oblast codes per language. EN/DE/FR use Latin abbreviations;
 *  UK uses 3-letter Cyrillic abbreviations. Falls back to EN. */
const OBLAST_CODES: Record<"en" | "de" | "fr" | "uk", Record<string, string>> = {
  en: {
    "UA-71": "CHK", "UA-74": "CHR", "UA-77": "CHV", "UA-43": "CRI",
    "UA-12": "DNI", "UA-14": "DON", "UA-26": "IVF", "UA-63": "KHA",
    "UA-65": "KHE", "UA-68": "KHM", "UA-30": "KYV", "UA-32": "KYO",
    "UA-35": "KIR", "UA-09": "LUH", "UA-46": "LVI", "UA-48": "MYK",
    "UA-51": "ODE", "UA-53": "POL", "UA-56": "RIV", "UA-59": "SUM",
    "UA-61": "TER", "UA-05": "VIN", "UA-07": "VOL", "UA-21": "ZAK",
    "UA-23": "ZAP", "UA-18": "ZHY",
  },
  de: {
    "UA-71": "TSK", "UA-74": "TSN", "UA-77": "TSW", "UA-43": "KRI",
    "UA-12": "DNI", "UA-14": "DON", "UA-26": "IFR", "UA-63": "CHA",
    "UA-65": "CHE", "UA-68": "CHM", "UA-30": "KYI", "UA-32": "KYG",
    "UA-35": "KIR", "UA-09": "LUH", "UA-46": "LWI", "UA-48": "MYK",
    "UA-51": "ODE", "UA-53": "POL", "UA-56": "RIW", "UA-59": "SUM",
    "UA-61": "TER", "UA-05": "WYN", "UA-07": "WOL", "UA-21": "TRK",
    "UA-23": "SAP", "UA-18": "SCH",
  },
  fr: {
    "UA-71": "TCK", "UA-74": "TCN", "UA-77": "TCV", "UA-43": "CRI",
    "UA-12": "DNI", "UA-14": "DON", "UA-26": "IVF", "UA-63": "KHA",
    "UA-65": "KHE", "UA-68": "KHM", "UA-30": "KYV", "UA-32": "KYO",
    "UA-35": "KIR", "UA-09": "LOU", "UA-46": "LVI", "UA-48": "MYK",
    "UA-51": "ODE", "UA-53": "POL", "UA-56": "RIV", "UA-59": "SOU",
    "UA-61": "TER", "UA-05": "VIN", "UA-07": "VOL", "UA-21": "TCR",
    "UA-23": "ZAP", "UA-18": "JYT",
  },
  uk: {
    "UA-71": "ЧРК", "UA-74": "ЧРН", "UA-77": "ЧРВ", "UA-43": "КРМ",
    "UA-12": "ДНП", "UA-14": "ДОН", "UA-26": "ІВФ", "UA-63": "ХРК",
    "UA-65": "ХРС", "UA-68": "ХМЛ", "UA-30": "КИЇ", "UA-32": "КИО",
    "UA-35": "КРВ", "UA-09": "ЛУГ", "UA-46": "ЛЬВ", "UA-48": "МИК",
    "UA-51": "ОДС", "UA-53": "ПЛТ", "UA-56": "РВН", "UA-59": "СУМ",
    "UA-61": "ТРН", "UA-05": "ВНН", "UA-07": "ВЛН", "UA-21": "ЗАК",
    "UA-23": "ЗПР", "UA-18": "ЖТМ",
  },
};


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
  const { t, i18n } = useTranslation();
  const lang = ((i18n.language || "en").slice(0, 2) as "en" | "de" | "fr" | "uk");
  const codeMap = OBLAST_CODES[lang] ?? OBLAST_CODES.en;
  const [data, setData] = useState<ApiPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [hovered, setHovered] = useState<
    | { kind: "oblast"; iso: string; name: string; nameEn: string; x: number; y: number }
    | { kind: "raion"; name: string; oblastIso: string; x: number; y: number }
    | { kind: "aggressor"; country: "Belarus" | "Russia"; x: number; y: number }
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

  // Index of active raions keyed by `${oblastIso}::${normName}` so raion-name
  // collisions across oblasts (e.g. "Сумський район") never bleed onto the
  // wrong polygon.
  const activeRaionsByKey = useMemo(() => {
    const m = new Map<string, RaionAlert>();
    for (const r of data?.raions ?? []) m.set(`${r.oblastIso}::${normRaion(r.name)}`, r);
    return m;
  }, [data]);

  // Both full and partial oblast states count as "active" for the live signal
  // — alerts.in.ua mirrors this on its map. Partial state means the alert
  // covers one or more raions inside the oblast (rendered red individually).
  const isActiveAlert = (o: OblastAlert): boolean => {
    const s = (o.state ?? (o.active ? "full" : "none")) as AlertState;
    return s === "full" || s === "partial";
  };

  // Active count excludes occupied territories — alerts.in.ua marks occupied
  // oblasts as permanently "active" because Russian forces operate from them,
  // but for a free-Ukraine air-raid signal that creates a constant false
  // baseline. We report only alerts on free Ukrainian territory.
  const activeCount = (data?.oblasts ?? [])
    .filter(isActiveAlert)
    .filter((o) => !OCCUPIED_ISOS.has(o.iso))
    .length;
  const activeRaionCount = (data?.raions ?? []).filter((r) => !OCCUPIED_ISOS.has(r.oblastIso)).length;


  // Active alerts list — full + partial state, excluding occupied territories.
  // Sorted alphabetically.
  const activeList = useMemo(() => {
    return (data?.oblasts ?? [])
      .filter(isActiveAlert)
      .filter((o) => !OCCUPIED_ISOS.has(o.iso))
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
    <div className="relative flex flex-col h-full w-full">
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
            {/* Diagonal red hatch used to mark aggressor states (RU + BY).
                A subtle red tint sits underneath so the territories read as
                hostile even when zoomed out and the stripes blur. */}
            <defs>
              <pattern
                id="aggressor-stripes"
                patternUnits="userSpaceOnUse"
                width="6"
                height="6"
                patternTransform="rotate(45)"
              >
                <rect width="6" height="6" fill="hsl(var(--signal) / 0.16)" />
                <line x1="0" y1="0" x2="0" y2="6" stroke="hsl(var(--signal) / 0.7)" strokeWidth="1.6" />
              </pattern>
            </defs>

            {/* Belarus + Russia — marked as aggressor states with a red
                diagonal hatch. Interactive: hovering opens an explanatory
                tooltip. Drawn first so Ukraine oblasts remain on top. */}
            <Geographies geography={WORLD_GEO}>
              {({ geographies }) =>
                geographies
                  .filter((g) => NEIGHBOUR_NAMES.has(g.properties.name as string))
                  .map((geo) => {
                    const country = geo.properties.name as "Belarus" | "Russia";
                    return (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        onMouseEnter={(e) => {
                          const cont = (e.currentTarget.closest("div") as HTMLDivElement | null)
                            ?.getBoundingClientRect();
                          setHovered({
                            kind: "aggressor",
                            country,
                            x: e.clientX - (cont?.left ?? 0),
                            y: e.clientY - (cont?.top ?? 0),
                          });
                        }}
                        onMouseMove={(e) => {
                          const cont = (e.currentTarget.closest("div") as HTMLDivElement | null)
                            ?.getBoundingClientRect();
                          setHovered({
                            kind: "aggressor",
                            country,
                            x: e.clientX - (cont?.left ?? 0),
                            y: e.clientY - (cont?.top ?? 0),
                          });
                        }}
                        style={{
                          default: {
                            fill: "url(#aggressor-stripes)",
                            stroke: "hsl(var(--signal) / 0.75)",
                            strokeWidth: 0.7,
                            outline: "none",
                            cursor: "help",
                          },
                          hover: {
                            fill: "url(#aggressor-stripes)",
                            stroke: "hsl(var(--signal))",
                            strokeWidth: 1.1,
                            outline: "none",
                            cursor: "help",
                          },
                          pressed: { outline: "none" },
                        }}
                      />
                    );
                  })
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
                  const state: AlertState = alert?.state ?? (alert?.active ? "full" : "none");
                  const occupied = OCCUPIED_ISOS.has(iso);
                  // Occupied territories are rendered permanently dark red and
                  // never pulse — active-alert signalling only applies to free
                  // Ukrainian territory.
                  const isFull = state === "full" && !occupied;
                  const isPartial = state === "partial" && !occupied;

                  const baseFill = occupied
                    ? "hsl(var(--occupied))"
                    : isFull
                      ? "hsl(var(--signal) / 0.65)"
                      : isPartial
                        ? "hsl(var(--signal) / 0.18)"
                        : "hsl(var(--muted))";
                  const hoverFill = occupied
                    ? "hsl(var(--occupied))"
                    : isFull
                      ? "hsl(var(--signal) / 0.85)"
                      : isPartial
                        ? "hsl(var(--signal) / 0.28)"
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
                          stroke: occupied ? "hsl(var(--occupied-border))" : "hsl(var(--foreground) / 0.6)",
                          strokeWidth: occupied ? 1.4 : 0.7,
                          outline: "none",
                          transition: "fill 200ms ease",
                          cursor: variant === "full" ? "pointer" : "default",
                        },
                        hover: {
                          fill: hoverFill,
                          stroke: occupied ? "hsl(var(--occupied-border))" : "hsl(var(--foreground) / 0.85)",
                          strokeWidth: occupied ? 1.6 : 0.9,
                          outline: "none",
                          cursor: variant === "full" ? "pointer" : "default",
                        },
                        pressed: { fill: baseFill, outline: "none" },
                      }}
                      className={(isFull || isPartial) ? "air-alert-pulse" : undefined}
                    />
                  );
                })
              }
            </Geographies>

            {/* Oblast abbreviation labels — placed at the polygon centroid.
                Pointer-events disabled so they never intercept hover/click. */}
            <Geographies geography={OBLASTS_GEO}>
              {({ geographies }) =>
                geographies.map((geo) => {
                  const iso = geo.properties.iso as string;
                  const code = codeMap[iso];
                  if (!code) return null;
                  const [lng, lat] = geoCentroid(geo);
                  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
                  const occupied = OCCUPIED_ISOS.has(iso);
                  // Slightly smaller font for Cyrillic so 3-letter codes fit
                  // tight oblasts; bumped vs prior values for legibility.
                  const fontSize = variant === "full"
                    ? (lang === "uk" ? 11 : 12)
                    : (lang === "uk" ? 9 : 10);
                  return (
                    <Marker key={`lbl-${iso}`} coordinates={[lng, lat]}>
                      <text
                        textAnchor="middle"
                        dy={3}
                        style={{
                          pointerEvents: "none",
                          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                          fontSize,
                          fontWeight: 700,
                          letterSpacing: "0.06em",
                          fill: occupied ? "hsl(0 0% 100%)" : "hsl(var(--foreground))",
                          paintOrder: "stroke",
                          stroke: occupied ? "hsl(215 30% 8% / 0.95)" : "hsl(var(--background))",
                          strokeWidth: 3.5,
                          strokeLinejoin: "round",
                        }}
                      >
                        {code}
                      </text>
                    </Marker>
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
                    const raion = activeRaionsByKey.get(`${oblastIso}::${normRaion(name)}`);
                    // Occupied raions never count as active alerts — they
                    // render as thin light-grey subdivision borders only.
                    const isActive = !!raion && !occupied;
                    // Free-territory raions are interactive: hover shows the
                    // raion name + status, click opens the detail panel.
                    const interactive = !occupied;
                    return (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        onMouseEnter={(e) => {
                          if (!interactive) return;
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
                          if (!interactive) return;
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
                        onClick={() => {
                          if (!interactive || variant !== "full") return;
                          setSelected({ kind: "raion", name, oblastIso, raion });
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
                            pointerEvents: interactive ? "auto" : "none",
                            cursor: interactive ? "pointer" : "default",
                          },
                          hover: {
                            fill: isActive
                              ? "hsl(var(--signal))"
                              : occupied
                                ? "transparent"
                                : "hsl(var(--foreground) / 0.08)",
                            stroke: occupied
                              ? "hsl(0 0% 88% / 0.45)"
                              : "hsl(var(--foreground) / 0.55)",
                            strokeWidth: occupied ? 0.3 : 0.6,
                            outline: "none",
                            cursor: interactive ? "pointer" : "default",
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
                  {o && isActiveAlert(o) && !OCCUPIED_ISOS.has(o.iso) ? (
                    <>
                      <span className="text-[hsl(var(--signal))]">● {t("airAlerts.active")}</span>
                      <span className="ml-2">{durationLabel(o.changedAt, true)}</span>
                    </>
                  ) : OCCUPIED_ISOS.has(hovered.iso) ? (
                    <span className="text-[hsl(var(--occupied))]">Occupied territory</span>
                  ) : (
                    <span>{t("airAlerts.clear")}</span>
                  )}
                </div>
                {o && isActiveAlert(o) && o.types && o.types.length > 0 && (
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
          if (hovered.kind === "aggressor") {
            const titles: Record<typeof lang, { by: string; ru: string; line1: string; line2: string }> = {
              en: { by: "Belarus", ru: "Russia",   line1: "Aggressor state",   line2: "Hostile territory — launches, staging and overflight against Ukraine originate here." },
              de: { by: "Belarus", ru: "Russland", line1: "Aggressor-Staat",   line2: "Feindliches Gebiet — Starts, Aufmärsche und Überflüge gegen die Ukraine erfolgen von hier." },
              fr: { by: "Biélorussie", ru: "Russie", line1: "État agresseur", line2: "Territoire hostile — tirs, déploiements et survols contre l'Ukraine partent d'ici." },
              uk: { by: "Білорусь", ru: "Росія",   line1: "Держава-агресор", line2: "Ворожа територія — звідси здійснюються пуски, розгортання та польоти проти України." },
            };
            const tx = titles[lang] ?? titles.en;
            const name = hovered.country === "Belarus" ? tx.by : tx.ru;
            return (
              <div
                className="pointer-events-none absolute z-10 rounded border border-[hsl(var(--signal)/0.5)] bg-background/95 px-3 py-2 text-xs font-mono shadow-lg backdrop-blur min-w-[200px] max-w-[260px]"
                style={{ left: hovered.x + 12, top: Math.max(hovered.y - 8, 4), transform: "translateY(-100%)" }}
              >
                <div className="font-semibold text-foreground">{name}</div>
                <div className="mt-1 text-[hsl(var(--signal))] uppercase tracking-[0.16em] text-[10px]">
                  ● {tx.line1}
                </div>
                <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">{tx.line2}</p>
              </div>
            );
          }
          // raion — show tooltip for every raion in free territory.
          const r = activeRaionsByKey.get(`${hovered.oblastIso}::${normRaion(hovered.name)}`);
          const parent = byIso.get(hovered.oblastIso);
          return (
            <div
              className="pointer-events-none absolute z-10 rounded border border-border bg-background/95 px-3 py-2 text-xs font-mono shadow-lg backdrop-blur min-w-[180px]"
              style={{ left: hovered.x + 12, top: Math.max(hovered.y - 8, 4), transform: "translateY(-100%)" }}
            >
              <div className="font-semibold text-foreground">{hovered.name}</div>
              {parent && (
                <div className="text-[10px] text-muted-foreground">{parent.nameEn}</div>
              )}
              {(() => {
                // If the raion itself is flagged, show raion-level alert.
                // Otherwise inherit the parent oblast's alert state so users
                // never see "ALL CLEAR" while hovering inside an oblast that
                // is currently under a full/partial air-raid alert.
                const parentActive = parent && isActiveAlert(parent) && !OCCUPIED_ISOS.has(parent.iso);
                const types = r?.types ?? (parentActive ? parent?.types : undefined);
                const since = r?.changedAt ?? (parentActive ? parent?.changedAt : undefined);
                const showActive = !!r || parentActive;
                return (
                  <>
                    <div className="mt-1">
                       {showActive ? (
                         <>
                           <span className="text-[hsl(var(--signal))]">● {t("airAlerts.active")}</span>
                           {!r && parentActive && (
                             <span className="ml-2 text-[10px] text-muted-foreground/80">
                               (oblast-wide)
                             </span>
                           )}
                         </>
                       ) : (
                         <span className="text-muted-foreground">{t("airAlerts.clear")}</span>
                       )}
                     </div>
                    {types && types.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {types.map((tp) => (
                          <span key={tp} className="rounded bg-[hsl(var(--signal)/0.2)] px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-foreground">
                            {typeLabel(tp, t)}
                          </span>
                        ))}
                      </div>
                    )}
                  </>
                );
              })()}
              <div className="mt-1.5 text-[9px] text-muted-foreground/70">Click for details</div>
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
