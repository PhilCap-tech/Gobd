# 8 Prüfung, Freigabe und Buchungsübergabe

## 8.1 Statusfolge

| Status | Bedeutung | Nächster zulässiger Schritt |
| --- | --- | --- |
| Eingegangen | Datei oder Papier liegt vor | formale und sachliche Prüfung |
| In Klärung | Angabe fehlt oder Widerspruch besteht | Klärung dokumentieren |
| Freigegeben | Leistungsbezug und Betrag bestätigt | Bereitstellung zur Buchung |
| Zur Buchung bereitgestellt | Beleg ist der Buchung zugänglich | Buchung oder Rückfrage |
| Gebucht | Buchung und Beleg-ID sind verbunden | Aufbewahrung und Kontrolle |

## 8.2 Übergabe an die Buchung / Kanzlei

{{answers.buchhaltung | or "Die Buchhaltung (Person ist zu benennen)"}} stellt freigegebene Belege in geeignetem Turnus bereit (mindestens monatlich, soweit nicht anders bestätigt). {{#if answers.steuerberater}}{{answers.steuerberater}} übernimmt Tätigkeiten ausschließlich im vereinbarten Mandatsumfang. Eine allgemeine fachliche Freigabe der Verfahrensdokumentation durch die Kanzlei ist damit nicht verbunden.{{/if}}{{#unless answers.steuerberater}}Sofern eine externe Kanzlei beteiligt ist, ist der Mandatsumfang zu bestätigen.{{/unless}}

## 8.3 Vollständigkeitsabgleich

Zum Periodenabschluss vergleicht {{answers.buchhaltung | or "die Buchhaltung"}} die Liste freigegebener Belege mit der Übergabeübersicht. Offene oder zurückgewiesene Vorgänge bleiben sichtbar. {{answers.gf | or "Die Geschäftsführung"}} erhält eine Übersicht nicht abgeschlossener Fälle.

## 8.4 Verbindung von Beleg und Buchung

Die Verbindung erfolgt über die Beleg-ID in {{answers.archiv | or "der Belegablage (zu bestätigen)"}} und die Zuordnung in {{answers.fibu | join ", " | or "der FiBu (zu bestätigen)"}}.{{#if answers.belegId}} Beleg-ID laut bestätigter Angabe: {{answers.belegId}}.{{/if}} Ergänzende Unterlagen werden so abgelegt, dass der Bezug zum Geschäftsvorfall erkennbar bleibt.
