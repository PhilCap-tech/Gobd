# 4 Freigabe, Buchung und Nachvollziehbarkeit

<!-- frage:F01 -->
{{#if answers.gf}}{{answers.gf}} ist für die Freigabe genannt.{{/if}}{{#unless answers.gf}}Die Geschäftsführung (Person ist zu benennen) ist für die Freigabe zu benennen.{{/unless}} {{#if answers.buchhaltung}}{{answers.buchhaltung}}{{/if}}{{#unless answers.buchhaltung}}Die Buchhaltung{{/unless}} stellt die Belege in {{answers.fibu | join ", " | or "der FiBu (zu bestätigen)"}} bereit. {{#if kanzleiBucht}}<!-- frage:F05 -->{{answers.steuerberater}} verbucht im vereinbarten Umfang.{{/if}}{{#if kanzleiUnbestaetigt}}Zur Kanzlei liegt diese Angabe vor: {{answers.steuerberater}}. Der Leistungsumfang ist nicht bestätigt; eine Verbuchung durch die Kanzlei wird nicht als Ist-Prozess beschrieben.{{/if}}{{#unless answers.steuerberater}}Die Verbuchung erfolgt intern bzw. über die vereinbarte externe Stelle (soweit vorhanden, ist sie zu benennen).{{/unless}} <!-- frage:F02 -->Eine Belegreferenz verbindet hochgeladenen Beleg und Buchung, soweit das System dies unterstützt. Bei Rückfragen bleibt der Vorgang als ungeklärt gekennzeichnet; eine Freigabe wird nicht fingiert.

{{#if answers.ausgangsrechnungen}}
<!-- frage:E05 -->
Ausgangsrechnungen werden über {{answers.ausgangsrechnungen | join ", "}} erstellt. <!-- frage:E03 -->{{#if answers.gf}}{{answers.gf}} ist für die sachliche Prüfung vor Versand genannt.{{/if}}{{#unless answers.gf}}Die Person für die sachliche Prüfung vor Versand ist zu benennen.{{/unless}} Die Übergabe einer strukturierten E-Rechnung an Kunden ist je Kundenfall zu erfassen, soweit einschlägig.
{{/if}}
{{#unless answers.ausgangsrechnungen}}
*Weg der Ausgangsrechnungen ist im Intake nicht angegeben — siehe offene Punkte.*
{{/unless}}
