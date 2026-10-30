import { V2_ENTRY_LABEL, V2_MEMBER_YEAR_LABEL } from "@/lib/pricing";
import { isPricingV2 } from "@/lib/pricing-model";
export type AmpelAnswer = "ja" | "nein" | "nicht_zutreffend";

export interface AmpelQuestion {
  id: string;
  question: string;
  explanation: string;
  weight: 1 | 2 | 3;
  applicable: "required" | "optional"; // optional = Option „Trifft nicht zu“ anzeigen
  source: string;
  hint?: string;
}

export const AMPEL_H1 = "GoBD-Ampel: Ihre Ersteinschätzung zur Verfahrensdokumentation";

/** <title> von /ampel-check (Growth 30.10.2026). */
export const AMPEL_TITLE = "GoBD-Ampel: kostenlose Ersteinschätzung in 10 Fragen";

export const AMPEL_INTRO =
  "Beantworten Sie 10 Fragen mit Ja oder Nein und sehen Sie nach etwa zwei Minuten, wie gut Ihre Buchführungsprozesse für eine Betriebsprüfung dokumentiert sind. Die Ampel dient der Orientierung und ersetzt keine Steuerberatung.";

/** Visible funnel copy on /ampel-check. Homepage and the page description keep AMPEL_INTRO. */
export const AMPEL_CHECK_KICKER = "Kostenlos · 10 Fragen · rund 2 Minuten";

export const AMPEL_CHECK_INTRO =
  "Beantworten Sie 10 kurze Ja/Nein-Fragen – Sie erhalten eine Ampel-Einschätzung mit Quellen.";

export const AMPEL_CHECK_WHY = "Warum fragen wir das?";

export const AMPEL_CHECK_HINT =
  "Selbsteinschätzung zur Orientierung – keine Steuer- oder Rechtsberatung.";

export const AMPEL_CHECK_PREVIEW_NOTE = "Selbsteinschätzung – keine Steuer- oder Rechtsberatung.";

export const AMPEL_CHECK_PREVIEW_DETAIL =
  "Welche Punkte das sind und was die Quellen dazu sagen, sehen Sie nach Eingabe Ihrer E-Mail-Adresse.";

export function ampelCheckPreviewLine(color: string, openPoints: number): string {
  if (openPoints === 0) {
    return `Ihre Einschätzung: ${color} – nach Ihren Angaben besteht kein offener Punkt.`;
  }
  return `Ihre Einschätzung: ${color} – bei ${openPoints} von ${AMPEL_QUESTIONS.length} Punkten besteht möglicher Handlungsbedarf.`;
}

export const AMPEL_CHECK_MAIL = {
  heading: "Ihre Ampel ist bereit",
  text:
    "Geben Sie Ihre E-Mail-Adresse ein – Ihr Ergebnis erscheint sofort hier auf der Seite. Zusätzlich senden wir Ihnen das Ergebnis mit Quellen als PDF.",
  label: "Ihre E-Mail-Adresse",
  button: "Ampel-Ergebnis anzeigen",
  note:
    "Kein Newsletter ohne Ihre ausdrückliche Zustimmung. Selbsteinschätzung – keine Steuer- oder Rechtsberatung.",
  emptyEmail: "Bitte geben Sie Ihre E-Mail-Adresse ein, damit wir Ihr Ergebnis anzeigen können.",
} as const;

