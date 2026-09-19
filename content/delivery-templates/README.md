# GoBD Delivery — Content-Templates v1 (Slice A+B)

Im Repo unter `content/delivery-templates/`. Der Builder rendert lokal aus Intake → PDF-Bytes → Blob. Keine Live-API. Single source: **bundle.json**.



Für **GoBD Builder**: lokal aus Intake rendern → PDF-Bytes → Blob. Keine Live-API.

## Eingabe

JSON `IntakeAnswers` + `identity` wie im Builder-Contract (siehe `sample-intake.json`).

## Ausgabe (vom Renderer erzeugen)

1. Cover (`cover.md`)
2. Kapitel 1–5 aus `chapters/*.md` (Platzhalter ersetzen)
3. Offene Punkte aus `open-points-rules.json` → Tabelle in Kapitel 6
4. Disclaimer aus `disclaimer.txt` (Cover + Fußzeile)

## Platzhalter

- `{{identity.*}}` / `{{answers.*}}`
- Arrays: `{{field | join ", "}}`
- Leer: `{{field | or "nicht angegeben"}}`
- `{{openPointsTable}}` — Markdown-Tabelle aus den Rules
- `{{generatedAt}}` — ISO-Datum Europe/Berlin
- `{{disclaimer}}` — Inhalt von `disclaimer.txt`

**Regel:** Keine erfundenen GoBD-Rechtstexte. Nur Intake-Hints + Struktur + Offene Punkte.

## Empfohlene PDF-Reihenfolge

cover → 01 → 02 → 03 → 04 → 05 → 06 → disclaimer (Fuß)

## Mapping UI-Schritte → Felder

| UI-Schritt | Felder |
| --- | --- |
| 1 Branche/Rechtsform/MA | branchen, rechtsform, mitarbeitende |
| 2 FiBu/weitereSysteme | fibu, weitereSysteme |
| 3 Eingang/Ausgang/Archiv | eingangsbelege, ausgangsrechnungen, archiv |
| 4 Hosting/Backup/Zugriff | hosting, backup, zugriff |
| 5 GF/Buchhaltung/IT/StB | gf, buchhaltung, it, steuerberater |

## Später (nicht v1)

Fertige Kapiteltexte (markdown/HTML) von Delivery; optional HTTP POST.
