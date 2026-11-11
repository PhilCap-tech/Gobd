/**
 * Index data for /fragen.
 * Welle-1 pages live in content/fragen. Later-wave rows marked kurz+link in the
 * content catalog are listed here as question plus existing article paths.
 * Those rows have no kurzantwort in the source, so none is stored.
 */
export const FRAGEN_GRUPPEN = [
  { key: "grundlagen-gobd", title: "Grundlagen der GoBD" },
  { key: "pflicht-adressaten", title: "Pflicht, Unternehmensgröße und Rechtsform" },
  { key: "verfahrensdokumentation-begriff-inhalt", title: "Inhalt und Aufbau der Verfahrensdokumentation" },
  { key: "erstellen-vorlage-muster", title: "Erstellen: Vorlage, Muster, Checkliste" },
  { key: "kosten-werkzeuge", title: "Kosten und Werkzeuge" },
  { key: "aufbewahrung-archiv", title: "Aufbewahrung und Archiv" },
  { key: "belege-e-rechnung", title: "Belege und E-Rechnung" },
  { key: "kasse-tse-kassennachschau", title: "Kasse und Kassennachschau" },
  { key: "it-cloud-systeme", title: "IT, Cloud und Systemwechsel" },
  { key: "betriebspruefung-datenzugriff", title: "Betriebsprüfung und Datenzugriff" },
  { key: "aktualisieren-versionierung", title: "Aktualisieren und Versionieren" },
  { key: "branchen", title: "Branchen" },
  { key: "verantwortung-auslagerung", title: "Verantwortung und Zusammenarbeit mit der Kanzlei" },
] as const;

export type FragenGruppeKey = (typeof FRAGEN_GRUPPEN)[number]["key"];

export type FragenKurzlink = {
  nr: number;
  gruppe: FragenGruppeKey;
  frage: string;
  slug: string;
  /** Live paths after kurz+link:. No short answer is included. */
  hrefs: readonly string[];
};

