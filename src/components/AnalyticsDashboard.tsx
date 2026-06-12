import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import type { Dataset, MonthPoint } from "@/lib/shahed-data";
import { Panel } from "@/components/ui/panel";
import { PanelActions } from "@/components/PanelActions";
import { ChartInsights } from "@/components/ChartInsights";
import { rampColor } from "@/lib/threat-ramp";


const fmt = (n: number) => n.toLocaleString("en-US");

type CategoryKey = "uavs" | "cruise" | "ballistic";

// Unified threat-ramp palette — identical stops to the escalation-calendar
// heatmap so every panel reads as one coherent visual system.
// yellow (lightest threat) → orange → deep red. Grayscale handled separately.
const CAT_COLORS: Record<CategoryKey, string> = {
  uavs:      "hsl(48 95% 55%)",   // yellow — largest mass, lowest per-unit threat
  cruise:    "hsl(28 92% 50%)",   // orange — mid threat
  ballistic: "hsl(0 78% 45%)",    // deep red — highest per-unit threat
};

interface Props {
  shahed: Dataset;
  cruise: Dataset;
  ballistic: Dataset;
}

function StackedTooltip({ active, payload, label, totalLabel }: any) {
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
          <span>{totalLabel}</span>
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
  labels,
  totalLabel,
}: {
  data: Array<{ label: string; uavs: number; cruise: number; ballistic: number }>;
  series: SeriesKey[];
  height?: number;
  labels: Record<CategoryKey, string>;
  totalLabel: string;
}) {
  const ticks = useMemo(() => data.filter((_, i) => i % 5 === 0).map((m) => m.label), [data]);
  const angled = data.length > 8;
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: angled ? 28 : 4 }}>
          <CartesianGrid stroke="hsl(var(--border) / 0.15)" vertical={false} />
          <XAxis
            dataKey="label"
            ticks={ticks}
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: "hsl(var(--border))" }}
            angle={-45}
            textAnchor="end"
            height={48}
            interval="preserveStartEnd"
          />

          <YAxis
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}

            tickLine={false}
            axisLine={false}
            width={48}
            tickFormatter={(v) => fmt(v as number)}
          />
          <Tooltip content={<StackedTooltip totalLabel={totalLabel} />} cursor={{ stroke: "hsl(var(--foreground))", strokeOpacity: 0.2 }} />
          {series.map((k) => (
            <Area
              key={k}
              type="monotone"
              dataKey={k}
              name={labels[k]}
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
    const now = new Date();
    const curKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
    const map = new Map<string, { label: string; uavs: number; cruise: number; ballistic: number }>();
    const seed = (ms: MonthPoint[]) => {
      for (const m of ms) {
        if (m.key === curKey) continue;
        if (!map.has(m.key)) map.set(m.key, { label: m.label, uavs: 0, cruise: 0, ballistic: 0 });
      }
    };
    seed(shahed.months); seed(cruise.months); seed(ballistic.months);
    for (const m of shahed.months)    if (map.has(m.key)) map.get(m.key)!.uavs      = m.launched;
    for (const m of cruise.months)    if (map.has(m.key)) map.get(m.key)!.cruise    = m.launched;
    for (const m of ballistic.months) if (map.has(m.key)) map.get(m.key)!.ballistic = m.launched;
    return Array.from(map.values());
  }, [shahed, cruise, ballistic]);
}

function SwipeRow({ children, hint }: { children: React.ReactNode; hint: string }) {
  return (
    <div>
      <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-3 md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0 md:pb-0 [scrollbar-width:thin]">
        {children}
      </div>
      <div className="mt-1 flex items-center justify-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground md:hidden">
        <span aria-hidden>←</span>
        <span>{hint}</span>
        <span aria-hidden>→</span>
      </div>
    </div>
  );
}

