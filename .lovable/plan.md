# Redesign: Professional OSINT / Defense Analytics Look

Goal: strip the marketing/cyber aesthetic and rebuild the surface to read like Bloomberg Terminal / Reuters Graphics / NATO briefings — calm, dense, trustworthy.

## 1. Design system reset (`src/index.css`, `tailwind.config.ts`)

**Palette — 2 colors + neutral grays only**
- Primary accent: deep navy/ink `--accent-primary` (used for headlines, key numbers, primary chart series)
- Signal accent: muted amber `--accent-signal` (used sparingly for active state, alerts, the single most important KPI)
- Everything else: neutral gray scale (`--neutral-50` … `--neutral-900`)
- Remove: cyber blue, purple, multi-stop gradients, `--cyber-glow`

**Chart series** reduced to: ink, amber, mid-gray. No purple/orange ramp.

**Effects removed**
- Delete `.glow-cyber`, `.glow-yellow`, `.text-glow-yellow`, `.scan-line`, `.pulse-soft`, `bg-tactical-grid` hero usage, radial vignettes, animated background grids
- Replace with: 1px hairline borders, single subtle shadow token `--shadow-card: 0 1px 2px rgba(0,0,0,.04), 0 1px 1px rgba(0,0,0,.03)`
- Single border-radius: `--radius: 4px`

**Typography**
- Headings: keep Space Grotesk but reduce weight to 500, tighten size scale
- Body: Inter 14/20
- Mono: IBM Plex Mono for all numbers (tabular)

## 2. Component refactor — uniform card primitive

Create `src/components/ui/panel.tsx` — the single card primitive used everywhere:
```
<Panel title="..." subtitle="..." source="Source: ..." note="..." />
```
Identical padding (24px), border (1px hairline), radius (4px), shadow (`--shadow-card`). All sections converted: SummaryStats, AnalyticsDashboard, MonthlyTrendChart, Weapons Catalog, How to Help.

Delete the per-card "liquid glass" / accent-rotation styling in `HowToHelpSection`.

## 3. Hero / Index page

- Remove animated background, glow dot, marketing copy
- Replace with a sober masthead: small kicker "OSINT · Air Threat Tracker", H1 "Ukraine Air Defense — Operational Data", one-line standfirst with date range, last-updated timestamp, primary source line
- KPI strip directly under masthead: 4 large numbers (Launched / Destroyed / Interception rate / Reached target), each with a tiny source label

## 4. Source attribution + uncertainty disclosure

- Add `<SourceLabel>` micro-component (10px uppercase, muted) rendered under every stat, chart, and table
- Wire real source strings from `shahed-data.ts` / `missiles-data.ts` / `weapons_catalog.csv` provenance
- Add a persistent thin banner above the footer: "Data is compiled from open sources and may contain errors. Figures are reviewed and updated regularly. Last update: <date>."
- Add status qualifiers in copy: `reported`, `confirmed`, `estimated`, `unverified` where applicable

## 5. Filters

Add a sticky filter bar (`src/components/FilterBar.tsx`) above the analytics + arsenal sections:
- Country (origin) — from weapons catalog
- Date range — existing `DateRangeFilter`, restyled
- Weapon system / category
- Source

State lifted into `Index.tsx`, passed to AnalyticsDashboard, MonthlyTrendChart, WeaponsCatalogSection.

## 6. Tables

Rebuild Weapons Catalog as a real table (not card grid):
- Sticky `<thead>`, zebra rows (`even:bg-neutral-50/40`), sortable columns (model, category, origin, in service, unit cost)
- Horizontal scroll on mobile with frozen first column
- Source label in caption

## 7. Charts

Apply across `MonthlyTrendChart`, `AnalyticsDashboard`, `InterceptionRateChart`:
- Remove gradients, glow filters, soft fills > 0.15 opacity
- Two series only: ink (Launched) + amber (Destroyed) — interception rate as a thin gray line on secondary axis
- Visible axis ticks + labels, gridlines only horizontal at 20% opacity, source caption under each chart, units in axis title

## 8. Copy pass

Rewrite emotional/marketing strings to neutral analytical tone in `Index.tsx`, `HowToHelpSection`, `Methodology.tsx`, `Sources.tsx`, `Disclaimer.tsx`. Examples:
- "Ukraine's Defense Analytics." → "Ukraine Air Defense — Operational Data"
- "Verified airstrike and aerial attack data…" → "Daily counts of reported aerial threats and confirmed interceptions, October 2022 – present."
- "How to Help" donate cards → plain list with org name, mandate, link, source

## 9. Mobile

- Single-column stacking ≤ 768px
- KPI strip becomes 2x2
- Filter bar collapses into a `<details>` drawer
- Tables: horizontal scroll + first-column freeze

## Technical scope

Files edited:
- `src/index.css`, `tailwind.config.ts` — token reset
- `src/pages/Index.tsx` — masthead, KPI strip, filter wiring, copy
- `src/components/SummaryStats.tsx`, `AnalyticsDashboard.tsx`, `MonthlyTrendChart.tsx`, `InterceptionRateChart.tsx`, `WeaponsCatalogSection.tsx`, `DateRangeFilter.tsx`, `DocPageLayout.tsx` — restyle, remove glow, add source labels
- `src/pages/Methodology.tsx`, `Sources.tsx`, `Disclaimer.tsx` — copy pass

Files created:
- `src/components/ui/panel.tsx` — uniform card primitive
- `src/components/SourceLabel.tsx` — source/uncertainty micro-component
- `src/components/FilterBar.tsx` — country / date / weapon / source filters
- `src/components/WeaponsTable.tsx` — sortable sticky table replacing card grid

Files removed/inlined:
- `HowToHelpSection` block in `Index.tsx` rewritten to plain list

No backend or data-model changes. Pure presentation + filter state.

Confirm and I'll implement.