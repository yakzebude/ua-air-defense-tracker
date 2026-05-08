import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { loadShahedData, type Dataset, type MonthPoint } from "@/lib/shahed-data";
import { loadAllMissileCategories } from "@/lib/missiles-data";
import { MonthlyTrendChart } from "@/components/MonthlyTrendChart";
import { InterceptionRateChart } from "@/components/InterceptionRateChart";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { ThemeToggle } from "@/components/ThemeToggle";

/* -------------------------------------------------------------------------- */
/*  Small primitives                                                          */
/* -------------------------------------------------------------------------- */

const fmt = (n: number) => n.toLocaleString("en-US");

function CountUp({ value, duration = 1600 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0);
  const startedRef = useRef(false);
  useEffect(() => {
    if (startedRef.current) {
      setDisplay(value);
      return;
    }
    startedRef.current = true;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(value * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <>{display.toLocaleString("en-US")}</>;
}

function StatusBar({ lastUpdated }: { lastUpdated: string | null }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/70 font-mono">
      <div className="container flex items-center justify-between gap-4 py-2 text-[11px] uppercase tracking-[0.18em]">
        <div className="flex items-center gap-3">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-series-launched opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-series-launched" />
          </span>
          <span className="font-semibold tracking-[0.22em]">UA DEFENSE TRACKER</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-muted-foreground md:inline">LAST UPDATE</span>
          <span className="num text-foreground">{lastUpdated ?? "—"}</span>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

function SectionNav() {
  const items = [
    { id: "drones", label: "Shahed drones" },
    { id: "cruise", label: "Cruise missiles" },
    { id: "ballistic", label: "Ballistic missiles" },
    { id: "methodology", label: "Methodology" },
    { id: "related", label: "Related sources" },
  ];
  const [active, setActive] = useState<string>(items[0].id);

  useEffect(() => {
    const sections = items
      .map((it) => document.getElementById(it.id))
      .filter((el): el is HTMLElement => !!el);
    if (!sections.length) return;
    const obs = new IntersectionObserver(
      (entries) => {
        // Pick the entry closest to the top that is currently intersecting.
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
    <nav className="sticky top-[34px] z-30 border-b border-border bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="container flex items-center gap-1 overflow-x-auto py-2 text-[11px] font-mono uppercase tracking-[0.18em]">
        {items.map((it) => {
          const isActive = active === it.id;
          return (
            <a
              key={it.id}
              href={`#${it.id}`}
              aria-current={isActive ? "true" : undefined}
              className={`whitespace-nowrap rounded-sm px-3 py-1 transition-colors ${
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
/*  Related sources                                                           */
/* -------------------------------------------------------------------------- */

type SourceLink = {
  name: string;
  href: string;
  blurb: string;
  tag: string;
};

const RELATED_SOURCES: SourceLink[] = [
  {
    name: "GUR · war-sanctions",
    href: "https://war-sanctions.gur.gov.ua/en/components",
    blurb:
      "Foreign components found in Russian missiles and drones — built and maintained by Ukraine's Defence Intelligence (HUR).",
    tag: "Components & sanctions",
  },
  {
    name: "Ukrainian Air Force",
    href: "https://www.facebook.com/kpszsu",
    blurb:
      "Original daily reports on launched and intercepted weapons, the upstream source of this dataset.",
    tag: "Primary source",
  },
  {
    name: "Oryx",
    href: "https://www.oryxspioenkop.com/2022/02/attack-on-europe-documenting-equipment.html",
    blurb:
      "Open-source, photo-verified record of equipment losses on both sides of the war.",
    tag: "Verified losses",
  },
  {
    name: "ISW · Russia Daily Updates",
    href: "https://www.understandingwar.org/backgrounder/russian-offensive-campaign-assessment",
    blurb:
      "Institute for the Study of War — daily campaign assessments and operational maps.",
    tag: "Analysis",
  },
  {
    name: "CSIS · Missile Threat",
    href: "https://missilethreat.csis.org/",
    blurb:
      "Reference profiles for the cruise, ballistic and hypersonic weapons used against Ukraine.",
    tag: "Weapon profiles",
  },
  {
    name: "Kiel Institute · Ukraine Support Tracker",
    href: "https://www.ifw-kiel.de/topics/war-against-ukraine/ukraine-support-tracker/",
    blurb:
      "Quantifies military, financial and humanitarian aid pledged to Ukraine by Western governments.",
    tag: "Aid tracking",
  },
];

function RelatedSourcesSection() {
  return (
    <section id="related" className="scroll-mt-24 border-t border-border">
      <div className="container py-14 md:py-20">
        <div className="mb-8 max-w-3xl">
          <div className="mb-4 inline-block border-l-2 border-series-launched pl-3 font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Further reading
          </div>
          <h2 className="font-serif text-3xl md:text-4xl leading-tight">
            Related sources & investigations
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            This tracker only covers the volume side of the air war. For the
            components inside those weapons, the people losing them and the support
            flowing the other way, the sources below pick up where these charts end.
          </p>
        </div>
        <div className="grid gap-px bg-border md:grid-cols-2 lg:grid-cols-3">
          {RELATED_SOURCES.map((s) => (
            <a
              key={s.href}
              href={s.href}
              target="_blank"
              rel="noopener noreferrer external"
              className="group flex flex-col gap-3 bg-card p-5 transition-colors hover:bg-secondary/50"
            >
              <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                {s.tag}
              </div>
              <h3 className="font-serif text-xl leading-tight">{s.name}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{s.blurb}</p>
              <div className="mt-auto pt-2 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground transition-colors group-hover:text-foreground">
                Visit site ↗
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  KPI primitives                                                            */
/* -------------------------------------------------------------------------- */

type Accent = "launched" | "destroyed" | "rate" | "neutral";
const accentClass: Record<Accent, string> = {
  launched: "before:bg-series-launched",
  destroyed: "before:bg-series-destroyed",
  rate: "before:bg-series-rate",
  neutral: "before:bg-foreground",
};

function KPI({
  label,
  value,
  sub,
  accent = "neutral",
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: Accent;
}) {
  return (
    <div
      className={`relative pl-4 before:absolute before:left-0 before:top-1 before:h-[calc(100%-0.25rem)] before:w-[3px] ${accentClass[accent]}`}
    >
      <div className="text-[11px] font-mono font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 font-serif text-3xl md:text-4xl text-foreground num leading-none">
        {value}
      </div>
      {sub && <div className="mt-2 text-xs text-muted-foreground num">{sub}</div>}
    </div>
  );
}

/** Tiny inline sparkline (no axes), used for at-a-glance category cards. */
function Sparkline({
  data,
  stroke = "hsl(var(--series-launched))",
  height = 36,
}: {
  data: number[];
  stroke?: string;
  height?: number;
}) {
  if (!data.length) return null;
  const w = 120;
  const h = height;
  const max = Math.max(...data, 1);
  const step = w / Math.max(data.length - 1, 1);
  const points = data
    .map((v, i) => `${(i * step).toFixed(1)},${(h - (v / max) * h).toFixed(1)}`)
    .join(" ");
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className="h-9 w-full"
      aria-hidden="true"
    >
      <polyline
        fill="none"
        stroke={stroke}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        points={points}
      />
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/*  Hero pillar card (one of three categories)                                */
/* -------------------------------------------------------------------------- */

function PillarCard({
  index,
  kicker,
  title,
  total,
  destroyed,
  spark,
  href,
}: {
  index: string;
  kicker: string;
  title: string;
  total: number;
  destroyed: number;
  spark: number[];
  href: string;
}) {
  const rate = total > 0 ? destroyed / total : 0;
  const reached = Math.max(total - destroyed, 0);
  return (
    <a
      href={href}
      className="group relative flex flex-col gap-4 border border-border bg-card p-5 transition-colors hover:bg-secondary/50"
    >
      <div className="flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
        <span>{index}</span>
        <span>{kicker}</span>
      </div>
      <h3 className="font-serif text-xl leading-tight md:text-2xl">{title}</h3>
      <div className="font-serif text-5xl md:text-6xl num leading-none">
        <CountUp value={total} />
      </div>
      <Sparkline data={spark} />
      <div className="grid grid-cols-3 gap-3 border-t border-border pt-3 text-xs">
        <div>
          <div className="font-mono uppercase tracking-wider text-muted-foreground">Down</div>
          <div className="mt-1 num font-semibold text-series-destroyed">{fmt(destroyed)}</div>
        </div>
        <div>
          <div className="font-mono uppercase tracking-wider text-muted-foreground">Rate</div>
          <div className="mt-1 num font-semibold text-series-rate">
            {(rate * 100).toFixed(1)}%
          </div>
        </div>
        <div>
          <div className="font-mono uppercase tracking-wider text-muted-foreground">Through</div>
          <div className="mt-1 num font-semibold text-foreground">{fmt(reached)}</div>
        </div>
      </div>
      <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground transition-colors group-hover:text-foreground">
        Read section →
      </div>
    </a>
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
  unitNoun: string; // "drones" or "missiles"
  dataset: Dataset;
  range: [number, number];
  onRangeChange: (r: [number, number]) => void;
};

function CategorySection({
  id,
  kicker,
  title,
  description,
  unitNoun,
  dataset,
  range,
  onRangeChange,
}: CategorySectionProps) {
  const filtered = dataset.months.slice(range[0], range[1] + 1);
  const launched = filtered.reduce((s, m) => s + m.launched, 0);
  const destroyed = filtered.reduce((s, m) => s + m.destroyed, 0);
  const rate = launched > 0 ? destroyed / launched : 0;
  const peak = filtered.length
    ? filtered.reduce((a, b) => (b.launched > a.launched ? b : a))
    : null;
  const rangeLabel = filtered.length
    ? `${filtered[0].label} – ${filtered[filtered.length - 1].label}`
    : "";

  return (
    <section id={id} className="scroll-mt-24 border-t border-border">
      <div className="container py-14 md:py-20">
        <div className="mb-8 max-w-3xl">
          <div className="mb-4 inline-block border-l-2 border-series-launched pl-3 font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            {kicker}
          </div>
          <h2 className="font-serif text-3xl md:text-4xl leading-tight">{title}</h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">{description}</p>
        </div>

        <div className="mb-8 grid grid-cols-2 gap-x-6 gap-y-6 border-y border-border py-6 md:grid-cols-4">
          <KPI label="Launched" value={fmt(launched)} sub={rangeLabel} accent="launched" />
          <KPI
            label="Destroyed"
            value={fmt(destroyed)}
            sub="confirmed interceptions"
            accent="destroyed"
          />
          <KPI
            label="Interception rate"
            value={`${(rate * 100).toFixed(1)}%`}
            sub={`${fmt(destroyed)} of ${fmt(launched)}`}
            accent="rate"
          />
          <KPI
            label="Reached target area"
            value={fmt(Math.max(launched - destroyed, 0))}
            sub={
              launched > 0
                ? `${(((launched - destroyed) / launched) * 100).toFixed(1)}% of launches`
                : "—"
            }
          />
        </div>

        <div className="mb-10">
          <DateRangeFilter months={dataset.months} range={range} onChange={onRangeChange} />
        </div>

        <div className="rounded-sm border border-border bg-card p-4 md:p-6">
          <MonthlyTrendChart data={filtered} />
        </div>
        {peak && (
          <p className="mt-3 text-xs text-muted-foreground">
            Peak month in range:{" "}
            <span className="font-semibold text-foreground">{peak.label}</span> with{" "}
            <span className="num">{fmt(peak.launched)}</span> {unitNoun} launched ·{" "}
            <span className="num">{fmt(peak.destroyed)}</span> destroyed (
            {(peak.rate * 100).toFixed(1)}% intercepted).
          </p>
        )}

        <div className="mt-10 rounded-sm border border-border bg-card p-4 md:p-6">
          <InterceptionRateChart data={filtered} />
        </div>
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
  const [aboutOpen, setAboutOpen] = useState(false);

  useEffect(() => {
    loadShahedData()
      .then((d) => {
        setShahed(d);
        setShahedRange([0, d.months.length - 1]);
      })
      .catch((e) => setError(String(e)));

    loadAllMissileCategories()
      .then(({ cruise: c, ballistic: b }) => {
        setCruise(c);
        setCruiseRange([0, c.months.length - 1]);
        setBallistic(b);
        setBallisticRange([0, b.months.length - 1]);
      })
      .catch((e) => setError(String(e)));
  }, []);

  const ready = shahed && cruise && ballistic;

  const grand = useMemo(() => {
    if (!ready) return { launched: 0, destroyed: 0, rate: 0 };
    const launched =
      shahed!.totals.launched + cruise!.totals.launched + ballistic!.totals.launched;
    const destroyed =
      shahed!.totals.destroyed + cruise!.totals.destroyed + ballistic!.totals.destroyed;
    return { launched, destroyed, rate: launched > 0 ? destroyed / launched : 0 };
  }, [ready, shahed, cruise, ballistic]);

  const sparks = useMemo(() => {
    return {
      shahed: shahed?.months.map((m) => m.launched) ?? [],
      cruise: cruise?.months.map((m) => m.launched) ?? [],
      ballistic: ballistic?.months.map((m) => m.launched) ?? [],
    };
  }, [shahed, cruise, ballistic]);

  const lastUpdatedLabel = useMemo(() => {
    const lastWithData = (d: Dataset | null): MonthPoint | null => {
      if (!d) return null;
      for (let i = d.months.length - 1; i >= 0; i--) {
        if (d.months[i].launched > 0) return d.months[i];
      }
      return null;
    };
    const candidates = [lastWithData(shahed), lastWithData(cruise), lastWithData(ballistic)]
      .filter((m): m is MonthPoint => !!m)
      .sort((a, b) => b.date.getTime() - a.date.getTime());
    return candidates[0]?.label ?? null;
  }, [shahed, cruise, ballistic]);

  return (
    <main className="min-h-screen bg-background">
      <StatusBar lastUpdated={lastUpdatedLabel} />
      <SectionNav />

      {/* ─────────────── HERO ─────────────── */}
      <section className="border-b border-border">
        <div className="container py-14 md:py-20">
          <div className="mb-6 inline-block border-l-2 border-series-launched pl-3 font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Defence · Data Story · Oct 2022 – present
          </div>

          <div className="grid gap-10 md:grid-cols-12 md:items-end">
            <div className="md:col-span-7">
              <h1 className="font-serif text-4xl leading-[1.05] tracking-tight md:text-6xl">
                Russia's air war on Ukraine, in numbers.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg">
                Each month, Ukraine's air defences face thousands of incoming weapons —
                Iranian-designed Shahed drones, Russian cruise missiles, and ballistic
                weapons that are far harder to intercept. This is the monthly record,
                from October 2022 to today.
              </p>
            </div>

            <div className="md:col-span-5 md:border-l md:border-border md:pl-8">
              <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                Total weapons fired at Ukraine
              </div>
              <div className="mt-2 font-serif text-7xl leading-none tracking-tight num md:text-[8rem]">
                {ready ? <CountUp value={grand.launched} /> : "—"}
              </div>
              <div className="mt-4 flex flex-wrap items-baseline gap-x-5 gap-y-1 text-sm text-muted-foreground num">
                <span>
                  <span className="font-semibold text-series-destroyed">
                    {ready ? fmt(grand.destroyed) : "—"}
                  </span>{" "}
                  destroyed
                </span>
                <span>
                  <span className="font-semibold text-series-rate">
                    {ready ? `${(grand.rate * 100).toFixed(1)}%` : "—"}
                  </span>{" "}
                  intercepted
                </span>
                <span>
                  <span className="font-semibold text-foreground">
                    {ready ? fmt(Math.max(grand.launched - grand.destroyed, 0)) : "—"}
                  </span>{" "}
                  through
                </span>
              </div>
            </div>
          </div>

          {/* About — collapsible */}
          <div className="mt-6 border-t border-border pt-3">
            <button
              type="button"
              onClick={() => setAboutOpen((v) => !v)}
              aria-expanded={aboutOpen}
              className="flex w-full items-center justify-between gap-4 text-left font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:text-foreground"
            >
              <span>About this project</span>
              <ChevronDown
                className={`h-4 w-4 transition-transform duration-300 ${
                  aboutOpen ? "rotate-180" : ""
                }`}
              />
            </button>
            {aboutOpen && (
              <p className="mt-3 max-w-3xl animate-fade-in text-sm leading-relaxed text-muted-foreground">
                Daily reports from the Air Force Command of the Armed Forces of Ukraine
                are aggregated to monthly totals and broken into three weapon families:
                Shahed-136/131 loitering munitions; cruise / air-to-surface missiles
                (Kalibr, X-101/X-555, X-22, X-59/X-69, Iskander-K, P-800 Oniks, others);
                and ballistic weapons (Iskander-M / KN-23, Kinzhal, 3M22 Zircon,
                S-300/S-400 fired in surface-to-surface mode, ICBMs). Mixed-model rows
                contribute to every category they list. Source:{" "}
                <a
                  href="https://www.kaggle.com/datasets/piterfm/massive-missile-attacks-on-ukraine"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2 hover:text-foreground"
                >
                  Kaggle dataset
                </a>
                .
              </p>
            )}
          </div>
        </div>
      </section>

      {/* ─────────────── THREE-PILLAR KPI ─────────────── */}
      {ready && (
        <section className="border-b border-border bg-secondary/30">
          <div className="container py-12 md:py-16">
            <div className="mb-8 flex items-baseline justify-between gap-6">
              <div>
                <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                  At a glance
                </div>
                <h2 className="mt-1 font-serif text-2xl md:text-3xl">
                  Three weapon categories, since October 2022
                </h2>
              </div>
              <div className="hidden text-right font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground md:block">
                Click any card to read the section
              </div>
            </div>
            <div className="grid gap-px bg-border md:grid-cols-3">
              <PillarCard
                index="01"
                kicker="Loitering munitions"
                title="Shahed-136/131 attack drones"
                total={shahed!.totals.launched}
                destroyed={shahed!.totals.destroyed}
                spark={sparks.shahed}
                href="#drones"
              />
              <PillarCard
                index="02"
                kicker="Cruise & air-to-surface"
                title="Cruise missiles"
                total={cruise!.totals.launched}
                destroyed={cruise!.totals.destroyed}
                spark={sparks.cruise}
                href="#cruise"
              />
              <PillarCard
                index="03"
                kicker="Ballistic & quasi-ballistic"
                title="Ballistic missiles"
                total={ballistic!.totals.launched}
                destroyed={ballistic!.totals.destroyed}
                spark={sparks.ballistic}
                href="#ballistic"
              />
            </div>
          </div>
        </section>
      )}

      {error && (
        <div className="container py-8 text-sm text-destructive">
          Failed to load dataset: {error}
        </div>
      )}

      {/* ─────────────── SECTIONS ─────────────── */}
      {shahed && shahedRange && (
        <CategorySection
          id="drones"
          kicker="01 · Shahed-136/131"
          title="Shahed-136/131 attack drones fired at Ukraine"
          description="Iranian-designed loitering munitions launched at Ukrainian cities and infrastructure, with monthly interceptions reported by Ukrainian air defenses. Cruise and ballistic missiles are tracked in their own sections below."
          unitNoun="drones"
          dataset={shahed}
          range={shahedRange}
          onRangeChange={setShahedRange}
        />
      )}

      {cruise && cruiseRange && (
        <CategorySection
          id="cruise"
          kicker="02 · Cruise missiles"
          title="Cruise missiles fired at Ukraine"
          description="Cruise and air-to-surface missiles — Kalibr, X-101/X-555, X-22, X-32, X-59/X-69, X-31, X-35, Iskander-K and P-800 Oniks. Generally subsonic, easier to intercept than ballistic weapons."
          unitNoun="missiles"
          dataset={cruise}
          range={cruiseRange}
          onRangeChange={setCruiseRange}
        />
      )}

      {ballistic && ballisticRange && (
        <CategorySection
          id="ballistic"
          kicker="03 · Ballistic missiles"
          title="Ballistic missiles fired at Ukraine"
          description="Ballistic and quasi-ballistic weapons — Iskander-M / KN-23, X-47 Kinzhal, 3M22 Zircon, ICBMs and S-300 / S-400 systems used in surface-to-surface mode. Their high speed and trajectory make them the hardest category to intercept."
          unitNoun="missiles"
          dataset={ballistic}
          range={ballisticRange}
          onRangeChange={setBallisticRange}
        />
      )}

      {/* ─────────────── METHODOLOGY ─────────────── */}
      <section id="methodology" className="scroll-mt-24 border-t border-border bg-secondary/30">
        <div className="container grid gap-10 py-14 md:grid-cols-12 md:py-20">
          <div className="md:col-span-4">
            <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              Methodology
            </div>
            <h2 className="mt-2 font-serif text-3xl leading-tight md:text-4xl">
              How the numbers are built
            </h2>
          </div>
          <div className="space-y-4 text-sm leading-relaxed text-muted-foreground md:col-span-8">
            <p>
              Daily reports from the Air Force Command of the Armed Forces of Ukraine
              are parsed from a public CSV and aggregated to calendar months in UTC.
              "Launched" reflects the count reported by Ukrainian sources for that
              window; "Destroyed" reflects confirmed interceptions only. Weapons that
              were jammed, lost, or fell without reaching their target are not counted
              as "destroyed" — they are absorbed into "Reached target area".
            </p>
            <p>
              Rows that mix multiple weapon types in a single attack (for example
              "X-101/X-555 and Iskander-K") have their counts attributed to every
              category they reference. This produces a small overlap between the
              cruise and ballistic categories on a handful of mixed-fire nights.
            </p>
            <p>
              Range covered: October 2022 – March 2026. Source:{" "}
              <a
                href="https://www.kaggle.com/datasets/piterfm/massive-missile-attacks-on-ukraine"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-foreground"
              >
                Kaggle — Massive missile attacks on Ukraine
              </a>
              .
            </p>
          </div>
        </div>
      </section>

      <RelatedSourcesSection />

      <footer className="border-t border-border">
        <div className="container flex flex-col items-start justify-between gap-4 py-8 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground md:flex-row md:items-center">
          <p>
            Defence Watch · monthly aggregates from Ukrainian Air Force daily reports.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <span>
              Last data point:{" "}
              <span className="text-foreground">{lastUpdatedLabel ?? "—"}</span>
            </span>
            <a
              href="/data/missile_attacks_daily.csv"
              download
              className="rounded-sm border border-border px-3 py-1 text-foreground transition-colors hover:bg-secondary"
            >
              Download CSV ↓
            </a>
            <a
              href="#methodology"
              className="underline-offset-4 hover:text-foreground hover:underline"
            >
              Methodology
            </a>
          </div>
        </div>
      </footer>

      {!ready && !error && (
        <div className="container py-24 text-center font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          Loading dataset…
        </div>
      )}
    </main>
  );
};

export default Index;
