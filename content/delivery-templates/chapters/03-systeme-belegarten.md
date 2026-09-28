# 2 Systeme und Belegarten

<!-- frage:B01 -->
Nur für im Intake genannte Wege. Fehlende oder unklare Kanäle erscheinen als offene Punkte, nicht als erfundene Praxis.

| Belegart und Weg | Original und Ablage |
| --- | --- |
{{#if answers.eingangsbelege contains "E-Mail"}}| Eingangsrechnung als PDF per E-Mail | Originaldatei aus dem Eingangskanal geht in {{answers.archiv | or "das angegebene Archiv (zu bestätigen)"}}; belegrelevante E-Mail-Zusatzangaben werden mitaufbewahrt, soweit vorhanden. Ein Verfahren gegen Überschreiben ist nicht gesondert bestätigt. |{{/if}}
{{#if answers.eingangsbelege contains "PDF"}}| Eingangsrechnung als PDF | Original-PDF geht in die Ablage und wird der Buchhaltung bereitgestellt. Ein Verfahren gegen Überschreiben ist nicht gesondert bestätigt. |{{/if}}
{{#if answers.eingangsbelege contains "E-Rechnung"}}| Strukturierte E-Rechnung | Die empfangene strukturierte Datei (z. B. XML / XRechnung / ZUGFeRD-Original) wird im ursprünglichen Format abgelegt. Eine PDF-Ansicht ist nur Lesehilfe. |{{/if}}
{{#if answers.eingangsbelege contains "ZUGFeRD"}}| Strukturierte E-Rechnung (ZUGFeRD) | Die empfangene Originaldatei bleibt erhalten; die Ansicht ersetzt nicht den strukturierten Teil. |{{/if}}
{{#if answers.eingangsbelege contains "XRechnung"}}| Strukturierte E-Rechnung (XRechnung) | Die empfangene XML-Datei wird im ursprünglichen Format aufbewahrt. |{{/if}}
{{#if answers.eingangsbelege contains "Papier"}}| Papierbeleg per Post | {{answers.buchhaltung | or "Die Buchhaltung"}} ist für Papierpost genannt. Ob gescannt wird und wie das Papieroriginal verwahrt oder ersetzt wird, ist zu bestätigen. |{{/if}}
{{#if answers.eingangsbelege contains "Scan"}}| Papierbeleg mit Scan | Scan zur Bearbeitung; Umgang mit dem Papieroriginal (zusätzliche Verwahrung oder dokumentiertes Ersetzen) ist zu bestätigen. |{{/if}}
{{#if answers.eingangsbelege contains "Portal"}}| Eingang über Portal / Download | Belegdatei aus dem genannten Portalweg wird unverändert übernommen und abgelegt. |{{/if}}
{{#if answers.ausgangsrechnungen}}| Ausgangsrechnung | Erstellung über {{answers.ausgangsrechnungen | join ", "}}; exportiertes Original geht in die Belegablage. Korrektur und Storno sind im Intake nicht beschrieben. |{{/if}}

{{#unless answers.eingangsbelege}}*Eingangswege sind im Intake nicht angegeben — siehe offene Punkte.*{{/unless}}

{{#unless answers.eingangsbelege contains "Papier"}}{{#unless answers.eingangsbelege contains "Scan"}}*Papierweg laut Intake nicht genannt — kein Papier-Vollverfahren in diesem Dokument.*{{/unless}}{{/unless}}
