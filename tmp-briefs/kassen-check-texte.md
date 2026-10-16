---
status: "draft"
titel: "Kassen- und TSE-Meldecheck"
route: "/kassen-check"
noindex: true
ctaSoft: "/readiness"
ctaSecondary: "/ampel-check"
stand: "2026-10-16"
quellen:
  - "§ 146a AO — https://www.gesetze-im-internet.de/ao_1977/__146a.html"
  - "BMF-Schreiben vom 28.06.2024, IV D 2 - S 0316-a/19/10011 :009, DOK 2024/0511821 — https://www.bundesfinanzministerium.de/Content/DE/Downloads/BMF_Schreiben/Weitere_Steuerthemen/Abgabenordnung/2024-06-28-mitteilungsverpflichtung-nach-AO.pdf?__blob=publicationFile&v=7"
---

# Kassen- und TSE-Meldecheck

**H1:** Kassen- und TSE-Meldecheck: Sind Ihre Kassen beim Finanzamt gemeldet?

**Intro:** Beantworten Sie 6 Fragen mit Ja oder Nein und sehen Sie, ob Ihre elektronischen Kassen und deren Meldungen an das Finanzamt vollständig erscheinen. Der Check dient der Orientierung und ersetzt keine Steuerberatung.

Struktur wie `lib/ampel-questions.ts` (`id`, `question`, `explanation`, `weight`, `applicable`, `source`). Antworten: Ja / Nein, bei `optional` zusätzlich „Trifft nicht zu“.

## 1. Fragen

### 1.1 `kasse_tse` · weight 3 · required
**Frage:** Ist jede elektronische Kasse in Ihrem Betrieb durch eine zertifizierte technische Sicherheitseinrichtung (TSE) geschützt?
**Erläuterung:** Elektronische Aufzeichnungssysteme und ihre digitalen Aufzeichnungen sind durch eine zertifizierte technische Sicherheitseinrichtung zu schützen. Sie besteht aus Sicherheitsmodul, Speichermedium und einheitlicher digitaler Schnittstelle.
**Quelle:** § 146a Abs. 1 Satz 2 und 3 AO

### 1.2 `meldung_neu` · weight 3 · optional
**Frage:** Haben Sie Kassen, die Sie seit dem 01.07.2025 angeschafft, gemietet oder geleast haben, innerhalb eines Monats über Mein ELSTER (oder Ihre Kassen- bzw. Steuersoftware) an das Finanzamt gemeldet?
**Erläuterung:** Ab dem 01.07.2025 angeschaffte elektronische Aufzeichnungssysteme sind innerhalb eines Monats nach Anschaffung mitzuteilen, nach amtlich vorgeschriebenem Datensatz per Datenfernübertragung. Die Übermittlung steht über „Mein ELSTER“ und die ERiC-Schnittstelle zur Verfügung. Gemietete oder geleaste Systeme stehen angeschafften gleich.
**Quelle:** § 146a Abs. 4 Satz 1 und 2 AO; BMF-Schreiben vom 28.06.2024, Abschnitt I (mit Verweis auf AEAO zu § 146a Nr. 1.16.2.6)

### 1.3 `meldung_bestand` · weight 3 · optional
**Frage:** Sind auch die Kassen gemeldet, die Sie schon vor dem 01.07.2025 im Einsatz hatten?
**Erläuterung:** Für vor dem 01.07.2025 angeschaffte Systeme sah das BMF-Schreiben eine Mitteilung bis zum 31.07.2025 vor. Dieser Termin liegt in der Vergangenheit. Wenn eine Meldung noch fehlt, besprechen Sie das weitere Vorgehen mit Ihrer Steuerberatung.
**Quelle:** BMF-Schreiben vom 28.06.2024, Abschnitt I

### 1.4 `meldung_ausserbetrieb` · weight 2 · optional
**Frage:** Haben Sie Kassen, die Sie seit dem 01.07.2025 außer Betrieb genommen haben, innerhalb eines Monats als Außerbetriebnahme gemeldet?
**Erläuterung:** Auch die Außerbetriebnahme ist innerhalb eines Monats mitzuteilen. Dabei muss die Anschaffung des Systems vorher gemeldet worden sein.
**Quelle:** § 146a Abs. 4 Satz 1 Nr. 8 und Satz 2 AO; BMF-Schreiben vom 28.06.2024, Abschnitt I

### 1.5 `meldung_vollstaendig` · weight 2 · optional
**Frage:** Enthält Ihre Meldung je Betriebsstätte alle dort genutzten elektronischen Kassen?
**Erläuterung:** Bei jeder Mitteilung sind stets alle elektronischen Aufzeichnungssysteme einer Betriebsstätte in einer einheitlichen Mitteilung zu übermitteln.
**Quelle:** BMF-Schreiben vom 28.06.2024, Abschnitt I (mit Verweis auf AEAO zu § 146a Nr. 1.16.1.4)

### 1.6 `meldung_angaben` · weight 2 · optional
**Frage:** Stimmen die gemeldeten Angaben noch mit Ihrem heutigen Stand überein — insbesondere Art der TSE, Art, Anzahl und Seriennummer der Kassen?
**Erläuterung:** Die Mitteilung umfasst unter anderem Name und Steuernummer, Art der zertifizierten technischen Sicherheitseinrichtung, Art und Anzahl der Systeme, Seriennummer sowie Datum der Anschaffung und gegebenenfalls der Außerbetriebnahme. Wurde zum Beispiel eine TSE getauscht, klären Sie mit Ihrer Steuerberatung, ob und wie die Mitteilung anzupassen ist.
**Quelle:** § 146a Abs. 4 Satz 1 Nr. 1–8 AO

