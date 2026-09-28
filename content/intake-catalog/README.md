# Katalog-MVP Intake — vor „fertig“

**CoS-Lock:** Katalog-Fragen in **diesem Slice** im produktiven Erstellungsfluss, nicht erst nach Muster-PDF.  
**Soft-Invite an echte Kanzleien bleibt Hold.** Smoke und Merge entscheidet CoS. Kein Ping an Philip aus diesem Stand.

## Datei
`INTAKE-CATALOG-MVP-v1.json` — Schritte A–I, Mindestfragen A01–I05 (Kern), Antwortstatus, Generator-Regel, Legacy-Bridge.

## Reihenfolge Slice
1. Generator/Templates/Export-Regeln + Partner-Fixes (läuft)
2. **Dieses Intake** verdrahten (Builder) — Delivery liefert Schema/Fragetexte hier
3. Muster-PDF aus erweitertem Flow  
Voll-UI (alle Wiederhollisten/Nachweis-Uploads) danach iterieren.

## Pflicht-UX
- Jede Frage: Status `bestaetigt|geplant|unbekannt|nicht_zutreffend`
- Bei `nicht_zutreffend`: Grund-Feld
- Optional wo sinnvoll: Verantwortlicher, Bestätigungsdatum
- Conditional steps: D nur bei Papier; E02 bei E-Rechnung-Formaten
- Nie Stripe/stub im Kundendoc

## Smoke
Review-ready an Builder/CoS, wenn der Katalog im produktiven Flow hängt — nicht nur als Mapping auf das alte Kurz-Intake. Philip erst, wenn CoS die vier Live-Kriterien bestätigt.
