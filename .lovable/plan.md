
# UA Air Defense Tracker — OSINT Redesign Plan

This is a large, multi-section redesign. To keep changes reviewable and avoid regressions across the live site, I propose shipping it in **4 phases**. You can approve all, or pick the phases you want now.

---

## Design system foundation (applies to all phases)

Establish a journalism-grade visual language in `src/index.css` and `tailwind.config.ts`:

- **Typography**: Inter (UI/body), Source Serif 4 (editorial headlines). Drop any decorative display fonts.
- **Color tokens** (semantic, HSL):
  - `--uav` blue, `--cruise` orange, `--ballistic` red, `--interception` green, `--bomb` purple
  - Neutral palette: paper white, ink black, 5-step gray scale
  - Remove neon/gradient-heavy tokens; keep one subtle accent
- **Grid**: 12-col container, max-width 1400px, generous vertical rhythm
- **Chart primitives**: unified `<ChartFrame>` wrapper providing title, source line, last-updated, "Explain this metric" tooltip, CSV download button, coverage note
- **Reusable**: `<SourceBadge reliability="official|osint|academic">`, `<MetricTooltip>`, `<InsightCard>`, `<SectionHeader kicker title dek>`

---

## Phase 1 — Hero, IA & Trust Bar (homepage shell)

Rewrite `src/pages/Index.tsx` into a narrative scroll, not a dashboard wall.

1. **Hero**
   - Serif H1: "Russian Air Attacks Against Ukraine"
   - Dek: "Empirical OSINT tracking of aerial attacks and Ukrainian air defence performance."
   - 3 KPI cards: Total reported attacks · Confirmed interceptions · Estimated penetration rate
   - Metadata bar: Last update · Coverage period · Primary source · Methodology link · Download dataset · Language switch
2. **Section 1 — Executive Summary**
   - This-month UAV/missile/interception stats, MoM deltas, 3–5 auto-generated insights (extend `src/lib/chart-insights.ts`)
3. **Sticky in-page nav** (Overview · Analytics · Timeline · Live · Arsenal · Methodology · Sources · Data · Insights)
4. Move existing `AirAlertsMap` + `AirThreatFeed` into a collapsible **Section 4 — Live Situation** below historical data

## Phase 2 — Main Analytics & Timeline

5. **Section 2 — Main Analytics**: refactor `AnalyticsDashboard.tsx` into tabs (Overview · UAVs · Cruise · Ballistic · Guided bombs · Combined). Each tab uses the identical structure: metrics → long-term trend → monthly chart → interception trend → seasonality → milestones → source notes.
6. **Section 3 — Campaign Timeline**: new `CampaignTimeline.tsx` — horizontal scroll timeline overlaying attack-wave markers, weapon introductions, aid deliveries, AD milestones on the launches trend line. Data file `src/data/campaign-events.ts`.

## Phase 3 — Arsenal, Methodology, Sources, Data

7. **Section 5 — Weapon Systems Database**: rebuild `WeaponsCatalogSection.tsx` as OSINT catalogue cards (image, origin, type, range, guidance, est. cost, launch history, interception rate, limitations, primary sources, related charts).
8. **Section 6 — Methodology**: promote `/methodology` content into a homepage section with an interactive pipeline flowchart (Source Reports → Collection → Cleaning → Aggregation → Validation → Publication), confidence-level legend, what's counted / excluded, revision policy.
9. **Section 7 — Sources**: redesign `/sources` with categories (Official UA · OSINT · Academic · Reference · International orgs), each entry with description, reliability badge, update frequency, coverage.
10. **Section 8 — Download Data**: new `/data` page — CSV/JSON downloads, GitHub link, license (CC-BY), changelog, version history, citation block (APA + BibTeX).

## Phase 4 — Insights, Related Projects, Footer, Mobile polish

11. **Section 9 — Insights**: new `/insights` index + MDX-style article shells (Why ballistic interception differs; Shahed evolution; Seasonality; Largest waves; Effect of new AD deliveries).
12. **Section 10 — Related Projects**: link grid (Oryx, ISW, CSIS Missile Threat, UA Air Force, Kiel Tracker) with one-line descriptions.
13. **Footer**: 3-pillar (Data · Methodology · Legal) with About, Team, Changelog, License, Contact, Responsible disclosure, Privacy.
14. **Mobile pass**: executive summary first, expandable charts, sticky in-page nav becomes a bottom sheet, larger tap targets, lazy-load heavy charts.

---

## Technical notes

- All new colors go through `index.css` HSL tokens + `tailwind.config.ts`; no hex in components.
- Charts: keep Recharts but standardise via `<ChartFrame>`; add CSV export via a `toCSV(data)` helper in `src/lib/csv.ts`.
- Insights engine: extend `chart-insights.ts` with `generateExecutiveInsights(windowStats)` returning typed `Insight[]` with severity + source.
- i18n: every new string added to `en.json`, `de.json`, `fr.json`, `uk.json`.
- No backend schema changes required — this is pure frontend + content.
- No new dependencies expected beyond what's installed (Recharts, Framer Motion, shadcn already present).

---

## How would you like to proceed?

**Option A** — Ship **Phase 1** now (hero + exec summary + IA + trust bar + collapsible live section). Highest visible impact, ~1 implementation pass. Then iterate.

**Option B** — Ship **Phases 1 + 2** together (adds tabbed analytics + campaign timeline). Larger change, more review surface.

**Option C** — Approve the full plan and I execute all 4 phases sequentially.

Tell me A / B / C (or edit any section above) and I'll start.
