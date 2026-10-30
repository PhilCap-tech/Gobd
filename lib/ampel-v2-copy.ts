/**
 * Alle Texte für die Ampel ohne E-Mail an einer Stelle (nur mit Flag sichtbar).
 * Quelle: gobd-ops/growth/ampel-inhalte-2026-10-30.md (1:1 übernommen).
 * Mit PLATZHALTER markiert: noch ohne freigegebenen Text, nur mit Flag erreichbar.
 * Legal-Nachträge bitte hier einpflegen.
 */

import type { AmpelLight } from "@/lib/ampel-score";

/** Einwilligungsversion für neue Opt-ins im Bericht-Ablauf (Freigabe Philip 30.10.2026 17:28 MEZ). */
export const AMPEL_REPORT_CONSENT_TEXT_VERSION = "2026-10-30";

/** Legal-Prüfung E1 (ampel-inhalte-check-2026-10-30.md): Erklärtext je Frage, nur im Flag-Pfad. */
export const AMPEL_V2_EXPLANATION_REPLACEMENTS: Record<string, [string, string]> = {
  iks: [
    "Wie umfangreich es sein muss, hängt von Größe und Komplexität des Unternehmens ab.",
    "Wie es konkret ausgestaltet sein muss, hängt von der Komplexität Ihrer Geschäftstätigkeit, Ihrer Organisation und der eingesetzten Software ab.",
  ],
};

export function ampelV2Explanation(id: string, text: string): string {
  const replacement = AMPEL_V2_EXPLANATION_REPLACEMENTS[id];
  return replacement ? text.replace(replacement[0], replacement[1]) : text;
}

export const AMPEL_V2_PLACEHOLDER = "[PLATZHALTER – Growth]";

const p = (what: string) => `${AMPEL_V2_PLACEHOLDER} ${what}`;

/** Grundlagen, deren „Nein“ Rot erzwingt (Inhalte Abschnitt 2, Rot Variante A). */
export const AMPEL_V2_BASICS = ["vd_vorhanden", "aufbewahrung", "kasse_tse"] as const;

export const AMPEL_V2_SHORT_LABELS: Record<string, string> = {
  vd_vorhanden: "Verfahrensdokumentation vorhanden",
  vd_aktuell: "Aktualisierung und Versionierung",
  kasse_tse: "Kasse: TSE und Meldung",
  aufbewahrung: "Geordnete Aufbewahrung",
  unveraenderbarkeit: "Unveränderbarkeit und Protokollierung",
  datenzugriff: "Datenzugriff der Finanzverwaltung",
  iks: "Internes Kontrollsystem",
  scannen: "Scanprozess beschrieben",
  erechnung: "E-Rechnungen empfangen und aufbewahren",
  belegfluss: "Belegfluss dokumentiert",
};

const DISCLAIMER_SENTENCE = "Das ist eine Ersteinschätzung auf Grundlage Ihrer Angaben, keine Prüfung.";

/** Einordnung je Farbe (Headlines bleiben aus AMPEL_RESULTS). */
export function ampelV2Einordnung(light: AmpelLight, neinIds: string[]): string {
  if (light === "gruen") {
    return `Sie haben keine der 10 Fragen mit „Nein“ beantwortet. Nach Ihren Angaben sind die zentralen Bausteine eingerichtet, von der Verfahrensdokumentation bis zur Aufbewahrung. ${DISCLAIMER_SENTENCE} Sinnvoll bleibt eine regelmäßige Durchsicht, besonders wenn sich Software oder Abläufe ändern.`;
  }
  if (light === "gelb") {
    const n = neinIds.length;
    return `Die drei Grundlagen Verfahrensdokumentation, Aufbewahrung und gegebenenfalls Kasse sind nach Ihren Angaben vorhanden. Bei ${n} ${n === 1 ? "Frage" : "Fragen"} haben Sie mit „Nein“ geantwortet. Diese Themen sehen Sie unten, dort setzen Sie am besten an. ${DISCLAIMER_SENTENCE}`;
  }
  const basicMissing = neinIds.some((id) => (AMPEL_V2_BASICS as readonly string[]).includes(id));
  if (basicMissing) {
    return `Bei mindestens einer der drei Grundlagen (Verfahrensdokumentation, Aufbewahrung, Kasse) haben Sie mit „Nein“ geantwortet. Deshalb zeigt die Ampel Rot. Das lässt sich Schritt für Schritt angehen. ${DISCLAIMER_SENTENCE}`;
  }
  return `Die drei Grundlagen sind nach Ihren Angaben vorhanden, bei vielen weiteren Bausteinen haben Sie jedoch mit „Nein“ geantwortet. Die Themen sehen Sie unten. Am besten gehen Sie sie in einer festen Reihenfolge an. ${DISCLAIMER_SENTENCE}`;
}

