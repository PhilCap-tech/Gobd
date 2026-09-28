# GoBD Delivery — Template-Outline v3 (Philip-Bar)

**Zweck:** Kurzer Kapitelbaum für CoS/Builder.  
**Version:** 3.0.0 | Stand: 2026-09-28  
**Qualität:** `QUALITY-RULES-v3.md` · Referenz: `reference/philip-muster-extracted.txt`  
**Intake (camelCase):**  
`identity.email|company|stripeSessionId|stripeCustomerId|stub`  
`answers.branchen[]|rechtsform|mitarbeitende|fibu[]|weitereSysteme|eingangsbelege[]|ausgangsrechnungen[]|archiv|hosting|backup[]|zugriff|gf|buchhaltung|it|steuerberater`

Legende: **S** Standard · **I** Intake · **O** Offener Punkt · **C** conditional

---

## 0 Cover — S + I
Titel „Verfahrensdokumentation zur Belegablage“ · **{{identity.company}}** · Fassung **{{version}}** · Stand **{{generatedAt}}** · Kurzdisclaimer.  
**Nicht:** stripe*, stub, email (optional weglassen).

## 1 Merkmal-Tabelle — I / O
Zeilen: Betrieb | Geltungsbereich | Verantwortung | Systeme | Stand — nur bestätigte Werte oder „zu bestätigen“.

## 2 Zweck und Grenzen — S + I
Tatsächlicher Belegweg im Geltungsbereich; GF prüft gegen Praxis; Software/Kanzlei ≠ betriebliche Bestätigung.

## 3 Systeme und Belegarten — I / C / O
Tabelle Belegart/Weg | Original und Ablage.  
Zeilen nur für Kanäle in `eingangsbelege` / `ausgangsrechnungen`. Fehlende Kanäle → kein erfundener Weg; ggf. OP.

## 4 Eingang und Prüfung — I / C / O
- E-Mail/PDF-Zweig wenn email-pdf-Token  
- E-Rechnung-Zweig wenn erechnung-Token (XML/Original vs. Ansicht; Validierung → OP)  
- Papier-Zweig nur wenn papier-Token (sonst omit / kurze N/A)

## 5 Freigabe, Buchung und Nachvollziehbarkeit — I / O
Freigabe GF, Übergabe Buchhaltung/FiBu/Kanzlei, Beleg-ID-Verknüpfung; Ausgangsnummern aus Intake-Systemen.

## 6 Aufbewahrung, Zugriff und Sicherung — I / O
Archiv/Zugriff aus Intake; Buchungsbelege i. d. R. **8 Jahre**; Backup nur wenn `backup` gesetzt, sonst OP; Wiederherstellungstest immer OP ohne Bestätigung.

## 7 Kontrollen und Änderungen — S + O
Keine erfundenen Stichproben; Kontrollprotokoll → OP. Versions-/Änderungsregeln in Präsens nur als Soll-Prozess („lösen neue Version aus“).

## 8 Anlagen und offene Punkte — O
Tabelle aus `open-points-rules.json` (`customerFacing: true`). Hinweis: OP ≠ Nachweis Ordnungsmäßigkeit.

## 9 Version und betriebliche Bestätigung — S + I
Versionstabelle + Platzhalter Sign-off GF — **nicht** auto-bestätigt.

## 10 Quellen — S (kurz)
BMF GoBD, § 147 AO, § 257 HGB, E-Rechnung-FAQ.

---

## Builder-Hooks
- Conditionals: `{{#if path}}` / `contains` — siehe QUALITY-RULES §3  
- Schema-Flags: `includeIf` in `chapter-schema.json`  
- Bundle: `python3 scripts/build-bundle.py`  
- Fixture: `sample-intake-partner-trust.json` + `FIXTURE-CHECKLIST-v3.md`
