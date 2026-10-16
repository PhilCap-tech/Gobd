import type { AmpelQuestion } from "@/lib/ampel-questions";

export const KASSEN_CHECK_PATH = "/kassen-check";
export const KASSEN_CHECK_SOURCE = "kassen-check";
export const KASSEN_RATE_SCOPE = "kassen";
export const KASSEN_LEAD_PREFIX = "kassen";
export const KASSEN_LEAD_STATUS = "kassen-check";
export const KASSEN_CTA_SOFT = "/readiness";
export const KASSEN_CTA_SECONDARY = "/ampel-check";

export const KASSEN_H1 =
  "Kassen- und TSE-Meldecheck: Sind Ihre Kassen beim Finanzamt gemeldet?";

export const KASSEN_INTRO =
  "Beantworten Sie 6 Fragen mit Ja oder Nein und sehen Sie, ob Ihre elektronischen Kassen und deren Meldungen an das Finanzamt vollständig erscheinen. Der Check dient der Orientierung und ersetzt keine Steuerberatung.";

export const KASSEN_QUESTIONS: AmpelQuestion[] = [
  {
    id: "kasse_tse",
    question:
      "Ist jede elektronische Kasse in Ihrem Betrieb durch eine zertifizierte technische Sicherheitseinrichtung (TSE) geschützt?",
    explanation:
      "Elektronische Aufzeichnungssysteme und ihre digitalen Aufzeichnungen sind durch eine zertifizierte technische Sicherheitseinrichtung zu schützen. Sie besteht aus Sicherheitsmodul, Speichermedium und einheitlicher digitaler Schnittstelle.",
    weight: 3,
    applicable: "required",
    source: "§ 146a Abs. 1 Satz 2 und 3 AO",
  },
  {
    id: "meldung_neu",
    question:
      "Haben Sie Kassen, die Sie seit dem 01.07.2025 angeschafft, gemietet oder geleast haben, innerhalb eines Monats über Mein ELSTER (oder Ihre Kassen- bzw. Steuersoftware) an das Finanzamt gemeldet?",
    explanation:
      "Ab dem 01.07.2025 angeschaffte elektronische Aufzeichnungssysteme sind innerhalb eines Monats nach Anschaffung mitzuteilen, nach amtlich vorgeschriebenem Datensatz per Datenfernübertragung. Die Übermittlung steht über „Mein ELSTER“ und die ERiC-Schnittstelle zur Verfügung. Gemietete oder geleaste Systeme stehen angeschafften gleich.",
    weight: 3,
    applicable: "optional",
    source:
      "§ 146a Abs. 4 Satz 1 und 2 AO; BMF-Schreiben vom 28.06.2024, Abschnitt I (mit Verweis auf AEAO zu § 146a Nr. 1.16.2.6)",
  },
  {
    id: "meldung_bestand",
    question: "Sind auch die Kassen gemeldet, die Sie schon vor dem 01.07.2025 im Einsatz hatten?",
    explanation:
      "Für vor dem 01.07.2025 angeschaffte Systeme sah das BMF-Schreiben eine Mitteilung bis zum 31.07.2025 vor. Dieser Termin liegt in der Vergangenheit. Wenn eine Meldung noch fehlt, besprechen Sie das weitere Vorgehen mit Ihrer Steuerberatung.",
    weight: 3,
    applicable: "optional",
    source: "BMF-Schreiben vom 28.06.2024, Abschnitt I",
  },
  {
    id: "meldung_ausserbetrieb",
    question:
      "Haben Sie Kassen, die Sie seit dem 01.07.2025 außer Betrieb genommen haben, innerhalb eines Monats als Außerbetriebnahme gemeldet?",
    explanation:
      "Auch die Außerbetriebnahme ist innerhalb eines Monats mitzuteilen. Dabei muss die Anschaffung des Systems vorher gemeldet worden sein.",
    weight: 2,
    applicable: "optional",
    source: "§ 146a Abs. 4 Satz 1 Nr. 8 und Satz 2 AO; BMF-Schreiben vom 28.06.2024, Abschnitt I",
  },
  {
    id: "meldung_vollstaendig",
    question: "Enthält Ihre Meldung je Betriebsstätte alle dort genutzten elektronischen Kassen?",
    explanation:
      "Bei jeder Mitteilung sind stets alle elektronischen Aufzeichnungssysteme einer Betriebsstätte in einer einheitlichen Mitteilung zu übermitteln.",
    weight: 2,
    applicable: "optional",
    source:
      "BMF-Schreiben vom 28.06.2024, Abschnitt I (mit Verweis auf AEAO zu § 146a Nr. 1.16.1.4)",
  },
  {
    id: "meldung_angaben",
    question:
      "Stimmen die gemeldeten Angaben noch mit Ihrem heutigen Stand überein — insbesondere Art der TSE, Art, Anzahl und Seriennummer der Kassen?",
    explanation:
      "Die Mitteilung umfasst unter anderem Name und Steuernummer, Art der zertifizierten technischen Sicherheitseinrichtung, Art und Anzahl der Systeme, Seriennummer sowie Datum der Anschaffung und gegebenenfalls der Außerbetriebnahme. Wurde zum Beispiel eine TSE getauscht, klären Sie mit Ihrer Steuerberatung, ob und wie die Mitteilung anzupassen ist.",
    weight: 2,
    applicable: "optional",
    source: "§ 146a Abs. 4 Satz 1 Nr. 1–8 AO",
  },
];

