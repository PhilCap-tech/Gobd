# {{bereich.docTitle}}

**{{identity.company | or "zu bestätigen"}}**  
Fassung {{version}}  |  erzeugt am {{generatedAt}}
{{#if validFrom}}Gültig ab {{validFrom}}
{{/if}}{{#if changeSummary}}Änderung: {{changeSummary}}
{{/if}}

Dieses Dokument beschreibt {{#if bereich.belegfluss}}den Belegweg{{/if}}{{#if bereich.andere}}die Abläufe im Bereich {{bereich.label}}{{/if}} auf Grundlage der im Intake bestätigten Angaben. Präsens-Aussagen gelten nur, soweit die jeweilige Angabe bestätigt ist. Fehlende oder unklare Sachverhalte erscheinen als Hinweis oder offener Punkt. Das Dokument ist keine steuerliche oder rechtliche Beratung und **keine** Bestätigung der GoBD-Konformität. Die automatische Generierung ersetzt **nicht** die betriebliche Bestätigung durch die Geschäftsleitung.

## Dokumentmerkmale

| Dokumentmerkmal | Angabe |
| --- | --- |
| Unternehmen | {{identity.company | or "zu bestätigen"}}{{#if answers.branchen}}, {{answers.branchen | join ", "}}{{/if}}{{#if answers.rechtsform}}, {{answers.rechtsform}}{{/if}}{{#if answers.mitarbeitende}}, Mitarbeitende: {{answers.mitarbeitende}}{{/if}} |
| Geschäftsführung | {{answers.gf | or "zu bestätigen"}} |
{{#if bereich.belegfluss}}| Buchhaltung | {{answers.buchhaltung | or "zu bestätigen"}} |
{{#if keineKanzlei}}| Buchhaltung und Steuererklärungen | {{eigenbuchhaltung}} |
{{/if}}{{#unless keineKanzlei}}| Externe Kanzlei | {{answers.steuerberater | or "zu bestätigen (soweit beteiligt)"}} |
{{/unless}}
{{#if geltungText}}| Geltungsbereich | {{geltungText}} |
{{/if}}{{#unless geltungText}}| Geltungsbereich | Eingangs- und Ausgangsrechnungen, sonstige Buchungsbelege, Übergabe zur Buchung und Aufbewahrung im beschriebenen Umfang |
{{/unless}}
{{/if}}{{#if bereich.andere}}| Bereich | {{bereich.label}} |
| Bereichsverantwortung | {{bereich.verantwortlich | or "zu bestätigen"}} |
| Geltungsbereich | {{bereich.kurz}} Allgemeiner Teil (Unternehmen, Systeme, Aufbewahrung, Berechtigungen, Kontrollen) im beschriebenen Umfang |
{{/if}}| Ausgeschlossen | {{answers.geltungAusschluss | or "nichts ausdrücklich ausgenommen; nicht beschriebene Abläufe gelten nicht als vorhanden"}} |
| Status | Entwurf aus Kunden-Intake — betriebliche Bestätigung ausstehend |

## Freigabevermerk

Bei einem realen Betrieb bestätigt die Geschäftsleitung an dieser Stelle, dass die beschriebenen Abläufe der tatsächlichen Praxis entsprechen. Automatische Erzeugung und fachliche Hinweise ersetzen diese betriebliche Prüfung nicht.

| Rolle | Name | Datum | Status |
| --- | --- | --- | --- |
| Geschäftsleitung | {{#if answers.bestaetigungName}}{{answers.bestaetigungName}}{{/if}}{{#unless answers.bestaetigungName}}{{answers.gf | or "________________"}}{{/unless}} | {{answers.bestaetigungDatum | or "________________"}} | ausstehend |
| Dokumentationsverantwortung | {{#if bereich.belegfluss}}{{answers.buchhaltung | or "________________"}}{{/if}}{{#if bereich.andere}}{{bereich.verantwortlich | or "________________"}}{{/if}} | ________________ | ausstehend |

{{disclaimer}}
