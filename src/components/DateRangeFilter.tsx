import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Slider } from "@/components/ui/slider";
import type { MonthPoint } from "@/lib/shahed-data";

interface Props {
  months: MonthPoint[];
  range: [number, number];
  onChange: (r: [number, number]) => void;
}

export function DateRangeFilter({ months, range, onChange }: Props) {
  const { t } = useTranslation();
  const [from, to] = range;
  const fromLabel = months[from]?.label ?? "";
  const toLabel = months[to]?.label ?? "";

  const presets = useMemo(
    () => [
      { name: t("dateRange.all"), from: 0, to: months.length - 1 },
    ],
    [months.length, t],
  );


  return (
    <div className="space-y-3 rounded-sm border border-border bg-card p-4 md:p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="src-label">{t("dateRange.label")}</div>
          <div className="mt-1 num text-[15px] font-semibold text-foreground">
            {fromLabel} <span className="text-muted-foreground">→</span> {toLabel}
          </div>
        </div>
        <div className="flex flex-wrap gap-1">
          {presets.map((p) => {
            const active = p.from === from && p.to === to;
            return (
              <button
                key={p.name}
                onClick={() => onChange([p.from, p.to])}
                className={`rounded-sm border px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.14em] transition-colors ${
                  active
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground"
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
    </div>
  );
}
