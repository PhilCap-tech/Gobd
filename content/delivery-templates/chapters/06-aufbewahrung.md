# 5 Aufbewahrung, Zugriff und Sicherung

Digitale Originale und relevante Zusatzunterlagen werden in {{answers.archiv | or "dem Archiv (zu bestätigen)"}} geordnet nach Belegart und Zeitraum abgelegt. Betriebliche Zugriffsrechte haben {{answers.zugriff | or "die berechtigten Personen (Zugriffskreis ist zu bestätigen)"}}. {{#if answers.steuerberater}}{{answers.steuerberater}} erhält Zugang ausschließlich im vereinbarten Mandatsumfang.{{/if}} Rechteänderungen veranlasst {{#if answers.gf}}{{answers.gf}}{{/if}}{{#unless answers.gf}}die Geschäftsführung{{/unless}} und hält sie in einer separaten Berechtigungsliste fest (Anlage / offener Punkt, soweit noch nicht abgelegt).

Die Aufbewahrungsdauer richtet sich nach der jeweiligen Unterlagenart und den geltenden Vorschriften; sie wird nicht aus einer pauschalen Frist für alle Belege abgeleitet. **Buchungsbelege** unterliegen nach aktueller Regelung grundsätzlich **acht Jahren** (§ 147 AO / § 257 HGB). Andere Dokumentationsarten können zehn oder sechs Jahre erfordern. Fristbeginn, Sonderfälle und gegebenenfalls verlängerte Aufbewahrung werden vor Löschung geprüft. Bei E-Rechnungen bleibt zumindest der strukturierte Teil in ursprünglicher Form unversehrt erhalten.

{{#if answers.backup}}
Die technische Sicherung erfolgt laut Intake über: {{answers.backup | join ", "}}. Ob und wie eine Rücksicherung geprüft wird, ist gesondert zu belegen (offener Punkt, sofern kein dokumentierter Wiederherstellungstest vorliegt). Eine Sicherungskopie ersetzt keine geordnete Aufbewahrung.
{{/if}}
{{#unless answers.backup}}
Ein Backup-Verfahren ist im Intake nicht angegeben — Sicherung und Wiederherstellungstest sind als offene Punkte zu klären. Eine Sicherungskopie ersetzt keine geordnete Aufbewahrung.
{{/unless}}
