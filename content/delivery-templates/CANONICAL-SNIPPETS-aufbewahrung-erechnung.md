# Kanonische Snippets — Aufbewahrung & E-Rechnung (Partner-Trust / Generator)

Für Builder (bc-fb5d8f6a). Kein Halbwissen: Rahmen laut Gesetz/BMF-FAQ; **keine** Konformitätszusicherung.
Quellen zur Einordnung: § 147 AO, § 257 HGB; BMF FAQ E-Rechnung; GoBD (BMF).

Legende:
- **S (Standardrahmen)** = immer so formulieren, wenn Kapitel „Aufbewahrung“/„Belegarten“ erscheint
- **P (Prozess, Präsens)** = nur wenn Intake den konkreten Weg bestätigt
- **H (Hinweis)** = wenn Intake unklar/leer → kein Präsens-Prozess
- **OP** = offener Punkt, wenn Text eine Prüfung/Anlage verlangt, die nicht bestätigt ist

---

## 1. Aufbewahrungsdauer (Buchungsbelege ≠ pauschal 10 Jahre)

### S — kanonisch (2–4 Sätze, Kundendoc)
Die Aufbewahrungsdauer richtet sich nach der jeweiligen Unterlagenart und den geltenden Vorschriften; sie wird nicht aus einer pauschalen Frist für alle Belege abgeleitet. Buchungsbelege unterliegen nach aktueller Regelung (§ 147 AO, § 257 HGB) grundsätzlich einer Frist von acht Jahren. Andere Dokumentationsarten können abweichende Fristen erfordern (insbesondere sechs oder zehn Jahre). Fristbeginn, Sonderfälle und eine etwaige längere Aufbewahrung werden vor einer Löschung oder Vernichtung geprüft.

### H — wenn Intake keine Archiv-/Löschpraxis bestätigt
Ob und wie Fristen im Betrieb konkret überwacht und vor Löschung geprüft werden, ist aus dem Intake nicht hinreichend belegt und bleibt zu bestätigen.

### OP — wenn Text „wir prüfen vor Löschung“ behauptet, ohne Bestätigung
Kennung z. B. `OP-AUFBEWAHRUNG-FRIST`: Verfahren zur Fristüberwachung und Freigabe vor Löschung/Vernichtung konkretisieren und dokumentieren.

### Nicht schreiben
- „Alle Belege werden zehn Jahre aufbewahrt.“
- „Die GoBD verlangt pauschal zehn Jahre.“
- Konformitätsfloskeln („damit ist die Aufbewahrung GoBD-konform“).

---

## 2. E-Rechnung 2025 — strukturiert vs. PDF/Ansicht

### S — kanonisch (2–4 Sätze, Kundendoc)
Bei strukturierten elektronischen Rechnungen ist die empfangene maschinenlesbare Datei (z. B. XML bzw. der strukturierte Anteil bei ZUGFeRD) das aufbewahrungspflichtige Original in dem Format, in dem sie empfangen wurde. Eine PDF- oder Bildschirmansicht dient nur der Lesbarkeit und ersetzt die strukturierte Originaldatei nicht. Abweichungen zwischen Ansicht und strukturiertem Inhalt werden vor einer Freigabe geklärt. Die konkrete technische Validierung und deren Nachweisführung sind nur dann als gelebter Prozess zu beschreiben, wenn sie im Intake bestätigt sind.

### P — nur bei bestätigtem digitalem E-Rechnungs-Eingang (Intake)
Beispielpräsens (Rollen aus Intake, z. B. `{{answers.buchhaltung}}`):  
`{{answers.buchhaltung}}` prüft eingehende strukturierte E-Rechnungen auf technische Lesbarkeit. Die Originaldatei bleibt unverändert erhalten; eine Ansicht wird nicht als Ersatzoriginal abgelegt.

### H — wenn Intake E-Mail/PDF nennt, aber keine strukturierte E-Rechnung bestätigt
Ob strukturierte E-Rechnungen empfangen und wie sie technisch geprüft werden, ist aus dem Intake nicht bestätigt und bleibt zu beschreiben.

### OP — wenn Kapitel E-Rechnung anspricht ohne bestätigte Validierung
Kennung z. B. `OP-ERECHNUNG-VALIDIERUNG`: Verfahren und Nachweis der technischen Prüfung strukturierter E-Rechnungen konkretisieren.

### Nicht schreiben
- „PDF-Rechnungen per E-Mail sind E-Rechnungen im Sinne der Pflicht ab 2025.“ (fachlich unsauber vermengen)
- „Die Ansicht reicht als Aufbewahrung.“
- Unbelegte Validierungs-/Protokoll-Prozesse im Präsens.

---

## 3. Generator-Regel (kurz)

| Situation | Ausgabe |
|---|---|
| Thema muss im Kapitel vorkommen (Rahmen) | **S**-Sätze |
| Intake bestätigt konkreten Ablauf/Rolle | **P**-Sätze |
| Intake fehlt / unklar | **H** + ggf. **OP** |
| Kein Bezug im Intake (z. B. kein E-Rechnungs-Kanal) | Abschnitt weglassen oder ein Satz N/A — kein erfundenes Verfahren |

Identity-Felder `stub` / `stripeSessionId` / `stripeCustomerId` **nie** ins Kundendoc.
