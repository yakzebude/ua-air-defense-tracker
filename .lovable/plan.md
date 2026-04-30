## Ziel

Headline auf "Vier Jahre russischer Angriffskrieg gegen die Ukraine" anpassen und den Datenbereich vom ersten vollständigen Monat im Datensatz beginnen lassen — **Oktober 2022** (der Datensatz startet am 28.09.2022, daher ist Oktober 2022 der erste komplette Monat).

## Änderungen

### 1. `src/pages/Index.tsx` — Headline & Intro
- H1 ersetzen durch: **„Vier Jahre russischer Angriffskrieg gegen die Ukraine"** mit Subzeile „measured month by month".
- Intro-Text aktualisieren: Zeitraum "October 2022 – March 2026" statt "since February 2022 … through March 2026".
- Footer-Hinweis "Range locked to Jan 2023 – Mar 2026" → "Range: Oct 2022 – Mar 2026".

### 2. `src/lib/shahed-data.ts` — Datenfenster erweitern
- `MIN` von `2023-01-01` auf `2022-10-01` setzen.
- Bucket-Seeding-Schleife so anpassen, dass sie bei Oktober 2022 beginnt (Jahr 2022 ab Monatsindex 9).

### 3. `src/lib/missiles-data.ts` — gleiche Anpassung
- `MIN` auf `2022-10-01`, Bucket-Seeding ab Oktober 2022.

### 4. `src/components/DateRangeFilter.tsx` — Presets
- Presets-Indizes neu berechnen: Oktober 2022 = Index 0, Jan 2023 = Index 3, Jan 2024 = 15, Jan 2025 = 27, Jan 2026 = 39.
- Neuen Preset "2022" hinzufügen (Okt–Dez 2022, Index 0–2).
- Slider-Endbeschriftung links auf `"Oct '22"` ändern.

## Hinweise
- Die Headline bleibt sprachlich deutsch wie vom User gewünscht; der restliche Fließtext bleibt englisch (konsistent mit aktuellem Stand).
- "Three years of Shahed strikes" entfällt zugunsten der neuen Vier-Jahres-Headline.