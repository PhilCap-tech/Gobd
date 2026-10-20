> **INTERNER ENTWURF · Stand 20.10.2026 · Fassung 3 – final, zur Einbindung durch Builder nach Freigabe · keine Rechtsberatung**
> Textentwurf für gobd-doku-erstellen.de (IKAT GmbH). Nicht veröffentlicht, nicht versendet, Repository nicht geändert.
> **Status:** Fassung 3 – final, zur Einbindung durch Builder nach Freigabe. Grundlage: Entscheidungen von Philip Cappelletti vom 20.10.2026, 07:39 Uhr (Europe/Zagreb), übermittelt durch den GoBD Chief of Staff. Vor Veröffentlichung juristisch prüfen.
> Die veröffentlichungsfähigen Texte (§ 9a, Hinweis auf der Partnerseite, Datenschutz-Abschnitt 12 und Folgeänderungen) enthalten keine offenen Platzhalter mehr. Technische Prüfungen vor dem Livegang stehen in Abschnitt 4 (T1–T8).

---

## 0. Grundlagen und Quellen

### 0.1 Geprüfte Fassungen im Repository (PhilCap-tech/Gobd, Branch `main`)

Stand des Branches beim Abruf: Commit `85dd175`, 19.10.2026, 20:21 Uhr (Europe/Zagreb). Abgerufen am 20.10.2026.

| Datei | URL | Stand laut Datei |
|---|---|---|
| AGB | https://raw.githubusercontent.com/PhilCap-tech/Gobd/main/content/legal/agb.md | 13.10.2026 |
| Datenschutzerklärung | https://raw.githubusercontent.com/PhilCap-tech/Gobd/main/content/legal/datenschutz.md | 15.10.2026 |
| FAQ | https://raw.githubusercontent.com/PhilCap-tech/Gobd/main/content/faq.md | ohne Datum |

Wichtige Stellen im Bestand:
- **AGB § 1 Abs. 1:** Die AGB gelten für Verträge „zwischen IKAT GmbH … und dem Kunden“. Ein Dritter als Verkäufer ist nicht vorgesehen.
- **AGB § 3 Abs. 2:** Vertragsschluss „über Stripe Checkout“, Zustandekommen „mit erfolgreicher Zahlungsbestätigung bzw. Annahme durch den Anbieter“.
- **AGB § 4 Abs. 2–3:** 149 € Einrichtung + 49 €/Monat; der erste Monat ist im **Einstiegspreis von 198 €** (149 € + 49 €) enthalten; Zahlung über Stripe, Rechnungen im Kundenkonto unter „Abo & Rechnungen“. **§ 4 Abs. 5:** Preisanpassung mit 4 Wochen Ankündigungsfrist.
- **AGB § 8:** Kein gesetzliches Widerrufsrecht (B2B).
- **AGB § 9:** 14-Tage-Zufriedenheitsgarantie per E-Mail an info@; vor dem ersten PDF 198 € zurück, danach nur 49 €; Einrichtung 149 € nicht erstattungsfähig.
- **AGB § 12 Abs. 2:** Kündigung im Kundenkonto („Konto → Abo → Kündigen“) oder in Textform an info@.
- **FAQ Nr. 6** „14 Tage Zufriedenheitsgarantie“: Voraussetzung „Bestellung über gobd-doku-erstellen.de (Stripe Checkout)“. FAQ Nr. 2 nennt als Schritt 1 „Bestellung über die Website (Stripe Checkout)“.
- **Datenschutzerklärung:** 24 nummerierte Abschnitte (`## 1.` bis `## 24.`). Relevant sind **4. Auftragsverarbeiter**, **11. Zahlungsabwicklung über Stripe**, **12. Google Ads Conversion-Tracking** (Transaktions-ID = Stripe-Checkout-Session-ID), **19. Weitergabe von Daten**, **20. Speicherdauer**, **22. Pflicht zur Bereitstellung** und **23. Automatisierte Entscheidungsfindung**. Einen eigenen Abschnitt zu Empfängern oder Drittlandübermittlungen gibt es nicht; Drittlandangaben stehen jeweils im Abschnitt des Dienstes. Die einzige Querverweisung mit Nummer ist „Abschnitt 10“ in Abschnitt 4.

### 0.2 Offizielle Digistore24-Quellen (alle abgerufen am 20.10.2026)

Hinweis: Die Adressen ohne Nummer (z. B. `/page/terms`, `/page/imprint`) zeigten beim Abruf vom Server aus die Fassung der **Digistore24 Inc. (USA)**. Die angezeigte Fassung hängt also von der Region ab. Zitiert werden die Adressen mit Reseller-Nummer (1 = Digistore24 GmbH, 4 = Digistore24 MSLW Limited), die Digistore24 selbst verlinkt.

