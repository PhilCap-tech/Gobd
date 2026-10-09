import { MONTHLY_EUR, SETUP_EUR, TODAY_EUR } from "@/lib/pricing";

/** Owner Spec 29.09 — same sentence on hero, pricing, and checkout summary. */
export const RESULT_PROMISE =
  "Sie erhalten eine individuell aus Ihren Angaben erstellte Verfahrensdokumentation als PDF und eine Liste offener Punkte. Sie prüfen und ergänzen die Angaben vor der Verwendung.";

/** Exact price line next to the first paid CTA and the sticky bar. Net, like the AGB. */
export const PRICE_MICRO = `Heute ${TODAY_EUR} € zzgl. USt (${SETUP_EUR} € Einrichtung + erster Monat), danach ${MONTHLY_EUR} € zzgl. USt pro Monat`;

/** Homepage only: one line under the price table. Amounts follow pricing.ts. */
export const PRICE_FRAME_LINE = `${TODAY_EUR} € zzgl. USt = individuelles PDF + Liste offener Punkte (kein reines Tool-Abo und kein reiner Check) · ${MONTHLY_EUR} € zzgl. USt pro Monat = Versionen und Pflege.`;

/** Homepage hero, directly under the H1. No social-proof counts. */
export const HERO_OUTCOME_LINE =
  "PDF + Offene-Punkte aus Ihren Angaben · Entwurf für Sie und Ihren Steuerberater.";

/** Homepage hero, after the CTA row. Competitor-watch copy 07.10.2026. */
export const HERO_FACTS_LINE =
  "24 Module · 5 Branchen-Muster · Muster-PDF ohne Anmeldung";

/**
 * Price block inclusion line. The cancellation timing from the old
 * „Monatlich kündbar …“ hint is appended at the call site so it is not repeated.
 */
export const PRICE_INCLUSION_LINE =
  "Alle 24 Module inklusive · keine Zusatzmodule · keine Jahresvorauszahlung · monatlich kündbar";

/** Equal-weight secondary pair in the homepage hero (above the fold). */
export const CTA_CHECK_HERO = "Kostenlosen 3-Minuten-Check";
export const CTA_MUSTER_HERO = "Muster ansehen";

export const PRICE_CTA_SUFFIX = `Heute ${TODAY_EUR} € zzgl. USt, danach ${MONTHLY_EUR} € zzgl. USt pro Monat`;

export const CTA_CREATE = "Dokumentation erstellen";
export const CTA_CREATE_WITH_PRICE = `${CTA_CREATE} — ${PRICE_CTA_SUFFIX}`;
export const CTA_MUSTER = "Muster-Dokument ansehen";
export const CTA_CHECK = "Kostenlosen 3-Minuten-Check machen";

/** FAQ section „14 Tage Zufriedenheitsgarantie“. */
export const GELD_ZURUECK_HREF = "/faq#geld-zurueck";

/** Short form for hero, sticky bar, and closing CTA. Details stay in the FAQ. */
export const GELD_ZURUECK_MICRO =
  "14 Tage Zufriedenheitsgarantie — volle Erstattung, solange noch kein PDF erzeugt wurde";

export const DISCLAIMER_ONCE =
  "Wir leisten keine Steuerberatung. Die fachliche Prüfung bleibt bei Ihnen bzw. bei Ihrem Steuerberater.";

/** Owner-Entscheidung 05.10.2026 / 24-Module 05.10.2026: ein Preis je Firma, alle Module inklusive. */
export const ALL_AREAS_LINE =
  "24 Module, alle inklusive – ein Preis für die komplette GoBD-Verfahrensdokumentation.";

export const ALL_AREAS_DETAIL =
  "Der Preis gilt je Firma. Darin enthalten ist das Gesamtdokument mit allen für den Betrieb relevanten Modulen (Unternehmen, Verkauf, Einkauf, Rechnungen, E-Rechnung, Papier, Zahlungsverkehr, Kasse, Buchführung, Warenwirtschaft, Anlagen, Personal, Onlineshop, Branche, Archiv, Fristen, Systeme, Rechte, Sicherung, Kontrollen, Auslagerung, Prüfungszugriff, Änderungen, Pflege). Module, die es bei Ihnen nicht gibt, werden als „nicht vorhanden“ begründet; vorhandene Bereiche werden nicht stillschweigend ausgelassen.";

/** Alias for pages that still say Bereiche. */
export const ALL_MODULES_LINE = ALL_AREAS_LINE;
export const ALL_MODULES_DETAIL = ALL_AREAS_DETAIL;

