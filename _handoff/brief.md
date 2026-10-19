# Builder-Brief: Branchenseiten Welle 6 (Marktstand, Reisebüro)

**Datum:** 2026-10-19 · **Von:** GoBD Content · **An:** GoBD Builder
**Repo:** PhilCap-tech/Gobd (Basis: aktueller main, 10 Branchen live) · **Branch-Vorschlag:** `feat/branchen-welle6`

## Harte Regeln
- **Ein PR mit beiden Seiten.** Da `reisebuero` ein Philip-Review-Flag hat: **Draft-PR**, Titel enthält **„Philip-Freigabe“**, z. B. `Branchen Welle 6: Marktstand, Reisebüro (Philip-Freigabe)`. **DO NOT MERGE.** Merge nur nach Philips OK über CoS.
- Beide Seiten **index,follow**: `noindex: false`, `status: "draft"` unverändert (wie hofladen/kosmetikstudio auf main). Kein `noindex` in Meta oder X-Robots-Tag.
- Beide Seiten **in der Sitemap**.
- **Interne Verlinkung nur über die Footer-Spalte „Branchen“** (automatisch via `listBranchenFooterLinks()`). Keine zusätzlichen Links aus Blog, Muster-Seite, Homepage oder anderen Branchenseiten. Nimmt der „andere Branchen“-Block in `components/branchen-page.tsx` die neuen Seiten automatisch auf: nicht im Code ändern, im PR vermerken.
- Texte **1:1** übernehmen; nichts ergänzen oder umformulieren (insbesondere keine Preis-, Garantie- oder Aufwandssätze).
- `scripts/check-forbidden-words.mjs` und `scripts/check-sie-ansprache.mjs` grün; Build grün.
- **Keine Preview-Links als Abnahme**, sondern Screenshots (siehe 4.).

## Quellen
- `/workspace/gobd-content/branchen/verfahrensdokumentation-marktstand.md` → `content/branchen/marktstand.md`
- `/workspace/gobd-content/branchen/verfahrensdokumentation-reisebuero.md` → `content/branchen/reisebuero.md`
- Begründung, Kannibalisierung, Flags: `/workspace/gobd-content/branchen/2026-10-19-welle6-keyword-recherche.md`

## Review-Flags (für PR-Beschreibung übernehmen)
- marktstand: **nein**
- reisebuero: **ja** — Agentur-/Veranstalterinkasso, Kundengelder, Provisionsabrechnungen nur als Ablauf beschrieben, steuerliche Einordnung an Steuerberatung verwiesen.

## 1. Seiten registrieren
- Dateien nach `content/branchen/<slug>.md` kopieren (Dateiname = slug).
- `lib/branchen.ts`: `BRANCHEN_SLUGS = ["friseure", "einzelhandel", "taxi", "kiosk", "verein", "apotheke", "automaten", "hotel", "hofladen", "kosmetikstudio", "marktstand", "reisebuero"]`.
- Routing über `lib/branchen-routes.ts` + `app/branchen/[slug]` wie bisher. Prüfen: `/verfahrensdokumentation-marktstand` und `/verfahrensdokumentation-reisebuero` liefern 200, `/branchen/<slug>` leitet um.
- `musterVorlage`: marktstand → `handel`, reisebuero → `dienstleister`; `readinessBranche`: `handel` / `dienstleistung`.
- Footer-Anker (H1 bis zum Doppelpunkt): „Verfahrensdokumentation für Marktstände“, „Verfahrensdokumentation für Reisebüros“.

## 2. Sitemap
- Beide Routen in `app/sitemap.ts` bzw. automatisch über `listBranchenRoutes`. In sitemap.xml der Preview kontrollieren.

## 3. Verlinkung der neuen Seiten
Die Seiten verlinken nur auf existierende Ziele (live mit HTTP 200 geprüft am 2026-10-19): Blog `gobd-verfahrensdokumentation-erstellen`, `verfahrensdokumentation-kasse`, `kassen-nachschau-ablauf-vorbereitung`, `verfahrensdokumentation-belegablage`, `aufbewahrungsfristen-gobd`, `verfahrensdokumentation-fehler`, `verfahrensdokumentation-pflicht`, `verfahrensdokumentation-muster-einzelunternehmer`, `internes-kontrollsystem-verfahrensdokumentation`, `verfahrensdokumentation-checkliste-zustaendigkeiten-vertretung`, `verfahrensdokumentation-steuerberater-arbeitsteilung`, `datenzugriff-betriebspruefung`, `verfahrensdokumentation-systemwechsel`; Branchen `/verfahrensdokumentation-hofladen`, `/verfahrensdokumentation-einzelhandel`; `/ampel-check`, `/readiness`, `/muster`, `/muster/gesamt/{handel,dienstleister}`. Falls der Build `kassen-nachschau-ablauf-vorbereitung` nicht unter content/blog findet: nicht entfernen, im PR melden.

## 4. Abnahme und Rückmeldung an GoBD Content
- 200 beider Routen, index,follow, in sitemap.xml, Footer-Spalte „Branchen“ zeigt 12 Einträge, FAQ-JSON-LD vorhanden, keine sichtbaren CTA-Labels, Prüfskripte grün.
- **4 Screenshots** (Full Page): `marktstand-desktop.png` (1440 px), `marktstand-mobile.png` (390 px), `reisebuero-desktop.png`, `reisebuero-mobile.png`.
- Dazu: **PR-Nummer** und Link, Commit-Hash(es), Ergebnis der Prüfskripte, Hinweis zum „andere Branchen“-Block.
- Rückmeldung an **GoBD Content**; Freigabe an Philip läuft über CoS.
