# GoBD Delivery — Content-Templates v2.0.0

Für **GoBD Builder**: lokal aus Intake rendern → PDF-Bytes → Blob. Keine Live-API.

Diese Version hebt die Kapitelstruktur und Texttiefe auf das Niveau einer prüfbaren Verfahrensdokumentation zur Belegablage (Referenzstruktur), bleibt aber **strikt intake-parametrisiert**. Es wird keine einzelfallbezogene Steuerberatung formuliert.

## Was sich für den Builder ändert (v1 → v2)

| Thema | v1 | v2 |
| --- | --- | --- |
| Kapitelanzahl | 6 (flach) | 10 (Cover + 9 Inhalt), Outline wie Referenz |
| Texttiefe | Kurzabsätze | Nummerierte Absätze `[1][2]…` mit Prozessbeschreibung |
| Rechtlicher Rahmen | bewusst weggelassen | Allgemeine Rechtslage laut Gesetzestext (HGB/AO/UStG-Fristen), klar als keine Beratung gekennzeichnet |
| Papier / Digital | ein Beleg-Kapitel | getrennte Verfahrenketten (Kap. 4 / 5) |
| Zuständigkeiten | eine Tabelle | Rollen → Prozessschritte, fehlende Werte als „offen“ + Offene Punkte |
| `VERSION` | — | Datei `VERSION` = `2.0.0` |
| Dokumentversion im PDF | — | Placeholder `{{version}}` (Default `1.0`, vom Builder setzbar) |
| Cover | `cover.md` root | `chapters/00-cover.md` (auch in `bundle.json` → `coverMarkdown`) |

**Builder macht weiterhin:** Logo-Header, Platzhalterersetzung, Offene-Punkte-Tabelle aus Rules, Disclaimer einbetten, PDF-Render. Keine inhaltliche Texterfindung.

## Eingabe

JSON `identity` + `answers` wie im Builder-Contract (siehe `sample-intake.json`).

### Intake-Felder (camelCase)

- `identity`: `email`, `company`, `stripeSessionId`, `stripeCustomerId`, `stub`
- `answers`: `branchen[]`, `rechtsform`, `mitarbeitende`, `fibu[]`, `weitereSysteme`, `eingangsbelege[]`, `ausgangsrechnungen[]`, `archiv`, `hosting`, `backup[]`, `zugriff`, `gf`, `buchhaltung`, `it`, `steuerberater`

## Ausgabe-Reihenfolge (PDF)

1. Cover (`00-cover`) — Titel, Unternehmen, Version, Stand, Disclaimer
2. Vorbemerkungen
3. Zielsetzung und Überblick (Unterabschnitte 2.1–2.6)
4. Organisation und Sicherheit (3.1–3.4)
5. Verfahren Papier (Prozesskette)
6. Verfahren Digital (Prozesskette)
7. Mitgeltende Unterlagen
8. Änderungshistorie (Tabellenvorlage)
9. Glossar
10. Offene Punkte (`{{openPointsTable}}`)
11. Disclaimer erneut in Fußzeile (aus `disclaimer.txt`)

Schema: `chapter-schema.json`. Einzelimport: `bundle.json`.

## Platzhalter

- `{{identity.*}}` / `{{answers.*}}`
- Arrays: `{{field | join ", "}}`
- Leer: `{{field | or "nicht angegeben"}}` (in Rollenzuordnungen teils `| or "offen"`)
- `{{openPointsTable}}` — Markdown-Tabelle aus `open-points-rules.json`
- `{{generatedAt}}` — Datum/Zeit Europe/Berlin
- `{{version}}` — Dokumentversion (Default `1.0`)
- `{{disclaimer}}` — Inhalt von `disclaimer.txt`

**Regeln:** Keine erfundenen Unternehmensfakten. Keine SDC-/personenbezogenen Referenzinhalte. Keine Steuerberatung; Disclaimer ist verbindlich. Gesetzliche Fristen nur als allgemeine Gesetzeswiedergabe.

## Mapping UI-Schritte → Felder

| UI-Schritt | Felder | Primärkapitel |
| --- | --- | --- |
| 1 Branche/Rechtsform/MA | branchen, rechtsform, mitarbeitende | 02-zielsetzung |
| 2 FiBu/weitereSysteme | fibu, weitereSysteme | 03-organisation-sicherheit |
| 3 Eingang/Ausgang/Archiv | eingangsbelege, ausgangsrechnungen, archiv | 04 + 05 |
| 4 Hosting/Backup/Zugriff | hosting, backup, zugriff | 03 (+ 04/05 Sicherung) |
| 5 GF/Buchhaltung/IT/StB | gf, buchhaltung, it, steuerberater | 03-organisation-sicherheit |

## bundle.json regenerieren

```bash
node content/delivery-templates/build-bundle.mjs
```

`bundle.json` enthält: `version`, `disclaimer`, `coverFile`, `coverMarkdown`, `chapters[]` (id, file, markdown), `openPointsRules`.

## Dateien

- `VERSION` — `2.0.0`
- `chapter-schema.json` — Kapitel-IDs, Order, Felder, Subsections
- `chapters/*.md` — Einzeltemplates
- `open-points-rules.json` — Rules inkl. Severity
- `disclaimer.txt` — verstärkter Disclaimer
- `bundle.json` — Single-Import
- `sample-intake.json` — Beispiel-Intake
- `CHANGELOG.md` — v1→v2
- `reference/` — Referenzmaterial (nicht in PDF übernehmen)