export const AMPEL_QUESTIONS: AmpelQuestion[] = [
  {
    id: "vd_vorhanden",
    question:
      "Haben Sie für Ihr Unternehmen bereits eine schriftliche Verfahrensdokumentation?",
    hint: "Wenn Sie unsicher sind, wählen Sie „Nein“.",
    explanation:
      "Die GoBD verlangen für jedes DV-System eine übersichtlich gegliederte Verfahrensdokumentation, aus der Inhalt, Aufbau, Ablauf und Ergebnisse des Verfahrens ersichtlich sind. Sie besteht in der Regel aus allgemeiner Beschreibung, Anwenderdokumentation, technischer Systemdokumentation und Betriebsdokumentation.",
    weight: 3,
    applicable: "required",
    source: "GoBD Rz. 151–153; § 146 Abs. 1, § 145 Abs. 1 AO",
  },
  {
    id: "vd_aktuell",
    question:
      "Wird Ihre Verfahrensdokumentation bei Änderungen an Software, Abläufen oder Zuständigkeiten aktualisiert und versioniert?",
    explanation:
      "Änderungen an der Verfahrensdokumentation müssen historisch nachvollziehbar sein, frühere Fassungen sind aufzubewahren. Einen festen Turnus für die Überprüfung schreiben die GoBD nicht vor. Maßgeblich ist, dass die Dokumentation über die gesamte Aufbewahrungsfrist dem tatsächlich eingesetzten Verfahren entspricht. Eine regelmäßige, etwa jährliche Durchsicht kann dabei helfen.",
    weight: 2,
    applicable: "required",
    source: "GoBD Rz. 154; § 147 Abs. 1 Nr. 1 AO (Arbeitsanweisungen und sonstige Organisationsunterlagen)",
  },
  {
    id: "kasse_tse",
    question:
      "Falls Sie eine elektronische Kasse nutzen: Ist sie mit einer zertifizierten technischen Sicherheitseinrichtung (TSE) ausgestattet und beim Finanzamt gemeldet?",
    explanation:
      "Elektronische Aufzeichnungssysteme mit Kassenfunktion müssen durch eine zertifizierte TSE geschützt sein. Seit dem 01.01.2025 steht für die Mitteilung an das Finanzamt das Verfahren über „Mein ELSTER“ zur Verfügung. Die Mitteilung erfolgt elektronisch je Betriebsstätte für alle Kassen. Neue oder außer Betrieb genommene Kassen sind innerhalb eines Monats mitzuteilen. Antworten Sie nur mit „Ja“, wenn beides zutrifft.",
    weight: 3,
    applicable: "optional",
    source:
      "§ 146a Abs. 1 Satz 2 und Abs. 4 AO; §§ 1–3 KassenSichV; BMF-Schreiben vom 28.06.2024 (IV D 2 – S 0316-a/19/10011 :009) zur Mitteilungspflicht nach § 146a Abs. 4 AO",
  },
  {
    id: "aufbewahrung",
    question:
      "Werden Ihre Bücher und Belege geordnet abgelegt und sind sie für die gesamte Aufbewahrungsfrist auffindbar?",
    explanation:
      "Bücher, Jahresabschlüsse und Organisationsunterlagen werden 10 Jahre aufbewahrt. Für Buchungsbelege gilt seit 2025 eine Frist von 8 Jahren, Handels- und Geschäftsbriefe 6 Jahre.",
    weight: 3,
    applicable: "required",
    source:
      "§ 147 Abs. 1 und Abs. 3 AO i. d. F. des Vierten Bürokratieentlastungsgesetzes (BGBl. 2024 I Nr. 323); Übergangsregel Art. 97 § 19a Abs. 2 und 3 EGAO; § 257 Abs. 4 HGB; GoBD Rz. 116, 117, 119",
  },
  {
    id: "unveraenderbarkeit",
    question:
      "Werden elektronische Belege und Buchungen so gespeichert, dass nachträgliche Änderungen ausgeschlossen sind oder protokolliert werden?",
    explanation:
      "Eine Buchung oder Aufzeichnung darf nicht so verändert werden, dass der ursprüngliche Inhalt nicht mehr feststellbar ist. Die Unveränderbarkeit kann technisch oder organisatorisch sichergestellt werden, zum Beispiel über ein Archivsystem mit Änderungsprotokoll.",
    weight: 2,
    applicable: "required",
    source: "§ 146 Abs. 4 AO; GoBD Rz. 58–60 und Rz. 107–112",
  },
  {
    id: "datenzugriff",
    question:
      "Könnten Sie der Betriebsprüfung Ihre steuerrelevanten Daten maschinell auswertbar zur Verfügung stellen, also per Lesezugriff, per Auswertung nach Vorgabe oder als Datenüberlassung, zum Beispiel auf einem Datenträger?",
    explanation:
      "Die Finanzverwaltung hat das Recht auf unmittelbaren Datenzugriff (Z1), mittelbaren Datenzugriff (Z2) und Datenüberlassung (Z3), zum Beispiel auf einem Datenträger oder über eine Datenaustauschplattform der Finanzbehörde. Dafür müssen die Daten während der Aufbewahrungsfrist verfügbar und maschinell auswertbar sein.",
    weight: 2,
    applicable: "required",
    source:
      "§ 147 Abs. 6 AO; GoBD Rz. 158–178 i. d. F. vom 14.07.2025 (Z1 unmittelbarer Datenzugriff: Rz. 165; Z2 mittelbarer Datenzugriff: Rz. 166; Z3 Datenüberlassung: Rz. 167)",
  },
  {
    id: "iks",
    question:
      "Sind Zuständigkeiten, Zugriffsrechte und Kontrollen in Ihrer Buchhaltung festgelegt, also wer was erfasst, freigibt und prüft?",
    explanation:
      "Die GoBD erwarten ein internes Kontrollsystem (IKS), zum Beispiel mit Zugangs- und Zugriffsberechtigungen, Funktionstrennung und Abstimmungskontrollen. Wie es konkret ausgestaltet sein muss, hängt von der Komplexität Ihrer Geschäftstätigkeit, Ihrer Organisation und der eingesetzten Software ab.",
    weight: 2,
    applicable: "required",
    source: "GoBD Rz. 60, Rz. 100–102",
  },
  {
    id: "scannen",
    question:
      "Falls Sie Papierbelege scannen: Ist der Scanprozess beschrieben, einschließlich Zuständigkeit, Qualitätskontrolle und Umgang mit den Originalen?",
    explanation:
      "Papierbelege dürfen nach dem Scannen grundsätzlich vernichtet werden, wenn das Verfahren dokumentiert ist und die Digitalisate den Anforderungen entsprechen (ersetzendes Scannen). Eine Orientierung bietet die Technische Richtlinie TR-RESISCAN des BSI. Sie ist jedoch keine Pflicht.",
    weight: 1,
    applicable: "optional",
    source: "GoBD Rz. 130 und Rz. 136–141; § 147 Abs. 2 AO; BSI TR-03138 (TR-RESISCAN)",
  },
  {
    id: "erechnung",
    question:
      "Können Sie E-Rechnungen (z. B. XRechnung oder ZUGFeRD) empfangen, verarbeiten und im strukturierten Originalformat aufbewahren?",
    explanation:
      "Seit dem 01.01.2025 müssen alle inländischen Unternehmen E-Rechnungen im B2B-Bereich empfangen können. Für die Aufbewahrung ist der strukturierte Teil der E-Rechnung (z. B. die XML-Datei) maßgeblich. Den menschenlesbaren Teil einer hybriden Rechnung bewahren Sie nur zusätzlich auf, wenn er zusätzliche oder abweichende, für die Besteuerung bedeutsame Angaben enthält, etwa Buchungsvermerke.",
    weight: 2,
    applicable: "required",
    source:
      "§ 14 Abs. 1 und Abs. 2 UStG i. d. F. des Wachstumschancengesetzes; § 27 Abs. 38 UStG (Übergangsregeln Ausstellung); BMF-Schreiben vom 15.10.2024 (BStBl I S. 1320) und vom 15.10.2025 zur E-Rechnung; GoBD Rz. 118, 119, 125 (Beispiel 10) und 131 i. d. F. vom 14.07.2025",
  },
  {
    id: "belegfluss",
    question:
      "Ist dokumentiert, wie ein Beleg bei Ihnen vom Eingang über Prüfung und Buchung bis zur Ablage läuft?",
    explanation:
      "Die Verfahrensdokumentation beschreibt den organisatorisch und technisch gewollten Prozess, von der Entstehung der Information über Erfassung, Verarbeitung und Speicherung bis zur Wiederauffindbarkeit. Belege sind zeitnah gegen Verlust zu sichern.",
    weight: 2,
    applicable: "required",
    source: "GoBD Rz. 152, Rz. 67–70 (Belegsicherung); § 146 Abs. 1 AO",
  },
];

