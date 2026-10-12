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
 * Eine Gesamtzeit nur als INTAKE_EFFORT_RANGE. Keine Minuten-Zusage für das Gesamtdokument.
 *
 * Neue Blogartikel übernehmen INTAKE_EFFORT_LINE wörtlich.
 * Enthält ein Artikel noch die alte Minuten-Angabe, ersetzt sie
 * rewriteLegacyEffortClaims beim Rendern. Siehe content/blog/README.md.
 */
export const INTAKE_EFFORT_LINE =
  "Der Einstieg ist der kurze Betriebs-Check; die Module füllen Sie danach in Etappen aus. Der Zwischenstand wird gespeichert, offene Module erscheinen als To-dos in Ihrem Konto, und „Später ausfüllen“ ist möglich.";

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
/**
 * Upsell auf Musterseiten, am Demo-Ende und als letzte Seite der Muster-PDFs.
 * Wortlaut Growth 09.10.2026. Beträge kommen aus pricing.ts, die Formulierung
 * bleibt die freigegebene Preiszeile.
 * Uploads bleiben drin: Datei-Upload und öffnen im Intake, Abruf über
 * /api/module-upload/file. Frühere Fassungen bleiben drin: Versionshistorie
 * im Konto verlinkt jede Fassung auf ihren PDF-Download.
 * Die Fußnote ist enthalten; das hochgestellte ¹ bleibt deshalb stehen.
 */
export const UPSELL_HEADLINE =
  "Das Muster zeigt eine fiktive Firma. Ihre Dokumentation zeigt Ihren Betrieb.";

export const UPSELL_SECTION_1_TITLE = "Ihre Abläufe statt Beispiel";

export const UPSELL_SECTION_1_TEXT =
  "Das Muster beschreibt ein erfundenes Unternehmen. Ihr Entwurf entsteht aus Ihren Angaben: Ihre Abläufe, Ihre Systeme, Ihre Verantwortlichen. Dazu erhalten Sie eine Liste offener Punkte, die Sie prüfen und ergänzen.";

export const UPSELL_SECTION_2_TITLE = "Keine einmalige Sache";

export const UPSELL_SECTION_2_TEXT =
  "Eine einmal erstellte Fassung bildet nur den heutigen Stand ab. Ändern sich Software, Abläufe oder Zuständigkeiten, ist die Verfahrensdokumentation nachzuziehen. Frühere Fassungen bleiben aufbewahrungspflichtig, Änderungen müssen nachvollziehbar versioniert sein.¹";

export const UPSELL_SECTION_3_TITLE = "Darum ein Monatsabo";

export const UPSELL_BULLETS = [
  "Versionierung: jede Fassung mit Änderungshistorie",
  "Speicherung Ihrer Dokumentation und früherer Fassungen",
  "Änderungen jederzeit nachtragen, wenn sich in Ihrem Betrieb etwas ändert",
  "Konto mit To-dos für offene Punkte und Module, inklusive Uploads",
] as const;

export const UPSELL_EFFORT_NOTE =
  "Sie können in Etappen arbeiten, der Stand wird gespeichert.";

export const UPSELL_PRICE = `heute ${TODAY_EUR} € zzgl. USt, danach ${MONTHLY_EUR} €/Monat, monatlich kündbar, alle 24 Module inklusive`;

export const UPSELL_PRICE_BREAKDOWN = `${TODAY_EUR} € = ${SETUP_EUR} € Einrichtung + ${MONTHLY_EUR} € erster Monat`;

export const UPSELL_CTA = "Eigene Dokumentation erstellen";

export const UPSELL_CTA_HREF = "/checkout";

export const UPSELL_DISCLAIMER =
  "Sie erhalten einen Entwurf, den Sie prüfen und ergänzen · keine Steuerberatung";

export const UPSELL_FOOTNOTE =
  "¹ Vgl. GoBD (BMF-Schreiben vom 28.11.2019 in der Fassung vom 14.07.2025), Rz. 150 und 154; § 147 AO.";

export const PDF_UPSELL_HEADLINE = "Dieses Muster zeigt eine fiktive Firma.";

export const PDF_UPSELL_BODY =
  "Ihre Verfahrensdokumentation beschreibt Ihre eigenen Abläufe, Systeme und Verantwortlichen – als Entwurf mit Liste offener Punkte. Ändern sich Software, Abläufe oder Zuständigkeiten, ist sie nachzuziehen; frühere Fassungen sind aufzubewahren.¹ Im Monatsabo werden Ihre Fassungen versioniert und gespeichert, Sie tragen Änderungen jederzeit nach, To-dos und Uploads liegen in Ihrem Konto. Sie können in Etappen arbeiten, der Stand wird gespeichert.";

export const PDF_UPSELL_PRICE = UPSELL_PRICE;

export const PDF_UPSELL_URL = "gobd-doku-erstellen.de/checkout";

export const PDF_UPSELL_CTA = `Eigene Dokumentation erstellen: ${PDF_UPSELL_URL}`;

export const PDF_UPSELL_DISCLAIMER =
  "Entwurf zum Prüfen und Ergänzen · keine Steuerberatung";

export const PDF_UPSELL_FOOTNOTE = "¹ Vgl. GoBD Rz. 150, 154; § 147 AO.";

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
    .replace(withEinstieg, INTAKE_EFFORT_LINE)
    .replace(bare, INTAKE_EFFORT_LINE)
    .replace(/kurzes Intake/g, "geführtes Intake")
    .replace(
      /Einstieg typischerweise wenige Minuten, Nacharbeit bleibt/g,
      "Betriebs-Check kurz, Module in Etappen; Zwischenstand bleibt gespeichert",
    )
    .replace(/oft schnell, Fragen führen/g, "Fragen führen, Ausfüllen in Etappen");
}