| Kürzel | Quelle | URL |
|---|---|---|
| Q1 | Impressum Digistore24 GmbH | https://www.digistore24.com/page/imprint/1/de |
| Q2 | Allgemeine Geschäftsbedingungen des Digistore24 für Käufer (Digistore24 GmbH) | https://www.digistore24.com/page/terms/1/de |
| Q3 | Datenschutzerklärung Digistore24 GmbH (Endkunden) | https://www.digistore24.com/page/privacy/1/de |
| Q4 | Digistore24 GmbH AGB für Vendoren und Affiliates | https://www.digistore24.com/info/merchant_contract/1/de |
| Q5 | Hilfe-Center: Das Reseller-Modell auf Digistore24 | https://help.digistore24.com/hc/de/articles/23298594798225 |
| Q6 | Hilfe-Center: Resellerverträge bei Digistore24 | https://help.digistore24.com/hc/de/articles/23329038461969 |
| Q7 | Hilfe-Center: Übersicht Digistore24 Reseller | https://help.digistore24.com/hc/de/articles/23314370906897 |
| Q8 | Hilfe-Center: Rückgaberegelung erstellen | https://help.digistore24.com/hc/de/articles/23901093157393 |
| Q9 | Hilfe-Center: Rückgaben und Rückerstattungen durchführen (inkl. „Teilrückgabe durchführen“) | https://help.digistore24.com/hc/de/articles/24292990530321 |
| Q10 | Hilfe-Center: Wie kündige ich ein Abonnement bei Digistore24? | https://help.digistore24.com/hc/de/articles/27768168637841 |
| Q11 | Impressum Digistore24 MSLW Limited | https://www.digistore24.com/page/imprint/4/de |
| Q12 | Hilfe-Center: Billie als Bezahlmethode (Einstellung „Für Geschäftskunden verfügbar“) | https://help.digistore24.com/hc/de/articles/41006392988689 |
| Q13 | Hilfe-Center: Prozesse des Digistore24-Supports bei Rückgabe- und Kündigungsanfragen | https://help.digistore24.com/hc/de/articles/23638406767505 |

Ergänzende Angaben des CoS vom 20.10.2026 (nicht aus den Quellen, sondern intern mitgeteilt):
- Das Bestellformular ist auf `/partner-angebot` **verlinkt, nicht eingebettet** (keine Multi-Step-Order-Box).
- Digistore24 wählt die verkaufende Gesellschaft nach dem Land des Käufers. Bei einem Test mit Käufer aus Deutschland war es die **Digistore24 GmbH**.
- Abrechnung: **198 € netto beim Kauf** (Einrichtung 149 € + 1. Monat 49 €), das Abo über 49 € netto/Monat beginnt **einen Monat später**.
- Philip hat in Digistore24 eine Rückgabefrist von **14 Tagen einschließlich B2B** eingestellt. Ob die Einstellung greift, wird noch geprüft.

### 0.3 Befunde zur Rolle von Digistore24 (kurze, wörtliche Zitate)

1. **Verkaufende Gesellschaft:** Digistore24 betreibt mehrere Reseller-Gesellschaften (Q7): „DACH-Reseller – Digistore24 GmbH (Deutschland)“, „US-Reseller – Digistore24 Inc. (USA)“, „UK-Reseller – Digistore24 LTD“, „IE-Reseller – Digistore24 MSLW Ltd (Irland)“. Welche davon verkauft, hängt nach Q6 und Q7 von den Reseller-Verträgen des Vendors und von der Region des Käufers ab. Nach dem Test des CoS ist es für Käufer aus Deutschland die Digistore24 GmbH. Daten der GmbH (Q1): „Digistore24 GmbH, St.-Godehard-Straße 32, 31139 Hildesheim, Deutschland“, „Registergericht: Amtsgericht Hildesheim“, „Registernummer: HRB 202956“, USt-ID EU „DE283017717“, support@digistore24.com, Datenschutzbeauftragter Simon Hofer (datenschutz@digistore24.com). Die Entwürfe verwenden deshalb neutral „Digistore24“ bzw. „die jeweils nach Ihrem Land zuständige Digistore24-Gesellschaft“.
2. **Wiederverkäufer im eigenen Namen; Kaufvertrag mit Digistore24, Leistung durch den Vendor:**
   - Q2 § 2: „Wir verkaufen im eigenen Namen und für eigene Rechnung Produkte und Dienstleistungen von Händlern und Dienstleistern (…) Die Auslieferung des Produktes oder die Erbringung der Dienstleistung erfolgt somit über unsere Vertragspartner (…), die unsere Erfüllungsgehilfen sind.“
   - Q2 § 2: „Unsere Vertragspartner sind berechtigt, gegebenenfalls ergänzende produktspezifische Nutzungsbedingungen vorzuhalten. (…) Diese gelten sodann zwischen dem Kunden und unserem Erfüllungsgehilfen.“ Auf diese Stelle stützt sich die Geltung der IKAT-AGB als Nutzungsbedingungen.
   - Q4 Präambel: „Eine vertragliche Beziehung zwischen Vendor und Endkunde besteht nicht.“ Q4 § 3: „Hierbei agiert der Vendor gegenüber dem Kunden als Erfüllungsgehilfe von Digistore24.“
