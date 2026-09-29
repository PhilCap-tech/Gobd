import { MONTHLY_EUR, SETUP_EUR, TODAY_EUR } from "@/lib/pricing";

/** Owner Spec 29.09 — same sentence on hero, pricing, and checkout summary. */
export const RESULT_PROMISE =
  "Du erhältst eine individuell aus deinen Angaben erstellte Verfahrensdokumentation als PDF und eine Liste offener Punkte. Du prüfst und ergänzt die Angaben vor der Verwendung.";

/** Exact price line next to the first paid CTA and the sticky bar. */
export const PRICE_MICRO = `Heute ${TODAY_EUR} € (${SETUP_EUR} € Einrichtung + erster Monat), danach ${MONTHLY_EUR} €/Monat`;

export const PRICE_CTA_SUFFIX = `Heute ${TODAY_EUR} €, danach ${MONTHLY_EUR} €/Monat`;

export const CTA_CREATE = "Dokumentation erstellen";
export const CTA_CREATE_WITH_PRICE = `${CTA_CREATE} — ${PRICE_CTA_SUFFIX}`;
export const CTA_MUSTER = "Muster-Dokument ansehen";
export const CTA_CHECK = "Kostenlosen 3-Minuten-Check machen";

/** FAQ section „14 Tage Geld-zurück“ (Variante B: full refund only before first PDF). */
export const GELD_ZURUECK_HREF = "/faq#geld-zurueck";

export const DISCLAIMER_ONCE =
  "Wir leisten keine Steuerberatung. Die fachliche Prüfung bleibt bei dir bzw. bei deinem Steuerberater.";