/** Nein forces Rot, including when the weighted score would be Grün or Gelb. */
export const KASSEN_NEIN_FORCES_ROT = ["kasse_tse"] as const;

/** Nein cannot stay Grün. A Gelb or Rot from the weighted score stays. */
export const KASSEN_NEIN_CAPS_AT_GELB = ["meldung_angaben"] as const;

/** Same flag the question form uses for the third choice. */
export function kassenOffersNotApplicable(question: AmpelQuestion): boolean {
  return question.applicable === "optional";
}

export const KASSEN_RESULTS = {
  gruen: {
    headline: "Ihre Kassenmeldungen wirken vollständig.",
    text: "Nach Ihren Angaben sind Ihre Kassen mit einer TSE ausgestattet und die Meldungen an das Finanzamt aktuell. Bewahren Sie die Übermittlungsbestätigungen auf und prüfen Sie die Angaben, wenn sich an Ihren Kassen etwas ändert. Wie Kasse, Abschluss und Belege bei Ihnen ablaufen, halten Sie in der Verfahrensdokumentation fest.",
  },
  gelb: {
    headline: "Einzelne Punkte sind offen.",
    text: "Bei einigen Fragen haben Sie mit Nein geantwortet. Häufig betrifft das eine Kasse, die ersetzt oder abgeschafft wurde, oder eine Meldung, die nicht alle Kassen einer Betriebsstätte enthält. Gehen Sie die offenen Punkte in Ruhe durch und klären Sie sie mit Ihrer Steuerberatung.",
  },
  rot: {
    headline: "Grundlegende Punkte sind noch offen.",
    text: "Nach Ihren Angaben fehlen eine TSE oder die Meldung einer oder mehrerer Kassen. Sprechen Sie zeitnah mit Ihrer Steuerberatung über die nächsten Schritte. Die Erläuterungen und Quellen zu jeder Frage helfen Ihnen, das Gespräch vorzubereiten.",
  },
} as const;

export const KASSEN_DISCLAIMER =
  "Keine Steuerberatung, keine Zusicherung zu Prüfungsergebnissen. Der Check ist eine allgemeine Orientierung auf Grundlage Ihrer Angaben und ersetzt keine Prüfung durch Ihre Steuerberatung.";

export const KASSEN_OPT_IN = {
  heading: "Ergebnis mit Quellen per E-Mail erhalten",
  text: "Wenn Sie möchten, senden wir Ihnen Ihr Ergebnis mit allen Erläuterungen und Quellen an Ihre E-Mail-Adresse. Das Ergebnis sehen Sie auch ohne Eingabe direkt auf dieser Seite.",
  field: "E-Mail-Adresse",
  button: "Ergebnis senden",
  hintBefore: "Hinweise zur Verarbeitung Ihrer Daten finden Sie in der ",
  hintLink: "Datenschutzerklärung",
  hintAfter: ".",
} as const;

export const KASSEN_WEITER =
  "Die Meldung ist ein Baustein. Wie Ihre Kasse im Alltag läuft — wer kassiert, zählt, storniert und Belege weitergibt —, beschreibt die Verfahrensdokumentation. Der Readiness-Check zeigt in drei Schritten, welche Bereiche bei Ihnen vorkommen. Für einen breiteren Blick auf Ihre Buchführung gibt es den Ampel-Check mit 10 Fragen.";

export const KASSEN_SENT_NOTICE =
  "Das Ergebnis mit den Erläuterungen und Quellen ist unterwegs. Die Auswertung sehen Sie auch auf dieser Seite.";

export const KASSEN_TEASER = {
  title: "Kassen- und TSE-Meldecheck",
  defaultText:
    "Sind Ihre Kassen mit TSE ausgestattet und beim Finanzamt gemeldet — auch nach einem Austausch oder einer Außerbetriebnahme? Sechs Fragen mit Erläuterungen und Quellen geben Ihnen eine erste Orientierung.",
  taxiText:
    "Nutzen Sie neben dem Taxameter auch eine elektronische Kasse? Sechs Fragen mit Erläuterungen und Quellen geben Ihnen eine erste Orientierung zu TSE und Meldung.",
  link: "Zum Kassen- und TSE-Meldecheck",
} as const;
