# Tägliche Kaggle-Synchronisation

Quelle: `piterfm/massive-missile-attacks-on-ukraine` (Kaggle, täglich aktualisiert).
Ziel: 1×/Tag um **06:00 UTC** automatisch alle CSVs ziehen, Rohdateien archivieren, Tabellen befüllen, Aggregate berechnen.

## Architektur

```text
pg_cron (06:00 UTC)
   └─► Edge Function `kaggle-sync`
         ├─ GET https://www.kaggle.com/api/v1/datasets/download/piterfm/massive-missile-attacks-on-ukraine
         │     Basic Auth: KAGGLE_USERNAME : KAGGLE_KEY  → liefert ZIP
         ├─ ZIP entpacken (in-memory)
         ├─ Storage-Bucket `kaggle-raw/<YYYY-MM-DD>/*.csv`  (Archiv)
         ├─ Pro CSV → public.kaggle_rows  (idempotenter Upsert per Hash)
         ├─ Aggregate neu berechnen → public.kaggle_aggregates
         └─ Run-Protokoll → public.sync_runs
```

## Was du einmalig tust

1. Kaggle-API-Token erzeugen: kaggle.com → Account → „Create New API Token" lädt `kaggle.json` mit `username` + `key`.
2. Wenn ich gleich danach frage, gibst du beides als Secrets ein:
   - `KAGGLE_USERNAME`
   - `KAGGLE_KEY`

## Datenmodell (Migration)

- **`public.kaggle_rows`** – generischer Speicher für alle CSV-Zeilen
  - `source_file text` (z. B. `missile_attacks_daily.csv`)
  - `row_hash text` (sha256 des Zeileninhalts, idempotenter Upsert-Key)
  - `data jsonb` (komplette Zeile als Objekt)
  - `event_date date` (extrahiert wenn vorhanden, für Index)
  - `synced_at timestamptz`
  - UNIQUE `(source_file, row_hash)`, Index auf `(source_file, event_date)`

- **`public.kaggle_aggregates`** – vorberechnet für schnelle Charts
  - `metric text` (z. B. `daily_launched`, `daily_destroyed`, `weapon_type_totals`)
  - `bucket text` (z. B. ISO-Datum oder Waffentyp)
  - `value numeric`
  - `dimensions jsonb` (zusätzliche Schnitte)
  - PK `(metric, bucket, dimensions)`

- **`public.sync_runs`** – Beobachtbarkeit
  - `source text` (`kaggle`), `started_at`, `finished_at`, `status` (`ok|error`),
    `files_processed int`, `rows_upserted int`, `error text`

Grants: `SELECT` für `anon` + `authenticated` auf `kaggle_rows` und `kaggle_aggregates` (öffentliche Visualisierungen); Schreibrechte nur `service_role`. `sync_runs`: nur `service_role`.
RLS aktiv, Lese-Policies `using (true)` für die beiden öffentlichen Tabellen.

## Storage

Bucket **`kaggle-raw`**, privat. Edge Function lädt mit Service-Role hoch und legt pro Tag einen Ordner an. Aufbewahrung manuell, ältere Stände bleiben als Rohbackup.

## Edge Function `kaggle-sync`

- POST/GET; kein JWT (per cron aufrufbar).
- Liest `KAGGLE_USERNAME`, `KAGGLE_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
- Lädt ZIP, entpackt mit `npm:fflate`, parst CSVs mit `npm:papaparse`.
- Schreibt Rohdatei nach Storage (`<date>/<filename>`).
- Upsert in `kaggle_rows` in Batches à 500 Zeilen.
- Aktualisiert `kaggle_aggregates` per einfachem SQL aus `kaggle_rows` (Tagesreihen, Summen je Waffentyp).
- Protokoll in `sync_runs`.
- 429/5xx von Kaggle → einmal Retry mit Backoff, dann Fehlerstatus.

## Zeitplan

`pg_cron` (via `supabase--insert`, nicht Migration, da projekt-spezifische URL/Key enthalten):

```sql
select cron.schedule(
  'kaggle-sync-daily',
  '0 6 * * *',
  $$ select net.http_post(
       url:='https://<project>.functions.supabase.co/kaggle-sync',
       headers:='{"Content-Type":"application/json","apikey":"<anon>"}'::jsonb,
       body:='{}'::jsonb) $$
);
```
Extensions `pg_cron` + `pg_net` werden in derselben Migration aktiviert.

## Bedienung im Frontend

Kleiner Admin-Button („Jetzt synchronisieren") + Statuszeile (letzter Lauf, Anzahl Zeilen, Fehler) auf einer geschützten Methoden-Seite. Charts lesen ausschließlich aus `kaggle_aggregates` bzw. gefiltert aus `kaggle_rows`.

## Kosten / Quoten

- Kaggle: ein Download/Tag, keine harte Quote für persönliche API-Tokens; Datei aktuell <50 MB.
- Edge Function: 1 Lauf/Tag, irrelevant für Limits.
- Storage: ~1 Datei-Set/Tag, vernachlässigbar.

## Offene Punkte, die ich beim Bauen entscheide
- Genaue Liste der CSV-Spalten lese ich aus dem ersten Sync (Header-Mapping landet in `kaggle_rows.data` 1:1).
- Welche Aggregate genau? Standardstart: tägliche Starts/Abschüsse, Summen je Waffentyp, kumulativ. Erweiterung danach trivial.

## Verifikation
- Nach Deploy einmal manuell triggern → `sync_runs` zeigt `status=ok`, Storage enthält Tagesordner, `kaggle_rows`/`kaggle_aggregates` haben Zeilen.
- Zweiter Lauf am selben Tag → keine Duplikate (Hash-Unique greift).
