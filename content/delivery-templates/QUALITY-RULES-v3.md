# QUALITY-RULES v3 — Generator-Brief (Philip-Bar)

**Gilt für:** Template-Engine / Builder beim Rendern der Kunden-PDF.  
**Version:** 3.0.0 | Stand: 2026-09-28  
**Referenzton:** `reference/philip-muster-extracted.txt` — kurz, konkret, Tabellen, benannte Rollen; kein 145-Absatz-Klon.

---

## 1. Drei Ausgabe-Modi (zwingend)

| Modus | Wann | Formulierung |
| --- | --- | --- |
| **Präsens (gelebte Praxis)** | Intake-Feld ist **bestätigt** (nicht leer, nicht in `emptyValues`) **und** die Aussage folgt direkt aus dem Feld | „{{answers.buchhaltung}} prüft…“, „… lädt hoch…“ |
| **Hinweis / „ist zu …“** | Feld fehlt oder Aussage wäre Interpretation/Annahme | „ist zu beschreiben“, „ist zu bestätigen“, „laut Intake nicht angegeben“ |
| **Offener Punkt (OP)** | Anspruch im Fließtext würde sonst überclaimen **oder** Rule in `open-points-rules.json` greift | OP-Tabelle; Fließtext darf denselben Lückenhinweis tragen |
| **Abschnitt weglassen** | Kanal/Thema laut Intake **nicht vorhanden** (z. B. kein Papier) | `includeIf` falsch → Kapitel/Abschnitt **omit** oder 1-Zeilen-N/A, kein Vollkapitel |

**Niemals** gelebte Praxis erfinden. **Niemals** „ordnungsgemäß“ / GoBD-Konformität behaupten, wenn kein konkreter Check im Intake steht oder als OP ausgewiesen ist.

---

## 2. Verbotene Inhalte in der Kunden-PDF

Folgende Felder/Inhalte **dürfen nicht** in Cover, Merkmal-Tabelle, Kapiteln oder OP-Tabelle erscheinen:

- `identity.stub`
- `identity.stripeSessionId`
- `identity.stripeCustomerId`
- `rules.json` / Template-Versions-Internals (`QUALITY-RULES`, Engine-Jargon, `includeIf`-Syntax im PDF)
- Builder-/Delivery-Technik („bundle“, „renderer“, „fixture“)

Erlaubt im Kunden-PDF: `identity.company` (und optional `identity.email` nur wenn fachlich nötig — Standard: **nicht** auf dem Deckblatt). Stripe/stub bleiben nur in internen Delivery-Logs.

Rules mit `"customerFacing": false` erzeugen **keine** OP-Zeile im PDF.

---

## 3. Placeholder-Syntax (Builder-Contract)

### 3.1 Werte

```
{{identity.company}}
{{answers.gf}}
{{answers.fibu | join ", "}}
{{answers.archiv | or "zu bestätigen"}}
{{generatedAt}}
{{version}}
{{disclaimer}}
{{openPointsTable}}
```

- Arrays: `| join ", "`
- Leerersatz: `| or "…" ` (Kunden-PDF: bevorzugt „zu bestätigen“, nicht „nicht angegeben“ in Merkmal-Zeilen)
- Rollen leer → OP + Formulierung „zuständige Person ist zu benennen“

### 3.2 Conditionals (Block-Syntax)

Builder implementiert exakt:

```
{{#if <path>}}…{{/if}}
{{#if <path> contains "<token>"}}…{{/if}}
{{#unless <path>}}…{{/unless}}
{{#unless <path> contains "<token>"}}…{{/unless}}
```

Semantik:

| Ausdruck | Wahr wenn |
| --- | --- |
| `{{#if answers.gf}}` | String nicht leer / nicht emptyValue |
| `{{#if answers.backup}}` | Array length > 0 **oder** non-empty string |
| `{{#if answers.eingangsbelege contains "Papier"}}` | Array enthält Token (case-insensitive; Aliase siehe §5) |
| `{{#unless …}}` | Negation |

Verschachtelung erlaubt. Fehlende Pfade = falsy.

Kapitel-/Abschnitts-Flags stehen zusätzlich in `chapter-schema.json` als `includeIf` (gleiche Semantik); Builder darf Schema-Flags **oder** Block-Syntax nutzen — Ergebnis muss identisch sein.

---

## 4. Feld → Claim-Mapping

| Intake-Feld | Darf behaupten (Präsens) | Sonst |
| --- | --- | --- |
| `identity.company` | Firmenname auf Titel/Merkmal | OP high; kein PDF ohne Firma |
| `answers.branchen`, `rechtsform`, `mitarbeitende` | Merkmal „Betrieb“-Zeile | Teil-Hinweis „zu bestätigen“ |
| `answers.gf`, `buchhaltung`, `it`, `steuerberater` | Benannte Rolle in Sätzen | OP; „ist zu benennen“ |
| `answers.fibu[]` | Genannte FiBu/Systeme | OP high |
| `answers.weitereSysteme` | Genannte Vorsysteme | OP low („prüfen ob weitere…“) auch wenn gefüllt optional; **leer** → OP |
| `answers.eingangsbelege[]` | Zeilen/Abschnitte nur für genannte Kanäle | leer → OP high; kein Papier-Volltext ohne Token |
| `answers.ausgangsrechnungen[]` | Ausgangsweg | OP high wenn leer |
| `answers.archiv` | Ablageort | OP high |
| `answers.hosting` | Hosting-Hinweis | OP medium |
| `answers.backup[]` | „Sicherung laut Anbieter/Intake“ | **kein** Wiederherstellungstest behaupten → immer OP `op-backup-test` sofern nicht explizit bestätigt (Intake hat kein Test-Feld → OP) |
| `answers.zugriff` | Zugriffskreis grob | Berechtigungsliste als mitgeltende Unterlage → OP `op-berechtigungsliste` |