// Summe aller Gewichte: 22 (bei „Trifft nicht zu“ verringert sich die Bezugsgröße entsprechend)

/** Nein forces Rot, including when the weighted score would be Grün or Gelb. */
export const AMPEL_NEIN_FORCES_ROT = ["vd_vorhanden", "aufbewahrung", "kasse_tse"] as const;

/** Nein cannot stay Grün. A Gelb or Rot from the weighted score stays. „Trifft nicht zu“ is not Nein. */
export const AMPEL_NEIN_CAPS_AT_GELB = [
  "vd_aktuell",
  "unveraenderbarkeit",
  "datenzugriff",
  "iks",
  "scannen",
  "erechnung",
  "belegfluss",
] as const;

export const AMPEL_RESULTS = {
  gruen: {
    range: [80, 100],
    label: "Grün",
    headline: "Gute Grundlage: Die wichtigsten Bausteine sind laut Ihren Angaben vorhanden.",
    text:
      "Ihre Antworten zeigen, dass zentrale Dokumentations- und Ablageprozesse bereits eingerichtet sind. Das Ergebnis ist eine Selbsteinschätzung und keine Bestätigung, dass Ihre Buchführung ordnungsgemäß ist. Ob Ihre Unterlagen den Anforderungen im Einzelfall genügen, kann nur eine fachliche Prüfung zeigen.",
    hints: [
      "Prüfen Sie, ob Ihre Verfahrensdokumentation alle aktuell genutzten Systeme abbildet, auch neu eingeführte Software oder Schnittstellen.",
      "Legen Sie einen festen Termin fest, zu dem Sie die Dokumentation regelmäßig durchsehen, und halten Sie Änderungen mit Datum und Version fest.",
      "Besprechen Sie das Ergebnis mit Ihrer Steuerkanzlei, besonders bei den Fragen, die Sie mit „Nein“ beantwortet haben.",
    ],
  },
  gelb: {
    range: [50, 79],
    label: "Gelb",
    headline: "Teilweise dokumentiert: Einige Bausteine fehlen noch oder sind nicht aktuell.",
    text:
      "Viele Grundlagen sind vorhanden, an einzelnen Stellen besteht aber Handlungsbedarf. Die Fragen, die Sie mit „Nein“ beantwortet haben, zeigen, wo Sie ansetzen können.",
    hints: [
      "Beginnen Sie mit den Punkten, die Sie mit „Nein“ beantwortet haben und die ein hohes Gewicht haben: Verfahrensdokumentation, Kasse und Aufbewahrung.",
      "Beschreiben Sie Ihren Belegfluss schriftlich, vom Eingang bis zur Ablage, inklusive Zuständigkeiten.",
      "Klären Sie mit Ihrer Steuerkanzlei oder Ihrem Softwareanbieter, in welcher Form Sie Daten für den Datenzugriff (Z1–Z3) bereitstellen können.",
    ],
  },
  rot: {
    range: [0, 49],
    label: "Rot",
    headline: "Deutlicher Nachholbedarf: Mindestens eine wichtige Grundlage ist noch nicht dokumentiert.",
    text:
      "Laut Ihren Angaben fehlt mindestens ein grundlegender Baustein. Das lässt sich Schritt für Schritt angehen. Wichtig ist, mit einer klaren Reihenfolge zu beginnen.",
    hints: [
      "Erstellen Sie zuerst eine Übersicht: Welche Systeme (Buchhaltung, Kasse, Warenwirtschaft, Archiv) nutzen Sie und wer ist jeweils zuständig?",
      "Prüfen Sie, ob Ihre Kasse mit einer TSE ausgestattet und über ELSTER gemeldet ist, und ob Sie E-Rechnungen empfangen können.",
      "Sprechen Sie mit Ihrer Steuerkanzlei über die nächsten Schritte und beginnen Sie mit der Verfahrensdokumentation.",
    ],
  },
} as const;

