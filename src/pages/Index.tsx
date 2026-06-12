import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Trans, useTranslation } from "react-i18next";
import Papa from "papaparse";
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
import { WeaponTerm } from "@/components/WeaponTerm";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AirAlertsMap } from "@/components/AirAlertsMap";
import { AirThreatFeed } from "@/components/AirThreatFeed";
import { MiniAlertsMap } from "@/components/MiniAlertsMap";
import { CategorySparklines } from "@/components/CategorySparklines";
import { DataConfidenceSection } from "@/components/DataConfidenceSection";
import { StatusBanner } from "@/components/StatusBadge";

const fmt = (n: number) => n.toLocaleString("en-US");

/** Compact glossary of representative weapons per category for hover tooltips. */
const GLOSSARY: Record<string, Array<{ term: string; description: string }>> = {
  drones: [
    { term: "Shahed-136 / 131", description: "Iranian-designed delta-wing loitering munition (~50 kg warhead, 1,800+ km range). Mass-launched at night against energy & civilian infrastructure; slow and noisy but cheap (~$20–50k per unit)." },
    { term: "Lancet-3", description: "Russian loitering munition (~3 kg warhead). Used tactically against artillery, air-defense and armoured vehicles at the front line." },
    { term: "Orlan-10 / ZALA", description: "Russian reconnaissance UAVs used to spot targets for artillery and missile strikes; unarmed but force-multipliers." },
  ],
  cruise: [
    { term: "Kh-101 / Kh-555", description: "Russian air-launched stealth cruise missile (~450 kg warhead, ~2,500 km range). Subsonic, low-altitude flight; primary strategic strike weapon against infrastructure." },
    { term: "Kalibr (3M14)", description: "Sea-launched cruise missile fired from Black Sea ships and submarines. Subsonic, GPS/INS-guided, ~450 kg warhead." },
    { term: "Kh-22 / Kh-32", description: "Heavy Soviet-era anti-ship cruise missile (~1,000 kg warhead). Used in surface-attack mode; very hard to intercept due to terminal-dive profile." },
    { term: "Iskander-K", description: "Ground-launched 9M728/9M729 cruise missile variant of the Iskander system. Low-altitude, terrain-hugging flight; ~500 km range." },
  ],
  ballistic: [
    { term: "Iskander-M / 9K720", description: "Russian short-range ballistic missile (~480 km, 700 kg warhead). Quasi-ballistic trajectory with mid-course maneuvers; only Patriot-class systems can reliably intercept." },
    { term: "Kh-47M2 Kinzhal", description: "Air-launched aero-ballistic missile derived from Iskander, carried by MiG-31K. Hypersonic terminal speed (~Mach 10); intercepted by Patriot PAC-3 since May 2023." },
    { term: "KN-23", description: "North Korean short-range ballistic missile (similar to Iskander). Transferred to Russia since late 2023; lower accuracy but high terminal speed." },
    { term: "S-300 / S-400 (S2S mode)", description: "Surface-to-air missiles repurposed for surface-to-surface strikes against ground targets. Limited warhead but very fast and used in saturation attacks." },
  ],
};

function GlossaryChips({ category }: { category: keyof typeof GLOSSARY }) {
  const { t } = useTranslation();
  const items = GLOSSARY[category];
  if (!items?.length) return null;
  return (
    <div className="mb-6 flex flex-wrap items-center gap-2">
      <span className="src-label mr-1">{t("glossary.label")}</span>
      {items.map((w) => (
        <WeaponTerm key={w.term} term={w.term} description={w.description} />
      ))}
    </div>
  );
}

/** Format an actual date+time in UTC, e.g. "2026-05-29 14:07 UTC". */
function fmtUtc(d: Date | null): string {
  if (!d) return "—";
  const iso = d.toISOString(); // 2026-05-29T14:07:33.000Z
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
}



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
/** Russia's full-scale invasion of Ukraine began at 03:40 Kyiv time on 24 Feb 2022
 *  (sources: BBC, Reuters, UN, ISW). Increments by one each day. */
const WAR_START_UTC = Date.UTC(2022, 1, 24, 1, 40); // 03:40 EET = 01:40 UTC