3. **Rechnung (Q2 § 3, § 6; Q4 § 3):** „Mit der Bestellbestätigung erhält der Kunde eine Rechnung über die erworbene Leistung. Der Kunde ist damit einverstanden, dass diese Rechnung ausschließlich elektronisch übersandt wird.“ / Q4: „Zahlungsempfänger und Rechnungsstelle ist Digistore24.“ Der Vertrag kommt mit der Bestellbestätigung zustande (Q2 § 3: „Diese Bestellbestätigung stellt bereits die Annahme (…) dar.“).
4. **Rückgabe und Erstattung:**
   - Q2 (Käufer-AGB GmbH) enthält **keine 60-Tage-Frist**, sondern nur das gesetzliche Widerrufsrecht für Verbraucher: „Die in dieser Erklärung genannten Widerrufsrechte stehen ausschließlich Verbrauchern zu.“
   - Q8: Der Vendor wählt die Frist („Digistore24 GmbH | 14, 30, 60, 90 und 180 Tage“). Für B2B gilt: „Rückgaberichtlinie für B2B-Kunden erlauben (…) Standard ist Nein.“ „Die Einstellung wirkt nur bei Bestellungen über den deutschen und den irischen Reseller.“ „Die Rückgabefrist beginnt mit der ersten Zahlung.“
   - **Abo, Q8:** „Die Rückgabefrist, die du für deine Produkte einstellst, gilt nicht für Abo-Produkte. Für die Kündigung von Abo-Produkten ist die Einstellung zur Mindestlaufzeit ausschlaggebend.“ Für den Fall, dass die Rückgabefrist das Abo nicht erfasst, ist das hier aber wenig erheblich: In den 14 Tagen nach dem Kauf wird nur die Zahlung über 198 € fällig, die erste Abo-Zahlung von 49 € erst einen Monat später. → technische Prüfung T1 (Einmalzahlung oder erste Zahlung eines Abo-Plans?).
   - **Pflicht von Digistore24 zur Rückgabe, Q9:** „Geht bei uns eine Rückgabeanfrage innerhalb der von dir festgelegten Rückgabefrist ein, sind wir aufgrund der gesetzlichen Regelung verpflichtet, stellvertretend für dich die Rückgabe durchzuführen.“ Eine „Rückgabe“ in Digistore24 ist eine volle Erstattung der Transaktion. Q13: „Wenn ein Endkunde explizit erwähnt hat, dass er sein Geld zurückerhalten möchte“, prüft der Support je nach Produkttyp und leitet die Rückgabe ein; der Vendor „erhält eine Kopie der Antwort-E-Mail“. **Mit einer B2B-Rückgabefrist von 14 Tagen kann der Digistore24-Support also auch nach dem ersten PDF voll erstatten.** Das kann mit der Erstattungsregel aus § 9 kollidieren (siehe Punkt 5 und Prüfung T2).
