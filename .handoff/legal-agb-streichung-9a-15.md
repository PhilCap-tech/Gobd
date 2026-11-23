# Streichung § 9a und § 15 (Digistore24 / Monatsabonnement): finale Streich-Fassung als Alt/Neu

> **Entwurf zur Prüfung. Wortlaut nicht freigegeben, keine Rechtsberatung.** [Vorschlag, Philip-Freigabe ausstehend]
> **Freigabe der Entscheidung:** laut Philip „Digistore-Produkt 751404 (198 € + USt) deaktivieren; AGB §9a/§15 (Digistore/Altabo) streichen (Wortlaut-Freigabe vor Live)“ (approvals.md Z. 584, 23.11.2026 21:39, Widget). Philip gibt den Wortlaut also vor dem Live-Gang noch frei.
> Die Zeile nennt nur die AGB. Die Änderungen in DSE und Cookie-Seite folgen daraus, brauchen aber dieselbe Wortlaut-Freigabe.
> **Grundlage:** Repo PhilCap-tech/Gobd, `main` b6fff87, nur gelesen. Zeilennummern (Z.) beziehen sich auf diesen Stand.
> **Bezug:** Preisabgleich und Varianten in `/workspace/gobd-ops/legal-agb-preise-entwurf.md` (Teil B, Var. 1). Diese Datei ersetzt dort nichts. Sie ist die ausformulierte Variante 1.
> **Nicht angefasst:** § 12d, alle `<!-- if:schnellversion -->`-Blöcke, § 12c Abs. 4.
> **Voraussetzung:** Produkt 751404 ist in Digistore24 deaktiviert. Laut CoS läuft das gerade. Der Builder oder Ops bestätigt es vor dem Merge (Teil E, Punkt 1).

## Nummerierung: gewählte Variante

- **AGB: § 9a und § 15 werden ganz gestrichen, ohne Platzhalter und ohne Umnummerierung.**
  - § 9a ist ein eingeschobener Buchstaben-Paragraf zwischen § 9 und § 10. § 15 ist der letzte Paragraf.
  - Fallen beide weg, ändert sich keine andere Paragrafennummer.
  - Ein Platzhalter „(weggefallen)“ würde Neukunden nur auf ein Modell hinweisen, das es nicht mehr gibt.
- **AGB § 12c Abs. 3 wird zu „(3) (weggefallen)“.**
  - Abs. 4 (Schnellversion) muss seine Nummer behalten. § 12d Abs. 6 und § 12c Abs. 4 verweisen aufeinander.
  - Ein ersatzloses Streichen würde eine Lücke (2) → (4) erzeugen. Ein Umnummerieren würde den Schnellversion-Block berühren.
- **AGB § 1 Abs. 4 und § 12a Abs. 6** sind jeweils der letzte Absatz und werden ersatzlos gestrichen.
- **DSE Abschnitt 12 wird zu „## 12. (weggefallen)“** (Fassung A, siehe C5).
  - Die Abschnitte 13 bis 25 behalten ihre Nummern.
  - Damit bleiben alle Querverweise wie „Abschnitt 17“, „Abschnitt 20“, „Abschnitt 21“ und die Verweise von der Cookie-Seite gültig.

## C5-Abhängigkeit

C5 fragt: **Lädt das Digistore24-Promocode-Skript noch irgendwo?**
- Laut Code lädt es nur auf `/partner-angebot`. Die Seite leitet live mit 307 auf die Startseite um (`next.config.ts:189-193`).
- **Fassung A:** Das Skript lädt nirgends mehr. Das ist die erwartete Fassung.
- **Fassung B:** Das Skript lädt noch.
- Alle Stellen, die davon abhängen, sind mit **[klären: Builder – C5]** markiert und haben beide Fassungen.

---

## Teil A: AGB `content/legal/agb-v3.md` (8 Stellen)

