# Frage-ID → Kapitel / OP / Ausgabe (Fragenkatalog v1.0)

**Quelle:** `reference/philip-fragenkatalog-vorschlag-2026-09-28.docx`  
**Stand:** 2026-09-28 | Delivery + Builder-Contract  
**Regelsatz:** Antwortstatus `bestätigt` → Präsens-Ist-Satz; `geplant` → kein Ist-Prozess; `unbekannt` → OP; `nicht zutreffend` → Grund speichern, Kapitel/Zweig ausblenden.  
**Fachtexte** (Fristen, E-Rechnung-Rahmen): versionierte Bibliothek mit Prüfdatum — nicht aus Intake erfinden (`CANONICAL-SNIPPETS-aufbewahrung-erechnung.md`, `QUALITY-RULES-v3.md`).

Kapitel-IDs (Outline v3 / Philip-Muster):
| ID | Kapitel |
|---|---|
| K0 | Cover |
| K1 | Merkmal-Tabelle |
| K2 | Zweck und Grenzen |
| K3 | Systeme und Belegarten |
| K4 | Eingang und Prüfung |
| K5 | Freigabe, Buchung und Nachvollziehbarkeit |
| K6 | Aufbewahrung, Zugriff und Sicherung |
| K7 | Kontrollen und Änderungen |
| K8 | Anlagen und offene Punkte |
| K9 | Version und betriebliche Bestätigung |
| K10 | Quellen (Fachbibliothek) |

---

## A — Unternehmen und Geltungsbereich

| Frage | Wenn | Ausgabe-Kapitel | OP wenn nicht bestätigt | MVP |
|---|---|---|---|---|
| A01 Rechtsträger, Standort, GF | immer | K0, K1 (Betrieb/Verantwortung), K2 | OP-A01 Stammdaten/GF | ja |
| A02 Belegarten / Gesellschaften im Scope | immer | K1 Geltungsbereich, K2 Abgrenzung | OP-A02 Scope unklar | ja |
| A03 Kasse/Shop/Lager/Lohn/Plattformen | immer | K2 Zweige; Hinweis auf ergänzende Doku | OP-A03 Vorsysteme ungeklärt | ja (Ja/Nein/unbekannt) |
| A04 Seit wann Ablauf so ausgeführt | immer | K1 Stand, K9 Gültig-ab — **kein Rückdatieren** | OP-A04 Wirksamkeitsdatum | ja |

## B — Systeme und Datenfluss

| Frage | Wenn | Ausgabe | OP | MVP |
|---|---|---|---|---|
| B01 Systeme Liste | immer | K1 Systeme, K3 | OP-B01 keine Systeme | ja (map fibu/weitereSysteme) |
| B02 Version/Betreiber/Speicher/Schnittstelle je System | je B01 | Anlage System; nicht im Fließtext erfinden | OP-B02 Details je System | später (MVP: Kurzname reicht) |
| B03 Datenfluss zwischen Systemen | ≥2 Systeme | K3 / K5 Übergang | OP-B03 Übertragung/Kontrolle | später |
| B04 Original-Dateien/Metadaten | je Belegweg | K3 Originalerhalt, K6 | OP-B04 Originalformat | ja (grob) |
| B05 Drittanbieter / Unterlagen | externe Systeme | K8 Anlagen | OP-B05 Anbieterunterlagen | ja wenn Hosting/extern |

## C — Eingang und Erfassung

| Frage | Wenn | Ausgabe | OP | MVP |
|---|---|---|---|---|
| C01 Eingangswege | immer | K3/K4 je Weg; **kein** Papierkapitel ohne Papier | — | ja (map eingangsbelege) |
| C02 Postfach/Portal, wer, Turnus | digitaler Eingang | K4 Eingangskontrolle | OP-C02 Sichtung | ja |
| C03 Papierannahme | Papier gewählt | K4 Papierzweig | OP-C03 | nur wenn Papier |
| C04 Duplikate/unlesbar/verdächtig | immer | K4 Ausnahme | OP-C04 | später (MVP: Kurzhinweis oder OP) |
| C05 Portal/Schnittstellen-Vollständigkeit | Portal/Schnittstelle | K4 | OP-C05 | später |

