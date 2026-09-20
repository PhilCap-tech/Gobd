> **Entwurf / Template — keine Rechtsberatung.**  
> Vor Live-Schaltung Counsel-Review empfohlen.  
> Produkt: GoBD-Verfahrensdokumentation SaaS · Domain: gobd-doku-erstellen.de · Zahlung: Stripe Checkout · Hosting: Vercel · Betreiber: IKAT GmbH (B2B)

---
# Cookie- / Tracking-Hinweis

## Kurzfassung

Diese Website verwendet **technisch notwendige** Cookies bzw. vergleichbare Technologien, die für den Betrieb der Seite, Sicherheit und den **Stripe-Checkout** erforderlich sind.

Ein optionaler **Meta Pixel** (Meta Platforms) wird **nur geladen, wenn du im Cookie-Banner der Marketing-Kategorie zustimmst.** Lehnst du ab oder fehlt die Einwilligung, wird der Pixel nicht gesetzt. Stripe Checkout bleibt im Testmodus; über den Pixel werden **keine Purchase-Events** ausgelöst.

## Was sind Cookies?

Cookies sind kleine Textdateien, die auf deinem Endgerät gespeichert werden. Vergleichbare Technologien (z. B. Local Storage, Session Storage, Pixel) können ähnliche Funktionen erfüllen.

## Technisch notwendige Cookies / Speicherung

Wir setzen technisch notwendige Mittel ein, soweit erforderlich für:
- Bereitstellung und Stabilität der Website
- Sicherheitsfunktionen (z. B. Schutz vor Missbrauch)
- Durchführung des Bezahlvorgangs über **Stripe Checkout** (Stripe kann eigene Cookies/Technologien setzen)
- Magic-Link-Anmeldung und Zugriff auf gespeicherte Dokumente (`gobd_session`)
- Speicherung deiner Cookie-Auswahl (`gobd_consent`, Cookie und/oder Local Storage)

Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse am technischen Betrieb) bzw. § 25 Abs. 2 TTDSG (soweit Speicherung/Zugriff unbedingt erforderlich), sowie Art. 6 Abs. 1 lit. b DSGVO im Kontext der Zahlungsabwicklung.

## Stripe

Beim Start des Checkouts kann Stripe Cookies und ähnliche Technologien setzen. Details: https://stripe.com/privacy sowie Stripe-Cookie-Dokumentation.  
**TODO:** prüfen, welche konkreten Stripe-Cookies im Live-Checkout gesetzt werden, und Tabelle unten aktualisieren.

## Optionaler Meta Pixel

Wenn du **Marketing erlauben** wählst, laden wir den Meta Pixel (`connect.facebook.net`). Er erfasst Seitenaufrufe (PageView) sowie Readiness-Events (ReadinessStart, CompleteRegistration / ReadinessSubmit). Ohne Einwilligung oder ohne konfigurierte Pixel-ID wird das Skript nicht geladen.

Falls zusätzlich eine Google-Ads-Conversion-ID konfiguriert ist, kann bei ReadinessSubmit ein Conversion-Tag geladen werden — ebenfalls nur mit Marketing-Einwilligung.

**TODO:** Counsel-Review zu Meta Pixel / ggf. Google Ads (Drittlandtransfer, AVV) vor Go-Live.

## Hosting (Vercel)

Das Hosting kann technisch bedingte Verbindungsdaten und ggf. notwendige Speichervorgänge umfassen. Siehe Datenschutzerklärung (Hosting/Logs).

## Übersicht (Platzhalter — vor Go-Live befüllen)

| Name / Technologie | Anbieter | Zweck | Speicherdauer | Notwendigkeit |
|---|---|---|---|---|
| gobd_session | eigene Domain | Magic-Link-Anmeldung / Dokumentenzugang | 30 Tage | notwendig |
| gobd_consent | eigene Domain | Speicherung der Cookie-/Tracking-Auswahl | 180 Tage | notwendig |
| TODO | Stripe | Checkout / Betrugsprävention | TODO | notwendig |
| Meta Pixel (_fbp / _fbc) | Meta Platforms | Reichweiten- und Event-Messung (nur Readiness, kein Purchase) | laut Anbieter / bis Widerruf | optional, nur mit Einwilligung |

## Verwaltung / Ablehnung

Technisch notwendige Cookies können in der Regel nicht über ein Banner abgewählt werden, ohne die Funktion der Website bzw. des Checkouts zu beeinträchtigen. Marketing (Meta Pixel) kannst du über **Nur essenziell** ablehnen oder später unter **Cookie-Einstellungen** im Footer ändern. Die Auswahl speichern wir lokal (`gobd_consent`). Du kannst Cookies generell in deinem Browser löschen oder blockieren; dann funktionieren Teile der Website ggf. nicht.

## Weitere Informationen

Ausführliche Informationen zur Datenverarbeitung: siehe **Datenschutzerklärung**.  
Verantwortlicher: **IKAT GmbH**, Gartzenweg 1a, 40789 Monheim am Rhein  
Kontakt: **info@gobd-doku-erstellen.de**

**Stand:** TODO: Datum der Veröffentlichung
