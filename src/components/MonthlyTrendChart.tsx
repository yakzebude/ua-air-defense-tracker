import { useMemo } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import type { MonthPoint } from "@/lib/shahed-data";

interface Props {
  data: MonthPoint[];
}

const fmt = (n: number) => n.toLocaleString("en-US");

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0]?.payload as MonthPoint;
  return (
    <div className="rounded-sm border border-border bg-card px-3 py-2 shadow-md">
      <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="space-y-1 text-sm num">
        <div className="flex items-center justify-between gap-6">
          <span className="flex items-center gap-2">
            <span className="h-[2px] w-3 bg-series-launched" />
            Launched
          </span>
          <span className="font-semibold">{fmt(p.launched)}</span>
        </div>
        <div className="flex items-center justify-between gap-6">
          <span className="flex items-center gap-2">
            <span className="h-[2px] w-3 bg-series-destroyed" />
            Destroyed
          </span>
          <span className="font-semibold">{fmt(p.destroyed)}</span>
        </div>
        <div className="mt-1 border-t border-border pt-1 flex items-center justify-between gap-6 text-xs text-muted-foreground">
          <span>Interception</span>
          <span className="font-semibold">{(p.rate * 100).toFixed(1)}%</span>
        </div>
      </div>
    </div>
  );
}

export function MonthlyTrendChart({ data }: Props) {
  const ticks = useMemo(
    () => data.filter((_, i) => i % 3 === 0).map((m) => m.label),
    [data],
  );

  return (
    <div className="h-[420px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 16, right: 24, left: 8, bottom: 8 }}>
          <CartesianGrid stroke="hsl(var(--grid))" strokeDasharray="0" vertical={false} />
          <XAxis
            dataKey="label"
            ticks={ticks}
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
            tickLine={false}
            axisLine={{ stroke: "hsl(var(--border))" }}
          />
          <YAxis
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => fmt(v as number)}
            width={56}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ stroke: "hsl(var(--foreground))", strokeOpacity: 0.15 }} />
          <Legend
            verticalAlign="top"
            align="left"
            iconType="plainline"
            wrapperStyle={{ paddingBottom: 16, fontSize: 13 }}
          />
          <Line
            type="monotone"
            dataKey="launched"
            name="Launched"
            stroke="hsl(var(--series-launched))"
            strokeWidth={2.25}
            dot={false}
            activeDot={{ r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="destroyed"
            name="Destroyed"
            stroke="hsl(var(--series-destroyed))"
            strokeWidth={2.25}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
