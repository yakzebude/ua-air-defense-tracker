import { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import type { Dataset, MonthPoint } from "@/lib/shahed-data";
import { Panel, SourceLabel } from "@/components/ui/panel";
import { rampColor } from "@/lib/threat-ramp";

const fmt = (n: number) => n.toLocaleString("en-US");
const PRIMARY_SOURCE = "Air Force Command of the Armed Forces of Ukraine (weekly reports, via Kaggle)";

type CategoryKey = "uavs" | "cruise" | "ballistic";

// Grayscale ramp — UAVs lightest, ballistic darkest (highest threat / lowest intercept).
const CAT_COLORS: Record<CategoryKey, string> = {
  uavs:      "hsl(220 10% 62%)",   // light gray   — UAVs
  cruise:    "hsl(220 12% 42%)",   // mid gray     — cruise
  ballistic: "hsl(220 18% 22%)",   // dark gray    — ballistic
};

const CAT_LABELS: Record<CategoryKey, string> = {
  uavs: "UAVs",
  cruise: "Cruise",
  ballistic: "Ballistic",
};

interface Props {
  shahed: Dataset;
  cruise: Dataset;
  ballistic: Dataset;
}

/* -------------------------------------------------------------------------- */
/*  Stacked area — composition over time                                      */
/* -------------------------------------------------------------------------- */

function StackedTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((s: number, p: any) => s + (p.value ?? 0), 0);
  return (
    <div className="panel min-w-[180px] px-3 py-2 font-mono text-[11px]">
      <div className="mb-1.5 src-label">{label}</div>
      <div className="space-y-1">
        {payload.slice().reverse().map((p: any) => (
          <div key={p.dataKey} className="flex items-center justify-between gap-6 text-foreground">
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-sm" style={{ background: p.color }} />
              {p.name}
            </span>
            <span className="num font-semibold">{fmt(p.value as number)}</span>
          </div>
        ))}
        <div className="mt-1 flex items-center justify-between gap-6 border-t border-border pt-1 text-muted-foreground">
          <span>Total</span>
          <span className="num font-semibold text-foreground">{fmt(total)}</span>
        </div>
      </div>
    </div>
  );
}

type SeriesKey = CategoryKey;

