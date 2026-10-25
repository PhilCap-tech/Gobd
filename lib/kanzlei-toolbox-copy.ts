import { LEGAL_OPERATOR } from "@/lib/legal";
import { MONTHLY_EUR, SETUP_EUR } from "@/lib/pricing";

/** Draft marker for pages that are not the published legal texts. */
export const KANZLEI_TOOLBOX_DRAFT_BANNER =
  "Entwurf, noch nicht freigegeben. Dieser Text ist nicht Bestandteil der veröffentlichten Datenschutzerklärung oder der AGB. Stand und offene Fristen legt der Anbieter noch fest.";

export const KANZLEI_TOOLBOX_CONSENT_TEXT_VERSION = "2026-10-25-entwurf";

export const KANZLEI_TOOLBOX_AUTHORITY_TEXT =
  "Ich bin Steuerberater/in der angemeldeten Kanzlei oder handle mit Befugnis für die angemeldete Kanzlei. Die Kanzlei ist eine Steuerberaterpraxis oder eine Steuerberatungsgesellschaft.";

export const KANZLEI_TOOLBOX_TERMS_TEXT =
  "Ich habe die Teilnahmebedingungen gelesen und stimme zu, dass die IKAT GmbH den geprüften Kanzleinamen als Text in der Zeile „Hinweis von [Kanzleiname]“ auf dem Ampel-Check anzeigt, der über unseren Link aufgerufen wird (Ziffer 7). Ich kann das jederzeit kostenfrei widerrufen.";

export const KANZLEI_TOOLBOX_REPORT_TEXT =
  "Ich möchte den monatlichen Bericht mit zusammengefassten Zahlen zu unserem Link. Werte unter 5 werden darin nicht als Zahl genannt. Käufe und Ergebnisse enthält der Bericht nicht. Den Bericht kann ich jederzeit abbestellen.";

export const KANZLEI_TOOLBOX_PRIVACY_HINT =
  "Informationen zur Verarbeitung Ihrer Angaben finden Sie in unserer Datenschutzerklärung. Der Abschnitt zur Kanzlei-Toolbox ist noch ein Entwurf und noch nicht veröffentlicht.";

export function kanzleiHinweisText(name: string): { title: string; body: string } {
  return {
    title: `Hinweis von ${name}`,
    body: `Der Ampel-Check ist ein kostenloses Angebot der ${LEGAL_OPERATOR.name}. ${name} hat ihn nicht erstellt und nicht geprüft. Der Check ist nicht erstellt und nicht geprüft von der Kanzlei. ${name} erhält Ihre Antworten, Ihr Ergebnis und Ihre E-Mail-Adresse nicht. Wir speichern, dass Sie über diesen Link gekommen sind.`,
  };
}

export function kanzleiFormLine(name: string): string {
  return `Ihre Anfrage ordnen wir dem Link von ${name} zu. ${name} erhält Ihre Daten nicht.`;
}

export const KANZLEI_TOOLBOX_HEADING = "Kanzlei-Toolbox: Der kostenlose GoBD-Ampel-Check für Ihre Mandanten";

export const KANZLEI_TOOLBOX_LEAD =
  "Melden Sie Ihre Kanzlei an. Nach der Bestätigung Ihrer E-Mail-Adresse erhalten Sie Ihren persönlichen Link zum Ampel-Check, ein Merkblatt für Mandanten und Textbausteine für Ihren Mandanten-Newsletter.";

export const KANZLEI_TOOLBOX_POINTS = [
  "Ihr Link: Mandanten sehen im Check die Zeile „Hinweis von [Ihre Kanzlei]“, als reinen Text und ohne Logo. Der Name erscheint erst nach dem Abgleich mit Impressum und amtlichem Steuerberaterverzeichnis.",
  "Ihre Mandanten beantworten 10 Ja/Nein-Fragen in rund 2 Minuten und erhalten eine Ampel-Einschätzung mit Quellen.",
  "Antworten und E-Mail-Adressen Ihrer Mandanten erhalten Sie nicht. Sie übermitteln uns keine Mandantendaten.",
  "Die Toolbox ist kostenlos. Die Kanzlei erhält von der IKAT GmbH keine Provision, keine Vergütung und keine sonstige Gegenleistung für Hinweise oder vermittelte Aufträge. Preise für Mandanten bleiben die allgemeinen Preise.",
  "Sie können den Eintrag jederzeit kostenfrei widerrufen. Der Name entfällt dann sofort.",
] as const;

export const KANZLEI_TOOLBOX_FORM_TITLE = "Toolbox anfordern";

export const KANZLEI_TOOLBOX_SUCCESS =
  "Bitte bestätigen Sie Ihre E-Mail-Adresse über den Link in unserer Nachricht. Vorher ist die Anmeldung nicht aktiv, und der Kanzleiname wird nicht angezeigt.";

export const KANZLEI_TOOLBOX_FIELDS = {
  name: "Kanzleiname, so wie er angezeigt werden soll",
  website: "Website der Kanzlei",
  email: "Dienstliche E-Mail-Adresse",
  city: "Ort",
} as const;

