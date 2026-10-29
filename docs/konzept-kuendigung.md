# Konzept: Kündigung, ZIP-Download, Wiederherstellung und Löschung

Stand 12.10.2026. Analyse gegen `main` `461339e` (nach `git fetch origin main`).
Dieses Dokument ist Analyse und Soll-Konzept. Es ändert keinen Produktcode und keine Rechtstexte.
Keine Rechtsberatung. Formulierungen für AGB, FAQ und Datenschutz sind Änderungsbedarf, keine fertigen Klauseln.

Produkt: GoBD Verfahrensdoku, IKAT GmbH, https://www.gobd-doku-erstellen.de.
Abo: einmalig 149 € Einrichtung plus 49 € pro Monat, erster Monat im Einstieg von 198 € enthalten (`lib/pricing.ts`: `SETUP_EUR`, `MONTHLY_EUR`, `TODAY_EUR`). Alle Beträge netto, zuzüglich Umsatzsteuer, wie in den AGB.

---

## Teil 1 — Ist-Analyse

### 1.1 Weg des Kunden ins Stripe-Portal

Es gibt im Konto keinen Button mit der Beschriftung „Kündigen“.

1. `/account` zeigt bei vorhandenem Stripe-Bezug die Karte `AccountAboCard` (`components/account-abo.tsx`). Der Link „Abo verwalten“ führt auf `/account/billing` (`accountBillingPath` in `lib/stripe.ts`).
2. `/account/billing` rendert `AccountBillingStatus` (`components/account-billing.tsx`). Der Button „Zahlungsmethode / Abo im Stripe-Portal öffnen“ sendet `POST /api/stripe/portal`.
3. `app/api/stripe/portal/route.ts` ruft `portalRedirectResponse` auf. Dieselbe Weiterleitung nutzen `GET` und `POST` sowie die Kurzwege `/portal` und `/billing` (`lib/portal.ts`, `resolvePortalRedirect`).
4. `createBillingPortalSession` (`lib/stripe.ts`) erzeugt eine Billing-Portal-Session mit `customer`, `locale: "de"` und `return_url` `{APP_URL}/account/billing?portal=returned`. Es wird kein `flow_data` mitgegeben. Die Session landet auf der Startseite des Portals, nicht auf einem Kündigungsdialog.
5. Ob das Portal die Kündigung anbietet, ob sie zum Periodenende oder sofort wirkt und ob Stripe dabei eine eigene E-Mail sendet, steht in der Portal-Konfiguration im Stripe-Dashboard. Im Repository liegt diese Konfiguration nicht. `README.md` (Abschnitt Customer Portal) beschreibt sie als „je nach Portal-Config“. **Unbekannt:** der konkrete Live- und Test-Zustand (Kündigung erlaubt, Zeitpunkt, Stripe-Mail).

`stripeBound` auf `/account` ist wahr, sobald `findLatestStripeCustomerIdByEmail` eine Kunden-ID findet oder eine Dokumentzeile `stripeCustomerId` oder `stripeSessionId` trägt (`app/account/page.tsx`). Eine Kündigung löscht diese IDs nicht. Die Abo-Karte bleibt deshalb stehen.

Rückkehr aus dem Portal zeigt auf `/account/billing` den Hinweis aus `portalStatusCopy("returned")`: „Zurück aus der Abo-Verwaltung. Änderungen (Zahlungsmittel, Kündigung) können kurz brauchen, bis sie sichtbar sind.“ Das ist ein allgemeiner Rückkehrtext. Er bestätigt keine Kündigung und nennt kein Datum. `/account` zeigt denselben Banner nur, wenn die Query `portal` gesetzt ist. Die `return_url` setzt sie auf `/account/billing`, nicht auf `/account`.

### 1.2 Webhooks

`POST /api/stripe/webhook` (`app/api/stripe/webhook/route.ts`) verarbeitet in `POST` nur:

| Event | Wirkung |
| --- | --- |
| `checkout.session.completed` | Zeile mit `status: "paid"` und `stripeCustomerId` über `appendRecord` / `toSheetRow`; danach `triggerOnboardingMail`. Idempotent über `findRowByStripeSessionId`. Die Subscription-ID der Session wird nicht gelesen. |
| `invoice.payment_failed` | `handleFailedPayment` (`lib/ops.ts`). |
| jeder andere Typ, darunter `customer.subscription.updated` und `customer.subscription.deleted` | `default: break`. Antwort danach `{ received: true }` mit Status 200. Kein Schreiben, keine Mail, keine Löschung. |

`README.md` nennt für den Dashboard-Endpoint nur `checkout.session.completed` und `invoice.payment_failed`. **Unbekannt:** ob der produktive Endpoint darüber hinaus abonniert ist. Trifft ein Abo-Event ein, verwirft ihn der Code. Fehlt das Abonnement im Dashboard, kommt das Event gar nicht an. In beiden Fällen ändert die Anwendung nichts.

Ein Fehler in den beiden bekannten Cases ruft `handleFailedJob` auf (Mail „Technisches Problem bei der Erstellung“ an die Kundenadresse, soweit eine E-Mail im Kontext liegt). Für die ignorierten Abo-Events gibt es diesen Pfad nicht, weil sie den `try`-Block ohne Ausnahme verlassen.

### 1.3 Wird eine Mail von info@ gesendet?

Bei der Kündigung: keine.

`sendEmail` (`lib/mail.ts`) setzt `from` auf `process.env.EMAIL_FROM`. Die Adresse `info@gobd-doku-erstellen.de` ist in `LEGAL_OPERATOR.email` (`lib/legal.ts`) und als `MAIL_SUPPORT_EMAIL` im Mail-Footer hinterlegt (`lib/mail-layout.ts`). Sie ist nicht der Absender im Code. `.env.example` lässt `EMAIL_FROM` leer. `README.md` nennt als Beispiel `GoBD Verfahrensdoku <noreply@deine-domain.de>`. **Unbekannt:** welcher Absender in Vercel produktiv gesetzt ist und ob Resend `info@gobd-doku-erstellen.de` als Absender freigegeben hat.

Vorhandene Kundenmails, alle über denselben Absender-Env, keine davon zur Kündigung:

| Funktion | Anlass | Betreff |
| --- | --- | --- |
| `triggerOnboardingMail` | `checkout.session.completed` | Onboarding (Kunde oder Steuerberater) |
| `handleFailedPayment` / `buildFailedPaymentMail` | `invoice.payment_failed` | „Zahlung fehlgeschlagen — bitte prüfen“ |
| `handleFailedJob` | Exception im Webhook | „Technisches Problem bei der Erstellung — wir kümmern uns“ |
| `sendDeliveryMail` | PDF-Lieferung | „Ihr Entwurf der Verfahrensdokumentation“ |
| `sendReferralAfterDeliveryMail` | nach Lieferung | Empfehlungslink |
| `sendMagicLinkMail` | Login | „Ihr Anmeldelink — GoBD Verfahrensdoku“ |
| `sendReadinessMail` | kostenloser Check | Readiness-Ergebnis |

`handleFailedPayment` sperrt das Konto nicht und kündigt nicht. Pilot-Adressen kann `isPilotPaymentFailedExempt` ausnehmen. Die AGB-Formulierung in § 4 Abs. 4 (Sperre nach Mahnung, Frist 14 Tage) hat im Code keine Entsprechung.

