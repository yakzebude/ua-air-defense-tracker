import { useMemo } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import type { MonthPoint } from "@/lib/shahed-data";
import { rampColor } from "@/lib/threat-ramp";

interface Props {
  data: MonthPoint[];
}

const fmt = (n: number) => n.toLocaleString("en-US");

const COLOR_LAUNCHED  = rampColor(0.45); // orange — "incoming"
const COLOR_DESTROYED = rampColor(1);    // deep purple — "neutralised"
const ACCENT          = rampColor(1);

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0]?.payload as MonthPoint;
  return (
    <div className="rounded-sm border border-border bg-background/95 px-3 py-2 font-mono text-[11px] shadow-xl backdrop-blur">
      <div className="mb-1.5 uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-6 text-foreground">
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-sm" style={{ background: COLOR_LAUNCHED }} />
            Launched
          </span>
          <span className="num font-semibold">{fmt(p.launched)}</span>
        </div>
        <div className="flex items-center justify-between gap-6 text-foreground">
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-sm" style={{ background: COLOR_DESTROYED }} />
            Destroyed
          </span>
          <span className="num font-semibold">{fmt(p.destroyed)}</span>
        </div>
        <div className="mt-1 flex items-center justify-between gap-6 border-t border-border pt-1 text-muted-foreground">
          <span>Interception</span>
          <span className="num font-semibold text-foreground">{(p.rate * 100).toFixed(1)}%</span>
        </div>
      </div>
    </div>
  );
}

export function MonthlyTrendChart({ data }: Props) {
  const ticks = useMemo(
    () => data.filter((_, i) => i % 4 === 0).map((m) => m.label),
    [data],
  );

  return (
    <div className="h-[420px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 12, right: 16, left: 0, bottom: 8 }}>
          <defs>
            <linearGradient id="mtc-launched" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={COLOR_LAUNCHED} stopOpacity={0.7} />
              <stop offset="100%" stopColor={COLOR_LAUNCHED} stopOpacity={0.05} />
            </linearGradient>
            <linearGradient id="mtc-destroyed" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={COLOR_DESTROYED} stopOpacity={0.7} />
              <stop offset="100%" stopColor={COLOR_DESTROYED} stopOpacity={0.05} />
            </linearGradient>
            <filter id="mtc-glow" x="-20%" y="-20%" width="140%" height="140%">
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
            width={56}
            tickFormatter={(v) => fmt(v as number)}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ stroke: ACCENT, strokeOpacity: 0.5 }} />
          <Area
            type="monotone"
            dataKey="launched"
            name="Launched"
            stroke={COLOR_LAUNCHED}
            strokeWidth={1.5}
            fill="url(#mtc-launched)"
            filter="url(#mtc-glow)"
          />
          <Area
            type="monotone"
            dataKey="destroyed"
            name="Destroyed"
            stroke={COLOR_DESTROYED}
            strokeWidth={1.5}
            fill="url(#mtc-destroyed)"
            filter="url(#mtc-glow)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
