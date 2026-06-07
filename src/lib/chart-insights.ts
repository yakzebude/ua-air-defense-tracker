import type { MonthPoint } from "@/lib/shahed-data";

export type InsightTone = "neutral" | "good" | "bad" | "warn";

export interface Insight {
  icon: string;          // ▲ ▼ ● ★ ⚠
  tone: InsightTone;
  label: string;         // short tag, e.g. "Peak month"
  text: string;          // plain-language sentence
}

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

/**
 * Generate 3–5 plain-language observations from a monthly time-series.
 * `metric` is what the y-axis represents in natural language ("launches",
 * "interception rate", …). `direction` decides whether a rise is good or bad.
 */
export function computeMonthlyInsights(
  data: MonthPoint[],
  opts: {
    metric: "launched" | "destroyed" | "rate" | "reached";
    unit?: string;
    direction?: "up-is-good" | "down-is-good";
  },
): Insight[] {
  const { metric, unit = "weapons", direction = "down-is-good" } = opts;
  if (!data || data.length < 2) return [];

  const valueOf = (m: MonthPoint): number => {
    switch (metric) {
      case "launched":  return m.launched;
      case "destroyed": return m.destroyed;
      case "rate":      return m.rate * 100;
      case "reached":   return Math.max(m.launched - m.destroyed, 0);
    }
  };
  const unitLabel = metric === "rate" ? "%" : ` ${unit}`;

  // Exclude empty leading months for the trend story.
  const points = data.filter((m) => m.launched > 0 || metric === "rate");
  if (points.length < 2) return [];

  // Peak / trough
  let peak = points[0], trough = points[0];
  for (const p of points) {
    if (valueOf(p) > valueOf(peak)) peak = p;
    if (valueOf(p) < valueOf(trough)) trough = p;
  }

  // MoM deltas (skip current incomplete month already filtered upstream).
  let biggestUp: { from: MonthPoint; to: MonthPoint; pct: number } | null = null;
  let biggestDown: { from: MonthPoint; to: MonthPoint; pct: number } | null = null;
  for (let i = 1; i < points.length; i++) {
    const a = valueOf(points[i - 1]);
    const b = valueOf(points[i]);
    if (!a) continue;
    const pct = ((b - a) / a) * 100;
    if (!Number.isFinite(pct)) continue;
    if (!biggestUp || pct > biggestUp.pct) biggestUp = { from: points[i - 1], to: points[i], pct };
    if (!biggestDown || pct < biggestDown.pct) biggestDown = { from: points[i - 1], to: points[i], pct };
  }

  // 90-day window vs prior 90-day (≈ last 3 months vs prior 3).
  const recent = points.slice(-3);
  const prior  = points.slice(-6, -3);
  const sumV = (arr: MonthPoint[]) => arr.reduce((s, m) => s + valueOf(m), 0);
  const avgV = (arr: MonthPoint[]) => (arr.length ? sumV(arr) / arr.length : 0);
  const r90 = avgV(recent);
  const p90 = avgV(prior);
  const trend90 =
    prior.length && p90 ? ((r90 - p90) / p90) * 100 : null;

  // Long-term: first-half vs second-half average.
  const half = Math.floor(points.length / 2);
  const firstAvg = avgV(points.slice(0, half));
  const secondAvg = avgV(points.slice(half));
  const longTerm =
    firstAvg ? ((secondAvg - firstAvg) / firstAvg) * 100 : null;

  const goodIfDown = direction === "down-is-good";
  const toneOf = (delta: number): InsightTone => {
    if (Math.abs(delta) < 1) return "neutral";
    const rising = delta > 0;
    const good = goodIfDown ? !rising : rising;
    return good ? "good" : "bad";
  };

  const out: Insight[] = [];

  out.push({
    icon: "★",
    tone: "warn",
    label: "Peak month",
    text: `Highest recorded ${metric === "rate" ? "interception rate" : "monthly volume"} was in ${peak.label} at ${fmt(valueOf(peak))}${unitLabel}.`,
  });

  out.push({
    icon: "●",
    tone: "neutral",
    label: "Lowest month",
    text: `Lowest value in the series was ${trough.label} at ${fmt(valueOf(trough))}${unitLabel}.`,
  });

  if (biggestUp && biggestUp.pct > 1) {
    out.push({
      icon: "▲",
      tone: toneOf(biggestUp.pct),
      label: "Largest jump",
      text: `Biggest month-over-month increase: ${biggestUp.from.label} → ${biggestUp.to.label}, +${biggestUp.pct.toFixed(1)}%.`,
    });
  }
  if (biggestDown && biggestDown.pct < -1) {
    out.push({
      icon: "▼",
      tone: toneOf(biggestDown.pct),
      label: "Largest drop",
      text: `Biggest month-over-month decrease: ${biggestDown.from.label} → ${biggestDown.to.label}, ${biggestDown.pct.toFixed(1)}%.`,
    });
  }

  if (trend90 !== null && Math.abs(trend90) >= 2) {
    out.push({
      icon: trend90 > 0 ? "▲" : "▼",
      tone: toneOf(trend90),
      label: "90-day trend",
      text: `Average over the last 3 months is ${trend90 > 0 ? "up" : "down"} ${Math.abs(trend90).toFixed(1)}% versus the previous 3 months.`,
    });
  }

  if (longTerm !== null && Math.abs(longTerm) >= 5 && out.length < 5) {
    out.push({
      icon: longTerm > 0 ? "▲" : "▼",
      tone: toneOf(longTerm),
      label: "Long-term trend",
      text: `Second-half average is ${longTerm > 0 ? "higher" : "lower"} than the first-half average by ${Math.abs(longTerm).toFixed(1)}%.`,
    });
  }

  return out.slice(0, 5);
}
