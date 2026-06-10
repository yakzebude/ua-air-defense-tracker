interface StatProps {
  label: string;
  value: string;
  sub?: string;
  accent?: "launched" | "destroyed" | "rate";
}

function Stat({ label, value, sub, accent }: StatProps) {
  const accentClass =
    accent === "launched"
      ? "before:bg-series-launched"
      : accent === "destroyed"
        ? "before:bg-series-destroyed"
        : accent === "rate"
          ? "before:bg-series-rate"
          : "before:bg-foreground";

  return (
    <div
      className={`relative pl-4 before:absolute before:left-0 before:top-1 before:h-[calc(100%-0.25rem)] before:w-[3px] ${accentClass}`}
    >
      <div className="stat-label uppercase">
        {label}
      </div>
      <div className="mt-2 stat-value text-[32px] md:text-[40px] md:leading-[44px]">{value}</div>
      {sub && <div className="mt-2 t-caption text-muted-foreground num">{sub}</div>}
    </div>
  );
}

interface Props {
  launched: number;
  destroyed: number;
  rate: number;
  rangeLabel: string;
}

const fmt = (n: number) => n.toLocaleString("en-US");

export function SummaryStats({ launched, destroyed, rate, rangeLabel }: Props) {
  const survived = Math.max(launched - destroyed, 0);
  return (
    <div className="border-y border-border bg-card/40 py-8 md:py-10">
      <div className="container">
        <div className="mb-6 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Summary · {rangeLabel}
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-8 md:grid-cols-4">
          <Stat label="Launched" value={fmt(launched)} accent="launched" sub="drones & missiles" />
          <Stat label="Destroyed" value={fmt(destroyed)} accent="destroyed" sub="confirmed interceptions" />
          <Stat
            label="Interception rate"
            value={`${(rate * 100).toFixed(1)}%`}
            accent="rate"
            sub={`${fmt(destroyed)} of ${fmt(launched)}`}
          />
          <Stat
            label="Reached target area"
            value={fmt(survived)}
            sub={`${(((survived) / Math.max(launched, 1)) * 100).toFixed(1)}% of launches`}
          />
        </div>
      </div>
    </div>
  );
}
