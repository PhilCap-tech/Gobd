# GoBD Verfahrensdoku

Landing, Stripe Checkout (149 € Setup + 49 €/Monat), 5-Schritt-Intake, Ablage in Google Sheets. Delivery und Ops sind Stubs.

## Lokal starten

```bash
cp .env.example .env.local
npm install
npm run dev
```

Öffnen: http://localhost:3000

Ohne Stripe- und Sheets-Keys läuft der Demo-Pfad trotzdem (Stub-Checkout, Datei-Fallback).

## Demo-Pfad

1. Landing → **Readiness-Check starten (kostenlos)** (`/readiness`) oder sekundär Checkout
2. Checkout: Firma + E-Mail + Disclaimer
3. Stripe Checkout (Testmodus) **oder** Stub-Weiterleitung, wenn Keys fehlen
4. Intake: Branche → Software → Belegwege → IT → Verantwortliche
5. Speichern: Google Sheets oder Datei-Fallback (lokal `.data/intakes.json`, auf Vercel `/tmp/gobd-data/intakes.json`)
6. Delivery-Stub zeigt nur Kapitelgerüst, kein PDF

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

Webhook lokal:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

`STRIPE_WEBHOOK_SECRET` aus `stripe listen` setzen. Events: `checkout.session.completed` (Order-Zeile + Onboarding-Stub), `invoice.payment_failed` (Failed-Payment-Stub).

**Blocker ohne Keys:** Echte Zahlung ist nicht testbar, solange `STRIPE_SECRET_KEY` und die beiden Price-IDs fehlen. Die Integration ist vollständig verdrahtet; der Checkout fällt dann auf eine Mock-Session zurück.

## Google Sheets

Service Account (JSON) in Google Cloud, Sheets API aktivieren. Tabelle mit dem Service-Account-User **teilen** (Bearbeiter).

Env:

- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` (Newlines als `\n`)
- `GOOGLE_SHEETS_SPREADSHEET_ID`
- `GOOGLE_SHEETS_TAB` (Default: `intakes`)

Spalten (Header wird geschrieben, wenn A1 leer ist):

`timestamp | stripe_session_id | stripe_customer_id | email | company | branchen | rechtsform | mitarbeitende | fibu | weitere_systeme | eingangsbelege | ausgangsrechnungen | archiv | hosting | backup | zugriff | gf | buchhaltung | it | steuerberater | status | delivery_status`

Ohne Sheets-Credentials — oder wenn Sheets-Append fehlschlägt — schreibt die App einen Datei-Fallback:
lokal nach `.data/intakes.json` (nicht committen), auf Vercel (`VERCEL=1`) nach `os.tmpdir()/gobd-data/intakes.json`
(typisch `/tmp`, das einzige beschreibbare Verzeichnis auf Serverless). Der Fallback ist nicht persistent über Invocations.

## Was ist Stub

- **Delivery** (`lib/delivery.ts`, `POST /api/delivery`): Kapitelgerüst + offene Punkte. Keine GoBD-Rechtstexte, kein PDF. TODO im Code.
- **Ops** (`lib/ops.ts`, `POST /api/ops`): Onboarding-Mail, Failed Payment, Failed Job. Nur Logs, kein Versand. TODO im Code.
- **Checkout ohne Stripe-Keys:** Mock-Session, weiter zum Intake.
- **Intake ohne Sheets / Sheets-Fehler:** Datei-Fallback (lokal `.data`, auf Vercel `/tmp`).

Kein Auth, kein Admin-UI.

## Vercel

Next.js App Router, bereit für Vercel. Dieselben Env-Vars setzen. Webhook-URL: `https://www.gobd-doku-erstellen.de/api/stripe/webhook`.

**Pflicht nach Deploy:** `NEXT_PUBLIC_APP_URL=https://www.gobd-doku-erstellen.de` (www, kein trailing slash) setzen und **neu deployen** — der Wert wird zur Build-Zeit eingebettet. Apex (`https://gobd-doku-erstellen.de`) nicht verwenden.

Landing ist indexierbar (`robots` erlaubt Indexierung). Checkout und Intake sind `noindex`.