// Grenze für Grün: Ist eine Frage mit weight 3 mit „nein“ beantwortet, Ergebnis höchstens „gelb“.
export const AMPEL_CAP_NOTE =
  "Hinweis: Mindestens eine grundlegende Frage haben Sie mit „Nein“ beantwortet. Deshalb zeigt die Ampel höchstens Gelb.";

export const AMPEL_CTA = {
  headline: "Verfahrensdokumentation strukturiert erstellen",
  text:
    "Mit gobd-doku-erstellen.de erstellen Sie Ihre Verfahrensdokumentation Schritt für Schritt in 24 Modulen, vom Belegfluss über Kasse und Archiv bis zum internen Kontrollsystem. Änderungen halten Sie laufend fest, frühere Versionen bleiben nachvollziehbar.",
  price: isPricingV2()
    ? `${V2_ENTRY_LABEL} € einmalig, optional Jahrespaket ${V2_MEMBER_YEAR_LABEL} €/Jahr, zzgl. USt.`
    : "149 € einmalige Einrichtung + 49 € pro Monat, zzgl. USt. Monatlich kündbar.",
  button: "Verfahrensdokumentation starten",
  secondary: "So funktioniert es",
};

export const AMPEL_RESULT_MAIL = {
  label: "Ergebnis ansehen",
  placeholder: "Ihre E-Mail-Adresse",
  button: "Ergebnis anzeigen",
  invalidEmail: "Bitte geben Sie eine gültige E-Mail-Adresse an.",
  sendFailed: "Das Ergebnis konnte gerade nicht gesendet werden. Bitte versuchen Sie es später erneut.",
  rateLimitedEmail:
    "Sie haben das Ergebnis heute bereits mehrfach angefordert. Ihr Ergebnis sehen Sie unten; eine weitere E-Mail ist morgen wieder möglich.",
  rateLimitedIp:
    "Sie haben das Ergebnis heute bereits mehrfach angefordert. Ihr Ergebnis sehen Sie unten; eine weitere E-Mail ist in Kürze wieder möglich.",
  alreadySent: "Das Ergebnis wurde bereits an diese Adresse gesendet.",
  sendUnauthorized: "Diese Anfrage ist nicht gültig.",
  sending: "Die E-Mail wird gesendet …",
  sendInterrupted: "Die Verbindung wurde unterbrochen. Bitte prüfen Sie Ihr Postfach.",
  shownWithoutMail: "Die Auswertung sehen Sie auf dieser Seite. Die E-Mail konnte gerade nicht gesendet werden.",
  offline: "Die Verbindung ist fehlgeschlagen. Die Auswertung sehen Sie auf dieser Seite.",
  sent: "Das PDF mit Ihrem Ergebnis ist unterwegs. Die Auswertung sehen Sie auch auf dieser Seite.",
  doiSuccess:
    "Zusätzlich haben wir Ihnen eine E-Mail mit einem Bestätigungslink gesendet. Die Einwilligung können Sie jederzeit widerrufen.",
};