5. **Teilerstattung durch den Vendor (Q9, Abschnitt „4. Schritt-für-Schritt-Anleitung: Teilrückgabe durchführen“):** Vendoren können Teilerstattungen selbst auslösen: „Des Weiteren kannst du dich kulant zeigen und Teilrückerstattungen ausführen, z. B. wenn der Kunde einen Teil des Produktes bereits verwendet hat.“ Ablauf: „Gehe in der Vendor-Ansicht auf Berichte > Transaktionen“ → Bestellung suchen → „Lupen-Icon“ → „Scrolle herunter bis zum Fenster Teilweise Rückerstattung“ → Betrag eingeben → „Button Betrag erstatten“. „Nach einer Prüfung durch unser System wird die Teilrückgabe eingeleitet und dem Käufer wird der Betrag – wie bei einer gewöhnlichen Rückgabe – erstattet.“ **Wichtige Einschränkungen:** „Bei einer Teilrückgabe ändert sich der Bezahlstatus nicht! Abo- und Ratenzahlungen laufen demnach ganz normal weiter.“ „Es werden für Teilrückgabe keine IPN-Benachrichtigungen versendet.“ Nach einer Teilerstattung muss also **zusätzlich das Abo gekündigt** und der Zugang bei IKAT von Hand beendet werden.
6. **Kündigung durch Geschäftskunden (Q2 § 6; Q10):** Q2: „Gestaltungserklärungen, insbesondere Kündigungen, Anfechtungen sowie Widerrufe sind einzig gegenüber der Digistore24 GmbH (…) support@digistore24.com abzugeben.“ Q10: „Wenn du als Unternehmen/Geschäftskunde (B2B) gekauft hast: Du musst den Digistore24-Support für die Kündigung kontaktieren.“ Der Weg führt über die Bestellbestätigungs-E-Mail (Absender `support@digistore24.com`, Betreff „Digistore24 - Bestellung erfolgreich / Zugang“), dann „Klicken Sie hier für Soforthilfe!“ → „Frage zur Bezahlung“ → „Ich möchte die Zahlungen kündigen“ → „Benötigen Sie weitere Hilfe? Wenden Sie sich an uns.“
7. **Datenschutzrolle (Q3, Q4):**
   - Digistore24 ist **eigener Verantwortlicher** für die Bestelldaten, nicht Auftragsverarbeiter von IKAT. Q3 Nr. 1 gilt für die „Tätigkeit als Reseller gegenüber Endkundinnen und Endkunden“.
   - Datenkategorien (Q3 4.2a): Stammdaten, IP-Adresse, Logfiles, Zahlungsdaten („Zahlungsanbieter, Zahlungsart, Betrag, Transaktionskennungen“), Bestell- und Vertragsdaten, gegebenenfalls weitere und freiwillige Angaben.
   - An den Vendor (Q3 4.2a): „Die im Bestellformular erhobenen Daten werden, soweit für die Vertragsdurchführung erforderlich, an den jeweiligen Vendor übermittelt“. Q4 § 9: „Der Vertragspartner erhält personenbezogene Daten von Dritten ausschließlich zum Zwecke der Vertragserfüllung gemäß Art. 6 Abs. 1 b) DSGVO. Für eine darüber hinausgehende Verwendung (…) hat der Vertragspartner als Verantwortlicher (…) allein für die Rechtmäßigkeit der Verwendung zu sorgen.“
   - **Gemeinsame Verantwortlichkeit (Art. 26 DSGVO) nach Q3 4.2b und Q4 § 11 gilt nur bei eingebettetem Bestellformular (Multi-Step-Order-Box).** Das Formular ist laut CoS **verlinkt**. Art. 26 ist daher **nicht einschlägig**.
   - Drittland (Q3 Nr. 4): „Die Daten können auch außerhalb der EU bzw. des EWR verarbeitet werden. Eine Datenübermittlung an Drittländer findet ausschließlich bei Vorliegen geeigneter Garantien, dem Abschluss von Standardvertragsklauseln oder bei Vorliegen eines Angemessenheitsbeschlusses (…) statt.“
   - Weitere eigene Verarbeitungen von Digistore24 (Q3): Bonitätsprüfung bei Lastschrift, Inkasso, teilautomatisierte Entscheidungen zu Rückgaben und Kündigungen, Aufbewahrung von Abrechnungsdaten „nach Ablauf von acht Jahren gelöscht“.
8. **Weitere Abweichungen:** Q2 § 5: Preise „inklusive Mehrwert- und Umsatzsteuer“, das Bestellformular zeigt also voraussichtlich brutto. Q4 § 3: Preiserhöhungen in Abos „spätestens 3 Monate vor Ablauf des laufenden Vertragszeitraumes“ mit Sonderkündigungsrecht; AGB § 4 Abs. 5 sieht 4 Wochen vor. Q12: Beschränkung auf Geschäftskunden über „Ja, Firmenname ist Pflichtfeld“.

---

## (1) AGB-Zusatz: „§ 9a Bestellungen über Digistore24 (Partner-Angebot)“

**Einordnung:** Einfügen als **neuer § 9a direkt nach § 9 (Zufriedenheitsgarantie)**. Die Nummerierung §§ 10–14 bleibt unverändert. Folgeänderung in **§ 1**, neuer Abs. 4:

> (4) Für Bestellungen über die Partnerseite https://www.gobd-doku-erstellen.de/partner-angebot, die über Digistore24 abgewickelt werden, gelten ergänzend und vorrangig die Regelungen in § 9a.

### Text (final)

