# Drei Visualisierungen — gezielt verteilt statt gebündelt

Das Dashboard bleibt fokussiert. Jedes der drei Patterns wird dort eingesetzt, wo es inhaltlich am stärksten wirkt — eines auf der Landingpage (als Ersatz), zwei auf bestehenden Unterseiten (als Ersatz bzw. neuer Hero-Block).

---

## 1) Small Multiples → ersetzt einen Teil des Dashboards

**Pattern (Bild 1):** Mehrere kleine Liniencharts nebeneinander, je mit Start-/Endwert und Δ%.

**Einsatzort:** **Landingpage `Index.tsx`** — ersetzt den heutigen `ChartInsights`-Block ("Key Findings"-Karten) **direkt unter** dem `MonthlyTrendChart`.

**Warum dort:**
- Die heutigen Key-Findings sind Text-Karten, die sagen "Peak war im Mai". Small Multiples *zeigen* dasselbe — pro Waffenkategorie. Das ist ein echter Upgrade von Text zu Daten, ohne ein neues Element hinzuzufügen.
- Der große Verlaufschart darüber zeigt das Gesamtbild, die Multiples zerlegen es in 4–6 Kategorien (Shahed/UAV · Cruise · Ballistic · KAB/Glide · S-300 ground-launch · Other). Das ist die klassische "overview → breakdown"-Bewegung.
- Δ% in `--signal` (rot ↑) bzw. `--signal-ok` (grün ↓) ersetzt die textuellen Trend-Aussagen.

**Was wegfällt:** `ChartInsights.tsx` auf der Landingpage (Komponente bleibt für eventuelle Wiederverwendung erhalten).

**Neu:** `src/components/CategorySparklines.tsx` (Recharts `<LineChart>` ohne Achsen, Endpunkt-Marker, mono-Beschriftung, dünne Borders).

---

## 2) Treemap → wird zum Hero der Seite `/methodology` oder `/sources` … besser: **neue Sektion auf `/about` "Arsenal Composition"** *oder* ersetzt den oberen Teil von **`WeaponsCatalogSection`**

**Pattern (Bild 2):** Flächenproportionale Kacheln, große Zahl + kurzes Label, Farbe als zweite Dimension.

**Einsatzort:** **`WeaponsCatalogSection.tsx`** — als **neuer Visual-Header über der Tabelle**, nicht auf dem Dashboard.

**Warum dort:**
- Die Waffenkatalog-Tabelle ist heute eine reine Listenansicht. Eine Treemap als Einstieg zeigt sofort *welches System dominiert das Arsenal in den letzten 30 Tagen* und macht die darunterliegende Tabelle zum Detail-Drill-down.
- Auf dem Dashboard wäre die Treemap redundant zu Summary-Stats + Trendchart. In der Katalog-Sektion ist sie die fehlende Brücke zwischen "Liste aller Systeme" und "wer tatsächlich eingesetzt wird".
- Flächengröße = Launches in 30 Tagen. Farbintensität = Abfangrate (gedämpftes Bernstein → Tiefrot über `threat-ramp.ts`). Klick auf Kachel filtert die Tabelle darunter.

**Neu:** `src/components/ArsenalTreemap.tsx` (Recharts `<Treemap>` mit Custom-Content-Renderer für Typografie wie in Bild 2: große Zahl oben, Systemname, dezenter Sub-Text).

**Dashboard bleibt unverändert** in diesem Punkt.

---

## 3) Tile-Grid-Map → **ersetzt die Listenansicht auf `/alerts`**

**Pattern (Bild 3):** Jede Region als gleich große Kachel mit Zahl, Highlight-Farbe für Spitzenwerte, Sub-Labels.

**Einsatzort:** **`Alerts.tsx`** (die dedizierte Alerts-Unterseite) — als **primäre Visualisierung neben oder anstelle** der dortigen Detail-Listen.

**Warum dort:**
- Auf dem Dashboard zeigt `AirAlertsMap` die geografische Echtzeit-Sicht — die bleibt, sie ist emotional und korrekt verortet.
- Die Unterseite `/alerts` ist heute redundant zur Karte. Hier passt das Tile-Grid perfekt: es löst die Schwäche der Geo-Karte (kleine Oblaste wie Tscherniwzi/Tschernihiw verschwinden visuell trotz hoher Alarmlast) und wird zur *analytischen* Schwester der *geografischen* Dashboard-Ansicht.
- Jede Kachel: ISO-Code groß, "X h / 30d" klein, Farbintensität nach kumulierten Alarmstunden, besetzte Oblaste mit diagonaler Schraffur, aktiver Alarm mit pulsierendem Rand.
- Toggle "Tile Grid / Geo Map" oben auf `/alerts` (Geo-Map als sekundäre Sicht spiegeln, damit Nutzer wechseln können).

**Neu:** `src/components/OblastTileGrid.tsx` (statisches CSS-Grid, 25 Oblaste + Krim hand-positioniert nach Ukraine-Geografie, Daten aus dem bestehenden `air-alerts`-Feed + `oblastStats.json`).

---

## Was sich auf der Landingpage ändert (kompakt)

```text
vorher:                              nachher:
…                                    …
MonthlyTrendChart                    MonthlyTrendChart
ChartInsights (Text-Karten)    →     CategorySparklines (6 Mini-Charts) ← Bild 1
InterceptionRateChart                InterceptionRateChart
AirAlertsMap + ThreatFeed            AirAlertsMap + ThreatFeed
…                                    …
```

Genau **ein** ersetztes Element. Kein zusätzlicher Block, keine erhöhte Scroll-Tiefe.

## Was sich auf Unterseiten ändert

- **`/alerts`:** Liste → Tile-Grid als Primärsicht, Geo-Map als Toggle. (Bild 3)
- **Waffenkatalog-Sektion** (eingebunden auf Landingpage *unten* + ggf. `/methodology`): Treemap als visueller Header über der Tabelle. (Bild 2)

Damit verteilt sich die visuelle Last über die Site, jede Seite bekommt einen klaren Hero-Moment, und das Dashboard bleibt schlank.

---

## Farbkonzept

Unverändert formell: `--background`/`--card` als Flächen, `--signal` (gedämpftes Rot) für negative/hohe Werte, `--signal-ok` für positive/niedrige, `--signal-warn` (Bernstein) als Mittelwert, monospace Beschriftung, 1px-Borders. Keine Verläufe, kein Neon, keine bunten Treemap-Farben aus den Referenzbildern.

---

## Technisch

- Neue Komponenten: `CategorySparklines.tsx`, `ArsenalTreemap.tsx`, `OblastTileGrid.tsx`.
- Daten: bereits vorhanden (`shahed-data.ts`, `missiles-data.ts`, `weapons-catalog.ts`, `air-alerts`-Edge-Function, `oblastStats.json`). Keine Backend-Änderungen.
- i18n: neue Keys in `en/de/fr/uk`.
- `Index.tsx`: `ChartInsights` durch `CategorySparklines` ersetzen.
- `WeaponsCatalogSection.tsx`: `ArsenalTreemap` als Header darüber.
- `Alerts.tsx`: Tile-Grid als Primärsicht, Toggle zur Geo-Karte.

---

## Frage vor Build

Passt diese Verteilung (Sparklines → Dashboard, Treemap → Waffenkatalog, Tile-Grid → `/alerts`) — oder möchtest du eines der drei Patterns weglassen / anders verorten?
