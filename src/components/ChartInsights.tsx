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

const TONE_BG: Record<Insight["tone"], string> = {
  good:    "bg-[hsl(var(--signal-ok)/0.08)] border-[hsl(var(--signal-ok)/0.35)]",
  bad:     "bg-[hsl(var(--signal)/0.08)] border-[hsl(var(--signal)/0.35)]",
  warn:    "bg-[hsl(var(--signal-warn)/0.08)] border-[hsl(var(--signal-warn)/0.35)]",
  neutral: "bg-card border-border",
};

const TONE_TEXT: Record<Insight["tone"], string> = {
  good:    "text-[hsl(var(--signal-ok))]",
  bad:     "text-[hsl(var(--signal))]",
  warn:    "text-[hsl(var(--signal-warn))]",
  neutral: "text-muted-foreground",
};

/**
 * "Key Findings" panel — now rendered as a grid of tone-coloured cards so
 * each finding reads as a self-contained insight tile rather than a bullet
 * list. The icon + label sit in a coloured header strip; the body uses the
 * full card width for readability.
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
    <section
      className="mt-4 rounded-sm border border-border bg-card/60 p-4 md:p-5"
      aria-label={title}
    >
      <header className="mb-4 flex items-baseline justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.18em] text-foreground">
            <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-foreground" />
            <span>{title}</span>
          </div>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">{subtitle}</p>
        </div>
        <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          auto-generated
        </span>
      </header>

      <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {insights.map((ins, i) => (
          <li
            key={i}
            className={`flex flex-col gap-2 rounded-sm border p-3.5 ${TONE_BG[ins.tone]}`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                {String(i + 1).padStart(2, "0")} · {ins.label}
              </span>
              <span aria-hidden className={`text-[14px] leading-none ${TONE_TEXT[ins.tone]}`}>
                {ins.icon}
              </span>
            </div>
            <p className="text-[13.5px] leading-[1.55] text-foreground">{ins.text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
