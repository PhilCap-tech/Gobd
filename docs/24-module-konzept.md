# Konzept: Komplette Verfahrensdokumentation in 24 Modulen (Gesamtdokument je Firma)

Stand 05.10.2026 · Auftrag Philip 05.10 13:28 (Experten-Feedback) · ersetzt das 12-Bereiche-Modell
(`multi-bereich-vd-konzept.md`) für neue Dokumente. Repo: PhilCap-tech/Gobd · Prod: www.gobd-doku-erstellen.de

## 1. Maßstab

Alle steuerrelevanten Prozesse müssen beschreibbar sein: von der Entstehung eines Geschäftsvorfalls
über Verarbeitung und Buchung bis zur Aufbewahrung und Bereitstellung in der Außenprüfung,
einschließlich Vorsystemen und ausgelagerter Aufgaben. Gliederung nach den GoBD in vier Teile
(GoBD Rz. 153: allgemeine Beschreibung, Anwenderdokumentation, technische Systemdokumentation,
Betriebsdokumentation). Versionierung und Änderungshistorie nach GoBD Rz. 154.

## 2. Die 24 Module und ihre Zuordnung

| Nr. | Modul | Teil | Typ | Aktivierung | Quelle der Fragen |
| --- | --- | --- | --- | --- | --- |
| 1 | Unternehmen und Organisation | I Allgemeine Beschreibung | Kern | immer | Katalog A01, A04 + neu UO01–UO06 |
| 2 | Verkauf und Leistungserbringung | II Anwender | Regel | Standard an | Bereich Verkauf VK00–VK04 + neu LE01–LE05 |
| 3 | Einkauf und Rechnungseingang | II Anwender | Regel | Standard an | Bereich Einkauf EK00–EK10 + Katalog C01, C02, E03 |
| 4 | Ausgangsrechnungen und Korrekturen | II Anwender | Regel | Standard an | Katalog E05 + VK05–VK08 + neu AR00–AR04 |
| 5 | Elektronische Belege und E-Rechnungen | II Anwender | betriebsabh. | Check „E-Rechnungen / elektronische Belege“ | Katalog E01, E02, B04 + neu ER00–ER06 |
| 6 | Papierbelege und Digitalisierung | II Anwender | betriebsabh. | Check „Papierbelege“ | Katalog C03, D01 + neu PB00–PB06 |
| 7 | Zahlungsverkehr und offene Posten | II Anwender | Regel | Standard an; Check „Zahlungsdienstleister“ öffnet ZD | Bereich Bank BA00–BA10 + VK09 + neu ZD01–ZD04 |
| 8 | Bargeld und Kassenführung | II Anwender | betriebsabh. | Check „Bargeld/Kasse“ | Bereich Kasse KA00–KA11 |
| 9 | Buchführung und Abschlüsse | II Anwender | Kern | immer | Katalog F01, F02 + neu BU00–BU07 |
| 10 | Warenwirtschaft, Lager und Inventur | II Anwender | betriebsabh. | Check „Lager/Waren“ | Bereich Warenwirtschaft WW00–WW10 |
| 11 | Anlagevermögen | II Anwender | betriebsabh. | Check „Anlagevermögen“ | Bereich Anlagen AN00–AN10 |
| 12 | Personal und Lohnabrechnung | II Anwender | betriebsabh. | Check „Personal“ (+ „Zeiterfassung“) | Bereiche Lohn LO00–LO11, Zeiterfassung ZE00–ZE09 |
| 13 | Onlineshop, Marktplätze und Plattformen | II Anwender | betriebsabh. | Check „Online“ (+ „Retouren“) | Bereiche E-Commerce EC00–EC10, Retouren RT00–RT10 |
| 14 | Branchenspezifische Abläufe | II Anwender | betriebsabh. | Check „Branche“ + Auswahl | neu BS00–BS08 + Bereich Vorsystem SV00–SV10 |
| 15 | Archivierung und Wiederauffindbarkeit | III Technik | Kern | immer | Katalog G01 + neu AW01–AW06 |
| 16 | Aufbewahrungsfristen und Löschung | III Technik | Kern | immer | Katalog G05 + neu AF01–AF06 |
| 17 | Systeme und Datenübertragung | III Technik | Kern | immer | Katalog B01, B05 + neu SY01–SY06 |
| 18 | Zugriffsrechte und Datensicherheit | III Technik | Kern | immer | Katalog G02 + neu ZR01–ZR06 |
| 19 | Sicherung, Wiederherstellung und Notfälle | III Technik | Kern | immer | Katalog G06, H04 + neu SN01–SN06 |
| 20 | Kontrollen und Fehlerbehandlung | IV Betrieb | Kern | immer | Katalog H01 + neu KF01–KF06 |
| 21 | Ausgelagerte Aufgaben | IV Betrieb | Kern | immer | Katalog F05 + neu AU01–AU06 |
| 22 | Prüfungszugriff und Datenbereitstellung | IV Betrieb | Kern | immer | neu PZ00–PZ07 (§ 147 Abs. 6 AO, Z1–Z3) |
| 23 | System- und Prozessänderungen | IV Betrieb | Kern | immer | neu AE00–AE06 |
| 24 | Pflege der Verfahrensdokumentation | IV Betrieb | Kern | immer | Katalog I01, I02, I04, I05 + neu PF01–PF03 |

