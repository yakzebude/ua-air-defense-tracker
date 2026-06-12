import { useMemo } from "react";
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

/**
 * Stacked, 100%-normalized area chart showing how the *composition* of Russian
 * air attacks — UAVs vs cruise vs ballistic — has shifted over the last
 * 24 calendar months. Absolute counts are deliberately suppressed; the chart
 * is about structural mix, not volume.
 */
interface Props {
  shahed: Dataset;
  cruise: Dataset;
  ballistic: Dataset;
}

type Row = {
  key: string;
  label: string;
  uav: number;
  cruise: number;
  ballistic: number;
  total: number;
};

const COLORS = {
  uav: "hsl(var(--series-launched))",
  cruise: "hsl(var(--series-rate))",
  ballistic: "hsl(var(--signal))",
};

function pct(n: number, total: number): number {
  if (!total) return 0;
  return (n / total) * 100;
}

function ChartTooltip({ active, payload, label, t }: any) {
  if (!active || !payload?.length) return null;
  const r = payload[0]?.payload as Row;
  const total = r.total;
  const items: Array<[string, number, string]> = [
    [t("category.uavs"), r.uav, COLORS.uav],
    [t("category.cruise"), r.cruise, COLORS.cruise],
    [t("category.ballistic"), r.ballistic, COLORS.ballistic],
  ];
  return (
    <div className="panel min-w-[200px] px-3 py-2 font-mono text-[11px]">
      <div className="mb-1.5 src-label">{label}</div>
      <div className="space-y-1">
        {items.map(([name, val, color]) => (
          <div key={name} className="flex items-center justify-between gap-6">
            <span className="flex items-center gap-2 text-foreground">
              <span className="h-2 w-2 rounded-sm" style={{ background: color }} />
              {name}
            </span>
            <span className="num font-semibold">
              {pct(val, total).toFixed(1)}%
              <span className="ml-2 font-normal text-muted-foreground">
                {val.toLocaleString("en-US")}
              </span>
            </span>
          </div>
        ))}
        <div className="mt-1 flex items-center justify-between gap-6 border-t border-border pt-1 text-muted-foreground">
          <span>{t("composition.monthTotal")}</span>
          <span className="num font-semibold text-foreground">
            {total.toLocaleString("en-US")}
          </span>
        </div>
      </div>
    </div>
  );
}

export function CompositionShiftChart({ shahed, cruise, ballistic }: Props) {
  const { t } = useTranslation();

  const data: Row[] = useMemo(() => {
    const byKey = new Map<string, Row>();
    const seed = (ms: MonthPoint[]) => {
      for (const m of ms) {
        if (!byKey.has(m.key)) {
          byKey.set(m.key, { key: m.key, label: m.label, uav: 0, cruise: 0, ballistic: 0, total: 0 });
        }
      }
    };
    seed(shahed.months); seed(cruise.months); seed(ballistic.months);

    for (const m of shahed.months)    byKey.get(m.key)!.uav += m.launched;
    for (const m of cruise.months)    byKey.get(m.key)!.cruise += m.launched;
    for (const m of ballistic.months) byKey.get(m.key)!.ballistic += m.launched;

    const all = Array.from(byKey.values()).sort((a, b) => (a.key < b.key ? -1 : 1));
    // Exclude the current (incomplete) calendar month for a clean structural view.
    const now = new Date();
    const curKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
    const completed = all.filter((r) => r.key !== curKey);
    // Take last 24 months and drop empty leading months.
    const tail = completed.slice(-24);
    for (const r of tail) r.total = r.uav + r.cruise + r.ballistic;
    return tail.filter((r) => r.total > 0);
  }, [shahed, cruise, ballistic]);

  if (!data.length) return null;

  return (
    <div className="h-[280px] w-full sm:h-[340px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          stackOffset="expand"
          margin={{ top: 8, right: 8, left: -10, bottom: 0 }}
        >
          <defs>
            <linearGradient id="grad-uav" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={COLORS.uav} stopOpacity={0.85} />
              <stop offset="100%" stopColor={COLORS.uav} stopOpacity={0.65} />
            </linearGradient>
            <linearGradient id="grad-cruise" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={COLORS.cruise} stopOpacity={0.85} />
              <stop offset="100%" stopColor={COLORS.cruise} stopOpacity={0.65} />
            </linearGradient>
            <linearGradient id="grad-bal" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={COLORS.ballistic} stopOpacity={0.9} />
              <stop offset="100%" stopColor={COLORS.ballistic} stopOpacity={0.7} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="2 4" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10, fontFamily: "var(--font-mono, ui-monospace)" }}
            axisLine={{ stroke: "hsl(var(--border))" }}
            tickLine={false}
            interval="preserveStartEnd"
            minTickGap={24}
          />
          <YAxis
            tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10, fontFamily: "var(--font-mono, ui-monospace)" }}
            axisLine={false}
            tickLine={false}
            domain={[0, 1]}
            ticks={[0, 0.25, 0.5, 0.75, 1]}
            width={36}
          />
          <Tooltip
            cursor={{ stroke: "hsl(var(--border))", strokeDasharray: "2 4" }}
            content={(props) => <ChartTooltip {...props} t={t} />}
          />
          <Area
            type="monotone"
            dataKey="ballistic"
            stackId="1"
            stroke={COLORS.ballistic}
            strokeWidth={1}
            fill="url(#grad-bal)"
          />
          <Area
            type="monotone"
            dataKey="cruise"
            stackId="1"
            stroke={COLORS.cruise}
            strokeWidth={1}
            fill="url(#grad-cruise)"
          />
          <Area
            type="monotone"
            dataKey="uav"
            stackId="1"
            stroke={COLORS.uav}
            strokeWidth={1}
            fill="url(#grad-uav)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

