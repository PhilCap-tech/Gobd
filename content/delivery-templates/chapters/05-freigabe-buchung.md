# 4 Freigabe, Buchung und Nachvollziehbarkeit

{{#if answers.gf}}{{answers.gf}}{{/if}}{{#unless answers.gf}}Die Geschäftsführung (Person ist zu benennen){{/unless}} gibt sachlich geprüfte Eingangsrechnungen frei. {{#if answers.buchhaltung}}{{answers.buchhaltung}}{{/if}}{{#unless answers.buchhaltung}}Die Buchhaltung{{/unless}} ordnet sie dem Buchungsmonat zu und stellt sie in {{answers.fibu | join ", " | or "der FiBu (zu bestätigen)"}} bereit. {{#if answers.steuerberater}}{{answers.steuerberater}} verbucht im vereinbarten Umfang.{{/if}}{{#unless answers.steuerberater}}Die Verbuchung erfolgt intern bzw. über die vereinbarte externe Stelle (soweit vorhanden, ist sie zu benennen).{{/unless}} Eine Belegreferenz verbindet hochgeladenen Beleg und Buchung, soweit das System dies unterstützt. Bei Rückfragen bleibt der Vorgang als ungeklärt gekennzeichnet; eine Freigabe wird nicht fingiert.

{{#if answers.ausgangsrechnungen}}
Ausgangsrechnungen werden in {{answers.ausgangsrechnungen | join ", "}} fortlaufend nummeriert. {{#if answers.gf}}{{answers.gf}}{{/if}}{{#unless answers.gf}}Die Geschäftsführung{{/unless}} prüft Empfänger, Leistung und Betrag vor Versand. Berichtigungen erzeugen eine neue, nachvollziehbar verknüpfte Datei; der ursprüngliche Stand bleibt aufbewahrt. Die Übergabe einer strukturierten E-Rechnung an Kunden ist je Kundenfall zu erfassen, soweit einschlägig.
{{/if}}
{{#unless answers.ausgangsrechnungen}}
*Weg der Ausgangsrechnungen ist im Intake nicht angegeben — siehe offene Punkte.*
{{/unless}}