Kernmodule (1, 9, 15–24) sind immer aktiv. Regelmodule (2, 3, 4, 7) sind standardmäßig aktiv und
können nur mit Begründung als „nicht vorhanden“ markiert werden. Betriebsabhängige Module (5, 6, 8,
10–14) aktiviert der Betriebs-Check.

Teil I enthält zusätzlich Dokumentenlenkung, Zweck/Geltungsbereich und die **Vollständigkeits-
übersicht** aller 24 Module. Anhänge: A Offene Punkte, B Mitgeltende Unterlagen und bestehende
Dokumentationen, C Prozessmatrix, D Begriffe.

## 3. Modulstatus (keine stille Auslassung)

| Status | Bedeutung | Wirkung im PDF |
| --- | --- | --- |
| im Tool beschrieben | Fragen des Moduls werden beantwortet | Kapitel mit Ist-Beschreibung (nur „bestätigt“ im Präsens) |
| durch bestehende Dokumentation abgedeckt | Verweistext Pflicht, Link/Ablageort optional | Kurzkapitel mit Verweis + Eintrag in Anhang B; ohne Verweistext offener Punkt |
| noch nicht dokumentiert | Bereich existiert, Beschreibung fehlt | Kurzkapitel „noch nicht dokumentiert“ + offener Punkt (hoch) |
| nicht vorhanden | Nur betriebsabhängige/Regel-Module, Begründung Pflicht | Zeile in der Vollständigkeitsübersicht mit Begründung |

Jedes der 24 Module steht in der Vollständigkeitsübersicht (PDF + Konto). Ein Kernmodul kann nicht
„nicht vorhanden“ sein. Build-Check: jedes Modul hat Fragen, ein PDF-Kapitel und einen Status.

## 4. Ablauf im Tool (bestehender Flow bleibt)

1. **Betriebs-Check** (10 Ja/Nein/Weiß-nicht-Fragen): Bargeld/Kasse · Lager/Waren · Personal
   (+ Zeiterfassung) · Onlineshop/Marktplätze (+ Retouren) · Papierbelege · E-Rechnungen und
   elektronische Belege · Anlagevermögen · Steuerkanzlei/Buchhaltungsservice · branchenspezifische
   Abläufe (+ Art) · Zahlungsdienstleister/Kartenzahlung. Dazu optional **Branchenvorlage**
   (Dienstleister, Handel, Gastronomie, Handwerk/Bau, E-Commerce) und **Software-Vorlagen**
   (DATEV, lexoffice, sevDesk, Shopify, Kassensystem). „Weiß ich nicht“ öffnet das Modul als
   „noch nicht dokumentiert“ (offener Punkt).
2. **Stammdaten einmal erfassen**: Geschäftsführung, Buchhaltung, IT, Kanzlei, Hauptsysteme. Sie
   werden als Vorschlag in alle Module übernommen (Verantwortung, Systeme, Kanzlei); Status setzt der
   Kunde selbst.
3. **Modulübersicht** vor dem Ausfüllen: alle 24 Module mit vorgeschlagenem Status, änderbar.
4. Schritte A, B und je aktivem Modul ein Schritt (Fortschritt je Modul in der Übersicht),
   danach G, H, I und Prüfung. Zwischenstand wird lokal im Browser gespeichert
   (Speichern & später fortsetzen auf demselben Gerät).
