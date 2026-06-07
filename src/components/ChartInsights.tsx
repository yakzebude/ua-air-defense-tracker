import { useMemo } from "react";
import type { MonthPoint } from "@/lib/shahed-data";
import { computeMonthlyInsights, type Insight } from "@/lib/chart-insights";

interface Props {
  data: MonthPoint[];
  metric?: "launched" | "destroyed" | "rate" | "reached";
  unit?: string;
  direction?: "up-is-good" | "down-is-good";
  title?: string;
  subtitle?: string;
}

const TONE_CLASS: Record<Insight["tone"], string> = {
  good:    "text-[hsl(var(--signal-ok))]",
  bad:     "text-[hsl(var(--signal))]",
  warn:    "text-[hsl(var(--signal-warn))]",
  neutral: "text-muted-foreground",
};

/**
 * "Key Findings" card. Renders auto-generated, plain-language observations
 * about the supplied monthly time-series. Designed to sit directly under a
 * chart so visitors get the analytical story without interpreting axes.
 */
export function ChartInsights({
  data,
  metric = "launched",
  unit = "weapons",
  direction = "down-is-good",
  title = "Key findings",
  subtitle = "Generated automatically from the selected time range.",
}: Props) {
  const insights = useMemo(
    () => computeMonthlyInsights(data, { metric, unit, direction }),
    [data, metric, unit, direction],
  );

  if (!insights.length) return null;

  return (
    <aside
      className="mt-4 rounded-sm border border-border bg-card/60 p-4 md:p-5"
      aria-label={title}
    >
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <div className="flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.18em] text-foreground">
          <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-foreground" />
          <span>{title}</span>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          auto-generated
        </span>
      </div>
      <p className="mb-3 text-[12.5px] leading-relaxed text-muted-foreground">{subtitle}</p>
      <ul className="space-y-2.5">
        {insights.map((ins, i) => (
          <li key={i} className="flex items-start gap-2.5 text-[13px] leading-[1.55]">
            <span
              aria-hidden
              className={`mt-[2px] inline-flex h-4 w-4 shrink-0 items-center justify-center text-[12px] ${TONE_CLASS[ins.tone]}`}
            >
              {ins.icon}
            </span>
            <span>
              <span className="mr-1.5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
                {ins.label}
              </span>
              <span className="text-foreground">{ins.text}</span>
            </span>
          </li>
        ))}
      </ul>
    </aside>
  );
}