export function kanzleiNewsletterShort(slug: string): string {
  return [
    "GoBD: Kostenloser Ampel-Check für Ihr Unternehmen",
    "Haben Sie Ihre Abläufe rund um Belege, Kasse und Aufbewahrung schriftlich beschrieben? Mit dem kostenlosen GoBD-Ampel-Check der IKAT GmbH beantworten Sie in rund 2 Minuten 10 Ja/Nein-Fragen und sehen, wo Handlungsbedarf besteht. Das Ergebnis besprechen wir gern mit Ihnen:",
    `https://www.gobd-doku-erstellen.de/k/${slug}`,
    "Selbsteinschätzung, keine Steuer- oder Rechtsberatung. Wir erhalten für diesen Hinweis keine Vergütung.",
  ].join("\n");
}

export function kanzleiNewsletterLong(slug: string): string {
  return [
    "GoBD-Verfahrensdokumentation: Wo steht Ihr Unternehmen?",
    "Die GoBD verlangen, dass Unternehmen nachvollziehbar beschreiben, wie Belege eingehen, verarbeitet, gebucht und aufbewahrt werden. Diese Beschreibung heißt Verfahrensdokumentation.",
    "Einen ersten Überblick gibt der kostenlose GoBD-Ampel-Check der IKAT GmbH:",
    "- 10 Ja/Nein-Fragen, unter anderem zu Kasse, Belegablage, E-Rechnung und Aufbewahrung",
    "- rund 2 Minuten, die Ampelfarbe sehen Sie sofort",
    "- auf Wunsch die Auswertung mit Quellen per E-Mail",
    "Ihre Antworten gehen an die IKAT GmbH, nicht an unsere Kanzlei. Wenn Sie möchten, besprechen wir das Ergebnis und die offenen Punkte anschließend gemeinsam.",
    `Zum Check: https://www.gobd-doku-erstellen.de/k/${slug}`,
    "Der Check ist eine Selbsteinschätzung zur Orientierung und keine Steuer- oder Rechtsberatung. Anbieter: IKAT GmbH, Monheim am Rhein. Wir erhalten für diesen Hinweis keine Vergütung.",
  ].join("\n");
}

export const KANZLEI_TOOLBOX_NEWSLETTER_NOTE =
  "Bitte senden Sie die Bausteine nur an Empfänger, die Ihrem Newsletter wirksam zugestimmt haben. Die Ausnahme für Bestandskunden gilt für Angebote Dritter in der Regel nicht. Sie dürfen die Bausteine kürzen. Der Link muss unverändert bleiben.";

export function kanzleiMerkblattLines(name: string, slug: string): string[] {
  return [
    "GoBD-Ampel-Check: In rund 2 Minuten wissen, wo Sie stehen",
    `Ein Hinweis von ${name} auf ein kostenloses Angebot der ${LEGAL_OPERATOR.name}`,
    "Worum geht es?",
    "Wer Bücher führt oder Aufzeichnungen erstellt, muss die GoBD beachten. Dazu gehört eine Verfahrensdokumentation: eine Beschreibung, wie Belege eingehen, verarbeitet, gebucht und aufbewahrt werden.",
    "Was der Ampel-Check zeigt",
    "10 Ja/Nein-Fragen, unter anderem zu Verfahrensdokumentation, Kasse, Belegablage, E-Rechnung und Aufbewahrung. Ihre Ampelfarbe sehen Sie sofort. Die Auswertung mit Quellen erhalten Sie auf Wunsch per E-Mail.",
    "So geht es",
    `1. Link öffnen oder QR-Code scannen: https://www.gobd-doku-erstellen.de/k/${slug}`,
    "2. Fragen beantworten (rund 2 Minuten, kostenlos).",
    "3. Ergebnis ansehen und offene Punkte mit Ihrer Steuerkanzlei besprechen.",
    "Gut zu wissen",
    `Ihre Antworten und Ihre E-Mail-Adresse gehen an die ${LEGAL_OPERATOR.name}, nicht an ${name}.`,
    "Der Check ist eine Selbsteinschätzung auf Basis Ihrer Angaben. Er ersetzt keine Prüfung und keine Beratung.",
    `Wenn Sie anschließend Ihre Verfahrensdokumentation geführt erstellen möchten, geht das auf gobd-doku-erstellen.de: ${SETUP_EUR} € einmalige Einrichtung plus ${MONTHLY_EUR} € pro Monat, jeweils zzgl. USt., monatlich kündbar, bis zu 5 Firmen je Abo. Das ist freiwillig und für den Check nicht nötig.`,
    `Keine Steuer- oder Rechtsberatung. Der Ampel-Check und die Dokumentation sind Angebote der ${LEGAL_OPERATOR.name}, ${LEGAL_OPERATOR.street}, ${LEGAL_OPERATOR.zipCity}, ${LEGAL_OPERATOR.email}. ${name} hat den Check nicht erstellt und nicht geprüft. ${name} erhält für diesen Hinweis keine Vergütung von der ${LEGAL_OPERATOR.name}. Angebot ausschließlich für Unternehmer.`,
  ];
}
