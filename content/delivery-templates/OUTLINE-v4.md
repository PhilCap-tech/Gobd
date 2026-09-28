# GoBD Delivery — Outline v4 (Philip Muster detailliert)

**Referenz:** `reference/philip-muster-v2-detailliert-2026-09-28.docx`  
**Stand:** 2026-09-28 | Soft-Invite Hold  
**Qualität:** Präsens nur bei bestätigtem Intake; sonst Hinweis/OP; Kapitel/Zweige conditional omit  
**Vorgänger:** v3 (philip-muster kurz) — **nicht** mehr Qualitätsziel

Aktives Renderer-Ziel. Die Kapiteldateien von Delivery v4 (`00-cover-freigabe.md` … `B-begriffe.md`) sind als Zwischenadapter eingebunden. `chapter-schema.json` und `bundle.json` **4.0.0** fehlen noch (`gobd-delivery-templates/`). Fassung bleibt **3.0.0**. Kein Produktions-Qualitätsclaim und keine Review-Freigabe, bis Schema und Bundle 4.0.0 liegen.

## Kundendoc-Struktur

| # | Kapitel | Typ | Hinweise |
|---|---|---|---|
| 0 | Deckblatt + Dokumentmerkmale + **Freigabevermerk** | I/S | Kein Stripe/Stub; Sign-off-Platzhalter GF |
| DL | **Dokumentenlenkung** (ID, Version, gültig ab, nächste Prüfung, Speicherort, Vorversion, Anlass) | I/S | Tabelle |
| 1 | Zweck, Geltungsbereich und Verantwortung | S+I | inkl. fachliche Grundlage (Rahmen) |
| 2 | Unternehmen, Rollen und Aufgaben | I | **Rollenmatrix** Ausführung \| Kontrolle |
| 3 | Systemlandschaft und Datenfluss | I | Systemtabelle + Fluss; Vorsysteme |
| 4 | Belegarten und Eingangskanäle | I/C | Nur bestätigte Kanäle als Zeilen |
| 5 | Eingangsrechnungen und E-Rechnungen | I/C | Canonical E-Rechnung; Validierung→OP wenn unbestätigt |
| 6 | Papierbelege und Digitalisierung | C | **omit** wenn kein Papier |
| 7 | Ausgangsrechnungen und Korrekturen | I/C | |
| 8 | Prüfung, Freigabe und Buchungsübergabe | I | **Statuskette** Eingegangen→…→Gebucht |
| 9 | Ablage, Aufbewahrung und Datenzugriff | I+S | Canonical: Buchungsbelege **8 Jahre** |
| 10 | Berechtigungen, Sicherung und Notfall | I/O | Rechte-Matrix; Backup-Test→OP |
| 11 | Internes Kontrollsystem | I/O | **IKS-Tabelle nur bestätigte Kontrollen**; sonst OP |
| 12 | Versionspflege und Änderungen | S+I | |
| 13 | Mitgeltende Unterlagen | I/O | Status vorhanden/offen |
| 14 | Offene Punkte und Maßnahmen | O | ID \| **Prio** \| Text \| Verantwortung \| **Zieltermin** |
| A | Anhang Prozessmatrix | I/S | P01–P08 aus bestätigten Schritten |
| B | Anhang Begriffe | S | Beleg-ID, E-Rechnung, Originaldatei, OP, Ist-Aussage, Mitgeltende Unterlage |

## Builder-Hooks
- Conditionals: Papier (Kap.6), E-Rechnung-Zweig (Kap.5), Ausgang (Kap.7)
- OP-Shape v4: `{id, priority, text, responsibility, dueDate?}`
- Freigabevermerk nie auto-bestätigt
- Fachtexte: `CANONICAL-SNIPPETS-aufbewahrung-erechnung.md`
- Mapping: `FRAGE-ID-MAPPING-v1.md` (MVP) — Kapitelnummern auf v4 umbiegen bei Nachzug

## Nicht finalisieren als Produktions-Qualitätsclaim
bis Philip Muster-PDF aus Generator gegen **dieses** v2-Muster freigibt.
