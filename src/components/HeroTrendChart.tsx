import { useMemo, useState } from "react";
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
  ReferenceDot,
} from "recharts";
import type { Dataset, MonthPoint } from "@/lib/shahed-data";

type TabKey = "all" | "uav" | "cruise" | "ballistic";

interface Props {
  shahed: Dataset;
  cruise: Dataset;
  ballistic: Dataset;
}

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");
const fmtCompact = (n: number) => {
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return String(n);
};

interface Row {
  key: string;
  label: string;
  shortLabel: string;
  date: Date;
  launched: number;
  intercepted: number;
  breached: number;
}

function combine(sets: Dataset[]): Row[] {
  const map = new Map<string, Row>();
  for (const ds of sets) {
    for (const m of ds.months) {
      const cur = map.get(m.key);
      if (cur) {
        cur.launched += m.launched;
        cur.intercepted += m.destroyed;
        cur.breached += Math.max(m.launched - m.destroyed, 0);
      } else {
        map.set(m.key, {
          key: m.key,
          label: m.label,
          shortLabel: (() => {
            const mo = m.date.toLocaleString("en-US", { month: "short" });
            return m.date.getUTCMonth() === 0
              ? `${mo} ${String(m.date.getUTCFullYear()).slice(2)}`
              : mo;
          })(),
          date: m.date,
          launched: m.launched,
          intercepted: m.destroyed,
          breached: Math.max(m.launched - m.destroyed, 0),
        });
      }
    }
  }
  const rows = Array.from(map.values()).sort(
    (a, b) => a.date.getTime() - b.date.getTime(),
  );
  // Drop current incomplete month for a cleaner trailing line.
  const now = new Date();
  const curY = now.getUTCFullYear();
  const curM = now.getUTCMonth();
  return rows.filter(
    (r) => !(r.date.getUTCFullYear() === curY && r.date.getUTCMonth() === curM),
  );
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0]?.payload as Row;
  const rate = p.launched > 0 ? (p.intercepted / p.launched) * 100 : 0;
  return (
    <div className="panel min-w-[200px] px-3 py-2 font-mono text-[11px]">
      <div className="mb-1.5 src-label">{label}</div>
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-6">
          <span className="flex items-center gap-2 text-muted-foreground">
            <span className="h-2 w-2 rounded-sm bg-muted-foreground/40" />
            Launched
          </span>
          <span className="num font-semibold text-foreground/80">{fmt(p.launched)}</span>
        </div>
        <div className="flex items-center justify-between gap-6">
          <span className="flex items-center gap-2 text-muted-foreground">
            <span className="h-[2px] w-3" style={{ background: "hsl(var(--foreground))" }} />
            Intercepted
          </span>
          <span className="num font-semibold text-foreground/80">{fmt(p.intercepted)}</span>
        </div>
        <div className="flex items-center justify-between gap-6">
          <span className="flex items-center gap-2 text-muted-foreground">
            <span className="h-[2px] w-3" style={{ background: "hsl(var(--signal-warn))" }} />
            Breached
          </span>
          <span className="num font-semibold" style={{ color: "hsl(var(--signal-warn))" }}>
            {fmt(p.breached)}
          </span>
        </div>
        <div className="mt-1 flex items-center justify-between gap-6 border-t border-border pt-1 text-muted-foreground">
          <span>Interception rate</span>
          <span className="num font-semibold text-foreground/80">{rate.toFixed(1)}%</span>
        </div>
      </div>
    </div>
  );
}