5. Nachträglich: im Konto „Modul ergänzen“ öffnet das Intake als neue Fassung mit dem Modul.

Vorschläge aus Vorlagen setzen nur Werte, nie den Status: Erst „So läuft es heute“ macht eine Angabe
zur Ist-Beschreibung.

## 5. Gesamtdokument und Versionierung

- **Ein Gesamtdokument je Firma** mit allen aktiven Modulen, gemeinsame Versionierung (Version,
  Gültig ab, Änderungshistorie, frühere PDFs im Konto).
- Gliederung: Deckblatt · Dokumentenlenkung · Vollständigkeitsübersicht · Teil I (Modul 1) ·
  Teil II (Module 2–14) · Teil III (15–19) · Teil IV (20–24) · Anhänge A–D. Kapitelnummer =
  Modulnummer (stabile Querverweise; nicht vorhandene Module erscheinen nur in der Übersicht).
- Inhalte aus dem bisherigen Belegfluss-Dokument (Kapitel 4–12) werden als Abschnitte in die
  Module 3, 4, 5, 6, 9, 15–20, 23, 24 übernommen; Bereichsinhalte (Prozess, Kontrollen, Fristen,
  Begriffe) in die Module 2, 7, 8, 10–14.
- Optionaler **Modul-Export**: ein PDF nur mit Dokumentenlenkung, Übersicht und einem Modul.

## 6. Migration und Altbestand

- Bisherige Bereichs-VDs (Belegfluss, Kasse, …) bleiben im Konto lesbar und downloadbar
  („bisherige Bereichsdokumente“), Bearbeiten erzeugt weiter Versionen im alten Format.
- „Gesamtdokument anlegen“ übernimmt alle Antworten der Bereichs-VDs der Firma (Frage-IDs sind
  disjunkt) und setzt die passenden Module auf „im Tool beschrieben“. Kein neuer Checkout.
- Neue Intakes starten im Gesamtdokument.

## 7. Muster

- /muster: drei vollständige Gesamtdokumente je Branchenvorlage (Dienstleister, Handel mit Kasse und
  Lager, E-Commerce) als PDF + ausgefüllter Fragebogen, dazu je Modul ein Muster-Fragebogen.
- Bisherige URLs /muster/<bereich>(/pdf|/fragebogen) bleiben erreichbar (Weiterleitung auf das
  passende Modul bzw. Muster), keine 404.

## 8. Aufbewahrung (unverändert korrekt)

10 Jahre Bücher, Aufzeichnungen, Inventare, Organisationsunterlagen inkl. Verfahrensdokumentation
(§ 147 Abs. 1 Nr. 1, Abs. 3 AO) · 8 Jahre Buchungsbelege (§ 147 Abs. 1 Nr. 4, Abs. 3 AO) · 6 Jahre
Handels- und Geschäftsbriefe, sonstige Unterlagen (§ 147 Abs. 1 Nr. 2, 3, 5 AO) · Fristbeginn mit
Schluss des Kalenderjahres (§ 147 Abs. 4 AO) · Ablaufhemmung vor Löschung prüfen (§ 147 Abs. 3 AO).

## 9. Preis und Recht

Unverändert 149 € Einrichtung + 49 €/Monat je Firma; „24 Module, alle inklusive“. Stripe, Preise,
Ads unverändert. AGB/Datenschutz/Disclaimer: Umfangsformulierung „vom Kunden gewählte Module/Bereiche“
(Scope-Angleichung von Philip freigegeben).

## 10. Auslieferung

- PR 1: Modulkatalog, Betriebs-Check, Status, Intake-Flow (über `?modus=gesamt`, noch nicht Standard).
- PR 2: Gesamt-PDF in vier Teilen, gemeinsame Versionierung, Modul-Export; Gesamtdokument wird Standard.
- PR 3: Konto (Vollständigkeit, Modul ergänzen, Altbestand), Muster, Texte, Sitemap, Rechtstexte.

## 11. Offen

- Speichern & fortsetzen geräteübergreifend (Server-Entwurf) – derzeit lokal im Browser.
- Hochladen bestehender Dokumentationen: derzeit Verweis + Link/Ablageort, kein Datei-Upload.
- Fachliche Prüfung der neuen Fragen (Module 14, 21–23) durch Kanzlei-Partner.