export const FRAGEN_KURZLINKS: readonly FragenKurzlink[] = [
  { nr: 14, gruppe: "pflicht-adressaten", frage: "Ab wann ist eine Verfahrensdokumentation nötig, etwa bei der Gründung?", slug: "verfahrensdokumentation-ab-wann", hrefs: ["/blog/verfahrensdokumentation-erstellen-gruendung"] },
  { nr: 15, gruppe: "pflicht-adressaten", frage: "Brauchen Freiberufler eine Verfahrensdokumentation?", slug: "verfahrensdokumentation-freiberufler-pflicht", hrefs: ["/blog/gobd-verfahrensdokumentation-dienstleister-freiberufler"] },
  { nr: 17, gruppe: "pflicht-adressaten", frage: "Braucht eine GmbH oder UG eine Verfahrensdokumentation?", slug: "verfahrensdokumentation-gmbh-ug-pflicht", hrefs: ["/blog/verfahrensdokumentation-gmbh"] },
  { nr: 28, gruppe: "verfahrensdokumentation-begriff-inhalt", frage: "Was hat das interne Kontrollsystem mit der Verfahrensdokumentation zu tun?", slug: "internes-kontrollsystem", hrefs: ["/blog/internes-kontrollsystem-verfahrensdokumentation"] },
  { nr: 36, gruppe: "erstellen-vorlage-muster", frage: "Wie erstelle ich eine Verfahrensdokumentation Schritt für Schritt?", slug: "verfahrensdokumentation-schritt-fuer-schritt", hrefs: ["/blog/gobd-verfahrensdokumentation-erstellen"] },
  { nr: 37, gruppe: "erstellen-vorlage-muster", frage: "Welche Informationen brauche ich, bevor ich die Verfahrensdokumentation schreibe?", slug: "informationen-vor-dem-erstellen", hrefs: ["/blog/verfahrensdokumentation-erstellen-vorbereitung"] },
  { nr: 38, gruppe: "erstellen-vorlage-muster", frage: "Gibt es eine Vorlage für die Verfahrensdokumentation als Word-Datei?", slug: "verfahrensdokumentation-vorlage-word", hrefs: ["/blog/verfahrensdokumentation-vorlage"] },
  { nr: 39, gruppe: "erstellen-vorlage-muster", frage: "Sind Muster von IHK oder AWV verbindlich?", slug: "ihk-awv-muster-verbindlich", hrefs: ["/blog/verfahrensdokumentation-vorlage"] },
  { nr: 40, gruppe: "erstellen-vorlage-muster", frage: "Welche Fehler passieren häufig beim Erstellen?", slug: "fehler-beim-erstellen", hrefs: ["/blog/verfahrensdokumentation-fehler"] },
  { nr: 43, gruppe: "kosten-werkzeuge", frage: "Welche Software hilft bei der Verfahrensdokumentation?", slug: "software-fuer-verfahrensdokumentation", hrefs: ["/blog/verfahrensdokumentation-software"] },
  { nr: 44, gruppe: "kosten-werkzeuge", frage: "Vorlage, Software oder Steuerberater: Was passt zu meinem Betrieb?", slug: "vorlage-software-oder-steuerberater", hrefs: ["/blog/verfahrensdokumentation-vorlage-software-steuerberater"] },
  { nr: 46, gruppe: "kosten-werkzeuge", frage: "Wie erstelle ich die Verfahrensdokumentation, wenn ich DATEV nutze?", slug: "verfahrensdokumentation-mit-datev", hrefs: ["/blog/verfahrensdokumentation-datev"] },
  { nr: 47, gruppe: "kosten-werkzeuge", frage: "Wie erstelle ich die Verfahrensdokumentation mit Lexware Office oder sevdesk?", slug: "verfahrensdokumentation-mit-lexware-sevdesk", hrefs: ["/blog/verfahrensdokumentation-lexware-sevdesk"] },
  { nr: 48, gruppe: "kosten-werkzeuge", frage: "Was kostet eine Verfahrensdokumentation bei der Steuerberatung?", slug: "kosten-steuerberatung-verfahrensdokumentation", hrefs: ["/blog/verfahrensdokumentation-kosten"] },
  { nr: 50, gruppe: "aufbewahrung-archiv", frage: "Wie lange muss die Verfahrensdokumentation aufbewahrt werden?", slug: "aufbewahrungsfrist-verfahrensdokumentation", hrefs: ["/blog/aufbewahrungsfristen-gobd"] },
  { nr: 51, gruppe: "aufbewahrung-archiv", frage: "Gilt die Frist von acht Jahren auch für ältere Buchungsbelege?", slug: "acht-jahre-aeltere-belege", hrefs: ["/blog/aufbewahrungsfristen-gobd"] },
  { nr: 53, gruppe: "aufbewahrung-archiv", frage: "Was ist ersetzendes Scannen?", slug: "ersetzendes-scannen", hrefs: ["/blog/ersetzendes-scannen-verfahrensdokumentation"] },
  { nr: 55, gruppe: "aufbewahrung-archiv", frage: "Reicht ein Cloud-Ordner als Archiv?", slug: "cloud-ordner-archiv", hrefs: ["/blog/verfahrensdokumentation-homeoffice-cloud"] },
  { nr: 58, gruppe: "belege-e-rechnung", frage: "Wie bewahre ich E-Rechnungen auf?", slug: "e-rechnung-aufbewahren", hrefs: ["/blog/verfahrensdokumentation-belegablage"] },
  { nr: 60, gruppe: "belege-e-rechnung", frage: "Wie dokumentiere ich Rechnungen aus E-Mail-Postfach und Portalen?", slug: "e-mail-portalrechnungen", hrefs: ["/blog/verfahrensdokumentation-checkliste-e-mail-portalrechnungen"] },
  { nr: 61, gruppe: "belege-e-rechnung", frage: "Wie dokumentiere ich Ausgangsrechnungen und Korrekturen?", slug: "ausgangsrechnungen-dokumentieren", hrefs: ["/blog/verfahrensdokumentation-muster-ausgangsrechnungen"] },
  { nr: 62, gruppe: "belege-e-rechnung", frage: "Wie dokumentiere ich Lohn und Gehalt in der Verfahrensdokumentation?", slug: "lohn-gehalt-dokumentieren", hrefs: ["/blog/verfahrensdokumentation-vorlage-lohn-gehalt"] },
  { nr: 63, gruppe: "belege-e-rechnung", frage: "Was gilt für Belege im Homeoffice und auf dem Smartphone?", slug: "belege-homeoffice-smartphone", hrefs: ["/blog/verfahrensdokumentation-homeoffice-cloud"] },
  { nr: 67, gruppe: "kasse-tse-kassennachschau", frage: "Muss ich meine Kasse beim Finanzamt melden?", slug: "kasse-beim-finanzamt-melden", hrefs: ["/kassen-check", "/blog/verfahrensdokumentation-kasse"] },
  { nr: 68, gruppe: "kasse-tse-kassennachschau", frage: "Was ist eine Kassennachschau?", slug: "was-ist-kassennachschau", hrefs: ["/blog/kassen-nachschau-ablauf-vorbereitung"] },
  { nr: 69, gruppe: "kasse-tse-kassennachschau", frage: "Welche Unterlagen sollte ich für eine Kassennachschau bereithalten?", slug: "unterlagen-kassennachschau", hrefs: ["/blog/kassen-nachschau-ablauf-vorbereitung"] },
  { nr: 71, gruppe: "kasse-tse-kassennachschau", frage: "Ersetzt die TSE die Verfahrensdokumentation?", slug: "tse-ersetzt-verfahrensdokumentation", hrefs: ["/blog/verfahrensdokumentation-kasse"] },
  { nr: 72, gruppe: "it-cloud-systeme", frage: "Wie dokumentiere ich Zugriffsrechte und Rollen?", slug: "zugriffsrechte-dokumentieren", hrefs: ["/blog/verfahrensdokumentation-checkliste-zugriffsrechte-rollen"] },
  { nr: 73, gruppe: "it-cloud-systeme", frage: "Wie beschreibe ich Datensicherung und Archivierung?", slug: "datensicherung-archivierung-dokumentieren", hrefs: ["/blog/verfahrensdokumentation-vorlage-datensicherung-archivierung"] },
  { nr: 74, gruppe: "it-cloud-systeme", frage: "Was ändert sich bei einem Softwarewechsel?", slug: "softwarewechsel-verfahrensdokumentation", hrefs: ["/blog/verfahrensdokumentation-systemwechsel"] },
  { nr: 77, gruppe: "it-cloud-systeme", frage: "Kann ich die Verfahrensdokumentation digital führen?", slug: "verfahrensdokumentation-digital-fuehren", hrefs: ["/blog/digitale-verfahrensdokumentation"] },
  { nr: 79, gruppe: "betriebspruefung-datenzugriff", frage: "Welche Fragen stellt die Prüfung zur Verfahrensdokumentation?", slug: "pruefungsfragen-verfahrensdokumentation", hrefs: ["/blog/betriebspruefung-fragen-verfahrensdokumentation"] },
  { nr: 80, gruppe: "betriebspruefung-datenzugriff", frage: "Was bedeutet Datenzugriff Z1, Z2 und Z3?", slug: "datenzugriff-z1-z2-z3", hrefs: ["/blog/datenzugriff-betriebspruefung"] },
  { nr: 81, gruppe: "betriebspruefung-datenzugriff", frage: "Betriebsprüfung angekündigt: Was tun mit der Verfahrensdokumentation?", slug: "betriebspruefung-angekuendigt", hrefs: ["/blog/betriebspruefung-angekuendigt-pruefungsanordnung"] },
  { nr: 82, gruppe: "betriebspruefung-datenzugriff", frage: "Welche Unterlagen fordert die Betriebsprüfung an?", slug: "unterlagen-betriebspruefung", hrefs: ["/blog/betriebspruefung-ablauf-unterlagen"] },
  { nr: 83, gruppe: "betriebspruefung-datenzugriff", frage: "Wie wirke ich bei einer Betriebsprüfung mit?", slug: "mitwirkung-betriebspruefung", hrefs: ["/blog/betriebspruefung-mitwirkung-vorbereitung"] },
  { nr: 86, gruppe: "aktualisieren-versionierung", frage: "Darf ich eine Verfahrensdokumentation nachträglich erstellen?", slug: "verfahrensdokumentation-nachtraeglich", hrefs: ["/blog/verfahrensdokumentation-fehlt-veraltet"] },
  { nr: 89, gruppe: "aktualisieren-versionierung", frage: "Wie erkenne ich, wo meine Verfahrensdokumentation steht?", slug: "stand-verfahrensdokumentation-einschaetzen", hrefs: ["/blog/verfahrensdokumentation-ampel-gruen-gelb-rot"] },
  { nr: 90, gruppe: "branchen", frage: "Was beschreibt ein Friseursalon in der Verfahrensdokumentation?", slug: "friseursalon-verfahrensdokumentation", hrefs: ["/verfahrensdokumentation-friseure", "/blog/verfahrensdokumentation-erstellen-friseur"] },
  { nr: 91, gruppe: "branchen", frage: "Was beschreibt ein Gastronomiebetrieb in der Verfahrensdokumentation?", slug: "gastronomie-verfahrensdokumentation", hrefs: ["/blog/verfahrensdokumentation-gastronomie"] },
  { nr: 92, gruppe: "branchen", frage: "Was beschreibt eine Arzt- oder Zahnarztpraxis in der Verfahrensdokumentation?", slug: "arztpraxis-verfahrensdokumentation", hrefs: ["/blog/verfahrensdokumentation-arztpraxis"] },
  { nr: 93, gruppe: "branchen", frage: "Was beschreibt eine Apotheke in der Verfahrensdokumentation?", slug: "apotheke-verfahrensdokumentation", hrefs: ["/verfahrensdokumentation-apotheke"] },
  { nr: 94, gruppe: "branchen", frage: "Was beschreibt der Einzelhandel in der Verfahrensdokumentation?", slug: "einzelhandel-verfahrensdokumentation", hrefs: ["/verfahrensdokumentation-einzelhandel"] },
  { nr: 95, gruppe: "branchen", frage: "Was beschreibt ein Onlinehändler in der Verfahrensdokumentation?", slug: "onlinehandel-verfahrensdokumentation", hrefs: ["/blog/gobd-verfahrensdokumentation-onlinehandel"] },
  { nr: 96, gruppe: "branchen", frage: "Was beschreibt ein Handwerksbetrieb in der Verfahrensdokumentation?", slug: "handwerk-verfahrensdokumentation", hrefs: ["/blog/verfahrensdokumentation-handwerk-kmu"] },
  { nr: 97, gruppe: "branchen", frage: "Was beschreibt eine Bäckerei in der Verfahrensdokumentation?", slug: "baeckerei-verfahrensdokumentation", hrefs: ["/blog/verfahrensdokumentation-baeckerei"] },
  { nr: 98, gruppe: "branchen", frage: "Was beschreibt ein Kosmetikstudio in der Verfahrensdokumentation?", slug: "kosmetikstudio-verfahrensdokumentation", hrefs: ["/verfahrensdokumentation-kosmetikstudio"] },
  { nr: 99, gruppe: "branchen", frage: "Braucht ein Verein eine Verfahrensdokumentation?", slug: "verein-verfahrensdokumentation", hrefs: ["/verfahrensdokumentation-verein"] },
  { nr: 101, gruppe: "verantwortung-auslagerung", frage: "Wer macht was zwischen Betrieb und Steuerberatung?", slug: "arbeitsteilung-steuerberatung", hrefs: ["/blog/verfahrensdokumentation-steuerberater-arbeitsteilung", "/steuerberater"] },
  { nr: 102, gruppe: "verantwortung-auslagerung", frage: "Was übergebe ich der Steuerberatung zum Jahresende?", slug: "jahresuebergabe-steuerberatung", hrefs: ["/blog/verfahrensdokumentation-checkliste-steuerberater-jahresuebergabe"] },
  { nr: 103, gruppe: "verantwortung-auslagerung", frage: "Wie halte ich Zuständigkeiten und Vertretungen fest?", slug: "zustaendigkeiten-vertretung", hrefs: ["/blog/verfahrensdokumentation-checkliste-zustaendigkeiten-vertretung"] },
];

