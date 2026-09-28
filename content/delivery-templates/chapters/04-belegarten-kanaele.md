# 4 Belegarten und Eingangskanäle

Nur bestätigte Kanäle erscheinen als Zeilen. Fehlende oder unklare Wege werden als offene Punkte geführt, nicht als gelebte Praxis.

## 4.1 Belegübersicht

| Belegart | Eingang oder Entstehung | Original | Ablage |
| --- | --- | --- | --- |
{{#if answers.eingangsbelege contains "E-Mail"}}| PDF-Eingangsrechnung (E-Mail) | Funktionspostfach / E-Mail | empfangene PDF-Datei | {{answers.archiv | or "zu bestätigen"}} |
{{/if}}{{#if answers.eingangsbelege contains "PDF"}}{{#unless answers.eingangsbelege contains "E-Mail"}}| PDF-Eingangsrechnung | digitaler Eingang | empfangene PDF-Datei | {{answers.archiv | or "zu bestätigen"}} |
{{/unless}}{{/if}}{{#if answers.eingangsbelege contains "E-Rechnung"}}| XRechnung oder ZUGFeRD / strukturierte E-Rechnung | digitaler Eingang | strukturierter Teil in empfangener Form | {{answers.archiv | or "zu bestätigen"}} |
{{/if}}{{#if answers.eingangsbelege contains "ZUGFeRD"}}{{#unless answers.eingangsbelege contains "E-Rechnung"}}| ZUGFeRD | digitaler Eingang | strukturierter Teil in empfangener Form | {{answers.archiv | or "zu bestätigen"}} |
{{/unless}}{{/if}}{{#if answers.eingangsbelege contains "XRechnung"}}{{#unless answers.eingangsbelege contains "E-Rechnung"}}| XRechnung | digitaler Eingang | XML in empfangener Form | {{answers.archiv | or "zu bestätigen"}} |
{{/unless}}{{/if}}{{#if answers.eingangsbelege contains "Papier"}}| Papierbeleg | Post oder persönliche Übergabe | Papieroriginal; Scan als Bearbeitungskopie | Jahresordner und {{answers.archiv | or "digitale Ablage (zu bestätigen)"}} |
{{/if}}{{#if answers.eingangsbelege contains "Scan"}}{{#unless answers.eingangsbelege contains "Papier"}}| Papierbeleg mit Scan | Scan zur Bearbeitung | Scan; Umgang mit Papieroriginal zu bestätigen | {{answers.archiv | or "zu bestätigen"}} |
{{/unless}}{{/if}}{{#if answers.eingangsbelege contains "Portal"}}| Portal / Download | genanntes Portal | empfangene Datei | {{answers.archiv | or "zu bestätigen"}} |
{{/if}}{{#if answers.ausgangsrechnungen}}| Ausgangsrechnung | {{answers.ausgangsrechnungen | join ", "}} | exportierte, versandte Fassung | {{answers.archiv | or "zu bestätigen"}} |
{{/if}}

{{#unless answers.eingangsbelege}}*Eingangswege sind im Intake nicht angegeben — siehe offene Punkte.*{{/unless}}
{{#unless answers.eingangsbelege contains "Papier"}}{{#unless answers.eingangsbelege contains "Scan"}}*Papierweg laut Intake nicht genannt — Kapitel 6 entfällt.*{{/unless}}{{/unless}}

## 4.2 Vollständigkeit

{{answers.buchhaltung | or "Die Buchhaltung (Person ist zu benennen)"}} prüft an Arbeitstagen den bestätigten Eingangskanal und in geeignetem Turnus, ob regelmäßig genutzte Portale oder Zahlungswege vollständig berücksichtigt wurden. Nicht zuordenbare Dateien werden nicht gelöscht, sondern bis zur Klärung in einem gesonderten Status gehalten.

## 4.3 Belegrelevante Zusatzinformationen

Enthält eine E-Mail Angaben, die für Verständnis, Prüfung oder Freigabe des Geschäftsvorfalls erforderlich sind, wird auch diese Nachricht oder ein nachvollziehbarer Export aufbewahrt. Reine Transportnachrichten ohne Belegfunktion werden nicht pauschal als Buchungsbeleg behandelt.
