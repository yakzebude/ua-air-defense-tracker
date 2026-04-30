import { useEffect, useMemo, useState } from "react";
import { loadShahedData, type Dataset, type MonthPoint } from "@/lib/shahed-data";
import { loadAllMissileCategories } from "@/lib/missiles-data";
import { MonthlyTrendChart } from "@/components/MonthlyTrendChart";
import { InterceptionRateChart } from "@/components/InterceptionRateChart";
import { SummaryStats } from "@/components/SummaryStats";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { ThemeToggle } from "@/components/ThemeToggle";


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

  return (
    <main className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="border-b border-border">
        <div className="container flex items-center justify-between py-4">
          <div className="flex items-center gap-3">
            <div className="h-2 w-2 rounded-full bg-series-launched" />
            <span className="text-sm font-semibold tracking-wide">DEFENCE WATCH</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">Open data · Updated 2026</span>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="border-b border-border">
        <div className="container grid gap-10 py-14 md:grid-cols-12 md:py-20">
          <div className="md:col-span-8">
            <div className="mb-4 inline-block border-l-2 border-series-launched pl-3 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Defense · Data Story
            </div>
            <h1 className="font-serif text-4xl leading-[1.05] tracking-tight md:text-6xl">
              Four years of Russia's war on Ukraine,{" "}
              <span>measured month by month</span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
              Russia has been conducting aerial attacks against Ukraine since the
              full-scale invasion began in February 2022. This dataset focuses
              specifically on the period from October 2022 through the present day,
              beginning with the first full month of sustained Russian strikes using
              Iranian-designed Shahed-136/131 loitering munitions. It tracks the number
              of Shahed drones launched at Ukrainian cities and infrastructure, along
              with the number reportedly intercepted by Ukrainian air defenses. A
              second section extends the picture to ballistic and cruise missiles —
              including Kalibr, X-101/X-555, Iskander-M/K, Kinzhal and other
              stand-off weapons fired at Ukrainian targets over the same period.
            </p>
          </div>
          <aside className="md:col-span-4 md:border-l md:border-border md:pl-8">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              At a glance
            </div>
            {dataset ? (
              <dl className="mt-4 space-y-4 num">
                <div>
                  <dt className="text-xs text-muted-foreground">Total launched</dt>
                  <dd className="font-serif text-2xl">
                    {dataset.totals.launched.toLocaleString()}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Total destroyed</dt>
                  <dd className="font-serif text-2xl">
                    {dataset.totals.destroyed.toLocaleString()}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Overall interception</dt>
                  <dd className="font-serif text-2xl text-series-rate">
                    {(dataset.totals.rate * 100).toFixed(1)}%
                  </dd>
                </div>
              </dl>
            ) : (
              <div className="mt-4 text-sm text-muted-foreground">Loading dataset…</div>
            )}
          </aside>
        </div>
      </section>

      {error && (
        <div className="container py-8 text-sm text-destructive">
          Failed to load dataset: {error}
        </div>
      )}

      {dataset && range && (
        <>
          {/* Summary */}
          <SummaryStats
            launched={totals.launched}
            destroyed={totals.destroyed}
            rate={totals.rate}
            rangeLabel={rangeLabel}
          />

          {/* Filter */}
          <section className="container py-10 md:py-14">
            <DateRangeFilter months={dataset.months} range={range} onChange={setRange} />
          </section>

          {/* Main chart */}
          <section className="container pb-14">
            <div className="mb-6 max-w-3xl">
              <h2 className="font-serif text-2xl md:text-3xl">
                Monthly launches versus interceptions
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Each point is a calendar month. The orange line shows drones launched toward
                Ukraine; the blue line shows how many were destroyed by air defenses. Hover
                for exact figures.
              </p>
            </div>
            <div className="rounded-sm border border-border bg-card p-4 md:p-6">
              <MonthlyTrendChart data={filtered} />
            </div>
            {peak && (
              <p className="mt-3 text-xs text-muted-foreground">
                Peak month in range: <span className="font-semibold text-foreground">{peak.label}</span>{" "}
                with <span className="num">{peak.launched.toLocaleString()}</span> drones launched ·{" "}
                <span className="num">{peak.destroyed.toLocaleString()}</span> destroyed
                ({(peak.rate * 100).toFixed(1)}% intercepted).
              </p>
            )}
          </section>

          {/* Rate chart */}
          <section className="border-t border-border bg-card/30">
            <div className="container py-14">
              <div className="mb-6 max-w-3xl">
                <h2 className="font-serif text-2xl md:text-3xl">
                  Interception efficiency over time
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  The share of incoming Shahed drones that Ukrainian air defenses neutralized
                  each month. The dashed line marks the 50% midpoint.
                </p>
              </div>
              <div className="rounded-sm border border-border bg-card p-4 md:p-6">
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