export function ampelResultSentNotice(email: string): string {
  return `Das Ergebnis wurde an ${email.trim()} gesendet.`;
}

export function ampelSendStatusNotice(input: {
  email: string;
  aborted?: boolean;
  status: number;
  ok: boolean;
  mailed?: boolean;
  duplicate?: boolean;
  notice?: string;
  error?: string;
  marketing?: string;
}): string {
  if (input.aborted) return AMPEL_RESULT_MAIL.sendInterrupted;
  if (!input.ok || input.status === 403 || input.status === 429) {
    const message = input.error || input.notice || AMPEL_RESULT_MAIL.shownWithoutMail;
    return message === AMPEL_RESULT_MAIL.sending ? AMPEL_RESULT_MAIL.shownWithoutMail : message;
  }
  if (input.duplicate) return input.notice || AMPEL_RESULT_MAIL.alreadySent;
  if (input.mailed === false) {
    const message = input.notice || AMPEL_RESULT_MAIL.shownWithoutMail;
    return message === AMPEL_RESULT_MAIL.sending ? AMPEL_RESULT_MAIL.shownWithoutMail : message;
  }
  const sent = ampelResultSentNotice(input.email);
  return input.marketing === "started" ? `${sent} ${AMPEL_RESULT_MAIL.doiSuccess}` : sent;
}

export const AMPEL_EMAIL_PRIVACY_NOTE =
  "Wir senden Ihnen Ihr Ergebnis zusätzlich als PDF an diese Adresse. Ihre E-Mail-Adresse verwenden wir nur dafür. Werbung erhalten Sie nur, wenn Sie unten ausdrücklich zustimmen. Mehr dazu in unserer Datenschutzerklärung.";

export const AMPEL_MARKETING_CONSENT =
  "Ja, ich möchte per E-Mail Informationen zu GoBD-Themen und Angeboten von gobd-doku-erstellen.de (IKAT GmbH) erhalten, etwa zu Gesetzesänderungen, Fristen und neuen Funktionen. Ich erhalte zuerst eine E-Mail mit einem Bestätigungslink. Meine Einwilligung kann ich jederzeit widerrufen, zum Beispiel über den Abmeldelink in jeder E-Mail oder per Nachricht an info@gobd-doku-erstellen.de.";

/** Text der Checkbox. Mit dem Text speichern, damit der Nachweis die Fassung nennt. */
export const AMPEL_CONSENT_TEXT_VERSION = "2026-10-14";

