# GoBD Delivery — Content-Templates (Outline v2)

Im Repo unter `content/delivery-templates/`. Der Builder rendert lokal aus Intake → PDF-Bytes → Blob. Keine Live-API.

**Kapitelquelle:** die Markdown-Dateien in `cover.md` und `chapters/*.md`. Delivery kann später vollere Kapiteltexte in dieselben Dateien legen; der Renderer liest die Dateien und fällt auf `bundle.json` zurück.

`bundle.json` ist die kompilierte Quelle (Disclaimer, Kapitelreihenfolge, eingebettetes Markdown, Open-Points-Rules). Nach Änderungen an den `.md`-Dateien `node content/delivery-templates/build-bundle.mjs` ausführen.

## Eingabe

JSON `IntakeAnswers` + `identity` wie im Builder-Contract (siehe `sample-intake.json`). Zusätzlich `{{version}}` (Start `1.0`) und `{{generatedAtDisplay}}`.

## Ausgabe

1. Titelseite / Kapitel 0 (`cover.md`) mit Logo-Header
2. Kapitel 1–9 aus `chapters/*.md` (Platzhalter ersetzen)
3. Nummerierte Absätze `[1]`, `[2]`, …
4. Offene Punkte aus `open-points-rules.json` → Tabelle in Kapitel 9
5. Kurzer Disclaimer (kein Steuerberatungsersatz) in Kopf/Fuß, nicht der Landing-Langtext

## Platzhalter

- `{{identity.*}}` / `{{answers.*}}` / `{{roles.*}}`
- Arrays: `{{field | join ", "}}`
- Leer: `{{field | or "nicht angegeben"}}`
- `{{openPointsTable}}` — Markdown-Tabelle aus den Rules
- `{{generatedAt}}` / `{{generatedAtDisplay}}`
- `{{version}}` — z. B. `1.0`
- `{{disclaimer}}` — Inhalt von `disclaimer.txt`

**Regel:** Standardtexte (S) beschreiben den allgemeinen Rahmen. Keine erfundenen Zertifikate, Serverpfade oder Personennamen. Keine Zusicherung der Prüfungsfestigkeit. Kein „rechtssicher“.

## PDF-Reihenfolge

Titelseite (0) → 1 Vorbemerkungen → 2 Zielsetzung → 3 Organisation → 4 Papier → 5 Digital → 6 Mitgeltende → 7 Historie → 8 Glossar → 9 Offene Punkte

Kapitel 4 wird gekürzt (`04-verfahren-papier-kurz.md`), wenn der Intake keinen Papierweg erkennen lässt.

## Mapping UI-Schritte → Felder

| UI-Schritt | Felder |
| --- | --- |
| 1 Branche/Rechtsform/MA | branchen, rechtsform, mitarbeitende |
| 2 FiBu/weitereSysteme | fibu, weitereSysteme |
| 3 Eingang/Ausgang/Archiv | eingangsbelege, ausgangsrechnungen, archiv |
| 4 Hosting/Backup/Zugriff | hosting, backup, zugriff |
| 5 GF/Buchhaltung/IT/StB | gf, buchhaltung, it, steuerberater |