| Nr. | Fundstelle | Alt (exakt) | Neu (exakt) | Status |
|---|---|---|---|---|
| S-A1 | § 1 Abs. 4, Z. 28 | „(4) Für Bestellungen über die Partnerseite https://www.gobd-doku-erstellen.de/partner-angebot, die über Digistore24 abgewickelt werden, gelten ergänzend und vorrangig die Regelungen in § 9a.“ | *(Absatz ersatzlos gestrichen; § 1 endet mit Abs. 3)* | inhaltlich (Philip, Z. 584) |
| S-A2 | § 9 Abs. 4, Z. 108 | „(4) Für weitere Firmen gilt dieser § 9 je Firma.`<!-- if:schnellversion -->` Für die Schnellversion gilt dieser § 9 mit der Maßgabe des § 12d Abs. 7.`<!-- endif -->` Für Monatsabonnements nach § 15 gilt § 15 Abs. 4; für Bestellungen über Digistore24 gilt § 9a Abs. 9.“ | „(4) Für weitere Firmen gilt dieser § 9 je Firma.`<!-- if:schnellversion -->` Für die Schnellversion gilt dieser § 9 mit der Maßgabe des § 12d Abs. 7.`<!-- endif -->`“ *(nur der letzte Satz entfällt; der Schnellversion-Block bleibt zeichengleich)* | inhaltlich (Philip, Z. 584) |
| S-A3 | § 9a, Z. 112-138 (Überschrift „## § 9a Bestellungen über Digistore24 (Partner-Angebot)“ und Abs. 1-11 einschließlich „So geben Sie Ihre Bestellung zurück“ und „Nach der Rückgabe“) | ganzer Paragraf, u. a. Abs. 5 „**198 € zum Start (Einrichtung 149 € + 1. Monat 49 €), danach 49 € pro Monat** …“ | *(ganzer Paragraf ersatzlos gestrichen, ohne Platzhalter; auf § 9 folgt § 10)* | inhaltlich (Philip, Z. 584) |
| S-A4 | § 12a Abs. 6, Z. 186 | „(6) Für Monatsabonnements nach § 15 gilt statt der Absätze 1 bis 5 die Regelung in § 15 Abs. 5.“ | *(Absatz ersatzlos gestrichen; § 12a endet mit Abs. 5)* | inhaltlich (Philip, Z. 584) |
| S-A5 | § 12b Abs. 1 Satz 2, Z. 190 | „Ihr Nutzungsrecht nach § 6 Abs. 1 an heruntergeladenen PDFs bleibt vom Ende des Zugangs, vom Ende des Jahrespakets und von der Löschung nach § 12 Abs. 5 bzw. § 12a Abs. 5 unberührt (Ausnahme: Rückgabe nach § 9a Abs. 9).“ | „Ihr Nutzungsrecht nach § 6 Abs. 1 an heruntergeladenen PDFs bleibt vom Ende des Zugangs, vom Ende des Jahrespakets und von der Löschung nach § 12 Abs. 5 bzw. § 12a Abs. 5 unberührt.“ | inhaltlich (Philip, Z. 584) |
| S-A6 | § 12c Abs. 3, Z. 200 | „(3) Für Monatsabonnements nach § 15 und Bestellungen über Digistore24 bleibt es bei **bis zu fünf Firmen** je Abonnement (§ 15 Abs. 1, § 9a Abs. 10).“ | „(3) (weggefallen)“ *(Abs. 4 und der Marker in Z. 201 bleiben unverändert)* | inhaltlich (Philip, Z. 584) |
| S-A7 | § 15, Z. 249-259 (Überschrift „## § 15 Monatsabonnement (bisheriges Modell)“ und Abs. 1-5) | ganzer Paragraf, u. a. Abs. 2 „Einrichtung **149 €** einmalig und Nutzungsentgelt **49 € pro Monat** …“ und **Abs. 4 „Zufriedenheitsgarantie. … Vor dem ersten PDF erstatten wir 198 € zzgl. USt; nach dem ersten PDF erstatten wir das bereits gezahlte monatliche Nutzungsentgelt (49 € zzgl. USt), die Einrichtungsvergütung (149 € zzgl. USt) ist dann nicht erstattungsfähig. …“** | *(ganzer Paragraf ersatzlos gestrichen, ohne Platzhalter; auf § 14 folgt die Stand-Zeile)*. Der alte Garantie-Rest aus Abs. 4 entfällt damit. Es gilt nur noch § 9 Abs. 2 (Erstattung, wenn die Erstellung fehlschlägt; laut Philip, approvals.md Z. 460). | inhaltlich (Philip, Z. 584) |
| S-A8 | Stand, Z. 261 | „**Stand:** Oktober 2026“ | „**Stand:** [Monat der Veröffentlichung]“, setzt der Builder beim Merge | redaktionell |

**Gegenprobe:** Nach S-A1 bis S-A7 enthält `agb-v3.md` keinen Verweis mehr auf „§ 9a“, „§ 15“, „Digistore24“, „Partnerseite“ oder „Monatsabonnement“.
- Geprüft per `rg` auf alle Fundstellen: Z. 28, 108, 112-138, 186, 190, 200, 249-259.
- Weitere Treffer gab es nicht. „Vertragspartner“ in der Überschrift von § 1 meint die IKAT GmbH und bleibt.

---

## Teil B: Datenschutzerklärung `content/legal/datenschutz-v3.md` (13 Stellen)

| Nr. | Fundstelle | Alt (exakt) | Neu (exakt) | Status |
|---|---|---|---|---|
| S-D1 | Abschnitt 3 (Überblick), Z. 23, Ende der Klammer | „… je Option eine Firma, weitere Firmen gesondert; für Bestellungen über Digistore24 und bestehende Verträge das bisherige Monatsabonnement) sowie zur Erfüllung gesetzlicher Pflichten erforderlich ist.“ | „… je Option eine Firma, weitere Firmen gesondert) sowie zur Erfüllung gesetzlicher Pflichten erforderlich ist.“ *(der Schnellversion-Block davor bleibt zeichengleich)* | inhaltlich (Philip) |
| S-D2 | Abschnitt 4 (Auftragsverarbeiter, **Dienstleister-Abschnitt**), Z. 34, letzter Satz | „Digistore24 ist nicht unser Auftragsverarbeiter, sondern bei Bestellungen über die Partnerseite als Wiederverkäufer eigener Verantwortlicher (Abschnitt 12).“ | *(Satz gestrichen; der Absatz endet mit „Die Einzelheiten stehen in Abschnitt 10.“)* | inhaltlich (Philip) |
| S-D3 | Abschnitt 12, Überschrift, Z. 111 **[klären: Builder – C5]** | „## 12. Bestellungen über Digistore24 (Partner-Angebot)“ | **Fassung A:** „## 12. (weggefallen)“ · **Fassung B:** „## 12. Affiliate-Zuordnung auf der Partnerseite (Digistore24-Promocode)“ | inhaltlich (Philip) |
| S-D4 | Abschnitt 12, Bestellung über Digistore24, Z. 113-121 (vier Absätze: Bestellformular/Wiederverkäufer; eigener Verantwortlicher; „Von Digistore24 erhalten wir …“; Rechtsgrundlage Art. 6 Abs. 1 lit. b und c DSGVO mit § 147 AO, § 257 HGB) und der Satz „**Käufe über Digistore24 geben wir nicht an Werbedienste weiter, insbesondere nicht an Google Ads oder Meta.**“ | wie zitiert | *(alle gestrichen, in beiden Fassungen)* | inhaltlich (Philip) |
| S-D5 | Abschnitt 12, **Drittland und Speicherdauer**, Z. 123 | „Nach Angaben von Digistore24 können Daten auch außerhalb der EU bzw. des EWR verarbeitet werden, dann nur auf Grundlage geeigneter Garantien, von Standardvertragsklauseln oder eines Angemessenheitsbeschlusses (Art. 45, 46 DSGVO). Für die Daten, die wir von Digistore24 erhalten und bei uns speichern, gelten die Abschnitte 8 und 20 sowie die Speicherfristen in den Abschnitten 17 und 21.“ | *(gestrichen, in beiden Fassungen)*. Für etwa noch vorhandene Abrechnungsdaten siehe S-D10. | inhaltlich (Philip) |
| S-D6 | Abschnitt 12, Promocode, Z. 125-135 (Zwischenüberschrift „**Affiliate-Zuordnung auf der Partnerseite (Digistore24-Promocode)**“, Skript, `ds24c.v1`/`ds24p.v1`/`ds24s.v1`, Übermittlung an www.checkout-ds24.com einschließlich IP-Adresse, Speicherdauer 7 Tage / bis zur Löschung / Sitzung, Rechtsgrundlage Einwilligung) **[klären: Builder – C5]** | wie zitiert | **Fassung A:** *(alles gestrichen; Abschnitt 12 besteht nur aus der Überschrift „## 12. (weggefallen)“)* · **Fassung B:** bleibt wörtlich; nur die Zwischenüberschrift Z. 125 entfällt, weil sie in S-D3 zur Abschnittsüberschrift wird | inhaltlich (Philip) |
| S-D7 | Abschnitt 13 (Google Ads/GA4), Z. 141, Satz | „Käufe über Digistore24 melden wir nicht an Google.“ | *(Satz gestrichen)* | inhaltlich (Philip) |
| S-D8 | Abschnitt 17 (Speicherdauer Dokumentationsdaten), Z. 185 | „- **Monatsabonnement (Bestellungen über Digistore24 und bestehende Verträge):** Nach Vertragsende können Sie bereits erzeugte PDFs noch 30 Tage herunterladen; danach löschen wir sie. Nach einer Rückgabe über Digistore24 sperren wir den Zugang sofort (entspricht AGB § 9a Abs. 9).“ | *(Aufzählungspunkt gestrichen)* | inhaltlich (Philip) |
| S-D9 | Abschnitt 20 (Weitergabe), Z. 207 | „Eine Weitergabe erfolgt nur, soweit erforderlich (Hosting, Zahlungsdienstleister, bei Bestellungen über die Partnerseite unser Vertriebspartner Digistore24 als eigener Verantwortlicher (Abschnitt 12), gesetzliche Verpflichtung) oder mit Einwilligung.“ | „Eine Weitergabe erfolgt nur, soweit erforderlich (Hosting, Zahlungsdienstleister, gesetzliche Verpflichtung) oder mit Einwilligung.“ | inhaltlich (Philip) |
| S-D10 | Abschnitt 21 (**Speicherdauer**), Z. 211 | „… Unsere eigenen Rechnungs- und Buchhaltungsunterlagen (z. B. Rechnungen und zahlungsrelevante Nachweise) unterliegen eigenen gesetzlichen Aufbewahrungsfristen …“ | **bleibt**. [Einschätzung, keine Rechtsberatung] Der Satz deckt etwaige Digistore24-Abrechnungen als eigene Buchhaltungsunterlagen ab. Nur falls bei uns noch **Bestelldaten aus Digistore24-Käufen** (IPN-Zeilen, Kundenkonten) liegen [klären: Builder], am Ende von Z. 211 ergänzen: „Daten aus früheren Bestellungen über Digistore24 bewahren wir nur auf, soweit gesetzliche Aufbewahrungspflichten bestehen (Art. 6 Abs. 1 lit. c DSGVO, § 147 AO, § 257 HGB), und löschen sie danach.“ | bleibt (Ergänzung nur bei Befund) |
| S-D11 | Abschnitt 23 (Pflicht zur Bereitstellung), Z. 221, Satz 3 | „Bei Bestellungen über Digistore24 erhebt Digistore24 die für Kauf und Zahlung erforderlichen Daten.“ | *(Satz gestrichen)* | inhaltlich (Philip) |
| S-D12 | Abschnitt 24 (Automatisierte Entscheidungen), Z. 225, Satz 3 | „Bei Bestellungen über Digistore24 kann Digistore24 eigene automatisierte Prüfungen vornehmen; siehe die Datenschutzerklärung von Digistore24.“ | *(Satz gestrichen)* | inhaltlich (Philip) |
| S-D13 | Stand, Z. 231 | „**Stand:** November 2026“ | „**Stand:** [Monat der Veröffentlichung]“, setzt der Builder beim Merge | redaktionell |

**Gegenprobe Fassung A:** Danach kein Treffer mehr für „Digistore“, „ds24“, „Partnerseite“, „partner-angebot“ oder „Monatsabonnement“ in `datenschutz-v3.md`.
- „Partneranfragen“ in Abschnitt 10 (Z. 92) und Abschnitt 18 bleiben. Sie betreffen den Steuerberater-Bereich, nicht Digistore24.

---

## Teil C: Cookie-Seite `content/legal/cookies-v3.md` (5 Stellen)

| Nr. | Fundstelle | Alt (exakt) | Neu (exakt) | Status |
|---|---|---|---|---|
| S-K1 | Einleitung, Z. 7 **[klären: Builder – C5]** | „**Marketing-Dienste** (Google Ads / GA4, Meta Pixel und auf der Partnerseite der Digistore24-Promocode)`<!-- if:schnellversion -->` sowie …“ | **Fassung A:** „**Marketing-Dienste** (Google Ads / GA4 und Meta Pixel)`<!-- if:schnellversion -->` sowie …“ *(alles ab dem Marker bleibt zeichengleich)* · **Fassung B:** unverändert | inhaltlich (Philip) |
| S-K2 | Z. 23 **[klären: Builder – C5]** | „Auf der Partnerseite https://www.gobd-doku-erstellen.de/partner-angebot laden wir nach „Marketing erlauben“ zusätzlich das Promocode-Skript von Digistore24. … Einzelheiten stehen in der Datenschutzerklärung, Abschnitt „Bestellungen über Digistore24“.“ | **Fassung A:** *(Absatz gestrichen)* · **Fassung B:** Absatz bleibt, nur der letzte Satz lautet: „Einzelheiten stehen in der Datenschutzerklärung, Abschnitt 12.“ *(weil die DSE-Überschrift sich nach S-D3 ändert)* | inhaltlich (Philip) |
| S-K3 | Tabelle, Z. 63-65 **[klären: Builder – C5]** | Zeilen „`ds24c.v1` (Cookie) \| Digistore24 GmbH \| …“, „`ds24p.v1` (Local Storage) \| …“, „`ds24s.v1` (Session Storage) \| …“ | **Fassung A:** *(drei Zeilen gestrichen)* · **Fassung B:** unverändert | inhaltlich (Philip) |
| S-K4 | Widerruf, Z. 74 **[klären: Builder – C5]** | „Bereits gesetzte Marketing-Cookies (`_ga`, `_gcl_au`, `_fbp`, `ds24c.v1` und ähnliche) entfernt der Widerruf nicht automatisch.“ | **Fassung A:** „Bereits gesetzte Marketing-Cookies (`_ga`, `_gcl_au`, `_fbp` und ähnliche) entfernt der Widerruf nicht automatisch.“ · **Fassung B:** unverändert | inhaltlich (Philip) |
| S-K5 | Stand, Z. 82 | „**Stand:** November 2026“ | „**Stand:** [Monat der Veröffentlichung]“, setzt der Builder beim Merge (nur bei Fassung A, sonst unverändert) | redaktionell |

---

## Teil D: Impressum und Produkt-Disclaimer (je 1 Stelle)

Beide Dateien enthalten **keinen** Digistore24-, § 9a- oder § 15-Bezug (per `rg` geprüft). Zu ändern ist nur die veraltete interne Kopfnotiz. Sie wird beim Rendern entfernt (`lib/legal-content.ts:1-2`) und ist live nicht sichtbar. Die Stand-Zeilen bleiben, weil sich am angezeigten Text nichts ändert.

| Nr. | Fundstelle | Alt (exakt) | Neu (exakt) | Status |
|---|---|---|---|---|
| S-I1 | `impressum.md` Z. 1 | „> Owner-Defaults: reines B2B · Kontakt `info@gobd-doku-erstellen.de` · kein Datenschutzbeauftragter · Garantie: voll nur vor erstem PDF, danach nur Monatsbeitrag (Setup 149 € nicht).“ | „> Owner-Defaults: reines B2B · Preise netto zzgl. USt · Kontakt `info@gobd-doku-erstellen.de` · kein Datenschutzbeauftragter · Erstattung nur, wenn die Erstellung fehlschlägt (AGB § 9 Abs. 2).“ | redaktionell |
| S-P1 | `produkt-disclaimer.md` Z. 1 | wie S-I1 | wie S-I1 | redaktionell |

---

## Teil E: Offene Punkte

1. **[klären: Ops] Deaktivierung 751404 bestätigen.** Am 23.11. um 21:34 Europe/Berlin zeigte https://www.digistore24.com/product/751404 noch ein Bestellformular mit 198 € (Preisentwurf, Teil A2). Merge erst, wenn das Formular „nicht (mehr) erwerbbar“ meldet wie bei 751419.
2. **[klären: Builder – C5]** Lädt das Promocode-Skript (`components/digistore-promocode.tsx`, `lib/digistore-promocode.ts`) noch irgendwo? Davon hängen S-D3, S-D6 und S-K1 bis S-K4 ab.
3. **[klären: Builder] Gibt es noch Digistore24-Bestelldaten** (IPN, `app/api/digistore24/ipn/route.ts`) oder Website-Monatsabos aus der Zeit bis 29.10.2026? Nur dann die Ergänzung in S-D10. Laut Philip „Altverträge/DS24 egal, DS24 nicht live“ (approvals.md Z. 562).
4. **[klären: Builder] Seiten außerhalb `content/legal/`.** Das sind keine Rechtstexte, aber sie verweisen auf die gestrichenen Paragrafen:
   - `/partner-danke` ist live erreichbar (HTTP 200). In `app/partner-danke/page.tsx:39-41` steht: „Preis, Laufzeit und Kündigung Ihrer Bestellung richten sich nach Ihrer Bestellung bei Digistore24 und unseren AGB (§ 9a, § 15).“ Nach der Streichung zeigt das ins Leere. Vorschlag: die Seite wie `/partner-angebot` auf die Startseite umleiten oder entfernen. Copy schreibe ich hier nicht.
   - Prüfskripte erwarten die gestrichenen Abschnitte und müssen angepasst werden:
     - `scripts/check-schnellversion.ts:1289-1290` hat Hash-Prüfungen auf § 9a und § 15.
     - `scripts/check-partner-angebot.ts:238-272` prüft, ob § 9a vorhanden ist.
   - `scripts/fixtures/agb-v3-main-2f44180.md` ist ein Prüf-Fixture und kein ausgelieferter Text.
5. **Rollback-Dateien** `agb.md`, `agb-v2.md`, `datenschutz.md`, `cookies.md` werden nur bei `PRICING_MODEL=legacy` geladen. [Vorschlag] unverändert lassen.
6. **Archiv:** [Vorschlag] Die bisherige AGB-Fassung (main b6fff87, `agb-v3.md`) intern als PDF ablegen, damit der frühere Wortlaut belegbar bleibt. [klären: Ops]

---

## Streichliste für den Builder

| # | Datei | Stelle | Aktion |
|---|---|---|---|
| 1 | `content/legal/agb-v3.md` | § 1 Abs. 4 (Z. 28) | Absatz löschen |
| 2 | `content/legal/agb-v3.md` | § 9 Abs. 4, letzter Satz (Z. 108) | „ Für Monatsabonnements nach § 15 gilt § 15 Abs. 4; für Bestellungen über Digistore24 gilt § 9a Abs. 9.“ löschen; Schnellversion-Marker unverändert lassen |
| 3 | `content/legal/agb-v3.md` | § 9a komplett (Z. 112-138) | Überschrift und alle Absätze löschen, kein Platzhalter |
| 4 | `content/legal/agb-v3.md` | § 12a Abs. 6 (Z. 186) | Absatz löschen |
| 5 | `content/legal/agb-v3.md` | § 12b Abs. 1 (Z. 190) | „ (Ausnahme: Rückgabe nach § 9a Abs. 9)“ löschen, Punkt bleibt |
| 6 | `content/legal/agb-v3.md` | § 12c Abs. 3 (Z. 200) | ersetzen durch „(3) (weggefallen)“; Z. 201-203 nicht anfassen |
| 7 | `content/legal/agb-v3.md` | § 15 komplett (Z. 249-259) | Überschrift und Abs. 1-5 löschen, kein Platzhalter |
| 8 | `content/legal/agb-v3.md` | Stand (Z. 261) | Monat der Veröffentlichung |
| 9 | `content/legal/datenschutz-v3.md` | Abschnitt 3 (Z. 23) | „; für Bestellungen über Digistore24 und bestehende Verträge das bisherige Monatsabonnement“ löschen |
| 10 | `content/legal/datenschutz-v3.md` | Abschnitt 4 (Z. 34) | letzten Satz „Digistore24 ist nicht unser Auftragsverarbeiter, …(Abschnitt 12).“ löschen |
| 11 | `content/legal/datenschutz-v3.md` | Abschnitt 12 Überschrift (Z. 111) | C5 Fassung A: „## 12. (weggefallen)“ · Fassung B: „## 12. Affiliate-Zuordnung auf der Partnerseite (Digistore24-Promocode)“ |
| 12 | `content/legal/datenschutz-v3.md` | Abschnitt 12 (Z. 113-123) | alle Absätze löschen (beide Fassungen) |
| 13 | `content/legal/datenschutz-v3.md` | Abschnitt 12 Promocode (Z. 125-135) | C5 Fassung A: löschen · Fassung B: nur Z. 125 löschen, Rest lassen |
| 14 | `content/legal/datenschutz-v3.md` | Abschnitt 13 (Z. 141) | Satz „Käufe über Digistore24 melden wir nicht an Google.“ löschen |
| 15 | `content/legal/datenschutz-v3.md` | Abschnitt 17 (Z. 185) | Aufzählungspunkt „Monatsabonnement …“ löschen |
| 16 | `content/legal/datenschutz-v3.md` | Abschnitt 20 (Z. 207) | „ bei Bestellungen über die Partnerseite unser Vertriebspartner Digistore24 als eigener Verantwortlicher (Abschnitt 12),“ löschen |
| 17 | `content/legal/datenschutz-v3.md` | Abschnitt 21 (Z. 211) | nur bei Befund aus Teil E Punkt 3: Satz aus S-D10 anhängen; sonst nichts |
| 18 | `content/legal/datenschutz-v3.md` | Abschnitt 23 (Z. 221) | Satz 3 löschen |
| 19 | `content/legal/datenschutz-v3.md` | Abschnitt 24 (Z. 225) | Satz 3 löschen |
| 20 | `content/legal/datenschutz-v3.md` | Stand (Z. 231) | Monat der Veröffentlichung |
| 21 | `content/legal/cookies-v3.md` | Z. 7 | C5 Fassung A: „, Meta Pixel und auf der Partnerseite der Digistore24-Promocode)“ → „ und Meta Pixel)“ · Fassung B: nichts |
| 22 | `content/legal/cookies-v3.md` | Z. 23 | C5 Fassung A: Absatz löschen · Fassung B: letzten Satz auf „… Abschnitt 12.“ ändern |
| 23 | `content/legal/cookies-v3.md` | Tabelle Z. 63-65 | C5 Fassung A: drei `ds24`-Zeilen löschen · Fassung B: nichts |
| 24 | `content/legal/cookies-v3.md` | Z. 74 | C5 Fassung A: „, `ds24c.v1`“ löschen · Fassung B: nichts |
| 25 | `content/legal/cookies-v3.md` | Stand (Z. 82) | bei Fassung A: Monat der Veröffentlichung |
| 26 | `content/legal/impressum.md` | Z. 1 (interne Kopfnotiz) | durch Wortlaut S-I1 ersetzen |
| 27 | `content/legal/produkt-disclaimer.md` | Z. 1 (interne Kopfnotiz) | durch Wortlaut S-I1 ersetzen |
| 28 | `app/partner-danke/page.tsx`, `scripts/check-schnellversion.ts`, `scripts/check-partner-angebot.ts` | siehe Teil E Punkt 4 | Builder entscheidet (kein Rechtstext) |

**Nicht anfassen:** § 12d, § 12c Abs. 4, alle `<!-- if:schnellversion -->`- und `<!-- if:schnellversion-off -->`-Blöcke sowie die Rollback-Dateien.

## Prüfungen

- Verbotswort-Liste aus der Vorgabe: 0 Treffer in dieser Datei (geprüft mit `rg -i`, ohne diese Zeile).
- Keine privaten Adressen und keine privaten E-Mail-Adressen. Genannt ist nur info@gobd-doku-erstellen.de.
- Nur gelesen: kein PR, kein Kommentar, keine Edits im Repo.
