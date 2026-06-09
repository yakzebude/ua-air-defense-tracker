# Falsche Regionen in der Live-Karte beheben

## Ursache

Die Edge Function `air-alerts` interpretiert die 27-Zeichen-Antwort der `/v1/iot/active_air_raid_alerts_by_oblast.json` API mit einer **falschen Oblast-Reihenfolge**.

Aktuell (falsch) wird angenommen, die Reihenfolge sei „alphabetisch nach ukrainischem Namen, mit Krim/Kyiv/Sewastopol am Ende". Laut [offizieller Doku](https://devs.alerts.in.ua/) ist die korrekte Reihenfolge jedoch:

```
1.  Автономна Республіка Крим   (UA-43)
2.  Волинська область           (UA-07)
3.  Вінницька область           (UA-05)
4.  Дніпропетровська область    (UA-12)
5.  Донецька область            (UA-14)
6.  Житомирська область         (UA-18)
7.  Закарпатська область        (UA-21)
8.  Запорізька область          (UA-23)
9.  Івано-Франківська область   (UA-26)
10. м. Київ                     (UA-30)
11. Київська область            (UA-32)
12. Кіровоградська область      (UA-35)
13. Луганська область           (UA-09)
14. Львівська область           (UA-46)
15. Миколаївська область        (UA-48)
16. Одеська область             (UA-51)
17. Полтавська область          (UA-53)
18. Рівненська область          (UA-56)
19. м. Севастополь              (UA-40)
20. Сумська область             (UA-59)
21. Тернопільська область       (UA-61)
22. Харківська область          (UA-63)
23. Херсонська область          (UA-65)
24. Хмельницька область         (UA-68)
25. Черкаська область           (UA-71)
26. Чернівецька область         (UA-77)
27. Чернігівська область        (UA-74)
```

Konkretes Beispiel: Bei der API-Antwort `"NANNNNN..."` ist Volyn aktiv. Unsere bisherige Logik zeigt aber **Volyn → falsche Position 2**, mappt aber „Position 2 = Volyn" zufällig richtig. Probleme treten dort auf, wo offizielle und alphabetische Reihenfolge auseinanderlaufen – z. B. Position 1 (Krim vs. Vinnytsia), Position 3 (Vinnytsia vs. Dnipropetrovsk), Position 10 (Kyiv-Stadt vs. Kyiv-Oblast), Position 19 (Sevastopol vs. Kharkiv). Das erklärt genau das beobachtete Phänomen, dass „ganz andere Regionen" leuchten als auf alerts.in.ua.

## Änderungen

### 1. `supabase/functions/air-alerts/index.ts`
- `ORDER`-Array exakt auf die offizielle Reihenfolge der API-Doku umstellen (siehe oben).
- Bei der Cache-Invalidation: vorhandene `lastState`-Einträge bleiben gültig (Schlüssel = ISO-Code, unverändert).
- Antwortformat bleibt gleich – kein Frontend-Vertragsbruch.

### 2. „Nur rote Alarme" Filterung in `src/components/AirAlertsMap.tsx`
- Karten-Einfärbung: nur `state === "full"` → rot (`--signal`) mit Pulsanimation. `state === "partial"` wird **nicht** mehr eingefärbt (neutral wie `none`).
- Side-Panel: nur Einträge mit `state === "full"` listen.
- Status-Pille oben („X aktive Alarme") zählt nur volle Alarme.
- Legende/Strings entsprechend reduzieren: kein „Partial"-Badge mehr.

### 3. i18n
- Aus `en.json`, `de.json`, `fr.json`, `uk.json` die Strings `partialAlert` und die zugehörigen Legenden-Einträge entfernen bzw. unbenutzt lassen.

## Nicht Teil dieser Änderung
- Token, Polling-Intervall, Caching, Edge-Function-Vertrag bleiben unverändert.
- Daten der `partial`-Alarme werden vom Backend weiterhin geliefert (für eine spätere optionale Ebene), aber UI-seitig ignoriert.

## Verifikation
- Nach Deploy `supabase--curl_edge_functions` auf `air-alerts` → prüfen, dass Oblasts mit `state: "full"` exakt der Live-Karte auf alerts.in.ua entsprechen (Stichprobe 2–3 Regionen, z. B. Sumy, Kharkiv, Kyiv-Stadt vs. Kyiv-Oblast).
- Im Browser-Preview: Karte zeigt nur rote Polygone, Side-Panel listet die gleichen Oblasts wie die Quellseite.
