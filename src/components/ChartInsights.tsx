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

/** Extract the headline number out of an insight sentence so we can render it
 *  large and Bloomberg-like, with the prose acting as the explanatory caption. */
function splitInsight(ins: Insight): { value: string; caption: string } {
  // Match the first occurrence of a signed/percent/number token in the text.
  const m = ins.text.match(/([+\-]?\d[\d,]*(?:\.\d+)?\s*%?)/);
  if (!m) return { value: "", caption: ins.text };
  return { value: m[0].trim(), caption: ins.text };
}

/** Tiny diverging bar that visually anchors the magnitude of a finding.
 *  Width is mapped from the |percentage| component of the value when present,
 *  otherwise the bar collapses to a neutral tick. */
function MagnitudeBar({ value, tone }: { value: string; tone: Insight["tone"] }) {
  const num = parseFloat(value.replace(/[,%+\s]/g, ""));
  const pct = Number.isFinite(num) ? Math.min(Math.abs(num), 100) : 6;
  const negative = /^-/.test(value);
  const color =
    tone === "good"
      ? "hsl(var(--signal-ok))"
      : tone === "bad"
        ? "hsl(var(--signal))"
        : tone === "warn"
          ? "hsl(var(--signal-warn))"
          : "hsl(var(--foreground))";
  return (
    <div className="relative mt-2 h-[3px] w-full bg-border/60">
      <span
        aria-hidden
        className="absolute top-0 h-full"
        style={{
          left: negative ? `${50 - pct / 2}%` : "50%",
          width: `${pct / 2}%`,
          background: color,
        }}
      />
      <span
        aria-hidden
        className="absolute top-[-2px] h-[7px] w-px bg-foreground/60"
        style={{ left: "50%" }}
      />
    </div>
  );
}

/**
 * "Key Findings" panel — redesigned as a flat editorial grid.
 * No tinted blocks, no bullet next to the title; each finding is a
 * Bloomberg-style stat (label · large value · diverging magnitude bar
 * · caption) that lets the eye scan extremes at a glance.
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
      <header className="mb-5 flex items-baseline justify-between gap-3 border-b border-border/70 pb-3">
        <div>
          <div className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-foreground">
            {title}
          </div>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">{subtitle}</p>
        </div>
        <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          auto-generated
        </span>
      </header>

      <ol className="grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
        {insights.map((ins, i) => {
          const { value, caption } = splitInsight(ins);
          return (
            <li key={i} className="flex flex-col">
              <div className="flex items-center justify-between gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                <span>
                  {String(i + 1).padStart(2, "0")} · {ins.label}
                </span>
              </div>
              <div className="mt-1.5 flex items-baseline gap-2">
                <span className="font-mono text-[22px] leading-none tracking-tight text-foreground">
                  {value || "—"}
                </span>
              </div>
              <MagnitudeBar value={value} tone={ins.tone} />
              <p className="mt-2.5 text-[12.5px] leading-[1.55] text-muted-foreground">{caption}</p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