**Kontrollen / Stichprobe:** Intake hat **kein** Feld für monatliche Stichprobe. Daher **niemals** „monatliche Stichprobe von n Belegen“ im Präsens. Stattdessen Hinweis + OP `op-kontrollprotokoll`.

**E-Rechnung Validierung:** Wenn Kanal E-Rechnung/ZUGFeRD/XRechnung vorhanden: strukturierte Datei vs. PDF-Ansicht beschreiben; technische Validierung + Protokoll → OP `op-erechnung-validierung` (kein „wird validiert“ ohne Intake-Bestätigung).

---

## 5. Kanal-Aliase (`contains`)

Builder normalisiert Tokens case-insensitive; folgende Aliase gelten als gleichwertig:

| Logische Gruppe | Tokens (Beispiele) |
| --- | --- |
| `papier` | `Papier`, `Post`, `Scan`, `Papierbeleg` |
| `email-pdf` | `E-Mail`, `Email`, `PDF`, `E-Mail-PDF`, `PDF per E-Mail` |
| `erechnung` | `E-Rechnung`, `eRechnung`, `ZUGFeRD`, `XRechnung`, `XML` |
| `digital` | `digital`, `Portal`, `Download` + email-pdf + erechnung |
| `kasse` | `Kasse`, `Bar`, `EC-Beleg` |

`includeIf`-Beispiele in Schema nutzen die **logische Gruppe** oder Roh-Token; Builder mappt Aliase.

---

## 6. Aufbewahrung (fachlich)

- **Buchungsbelege:** i. d. R. **8 Jahre** (§ 147 AO / § 257 HGB, aktuelle Fassung) — **kein** pauschales „10 Jahre für alle“.
- Andere Unterlagenarten können 6 oder 10 Jahre erfordern — Formulierung: „richtet sich nach Unterlagenart… vor Löschung Fristbeginn/Sonderfälle prüfen“.
- E-Rechnung: strukturierter Teil (XML/ZUGFeRD-Original) unversehrt aufbewahren; PDF-Ansicht = Lesehilfe.

Keine Rechtsberatung; Quellen nur als Einordnung (Kap. 10).

---

## 7. Conditional Chapters (v3-Baum)

| Kapitel | includeIf / Regel |
| --- | --- |
| 00 Cover | immer |
| 01 Merkmal | immer |
| 02 Zweck | immer |
| 03 Systeme/Belegarten | immer; **Zeilen** nur für vorhandene Kanäle |
| 04 Eingang/Prüfung | immer; Unterblöcke conditional (email/PDF, E-Rechnung, Papier) |
| 05 Freigabe/Buchung | immer |
| 06 Aufbewahrung | immer; Backup-Satz nur wenn `answers.backup` gesetzt, sonst OP-Hinweis |
| 07 Kontrollen | immer; nur Änderungsregeln in Präsens; Kontrollroutine = Hinweis/OP |
| 08 Anlagen/OP | immer |
| 09 Version/Bestätigung | immer — Sign-off-Platzhalter, **nicht** auto-bestätigt |
| 10 Quellen | immer (kurz, Typ S) |

Wenn `eingangsbelege` **kein** Papier-Token: **kein** Papier-Vollabsatz; optional ein Satz „Papierweg laut Intake nicht angegeben“ + kein OP nur deshalb, **außer** Eingangswege insgesamt leer.

---

## 8. Widerspruch / Konformität

Verboten ohne dokumentierten Check oder OP:

- „ordnungsgemäß“, „GoBD-konform“, „prüfungsfest“, „revisionssicher“ als Feststellung
- „Backup wird getestet“, „E-Rechnung wird validiert“, „monatliche Stichprobe“ ohne Intake

Erlaubt: Beschreibung des **genannten** Ablaufs + Verweis auf OP.

---

## 9. Disclaimer

Kurzzeile auf Cover + voller Text aus `disclaimer.txt` (Fuß/Anhang). Kern:

- kein StB-/RA-Ersatz
- keine Konformitätszusicherung
- Generierung ≠ betriebliche Bestätigung durch GF

---

## 10. Erfolgskriterien (Acceptance)

1. Struktur = Philip-Muster (lean, Tabellen, benannte Rollen).
2. Leerer Intake → Präsens-Claims fehlen; OPs/Hinweise statt Erfindung.
3. 8 Jahre für Buchungsbelege; E-Rechnung-Unterscheidung vorhanden wenn Kanal da.
4. Kein stripe/stub/stub-Jargon in Kundenkapiteln.
5. Fixture `sample-intake-partner-trust.json` + `FIXTURE-CHECKLIST-v3.md` grün für Muster-PDF.
6. `bundle.json` valid, Version `3.0.0`.
