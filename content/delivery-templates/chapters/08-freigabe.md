# 8 Prüfung, Freigabe und Buchungsübergabe

<!-- frage:F01 -->
{{#if answers.gf}}{{answers.gf}} ist für die Freigabe genannt.{{/if}}{{#unless answers.gf}}Die Geschäftsführung (Person ist zu benennen) ist für die Freigabe zu benennen.{{/unless}} {{#if answers.buchhaltung}}{{answers.buchhaltung}}{{/if}}{{#unless answers.buchhaltung}}Die Buchhaltung{{/unless}} stellt die Belege in {{answers.fibu | join ", " | or "der FiBu (zu bestätigen)"}} bereit. {{#if kanzleiBucht}}<!-- frage:F05 -->{{answers.steuerberater}} verbucht im vereinbarten Umfang.{{/if}}{{#if kanzleiUnbestaetigt}}Zur Kanzlei liegt diese Angabe vor: {{answers.steuerberater}}. Der Leistungsumfang ist nicht bestätigt; eine Verbuchung durch die Kanzlei wird nicht als Ist-Prozess beschrieben.{{/if}}{{#unless answers.steuerberater}}Die Verbuchung erfolgt intern bzw. über die vereinbarte externe Stelle (soweit vorhanden, ist sie zu benennen).{{/unless}} Bei Rückfragen bleibt der Vorgang als ungeklärt gekennzeichnet; eine Freigabe wird nicht fingiert.

## Statusfolge

Die folgende Kette ist ein Ordnungsrahmen, keine bestätigte gelebte Praxis. Das Intake enthält keine Statuswerte.

| Status | Bedeutung im Rahmen | Im Intake |
| --- | --- | --- |
| Eingegangen | Datei oder Papier liegt vor | Kanal nur soweit genannt |
| In Klärung | Angabe fehlt | nicht als Status geführt |
| Freigegeben | sachliche Prüfung erfolgt | Person genannt, Kriterien offen |
| Zur Buchung bereitgestellt | Übergabe | Turnus nicht bestätigt |
| Gebucht | Beleg und Buchung verbunden | Beleg-ID nicht bestätigt |

<!-- frage:F02 -->
Eine Belegreferenz, die Beleg und Buchung verbindet, ist soweit das System sie unterstützt zu beschreiben. Sie ist im Intake nicht als vorhandene Beleg-ID bestätigt. Eine monatliche Übergabeliste ist nicht bestätigt.
