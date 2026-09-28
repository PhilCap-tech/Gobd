# 5 Eingangsrechnungen und E-Rechnungen

## 5.1 Eingang und erste Prüfung

{{answers.buchhaltung | or "Die Buchhaltung (Person ist zu benennen)"}} prüft Absender, Dateiformat, Lesbarkeit und offensichtliche Vollständigkeit. Verdächtige Anhänge werden nicht geöffnet oder weiterverarbeitet. Dubletten, falsche Empfänger oder fehlende Seiten werden vor Freigabe geklärt. Die empfangene Originaldatei bleibt unverändert.
{{#if answers.sichtung}}

Sichtung laut bestätigter Angabe: {{answers.sichtung}}.
{{/if}}
{{#if answers.erechnungVerfahren}}

Umgang mit dem strukturierten Teil laut bestätigter Angabe: {{answers.erechnungVerfahren}}.
{{/if}}

{{#if answers.eingangsbelege contains "E-Mail"}}
### E-Mail- und PDF-Eingang

Eingangsrechnungen per E-Mail werden anhand Absender, Leistung, Betrag und vorhandener Bestellung bzw. Vertragsunterlage geprüft. Die Originaldatei wird unverändert nach {{answers.archiv | or "dem Archiv (zu bestätigen)"}} übernommen. Belegrelevante Transportnachrichten werden mitaufbewahrt, soweit vorhanden.
{{/if}}

{{#if answers.eingangsbelege contains "PDF"}}
{{#unless answers.eingangsbelege contains "E-Mail"}}
### PDF-Eingang

PDF-Eingangsbelege werden auf Vollständigkeit und Nachvollziehbarkeit geprüft und unverändert abgelegt.
{{/unless}}
{{/if}}

{{#if answers.eingangsbelege contains "E-Rechnung"}}
## 5.2 Strukturierte E-Rechnungen

Bei strukturierten elektronischen Rechnungen ist die empfangene maschinenlesbare Datei (z. B. XML bzw. der strukturierte Anteil bei ZUGFeRD) das aufbewahrungspflichtige Original in dem Format, in dem sie empfangen wurde. Eine PDF- oder Bildschirmansicht dient nur der Lesbarkeit und ersetzt die strukturierte Originaldatei nicht. Abweichungen zwischen Ansicht und strukturiertem Inhalt werden vor einer Freigabe geklärt. Die konkrete technische Validierung und deren Nachweisführung sind nur dann als gelebter Prozess zu beschreiben, wenn sie im Intake bestätigt sind — andernfalls als offener Punkt.
{{/if}}

{{#if answers.eingangsbelege contains "ZUGFeRD"}}
{{#unless answers.eingangsbelege contains "E-Rechnung"}}
## 5.2 Strukturierte E-Rechnungen (ZUGFeRD)

Die empfangene Originaldatei bleibt erhalten; die Ansicht ersetzt nicht den strukturierten Teil. Technische Validierung und Protokollierung: siehe offene Punkte, sofern nicht gesondert bestätigt.
{{/unless}}
{{/if}}

{{#if answers.eingangsbelege contains "XRechnung"}}
{{#unless answers.eingangsbelege contains "E-Rechnung"}}
## 5.2 Strukturierte E-Rechnungen (XRechnung)

Die empfangene XML-Datei wird im ursprünglichen Format aufbewahrt. Technische Validierung und Protokollierung: siehe offene Punkte, sofern nicht gesondert bestätigt.
{{/unless}}
{{/if}}

{{#unless answers.eingangsbelege contains "E-Rechnung"}}
{{#unless answers.eingangsbelege contains "ZUGFeRD"}}
{{#unless answers.eingangsbelege contains "XRechnung"}}
## 5.2 Strukturierte E-Rechnungen

Ob strukturierte E-Rechnungen empfangen und wie sie technisch geprüft werden, ist aus dem Intake nicht bestätigt und bleibt zu beschreiben. Eine reine PDF per E-Mail ist nicht mit einer strukturierten E-Rechnung gleichzusetzen.
{{/unless}}
{{/unless}}
{{/unless}}

## 5.3 Sachliche Prüfung und Freigabe

{{answers.gf | or "Die Geschäftsführung (Person ist zu benennen)"}} prüft Leistungsbezug, Liefer- oder Leistungszeitraum, Betrag, Zahlungskonditionen und Bezug zu Bestellung oder Vertrag. Eigene Auslagen werden nicht selbst freigegeben. Abweichungen werden dokumentiert und vor Weitergabe zur Buchung geklärt.

## 5.4 Ausnahmen

| Fall | Behandlung |
| --- | --- |
| Dublettenverdacht | Beleg sperren, vorhandene Beleg-ID suchen, Ergebnis dokumentieren |
| Unlesbare oder defekte Datei | neue Datei beim Absender anfordern; defekte Eingangsdatei bis zur Klärung erhalten |
| XML und Sichtdarstellung weichen ab | keine Freigabe; strukturierte Daten prüfen und Absender kontaktieren |
| Unbekannter Absender | Leistungsbezug und Authentizität klären |
| Gutschrift oder Korrektur | Bezug zur Ursprungsrechnung herstellen und beide Fassungen erhalten |

{{#unless answers.eingangsbelege}}
*Eingangswege fehlen im Intake — Prüfung und Vorsortierung sind zu beschreiben (offener Punkt).*
{{/unless}}
