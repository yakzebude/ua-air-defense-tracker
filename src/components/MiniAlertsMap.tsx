import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ComposableMap, Geographies, Geography } from "react-simple-maps";
import type { OblastAlert, RaionAlert } from "./AirAlertsMap";

const REFRESH_MS = 60 * 1000;
const OBLASTS_GEO = "/geo/ua-oblasts.geo.json";

interface ApiPayload {
  updatedAt: string;
  oblasts: OblastAlert[];
  raions?: RaionAlert[];
  stale?: boolean;
}

/**
 * Compact live air-alert map for header / above-the-fold placement.
 * Polls every 60s; clicking opens the full /alerts view.
 */
export function MiniAlertsMap({ href = "/alerts" }: { href?: string }) {
  const { t } = useTranslation();
  const [data, setData] = useState<ApiPayload | null>(null);
  const timerRef = useRef<number | null>(null);

  const load = async () => {
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID as string;
      const apikey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
      const res = await fetch(`https://${projectId}.functions.supabase.co/air-alerts`, {
        headers: { apikey, Authorization: `Bearer ${apikey}` },
      });
      if (!res.ok) return;
      setData(await res.json());
    } catch {
      /* swallow — mini map degrades silently */
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

  const activeIso = new Set((data?.oblasts ?? []).filter((o) => o.active).map((o) => o.iso));
  const activeCount = activeIso.size;
  const raionCount = (data?.raions ?? []).length;

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
              activeCount > 0 ? "bg-[hsl(var(--signal))] animate-pulse" : "bg-muted-foreground/50"
            }`}
            aria-hidden
          />
          {t("airAlerts.miniTitle")}
        </span>
        <span className="text-foreground">
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
                        fill: isActive ? "hsl(var(--signal) / 0.7)" : "hsl(var(--muted))",
                        stroke: "hsl(var(--background))",
                        strokeWidth: 0.5,
                        outline: "none",
                        transition: "fill 200ms ease",
                      },
                      hover: {
                        fill: isActive ? "hsl(var(--signal) / 0.85)" : "hsl(var(--muted))",
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
        </ComposableMap>
        <span
          aria-hidden
          className="pointer-events-none absolute bottom-1.5 right-2 inline-flex items-center gap-1 rounded-sm bg-background/85 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-foreground backdrop-blur transition-colors group-hover:bg-background"
        >
          {t("airAlerts.viewFull")} →
        </span>
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
