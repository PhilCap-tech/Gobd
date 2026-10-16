# Builder-Brief: Lead-Magnet „Kassen- und TSE-Meldecheck“

**Datum:** 2026-10-16 · **Von:** GoBD Content · **An:** GoBD Builder
**Repo:** PhilCap-tech/Gobd (aktueller main) · **Branch-Vorschlag:** `feat/kassen-check`

## Harte Regeln
- **Draft-PR. DO NOT MERGE** — Merge nur nach Philips Freigabe.
- Seite `noindex, follow`, **nicht in der Sitemap**, bis Philip freigibt.
- Texte **1:1** aus `/workspace/gobd-content/lead-magnete/2026-10-16-kassen-tse-meldecheck.md`; keine Fristen-, Preis-, Garantie- oder Datenschutzaussagen ergänzen (insbesondere **keine** Aussage zu automatischer Löschung).
- Keine sichtbaren CTA-Labels; Ziele `/readiness` und `/ampel-check` kommen aus dem Frontmatter.
- `scripts/check-forbidden-words.mjs` und `scripts/check-sie-ansprache.mjs` grün; Build grün.
- **Zwei Commits:** (1) Check-Seite, (2) Teaser auf den Branchenseiten.

## 1. Route
- Vorschlag: **`/kassen-check`**. Geprüft am 2026-10-16 gegen `app/` auf main: kein Ordner `kassen-check`; vorhanden sind u. a. `ampel-check`, `readiness`, `branchen/[slug]`. Bitte zusätzlich Rewrites/Redirects in `next.config` und `lib/branchen-routes.ts` auf Kollision prüfen; bei Konflikt Alternative `/kassen-meldecheck` und im PR notieren.

## 2. Umsetzung (Commit 1)
- Fragen als `lib/kassen-check-questions.ts` nach Vorbild `lib/ampel-questions.ts` (`id`, `question`, `explanation`, `weight`, `applicable`, `source`); IDs/Gewichte wie im Content-Dokument.
- Seite `app/kassen-check/page.tsx`, Komponente/Auswertung des Ampel-Checks wiederverwenden (Grün/Gelb/Rot, „Trifft nicht zu“ nicht gewertet). Schwellen wie Ampel-Check; im PR angeben, welche.
- Ergebnis wird ohne E-Mail angezeigt. Opt-in nur E-Mail-Feld; vorhandene Mail-/Opt-in-Infrastruktur des Ampel-Checks nutzen, falls vorhanden; sonst Feld ohne Funktion lassen und im PR markieren (kein neuer Datenfluss ohne Philips Freigabe).
- Disclaimer unter jedem Ergebnis, Quellen pro Frage sichtbar.

## 3. Teaser auf Branchenseiten (Commit 2, separat)
Seiten: `content/branchen/kiosk.md`, `friseure.md`, `einzelhandel.md`, `taxi.md`. Position: direkt nach dem Abschnitt „Kasse und Bargeld“ (bzw. dessen Vertiefungs-Link).
Bevorzugt als Komponente (`<KassenCheckTeaser />` o. ä.), sonst als Markdown-Absatz:

> **Kassen- und TSE-Meldecheck**
> Sind Ihre Kassen mit TSE ausgestattet und beim Finanzamt gemeldet — auch nach einem Austausch oder einer Außerbetriebnahme? Sechs Fragen mit Erläuterungen und Quellen geben Ihnen eine erste Orientierung. [Zum Kassen- und TSE-Meldecheck](/kassen-check)

Hinweis Taxi: Der Check behandelt Kassensysteme; EU-Taxameter haben laut BMF-Schreiben teils abweichende Regeln. Für `taxi.md` daher diese Variante:

> **Kassen- und TSE-Meldecheck**
> Nutzen Sie neben dem Taxameter auch eine elektronische Kasse? Sechs Fragen mit Erläuterungen und Quellen geben Ihnen eine erste Orientierung zu TSE und Meldung. [Zum Kassen- und TSE-Meldecheck](/kassen-check)

Ankertext ist ein beschreibender Link, kein CTA-Label. Branchenseiten bleiben `noindex`, falls noch nicht freigegeben.

## 4. Abnahme und Rückmeldung an GoBD Content
- 200 auf der Route, X-Robots-Tag `noindex, follow`, nicht in sitemap.xml, Prüfskripte grün.
- **Screenshots** statt Preview-Links: Check-Seite Desktop + Mobile (Fragen und je ein Ergebnis Grün/Gelb/Rot), dazu je ein Desktop-Screenshot des Teasers auf den vier Branchenseiten.
- Draft-PR-Link, Commit-Hashes, Schwellenwerte, Status des Opt-ins (angebunden / nur Feld).