> ## § 9a Bestellungen über Digistore24 (Partner-Angebot)
>
> (1) **Anwendungsbereich.** Dieser § 9a gilt für Bestellungen, die Sie über die Partnerseite https://www.gobd-doku-erstellen.de/partner-angebot im Bestellformular von Digistore24 aufgeben (Produkte 751404 und 751419). „Digistore24“ ist die jeweils nach Ihrem Land zuständige Digistore24-Gesellschaft (für Käufer aus Deutschland: Digistore24 GmbH, St.-Godehard-Straße 32, 31139 Hildesheim, Amtsgericht Hildesheim, HRB 202956). Welche Gesellschaft Ihr Vertragspartner ist, sehen Sie im Bestellformular und in der Bestellbestätigung. Für Bestellungen über Stripe Checkout auf unserer Website gilt dieser § 9a nicht.
>
> (2) **Nur für Unternehmer.** Das Partner-Angebot richtet sich **ausschließlich an Unternehmer** im Sinne von § 14 BGB, die in Ausübung ihrer gewerblichen oder selbstständigen beruflichen Tätigkeit bestellen. **Bestellungen sind nur als Unternehmen und nur mit Angabe des Firmennamens möglich**; der Firmenname ist im Bestellformular ein Pflichtfeld. Verbraucher im Sinne von § 13 BGB sind vom Vertragsschluss ausgeschlossen. Mit der Bestellung bestätigen Sie, dass Sie als Unternehmer handeln. § 1 Abs. 2 und § 7 Abs. 3 gelten.
>
> (3) **Vertragspartner für Kauf und Zahlung.** Digistore24 verkauft die Leistung als Wiederverkäufer im eigenen Namen und für eigene Rechnung. Ihr Vertragspartner für Kauf und Zahlung ist ausschließlich Digistore24. Der Vertrag kommt nach den Bedingungen von Digistore24 zustande, in der Regel mit der Bestellbestätigung per E-Mail von Digistore24. Für Vertragsschluss, Preise, Zahlung, Rechnung, Zahlungsverzug, Rückabwicklung und Kündigung gelten **vorrangig** die Käufer-AGB von Digistore24, die Ihnen im Bestellformular angezeigt werden (für Käufer aus Deutschland derzeit: https://www.digistore24.com/page/terms/1/de).
>
> (4) **Leistungserbringung durch die IKAT GmbH; Nutzungsbedingungen.** Die IKAT GmbH erbringt die bestellte Leistung (Bereitstellung des Online-Dienstes und Erstellung der Verfahrensdokumentation nach § 2 und § 5) im Auftrag von Digistore24. Für die **Nutzung des Dienstes** gelten diese AGB als produktspezifische Nutzungsbedingungen, insbesondere § 2, § 5, § 6, § 7, § 11, § 12 Abs. 4 und § 13. Ihre gesetzlichen Rechte gegenüber Digistore24 als Verkäufer bleiben unberührt.
>
> (5) **Preise.** Es gelten dieselben Preise wie bei einer Bestellung über unsere Website: **198 € zum Start (Einrichtung 149 € + 1. Monat 49 €), danach 49 € pro Monat**, jeweils netto zuzüglich der gesetzlichen Umsatzsteuer. Digistore24 berechnet beim Kauf 198 € netto. Das monatliche Nutzungsentgelt von 49 € netto berechnet Digistore24 erstmals einen Monat nach dem Kauf und danach monatlich im Voraus. Das Bestellformular von Digistore24 zeigt die Beträge einschließlich Umsatzsteuer an. Maßgeblich sind die im Bestellformular angezeigten Beträge. § 4 Abs. 2 und 3 gelten für Bestellungen über Digistore24 nicht.
>
> (6) **Preisänderungen.** Abweichend von § 4 Abs. 5 kündigen wir Änderungen des monatlichen Nutzungsentgelts für Bestellungen über Digistore24 **mindestens drei Monate** vor ihrem Wirksamwerden in Textform an. Mit der Ankündigung weisen wir Sie auf Ihr **Sonderkündigungsrecht** hin: Sie können das Abonnement außerordentlich zum Zeitpunkt des Wirksamwerdens der Preisänderung kündigen.
>
> (7) **Rechnung.** Die Rechnungen stellt **Digistore24** aus und übermittelt sie elektronisch, mit der Bestellbestätigung und für die Folgezahlungen nach den Bedingungen von Digistore24. Die IKAT GmbH stellt für diese Bestellungen keine eigene Rechnung. Rechnungsfragen richten Sie bitte an Digistore24 (support@digistore24.com).
>
> (8) **Laufzeit und Kündigung.** Das Abonnement läuft auf unbestimmte Zeit und ist **monatlich** zum Ende des jeweils laufenden Abrechnungsmonats kündbar. Die Kündigung erklären Sie **gegenüber Digistore24**: Öffnen Sie die Bestellbestätigung von Digistore24 (Absender support@digistore24.com, Betreff „Digistore24 - Bestellung erfolgreich / Zugang“), klicken Sie auf den Link zur Soforthilfe, wählen Sie „Frage zur Bezahlung“ → „Ich möchte die Zahlungen kündigen“ und senden Sie Ihr Anliegen über „Wenden Sie sich an uns“ an den Digistore24-Support. Alternativ kündigen Sie in Textform an support@digistore24.com unter Angabe Ihrer Bestell-ID. Die Kündigungsfunktion im Kundenkonto nach § 12 Abs. 2 steht für Bestellungen über Digistore24 nicht zur Verfügung. § 12 Abs. 1, 3 und 4 gelten entsprechend.
>
> (9) **14-Tage-Zufriedenheitsgarantie.** Auch für Bestellungen über Digistore24 gilt die **14-Tage-Zufriedenheitsgarantie** ab dem Kauf, und zwar ausschließlich nach den folgenden Regeln, die denen in § 9 entsprechen:
> - Haben Sie noch **kein PDF** der Dokumentation erzeugt oder heruntergeladen, erstatten wir **198 € zzgl. USt** (Einrichtung 149 € und 1. Monat 49 €).
> - Haben Sie bereits ein **PDF erzeugt oder heruntergeladen**, erstatten wir nur das **monatliche Nutzungsentgelt von 49 € zzgl. USt**. Die **Einrichtungsvergütung von 149 € zzgl. USt ist dann nicht erstattungsfähig**, da die Einrichtungsleistung erbracht ist.
>
> **So beantragen Sie die Erstattung:** Wenden Sie sich innerhalb der 14 Tage an Digistore24 über den Link zur Soforthilfe in Ihrer Bestellbestätigung von Digistore24 und geben Sie Ihre Bestell-ID an. Zusätzlich erreichen Sie uns unter **info@gobd-doku-erstellen.de** (Betreff „Zufriedenheitsgarantie“, mit Bestell-ID). **Erstattungen werden über Digistore24 abgewickelt**, und zwar über das beim Kauf verwendete Zahlungsmittel. Mit der Erstattung endet das Abonnement; weitere Beträge werden nicht abgebucht. Eine darüber hinausgehende Erstattung gewähren wir nicht; § 9 Abs. 4 (gesetzliche Rechte) bleibt unberührt. Ein gesetzliches Widerrufsrecht besteht nicht (§ 8); die Garantie ist eine vertragliche Zusage.
>
> (10) **Leistungsumfang.** Ein Abonnement umfasst **bis zu fünf Firmen** und alle Module (§ 2 Abs. 1 und 2). Für jede weitere Firma ab der sechsten ist ein weiteres Abonnement erforderlich.
>
> (11) **Verhältnis zu den übrigen Regelungen.** § 3 (Vertragsschluss), § 4 (Preise und Zahlung), § 9 Abs. 1 bis 3 (Antragsweg und Erstattung) und § 12 Abs. 2 (Kündigungsweg) gelten für Bestellungen über Digistore24 nicht, soweit dieser § 9a oder die Bedingungen von Digistore24 etwas anderes regeln. Wir dürfen den Zugang sperren oder beenden, wenn Digistore24 uns die Beendigung, Rückabwicklung oder einen Zahlungsausfall der Bestellung mitteilt; § 4 Abs. 4 gilt insoweit nicht. Im Übrigen gelten diese AGB, soweit sie dem § 9a und den Bedingungen von Digistore24 nicht widersprechen. Bei Widersprüchen gehen in Fragen von Kauf und Zahlung die Bedingungen von Digistore24 vor, in Fragen der Nutzung des Dienstes diese AGB.

### Interner Umsetzungshinweis zu Abs. 9 (nicht Teil des AGB-Textes)

Erstattungen in Digistore24 (Quellen Q9, Q13):
- **198 € (vor dem ersten PDF):** In der Vendor-Ansicht „Berichte > Transaktionen“ → Bestellung → bei der Transaktion „Rückgabe“. „Nach der Prüfung leitet Digistore24 die Rückgabe ein.“ Ob damit auch das Abo endet, prüft T3.
- **49 € (nach dem ersten PDF):** „Berichte > Transaktionen“ → Bestellung → Fenster „Teilweise Rückerstattung“ → Betrag eingeben → „Betrag erstatten“. **Danach das Abo von Hand kündigen und den Zugang bei IKAT beenden.** Laut Q9 laufen Abos nach einer Teilrückgabe „ganz normal weiter“, und es werden „keine IPN-Benachrichtigungen“ versendet (T4).
- Anfragen, die beim Digistore24-Support eingehen, werden laut Q13 dem Vendor in Kopie weitergeleitet. Innerhalb einer eingestellten Rückgabefrist ist Digistore24 nach Q9 „verpflichtet, stellvertretend für dich die Rückgabe durchzuführen“, also voll zu erstatten. Ob die B2B-Rückgabeeinstellung (14 Tage) das auslöst und damit die Regel aus Abs. 9 unterläuft, prüft T2.

---

## (2) Hinweis auf der Partnerseite (nahe am Kaufen-Button), final

> Der Kauf läuft über Digistore24 (die jeweils nach Ihrem Land zuständige Digistore24-Gesellschaft, für Käufer aus Deutschland die Digistore24 GmbH, Hildesheim): Digistore24 ist als Wiederverkäufer Ihr Vertragspartner für Kauf, Zahlung und Rechnung, es gelten die im Bestellformular verlinkten Käufer-AGB und die Datenschutzerklärung von Digistore24, die Leistung erbringt die IKAT GmbH nach unseren AGB (§ 9a). Das Angebot gilt ausschließlich für Unternehmer im Sinne von § 14 BGB; eine Bestellung ist nur als Unternehmen mit Angabe des Firmennamens möglich, Verbraucher sind ausgeschlossen. 198 € zum Start (Einrichtung 149 € + 1. Monat 49 €), danach 49 €/Monat, jeweils zzgl. USt, bis zu 5 Firmen, monatlich über Digistore24 kündbar, 14-Tage-Zufriedenheitsgarantie nach § 9a AGB mit Erstattung über Digistore24.

*(Einbindung: „AGB (§ 9a)“ auf `/agb` verlinken.)*

---

## (3) Datenschutzerklärung: Ergänzung

### 3.1 Neuer Abschnitt (final)

**Einordnung:** Als **neuer Abschnitt 12** nach „11. Zahlungsabwicklung über Stripe“ einfügen. Die bisherigen Abschnitte 12–24 werden zu 13–25. Der Querverweis „Abschnitt 10“ in Abschnitt 4 bleibt richtig.

> ## 12. Bestellungen über Digistore24 (Partner-Angebot)
>
> Wenn Sie über unsere Partnerseite https://www.gobd-doku-erstellen.de/partner-angebot bestellen, führt Sie ein Link zum Bestellformular von Digistore24. „Digistore24“ ist die jeweils nach Ihrem Land zuständige Digistore24-Gesellschaft (für Käufer aus Deutschland: Digistore24 GmbH, St.-Godehard-Straße 32, 31139 Hildesheim, Deutschland). Digistore24 verkauft unsere Leistung als Wiederverkäufer im eigenen Namen und ist Ihr Vertragspartner für Kauf, Zahlung und Rechnung.
>
> Digistore24 verarbeitet die Daten aus dem Bestellformular und zur Zahlungsabwicklung als **eigener Verantwortlicher**, nicht in unserem Auftrag. Einzelheiten und Ihre Rechte gegenüber Digistore24 finden Sie in der Datenschutzerklärung der zuständigen Digistore24-Gesellschaft, die im Bestellformular verlinkt ist (für Käufer aus Deutschland: https://www.digistore24.com/page/privacy/1/de).
>
> Von Digistore24 erhalten wir die Daten, die für die Durchführung Ihrer Bestellung erforderlich sind: Angaben zu Ihrer Person und Ihrem Unternehmen aus dem Bestellformular sowie Angaben zur Bestellung und zu deren Status (z. B. Zahlung, Kündigung, Erstattung). Außerdem erhalten wir von Digistore24 Abrechnungen über die verkauften Leistungen. Wir verwenden diese Daten, um Ihre Bestellung Ihrem Kundenkonto zuzuordnen, die gebuchte Leistung zu erbringen, mit Ihnen zur Bestellung zu kommunizieren und Kündigungen und Erstattungen umzusetzen. Soweit dafür erforderlich, tauschen wir mit Digistore24 Angaben zu Ihrer Bestellung aus.
>
> Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO. Für die Aufbewahrung von Abrechnungen und Buchungsbelegen ist es Art. 6 Abs. 1 lit. c DSGVO in Verbindung mit § 147 AO und § 257 HGB.
>
> **Käufe über Digistore24 geben wir nicht an Werbedienste weiter, insbesondere nicht an Google Ads oder Meta.**
>
> Nach Angaben von Digistore24 können Daten auch außerhalb der EU bzw. des EWR verarbeitet werden, dann nur auf Grundlage geeigneter Garantien, von Standardvertragsklauseln oder eines Angemessenheitsbeschlusses (Art. 45, 46 DSGVO). Für die Daten, die wir von Digistore24 erhalten und bei uns speichern, gelten die Abschnitte 8 und 20 (bisher 19) sowie die Speicherfristen in den Abschnitten 17 und 21 (bisher 16 und 20).

*Hinweis für den Builder: Die Klammern „(bisher …)“ beim Einbau entfernen und nur die neuen Nummern stehen lassen. Art. 26 DSGVO (gemeinsame Verantwortlichkeit) ist nicht einschlägig, weil das Bestellformular verlinkt und nicht eingebettet ist.*

### 3.2 Folgeänderungen in bestehenden Abschnitten (final)

Nummern nach Einfügen des neuen Abschnitts 12.

- **4. Auftragsverarbeiter**, Satz anfügen: „Digistore24 ist nicht unser Auftragsverarbeiter, sondern bei Bestellungen über die Partnerseite als Wiederverkäufer eigener Verantwortlicher (Abschnitt 12).“
- **13. Google Ads Conversion-Tracking und Google Analytics 4**, nach „Weitere Conversions (z. B. für den kostenlosen Check) melden wir nicht.“ einfügen: „Käufe über Digistore24 melden wir nicht an Google.“
- **20. Weitergabe von Daten**, ersten Satz ersetzen: „Eine Weitergabe erfolgt nur, soweit erforderlich (Hosting, Zahlungsdienstleister, bei Bestellungen über die Partnerseite unser Vertriebspartner Digistore24 als eigener Verantwortlicher (Abschnitt 12), gesetzliche Verpflichtung) oder mit Einwilligung.“ Der Rest bleibt unverändert.
- **23. Pflicht zur Bereitstellung**, Satz anfügen: „Bei Bestellungen über Digistore24 erhebt Digistore24 die für Kauf und Zahlung erforderlichen Daten.“
- **24. Automatisierte Entscheidungsfindung**, Satz anfügen: „Bei Bestellungen über Digistore24 kann Digistore24 eigene automatisierte Prüfungen vornehmen; siehe die Datenschutzerklärung von Digistore24.“
- **Stand-Datum** am Ende anpassen.

Abschnitt 14 (Meta Pixel, bisher 13) braucht keine Änderung; er sagt bereits „Bestellabschlüsse übermitteln wir nicht.“

---

## 4. Entschieden, Einbindung und technische Prüfungen

### Entschieden 20.10.2026

Durch den CoS:
- Preis wie auf der Hauptseite: 198 € zum Start (149 € + 1. Monat 49 €), danach 49 €/Monat netto; Digistore24 berechnet 198 € beim Kauf, das Abo beginnt einen Monat später.
- Verkäufer neutral „Digistore24“ nach Käuferland; für Käufer aus Deutschland Digistore24 GmbH (Test des CoS).
- Bestellformular verlinkt, nicht eingebettet; Art. 26 DSGVO nicht einschlägig.

Durch Philip, 07:39 Uhr:
- **Erstattung:** Die Regel aus § 9 ist die einzige Regel. Die Alternative mit voller Erstattung ist gestrichen. Erstattungen werden über Digistore24 abgewickelt.
- **Antragsweg:** Digistore24 (Soforthilfe-Link in der Bestellbestätigung), zusätzlich info@gobd-doku-erstellen.de.
- **Preisänderungen:** drei Monate Ankündigung mit Sonderkündigungsrecht (entspricht Q4 § 3).
- **Nur Unternehmer:** Der Firmenname ist Pflichtfeld; Verkauf nur an Unternehmer nach § 14 BGB.
- **Tracking:** Keine Übermittlung von Digistore24-Käufen an Google Ads oder Meta.

### Einbindung durch Builder (nach Freigabe)

- AGB: § 1 Abs. 4 und § 9a einfügen, Stand-Datum anpassen.
- Datenschutz: Abschnitt 12 einfügen, 12–24 auf 13–25 umnummerieren, Folgeänderungen nach 3.2 einbauen.
- Partnerseite: Hinweis aus (2) neben dem Kaufen-Button einbauen; bestehenden Text von `/partner-angebot` vorher abgleichen.
- FAQ: Nr. 6 ergänzen um „Bei Bestellungen über unsere Partnerseite (Digistore24) gelten dieselben Erstattungsregeln; die Erstattung beantragen Sie über Digistore24 (Soforthilfe-Link in der Bestellbestätigung) oder bei uns, abgewickelt wird sie über Digistore24 (§ 9a AGB).“ Nr. 2 und Nr. 5 um einen Hinweis auf Digistore24 ergänzen.

### Verbleibende technische Prüfungen (vor dem Livegang)

- **T1 Produktaufbau 751404:** Ist 751404 in Digistore24 eine Einmalzahlung oder die erste Zahlung eines Abo-Plans? Laut Q8 gilt die Rückgabefrist nicht für Abo-Produkte.
- **T2 Wirkung der B2B-Rückgabeeinstellung (14 Tage inkl. B2B):** Greift sie (laut Q8 nur beim deutschen und irischen Reseller)? Erstattet der Digistore24-Support dann innerhalb der Frist voll (Q9), auch nach dem ersten PDF? Falls ja, muss die Einstellung so gewählt werden, dass die Regel aus § 9a Abs. 9 eingehalten wird.
- **T3 Volle Rückgabe:** Beendet eine Rückgabe der 198-€-Transaktion auch das Abo über 49 €?
- **T4 Teilerstattung über 49 €:** Nach „Teilweise Rückerstattung“ das Abo von Hand kündigen und den Zugang bei IKAT beenden (keine Statusänderung, keine IPN laut Q9). Ist der Betrag brutto oder netto einzugeben?
- **T5 Produkteinstellungen:** „Für Geschäftskunden verfügbar → Ja, Firmenname ist Pflichtfeld“ aktiv? Keine Mindestlaufzeit an 751419? Kein externes Tracking (Google Ads, Meta) am Digistore24-Bestellformular hinterlegt?
- **T6 Freischaltung und Datenfelder:** Wie wird nach dem Kauf freigeschaltet (Schnittstelle/IPN, Zugangslink)? Passen die tatsächlich übermittelten Felder zur Beschreibung in Datenschutz-Abschnitt 12 („Angaben zu Ihrer Person und Ihrem Unternehmen … Bestellung und deren Status“)?
- **T7 Preisanzeige:** Zeigt das Bestellformular brutto 198 € bzw. 49 € zzgl. USt übereinstimmend mit der Partnerseite, und beginnt die erste Abo-Zahlung tatsächlich einen Monat nach dem Kauf?
- **T8 Weitere Reseller:** Bestehen neben der GmbH weitere Reseller-Verträge (z. B. MSLW Ltd., Irland)? Dann gelten für Nicht-DE-Käufer andere Käufer-AGB und Datenschutzerklärungen; der neutrale Wortlaut deckt das ab.