function CompositionAreaChart({
  data,
  series,
  height = 300,
}: {
  data: Array<{ label: string; uavs: number; cruise: number; ballistic: number }>;
  series: SeriesKey[];
  height?: number;
}) {
  const ticks = useMemo(() => data.filter((_, i) => i % 4 === 0).map((m) => m.label), [data]);
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
          <CartesianGrid stroke="hsl(var(--grid))" vertical={false} />
          <XAxis
            dataKey="label"
            ticks={ticks}
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: "hsl(var(--border))" }}
          />
          <YAxis
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={48}
            tickFormatter={(v) => fmt(v as number)}
          />
          <Tooltip content={<StackedTooltip />} cursor={{ stroke: "hsl(var(--foreground))", strokeOpacity: 0.2 }} />
          {series.map((k) => (
            <Area
              key={k}
              type="monotone"
              dataKey={k}
              name={CAT_LABELS[k]}
              stackId="1"
              stroke={CAT_COLORS[k]}
              strokeWidth={1.25}
              fill={CAT_COLORS[k]}
              fillOpacity={0.35}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function useCompositionData({ shahed, cruise, ballistic }: Props) {
  return useMemo(() => {
    const map = new Map<string, { label: string; uavs: number; cruise: number; ballistic: number }>();
    const seed = (ms: MonthPoint[]) => {
      for (const m of ms) {
        if (!map.has(m.key)) map.set(m.key, { label: m.label, uavs: 0, cruise: 0, ballistic: 0 });
      }
    };
    seed(shahed.months); seed(cruise.months); seed(ballistic.months);
    for (const m of shahed.months)    map.get(m.key)!.uavs      = m.launched;
    for (const m of cruise.months)    map.get(m.key)!.cruise    = m.launched;
    for (const m of ballistic.months) map.get(m.key)!.ballistic = m.launched;
    return Array.from(map.values());
  }, [shahed, cruise, ballistic]);
}

function CompositionPair(props: Props) {
  const data = useCompositionData(props);
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Panel
        title="UAV launches · monthly"
        subtitle="Loitering munitions & reconnaissance UAVs"
        source={PRIMARY_SOURCE}
        note="Includes Shahed-136/131, Lancet, Orlan, ZALA, Supercam and other UAV types reported in daily Air Force communiqués."
      >
        <CompositionAreaChart data={data} series={["uavs"]} />
      </Panel>
      <Panel
        title="Cruise & ballistic launches · monthly"
        subtitle="Stacked, monthly aggregates"
        source={PRIMARY_SOURCE}
        note="Mixed-fire rows attribute counts to every category referenced; minor overlap between cruise and ballistic on those nights."
      >
        <CompositionAreaChart data={data} series={["ballistic", "cruise"]} />
      </Panel>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Share & interception performance                                          */
/* -------------------------------------------------------------------------- */

function ShareInterception({ shahed, cruise, ballistic }: Props) {
  const rows = [
    { key: "uavs",      label: CAT_LABELS.uavs,      color: CAT_COLORS.uavs,      ds: shahed },
    { key: "cruise",    label: CAT_LABELS.cruise,    color: CAT_COLORS.cruise,    ds: cruise },
    { key: "ballistic", label: CAT_LABELS.ballistic, color: CAT_COLORS.ballistic, ds: ballistic },
  ];
  const grandLaunched = rows.reduce((s, r) => s + r.ds.totals.launched, 0);

  return (
    <ul className="space-y-4">
      {rows.map((r) => {
        const pct = r.ds.totals.rate * 100;
        const share = grandLaunched > 0 ? (r.ds.totals.launched / grandLaunched) * 100 : 0;
        return (
          <li key={r.key}>
            <div className="mb-1.5 flex items-baseline justify-between font-mono text-[11px]">
              <span className="flex items-center gap-2 text-foreground">
                <span className="h-2 w-2 rounded-sm" style={{ background: r.color }} />
                {r.label}
                <span className="text-muted-foreground">· {share.toFixed(1)}% of launches</span>
              </span>
              <span className="num text-muted-foreground">
                <span className="text-foreground">{pct.toFixed(1)}%</span>
                <span className="ml-2">{fmt(r.ds.totals.destroyed)} / {fmt(r.ds.totals.launched)}</span>
              </span>
            </div>
            <div className="relative h-1.5 overflow-hidden rounded-sm bg-secondary">
              <div className="h-full" style={{ width: `${share}%`, background: r.color, opacity: 0.4 }} />
            </div>
            <div className="relative mt-1 h-2 overflow-hidden rounded-sm bg-secondary">
              <div className="h-full" style={{ width: `${pct}%`, background: r.color }} />
            </div>
            <div className="mt-1 flex justify-between font-mono text-[9.5px] uppercase tracking-[0.14em] text-muted-foreground">
              <span>Share of launches</span>
              <span>Interception rate</span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/* -------------------------------------------------------------------------- */
/*  Calendar heatmap                                                          */
/* -------------------------------------------------------------------------- */

function HeatmapMonthlyIntensity({ shahed, cruise, ballistic }: Props) {
  const [cat, setCat] = useState<"all" | CategoryKey>("all");

  const { grid, years, max } = useMemo(() => {
    const now = new Date();
    const curY = now.getUTCFullYear();
    const curM = now.getUTCMonth();
    const yearsSet = new Set<number>();
    const cellMap = new Map<string, number>();
    const add = (m: MonthPoint, val: number) => {
      const y = m.date.getUTCFullYear();
      const mo = m.date.getUTCMonth();
      // Skip the current (incomplete) calendar month
      if (y === curY && mo === curM) return;
      yearsSet.add(y);
      const k = `${y}-${mo}`;
      cellMap.set(k, (cellMap.get(k) ?? 0) + val);
    };
    if (cat === "all" || cat === "uavs")      shahed.months.forEach((m)    => add(m, m.launched));
    if (cat === "all" || cat === "cruise")    cruise.months.forEach((m)    => add(m, m.launched));
    if (cat === "all" || cat === "ballistic") ballistic.months.forEach((m) => add(m, m.launched));
    const years = Array.from(yearsSet).sort();
    let max = 0;
    for (const v of cellMap.values()) if (v > max) max = v;
    return { grid: cellMap, years, max };
  }, [cat, shahed, cruise, ballistic]);

  const monthLabels = ["J","F","M","A","M","J","J","A","S","O","N","D"];

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1 font-mono text-[10.5px] uppercase tracking-[0.14em]">
          {(["all", "uavs", "cruise", "ballistic"] as const).map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={`rounded-sm border px-2.5 py-1 transition-colors ${
                cat === c
                  ? "border-foreground bg-foreground text-background"
                  : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground"
              }`}
            >
              {c === "all" ? "All" : CAT_LABELS[c]}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          <span>Less</span>
          <div className="flex gap-1">
            {[0.15, 0.35, 0.55, 0.75, 1].map((i) => (
              <div
                key={i}
                className="h-2.5 w-5 rounded-[2px] border border-border/60"
                style={{ background: rampColor(i, 0.25 + i * 0.75) }}
              />
            ))}
          </div>
          <span>More · Peak {fmt(max)}</span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-separate" style={{ borderSpacing: 2 }}>
          <thead>
            <tr>
              <th />
              {monthLabels.map((m, i) => (
                <th key={i} className="font-mono text-[10px] font-normal uppercase text-muted-foreground">
                  {m}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {years.map((y) => (
              <tr key={y}>
                <td className="pr-2 text-right font-mono text-[10.5px] uppercase tracking-wider text-muted-foreground">
                  {y}
                </td>
                {Array.from({ length: 12 }, (_, mo) => {
                  const v = grid.get(`${y}-${mo}`) ?? 0;
                  const intensity = max > 0 ? Math.pow(v / max, 0.7) : 0;
                  const has = v > 0;
                  return (
                    <td key={mo} className="p-0">
                      <div
                        className="aspect-square w-full min-w-[20px] rounded-[2px] border border-border/60"
                        style={{
                          background: has
                            ? rampColor(intensity, 0.25 + intensity * 0.75)
                            : "hsl(var(--card))",
                        }}
                        title={`${monthLabels[mo]} ${y}: ${fmt(v)} reported launches`}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Section                                                                   */
/* -------------------------------------------------------------------------- */

export function AnalyticsDashboard(props: Props) {
  return (
    <section id="analytics" className="scroll-mt-24 border-t border-border bg-secondary/40">
      <div className="container py-12 md:py-16">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-3xl">
            <div className="src-label mb-2">Analytics</div>
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">
              Cross-category composition and interception
            </h2>
            <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
              Monthly composition of reported launches across UAVs, cruise and ballistic systems,
              with interception performance and a calendar of escalation since October 2022.
            </p>
          </div>
          <div className="flex items-center gap-3 font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
            {(Object.keys(CAT_COLORS) as CategoryKey[]).map((k) => (
              <span key={k} className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm" style={{ background: CAT_COLORS[k] }} />
                {CAT_LABELS[k]}
              </span>
            ))}
          </div>
        </div>

        <CompositionPair {...props} />


        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Panel
            title="Share & interception performance"
            subtitle="All-time · confirmed / launched"
            source={PRIMARY_SOURCE}
          >
            <ShareInterception {...props} />
          </Panel>

          <Panel
            title="Escalation calendar"
            subtitle="Year × month · reported launches"
            source={PRIMARY_SOURCE}
          >
            <HeatmapMonthlyIntensity {...props} />
          </Panel>
        </div>
      </div>
    </section>
  );
}
