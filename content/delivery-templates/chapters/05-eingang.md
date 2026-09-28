# 5 Eingangsrechnungen und E-Rechnungen

<!-- frage:F01 -->
{{#if answers.buchhaltung}}{{answers.buchhaltung}} ist für die Sichtung eingehender Belege genannt.{{/if}}{{#unless answers.buchhaltung}}Die für die Sichtung zuständige Person ist zu benennen.{{/unless}}
<!-- frage:C02 -->
Der Turnus dieser Sichtung ist im Intake nicht bestätigt und bleibt offener Punkt. Unklare oder doppelte Belege sind vor einer Buchungsfreigabe mit {{#if answers.gf}}{{answers.gf}}{{/if}}{{#unless answers.gf}}der Geschäftsführung{{/unless}} zu klären.

{{#if answers.eingangsbelege contains "E-Mail"}}
## E-Mail- und PDF-Eingang

<!-- frage:C01 -->
Eingangsrechnungen per E-Mail gehen nach {{answers.archiv | or "dem Archiv (zu bestätigen)"}}. Belegrelevante Transportnachrichten werden mitaufbewahrt, soweit vorhanden. Absenderprüfung, Dubletten und der Umgang mit verdächtigen Dateien sind nicht im Einzelnen bestätigt.
{{/if}}

{{#if answers.eingangsbelege contains "PDF"}}
{{#unless answers.eingangsbelege contains "E-Mail"}}
## PDF-Eingang

<!-- frage:C01 -->
PDF-Eingangsbelege gehen in die Ablage. Welche Prüfungsschritte je Beleg gelten, ist nicht bestätigt. Eine PDF-Datei ist damit keine strukturierte E-Rechnung.
{{/unless}}
{{/if}}

{{#if answers.eingangsbelege contains "E-Rechnung"}}
## Strukturierte E-Rechnung

<!-- frage:E02 -->
Für strukturierte E-Rechnungen bleibt die maschinenlesbare Datei (XML bzw. ZUGFeRD-/XRechnung-Original) erhalten. Eine PDF-Ansicht ist nur Lesehilfe. Abweichungen zwischen Ansicht und strukturiertem Inhalt sind vor Freigabe zu klären. Die konkrete technische Validierung ist nicht bestätigt.
{{/if}}

{{#if answers.eingangsbelege contains "ZUGFeRD"}}
{{#unless answers.eingangsbelege contains "E-Rechnung"}}
## Strukturierte E-Rechnung (ZUGFeRD)

Die empfangene Originaldatei bleibt erhalten; die Ansicht ersetzt nicht den strukturierten Teil. Technische Validierung: siehe offene Punkte.
{{/unless}}
{{/if}}

{{#if answers.eingangsbelege contains "XRechnung"}}
{{#unless answers.eingangsbelege contains "E-Rechnung"}}
## Strukturierte E-Rechnung (XRechnung)

Die empfangene XML-Datei wird im ursprünglichen Format aufbewahrt. Technische Validierung: siehe offene Punkte.
{{/unless}}
{{/if}}

{{#unless answers.eingangsbelege contains "E-Rechnung"}}
{{#unless answers.eingangsbelege contains "ZUGFeRD"}}
{{#unless answers.eingangsbelege contains "XRechnung"}}
## Strukturierte E-Rechnung

Ob strukturierte E-Rechnungen empfangen und wie sie technisch geprüft werden, ist aus dem Intake nicht bestätigt. Eine PDF- oder E-Mail-Rechnung ist damit nicht als strukturierte E-Rechnung beschrieben. Validierung und Protokoll bleiben offener Punkt.
{{/unless}}
{{/unless}}
{{/unless}}

{{#unless answers.eingangsbelege}}
*Eingangswege fehlen im Intake — Prüfung ist zu beschreiben (offener Punkt).*
{{/unless}}
