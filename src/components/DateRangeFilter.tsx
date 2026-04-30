import { useMemo } from "react";
import { Slider } from "@/components/ui/slider";
import type { MonthPoint } from "@/lib/shahed-data";

interface Props {
  months: MonthPoint[];
  range: [number, number];
  onChange: (r: [number, number]) => void;
}

export function DateRangeFilter({ months, range, onChange }: Props) {
  const [from, to] = range;
  const fromLabel = months[from]?.label ?? "";
  const toLabel = months[to]?.label ?? "";

  // Index 0 = Oct 2022. 2022 covers Oct–Dec (3 months), then full years.
  const presets = useMemo(
    () => [
      { name: "All time", from: 0, to: months.length - 1 },
      { name: "2022", from: 0, to: 2 },
      { name: "2023", from: 3, to: 14 },
      { name: "2024", from: 15, to: 26 },
      { name: "2025", from: 27, to: 38 },
      { name: "2026", from: 39, to: months.length - 1 },
    ],
    [months.length],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Date range
          </div>
          <div className="mt-1 font-serif text-xl num">
            {fromLabel} <span className="text-muted-foreground">→</span> {toLabel}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {presets.map((p) => {
            const active = p.from === from && p.to === to;
            return (
              <button
                key={p.name}
                onClick={() => onChange([p.from, p.to])}
                className={`rounded-sm border px-3 py-1 text-xs font-medium transition-colors ${
                  active
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-card text-foreground hover:bg-secondary"
                }`}
              >
                {p.name}
              </button>
            );
          })}
        </div>
      </div>
      <Slider
        min={0}
        max={months.length - 1}
        step={1}
        value={[from, to]}
        onValueChange={(v) => onChange([v[0], v[1]] as [number, number])}
        className="w-full"
      />
      <div className="flex justify-between text-[11px] text-muted-foreground num">
        <span>Oct '22</span>
        <span>Mar '26</span>
      </div>
    </div>
  );
}
