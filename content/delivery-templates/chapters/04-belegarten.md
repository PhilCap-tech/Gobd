# 4 Belegarten und Eingangskanäle

Kanäle nur, wenn das Intake sie nennt. E-Mail und PDF sind kein Scan und keine strukturierte E-Rechnung.

| Belegart und Weg | Original und Ablage |
| --- | --- |
{{#if answers.eingangsbelege contains "E-Mail"}}| Eingangsrechnung per E-Mail | Datei aus dem genannten Kanal geht nach {{answers.archiv | or "das Archiv (zu bestätigen)"}}. Ein Verfahren gegen Überschreiben ist nicht gesondert bestätigt. |{{/if}}
{{#if answers.eingangsbelege contains "PDF"}}| Eingangsrechnung als PDF | PDF geht in die Ablage. PDF ist hier keine strukturierte E-Rechnung. |{{/if}}
{{#if answers.eingangsbelege contains "E-Rechnung"}}| Strukturierte E-Rechnung | Die empfangene strukturierte Datei bleibt das Original. Eine PDF-Ansicht ist nur Lesehilfe. |{{/if}}
{{#if answers.eingangsbelege contains "ZUGFeRD"}}| Strukturierte E-Rechnung (ZUGFeRD) | Die empfangene Originaldatei bleibt erhalten; die Ansicht ersetzt den strukturierten Teil nicht. |{{/if}}
{{#if answers.eingangsbelege contains "XRechnung"}}| Strukturierte E-Rechnung (XRechnung) | Die empfangene XML-Datei wird im ursprünglichen Format aufbewahrt. |{{/if}}
{{#if answers.eingangsbelege contains "Papier"}}| Papierbeleg | Weg ist genannt. Scan, Vernichtung und Lagerort sind zu bestätigen. |{{/if}}
{{#if answers.eingangsbelege contains "Scan"}}| Scan | Weg ist genannt. Umgang mit dem Papieroriginal ist zu bestätigen. |{{/if}}
{{#if answers.eingangsbelege contains "Portal"}}| Portal / Download | Belegdatei aus dem genannten Portalweg. |{{/if}}
{{#if answers.ausgangsrechnungen}}| Ausgangsrechnung | Erstellung über {{answers.ausgangsrechnungen | join ", "}}. Versand, Nummernkreis und Korrektur sind nicht beschrieben. |{{/if}}

{{#unless answers.eingangsbelege}}*Eingangswege sind im Intake nicht angegeben — siehe offene Punkte.*{{/unless}}

{{#unless answers.eingangsbelege contains "Papier"}}{{#unless answers.eingangsbelege contains "Scan"}}*Papierweg laut Intake nicht genannt — kein Papier-Vollverfahren in diesem Dokument.*{{/unless}}{{/unless}}

Belegrelevante Zusatzangaben aus E-Mails werden nur mitaufbewahrt, soweit sie vorhanden sind. Welche Nachrichten belegrelevant sind, ist nicht bestätigt.
