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
6. Success (`/success?session_id=…&document_id=…`): PDF-Download, Disclaimer, Link zu **Meine Dokumente**
7. Konto: `/login` (Magic Link) → `/account` (Liste + Download). Alias: `/meine-dokumente`

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

Spalten (Header wird geschrieben, wenn A1 leer ist; fehlende Spalten werden **angehängt**, bestehende nicht umsortiert):

`timestamp | stripe_session_id | stripe_customer_id | email | company | branchen | rechtsform | mitarbeitende | fibu | weitere_systeme | eingangsbelege | ausgangsrechnungen | archiv | hosting | backup | zugriff | gf | buchhaltung | it | steuerberater | status | delivery_status | document_id | pdf_url | version`

Ohne Sheets-Credentials — oder wenn Sheets-Append fehlschlägt — schreibt die App einen Datei-Fallback:
lokal nach `.data/intakes.json` (nicht committen), auf Vercel (`VERCEL=1`) nach `os.tmpdir()/gobd-data/intakes.json`
(typisch `/tmp`, das einzige beschreibbare Verzeichnis auf Serverless). Der Fallback ist nicht persistent über Invocations.

## PDF, Blob, E-Mail, Magic Link

Nach dem Intake entsteht **PDF v1** (pdfkit) aus `content/delivery-templates/bundle.json`: Cover, Kapitel 01–06 (allgemein, systeme, belegwesen, aufbewahrung, verantwortlichkeiten, offene-punkte), Disclaimer-Footer. Platzhalter aus Intake/Identity, keine erfundenen GoBD-Rechtstexte.

### Vercel Blob

1. Im Vercel-Projekt Storage → Blob anlegen
2. `BLOB_READ_WRITE_TOKEN` in `.env.local` / Vercel Env setzen
3. PDFs landen unter `gobd/{document_id}/v1.pdf`

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
3. `/account` listet Dokumente zu dieser E-Mail (Sheets/Datei) und bietet den neuesten Download

Link-Token: 20 Minuten. Ohne `MAGIC_LINK_SECRET` gibt es einen Dev-Fallback (nur Demo; in Produktion setzen). Ohne Mail zeigt `/login` den Demo-Link im Banner.

Identität ist die Checkout-/Intake-E-Mail (weiche Bindung an Stripe-Session/Customer-ID). Stripe Customer Portal ist in diesem Slice ein TODO-Hinweis, keine Integration.

Weitere Env: `NEXT_PUBLIC_APP_URL` (siehe oben).

## Was ist Stub

- **Ops** (`lib/ops.ts`, `POST /api/ops`): Onboarding nach Zahlung, Failed Payment, Failed Job. Nur Logs, kein Versand.
- **Checkout ohne Stripe-Keys:** Mock-Session, weiter zum Intake.
- **Intake ohne Sheets / Sheets-Fehler:** Datei-Fallback (lokal `.data`, auf Vercel `/tmp`).
- **PDF ohne Blob:** lokale Datei, auf Vercel nicht persistent; Download kann aus der Intake-Zeile regenerieren.
- **Mail ohne Resend:** Log-Stub, Download auf Success bleibt.
- **Stripe Customer Portal:** nur Hinweis auf `/account`.

PDF-Kapiteltexte über Counsel und Intake-Nachbearbeitung sind Slice C.

## Vercel

Next.js App Router, bereit für Vercel. Dieselben Env-Vars setzen. Webhook-URL: `https://www.gobd-doku-erstellen.de/api/stripe/webhook`.

**Pflicht nach Deploy:** `NEXT_PUBLIC_APP_URL=https://www.gobd-doku-erstellen.de` (www, kein trailing slash) setzen und **neu deployen** — der Wert wird zur Build-Zeit eingebettet. Apex (`https://gobd-doku-erstellen.de`) nicht verwenden.

Für persistente PDFs und Mail: `BLOB_READ_WRITE_TOKEN`, `RESEND_API_KEY`, `EMAIL_FROM`, `MAGIC_LINK_SECRET` setzen.

Landing ist indexierbar (`robots` erlaubt Indexierung). Checkout, Intake, Success, Login und Konto sind `noindex`.
