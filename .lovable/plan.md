
# Live-Karte: Luftalarme Ukraine

## Datenquelle

**alerts.in.ua** – offizielle API hinter neptun.in.ua, alerts.in.ua, vielen Telegram-Bots. Liefert Status für alle 27 Oblaste und ~1.500 Hromadas (Rajone/Gemeinden) inkl. Startzeit jedes Alarms.

- Endpoint: `https://api.alerts.in.ua/v1/alerts/active.json`
- Auth: Bearer Token (kostenlos per E-Mail an `api@alerts.in.ua` mit kurzer Projektbeschreibung; meist innerhalb 1–2 Tagen).
- Rate Limit: alle 30 Sek. erlaubt → unser 5-Min-Intervall ist unkritisch.
- Lizenz: Attribution erforderlich („Data: alerts.in.ua").

Token wird als Secret `ALERTS_IN_UA_TOKEN` hinterlegt.

## Architektur

```text
alerts.in.ua API
        │  (Bearer Token, alle 60s gecached)
        ▼
Edge Function  air-alerts   ─►  JSON  ─►  React-Komponente AirAlertsMap
- fetch + normalisieren                   - Auto-Refresh 5 Min
- in-memory Cache 60s                     - Choropleth (SVG)
- CORS, public                            - Hover-Tooltip, Click-Panel
```

## Backend — Edge Function `air-alerts`

Datei: `supabase/functions/air-alerts/index.ts`

- Holt `active.json` mit Bearer-Token.
- Normalisiert auf:
  ```json
  {
    "updatedAt": "2026-05-31T12:00:00Z",
    "oblasts": [
      { "id": "UA-32", "name": "Kyiv Oblast", "active": true, "since": "2026-05-31T11:42:00Z", "type": "air_raid" }
    ],
    "hromadas": [
      { "id": "UA-32-1234", "name": "...", "oblastId": "UA-32", "active": true, "since": "...", "type": "air_raid" }
    ]
  }
  ```
- In-Memory Cache 60s.
- CORS public, `verify_jwt = false` (Standard für Lovable-Edge-Functions).
- Fehler-Fallback: leere Listen + Fehlerflag.

## Geo-Daten

Zwei statische GeoJSON-Dateien in `public/geo/`:
- `ua-oblasts.geo.json` (~120 KB, 27 Polygone)
- `ua-hromadas.geo.json` (~1.5 MB, ~1500 Polygone, vereinfacht via mapshaper auf ~10 % der Originalpunkte)

Quelle: OpenStreetMap / `simplemaps` / `deepstatemap` (CC-BY). IDs werden mit den alerts.in.ua-IDs gematcht (KOATUU-Codes).

Werden lazy-geladen — `hromadas` nur, wenn der Nutzer in die Detailansicht zoomt oder die Karte auf `/alerts` öffnet, damit die Startseite nicht durch 1.5 MB belastet wird.

## Frontend

### Komponente `src/components/AirAlertsMap.tsx`
- Rendering mit **react-simple-maps** (leichtgewichtig, SVG, keine API-Keys, gut zoom-/pan-bar). Wird via `bun add react-simple-maps d3-geo` installiert.
- Props: `variant: "compact" | "full"`.
  - `compact` (Startseite): nur Oblaste, fixe Höhe ~420 px, kein Zoom, Klick öffnet `/alerts`.
  - `full` (/alerts): Oblaste + Hromadas, Zoom/Pan, Seitenpanel.
- Aktive Oblaste/Hromadas: rot mit sanfter Puls-Animation (CSS-Keyframe analog zu existierender `pulse-soft`-Klasse).
- Inaktive: dunkles Neutralgrau passend zum bestehenden OSINT-Theme.
- Tooltip beim Hover: Name, Dauer („active for 23 min"), Typ.
- Legende unten: Anzahl aktiver Oblaste, „Last update HH:MM:SS", Quelle „alerts.in.ua".
- Auto-Refresh `setInterval(5 * 60 * 1000)`, pausiert wenn Tab inaktiv (`document.visibilityState`).

### Detailpanel `src/components/AirAlertsPanel.tsx`
Slide-in rechts (Sheet-Komponente aus shadcn). Bei Klick auf Oblast:
- Aktueller Status + Dauer
- Liste der aktiven Hromadas innerhalb dieser Oblast
- Link zur offiziellen Quelle alerts.in.ua/?oblast=…

### Integration

1. **Startseite** (`src/pages/Index.tsx`): neuer Block „Live air-raid alerts" zwischen Statistiken und Waffenkatalog, `<AirAlertsMap variant="compact" />`, mit „View full map →"-Link auf `/alerts`.
2. **Neue Route** `/alerts` (`src/pages/Alerts.tsx`): Vollbild-Karte mit Detailpanel, eingebunden in `src/App.tsx` und der Hauptnavigation.
3. **i18n**: neue Keys in `en.json`, `de.json`, `fr.json`, `uk.json` (Titel, Legende, Panel-Labels, Tooltips).

## Refresh-Verhalten
- Client: 5-Min-Intervall, pausiert bei inaktivem Tab, sofortiger Re-Fetch beim Tab-Wechsel zurück.
- Server: 60-Sek-Cache pro Edge-Function-Instanz (verhindert API-Hammering bei vielen Clients).

## Out of Scope (für später)
- Historie / Alarm-Dauer-Charts (alerts.in.ua bietet `regions_history.json` — kann später ergänzt werden).
- Push-Notifications.
- Mobile-optimiertes Bottom-Sheet statt Side-Panel (kommt bei Bedarf).

## Schritte
1. Token bei alerts.in.ua anfragen (User-Aktion, parallel möglich) und als Secret `ALERTS_IN_UA_TOKEN` hinterlegen.
2. Edge Function `air-alerts` erstellen.
3. GeoJSON-Dateien generieren/herunterladen und nach `public/geo/` legen.
4. `react-simple-maps` + `d3-geo` installieren.
5. Komponenten `AirAlertsMap` + `AirAlertsPanel` bauen.
6. Block auf Startseite + neue Route `/alerts` einbinden, Navigation ergänzen.
7. i18n-Strings ergänzen (4 Sprachen).
8. Visuell prüfen (Desktop + Mobile).

## Was ich von dir brauche, bevor es losgeht
- **Token bei alerts.in.ua anfordern**: Mail an `api@alerts.in.ua` mit kurzem Text wie „Requesting API access for ua-airdefense-tracker.org — non-commercial OSINT tracker, will display attribution". Sobald du den Token hast, sage Bescheid, dann setze ich den Secret-Dialog für `ALERTS_IN_UA_TOKEN` auf.
- Falls die Token-Vergabe zu lange dauert: ich kann initial gegen den ungetokenten, weniger zuverlässigen Endpoint `war.ukrzen.in.ua` bauen und später umstellen — sag Bescheid, falls du das willst.
