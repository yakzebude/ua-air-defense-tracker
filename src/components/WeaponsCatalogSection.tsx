import { useEffect, useMemo, useState } from "react";
import { Search, ArrowUpDown, ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { loadWeaponsCatalog, type Weapon } from "@/lib/weapons-catalog";
import { loadModelStats, lookupModelStats, type ModelStats } from "@/lib/model-stats";
import { Skeleton } from "@/components/ui/skeleton";
import { Panel } from "@/components/ui/panel";
import { ArsenalTreemap } from "@/components/ArsenalTreemap";

const fmt = (n: number) => n.toLocaleString("en-US");
const COLLAPSED_ROWS = 5;

type SortKey = "model" | "category" | "national_origin" | "in_sevice" | "unit_cost";

export function WeaponsCatalogSection() {
  const { t } = useTranslation();
  const [weapons, setWeapons] = useState<Weapon[] | null>(null);
  const [stats, setStats] = useState<Map<string, ModelStats> | null>(null);
  const [cat, setCat] = useState<string>("all");
  const [origin, setOrigin] = useState<string>("all");
  const [q, setQ] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("model");
  const [sortAsc, setSortAsc] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [treemapFilter, setTreemapFilter] = useState<string | null>(null);

  useEffect(() => {
    loadWeaponsCatalog().then(setWeapons).catch(() => setWeapons([]));
    loadModelStats().then(setStats).catch(() => setStats(new Map()));
  }, []);

  useEffect(() => { setExpanded(false); }, [cat, origin, q]);

  const CATEGORIES = [
    { key: "all", label: t("arsenal.all") },
    { key: "UAV", label: t("arsenal.uavs") },
    { key: "cruise missile", label: t("arsenal.cruise") },
    { key: "ballistic missile", label: t("arsenal.ballistic") },
    { key: "surface-to-air missile", label: t("arsenal.sam") },
    { key: "guided bomb", label: t("arsenal.guidedBombs") },
  ];

  const origins = useMemo(() => {
    if (!weapons) return [];
    const s = new Set<string>();
    weapons.forEach((w) => w.national_origin && s.add(w.national_origin));
    return ["all", ...Array.from(s).sort()];
  }, [weapons]);

  const filtered = useMemo(() => {
    if (!weapons) return [];
    const needle = q.trim().toLowerCase();
    // Treemap-driven token filter: split on non-alphanumerics and require any
    // significant token to appear in the weapon's name/model/type fields.
    const tmTokens = treemapFilter
      ? treemapFilter
          .toLowerCase()
          .split(/[\s/+,()]+/)
          .filter((tok) => tok.length >= 3)
      : [];
    const arr = weapons.filter((w) => {
      if (cat !== "all" && w.category !== cat) return false;
      if (origin !== "all" && w.national_origin !== origin) return false;
      if (tmTokens.length) {
        const hay = [w.model, w.name, w.name_NATO, w.type].join(" ").toLowerCase();
        if (!tmTokens.some((tok) => hay.includes(tok))) return false;
      }
      if (!needle) return true;
      return [w.model, w.name, w.name_NATO, w.type, w.manufacturer, w.designer]
        .some((v) => v.toLowerCase().includes(needle));
    });
    const getKey = (w: Weapon) =>
      sortKey === "model"
        ? (w.name || w.model || "").toLowerCase()
        : (w[sortKey] || "").toString().toLowerCase();
    return arr.sort((a, b) =>
      getKey(a).localeCompare(getKey(b), "en", { numeric: true }) * (sortAsc ? 1 : -1),
    );
  }, [weapons, cat, origin, q, sortKey, sortAsc, treemapFilter]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortAsc((v) => !v);
    else { setSortKey(k); setSortAsc(true); }
  };

        <div className="mb-6 rounded-sm border border-border bg-card/60 p-5">
          <ArsenalTreemap
            selected={treemapFilter}
            onSelect={(name) => setTreemapFilter(name)}
          />
        </div>


  return (
    <section id="arsenal" className="scroll-mt-32 border-t border-border">
      <div className="container py-8 md:py-10">
        <div className="mb-6 max-w-3xl">
          <div className="src-label mb-3">{t("arsenal.kicker")}</div>
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">
            {t("arsenal.title")}
          </h2>
          <p className="mt-3 text-[14px] leading-[1.65] text-muted-foreground">
            {t("arsenal.intro")}
          </p>
        </div>

        <Panel source={t("arsenal.source")} note={t("arsenal.note")}>
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap gap-1">
              {CATEGORIES.map((c) => {
                const active = cat === c.key;
                return (
                  <button
                    key={c.key}
                    onClick={() => setCat(c.key)}
                    className={`rounded-sm border px-2.5 py-1 text-[11px] font-mono uppercase tracking-[0.14em] transition-colors ${
                      active
                        ? "border-foreground bg-foreground text-background"
                        : "border-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground"
                    }`}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
              <select
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                className="min-w-0 flex-1 rounded-sm border border-border bg-card px-2 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-foreground sm:flex-none"
              >
                {origins.map((o) => (
                  <option key={o} value={o}>{o === "all" ? t("arsenal.allOrigins") : o}</option>
                ))}
              </select>
              <div className="relative min-w-0 flex-1 sm:w-56 sm:flex-none">
                <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder={t("arsenal.search")}
                  className="w-full rounded-sm border border-border bg-card py-1.5 pl-7 pr-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-foreground/40"
                />
              </div>
            </div>
          </div>

          {!weapons ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-sm border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
              {t("arsenal.noMatch")}
            </div>
          ) : (
            <>
              <div className="src-label mb-2">
                {filtered.length} {filtered.length === 1 ? t("arsenal.system_one") : t("arsenal.system_other")}
                {!expanded && filtered.length > COLLAPSED_ROWS && (
                  <span> · {t("arsenal.showing")} {COLLAPSED_ROWS}</span>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="sticky top-0 z-10 bg-card">
                      <Th onClick={() => toggleSort("model")} active={sortKey === "model"} asc={sortAsc}>{t("arsenal.system")}</Th>
                      <Th onClick={() => toggleSort("category")} active={sortKey === "category"} asc={sortAsc}>{t("arsenal.category")}</Th>
                      <Th onClick={() => toggleSort("national_origin")} active={sortKey === "national_origin"} asc={sortAsc}>{t("arsenal.origin")}</Th>
                      <Th>{t("arsenal.launched")}</Th>
                      <Th>{t("arsenal.intercepted")}</Th>
                      <Th>{t("arsenal.rate")}</Th>
                      <Th onClick={() => toggleSort("in_sevice")} active={sortKey === "in_sevice"} asc={sortAsc}>{t("arsenal.inService")}</Th>
                      <Th>{t("arsenal.guidance")}</Th>
                      <Th onClick={() => toggleSort("unit_cost")} active={sortKey === "unit_cost"} asc={sortAsc}>{t("arsenal.unitCost")}</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {(expanded ? filtered : filtered.slice(0, COLLAPSED_ROWS)).map((w, i) => {
                      const ms = stats ? lookupModelStats(stats, w.model) : null;
                      return (
                        <tr key={w.model} className={`border-t border-border ${i % 2 === 1 ? "bg-secondary/40" : ""}`}>
                          <td className="px-3 py-2.5 align-top">
                            <div className="font-semibold text-foreground">{w.name || w.model}</div>
                            {w.name_NATO && (
                              <div className="src-label mt-0.5">{t("arsenal.natoPrefix")} {w.name_NATO}</div>
                            )}
                            <div className="src-label mt-0.5 text-muted-foreground/70">{w.type || ""}</div>
                          </td>
                          <td className="px-3 py-2.5 align-top text-muted-foreground">{w.category || "—"}</td>
                          <td className="px-3 py-2.5 align-top text-muted-foreground">{w.national_origin || "—"}</td>
                          <td className="px-3 py-2.5 align-top num text-foreground">{ms ? fmt(ms.launched) : "—"}</td>
                          <td className="px-3 py-2.5 align-top num text-muted-foreground">{ms ? fmt(ms.destroyed) : "—"}</td>
                          <td className="px-3 py-2.5 align-top num text-muted-foreground">
                            {ms && ms.launched > 0 ? `${(ms.rate * 100).toFixed(1)}%` : "—"}
                          </td>
                          <td className="px-3 py-2.5 align-top num text-muted-foreground">{w.in_sevice || "—"}</td>
                          <td className="px-3 py-2.5 align-top text-muted-foreground">{w.guidance_system || "—"}</td>
                          <td className="px-3 py-2.5 align-top num text-muted-foreground">{w.unit_cost || "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {filtered.length > COLLAPSED_ROWS && (
                <div className="mt-3 flex justify-center">
                  <button
                    onClick={() => setExpanded((v) => !v)}
                    className="inline-flex items-center gap-1.5 rounded-sm border border-border bg-card px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-foreground transition-colors hover:bg-secondary"
                  >
                    {expanded ? t("arsenal.showFewer") : t("arsenal.showAll", { n: filtered.length })}
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
                  </button>
                </div>
              )}
            </>
          )}
        </Panel>
      </div>
    </section>
  );
}

function Th({
  children,
  onClick,
  active,
  asc,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
  asc?: boolean;
}) {
  return (
    <th
      onClick={onClick}
      className={`border-b border-border px-3 py-2 text-left font-mono text-[10.5px] font-medium uppercase tracking-[0.14em] text-muted-foreground ${
        onClick ? "cursor-pointer select-none hover:text-foreground" : ""
      } ${active ? "text-foreground" : ""}`}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {onClick && <ArrowUpDown className={`h-3 w-3 ${active ? "opacity-100" : "opacity-30"}`} />}
        {active && <span className="text-[9px]">{asc ? "↑" : "↓"}</span>}
      </span>
    </th>
  );
}