interface SectionProps {
  shahed: Dataset;
  cruise: Dataset;
  ballistic: Dataset;
}

export function CompositionShiftSection({ shahed, cruise, ballistic }: SectionProps) {
  const { t } = useTranslation();

  // Compute first vs last month structural shift to surface as a headline.
  const shift = useMemo(() => {
    const byKey = new Map<string, { uav: number; cruise: number; ballistic: number; key: string; label: string }>();
    const seed = (ms: MonthPoint[]) => ms.forEach((m) => {
      if (!byKey.has(m.key)) byKey.set(m.key, { key: m.key, label: m.label, uav: 0, cruise: 0, ballistic: 0 });
    });
    seed(shahed.months); seed(cruise.months); seed(ballistic.months);
    for (const m of shahed.months)    byKey.get(m.key)!.uav += m.launched;
    for (const m of cruise.months)    byKey.get(m.key)!.cruise += m.launched;
    for (const m of ballistic.months) byKey.get(m.key)!.ballistic += m.launched;

    const now = new Date();
    const curKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
    const rows = Array.from(byKey.values())
      .filter((r) => r.key !== curKey)
      .sort((a, b) => (a.key < b.key ? -1 : 1))
      .slice(-24)
      .filter((r) => r.uav + r.cruise + r.ballistic > 0);
    if (rows.length < 2) return null;
    const first = rows[0];
    const last = rows[rows.length - 1];
    const share = (r: typeof first) => {
      const t = r.uav + r.cruise + r.ballistic;
      return { uav: r.uav / t, cruise: r.cruise / t, ballistic: r.ballistic / t };
    };
    const s0 = share(first);
    const s1 = share(last);
    return {
      firstLabel: first.label,
      lastLabel: last.label,
      uavDelta: (s1.uav - s0.uav) * 100,
      cruiseDelta: (s1.cruise - s0.cruise) * 100,
      ballisticDelta: (s1.ballistic - s0.ballistic) * 100,
      latestUav: s1.uav * 100,
      latestCruise: s1.cruise * 100,
      latestBallistic: s1.ballistic * 100,
    };
  }, [shahed, cruise, ballistic]);

  return (
    <section id="composition" className="scroll-mt-32 border-t border-border bg-card/30">
      <div className="container py-10 md:py-14">
        <div className="mb-6 max-w-3xl md:mb-8">
          <div className="src-label mb-2">{t("composition.kicker")}</div>
          <h2 className="font-serif text-[1.5rem] leading-tight tracking-tight sm:text-[1.875rem] md:text-[2.25rem]">
            {t("composition.title")}
          </h2>
          <p className="mt-2 text-[14px] leading-[1.6] text-muted-foreground">
            {t("composition.subtitle")}
          </p>
        </div>

        {shift && (
          <div className="mb-5 grid grid-cols-3 gap-3 border-y border-border py-4 text-[11.5px]">
            <ShiftStat
              color={COLORS.uav}
              label={t("category.uavs")}
              share={shift.latestUav}
              delta={shift.uavDelta}
            />
            <ShiftStat
              color={COLORS.cruise}
              label={t("category.cruise")}
              share={shift.latestCruise}
              delta={shift.cruiseDelta}
            />
            <ShiftStat
              color={COLORS.ballistic}
              label={t("category.ballistic")}
              share={shift.latestBallistic}
              delta={shift.ballisticDelta}
            />
          </div>
        )}

        <CompositionShiftChart shahed={shahed} cruise={cruise} ballistic={ballistic} />

        {shift && (
          <p className="mt-3 text-[11.5px] font-mono uppercase tracking-[0.14em] text-muted-foreground">
            {t("composition.axisNote", { first: shift.firstLabel, last: shift.lastLabel })}
          </p>
        )}
      </div>
    </section>
  );
}

function ShiftStat({
  color, label, share, delta,
}: { color: string; label: string; share: number; delta: number }) {
  const rising = delta > 0;
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5 text-[10px] sm:text-[10.5px] font-mono uppercase tracking-[0.14em] text-muted-foreground">
        <span className="inline-block h-2 w-2 rounded-sm" style={{ background: color }} />
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-1 num text-[1.125rem] sm:text-[1.5rem] font-semibold leading-none">
        {share.toFixed(0)}%
      </div>
      <div className={`mt-1 num text-[10.5px] font-mono uppercase tracking-[0.14em] ${
        Math.abs(delta) < 0.5 ? "text-muted-foreground" : rising ? "text-[hsl(var(--signal))]" : "text-[hsl(var(--signal-ok))]"
      }`}>
        {rising ? "▲" : "▼"} {Math.abs(delta).toFixed(1)} pp
      </div>
    </div>
  );
}