Stripe selbst kann bei einer Portal-Kündigung eine eigene Mail senden. **Unbekannt**, ob das im Dashboard an ist.

### 1.4 Was `/account` zeigt

`/account` (Titel „Meine Firmen“) zeigt den Abo-Status nicht.

Sichtbar, unabhängig von `cancel_at_period_end` und von `customer.subscription.deleted`:

- Name aus dem Profil und Login-E-Mail.
- Abo-Karte mit dem Satz, ein Abo gelte für bis zu `MAX_ENTITIES_PER_ACCOUNT` Firmen, plus Link „Abo verwalten“. Ohne Stripe-Bezug stattdessen die Upgrade-Karte.
- Block „Offener Entwurf“, wenn `listOpenDraftsForEmail` einen noch nicht gelieferten Entwurf findet (`lib/open-drafts.ts`, `isUndeliveredDraft`).
- Firmen, Stammdaten, Legacy-Bereiche, Gesamtdokumente.
- Je Familie: Vollständigkeit, offene Module, Badge und Gültigkeitszeitraum über `selectCurrentVersion` (`lib/versioning.ts`), `DocumentRevisionActions`, `VersionHistory`.
- Aktionen bleiben „PDF herunterladen“, „Angaben überarbeiten“, „Dokument bearbeiten“, „Neue PDF-Version erzeugen“ (`components/document-revision.tsx`).
- Abmelden über `POST /api/auth/logout`.

Der einzige Status, der ein Abo bewertet, liegt auf `/account/billing`. `loadCustomerBilling` liest `stripe.subscriptions.list({ customer, limit: 20 })` ohne `status`-Filter und `stripe.invoices.list`. `billingSubscriptionStatusFrom` kennt nur drei Werte:

- `past_due` oder `unpaid` → „Zahlungsrückstand“ / „Ihr Abo hat einen Zahlungsrückstand. Bitte Zahlungsmittel im Stripe-Portal prüfen.“
- sonst `active` oder `trialing` → „Aktiv“ / „Ihr Abo ist aktiv.“
- sonst → „Kein Abo“ / „Kein aktives Abo zu diesem Konto.“

`cancel_at_period_end`, `cancel_at`, `current_period_end` und Kündigungsgrund werden nicht gelesen. Ein Abo mit `cancel_at_period_end=true` bleibt bei Stripe im Status `active`, bis die Periode endet. Die Billing-Seite zeigt dann weiter „Aktiv“. Nach `customer.subscription.deleted` ist der Status `canceled`. Die Liste im Code übergibt kein `status: "all"` (anders als `listSubscriptions` im Admin-Wipe, `lib/admin-wipe-run.ts`). Nach der Stripe-API liefert `subscriptions.list` ohne `status` die nicht gekündigten Abos. **Nicht gegen ein Live-Konto geprüft.** Selbst wenn ein gekündigtes Abo in der Liste läge, mappt `billingSubscriptionStatusFrom` jeden Status außer `active`, `trialing`, `past_due` und `unpaid` auf `none`. Die Oberfläche zeigt dann „Kein Abo“, ohne Enddatum und ohne Hinweis auf gespeicherte Dokumente.

Rechnungen bleiben der Stripe-Invoice-API überlassen. Eine Kündigung löscht sie in dieser Anwendung nicht. Es gibt kein eigenes Rechnungsarchiv.

### 1.5 Entwürfe, PDFs, Versionen, Blob, Zugang

Eine Portal-Kündigung und die beiden Abo-Webhooks lassen alle folgenden Speicher unberührt. Es gibt keinen Cron (`vercel.json` enthält nur `buildCommand`). `deleteStoredBlob` (`lib/blob.ts`) hängt an Tests und am internen Blob-Smoke, nicht am Kunden-Webhook. `clearIntakeDraft` hängt an `DELETE /api/intake/draft` (Kunde löscht seinen Entwurf) und an Tests.

**Dokumentzeilen.** Jede Fassung ist eine Zeile `SheetRow` (`lib/types.ts`): `documentId`, `parentDocumentId`, `version`, `pdfUrl`, `validFrom`, `validTo`, `changeSummary`, `changedBy`, `chapterContent`, `fragen`, `email`, `stripeCustomerId`, `stripeSessionId`, `status`, `deliveryStatus`. `status` ist der Bestellstatus (`paid`), kein Abo-Lebenszyklus. Speicherort ist das Google Sheet der Intakes, ersatzweise eine Datei. Weitere Tabs: `entities`, `profiles`, `readiness_leads`.

**PDF.** `storePdf` schreibt privat nach `gobd/{familyId}/v{version}.pdf` (`allowOverwrite: true`). `pdfUrl` speichert den Pfad, keine öffentliche Blob-URL. Lesen nur mit Token über `loadDocumentPdf`. Download: `GET /api/docs/[id]/download`.

**Kapiteltext.** Passt der JSON in die Sheet-Zelle, liegt er in `chapterContent`. Darüber schreibt `persistChapterContent` nach `gobd/{familyId}/v{version}-chapters.json`.

**Antworten.** `intakeAnswersBlobPath` (`lib/intake-payload.ts`): `gobd/{familyId}/{documentId}/v{version}-answers.json`, wenn der Antwortblock nicht in der Zelle bleibt.

**Kunden-Uploads** (Modul „durch bestehende Dokumentation abgedeckt“). `storeCustomerUpload`: `gobd/uploads/{owner}/{modul}/{zeitstempel}-{dateiname}`, ohne Überschreiben.

**Entwürfe.** `saveIntakeDraft`: `gobd/drafts/{sha256-prefix}.json`, ein Objekt pro `draftKey`, wird überschrieben (`lib/draft-path.ts`, `lib/intake-draft.ts`). Index der offenen Entwürfe: `gobd/draft-index/{emailHash}.json` (`lib/open-drafts.ts`). Zusätzlich `localStorage`-Schlüssel `gobd-intake-draft:{draftKey|session|neu}` in `app/intake/intake-form.tsx`. Den Browser-Speicher erreicht ein Webhook nicht.

**Zugang und Auth.**

- Magic Link 20 Minuten, Session-Cookie `gobd_session` 30 Tage (`MAGIC_TTL_MS`, `SESSION_TTL_MS` in `lib/auth.ts`). `getSessionEmail` prüft Signatur und Ablauf, nicht das Abo.
- `canAccessDocument` (`lib/documents.ts`): gleiche E-Mail oder gleiche Checkout-Session-ID. Kein Abo-Status.
- `authorizeDeliveredWrite` (`lib/session-write.ts`): nach der ersten Lieferung nur die Login-Mail des Dokuments. Kein Abo-Status.
- `authorizeDraftAccess` (`lib/checkout-access.ts`): Login-Mail des Owners oder eine bei Stripe bezahlte Checkout-Session. Die historische Zahlung bleibt ein Nachweis. Ein später gelöschtes Abo widerruft sie nicht.
- Neue PDF-Versionen, Intake, Dokumenteditor, Modul-Uploads und Einzeldownloads laufen über diese Prüfungen. Sie bleiben nach einer Kündigung bedienbar, solange Login und Zeilen existieren.
- Der Checkout (`createCheckoutSession`) übergibt `customer_email`, keine bestehende `customer`-ID. Ein späteres neues Abo kann bei Stripe einen zweiten Kunden anlegen. **Unbekannt:** ob das Dashboard „bestehenden Kunden per E-Mail wiederverwenden“ erzwingt.

