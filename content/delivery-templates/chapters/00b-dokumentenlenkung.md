# Dokumentenlenkung

| Feld | Inhalt |
| --- | --- |
| Dokument-ID | {{#if bereich.belegfluss}}{{documentId | or "VD-BELEG-(zu vergeben)"}}{{/if}}{{#if bereich.andere}}{{documentId | or "VD-(zu vergeben)"}}{{/if}} |
| Version | {{version}} |
| Gültig ab | {{validFrom | or "*(von der Geschäftsleitung festzulegen)*"}} |
| Nächste planmäßige Prüfung | *(zu planen, z. B. ein Jahr nach Gültig-ab)* |
| Speicherort | {{answers.archiv | or "zu bestätigen"}} / Organisationsablage Verfahrensdokumentation |
| Vorversion | {{history.vorversion | or "Keine; Erstfassung — sofern eine Vorfassung existiert, ist sie hier zu benennen"}} |
| Änderungsanlass | {{history.anlass | or "Erstmalige Beschreibung aus Kunden-Intake bzw. angegebener Anlass"}} |

## Inhaltsübersicht

{{#if bereich.belegfluss}}1 Zweck, Geltungsbereich und Verantwortung  
2 Unternehmen, Rollen und Aufgaben  
3 Systemlandschaft und Datenfluss  
4 Belegarten und Eingangskanäle  
5 Eingangsrechnungen und E-Rechnungen  
6 Papierbelege und Digitalisierung *(nur wenn Papierweg bestätigt)*  
7 Ausgangsrechnungen und Korrekturen  
8 Prüfung, Freigabe und Buchungsübergabe  
9 Ablage, Aufbewahrung und Datenzugriff  
10 Berechtigungen, Sicherung und Notfall  
11 Internes Kontrollsystem  
12 Versionspflege und Änderungen  
13 Mitgeltende Unterlagen  
14 Offene Punkte und Maßnahmen  
Anhang A Prozessmatrix · Anhang B Begriffserläuterungen{{/if}}{{#if bereich.andere}}1 Zweck, Geltungsbereich und Verantwortung  
2 Unternehmen, Rollen und Aufgaben  
3 Systemlandschaft und Datenfluss  
4 {{bereich.titel}}: Abläufe  
5 Ablage, Aufbewahrung und Datenzugriff  
6 Berechtigungen, Sicherung und Notfall  
7 Internes Kontrollsystem  
8 Versionspflege und Änderungen  
9 Mitgeltende Unterlagen  
10 Offene Punkte und Maßnahmen  
Anhang A Prozessmatrix {{bereich.label}} · Anhang B Begriffserläuterungen{{/if}}
