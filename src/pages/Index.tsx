import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Trans, useTranslation } from "react-i18next";
import { loadShahedData, type Dataset, type MonthPoint } from "@/lib/shahed-data";
import { loadAllMissileCategories } from "@/lib/missiles-data";
import { MonthlyTrendChart } from "@/components/MonthlyTrendChart";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { AnalyticsDashboard } from "@/components/AnalyticsDashboard";
import { WeaponsCatalogSection } from "@/components/WeaponsCatalogSection";
import { Panel, SourceLabel } from "@/components/ui/panel";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { PanelActions } from "@/components/PanelActions";

const fmt = (n: number) => n.toLocaleString("en-US");

/** Compute freshness tier of the latest reported data point. */
function freshnessTier(latest: Date | null): "fresh" | "stale" | "veryStale" | null {
  if (!latest) return null;
  // End-of-month for the latest reported month, then days since then.
  const eom = new Date(Date.UTC(latest.getUTCFullYear(), latest.getUTCMonth() + 1, 0));
  const diffDays = Math.floor((Date.now() - eom.getTime()) / 86_400_000);
  if (diffDays <= 3) return "fresh";
  if (diffDays <= 10) return "stale";
  return "veryStale";
}

const FRESHNESS_VAR: Record<NonNullable<ReturnType<typeof freshnessTier>>, string> = {
  fresh: "--signal-ok",
  stale: "--signal-warn",
  veryStale: "--signal",
};


