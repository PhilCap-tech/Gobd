# Fixture-Checkliste v3 — Partner-Trust Muster-PDF

**Fixture:** `sample-intake-partner-trust.json`  
**Profil:** kleine GmbH · DATEV · E-Mail/PDF-Eingang · digital · **kein Papier**  
**Qualität:** Philip-Muster + `QUALITY-RULES-v3.md` + `CANONICAL-SNIPPETS-aufbewahrung-erechnung.md`

## Muss im PDF erscheinen
- [ ] Cover mit Firmenname, Fassung, Datum, Disclaimer (kein StB/GoBD-Konformitätsclaim)
- [ ] Merkmal-Tabelle: Betrieb, Geltungsbereich, Verantwortung, Systeme, Stand
- [ ] Zweck und Grenzen
- [ ] Systeme und Belegarten — Zeilen für E-Mail/PDF-Eingang + Ausgang; **kein** Papier-Weg als gelebter Prozess
- [ ] Eingang und Prüfung — digitaler Zweig (Postfach-Sichtung); E-Rechnung-Validierung nur als Hinweis/OP falls nicht bestätigt
- [ ] Freigabe / Buchung / Nachvollziehbarkeit — Rollen aus gf/buchhaltung; Kanzlei ohne unterstellte Freigabe
- [ ] Aufbewahrung: **Buchungsbelege i.d.R. acht Jahre** (§147 AO / §257 HGB); keine Pauschal-10 für alle
- [ ] E-Rechnung-Rahmen falls Format angesprochen: strukturierte Datei ≠ PDF-Ansicht
- [ ] Kontrollen: **keine** erfundene Monats-Stichprobe im Präsens → OP
- [ ] Offene-Punkte-Tabelle (customerFacing)
- [ ] Version + Platzhalter betriebliche Bestätigung (nicht auto-bestätigt)
- [ ] Kurze Quellen

## Darf NICHT erscheinen
- [ ] `stub`, `stripeSessionId`, `stripeCustomerId`
- [ ] `rules.json` / Engine-/Bundle-Jargon
- [ ] Vollkapitel Papier/Scan/ersetzendes Scannen (Fixture hat keinen Papierweg)
- [ ] „Alle Belege 10 Jahre“
- [ ] GoBD-konform / Ordnungsmäßigkeit zugesichert
- [ ] Unbelegte Backup-Wiederherstellungstests im Präsens

## Erwartete Offene Punkte (mindestens)
- OP zu E-Rechnung-Validierung / technischer Prüfung (wenn angesprochen ohne Bestätigung)
- OP Backup-/Rücksicherungstest (Anbieter-Backup allein reicht nicht als geprüfte Wiederherstellung)
- OP Kontrollprotokoll / konkrete Kontrollroutine (H01 unbekannt)
- OP Kanzlei-Leistungsumfang wenn nur Name, keine bestätigte F05
- OP weitere Vorsysteme / Berechtigungsliste nach Bedarf

## Mapping Intake → Kanäle
| answers.eingangsbelege | Kapitel 4 |
|---|---|
| E-Mail, PDF | Digital-/E-Mail-Zweig |
| (kein Papier/Scan/Post) | Papier-Abschnitt omit |

## Abnahme
1. Generator mit Fixture → PDF  
2. Checkliste oben abhaken  
3. Philip-Freigabe vor Soft-Invite / Kanzlei-Empfehlung  
