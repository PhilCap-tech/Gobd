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

1. Landing → **Readiness-Check starten (kostenlos)** (`/readiness`) — 3 kurze Schritte, kein Stripe
2. PDF „GoBD-Grundlagen für [Branche]“ auf `/readiness/success` herunterladen; Lead in Tab `readiness_leads` (oder `.data/readiness-leads.json`)
3. Optional weicher CTA zum Checkout. Checkout: Firma + E-Mail + Disclaimer
4. Stripe Checkout (Testmodus) **oder** Stub-Weiterleitung, wenn Keys fehlen
5. Intake: Branche → Software → Belegwege → IT → Verantwortliche
6. Speichern: Google Sheets (`intakes`) oder Datei-Fallback (lokal `.data/intakes.json`, auf Vercel `/tmp/gobd-data/intakes.json`)
7. Success (`/success?session_id=…&document_id=…`): PDF-Download, **Angaben überarbeiten**, **Neue PDF-Version erzeugen**, **Versionshistorie**. Fehlt `document_id`, reicht `session_id` — die App lädt die neueste Zeile zu dieser Stripe-Session.
8. Konto: `/login` (Magic Link) → `/account` (**Angaben überarbeiten** + **Versionshistorie** + Download + **Abo verwalten**). Alias: `/meine-dokumente` → `/account`
9. Re-Edit: Intake vorbefüllt → Absenden erzeugt **Version N+1**, alte Versionen bleiben downloadbar

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

Auf **Meine Dokumente** (`/account`, Alias `/meine-dokumente`): Block **Abo** ist nach Login immer sichtbar.

- Mit `stripe_customer_id` und `STRIPE_SECRET_KEY`: Button **Abo verwalten** → `POST /api/stripe/portal`
- Sonst: deaktivierter Ghost-Button plus Hinweis (kein Kunde / Stripe nicht konfiguriert)

`POST /api/stripe/portal` liest die Session-E-Mail, sucht `stripe_customer_id` (bevorzugt Paid-/Intake-Zeilen; Fallback `customers.list` nach E-Mail, kurz gecacht) und erzeugt eine Billing-Portal-Session. Fehler und Rückkehr landen auf `/account?portal=…` (nicht `/meine-dokumente`, damit der Status-Banner nicht in der Alias-Weiterleitung verloren geht). `return_url` = `{NEXT_PUBLIC_APP_URL}/account?portal=returned`.

Komfort-Routen **`/portal`** und **`/billing`**: eingeloggt mit Kunde → direkt ins Stripe-Portal, sonst Redirect auf `/account` (mit `?portal=missing|unavailable|error`). Nicht eingeloggt → `/login?next=/portal` (bzw. `/billing`); der Magic Link führt zurück auf diese Route. `GET` und `POST /api/stripe/portal` machen dieselbe Weiterleitung (`POST` bleibt für **Abo verwalten**). Kein 404.

`stripe_customer_id` wird geschrieben, wenn vorhanden:

- Webhook `checkout.session.completed` (auch nach, wenn die Intake-Zeile die ID noch nicht hatte)
- Intake (Checkout-Session-Retrieve, sonst Store/Stripe-Lookup)

Ohne Webhook-Secret speichert der Intake die ID trotzdem über Session-Retrieve. Fehlt sie in den Zeilen, listet das Konto/Portal Stripe-Kunden zur E-Mail (kein Ersatz für Keys; `STRIPE_WEBHOOK_SECRET` bleibt Ops-Aufgabe).

Ohne Customer-ID, ohne `STRIPE_SECRET_KEY` oder bei Stripe-Fehler: Redirect zurück auf `/account` mit Hinweis (kein harter 500). Der Abo-Block bleibt sichtbar.

