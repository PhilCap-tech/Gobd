> Legal v3 ENDFASSUNG (cookie-richtlinie.md), eingebaut 1:1 am 28.10.2026 (Builder, #282). Wahlfassung gobd_checkout: A. Interne Zeile, wird beim Rendern entfernt.

# Cookie-Richtlinie

## Kurzfassung

Wir nutzen **notwendige** Cookies und ähnliche Technologien, damit die Website, Sicherheit, Anmeldung, Bestellung und Stripe Checkout funktionieren. **Marketing-Dienste** (Google Ads / GA4, Meta Pixel und auf der Partnerseite der Digistore24-Promocode) laden wir erst nach Ihrer Einwilligung im Cookie-Banner. **Vercel Web Analytics** läuft ohne Cookies und ohne Einwilligung.

## Was sind Cookies?

Cookies sind kleine Textdateien auf Ihrem Endgerät. Vergleichbare Technologien (Local Storage, Session Storage) können ähnliche Funktionen erfüllen. Für das Speichern und Auslesen gilt § 25 TDDDG: Ohne Ihre Einwilligung setzen wir nur, was unbedingt erforderlich ist, damit wir den von Ihnen gewünschten Dienst bereitstellen können (§ 25 Abs. 2 Nr. 2 TDDDG). Alles andere setzen wir nur mit Ihrer Einwilligung (§ 25 Abs. 1 TDDDG).

## Essenzielle Cookies / Speicherung

Rechtsgrundlage: Art. 6 Abs. 1 lit. f bzw. lit. b DSGVO und § 25 Abs. 2 Nr. 2 TDDDG, soweit Speicherung/Zugriff unbedingt erforderlich ist.

## Marketing (nur nach Einwilligung)

Marketing-Dienste von Google und Meta laden wir erst, nachdem Sie im Cookie-Banner Marketing erlauben. Dabei können Daten an Google bzw. Meta und in Drittländer (insbesondere die USA) übermittelt werden. Einzelheiten finden Sie in unserer Datenschutzerklärung. Ihre Einwilligung können Sie jederzeit über „Cookie-Einstellungen“ im Seitenfuß widerrufen.

Wir setzen den Google Consent Mode v2 ein. Das Google-Tag wird erst geladen, nachdem Sie im Cookie-Banner „Marketing erlauben“ gewählt haben. Danach messen wir, ob eine Anzeige zu einem Kauf oder zur Anforderung des Ampel-Berichts geführt hat (Google Ads Conversion-Tracking, AW-586367190). Dazu übermitteln wir nach einem erfolgreichen Kauf den Bestellwert und die Stripe-Checkout-Session-ID als Transaktions-ID an Google. Zahlungsdaten übermitteln wir nicht. Außerdem werten wir die Nutzung der Website statistisch aus (Google Analytics 4, Aufbewahrung 14 Monate). Ohne Einwilligung findet keine Übertragung an Google statt. Ihre Einwilligung können Sie jederzeit über „Cookie-Einstellungen“ im Seitenfuß widerrufen.

Auf der Partnerseite https://www.gobd-doku-erstellen.de/partner-angebot laden wir nach „Marketing erlauben“ zusätzlich das Promocode-Skript von Digistore24. Es setzt das Cookie `ds24c.v1` sowie den Session-Storage-Eintrag `ds24s.v1` und, wenn Digistore24 die Speicherung erlaubt, den Local-Storage-Eintrag `ds24p.v1`. Zweck ist die Zuordnung eines Affiliate-Links und die Zählung des Aufrufs bei Digistore24. Dabei kann Ihr Browser Daten an Digistore24 übermitteln (Produkt-ID, Affiliate-ID, Kampagnenparameter, Referrer). Ohne Einwilligung wird das Skript nicht geladen. Einzelheiten stehen in der Datenschutzerklärung, Abschnitt „Bestellungen über Digistore24“.

## Stripe Checkout

Für die Zahlung leiten wir Sie zu Stripe Checkout weiter. Dort kann Stripe eigene Cookies bzw. ähnliche Technologien einsetzen, die für Zahlungsabwicklung und Betrugsprävention erforderlich sind (siehe Datenschutzerklärung, Abschnitt „Zahlungsabwicklung über Stripe“).

## Hosting (Vercel)

Das Hosting kann technisch bedingte Verbindungsdaten umfassen. Siehe Datenschutzerklärung.

## Vercel Web Analytics

Vercel Web Analytics setzt keine Cookies und speichert nichts auf Ihrem Endgerät. Eine Einwilligung ist nicht erforderlich. Einzelheiten stehen in der Datenschutzerklärung, Abschnitt „Vercel Web Analytics“.

## Kampagnenparameter (UTM)

Kampagnenparameter in der Adresse (UTM) speichern wir nicht auf Ihrem Endgerät.

## Übersicht der eingesetzten Cookies und ähnlichen Technologien

| Name / Technologie | Anbieter | Zweck | Kategorie | Laufzeit |
|---|---|---|---|---|
| `gobd_consent` (Cookie und Local Storage) | IKAT GmbH | Speichert Ihre Cookie-Auswahl | Essenziell | 180 Tage |
| `gobd_session` (Cookie) | IKAT GmbH | Hält Sie nach dem Magic-Link-Login angemeldet | Essenziell | 30 Tage |
| `gobd_checkout` (Cookie) | IKAT GmbH | Weist nach einer Bezahlung über Stripe Ihre Bestellung nach der Rückkehr von Stripe nach, ohne Sie anzumelden (signiert, für Skripte nicht auslesbar, enthält E-Mail-Adresse und Kennung der Stripe-Zahlung) | Essenziell | 6 Stunden |
| `gobd-intake-draft:<Kennung>` (Local Storage) | IKAT GmbH | Entwurf Ihrer Eingaben im Fragebogen, damit nichts verloren geht | Essenziell | 30 Tage; wird beim Abmelden gelöscht |
| `gobd-success-pending:<Checkout-Session>` (Session Storage) | IKAT GmbH | Merkt sich nach der Bezahlung den Beginn der Wartezeit, bis die Bestellung bestätigt ist | Essenziell | Ende der Browsersitzung |
| `gobd_ampel_shown:<Antworten>` (Session Storage) | IKAT GmbH | Merkt sich im Ampel-Check, dass Sie zu diesen Antworten den Bericht bereits angefordert haben, damit die Bestätigung auch nach dem Neuladen der Seite angezeigt wird. Der Eintrag bleibt in Ihrem Browser und wird nicht an uns übertragen | Essenziell | Ende der Browsersitzung |
| Vercel Web Analytics | Vercel Inc. | Zusammengefasste Statistik zu Seitenaufrufen, Referrer, Gerätetyp und Land | Kein Cookie, keine Einwilligung | keine Speicherung auf dem Endgerät |
| Stripe-Cookies bzw. -Speicher (z. B. `__stripe_mid`, `__stripe_sid`) | Stripe Payments Europe, Ltd. | Zahlungsabwicklung, Betrugsprävention; gesetzt auf der Domain von Stripe, nicht auf unserer Website | Essenziell für die Zahlung | typischerweise etwa 1 Jahr (`__stripe_mid`) bzw. 30 Minuten (`__stripe_sid`); genaue Laufzeit im Browser beim Checkout sichtbar |
| `_ga` | Google Ireland Ltd. | GA4: Unterscheidung von Besuchern | Marketing (nur nach Einwilligung) | typischerweise 2 Jahre; genaue Laufzeit im Browser nach Einwilligung sichtbar |
| `_ga_RJ4KLBP1SF` | Google Ireland Ltd. | GA4: Sitzungsstatus zur Mess-ID G-RJ4KLBP1SF | Marketing (nur nach Einwilligung) | typischerweise 2 Jahre; genaue Laufzeit im Browser nach Einwilligung sichtbar |
| `_gcl_au` | Google Ireland Ltd. | Google Ads: Zuordnung von Kaufabschlüssen und Ampel-Bericht-Anforderungen zu Anzeigen (Ads-ID AW-586367190) | Marketing (nur nach Einwilligung) | typischerweise 90 Tage; genaue Laufzeit im Browser nach Einwilligung sichtbar |
| `gobd_ads_purchase:<Checkout-Session>` (Local und Session Storage) | IKAT GmbH | Vermerkt, dass ein Kauf bereits als Conversion gemeldet wurde, damit er nicht doppelt gezählt wird | Marketing (nur nach Einwilligung) | 90 Tage |
| `gobd_kassen_check_submit` (Session Storage) | IKAT GmbH | Verhindert, dass das Absenden des Kassen-Checks in GA4 doppelt gezählt wird | Marketing (nur nach Einwilligung) | Ende der Browsersitzung |
| `_fbp` | Meta Platforms Ireland Ltd. | Meta Pixel: Browser-Kennung für Werbemessung, nur wenn eine Pixel-ID konfiguriert ist | Marketing (nur nach Einwilligung) | typischerweise 90 Tage; genaue Laufzeit im Browser nach Einwilligung sichtbar |
| `ds24c.v1` (Cookie) | Digistore24 GmbH | Affiliate-Zuordnung auf der Partnerseite (Affiliate-ID, Kampagne, UTM-Parameter) | Marketing (nur nach Einwilligung) | 7 Tage, wenn Digistore24 die Speicherung erlaubt; sonst Ende der Browsersitzung |
| `ds24p.v1` (Local Storage) | Digistore24 GmbH | Dieselben Zuordnungsdaten, nur wenn Digistore24 die Speicherung erlaubt | Marketing (nur nach Einwilligung) | bis zur Löschung im Browser |
| `ds24s.v1` (Session Storage) | Digistore24 GmbH | Dieselben Zuordnungsdaten für die laufende Sitzung | Marketing (nur nach Einwilligung) | Ende der Browsersitzung |

## Verwaltung / Ablehnung

Technisch notwendige Cookies können in der Regel nicht abgewählt werden, ohne Funktion oder Checkout zu beeinträchtigen. Marketing können Sie jederzeit über „Cookie-Einstellungen“ widerrufen. Die Ablehnung wird gespeichert; Marketing-Skripte werden danach nicht mehr geladen. Bereits gesetzte Marketing-Cookies (`_ga`, `_gcl_au`, `_fbp`, `ds24c.v1` und ähnliche) entfernt der Widerruf nicht automatisch. Sie können sie in den Einstellungen Ihres Browsers löschen.

## Weitere Informationen

Ausführliche Informationen: **Datenschutzerklärung**.  
Verantwortlicher: IKAT GmbH, Gartzenweg 1a, 40789 Monheim am Rhein  
Kontakt: **info@gobd-doku-erstellen.de**

**Stand:** Oktober 2026