export const AMPEL_RESULT_REGISTER_LINE =
  "IKAT GmbH, Gartzenweg 1a, 40789 Monheim am Rhein, GF Philip Cappelletti, HRB 81430 AG Düsseldorf.";

export const AMPEL_PRIVACY_TITLE =
  "Ampel-Check: Versand des Ergebnisses und E-Mail-Informationen";

/**
 * Offener Punkt, nicht auf der Seite:
 * Rate-Limit-Daten: Löschfrist [klären: Frist, z. B. 7 Tagen], soweit sie nicht zur Aufklärung eines konkreten Missbrauchs länger benötigt werden.
 */
export const AMPEL_PRIVACY_PARAGRAPHS = [
  "Den Ampel-Check können Sie ohne Angabe einer E-Mail-Adresse nutzen. Ihre Antworten werden in Ihrem Browser ausgewertet, und das Ergebnis wird Ihnen direkt angezeigt. Dabei übermitteln Sie uns keine Antworten und keine E-Mail-Adresse. Technisch bedingt verarbeitet unser Hosting-Anbieter beim Aufruf der Seite kurzzeitig Ihre IP-Adresse (siehe Abschnitt „Server-Logfiles“).",
  "Wenn Sie zusätzlich den ausführlichen Ampel-Bericht als PDF anfordern, verarbeiten wir Ihre E-Mail-Adresse und Ihre Antworten im Check, um den Bericht zu erstellen und Ihnen per E-Mail zuzusenden. Die Angabe der E-Mail-Adresse ist nur dafür erforderlich. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO (Durchführung vorvertraglicher Maßnahmen auf Ihre Anfrage). Ohne Ihre gesonderte Einwilligung nutzen wir die Adresse nicht für Werbung. Wir speichern dazu Ihre E-Mail-Adresse, Ihre Antworten, das Ergebnis (Punktzahl und Ampelfarbe), den Zeitpunkt der Anforderung und den Versandstatus in unserer Datenbank (siehe Abschnitt „Datenbank und Dateispeicher“).",
  "Wenn Sie zusätzlich in E-Mail-Informationen einwilligen, senden wir Ihnen zunächst eine Bestätigungs-E-Mail (Double-Opt-in). Erst nach Ihrer Bestätigung erhalten Sie Informationen zu GoBD-Themen und unseren Angeboten. Wir speichern den Zeitpunkt Ihrer Anmeldung und Bestätigung, die dabei verwendete IP-Adresse und den Text der Einwilligung, um die Einwilligung nachweisen zu können. Rechtsgrundlage ist Ihre Einwilligung (Art. 6 Abs. 1 lit. a DSGVO, § 7 Abs. 2 Nr. 2 UWG), für das Nachweisprotokoll Art. 6 Abs. 1 lit. c und f DSGVO.",
  "Für den Versand der E-Mails setzen wir Resend (Plus Five Five, Inc., USA) als Auftragsverarbeiter nach Art. 28 DSGVO ein. Dabei werden Ihre E-Mail-Adresse, der Inhalt der E-Mail und technische Versanddaten (z. B. Zustellstatus) verarbeitet. Grundlage ist ein Auftragsverarbeitungsvertrag. Für die Übermittlung in die USA stützen wir uns auf die Zertifizierung von Resend nach dem EU-U.S. Data Privacy Framework (Angemessenheitsbeschluss der EU-Kommission, Art. 45 DSGVO). Ergänzend sind im Vertrag Standardvertragsklauseln vereinbart (Art. 46 Abs. 2 lit. c DSGVO).",
  "Schutz vor Missbrauch: Um den Ampel-Check und den E-Mail-Versand vor Missbrauch zu schützen (z. B. massenhafte Anfragen oder Versand an fremde Adressen), verarbeiten wir beim Absenden Ihre IP-Adresse, den Zeitpunkt und eine Zählung der Anfragen (Rate-Limiting). Rechtsgrundlage ist unser berechtigtes Interesse an einem sicheren, missbrauchsfreien Betrieb (Art. 6 Abs. 1 lit. f DSGVO).",
  "Interne Auswertung: Damit wir den Ampel-Check verbessern und den Versand überwachen können, werten wir die Einträge intern aus. Dabei geht es um die Anzahl der angeforderten Berichte, den Zeitpunkt der Anfrage (diesen speichern wir bei jeder Berichtsanforderung, auch ohne Einwilligung in E-Mail-Informationen), das Ergebnis (Ampelfarbe), ob die Bericht-E-Mail versendet wurde und ob Sie in E-Mail-Informationen eingewilligt haben. Die Auswertung ist nur für uns auf einer geschützten Admin-Seite sichtbar. Wir geben diese Daten nicht an Dritte weiter und verwenden sie nicht für Werbung. Außerdem speichern wir die Kennung des Links/Einstiegs, über den Sie den Ampel-Check aufgerufen haben (z. B. Startseite), soweit die aufgerufene Adresse eine solche Kennung enthält. Kampagnenparameter (UTM) und Klick-Kennungen von Werbeanbietern speichern wir dabei nicht. Rechtsgrundlage ist unser berechtigtes Interesse an der Verbesserung unseres Angebots und an einem zuverlässigen Versand (Art. 6 Abs. 1 lit. f DSGVO). Die Einträge löschen wir nach den Fristen im Absatz „Speicherdauer“ oder früher auf Ihren Wunsch. Sie können der Auswertung jederzeit widersprechen (Art. 21 DSGVO), per Nachricht an info@gobd-doku-erstellen.de.",
  "Speicherdauer: Nutzen Sie den Ampel-Check ohne Bericht, speichern wir Ihre Antworten nicht. Haben Sie den Bericht angefordert, speichern wir Ihre Angaben (E-Mail-Adresse, Antworten, Ergebnis, Zeitpunkt der Anfrage, Kennung des Links/Einstiegs, Versand- und Einwilligungsstatus). Haben Sie nicht in E-Mail-Informationen eingewilligt, löschen wir diese Angaben 6 Monate nach dem Versand. Haben Sie zusätzlich in E-Mail-Informationen eingewilligt, speichern wir bis zu Ihrer Bestätigung Ihre E-Mail-Adresse, Ihre Antworten und die Angaben zur Einwilligung in unserem Dateispeicher. Der Bestätigungslink ist 48 Stunden gültig. Bestätigen Sie eine Anmeldung zu E-Mail-Informationen nicht, löschen wir die Angaben dazu nach 30 Tagen. Haben Sie in E-Mail-Informationen eingewilligt und dies bestätigt, speichern wir Ihre Angaben und Ihre Adresse dafür bis zu Ihrem Widerruf. Die Daten zum Schutz vor Missbrauch (IP-Adresse, Zeitpunkt und Zählung der Anfragen) löschen wir nach 30 Tagen. Sie können die Löschung jederzeit verlangen, soweit keine gesetzlichen Aufbewahrungspflichten entgegenstehen.",
  "Nach einem Widerruf speichern wir Ihre E-Mail-Adresse drei Jahre lang in einer Sperrliste, damit Sie keine weiteren Informations-E-Mails erhalten, und löschen sie danach. Außerdem bewahren wir den Nachweis Ihrer Einwilligung und Ihres Widerrufs drei Jahre nach Ihrem Widerruf auf und löschen ihn danach. Rechtsgrundlage dafür ist unser berechtigtes Interesse, Ihren Widerruf dauerhaft zu beachten und rechtliche Ansprüche abwehren zu können (Art. 6 Abs. 1 lit. c und f DSGVO).",
  "Widerruf: Sie können Ihre Einwilligung jederzeit mit Wirkung für die Zukunft widerrufen, über den Abmeldelink in jeder E-Mail oder per Nachricht an info@gobd-doku-erstellen.de. Die Rechtmäßigkeit der bis zum Widerruf erfolgten Verarbeitung bleibt unberührt.",
] as const;

