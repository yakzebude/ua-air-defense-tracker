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
        <Link
          to="/changelog"
          className="whitespace-nowrap rounded-sm px-2.5 py-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          {t("nav.changelog")}
        </Link>
      </div>
    </nav>
  );
}


function KPI({
  label, value, numeric, decimals = 0, suffix = "", sub, signal = false, info,
}: {
  label: string; value?: string; numeric?: number; decimals?: number; suffix?: string; sub?: string; signal?: boolean; info?: { label: string; body: string };
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5 text-[10.5px] font-mono font-medium uppercase tracking-[0.18em] text-muted-foreground">
        <span>{label}</span>
        {info && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={info.label}
                className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border border-muted-foreground/40 text-[9px] leading-none text-muted-foreground transition-colors hover:border-foreground hover:text-foreground focus:outline-none focus-visible:ring-1 focus-visible:ring-foreground"
              >
                i
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" align="start" className="max-w-xs text-[12px] leading-relaxed normal-case tracking-normal">
              <div className="src-label mb-1">{info.label}</div>
              <div>{info.body}</div>
            </TooltipContent>
          </Tooltip>
        )}
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

    // Determine the most recent raw daily data point timestamp from both CSVs.
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
          const t = Date.parse(iso);
          if (!isNaN(t) && t > maxMs) maxMs = t;
        }
      }
      if (maxMs > 0) setLatestDataPoint(new Date(maxMs));
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
        <div className="container py-10 md:py-14">
          <div className="src-label mb-3">{t("masthead.kicker")}</div>
          <h1 className="max-w-4xl text-3xl font-semibold leading-[1.15] tracking-tight md:text-[2.75rem]">
            {t("masthead.title")}
          </h1>

          {/* Prominent refresh badge directly under the title */}
          <div className="mt-5 inline-flex flex-wrap items-center gap-x-3 gap-y-1 rounded-sm border border-border bg-card px-3.5 py-2 font-mono text-[11.5px]">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[#db8400] pulse-soft" />
            <span className="uppercase tracking-[0.16em] text-muted-foreground">
              {t("masthead.refreshBadge")}
            </span>
            <span aria-hidden className="hidden h-3 w-px bg-border sm:inline-block" />
            <span className="num text-foreground">{fmtUtc(latestDataPoint)}</span>
          </div>

          <p className="mt-5 max-w-3xl text-[14px] leading-[1.7] text-muted-foreground md:text-[15px]">
            {t("masthead.intro")}
          </p>

          {ready && (
            <>
              <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-6 border-y border-border py-7 md:grid-cols-4">
                <KPI label={t("kpi.totalLaunched")} numeric={grand.launched} sub={t("kpi.totalLaunchedSub")} signal />
                <KPI label={t("kpi.confirmedDestroyed")} numeric={grand.destroyed} sub={t("kpi.confirmedDestroyedSub")} />
                <KPI label={t("kpi.interceptionRate")} numeric={grand.rate * 100} decimals={1} suffix="%" sub={`${fmt(grand.destroyed)} ${t("kpi.ofSep")} ${fmt(grand.launched)}`} />
                <KPI label={t("kpi.reachedTarget")} numeric={reached} sub={t("kpi.reachedTargetSub")} />
              </div>
            </>
          )}

          {ready && (
            <div className="mt-3 flex flex-wrap items-start gap-x-4 gap-y-1 text-[12px] leading-relaxed text-muted-foreground">
              <span className="src-label shrink-0 pt-0.5">{t("masthead.sourcesLabel")}</span>
              <span className="min-w-0">{t("masthead.sourcesBody")}</span>
            </div>
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
          glossaryKey="drones"
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
          glossaryKey="cruise"
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
          glossaryKey="ballistic"
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
        <div className="container grid gap-8 py-10 md:grid-cols-4">
          <div>
            <div className="src-label mb-3">{t("footer.colAbout")}</div>
            <ul className="space-y-2 text-[13px]">
              <li><Link to="/about" className="text-foreground hover:underline underline-offset-4">{t("nav.about")}</Link></li>
              <li><Link to="/changelog" className="text-foreground hover:underline underline-offset-4">{t("nav.changelog")}</Link></li>
              <li className="text-muted-foreground">{t("footer.curatedBy")} <span className="text-foreground">Petro Ivaniuk</span></li>
              <li className="text-muted-foreground">{t("footer.responsibleBy")} <span className="text-foreground">Alexander Anton-Boicuk</span></li>
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
              <li>{t("footer.lastDataPoint")} <span className="text-foreground num">{lastUpdatedLabel ?? "—"}</span></li>
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
        <div className="border-t border-border">
          <div className="container py-4 font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
            {t("footer.tagline")}
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
