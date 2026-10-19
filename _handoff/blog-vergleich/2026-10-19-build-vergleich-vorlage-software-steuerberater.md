# Builder-Brief: Ratgeber „Verfahrensdokumentation: Vorlage, Software oder Steuerberater?“

**Datum:** 2026-10-19 · **Von:** GoBD Content · **An:** GoBD Builder
**Repo:** PhilCap-tech/Gobd (aktueller main) · **Branch-Vorschlag:** `feat/blog-vergleich-vorlage-software-steuerberater`

## Harte Regeln
- **Draft-PR. DO NOT MERGE** — den Merge übernimmt **CoS** nach Philips OK.
- Texte **1:1** übernehmen; nichts umformulieren, keine Preis-, Kosten-, Garantie- oder Aufwandssätze ergänzen.
- `scripts/check-forbidden-words.mjs` und `scripts/check-sie-ansprache.mjs` grün; Build grün.
- Abnahme per **Screenshots**, nicht per Preview-Link (siehe 4.).

## Quelle
- `/workspace/gobd-content/artikel/2026-10-19-verfahrensdokumentation-vorlage-software-steuerberater.md` → `content/blog/verfahrensdokumentation-vorlage-software-steuerberater.md`
- Nicht übernehmen: `/workspace/gobd-content/artikel/_review/2026-10-19-stbvv-passage-legal.md` (interne Prüfnotiz für GoBD Legal Draft).

## 1. Neuer Blogartikel (Commit 1)
- Datei anlegen, Dateiname = slug `verfahrensdokumentation-vorlage-software-steuerberater`.
- **Indexierung:** bis Philips OK `noindex` und nicht in der Sitemap. Die Quelldatei hat `noindex: true` und `status: "draft"`. Bestehende Blogartikel nutzen kein `noindex`-Feld, sondern `status` (z. B. `ready-for-publish`). Bitte gemäß Blog-Konvention in `content/blog/README.md` / Blog-Loader umsetzen: Wird `noindex` unterstützt, so belassen; sonst den Status-Wert verwenden, der Indexierung und Sitemap ausschließt, und im PR vermerken, welcher Mechanismus greift. Falls keiner existiert: im PR melden, nicht selbst einen bauen.
- Frontmatter-Felder `quellen` und `stand` belassen; falls der Loader sie ablehnt, im PR melden.
- `ctaSoft`/`ctaPrimary` nur aus dem Frontmatter; keine sichtbaren CTA-Labels.
- Externe Links (BStBK-PDF, IHK-PDF) wie in den übrigen Artikeln behandeln (`rel`/Target nach Repo-Konvention).

## 2. Anpassung `content/blog/verfahrensdokumentation-software.md` (Commit 2)
**NUR** diese zwei Änderungen, sonst nichts — kein Umformulieren, kein 301, kein Canonical:
1. In `secondaryKeywords` die Zeile `- "Verfahrensdokumentation online erstellen"` entfernen.
2. **Einen** Link auf den neuen Artikel im Abschnitt „## Weiterlesen“ ergänzen:
   `- [Verfahrensdokumentation: Vorlage, Software oder Steuerberater?](/blog/verfahrensdokumentation-vorlage-software-steuerberater)`
Hinweis: Solange der neue Artikel noindex ist, zeigt der Link auf eine noindex-Seite; das ist gewollt.

## 3. Prüfung
- Neuer Artikel: Route 200, noindex aktiv, nicht in sitemap.xml; alle internen Links 200 (8 Branchenseiten, /muster, /readiness, /ampel-check, /checkout, 6 Blogartikel).
- Software-Artikel: Diff zeigt genau 2 Zeilen (1 entfernt, 1 hinzugefügt).

## 4. Rückmeldung an GoBD Content
- Draft-PR-Link, Commit-Hashes, Ergebnis der Prüfskripte, verwendeter noindex-Mechanismus.
- **Screenshots** (Full Page) des neuen Artikels: `vergleich-desktop.png` (1440 px) und `vergleich-mobile.png` (390 px); dazu ein Ausschnitt des „Weiterlesen“-Blocks im Software-Artikel.
- Merge erfolgt durch **CoS**, nicht durch Builder.
