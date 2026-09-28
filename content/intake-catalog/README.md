# Katalog-MVP Intake — vor „fertig“

**CoS-Lock:** Katalog-Fragen in **diesem Slice** im produktiven Erstellungsfluss, nicht erst nach Muster-PDF.  
**Soft-Invite Hold** bis (1) Generator/Templates/Export, (2) dieses Intake live, (3) neues Muster-PDF + Philip-Review.

## Datei
`INTAKE-CATALOG-MVP-v1.json` — Schritte A–I, Mindestfragen A01–I05 (Kern), Antwortstatus, Generator-Regel, Legacy-Bridge.

## Reihenfolge Slice
1. Generator/Templates/Export-Regeln + Partner-Fixes (läuft)
2. **Dieses Intake** verdrahten (Builder) — Delivery liefert Schema/Fragetexte hier
3. Muster-PDF aus erweitertem Flow → Philip-Review  
Voll-UI (alle Wiederhollisten/Nachweis-Uploads) danach iterieren.

## Pflicht-UX
- Jede Frage: Status `bestaetigt|geplant|unbekannt|nicht_zutreffend`
- Bei `nicht_zutreffend`: Grund-Feld
- Optional wo sinnvoll: Verantwortlicher, Bestätigungsdatum
- Conditional steps: D nur bei Papier; E02 bei E-Rechnung-Formaten
- Nie Stripe/stub im Kundendoc

## Fertig-Ping an Philip
Erst wenn (2) **live** im produktiven Flow — nicht nur Mapping auf altes Kurz-Intake.
