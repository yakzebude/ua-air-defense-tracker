import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ComposableMap, Geographies, Geography, ZoomableGroup } from "react-simple-maps";
import type { OblastAlert, RaionAlert } from "./AirAlertsMap";

const REFRESH_MS = 60 * 1000;
const OBLASTS_GEO = "/geo/ua-oblasts.geo.json";

interface ApiPayload {
  updatedAt: string;
  oblasts: OblastAlert[];
  raions?: RaionAlert[];
  stale?: boolean;
}

// Approximate centroids per oblast (ISO-3166-2 UA-XX), in [lng, lat].
// Used to compute the bounding box of active alerts for auto-zoom.
const OBLAST_CENTROIDS: Record<string, [number, number]> = {
  "UA-05": [28.5, 49.2], // Vinnytsia
  "UA-07": [25.3, 51.0], // Volyn
  "UA-09": [38.6, 48.8], // Luhansk
  "UA-12": [35.0, 48.4], // Dnipropetrovsk
  "UA-14": [37.7, 48.0], // Donetsk
  "UA-18": [28.6, 50.6], // Zhytomyr
  "UA-21": [23.3, 48.4], // Zakarpattia
  "UA-23": [35.4, 47.5], // Zaporizhzhia
  "UA-26": [24.7, 48.7], // Ivano-Frankivsk
  "UA-30": [30.5, 50.45], // Kyiv City
  "UA-32": [30.5, 50.4], // Kyiv Oblast
  "UA-35": [32.4, 48.5], // Kirovohrad
  "UA-40": [33.5, 44.6], // Sevastopol
  "UA-43": [34.1, 45.2], // Crimea
  "UA-46": [24.0, 49.7], // Lviv
  "UA-48": [31.8, 47.2], // Mykolaiv
  "UA-51": [30.7, 46.8], // Odesa
  "UA-53": [34.5, 49.6], // Poltava
  "UA-56": [26.7, 50.6], // Rivne
  "UA-59": [34.0, 51.0], // Sumy
  "UA-61": [25.6, 49.4], // Ternopil
  "UA-63": [36.5, 49.7], // Kharkiv
  "UA-65": [33.6, 46.6], // Kherson
  "UA-68": [27.0, 49.4], // Khmelnytskyi
  "UA-71": [31.7, 49.2], // Cherkasy
  "UA-74": [31.6, 51.3], // Chernihiv
  "UA-77": [25.9, 48.3], // Chernivtsi
};

const UA_DEFAULT = { center: [31.5, 49] as [number, number], zoom: 1 };

/**
 * Compute camera (center + zoom) that frames the active oblast set.
 * Returns the default Ukraine view if there are no active alerts.
 */
