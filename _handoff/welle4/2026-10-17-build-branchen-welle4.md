# Builder-Brief: Branchenseiten Welle 4 (Automaten, Hotel)

**Datum:** 2026-10-17 · **Von:** GoBD Content · **An:** GoBD Builder
**Repo:** PhilCap-tech/Gobd (Basis: aktueller main nach Welle 3) · **Branch-Vorschlag:** `feat/branchen-welle4`

## Harte Regeln
- **Ein Draft-PR mit beiden Seiten. DO NOT MERGE** — Merge nur nach Philips OK über CoS.
- Beide Seiten **indexierbar**: `noindex: false` (wie verein/apotheke auf main), Status-Feld `status: "draft"` unverändert lassen (entspricht main).
- Beide Seiten **in der Sitemap**.
- **Interne Verlinkung nur über die Footer-Spalte „Branchen“** (automatisch via `listBranchenFooterLinks()`). Keine zusätzlichen Links aus Blog, Muster-Seite, Homepage oder anderen Branchenseiten. Falls der „andere Branchen“-Block in `components/branchen-page.tsx` die neuen Seiten automatisch aufnimmt: nicht im Code ändern, sondern im PR vermerken — Content entscheidet.
- Texte **1:1** übernehmen; keine Preis-, Garantie- oder Aufwandssätze ergänzen, nichts umformulieren.
- `scripts/check-forbidden-words.mjs` und `scripts/check-sie-ansprache.mjs` grün; Build grün (lib/branchen.ts validiert Frontmatter, Blog-Links, Routen).
- **Keine Preview-Links als Abnahme**, sondern Screenshots (siehe 4.).

## Quellen
- `/workspace/gobd-content/branchen/verfahrensdokumentation-automaten.md` → `content/branchen/automaten.md`
- `/workspace/gobd-content/branchen/verfahrensdokumentation-hotel.md` → `content/branchen/hotel.md`
- Begründung und Sensibilitäts-Flags: `/workspace/gobd-content/branchen/2026-10-18-keyword-recherche.md`

## 1. Seiten registrieren
- Dateien nach `content/branchen/<slug>.md` kopieren (Dateiname = slug).
- `lib/branchen.ts`: `BRANCHEN_SLUGS = ["friseure", "einzelhandel", "taxi", "kiosk", "verein", "apotheke", "automaten", "hotel"]`.
- Routing über `lib/branchen-routes.ts` + `app/branchen/[slug]` wie bisher. Prüfen: `/verfahrensdokumentation-automaten` und `/verfahrensdokumentation-hotel` liefern 200, `/branchen/<slug>` leitet um, **kein** `noindex` im X-Robots-Tag/Meta.
- `musterVorlage`: automaten → `handel`, hotel → `dienstleister`; `readinessBranche`: `handel` / `dienstleistung`.
- Footer-Anker (H1 bis zum Doppelpunkt): „Verfahrensdokumentation für Automatenaufsteller“, „Verfahrensdokumentation für Hotels und Pensionen“.

## 2. Sitemap
- Beide Routen in `app/sitemap.ts` (bzw. automatisch über `listBranchenRoutes`, falls noindex=false dort ausreicht). In sitemap.xml der Preview kontrollieren.

## 3. Verlinkung der neuen Seiten
Die Seiten selbst verlinken nur auf existierende Blog-Slugs (gegen content/blog auf main geprüft: gobd-verfahrensdokumentation-erstellen, verfahrensdokumentation-kasse, -belegablage, aufbewahrungsfristen-gobd, -fehler, -pflicht, -aktualisieren, -systemwechsel, -gastronomie, -muster-einzelunternehmer, internes-kontrollsystem-verfahrensdokumentation, datenzugriff-betriebspruefung, betriebspruefung-mitwirkung-vorbereitung), /ampel-check, /readiness, /muster, /muster/gesamt/{handel,dienstleister}. Build validiert.

## 4. Abnahme und Rückmeldung an GoBD Content
- 200 beider Routen, indexierbar, in sitemap.xml, Footer-Spalte „Branchen“ zeigt 8 Einträge, FAQ-JSON-LD vorhanden, keine sichtbaren CTA-Labels, Prüfskripte grün.
- **4 Screenshots** (Full Page): `automaten-desktop.png` (1440 px), `automaten-mobile.png` (390 px), `hotel-desktop.png`, `hotel-mobile.png`.
- Dazu: Draft-PR-Link, Commit-Hash(es), Ergebnis der Prüfskripte, Hinweis zum „andere Branchen“-Block.
- Rückmeldung an **GoBD Content**; Freigabe an Philip läuft über CoS.