**Admin-Wipe** (`app/api/admin/wipe-account`, `lib/admin-wipe.ts`) ist ein separater, token- und allowlist-geschützter Weg für Testadressen. Er löscht Sheet-Zeilen, Blobs und kann Stripe-Abos sofort kündigen sowie Stripe-Kunden löschen. Eine Kundenkündigung ruft ihn nicht auf. Ein späterer Löschjob darf diesen Weg nicht wiederverwenden, weil die Löschung des Stripe-Kunden die Rechnungen träfe.

**Erstes PDF für die Garantie.** Erzeugung heißt: Intake schreibt eine Zeile mit `documentId` und gespeichertem PDF (`app/api/intake/route.ts`). Ein Download-Protokoll gibt es nicht. Ob jemand die Datei abgerufen hat, ist im Code nicht feststellbar. Die Garantie selbst ist ein manueller E-Mail-Weg an info@ (AGB § 9, FAQ Abschnitt 6). Kein Button, kein Refund-Webhook.

### 1.6 Unbekanntes, gesammelt

- Portal-Konfiguration Live/Test: Kündigung ja/nein, zum Periodenende oder sofort, Stripe-eigene Mail.
- Produktiver Wert von `EMAIL_FROM` und die Resend-Freigabe für info@.
- Ob der Webhook-Endpoint die Abo-Events überhaupt empfängt.
- Ob Checkout einen zweiten `cus_` anlegt.
- Ob Kunden die PDFs heruntergeladen haben.
- Ob über der Liste von 20 Subscriptions je Kunde hinaus weitere Abos existieren (`limit: 20`). Für das heutige eine Abo je Konto ist das praktisch leer; der Code deckt es nicht ab.
- Lage von `current_period_end` in den Typen von `stripe` ^18 (Paket ist im Repo ab `package.json` referenziert). Der Code liest das Feld nicht. Bei der Umsetzung gegen die installierten SDK-Typen prüfen; je API-Version liegt das Periodenende am Abo oder am Subscription-Item.

---

## Teil 2 — Soll-Konzept

### 2.1 Zielbild

Die Kündigung bleibt eine Kündigung zum Ende des bezahlten Zeitraums und läuft weiterhin im Stripe-Portal zu Ende. Davor steht eine eigene Seite. Bis zum Periodenende bleibt der bezahlte Umfang einschließlich Pflege, neuer Versionen und Downloads. Danach 14 Tage Wiederherstellung durch ein neues Abo, dann Löschung. Der Kunde wird per Mail von info@ bestätigt und vor der Löschung erinnert. Die zehnjährige Aufbewahrung seiner Unterlagen bleibt seine Pflicht, nicht unsere Archivleistung.

Phasen je Abonnement:

| Phase | Auslöser | Konto | Pflege und neue Versionen | PDF-Download im Konto | Daten |
| --- | --- | --- | --- | --- | --- |
| `active` | Zahlung, oder Reaktivierung vor Periodenende | „Aktiv“ | ja | ja | bleiben |
| `cancel_scheduled` | `customer.subscription.updated` mit `cancel_at_period_end=true`, Status weiter `active` | „gekündigt zum {Periodenende}“ | ja, bis zum Periodenende | ja, bis zum Periodenende | bleiben |
| `restore` | `customer.subscription.deleted` | „beendet am {Ende}. Wiederherstellung bis {Ende+14 Tage}“ | nein | nein | bleiben, kein stiller Download |
| `purged` | Cron nach `purge_at` | leeres Konto, Checkout möglich | nein | nein | Vertragsdaten gelöscht |

„Online-Pflege und Versionierung entfallen“ ist die Ansage auf der Warnseite für den Zustand ab Periodenende. Sie schaltet die Funktionen nicht schon am Tag der Kündigung ab. Bis `period_end` ist der Monat bezahlt; AGB § 12 Abs. 4 Satz 1 sichert für die Laufzeit Zugang zu früheren Fassungen und späteren Anpassungen. Diesen Satz erfüllt die Phase `cancel_scheduled`.

### 2.2 Warnseite, ZIP, dann Portal

Neue Seite, Vorschlag `/account/kuendigung`, nur mit Session. Sie ist der Weg „Kündigen“.

Inhalt, formal Sie:

- Überschrift sinngemäß: Kündigung zum Ende des bezahlten Zeitraums.
- Kernsatz: **Online-Pflege und Versionierung entfallen** mit dem Periodenende. Bis dahin bleiben Konto, Entwürfe und PDF-Versionen nutzbar.
- Datum aus der Lifecycle-Zeile (`period_end`), sobald bekannt. Vor dem ersten Stripe-Lesen: Datum nach Laden der Subscription nachziehen, die Seite nicht mit einem leeren Datum zum Portal schicken.
- Hinweis Aufbewahrung, Wortlaut in Abschnitt 2.8, auf der Seite sichtbar, nicht nur in der Mail.
- Hinweis Garantie: Diese Seite kündigt das Abo. Sie erstattet nicht. Die 14-Tage-Zufriedenheitsgarantie läuft weiter nur per E-Mail an info@, Regeln in den AGB. Volle Erstattung der bis dahin gezahlten Vergütung nur, solange noch kein PDF erzeugt wurde. Danach nur das monatliche Nutzungsentgelt, die Einrichtung nicht.
- Button **„Alle PDF-Versionen als ZIP herunterladen“**.
- Erst danach die Weiterleitung ins Stripe-Portal.

Ablauf des ZIP, weil ein sofortiger Redirect den Download im Browser abbricht:

1. Der ZIP-Button erzeugt das Archiv und liefert es aus (`Content-Disposition: attachment`). Die Seite bleibt.
2. Nach erfolgreicher Antwort, oder wenn es keine PDF-Version gibt, wird der zweite Button aktiv: „Weiter zur Kündigung im Stripe-Portal“.
3. Dieser zweite Button erzeugt die Portal-Session und redirectet.
4. Schlägt das ZIP fehl, gibt es keinen Redirect. Der Kunde sieht den Fehler und kann es wiederholen. Ein zusätzlicher Satz „Trotzdem zum Stripe-Portal“ bleibt erreichbar, damit ein Blob-Fehler die Kündigung nicht sperrt. Die AGB lassen die Kündigung auch in Textform an info@ zu; die Seite darf sie nicht hinter einem Download verstecken.

ZIP-Inhalt: jede gespeicherte PDF-Version aller Familien dieser Login-Mail, Dateiname aus `pdfDownloadName` plus Version und Firma, dazu eine einfache Inhaltsliste (Firma, Version, Gültig-von, Dokument-ID). Keine Kapitel-JSON, keine Antwort-JSON, keine fremden Uploads, es sei denn der Upload ist die vom Kunden selbst hochgeladene Datei zu einem Modul; die gehört in das ZIP, weil sie Teil seiner Unterlagen ist. Erzeugung serverseitig aus den privaten Blobs (`loadDocumentPdf`, `readCustomerUpload`), nur nach `canAccessDocument` für die Session-Mail. Kein öffentlicher Blob-Link. Timeout und Größe als Risiko in Teil 4; bei vielen Versionen streamen, nicht im Speicher sammeln.

