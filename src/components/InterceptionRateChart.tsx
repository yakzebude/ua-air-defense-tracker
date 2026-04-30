import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Legend,
} from "recharts";
import { useMemo } from "react";
import type { MonthPoint } from "@/lib/shahed-data";

interface Props {
  data: MonthPoint[];
}

type Row = MonthPoint & {
  destroyedPct: number;
  leakedPct: number;
  leaked: number;
};

function StackTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0]?.payload as Row;
  if (!p) return null;
  return (
    <div className="rounded-sm border border-border bg-card px-3 py-2 shadow-md">
      <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="space-y-1 text-sm num">
        <div className="flex items-center justify-between gap-6">
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-[1px] bg-series-rate" />
            Destroyed
          </span>
          <span className="font-semibold">
            {p.destroyedPct.toFixed(1)}%
          </span>
        </div>
        <div className="flex items-center justify-between gap-6">
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-[1px] bg-series-launched" />
            Reached target area
          </span>
          <span className="font-semibold">{p.leakedPct.toFixed(1)}%</span>
        </div>
        <div className="mt-1 border-t border-border pt-1 flex items-center justify-between gap-6 text-xs text-muted-foreground">
          <span>Volume</span>
          <span>
            {p.destroyed.toLocaleString()} / {p.launched.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
}

export function InterceptionRateChart({ data }: Props) {
  const rows = useMemo<Row[]>(
    () =>
      data.map((m) => {
        const destroyedPct = m.launched > 0 ? (m.destroyed / m.launched) * 100 : 0;
        const leaked = Math.max(m.launched - m.destroyed, 0);
        const leakedPct = m.launched > 0 ? 100 - destroyedPct : 0;
        return {
          ...m,
          leaked,
          destroyedPct: +destroyedPct.toFixed(2),
          leakedPct: +leakedPct.toFixed(2),
        };
      }),
    [data],
  );

  const ticks = useMemo(
    () => rows.filter((_, i) => i % 3 === 0).map((m) => m.label),
    [rows],
  );

  return (
    <div className="h-[360px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={rows} margin={{ top: 16, right: 24, left: 8, bottom: 8 }} stackOffset="expand">
          <defs>
            <linearGradient id="gradDestroyed" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--series-rate))" stopOpacity={0.85} />
              <stop offset="100%" stopColor="hsl(var(--series-rate))" stopOpacity={0.55} />
            </linearGradient>
            <linearGradient id="gradLeaked" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--series-launched))" stopOpacity={0.55} />
              <stop offset="100%" stopColor="hsl(var(--series-launched))" stopOpacity={0.85} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="hsl(var(--grid))" vertical={false} />
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
            tickFormatter={(v) => `${Math.round((v as number) * 100)}%`}
            domain={[0, 1]}
            width={48}
          />
          <Tooltip content={<StackTooltip />} cursor={{ stroke: "hsl(var(--foreground))", strokeOpacity: 0.15 }} />
          <Legend
            verticalAlign="top"
            align="left"
            iconType="square"
            wrapperStyle={{ paddingBottom: 12, fontSize: 13 }}
          />
          <ReferenceLine y={0.5} stroke="hsl(var(--border))" strokeDasharray="3 3" />
          <Area
            type="monotone"
            dataKey="destroyed"
            name="Destroyed"
            stackId="1"
            stroke="hsl(var(--series-rate))"
            strokeWidth={1.5}
            fill="url(#gradDestroyed)"
          />
          <Area
            type="monotone"
            dataKey="leaked"
            name="Reached target area"
            stackId="1"
            stroke="hsl(var(--series-launched))"
            strokeWidth={1.5}
            fill="url(#gradLeaked)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
