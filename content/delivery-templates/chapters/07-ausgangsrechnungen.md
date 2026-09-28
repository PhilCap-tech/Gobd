# 7 Ausgangsrechnungen und Korrekturen

{{#if answers.ausgangsrechnungen}}
## 7.1 Erstellung

{{answers.gf | or "Die Geschäftsführung (Person ist zu benennen)"}} erstellt Ausgangsrechnungen in {{answers.ausgangsrechnungen | join ", "}}. Das System vergibt fortlaufende Rechnungsnummern, soweit so vorgesehen. Vor Versand werden Empfänger, Leistungsbeschreibung, Leistungsdatum, Betrag und Zahlungsbedingungen geprüft. Die versandte Fassung wird exportiert und geordnet in {{answers.archiv | or "der Ablage (zu bestätigen)"}} abgelegt.

## 7.2 Versand und Nachweis

Der Versand erfolgt per E-Mail oder als strukturierte E-Rechnung, sofern dies für den Vorgang vorgesehen ist. Der Übermittlungsweg wird am Vorgang dokumentiert. Rückläufer oder technische Fehler werden geklärt; ein bloßer Versandversuch gilt nicht als erfolgreicher Zugang.

## 7.3 Berichtigung und Storno

Bereits versandte Rechnungen werden nicht überschrieben. Eine Korrektur oder ein Storno erhält eine eigene nachvollziehbare Fassung und wird mit der ursprünglichen Rechnung verknüpft. Der Anlass wird kurz dokumentiert. Nummernlücken werden nicht durch Löschen verdeckt, sondern erklärt.

## 7.4 Eigenbelege

Fehlt ausnahmsweise ein Fremdbeleg, entscheidet {{answers.gf | or "die Geschäftsführung"}} über die Erstellung eines Eigenbelegs. Der Eigenbeleg beschreibt Geschäftsvorfall, Betrag, Datum, Beteiligte und Grund für das Fehlen des Fremdbelegs; verfügbare Nachweise werden beigefügt. Diese Ausnahme wird nicht zum Regelprozess.
{{/if}}
{{#unless answers.ausgangsrechnungen}}
*Weg der Ausgangsrechnungen ist im Intake nicht angegeben — Erstellung, Nummerierung und Korrekturverfahren sind zu beschreiben (offener Punkt).*
{{/unless}}