Portal-Session für diesen zweiten Button: `billingPortal.sessions.create` mit `flow_data.type = subscription_cancel` und der Subscription-ID, `locale: "de"`, `return_url` weiter `/account/billing?portal=returned`. So landet der Kunde im Kündigungsdialog. Voraussetzung im Dashboard: Kündigung **zum Periodenende**, nicht sofort. Steht das Dashboard auf Sofortkündigung, ist das Datum „gekündigt zum …“ falsch; dann gilt die Phase `restore` ab dem Lösch-Event, und die Bestätigungsmail nennt das tatsächliche Ende. Das ist vor dem ersten produktiven Einsatz im Dashboard zu prüfen und festzuhalten.

Daneben bleibt ein Button „Zahlungsmittel und Rechnungen“ auf `/account/billing`, der das Portal **ohne** `subscription_cancel` öffnet. Im Portal kann der Kunde die Kündigung dennoch anwählen und die Warnseite umgehen. Diesen Restweg schließt der Webhook: die Bestätigungsmail geht auch dann hinaus, das ZIP war dann nur auf der Warnseite angeboten. `/portal` und `/billing` führen für eine Kündigung auf die Warnseite, sobald ein kündbares Abo existiert. Fehlt es, bleibt das heutige Verhalten (`portal=missing` und Verwandte).

### 2.3 Daten- und Zustandsmodell

Neue Sheet-Tabelle `subscription_lifecycle`, eine Zeile je Paar E-Mail und `stripe_subscription_id`. Ein Sheet ist für Support lesbar; die bestehenden Tabs folgen demselben Muster (`lib/store.ts`). Blob-JSON wäre für einen Cron ebenfalls möglich und ist die schlechtere Wahl, solange Ops die Daten in der Tabelle erwarten.

| Spalte | Inhalt |
| --- | --- |
| `email` | Login- und Checkout-Mail, kleingeschrieben |
| `stripe_customer_id` | `cus_…` |
| `stripe_subscription_id` | `sub_…` |
| `phase` | `active`, `cancel_scheduled`, `restore`, `purged` |
| `cancel_at_period_end` | `true` / `false` |
| `period_end` | ISO-Zeitpunkt des Periodenendes aus der Subscription |
| `ended_at` | Zeitpunkt von `customer.subscription.deleted`, leer davor |
| `restore_until` | `ended_at` plus 14 Tage, leer davor |
| `purge_at` | gleich `restore_until` |
| `end_reason` | `customer_cancel`, `payment_failed`, `refund`, `other`, leer solange aktiv |
| `confirm_mail_at` | Zeitpunkt der Bestätigungsmail |
| `reminder_mail_at` | Zeitpunkt der Erinnerung |
| `reactivated_at` | letzte Rücknahme vor Periodenende |
| `last_event_id` | letzte verarbeitete Stripe-Event-ID |
| `updated_at` | Schreibzeit |

Konto-Anzeige bei mehreren Zeilen derselben Mail: ein Abo in `active` ohne Kündigungsflag gewinnt. Sonst die `cancel_scheduled`-Zeile mit dem frühesten `period_end`. Sonst `restore` mit dem spätesten `restore_until`. `purged` allein zeigt das leere Konto. `past_due` / `unpaid` bleibt ein zusätzliches Warnbanner und überschreibt die Phase nicht.

`checkout.session.completed` schreibt die Zeile mit, sobald `session.subscription` vorhanden ist: Phase `active`, Customer, Subscription, `period_end` per Retrieve. Die heutige Order-Zeile (`status=paid`) bleibt. Sie wird nicht zum Lebenszyklus umgedeutet.

Idempotenz: gleiche `event.id` noch einmal ist ein No-Op. Mail-Versand zusätzlich mit Resend-Idempotency-Key `kuendigung-{subscriptionId}-{periodEnd}` bzw. `erinnerung-{subscriptionId}-{purgeAt}`.

### 2.4 Webhooks

Zusätzlich zu den heutigen Cases, und im Stripe-Dashboard zu abonnieren:

**`customer.subscription.updated`**

- `cancel_at_period_end` wechselt auf `true`, Status ist noch nicht `canceled`: Phase `cancel_scheduled`, `period_end` setzen, `end_reason=customer_cancel`, Bestätigungsmail genau einmal.
- `cancel_at_period_end` wechselt auf `false`, bevor `deleted` kam (Reaktivierung im Portal): Phase `active`, `confirm_mail_at` behalten als Historie, `reactivated_at` setzen, Mail „Kündigung aufgehoben“. Keine Löschung, `purge_at` leeren.
- Status `past_due` oder `unpaid`: Phase unberührt lassen. Die bestehende Mail `buildFailedPaymentMail` bleibt der Zahlungsweg. Kein Start von `restore`.
- `last_event_id` immer setzen.

**`customer.subscription.deleted`**

- Phase `restore`, `ended_at` aus dem Event, `restore_until` und `purge_at` = `ended_at` + 14 Tage.
- `end_reason`: `payment_failed`, wenn `cancellation_details.reason` auf fehlende Zahlung zeigt; `customer_cancel`, wenn zuvor `cancel_scheduled` oder der Grund die Kundenkündigung ist; sonst `other`. Ein Refund-Grund wird gesetzt, wenn derselbe Kunde in den letzten 14 Tagen ein `charge.refunded` hatte (siehe Randfälle) oder der Grund explizit eine Erstattung ist.
- Keine Blob-Löschung in der Request. Nur die Zeile und, falls noch keine Bestätigung herausging (Sofortende), eine Mail mit dem tatsächlichen Enddatum und dem Wiederherstellungsdatum.
- Zugriff ab diesem Event nach der Tabelle in 2.1 sperren. Dafür müssen `canAccessDocument` (Download), `authorizeDeliveredWrite`, Intake, Editor und Upload die Phase lesen. Eine bezahlte Checkout-Session allein darf nach `ended_at` kein PDF mehr ausliefern.

**`checkout.session.completed` (Erweiterung)**

- Subscription-ID speichern, Lifecycle auf `active`.
- Liegt dieselbe Mail in `restore` und `purge_at` ist noch nicht erreicht: Phase `active`, `purge_at` leeren, Dokumente, Entwürfe und Blobs unverändert lassen. Das ist die Wiederherstellung.
- Liegt die Mail in `purged`: normales neues Abo, Daten bleiben gelöscht.
- Checkout übergibt die bekannte `customer`-ID, wenn die Lifecycle-Zeile oder die Sheet-Zeilen eine haben, statt nur `customer_email`. So bleibt es ein Stripe-Kunde.

**Nicht auslösen**

- `invoice.payment_failed` startet keine Frist.
- `customer.subscription.deleted` löscht nichts synchron.

Optional später, für den Erstattungsgrund: `charge.refunded`. Ohne dieses Event bleibt `end_reason=refund` eine manuelle Setzung durch Ops. Das ist für die erste Scheibe tragfähig, weil die Garantie heute schon manuell ist.

### 2.5 Jobs

Ein täglicher Cron. `vercel.json` hat heute keinen. Vorschlag: `GET /api/cron/lifecycle`, geschützt durch `CRON_SECRET`, analog zur üblichen Vercel-Cron-Absicherung. Kein Kunden-Cookie.

Zwei Läufe über Zeilen mit Phase `restore`:

1. Erinnerung, wenn `reminder_mail_at` leer ist und `now` mindestens 3 Tage vor `purge_at` liegt (oder sofort, wenn zwischen `ended_at` und `purge_at` weniger als 3 Tage liegen — bei 14 Tagen der Normalfall ist der dritte Tag vor dem Ende). Eine Mail, dann `reminder_mail_at` setzen. Wiederholung derselben Zeile sendet nicht noch einmal.
2. Löschung, wenn `now >= purge_at` und keine Zeile derselben Mail in `active` oder `cancel_scheduled` liegt. Dann Vertragsdaten dieser Mail entfernen und Phase `purged` setzen. Eine zweite Mail nach der Löschung ist nicht vorgesehen; die Erinnerung ist die letzte.