## D — Papier und Scannen

| Frage | Wenn | Ausgabe | OP | MVP |
|---|---|---|---|---|
| D01 Scan Zweck (nein / Kopie / ersetzend) | Papier | D-Zweig; ersetzend = eigener detaillierter Zweig | — | nur wenn Papier |
| D02 Geräte/Formate/QC | Scannen | Scanbeschreibung | OP-D02 | später |
| D03 Vernichtung vs zusätzlich | Scannen | K6 Vernichtung/Aufbewahrung | OP-D03 Freigabe | nur wenn Papier+Scan |
| D04 Papierlager Ort/Ordnung/Zugriff | Papier | K6 Papierablage | OP-D04 | nur wenn Papier |
| D05 trotz Scan zwingend Original | ersetzend | Ausnahme + OP | OP-D05 | später |

**Prüfregel:** `kein Papier` + `ersetzendes Scannen` → Widerspruchs-Hinweis vor Export.

## E — Rechnungen / E-Rechnung

| Frage | Wenn | Ausgabe | OP | MVP |
|---|---|---|---|---|
| E01 Formate (PDF, XRechnung, ZUGFeRD, Papier, EDI) | immer | K3 Formatwege; **PDF≠strukturierte E-Rechnung** | — | ja |
| E02 strukturierter Teil Empfang/Prüfung/Speicher | E-Rechnung | K4 + Canonical E-Rechnung **S**; Validierung nur bei bestätigt | OP-E02 Validierung | ja |
| E03 sachliche Prüfung vor Freigabe | immer | K4/K5 | OP-E03 | ja (Rollen gf/buchhaltung) |
| E04 Korrektur/Storno/Dublette/XML-Abweichung | E-Rechnung oder digital | K4/K5 Ausnahme | OP-E04 | später |
| E05 Ausgangsrechnung System/Nummern | Ausgang | K3/K5 | OP-E05 | ja (map ausgangsrechnungen) |
| E06 Versand-Original + Übermittlung | Ausgang | K5 | OP-E06 | später |

## F — Freigabe und Buchung

| Frage | Wenn | Ausgabe | OP | MVP |
|---|---|---|---|---|
| F01 wer prüft / gibt frei / bucht | immer | K5 Rollen | OP-F01 | ja |
| F02 Beleg-ID Verknüpfung | immer | K5 Nachvollziehbarkeit | OP-F02 | ja (oder OP) |
| F03 ohne Freigabe / fehlende Kontierung | immer | K5 Sperre/Eskalation | OP-F03 | später |
| F04 Turnus Übergabe / Vollständigkeit | immer | K5 | OP-F04 | später |
| F05 Kanzlei Leistungsumfang | externe Kanzlei | K5 — **keine unterstellte Beraterrolle** | OP-F05 | ja (steuerberater nur wenn bestätigt) |

## G — Archiv und Aufbewahrung

| Frage | Wenn | Ausgabe | OP | MVP |
|---|---|---|---|---|
| G01 Ablageort / Suchmerkmale | je Belegart | K6 | OP-G01 | ja (archiv) |
| G02 Rechtematrix | immer | K6 Zugriff | OP-G02 Berechtigungsliste | ja (zugriff) |
| G03 frühere Zustände / Löschprotokoll | digitales Archiv | K6 | OP-G03 | später |
| G04 Export / Prüfung | immer | K6 Datenzugriff | OP-G04 | später |
| G05 Fristklassifikation / Löschfreigabe | immer | K6 + Canonical **Aufbewahrung S** (8 J. Buchungsbelege) | OP-G05 | ja (S immer; P nur bestätigt) |
| G06 Backup + getestete Rücksicherung | immer | K6; ohne Nachweis = OP | OP-G06 | ja |

