# GoBD Verfahrensdoku

Landing, Stripe Checkout (149 € Setup + 49 €/Monat), 5-Schritt-Intake, PDF-Entwurf (Kapitelgerüst + offene Punkte), Magic-Link-Konto.

## Lokal starten

```bash
cp .env.example .env.local
npm install
npm run dev
```

Öffnen: http://localhost:3000

Ohne Stripe-, Sheets-, Blob- und Mail-Keys läuft der Demo-Pfad trotzdem (Stub-Checkout, Datei-Fallback, lokales PDF, Log-Stub statt E-Mail).

## Demo-Pfad

1. Landing → **Readiness-Check starten (kostenlos)** (`/readiness`) oder sekundär Checkout
2. Checkout: Firma + E-Mail + Disclaimer
3. Stripe Checkout (Testmodus) **oder** Stub-Weiterleitung, wenn Keys fehlen
4. Intake: Branche → Software → Belegwege → IT → Verantwortliche
5. Speichern: Google Sheets oder Datei-Fallback (lokal `.data/intakes.json`, auf Vercel `/tmp/gobd-data/intakes.json`)
6. Success (`/success?session_id=…&document_id=…`): PDF-Download, **Angaben überarbeiten**, **Neue PDF-Version erzeugen**, **Versionshistorie**. Fehlt `document_id`, reicht `session_id` — die App lädt die neueste Zeile zu dieser Stripe-Session.
7. Konto: `/login` (Magic Link) → `/account` (**Angaben überarbeiten** + **Versionshistorie** + Download + **Abo verwalten**). Alias: `/meine-dokumente` → `/account`
8. Re-Edit: Intake vorbefüllt → Absenden erzeugt **Version N+1**, alte Versionen bleiben downloadbar

## Stripe (Testmodus)

Checkout Session im `subscription`-Modus mit zwei Line Items:

- einmalig 149 € — `STRIPE_PRICE_SETUP_ID`
- monatlich 49 € — `STRIPE_PRICE_MONTHLY_ID`

`success_url` → `{NEXT_PUBLIC_APP_URL}/intake?session_id={CHECKOUT_SESSION_ID}`  
`cancel_url` → `{NEXT_PUBLIC_APP_URL}/`

Kanonische Produktions-URL (kein Apex, kein trailing slash):

`https://www.gobd-doku-erstellen.de`

`getAppUrl()` normalisiert `gobd-doku-erstellen.de` → `www`. Der Apex-Host 308t auf www; Stripe muss direkt die www-`success_url` bekommen, sonst kann `session_id` in der Redirect-Kette verloren gehen.

Der Success-Redirect hängt **nicht** am Webhook. Intake prüft die Session per Stripe Retrieve (`status === complete` **oder** `payment_status === paid`).

In Stripe (Testmodus) anlegen:

1. Produkt + Price einmalig 149 EUR
2. Produkt + Price recurring 49 EUR / Monat
3. Keys und Price-IDs nach `.env.local`

### Webhook (`STRIPE_WEBHOOK_SECRET`)

Ohne Signing-Secret nimmt `/api/stripe/webhook` keine Events an (HTTP 503, klare Fehlermeldung; in Produktion `production: true` im JSON). **Kein Platzhalter-Secret im Code** — den Wert nur aus Stripe übernehmen.

**Lokal (Stripe CLI):**

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Die CLI gibt ein Secret aus (`whsec_…`). Das als `STRIPE_WEBHOOK_SECRET` in `.env.local` setzen (nach Änderung `next dev` neu starten).

**Produktion (Stripe Dashboard):**

1. Developers → Webhooks → Add endpoint
2. URL: `https://www.gobd-doku-erstellen.de/api/stripe/webhook`
3. Events: `checkout.session.completed`, `invoice.payment_failed`
4. Signing secret (`whsec_…`) als `STRIPE_WEBHOOK_SECRET` in Vercel setzen und neu deployen

Events:

- `checkout.session.completed` — Order-Zeile (`status=paid`, inkl. `stripe_customer_id`) + Onboarding-Stub; idempotent pro `stripe_session_id`
- `invoice.payment_failed` — Failed-Payment-Stub (E-Mail aus Invoice oder Customer-Retrieve)

### Customer Portal

In Stripe (Testmodus): Settings → Billing → Customer portal aktivieren (Zahlungsmittel, Rechnungen, Abo kündigen — je nach Portal-Config).

