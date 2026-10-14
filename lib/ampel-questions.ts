export type AmpelAnswer = "ja" | "nein" | "nicht_zutreffend";

export interface AmpelQuestion {
  id: string;
  question: string;
  explanation: string;
  weight: 1 | 2 | 3;
  applicable: "required" | "optional"; // optional = Option „Trifft nicht zu“ anzeigen
  source: string;
}

export const AMPEL_H1 =
  "Betriebsprüfungs-Ampel: Wie gut ist Ihre Buchführung dokumentiert?";

export const AMPEL_INTRO =
  "Beantworten Sie 10 Fragen mit Ja oder Nein und sehen Sie nach etwa zwei Minuten, wie gut Ihre Buchführungsprozesse für eine Betriebsprüfung dokumentiert sind. Die Ampel dient der Orientierung und ersetzt keine Steuerberatung.";

export const AMPEL_QUESTIONS: AmpelQuestion[] = [
  {
    id: "vd_vorhanden",
    question:
      "Gibt es für Ihr Unternehmen eine schriftliche Verfahrensdokumentation zu Ihren buchführungsrelevanten Prozessen und IT-Systemen?",
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
      "Änderungen an der Verfahrensdokumentation müssen historisch nachvollziehbar sein, frühere Fassungen sind aufzubewahren. Ein festes Prüfintervall schreibt das Gesetz nicht vor. Eine jährliche Durchsicht ist eine verbreitete Praxisempfehlung.",
    weight: 2,
    applicable: "required",
    source: "GoBD Rz. 154; § 147 Abs. 1 Nr. 1 AO (Arbeitsanweisungen und sonstige Organisationsunterlagen)",
  },
  {
    id: "kasse_tse",
    question:
      "Falls Sie eine elektronische Kasse nutzen: Ist sie mit einer zertifizierten technischen Sicherheitseinrichtung (TSE) ausgestattet und beim Finanzamt gemeldet?",
    explanation:
      "Elektronische Aufzeichnungssysteme mit Kassenfunktion müssen durch eine zertifizierte TSE geschützt sein. Seit dem 01.01.2025 steht für die Mitteilung an das Finanzamt das Verfahren über „Mein ELSTER“ zur Verfügung. Neu angeschaffte Systeme sind innerhalb eines Monats zu melden, ebenso ihre Außerbetriebnahme. Antworten Sie nur mit „Ja“, wenn beides zutrifft.",
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
      "§ 147 Abs. 1 und Abs. 3 AO i. d. F. des Vierten Bürokratieentlastungsgesetzes (BGBl. 2024 I Nr. 323); Übergangsregel Art. 97 § 19a Abs. 2 und 3 EGAO; GoBD Rz. 113 ff.",
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
      "Die GoBD erwarten ein internes Kontrollsystem (IKS), zum Beispiel mit Zugangs- und Zugriffsberechtigungen, Funktionstrennung und Abstimmungskontrollen. Wie umfangreich es sein muss, hängt von Größe und Komplexität des Unternehmens ab.",
    weight: 2,
    applicable: "required",
    source: "GoBD Rz. 100–102",
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
      "Seit dem 01.01.2025 müssen alle inländischen Unternehmen E-Rechnungen im B2B-Bereich empfangen können. Für die Aufbewahrung ist der strukturierte Teil der E-Rechnung (z. B. die XML-Datei) maßgeblich. Den Bildteil einer hybriden Rechnung bewahren Sie zusätzlich auf, wenn er weitere steuerlich wichtige Angaben enthält, etwa Buchungsvermerke.",
    weight: 2,
    applicable: "required",
    source:
      "§ 14 Abs. 1 und Abs. 2 UStG i. d. F. des Wachstumschancengesetzes; § 27 Abs. 38 UStG; BMF-Schreiben vom 15.10.2024 (BStBl I S. 1320) und vom 15.10.2025 zur E-Rechnung; GoBD Rz. 118, 119 und 131 i. d. F. vom 14.07.2025",
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
    headline: "Deutlicher Nachholbedarf: Wichtige Grundlagen sind noch nicht dokumentiert.",
    text:
      "Laut Ihren Angaben fehlen mehrere grundlegende Bausteine. Das kommt häufig vor und lässt sich Schritt für Schritt angehen. Wichtig ist, mit einer klaren Reihenfolge zu beginnen.",
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
  price: "149 € einmalige Einrichtung + 49 € pro Monat, zzgl. USt. Monatlich kündbar.",
  button: "Verfahrensdokumentation starten",
  secondary: "So funktioniert es",
};

export const AMPEL_RESULT_MAIL = {
  label: "Ergebnis ansehen",
  placeholder: "Ihre E-Mail-Adresse",
  button: "Ergebnis anzeigen",
  invalidEmail: "Bitte geben Sie eine gültige E-Mail-Adresse an.",
  sendFailed: "Das Ergebnis konnte gerade nicht gesendet werden. Bitte versuchen Sie es später erneut.",
  rateLimited: "Sie haben diese Abfrage zu oft gesendet. Bitte versuchen Sie es später erneut.",
  sent: "Das PDF mit Ihrem Ergebnis ist unterwegs. Die Auswertung sehen Sie auch auf dieser Seite.",
  doiSuccess:
    "Zusätzlich haben wir Ihnen eine E-Mail mit einem Bestätigungslink gesendet. Die Einwilligung können Sie jederzeit widerrufen.",
};

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
 * Offene Punkte, nicht auf der Seite:
 * Für die Übermittlung in die USA stützen wir uns auf [klären: EU-US Data Privacy Framework, sofern Resend zertifiziert ist, sonst Standardvertragsklauseln].
 * Das Nachweisprotokoll bewahren wir bis zu drei Jahre nach dem Widerruf auf [klären].
 * Diese Daten löschen wir nach [klären: Frist, z. B. 7 Tagen], soweit sie nicht zur Aufklärung eines konkreten Missbrauchs länger benötigt werden.
 */
export const AMPEL_PRIVACY_PARAGRAPHS = [
  "Wenn Sie den Ampel-Check nutzen, verarbeiten wir Ihre E-Mail-Adresse und Ihre Antworten im Check, um Ihnen das Ergebnis anzuzeigen und zusätzlich als PDF per E-Mail zuzusenden. Die Angabe der E-Mail-Adresse ist dafür erforderlich. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO (Durchführung vorvertraglicher Maßnahmen auf Ihre Anfrage). Ohne Ihre gesonderte Einwilligung nutzen wir die Adresse nicht für Werbung.",
  "Wenn Sie zusätzlich in E-Mail-Informationen einwilligen, senden wir Ihnen zunächst eine Bestätigungs-E-Mail (Double-Opt-in). Erst nach Ihrer Bestätigung erhalten Sie Informationen zu GoBD-Themen und unseren Angeboten. Wir speichern den Zeitpunkt Ihrer Anmeldung und Bestätigung, die dabei verwendete IP-Adresse und den Text der Einwilligung, um die Einwilligung nachweisen zu können. Rechtsgrundlage ist Ihre Einwilligung (Art. 6 Abs. 1 lit. a DSGVO, § 7 Abs. 2 Nr. 2 UWG), für das Nachweisprotokoll Art. 6 Abs. 1 lit. c und f DSGVO.",
  "Für den Versand der E-Mails setzen wir Resend (Plus Five Five, Inc., USA) als Auftragsverarbeiter nach Art. 28 DSGVO ein. Dabei werden Ihre E-Mail-Adresse, der Inhalt der E-Mail und technische Versanddaten (z. B. Zustellstatus) verarbeitet.",
  "Schutz vor Missbrauch: Um den Ampel-Check und den E-Mail-Versand vor Missbrauch zu schützen (z. B. massenhafte Anfragen oder Versand an fremde Adressen), verarbeiten wir beim Absenden Ihre IP-Adresse, den Zeitpunkt und eine Zählung der Anfragen (Rate-Limiting). Rechtsgrundlage ist unser berechtigtes Interesse an einem sicheren, missbrauchsfreien Betrieb (Art. 6 Abs. 1 lit. f DSGVO).",
  "Speicherdauer: Die Angaben zum Ampel-Check speichern wir 90 Tage nach dem Check und löschen sie danach, soweit keine gesetzlichen Aufbewahrungspflichten bestehen oder Sie Kunde werden. Bei erteilter Einwilligung speichern wir Ihre Adresse für E-Mail-Informationen, bis Sie die Einwilligung widerrufen.",
  "Widerruf: Sie können Ihre Einwilligung jederzeit mit Wirkung für die Zukunft widerrufen, über den Abmeldelink in jeder E-Mail oder per Nachricht an info@gobd-doku-erstellen.de. Die Rechtmäßigkeit der bis zum Widerruf erfolgten Verarbeitung bleibt unberührt.",
] as const;

export const AMPEL_SHARE_KANZLEI = {
  button: "Mit Mandanten teilen",
  headline: "Für Steuerkanzleien",
  intro:
    "Teilen Sie die Ampel mit Ihren Mandanten. Sie sehen dann vor dem Gespräch, wo bei der Dokumentation Handlungsbedarf besteht.",
  message:
    "Wie gut ist Ihre Buchführung für eine Betriebsprüfung dokumentiert? Mit der kostenlosen Betriebsprüfungs-Ampel beantworten Sie in etwa zwei Minuten 10 Ja/Nein-Fragen und erhalten eine erste Einschätzung. Gerne besprechen wir das Ergebnis anschließend gemeinsam: {link}",
  copied: "Link kopiert",
};

export const AMPEL_DISCLAIMER =
  "Die Betriebsprüfungs-Ampel dient ausschließlich der Orientierung und ist keine Steuerberatung. Sie ersetzt weder eine Prüfung im Einzelfall noch die Beratung durch eine Steuerberaterin oder einen Steuerberater. Das Ergebnis beruht allein auf Ihren Angaben und bestätigt nicht, dass Ihre Buchführung ordnungsgemäß ist. Stand der Rechtsgrundlagen: Oktober 2026.";

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
      "Mitteilungspflicht § 146a Abs. 4 AO über ELSTER ab 01.01.2025; Altbestand bis 31.07.2025; danach Monatsfrist",
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