**Blocker ohne Keys:** Echte Zahlung und das echte Portal sind nicht testbar, solange `STRIPE_SECRET_KEY` und die beiden Price-IDs fehlen. Die Integration ist vollständig verdrahtet; der Checkout fällt dann auf eine Mock-Session zurück. Das Portal braucht zusätzlich eine echte `cus_…` (nach Test-Checkout in der Sheet-/Datei-Zeile).

## Google Sheets

Service Account (JSON) in Google Cloud, Sheets API aktivieren. Tabelle mit dem Service-Account-User **teilen** (Bearbeiter).

Env:

- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` (Newlines als `\n`)
- `GOOGLE_SHEETS_SPREADSHEET_ID`
- `GOOGLE_SHEETS_TAB` (Default: `intakes`)
- `GOOGLE_SHEETS_READINESS_TAB` (Default: `readiness_leads`) — **eigene Tabelle**, nicht mit Paid-Intakes mischen

Spalten `intakes` (Header wird geschrieben, wenn A1 leer ist; fehlende Spalten werden **angehängt**, bestehende nicht umsortiert):

`timestamp | stripe_session_id | stripe_customer_id | email | company | branchen | rechtsform | mitarbeitende | fibu | weitere_systeme | eingangsbelege | ausgangsrechnungen | archiv | hosting | backup | zugriff | gf | buchhaltung | it | steuerberater | status | delivery_status | document_id | pdf_url | version | parent_document_id`

Ohne Sheets-Credentials — oder wenn Sheets-Append fehlschlägt — schreibt die App einen Datei-Fallback:
lokal nach `.data/intakes.json` (nicht committen), auf Vercel (`VERCEL=1`) nach `os.tmpdir()/gobd-data/intakes.json`
(typisch `/tmp`, das einzige beschreibbare Verzeichnis auf Serverless). Der Fallback ist nicht persistent über Invocations.

### Readiness-Leads (`readiness_leads`)

Kostenloser Check unter `/readiness` schreibt **nicht** in `intakes` (kein Stripe, keine VD-Versionen). Fehlt das Tab, wird es angelegt.

Spalten:

`timestamp | lead_id | access_token | name | email | company | branche | branche_freitext | rechtsform | mitarbeitende | belegweg | software | verantwortliche | status | pdf_url | mail_status`

Datei-Fallback: `.data/readiness-leads.json` bzw. `/tmp/gobd-data/readiness-leads.json`. `mail_status`: `sent` | `stub` | `failed`.

Branche-Schlüssel: `handwerk` | `handel` | `praxis` | `gastronomie` | `dienstleistung` | `allgemein`. Unbekannt → `allgemein`. Module: `content/readiness/*.md`.

## PDF, Blob, E-Mail, Magic Link

Nach dem Intake entsteht die **Verfahrensdokumentation PDF** (pdfkit, Outline v2) lokal aus `content/delivery-templates/` (Markdown-Kapitel + `bundle.json`): Titelseite mit Logo → Kapitel 1–9 mit nummerierten Absätzen `[1][2]…` → Kurzer Disclaimer (kein Steuerberatungsersatz) in Kopf/Fuß, Seitenzahlen. Platzhalter `{{identity.*}}` / `{{answers.*}}` / `{{roles.*}}` / `{{version}}` mit `| join ", "` und `| or "nicht angegeben"`. Offene Punkte aus `open-points-rules.json` in Kapitel 9. Standardrahmen nur aus den Templates; keine erfundenen Zertifikate, Pfade oder Personennamen.

Readiness-PDF (4–6 Seiten): `content/readiness/{branche}.md` mit `{{Branche}}` / `{{Firma}}` / `{{Datum}}`. Blob-Pfad `gobd/readiness-{lead_id}/v1.pdf`. Download: `/api/readiness/{lead_id}/download?token=…` (oder Session-Cookie zur Lead-E-Mail). Keine Verfahrensdokumentation, kein Konto-Eintrag.

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

Die Delivery-Mail enthält Download-Link, Magic Link und FAQ (`https://www.gobd-doku-erstellen.de/faq`). Die Onboarding-Mail nach `checkout.session.completed` ebenso FAQ plus Login. Die Readiness-Mail enthält den Grundlagen-PDF-Link (kein VD-Claim). Fehlen die Env-Werte: **kein Versand**, Log-Stub, Download bleibt auf `/success` bzw. `/readiness/success`.

### Magic Link

1. Langes Zufallsgeheimnis setzen: `MAGIC_LINK_SECRET`
2. `/login` fordert einen Link an → E-Mail → `/auth/verify?token=` setzt httpOnly-Cookie `gobd_session` (30 Tage)
3. `/account` listet Dokumente zu dieser E-Mail (Sheets/Datei), **Angaben überarbeiten** und die **Versionshistorie**

Link-Token: 20 Minuten. Ohne `MAGIC_LINK_SECRET` gibt es einen Dev-Fallback (nur Demo; in Produktion setzen). Ohne Mail zeigt `/login` den Demo-Link im Banner.

Identität ist die Checkout-/Intake-E-Mail (weiche Bindung an Stripe-Session/Customer-ID). Nur diese Session-E-Mail **oder** die passende Stripe-Checkout-Session darf bearbeiten und herunterladen. **Abo** auf `/account` ist nach Login immer sichtbar; **Abo verwalten** öffnet das Stripe Customer Portal, sobald eine `cus_…` zur E-Mail vorliegt (Sheet/Datei oder Stripe-Lookup). Alias-Routen: `/meine-dokumente`, `/portal`, `/billing`.

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

PDF-Text kommt weiter nur aus `content/delivery-templates/`. Standardrahmen (S) und Intake-Platzhalter (I); keine Zusicherung der Prüfungsfestigkeit.

## Was ist Stub

- **Ops** (`lib/ops.ts`, `POST /api/ops`): Onboarding nach Zahlung per Resend, wenn Mail-Env gesetzt; sonst Log-Stub. Failed Payment / Failed Job: weiter nur Logs.
- **Checkout ohne Stripe-Keys:** Mock-Session, weiter zum Intake.
- **Intake ohne Sheets / Sheets-Fehler:** Datei-Fallback (lokal `.data`, auf Vercel `/tmp`).
- **Readiness ohne Sheets:** `.data/readiness-leads.json` bzw. `/tmp`.
- **PDF ohne Blob:** lokale Datei, auf Vercel nicht persistent; Download kann aus der Intake- bzw. Readiness-Zeile regenerieren.
- **Mail ohne Resend:** Log-Stub, Download auf Success / Readiness-Success bleibt.
- **Stripe Customer Portal:** ohne `STRIPE_SECRET_KEY` oder ohne `stripe_customer_id` zur Session-E-Mail — deaktivierter Button plus Hinweis auf `/account` (nicht unsichtbar). `/portal` und `/billing` leiten entsprechend weiter.

Intake-Nachbearbeitung (Re-Edit / neue PDF-Version) ist implementiert. Fertige Kapiteltexte über Counsel bleiben später.

## Vercel

Next.js App Router, bereit für Vercel. Dieselben Env-Vars setzen. Webhook-URL: `https://www.gobd-doku-erstellen.de/api/stripe/webhook`.

**Pflicht nach Deploy:** `NEXT_PUBLIC_APP_URL=https://www.gobd-doku-erstellen.de` (www, kein trailing slash) setzen und **neu deployen** — der Wert wird zur Build-Zeit eingebettet. Apex (`https://gobd-doku-erstellen.de`) nicht verwenden.

Für persistente PDFs, Mail und Abo-Portal: `BLOB_READ_WRITE_TOKEN`, `RESEND_API_KEY`, `EMAIL_FROM`, `MAGIC_LINK_SECRET`, `STRIPE_WEBHOOK_SECRET` setzen.

Landing ist indexierbar (`robots` erlaubt Indexierung). Checkout, Intake, Success, Readiness, Login und Konto sind `noindex`.