export const AMPEL_SHARE_KANZLEI = {
  button: "Mit Mandanten teilen",
  headline: "Für Steuerkanzleien",
  intro:
    "Teilen Sie die Ampel mit Ihren Mandanten. Sie sehen dann vor dem Gespräch, wo bei der Dokumentation Handlungsbedarf besteht.",
  message:
    "Wie steht es um die Verfahrensdokumentation in Ihrem Unternehmen? Mit der kostenlosen GoBD-Ampel beantworten Sie 10 Ja/Nein-Fragen und erhalten eine Ersteinschätzung (keine Steuer- oder Rechtsberatung durch den Anbieter des Tools). Gerne besprechen wir das Ergebnis anschließend gemeinsam: {link}",
  copied: "Link kopiert",
};

export const AMPEL_DISCLAIMER =
  "Die GoBD-Ampel dient ausschließlich der Orientierung und ist keine Steuerberatung. Sie ersetzt weder eine Prüfung im Einzelfall noch die Beratung durch eine Steuerberaterin oder einen Steuerberater. Das Ergebnis beruht allein auf Ihren Angaben und bestätigt nicht, dass Ihre Buchführung ordnungsgemäß ist. Stand der Rechtsgrundlagen: Oktober 2026.";

export const AMPEL_QUELLEN_PATH = "/ampel-check/quellen";

