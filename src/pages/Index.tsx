import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { loadShahedData, type Dataset, type MonthPoint } from "@/lib/shahed-data";
import { loadAllMissileCategories } from "@/lib/missiles-data";
import { MonthlyTrendChart } from "@/components/MonthlyTrendChart";
import { InterceptionRateChart } from "@/components/InterceptionRateChart";
import { SummaryStats } from "@/components/SummaryStats";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { ThemeToggle } from "@/components/ThemeToggle";

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

function StatusBar() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const stamp = now
    .toISOString()
    .replace("T", " · ")
    .replace(/:\d\d\.\d+Z$/, " UTC")
    .toUpperCase();
  return (
    <header className="border-b border-border bg-card/60 font-mono">
      <div className="container flex items-center justify-between gap-4 py-2 text-[11px] uppercase tracking-[0.18em]">
        <div className="flex items-center gap-3">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-series-launched opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-series-launched" />
          </span>
          <span className="font-semibold tracking-[0.22em]">DEFENCE WATCH</span>
          <span className="hidden text-muted-foreground sm:inline">// LIVE STATUS</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-muted-foreground md:inline">LAST UPDATE</span>
          <span className="num text-foreground animate-pulse">{stamp}</span>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
type MissileSectionProps = {
  kicker: string;
  title: string;
  description: string;
  dataset: Dataset | null;
  range: [number, number] | null;
  onRangeChange: (r: [number, number]) => void;
};

const MissileSection = ({
  kicker,
  title,
  description,
  dataset,
  range,
  onRangeChange,
}: MissileSectionProps) => {
  if (!dataset || !range) return null;
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
    <section className="border-t border-border">
      <div className="container py-14 md:py-20">
        <div className="mb-8 max-w-3xl">
          <div className="mb-4 inline-block border-l-2 border-series-launched pl-3 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            {kicker}
          </div>
          <h2 className="font-serif text-3xl md:text-4xl leading-tight">{title}</h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">{description}</p>
        </div>

        <div className="mb-8 grid grid-cols-2 gap-x-6 gap-y-6 border-y border-border py-6 md:grid-cols-4">
          <div className="relative pl-4 before:absolute before:left-0 before:top-1 before:h-[calc(100%-0.25rem)] before:w-[3px] before:bg-series-launched">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Launched</div>
            <div className="mt-1 font-serif text-3xl md:text-4xl num">{launched.toLocaleString("en-US")}</div>
            <div className="mt-1 text-xs text-muted-foreground">{rangeLabel}</div>
          </div>
          <div className="relative pl-4 before:absolute before:left-0 before:top-1 before:h-[calc(100%-0.25rem)] before:w-[3px] before:bg-series-destroyed">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Destroyed</div>
            <div className="mt-1 font-serif text-3xl md:text-4xl num">{destroyed.toLocaleString("en-US")}</div>
            <div className="mt-1 text-xs text-muted-foreground">confirmed interceptions</div>
          </div>
          <div className="relative pl-4 before:absolute before:left-0 before:top-1 before:h-[calc(100%-0.25rem)] before:w-[3px] before:bg-series-rate">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Interception rate</div>
            <div className="mt-1 font-serif text-3xl md:text-4xl num">{(rate * 100).toFixed(1)}%</div>
            <div className="mt-1 text-xs text-muted-foreground num">{destroyed.toLocaleString("en-US")} of {launched.toLocaleString("en-US")}</div>
          </div>
          <div className="relative pl-4 before:absolute before:left-0 before:top-1 before:h-[calc(100%-0.25rem)] before:w-[3px] before:bg-foreground">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Reached target area</div>
            <div className="mt-1 font-serif text-3xl md:text-4xl num">{Math.max(launched - destroyed, 0).toLocaleString("en-US")}</div>
            <div className="mt-1 text-xs text-muted-foreground">{launched > 0 ? (((launched - destroyed) / launched) * 100).toFixed(1) : "0.0"}% of launches</div>
          </div>
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
            <span className="font-semibold text-foreground">{peak.label}</span>{" "}
            with <span className="num">{peak.launched.toLocaleString()}</span> missiles launched ·{" "}
            <span className="num">{peak.destroyed.toLocaleString()}</span> destroyed
            ({(peak.rate * 100).toFixed(1)}% intercepted).
          </p>
        )}

        <div className="mt-10 rounded-sm border border-border bg-card p-4 md:p-6">
          <InterceptionRateChart data={filtered} />
        </div>
      </div>
    </section>
  );
};