export function HeroTrendChart({ shahed, cruise, ballistic }: Props) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<TabKey>("all");

  const rows = useMemo(() => {
    const sets =
      tab === "all" ? [shahed, cruise, ballistic]
      : tab === "uav" ? [shahed]
      : tab === "cruise" ? [cruise]
      : [ballistic];
    return combine(sets);
  }, [tab, shahed, cruise, ballistic]);

  const { peakLaunched, peakBreached } = useMemo(() => {
    let pL: Row | null = null;
    let pB: Row | null = null;
    for (const r of rows) {
      if (!pL || r.launched > pL.launched) pL = r;
      if (!pB || r.breached > pB.breached) pB = r;
    }
    return { peakLaunched: pL, peakBreached: pB };
  }, [rows]);

  const tabs: { k: TabKey; label: string }[] = [
    { k: "all", label: "ALL" },
    { k: "uav", label: "UAVS" },
    { k: "cruise", label: "CRUISE" },
    { k: "ballistic", label: "BALLISTIC" },
  ];

  return (
    <section className="border-t border-border">
      <div className="container py-8 md:py-12">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div className="max-w-2xl">
            <div className="src-label mb-2">
              {t("hero.trendKicker", "Monthly trend")}
            </div>
            <h2 className="font-serif text-[1.375rem] md:text-[1.75rem] leading-tight tracking-tight text-foreground">
              {t("hero.trendTitle", "Launched, intercepted, and what got through")}
            </h2>
            <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
              {t(
                "hero.trendSubtitle",
                "Monthly totals since October 2022. Bars show launches; the amber line marks the count that breached air defenses.",
              )}
            </p>
          </div>
          <div
            role="tablist"
            aria-label="Weapon type"
            className="flex flex-wrap items-center justify-end gap-1 md:gap-1.5"
          >
            {tabs.map((tt) => (
              <button
                key={tt.k}
                role="tab"
                aria-selected={tab === tt.k}
                onClick={() => setTab(tt.k)}
                className={`shrink-0 border px-2 py-1 text-center font-mono text-[10.5px] uppercase tracking-[0.12em] transition-colors md:px-2.5 md:py-1.5 md:text-[11px] md:tracking-[0.14em] min-w-[68px] md:min-w-[76px] ${
                  tab === tt.k
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-background text-muted-foreground hover:text-foreground hover:border-foreground/40"
                }`}
              >
                {tt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="h-[340px] w-full sm:h-[420px] rounded-sm border border-border bg-card p-3 sm:p-5">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={rows}
              margin={{ top: 24, right: 16, left: 0, bottom: 28 }}
              barCategoryGap={0}
              barGap={0}
            >
              <CartesianGrid stroke="hsl(var(--border) / 0.25)" vertical={false} />
              <XAxis
                dataKey="shortLabel"
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: "hsl(var(--border))" }}
                interval="preserveStartEnd"
                minTickGap={20}
              />
              <YAxis
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={48}
                tickFormatter={(v) => fmtCompact(v as number)}
              />
              <Tooltip
                content={<ChartTooltip />}
                cursor={{ fill: "hsl(var(--foreground) / 0.05)" }}
              />
              <Bar
                dataKey="breached"
                name="Breached"
                stackId="a"
                fill="hsl(var(--signal))"
                isAnimationActive={false}
              />
              <Bar
                dataKey="intercepted"
                name="Intercepted"
                stackId="a"
                fill="hsl(var(--series-destroyed))"
                isAnimationActive={false}
              />
              {peakLaunched && (
                <ReferenceDot
                  x={peakLaunched.shortLabel}
                  y={peakLaunched.launched}
                  r={4}
                  fill="hsl(var(--foreground))"
                  stroke="hsl(var(--background))"
                  strokeWidth={1.5}
                  label={{
                    value: `${t("hero.peakLaunched", "Largest wave")} · ${fmt(peakLaunched.launched)}`,
                    position: "top",
                    fill: "hsl(var(--foreground))",
                    fontSize: 10,
                    fontFamily: "var(--font-mono, ui-monospace)",
                  }}
                />
              )}
              {peakBreached && peakBreached.key !== peakLaunched?.key && (
                <ReferenceDot
                  x={peakBreached.shortLabel}
                  y={peakBreached.breached}
                  r={4}
                  fill="hsl(var(--signal-warn))"
                  stroke="hsl(var(--background))"
                  strokeWidth={1.5}
                  label={{
                    value: `${t("hero.peakBreached", "Most breached")} · ${fmt(peakBreached.breached)}`,
                    position: "top",
                    fill: "hsl(var(--signal-warn))",
                    fontSize: 10,
                  }}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-3 rounded-sm" style={{ background: "hsl(var(--series-destroyed))" }} /> Intercepted
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-3 rounded-sm" style={{ background: "hsl(var(--signal))" }} /> Breached
          </span>
          <span className="ml-auto normal-case tracking-normal text-[11px] text-muted-foreground/80">
            {t("hero.trendSource", "Source: Ukrainian Air Force Command (via Kaggle, Petro Ivaniuk).")}
          </span>
        </div>
      </div>
    </section>
  );
}
