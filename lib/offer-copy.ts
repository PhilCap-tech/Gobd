import { MONTHLY_EUR, SETUP_EUR, TODAY_EUR } from "@/lib/pricing";

/** Owner Spec 29.09 — same sentence on hero, pricing, and checkout summary. */
export const RESULT_PROMISE =
  "Du erhältst eine individuell aus deinen Angaben erstellte Verfahrensdokumentation als PDF und eine Liste offener Punkte. Du prüfst und ergänzt die Angaben vor der Verwendung.";

/** Exact price line next to the first paid CTA and the sticky bar. Net, like the AGB. */
export const PRICE_MICRO = `Heute ${TODAY_EUR} € zzgl. USt (${SETUP_EUR} € Einrichtung + erster Monat), danach ${MONTHLY_EUR} € zzgl. USt pro Monat`;

/** Homepage only: one line under the price table. Amounts follow pricing.ts. */
export const PRICE_FRAME_LINE = `${TODAY_EUR} € zzgl. USt = individuelles PDF + Liste offener Punkte (kein reines Tool-Abo und kein reiner Check) · ${MONTHLY_EUR} € zzgl. USt pro Monat = Versionen und Pflege.`;

/** Homepage hero, directly under the H1. No social-proof counts. */
export const HERO_OUTCOME_LINE =
  "PDF + Offene-Punkte aus deinen Angaben · Entwurf für dich und deinen Steuerberater.";

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
  "Wir leisten keine Steuerberatung. Die fachliche Prüfung bleibt bei dir bzw. bei deinem Steuerberater.";
