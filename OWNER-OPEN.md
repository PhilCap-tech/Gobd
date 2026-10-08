# Offen für den Owner

Stand 08.10.2026. Die öffentlichen Seiten enthalten keine `[klären]`-Marker mehr.
Dieser Text ist intern und wird nicht ausgeliefert.
Stripe bleibt im Testmodus. Die Live-Schaltung ist nicht Teil dieser Freigabe.

## Vom Owner bestätigt (08.10.2026)

Philip, 08.10.2026, 13:08: Die Rechtstexte aus PR #62 (live seit 02.10.) sind bestätigt.

- **§ 36 VSBG:** Der Satz im Impressum bleibt: nicht bereit und nicht verpflichtet, an einer Verbraucherschlichtung teilzunehmen.
- **Gerichtsstand:** Monheim am Rhein (Sitz der IKAT GmbH) bleibt.
- **Fristen:** Download bereits erzeugter PDFs nach Vertragsende **30 Tage**, danach Löschung soweit keine Aufbewahrungspflicht entgegensteht. Zahlungsausfall: Mahnung, danach Sperre des Kontozugangs nach **14 Tagen**. Preisänderung des Monatsentgelts: Ankündigung **4 Wochen** in Textform, dann außerordentliche Kündigung zum Wirksamwerden. Der Code setzt Sperre und Löschung noch nicht automatisch um. Heute verschickt der Webhook nur eine Hinweis-Mail bei `invoice.payment_failed`. Eine automatische Sperre gibt es nicht.
- **AGB-Umfang:** „24 Module, alle inklusive“ bleibt.

## Wirklich offen

Nicht Teil der Freigabe vom 08.10.2026.

- **MStV § 18 Abs. 2:** Der Abschnitt ist weggelassen. Nur wieder aufnehmen, wenn der Blog als journalistisch-redaktionell gilt. Dann Name und Anschrift nennen.
- **DPF-Zertifizierung:** Nicht geprüft für Vercel, Google, Meta, Stripe und Resend. Die Texte stützen USA-Übermittlungen auf Standardvertragsklauseln oder einen Angemessenheitsbeschluss, sofern der Anbieter zertifiziert ist. Sie behaupten die Zertifizierung nicht.

## Aus dem Code übernommen (nicht geraten)

- Speicherung von Konto, Fragebogen, Firmen und Readiness: **Google Sheets** (`intakes`, `entities`, `readiness_leads`). Entwürfe, PDFs, Kapiteltexte und Uploads: **privater Vercel Blob**. Datei-Fallback nur ohne Token, lokal.
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
