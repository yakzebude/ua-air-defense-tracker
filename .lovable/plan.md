# Live Air-Raid Alerts (alerts.in.ua) – Map Integration

## Status quo
- Edge Function `supabase/functions/air-alerts/index.ts` already exists and uses `/v1/alerts/active.json` (full alert objects).
- Secret `ALERTS_IN_UA_TOKEN` is set, but **upstream returns HTTP 401 "Invalid API token"** on every recent invocation.
- `src/components/AirAlertsMap.tsx` already renders the Ukraine map and consumes this function.

So the change is mostly: switch endpoint, fix token, simplify shape, render colored oblasts + a side list, poll every 30 s.

## Credits clarification (for your reference)
- API polling does **not** consume Lovable build credits.
- Only Lovable Cloud Edge-Function invocations + outbound bandwidth count (covered by the monthly $25 free Cloud balance).
- alerts.in.ua's own quota applies (their docs recommend min 30 s between calls — we'll respect that).

## Plan

### 1. Edge Function `air-alerts` (rewrite)
Switch from `/v1/alerts/active.json` to **`/v1/iot/active_air_raid_alerts_by_oblast`** (per your choice).

- That endpoint returns a 27-char string where each character represents one oblast's state:
  `N` = no alert · `A` = active air-raid alert · `P` = partial (some raions only)
- Map each position → ISO-3166-2 code (reuse existing `UID_TO_ISO`/`ISO_TO_EN` constants, re-keyed by position index per official docs).
- Normalize to:
  ```ts
  { fetchedAt: ISO, oblasts: [{ iso, name, nameEn, state: 'none'|'partial'|'full' }] }
  ```
- Keep 30 s in-memory cache, CORS headers, graceful error JSON with `status: 'unavailable' | 'delayed' | 'ok'`.
- On 401: return `{ status: 'unauthorized' }` so the frontend shows a clear banner instead of generic error.

### 2. Token check
The current token is rejected by the API (HTTP 401). I'll request a refresh via the secret update flow so you can paste the new token from your alerts.in.ua dashboard. The IoT endpoint requires a token with **IoT access** enabled — please confirm that scope when issuing it.

### 3. Frontend – `AirAlertsMap.tsx`
- Poll every **30 s** with `setInterval` + `AbortController`; pause when tab hidden (`document.visibilityState`) to save quota.
- Color logic for the SVG/GeoJSON regions:
  - `none` → neutral fill (existing base color)
  - `partial` → amber (`hsl(var(--weapon-cruise))`, ~40% opacity)
  - `full` → red (`hsl(var(--weapon-ballistic))`, ~70% opacity) + subtle pulse animation
- Add an **"Active alerts" side panel** beside the map:
  - Sorted list of oblasts with `full`/`partial` state
  - Shows oblast name + state badge + (where available) duration since `fetchedAt` switched
  - Empty state: "No active alerts" with green check
- Status pill above the map: `Live · updated 12 s ago` / `Delayed` / `Live feed unavailable`.

### 4. Layout
Two-column layout on `lg+` (map 2/3, list 1/3); stacked on mobile. Reuse existing `<StatusBadge>` and card styles — no new design tokens.

### 5. i18n
Add strings to `en.json` / `de.json` / `fr.json` / `uk.json`:
`activeAlerts`, `noActiveAlerts`, `partialAlert`, `fullAlert`, `liveUpdated`, `feedUnauthorized`.

### 6. Technical notes
- No DB changes, no new dependencies.
- Polling is client-side only; each browser tab triggers its own edge-function call (cached server-side for 30 s, so concurrent tabs share the same upstream hit).
- Token stays server-side; frontend never sees it.

## Open question before I build
The current token gets `401`. Two options:
1. **You paste a new IoT-enabled token** → I update the secret and ship.
2. **You confirm the existing token should work** → I'll add diagnostics and we debug from logs.

Tell me which, and I'll proceed.
