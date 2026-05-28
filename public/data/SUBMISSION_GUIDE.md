# Open-Data-Portale: Einreichungs-Leitfaden

Dieser Leitfaden beschreibt Schritt für Schritt die Aufnahme des UA Defense
Tracker Datensatzes in drei zentrale offene Daten-Portale, damit
Journalisten, EU-Stäbe und Forscher den Datensatz dort finden, wo sie
ohnehin suchen.

**Reihenfolge (empfohlen):**

1. **Zenodo** zuerst → vergibt sofort eine DOI.
2. **HDX** → ergänzt humanitäre Sichtbarkeit, akzeptiert Zenodo-DOI als Referenz.
3. **data.europa.eu** → finale Stufe; europäisches Pendant zu data.gov.

---

## 1. Zenodo (CERN) — DOI-Vergabe

**Warum zuerst:** Zenodo vergibt beim Upload sofort einen permanenten DOI.
Dieser DOI wird dann bei HDX und data.europa.eu als „persistent identifier"
referenziert und erhöht die Glaubwürdigkeit jeder weiteren Einreichung.

**Voraussetzungen:** Kostenloses Konto auf https://zenodo.org/ (ORCID-Login möglich).

**Vorgehen:**

1. Auf https://zenodo.org/uploads/new gehen.
2. **Resource type:** *Dataset*.
3. **Files hochladen:**
   - `missile_attacks_daily.csv`
   - `datapackage.json`
   - `README.md`
4. **Title:** *UA AirDefense Tracker — Ukraine air defense aggregated data*
5. **Authors:** Ivaniuk, Petro (ORCID ergänzen, falls vorhanden).
6. **Description:** Inhalt von `README.md` einfügen (Markdown wird gerendert).
7. **License:** *Open Data Commons Attribution (ODC-BY) v1.0*.
8. **Keywords:** ukraine, air-defense, osint, shahed, cruise-missile,
   ballistic-missile, interception-rate, russia, war.
9. **Related identifiers:**
   - *is supplement to* → https://ua-airdefense-tracker.org/
   - *is derived from* → https://www.kaggle.com/datasets/piterfm/massive-missile-attacks-on-ukraine
10. **Funding / Grants:** leer lassen.
11. **Publish** → DOI wird sofort vergeben (Format: `10.5281/zenodo.XXXXXXX`).

**Nach Annahme:**

- DOI im JSON-LD-Block in `index.html` als `identifier` ergänzen.
- DOI-Badge im Footer / About-Seite einfügen.
- Bei künftigen Updates eine **neue Version** auf demselben Zenodo-Eintrag
  hochladen (Zenodo vergibt dann automatisch versionierte DOIs, der
  "concept DOI" bleibt stabil).

**Bearbeitungszeit:** sofort.

---

## 2. Humanitarian Data Exchange (HDX) — OCHA

**Warum:** HDX ist das zentrale humanitäre Daten-Portal der UN OCHA, intensiv
genutzt von NGOs, EU-Humanitärabteilungen und Forschung. Eine Listung dort
erreicht ein anderes Publikum als Zenodo.

**Voraussetzungen:** Kostenloses Konto auf https://data.humdata.org/.

**Vorgehen:**

1. Auf https://data.humdata.org/dashboard/datasets neuen Eintrag anlegen.
2. **Organisation:** Falls noch keine eigene Organisation existiert,
   eine beantragen („Request a new organisation") — Review durch HDX-Team
   dauert 2–5 Tage.
3. **Dataset name:** *ukraine-air-defense-aggregated-data*
4. **Title:** *UA AirDefense Tracker — Ukraine air defense aggregated data*
5. **Source:** Air Force Command of the Armed Forces of Ukraine
6. **License:** Open Data Commons Attribution License (ODC-BY 1.0)
7. **Methodology:** „Other" → Link auf https://ua-airdefense-tracker.org/methodology
8. **Caveats / Comments:** Aus `disclaimerPage` der Seite übernehmen
   (kurz: einseitige Quellenlage, Revisionen möglich, kein
   Frühwarnsystem).
9. **Tags:** *conflict-violence*, *ukraine*, *protection*.
10. **Location:** Ukraine.
11. **Resources hochladen:** `missile_attacks_daily.csv` und
    `datapackage.json`.
12. **Time period:** Start 2022-10-01, End: „ongoing".
13. **Update frequency:** *Live* (HDX akzeptiert auch *Every week*).
14. **Submit for review.**

**Bearbeitungszeit:** 1–2 Wochen Review durch HDX-Kurator.

---

## 3. data.europa.eu — EU Open Data Portal

**Warum:** Das offizielle Daten-Portal der EU. Wird von Referenten in
EU-Parlament, Kommission, EEAS und EDA als erstes konsultiert.

**Wichtig:** data.europa.eu ist primär ein **Aggregator**. Es harvested
Datensätze automatisch von nationalen Open-Data-Portalen (z. B.
GovData.de, data.gouv.fr) sowie von EU-Institutionen. Direkteinreichung
ist über die Kontakt-Funktion möglich, aber der zuverlässigere Weg ist
die Einreichung in ein nationales Portal, von dem aus data.europa.eu
automatisch übernimmt.

**Empfohlener Weg für Deutschland — GovData.de:**

1. Auf https://www.govdata.de/web/guest/anmeldung registrieren.
2. Neuen Datensatz anlegen, **DCAT-AP** als Format wählen (datapackage.json
   ist DCAT-kompatibel).
3. Felder analog zu HDX ausfüllen; zusätzlich:
   - **Kategorie:** *Internationale Themen* + *Bevölkerung und Gesellschaft*
   - **Geodaten:** Ukraine (UN/LOCODE: UA)
   - **Sprache:** Englisch (zusätzlich Deutsch markieren, da Seite mehrsprachig)
4. **Resource-URLs** direkt auf die Live-Dateien zeigen:
   - https://ua-airdefense-tracker.org/data/missile_attacks_daily.csv
   - https://ua-airdefense-tracker.org/data/datapackage.json
5. Veröffentlichen.

**Übernahme nach data.europa.eu:** automatisch innerhalb von 1–2 Wochen
durch den GovData → data.europa.eu Harvester.

**Alternative für Frankreich:** https://www.data.gouv.fr/
**Alternative für Ukraine selbst:** https://data.gov.ua/

---

## Nach erfolgreicher Listung

1. **Badges** auf der About-Seite hinzufügen (Zenodo, HDX, data.europa.eu).
2. **JSON-LD in `index.html`** um Felder `sameAs` mit allen Portal-URLs
   ergänzen — verstärkt das Knowledge-Graph-Signal für Google Dataset
   Search.
3. **Outreach starten:** kurzes E-Mail an Multiplikatoren (ISW, RUSI,
   SEDE-Sekretariat, SWP Berlin, IFRI Paris) mit Link zur Seite und
   zum Zenodo-DOI.
