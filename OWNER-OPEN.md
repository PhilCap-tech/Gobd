# Offen für den Owner

Stand 02.10.2026. Die öffentlichen Seiten enthalten keine `[klären]`-Marker mehr.
Dieser Text ist intern und wird nicht ausgeliefert.

## Wirklich offen

- **MStV § 18 Abs. 2:** Der Abschnitt ist weggelassen. Nur wieder aufnehmen, wenn der Blog als journalistisch-redaktionell gilt. Dann Name und Anschrift nennen.
- **§ 36 VSBG:** Im Impressum steht, dass wir nicht bereit und nicht verpflichtet sind, an einer Verbraucherschlichtung teilzunehmen. Ob das bei reinem B2B so bleiben soll, muss Counsel bestätigen.
- **Gerichtsstand:** Die AGB nennen Monheim am Rhein (Sitz der IKAT GmbH). Counsel soll den ausschließlichen Gerichtsstand bestätigen.
- **DPF-Zertifizierung:** Nicht geprüft für Vercel, Google, Meta, Stripe und Resend. Die Texte stützen USA-Übermittlungen auf Standardvertragsklauseln oder einen Angemessenheitsbeschluss, sofern der Anbieter zertifiziert ist. Sie behaupten die Zertifizierung nicht.

## Im Text gesetzte Defaults (bitte überschreiben, wenn anders gewollt)

Diese Fristen stehen in AGB, Datenschutz und FAQ. Der Code setzt sie noch nicht automatisch um.

- Download bereits erzeugter PDFs nach Vertragsende: **30 Tage**, danach Löschung soweit keine Aufbewahrungspflicht entgegensteht.
- Zahlungsausfall: Mahnung, danach Sperre des Kontozugangs nach **14 Tagen**. Heute verschickt der Webhook nur eine Hinweis-Mail bei `invoice.payment_failed`. Eine automatische Sperre gibt es nicht.
- Preisänderung des Monatsentgelts: Ankündigung **4 Wochen** in Textform, dann außerordentliche Kündigung zum Wirksamwerden.

## Aus dem Code übernommen (nicht geraten)

- Speicherung von Konto, Fragebogen, Firmen und Readiness: **Google Sheets** (`intakes`, `entities`, `readiness_leads`). PDFs und Kapiteltexte: **Vercel Blob**, sonst nur ein nicht dauerhafter Datei-Fallback.
- E-Mail: **Resend** an die konfigurierte Absenderadresse. Partnerformular (Name, Kanzlei, E-Mail, grobe Mandanten-Zahl, Nachricht) geht per Resend an info@gobd-doku-erstellen.de und liegt nicht in einer eigenen Tabelle.
- Readiness wird gespeichert (nicht nur im Browser), inklusive Name, E-Mail und Firma.
- Cookies aus dem Code: `gobd_consent` 180 Tage, `gobd_session` 30 Tage, `gobd_utm_first` nur bis zum Tab-Ende.
- Google Ads `AW-586367190` und GA4 `G-RJ4KLBP1SF` sind im ausgelieferten Client fest hinterlegt. Eine Meta-Pixel-ID ist dort nicht fest hinterlegt; ohne ID lädt das Pixel nicht.
- Rechnungen: Stripe-Rechnung im Kundenkonto unter „Abo & Rechnungen“ (Link und PDF). Kein eigener Rechnungsversand über Resend.
- Garantie nur per E-Mail an info@. Kein Button im Konto.
- Widerruf „Nur essenziell“ speichert die Ablehnung und lädt Marketing-Skripte nicht erneut. Vorhandene Marketing-Cookies löscht er nicht.
- Checkout bleibt im Testmodus, solange Test-Keys gesetzt sind. Ads werden nicht pausiert.

## Bewusst nicht behauptet

Region von Vercel, Google Sheets und Resend; Log-Aufbewahrung in Tagen; GA4-Aufbewahrung im Konto; ob die AVV bereits unterschrieben sind; Stripe-Postanschrift gegen die heutige Anbieterseite; automatische Löschung nach 30 Tagen.
