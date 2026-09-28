# GoBD Delivery — Content-Templates v2.0.0

Für **GoBD Builder**: lokal aus Intake rendern → PDF-Bytes → Blob. Keine Live-API.

Diese Version bleibt **strikt intake-parametrisiert**. Präsens im PDF nur für bestätigte Fragebogenangaben. Nicht abgefragtes wird Hinweis oder offener Punkt („zu beschreiben/zu bestätigen“). Keine einzelfallbezogene Steuerberatung. Ein Papierkapitel nur bei „Papierordner“ oder „Scan / App“.

## Was sich für den Builder ändert (v1 → v2)

| Thema | v1 | v2 |
| --- | --- | --- |
| Kapitelanzahl | 6 (flach) | 10 (Cover + 9 Inhalt), Outline wie Referenz |
| Texttiefe | Kurzabsätze | Festgelegte Angaben, Hinweise, offene Punkte — kein erfundener Ablauf |
| Rechtlicher Rahmen | bewusst weggelassen | Hinweis nach Unterlagenart (Buchungsbelege grundsätzlich 8 Jahre; andere 10 oder 6), keine Pauschale, keine fallbezogene Beratung |
| Papier / Digital | ein Beleg-Kapitel | Papierkapitel nur bei Papierordner oder Scan/App; sonst entfällt es |
| Zuständigkeiten | eine Tabelle | Benannte Stellen aus dem Fragebogen; keine erfundenen Prozessrollen |
| `VERSION` | — | Datei `VERSION` = `2.0.0` |
| Dokumentversion im PDF | — | Placeholder `{{version}}` (Default `1.0`, vom Builder setzbar) |
| Cover | `cover.md` root | `chapters/00-cover.md` (auch in `bundle.json` → `coverMarkdown`) |

**Builder macht weiterhin:** Logo-Header, Platzhalterersetzung, Offene-Punkte-Tabelle aus Rules, Disclaimer einbetten, PDF-Render. Keine inhaltliche Texterfindung.

## Eingabe

JSON `identity` + `answers` wie im Builder-Contract (siehe `sample-intake.json`).

### Intake-Felder (camelCase)

- `identity`: `email`, `company`, `stripeSessionId`, `stripeCustomerId`, `stub`
- Stripe-Session, Stripe-Kunde und Stub bleiben in der Identität für Checkout, Webhook und Konto. Sie stehen nicht auf dem Deckblatt und sind keine fachlichen offenen Punkte.
- `answers`: `branchen[]`, `rechtsform`, `mitarbeitende`, `fibu[]`, `weitereSysteme`, `eingangsbelege[]`, `ausgangsrechnungen[]`, `archiv`, `hosting`, `backup[]`, `zugriff`, `gf`, `buchhaltung`, `it`, `steuerberater`

## Ausgabe-Reihenfolge (PDF)

1. Cover (`00-cover`) — Titel, Unternehmen, Version, Stand, Disclaimer
2. Zweck und Grenzen
3. Systeme und Belegarten
4. Verantwortung, Zugriff und Aufbewahrung
5. Papierweg — nur wenn der Eingang Papierordner oder Scan/App enthält
6. Eingang, Ausgang und Ablage
7. Mitgeltende Unterlagen (als Hinweis, nicht als vorhanden)
8. Version
9. Quellen (Hinweis)
10. Offene Punkte (`{{openPointsTable}}`)
11. Kurzzeile in der Fußzeile, ohne Dokument-ID und ohne technische Referenzen

Schema: `chapter-schema.json`. Einzelimport: `bundle.json`.

## Platzhalter

- `{{identity.*}}` / `{{answers.*}}`
- Arrays: `{{field | join ", "}}`
- Leer: `{{field | or "nicht angegeben"}}`
- `{{openPointsTable}}` — Markdown-Tabelle aus dem Regelsatz (leer, includes, always). Keine Widerspruchsprüfung. Der Dateiname steht nicht im Kunden-PDF.
- `{{generatedAt}}` — Datum/Zeit Europe/Berlin
- `{{version}}` — Dokumentversion (Default `1.0`)
- `{{disclaimer}}` — Inhalt von `disclaimer.txt`

**Regeln:** Keine erfundenen Unternehmensfakten. Keine Präsens-Sätze ohne passende Fragebogenangabe. Hinweise als Hinweise kennzeichnen. Nicht zutreffende Kapitel weglassen. Keine technischen Artefakte im Kunden-PDF (keine Session-, Kunden- oder Stub-Referenzen, keine Regelsatz-Dateipfade, keine Dokument-ID in der Fußzeile). Keine Behauptung „widersprüchliche Angaben“, solange keine Widerspruchsprüfung existiert. „Freigabe durch die Geschäftsführung“ nur als ausstehend, nicht als bereits erfolgt. Aufbewahrung nach Unterlagenart: Buchungsbelege grundsätzlich acht Jahre, nicht pauschal zehn für alles. Keine Steuerberatung; Disclaimer ist verbindlich.

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
