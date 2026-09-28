# 3 Eingang und Prüfung

{{#if answers.buchhaltung}}{{answers.buchhaltung}}{{/if}}{{#unless answers.buchhaltung}}Die Buchhaltung (Person ist zu benennen){{/unless}} sichtet eingehende Belege zeitnah an Arbeitstagen. Unklare oder doppelte Belege werden markiert und vor einer Buchungsfreigabe mit {{#if answers.gf}}{{answers.gf}}{{/if}}{{#unless answers.gf}}der Geschäftsführung{{/unless}} geklärt. Originaldateien werden nicht überschrieben.

{{#if answers.eingangsbelege contains "E-Mail"}}
## E-Mail- und PDF-Eingang

Eingangsrechnungen per E-Mail werden anhand Absender, Leistung, Betrag und vorhandener Bestellung bzw. Vertragsunterlage geprüft. Die Originaldatei wird unverändert nach {{answers.archiv | or "dem Archiv (zu bestätigen)"}} übernommen. Belegrelevante Transportnachrichten werden mitaufbewahrt, soweit vorhanden.
{{/if}}

{{#if answers.eingangsbelege contains "PDF"}}
{{#unless answers.eingangsbelege contains "E-Mail"}}
## PDF-Eingang

PDF-Eingangsbelege werden auf Vollständigkeit und Nachvollziehbarkeit geprüft und unverändert abgelegt.
{{/unless}}
{{/if}}

{{#if answers.eingangsbelege contains "E-Rechnung"}}
## Strukturierte E-Rechnung

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

Papierpost wird am Eingangstag an {{#if answers.buchhaltung}}{{answers.buchhaltung}}{{/if}}{{#unless answers.buchhaltung}}die Buchhaltung{{/unless}} weitergeleitet, mit Eingangsdatum versehen und zur Bearbeitung gescannt, soweit so vorgesehen. Das Papieroriginal wird zusätzlich geordnet verwahrt, sofern kein dokumentiertes ersetzendes Scanverfahren bestätigt ist. Die digitale Kopie trägt eine eindeutige Zuordnung zum Papieroriginal.
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