function computeCamera(activeIso: string[]): { center: [number, number]; zoom: number } {
  const pts = activeIso
    .map((iso) => OBLAST_CENTROIDS[iso])
    .filter((p): p is [number, number] => Array.isArray(p));
  if (pts.length === 0) return UA_DEFAULT;

  let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
  for (const [lng, lat] of pts) {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  // Pad bbox slightly so polygons aren't clipped at the edge.
  const padLng = Math.max(1.2, (maxLng - minLng) * 0.25);
  const padLat = Math.max(0.8, (maxLat - minLat) * 0.25);
  minLng -= padLng; maxLng += padLng;
  minLat -= padLat; maxLat += padLat;

  const center: [number, number] = [(minLng + maxLng) / 2, (minLat + maxLat) / 2];
  const spanLng = Math.max(0.5, maxLng - minLng);
  const spanLat = Math.max(0.5, maxLat - minLat);
  // Ukraine full extent ≈ 22° lng × 8° lat at zoom 1. Compute fit factor.
  const zoom = Math.min(
    5,
    Math.max(1, Math.min(22 / spanLng, 8 / spanLat) * 0.9),
  );
  return { center, zoom };
}

/**
 * Compact live air-alert map for header / above-the-fold placement.
 * Polls every 60s (matching the upstream UkraineAlarm cadence) and
 * auto-zooms to the active oblast cluster.
 */
export function MiniAlertsMap({ href = "/alerts" }: { href?: string }) {
  const { t } = useTranslation();
  const [data, setData] = useState<ApiPayload | null>(null);
  const [error, setError] = useState(false);
  const timerRef = useRef<number | null>(null);

  const load = async () => {
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID as string;
      const apikey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
      const res = await fetch(`https://${projectId}.functions.supabase.co/air-alerts`, {
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

  const activeIso = useMemo(
    () => new Set((data?.oblasts ?? []).filter((o) => o.active).map((o) => o.iso)),
    [data],
  );
  const activeCount = activeIso.size;
  const raionCount = (data?.raions ?? []).length;
  const allClear = !!data && activeCount === 0;
  const camera = useMemo(() => computeCamera(Array.from(activeIso)), [activeIso]);

  return (
    <a
      href={href}
      aria-label={t("airAlerts.viewFull")}
      className="group relative block w-full overflow-hidden rounded-sm border border-border bg-card transition-colors hover:border-foreground/40"
    >
      <div className="flex items-center justify-between border-b border-border px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em]">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <span
            className={`inline-block h-1.5 w-1.5 rounded-full ${
              activeCount > 0
                ? "bg-[hsl(var(--signal))] animate-pulse"
                : allClear
                  ? "bg-emerald-500"
                  : "bg-muted-foreground/50"
            }`}
            aria-hidden
          />
          {t("airAlerts.miniTitle")}
        </span>
        <span className={activeCount > 0 ? "text-[hsl(var(--signal))] font-semibold" : "text-foreground"}>
          {activeCount} {t("airAlerts.miniActive")}
        </span>
      </div>
      <div className="relative" style={{ height: 168 }}>
        <ComposableMap
          projection="geoMercator"
          projectionConfig={{ scale: 1700, center: [31.5, 49] }}
          width={300}
          height={168}
          style={{ width: "100%", height: "100%" }}
        >
          {/* ZoomableGroup is purely declarative here — we never expose pan/zoom UX */}
          <ZoomableGroup
            zoom={camera.zoom}
            center={camera.center}
            minZoom={1}
            maxZoom={6}
            // Disable user interaction; the card itself is a link.
            filterZoomEvent={() => false}
          >
            <Geographies geography={OBLASTS_GEO}>
              {({ geographies }) =>
                geographies.map((geo) => {
                  const iso = geo.properties.iso as string;
                  const isActive = activeIso.has(iso);
                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      style={{
                        default: {
                          fill: isActive ? "hsl(var(--signal) / 0.75)" : "hsl(var(--muted))",
                          stroke: "hsl(var(--background))",
                          strokeWidth: 0.4,
                          outline: "none",
                          transition: "fill 200ms ease",
                        },
                        hover: {
                          fill: isActive ? "hsl(var(--signal) / 0.9)" : "hsl(var(--muted))",
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
          </ZoomableGroup>
        </ComposableMap>

        {/* "All clear" overlay when no alerts are active anywhere. */}
        {allClear && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center bg-background/35 backdrop-blur-[1px]">
            <div className="flex items-center gap-1.5 rounded-sm border border-emerald-500/40 bg-background/90 px-2 py-1 font-mono text-[10.5px] uppercase tracking-[0.18em] text-emerald-500">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
              {t("airAlerts.allClearBadge")}
            </div>
            <span className="mt-1 font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
              {t("airAlerts.allClearSub")}
            </span>
          </div>
        )}

        {/* Bottom-right action chip (always visible) */}
        <span
          aria-hidden
          className="pointer-events-none absolute bottom-1.5 right-2 inline-flex items-center gap-1 rounded-sm bg-background/85 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-foreground backdrop-blur transition-colors group-hover:bg-background"
        >
          {t("airAlerts.viewFull")} →
        </span>

        {error && !data && (
          <span className="pointer-events-none absolute left-2 top-2 rounded-sm bg-background/85 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-[hsl(var(--signal))] backdrop-blur">
            {t("airAlerts.error")}
          </span>
        )}
      </div>
      {raionCount > 0 && (
        <div className="border-t border-border px-2.5 py-1 font-mono text-[10px] text-muted-foreground">
          {t("airAlerts.activeRaions", { count: raionCount })}
        </div>
      )}
    </a>
  );
}

export default MiniAlertsMap;
