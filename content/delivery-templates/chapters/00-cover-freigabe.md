# Verfahrensdokumentation zur Belegablage

**{{identity.company | or "zu bestätigen"}}**  
Fassung {{version}}  |  erzeugt am {{generatedAt}}
{{#if validFrom}}Gültig ab {{validFrom}}
{{/if}}{{#if changeSummary}}Änderung: {{changeSummary}}
{{/if}}

Dieses Dokument beschreibt den Belegweg auf Grundlage der im Intake bestätigten Angaben. Präsens-Aussagen gelten nur, soweit die jeweilige Angabe bestätigt ist. Fehlende oder unklare Sachverhalte erscheinen als Hinweis oder offener Punkt. Das Dokument ist keine steuerliche oder rechtliche Beratung und **keine** Bestätigung der GoBD-Konformität. Die automatische Generierung ersetzt **nicht** die betriebliche Bestätigung durch die Geschäftsleitung.

## Dokumentmerkmale

| Dokumentmerkmal | Angabe |
| --- | --- |
| Unternehmen | {{identity.company | or "zu bestätigen"}}{{#if answers.branchen}}, {{answers.branchen | join ", "}}{{/if}}{{#if answers.rechtsform}}, {{answers.rechtsform}}{{/if}}{{#if answers.mitarbeitende}}, Mitarbeitende: {{answers.mitarbeitende}}{{/if}} |
| Geschäftsführung | {{answers.gf | or "zu bestätigen"}} |
| Buchhaltung | {{answers.buchhaltung | or "zu bestätigen"}} |
| Externe Kanzlei | {{answers.steuerberater | or "zu bestätigen (soweit beteiligt)"}} |
| Geltungsbereich | Eingangs- und Ausgangsrechnungen, sonstige Buchungsbelege, Übergabe zur Buchung und Aufbewahrung im beschriebenen Umfang |
| Ausgeschlossen | Kasse, Warenwirtschaft, Lohnabrechnung und branchenspezifische Fachverfahren, soweit im Intake nicht ausdrücklich einbezogen |
| Status | Entwurf aus Kunden-Intake — betriebliche Bestätigung ausstehend |

## Freigabevermerk

Bei einem realen Betrieb bestätigt die Geschäftsleitung an dieser Stelle, dass die beschriebenen Abläufe der tatsächlichen Praxis entsprechen. Automatische Erzeugung und fachliche Hinweise ersetzen diese betriebliche Prüfung nicht.

| Rolle | Name | Datum | Status |
| --- | --- | --- | --- |
| Geschäftsleitung | {{#if answers.bestaetigungName}}{{answers.bestaetigungName}}{{/if}}{{#unless answers.bestaetigungName}}{{answers.gf | or "________________"}}{{/unless}} | {{answers.bestaetigungDatum | or "________________"}} | ausstehend |
| Dokumentationsverantwortung | {{answers.buchhaltung | or "________________"}} | ________________ | ausstehend |

{{disclaimer}}
