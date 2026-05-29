import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import { useMemo } from "react";
import type { MonthPoint } from "@/lib/shahed-data";

interface Props {
  data: MonthPoint[];
}

function RateTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0]?.payload as MonthPoint;
  return (
    <div className="rounded-sm border border-border bg-card px-3 py-2 shadow-md">
      <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="space-y-1 text-sm num">
        <div className="flex items-center justify-between gap-6">
          <span>Interception rate</span>
          <span className="font-semibold">{(p.rate * 100).toFixed(1)}%</span>
        </div>
        <div className="flex items-center justify-between gap-6 text-xs text-muted-foreground">
          <span>{p.destroyed.toLocaleString()} of {p.launched.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}

export function InterceptionRateChart({ data }: Props) {
  const enriched = useMemo(
    () => data.map((m) => ({ ...m, ratePct: +(m.rate * 100).toFixed(2) })),
    [data],
  );
  const ticks = useMemo(
    () => enriched.filter((_, i) => i % 3 === 0).map((m) => m.label),
    [enriched],
  );

  return (
    <div className="h-[320px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={enriched} margin={{ top: 16, right: 24, left: 8, bottom: 28 }}>
          <CartesianGrid stroke="hsl(var(--border) / 0.15)" vertical={false} />
          <XAxis
            dataKey="label"
            ticks={ticks}
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
            tickLine={false}
            axisLine={{ stroke: "hsl(var(--border))" }}
            angle={-45}
            textAnchor="end"
            height={48}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            domain={[0, 100]}
            tickFormatter={(v) => `${v}%`}
            width={48}
          />
          <Tooltip content={<RateTooltip />} cursor={{ fill: "hsl(var(--foreground))", fillOpacity: 0.04 }} />
          <ReferenceLine y={50} stroke="hsl(var(--border))" strokeDasharray="3 3" />
          <Bar dataKey="ratePct" fill="hsl(var(--series-rate))" fillOpacity={0.18} barSize={10} />
          <Line
            type="monotone"
            dataKey="ratePct"
            stroke="hsl(var(--series-rate))"
            strokeWidth={2.25}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