/** Abbreviations on the Quellen & Methodik page. Source check 14.10.2026, item 1. */
export const AMPEL_ABBREVIATIONS =
  "Abkürzungen: GoBD = BMF-Schreiben vom 28.11.2019 (IV A 4 – S 0316/19/10003 :001, BStBl I S. 1269), geändert durch BMF-Schreiben vom 11.03.2024 (BStBl I S. 374) und vom 14.07.2025 (IV D 2 – S 0316/00128/005/088, BStBl I S. 1502). Rz. bezieht sich auf die Randziffern in der Fassung vom 14.07.2025.";

export type AmpelSourceRow = {
  source: string;
  content: string;
  status: string;
};

/** Quellen & Methodik table. Source check 14.10.2026, item 12. */
export const AMPEL_SOURCE_ROWS: readonly AmpelSourceRow[] = [
  {
    source: "BMF-Schreiben vom 11.03.2024 (1. Änderung GoBD, BStBl I S. 374)",
    content:
      "u. a. Datenüberlassung (Z3, Rz. 167–169 n. F.), Beschränkung des Datenzugriffs auf die Außenprüfung (Rz. 159), Anlage zur Datenüberlassung",
    status:
      "gesichert; Z1 = Rz. 165, Z2 = Rz. 166 (neu gefasst am 14.07.2025), Z3 = Rz. 167",
  },
  {
    source:
      "BMF-Schreiben vom 14.07.2025 (2. Änderung GoBD, IV D 2 – S 0316/00128/005/088, BStBl I S. 1502)",
    content:
      "Aufbewahrung von E-Rechnungen (Rz. 118, 119, 125, 127, 131), Fakturierung (Rz. 76), Zahlungsdienst-Nachweise (Rz. 121), Z2 (Rz. 166), Anwendung ab 14.07.2025 (Rz. 185)",
    status: "gesichert",
  },
  {
    source: "GoBD Rz. 130 und Rz. 136–141",
    content: "Bildliche Erfassung von Papierdokumenten",
    status: "gesichert",
  },
  {
    source: "GoBD Rz. 67",
    content: "Belegsicherung",
    status: "gesichert",
  },
  {
    source: "BEG IV (BGBl. 2024 I Nr. 323 vom 29.10.2024), Art. 97 § 19a Abs. 2 und 3 EGAO",
    content:
      "8 Jahre für Buchungsbelege (§ 147 Abs. 3 Satz 1 AO), anzuwenden auf alle Unterlagen, deren Frist am 31.12.2024 noch nicht abgelaufen war",
    status:
      "gesichert; Ausnahmen nach Abs. 3 für Institute i. S. d. KWG, VAG-beaufsichtigte Unternehmen und Wertpapierinstitute",
  },
  {
    source: "BMF-Schreiben vom 28.06.2024 (IV D 2 – S 0316-a/19/10011 :009)",
    content:
      "Mitteilungspflicht § 146a Abs. 4 AO über ELSTER ab 01.01.2025; Frist für den Altbestand (31.07.2025) abgelaufen; neue oder außer Betrieb genommene Kassen innerhalb eines Monats",
    status: "gesichert",
  },
  {
    source: "BMF-Schreiben vom 15.10.2024 (BStBl I S. 1320)",
    content: "E-Rechnung",
    status: "gesichert",
  },
  {
    source: "BMF-Schreiben vom 15.10.2025 (III C 2 – S 7287-a/00019/007/243)",
    content:
      "Änderung des Schreibens vom 15.10.2024 und des UStAE: Formatfehler, Validierung, Aufbewahrung des strukturierten Teils (UStAE 14b.1)",
    status: "gesichert",
  },
];
