import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  YAxis,
  ReferenceDot,
  Tooltip,
} from "recharts";
import type { Dataset, MonthPoint } from "@/lib/shahed-data";

interface CategoryInput {
  id: "drones" | "cruise" | "ballistic";
  label: string;
  unit: string;
  dataset: Dataset;
  /** Anchor on the landing page to deep-link to. */
  href: string;
}

interface Props {
  categories: CategoryInput[];
  /** How many trailing months to draw in the sparkline. Default 24. */
  window?: number;
}

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

/** Build the trailing slice used by the sparkline, excluding the current
 *  (incomplete) month so the line ends on the last *completed* data point. */
function trail(months: MonthPoint[], window: number): MonthPoint[] {
  if (!months.length) return [];
  const now = new Date();
  const curY = now.getUTCFullYear();
  const curM = now.getUTCMonth();
  const completed = months.filter(
    (m) => !(m.date.getUTCFullYear() === curY && m.date.getUTCMonth() === curM),
  );
  return completed.slice(-window);
}

interface Stats {
  start: MonthPoint | null;
  end: MonthPoint | null;
  startVal: number;
  endVal: number;
  deltaPct: number | null;
  peak: MonthPoint | null;
}

function statsOf(points: MonthPoint[]): Stats {
  if (!points.length) {
    return { start: null, end: null, startVal: 0, endVal: 0, deltaPct: null, peak: null };
  }
  const start = points[0];
  const end = points[points.length - 1];
  const startVal = start.launched;
  const endVal = end.launched;
  const deltaPct =
    startVal > 0 ? ((endVal - startVal) / startVal) * 100 : null;
  let peak = points[0];
  for (const p of points) if (p.launched > peak.launched) peak = p;
  return { start, end, startVal, endVal, deltaPct, peak };
}

function SparkTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0]?.payload as MonthPoint;
  return (
    <div className="rounded-sm border border-border bg-card px-2.5 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.14em] shadow-md">
      <div className="text-muted-foreground">{p.label}</div>
      <div className="mt-0.5 text-foreground/80">
        <span className="num font-semibold">{fmt(p.launched)}</span>
        <span className="ml-1 normal-case tracking-normal text-muted-foreground">
          launched
        </span>
      </div>
    </div>
  );
}

function CategoryCard({ input, window }: { input: CategoryInput; window: number }) {
  const points = useMemo(() => trail(input.dataset.months, window), [input, window]);
  const s = useMemo(() => statsOf(points), [points]);

  // Δ% tone: more launches = bad (red signal), fewer = good (green signal-ok).
  const deltaTone =
    s.deltaPct === null || !Number.isFinite(s.deltaPct)
      ? "text-muted-foreground"
      : s.deltaPct > 0
        ? "text-[hsl(var(--signal))]"
        : "text-[hsl(var(--signal-ok))]";
  const deltaArrow =
    s.deltaPct === null ? "" : s.deltaPct > 0 ? "▲" : s.deltaPct < 0 ? "▼" : "•";
  const deltaLabel =
    s.deltaPct === null
      ? "—"
      : `${s.deltaPct > 0 ? "+" : ""}${s.deltaPct.toFixed(0)}%`;

  return (
    <a
      href={input.href}
      className="group flex flex-col gap-3 rounded-sm border border-border bg-card p-4 transition-colors hover:bg-secondary/40"
      aria-label={`${input.label} — jump to detail section`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <div className="font-mono text-[10.5px] font-medium uppercase tracking-[0.18em] text-foreground">
          {input.label}
        </div>
        <div
          className={`inline-flex items-center gap-1 font-mono text-[22px] uppercase tracking-[0.14em] ${deltaTone}`}
          title={`Change between ${s.start?.label ?? "—"} and ${s.end?.label ?? "—"}`}
        >
          <span aria-hidden>{deltaArrow}</span>
          <span className="num">{deltaLabel}</span>
        </div>
      </div>

      <div className="flex items-end justify-between gap-3">
        <div className="num text-[10.5px] text-muted-foreground">
          <span className="block leading-none">{s.start?.label ?? "—"}</span>
          <span className="mt-0.5 block leading-none text-foreground/80">
            {s.start ? fmt(s.startVal) : "—"}
          </span>
        </div>
        <div className="text-right num text-[10.5px] text-muted-foreground">
          <span className="block leading-none">{s.end?.label ?? "—"}</span>
          <span className="mt-0.5 block leading-none num font-semibold text-foreground text-[15px]">
            {s.end ? fmt(s.endVal) : "—"}
          </span>
        </div>
      </div>

      <div className="h-[64px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 8, right: 8, left: 8, bottom: 4 }}>
            <YAxis hide domain={[0, "dataMax"]} />
            <Tooltip content={<SparkTooltip />} cursor={{ stroke: "hsl(var(--border))" }} />
            <Line
              type="monotone"
              dataKey="launched"
              stroke="hsl(var(--foreground))"
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
            />
            {s.start && (
              <ReferenceDot
                x={s.start.label}
                y={s.startVal}
                r={2.5}
                fill="hsl(var(--muted-foreground))"
                stroke="none"
              />
            )}
            {s.end && (
              <ReferenceDot
                x={s.end.label}
                y={s.endVal}
                r={3}
                fill="hsl(var(--signal))"
                stroke="hsl(var(--background))"
                strokeWidth={1.5}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        <span>peak {s.peak ? `${s.peak.label} · ${fmt(s.peak.launched)}` : "—"}</span>
        <span className="opacity-0 transition-opacity group-hover:opacity-100">view →</span>
      </div>
    </a>
  );
}

/**
 * Small-multiples overview: one mini line chart per weapon category.
 * Replaces text-based "Key Findings" with a comparative, scannable grid.
 */
export function CategorySparklines({ categories, window = 24 }: Props) {
  const { t } = useTranslation();
  const valid = categories.filter((c) => c.dataset?.months?.length);
  if (!valid.length) return null;

  return (
    <section className="border-t border-border bg-secondary/20">
      <div className="container py-10 md:py-14">
        <div className="mb-6 max-w-3xl">
          <div className="src-label mb-2">{t("sparklines.kicker", "Category breakdown")}</div>
          <h2 className="text-xl md:text-2xl font-semibold tracking-tight">
            {t("sparklines.title", "How each category has moved over the last 24 months")}
          </h2>
          <p className="mt-2 text-[13.5px] leading-[1.6] text-muted-foreground">
            {t(
              "sparklines.subtitle",
              "Each panel shows monthly launches for one weapon family, anchored on the first and last completed month. Δ% compares start vs. end. Click a card to jump to its detail section.",
            )}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {valid.map((c) => (
            <CategoryCard key={c.id} input={c} window={window} />
          ))}
        </div>
      </div>
    </section>
  );
}