Löschumfang, an das Inventar des Admin-Wipe angelehnt, ohne dessen Stripe-Kunden-Löschung und ohne dessen Allowlist:

- Intake-Zeilen dieser Mail (Dokumentfamilien).
- Entwurfs-Blobs aus dem Draft-Index und den bekannten `draftKey`s, danach `gobd/draft-index/{hash}.json`.
- Blobs unter `gobd/{familyId}/` (PDF, Kapitel, Antworten).
- Uploads unter `gobd/uploads/{owner}/` nur für den Owner-Schlüssel dieser Mail, nie den Sammelordner `anon` (`lib/upload-path.ts`).
- Entity-Stammdaten dieser Mail.
- Lokale Datei-Fallbacks derselben Pfade, soweit der Prozess sie sieht. Auf Vercel ist das Dateisystem flüchtig; der dauerhafte Ort ist Blob plus Sheet.

Stehen lassen:

- Stripe-Kunde, Subscription-Historie, Invoices, Payment Methods. Das sind unsere Rechnungsunterlagen.
- Profilzeile (Name, E-Mail), damit Login und ein neues Abo eine Adresse haben. Auf Wunsch der betroffenen Person Löschung über den bestehenden Datenschutzkontakt, nicht automatisch mit dem Abo.
- `readiness_leads`. Der kostenlose Check hat einen eigenen Zweck (Datenschutz, Abschnitt zum Check). Ihn nicht mit der Abo-Löschung vermengen.
- Lifecycle-Zeile selbst, Phase `purged`, als Nachweis des Zeitpunkts. Ohne Dokumentinhalte.

`localStorage` im Browser bleibt. Die nächste Intake-Sitzung darf einen lokalen Entwurf nicht wieder zum Server hochladen, wenn die Phase `purged` ist und der Entwurf älter als die Löschung ist. Dafür reicht ein Vergleich von `updatedAt` des Entwurfs mit `purge_at` beim nächsten `PUT /api/intake/draft`.

Vor dem Löschen eines Kontos mit einer zweiten, noch laufenden Subscription derselben Mail abbrechen und nur die beendete Subscription-Zeile auf `purged` setzen, ohne Blobs zu löschen. Ein Abo gilt für bis zu fünf Firmen; die Daten hängen an der Mail, nicht an der einzelnen `sub_`.

Der Job ist idempotent: fehlende Blobs sind Erfolg (`deleteStoredBlob` behandelt `BlobNotFoundError` bereits so). Sheet-Löschung über denselben Stil wie der Admin-Wipe (Zeile leeren oder entfernen), nicht über ein zweites Datenmodell.

### 2.6 Konto

`/account` und `/account/billing` lesen die Lifecycle-Zeile.

- `cancel_scheduled`: Statuszeile **„gekündigt zum {Datum}“**, Datum deutsch aus `period_end`. Downloads, Versionshistorie, „Neue PDF-Version erzeugen“, offene Entwürfe und „Weiter ausfüllen“ bleiben. Kurzer Satz: Pflege und neue Versionen enden an diesem Datum; bitte bis dahin herunterladen. Link zur ZIP-Seite bleibt verfügbar.
- `restore`: Statuszeile **„Abo beendet am {Datum}. Wiederherstellung durch ein neues Abo bis {Datum}.“** Download-Links und Schreibaktionen entfallen. Sichtbar bleiben Firmenname und die Tatsache, dass Fassungen noch wiederherstellbar sind, ohne die Dateien auszuliefern. Button zum Checkout, der die bestehende `customer`-ID nutzt.
- `active` mit `past_due`: heutiger Text „Zahlungsrückstand“ zusätzlich, Phase bleibt.
- Nach `purged`: heutiger Leerzustand plus Checkout. Kein „gekündigt zum“.

`billingSubscriptionStatusFrom` allein reicht nicht mehr. Die Billing-Seite zeigt den Stripe-Status und die Phase. „Aktiv“ bei gesetztem `cancel_at_period_end` wird durch „gekündigt zum …“ ersetzt.

### 2.7 Mails

Absender: `GoBD Verfahrensdoku <info@gobd-doku-erstellen.de>` über `EMAIL_FROM`, sobald Resend diese Adresse freigibt. Bis dahin ist info@ nur Kontakt im Footer; das ist für dieses Soll zu ändern. Versand weiter über `sendEmail` und `wrapTransactionalHtml` / `wrapTransactionalText`. Anrede Sie. Gruß in allen drei Texten: **Ihr Team von GoBD Verfahrensdoku**. Der bestehende Footer (Impressum, FAQ, Datenschutz, Kontakt info@, Anschrift) bleibt und steht unter dem Gruß.

Platzhalter in geschweiften Klammern sind zur Laufzeit zu ersetzen. Datumsformat `TT.MM.JJJJ` in der Zeitzone Europe/Berlin.

**Bestätigung bei Kündigung zum Periodenende**

Betreff: Ihre Kündigung — das Abo endet am {Periodenende}

```
Guten Tag,

Sie haben das Abonnement für GoBD Verfahrensdoku gekündigt. Das Abo läuft bis zum {Periodenende}, dem Ende des bereits bezahlten Zeitraums. Bis dahin bleiben Ihre Firmen, Entwürfe und PDF-Versionen in Ihrem Konto verfügbar, einschließlich Download und weiterer Versionen.

Mit diesem Datum entfallen Online-Pflege und Versionierung. Bitte laden Sie die PDF-Versionen bis dahin herunter. In Ihrem Konto können Sie dazu alle PDF-Versionen als ZIP herunterladen:
{Konto-URL}

Die Aufbewahrung steuerlich relevanter Unterlagen ist Ihre Pflicht. Für Bücher und Aufzeichnungen gelten in der Regel zehn Jahre (§ 147 AO). Wir führen kein Archiv für Sie. Mit der späteren Löschung bei uns ist Ihre Aufbewahrung nicht erfüllt.

Nach dem {Periodenende} halten wir die bei uns gespeicherten Entwürfe und Dokumente noch 14 Tage vor. In dieser Frist stellen Sie den Zugang wieder her, indem Sie ein neues Abonnement abschließen. Danach löschen wir diese Daten. Vor der Löschung erhalten Sie eine Erinnerung.

Die Kündigung ist keine Erstattung. Die 14-Tage-Zufriedenheitsgarantie beantragen Sie gesondert per E-Mail an info@gobd-doku-erstellen.de.

Ihr Konto: {Konto-URL}

Ihr Team von GoBD Verfahrensdoku
```

**Erinnerung vor der Löschung**

Betreff: Erinnerung — Löschung Ihrer Dokumentation am {Löschdatum}

```
Guten Tag,

Ihr Abonnement für GoBD Verfahrensdoku ist am {Ende} ausgelaufen. Wir löschen die bei uns gespeicherten Entwürfe, PDF-Versionen und hochgeladenen Dateien am {Löschdatum}.

Bis zu diesem Datum stellen Sie den Zugang wieder her, indem Sie ein neues Abonnement abschließen:
{Checkout-URL}

Eine Wiederherstellung nach diesem Datum ist nicht mehr möglich. Bitte denken Sie an Ihre eigene Aufbewahrung. Für Bücher und Aufzeichnungen gelten in der Regel zehn Jahre (§ 147 AO). Die Löschung bei uns ersetzt diese Pflicht nicht.

Ihr Team von GoBD Verfahrensdoku
```