## 2. Ergebnistexte

Auswertung wie Ampel-Check (Gewichtung; „Trifft nicht zu“ zählt nicht). Schwellen übernimmt der Builder aus `lib/ampel-questions.ts` bzw. der dortigen Auswertungslogik.

**Grün — Ihre Kassenmeldungen wirken vollständig.**
Nach Ihren Angaben sind Ihre Kassen mit einer TSE ausgestattet und die Meldungen an das Finanzamt aktuell. Bewahren Sie die Übermittlungsbestätigungen auf und prüfen Sie die Angaben, wenn sich an Ihren Kassen etwas ändert. Wie Kasse, Abschluss und Belege bei Ihnen ablaufen, halten Sie in der Verfahrensdokumentation fest.

**Gelb — Einzelne Punkte sind offen.**
Bei einigen Fragen haben Sie mit Nein geantwortet. Häufig betrifft das eine Kasse, die ersetzt oder abgeschafft wurde, oder eine Meldung, die nicht alle Kassen einer Betriebsstätte enthält. Gehen Sie die offenen Punkte in Ruhe durch und klären Sie sie mit Ihrer Steuerberatung.

**Rot — Grundlegende Punkte sind noch offen.**
Nach Ihren Angaben fehlen eine TSE oder die Meldung einer oder mehrerer Kassen. Sprechen Sie zeitnah mit Ihrer Steuerberatung über die nächsten Schritte. Die Erläuterungen und Quellen zu jeder Frage helfen Ihnen, das Gespräch vorzubereiten.

**Disclaimer (unter jedem Ergebnis):**
> Keine Steuerberatung, keine Zusicherung zu Prüfungsergebnissen. Der Check ist eine allgemeine Orientierung auf Grundlage Ihrer Angaben und ersetzt keine Prüfung durch Ihre Steuerberatung.

## 3. Opt-in (nur E-Mail)

**Überschrift:** Ergebnis mit Quellen per E-Mail erhalten
**Text:** Wenn Sie möchten, senden wir Ihnen Ihr Ergebnis mit allen Erläuterungen und Quellen an Ihre E-Mail-Adresse. Das Ergebnis sehen Sie auch ohne Eingabe direkt auf dieser Seite.
**Feld:** E-Mail-Adresse
**Button:** Ergebnis senden
**Hinweis unter dem Feld:** Hinweise zur Verarbeitung Ihrer Daten finden Sie in der [Datenschutzerklärung](/datenschutz).

(Keine Aussagen zu Löschfristen oder automatischer Löschung. Ob Einwilligung/Double-Opt-in nötig ist, legt Philip bzw. die Datenschutzerklärung fest — nicht Teil dieses Textes.)

## 4. Weiterführender Hinweis (Ziele nur im Frontmatter: `ctaSoft` /readiness, `ctaSecondary` /ampel-check)

Die Meldung ist ein Baustein. Wie Ihre Kasse im Alltag läuft — wer kassiert, zählt, storniert und Belege weitergibt —, beschreibt die Verfahrensdokumentation. Der Readiness-Check zeigt in drei Schritten, welche Bereiche bei Ihnen vorkommen. Für einen breiteren Blick auf Ihre Buchführung gibt es den Ampel-Check mit 10 Fragen.

## 5. Geprüfte Quellen (abgerufen 2026-10-16)
- § 146a AO (Abs. 1, 2, 4), Wortlaut: https://www.gesetze-im-internet.de/ao_1977/__146a.html
- BMF-Schreiben vom 28.06.2024, „Beginn der Mitteilungsverpflichtung nach § 146a Absatz 4 AO“, GZ IV D 2 - S 0316-a/19/10011 :009, DOK 2024/0511821, PDF-Volltext gelesen: https://www.bundesfinanzministerium.de/Content/DE/Downloads/BMF_Schreiben/Weitere_Steuerthemen/Abgabenordnung/2024-06-28-mitteilungsverpflichtung-nach-AO.pdf?__blob=publicationFile&v=7
- Nur über das BMF-Schreiben zitiert, nicht selbst geprüft: AEAO zu § 146a Nr. 1.16.1.4 und 1.16.2.6.

## Offen / nicht verifiziert
- Ob ein **TSE-Tausch** bei einer Kasse (nicht Taxameter) eine neue Mitteilung auslöst: nicht verifiziert. Das BMF-Schreiben nennt „Ausrüstung mit einer TSE“ nur für EU-Taxameter/Wegstreckenzähler. Frage 1.6 deshalb neutral formuliert, mit Verweis auf Steuerberatung. Klärung möglich über die BMF-Ausfüllanleitung (https://www.bundesfinanzministerium.de/Content/DE/Downloads/Steuern/FAQ-Ausfuellanleitung.html, nicht gelesen).
- Taxameter/Wegstreckenzähler bewusst nicht als eigene Frage aufgenommen (abweichende Regeln im BMF-Schreiben, Abschnitt II).
- Keine Aussage zu Folgen fehlender Meldungen (nicht geprüft, außerdem Angstverkauf).
