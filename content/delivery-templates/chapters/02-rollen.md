# 2 Unternehmen, Rollen und Aufgaben

| Merkmal | Sachverhalt laut Intake |
| --- | --- |
| Betrieb | {{identity.company | or "zu bestätigen"}}{{#if answers.branchen}}; {{answers.branchen | join ", "}}{{/if}}{{#if answers.rechtsform}}; {{answers.rechtsform}}{{/if}}{{#if answers.mitarbeitende}}; Mitarbeitende: {{answers.mitarbeitende}}{{/if}} |
| Verantwortung | Geschäftsführung: {{answers.gf | or "zu bestätigen"}}; Buchhaltung: {{answers.buchhaltung | or "zu bestätigen"}}{{#if answers.steuerberater}}; Steuerberatung: {{answers.steuerberater}}{{/if}}{{#if answers.it}}; IT: {{answers.it}}{{/if}} |
| Systeme | FiBu: {{answers.fibu | join ", " | or "zu bestätigen"}}{{#if answers.weitereSysteme}}; weitere Systeme: {{answers.weitereSysteme}}{{/if}}{{#if answers.archiv}}; Archiv: {{answers.archiv}}{{/if}}{{#if answers.hosting}}; Hosting: {{answers.hosting}}{{/if}} |

Standort, genaue Kopfzahl und Vertretungsregeln sind im Intake nicht bestätigt.

## Rollenmatrix

Die Matrix trennt benannte Personen von Schritten, die das Intake nicht bestätigt. Sie ist keine gelebte Funktionstrennung.

| Prozessschritt | Benannt | Nicht bestätigt |
| --- | --- | --- |
| Sichtung Eingang | {{answers.buchhaltung | or "Buchhaltung ist zu benennen"}} | Turnus, Postfach, Vertretung |
| Sachliche Freigabe | {{answers.gf | or "Geschäftsführung ist zu benennen"}} | Kriterien, Selbstfreigabe, Auslagen |
| Bereitstellung zur Buchung | {{answers.buchhaltung | or "zu benennen"}} | Turnus und Vollständigkeitsabgleich |
| Buchung | {{#if kanzleiBucht}}{{answers.steuerberater}} im vereinbarten Umfang{{/if}}{{#if kanzleiUnbestaetigt}}Kanzlei genannt, Umfang offen{{/if}}{{#unless answers.steuerberater}}externe Stelle nicht benannt{{/unless}} | einzelne Buchungsschritte |
| Rechte und Austritt | {{answers.gf | or "zu benennen"}} veranlasst Änderungen | Liste, Wirksamkeitstag |
| Löschung | nicht als Person-Schritt bestätigt | Fristenprüfung und Protokoll |
| Fassung pflegen | {{answers.gf | or "Geschäftsführung"}} bestätigt neue Fassungen | Auslöser im Einzelfall |

<!-- frage:F01 -->
{{#if answers.gf}}{{answers.gf}} ist für die Freigabe genannt.{{/if}} {{#if answers.buchhaltung}}{{answers.buchhaltung}} ist für die Buchhaltung genannt.{{/if}} Wer bei Abwesenheit vertritt, ist nicht bestätigt.