**Kündigung vor Periodenende zurückgenommen**

Betreff: Ihre Kündigung ist aufgehoben

```
Guten Tag,

die Kündigung Ihres Abonnements für GoBD Verfahrensdoku ist aufgehoben. Das Abo läuft weiter. Online-Pflege und Versionierung bleiben verfügbar.

Ihr Konto: {Konto-URL}

Ihr Team von GoBD Verfahrensdoku
```

**Abo sofort beendet** (Zahlung endgültig gescheitert, Sofortkündigung im Portal oder Erstattung mit beendetem Abo). Nur wenn keine Bestätigung zum Periodenende schon denselben Endzustand beschrieben hat.

Betreff: Ihr Abo ist beendet

```
Guten Tag,

Ihr Abonnement für GoBD Verfahrensdoku ist am {Ende} beendet. Online-Pflege und Versionierung stehen nicht mehr zur Verfügung.

Wir halten die bei uns gespeicherten Entwürfe und Dokumente bis zum {Löschdatum} vor. Bis dahin stellen Sie den Zugang mit einem neuen Abonnement wieder her:
{Checkout-URL}

Danach löschen wir diese Daten. Eine Erinnerung senden wir vor der Löschung. Die Aufbewahrung Ihrer Unterlagen bleibt Ihre Pflicht, in der Regel zehn Jahre (§ 147 AO).

Ihr Team von GoBD Verfahrensdoku
```

Bei `end_reason=payment_failed` den ersten Satz ersetzen durch: „Ihr Abonnement für GoBD Verfahrensdoku ist am {Ende} beendet, weil die Zahlung nicht abgeschlossen werden konnte.“ Die schon vorhandene Mail „Zahlung fehlgeschlagen — bitte prüfen“ bleibt die frühe Mahnung und wird nicht ersetzt.

### 2.8 Hinweis zur zehnjährigen Aufbewahrung

Auf der Warnseite, in der Bestätigung und in der Erinnerung, jeweils sichtbar:

Der Kunde bewahrt seine Verfahrensdokumentation und die zugehörigen Unterlagen selbst auf. § 147 AO legt die Frist für Bücher und Aufzeichnungen beim Steuerpflichtigen an, regelmäßig zehn Jahre. Die Leistung von IKAT GmbH ist der Entwurf und, solange das Abo läuft, die Pflege. Sie ist nicht die Erfüllung dieser Frist. Nach der Löschung bei uns ist eine Fassung nur noch dort, wo der Kunde sie gespeichert hat.

Unsere eigenen Rechnungen und Zahlungsnachweise bleiben bei Stripe und in der Buchhaltung, im Rahmen der handels- und steuerrechtlichen Fristen des Anbieters. Sie werden mit der Kundenlöschung nicht gelöscht. Die Verfahrensdokumentation des Kunden gehört nicht in diese Frist.

### 2.9 Randfälle

**Reaktivierung vor Periodenende.** Im Portal nimmt der Kunde die Kündigung zurück. Stripe sendet `customer.subscription.updated` mit `cancel_at_period_end=false`. Phase zurück auf `active`, Mail aus Abschnitt 2.7, keine Löschfrist. Kommt das Event doppelt, verhindert `last_event_id` und der Idempotency-Key der Mail einen zweiten Versand. Eine Reaktivierung nach `customer.subscription.deleted` ist ein neues Abo und fällt unter die Wiederherstellung, nicht unter diese Rücknahme.

**Fehlgeschlagene Zahlung.** `invoice.payment_failed` bleibt Mail plus Banner „Zahlungsrückstand“. Zugriff und Daten bleiben, solange Stripe das Abo nicht löscht. Die 14-Tage-Sperre aus AGB § 4 Abs. 4 ist weiterhin nicht gebaut und ist nicht die 14-Tage-Wiederherstellung. Erst `customer.subscription.deleted` nach ausgeschöpfter Zahlungskette startet `restore` mit `end_reason=payment_failed` und der Mail „sofort beendet“. Ein gleichzeitiges `cancel_at_period_end` bleibt bestehen, bis das Lösch-Event kommt; die Bestätigungsmail der Kundenkündigung wird nicht ein zweites Mal gesendet. **Unbekannt bis zur Dashboard-Prüfung:** nach wie vielen Versuchen Stripe selbst kündigt. Der Code verlässt sich auf das Lösch-Event, nicht auf einen eigenen Zähler.

**Erstattung innerhalb der Garantie.** Weiter nur per E-Mail an info@ innerhalb von 14 Tagen ab Vertragsschluss. Kein Button. Die Warnseite spricht die Garantie ausdrücklich als anderen Weg an.

- Noch kein PDF erzeugt (keine Dokumentzeile mit gespeichertem PDF zu dieser Mail): Erstattung der gesamten bis dahin gezahlten Vergütung. Das sind 198 € nur, wenn genau Einrichtung und erster Monat gebucht wurden. Liefen schon weitere Monate, ist es die Summe der gezahlten Beträge, so die AGB § 9 Abs. 2. Das Abo endet mit der Erstattung. Ops erstattet in Stripe und beendet das Abo. Das Lösch-Event startet die 14-Tage-Frist. Entwürfe ohne PDF fallen in dieselbe Löschung. Ein Sofort-Purge ist nicht nötig und würde die Erinnerung unterlaufen.
- PDF bereits erzeugt oder, nach AGB, heruntergeladen: Erstattung nur des gezahlten Monatsbeitrags (49 € netto). Die Einrichtung (149 € netto) bleibt, weil die Leistung erbracht ist. Download-Protokoll fehlt; Ops entscheidet „heruntergeladen“ außerhalb des Codes. Die Daten durchlaufen dieselbe Frist, damit der Kunde die bezahlte Einrichtung noch über ein neues Abo erreichen oder vor Periodenende geladen haben kann. Die Bestätigungsmail bei einer früheren Kündigung hat den Download genannt. Liegt die Erstattung nach dem Periodenende, ist der Download im Soll geschlossen; Ops legt der Erstattungsmail dann das ZIP bei. Das ist ein manueller Schritt, kein zweiter Automatismus.
- Portal-Kündigung innerhalb der 14 Garantietage erstattet nicht von selbst. Wer nur kündigt, zahlt den laufenden Zeitraum zu Ende und behält die Daten bis `purge_at`.
- `charge.refunded` ohne beendetes Abo ändert die Phase nicht. Erst das Ende des Abos startet die Frist. So bleibt eine teilweise Korrektur einer Rechnung ohne Löschuhr.

**Wiederherstellung.** Neues Abo derselben Mail vor `purge_at` setzt Phase `active` und hebt die Sperre auf. Dateien wurden nicht verschoben. Nach `purge_at` ist der Checkout ein leeres Konto.

**Kündigung in Textform an info@.** Bleibt Ops: im Stripe-Portal oder per API `cancel_at_period_end` setzen. Dieselbe Webhook-Kette, dieselbe Mail. Kein zweites Formular in der ersten Ausbaustufe.

**Kein PDF.** ZIP-Button meldet „Es liegen noch keine PDF-Versionen vor.“ und gibt den Portal-Button frei.

