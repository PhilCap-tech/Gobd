# Anhang A Prozessmatrix

Die Matrix zeigt die logische Folge. Ergebnisse sind nur Ist, wo das Intake den Schritt bestätigt. Sonst steht der Schritt als offen.

| Nr. | Auslöser | Tätigkeit | Im Intake | Verantwortlich |
| --- | --- | --- | --- | --- |
| P01 | Beleg geht ein | Kanal und Ablage | {{answers.eingangsbelege | join ", " | or "Eingang fehlt"}} nach {{answers.archiv | or "Archiv fehlt"}} | {{answers.buchhaltung | or "zu benennen"}} |
| P02 | Prüfung | sachliche Freigabe | Person genannt, Kriterien offen | {{answers.gf | or "zu benennen"}} |
| P03 | Freigabe | bereitstellen | Turnus offen | {{answers.buchhaltung | or "zu benennen"}} |
| P04 | Bereitgestellt | buchen | {{#if kanzleiBucht}}{{answers.steuerberater}} im vereinbarten Umfang{{/if}}{{#if kanzleiUnbestaetigt}}Kanzlei ohne bestätigten Umfang{{/if}}{{#unless answers.steuerberater}}Stelle nicht benannt{{/unless}} | siehe offene Punkte, soweit der Umfang fehlt |
| P05 | Zeitraumsschluss | Vollständigkeit | nicht bestätigt | nicht bestätigt |
| P06 | Kontrolltermin | Stichprobe | nicht bestätigt | nicht bestätigt |
| P07 | Änderung | neue Fassung | Rahmen, Datum offen | {{answers.gf | or "zu benennen"}} |
| P08 | Fristende | Löschung prüfen | nicht bestätigt | nicht bestätigt |