function CompositionPair(props: Props) {
  const { t } = useTranslation();
  const data = useCompositionData(props);
  const labels: Record<CategoryKey, string> = {
    uavs: t("category.uavs"),
    cruise: t("category.cruise"),
    ballistic: t("category.ballistic"),
  };
  const totalLabel = t("chart.total");
  const csvRows = data.map((d) => ({
    month: d.label,
    uavs: d.uavs,
    cruise: d.cruise,
    ballistic: d.ballistic,
    total: d.uavs + d.cruise + d.ballistic,
  }));
  const csvHeaders = ["month", "uavs", "cruise", "ballistic", "total"];

  return (
    <SwipeRow hint={t("analytics.swipeHint")}>
      <div className="min-w-[85%] snap-start md:min-w-0">
        <Panel
          title={t("analytics.uavMonthly")}
          subtitle={t("analytics.uavMonthlySub")}
          source={t("primarySourceShort")}
          note={t("analytics.uavMonthlyNote")}
          action={
            <PanelActions
              filename="ua-defense-tracker_uav-monthly.csv"
              panelTitle={t("analytics.uavMonthly")}
              rows={csvRows.map(({ month, uavs }) => ({ month, uavs }))}
              headers={["month", "uavs"]}
            />
          }
        >
          <CompositionAreaChart data={data} series={["uavs"]} labels={labels} totalLabel={totalLabel} />
        </Panel>
      </div>
      <div className="min-w-[85%] snap-start md:min-w-0">
        <Panel
          title={t("analytics.cruiseBalMonthly")}
          subtitle={t("analytics.cruiseBalMonthlySub")}
          source={t("primarySourceShort")}
          note={t("analytics.cruiseBalMonthlyNote")}
          action={
            <PanelActions
              filename="ua-defense-tracker_cruise-ballistic-monthly.csv"
              panelTitle={t("analytics.cruiseBalMonthly")}
              rows={csvRows.map(({ month, cruise, ballistic }) => ({ month, cruise, ballistic }))}
              headers={["month", "cruise", "ballistic"]}
            />
          }
        >
          <CompositionAreaChart data={data} series={["ballistic", "cruise"]} labels={labels} totalLabel={totalLabel} />
        </Panel>
      </div>
    </SwipeRow>
  );
}