**Zweiter Stripe-Kunde.** Checkout muss die vorhandene `cus_` wiederverwenden. Sonst hängt die neue Subscription an einer anderen ID, der Webhook findet die `restore`-Zeile nur über die E-Mail. Die E-Mail ist der Schlüssel, die Customer-ID der Soll-Weg.

---

## Teil 3 — Abgleich mit den AGB

Quelle: `content/legal/agb.md`, Stand 05.10.2026, Kopfzeile „Interner Entwurf · Keine Rechtsberatung“. Ergänzend FAQ `content/faq.md` Abschnitt 3 und 6, Datenschutz `content/legal/datenschutz.md` (Zeilen zum Fragebogen und zur Löschung). Rechtstexte sind in diesem Auftrag nicht geändert.

### 3.1 § 12 Laufzeit, Verlängerung und Kündigung

§ 12 Abs. 1: unbestimmte Zeit, monatliche Fortsetzung. Das Soll ändert daran nichts.

§ 12 Abs. 2: Kündigung jederzeit zum Ende des laufenden Abrechnungsmonats, im Konto unter „Konto → Abo → Kündigen“ oder per Textform an info@. Heute heißt der Weg „Abo verwalten“ und dann „Zahlungsmethode / Abo im Stripe-Portal öffnen“. Das Soll führt eine echte Kündigungsseite ein und danach das Portal mit Kündigung zum Periodenende. Textform bleibt. **Nötige Textänderung:** den Pfad so benennen, wie die Oberfläche ihn nach dem Umbau wirklich heißt. Den Satz nur veröffentlichen, wenn das Dashboard die Kündigung zum Periodenende erzwingt. Eine Sofortkündigung im Portal widerspricht Abs. 2.

§ 12 Abs. 3: außerordentliche Kündigung bleibt. Das Soll fasst Zahlungsabbruch und Erstattung als Ende mit eigener Mail, ohne das Recht zu beschneiden.

§ 12 Abs. 4, drei Sätze:

1. Während der Laufzeit Zugang zu früheren Fassungen und späteren Anpassungen. Das Soll hält das bis `period_end` aufrecht. Kein Konflikt, solange die Funktionen nicht schon bei der Kündigungsmail abgeschaltet werden.
2. Nach Vertragsende noch 30 Tage Download, danach Löschung, soweit keine gesetzlichen Aufbewahrungspflichten entgegenstehen. **Konflikt.** Das Soll lässt den Download nur bis zum Periodenende zu (das ist noch Laufzeit, nicht „nach Vertragsende“) und hält die Daten danach 14 Tage ohne Download nur für eine Wiederherstellung durch ein neues Abo. Das ist kürzer als 30 Tage und ein anderer Inhalt als ein Downloadrecht. FAQ Abschnitt 3 wiederholt die 30 Tage wörtlich in der Sache. Datenschutz sagt denselben Satz („Nach Vertragsende kannst du bereits erzeugte PDFs noch 30 Tage herunterladen“) und verweist in der Löschübersicht auf diese 30 Tage.
3. Ohne aktives Abo bleibt die gelieferte Fassung auf dem Stand der Erstellung. Das beschreibt den Stopp der Pflege und passt zur Phase `restore`. Es verspricht keine fortlaufende Bearbeitung. Kein Konflikt mit dem Stopp der Versionierung. Es verspricht auch nicht, dass wir die Fassung 30 Tage zum Download vorhalten; das steht im Satz davor. Wer Satz 3 als „der Kunde behält die Fassung“ liest, muss das mit dem ZIP und dem Download bis Periodenende erfüllen, nicht mit einem Verbleib auf unseren Servern.

**Nötige Änderung in AGB, FAQ Abschnitt 3 und Datenschutz, bevor das Soll produktiv wird:** die 30-Tage-Downloadfrist nach Vertragsende durch das neue Modell ersetzen und die zwei Fristen auseinanderhalten. Vorschlag der Sache nach, keine Klausel: bis zum Ende des bezahlten Zeitraums Download und Pflege; danach 14 Tage nur Wiederherstellung durch neues Abo, ohne Pflege und ohne Download; danach Löschung der Vertragsdaten bei uns. Die Zahl 30 darf an dieser Stelle nicht stehen bleiben. Dieselbe Zahl steht heute an drei Stellen; eine Stelle allein zu ändern, lässt Widerspruch im öffentlichen Text.

### 3.2 Zufriedenheitsgarantie und 198 €

§ 9 und FAQ Abschnitt 6.

- Abs. 1: 14 Tage ab Vertragsschluss, Antrag in Textform an info@, ausdrücklich kein Button. Das Soll legt keinen Erstattungsbutton an. Die Warnseite muss die Kündigung von der Garantie trennen, sonst wirkt das ZIP wie ein Schritt der Erstattung.
- Abs. 2: noch kein PDF erzeugt oder heruntergeladen → Erstattung der gesamten bis dahin gezahlten Vergütung, Abo endet. FAQ Abschnitt 6 verkürzt das auf „volle Zahlung (198 € zzgl. USt)“. **Spannung schon heute,** sobald mehr als der Einstieg gezahlt wurde: die AGB erstatten die Summe, die FAQ nur 198 €. Das Soll folgt den AGB (gesamte gezahlte Vergütung) und nennt 198 € nur als den üblichen ersten Checkout (149 + 49). **Nötige Änderung:** FAQ an § 9 Abs. 2 angleichen, oder die AGB auf 198 € deckeln. Das ist eine Owner-Entscheidung. Der Kopf der AGB sagt „voll nur vor erstem PDF“.
- Abs. 3: nach Erzeugung oder Download nur 49 € netto, Einrichtung 149 € nicht, Abo endet. Das Soll ändert die Geldbeträge nicht. **Konflikt mit der Löschfrist:** Wer die Einrichtung behält, hat die Leistung erhalten. Eine Löschung unserer Kopie ist mit Abs. 3 verträglich, wenn der Kunde die Datei vorher bekommen hat. Das Soll schließt den Download nach Periodenende. Liegt die Erstattung in der Wiederherstellungsfrist, sieht der Kunde die Datei im Konto nicht mehr. **Nötige Klarstellung:** entweder in der Phase `restore` den Download der schon erzeugten PDFs doch erlauben (dann widerspricht das der hier festgehaltenen Produktregel „Download nur bis Periodenende“ und rückt an die heutigen 30 Tage heran, nur mit 14 Tagen), oder Ops schickt das ZIP mit der Erstattungsmail. Beides gehört in die AGB, damit § 12 und § 9 dasselbe Ende beschreiben.
- „Heruntergeladen“ ist nicht protokolliert. Eine automatische Schaltung „voll versus nur Monatsbeitrag“ darf nicht auf einem Download-Flag aufbauen, das es nicht gibt. Solange das so bleibt, bleibt die Unterscheidung bei Ops; „erzeugt“ kann der Code an der Dokumentzeile feststellen.

§ 8: kein Verbraucher-Widerruf, B2B. Die Garantie ist vertraglich. Das Soll führt kein Widerrufsrecht ein.

### 3.3 Weitere Stellen

§ 4 Abs. 4: Sperre nach Mahnung, 14 Tage, Zahlungspflicht bleibt. Nicht implementiert. Die neue 14-Tage-Frist ist eine Wiederherstellung nach dem Ende, keine Mahnsperre. **Nötige Klarstellung im Text**, sobald beide Fristen nebeneinander stehen, damit sie nicht als dieselbe Frist gelesen werden. Die Mahnsperre selbst ist kein Teil dieses Solls.

