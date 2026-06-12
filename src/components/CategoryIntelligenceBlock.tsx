import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import type { Dataset, MonthPoint } from "@/lib/shahed-data";
import { AnimatedNumber } from "@/components/AnimatedNumber";

/**
 * A single compact "intelligence block" per weapon category. Replaces the
 * legacy CategorySection (which used a heavy bar chart + 4-KPI strip + date
 * slider) with one tight unit that contains:
 *
 *   • Asymmetric 60/40 header (framing copy + 24-month share sparkline)
 *   • Stat row: total launched · interception rate · 12-month sparkline · MoM Δ
 *   • Full-width thin signal-line chart for the full history
 *
 * No bar charts. All micro labels share the body font.
 */

interface Props {
  id: string;
  index: number;                   // 01, 02, 03 — drives the sticky label
  kicker: string;
  title: string;
  framing: string;                 // editorial framing sentence — why this matters
  unit: string;
  accent: string;                  // hsl() colour for this category
  dataset: Dataset;
  shareSeries: number[];           // last-24-month share of total (0..1)
  shareLabels: string[];
}

const fmt = (n: number) => n.toLocaleString("en-US");

function ShareSparkline({ series, labels, accent }: { series: number[]; labels: string[]; accent: string }) {
  const data = useMemo(
    () => series.map((v, i) => ({ x: labels[i] ?? "", y: v * 100 })),
    [series, labels],
  );
  if (!data.length) return null;
  return (
    <div className="h-[64px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`share-grad-${accent}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={accent} stopOpacity={0.35} />
              <stop offset="100%" stopColor={accent} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="y"
            stroke={accent}
            strokeWidth={1.25}
            fill={`url(#share-grad-${accent})`}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function LaunchSparkline({ data, accent }: { data: MonthPoint[]; accent: string }) {
  return (
    <div className="h-[36px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
          <Line
            type="monotone"
            dataKey="launched"
            stroke={accent}
            strokeWidth={1.25}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function SignalLineTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const launched = payload.find((p: any) => p.dataKey === "launched")?.value ?? 0;
  const destroyed = payload.find((p: any) => p.dataKey === "destroyed")?.value ?? 0;
  return (
    <div className="panel min-w-[160px] px-3 py-2 text-[11px]">
      <div className="mb-1 src-label">{label}</div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-muted-foreground">Launched</span>
        <span className="num font-semibold">{fmt(launched)}</span>
      </div>
      <div className="flex items-center justify-between gap-4 text-muted-foreground">
        <span>Intercepted</span>
        <span className="num">{fmt(destroyed)}</span>
      </div>
    </div>
  );
}

function SignalLineHistory({ data, accent }: { data: MonthPoint[]; accent: string }) {
  // Only show ticks at year-start to keep the axis quiet.
  const ticks = useMemo(
    () => data.filter((m) => m.date.getUTCMonth() === 0).map((m) => m.label),
    [data],
  );
  return (
    <div className="h-[140px] w-full sm:h-[180px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 6, right: 6, left: -16, bottom: 0 }}>
          <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="2 4" vertical={false} />
          <XAxis
            dataKey="label"
            ticks={ticks}
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
            axisLine={{ stroke: "hsl(var(--border))" }}
            tickLine={false}
            interval={0}
          />
          <YAxis
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={36}
            tickFormatter={(v: number) =>
              Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : String(v)
            }
          />
          <Tooltip
            cursor={{ stroke: "hsl(var(--border))", strokeDasharray: "2 4" }}
            content={<SignalLineTooltip />}
          />
          <Line
            type="monotone"
            dataKey="destroyed"
            stroke="hsl(var(--muted-foreground))"
            strokeWidth={1}
            strokeDasharray="3 3"
            dot={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="launched"
            stroke={accent}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CategoryIntelligenceBlock({
  id, index, kicker, title, framing, unit, accent, dataset, shareSeries, shareLabels,
}: Props) {
  const { t } = useTranslation();

  // Exclude the partial current month from totals and 12-month windows for
  // an apples-to-apples view.
  const now = new Date();
  const curKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const completed = useMemo(
    () => dataset.months.filter((m) => m.key !== curKey),
    [dataset, curKey],
  );

  const totals = useMemo(() => {
    const launched = completed.reduce((s, m) => s + m.launched, 0);
    const destroyed = completed.reduce((s, m) => s + m.destroyed, 0);
    return { launched, destroyed, rate: launched > 0 ? destroyed / launched : 0 };
  }, [completed]);

  const last12 = useMemo(() => completed.slice(-12), [completed]);
  const momPct = useMemo(() => {
    if (completed.length < 2) return null;
    const last = completed[completed.length - 1];
    const prev = completed[completed.length - 2];
    if (!prev.launched) return null;
    return { pct: ((last.launched - prev.launched) / prev.launched) * 100, last: last.label, prev: prev.label };
  }, [completed]);

  return (
    <section id={id} className="scroll-mt-32">
      {/* Interrupted divider with sticky section label tucked into the gap. */}
      <div className="relative">
        <div className="divider-interrupted h-px" />
        <div className="absolute left-0 top-0 -translate-y-1/2 bg-background pr-2 src-label">
          {String(index).padStart(2, "0")}
        </div>
      </div>

      <div className="container pt-6 pb-8 md:pt-8 md:pb-12">
        {/* ── Asymmetric header: 60/40 ── */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-12 md:gap-6">
          <div className="md:col-span-7">
            <div className="src-label mb-1.5">{kicker}</div>
            <h2 className="text-[1.5rem] leading-tight tracking-tight md:text-[1.875rem] font-semibold">
              {title}
            </h2>
            <p className="mt-2 text-[14px] leading-[1.55] text-muted-foreground max-w-prose">
              {framing}
            </p>
          </div>
          <div className="md:col-span-5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="src-label">{t("intel.shareLast24m")}</span>
              {shareSeries.length >= 2 && (
                <span
                  className="data-tag num"
                  style={{ color: accent }}
                  title={t("intel.shareDelta") as string}
                >
                  {(shareSeries[shareSeries.length - 1] * 100).toFixed(0)}%
                  <span className="ml-1.5 text-muted-foreground">
                    ({shareSeries[shareSeries.length - 1] - shareSeries[0] >= 0 ? "▲" : "▼"}{" "}
                    {Math.abs((shareSeries[shareSeries.length - 1] - shareSeries[0]) * 100).toFixed(1)} pp)
                  </span>
                </span>
              )}
            </div>
            <ShareSparkline series={shareSeries} labels={shareLabels} accent={accent} />
          </div>
        </div>

        {/* ── Compact intelligence row ── */}
        <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4 border-y border-border py-3 md:grid-cols-4 md:gap-x-6">
          {/* Total launched */}
          <div className="min-w-0">
            <div className="src-label">{t("intel.totalLaunched", { unit })}</div>
            <div className="mt-1 num text-[1.25rem] sm:text-[1.5rem] md:text-[1.75rem] font-semibold leading-none">
              <AnimatedNumber value={totals.launched} />
            </div>
          </div>
          {/* Interception rate */}
          <div className="min-w-0">
            <div className="src-label">{t("intel.interceptionRate")}</div>
            <div className="mt-1 num text-[1.25rem] sm:text-[1.5rem] md:text-[1.75rem] font-semibold leading-none">
              <AnimatedNumber value={totals.rate * 100} decimals={1} suffix="%" />
            </div>
          </div>
          {/* 12-month sparkline */}
          <div className="min-w-0 col-span-2 md:col-span-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className="src-label">{t("intel.last12m")}</span>
              <span className="data-tag num text-muted-foreground">
                {last12[0]?.label} → {last12[last12.length - 1]?.label}
              </span>
            </div>
            <LaunchSparkline data={last12} accent={accent} />
          </div>
          {/* MoM delta */}
          <div className="min-w-0">
            <div className="src-label">{t("intel.mom")}</div>
            {momPct ? (
              <>
                <div
                  className="mt-1 num text-[1.25rem] sm:text-[1.5rem] md:text-[1.75rem] font-semibold leading-none"
                  style={{ color: momPct.pct >= 0 ? "hsl(var(--signal))" : "hsl(var(--signal-ok))" }}
                >
                  {momPct.pct >= 0 ? "+" : ""}{momPct.pct.toFixed(1)}%
                </div>
                <div className="mt-1 data-tag">{momPct.last} vs {momPct.prev}</div>
              </>
            ) : (
              <div className="mt-1 text-muted-foreground">—</div>
            )}
          </div>
        </div>

        {/* ── Full-width signal-line history ── */}
        <div className="mt-4">
          <div className="mb-1.5 flex items-baseline justify-between gap-2">
            <span className="src-label">{t("intel.signalLine", { unit })}</span>
            <span className="data-tag text-muted-foreground">
              <span className="mr-3 inline-flex items-center gap-1.5">
                <span className="inline-block h-[2px] w-3" style={{ background: accent }} />
                {t("intel.legendLaunched")}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-[1px] w-3 border-t border-dashed border-muted-foreground" />
                {t("intel.legendIntercepted")}
              </span>
            </span>
          </div>
          <SignalLineHistory data={completed} accent={accent} />
        </div>
      </div>
    </section>
  );
}
