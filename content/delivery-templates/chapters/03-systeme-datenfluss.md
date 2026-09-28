# 3 Systemlandschaft und Datenfluss

## 3.1 Verwendete Systeme

| System | Funktion | Verantwortung | Aufbewahrungsbezug |
| --- | --- | --- | --- |
{{#if answers.weitereSysteme}}| Eingangskanal / Vorsysteme (laut Intake) | {{answers.weitereSysteme}} | {{answers.buchhaltung | or "zu benennen"}} | Belegrelevante Zusatzangaben werden mitgesichert, soweit vorhanden |
{{/if}}{{#if answers.ausgangsrechnungen}}| {{answers.ausgangsrechnungen | join ", "}} | Erstellung und Versand von Ausgangsrechnungen | {{answers.gf | or "zu benennen"}} | Exportierte Originalfassung und Korrekturen |
{{/if}}{{#if answers.archiv}}| {{answers.archiv}} | Belegablage, Beleg-ID und Übergabe | {{answers.buchhaltung | or "zu benennen"}} | Zentraler Ablageort der beschriebenen Belege |
{{/if}}{{#if answers.fibu}}| {{answers.fibu | join ", "}} | Buchung / Finanzbuchhaltung | {{answers.steuerberater | or "Buchung intern bzw. Kanzlei (zu bestätigen)"}} | Verknüpfung von Buchung und Beleg-ID |
{{/if}}{{#if answers.hosting}}| Hosting | {{answers.hosting}} | {{answers.it | or answers.gf | or "zu benennen"}} | Technische Betriebsplattform der genannten Systeme |
{{/if}}

{{#unless answers.fibu}}*FiBu-/Buchhaltungssystem ist im Intake nicht angegeben — siehe offene Punkte.*{{/unless}}
{{#unless answers.archiv}}*Ablage-/Archivsystem ist im Intake nicht angegeben — siehe offene Punkte.*{{/unless}}

## 3.2 Datenfluss

Eingehende Dateien werden aus dem bestätigten Eingangskanal unverändert in {{answers.archiv | or "das Archiv (zu bestätigen)"}} übernommen. {{answers.buchhaltung | or "Die Buchhaltung (Person ist zu benennen)"}} ordnet Belegart und Zeitraum zu. Nach sachlicher Freigabe stellt sie den Beleg zur Buchung bereit. Die Buchung erfolgt über {{answers.fibu | join ", " | or "das FiBu-System (zu bestätigen)"}}{{#if answers.steuerberater}} durch {{answers.steuerberater}} im vereinbarten Umfang{{/if}}. Die Beleg-ID verbindet Buchung und Beleg, soweit das System dies unterstützt.{{#if answers.originalErhalt}} Als Original aufbewahrt laut bestätigter Angabe: {{answers.originalErhalt}}.{{/if}} Rückfragen werden im vereinbarten Kommunikationskanal geklärt; relevante Ergänzungen werden am Vorgang dokumentiert.

## 3.3 Vorsysteme

{{#if answers.weitereSysteme}}Laut Intake genannte weitere Systeme / Kanäle: {{answers.weitereSysteme}}. Ob darüber hinaus Portale, Apps, Tabellen oder Plattformen belegrelevant sind, ist periodisch zu prüfen.{{/if}}
{{#unless answers.weitereSysteme}}Weitere Vorsysteme sind im Intake nicht bestätigt. Vertragsunterlagen oder Zahlungsnachweise werden als mitgeltende Unterlagen aufgenommen, wenn der Beleg allein den Geschäftsvorfall nicht ausreichend erklärt. Die jährliche Systemprüfung fragt ausdrücklich nach neuen Portalen, Apps, Tabellen oder Plattformen — siehe offene Punkte.{{/unless}}
