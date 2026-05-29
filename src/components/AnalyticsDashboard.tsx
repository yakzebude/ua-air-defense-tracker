import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
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
import { Panel } from "@/components/ui/panel";
import { PanelActions } from "@/components/PanelActions";
import { rampColor } from "@/lib/threat-ramp";


const fmt = (n: number) => n.toLocaleString("en-US");

type CategoryKey = "uavs" | "cruise" | "ballistic";

const CAT_COLORS: Record<CategoryKey, string> = {
  uavs:      "hsl(220 10% 62%)",
  cruise:    "hsl(220 12% 42%)",
  ballistic: "hsl(220 18% 22%)",
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
          <CartesianGrid stroke="hsl(var(--grid))" vertical={false} />
          <XAxis
            dataKey="label"
            ticks={ticks}
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: "hsl(var(--border))" }}
            angle={angled ? -45 : 0}
            textAnchor={angled ? "end" : "middle"}
            height={angled ? 48 : 30}
            interval={0}
          />

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
                <span className="text-muted-foreground">· {share.toFixed(1)}{t("chart.shareSuffix")}</span>
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
              <span>{t("chart.share")}</span>
              <span>{t("chart.interceptionRate")}</span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function HeatmapMonthlyIntensity({ shahed, cruise, ballistic }: Props) {
  const { t } = useTranslation();
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

  const catLabel = (c: "all" | CategoryKey) =>
    c === "all" ? t("analytics.all") : t(`category.${c}`);

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
              {catLabel(c)}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          <span>{t("analytics.less")}</span>
          <div className="flex gap-1">
            {[0.15, 0.35, 0.55, 0.75, 1].map((i) => (
              <div
                key={i}
                className="h-2.5 w-5 rounded-[2px] border border-border/60"
                style={{ background: rampColor(i, 0.25 + i * 0.75) }}
              />
            ))}
          </div>
          <span>{t("analytics.more", { n: fmt(max) })}</span>
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
                        title={t("analytics.monthCellTitle", { month: monthLabels[mo], year: y, n: fmt(v) })}
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

      {active === "uavs" && (
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
        </Panel>
      )}

      {active === "cruiseBal" && (
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
        </Panel>
      )}

      {active === "share" && (
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
        </Panel>
      )}

      {active === "calendar" && (
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
        </Panel>
      )}
    </div>
  );
}

export function AnalyticsDashboard(props: Props) {

  const { t } = useTranslation();
  return (
    <section id="analytics" className="scroll-mt-32 border-t border-border bg-secondary/40">
      <div className="container py-12 md:py-16">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-3xl">
            <div className="src-label mb-3">{t("analytics.kicker")}</div>
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">
              {t("analytics.title")}
            </h2>
            <p className="mt-3 text-[14px] leading-[1.65] text-muted-foreground">
              {t("analytics.intro")}
            </p>
          </div>
          <div className="flex items-center gap-3 font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
            {(Object.keys(CAT_COLORS) as CategoryKey[]).map((k) => (
              <span key={k} className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm" style={{ background: CAT_COLORS[k] }} />
                {t(`category.${k}`)}
              </span>
            ))}
          </div>
        </div>

        <AnalyticsPager {...props} />



      </div>
    </section>
  );
}
