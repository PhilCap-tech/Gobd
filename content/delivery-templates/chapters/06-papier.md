# 6 Papierbelege und Digitalisierung

{{#if answers.eingangsbelege contains "Papier"}}
<!-- frage:C03 -->
Papierpost ist als Eingangsweg genannt und geht an {{#if answers.buchhaltung}}{{answers.buchhaltung}}{{/if}}{{#unless answers.buchhaltung}}die Buchhaltung{{/unless}}. Ob am Eingang gescannt wird, ob das Papieroriginal zusätzlich verwahrt wird und ob eine ersetzende Vernichtung stattfindet, ist zu bestätigen. Ein detailliertes Scan- und Lagerverfahren wird hier nicht behauptet.
{{/if}}

{{#if answers.eingangsbelege contains "Scan"}}
{{#unless answers.eingangsbelege contains "Papier"}}
## Scan von Papierbelegen

Papierbelege werden als Scanweg genannt. Ob das Papieroriginal zusätzlich verwahrt oder nach einem dokumentierten Verfahren ersetzt wird, ist zu bestätigen.
{{/unless}}
{{/if}}

{{#unless answers.eingangsbelege contains "Papier"}}
{{#unless answers.eingangsbelege contains "Scan"}}
Papierweg laut Intake nicht genannt — kein Papier-Vollverfahren in diesem Dokument. Posteingang, Scan, ersetzende Vernichtung und Papierlager entfallen.
{{/unless}}
{{/unless}}
