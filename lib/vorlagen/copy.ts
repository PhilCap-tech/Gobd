import { AMPEL_CONSENT_TEXT_VERSION, AMPEL_MARKETING_CONSENT } from "@/lib/ampel-questions";

/** Fassung des Formularhinweises. Kein Ersatz für die Datenschutzerklärung. */
export const MAGNET_PRIVACY_NOTE_VERSION = "2026-10-25";

export const MAGNET_PRIVACY_NOTE =
  "Wir senden Ihnen die angeforderte Vorlage erst, nachdem Sie Ihre E-Mail-Adresse über einen Link bestätigt haben. Die Adresse verwenden wir für diesen Versand. Werbung erhalten Sie nur, wenn Sie unten ausdrücklich zustimmen. Mehr dazu in unserer Datenschutzerklärung.";

/** Bestehender Newsletter-Text. Nicht vorausgewählt. Eigene Versionsangabe. */
export const MAGNET_MARKETING_CONSENT = AMPEL_MARKETING_CONSENT;
export const MAGNET_MARKETING_TEXT_VERSION = AMPEL_CONSENT_TEXT_VERSION;

export const MAGNET_EMAIL_LABEL = "E-Mail-Adresse";
export const MAGNET_EMAIL_INVALID = "Bitte geben Sie eine gültige E-Mail-Adresse ein.";
export const MAGNET_INPUT_INVALID = "Bitte prüfen Sie Ihre Eingabe.";
export const MAGNET_CALC_INVALID = "Die Angaben zum Rechner sind ungültig.";
export const MAGNET_RATE_LIMITED = "Bitte versuchen Sie es in einer Stunde erneut.";
export const MAGNET_SEND_FAILED = "Der Versand ist gerade nicht möglich. Bitte versuchen Sie es später erneut.";
export const MAGNET_LATER = "Bitte versuchen Sie es später erneut.";

export const MAGNET_SUBMIT_BUTTON = "Vorlage anfordern";
export const MAGNET_SUBMIT_PENDING = "Wird gesendet …";
export const MAGNET_SUBMIT_SUCCESS =
  "Bitte prüfen Sie Ihr Postfach. Wir senden Ihnen einen Bestätigungslink. Der Link ist 48 Stunden gültig. Die Vorlage erhalten Sie erst nach der Bestätigung.";

export const MAGNET_CONFIRM_TITLE = "E-Mail-Adresse bestätigt";
export const MAGNET_CONFIRM_BODY =
  "Sie können die Vorlage jetzt herunterladen. Den gleichen Link erhalten Sie auch per E-Mail. Er ist 30 Tage gültig.";
export const MAGNET_DOWNLOAD_LABEL = "Vorlage herunterladen";
export const MAGNET_CONFIRM_PENDING = "Ihre Bestätigung wird geprüft.";
export const MAGNET_LINK_INVALID = "Dieser Link ist ungültig.";
export const MAGNET_LINK_EXPIRED = "Dieser Link ist abgelaufen. Fordern Sie einen neuen Link an.";
export const MAGNET_RENEW_BUTTON = "Neuen Link anfordern";
export const MAGNET_RENEW_PENDING = "Der Link wird angefordert …";
export const MAGNET_RENEW_DONE = "Wir haben Ihnen einen neuen Link gesendet. Bitte prüfen Sie Ihr Postfach.";

export const MAGNET_MARKETING_CONFIRM_TITLE = "E-Mail-Informationen bestätigt";
export const MAGNET_MARKETING_CONFIRM_BODY =
  "Sie erhalten künftig Informationen zu GoBD-Themen und Angeboten. Die angeforderte Vorlage hängt nicht von dieser Einwilligung ab.";
export const MAGNET_MARKETING_WITHDRAWN =
  "Für diese Adresse sind keine E-Mail-Informationen mehr vorgemerkt. Eine bereits angeforderte Vorlage bleibt davon unberührt.";
export const MAGNET_UNSUBSCRIBE_TITLE = "Abmeldung";
export const MAGNET_UNSUBSCRIBE_BODY =
  "Sie erhalten keine weiteren E-Mail-Informationen. Eine bereits angeforderte Vorlage können Sie weiterhin über den Download-Link abrufen, solange dieser gültig ist.";
export const MAGNET_UNSUBSCRIBE_BUTTON = "E-Mail-Informationen abbestellen";

export function magnetConsentVersion(marketing: boolean): string {
  const base = `vorlage:${MAGNET_PRIVACY_NOTE_VERSION}`;
  if (!marketing) return base;
  return `${base}+newsletter:${MAGNET_MARKETING_TEXT_VERSION}`;
}

export const MAGNET_OVERVIEW_TITLE = "Vorlagen";
export const MAGNET_OVERVIEW_INTRO =
  "Drei Arbeitshilfen zur Verfahrensdokumentation. Die Checkliste und die Gliederungsvorlage senden wir Ihnen als PDF, nachdem Sie Ihre E-Mail-Adresse bestätigt haben. Den Kostenrechner können Sie direkt nutzen. Das Ergebnis-PDF senden wir ebenfalls erst nach der Bestätigung.";

export const MAGNET_GATE_INTRO =
  "Die Vorlage senden wir Ihnen als PDF, nachdem Sie Ihre E-Mail-Adresse bestätigt haben. Vorher liegt die Datei nicht zum Abruf bereit.";

export const MAGNET_PDF_BUTTON = "Ergebnis als PDF per E-Mail";