function WarDayTracker() {
  const [days, setDays] = useState<number>(() =>
    Math.max(1, Math.floor((Date.now() - WAR_START_UTC) / 86_400_000) + 1),
  );
  useEffect(() => {
    const tick = () =>
      setDays(Math.max(1, Math.floor((Date.now() - WAR_START_UTC) / 86_400_000) + 1));
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);
  return (
    <span
      className="inline-flex items-center gap-1.5 text-muted-foreground"
      title="Days since the start of Russia's full-scale invasion of Ukraine (24 Feb 2022)"
    >
      <span className="src-label">Day of war</span>
      <span className="num font-semibold text-foreground">{days.toLocaleString("en-US")}</span>
    </span>
  );
}



function StatusBar({
  lastUpdated,
  lastUpdatedDate,
}: {
  lastUpdated: string | null;
  lastUpdatedDate: Date | null;
}) {
  const { t } = useTranslation();
  const tier = freshnessTier(lastUpdatedDate);
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background">

      <div className="container flex items-center justify-between gap-3 py-2 font-mono text-[10.5px] uppercase tracking-[0.16em]">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate font-semibold tracking-[0.2em] text-foreground">
            <span className="sm:hidden">UA ADT</span>

            <span className="hidden sm:inline">{t("nav.uaIntel")}</span>
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-3 text-muted-foreground sm:gap-6">
          <span className="hidden md:inline">{t("nav.lastDataPoint")}</span>
          <span
            className="hidden items-center gap-1.5 sm:inline-flex"
            title={tier ? t(`freshness.${tier}`) : undefined}
            aria-label={tier ? t(`freshness.${tier}`) : undefined}
          >
            <span className="num text-foreground">{lastUpdated ?? "—"}</span>
          </span>
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
    { id: "alerts", label: t("nav.alerts") },
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
        <Link
          to="/contact"
          className="ml-auto whitespace-nowrap rounded-sm px-2.5 py-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          {t("nav.contact")}
        </Link>
      </div>
    </nav>
  );
}


