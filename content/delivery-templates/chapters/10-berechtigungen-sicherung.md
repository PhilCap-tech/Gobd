# 10 Berechtigungen, Sicherung und Notfall

## 10.1 Berechtigungen

Betriebliche Zugriffsrechte haben {{answers.zugriff | or "die berechtigten Personen (Zugriffskreis ist zu bestätigen)"}}.

| Rolle | Lesen | Bearbeiten | Freigeben | Rechte verwalten |
| --- | --- | --- | --- | --- |
| {{answers.gf | or "Geschäftsführung (zu benennen)"}} | ja | ja | ja | ja |
| {{answers.buchhaltung | or "Buchhaltung (zu benennen)"}} | ja | ja | nein* | nein |
| {{answers.steuerberater | or "Externe Kanzlei (soweit beteiligt)"}} | im Mandatsumfang | Buchung und Rückfrage | nein | nein |
| Andere Beschäftigte | nur bei ausdrücklicher Aufgabe | nein | nein | nein |

\* Sofern die Buchhaltung sachlich freigibt, ist dies im Intake zu bestätigen und hier anzupassen.

## 10.2 Änderungen und Austritt

Neue oder geänderte Rechte werden von {{answers.gf | or "der Geschäftsführung"}} beauftragt und in der Berechtigungsliste vermerkt. Bei Austritt oder Aufgabenwechsel werden nicht mehr erforderliche Rechte am Wirksamkeitstag entzogen. Die Berechtigungsliste ist als mitgeltende Unterlage abzulegen — siehe offene Punkte, soweit noch nicht vorhanden.

## 10.3 Sicherung

{{#if answers.backup}}
Die technische Sicherung erfolgt laut Intake über: {{answers.backup | join ", "}}. Anbieterangaben und der konkrete Rücksicherungsnachweis sind als Anlagen beizuziehen. Ob und wie eine Rücksicherung geprüft wird, ist gesondert zu belegen (offener Punkt, sofern kein dokumentierter Wiederherstellungstest vorliegt). Eine Sicherungskopie ersetzt keine geordnete Aufbewahrung.
{{/if}}
{{#unless answers.backup}}
Ein Backup-Verfahren ist im Intake nicht angegeben — Sicherung und Wiederherstellungstest sind als offene Punkte zu klären. Eine Sicherungskopie ersetzt keine geordnete Aufbewahrung.
{{/unless}}

## 10.4 Notfallbetrieb

Bei Ausfall des Eingangskanals informiert {{answers.buchhaltung | or "die Buchhaltung"}} {{answers.gf | or "die Geschäftsführung"}} und dokumentiert Beginn und Ende. Belege werden vorübergehend in einem zugriffsgeschützten Notfallordner gesammelt und nach Wiederherstellung kontrolliert in den Regelprozess überführt. Bei Ausfall des Archivsystems werden keine Originale gelöscht oder überschrieben. Das konkrete Notfallverfahren ist zu bestätigen, soweit nicht im Intake spezifiziert.
