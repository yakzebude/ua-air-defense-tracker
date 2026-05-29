# Plan: Militärisch-dezentes Redesign

## 1. Dark Mode Palette (`src/index.css`)
Komplett neuer `.dark` Block, basierend auf `#1e293b`:
- `--background: 215 28% 17%` (#1e293b)
- `--card: 215 25% 21%` (etwas heller, klar abgegrenzt)
- `--secondary/muted/accent: 215 22% 25%`
- `--border: 215 18% 32%` (dünn, 1 px, leicht heller als BG)
- `--foreground: 210 20% 92%`, `--muted-foreground: 215 12% 70%`

## 2. Sparsame Akzentfarben (`src/index.css` + `tailwind.config.ts`)
Drei Funktionsfarben, sonst nur Graustufen:
- `--series-destroyed` = Olive `84 60% 24%` (#3f6212) — erfolgreiche Abschüsse
- `--series-launched` = Karmesin `0 72% 35%` (#991b1b) — verfehlte / Einschläge / Gesamtbedrohung
- `--series-rate` / Total = neutrales Mittelgrau `215 10% 55%`
- `--signal-ok` → Olive, `--signal-warn` → entsättigtes Bernstein, `--destructive` → Karmesin
- Light-Mode-Variablen parallel auf gleiche Hues angleichen
- `CAT_COLORS` in `AnalyticsDashboard.tsx` auf Token (`series-destroyed`, `series-launched`, neutralgrau) umstellen — keine hartkodierten HSL-Werte mehr

## 3. Charts: Grid + X-Achse
In `MonthlyTrendChart.tsx`, `AnalyticsDashboard.tsx`, `InterceptionRateChart.tsx`:
- `--grid` auf nahezu transparent (`hsl(var(--border) / 0.15)`) bzw. `CartesianGrid` ganz entfernen
- Tages-Achsen: `angle={-45} textAnchor="end"` und `interval` so wählen, dass nur jeder 5. Tick gezeigt wird (bereits teilweise vorhanden, konsistent überall anwenden)

## 4. Typografie
- `<link>` für Google Fonts „Space Mono" + „IBM Plex Sans" in `index.html` ergänzen
- `tailwind.config.ts`:
  - `sans: ['"IBM Plex Sans"', …]`
  - `display/serif: ['"Space Mono"', …]` (für Überschriften)
- `src/index.css`:
  - `body` → IBM Plex Sans
  - `h1–h4` → Space Mono, `font-weight: 700`, `letter-spacing: 0`
  - `.num` weiter tabular

## 5. Eckige Karten / Boxen
- `--radius: 0.125rem` (≈ `rounded-sm`) global setzen → wirkt auf `.panel`, Buttons, Inputs
- `.panel` Border bereits 1 px; sicherstellen dass Border-Token leicht heller als BG ist (siehe 1.)
- Stat-/Infoboxen in `SummaryStats.tsx` & `AnalyticsDashboard.tsx` Klassen `rounded-*` → `rounded-none`/`rounded-sm`

## 6. Icons
- Audit aller Komponenten (`AnalyticsDashboard`, `WeaponsCatalogSection`, `Index`, Header etc.) auf farbige / „explosive" Symbole und Emojis
- Ersetzen durch monochrome Lucide-Linien-Icons: `Crosshair`, `Shield`, `Circle`, `MapPin`, `Radar`, `Target`
- Icons immer `text-muted-foreground` / `text-foreground`, `strokeWidth={1.5}`, keine Fill-Farben

## Technische Reihenfolge
1. `index.html` — Font-Links
2. `tailwind.config.ts` — Fonts, ggf. radius defaults
3. `src/index.css` — Tokens, Radius, Typo
4. `src/components/AnalyticsDashboard.tsx` — Farben, Grid, Eckigkeit, Icons
5. `MonthlyTrendChart.tsx`, `InterceptionRateChart.tsx` — Grid/Achsen
6. `SummaryStats.tsx`, `WeaponsCatalogSection.tsx`, übrige Seiten — Eckigkeit & Icon-Pass

Keine Logik- oder Datenänderungen, ausschließlich Präsentations-Layer.