/**
 * Aufwand der Verfahrensdokumentation.
 * Kurz sind der Readiness-Check (drei Schritte, Schritt 1 zeigt „ca. 1 Minute“)
 * und der Betriebs-Check, der die Module freischaltet.
 * Lang ist die Beschreibung der Module. QA 08.10.2026, neun Testfirmen:
 * vollständiges Intake meist etwa 2–3 Stunden, Spanne etwa 1,5–5 Stunden.
 * Usability: Checkout und Betriebs-Check bleiben kurz; das Ausfüllen
 * der Dokumentation liegt bei etwa 2–3 Stunden. Keine Minuten-Zusage für das Gesamtdokument.
 *
 * Blog-Schlüsse übernehmen BLOG_CTA_EFFORT_LINE wörtlich.
 * Enthält ein Artikel noch die alte Minuten-Angabe oder INTAKE_EFFORT_LINE,
 * ersetzt sie rewriteLegacyEffortClaims beim Rendern. Siehe content/blog/README.md.
 * Die feinere Spanne (1,5 bis 5 Stunden) steht nur in INTAKE_EFFORT_RANGE und in der FAQ.
 */
export const INTAKE_EFFORT_LINE =
  "Der Einstieg ist der kurze Betriebs-Check; die Module füllen Sie danach in Etappen aus. Der Zwischenstand wird gespeichert, offene Module erscheinen als To-dos in Ihrem Konto, und „Später ausfüllen“ ist möglich.";

/**
 * Blog-CTA. Einstieg kurz, vollständige Dokumentation in Etappen.
 * „ca. 5 Minuten“ gilt nur für den Einstieg, nicht für das Gesamtdokument.
 */
export const BLOG_CTA_EFFORT_LINE =
  "Einstieg in ca. 5 Minuten. Die vollständige Dokumentation füllen Sie in Etappen aus – je nach Betrieb insgesamt ca. 2–3 Stunden.";

/** Nur dort, wo eine Gesamtdauer genannt wird (FAQ). Spanne aus dem QA-Durchlauf vom 08.10.2026. */
export const INTAKE_EFFORT_RANGE =
  "Für das vollständige Ausfüllen der bei Ihnen aktiven Module rechnen Sie orientierend mit etwa 2–3 Stunden, in der Spanne von etwa 1,5 bis 5 Stunden — je nachdem, wie viele Module vorkommen und wie griffbereit die Angaben sind.";

/** Readiness-Check bleibt der kurze Überblick. Die Dokumentation ist der längere, unterteilbare Teil. */
export const READINESS_EFFORT_NOTE = `Dieser Check ist der kurze Überblick in drei Schritten. ${INTAKE_EFFORT_LINE}`;

/** Steuerberater-Seite: der Mandant füllt aus, nicht die Kanzlei. */
export const PARTNER_EFFORT_LINE =
  "Für den Mandanten ist der Betriebs-Check der kurze Einstieg. Die Module füllt der Mandant in Etappen aus. Der Zwischenstand wird gespeichert, offene Module erscheinen als To-dos im Konto, und „Später ausfüllen“ ist möglich.";

/**
 * Macht alte Blog-Schlüsse ehrlich, auch wenn die tägliche Blog-Routine
 * den früheren Satz noch einsetzt. Garantie-, Preis- und Beratungssätze
 * bleiben stehen, weil sie nicht Teil der Muster sind.
 * Muster stehen als Konstruktor, damit der öffentliche Text die alte Zusage nicht mehr enthält.
 */
export function rewriteLegacyEffortClaims(source: string): string {
  const withEinstieg = new RegExp(
    "(?:Ca\\.\\s*)?5\\s*[–-]\\s*8\\s*Minuten(?:\\s+für\\s+den)?\\s*Einstieg\\.?",
    "g",
  );
  const bare = new RegExp(
    "(?:Ca\\.\\s*)?(?<!\\d)5\\s*[–-]\\s*8\\s*Minuten\\.?",
    "g",
  );
  return source
    .replace(withEinstieg, BLOG_CTA_EFFORT_LINE)
    .replace(bare, BLOG_CTA_EFFORT_LINE)
    .replace(/kurzes Intake/g, "geführtes Intake")
    .replaceAll(INTAKE_EFFORT_LINE, BLOG_CTA_EFFORT_LINE)
    .replace(
      /Einstieg typischerweise wenige Minuten, Nacharbeit bleibt/g,
      "Betriebs-Check kurz, Module in Etappen; Zwischenstand bleibt gespeichert",
    )
    .replace(/oft schnell, Fragen führen/g, "Fragen führen, Ausfüllen in Etappen");
}
