# Merkmalübersicht

| Merkmal | Sachverhalt |
| --- | --- |
| **Betrieb** | {{identity.company | or "zu bestätigen"}}{{#if answers.branchen}}; {{answers.branchen | join ", "}}{{/if}}{{#if answers.rechtsform}}; {{answers.rechtsform}}{{/if}}{{#if answers.mitarbeitende}}; Mitarbeitende: {{answers.mitarbeitende}}{{/if}} |
| **Geltungsbereich** | Eingangs- und Ausgangsbelege, Übergabe an die Buchhaltung und Aufbewahrung im beschriebenen Umfang. Andere aufzeichnungsrelevante Systeme und Prozesse sind gesondert zu beschreiben. |
| **Verantwortung** | Geschäftsführung: {{answers.gf | or "zu bestätigen"}}; Buchhaltung: {{answers.buchhaltung | or "zu bestätigen"}}{{#if answers.steuerberater}}; Steuerberatung: {{answers.steuerberater}}{{/if}}{{#if answers.it}}; IT: {{answers.it}}{{/if}} |
| **Systeme** | FiBu: {{answers.fibu | join ", " | or "zu bestätigen"}}{{#if answers.weitereSysteme}}; weitere Systeme: {{answers.weitereSysteme}}{{/if}}{{#if answers.archiv}}; Archiv: {{answers.archiv}}{{/if}}{{#if answers.hosting}}; Hosting: {{answers.hosting}}{{/if}} |
| **Stand** | Erzeugt am {{generatedAt}} aus dem Kunden-Intake. Gültigkeit und gelebte Praxis sind von der Geschäftsleitung zu prüfen und zu bestätigen (siehe Abschnitt Version und betriebliche Bestätigung). Kein rückwirkender Nachweis. |
