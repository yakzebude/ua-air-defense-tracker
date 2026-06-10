## Goal

Lift the site to a credible public-intelligence dashboard register (FT / OWID / Bellingcat quality) by reworking only typography, spacing, layout grid and visual hierarchy. No brand, color, content or functional changes.

## 1. Typography system

**Font loading (`index.html`)**
- Replace the Google Fonts `<link>`: load **IBM Plex Sans** (400/500/600/700), **Source Sans 3** (400/500/600/700, including italic 400), keep **IBM Plex Mono** for code/numerics. Drop Inter and Source Serif 4.

**Tailwind (`tailwind.config.ts`)**
- `fontFamily.sans` → Source Sans 3 stack
- `fontFamily.display` / `serif` → IBM Plex Sans stack (headings)
- Keep `mono` as IBM Plex Mono

**Global CSS (`src/index.css`)**
- `body` → Source Sans 3, 18px / 30px, normal tracking
- `h1–h4` → IBM Plex Sans, weights 600/700, tracking -0.01em
- Define a type scale via utility classes (also expose as Tailwind component layer):
  - `.t-h1` 48/56/700, `.t-h2` 36/44/700, `.t-h3` 28/36/600, `.t-h4` 22/30/600
  - `.t-body-lg` 20/32, `.t-body` 18/30, `.t-body-sm` 16/26, `.t-caption` 14/22
- Mobile (`max-width: 640px`) overrides: H1 36, H2 30, H3 24, body 17
- Apply `font-variant-numeric: tabular-nums` to `.num`, all `<td>`, stat values

## 2. Spacing & layout grid

**Spacing tokens** (`tailwind.config.ts` → `extend.spacing` aliases): introduce semantic `s-1..s-7` mapping to `8, 16, 24, 32, 48, 64, 96`. Existing Tailwind numeric classes remain valid; new code prefers these.

**Container widths** — add three reusable container classes in `index.css`:
- `.container-content` → `max-width: 1280px`
- `.container-dashboard` → `max-width: 1440px`
- `.container-prose` → `max-width: 880px` (text-heavy pages)

Each: `margin-inline: auto`, responsive horizontal padding (`16/24/32px`).

**Section rhythm**: `.section` utility → `padding-block: 64px` (desktop) / `48px` (tablet) / `32px` (mobile).

## 3. Component standardization

**Cards / panels** (`.panel`, `.panel-padded` in `index.css`)
- Padding: `24px` mobile, `32px` desktop (consistent)
- Border radius: `var(--radius)` (unchanged)
- Header → body spacing: `16px`; metric ↔ label: `8px`
- New `.stat-value` (28/32, 600, tabular) + `.stat-label` (14/22, 500, muted, tracking 0.04em)

**Tables** (global `@layer components`)
- `th`: 14/22, 600, uppercase tracking 0.06em, muted-foreground, border-bottom
- `td`: 16/26, padding `12px 16px`, tabular nums
- Row hover: subtle muted background; zebra removed in favor of spacing
- Wrap tables in horizontally scrollable container on mobile

**Charts / maps / data viz**
- Allocate more horizontal space: dashboards use `.container-dashboard`; charts span full panel width
- Tighter filter row spacing (`gap: 8/16`), filters always above the viz with a `12px` gap to data
- Legend → 14/22, 8px gap from chart, never larger than axis labels

## 4. Page / section hierarchy audit

Apply the new tokens across:
- `src/pages/Index.tsx` (home / dashboard) — swap to `.container-dashboard`, replace ad-hoc `text-3xl/4xl/5xl` with `.t-h1/.t-h2`, normalize section paddings
- `src/components/AnalyticsDashboard.tsx`, `SummaryStats.tsx`, `MonthlyTrendChart.tsx`, `InterceptionRateChart.tsx`, `AirAlertsMap.tsx`, `WeaponsCatalogSection.tsx`, `DataConfidenceSection.tsx`, `AirThreatFeed.tsx`, `ChartInsights.tsx` — apply card/stat/table classes
- `src/components/DocPageLayout.tsx` and doc pages (`About`, `Methodology`, `Sources`, `Disclaimer`, `Imprint`, `Changelog`, `Contact`, `Unsubscribe`) — switch to `.container-prose`, body-default text, h2/h3 rhythm
- `Alerts.tsx`, `NotFound.tsx` — same container + heading tokens

For each section enforce order: **Heading → intro → content → supporting → actions** by adjusting margin-top utilities (`mt-2` after H#, `mt-6` between blocks, `mt-12` before next section).

## 5. Mobile

- Add `@media (max-width: 640px)` overrides for type scale (see §1)
- Touch targets ≥ 44px (audit buttons in nav, filters, ticker controls)
- Reduce stacked vertical padding (`section` → 32px on mobile)
- Tables → horizontal scroll wrapper with sticky first column where it exists

## 6. Out of scope (explicit)

- No color, palette, logo, iconography, illustration changes
- No new features, no removed content, no routing changes
- No dark/light mode rework beyond inheriting new typography
- No copy edits

## Files to edit

```
index.html                              (font links)
tailwind.config.ts                      (fonts, spacing aliases)
src/index.css                           (type scale, containers, panel, table, stat utilities, mobile)
src/components/DocPageLayout.tsx        (prose container + headings)
src/components/AnalyticsDashboard.tsx   (dashboard container, section rhythm)
src/components/SummaryStats.tsx         (.stat-value / .stat-label)
src/components/MonthlyTrendChart.tsx
src/components/InterceptionRateChart.tsx
src/components/AirAlertsMap.tsx
src/components/WeaponsCatalogSection.tsx
src/components/DataConfidenceSection.tsx
src/components/AirThreatFeed.tsx
src/components/ChartInsights.tsx
src/pages/Index.tsx
src/pages/{About,Methodology,Sources,Disclaimer,Imprint,Changelog,Contact,Unsubscribe,Alerts,NotFound}.tsx
```

## Validation

- Visual sweep at 1920, 1440, 1024, 768, 390 widths
- Confirm headings dominate body; stats ≥ body weight; consistent paddings
- Lighthouse a11y check (contrast unchanged; font sizes ≥ 14)
- No functional regressions: filters, charts, map, ticker, language switcher, theme toggle still work
