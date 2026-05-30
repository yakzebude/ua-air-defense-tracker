# Live News Ticker — Russische Luftangriffe auf die Ukraine

## Ziel
Ein full-width Lauftext-Ticker oben auf jeder Seite, der alle 5 Minuten aktuelle Meldungen zu russischen Luftangriffen aus mehreren RSS-Feeds bezieht, serverseitig filtert und im Frontend als laufende Zeile anzeigt.

## Architektur

```text
RSS-Feeds  ──►  Edge Function (Lovable Cloud)  ──►  JSON  ──►  React-Komponente (Ticker)
   (Kyiv Indep.,        - fetch + parse                              - auto-refresh 5 min
    Ukrainska Pravda,   - keyword-filter                             - marquee r→l
    Reuters Ukraine,    - dedupe + cache 5 min                       - pause on hover
    Euromaidan Press)   - return top 30                              - click → neuer Tab
```

## Backend — Supabase Edge Function `air-attack-news`

Datei: `supabase/functions/air-attack-news/index.ts`

- Lovable Cloud aktivieren (falls noch nicht geschehen) — liefert Edge-Function-Runtime.
- Function holt parallel mehrere RSS/Atom-Feeds:
  - `https://kyivindependent.com/rss/` (primär, englisch, hochwertig)
  - `https://www.pravda.com.ua/eng/rss/` (Ukrainska Pravda EN)
  - `https://euromaidanpress.com/feed/`
  - `https://www.ukrinform.net/rss/block-lastnews` (Ukrinform EN)
  - Optional ukr.net: kein offizieller Feed → vorerst weggelassen, Liste leicht erweiterbar via Array.
- XML-Parsing via `fast-xml-parser` (npm-Specifier).
- Keyword-Filter (case-insensitive, Titel + Description):
  `missile, drone, shahed, ballistic, kalibr, iskander, kinzhal, air raid, air defense, air strike, attack, strike, kyiv, odesa, kharkiv, lviv, dnipro, zaporizhzhia, mykolaiv`.
- Dedupe per normalisiertem Titel.
- Sortierung nach `pubDate` desc, Limit 30.
- In-Memory-Cache (Map) mit 5 min TTL pro Function-Instanz.
- CORS-Header gesetzt, `verify_jwt = false` (öffentlich).
- Response-Schema:
  ```json
  {
    "updatedAt": "2026-05-30T12:00:00Z",
    "items": [
      { "id": "sha1(url)", "title": "...", "url": "https://...", "source": "Kyiv Independent", "publishedAt": "2026-05-30T11:42:00Z" }
    ]
  }
  ```
- Fehlerbehandlung: Einzelne fehlschlagende Feeds werden übersprungen; bei 0 Items → `{ items: [] }` mit 200.

## Frontend — React-Komponente

Datei: `src/components/NewsTicker.tsx`

- Fetch via `supabase.functions.invoke('air-attack-news')` beim Mount + `setInterval(5*60*1000)`.
- State: `items`, `loading`, `error`.
- Rendering:
  - Full-width Leiste, `bg-[#111]`, weiße Schrift, mono-Font passend zum bestehenden OSINT-Stil.
  - Linke „LIVE“-Badge mit pulsierendem roten Punkt (nutzt existierende `--signal` HSL-Token via inline-Style auf #111-Background ok, oder eigenes Badge).
  - Marquee: zwei duplizierte Spans in einem Flex-Container, CSS-Keyframe `translateX(0 → -50%)` linear infinite ~60s.
  - Klasse `group` + `group-hover:[animation-play-state:paused]` für Pause beim Hover.
  - Items als `<a target="_blank" rel="noopener noreferrer">` mit Titel + kleinem Quellen-Tag, getrennt durch ` • `.
  - Ladezustand: „Loading air attack updates…“.
  - Fallback bei leer/Fehler: „No recent air attack updates available“.
- Keyframe in `src/index.css` ergänzt (`@keyframes ticker-scroll`).
- Mount in `src/App.tsx` ganz oben innerhalb `<BrowserRouter>`, vor `<Routes>`, damit auf allen Seiten sichtbar.
- Höhe fixiert (~36px), keine Layout-Shifts.

## Caching & Performance
- Server: In-Memory 5 min TTL.
- Client: kein zusätzliches Caching nötig, Intervall reicht; Komponente prüft `document.visibilityState` und pausiert Fetch wenn Tab inaktiv.

## Erweiterbarkeit
- Feed-Liste als Array oben in der Edge Function → neue Quellen mit einer Zeile.
- Keyword-Liste ebenfalls als Array.

## Out of Scope (jetzt)
- ukr.net Scraping (kein Feed, rechtlich heikel) — als Kommentar markiert, später nachrüstbar.
- i18n der Ticker-Strings (englisch belassen, da Feeds englisch).
- Persistenter DB-Cache (in-memory reicht für 5-min-Refresh).

## Schritte
1. Lovable Cloud aktivieren (falls nötig).
2. Edge Function `air-attack-news` anlegen (Fetch, Parse, Filter, Cache, CORS).
3. `NewsTicker.tsx` + Keyframe in `index.css`.
4. In `App.tsx` einbinden.
5. Visuell prüfen (Preview, Desktop + Mobile-Viewport).