function ShareInterception({ shahed, cruise, ballistic }: Props) {
  const { t } = useTranslation();
  const rows = [
    { key: "uavs",      label: t("category.uavs"),      color: CAT_COLORS.uavs,      ds: shahed },
    { key: "cruise",    label: t("category.cruise"),    color: CAT_COLORS.cruise,    ds: cruise },
    { key: "ballistic", label: t("category.ballistic"), color: CAT_COLORS.ballistic, ds: ballistic },
  ];
  const grandLaunched = rows.reduce((s, r) => s + r.ds.totals.launched, 0);

  const chartData = rows.map((r) => ({
    name: r.label,
    color: r.color,
    launched: r.ds.totals.launched,
    destroyed: r.ds.totals.destroyed,
    leakers: Math.max(r.ds.totals.launched - r.ds.totals.destroyed, 0),
    rate: +(r.ds.totals.rate * 100).toFixed(1),
    share: grandLaunched > 0 ? +((r.ds.totals.launched / grandLaunched) * 100).toFixed(1) : 0,
  }));

  return (
    <div className="space-y-6">
      {/* Bar chart — interception rate per category, matching the area-chart
          look-and-feel of the launches panel. */}
      <div style={{ height: 240 }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical" margin={{ top: 8, right: 24, left: 8, bottom: 4 }}>
            <CartesianGrid stroke="hsl(var(--border) / 0.2)" horizontal={false} />
            <XAxis
              type="number"
              domain={[0, 100]}
              unit="%"
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: "hsl(var(--border))" }}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={104}
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              cursor={{ fill: "hsl(var(--foreground) / 0.05)" }}
              content={({ active, payload }: any) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload;
                return (
                  <div className="panel min-w-[200px] px-3 py-2 font-mono text-[11px]">
                    <div className="mb-1.5 src-label">{d.name}</div>
                    <div className="space-y-0.5 text-foreground">
                      <div className="flex justify-between gap-6"><span className="text-muted-foreground">{t("kpi.interceptionRate")}</span><span className="num font-semibold">{d.rate}%</span></div>
                      <div className="flex justify-between gap-6"><span className="text-muted-foreground">{t("chart.share")}</span><span className="num">{d.share}%</span></div>
                      <div className="mt-1 flex justify-between gap-6 border-t border-border pt-1"><span className="text-muted-foreground">{t("chart.destroyed")} / {t("chart.launched")}</span><span className="num">{fmt(d.destroyed)} / {fmt(d.launched)}</span></div>
                    </div>
                  </div>
                );
              }}
            />
            <Bar dataKey="rate" radius={[0, 2, 2, 0]} barSize={22}>
              {chartData.map((d, i) => (
                <Cell key={i} fill={d.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Compact summary row keeps the per-category totals visible without
          duplicating the dual progress bars that lived here before. */}
      <ul className="grid gap-2 sm:grid-cols-3">
        {chartData.map((d) => (
          <li key={d.name} className="rounded-sm border border-border bg-background/60 p-3">
            <div className="mb-1 flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
              <span className="h-2 w-2 rounded-sm" style={{ background: d.color }} />
              {d.name}
            </div>
            <div className="num text-[1.25rem] font-semibold leading-none text-foreground">{d.rate}%</div>
            <div className="mt-1 font-mono text-[10.5px] text-muted-foreground">
              {fmt(d.destroyed)} / {fmt(d.launched)} · {d.share}{t("chart.shareSuffix")}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}


function HeatmapMonthlyIntensity({ shahed, cruise, ballistic }: Props) {
  const { t } = useTranslation();
  const [cat, setCat] = useState<"all" | CategoryKey>("all");
  const [hover, setHover] = useState<
    | { x: number; y: number; year: number; month: number; total: number; uavs: number; cruise: number; ballistic: number }
    | null
  >(null);

  // Build per-cell totals AND a full per-category breakdown so the hover
  // tooltip can show the composition, not just the active filter.
  const { grid, breakdown, years, max } = useMemo(() => {
    const now = new Date();
    const curY = now.getUTCFullYear();
    const curM = now.getUTCMonth();
    const yearsSet = new Set<number>();
    const cellMap = new Map<string, number>();
    const bdMap = new Map<string, { uavs: number; cruise: number; ballistic: number }>();
    const ensureBd = (k: string) => {
      let b = bdMap.get(k);
      if (!b) { b = { uavs: 0, cruise: 0, ballistic: 0 }; bdMap.set(k, b); }
      return b;
    };
    const visit = (m: MonthPoint, key: CategoryKey) => {
      const y = m.date.getUTCFullYear();
      const mo = m.date.getUTCMonth();
      if (y === curY && mo === curM) return;
      yearsSet.add(y);
      const k = `${y}-${mo}`;
      ensureBd(k)[key] += m.launched;
      const inFilter = cat === "all" || cat === key;
      if (inFilter) cellMap.set(k, (cellMap.get(k) ?? 0) + m.launched);
    };
    shahed.months.forEach((m)    => visit(m, "uavs"));
    cruise.months.forEach((m)    => visit(m, "cruise"));
    ballistic.months.forEach((m) => visit(m, "ballistic"));
    const years = Array.from(yearsSet).sort();
    let max = 0;
    for (const v of cellMap.values()) if (v > max) max = v;
    return { grid: cellMap, breakdown: bdMap, years, max };
  }, [cat, shahed, cruise, ballistic]);

  const monthLabels = ["J","F","M","A","M","J","J","A","S","O","N","D"];
  const monthFull = ["January","February","March","April","May","June","July","August","September","October","November","December"];

  const catLabel = (c: "all" | CategoryKey) =>
    c === "all" ? t("analytics.all") : t(`category.${c}`);

  const tierLabel = (v: number): { label: string; tone: string } => {
    if (v <= 0) return { label: "—", tone: "text-muted-foreground" };
    const r = max > 0 ? v / max : 0;
    if (r >= 0.85) return { label: "Record", tone: "text-[hsl(0_78%_42%)]" };
    if (r >= 0.6)  return { label: "High",   tone: "text-[hsl(0_72%_48%)]" };
    if (r >= 0.3)  return { label: "Medium", tone: "text-[hsl(28_90%_48%)]" };
    return { label: "Low", tone: "text-[hsl(48_90%_40%)]" };
  };

  return (
    <div className="relative">
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
              {catLabel(c)}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          <span>Low</span>
          <div className="flex gap-1">
            {[0.1, 0.3, 0.55, 0.8, 1].map((i) => (
              <div
                key={i}
                className="h-2.5 w-5 rounded-[2px] border border-border/60"
                style={{ background: rampColor(i, 1) }}
              />
            ))}
          </div>
          <span>Record · {fmt(max)}</span>
        </div>
      </div>
      <div className="relative" onMouseLeave={() => setHover(null)}>
        <div className="space-y-1.5">
          {/* Month header — month initials sit above the grid for orientation. */}
          <div className="grid items-end gap-1.5" style={{ gridTemplateColumns: "44px repeat(12, minmax(0, 1fr))" }}>
            <div />
            {monthLabels.map((m, i) => (
              <div key={i} className="text-center font-mono text-[9.5px] uppercase tracking-[0.18em] text-muted-foreground">
                {m}
              </div>
            ))}
          </div>

          {years.map((y) => (
            <div
              key={y}
              className="grid items-stretch gap-1.5"
              style={{ gridTemplateColumns: "44px repeat(12, minmax(0, 1fr))" }}
            >
              <div className="flex items-center justify-end pr-1 font-mono text-[11px] tabular-nums tracking-wider text-muted-foreground">
                {y}
              </div>
              {Array.from({ length: 12 }, (_, mo) => {
                const k = `${y}-${mo}`;
                const v = grid.get(k) ?? 0;
                const intensity = max > 0 ? Math.pow(v / max, 0.7) : 0;
                const has = v > 0;
                const bd = breakdown.get(k) ?? { uavs: 0, cruise: 0, ballistic: 0 };
                // Tier-aware text colour: dark ink on light yellow, white on
                // saturated orange/red. Keeps the big numbers legible across
                // the whole ramp without per-cell guessing.
                const textColor = !has
                  ? "hsl(var(--muted-foreground) / 0.55)"
                  : intensity >= 0.55
                    ? "hsl(0 0% 100%)"
                    : "hsl(0 0% 8%)";
                const display = !has
                  ? "—"
                  : v >= 10000 ? `${(v / 1000).toFixed(0)}k`
                  : v >= 1000  ? fmt(v)
                  : `${v}`;
                return (
                  <button
                    key={mo}
                    type="button"
                    aria-label={`${monthFull[mo]} ${y}: ${fmt(v)}`}
                    onMouseEnter={(e) => {
                      const cont = (e.currentTarget.closest(".relative") as HTMLDivElement | null)?.getBoundingClientRect();
                      setHover({
                        x: e.clientX - (cont?.left ?? 0),
                        y: e.clientY - (cont?.top ?? 0),
                        year: y, month: mo, total: v,
                        uavs: bd.uavs, cruise: bd.cruise, ballistic: bd.ballistic,
                      });
                    }}
                    onMouseMove={(e) => {
                      const cont = (e.currentTarget.closest(".relative") as HTMLDivElement | null)?.getBoundingClientRect();
                      setHover((h) => h && { ...h, x: e.clientX - (cont?.left ?? 0), y: e.clientY - (cont?.top ?? 0) });
                    }}
                    className="group relative flex h-[58px] flex-col justify-between rounded-[3px] border border-border/40 px-1.5 py-1 text-left transition-transform hover:z-10 hover:scale-[1.06] hover:ring-1 hover:ring-foreground/60"
                    style={{
                      background: has ? rampColor(intensity, 1) : "hsl(var(--muted) / 0.35)",
                    }}
                  >
                    <span
                      className="font-mono text-[8.5px] uppercase tracking-[0.16em] opacity-80"
                      style={{ color: textColor }}
                    >
                      {monthLabels[mo]}
                    </span>
                    <span
                      className="self-end font-mono text-[13px] font-semibold leading-none tabular-nums"
                      style={{ color: textColor }}
                    >
                      {display}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>


        {hover && (() => {
          const tier = tierLabel(hover.total);
          const sum = hover.uavs + hover.cruise + hover.ballistic;
          const share = (n: number) => (sum > 0 ? Math.round((n / sum) * 100) : 0);
          return (
            <div
              className="pointer-events-none absolute z-20 min-w-[210px] rounded border border-border bg-background/95 px-3 py-2 font-mono text-[11px] shadow-lg backdrop-blur"
              style={{ left: hover.x + 14, top: Math.max(hover.y - 8, 4), transform: "translateY(-100%)" }}
            >
              <div className="mb-1 flex items-baseline justify-between gap-3">
                <span className="font-semibold text-foreground">{monthFull[hover.month]} {hover.year}</span>
                <span className={`text-[10px] uppercase tracking-wider ${tier.tone}`}>{tier.label}</span>
              </div>
              <div className="mb-1.5 flex items-baseline justify-between gap-3">
                <span className="text-muted-foreground">Total launches</span>
                <span className="num font-semibold text-foreground">{fmt(hover.total)}</span>
              </div>
              <div className="space-y-0.5 border-t border-border pt-1.5 text-[10.5px]">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-1.5 text-muted-foreground"><span className="h-2 w-2 rounded-sm" style={{ background: CAT_COLORS.uavs }} />UAVs</span>
                  <span className="num text-foreground">{fmt(hover.uavs)} <span className="text-muted-foreground">· {share(hover.uavs)}%</span></span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-1.5 text-muted-foreground"><span className="h-2 w-2 rounded-sm" style={{ background: CAT_COLORS.cruise }} />Cruise</span>
                  <span className="num text-foreground">{fmt(hover.cruise)} <span className="text-muted-foreground">· {share(hover.cruise)}%</span></span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-1.5 text-muted-foreground"><span className="h-2 w-2 rounded-sm" style={{ background: CAT_COLORS.ballistic }} />Ballistic</span>
                  <span className="num text-foreground">{fmt(hover.ballistic)} <span className="text-muted-foreground">· {share(hover.ballistic)}%</span></span>
                </div>
              </div>
              {max > 0 && (
                <div className="mt-1.5 border-t border-border pt-1 text-[10px] text-muted-foreground">
                  {((hover.total / max) * 100).toFixed(0)}% of record peak ({fmt(max)})
                </div>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
}

type PagerKey = "uavs" | "cruiseBal" | "share" | "calendar";

function AnalyticsPager(props: Props) {
  const { t } = useTranslation();
  const [active, setActive] = useState<PagerKey>("uavs");
  const data = useCompositionData(props);
  const labels: Record<CategoryKey, string> = {
    uavs: t("category.uavs"),
    cruise: t("category.cruise"),
    ballistic: t("category.ballistic"),
  };
  const totalLabel = t("chart.total");

  const compRows = data.map((d) => ({
    month: d.label,
    uavs: d.uavs,
    cruise: d.cruise,
    ballistic: d.ballistic,
  }));

  const tabs: { key: PagerKey; label: string }[] = [
    { key: "uavs", label: t("analytics.uavMonthly") },
    { key: "cruiseBal", label: t("analytics.cruiseBalMonthly") },
    { key: "share", label: t("analytics.sharePanel") },
    { key: "calendar", label: t("analytics.calendarPanel") },
  ];

  return (
    <div>
      <div
        role="tablist"
        aria-label={t("analytics.title")}
        className="-mx-4 mb-4 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:overflow-visible md:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {tabs.map((tab, i) => {
          const isActive = active === tab.key;
          return (
            <button
              key={tab.key}
              role="tab"
              aria-selected={isActive}
              onClick={() => setActive(tab.key)}
              className={`snap-start shrink-0 whitespace-nowrap border px-3 py-2 font-mono text-[11px] uppercase tracking-[0.14em] transition-colors ${
                isActive
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-background text-muted-foreground hover:text-foreground hover:border-foreground/40"
              }`}
            >
              <span className="mr-2 opacity-60">{String(i + 1).padStart(2, "0")}</span>
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Equal-height shell — every tab takes exactly the same vertical space
          so switching panels never causes the page below to jump. Tall enough
          to fit the tallest tab (Share & interception with its swipe row). */}
      <div className="min-h-[1040px] md:min-h-[1080px]">

      {active === "uavs" && (
        <>
          <Panel
            title={t("analytics.uavMonthly")}
            subtitle={t("analytics.uavMonthlySub")}
            source={t("primarySourceShort")}
            note={t("analytics.uavMonthlyNote")}
            action={
              <PanelActions
                filename="ua-airdefense-tracker_uav-monthly.csv"
                panelTitle={t("analytics.uavMonthly")}
                rows={compRows.map(({ month, uavs }) => ({ month, uavs }))}
                headers={["month", "uavs"]}
              />
            }
          >
            <CompositionAreaChart data={data} series={["uavs"]} labels={labels} totalLabel={totalLabel} />
            <div className="mt-3 flex items-center gap-3 font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm" style={{ background: CAT_COLORS.uavs }} />
                {t("category.uavs")}
              </span>
            </div>
          </Panel>
          <ChartInsights
            data={props.shahed.months}
            metric="launched"
            unit="UAVs"
            accent={CAT_COLORS.uavs}
            direction="down-is-good"
            subtitle="Plain-language summary of monthly UAV launches detected at Ukrainian airspace."
          />
        </>
      )}

      {active === "cruiseBal" && (
        <>
          <Panel
            title={t("analytics.cruiseBalMonthly")}
            subtitle={t("analytics.cruiseBalMonthlySub")}
            source={t("primarySourceShort")}
            note={t("analytics.cruiseBalMonthlyNote")}
            action={
              <PanelActions
                filename="ua-airdefense-tracker_cruise-ballistic-monthly.csv"
                panelTitle={t("analytics.cruiseBalMonthly")}
                rows={compRows.map(({ month, cruise, ballistic }) => ({ month, cruise, ballistic }))}
                headers={["month", "cruise", "ballistic"]}
              />
            }
          >
            <CompositionAreaChart data={data} series={["ballistic", "cruise"]} labels={labels} totalLabel={totalLabel} />
            <div className="mt-3 flex items-center gap-3 font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm" style={{ background: CAT_COLORS.cruise }} />
                {t("category.cruise")}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm" style={{ background: CAT_COLORS.ballistic }} />
                {t("category.ballistic")}
              </span>
            </div>
          </Panel>
          <div
            className="-mx-4 mt-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0"
            aria-label="Key findings — swipe horizontally for ballistic missiles"
          >
            <div className="snap-start shrink-0 basis-[92%] md:basis-[88%] lg:basis-[85%]">
              <ChartInsights
                data={props.cruise.months}
                metric="launched"
                unit="cruise missiles"
                accent={CAT_COLORS.cruise}
                direction="down-is-good"
                title="Key findings · cruise missiles"
                subtitle="Plain-language summary of monthly cruise-missile launches. Swipe → for ballistic."
              />
            </div>
            <div className="snap-start shrink-0 basis-[92%] md:basis-[88%] lg:basis-[85%]">
              <ChartInsights
                data={props.ballistic.months}
                metric="launched"
                unit="ballistic missiles"
                accent={CAT_COLORS.ballistic}
                direction="down-is-good"
                title="Key findings · ballistic missiles"
                subtitle="Plain-language summary of monthly ballistic-missile launches."
              />
            </div>
          </div>
        </>
      )}

      {active === "share" && (
        <>
          <Panel
            title={t("analytics.sharePanel")}
            subtitle={t("analytics.sharePanelSub")}
            source={t("primarySourceShort")}
            action={
              <PanelActions
                filename="ua-airdefense-tracker_share-interception.csv"
                panelTitle={t("analytics.sharePanel")}
                rows={[
                  { category: "uavs", launched: props.shahed.totals.launched, destroyed: props.shahed.totals.destroyed, interception_rate_pct: +(props.shahed.totals.rate * 100).toFixed(2) },
                  { category: "cruise", launched: props.cruise.totals.launched, destroyed: props.cruise.totals.destroyed, interception_rate_pct: +(props.cruise.totals.rate * 100).toFixed(2) },
                  { category: "ballistic", launched: props.ballistic.totals.launched, destroyed: props.ballistic.totals.destroyed, interception_rate_pct: +(props.ballistic.totals.rate * 100).toFixed(2) },
                ]}
                headers={["category", "launched", "destroyed", "interception_rate_pct"]}
              />
            }
          >
            <ShareInterception {...props} />
            <div className="mt-3 flex items-center gap-3 font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm" style={{ background: CAT_COLORS.uavs }} />
                {t("category.uavs")}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm" style={{ background: CAT_COLORS.cruise }} />
                {t("category.cruise")}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm" style={{ background: CAT_COLORS.ballistic }} />
                {t("category.ballistic")}
              </span>
            </div>
          </Panel>
          <div
            className="-mx-4 mt-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0"
            aria-label="Key findings — swipe horizontally for cruise and ballistic"
          >
            <div className="snap-start shrink-0 basis-[92%] md:basis-[88%] lg:basis-[85%]">
              <ChartInsights
                data={props.shahed.months}
                metric="rate"
                unit=""
                accent={CAT_COLORS.uavs}
                direction="up-is-good"
                title="Key findings · UAV interception rate"
                subtitle="Plain-language summary of monthly UAV interception rate. Swipe → for cruise and ballistic."
              />
            </div>
            <div className="snap-start shrink-0 basis-[92%] md:basis-[88%] lg:basis-[85%]">
              <ChartInsights
                data={props.cruise.months}
                metric="rate"
                unit=""
                accent={CAT_COLORS.cruise}
                direction="up-is-good"
                title="Key findings · cruise interception rate"
                subtitle="Plain-language summary of monthly cruise-missile interception rate."
              />
            </div>
            <div className="snap-start shrink-0 basis-[92%] md:basis-[88%] lg:basis-[85%]">
              <ChartInsights
                data={props.ballistic.months}
                metric="rate"
                unit=""
                accent={CAT_COLORS.ballistic}
                direction="up-is-good"
                title="Key findings · ballistic interception rate"
                subtitle="Plain-language summary of monthly ballistic-missile interception rate."
              />
            </div>
          </div>
        </>
      )}

      {active === "calendar" && (
        <>
          <Panel
            title={t("analytics.calendarPanel")}
            subtitle={t("analytics.calendarPanelSub")}
            source={t("primarySourceShort")}
            action={
              <PanelActions
                filename="ua-airdefense-tracker_calendar-heatmap.csv"
                panelTitle={t("analytics.calendarPanel")}
                rows={(() => {
                  const map = new Map<string, { month: string; uavs: number; cruise: number; ballistic: number }>();
                  const add = (m: MonthPoint, key: CategoryKey) => {
                    const k = m.key;
                    if (!map.has(k)) map.set(k, { month: k, uavs: 0, cruise: 0, ballistic: 0 });
                    map.get(k)![key] += m.launched;
                  };
                  props.shahed.months.forEach((m) => add(m, "uavs"));
                  props.cruise.months.forEach((m) => add(m, "cruise"));
                  props.ballistic.months.forEach((m) => add(m, "ballistic"));
                  return Array.from(map.values()).sort((a, b) => a.month.localeCompare(b.month));
                })()}
                headers={["month", "uavs", "cruise", "ballistic"]}
              />
            }
          >
            <HeatmapMonthlyIntensity {...props} />
            <div className="mt-3 flex items-center gap-3 font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm" style={{ background: CAT_COLORS.uavs }} />
                {t("category.uavs")}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm" style={{ background: CAT_COLORS.cruise }} />
                {t("category.cruise")}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm" style={{ background: CAT_COLORS.ballistic }} />
                {t("category.ballistic")}
              </span>
            </div>
          </Panel>
          <div
            className="-mx-4 mt-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0"
            aria-label="Key findings — swipe horizontally for cruise and ballistic"
          >
            <div className="snap-start shrink-0 basis-[92%] md:basis-[88%] lg:basis-[85%]">
              <ChartInsights
                data={props.shahed.months}
                metric="reached"
                unit="UAVs"
                accent={CAT_COLORS.uavs}
                direction="down-is-good"
                title="Key findings · UAVs reaching target"
                subtitle="Plain-language summary of monthly UAVs not intercepted. Swipe → for cruise and ballistic."
              />
            </div>
            <div className="snap-start shrink-0 basis-[92%] md:basis-[88%] lg:basis-[85%]">
              <ChartInsights
                data={props.cruise.months}
                metric="reached"
                unit="cruise missiles"
                accent={CAT_COLORS.cruise}
                direction="down-is-good"
                title="Key findings · cruise reaching target"
                subtitle="Plain-language summary of monthly cruise missiles not intercepted."
              />
            </div>
            <div className="snap-start shrink-0 basis-[92%] md:basis-[88%] lg:basis-[85%]">
              <ChartInsights
                data={props.ballistic.months}
                metric="reached"
                unit="ballistic missiles"
                accent={CAT_COLORS.ballistic}
                direction="down-is-good"
                title="Key findings · ballistic reaching target"
                subtitle="Plain-language summary of monthly ballistic missiles not intercepted."
              />
            </div>
          </div>
        </>
      )}
      </div>
    </div>
  );
}

export function AnalyticsDashboard(props: Props) {

  const { t } = useTranslation();
  return (
    <section id="analytics" className="scroll-mt-32 border-t border-border bg-background">
      <div className="container py-12 md:py-16">
        <div className="mb-8 max-w-3xl">
          <div className="src-label mb-3">{t("analytics.kicker")}</div>
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">
            {t("analytics.title")}
          </h2>
          <p className="mt-3 text-[14px] leading-[1.65] text-muted-foreground">
            {t("analytics.intro")}
          </p>
        </div>

        <AnalyticsPager {...props} />



      </div>
    </section>
  );
}