/** Catalog number of each Welle-1 slug, for index order. */
export const FRAGEN_WELLE1_NR: Record<string, number> = {
  "was-ist-gobd": 1,
  "gobd-erfuellen": 2,
  "unterschied-gobd-verfahrensdokumentation": 3,
  "ist-verfahrensdokumentation-pflicht": 10,
  "wer-muss-verfahrensdokumentation": 11,
  "gobd-kleine-unternehmen": 12,
  "verfahrensdokumentation-kleinunternehmer-einzelunternehmen": 13,
  "was-ist-eine-verfahrensdokumentation": 19,
  "was-gehoert-in-verfahrensdokumentation": 20,
  "wie-sieht-verfahrensdokumentation-aus": 21,
  "verfahrensdokumentation-erstellen-einfach": 30,
  "gibt-es-vorlage-verfahrensdokumentation": 31,
  "muster-verfahrensdokumentation-beispiel": 32,
  "checkliste-verfahrensdokumentation-gobd": 33,
  "verfahrensdokumentation-selbst-schreiben": 34,
  "verfahrensdokumentation-erstellen-lassen": 35,
  "was-kostet-verfahrensdokumentation": 42,
  "aufbewahrungsfristen": 49,
  "belegablage-dokumentieren": 56,
  "verfahrensdokumentation-fuer-kasse": 64,
  "verfahrensdokumentation-betriebspruefung-vorlegen": 78,
  "verfahrensdokumentation-aktualisieren-wann": 84,
  "verfahrensdokumentation-fehlt-was-tun": 85,
  "verantwortung-steuerberater-buchhaltung": 100,
};
