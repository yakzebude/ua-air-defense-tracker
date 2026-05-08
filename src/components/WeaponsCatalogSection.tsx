import { useEffect, useMemo, useState } from "react";
import { Search, ArrowUpDown, ChevronDown } from "lucide-react";
import { loadWeaponsCatalog, type Weapon } from "@/lib/weapons-catalog";
import { loadModelStats, lookupModelStats, type ModelStats } from "@/lib/model-stats";
import { Skeleton } from "@/components/ui/skeleton";
import { Panel } from "@/components/ui/panel";

const fmt = (n: number) => n.toLocaleString("en-US");
const COLLAPSED_ROWS = 5;

const CATEGORIES = [
  { key: "all", label: "All" },
  { key: "UAV", label: "UAVs" },
  { key: "cruise missile", label: "Cruise" },
  { key: "ballistic missile", label: "Ballistic" },
  { key: "surface-to-air missile", label: "SAM" },
  { key: "guided bomb", label: "Guided bombs" },
];

type SortKey = "model" | "category" | "national_origin" | "in_sevice" | "unit_cost";

export function WeaponsCatalogSection() {
  const [weapons, setWeapons] = useState<Weapon[] | null>(null);
  const [cat, setCat] = useState<string>("all");
  const [origin, setOrigin] = useState<string>("all");
  const [q, setQ] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("model");
  const [sortAsc, setSortAsc] = useState(true);

  useEffect(() => {
    loadWeaponsCatalog().then(setWeapons).catch(() => setWeapons([]));
  }, []);

  const origins = useMemo(() => {
    if (!weapons) return [];
    const s = new Set<string>();
    weapons.forEach((w) => w.national_origin && s.add(w.national_origin));
    return ["all", ...Array.from(s).sort()];
  }, [weapons]);

  const filtered = useMemo(() => {
    if (!weapons) return [];
    const needle = q.trim().toLowerCase();
    const arr = weapons.filter((w) => {
      if (cat !== "all" && w.category !== cat) return false;
      if (origin !== "all" && w.national_origin !== origin) return false;
      if (!needle) return true;
      return [w.model, w.name, w.name_NATO, w.type, w.manufacturer, w.designer]
        .some((v) => v.toLowerCase().includes(needle));
    });
    return arr.sort((a, b) => {
      const av = (a[sortKey] || "").toString().toLowerCase();
      const bv = (b[sortKey] || "").toString().toLowerCase();
      if (av === bv) return 0;
      return (av < bv ? -1 : 1) * (sortAsc ? 1 : -1);
    });
  }, [weapons, cat, origin, q, sortKey, sortAsc]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortAsc((v) => !v);
    else { setSortKey(k); setSortAsc(true); }
  };

  return (
    <section id="arsenal" className="scroll-mt-24 border-t border-border">
      <div className="container py-12 md:py-16">
        <div className="mb-6 max-w-3xl">
          <div className="src-label mb-2">Arsenal · weapon catalog</div>
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">
            Russian weapon systems used against Ukraine
          </h2>
          <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
            Reference profiles for UAVs, cruise, ballistic, SAM and guided-bomb systems
            tracked in the dataset. Filter by category, origin or search by model, NATO
            designation or manufacturer. Profiles are reference-only and may contain
            inaccuracies.
          </p>
        </div>

        <Panel
          source="Open-source reference data, compiled internally; cross-checked against CSIS Missile Threat and public sources"
          note="Reference data — figures such as unit cost and service entry are estimates and may vary by source."
        >
          {/* Controls */}
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
            <div className="flex items-center gap-2">
              <select
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                className="rounded-sm border border-border bg-card px-2 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-foreground"
              >
                {origins.map((o) => (
                  <option key={o} value={o}>{o === "all" ? "All origins" : o}</option>
                ))}
              </select>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search model, NATO name…"
                  className="w-56 rounded-sm border border-border bg-card py-1.5 pl-7 pr-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-foreground/40"
                />
              </div>
            </div>
          </div>

          {/* Table */}
          {!weapons ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-sm border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
              No systems match these filters.
            </div>
          ) : (
            <>
              <div className="src-label mb-2">
                {filtered.length} {filtered.length === 1 ? "system" : "systems"}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="sticky top-0 z-10 bg-card">
                      <Th onClick={() => toggleSort("model")} active={sortKey === "model"} asc={sortAsc}>System</Th>
                      <Th onClick={() => toggleSort("category")} active={sortKey === "category"} asc={sortAsc}>Category</Th>
                      <Th onClick={() => toggleSort("national_origin")} active={sortKey === "national_origin"} asc={sortAsc}>Origin</Th>
                      <Th>Type</Th>
                      <Th onClick={() => toggleSort("in_sevice")} active={sortKey === "in_sevice"} asc={sortAsc}>In service</Th>
                      <Th>Guidance</Th>
                      <Th>Manufacturer</Th>
                      <Th onClick={() => toggleSort("unit_cost")} active={sortKey === "unit_cost"} asc={sortAsc}>Unit cost (est.)</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((w, i) => (
                      <tr
                        key={w.model}
                        className={`border-t border-border ${i % 2 === 1 ? "bg-secondary/40" : ""}`}
                      >
                        <td className="px-3 py-2.5 align-top">
                          <div className="font-semibold text-foreground">{w.name || w.model}</div>
                          {w.name_NATO && (
                            <div className="src-label mt-0.5">NATO · {w.name_NATO}</div>
                          )}
                        </td>
                        <td className="px-3 py-2.5 align-top text-muted-foreground">{w.category || "—"}</td>
                        <td className="px-3 py-2.5 align-top text-muted-foreground">{w.national_origin || "—"}</td>
                        <td className="px-3 py-2.5 align-top text-muted-foreground">{w.type || "—"}</td>
                        <td className="px-3 py-2.5 align-top num text-muted-foreground">{w.in_sevice || "—"}</td>
                        <td className="px-3 py-2.5 align-top text-muted-foreground">{w.guidance_system || "—"}</td>
                        <td className="px-3 py-2.5 align-top text-muted-foreground">{w.manufacturer || "—"}</td>
                        <td className="px-3 py-2.5 align-top num text-muted-foreground">{w.unit_cost || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