export const AMPEL_V2_COPY = {
  h1: "GoBD-Ampel: Ihre Ersteinschätzung zur Verfahrensdokumentation",
  title: "GoBD-Ampel: kostenlose Ersteinschätzung in 10 Fragen",
  description:
    "Beantworten Sie 10 Ja/Nein-Fragen zu Verfahrensdokumentation, Aufbewahrung, Kasse und Belegfluss und erhalten Sie direkt eine Ampel-Ersteinschätzung, ohne E-Mail-Adresse. Keine Steuer- oder Rechtsberatung.",
  shareMessage:
    "Wie steht es um die Verfahrensdokumentation in Ihrem Unternehmen? Mit der kostenlosen GoBD-Ampel beantworten Sie 10 Ja/Nein-Fragen und erhalten eine Ersteinschätzung (keine Steuer- oder Rechtsberatung durch den Anbieter des Tools). Gerne besprechen wir das Ergebnis anschließend gemeinsam: {link}",
  disclaimerShort: "Ersteinschätzung auf Grundlage Ihrer Angaben, keine Prüfung. Keine Steuer- oder Rechtsberatung.",
  disclaimerLong:
    "Die GoBD-Ampel ist eine Ersteinschätzung zur Orientierung. Sie beruht allein auf Ihren Angaben und ist keine Prüfung Ihrer Buchführung oder Ihrer Unterlagen. Sie bestätigt nicht, dass Ihre Buchführung ordnungsmäßig ist. Die Empfehlungen sind allgemeine Hinweise und ersetzen nicht die Beratung durch eine Steuerberaterin oder einen Steuerberater im Einzelfall. Keine Steuer- oder Rechtsberatung. Stand der Quellen: Oktober 2026.",
  neinHeading: p("Überschrift Liste der Nein-Themen"),
  offerHeading: "Ihr ausführlicher Ampel-Bericht als PDF",
  offerIntro: p("Einleitung Bericht-Angebot"),
  offerBullets: [p("Gegenwert-Bullet 1"), p("Gegenwert-Bullet 2"), p("Gegenwert-Bullet 3")],
  offerButton: "Bericht per E-Mail erhalten",
  offerEmptyEmail: "Bitte geben Sie Ihre E-Mail-Adresse ein, damit wir Ihnen den Bericht senden können.",
  /** Legal 30.10.2026 (ampel-dse-final-builder), Version AMPEL_REPORT_CONSENT_TEXT_VERSION. „Datenschutzerklärung“ wird verlinkt. */
  marketingConsent:
    "Ja, ich möchte zusätzlich per E-Mail Informationen zu GoBD-Themen und Angeboten von gobd-doku-erstellen.de (IKAT GmbH) erhalten, etwa zu Gesetzesänderungen, Fristen und neuen Funktionen. Ich erhalte zuerst eine E-Mail mit einem Bestätigungslink (Double-Opt-in). Den Bericht erhalte ich auch ohne dieses Häkchen. Meine Einwilligung kann ich jederzeit widerrufen, zum Beispiel über den Abmeldelink in jeder E-Mail oder per Nachricht an info@gobd-doku-erstellen.de. Mehr in der Datenschutzerklärung.",
  /** Hinweiszeile unter dem E-Mail-Feld. „Datenschutzerklärung“ wird verlinkt. */
  emailPrivacyNote:
    "Wir verwenden Ihre E-Mail-Adresse nur, um Ihnen diesen Bericht zu senden (Art. 6 Abs. 1 lit. b DSGVO). Werbung erhalten Sie nur, wenn Sie unten gesondert zustimmen. Mehr dazu in unserer Datenschutzerklärung. Keine Steuer- oder Rechtsberatung.",
  sentHeading: p("Überschrift Bestätigung Bericht unterwegs"),
  sentText: p("Text Bestätigung Bericht unterwegs"),
} as const;
