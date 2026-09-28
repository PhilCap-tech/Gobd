# 3 Systemlandschaft und Datenfluss

<!-- frage:B01 -->
Nur genannte Systeme. Version, Betreiber und Schnittstelle je System sind nicht erfasst.

| System laut Intake | Einordnung | Verantwortung |
| --- | --- | --- |
| FiBu: {{answers.fibu | join ", " | or "zu bestätigen"}} | Buchhaltungssystem | {{answers.buchhaltung | or "zu benennen"}} |
{{#if answers.weitereSysteme}}| {{answers.weitereSysteme}} | weitere genannte Systeme | {{answers.buchhaltung | or "zu benennen"}} |{{/if}}
{{#if answers.archiv}}| Archiv: {{answers.archiv}} | genannter Ablageort | {{answers.buchhaltung | or "zu benennen"}} |{{/if}}
{{#if answers.hosting}}| Hosting: {{answers.hosting}} | genannte Betriebsform | {{answers.it | or "IT ist zu benennen"}} |{{/if}}
{{#if answers.backup}}| Sicherung: {{answers.backup | join ", "}} | laut Intake, ohne Wiederherstellungstest | {{answers.gf | or "zu benennen"}} |{{/if}}

## Datenfluss

<!-- frage:B04 -->
Ein durchgängiger Fluss (unveränderte Übernahme, Beleg-ID, Übergabe, Buchung) ist im Intake nicht als Ist-Prozess bestätigt. Genannt ist der Weg von {{answers.eingangsbelege | join ", " | or "den Eingangskanälen (zu bestätigen)"}} nach {{answers.archiv | or "dem Archiv (zu bestätigen)"}} und die Ausgangserstellung über {{answers.ausgangsrechnungen | join ", " | or "ein nicht genanntes System"}}.

Weitere Vorsysteme, Portale oder eine jährliche Systemprüfung sind nicht bestätigt.
