import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { loadWeaponsCatalog, type Weapon } from "@/lib/weapons-catalog";
import { Skeleton } from "@/components/ui/skeleton";

const CATEGORIES = [
  { key: "all", label: "All" },
  { key: "UAV", label: "UAVs" },
  { key: "cruise missile", label: "Cruise" },
  { key: "ballistic missile", label: "Ballistic" },
  { key: "surface-to-air missile", label: "SAM" },
  { key: "guided bomb", label: "Guided bombs" },
];

function categoryAccent(cat: string): string {
  if (cat.includes("UAV")) return "var(--ua-yellow)";
  if (cat.includes("cruise")) return "var(--series-launched)";
  if (cat.includes("ballistic")) return "var(--series-destroyed)";
  if (cat.includes("surface-to-air")) return "var(--series-rate)";
  return "var(--muted-foreground)";
}

export function WeaponsCatalogSection() {
  const [weapons, setWeapons] = useState<Weapon[] | null>(null);
  const [cat, setCat] = useState<string>("all");
  const [origin, setOrigin] = useState<string>("all");
  const [q, setQ] = useState("");

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
    return weapons.filter((w) => {
      if (cat !== "all" && w.category !== cat) return false;
      if (origin !== "all" && w.national_origin !== origin) return false;
      if (!needle) return true;
      return [w.model, w.name, w.name_NATO, w.type, w.manufacturer, w.designer]
        .some((v) => v.toLowerCase().includes(needle));
    });
  }, [weapons, cat, origin, q]);

  return (
    <section id="arsenal" className="scroll-mt-24 border-t border-border">
      <div className="container py-14 md:py-20">
        <div className="mb-8 max-w-3xl">
          <div className="mb-4 inline-block border-l-2 border-series-destroyed pl-3 font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Arsenal · Weapon catalog
          </div>
          <h2 className="font-serif text-3xl md:text-4xl tracking-tight">
            Russian weapons used against Ukraine
          </h2>
          <p className="mt-3 text-sm text-muted-foreground md:text-base">
            Reference profiles for every UAV, cruise and ballistic system tracked in the
            dataset. Filter by category, origin or search for a specific model, NATO
            designation or manufacturer.
          </p>
        </div>

        {/* Controls */}
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((c) => {
              const active = cat === c.key;
              return (
                <button
                  key={c.key}
                  onClick={() => setCat(c.key)}
                  className={`rounded-sm border px-3 py-1 text-[11px] font-mono uppercase tracking-[0.16em] transition-colors ${
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
              className="rounded-sm border border-border bg-card px-2 py-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-foreground"
            >
              {origins.map((o) => (
                <option key={o} value={o}>
                  {o === "all" ? "All origins" : o}
                </option>
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

        {/* Results */}
        {!weapons ? (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-40 w-full" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-sm border border-border bg-card p-10 text-center text-sm text-muted-foreground">
            No weapons match these filters.
          </div>
        ) : (
          <>
            <div className="mb-3 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              {filtered.length} {filtered.length === 1 ? "system" : "systems"}
            </div>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {filtered.map((w) => {
                const accent = categoryAccent(w.category);
                return (
                  <article
                    key={w.model}
                    className="group relative overflow-hidden rounded-sm border border-border bg-card p-4 transition-colors hover:border-foreground/40"
                  >
                    <div
                      className="absolute inset-y-0 left-0 w-[2px]"
                      style={{ background: `hsl(${accent})` }}
                    />
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-serif text-lg leading-tight tracking-tight">
                          {w.name || w.model}
                        </div>
                        {w.name_NATO && (
                          <div className="mt-0.5 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                            NATO · {w.name_NATO}
                          </div>
                        )}
                      </div>
                      <span
                        className="shrink-0 rounded-sm border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em]"
                        style={{
                          color: `hsl(${accent})`,
                          borderColor: `hsl(${accent} / 0.4)`,
                          background: `hsl(${accent} / 0.08)`,
                        }}
                      >
                        {w.category}
                      </span>
                    </div>

                    <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
                      {w.type && <Row k="Type" v={w.type} />}
                      {w.national_origin && <Row k="Origin" v={w.national_origin} />}
                      {w.in_sevice && <Row k="In service" v={w.in_sevice} />}
                      {w.guidance_system && <Row k="Guidance" v={w.guidance_system} />}
                      {w.manufacturer && <Row k="Manufacturer" v={w.manufacturer} full />}
                      {w.launch_platform && <Row k="Platform" v={w.launch_platform} full />}
                      {w.unit_cost && <Row k="Unit cost" v={w.unit_cost} full />}
                    </dl>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function Row({ k, v, full }: { k: string; v: string; full?: boolean }) {
  return (
    <div className={full ? "col-span-2" : undefined}>
      <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        {k}
      </dt>
      <dd className="text-foreground/90">{v}</dd>
    </div>
  );
}
