import {
  generateLeadMagnetPdfFrom,
  leadMagnetReadinessAbsoluteUrlFor,
  leadMagnetReadinessHrefFor,
  type LeadMagnetCopy,
} from "@/lib/lead-magnet";

export const INHALT_GLIEDERUNG_SLUG = "inhalt-verfahrensdokumentation";
export const INHALT_GLIEDERUNG_FILENAME =
  "inhalt-verfahrensdokumentation-mini-gliederung.pdf";
export const INHALT_GLIEDERUNG_PATH = "/resources/inhalt-verfahrensdokumentation";
export const INHALT_GLIEDERUNG_DOWNLOAD_PATH =
  "/resources/inhalt-verfahrensdokumentation/download";

/** Soft CTA only. Campaign params stay on this magnet. */
export const INHALT_GLIEDERUNG_UTM =
  "utm_source=leadmagnet&utm_medium=pdf&utm_campaign=inhalt-gliederung";

export const INHALT_GLIEDERUNG_HEADLINE =
  "Inhalt einer Verfahrensdokumentation — Mini-Gliederung für KMU";
export const INHALT_GLIEDERUNG_SUBHEAD =
  "Kurzüberblick zum Abhaken — keine Steuerberatung";
export const INHALT_GLIEDERUNG_INTRO =
  "Die Verfahrensdokumentation soll einem sachverständigen Dritten eure Belegwege erklären — so, wie sie bei euch wirklich laufen. Diese Mini-Gliederung hilft dir, den Inhalt grob zu sortieren. Sie ersetzt keine Beratung und keine Freigabe durch dich bzw. deinen Steuerberater.";

export const INHALT_GLIEDERUNG_POINTS = [
  {
    title: "Zweck & Geltungsbereich",
    body: "Kurz: für welchen Betrieb / welche Prozesse gilt die Doku? Stand und Version notiert.",
  },
  {
    title: "Organisation & Rollen",
    body: "Wer erfasst Belege, wer prüft, wer bucht, wer freigibt die Doku? Vertretung wo nötig.",
  },
  {
    title: "Belegarten & Herkunft",
    body: "Welche Belege (Eingang, Ausgang, Kasse, Bank …) und wo entstehen sie (Papier, E-Mail, Portal, App)?",
  },
  {
    title: "Belegweg Ende-zu-Ende",
    body: "Vom Eingang bis Ablage/Buchhaltung: Schritte, Kontrollen, typische Ausnahmen — in eurer Sprache.",
  },
  {
    title: "Systeme & Datenzugriff",
    body: "Welche Software (Beispiele: DATEV, sevdesk, lexoffice — nur soweit bei euch relevant), wo Daten liegen, Export/Backup soweit für euch beschrieben.",
  },
  {
    title: "Scan / Digitales Archiv (falls zutreffend)",
    body: "Wenn Originale vernichtet werden: Scanprozess, Qualitätskontrolle, Vernichtungsregeln, Ausnahmen — sonst klar „nicht ersetzend / Originale bleiben“.",
  },
  {
    title: "Änderung & Versionierung",
    body: "Wann wird aktualisiert (Software-/Prozesswechsel)? Wer pflegt? Wo liegt die freigegebene Version?",
  },
] as const;

export const INHALT_GLIEDERUNG_CTA_TITLE = "Unsicher, wo ihr steht?";
export const INHALT_GLIEDERUNG_CTA_BEFORE = "Kostenloser ";
export const INHALT_GLIEDERUNG_CTA_LINK_LABEL = "Readiness-Check";
export const INHALT_GLIEDERUNG_CTA_AFTER =
  " — kurze Fragen zu Branche, Software, Belegwegen und IT. Ohne Kreditkarte. Keine Steuerberatung.";

export const INHALT_GLIEDERUNG_DISCLAIMER =
  "Allgemeine Arbeitshilfe von gobd-doku-erstellen.de. Keine Steuer-, Rechts- oder Prüfungsberatung. Keine Zusicherung von GoBD-Konformität, Vollständigkeit oder Prüfungsergebnis. Abstimmung und Freigabe bleiben bei dir bzw. deinem Berater.";

export function inhaltGliederungReadinessHref(): string {
  return leadMagnetReadinessHrefFor(INHALT_GLIEDERUNG_UTM);
}

/** Saved PDFs open later, so the link uses the canonical production origin. */
export function inhaltGliederungReadinessAbsoluteUrl(): string {
  return leadMagnetReadinessAbsoluteUrlFor(INHALT_GLIEDERUNG_UTM);
}

function inhaltGliederungCopy(): LeadMagnetCopy {
  return {
    headline: INHALT_GLIEDERUNG_HEADLINE,
    subhead: INHALT_GLIEDERUNG_SUBHEAD,
    intro: INHALT_GLIEDERUNG_INTRO,
    points: INHALT_GLIEDERUNG_POINTS,
    ctaTitle: INHALT_GLIEDERUNG_CTA_TITLE,
    ctaBefore: INHALT_GLIEDERUNG_CTA_BEFORE,
    ctaLinkLabel: INHALT_GLIEDERUNG_CTA_LINK_LABEL,
    ctaAfter: INHALT_GLIEDERUNG_CTA_AFTER,
    disclaimer: INHALT_GLIEDERUNG_DISCLAIMER,
    readinessAbsoluteUrl: inhaltGliederungReadinessAbsoluteUrl(),
  };
}

export function generateInhaltGliederungPdf(): Promise<Buffer> {
  return generateLeadMagnetPdfFrom(inhaltGliederungCopy());
}
