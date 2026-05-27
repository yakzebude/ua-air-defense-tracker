# UA Defense Tracker — Ukraine air defense aggregated data

Daily reports of aerial threats launched at Ukraine and confirmed interceptions
by Ukrainian air defence forces. Coverage starts **October 2022** and continues
to the present.

- **Homepage:** https://ua-airdefense-tracker.org/
- **License:** [Open Data Commons Attribution License (ODC-BY 1.0)](https://opendatacommons.org/licenses/by/1-0/)
- **Maintainer:** Petro Ivaniuk — https://www.kaggle.com/piterfm
- **Primary source:** Air Force Command of the Armed Forces of Ukraine
  (Повітряні сили ЗСУ), daily bulletins.

## Files

| File | Description |
|------|-------------|
| `missile_attacks_daily.csv` | Per-window record of launched and intercepted weapons by model. |
| `datapackage.json` | [Frictionless Data Package](https://specs.frictionlessdata.io/data-package/) schema describing the CSV. |

## Methodology summary

1. Daily AFU bulletins are mirrored as a CSV via the
   ["Massive Missile Attacks on Ukraine"](https://www.kaggle.com/datasets/piterfm/massive-missile-attacks-on-ukraine)
   Kaggle dataset.
2. Each row covers one reporting window (typically overnight) and lists one or
   more weapon models, the count launched, and the count reported as destroyed.
3. The UA Defense Tracker site aggregates these rows to calendar months (UTC),
   then groups models into three families:
   - **UAVs** — Shahed-136/131 and other loitering / reconnaissance UAVs.
   - **Cruise** — Kalibr, X-101/X-555, X-22, X-32, X-59/X-69, Iskander-K, Oniks, etc.
   - **Ballistic** — Iskander-M / KN-23, Kinzhal, Zircon, S-300/S-400 surface-to-surface, ICBM-class.

Full methodology and limitations:
https://ua-airdefense-tracker.org/methodology

## Update cadence

Refreshed when new daily bulletins are published — typically within hours of the
morning AFU briefing. Historical figures may be revised retroactively when
upstream bulletins are corrected; revisions are logged at
https://ua-airdefense-tracker.org/changelog

## Suggested citation

**APA**

> Ivaniuk, P. (2026). *UA Defense Tracker — Ukraine air defense aggregated data*
> [Dataset]. https://ua-airdefense-tracker.org/

**BibTeX**

```bibtex
@dataset{ivaniuk_ua_airdefense_2026,
  author = {Ivaniuk, Petro},
  title  = {UA Defense Tracker — Ukraine air defense aggregated data},
  year   = {2026},
  url    = {https://ua-airdefense-tracker.org/},
  note   = {Aggregated from Ukrainian Air Force Command daily reports}
}
```

## What this dataset is not

- Not an official AFU release. UA Defense Tracker is independent and
  not affiliated with the Government of Ukraine, the Armed Forces of Ukraine,
  NATO or the European Union.
- Not a real-time / early-warning feed. Treat hour-level changes as noise.
- Not a casualty figure. Out of scope.
- Not independently verified — figures reflect AFU reporting and are
  subject to the limitations documented at /methodology.

## Contact

Corrections and questions: see https://ua-airdefense-tracker.org/about
