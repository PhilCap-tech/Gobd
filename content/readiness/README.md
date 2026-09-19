# Readiness-Module (GoBD-Grundlagen)

Branchen-Arbeitshilfen für den kostenlosen Readiness-Check. **Keine** fertige Verfahrensdokumentation.

Quelle: GoBD Content, Stand 2026-09-19. Platzhalter: `{{Branche}}`, `{{Firma}}`, `{{Datum}}`.

| UI-Schlüssel | Datei | Anzeigename |
|--------------|--------|-------------|
| `handwerk` | `handwerk.md` | Handwerk |
| `handel` | `handel.md` | Handel |
| `praxis` | `praxis.md` | Praxis / Heilberufe |
| `gastronomie` | `gastronomie.md` | Gastronomie |
| `dienstleistung` | `dienstleistung.md` | Dienstleistung |
| `allgemein` / leer / unbekannt | `allgemein.md` | Allgemein |

Renderer: `lib/readiness.ts` → PDF über denselben markdown-ish Writer wie Delivery (`lib/pdf-markdown.ts`).
