import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AirAlertsMap } from "@/components/AirAlertsMap";
import { AirThreatFeed } from "@/components/AirThreatFeed";
import { OblastTileGrid } from "@/components/OblastTileGrid";

type View = "grid" | "geo";

export default function Alerts() {
  const { t } = useTranslation();
  const [view, setView] = useState<View>("grid");

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="container flex items-center justify-between py-6">
          <Link to="/" className="text-sm font-mono text-muted-foreground hover:text-foreground">
            ← {t("airAlerts.backHome")}
          </Link>
          <h1 className="text-base font-semibold">{t("airAlerts.pageTitle")}</h1>
          <span className="text-xs font-mono text-muted-foreground">{t("airAlerts.refreshNote")}</span>
        </div>
      </header>
      <section className="container py-8">
        <p className="mb-6 max-w-2xl text-sm text-muted-foreground">
          {t("airAlerts.pageIntro")}
        </p>

        <div className="mb-5 inline-flex rounded-sm border border-border bg-card p-0.5 font-mono text-[11px] uppercase tracking-[0.16em]">
          <button
            type="button"
            onClick={() => setView("grid")}
            aria-pressed={view === "grid"}
            className={`rounded-sm px-3 py-1.5 transition-colors ${
              view === "grid"
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t("airAlerts.viewGrid", "Tile grid")}
          </button>
          <button
            type="button"
            onClick={() => setView("geo")}
            aria-pressed={view === "geo"}
            className={`rounded-sm px-3 py-1.5 transition-colors ${
              view === "geo"
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t("airAlerts.viewGeo", "Geo map")}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          <div className="lg:col-span-2">
            {view === "grid" ? <OblastTileGrid /> : <AirAlertsMap variant="full" />}
          </div>
          <div className="lg:col-span-1">
            <AirThreatFeed />
          </div>
        </div>
      </section>
    </main>
  );
}