Auf **Meine Dokumente** (`/account`, Alias `/meine-dokumente`): Button **Abo verwalten**. `POST /api/stripe/portal` liest die Session-E-Mail aus dem Cookie, sucht die neueste Zeile mit `stripe_customer_id` und erzeugt eine Billing-Portal-Session. `return_url` = `{NEXT_PUBLIC_APP_URL}/meine-dokumente?portal=returned`.

Ohne Customer-ID, ohne `STRIPE_SECRET_KEY` oder bei Stripe-Fehler: Redirect zurück auf Meine Dokumente mit Hinweis (kein harter 500).

**Blocker ohne Keys:** Echte Zahlung und das echte Portal sind nicht testbar, solange `STRIPE_SECRET_KEY` und die beiden Price-IDs fehlen. Die Integration ist vollständig verdrahtet; der Checkout fällt dann auf eine Mock-Session zurück. Das Portal braucht zusätzlich eine echte `cus_…` (nach Test-Checkout in der Sheet-/Datei-Zeile).

## Google Sheets

Service Account (JSON) in Google Cloud, Sheets API aktivieren. Tabelle mit dem Service-Account-User **teilen** (Bearbeiter).

Env:

- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` (Newlines als `\n`)
- `GOOGLE_SHEETS_SPREADSHEET_ID`
- `GOOGLE_SHEETS_TAB` (Default: `intakes`)

Spalten (Header wird geschrieben, wenn A1 leer ist; fehlende Spalten werden **angehängt**, bestehende nicht umsortiert):

`timestamp | stripe_session_id | stripe_customer_id | email | company | branchen | rechtsform | mitarbeitende | fibu | weitere_systeme | eingangsbelege | ausgangsrechnungen | archiv | hosting | backup | zugriff | gf | buchhaltung | it | steuerberater | status | delivery_status | document_id | pdf_url | version | parent_document_id`

Ohne Sheets-Credentials — oder wenn Sheets-Append fehlschlägt — schreibt die App einen Datei-Fallback:
lokal nach `.data/intakes.json` (nicht committen), auf Vercel (`VERCEL=1`) nach `os.tmpdir()/gobd-data/intakes.json`
(typisch `/tmp`, das einzige beschreibbare Verzeichnis auf Serverless). Der Fallback ist nicht persistent über Invocations.

## PDF, Blob, E-Mail, Magic Link

Nach dem Intake entsteht **PDF v1** (pdfkit) lokal aus `content/delivery-templates/bundle.json` (GoBD Delivery Templates v1): Cover → Kapitel 01–06 → Disclaimer-Fußzeile. Platzhalter `{{identity.*}}` / `{{answers.*}}` mit `| join ", "` und `| or "nicht angegeben"`. Offene Punkte aus `openPointsRules`. Keine erfundenen GoBD-Rechtstexte über das Bundle hinaus.

### Vercel Blob

1. Im Vercel-Projekt Storage → Blob anlegen
2. `BLOB_READ_WRITE_TOKEN` in `.env.local` / Vercel Env setzen
3. PDFs landen unter `gobd/{family_id}/v{n}.pdf` (v1: `family_id` = `document_id`)

Ohne Token: lokale Datei (`.data/pdfs` bzw. `/tmp/gobd-data/pdfs`). Download regeneriert das PDF aus den gespeicherten Intake-Zeilen, falls die Datei fehlt.

### Resend (E-Mail)

1. API-Key bei [Resend](https://resend.com) anlegen
2. Absender verifizieren, dann setzen:

- `RESEND_API_KEY`
- `EMAIL_FROM` (z. B. `GoBD Verfahrensdoku <noreply@deine-domain.de>`)

Die Delivery-Mail enthält Download-Link und Magic Link. Fehlen die Env-Werte: **kein Versand**, Log-Stub (wie Ops), Download bleibt auf `/success`.

### Magic Link

1. Langes Zufallsgeheimnis setzen: `MAGIC_LINK_SECRET`
2. `/login` fordert einen Link an → E-Mail → `/auth/verify?token=` setzt httpOnly-Cookie `gobd_session` (30 Tage)
3. `/account` listet Dokumente zu dieser E-Mail (Sheets/Datei), **Angaben überarbeiten** und die **Versionshistorie**

Link-Token: 20 Minuten. Ohne `MAGIC_LINK_SECRET` gibt es einen Dev-Fallback (nur Demo; in Produktion setzen). Ohne Mail zeigt `/login` den Demo-Link im Banner.

Identität ist die Checkout-/Intake-E-Mail (weiche Bindung an Stripe-Session/Customer-ID). Nur diese Session-E-Mail **oder** die passende Stripe-Checkout-Session darf bearbeiten und herunterladen. **Abo verwalten** auf `/account` bzw. `/meine-dokumente` öffnet das Stripe Customer Portal (`stripe_customer_id` der neuesten Zeile zu dieser E-Mail).

Weitere Env: `NEXT_PUBLIC_APP_URL` (siehe oben).

## Re-Edit und Versionierung

Keine zweite Tabelle. Jede PDF-Fassung ist eine **neue Zeile** in `intakes` (Sheets oder `.data/intakes.json`).

- **v1:** `document_id` neu, `parent_document_id` = `document_id`, `version` = `1`, `pdf_url` = Blob-URL oder lokaler Pfad.
- **v2+:** gleiche `email` / `stripe_session_id` / Firma, neue `document_id`, `parent_document_id` = Familienwurzel (v1-`document_id`), `version` = n+1, neues PDF. Alte Zeilen bleiben unverändert.
- Slice-A+B-Zeilen ohne `parent_document_id`: die App behandelt `document_id` als Wurzel. Fehlende Spalte wird an den Header **angehängt**.

Ablauf:

1. Success oder Meine Dokumente → **Angaben überarbeiten** (oder **Neue PDF-Version erzeugen**) → `/intake?document_id=…&session_id=…`
2. Intake lädt die **aktuellste** Fassung der Familie und füllt das Formular aus der Sheet-/Datei-Zeile
3. Absenden hängt eine **neue Zeile** an (`version` = n+1, `parent_document_id` = Familienwurzel, neue `document_id` + PDF). Die alte Zeile bleibt. So entsteht Version 2, 3, …
4. `/account` und `/success` zeigen die **Versionshistorie**; bei nur einer Fassung den Hinweis „Nach dem Überarbeiten erscheint hier Version 2.“ Jede Version hat einen eigenen Download (`/api/docs/{document_id}/download`)

`/success?session_id=…` ohne `document_id` sucht die neueste Intake-Zeile zu dieser Stripe-Session und zeigt Download + Überarbeiten. `/intake?document_id=&session_id=…` (leere `document_id`) fällt ebenfalls auf die Session-Zeile zurück und startet den Re-Edit statt eines leeren Formulars.

Zugriff: Magic-Link-Cookie `gobd_session` (E-Mail) **oder** `session_id` der ursprünglichen Stripe-/Stub-Checkout-Session. Fremde E-Mails sehen das Intake nicht.

PDF-Text kommt weiter nur aus `content/delivery-templates/`. Keine zusätzlichen GoBD-Rechtstexte.

## Was ist Stub

- **Ops** (`lib/ops.ts`, `POST /api/ops`): Onboarding nach Zahlung, Failed Payment, Failed Job. Nur Logs, kein Versand.
- **Checkout ohne Stripe-Keys:** Mock-Session, weiter zum Intake.
- **Intake ohne Sheets / Sheets-Fehler:** Datei-Fallback (lokal `.data`, auf Vercel `/tmp`).
- **PDF ohne Blob:** lokale Datei, auf Vercel nicht persistent; Download kann aus der Intake-Zeile regenerieren.
- **Mail ohne Resend:** Log-Stub, Download auf Success bleibt.
- **Stripe Customer Portal:** ohne `STRIPE_SECRET_KEY` oder ohne `stripe_customer_id` zur Session-E-Mail — Hinweis statt Portal.

Intake-Nachbearbeitung (Re-Edit / neue PDF-Version) ist implementiert. Fertige Kapiteltexte über Counsel bleiben später.

## Vercel

Next.js App Router, bereit für Vercel. Dieselben Env-Vars setzen. Webhook-URL: `https://www.gobd-doku-erstellen.de/api/stripe/webhook`.

**Pflicht nach Deploy:** `NEXT_PUBLIC_APP_URL=https://www.gobd-doku-erstellen.de` (www, kein trailing slash) setzen und **neu deployen** — der Wert wird zur Build-Zeit eingebettet. Apex (`https://gobd-doku-erstellen.de`) nicht verwenden.

Für persistente PDFs, Mail und Abo-Portal: `BLOB_READ_WRITE_TOKEN`, `RESEND_API_KEY`, `EMAIL_FROM`, `MAGIC_LINK_SECRET`, `STRIPE_WEBHOOK_SECRET` setzen.

Landing ist indexierbar (`robots` erlaubt Indexierung). Checkout, Intake, Success, Login und Konto sind `noindex`.