const Index = () => {
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<[number, number] | null>(null);

  const [cruise, setCruise] = useState<Dataset | null>(null);
  const [cruiseRange, setCruiseRange] = useState<[number, number] | null>(null);

  const [ballistic, setBallistic] = useState<Dataset | null>(null);
  const [ballisticRange, setBallisticRange] = useState<[number, number] | null>(null);

  useEffect(() => {
    loadShahedData()
      .then((d) => {
        setDataset(d);
        setRange([0, d.months.length - 1]);
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

  const filtered = useMemo<MonthPoint[]>(() => {
    if (!dataset || !range) return [];
    return dataset.months.slice(range[0], range[1] + 1);
  }, [dataset, range]);

  const totals = useMemo(() => {
    const launched = filtered.reduce((s, m) => s + m.launched, 0);
    const destroyed = filtered.reduce((s, m) => s + m.destroyed, 0);
    return {
      launched,
      destroyed,
      rate: launched > 0 ? destroyed / launched : 0,
    };
  }, [filtered]);

  const peak = useMemo(() => {
    if (!filtered.length) return null;
    return filtered.reduce((a, b) => (b.launched > a.launched ? b : a));
  }, [filtered]);

  const rangeLabel =
    filtered.length > 0 ? `${filtered[0].label} – ${filtered[filtered.length - 1].label}` : "";

  const ready = dataset && cruise && ballistic;
  const grandLaunched = ready
    ? dataset.totals.launched + cruise.totals.launched + ballistic.totals.launched
    : 0;
  const grandDestroyed = ready
    ? dataset.totals.destroyed + cruise.totals.destroyed + ballistic.totals.destroyed
    : 0;
  const grandRate = grandLaunched > 0 ? grandDestroyed / grandLaunched : 0;

  const [aboutOpen, setAboutOpen] = useState(false);

  return (
    <main className="min-h-screen bg-background">
      <StatusBar />

      {/* Hero — single hook number */}
      <section className="border-b border-border">
        <div className="container py-20 md:py-28">
          <div className="mb-6 inline-block border-l-2 border-series-launched pl-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Defense · Data Story · Oct 2022 – present
          </div>

          <div className="grid gap-10 md:grid-cols-12 md:items-end">
            <div className="md:col-span-8">
              <div className="text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground">
                Total drones &amp; missiles fired at Ukraine
              </div>
              <div className="mt-3 font-serif text-7xl leading-none tracking-tight md:text-[10rem] num">
                {ready ? <CountUp value={grandLaunched} /> : "—"}
              </div>
              <div className="mt-4 flex flex-wrap items-baseline gap-x-6 gap-y-1 text-sm text-muted-foreground num">
                <span>
                  <span className="font-semibold text-series-destroyed">
                    {ready ? grandDestroyed.toLocaleString() : "—"}
                  </span>{" "}
                  destroyed
                </span>
                <span>
                  <span className="font-semibold text-series-rate">
                    {ready ? `${(grandRate * 100).toFixed(1)}%` : "—"}
                  </span>{" "}
                  intercepted
                </span>
                <span>
                  <span className="font-semibold text-foreground">
                    {ready ? Math.max(grandLaunched - grandDestroyed, 0).toLocaleString() : "—"}
                  </span>{" "}
                  reached target area
                </span>
              </div>
            </div>

            <div className="md:col-span-4 md:border-l md:border-border md:pl-8">
              <h1 className="font-serif text-2xl leading-[1.15] md:text-3xl">
                Four years of Russia's war on Ukraine, measured month by month.
              </h1>
            </div>
          </div>

          {/* Collapsible project description */}
          <div className="mt-10 border-t border-border pt-4">
            <button
              type="button"
              onClick={() => setAboutOpen((v) => !v)}
              aria-expanded={aboutOpen}
              className="flex w-full items-center justify-between gap-4 text-left text-[11px] font-mono font-semibold uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:text-foreground"
            >
              <span>About this project</span>
              <ChevronDown
                className={`h-4 w-4 transition-transform duration-300 ${aboutOpen ? "rotate-180" : ""}`}
              />
            </button>
            {aboutOpen && (
              <p className="mt-4 max-w-3xl animate-fade-in text-sm leading-relaxed text-muted-foreground">
                Russia has been conducting aerial attacks against Ukraine since the
                full-scale invasion began in February 2022. This dataset focuses on the
                period from October 2022 onward — the first full month of sustained
                strikes using Iranian-designed Shahed-136/131 loitering munitions. It
                tracks drones launched at Ukrainian cities and infrastructure, alongside
                interceptions reported by Ukrainian air defenses. Additional sections
                extend the picture to cruise missiles (Kalibr, X-101/X-555, Iskander-K,
                Oniks and others) and ballistic weapons (Iskander-M / KN-23, Kinzhal,
                Zircon, S-300/S-400 in surface-to-surface mode).
              </p>
            )}
          </div>
        </div>
      </section>

      {error && (
        <div className="container py-8 text-sm text-destructive">
          Failed to load dataset: {error}
        </div>
      )}

      {dataset && range && (
        <>
          {/* Combined summary (drones + cruise + ballistic missiles) */}
          {cruise && ballistic && (() => {
            const combinedLaunched =
              dataset.totals.launched + cruise.totals.launched + ballistic.totals.launched;
            const combinedDestroyed =
              dataset.totals.destroyed + cruise.totals.destroyed + ballistic.totals.destroyed;
            const combinedRate = combinedLaunched > 0 ? combinedDestroyed / combinedLaunched : 0;
            const combinedRangeLabel = dataset.months.length
              ? `${dataset.months[0].label} – ${dataset.months[dataset.months.length - 1].label}`
              : "";
            return (
              <SummaryStats
                launched={combinedLaunched}
                destroyed={combinedDestroyed}
                rate={combinedRate}
                rangeLabel={combinedRangeLabel}
              />
            );
          })()}

          {/* Shahed drones */}
          <section className="border-t border-border">
            <div className="container py-14 md:py-20">
              <div className="mb-8 max-w-3xl">
                <div className="mb-4 inline-block border-l-2 border-series-launched pl-3 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Group · Shahed-136/131
                </div>
                <h2 className="font-serif text-3xl md:text-4xl leading-tight">
                  Shahed-136/131 attack drones fired at Ukraine
                </h2>
                <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                  Aggregated monthly totals for Iranian-designed Shahed-136/131 loitering
                  munitions launched at Ukrainian cities and infrastructure, alongside the
                  number reportedly intercepted by Ukrainian air defenses. Cruise and
                  ballistic missiles are tracked in their own sections below.
                </p>
              </div>

              <div className="mb-8 grid grid-cols-2 gap-x-6 gap-y-6 border-y border-border py-6 md:grid-cols-4">
                <div className="relative pl-4 before:absolute before:left-0 before:top-1 before:h-[calc(100%-0.25rem)] before:w-[3px] before:bg-series-launched">
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Launched</div>
                  <div className="mt-1 font-serif text-3xl md:text-4xl num">{totals.launched.toLocaleString("en-US")}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{rangeLabel}</div>
                </div>
                <div className="relative pl-4 before:absolute before:left-0 before:top-1 before:h-[calc(100%-0.25rem)] before:w-[3px] before:bg-series-destroyed">
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Destroyed</div>
                  <div className="mt-1 font-serif text-3xl md:text-4xl num">{totals.destroyed.toLocaleString("en-US")}</div>
                  <div className="mt-1 text-xs text-muted-foreground">confirmed interceptions</div>
                </div>
                <div className="relative pl-4 before:absolute before:left-0 before:top-1 before:h-[calc(100%-0.25rem)] before:w-[3px] before:bg-series-rate">
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Interception rate</div>
                  <div className="mt-1 font-serif text-3xl md:text-4xl num">{(totals.rate * 100).toFixed(1)}%</div>
                  <div className="mt-1 text-xs text-muted-foreground num">{totals.destroyed.toLocaleString("en-US")} of {totals.launched.toLocaleString("en-US")}</div>
                </div>
                <div className="relative pl-4 before:absolute before:left-0 before:top-1 before:h-[calc(100%-0.25rem)] before:w-[3px] before:bg-foreground">
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Reached target area</div>
                  <div className="mt-1 font-serif text-3xl md:text-4xl num">{Math.max(totals.launched - totals.destroyed, 0).toLocaleString("en-US")}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{totals.launched > 0 ? (((totals.launched - totals.destroyed) / totals.launched) * 100).toFixed(1) : "0.0"}% of launches</div>
                </div>
              </div>

              <div className="mb-10">
                <DateRangeFilter months={dataset.months} range={range} onChange={setRange} />
              </div>

              <div className="rounded-sm border border-border bg-card p-4 md:p-6">
                <MonthlyTrendChart data={filtered} />
              </div>
              {peak && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Peak month in range:{" "}
                  <span className="font-semibold text-foreground">{peak.label}</span>{" "}
                  with <span className="num">{peak.launched.toLocaleString()}</span> drones launched ·{" "}
                  <span className="num">{peak.destroyed.toLocaleString()}</span> destroyed
                  ({(peak.rate * 100).toFixed(1)}% intercepted).
                </p>
              )}

              <div className="mt-10 rounded-sm border border-border bg-card p-4 md:p-6">
                <InterceptionRateChart data={filtered} />
              </div>
            </div>
          </section>

          {/* Cruise missiles */}
          <MissileSection
            kicker="Group · Cruise Missiles"
            title="Cruise missiles fired at Ukraine"
            description="Aggregated monthly totals for cruise and air-to-surface missiles — Kalibr, X-101/X-555, X-22, X-32, X-59/X-69, X-31, X-35, Iskander-K and P-800 Oniks. Ballistic missiles and Shahed drones are tracked in their own sections."
            dataset={cruise}
            range={cruiseRange}
            onRangeChange={setCruiseRange}
          />

          {/* Ballistic missiles */}
          <MissileSection
            kicker="Group · Ballistic Missiles"
            title="Ballistic missiles fired at Ukraine"
            description="Aggregated monthly totals for ballistic and quasi-ballistic weapons — Iskander-M / KN-23, X-47 Kinzhal, 3M22 Zircon, intercontinental ballistic missiles and S-300/S-400 systems used in surface-to-surface mode."
            dataset={ballistic}
            range={ballisticRange}
            onRangeChange={setBallisticRange}
          />

          {/* Footer */}
          <footer className="border-t border-border">
            <div className="container flex flex-col items-start justify-between gap-3 py-8 text-xs text-muted-foreground md:flex-row md:items-center">
              <p>
                Data: daily reports from the Air Force Command of the Armed Forces of
                Ukraine, aggregated to monthly totals. Filtered to model{" "}
                <span className="font-mono">Shahed-136/131</span>. Source:{" "}
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
              <p>Range: Oct 2022 – Mar 2026.</p>
            </div>
          </footer>
        </>
      )}

      {!dataset && !error && (
        <div className="container py-24 text-center text-sm text-muted-foreground">
          Loading dataset…
        </div>
      )}
    </main>
  );
};

export default Index;
