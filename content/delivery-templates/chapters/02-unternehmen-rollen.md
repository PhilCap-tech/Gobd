# 2 Unternehmen, Rollen und Aufgaben

## 2.1 Organisatorischer Rahmen

{{identity.company | or "Das Unternehmen"}}{{#if answers.branchen}} erbringt Leistungen im Bereich {{answers.branchen | join ", "}}{{/if}}{{#if answers.rechtsform}} ({{answers.rechtsform}}){{/if}}.{{#if answers.mitarbeitende}} Mitarbeitende laut Intake: {{answers.mitarbeitende}}.{{/if}}{{#unless answers.mitarbeitende}} Die organisatorische Größe ist zu bestätigen.{{/unless}} {{#if bereich.belegfluss}}Die Belegbearbeitung{{/if}}{{#if bereich.andere}}Die Abläufe im Bereich {{bereich.label}}{{/if}} {{#if bereich.belegfluss}}wird{{/if}}{{#if bereich.andere}}werden{{/if}} von den benannten Rollen ausgeführt; die Funktionstrennung wird durch Freigaben und Kontrollen der Geschäftsführung ergänzt, soweit bestätigt.

## 2.2 Rollenmatrix

{{#if bereich.belegfluss}}| Prozessschritt | Ausführung | Kontrolle oder Entscheidung |
| --- | --- | --- |
| E-Mail-Postfach / Eingang sichten | {{answers.buchhaltung | or "zu benennen"}} | Vertretung: {{answers.gf | or "zu benennen"}} |
{{#if answers.eingangsbelege contains "Papier"}}| Papierpost entgegennehmen | {{answers.buchhaltung | or "zu benennen"}} | {{answers.gf | or "zu benennen"}} bei Unklarheiten |{{/if}}
| Sachliche Rechnungsprüfung | {{answers.gf | or "zu benennen"}} | keine Selbstfreigabe eigener Auslagen |
| Belege bereitstellen | {{answers.buchhaltung | or "zu benennen"}} | Vollständigkeitsabgleich (Turnus zu bestätigen) |
| Buchung | {{answers.steuerberater | or "interne Buchung / Kanzlei (zu bestätigen)"}} | gemäß Mandats- bzw. Aufgabenvereinbarung |
| Rechte vergeben oder entziehen | {{answers.gf | or "zu benennen"}} | Dokumentation in Berechtigungsliste |
| Löschung freigeben | {{answers.gf | or "zu benennen"}} | vorherige Fristenprüfung |
| Dokument aktualisieren | {{answers.buchhaltung | or "zu benennen"}} | Bestätigung durch {{answers.gf | or "die Geschäftsführung"}} |{{/if}}{{#if bereich.andere}}| Aufgabe | Ausführung | Kontrolle oder Entscheidung |
| --- | --- | --- |
| Verantwortung für den Bereich {{bereich.label}} | {{bereich.verantwortlich | or "zu benennen"}} | Vertretung: {{bereich.vertretung | or "zu benennen"}} |
| Rechte vergeben oder entziehen | {{answers.gf | or "zu benennen"}} | Dokumentation in Berechtigungsliste |
| Löschung freigeben | {{answers.gf | or "zu benennen"}} | vorherige Fristenprüfung |
| Dokument aktualisieren | {{bereich.verantwortlich | or "zu benennen"}} | Bestätigung durch {{answers.gf | or "die Geschäftsführung"}} |

Weitere Rollen im Bereich ergeben sich aus Kapitel 4, soweit sie dort als bestätigte Angabe genannt sind.{{/if}}

## 2.3 Vertretung

Bei Abwesenheit der {{#if bereich.belegfluss}}buchhaltungsverantwortlichen Person übernimmt {{answers.gf | or "die Geschäftsführung (zu benennen)"}} die Sichtung und Weiterleitung, soweit so vorgesehen.{{/if}}{{#if bereich.andere}}bereichsverantwortlichen Person übernimmt {{bereich.vertretung | or answers.gf | or "die Geschäftsführung (zu benennen)"}} die Aufgaben im Bereich, soweit so vorgesehen.{{/if}} Änderungen an Rollen werden spätestens am Tag ihres Wirksamwerdens dokumentiert. Ausgeschiedene Personen verlieren ihre Zugriffsrechte unverzüglich.
