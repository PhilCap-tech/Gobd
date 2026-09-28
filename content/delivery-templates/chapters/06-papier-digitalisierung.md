# 6 Papierbelege und Digitalisierung

{{#if answers.papierannahme}}
Papierannahme laut bestätigter Angabe: {{answers.papierannahme}}.
{{/if}}
{{#if answers.scanZweck}}
Scan-Zweck laut bestätigter Angabe: {{answers.scanZweck}}.
{{/if}}
{{#if answers.papierlager}}
Papierablage laut bestätigter Angabe: {{answers.papierlager}}.
{{/if}}

## 6.1 Posteingang

{{answers.buchhaltung | or "Die Buchhaltung (Person ist zu benennen)"}} versieht eingehende Papierbelege mit dem Eingangsdatum, prüft die Vollständigkeit und legt sie bis zur Bearbeitung in einer gekennzeichneten Eingangsmappe ab. Schutzwürdige Post wird ungeöffnet an die benannte Person weitergegeben.

## 6.2 Digitalisierung

Papierbelege werden für die Bearbeitung gescannt. Der Scan wird auf Lesbarkeit, Vollständigkeit, richtige Ausrichtung und Seitenzahl geprüft und anschließend in {{answers.archiv | or "die digitale Ablage (zu bestätigen)"}} abgelegt. Der Dateiname oder die Beleg-ID ermöglicht die Zuordnung zum Papieroriginal.

## 6.3 Keine ersetzende Vernichtung (Standardhinweis)

Solange kein dokumentiertes ersetzendes Scanverfahren bestätigt ist, bleibt das Papieroriginal erhalten. Es werden keine Aussagen getroffen, dass Originale nach dem Scan vernichtet werden dürfen. Eine spätere Umstellung erfordert einen eigenen, detaillierten Prozess, geeignete Kontrollen und eine neue Fassung.

## 6.4 Papierablage

Papieroriginale werden nach Jahr, Monat und Belegart geordnet verwahrt. Zugriff haben die berechtigten Personen laut {{answers.zugriff | or "Zugriffskreis (zu bestätigen)"}}. Entnahmen erfolgen nur für betriebliche Zwecke; anschließend wird der Beleg unverzüglich zurückgelegt. Ort und Ordnung der Papierablage sind zu bestätigen, soweit nicht im Intake spezifiziert — siehe offene Punkte.
