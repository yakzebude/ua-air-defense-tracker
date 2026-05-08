# Ausbauplan: Inhalte, Interaktivität, externe Querverlinkung

## A — Neue Inhalte / Datenebenen

1. **Tagesgranularität zusätzlich zur Monatsansicht**
   Toggle „Monthly / Daily / 7-day rolling avg". Daily zeigt Spitzen (z.B. Großangriffe einzelner Nächte), Rolling-Avg glättet Trends.

2. **Key-Events-Layer**
   Vertikale Annotation-Linien im Chart bei wichtigen Ereignissen: Beginn Energieinfrastruktur-Kampagne (Okt 2022), Kinzhal-Erstabschuss (Mai 2023), Kachowka-Damm, Großangriff 29.12.2023, etc. Hover → Tooltip mit Kontext.

3. **Waffenfamilien-Drilldown**
   In der Cruise-Sektion eine kleine Tabelle/Treemap nach Modell (Kalibr vs X-101 vs X-22 …): Launched, Down, Rate. Heute werden alle gemixt.

4. **Abfangrate-Heatmap**
   Kalender-Heatmap (Monate × Jahre) für jede Kategorie — auf einen Blick erkennbar, wann Abwehr unter Druck stand.

5. **„Through-Rate"-Kontext**
   Mini-Erklärbox: was bedeutet ein durchgekommenes Shahed vs. eine durchgekommene Ballistic? Schwere/Sprengkopf/Reichweite kurz anreißen (Karten-Style).

6. **Geografie (optional, höherer Aufwand)**
   Statische Karte Ukraine + Hauptangriffsregionen (Kyiv, Charkiv, Odessa, Lwiw …) — wenn Daten verfügbar; sonst Schwarz-Weiß-Outline mit Energie/Hafen-Hotspots als Story-Element.

7. **Materialkosten / Aufwand pro Welle**
   Geschätzte Stückkosten (Shahed ~$50k, Kalibr ~$1M, Kinzhal ~$10M) → grobe „$ launched at Ukraine" Kennzahl. Quelle klar zitieren.

8. **Vergleich zur Luftverteidigung**
   Optionaler Block: bekannte gelieferte Patriot/IRIS-T/NASAMS-Systeme vs. ballistische Abfangrate-Entwicklung über Zeit.

## B — Struktur / Aufbau

1. **Hero-Hook schärfen**
   Aktuell: eine große Zahl (Total fired). Idee: 3 rotierende/auswählbare Hook-Zahlen (Total fired · Total intercepted · Got through) mit Kicker-Text wie bei FT-„Visual Stories".

2. **Storytelling-Reihenfolge statt Nebeneinander**
   Reihenfolge so begründen wie Reuters: Drohnen (volumenstark, billig) → Cruise (präzise, teuer) → Ballistic (schwer abzufangen, gefährlich). Zwischen Sektionen kurze redaktionelle Brücken-Absätze („Why this matters next…").

3. **Sticky-TOC mit Fortschrittsindikator**
   Aktive Sektion in Section-Nav hervorheben (Scroll-Spy). Optional dünner Progress-Bar oben.

4. **Methodology-Sektion ausbauen**
   Eigene Sektion (kein Drawer): Datenquelle, Update-Kadenz, Mixed-Model-Behandlung, Limitationen, Lizenz, Stand der Daten.

5. **Footer mit Trust-Signalen**
   Letztes Update, CSV-Download-Button, Quelle, Verantwortliche, Lizenz (CC BY 4.0?), Methodology-Link.

## C — Interaktivität

1. **Stacked / Grouped Toggle** im Trend-Chart (alle drei Kategorien zusammen sehen).
2. **Kategorie-Vergleich**: Multi-Select-Chips über einem Master-Chart (Shahed/Cruise/Ballistic an/aus).
3. **Brush/Zoom** im großen Chart statt nur DateRangeFilter — Drag-Auswahl direkt am Chart.
4. **Hover-Crosshair** mit synchronisiertem Tooltip in beiden Charts derselben Sektion.
5. **Share-Snapshot**: Button „Copy link to current view" — speichert Range + Kategorie in URL-Hash, beim Öffnen wiederhergestellt.
6. **Per-Sektion CSV-Download** der gefilterten Daten.
7. **Keyboard-Shortcuts** (g d / g c / g b für Sektionen, ? für Hilfe-Sheet) — kleines Power-User-Detail im FT-Stil.
8. **Light/Dark + High-Contrast** Mode.
9. **Live-Counter**: Statt einmaliger CountUp, jeden Monat beim Update kurz pulsen lassen.

## D — Querverlinkung zu externen Quellen (z.B. war-sanctions.gur.gov.ua)

Eine gut kuratierte „Related intelligence"-Sektion ist niedrigschwellig und sehr wertvoll. Vorschlag:

1. **Eigene Sektion „Related sources / Further reading"** vor dem Footer mit Karten-Grid:
   - **GUR war-sanctions** → Komponenten in russischen Waffen (https://war-sanctions.gur.gov.ua/en/components)
   - **Oryx** (visuell verifizierte Verluste)
   - **ISW** (Daily Russia Updates)
   - **Ukraine Air Force** (Originalquelle)
   - **CSIS Missile Threat** (Waffenprofile)
   - **Kiel Institute Ukraine Support Tracker**
   Jede Karte: Logo/Favicon, Titel, 1-Zeilen-Beschreibung, externer Link mit `rel="noopener external"` und `target="_blank"`.

2. **Kontextuelle Inline-Verlinkung**
   In den Waffenfamilien-Beschreibungen direkt verlinken: „Shahed-136 → siehe Komponentenanalyse bei GUR war-sanctions" — fließender, wie FT-Artikel Einzelnachweise einbauen.

3. **Component-Embed (optional)**
   Wenn GUR ein offenes Modell/JSON hat: ein „Top sanctioned components found in this week's downed drones" Widget einbetten, das live von dort lädt. Sonst statisch zitieren mit Stand-Datum.

4. **Backlinks anbieten**
   Klare Project-Page mit Logo/Kurztext/Embed-Snippet, damit andere Tracker zurücklinken können.

## E — Technische Verbesserungen (im Hintergrund)

- **SEO/OG**: dynamisches OG-Image mit aktueller Total-Zahl, JSON-LD `Dataset`-Schema, Canonical, sitemap.
- **Performance**: CSV einmal laden (heute zwei `fetch`-Calls auf dieselbe Datei), via React Query cachen.
- **A11y**: Charts mit `aria-label` + Daten-Tabelle als Fallback, Fokus-States für Section-Nav.
- **i18n-vorbereiten**: Texte in einer Strings-Datei, später UA/EN-Toggle.

## Empfohlene erste Iteration (kompakt, hoher Hebel)

1. Stacked Master-Chart oben mit Kategorie-Toggle + Brush/Zoom
2. Key-Events-Layer
3. Sektion „Related sources" inkl. GUR war-sanctions
4. Methodology als eigene Sektion + Footer mit Update-Stand & CSV-Download
5. Scroll-Spy in der Section-Nav

Sag mir, welche Punkte du angehen willst, dann setze ich daraus konkrete Arbeitspakete.
