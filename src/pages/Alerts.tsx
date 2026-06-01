import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AirAlertsMap } from "@/components/AirAlertsMap";
import { AirThreatFeed } from "@/components/AirThreatFeed";

export default function Alerts() {
  const { t } = useTranslation();
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <AirAlertsMap variant="full" />
          </div>
          <div className="lg:col-span-1 h-full">
            <AirThreatFeed />
          </div>
        </div>
      </section>
    </main>
  );
}
