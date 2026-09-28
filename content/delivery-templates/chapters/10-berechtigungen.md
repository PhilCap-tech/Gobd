# 10 Berechtigungen, Sicherung und Notfall

<!-- frage:G02 -->
Betriebliche Zugriffsrechte laut Intake: {{answers.zugriff | or "die berechtigten Personen (Zugriffskreis ist zu bestätigen)"}}. {{#if kanzleiBucht}}<!-- frage:F05 -->{{answers.steuerberater}} erhält Zugang ausschließlich im vereinbarten Mandatsumfang.{{/if}}{{#if kanzleiUnbestaetigt}}Ein Kanzleizugang wird nicht als gelebter Prozess beschrieben, solange der Leistungsumfang unbestätigt ist.{{/if}}

Eine detaillierte Matrix (Lesen, Bearbeiten, Freigeben, Rechte verwalten) ist nicht bestätigt. Rechteänderungen veranlasst {{#if answers.gf}}{{answers.gf}}{{/if}}{{#unless answers.gf}}die Geschäftsführung{{/unless}}. Eine separate Berechtigungsliste ist noch abzulegen (offener Punkt). Der Entzug am Austrittstag ist nicht bestätigt.

{{#if answers.backup}}
<!-- frage:G06 -->
Die technische Sicherung erfolgt laut Intake über: {{answers.backup | join ", "}}. Ob und wie eine Rücksicherung geprüft wird, ist zu belegen (offener Punkt). Eine Sicherungskopie ersetzt keine geordnete Aufbewahrung.
{{/if}}
{{#unless answers.backup}}
Ein Backup-Verfahren ist im Intake nicht angegeben. Sicherung und Wiederherstellungstest sind offene Punkte.
{{/unless}}

Ein Notfallweg bei Ausfall von Postfach oder Archiv ist nicht beschrieben. Originale dürfen in einem solchen Fall nicht als gelöscht gelten, solange kein bestätigtes Verfahren vorliegt; das ist ein Hinweis, keine bestätigte Notfallpraxis.
