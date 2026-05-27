## Ziel

Institutionelle Glaubwürdigkeit erhöhen (rechtlich sauberer Footer, sichtbare verantwortliche Person) und die Aufnahme in offene Daten-Portale vorbereiten, damit EU-Stäbe und Forscher den Datensatz finden.

## 1. About-Seite (`/about`)

Neue Route mit drei Blöcken:

- **Petro Ivaniuk — Data Curator**: kurze Bio, Rolle (Aggregation der täglichen AFU-Communiqués seit Oktober 2022), Links zu Kaggle, GitHub, optional ORCID/LinkedIn. Platzhalter-Avatar mit Initialen, falls kein Foto vorhanden.
- **Mission & Scope**: 2–3 Absätze — was die Seite ist (unabhängige OSINT-Aggregation), was sie nicht ist (keine offizielle AFU-Quelle, keine Echtzeit-Lageinformation).
- **Editorial principles**: Aufzählung — Datenquellen, Aktualisierungsrhythmus, Korrektur-Policy (Verweis auf `/changelog`), Lizenz (ODC-BY 1.0, wie in JSON-LD).

Verlinkt in der Hauptnavigation zwischen „Methodology" und „Sources" sowie im Footer.

## 2. Impressum / Legal Notice (`/imprint`)

Eigene Route, in allen vier Sprachen. Felder als Platzhalter, die der Nutzer ausfüllt:

- Betreiber (Name / ggf. Organisation)
- Anschrift
- E-Mail-Kontakt
- Verantwortlich i.S.d. § 18 Abs. 2 MStV
- Haftungsausschluss für externe Links
- Urheberrechtshinweis

Footer-Link „Imprint / Impressum" auf jeder Seite. Hinweis im Plan: tatsächliche Daten muss der Nutzer eintragen — ich setze deutlich markierte `TODO`-Platzhalter.

## 3. Footer-Aufwertung

Aktueller Footer wird zu einem dreispaltigen institutionellen Footer:

```text
About            Data              Legal
─────            ────              ─────
Mission          Methodology       Imprint
Petro Ivaniuk    Sources           Disclaimer
Changelog        Download CSV      License (ODC-BY 1.0)
                                   Contact
```

Plus eine Zeile: „Available in EN · DE · FR · UK" und „Last updated: …".

## 4. Open-Data-Metadaten (`public/data/`)

Drei statische Dateien, sodass die Einreichung bei Portalen nur noch Copy-Paste ist:

- **`public/data/datapackage.json`** — [Frictionless Data Package](https://specs.frictionlessdata.io/data-package/) Standard. Beschreibt das CSV-Schema, Lizenz, Maintainer, temporal/spatial coverage. Wird von Zenodo, HDX und CKAN-basierten Portalen (inkl. data.europa.eu) gelesen.
- **`public/data/README.md`** — Markdown-Datenkarte: Beschreibung, Quellen, Aktualisierungsrhythmus, Spaltendefinitionen, Beispielzitation (APA + BibTeX), Lizenz, Kontakt. Pflicht-Anhang für Zenodo-Deposits.
- **`public/data/SUBMISSION_GUIDE.md`** — interne Anleitung (nicht öffentlich verlinkt, aber auffindbar): Schritt-für-Schritt für die Einreichung bei **data.europa.eu**, **HDX (data.humdata.org)** und **Zenodo**. Welche Felder aus `datapackage.json` wohin gehören, geschätzte Bearbeitungszeit, was nach Annahme zu tun ist (DOI in JSON-LD `identifier` einfügen, Badge auf der Seite).

Diese Dateien werden über die Domain erreichbar und im JSON-LD-`Dataset`-Block als `distribution` referenziert.

## 5. JSON-LD ergänzen

In `index.html` den `Dataset`-Block erweitern:

- `identifier`: Platzhalter für künftige Zenodo-DOI
- `citation`: empfohlene Zitation als Text
- `maintainer`: Petro Ivaniuk (zusätzlich zu `creator`)
- `distribution` um den Datapackage-Eintrag erweitern

## 6. i18n

Neue Schlüssel in `de.json`, `en.json`, `fr.json`, `uk.json`:

- `nav.about`, `nav.imprint`
- `about.*` (Bio, Mission, Editorial principles — Bio-Text bleibt in EN, da Eigennamen/Berufstitel)
- `imprint.*` (Feldlabels)
- `footer.*` (neue Spaltenüberschriften, Lizenztext)

## 7. Routing

- `src/App.tsx`: zwei neue Routes (`/about`, `/imprint`)
- `src/pages/About.tsx`, `src/pages/Imprint.tsx` — beide nutzen `DocPageLayout`
- Hauptnav und Footer-Komponente entsprechend ergänzen

## Technische Details

- Keine neuen Dependencies. About/Imprint verwenden bestehende `DocPageLayout`-Komponente.
- Footer wird als eigene Komponente `src/components/SiteFooter.tsx` extrahiert (aktuell inline in `Index.tsx` / Doc-Layout), damit die neuen Links überall konsistent erscheinen.
- `datapackage.json` validierbar gegen Frictionless-Spec — Felder: `name`, `title`, `description`, `licenses`, `contributors`, `temporal`, `spatial`, `resources[]` mit `schema.fields[]` aus dem Aufbau von `missile_attacks_daily.csv`.
- README.md folgt der HDX-Datenkarte-Konvention (HDX akzeptiert standardisierte Markdown-Beschreibungen).

## Outreach-Pfad (nach Implementierung, kein Code)

Reihenfolge:
1. **Zenodo** zuerst — vergibt sofort einen DOI, der dann in data.europa.eu/HDX-Einträgen verlinkt wird (erhöht Glaubwürdigkeit der späteren Einreichungen).
2. **HDX** — manuelle Einreichung über UI, dauert 1–2 Wochen Review.
3. **data.europa.eu** — verweist meist auf nationale Open-Data-Portale; Direkteinreichung über das Portal-Formular.

Schritt-für-Schritt-Anleitung steht in `SUBMISSION_GUIDE.md`.

## Bewusst nicht in diesem Schritt

- Typografie-Umstellung auf Serif (separate Runde)
- Briefing-PDF-Generator (separate Runde)
- Outreach-E-Mail-Vorlagen für ISW/RUSI/SEDE/SWP (Folgerunde, sobald DOI vergeben ist)
