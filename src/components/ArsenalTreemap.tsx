import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ResponsiveContainer, Treemap, Tooltip } from "recharts";
import { loadModelStats, type ModelStats } from "@/lib/model-stats";
import { rampColor } from "@/lib/threat-ramp";

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

interface Cell {
  name: string;
  size: number; // launched
  destroyed: number;
  rate: number; // 0..1
}

/** Friendlier display labels for the messier raw dataset model strings. */
function prettyName(raw: string): string {
  return raw
    .replace(/\s+and\s+/gi, " + ")
    .replace(/^X-/, "Kh-")
    .replace(/\bX-/g, "Kh-");
}

interface Props {
  /** Max systems to show in the treemap. Tail is summarised as "Other". */
  topN?: number;
  /** Click handler — used to filter the catalog table below. */
  onSelect?: (modelName: string | null) => void;
  /** Currently selected model name (for visual highlight). */
  selected?: string | null;
}

/**
 * Treemap of weapon systems by total launches across the full dataset.
 * Tile size = launches; tile color = interception rate (red = low, amber =
 * medium, green = high), using the muted operational palette.
 */
export function ArsenalTreemap({ topN = 12, onSelect, selected }: Props) {
  const { t } = useTranslation();
  const [stats, setStats] = useState<Map<string, ModelStats> | null>(null);

  useEffect(() => {
    loadModelStats().then(setStats).catch(() => setStats(new Map()));
  }, []);

  const { cells, total } = useMemo(() => {
    if (!stats) return { cells: [] as Cell[], total: 0 };
    const all: Cell[] = [];
    for (const [name, s] of stats) {
      if (!s.launched) continue;
      all.push({
        name: prettyName(name),
        size: s.launched,
        destroyed: s.destroyed,
        rate: s.rate,
      });
    }
    all.sort((a, b) => b.size - a.size);
    const head = all.slice(0, topN);
    const tail = all.slice(topN);
    if (tail.length) {
      const tLaunched = tail.reduce((s, c) => s + c.size, 0);
      const tDestroyed = tail.reduce((s, c) => s + c.destroyed, 0);
      head.push({
        name: t("treemap.other", "Other systems"),
        size: tLaunched,
        destroyed: tDestroyed,
        rate: tLaunched > 0 ? tDestroyed / tLaunched : 0,
      });
    }
    const total = all.reduce((s, c) => s + c.size, 0);
    return { cells: head, total };
  }, [stats, topN, t]);

  /** Treemap color: green (high intercept rate) → amber → red (low). */
  const tileColor = (rate: number) => rampColor(1 - rate, 0.85);

  if (!stats) {
    return (
      <div className="h-[320px] w-full animate-pulse rounded-sm border border-dashed border-border bg-card/40" />
    );
  }
  if (!cells.length) {
    return (
      <div className="rounded-sm border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        {t("treemap.empty", "No launch data available yet.")}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <div className="src-label mb-1">{t("treemap.kicker", "Arsenal composition")}</div>
          <h3 className="text-base font-semibold tracking-tight md:text-lg">
            {t("treemap.title", "Top systems by total launches")}
          </h3>
          <p className="mt-1 text-[12.5px] leading-[1.55] text-muted-foreground">
            {t(
              "treemap.subtitle",
              "Tile size = total launches across the recorded period. Colour = interception rate (green = mostly destroyed, red = mostly leaked).",
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
          <span>low intercept</span>
          <span
            aria-hidden
            className="h-2 w-24 rounded-full"
            style={{
              background:
                "linear-gradient(90deg, hsl(0 78% 38%), hsl(28 92% 55%), hsl(48 95% 78%))",
            }}
          />
          <span>high intercept</span>
        </div>
      </div>

      <div className="h-[360px] w-full rounded-sm border border-border bg-card">
        <ResponsiveContainer width="100%" height="100%">
          <Treemap
            data={cells}
            dataKey="size"
            stroke="hsl(var(--background))"
            isAnimationActive={false}
            content={
              <TreemapTile
                total={total}
                colorFn={tileColor}
                selected={selected ?? null}
                onSelect={onSelect}
              />
            }
          >
            <Tooltip content={<TreemapTooltip total={total} />} />
          </Treemap>
        </ResponsiveContainer>
      </div>

      <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        {t("treemap.foot", "Source: missile_attacks_daily.csv (Kaggle, daily-synced).")}
        {selected && (
          <button
            type="button"
            onClick={() => onSelect?.(null)}
            className="ml-2 rounded-sm border border-border bg-secondary px-2 py-0.5 text-foreground transition-colors hover:bg-foreground hover:text-background"
          >
            {t("treemap.clearFilter", "Clear filter ✕")}
          </button>
        )}
      </div>
    </div>
  );
}

interface TileProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  index?: number;
  name?: string;
  size?: number;
  destroyed?: number;
  rate?: number;
  total: number;
  colorFn: (rate: number) => string;
  selected: string | null;
  onSelect?: (name: string | null) => void;
}

function TreemapTile(props: TileProps) {
  const {
    x = 0,
    y = 0,
    width = 0,
    height = 0,
    name = "",
    size = 0,
    rate = 0,
    total,
    colorFn,
    selected,
    onSelect,
  } = props;
  if (width <= 0 || height <= 0) return null;

  const fill = colorFn(rate);
  const isSelected = !!selected && selected === name;
  const showName = width > 48 && height > 28;
  const showValue = width > 64 && height > 46;
  const showShare = width > 96 && height > 64;
  const pct = total > 0 ? (size / total) * 100 : 0;

  // Pick legible text colour based on tile lightness (dark text on light tiles).
  const isLightTile = rate > 0.55; // amber/yellow region
  const textFill = isLightTile ? "hsl(0 0% 8%)" : "hsl(0 0% 98%)";
  const subFill = isLightTile ? "hsl(0 0% 8% / 0.7)" : "hsl(0 0% 98% / 0.75)";

  return (
    <g
      onClick={() => onSelect?.(name)}
      style={{ cursor: onSelect ? "pointer" : "default" }}
    >
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        style={{
          fill,
          stroke: isSelected ? "hsl(var(--foreground))" : "hsl(var(--background))",
          strokeWidth: isSelected ? 2 : 1,
        }}
      />
      {showName && (
        <text
          x={x + 8}
          y={y + 16}
          fill={textFill}
          style={{
            fontFamily: "var(--font-mono, ui-monospace)",
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            pointerEvents: "none",
          }}
        >
          {name.length > Math.max(8, Math.floor(width / 7))
            ? `${name.slice(0, Math.max(6, Math.floor(width / 7) - 1))}…`
            : name}
        </text>
      )}
      {showValue && (
        <text
          x={x + 8}
          y={y + 36}
          fill={textFill}
          style={{
            fontFamily: "var(--font-mono, ui-monospace)",
            fontSize: Math.min(20, Math.max(13, Math.floor(width / 10))),
            fontWeight: 700,
            pointerEvents: "none",
          }}
        >
          {fmt(size)}
        </text>
      )}
      {showShare && (
        <text
          x={x + 8}
          y={y + 52}
          fill={subFill}
          style={{
            fontFamily: "var(--font-mono, ui-monospace)",
            fontSize: 10,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            pointerEvents: "none",
          }}
        >
          {pct.toFixed(1)}% · {(rate * 100).toFixed(0)}% intercept
        </text>
      )}
    </g>
  );
}

function TreemapTooltip({ active, payload, total }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload as Cell;
  if (!d) return null;
  const share = total > 0 ? (d.size / total) * 100 : 0;
  return (
    <div className="rounded-sm border border-border bg-card px-3 py-2 shadow-md">
      <div className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
        {d.name}
      </div>
      <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5 text-[12px]">
        <span className="text-muted-foreground">Launched</span>
        <span className="num text-right text-foreground">{fmt(d.size)}</span>
        <span className="text-muted-foreground">Destroyed</span>
        <span className="num text-right text-foreground">{fmt(d.destroyed)}</span>
        <span className="text-muted-foreground">Intercept rate</span>
        <span className="num text-right text-foreground">
          {(d.rate * 100).toFixed(1)}%
        </span>
        <span className="text-muted-foreground">Share of arsenal</span>
        <span className="num text-right text-foreground">{share.toFixed(1)}%</span>
      </div>
    </div>
  );
}
