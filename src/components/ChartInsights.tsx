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
  /** Accent colour for the sparkline (matches the parent series). */
  accent?: string;
}

/** Pull the headline number out of an insight sentence for the big stat.
 *  Strip "'NN" year tokens first so a year like '24 is never mistaken
 *  for the headline value. */
function splitInsight(ins: Insight): { value: string; caption: string } {
  const cleaned = ins.text.replace(/'\d{2}\b/g, "");
  const m = cleaned.match(/([+\-]?\d[\d,]*(?:\.\d+)?\s*%?)/);
  if (!m) return { value: "", caption: ins.text };
  return { value: m[0].trim(), caption: ins.text };
}

/** Map an insight back to one or two indices in the supplied series so the
 *  sparkline can highlight exactly the months the finding refers to.
 *  Matches the project's label format ("May '24"). */
function highlightIndices(
  ins: Insight,
  series: MonthPoint[],
): { primary: number | null; secondary: number | null } {
  const labels = series.map((m) => m.label);
  // "May '24" — three-letter month + apostrophe + two-digit year.
  const tokens = ins.text.match(/[A-Z][a-z]{2}\s+'\d{2}/g) ?? [];
  const idxs = tokens
    .map((tok) => labels.findIndex((l) => l === tok))
    .filter((i) => i >= 0);
  return {
    primary: idxs[0] ?? null,
    secondary: idxs[1] ?? null,
  };
}

/** Mini bar-sparkline of the whole series; the months the finding refers to
 *  are highlighted in a darker neutral gray so the eye locks onto them
 *  without competing with the category colour used elsewhere on the page.
 *  When a finding compares two months (e.g. largest jump/drop), BOTH bars
 *  are coloured equally. */
function Sparkline({
  series,
  values,
  primary,
  secondary,
}: {
  series: MonthPoint[];
  values: number[];
  primary: number | null;
  secondary: number | null;
}) {
  const max = Math.max(1, ...values);
  const baseBg = "hsl(var(--muted-foreground) / 0.18)";
  const hiBg = "hsl(var(--muted-foreground) / 0.85)";
  return (
    <div className="mt-2 flex h-10 items-end gap-[1px]" aria-hidden>
      {values.map((v, i) => {
        const h = (Math.max(v, 0) / max) * 100;
        const isHi = i === primary || i === secondary;
        return (
          <div
            key={i}
            className="flex-1"
            style={{
              height: `${Math.max(h, 2)}%`,
              background: isHi ? hiBg : baseBg,
              minWidth: 2,
            }}
            title={`${series[i]?.label ?? ""}: ${v.toLocaleString("en-US")}`}
          />
        );
      })}
    </div>
  );
}

/**
 * Key Findings — each card now shows the underlying time series as a
 * miniature bar sparkline with the months the finding references picked
 * out in the category accent colour. The static "magnitude bar" is gone:
 * the reader can see the actual shape of the data behind every claim.
 */
export function ChartInsights({
  data,
  metric = "launched",
  unit = "weapons",
  direction = "down-is-good",
  title = "Key findings",
  subtitle = "Generated automatically from the selected time range.",
  accent = "hsl(48 95% 55%)",
}: Props) {
  // Only consider months that are fully closed (i.e. the calendar month is
  // entirely in the past). The current, partial month would otherwise show
  // up as a misleading "low" / "biggest drop" in the findings.
  const completeData = useMemo(() => {
    const now = new Date();
    const cutoff = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
    return data.filter((m) => m.date.getTime() < cutoff);
  }, [data]);

  const insights = useMemo(() => {
    const all = computeMonthlyInsights(completeData, { metric, unit, direction });
    const wanted = ["Peak month", "Largest drop", "Largest jump"];
    return wanted
      .map((label) => all.find((i) => i.label === label))
      .filter((i): i is NonNullable<typeof i> => Boolean(i));
  }, [completeData, metric, unit, direction]);

  // Build the series values that the spark uses (matches the metric).
  const series = useMemo(
    () => completeData.filter((m) => m.launched > 0 || metric === "rate"),
    [completeData, metric],
  );
  const values = useMemo(() => {
    return series.map((m) => {
      switch (metric) {
        case "launched":  return m.launched;
        case "destroyed": return m.destroyed;
        case "rate":      return Math.round(m.rate * 100);
        case "reached":   return Math.max(m.launched - m.destroyed, 0);
      }
    });
  }, [series, metric]);

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
          const { primary, secondary } = highlightIndices(ins, series);
          // Color logic: red on increase, green on 0 or decrease (remove yellow).
          // Peak month for interception-rate charts is a Ukrainian success → green.
          // Largest drop on launch charts stays white (not red).
          const isLaunchChart =
            metric === "launched" &&
            (unit === "UAVs" ||
              unit === "cruise missiles" ||
              unit === "ballistic missiles");
          const valueColor =
            ins.label === "Largest drop" && !isLaunchChart
              ? "hsl(var(--signal))"
              : ins.label === "Largest drop"
                ? "hsl(var(--foreground))"
                : ins.label === "Peak month" && metric === "rate"
                  ? "hsl(var(--signal-ok))"
                  : ins.tone === "bad" || ins.tone === "warn"
                    ? "hsl(var(--signal))"
                    : ins.tone === "good" || ins.tone === "neutral"
                      ? "hsl(var(--signal-ok))"
                      : "hsl(var(--foreground))";
          // Always lead with the month abbreviation in front of the year, and
          // show BOTH months when the finding compares two of them.
          const monthTag =
            primary !== null && secondary !== null
              ? `${series[primary]?.label} → ${series[secondary]?.label}`
              : primary !== null
                ? series[primary]?.label
                : null;
          return (
            <li key={i} className="flex flex-col">
              <div className="flex items-center justify-between gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                <span>
                  {String(i + 1).padStart(2, "0")} · {ins.label}
                </span>
                {monthTag && (
                  <span className="tabular-nums text-muted-foreground/80">
                    {monthTag}
                  </span>
                )}
              </div>
              <div className="mt-1.5 flex items-baseline gap-2">
                <span
                  className="font-mono text-[22px] leading-none tracking-tight"
                  style={{ color: value ? valueColor : "hsl(var(--foreground))" }}
                >
                  {value || "—"}
                </span>
              </div>
              <Sparkline
                series={series}
                values={values}
                primary={primary}
                secondary={secondary}
              />
              <p className="mt-2.5 text-[12.5px] leading-[1.55] text-muted-foreground">{caption}</p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