§ 4 Abs. 5: Preisänderung mit Sonderkündigung. Kein eigener Code. Fällt unter Textform-Kündigung durch Ops. Kein neuer Konflikt.

§ 2 Abs. 1: Zugang zu Versionen und späteren Anpassungen „bei aktivem Abonnement“. Passt zur Phase `active` und `cancel_scheduled`. Passt zur Abschaltung in `restore`.

Datenschutz, Löschabschnitt: „Rechnungs- und zahlungsrelevante Nachweise … insbesondere nach § 147 AO“ und „Eine darüber hinausgehende automatische Löschroutine … ist nicht hinterlegt.“ Mit dem Cron wird eine Routine hinterlegt. **Nötige Änderung:** die 30 Tage ersetzen, die 14 Tage und den Cron nennen, und klarstellen, dass § 147 AO unsere Rechnungen meint und die Aufbewahrung der Verfahrensdokumentation beim Kunden liegt. Der heutige Satz „soweit keine gesetzlichen Aufbewahrungspflichten entgegenstehen“ darf nicht so gelesen werden, dass wir die Kunden-PDFs zehn Jahre behalten.

Checkout-Hinweis `app/checkout/checkout-form.tsx`: „jederzeit zum Monatsende kündbar.“ Passt zu § 12 Abs. 2, sagt nichts über 30 oder 14 Tage. Nach der AGB-Änderung prüfen, ob der Satz einen Halbsatz zum Download braucht. `PRICE_INCLUSION_LINE` in `lib/offer-copy.ts` sagt „monatlich kündbar“ und sonst nichts zum Ende. Kein direkter Widerspruch; die ausführliche Frist steht in AGB und FAQ.

### 3.4 Was vor einem produktiven Umbau juristisch zu entscheiden ist

1. Download nach Vertragsende: 30 Tage streichen und durch „Download bis Periodenende, 14 Tage Wiederherstellung ohne Download, dann Löschung“ ersetzen, an AGB § 12 Abs. 4, FAQ Abschnitt 3 und Datenschutz gleichzeitig.
2. Garantie nach erzeugtem PDF: ZIP durch Ops in der Erstattungsmail, oder Download während der 14 Tage doch offen. Eine der beiden Varianten in § 9 und § 12.
3. FAQ-Betrag 198 € gegen AGB „gesamte bis dahin gezahlte Vergütung“.
4. § 4 Abs. 4 (Mahnsperre 14 Tage) sprachlich von der Wiederherstellung trennen.
5. § 147 AO: Pflicht des Kunden für seine Unterlagen, Pflicht des Anbieters für eigene Rechnungen. Kein zehnjähriges Aufbewahren der Kunden-PDFs.
6. Portal-Dashboard auf Kündigung zum Periodenende festlegen, sonst ist § 12 Abs. 2 im Portal nicht erfüllt.

Keine dieser Entscheidungen ist mit diesem Dokument umgesetzt.

---

## Teil 4 — Aufwand je Scheibe

Die Angaben beschreiben Umfang, betroffene Stellen und Risiken. Sie sind keine Kalenderplanung.

**Scheibe A — Zustandsmodell und Webhooks.** Mittel bis groß. Neue Tabelle und Schreibpfad in der Art von `lib/store.ts`. Cases in `app/api/stripe/webhook/route.ts` für `updated` und `deleted`, Erweiterung von `checkout.session.completed` um die Subscription-ID. Idempotenz über `last_event_id`. Tests für die Phasenübergänge ohne echten Stripe-Call. Abhängigkeit: Dashboard-Events. Risiko: Reihenfolge `updated` dann `deleted`, zweiter `cus_`, Feld `current_period_end` in der SDK.

**Scheibe B — Warnseite, ZIP, Portal-Flow.** Mittel. Neue Route unter `app/account`, ZIP aus privaten Blobs, `createBillingPortalSession` um `flow_data.subscription_cancel` erweitern, Buttons in `components/account-billing.tsx` und die Kurzwege in `lib/portal.ts` trennen. Abhängigkeit: Scheibe A für das Datum, zur Not Retrieve live. Risiko: Funktionsdauer und Speicher bei vielen Versionen; Redirect darf den Download nicht abbrechen; Portal-Bypass bleibt und wird von Scheibe A aufgefangen.

**Scheibe C — Kontoanzeige und Zugriff.** Mittel. `/account` und `/account/billing` zeigen die Phase. `canAccessDocument`, `authorizeDeliveredWrite`, Intake, Editor, Upload und `GET /api/docs/[id]/download` beachten `restore` und `purged`. Die Checkout-Session-ID allein darf nach dem Ende keinen Download mehr öffnen. Abhängigkeit: A. Risiko: bestehende Prüfskripte `scripts/check-auth-session.ts`, `scripts/check-draft-auth.ts`, `scripts/check-session-write-access.ts`.

**Scheibe D — Mails.** Klein. Drei bis vier Texte neben `buildFailedPaymentMail` in `lib/ops.ts`, Idempotency-Keys, Gruß „Ihr Team von GoBD Verfahrensdoku“. Abhängigkeit: A für die Zeitpunkte. Risiko: `EMAIL_FROM` muss info@ sein und bei Resend freigegeben sein. Das ist eine Umgebungsänderung, kein Codefund.

**Scheibe E — Cron Erinnerung und Löschung.** Mittel bis groß. `vercel.json` Cron, geschützte Route, Löschinventar wie Admin-Wipe ohne Stripe-Kunden-Löschung und ohne Allowlist. Draft-Index und `anon`-Uploads ausnehmen beziehungsweise nur den Owner löschen. `PUT` des Entwurfs lehnt lokale Wiederbelebung nach `purged` ab. Abhängigkeit: A. Risiko: Löschung bei einer zweiten lebendigen Subscription derselben Mail; Sheet-Zeilen versehentlich zu weit löschen; Job muss bei fehlenden Blobs durchlaufen.

**Scheibe F — Wiederherstellung im Checkout.** Mittel. `createCheckoutSession` übergibt die bekannte `customer`-ID. `checkout.session.completed` hebt `restore` auf. Abhängigkeit: A und E. Risiko: zweiter Stripe-Kunde, wenn die ID fehlt.

**Scheibe G — Randfälle Zahlung, Erstattung, Reaktivierung.** Mittel. Reaktivierung ist ein Zweig von Scheibe A. `payment_failed` als `end_reason` am Lösch-Event, eigener erster Satz in der Endmail. Erstattung bleibt Ops; optional später `charge.refunded`. Abhängigkeit: A und D. Risiko: `cancellation_details` je nach Stripe-Grund unvollständig, dann `end_reason=other` und die neutrale Endmail.

**Scheibe H — Rechtstexte.** Kein Engineering in diesem Auftrag. Blocker vor Produktion, Liste in Abschnitt 3.4. Ohne die gleichzeitige Änderung von AGB, FAQ und Datenschutz widerspricht die Oberfläche § 12 Abs. 4 und dem Datenschutz.

Reihenfolge: A, danach B, C und D parallel, dann E, dann F und G. H parallel zu A, fertig bevor E produktiv läuft. Scheibe E ohne geänderte AGB löscht früher, als der veröffentlichte Text sagt.
