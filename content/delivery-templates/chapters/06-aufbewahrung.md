# 5 Aufbewahrung, Zugriff und Sicherung

<!-- frage:G01 -->
Digitale Originale und relevante Zusatzunterlagen werden in {{answers.archiv | or "dem Archiv (zu bestätigen)"}} abgelegt. <!-- frage:G02 -->Betriebliche Zugriffsrechte laut Intake: {{answers.zugriff | or "die berechtigten Personen (Zugriffskreis ist zu bestätigen)"}}. {{#if kanzleiBucht}}<!-- frage:F05 -->{{answers.steuerberater}} erhält Zugang ausschließlich im vereinbarten Mandatsumfang.{{/if}}{{#if kanzleiUnbestaetigt}}Ein Kanzleizugang wird nicht als gelebter Prozess beschrieben, solange der Leistungsumfang unbestätigt ist.{{/if}} Rechteänderungen veranlasst {{#if answers.gf}}{{answers.gf}}{{/if}}{{#unless answers.gf}}die Geschäftsführung{{/unless}}. Eine separate Berechtigungsliste ist noch abzulegen (offener Punkt).

<!-- frage:G05 -->
Die Aufbewahrungsdauer richtet sich nach der jeweiligen Unterlagenart und den geltenden Vorschriften; sie wird nicht aus einer pauschalen Frist für alle Belege abgeleitet. **Buchungsbelege** unterliegen nach aktueller Regelung grundsätzlich **acht Jahren** (§ 147 AO / § 257 HGB). Andere Dokumentationsarten können zehn oder sechs Jahre erfordern. Fristbeginn, Sonderfälle und gegebenenfalls verlängerte Aufbewahrung werden vor Löschung geprüft. Bei E-Rechnungen bleibt zumindest der strukturierte Teil in ursprünglicher Form unversehrt erhalten.

{{#if answers.backup}}
Die technische Sicherung erfolgt laut Intake über: {{answers.backup | join ", "}}. Ob und wie eine Rücksicherung geprüft wird, ist gesondert zu belegen (offener Punkt, sofern kein dokumentierter Wiederherstellungstest vorliegt). Eine Sicherungskopie ersetzt keine geordnete Aufbewahrung.
{{/if}}
{{#unless answers.backup}}
Ein Backup-Verfahren ist im Intake nicht angegeben — Sicherung und Wiederherstellungstest sind als offene Punkte zu klären. Eine Sicherungskopie ersetzt keine geordnete Aufbewahrung.
{{/unless}}
