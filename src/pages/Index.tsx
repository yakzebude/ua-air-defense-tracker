import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { loadShahedData, type Dataset, type MonthPoint } from "@/lib/shahed-data";
import { loadAllMissileCategories } from "@/lib/missiles-data";
import { MonthlyTrendChart } from "@/components/MonthlyTrendChart";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AnalyticsDashboard } from "@/components/AnalyticsDashboard";
import { WeaponsCatalogSection } from "@/components/WeaponsCatalogSection";
import { Panel, SourceLabel } from "@/components/ui/panel";

const fmt = (n: number) => n.toLocaleString("en-US");
const PRIMARY_SOURCE = "Air Force Command of the Armed Forces of Ukraine (daily reports, via Kaggle dataset, Petro Ivaniuk)";

/* -------------------------------------------------------------------------- */
/*  Top bars                                                                  */
/* -------------------------------------------------------------------------- */

function StatusBar({ lastUpdated }: { lastUpdated: string | null }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background">
      <div className="container flex items-center justify-between gap-4 py-2 font-mono text-[10.5px] uppercase tracking-[0.16em]">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-signal" />
          <span className="font-semibold tracking-[0.2em] text-foreground">UA Intel</span>
          <span className="hidden text-muted-foreground sm:inline">· Air-Threat Tracker</span>
        </div>
        <div className="flex items-center gap-4 text-muted-foreground">
          <span className="hidden md:inline">Last data point</span>
          <span className="num text-foreground">{lastUpdated ?? "—"}</span>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

function SectionNav() {
  const items = [
    { id: "summary", label: "Summary" },
    { id: "analytics", label: "Analytics" },
    { id: "drones", label: "UAVs" },
    { id: "cruise", label: "Cruise" },
    { id: "ballistic", label: "Ballistic" },
    { id: "arsenal", label: "Arsenal" },
    { id: "methodology", label: "Methodology" },
    { id: "related", label: "Sources" },
    { id: "help", label: "How to help" },
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

/* -------------------------------------------------------------------------- */
/*  KPI                                                                       */
/* -------------------------------------------------------------------------- */

function KPI({
  label,
  value,
  sub,
  signal = false,
}: {
  label: string;
  value: string;
  sub?: string;
  signal?: boolean;
}) {
  return (
    <div className="min-w-0">
      <div className="text-[10.5px] font-mono font-medium uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </div>
      <div
        className={`mt-1.5 num font-semibold leading-none text-[2rem] md:text-[2.5rem] ${
          signal ? "text-signal" : "text-foreground"
        }`}
      >
        {value}
      </div>
      {sub && <div className="mt-2 text-[12px] text-muted-foreground num">{sub}</div>}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Sources                                                                   */
/* -------------------------------------------------------------------------- */

const RELATED_SOURCES = [
  {
    name: "GUR · war-sanctions",
    href: "https://war-sanctions.gur.gov.ua/en/components",
    blurb: "Foreign components identified in Russian missiles and UAVs. Maintained by Ukraine's Defence Intelligence (HUR).",
    tag: "Components",
  },
  {
    name: "Ukrainian Air Force",
    href: "https://www.facebook.com/kpszsu",
    blurb: "Original daily reports on launched and intercepted weapons — the upstream source of this dataset.",
    tag: "Primary",
  },
  {
    name: "Oryx",
    href: "https://www.oryxspioenkop.com/2022/02/attack-on-europe-documenting-equipment.html",
    blurb: "Open-source, photo-verified record of equipment losses on both sides of the war.",
    tag: "Verified losses",
  },
  {
    name: "ISW · Daily updates",
    href: "https://www.understandingwar.org/backgrounder/russian-offensive-campaign-assessment",
    blurb: "Institute for the Study of War — daily campaign assessments and operational maps.",
    tag: "Analysis",
  },
  {
    name: "CSIS · Missile Threat",
    href: "https://missilethreat.csis.org/",
    blurb: "Reference profiles for cruise, ballistic and hypersonic weapons used against Ukraine.",
    tag: "Reference",
  },
  {
    name: "Kiel · Ukraine Support Tracker",
    href: "https://www.ifw-kiel.de/topics/war-against-ukraine/ukraine-support-tracker/",
    blurb: "Quantifies military, financial and humanitarian aid pledged to Ukraine by Western governments.",
    tag: "Aid",
  },
];

function RelatedSourcesSection() {
  return (
    <section id="related" className="scroll-mt-24 border-t border-border">
      <div className="container py-12 md:py-16">
        <div className="mb-6 max-w-3xl">
          <div className="src-label mb-2">Further reading</div>
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">Related sources</h2>
          <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
            This tracker covers reported aerial threat volume only. Linked projects below
            cover components, equipment losses, campaign analysis and aid flows.
          </p>
        </div>
        <div className="grid gap-px overflow-hidden rounded-sm border border-border bg-border md:grid-cols-2 lg:grid-cols-3">
          {RELATED_SOURCES.map((s) => (
            <a
              key={s.href}
              href={s.href}
              target="_blank"
              rel="noopener noreferrer external"
              className="group flex flex-col gap-2 bg-card p-5 transition-colors hover:bg-secondary"
            >
              <div className="src-label">{s.tag}</div>
              <h3 className="text-[15px] font-semibold leading-snug text-foreground">{s.name}</h3>
              <p className="text-[13px] leading-relaxed text-muted-foreground">{s.blurb}</p>
              <div className="src-label mt-auto pt-2 transition-colors group-hover:text-foreground">
                Open ↗
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Donate                                                                    */
/* -------------------------------------------------------------------------- */

const DONATE_ORGS = [
  { name: "UNITED24", href: "https://u24.gov.ua/", blurb: "Official fundraising platform of the Office of the President of Ukraine — defence, demining, medical aid, rebuilding.", tag: "Mixed" },
  { name: "Come Back Alive", href: "https://savelife.in.ua/en/", blurb: "Ukrainian charity supporting the Armed Forces — equipment, training, veteran assistance (since 2014).", tag: "Military" },
  { name: "Serhiy Prytula Foundation", href: "https://prytulafoundation.org/en", blurb: "Funds reconnaissance UAVs, vehicles and protective gear; also runs humanitarian projects.", tag: "Mixed" },
  { name: "Razom for Ukraine", href: "https://razomforukraine.org/", blurb: "US-based non-profit delivering tactical medical supplies, emergency response and advocacy.", tag: "Humanitarian" },
  { name: "Hospitallers Medical Battalion", href: "https://www.hospitallers.life/needs-hospitallers", blurb: "Volunteer paramedic battalion evacuating wounded soldiers and civilians from the front line.", tag: "Humanitarian" },
  { name: "Voices of Children", href: "https://voices.org.ua/en/", blurb: "Psychological and humanitarian support for children affected by the war.", tag: "Humanitarian" },
];

function HowToHelpSection() {
  return (
    <section id="help" className="scroll-mt-24 border-t border-border">
      <div className="container py-12 md:py-16">
        <div className="mb-6 max-w-3xl">
          <div className="src-label mb-2">How to help</div>
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">Vetted donation organisations</h2>
          <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
            Established Ukrainian and international organisations covering military
            support and humanitarian relief. UA Intel does not solicit funds and is
            not affiliated with the entities listed.
          </p>
        </div>
        <div className="grid gap-px overflow-hidden rounded-sm border border-border bg-border md:grid-cols-2 lg:grid-cols-3">
          {DONATE_ORGS.map((s) => (
            <a
              key={s.href}
              href={s.href}
              target="_blank"
              rel="noopener noreferrer external"
              className="group flex flex-col gap-2 bg-card p-5 transition-colors hover:bg-secondary"
            >
              <div className="src-label">{s.tag}</div>
              <h3 className="text-[15px] font-semibold leading-snug text-foreground">{s.name}</h3>
              <p className="text-[13px] leading-relaxed text-muted-foreground">{s.blurb}</p>
              <div className="src-label mt-auto pt-2 transition-colors group-hover:text-foreground">
                Donate ↗
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Category section                                                          */
/* -------------------------------------------------------------------------- */

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
  const filtered = dataset.months.slice(range[0], range[1] + 1);
  const launched = filtered.reduce((s, m) => s + m.launched, 0);
  const destroyed = filtered.reduce((s, m) => s + m.destroyed, 0);
  const rate = launched > 0 ? destroyed / launched : 0;
  const peak = filtered.length ? filtered.reduce((a, b) => (b.launched > a.launched ? b : a)) : null;
  const rangeLabel = filtered.length ? `${filtered[0].label} – ${filtered[filtered.length - 1].label}` : "";

  return (
    <section id={id} className="scroll-mt-24 border-t border-border">
      <div className="container py-12 md:py-16">
        <div className="mb-6 max-w-3xl">
          <div className="src-label mb-2">{kicker}</div>
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">{title}</h2>
          <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">{description}</p>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-x-6 gap-y-6 border-y border-border py-6 md:grid-cols-4">
          <KPI label="Launched (reported)" value={fmt(launched)} sub={rangeLabel} />
          <KPI label="Destroyed (confirmed)" value={fmt(destroyed)} sub="confirmed interceptions" />
          <KPI label="Interception rate" value={`${(rate * 100).toFixed(1)}%`} sub={`${fmt(destroyed)} of ${fmt(launched)}`} />
          <KPI label="Reached target area" value={fmt(Math.max(launched - destroyed, 0))} sub={launched > 0 ? `${(((launched - destroyed) / launched) * 100).toFixed(1)}% of launches` : "—"} />
        </div>

        <div className="mb-6">
          <DateRangeFilter months={dataset.months} range={range} onChange={onRangeChange} />
        </div>

        <Panel
          title={`Monthly ${unitNoun} — launched vs destroyed`}
          subtitle={rangeLabel}
          source={PRIMARY_SOURCE}
          note={peak ? `Peak month in range: ${peak.label} — ${fmt(peak.launched)} ${unitNoun} reported, ${fmt(peak.destroyed)} destroyed (${(peak.rate * 100).toFixed(1)}% intercepted).` : undefined}
        >
          <MonthlyTrendChart data={filtered} />
        </Panel>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                      */
/* -------------------------------------------------------------------------- */

const Index = () => {
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

      {/* ─────────────── MASTHEAD ─────────────── */}
      <section id="summary" className="border-b border-border">
        <div className="container py-10 md:py-14">
          <div className="src-label mb-3">OSINT · Air-threat tracker</div>
          <h1 className="max-w-4xl text-3xl font-semibold leading-[1.15] tracking-tight md:text-[2.75rem]">
            Ukraine air defense — operational data
          </h1>
          <p className="mt-4 max-w-3xl text-[14px] leading-relaxed text-muted-foreground md:text-[15px]">
            Monthly counts of reported aerial threats and confirmed interceptions over Ukraine,
            October 2022 – present. Data is compiled from daily reports of the Ukrainian Air Force
            Command and aggregated to calendar months. Figures are subject to revision.
          </p>
          <div className="src-label mt-4 flex flex-wrap items-center gap-x-4 gap-y-1">
            <span>Last data point: <span className="text-foreground">{lastUpdatedLabel ?? "—"}</span></span>
            <span aria-hidden>·</span>
            <Link to="/sources" className="hover:text-foreground">Primary source ↗</Link>
            <Link to="/methodology" className="hover:text-foreground">Methodology</Link>
            <Link to="/disclaimer" className="hover:text-foreground">Disclaimer</Link>
          </div>

          {/* KPI strip */}
          {ready && (
            <div className="mt-8 grid grid-cols-2 gap-x-6 gap-y-6 border-y border-border py-7 md:grid-cols-4">
              <KPI label="Total launched (reported)" value={fmt(grand.launched)} sub="UAVs, cruise & ballistic combined" signal />
              <KPI label="Confirmed destroyed" value={fmt(grand.destroyed)} sub="Air defense interceptions" />
              <KPI label="Interception rate" value={`${(grand.rate * 100).toFixed(1)}%`} sub={`${fmt(grand.destroyed)} of ${fmt(grand.launched)}`} />
              <KPI label="Reached target area" value={fmt(reached)} sub="Estimated leakers" />
            </div>
          )}

          {ready && (
            <SourceLabel className="mt-3">
              Source: {PRIMARY_SOURCE} · Range: Oct 2022 – {lastUpdatedLabel}
            </SourceLabel>
          )}
        </div>
      </section>

      {error && (
        <div className="container py-6 text-sm text-destructive">
          Failed to load dataset: {error}
        </div>
      )}

      {/* ─────────────── ANALYTICS DASHBOARD ─────────────── */}
      {ready && (
        <AnalyticsDashboard shahed={shahed!} cruise={cruise!} ballistic={ballistic!} />
      )}

      {/* ─────────────── SECTIONS ─────────────── */}
      {shahed && shahedRange && (
        <CategorySection
          id="drones"
          kicker="01 · Unmanned aerial vehicles"
          title="Loitering munitions (Shahed-136 / 131)"
          description="Iranian-designed loitering munitions reported launched against Ukrainian targets, with confirmed interceptions by Ukrainian air defense. Cruise and ballistic systems are tracked separately below."
          unitNoun="UAVs"
          dataset={shahed}
          range={shahedRange}
          onRangeChange={setShahedRange}
        />
      )}

      {cruise && cruiseRange && (
        <CategorySection
          id="cruise"
          kicker="02 · Cruise & air-to-surface"
          title="Cruise missiles"
          description="Cruise and air-to-surface missiles — Kalibr, X-101/X-555, X-22, X-32, X-59/X-69, X-31, X-35, Iskander-K and P-800 Oniks. Generally subsonic; historically intercepted at higher rates than ballistic systems."
          unitNoun="missiles"
          dataset={cruise}
          range={cruiseRange}
          onRangeChange={setCruiseRange}
        />
      )}

      {ballistic && ballisticRange && (
        <CategorySection
          id="ballistic"
          kicker="03 · Ballistic & quasi-ballistic"
          title="Ballistic missiles"
          description="Ballistic and quasi-ballistic systems — Iskander-M / KN-23, X-47 Kinzhal, 3M22 Zircon, ICBMs and S-300 / S-400 used in surface-to-surface mode. High velocity and trajectory typically yield the lowest interception rates."
          unitNoun="missiles"
          dataset={ballistic}
          range={ballisticRange}
          onRangeChange={setBallisticRange}
        />
      )}

      <WeaponsCatalogSection />

      {/* ─────────────── METHODOLOGY ─────────────── */}
      <section id="methodology" className="scroll-mt-24 border-t border-border">
        <div className="container grid gap-8 py-12 md:grid-cols-12 md:py-16">
          <div className="md:col-span-4">
            <div className="src-label mb-2">Methodology</div>
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">
              How the figures are compiled
            </h2>
          </div>
          <div className="space-y-3 text-[14px] leading-relaxed text-muted-foreground md:col-span-8">
            <p>
              Daily reports from the Ukrainian Air Force Command are parsed from a public
              CSV mirror (Petro Ivaniuk, Kaggle) and aggregated to calendar months in UTC.
              <strong className="text-foreground"> Launched</strong> reflects values reported by Ukrainian sources;{" "}
              <strong className="text-foreground">destroyed</strong> reflects confirmed interceptions only.
              Weapons jammed, lost or impacting without interception are not counted as
              destroyed and are reported under <strong className="text-foreground">reached target area</strong>.
            </p>
            <p>
              Rows that mix multiple weapon types in one attack (e.g. "X-101/X-555 and Iskander-K")
              attribute counts to every category referenced. This produces a small overlap between
              cruise and ballistic categories on a handful of mixed-fire nights.
            </p>
            <p>
              Range covered: October 2022 – March 2026. All figures should be treated as{" "}
              <em>reported</em> rather than independently verified. See the{" "}
              <Link to="/methodology" className="underline underline-offset-4 hover:text-foreground">
                full methodology
              </Link>{" "}
              and <Link to="/sources" className="underline underline-offset-4 hover:text-foreground">source list</Link>.
            </p>
          </div>
        </div>
      </section>

      <RelatedSourcesSection />
      <HowToHelpSection />

      {/* Data disclaimer banner */}
      <div className="border-t border-border bg-secondary">
        <div className="container py-4">
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            <strong className="text-foreground">Data note.</strong> Figures are compiled from open
            sources and may contain errors, omissions or revisions. The dataset reflects{" "}
            <em>reported</em> launches and <em>confirmed</em> interceptions; values for weapons
            jammed, lost or unverified are not included. Figures are reviewed and updated on a
            rolling basis.
          </p>
        </div>
      </div>

      <footer className="border-t border-border">
        <div className="container flex flex-col items-start justify-between gap-3 py-6 font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground md:flex-row md:items-center">
          <p>UA Intel · monthly aggregates from Ukrainian Air Force daily reports</p>
          <div className="flex flex-wrap items-center gap-3">
            <span>Last data point: <span className="text-foreground">{lastUpdatedLabel ?? "—"}</span></span>
            <a
              href="/data/missile_attacks_daily.csv"
              download
              className="rounded-sm border border-border px-2.5 py-1 text-foreground transition-colors hover:bg-secondary"
            >
              Download CSV ↓
            </a>
            <Link to="/methodology" className="hover:text-foreground">Methodology</Link>
            <Link to="/sources" className="hover:text-foreground">Sources</Link>
            <Link to="/disclaimer" className="hover:text-foreground">Disclaimer</Link>
          </div>
        </div>
      </footer>

      {!ready && !error && (
        <div className="container py-20 text-center font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          Loading dataset…
        </div>
      )}
    </main>
  );
};

export default Index;
