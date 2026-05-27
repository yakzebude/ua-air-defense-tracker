import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import type { MonthPoint } from "@/lib/shahed-data";

interface Props {
  data: MonthPoint[];
}

const fmt = (n: number) => n.toLocaleString("en-US");
const COLOR_LAUNCHED  = "hsl(var(--series-launched))";
const COLOR_DESTROYED = "hsl(var(--series-destroyed))";
const COLOR_RATE      = "hsl(var(--series-rate))";

function ChartTooltip({ active, payload, label, t }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0]?.payload as MonthPoint;
  return (
    <div className="panel min-w-[180px] px-3 py-2 font-mono text-[11px]">
      <div className="mb-1.5 src-label">{label}</div>
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-6 text-foreground">
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-sm" style={{ background: COLOR_LAUNCHED }} />
            {t("kpi.launchedReported")}
          </span>
          <span className="num font-semibold">{fmt(p.launched)}</span>
        </div>
        <div className="flex items-center justify-between gap-6 text-foreground">
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-sm" style={{ background: COLOR_DESTROYED }} />
            {t("kpi.destroyedConfirmed")}
          </span>
          <span className="num font-semibold">{fmt(p.destroyed)}</span>
        </div>
        <div className="mt-1 flex items-center justify-between gap-6 border-t border-border pt-1 text-muted-foreground">
          <span>{t("chart.interceptionRate")}</span>
          <span className="num font-semibold text-foreground">{(p.rate * 100).toFixed(1)}%</span>
        </div>
      </div>
    </div>
  );
}

export function MonthlyTrendChart({ data }: Props) {
  const { t } = useTranslation();
  const enriched = useMemo(() => {
    const now = new Date();
    const curY = now.getUTCFullYear();
    const curM = now.getUTCMonth();
    return data
      .filter((m) => !(m.date.getUTCFullYear() === curY && m.date.getUTCMonth() === curM))
      .map((m) => ({ ...m, ratePct: +(m.rate * 100).toFixed(2) }));
  }, [data]);
  const ticks = useMemo(() => {
    const step = enriched.length <= 6 ? 1 : enriched.length <= 14 ? 2 : 4;
    return enriched.filter((_, i) => i % step === 0).map((m) => m.label);
  }, [enriched]);

  return (
    <div className="h-[360px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={enriched} margin={{ top: 8, right: 48, left: 0, bottom: 4 }} barCategoryGap="18%" barGap={2}>
          <CartesianGrid stroke="hsl(var(--grid))" vertical={false} />
          <XAxis
            dataKey="label"
            ticks={ticks}
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: "hsl(var(--border))" }}
          />
          <YAxis
            yAxisId="count"
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={48}
            tickFormatter={(v) => fmt(v as number)}
          />
          <YAxis
            yAxisId="rate"
            orientation="right"
            domain={[0, 100]}
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={42}
            tickFormatter={(v) => `${v}%`}
          />
          <Tooltip content={<ChartTooltip t={t} />} cursor={{ stroke: "hsl(var(--foreground))", strokeOpacity: 0.18 }} />
          <Bar yAxisId="count" dataKey="launched" name={t("chart.launched")} fill={COLOR_LAUNCHED} fillOpacity={0.85} maxBarSize={28} />
          <Bar yAxisId="count" dataKey="destroyed" name={t("chart.destroyed")} fill={COLOR_DESTROYED} fillOpacity={0.9} maxBarSize={28} />
          <Line
            yAxisId="rate"
            type="monotone"
            dataKey="ratePct"
            name={t("chart.interceptionRate")}
            stroke={COLOR_RATE}
            strokeWidth={1.25}
            strokeDasharray="3 3"
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm" style={{ background: COLOR_LAUNCHED }} /> {t("chart.launched")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm" style={{ background: COLOR_DESTROYED }} /> {t("chart.destroyed")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-[2px] w-3" style={{ background: COLOR_RATE }} /> {t("chart.interceptionRateRight")}
        </span>
      </div>
    </div>
  );
}
