# Plan: Glaubwürdigkeit stärken & Journalisten-Workflow verbessern

Fokus laut deiner Auswahl: **Höhere Glaubwürdigkeit** für die Zielgruppe **Journalisten & Medien**. Sechs gezielte Maßnahmen, geordnet nach Wirkung.

## 1. Datenfrische-Indikator im StatusBar

Im obersten StatusBar neben dem letzten Datenpunkt ein kleines visuelles Signal:
- grüner Punkt: Daten ≤ 3 Tage alt
- gelb: 4–10 Tage
- rot: > 10 Tage

Tooltip erklärt: "Letzter Eintrag im Datensatz; nicht die Zeit deines Besuchs". Macht für Journalisten sofort sichtbar, ob die Zahlen für eine Story noch tragen.

## 2. Quellenlink pro Monat im Chart-Tooltip

In `MonthlyTrendChart` und Composition-Charts: der Tooltip eines Monats bekommt einen kleinen "Quelle ↗"-Link, der auf den Kaggle-Datensatz mit Filter auf diesen Monat verweist (bzw. auf den Air-Force-Telegram-Kanal). So kann ein Journalist eine zitierte Zahl direkt rückverfolgen.

## 3. Changelog / Revisionsverlauf

Neue Route `/changelog` (im SectionNav verlinkt), die folgendes auflistet:
- Datum der letzten Datenaktualisierungen (aus CSV-Mtime ableiten oder manuell pflegen)
- Bekannte Revisionen einzelner Monate (z. B. "Mai 2024: Marschflugkörper-Zahl von 87 → 91 nach Air-Force-Korrektur")
- Versionshinweise des Trackers selbst

Start mit einer einfachen, statisch gepflegten Markdown-/TS-Liste; erweiterbar.

## 4. Teilbare URLs (Deep-Links)

Filter-State (Kategorie, Zeitraum, Heatmap-Filter) in URL-Query-Parameter syncen, z. B.
`/?range=2024-01,2024-09&cat=ballistic`. Beim Laden wird der State aus der URL gelesen. Ermöglicht Journalisten, eine konkrete Ansicht in Artikeln zu verlinken — ein klassisches Vertrauenssignal.

## 5. Pro-Panel-Daten-Export

Jedes Panel (Drohnen, Cruise, Ballistik, Composition, Heatmap) bekommt oben rechts ein dezentes "↓ CSV"-Icon, das **nur die im Panel sichtbaren, gefilterten Daten** als CSV exportiert. Dazu eine "Copy citation"-Aktion, die einen vorformatierten Zitat-String in die Zwischenablage legt:
> "Air Force Command of Ukraine, via Petro Ivaniuk (Kaggle), aggregated by UA Defense Tracker, retrieved [Datum]."

## 6. SEO & Social-Preview

- `<title>` und `<meta description>` in `index.html` auf "UA Defense Tracker — Ukraine air defense, aggregated OSINT data" setzen
- `og:title`, `og:description`, `og:url`, `og:type=website` ergänzen
- Ein dediziertes OG-Image (1200×630) im Stil des Dashboards generieren — KPI-Header-Look mit Total Launched / Intercepted / Rate, sodass geteilte Links auf X/LinkedIn/Slack professionell aussehen
- JSON-LD `Dataset` Schema einbetten (passt perfekt zu diesem Projekt und hilft bei Google-Dataset-Search)

## Technische Details

- Datenfrische: Differenz zwischen `lastUpdatedLabel.date` und `Date.now()` in Tagen; Farbtoken `--signal` (rot), eine neue `--signal-warn` (gelb), `--signal-ok` (grün) in `index.css`
- Tooltip-Link: `StackedTooltip` / `ChartTooltip` erweitern, externe URL pro Monat aus `m.date` ableiten
- URL-State: `useSearchParams` von `react-router-dom`, zentraler Hook `useFilterParams`, debounced Schreibvorgang
- CSV-Export: kleine Utility-Funktion `toCSV(rows, headers)`, `Blob` + `URL.createObjectURL`
- Changelog-Route: neue Datei `src/pages/Changelog.tsx` + Eintrag in `App.tsx` Router; Daten in `src/data/changelog.ts`
- JSON-LD `Dataset`: inline `<script type="application/ld+json">` in `index.html` mit `creator`, `temporalCoverage`, `distribution` (CSV-URL), `license`
- OG-Image: `imagegen` mit Quality `premium` wegen Text-Lesbarkeit, gespeichert als `public/og-image.jpg`

## Nicht im Plan

- Tagesgenaue Ansicht, Replay-Animation, Vergleichsmodus (sind eher "Interaktivität" — können in einer späteren Runde folgen)
- Druck-Layout, größere visuelle Animationen, neue Charts

Soll ich diesen Plan so umsetzen, oder Punkte streichen / priorisieren?
