# 3 Eingang und Prüfung

<!-- frage:F01 -->
{{#if answers.buchhaltung}}{{answers.buchhaltung}} ist für die Sichtung eingehender Belege genannt.{{/if}}{{#unless answers.buchhaltung}}Die für die Sichtung zuständige Person ist zu benennen.{{/unless}}
<!-- frage:C02 -->
Der Turnus dieser Sichtung ist im Intake nicht bestätigt und bleibt offener Punkt. Unklare oder doppelte Belege sind vor einer Buchungsfreigabe mit {{#if answers.gf}}{{answers.gf}}{{/if}}{{#unless answers.gf}}der Geschäftsführung{{/unless}} zu klären.

{{#if answers.eingangsbelege contains "E-Mail"}}
## E-Mail- und PDF-Eingang

<!-- frage:C01 -->
Eingangsrechnungen per E-Mail gehen nach {{answers.archiv | or "dem Archiv (zu bestätigen)"}}. Belegrelevante Transportnachrichten werden mitaufbewahrt, soweit vorhanden. Welche Prüfungsschritte je Beleg gelten, ist im Intake nicht im Einzelnen bestätigt.
{{/if}}

{{#if answers.eingangsbelege contains "PDF"}}
{{#unless answers.eingangsbelege contains "E-Mail"}}
## PDF-Eingang

<!-- frage:C01 -->
PDF-Eingangsbelege gehen in die Ablage. Welche Prüfungsschritte je Beleg gelten, ist im Intake nicht im Einzelnen bestätigt.
{{/unless}}
{{/if}}

{{#if answers.eingangsbelege contains "E-Rechnung"}}
## Strukturierte E-Rechnung

<!-- frage:E02 -->

Für strukturierte E-Rechnungen wird die technische Lesbarkeit geprüft. Die maschinenlesbare Datei (XML bzw. ZUGFeRD-/XRechnung-Original) bleibt erhalten; eine PDF-Ansicht ist nur Lesehilfe. Abweichungen zwischen Ansicht und strukturiertem Inhalt werden vor Freigabe geklärt. Die konkrete technische Validierung und deren Protokollierung sind als offener Punkt ausgewiesen, sofern nicht gesondert bestätigt.
{{/if}}

{{#if answers.eingangsbelege contains "ZUGFeRD"}}
{{#unless answers.eingangsbelege contains "E-Rechnung"}}
## Strukturierte E-Rechnung (ZUGFeRD)

Die empfangene Originaldatei bleibt erhalten; die Ansicht ersetzt nicht den strukturierten Teil. Technische Validierung und Protokollierung: siehe offene Punkte.
{{/unless}}
{{/if}}

{{#if answers.eingangsbelege contains "XRechnung"}}
{{#unless answers.eingangsbelege contains "E-Rechnung"}}
## Strukturierte E-Rechnung (XRechnung)

Die empfangene XML-Datei wird im ursprünglichen Format aufbewahrt. Technische Validierung und Protokollierung: siehe offene Punkte.
{{/unless}}
{{/if}}

{{#if answers.eingangsbelege contains "Papier"}}
## Papierpost

<!-- frage:C03 -->
Papierpost ist als Eingangsweg genannt und geht an {{#if answers.buchhaltung}}{{answers.buchhaltung}}{{/if}}{{#unless answers.buchhaltung}}die Buchhaltung{{/unless}}. Ob am Eingang gescannt wird und ob das Papieroriginal zusätzlich verwahrt oder nach einem dokumentierten Verfahren ersetzt wird, ist zu bestätigen.
{{/if}}

{{#if answers.eingangsbelege contains "Scan"}}
{{#unless answers.eingangsbelege contains "Papier"}}
## Scan von Papierbelegen

Papierbelege werden gescannt und digital weiterbearbeitet. Ob das Papieroriginal zusätzlich verwahrt oder nach einem dokumentierten Verfahren ersetzt wird, ist zu bestätigen.
{{/unless}}
{{/if}}

{{#unless answers.eingangsbelege}}
*Eingangswege fehlen im Intake — Prüfung und Vorsortierung sind zu beschreiben (offener Punkt).*
{{/unless}}