function StatusBar({ lastUpdated }: { lastUpdated: string | null }) {
  const { t } = useTranslation();
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background">
      <div className="container flex items-center justify-between gap-6 py-2 font-mono text-[10.5px] uppercase tracking-[0.16em]">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-signal" />
          <span className="font-semibold tracking-[0.2em] text-foreground">{t("nav.uaIntel")}</span>
        </div>
        <div className="flex items-center gap-6 text-muted-foreground">
          <span className="hidden md:inline">{t("nav.lastDataPoint")}</span>
          <span className="num text-foreground">{lastUpdated ?? "—"}</span>
          <span aria-hidden className="hidden h-3 w-px bg-border md:inline-block" />
          <LanguageSwitcher />
          <span aria-hidden className="hidden h-3 w-px bg-border md:inline-block" />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

function SectionNav() {
  const { t } = useTranslation();
  const items = [
    { id: "summary", label: t("nav.summary") },
    { id: "analytics", label: t("nav.analytics") },
    { id: "drones", label: t("nav.drones") },
    { id: "cruise", label: t("nav.cruise") },
    { id: "ballistic", label: t("nav.ballistic") },
    { id: "arsenal", label: t("nav.arsenal") },
    { id: "methodology", label: t("nav.methodology") },
    { id: "related", label: t("nav.sources") },
    { id: "help", label: t("nav.help") },
  ];
  const [active, setActive] = useState<string>(items[0].id);

  useEffect(() => {
    const sections = items
      .map((it) => document.getElementById(it.id))
      .filter((el): el is HTMLElement => !!el);
    if (!sections.length) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]?.target.id) setActive(visible[0].target.id);
      },
      { rootMargin: "-30% 0px -60% 0px", threshold: [0, 0.1, 0.5, 1] },
    );
    sections.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  return (
    <nav className="sticky top-[33px] z-30 border-b border-border bg-background">
      <div className="container flex items-center gap-1 overflow-x-auto py-1.5 text-[11px] font-mono uppercase tracking-[0.16em]">
        {items.map((it) => {
          const isActive = active === it.id;
          return (
            <a
              key={it.id}
              href={`#${it.id}`}
              aria-current={isActive ? "true" : undefined}
              className={`whitespace-nowrap rounded-sm px-2.5 py-1 transition-colors ${
                isActive
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              {it.label}
            </a>
          );
        })}
      </div>
    </nav>
  );
}

function KPI({
  label, value, numeric, decimals = 0, suffix = "", sub, signal = false,
}: {
  label: string; value?: string; numeric?: number; decimals?: number; suffix?: string; sub?: string; signal?: boolean;
}) {
  return (
    <div className="min-w-0">
      <div className="text-[10.5px] font-mono font-medium uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </div>
      <div className={`mt-1.5 num font-semibold leading-none text-[2rem] md:text-[2.5rem] ${signal ? "text-signal" : "text-foreground"}`}>
        {numeric !== undefined ? <AnimatedNumber value={numeric} decimals={decimals} suffix={suffix} /> : value}
      </div>
      {sub && <div className="mt-2 text-[12px] text-muted-foreground num">{sub}</div>}
    </div>
  );
}

const RELATED_SOURCES = [
  { key: "gur",  href: "https://war-sanctions.gur.gov.ua/en/components", color: "#0057B8" },
  { key: "uaf",  href: "https://www.facebook.com/kpszsu", color: "#1E90FF" },
  { key: "oryx", href: "https://www.oryxspioenkop.com/2022/02/attack-on-europe-documenting-equipment.html", color: "#D35400" },
  { key: "isw",  href: "https://www.understandingwar.org/backgrounder/russian-offensive-campaign-assessment", color: "#1F4E79" },
  { key: "csis", href: "https://missilethreat.csis.org/", color: "#C41E3A" },
  { key: "kiel", href: "https://www.ifw-kiel.de/topics/war-against-ukraine/ukraine-support-tracker/", color: "#003366" },
];

function RelatedSourcesSection() {
  const { t } = useTranslation();
  return (
    <section id="related" className="scroll-mt-32 border-t border-border">
      <div className="container py-12 md:py-16">
        <div className="mb-8 max-w-3xl">
          <div className="src-label mb-3">{t("related.kicker")}</div>
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">{t("related.title")}</h2>
          <p className="mt-3 text-[14px] leading-[1.65] text-muted-foreground">{t("related.intro")}</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {RELATED_SOURCES.map((s) => (
            <a
              key={s.href}
              href={s.href}
              target="_blank"
              rel="noopener noreferrer external"
              style={{ borderTopColor: s.color }}
              className="group relative flex flex-col gap-2 rounded-sm border border-border bg-card p-5 transition-colors hover:bg-secondary/50 border-t-2"
            >
              <span
                style={{ backgroundColor: `${s.color}14`, color: s.color }}
                className="inline-flex self-start rounded px-2 py-0.5 text-[10.5px] font-mono font-medium uppercase tracking-[0.18em]"
              >
                {t(`related.items.${s.key}.tag`)}
              </span>
              <h3 className="text-[15px] font-semibold leading-snug text-foreground">{t(`related.items.${s.key}.name`)}</h3>
              <p className="text-[13px] leading-relaxed text-muted-foreground">{t(`related.items.${s.key}.blurb`)}</p>
              <div className="src-label mt-auto pt-2 transition-colors group-hover:text-foreground">{t("related.open")}</div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

const DONATE_ORGS = [
  { key: "u24",          name: "UNITED24",                     href: "https://u24.gov.ua/",                              tag: "mixed", color: "#0057B8" },
  { key: "comeBackAlive",name: "Come Back Alive",              href: "https://savelife.in.ua/en/",                       tag: "military", color: "#556B2F" },
  { key: "prytula",      name: "Serhiy Prytula Foundation",    href: "https://prytulafoundation.org/en",                 tag: "mixed", color: "#E67E22" },
  { key: "razom",        name: "Razom for Ukraine",            href: "https://razomforukraine.org/",                     tag: "humanitarian", color: "#0077B6" },
  { key: "hospitallers", name: "Hospitallers Medical Battalion", href: "https://www.hospitallers.life/needs-hospitallers", tag: "humanitarian", color: "#C0392B" },
  { key: "voices",       name: "Voices of Children",           href: "https://voices.org.ua/en/",                        tag: "humanitarian", color: "#F5A623" },
];

function HowToHelpSection() {
  const { t } = useTranslation();
  return (
    <section id="help" className="scroll-mt-32 border-t border-border">
      <div className="container py-12 md:py-16">
        <div className="mb-8 max-w-3xl">
          <div className="src-label mb-3">{t("donate.kicker")}</div>
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">{t("donate.title")}</h2>
          <p className="mt-3 text-[14px] leading-[1.65] text-muted-foreground">{t("donate.intro")}</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {DONATE_ORGS.map((s) => (
            <a
              key={s.href}
              href={s.href}
              target="_blank"
              rel="noopener noreferrer external"
              style={{ borderTopColor: s.color }}
              className="group relative flex flex-col gap-2 rounded-sm border border-border bg-card p-5 transition-colors hover:bg-secondary/50 border-t-2"
            >
              <span
                style={{ backgroundColor: `${s.color}14`, color: s.color }}
                className="inline-flex self-start rounded px-2 py-0.5 text-[10.5px] font-mono font-medium uppercase tracking-[0.18em]"
              >
                {t(`donate.tags.${s.tag}`)}
              </span>
              <h3 className="text-[15px] font-semibold leading-snug text-foreground">{s.name}</h3>
              <p className="text-[13px] leading-relaxed text-muted-foreground">{t(`donate.items.${s.key}`)}</p>
              <div className="src-label mt-auto pt-2 transition-colors group-hover:text-foreground">{t("donate.cta")}</div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

type CategorySectionProps = {
  id: string;
  kicker: string;
  title: string;
  description: string;
  unitNoun: string;
  dataset: Dataset;
  range: [number, number];
  onRangeChange: (r: [number, number]) => void;
};

function CategorySection({
  id, kicker, title, description, unitNoun, dataset, range, onRangeChange,
}: CategorySectionProps) {
  const { t } = useTranslation();
  const filtered = dataset.months.slice(range[0], range[1] + 1);
  const launched = filtered.reduce((s, m) => s + m.launched, 0);
  const destroyed = filtered.reduce((s, m) => s + m.destroyed, 0);
  const rate = launched > 0 ? destroyed / launched : 0;
  const peak = filtered.length ? filtered.reduce((a, b) => (b.launched > a.launched ? b : a)) : null;
  const rangeLabel = filtered.length ? `${filtered[0].label} – ${filtered[filtered.length - 1].label}` : "";

  return (
    <section id={id} className="scroll-mt-32 border-t border-border">
      <div className="container py-12 md:py-16">
        <div className="mb-8 max-w-3xl">
          <div className="src-label mb-3">{kicker}</div>
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">{title}</h2>
          <p className="mt-3 text-[14px] leading-[1.65] text-muted-foreground">{description}</p>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-x-6 gap-y-6 border-y border-border py-6 md:grid-cols-4">
          <KPI label={t("kpi.launchedReported")} numeric={launched} sub={rangeLabel} />
          <KPI label={t("kpi.confirmedDestroyed")} numeric={destroyed} sub={t("kpi.confirmedInterceptions")} />
          <KPI label={t("kpi.interceptionRate")} numeric={rate * 100} decimals={1} suffix="%" sub={`${fmt(destroyed)} ${t("kpi.ofSep")} ${fmt(launched)}`} />
          <KPI label={t("kpi.reachedTarget")} numeric={Math.max(launched - destroyed, 0)} sub={launched > 0 ? `${(((launched - destroyed) / launched) * 100).toFixed(1)}${t("kpi.leakerPctSuffix")}` : "—"} />
        </div>

        <div className="mb-6">
          <DateRangeFilter months={dataset.months} range={range} onChange={onRangeChange} />
        </div>

        <Panel
          title={t("category.monthlyPanel", { unit: unitNoun })}
          subtitle={rangeLabel}
          source={t("primarySource")}
          note={peak ? t("category.peakNote", { month: peak.label, launched: fmt(peak.launched), unit: unitNoun, destroyed: fmt(peak.destroyed), rate: (peak.rate * 100).toFixed(1) }) : undefined}
        >
          <MonthlyTrendChart data={filtered} />
        </Panel>
      </div>
    </section>
  );
}

const Index = () => {
  const { t } = useTranslation();
  const [shahed, setShahed] = useState<Dataset | null>(null);
  const [shahedRange, setShahedRange] = useState<[number, number] | null>(null);
  const [cruise, setCruise] = useState<Dataset | null>(null);
  const [cruiseRange, setCruiseRange] = useState<[number, number] | null>(null);
  const [ballistic, setBallistic] = useState<Dataset | null>(null);
  const [ballisticRange, setBallisticRange] = useState<[number, number] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadShahedData()
      .then((d) => { setShahed(d); setShahedRange([0, d.months.length - 1]); })
      .catch((e) => setError(String(e)));
    loadAllMissileCategories()
      .then(({ cruise: c, ballistic: b }) => {
        setCruise(c); setCruiseRange([0, c.months.length - 1]);
        setBallistic(b); setBallisticRange([0, b.months.length - 1]);
      })
      .catch((e) => setError(String(e)));
  }, []);

  const ready = shahed && cruise && ballistic;

  const grand = useMemo(() => {
    if (!ready) return { launched: 0, destroyed: 0, rate: 0 };
    const launched = shahed!.totals.launched + cruise!.totals.launched + ballistic!.totals.launched;
    const destroyed = shahed!.totals.destroyed + cruise!.totals.destroyed + ballistic!.totals.destroyed;
    return { launched, destroyed, rate: launched > 0 ? destroyed / launched : 0 };
  }, [ready, shahed, cruise, ballistic]);

  const lastUpdatedLabel = useMemo(() => {
    const lastWithData = (d: Dataset | null): MonthPoint | null => {
      if (!d) return null;
      for (let i = d.months.length - 1; i >= 0; i--) if (d.months[i].launched > 0) return d.months[i];
      return null;
    };
    const candidates = [lastWithData(shahed), lastWithData(cruise), lastWithData(ballistic)]
      .filter((m): m is MonthPoint => !!m)
      .sort((a, b) => b.date.getTime() - a.date.getTime());
    return candidates[0]?.label ?? null;
  }, [shahed, cruise, ballistic]);

  const reached = Math.max(grand.launched - grand.destroyed, 0);

  return (
    <main className="min-h-screen bg-background">
      <StatusBar lastUpdated={lastUpdatedLabel} />
      <SectionNav />

      <section id="summary" className="border-b border-border">
        <div className="container py-10 md:py-14">
          <div className="src-label mb-3">{t("masthead.kicker")}</div>
          <h1 className="max-w-4xl text-3xl font-semibold leading-[1.15] tracking-tight md:text-[2.75rem]">
            {t("masthead.title")}
          </h1>
          <p className="mt-5 max-w-3xl text-[14px] leading-[1.7] text-muted-foreground md:text-[15px]">
            {t("masthead.intro")}
          </p>
          <div className="src-label mt-5 flex flex-wrap items-center gap-x-4 gap-y-1">
            <span>{t("nav.lastDataPoint")}: <span className="text-foreground">{lastUpdatedLabel ?? "—"}</span></span>
            <span aria-hidden>·</span>
            <Link to="/sources" className="hover:text-foreground">{t("masthead.primarySource")}</Link>
            <Link to="/methodology" className="hover:text-foreground">{t("masthead.methodology")}</Link>
            <Link to="/disclaimer" className="hover:text-foreground">{t("masthead.disclaimer")}</Link>
          </div>

          {ready && (
            <div className="mt-8 grid grid-cols-2 gap-x-6 gap-y-6 border-y border-border py-7 md:grid-cols-4">
              <KPI label={t("kpi.totalLaunched")} numeric={grand.launched} sub={t("kpi.totalLaunchedSub")} signal />
              <KPI label={t("kpi.confirmedDestroyed")} numeric={grand.destroyed} sub={t("kpi.confirmedDestroyedSub")} />
              <KPI label={t("kpi.interceptionRate")} numeric={grand.rate * 100} decimals={1} suffix="%" sub={`${fmt(grand.destroyed)} ${t("kpi.ofSep")} ${fmt(grand.launched)}`} />
              <KPI label={t("kpi.reachedTarget")} numeric={reached} sub={t("kpi.reachedTargetSub")} />
            </div>
          )}

          {ready && (
            <SourceLabel className="mt-3">
              {t("masthead.sourceRange", { source: t("primarySource"), last: lastUpdatedLabel })}
            </SourceLabel>
          )}
        </div>
      </section>

      {error && (
        <div className="container py-6 text-sm text-destructive">
          {t("masthead.loadFailed")} {error}
        </div>
      )}

      {ready && <AnalyticsDashboard shahed={shahed!} cruise={cruise!} ballistic={ballistic!} />}

      {shahed && shahedRange && (
        <CategorySection
          id="drones"
          kicker={t("category.drones.kicker")}
          title={t("category.drones.title")}
          description={t("category.drones.description")}
          unitNoun={t("category.drones.unit")}
          dataset={shahed}
          range={shahedRange}
          onRangeChange={setShahedRange}
        />
      )}

      {cruise && cruiseRange && (
        <CategorySection
          id="cruise"
          kicker={t("category.cruiseSection.kicker")}
          title={t("category.cruiseSection.title")}
          description={t("category.cruiseSection.description")}
          unitNoun={t("category.cruiseSection.unit")}
          dataset={cruise}
          range={cruiseRange}
          onRangeChange={setCruiseRange}
        />
      )}

      {ballistic && ballisticRange && (
        <CategorySection
          id="ballistic"
          kicker={t("category.ballisticSection.kicker")}
          title={t("category.ballisticSection.title")}
          description={t("category.ballisticSection.description")}
          unitNoun={t("category.ballisticSection.unit")}
          dataset={ballistic}
          range={ballisticRange}
          onRangeChange={setBallisticRange}
        />
      )}

      <WeaponsCatalogSection />

      <section id="methodology" className="scroll-mt-32 border-t border-border">
        <div className="container grid gap-8 py-12 md:grid-cols-12 md:py-16">
          <div className="md:col-span-4">
            <div className="src-label mb-3">{t("methodologyInline.kicker")}</div>
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">
              {t("methodologyInline.title")}
            </h2>
          </div>
          <div className="space-y-4 text-[14px] leading-[1.7] text-muted-foreground md:col-span-8">
            <p>
              {t("methodologyInline.p1Pre")}{" "}
              <strong className="text-foreground">{t("methodologyInline.launched")}</strong>{" "}
              {t("methodologyInline.p1Post")}
            </p>
            <p>{t("methodologyInline.p2")}</p>
            <p>
              {t("methodologyInline.p3Pre")}
              <em>{t("methodologyInline.p3Reported")}</em>
              {t("methodologyInline.p3Mid")}
              <Link to="/methodology" className="underline underline-offset-4 hover:text-foreground">
                {t("methodologyInline.p3FullMethodology")}
              </Link>
              {t("methodologyInline.p3And")}
              <Link to="/sources" className="underline underline-offset-4 hover:text-foreground">
                {t("methodologyInline.p3SourceList")}
              </Link>
              {t("methodologyInline.p3End")}
            </p>
          </div>
        </div>
      </section>

      <RelatedSourcesSection />
      <HowToHelpSection />

      <div className="border-t border-border bg-secondary">
        <div className="container py-4">
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            <strong className="text-foreground">{t("footer.dataNote")}</strong>{" "}
            {t("footer.dataNoteBody")}
          </p>
        </div>
      </div>

      <footer className="border-t border-border">
        <div className="container flex flex-col items-start justify-between gap-3 py-6 font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground md:flex-row md:items-center">
          <p>{t("footer.tagline")}</p>
          <div className="flex flex-wrap items-center gap-3">
            <span>{t("footer.lastDataPoint")} <span className="text-foreground">{lastUpdatedLabel ?? "—"}</span></span>
            <a href="/data/missile_attacks_daily.csv" download className="rounded-sm border border-border px-2.5 py-1 text-foreground transition-colors hover:bg-secondary">
              {t("footer.downloadCsv")}
            </a>
            <Link to="/methodology" className="hover:text-foreground">{t("footer.methodology")}</Link>
            <Link to="/sources" className="hover:text-foreground">{t("footer.sources")}</Link>
            <Link to="/disclaimer" className="hover:text-foreground">{t("footer.disclaimer")}</Link>
          </div>
        </div>
      </footer>

      {!ready && !error && (
        <div className="container py-20 text-center font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          {t("masthead.loading")}
        </div>
      )}
    </main>
  );
};

export default Index;
