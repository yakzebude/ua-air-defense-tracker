## Redesign: Data-journalism dashboard

Reshape the first screen of `src/pages/Index.tsx` so a reader can answer "what got through?" without scrolling. All changes are presentational (no data pipeline changes).

### 1. Replace the two-card hero with a 5-KPI strip

Drop the current Breached / Launched / Interception-rate split (lines ~677–847) and render one editorial KPI row with five tiles, in this order and emphasis:

```text
[ BREACHED ]   [ Intercepted ] [ Launched ] [ Interception % ] [ Breach % ]
  primary        neutral         neutral      neutral             secondary accent
```

- "Breached air defense" uses the single accent color (existing `--signal-warn`, amber). Larger number, heavier weight, short plain-language sub-label ("targets that got through").
- Other four tiles share a quieter neutral treatment (`text-foreground/80`, same font scale).
- Equal-width grid: `grid-cols-2 md:grid-cols-5`, stacks cleanly on mobile.
- Each tile has a tiny info tooltip with the metric definition (reuse existing Tooltip pattern at lines 687–701).
- Keep the existing `≈ %` micro-label style under each derived rate.

### 2. Editorial headline sentence

Above the KPI strip, render one auto-generated sentence summarizing the latest complete month, e.g.:

> "In **May 2026**, Russia launched **4,812** aerial weapons. Ukraine intercepted **3,664 (76.2%)**; **1,148 breached** air defenses — **+12% vs April**."

- Built from the already-computed `completeMonth` plus the prior month from `shahed/cruise/ballistic`.
- Serif font to match masthead; bold the numbers.
- Add a new i18n key `masthead.whatChanged` with interpolation; add EN string and TODO placeholders for de/fr/uk (same English fallback) so nothing renders blank.

### 3. One dominant trend chart: launched vs intercepted vs breached

Insert a new full-width chart panel directly below the KPI strip, replacing the current "TIER 3 last-complete-month breakdown" block (lines 728–793) as the hero visualization. Subtype panel keeps that breakdown lower in the page.

- New component `src/components/HeroTrendChart.tsx` built with Recharts (already used in the project).
- Monthly series, three measures combined across UAV+cruise+ballistic: `launched` (light gray bars), `intercepted` (neutral foreground line), `breached` (amber line, thicker).
- Toggle row above the chart: `All · UAV · Cruise · Ballistic` (segmented control) — drives which dataset(s) feed the series. Default `All`.
- Annotations: mark the top-1 launched month and the top-1 breached month with a ReferenceDot + short label ("Largest wave — 1,247 launched").
- Source/footnote in the panel footer using existing `SourceLabel` / `Panel` primitives.

### 4. Weapon-type tabs (small multiples)

Below the hero trend, reuse `CategorySparklines` (already rendered at line 870) but reframe its surrounding heading as "By weapon type — what got through" and ensure the three cards show: launched, intercepted, breached, breach rate (currently they emphasize launched/destroyed). Minor edits inside `CategorySparklines.tsx` to add the "breached" number and breach-rate %.

### 5. Demotions

- Keep the deep per-category sections (`CategorySection` for drones / cruise / ballistic, lines ~884+) but move them below `AnalyticsDashboard` so they read as secondary detail.
- The existing per-category interception-rate bars currently in the hero right card (lines 817–841) move into `AnalyticsDashboard` as a secondary panel, not the hero.
- No raw event table is added; existing tables stay where they are.

### Files touched

- `src/pages/Index.tsx` — replace lines ~677–847 (hero), insert headline sentence + HeroTrendChart mount, reorder later sections.
- `src/components/HeroTrendChart.tsx` — new.
- `src/components/CategorySparklines.tsx` — add breached count + breach-rate line per card.
- `src/locales/en.json` (+ de/fr/uk stubs) — new keys: `kpi.intercepted`, `kpi.breachRate`, `kpi.breachRateSub`, `kpi.interceptedSub`, `kpi.launchedSub`, `masthead.whatChanged`, `hero.trendTitle`, `hero.trendSubtitle`, `hero.peakLaunched`, `hero.peakBreached`, `hero.tabAll`.
- No backend, no data-loader, no Tailwind token changes (amber `signal-warn` already exists).

### Out of scope

- No changes to data loaders, CSV pipeline, or AnalyticsDashboard internals beyond receiving the relocated per-category bars.
- No new color tokens; reuse `signal-warn` as the single accent.
- No motion/scrolling effects beyond what already exists.