## H — Kontrollen und Störungen

| Frage | Wenn | Ausgabe | OP | MVP |
|---|---|---|---|---|
| H01 Kontrollen wer/Turnus | immer | K7 **nur nach Bestätigung** | OP-H01 | ja → OP wenn unbekannt |
| H02 Protokoll Ort | H01 bestätigt | K7/K8 | OP-H02 | später |
| H03 Ausfall Notfallweg | immer | K7 | OP-H03 | später |
| H04 letzter Wiederherstellungs-/Export-Test | immer | K7 Nachweis oder OP | OP-H04 | ja → OP |

## I — Pflege und Abschluss

| Frage | Wenn | Ausgabe | OP | MVP |
|---|---|---|---|---|
| I01 wer pflegt / Versionsauslöser | immer | K7/K9 | OP-I01 | ja (S-Rahmen) |
| I02 Anlagenliste | immer | K8 | OP-I02 | ja |
| I03 unbekannt/geplant/Widerspruch | immer | K8 OP-Tabelle (auto) | — | ja |
| I04 betriebliche Bestätigung Name/Datum | vor Veröffentlichung | K9 — **Generierung ≠ Bestätigung** | OP-I04 | ja (Platzhalter) |
| I05 Gültigkeitszeitraum / Archiv alter Fassungen | immer | K9 Historie | OP-I05 | ja |

---

## Prüfregeln vor PDF-Export (verbindlich)

1. Papierprozess nur bei bestätigtem Papiereingang (C01/C03); Scan nur bei D01; ersetzend nur mit D-Zweig.
2. E-Mail-PDF und strukturierte E-Rechnung getrennt (E01/E02); E-Mail löst keinen Scantext aus.
3. Kanzlei/Kontrollen nur aus bestätigten F05/H01 — keine Auto-Zuschreibung.
4. Jeder Präsens-Satz intern ≥1 bestätigte Frage-ID; sonst OP oder neutraler Hinweis.
5. Stripe/stub/Testrefs nie als fachliche OP und nie im Kundendoc.
6. Fachtextbibliothek mit Prüfdatum (Aufbewahrung 8 J., E-Rechnung strukturiert vs PDF).

---

## MVP vs Vollkatalog — Vorschlag Delivery

### MVP (jetzt, Soft-Invite Hold bis Philip Muster freigibt)
- Fragen mit **MVP = ja** oben; bestehende Intake-Felder mappar:
  - A01–A04 ← company, branchen, rechtsform, mitarbeitende, gf (+ Stand)
  - B01, B04, B05 ← fibu, weitereSysteme, hosting, archiv
  - C01, C02 ← eingangsbelege (+ Turnus-Default nur als H/OP)
  - E01, E02, E03, E05 ← Formate aus eingangsbelege/ausgangsrechnungen; Canonical E-Rechnung
  - F01, F02, F05 ← gf, buchhaltung, steuerberater
  - G01, G02, G05(S), G06 ← archiv, zugriff, backup + Canonical Aufbewahrung
  - H01, H04 ← i.d.R. OP
  - I01–I05 ← Version/OP/Sign-off-Platzhalter
- Bedingte Zweige D* nur wenn Papier im Intake
- Generator nutzt Antwortstatus wenn vorhanden; sonst heutiges Intake = „bestätigt wenn befüllt, sonst unbekannt“

### Später (Voll)
- B02–B03, C04–C05, D02/D05, E04/E06, F03–F04, G03–G04, H02–H03
- Wiederholbare System-/Kontrolllisten, Nachweis-Uploads, Widerspruchs-Engine UI
- Eigenes Fragenkatalog-UI statt nur Mehrfachauswahl-Intake

### Explizit Out of Scope Delivery
- Soft-Invite / Kanzlei-Empfehlung bis Philip neues Muster-PDF freigibt
- Rechtsberatung; keine DATEV-Zugänge
