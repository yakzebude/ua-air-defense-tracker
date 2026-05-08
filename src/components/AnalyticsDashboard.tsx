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

const fmt = (n: number) => n.toLocaleString("en-US");

type CategoryKey = "uavs" | "cruise" | "ballistic";

const CAT_META: Record<CategoryKey, { label: string; color: string }> = {
  uavs:      { label: "UAVs",      color: "hsl(var(--ua-yellow))" },     /* yellow */
  cruise:    { label: "Cruise",    color: "hsl(25 92% 58%)" },           /* orange */
  ballistic: { label: "Ballistic", color: "hsl(0 78% 60%)" },            /* red */
};

const ACCENT_PURPLE = "hsl(280 65% 68%)";

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
    <div className="rounded-sm border border-border bg-background/95 px-3 py-2 font-mono text-[11px] shadow-xl backdrop-blur">
      <div className="mb-1.5 uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
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

function StackedAreaChart({ shahed, cruise, ballistic }: Props) {
  const data = useMemo(() => {
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

  const ticks = useMemo(() => data.filter((_, i) => i % 4 === 0).map((m) => m.label), [data]);

  return (
    <div className="h-[360px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 12, right: 16, left: 0, bottom: 8 }}>
          <defs>
            <linearGradient id="g-uavs" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={CAT_META.uavs.color}      stopOpacity={0.85} />
              <stop offset="100%" stopColor={CAT_META.uavs.color}      stopOpacity={0.15} />
            </linearGradient>
            <linearGradient id="g-cruise" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={CAT_META.cruise.color}    stopOpacity={0.85} />
              <stop offset="100%" stopColor={CAT_META.cruise.color}    stopOpacity={0.15} />
            </linearGradient>
            <linearGradient id="g-ballistic" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={CAT_META.ballistic.color} stopOpacity={0.9} />
              <stop offset="100%" stopColor={CAT_META.ballistic.color} stopOpacity={0.18} />
            </linearGradient>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
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
          <Tooltip content={<StackedTooltip />} cursor={{ stroke: ACCENT_PURPLE, strokeOpacity: 0.5 }} />
          <Area type="monotone" dataKey="ballistic" name="Ballistic" stackId="1"
                stroke={CAT_META.ballistic.color} strokeWidth={1.5} fill="url(#g-ballistic)" filter="url(#glow)" />
          <Area type="monotone" dataKey="cruise"    name="Cruise"    stackId="1"
                stroke={CAT_META.cruise.color}    strokeWidth={1.5} fill="url(#g-cruise)"    filter="url(#glow)" />
          <Area type="monotone" dataKey="uavs"      name="UAVs"      stackId="1"
                stroke={CAT_META.uavs.color}      strokeWidth={1.5} fill="url(#g-uavs)"      filter="url(#glow)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Combined: share of launches × interception performance                    */
/* -------------------------------------------------------------------------- */

function ShareInterception({ shahed, cruise, ballistic }: Props) {
  const rows = [
    { key: "uavs",      label: CAT_META.uavs.label,      ds: shahed },
    { key: "cruise",    label: CAT_META.cruise.label,    ds: cruise },
    { key: "ballistic", label: CAT_META.ballistic.label, ds: ballistic },
  ];
  const grandLaunched = rows.reduce((s, r) => s + r.ds.totals.launched, 0);

  return (
    <ul className="space-y-5">
      {rows.map((r) => {
        const pct = r.ds.totals.rate * 100;
        const share = grandLaunched > 0 ? (r.ds.totals.launched / grandLaunched) * 100 : 0;
        const color = CAT_META[r.key as CategoryKey].color;
        return (
          <li key={r.key}>
            <div className="mb-2 flex items-baseline justify-between font-mono text-[11px] uppercase tracking-[0.16em]">
              <span className="flex items-center gap-2 text-foreground">
                <span className="h-2 w-2 rounded-sm" style={{ background: color }} />
                {r.label}
                <span className="text-muted-foreground">· {share.toFixed(1)}% of launches</span>
              </span>
              <span className="num text-muted-foreground">
                <span className="text-foreground">{pct.toFixed(1)}%</span>
                <span className="ml-2">
                  {fmt(r.ds.totals.destroyed)} / {fmt(r.ds.totals.launched)}
                </span>
              </span>
            </div>
            {/* Share bar (faint) */}
            <div className="relative h-1 overflow-hidden rounded-sm bg-secondary/60">
              <div
                className="h-full rounded-sm"
                style={{ width: `${share}%`, background: color, opacity: 0.35 }}
              />
            </div>
            {/* Interception bar (solid + glow) */}
            <div className="relative mt-1.5 h-2.5 overflow-hidden rounded-sm bg-secondary">
              <div
                className="h-full rounded-sm transition-[width] duration-700 ease-out"
                style={{
                  width: `${pct}%`,
                  background: color,
                  boxShadow: `0 0 12px -2px ${color}`,
                }}
              />
            </div>
            <div className="mt-1 flex justify-between font-mono text-[9.5px] uppercase tracking-[0.16em] text-muted-foreground">
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
/*  Calendar heatmap — monthly intensity, year × month                        */
/* -------------------------------------------------------------------------- */

function HeatmapMonthlyIntensity({ shahed, cruise, ballistic }: Props) {
  const [cat, setCat] = useState<"all" | CategoryKey>("all");

  const { grid, years, max } = useMemo(() => {
    const yearsSet = new Set<number>();
    const cellMap = new Map<string, number>(); // `${year}-${month}` -> launches

    const add = (m: MonthPoint, val: number) => {
      const y = m.date.getUTCFullYear();
      const mo = m.date.getUTCMonth();
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
  const baseColor = cat === "uavs" ? CAT_META.uavs.color
                  : cat === "cruise" ? CAT_META.cruise.color
                  : cat === "ballistic" ? CAT_META.ballistic.color
                  : ACCENT_PURPLE;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.18em]">
        {(["all", "uavs", "cruise", "ballistic"] as const).map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={`rounded-sm border px-2.5 py-1 transition-colors ${
              cat === c
                ? "border-foreground/60 bg-secondary text-foreground"
                : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground"
            }`}
          >
            {c === "all" ? "All" : CAT_META[c].label}
          </button>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-separate" style={{ borderSpacing: 3 }}>
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
                  const intensity = max > 0 ? Math.pow(v / max, 0.6) : 0;
                  const has = v > 0;
                  return (
                    <td key={mo} className="p-0">
                      <div
                        className="group relative aspect-square w-full min-w-[22px] rounded-[3px] border border-border/40 transition-transform hover:scale-110"
                        style={{
                          background: has
                            ? `color-mix(in srgb, ${baseColor} ${(intensity * 100).toFixed(0)}%, hsl(var(--card)))`
                            : "hsl(var(--card))",
                          boxShadow: intensity > 0.7 ? `0 0 8px -2px ${baseColor}` : undefined,
                        }}
                        title={`${monthLabels[mo]} ${y}: ${fmt(v)} launched`}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        <span>Less</span>
        <div className="flex gap-1">
          {[0.15, 0.35, 0.55, 0.75, 1].map((i) => (
            <div
              key={i}
              className="h-2.5 w-5 rounded-[2px] border border-border/40"
              style={{ background: `color-mix(in srgb, ${baseColor} ${(i * 100).toFixed(0)}%, hsl(var(--card)))` }}
            />
          ))}
        </div>
        <span>More · Peak {fmt(max)}</span>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Comparative interception bars                                             */
/* -------------------------------------------------------------------------- */

function InterceptionComparison({ shahed, cruise, ballistic }: Props) {
  const rows = [
    { key: "uavs",      label: CAT_META.uavs.label,      ds: shahed },
    { key: "cruise",    label: CAT_META.cruise.label,    ds: cruise },
    { key: "ballistic", label: CAT_META.ballistic.label, ds: ballistic },
  ];
  return (
    <ul className="space-y-4">
      {rows.map((r) => {
        const pct = r.ds.totals.rate * 100;
        return (
          <li key={r.key}>
            <div className="mb-1.5 flex items-baseline justify-between font-mono text-[11px] uppercase tracking-[0.16em]">
              <span className="text-foreground">{r.label}</span>
              <span className="num text-muted-foreground">
                <span className="text-foreground">{pct.toFixed(1)}%</span>
                <span className="ml-2">
                  {fmt(r.ds.totals.destroyed)} / {fmt(r.ds.totals.launched)}
                </span>
              </span>
            </div>
            <div className="relative h-2 overflow-hidden rounded-sm bg-secondary">
              <div
                className="h-full rounded-sm transition-[width] duration-700 ease-out"
                style={{
                  width: `${pct}%`,
                  background: CAT_META[r.key as CategoryKey].color,
                  boxShadow: `0 0 12px -2px ${CAT_META[r.key as CategoryKey].color}`,
                }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/* -------------------------------------------------------------------------- */
/*  Section                                                                   */
/* -------------------------------------------------------------------------- */

export function AnalyticsDashboard(props: Props) {
  return (
    <section id="analytics" className="scroll-mt-24 border-t border-border bg-secondary/20">
      <div className="container py-14 md:py-20">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-3xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-sm border border-cyber/40 bg-cyber/5 px-2.5 py-1 font-mono text-[10.5px] uppercase tracking-[0.22em] text-cyber">
              <span className="h-1.5 w-1.5 rounded-full bg-cyber pulse-soft" />
              Analytics Dashboard
            </div>
            <h2 className="font-display text-3xl leading-tight md:text-4xl">
              Cross-category attrition &amp; intensity
            </h2>
            <p className="mt-3 text-base leading-relaxed text-muted-foreground">
              Composition of monthly launches across UAVs, cruise and ballistic systems —
              with interception performance and a calendar view of escalation since
              October 2022.
            </p>
          </div>
          <div className="flex items-center gap-3 font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground">
            {(Object.entries(CAT_META) as [CategoryKey, typeof CAT_META[CategoryKey]][]).map(([k, v]) => (
              <span key={k} className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm" style={{ background: v.color }} />
                {v.label}
              </span>
            ))}
          </div>
        </div>

        {/* Top: stacked area — full width */}
        <div className="rounded-md border border-border bg-card/70 p-4 backdrop-blur md:p-6">
          <div className="mb-3 flex items-baseline justify-between">
            <h3 className="font-display text-lg text-foreground">Monthly composition · weapons launched</h3>
            <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground">
              Stacked · monthly
            </span>
          </div>
          <StackedAreaChart {...props} />
        </div>

        {/* Bottom: 3-up dashboard */}
        <div className="mt-px grid gap-px bg-border md:grid-cols-3">
          <div className="bg-card/70 p-5 backdrop-blur md:p-6">
            <div className="mb-4 flex items-baseline justify-between">
              <h3 className="font-display text-base text-foreground">Share of launches</h3>
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                All-time
              </span>
            </div>
            <DonutShare {...props} />
          </div>

          <div className="bg-card/70 p-5 backdrop-blur md:p-6">
            <div className="mb-4 flex items-baseline justify-between">
              <h3 className="font-display text-base text-foreground">Interception performance</h3>
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Confirmed / launched
              </span>
            </div>
            <InterceptionComparison {...props} />
          </div>

          <div className="bg-card/70 p-5 backdrop-blur md:p-6">
            <div className="mb-4 flex items-baseline justify-between">
              <h3 className="font-display text-base text-foreground">Escalation calendar</h3>
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Year × Month
              </span>
            </div>
            <HeatmapMonthlyIntensity {...props} />
          </div>
        </div>
      </div>
    </section>
  );
}