function KPI({
  label, value, numeric, decimals = 0, suffix = "", sub, signal = false, info, size = "md",
}: {
  label: string; value?: string; numeric?: number; decimals?: number; suffix?: string; sub?: string; signal?: boolean; info?: { label: string; body: string };
  size?: "md" | "lg" | "xl";
}) {
  const sizeClass =
    size === "xl" ? "text-[2.25rem] sm:text-[3rem] md:text-[4rem] tracking-tight"
    : size === "lg" ? "text-[1.875rem] sm:text-[2.25rem] md:text-[2.75rem]"
    : "text-[1.5rem] sm:text-[1.75rem] md:text-[2.125rem]";
  return (
    <div className="min-w-0">
      <div className="flex min-h-[2.4em] items-start gap-1.5 text-[10px] sm:text-[10.5px] font-mono font-medium uppercase tracking-[0.16em] leading-[1.2] text-muted-foreground">
        <span className="break-words">{label}</span>
        {info && (
          <Tooltip delayDuration={100}>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={info.label}
                className="mt-[1px] inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border border-muted-foreground/40 text-[9px] leading-none text-muted-foreground transition-colors hover:border-foreground hover:text-foreground focus:outline-none focus-visible:ring-1 focus-visible:ring-foreground"
              >
                &zwnj;i
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" align="start" className="max-w-xs font-sans text-[12px] font-light leading-relaxed normal-case tracking-normal">
              <div className="mb-1 font-sans text-[10px] font-light uppercase tracking-[0.18em]">{info.label}</div>
              <div className="font-sans font-light">{info.body}</div>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
      <div className={`mt-1 num font-semibold leading-none ${sizeClass} ${signal ? "text-signal" : "text-foreground"}`}>
        {numeric !== undefined ? <AnimatedNumber value={numeric} decimals={decimals} suffix={suffix} /> : value}
      </div>
      {sub && <div className="mt-1.5 text-[11.5px] sm:text-[12px] leading-snug text-muted-foreground num">{sub}</div>}
    </div>
  );
}

/** Pct change; null when prev is zero / missing. */
function pctChange(curr: number, prev: number): number | null {
  if (!prev || !Number.isFinite(prev)) return null;
  return ((curr - prev) / prev) * 100;
}

/**
 * Coloured trend pill. "up-is-good" → green when delta rises (e.g. interception
 * rate); "down-is-good" → green when delta falls (e.g. launched, leakers).
 */
function TrendBadge({
  delta, direction, label,
}: {
  delta: number | null;
  direction: "up-is-good" | "down-is-good";
  label?: string;
}) {
  if (delta === null || !Number.isFinite(delta)) {
    return (
      <span className="inline-flex items-center gap-1 rounded-sm bg-muted/60 px-1.5 py-0.5 text-[10.5px] font-mono uppercase tracking-[0.14em] text-muted-foreground">
        — {label}
      </span>
    );
  }
  const rising = delta > 0;
  const isGood = direction === "up-is-good" ? rising : !rising;
  const tone = isGood
    ? "bg-[hsl(var(--signal-ok)/0.15)] text-[hsl(var(--signal-ok))]"
    : "bg-[hsl(var(--signal)/0.18)] text-[hsl(var(--signal))]";
  const arrow = rising ? "▲" : "▼";
  return (
    <span className={`inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10.5px] font-mono font-semibold uppercase tracking-[0.14em] ${tone}`}>
      <span aria-hidden>{arrow}</span>
      <span className="num">{Math.abs(delta).toFixed(1)}%</span>
      {label && <span className="font-medium text-muted-foreground">{label}</span>}
    </span>
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
              className="group relative flex flex-col gap-2 rounded-sm border border-border bg-card p-5 transition-colors hover:bg-secondary/50 border-t-2 border-t-border"
            >
              <span className="inline-flex self-start rounded border border-border bg-secondary px-2 py-0.5 text-[10.5px] font-mono font-medium uppercase tracking-[0.18em] text-muted-foreground">
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
              className="group relative flex flex-col gap-2 rounded-sm border border-border bg-card p-5 transition-colors hover:bg-secondary/50 border-t-2 border-t-border"
            >
              <span className="inline-flex self-start rounded border border-border bg-secondary px-2 py-0.5 text-[10.5px] font-mono font-medium uppercase tracking-[0.18em] text-muted-foreground">
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
  glossaryKey?: keyof typeof GLOSSARY;
  kicker: string;
  title: string;
  description: string;
  unitNoun: string;
  dataset: Dataset;
  range: [number, number];
  onRangeChange: (r: [number, number]) => void;
};

function CategorySection({
  id, glossaryKey, kicker, title, description, unitNoun, dataset, range, onRangeChange,
}: CategorySectionProps) {
  const { t } = useTranslation();
  const filtered = dataset.months.slice(range[0], range[1] + 1);
  const launched = filtered.reduce((s, m) => s + m.launched, 0);
  const destroyed = filtered.reduce((s, m) => s + m.destroyed, 0);
  const rate = launched > 0 ? destroyed / launched : 0;
  const peak = filtered.length ? filtered.reduce((a, b) => (b.launched > a.launched ? b : a)) : null;
  const rangeLabel = filtered.length ? `${filtered[0].label} – ${filtered[filtered.length - 1].label}` : "";

  // Month-over-month delta on launches (last full vs prior full month in the dataset).
  const mom = useMemo(() => {
    const ms = dataset.months;
    if (ms.length < 2) return null;
    const now = new Date();
    const curY = now.getUTCFullYear();
    const curM = now.getUTCMonth();
    const completed = ms.filter((m) => !(m.date.getUTCFullYear() === curY && m.date.getUTCMonth() === curM));
    if (completed.length < 2) return null;
    const last = completed[completed.length - 1];
    const prev = completed[completed.length - 2];
    if (!prev.launched) return null;
    const pct = ((last.launched - prev.launched) / prev.launched) * 100;
    return { pct, last: last.label, prev: prev.label };
  }, [dataset]);


  return (
    <section id={id} className="scroll-mt-32 border-t border-border">
      <div className="container py-12 md:py-16">
        <div className="mb-8 max-w-3xl">
          <div className="src-label mb-3">{kicker}</div>
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">{title}</h2>
          <p className="mt-3 text-[14px] leading-[1.65] text-muted-foreground">{description}</p>
        </div>

        {glossaryKey && <GlossaryChips category={glossaryKey} />}

        <div className="mb-6 grid grid-cols-2 gap-x-6 gap-y-6 border-y border-border py-6 md:grid-cols-4">
          <KPI label={t("kpi.launchedReported")} numeric={launched} sub={rangeLabel} />
          <KPI label={t("kpi.confirmedDestroyed")} numeric={destroyed} sub={t("kpi.confirmedInterceptions")} />
          <KPI label={t("kpi.interceptionRate")} numeric={rate * 100} decimals={1} suffix="%" sub={`${fmt(destroyed)} ${t("kpi.ofSep")} ${fmt(launched)}`} />
          <KPI label={t("kpi.reachedTarget")} numeric={Math.max(launched - destroyed, 0)} sub={launched > 0 ? `${(((launched - destroyed) / launched) * 100).toFixed(1)}${t("kpi.leakerPctSuffix")}` : "—"} />
        </div>

        {mom && (
          <div className="mb-6 flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-sm border border-border bg-card px-4 py-3 text-[13px]">
            <span className="src-label">{t("kpi.momLabel")}</span>
            <span className={`num font-semibold ${mom.pct >= 0 ? "text-[#940000]" : "text-[hsl(var(--signal-ok))]"}`}>
              {mom.pct >= 0 ? "+" : ""}{mom.pct.toFixed(1)}%
            </span>
            <span className="text-muted-foreground">
              {t("kpi.momDetail", { last: mom.last, prev: mom.prev })}
            </span>
          </div>
        )}


        <div className="mb-6">
          <DateRangeFilter months={dataset.months} range={range} onChange={onRangeChange} />
        </div>

        <Panel
          title={t("category.monthlyPanel", { unit: unitNoun })}
          subtitle={rangeLabel}
          source={t("primarySource")}
          note={peak ? t("category.peakNote", { month: peak.label, launched: fmt(peak.launched), unit: unitNoun, destroyed: fmt(peak.destroyed), rate: (peak.rate * 100).toFixed(1) }) : undefined}
          action={
            <PanelActions
              filename={`ua-defense-tracker_${id}_${range[0]}-${range[1]}.csv`}
              panelTitle={typeof title === "string" ? title : id}
              rows={filtered.map((m) => ({
                month: m.label,
                month_key: m.key,
                launched: m.launched,
                destroyed: m.destroyed,
                interception_rate_pct: +(m.rate * 100).toFixed(2),
              }))}
              headers={["month", "month_key", "launched", "destroyed", "interception_rate_pct"]}
            />
          }
        >
          <MonthlyTrendChart data={filtered} />
        </Panel>



      </div>
    </section>
  );
}

/** Sync a [start,end] range with a single URL search param ("a-b"). */
function useUrlRange(
  key: string,
  range: [number, number] | null,
  setRange: (r: [number, number]) => void,
  maxIndex: number | null,
) {
  const [params, setParams] = useSearchParams();

  // Hydrate from URL once both maxIndex and current null range are ready.
  useEffect(() => {
    if (maxIndex == null) return;
    const raw = params.get(key);
    if (!raw) return;
    const [a, b] = raw.split("-").map((n) => parseInt(n, 10));
    if (Number.isFinite(a) && Number.isFinite(b)) {
      const lo = Math.max(0, Math.min(a, maxIndex));
      const hi = Math.max(lo, Math.min(b, maxIndex));
      if (!range || range[0] !== lo || range[1] !== hi) setRange([lo, hi]);
    }
    // intentionally only on key/maxIndex; do not retrigger on range
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, maxIndex]);

  // Write current range back to the URL (omit when at full extent).
  useEffect(() => {
    if (!range || maxIndex == null) return;
    const isFull = range[0] === 0 && range[1] === maxIndex;
    const next = new URLSearchParams(params);
    if (isFull) next.delete(key);
    else next.set(key, `${range[0]}-${range[1]}`);
    if (next.toString() !== params.toString()) {
      setParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, range?.[0], range?.[1], maxIndex]);
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
  const [latestDataPoint, setLatestDataPoint] = useState<Date | null>(null);
  const [completeMonth, setCompleteMonth] = useState<{ key: string; label: string } | null>(null);

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

    // Parse raw daily CSVs once: derive latest data point + last fully-covered calendar month.
    Promise.all([
      fetch("/data/shahed_attacks_daily.csv").then((r) => r.ok ? r.text() : ""),
      fetch("/data/missile_attacks_daily.csv").then((r) => r.ok ? r.text() : ""),
    ]).then(([a, b]) => {
      let maxMs = 0;
      for (const text of [a, b]) {
        if (!text) continue;
        const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });
        for (const row of parsed.data) {
          const s = (row.time_end || row.time_start || "").trim();
          if (!s) continue;
          const iso = s.length <= 10 ? `${s}T00:00:00Z` : `${s.replace(" ", "T")}:00Z`;
          const ts = Date.parse(iso);
          if (isNaN(ts)) continue;
          if (ts > maxMs) maxMs = ts;
        }
      }
      if (maxMs === 0) return;
      setLatestDataPoint(new Date(maxMs));

      // Latest month present in the dataset. We only advance to the following
      // month once it is fully covered (i.e. the dataset's max date sits on its
      // last day). Otherwise we keep showing the previous, complete month.
      const maxDate = new Date(maxMs);
      const lastDayOfMonth = (y: number, m: number) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
      let y = maxDate.getUTCFullYear();
      let m = maxDate.getUTCMonth();
      // If the dataset has only spilled a few days into a new month but that
      // month isn't complete yet, step back to the previous month.
      const dayOfMonth = maxDate.getUTCDate();
      if (dayOfMonth < lastDayOfMonth(y, m) && dayOfMonth <= 14) {
        m -= 1; if (m < 0) { m = 11; y -= 1; }
      }
      const key = `${y}-${String(m + 1).padStart(2, "0")}`;
      const label = new Date(Date.UTC(y, m, 1)).toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
      setCompleteMonth({ key, label });
    }).catch(() => {});
  }, []);


  useUrlRange("dr", shahedRange, setShahedRange, shahed ? shahed.months.length - 1 : null);
  useUrlRange("cr", cruiseRange, setCruiseRange, cruise ? cruise.months.length - 1 : null);
  useUrlRange("br", ballisticRange, setBallisticRange, ballistic ? ballistic.months.length - 1 : null);

  const ready = shahed && cruise && ballistic;

  const grand = useMemo(() => {
    if (!ready) return { launched: 0, destroyed: 0, rate: 0 };
    const launched = shahed!.totals.launched + cruise!.totals.launched + ballistic!.totals.launched;
    const destroyed = shahed!.totals.destroyed + cruise!.totals.destroyed + ballistic!.totals.destroyed;
    return { launched, destroyed, rate: launched > 0 ? destroyed / launched : 0 };
  }, [ready, shahed, cruise, ballistic]);

  const latest = useMemo(() => {
    const lastWithData = (d: Dataset | null): MonthPoint | null => {
      if (!d) return null;
      for (let i = d.months.length - 1; i >= 0; i--) if (d.months[i].launched > 0) return d.months[i];
      return null;
    };
    const candidates = [lastWithData(shahed), lastWithData(cruise), lastWithData(ballistic)]
      .filter((m): m is MonthPoint => !!m)
      .sort((a, b) => b.date.getTime() - a.date.getTime());
    return candidates[0] ?? null;
  }, [shahed, cruise, ballistic]);

  const lastUpdatedLabel = latest?.label ?? null;
  const lastUpdatedDate = latest?.date ?? null;

  const reached = Math.max(grand.launched - grand.destroyed, 0);
  const dataTimeframe = useMemo(() => {
    const pick = (d: Dataset | null) => {
      if (!d) return null;
      const first = d.months.find((m) => m.launched > 0) ?? d.months[0];
      const last = [...d.months].reverse().find((m) => m.launched > 0) ?? d.months[d.months.length - 1];
      return first && last ? { first: first.label, last: last.label } : null;
    };
    return pick(shahed) ?? pick(cruise) ?? pick(ballistic);
  }, [shahed, cruise, ballistic]);

  return (
    <main className="min-h-screen bg-background">
      <StatusBar lastUpdated={lastUpdatedLabel} lastUpdatedDate={lastUpdatedDate} />
      <SectionNav />


      <section id="summary" className="border-b border-border">
        <div className="container pt-6 pb-8 md:pt-10 md:pb-14">
          {/* Editorial masthead — serif headline, dek, trust/metadata bar */}
          <div className="max-w-4xl">
            <h1 className="font-serif text-[1.875rem] leading-[1.1] tracking-[-0.02em] sm:text-[2.25rem] md:text-[3rem] lg:text-[3.5rem]">
              {t("masthead.title")}
            </h1>
            <p className="mt-3 max-w-3xl font-serif text-[1rem] leading-[1.45] text-muted-foreground sm:text-[1.0625rem] md:text-[1.25rem]">
              {t("masthead.tagline")}
            </p>

            {/* Trust / metadata bar — primary source attribution + day tracker. */}
            <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-y border-border py-2.5 text-[11.5px] sm:text-[12px]">
              <WarDayTracker />
              {dataTimeframe && (
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <span className="src-label">{t("masthead.timeframe")}</span>
                  <span className="num text-foreground">{dataTimeframe.first} – {dataTimeframe.last}</span>
                </span>
              )}
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <span className="src-label">{t("trustbar.source")}</span>
                <a
                  href="https://www.kaggle.com/datasets/piterfm/massive-missile-attacks-on-ukraine"
                  target="_blank" rel="noopener noreferrer external"
                  className="text-foreground underline underline-offset-4 decoration-border hover:decoration-foreground"
                >
                  {t("trustbar.sourceName")}
                </a>
              </span>
            </div>
          </div>



          {ready && (
            <div className="mt-6 grid gap-3 md:mt-8 md:grid-cols-12 md:gap-4">
              {/* TIER 1 — hero KPI: Total launched (col-span-7) */}
              <div className="md:col-span-7 rounded-md border border-border bg-card p-4 sm:p-5 md:p-7">
                <KPI
                  label={t("kpi.totalLaunched")}
                  numeric={grand.launched}
                  size="xl"
                  signal
                  sub={`${t("kpi.totalLaunchedSub")}${dataTimeframe ? ` · ${dataTimeframe.first} – ${dataTimeframe.last}` : ""}`}
                  info={{ label: t("kpi.tip.totalLaunchedLabel"), body: t("kpi.tip.totalLaunched") }}
                />

                {/* TIER 3 — last fully-covered calendar month · per-category breakdown */}
                {completeMonth && (
                  <div className="mt-5 border-t-2 border-foreground bg-background/60">
                    <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-1.5 sm:px-4">
                      <span className="text-[9.5px] sm:text-[10px] font-mono font-semibold uppercase tracking-[0.22em] text-foreground truncate">
                        {completeMonth.label}
                      </span>
                      <span className="text-[9.5px] sm:text-[10px] font-mono uppercase tracking-[0.16em] text-muted-foreground whitespace-nowrap">
                        last complete month
                      </span>
                    </div>
                    {(() => {
                      const pick = (ds: typeof shahed) => ds?.months.find((mp) => mp.key === completeMonth.key);
                      const uav = pick(shahed);
                      const cru = pick(cruise);
                      const bal = pick(ballistic);
                      const cats = [
                        { key: "uav", label: t("nav.drones"),    l: uav?.launched ?? 0, d: uav?.destroyed ?? 0 },
                        { key: "cru", label: t("nav.cruise"),    l: cru?.launched ?? 0, d: cru?.destroyed ?? 0 },
                        { key: "bal", label: t("nav.ballistic"), l: bal?.launched ?? 0, d: bal?.destroyed ?? 0 },
                      ];
                      const total = {
                        l: cats.reduce((s, c) => s + c.l, 0),
                        d: cats.reduce((s, c) => s + c.d, 0),
                      };
                      const reachedOf = (l: number, d: number) => Math.max(l - d, 0);
                      const Cell = ({ label, total, values }: { label: string; total: number; values: { k: string; lbl: string; v: number }[] }) => (
                        <div className="min-w-0 px-2.5 py-3 sm:px-4 sm:py-3.5">
                          <div className="text-[8.5px] sm:text-[9.5px] font-mono uppercase tracking-[0.18em] leading-none text-muted-foreground truncate">
                            {label}
                          </div>
                          <div className="mt-2 num text-[1.375rem] sm:text-[1.75rem] font-semibold leading-none tracking-tight tabular-nums">
                            {fmt(total)}
                          </div>
                          <div className="mt-3 space-y-1">
                            {values.map((v) => (
                              <div key={v.k} className="flex items-baseline justify-between gap-2 text-[10px] font-mono">
                                <span className="uppercase tracking-[0.14em] text-muted-foreground truncate">{v.lbl}</span>
                                <span className="num tabular-nums text-foreground">{fmt(v.v)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                      return (
                        <div className="grid grid-cols-3 divide-x divide-border">
                          <Cell
                            label={t("masthead.insightLaunched")}
                            total={total.l}
                            values={cats.map((c) => ({ k: c.key, lbl: c.label, v: c.l }))}
                          />
                          <Cell
                            label={t("masthead.insightIntercepted")}
                            total={total.d}
                            values={cats.map((c) => ({ k: c.key, lbl: c.label, v: c.d }))}
                          />
                          <Cell
                            label={t("masthead.insightReached")}
                            total={reachedOf(total.l, total.d)}
                            values={cats.map((c) => ({ k: c.key, lbl: c.label, v: reachedOf(c.l, c.d) }))}
                          />
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>

              {/* TIER 2 — Interception rate + Reached target area (col-span-5, stacked) */}
              <div className="md:col-span-5 grid grid-cols-2 gap-3 md:grid-cols-1 md:gap-4">
                <div className="rounded-md border border-border bg-card p-4 sm:p-5">
                  {(() => {
                    const cats = [
                      { key: "uav", label: t("nav.drones"), l: shahed!.totals.launched, d: shahed!.totals.destroyed, color: "hsl(48 80% 55%)" },
                      { key: "cruise", label: t("nav.cruise"), l: cruise!.totals.launched, d: cruise!.totals.destroyed, color: "hsl(28 78% 50%)" },
                      { key: "bal", label: t("nav.ballistic"), l: ballistic!.totals.launched, d: ballistic!.totals.destroyed, color: "hsl(0 65% 48%)" },
                    ];
                    return (
                      <div>
                        <div className="flex items-baseline justify-between gap-2">
                          <div className="text-[10px] sm:text-[10.5px] font-mono font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                            {t("kpi.interceptionRate")}
                          </div>
                          <div className="num text-[1.125rem] font-semibold tabular-nums leading-none">
                            {(grand.rate * 100).toFixed(1)}<span className="text-muted-foreground">%</span>
                          </div>
                        </div>
                        <div className="mt-3 divide-y divide-border border-t border-border">
                          {cats.map((c) => {
                            const rate = c.l > 0 ? c.d / c.l : 0;
                            const pct = (rate * 100).toFixed(1);
                            return (
                              <div key={c.key} className="grid grid-cols-[64px_1fr_auto] items-center gap-3 py-2.5">
                                <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-foreground">
                                  {c.label}
                                </div>
                                <div className="h-1.5 w-full overflow-hidden bg-muted">
                                  <div className="h-full" style={{ width: `${Math.min(100, rate * 100)}%`, background: c.color }} />
                                </div>
                                <div className="num text-[13px] font-semibold tabular-nums leading-none tracking-tight">
                                  {pct}<span className="text-muted-foreground">%</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <div className="mt-2.5 text-[10px] sm:text-[10.5px] font-mono uppercase tracking-[0.12em] text-muted-foreground">
                          {fmt(grand.destroyed)} {t("kpi.ofSep")} {fmt(grand.launched)} {t("kpi.confirmedInterceptions")}
                        </div>
                      </div>
                    );
                  })()}
                </div>
                <div className="rounded-md border border-border bg-card p-4 sm:p-5">
                  <KPI
                    label={t("kpi.reachedTarget")}
                    numeric={reached}
                    size="lg"
                    sub={grand.launched > 0 ? `${((reached / grand.launched) * 100).toFixed(1)}${t("kpi.leakerPctSuffix")}` : "—"}
                    info={{ label: t("kpi.tip.reachedTargetLabel"), body: t("kpi.tip.reachedTarget") }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </section>






      {error && (
        <div className="container py-6">
          <StatusBanner
            level="unavailable"
            title="Live dataset temporarily unavailable"
            description="We can't reach the upstream data source right now. The dashboard is showing the most recent cached snapshot, which may be a few hours out of date."
            lastSuccess={lastUpdatedLabel ?? "—"}
            meta={<span>Status: source unreachable · auto-retrying</span>}
          />
        </div>
      )}

      {ready && (
        <CategorySparklines
          categories={[
            { id: "drones",    label: t("category.drones.kicker"),           unit: t("category.drones.unit"),           dataset: shahed!,    href: "#drones" },
            { id: "cruise",    label: t("category.cruiseSection.kicker"),    unit: t("category.cruiseSection.unit"),    dataset: cruise!,    href: "#cruise" },
            { id: "ballistic", label: t("category.ballisticSection.kicker"), unit: t("category.ballisticSection.unit"), dataset: ballistic!, href: "#ballistic" },
          ]}
        />
      )}

      {ready && <AnalyticsDashboard shahed={shahed!} cruise={cruise!} ballistic={ballistic!} />}

      {/* The full live-alerts section now lives further down (after Ballistic). */}


      {(shahed && shahedRange) || (cruise && cruiseRange) || (ballistic && ballisticRange) ? (
        <div className="border-t border-border">
          <div
            className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:thin]"
            aria-label="Categories — swipe horizontally between UAVs, cruise and ballistic"
          >
            {shahed && shahedRange && (
              <div className="w-[92%] snap-start shrink-0 border-r border-border last:border-r-0">
                <CategorySection
                  id="drones"
                  glossaryKey="drones"
                  kicker={t("category.drones.kicker")}
                  title={t("category.drones.title")}
                  description={t("category.drones.description")}
                  unitNoun={t("category.drones.unit")}
                  dataset={shahed}
                  range={shahedRange}
                  onRangeChange={setShahedRange}
                />
              </div>
            )}
            {cruise && cruiseRange && (
              <div className="w-[92%] snap-start shrink-0 border-r border-border last:border-r-0">
                <CategorySection
                  id="cruise"
                  glossaryKey="cruise"
                  kicker={t("category.cruiseSection.kicker")}
                  title={t("category.cruiseSection.title")}
                  description={t("category.cruiseSection.description")}
                  unitNoun={t("category.cruiseSection.unit")}
                  dataset={cruise}
                  range={cruiseRange}
                  onRangeChange={setCruiseRange}
                />
              </div>
            )}
            {ballistic && ballisticRange && (
              <div className="w-[92%] snap-start shrink-0 border-r border-border last:border-r-0">
                <CategorySection
                  id="ballistic"
                  glossaryKey="ballistic"
                  kicker={t("category.ballisticSection.kicker")}
                  title={t("category.ballisticSection.title")}
                  description={t("category.ballisticSection.description")}
                  unitNoun={t("category.ballisticSection.unit")}
                  dataset={ballistic}
                  range={ballisticRange}
                  onRangeChange={setBallisticRange}
                />
              </div>
            )}
          </div>
          <div className="container flex items-center justify-center gap-2 pb-4 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            <span aria-hidden>←</span>
            <span>{t("analytics.swipeHint", { defaultValue: "Swipe / scroll horizontally" })}</span>
            <span aria-hidden>→</span>
          </div>
        </div>
      ) : null}


      {/* Live situation — collapsible. Historical data remains the primary focus. */}
      <section id="alerts" className="scroll-mt-32 border-t border-border bg-secondary/30">
        <div className="container py-10 md:py-14">
          <details className="group" open>
            <summary className="flex cursor-pointer list-none flex-wrap items-end justify-between gap-3 [&::-webkit-details-marker]:hidden">
              <div>
                <div className="src-label mb-1 flex items-center gap-2">
                  <span>{t("airAlerts.kicker")}</span>
                </div>
                <h2 className="font-serif text-[1.75rem] leading-tight tracking-tight md:text-[2.25rem]">
                  {t("airAlerts.title")}
                </h2>
                <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                  {t("airAlerts.subtitle")}
                </p>
              </div>
              <span className="inline-flex items-center gap-2 rounded-sm border border-border bg-card px-3 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground transition-colors group-hover:text-foreground">
                <span className="group-open:hidden">{t("airAlerts.expand")}</span>
                <span className="hidden group-open:inline">{t("airAlerts.collapse")}</span>
                <span aria-hidden className="transition-transform group-open:rotate-180">▾</span>
              </span>
            </summary>
            <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-stretch">
              <div className="lg:col-span-2 flex">
                <div className="w-full"><AirAlertsMap variant="full" /></div>
              </div>
              <div className="lg:col-span-1 flex">
                <div className="w-full"><AirThreatFeed /></div>
              </div>
            </div>
          </details>
        </div>
      </section>


      <WeaponsCatalogSection />

      <DataConfidenceSection
        lastUpdatedLabel={lastUpdatedLabel}
        lastUpdatedDate={lastUpdatedDate}
      />

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




      <footer className="border-t border-border">
        <div className="container grid gap-8 py-10 md:grid-cols-4">
          <div>
            <div className="src-label mb-3">{t("footer.colAbout")}</div>
            <ul className="space-y-2 text-[13px]">
              <li><Link to="/about" className="text-foreground hover:underline underline-offset-4">{t("nav.about")}</Link></li>
              
              <li className="text-muted-foreground">{t("footer.curatedBy")} <span className="text-foreground">Alexander Anton-Boicuk</span></li>
              <li className="text-muted-foreground">Dataset: <span className="text-foreground">Petro Ivaniuk</span></li>
            </ul>
          </div>

          <div>
            <div className="src-label mb-3">{t("footer.colData")}</div>
            <ul className="space-y-2 text-[13px]">
              <li><Link to="/methodology" className="text-foreground hover:underline underline-offset-4">{t("nav.methodology")}</Link></li>
              <li><Link to="/sources" className="text-foreground hover:underline underline-offset-4">{t("nav.sources")}</Link></li>
              <li>
                <a href="/data/missile_attacks_daily.csv" download className="text-foreground hover:underline underline-offset-4">
                  {t("footer.downloadCsv")}
                </a>
              </li>
              <li>
                <a href="/data/datapackage.json" target="_blank" rel="noopener noreferrer" className="text-foreground hover:underline underline-offset-4">
                  {t("footer.dataPackage")}
                </a>
              </li>
            </ul>
          </div>
          <div>
            <div className="src-label mb-3">{t("footer.colLegal")}</div>
            <ul className="space-y-2 text-[13px]">
              <li><Link to="/imprint" className="text-foreground hover:underline underline-offset-4">{t("nav.imprint")}</Link></li>
              <li><Link to="/disclaimer" className="text-foreground hover:underline underline-offset-4">{t("footer.disclaimer")}</Link></li>
              <li className="text-muted-foreground">
                {t("footer.license")}{" "}
                <a href="https://opendatacommons.org/licenses/by/1-0/" target="_blank" rel="noopener noreferrer external" className="text-foreground hover:underline underline-offset-4">
                  ODC-BY 1.0
                </a>
              </li>
            </ul>
          </div>
          <div>
            <div className="src-label mb-3">{t("footer.colMeta")}</div>
            <ul className="space-y-2 text-[13px] text-muted-foreground">
              
              <li>{t("footer.availableIn")} <span className="text-foreground">EN · DE · FR · UK</span></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-border bg-card">
          <div className="container py-5">
            <p className="text-[12.5px] leading-[1.7] text-muted-foreground">
              {t("footer.provenance")}
            </p>
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
