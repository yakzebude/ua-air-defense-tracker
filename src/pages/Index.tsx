import { useEffect, useMemo, useState } from "react";
import { loadShahedData, type Dataset, type MonthPoint } from "@/lib/shahed-data";
import { MonthlyTrendChart } from "@/components/MonthlyTrendChart";
import { InterceptionRateChart } from "@/components/InterceptionRateChart";
import { SummaryStats } from "@/components/SummaryStats";
import { DateRangeFilter } from "@/components/DateRangeFilter";

const Index = () => {
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<[number, number] | null>(null);

  useEffect(() => {
    loadShahedData()
      .then((d) => {
        setDataset(d);
        setRange([0, d.months.length - 1]);
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
            <span className="text-sm font-semibold tracking-wide">SHAHED WATCH</span>
          </div>
          <span className="text-xs text-muted-foreground">Open data · Updated 2026</span>
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
              Three years of Shahed strikes,{" "}
              <span>measured month by month.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
              Since February 24th, 2022, Russia has launched thousands of Iranian-designed
              Shahed-136/131 attack drones at Ukrainian cities and infrastructure. This
              visualization tracks how many were sent — and how many Ukraine's air defenses
              brought down — every month through March 2026.
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
              <p>Range locked to Jan 2023 – Mar 2026.</p>
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
