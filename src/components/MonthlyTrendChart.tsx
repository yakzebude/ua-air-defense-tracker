import { useEffect, useMemo, useState } from "react";
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
const fmtCompact = (n: number) => {
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return String(n);
};
const COLOR_BREACHED  = "hsl(var(--signal))";
const COLOR_DESTROYED = "hsl(var(--series-destroyed))";
const COLOR_RATE      = "hsl(var(--series-rate))";
const COLOR_LAUNCHED  = "hsl(var(--series-launched))";

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

/** Track viewport width so we can switch to a denser layout on small screens. */
function useIsNarrow(breakpoint = 640): boolean {
  const [narrow, setNarrow] = useState<boolean>(
    typeof window !== "undefined" ? window.innerWidth < breakpoint : false,
  );
  useEffect(() => {
    const onResize = () => setNarrow(window.innerWidth < breakpoint);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [breakpoint]);
  return narrow;
}

export function MonthlyTrendChart({ data }: Props) {
  const { t } = useTranslation();
  const isNarrow = useIsNarrow(640);

  const enriched = useMemo(() => {
    const now = new Date();
    const curY = now.getUTCFullYear();
    const curM = now.getUTCMonth();
    return data
      .filter((m) => !(m.date.getUTCFullYear() === curY && m.date.getUTCMonth() === curM))
      .map((m) => ({
        ...m,
        // Short tick label for narrow screens (Jan, Feb …; year only on Jan).
        shortLabel: (() => {
          const mo = m.date.toLocaleString("en-US", { month: "short" });
          return m.date.getUTCMonth() === 0 ? `${mo} ${String(m.date.getUTCFullYear()).slice(2)}` : mo;
        })(),
        ratePct: +(m.rate * 100).toFixed(2),
      }));
  }, [data]);

  // Tick density adapts to viewport. On mobile we always rotate and keep the
  // label set sparse so months never overlap.
  const ticks = useMemo(() => {
    const step = isNarrow
      ? (enriched.length <= 8 ? 1 : enriched.length <= 18 ? 3 : 6)
      : (enriched.length <= 6 ? 1 : enriched.length <= 14 ? 2 : 5);
    return enriched.filter((_, i) => i % step === 0).map((m) => (isNarrow ? m.shortLabel : m.label));
  }, [enriched, isNarrow]);

  return (
    <div className="w-full">
      <div className="h-[300px] w-full sm:h-[360px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={enriched}
            margin={isNarrow
              ? { top: 8, right: 8, left: 0, bottom: 28 }
              : { top: 8, right: 48, left: 0, bottom: 28 }
            }
            barCategoryGap={isNarrow ? "12%" : "18%"}
            barGap={1}
          >
            <CartesianGrid stroke="hsl(var(--border) / 0.15)" vertical={false} />
            <XAxis
              dataKey={isNarrow ? "shortLabel" : "label"}
              ticks={ticks}
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: isNarrow ? 10 : 11 }}
              tickLine={false}
              axisLine={{ stroke: "hsl(var(--border))" }}
              angle={isNarrow ? 0 : -45}
              textAnchor={isNarrow ? "middle" : "end"}
              height={isNarrow ? 28 : 48}
              interval="preserveStartEnd"
              minTickGap={isNarrow ? 12 : 6}
            />

            <YAxis
              yAxisId="count"
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: isNarrow ? 10 : 11 }}
              tickLine={false}
              axisLine={false}
              width={isNarrow ? 36 : 48}
              tickFormatter={(v) => (isNarrow ? fmtCompact(v as number) : fmt(v as number))}
            />
            {!isNarrow && (
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
            )}
            <Tooltip content={<ChartTooltip t={t} />} cursor={{ stroke: "hsl(var(--foreground))", strokeOpacity: 0.18 }} />
            <Bar yAxisId="count" dataKey="launched" name={t("chart.launched")} fill={COLOR_LAUNCHED} fillOpacity={0.85} maxBarSize={isNarrow ? 14 : 18} />
            <Bar yAxisId="count" dataKey="destroyed" name={t("chart.destroyed")} fill={COLOR_DESTROYED} fillOpacity={0.85} maxBarSize={isNarrow ? 14 : 18} />
            {!isNarrow && (
              <Line
                yAxisId="count"
                type="monotone"
                dataKey="destroyed"
                name={t("chart.interceptionRate")}
                stroke={COLOR_RATE}
                strokeWidth={0}
                dot={false}
                legendType="none"
                hide
              />
            )}
            {!isNarrow && (
              <Line
                yAxisId="rate"
                type="monotone"
                dataKey="ratePct"
                name={t("chart.interceptionRate")}
                stroke={COLOR_RATE}
                strokeWidth={1}
                strokeDasharray="3 3"
                dot={false}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm" style={{ background: COLOR_LAUNCHED }} /> {t("chart.launched")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm" style={{ background: COLOR_DESTROYED }} /> {t("chart.destroyed")}
        </span>
        {!isNarrow && (
          <span className="flex items-center gap-1.5 basis-full sm:basis-auto">
            <span className="h-[2px] w-3" style={{ background: COLOR_RATE }} /> {t("chart.interceptionRateRight")}
          </span>
        )}
        {isNarrow && (
          <span className="basis-full text-[10px] normal-case tracking-normal text-muted-foreground/80">
            {t("chart.mobileHint", { defaultValue: "Tap a bar for monthly interception rate." })}
          </span>
        )}
      </div>
    </div>
  );
}

