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
      "Elektronische Aufzeichnungssysteme mit Kassenfunktion müssen durch eine zertifizierte TSE geschützt sein. Seit dem 01.01.2025 werden sie über ELSTER gemeldet. Antworten Sie nur mit „Ja“, wenn beides zutrifft.",
    weight: 3,
    applicable: "optional",
    source:
      "§ 146a Abs. 1 und Abs. 4 AO; §§ 1–3 KassenSichV; BMF-Schreiben vom 28.06.2024 zur Mitteilungspflicht nach § 146a Abs. 4 AO [Datum prüfen]",
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
      "§ 147 Abs. 1 und Abs. 3 AO i. d. F. des Vierten Bürokratieentlastungsgesetzes (BEG IV); Übergangsregel Art. 97 § 19a EGAO [prüfen]; GoBD Rz. 113 ff.",
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
      "Könnten Sie der Betriebsprüfung Ihre steuerrelevanten Daten maschinell auswertbar zur Verfügung stellen, also per Lesezugriff, per Auswertung nach Vorgabe oder auf einem Datenträger?",
    explanation:
      "Die Finanzverwaltung hat das Recht auf unmittelbaren Datenzugriff (Z1), mittelbaren Datenzugriff (Z2) und Datenträgerüberlassung (Z3). Dafür müssen die Daten während der Aufbewahrungsfrist verfügbar und maschinell auswertbar sein.",
    weight: 2,
    applicable: "required",
    source:
      "§ 147 Abs. 6 AO; GoBD Rz. 158–174 i. d. F. des BMF-Schreibens vom 11.03.2024 (Z1: Rz. 165, Z2: Rz. 166, Z3: Rz. 167 [Rz. nach Änderung 2024 prüfen])",
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
    source: "GoBD Rz. 136–141 [Rz.-Spanne prüfen]; § 147 Abs. 2 AO; BSI TR-03138 (TR-RESISCAN)",
  },
  {
    id: "erechnung",
    question:
      "Können Sie E-Rechnungen (z. B. XRechnung oder ZUGFeRD) empfangen, verarbeiten und im strukturierten Originalformat aufbewahren?",
    explanation:
      "Seit dem 01.01.2025 müssen alle inländischen Unternehmen E-Rechnungen im B2B-Bereich empfangen können. Für die Aufbewahrung ist der strukturierte Teil der E-Rechnung maßgeblich.",
    weight: 2,
    applicable: "required",
    source:
      "§ 14 Abs. 1 und Abs. 2 UStG i. d. F. des Wachstumschancengesetzes; § 27 Abs. 38 UStG; BMF-Schreiben vom 15.10.2024 zur E-Rechnung; GoBD i. d. F. des BMF-Schreibens vom 14.07.2025 [Rz. prüfen]",
  },
  {
    id: "belegfluss",
    question:
      "Ist dokumentiert, wie ein Beleg bei Ihnen vom Eingang über Prüfung und Buchung bis zur Ablage läuft?",
    explanation:
      "Die Verfahrensdokumentation beschreibt den organisatorisch und technisch gewollten Prozess, von der Entstehung der Information über Erfassung, Verarbeitung und Speicherung bis zur Wiederauffindbarkeit. Belege sind zeitnah gegen Verlust zu sichern.",
    weight: 2,
    applicable: "required",
    source: "GoBD Rz. 152, Rz. 67 (Belegsicherung) [Rz. 67 prüfen]; § 146 Abs. 1 AO",
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
  label: "Ergebnis per E-Mail erhalten",
  placeholder: "Ihre E-Mail-Adresse",
  button: "Ergebnis zusenden",
  doiNote:
    "Sie erhalten zuerst eine E-Mail mit einem Bestätigungslink. Ihr Ergebnis senden wir Ihnen erst, wenn Sie diesen Link angeklickt haben. Die Einwilligung können Sie jederzeit widerrufen.",
  doiSuccess:
    "Fast geschafft: Bitte bestätigen Sie Ihre E-Mail-Adresse über den Link, den wir Ihnen gerade gesendet haben.",
};

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

// Review markers stay inside the source strings above so Growth's copy remains
// unchanged. They are stripped before any customer-facing render. Verify each
// item against the BMF original, then remove the marker from `source`.
// TODO(ampel-quellen): kasse_tse — BMF-Schreiben vom 28.06.2024, Mitteilungspflicht § 146a Abs. 4 AO: Datum prüfen.
// TODO(ampel-quellen): aufbewahrung — Übergangsregel Art. 97 § 19a EGAO prüfen; BGBl.-Nr. und EGAO-Fundstelle des BEG IV prüfen.
// TODO(ampel-quellen): datenzugriff — Rz.-Zuordnung Z1–Z3 nach dem BMF-Schreiben vom 11.03.2024 prüfen (Z1: Rz. 165, Z2: Rz. 166, Z3: Rz. 167).
// TODO(ampel-quellen): scannen — GoBD Rz.-Spanne 136–141 prüfen.
// TODO(ampel-quellen): erechnung — Rz. der GoBD in der Fassung des BMF-Schreibens vom 14.07.2025 prüfen; Datum und Umfang dieser Änderung prüfen.
// TODO(ampel-quellen): belegfluss — GoBD Rz. 67 (Belegsicherung) prüfen.
// TODO(ampel-quellen): BMF-Schreiben vom 15.10.2024 zur E-Rechnung — mögliche Aktualisierung 2025 prüfen.
