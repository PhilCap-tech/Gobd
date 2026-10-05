/**
 * Modulkatalog: komplette Verfahrensdokumentation in 24 Modulen.
 * Konzept: gobd-ops/product/24-module-konzept.md
 *
 * Kapitelnummer im Gesamtdokument = Modulnummer. Teil I (Allgemeine
 * Beschreibung) = Modul 1, Teil II (Anwenderdokumentation) = 2–14,
 * Teil III (Technische Systemdokumentation) = 15–19, Teil IV
 * (Betriebsdokumentation) = 20–24 (Gliederung nach GoBD Rz. 153).
 */
import {
  BEREICHE,
  bereichById,
  type Bereich,
  type BereichFrist,
  type BereichKontrolle,
  type BereichQuestion,
  type BereichSchritt,
} from "@/lib/bereiche";
import {
  AE,
  AF,
  AR,
  AU,
  AW,
  BS,
  BU,
  ER,
  KF,
  LE,
  PB,
  PF,
  PZ,
  SN,
  SY,
  UO,
  ZD,
  ZR,
  type FragenGruppe,
} from "@/lib/module/fragen";
import type { CheckKey, ModulDef, ModulGruppe, ModulTeil } from "@/lib/module/typen";

export const TEIL_TITEL: Record<ModulTeil, string> = {
  1: "Teil I: Allgemeine Beschreibung",
  2: "Teil II: Anwenderdokumentation",
  3: "Teil III: Technische Systemdokumentation",
  4: "Teil IV: Betriebsdokumentation",
};

export const TEIL_KURZ: Record<ModulTeil, string> = {
  1: "Unternehmen, Organisation, Geltungsbereich und Verantwortung.",
  2: "Die steuerlich relevanten Abläufe vom Geschäftsvorfall bis zur Buchung, wie sie im Betrieb ausgeführt werden.",
  3: "Systeme, Schnittstellen, Archiv, Fristen, Zugriffsrechte und Sicherung.",
  4: "Kontrollen, ausgelagerte Aufgaben, Prüfungszugriff, Änderungen und Pflege der Dokumentation.",
};

const FRIST_VD: BereichFrist = {
  unterlage: "Diese Verfahrensdokumentation, Arbeitsanweisungen und Organisationsunterlagen",
  frist: "10 Jahre",
  grundlage: "§ 147 Abs. 1 Nr. 1, Abs. 3 AO",
};
const beleg = (unterlage: string): BereichFrist => ({ unterlage, frist: "8 Jahre", grundlage: "§ 147 Abs. 1 Nr. 4, Abs. 3 AO" });
const brief = (unterlage: string): BereichFrist => ({ unterlage, frist: "6 Jahre", grundlage: "§ 147 Abs. 1 Nr. 2, 3, Abs. 3 AO" });
const buch = (unterlage: string): BereichFrist => ({ unterlage, frist: "10 Jahre", grundlage: "§ 147 Abs. 1 Nr. 1, Abs. 3 AO" });
const sonstige = (unterlage: string): BereichFrist => ({ unterlage, frist: "6 Jahre", grundlage: "§ 147 Abs. 1 Nr. 5, Abs. 3 AO" });

const own = (titel: string, g: FragenGruppe, extra: Partial<ModulGruppe> = {}): ModulGruppe => ({ titel, questions: g.questions, ...extra });

export const MODULE: ModulDef[] = [
  {
    id: "m01",
    nr: 1,
    titel: "Unternehmen und Organisation",
    kurz: "Tätigkeiten, Gesellschaften, Standorte, Zuständigkeiten, Vertretungen und Geltungsbereich.",
    inhalt: ["Tätigkeiten und Geschäftsvorfälle", "Gesellschaften und Standorte", "Zuständigkeiten und Vertretungen", "Zeichnungs- und Freigabebefugnisse", "Geltungsbereich dieser Fassung"],
    teil: 1,
    typ: "kern",
    catalogIds: ["A01", "A04"],
    vorlagen: ["02.1", "02.2", "02.3"],
    gruppen: [own("Organisation und Geltungsbereich", UO)],
    aufbewahrung: [FRIST_VD],
    begriffe: [["Geschäftsvorfall", "Vorgang, der das Vermögen, die Schulden oder das Ergebnis des Unternehmens verändert und aufzuzeichnen ist."]],
  },
  {
    id: "m02",
    nr: 2,
    titel: "Verkauf und Leistungserbringung",
    kurz: "Auftrag oder Vertrag, Lieferung oder Leistung mit Nachweis, Abrechnung; Angebote, Auftragsänderungen, Abnahmen.",
    inhalt: ["Angebote und Aufträge", "Preise, Konditionen und Kundenstammdaten", "Auftragsänderungen", "Lieferung, Leistung und Nachweis", "Abnahmen", "Vollständige Abrechnung"],
    teil: 2,
    typ: "regel",
    catalogIds: [],
    vorlagen: [],
    gruppen: [
      { titel: "Auftrag, Angebot und Stammdaten", bereich: "verkauf", ids: ["VK00", "VK01", "VK02", "VK03", "VK04", "VK91", "VK92"] },
      own("Lieferung, Leistung und Abnahme", LE),
    ],
    hinweis: "Der Weg vom Angebot über Auftrag und Leistung bis zur Rechnung soll lückenlos nachvollziehbar sein. Leistungsnachweise verbinden die erbrachte Leistung mit der Rechnung.",
    prozess: [
      { schritt: "Angebot und Auftrag", beschreibung: "Angebot wird erstellt, Auftrag angenommen und erfasst.", frage: "VK02", rolle: "VK00.verantwortlich", nachweis: "Angebot, Auftragsbestätigung" },
      { schritt: "Auftragsänderung", beschreibung: "Änderungen an Umfang, Preis oder Termin werden bestätigt.", frage: "LE01", rolle: "LE01.wer", nachweis: "Bestätigte Änderung" },
      { schritt: "Lieferung oder Leistung", beschreibung: "Leistung wird erbracht und nachgewiesen.", frage: "LE02", nachweis: "Lieferschein, Leistungsnachweis" },
      { schritt: "Abnahme", beschreibung: "Kunde nimmt die Leistung ab, soweit vorgesehen.", frage: "LE03", nachweis: "Abnahmeprotokoll" },
      { schritt: "Abrechnungsabgleich", beschreibung: "Erbrachte Leistungen werden mit den Rechnungen abgeglichen.", frage: "LE05", rolle: "LE05.wer", nachweis: "Abgleichsvermerk" },
    ],
    aufbewahrung: [
      brief("Angebote, Auftragsbestätigungen und Geschäftskorrespondenz (empfangene und Wiedergaben abgesandter Handels- oder Geschäftsbriefe)"),
      sonstige("Verträge und Leistungsnachweise, soweit für die Besteuerung von Bedeutung und nicht Buchungsbeleg"),
      { unterlage: "Abgesandte Lieferscheine, soweit kein Buchungsbeleg", frist: "bis zum Versand der Rechnung", grundlage: "§ 147 Abs. 3 Satz 4 AO" },
    ],
    begriffe: [["Leistungsnachweis", "Unterlage, die belegt, dass und in welchem Umfang geliefert oder geleistet wurde (z. B. Lieferschein, Stundenzettel, Abnahmeprotokoll)."]],
  },
  {
    id: "m03",
    nr: 3,
    titel: "Einkauf und Rechnungseingang",
    kurz: "Bestellung, Wareneingang oder Leistungsprüfung, Rechnungseingang, sachliche Prüfung und Freigabe.",
    inhalt: ["Bedarf und Bestellung", "Wareneingang und Leistungsprüfung", "Eingangskanäle der Rechnungen", "Sachliche und rechnerische Prüfung", "Freigabe"],
    teil: 2,
    typ: "regel",
    catalogIds: ["C01", "C02", "E03"],
    vorlagen: ["04.0", "04.1", "04.2", "04.3", "05.0", "05.1", "05.3", "05.4"],
    gruppen: [{ titel: "Bestellung, Wareneingang und Abgleich", bereich: "einkauf" }],
    aufbewahrung: [],
  },
  {
    id: "m04",
    nr: 4,
    titel: "Ausgangsrechnungen und Korrekturen",
    kurz: "Erstellung, Nummernvergabe, Versand, Abschlags- und Schlussrechnungen, Gutschriften, Stornos und Berichtigungen.",
    inhalt: ["Erstellung und Pflichtangaben", "Nummernvergabe", "Versand", "Abschlags- und Schlussrechnungen", "Gutschriften", "Stornos und Berichtigungen", "Rechnungsdoppel"],
    teil: 2,
    typ: "regel",
    catalogIds: ["E05"],
    vorlagen: ["07.0", "07.1", "07.2", "07.3", "07.4"],
    gruppen: [
      { titel: "Rechnungsstellung", bereich: "verkauf", ids: ["VK05", "VK06", "VK07", "VK08", "VK10"] },
      own("Abschläge, Gutschriften und Berichtigungen", AR),
    ],
    hinweis: "Rechnungsnummern sind einmalig zu vergeben. Eine Berichtigung bezieht sich spezifisch und eindeutig auf die ursprüngliche Rechnung (§ 31 Abs. 5 UStDV); die ursprüngliche Rechnung bleibt erhalten.",
    prozess: [
      { schritt: "Rechnung erstellen", beschreibung: "Rechnung wird aus Auftrag oder Leistungsnachweis erstellt.", frage: "E05", rolle: "E05.wer", nachweis: "Rechnung im System" },
      { schritt: "Nummer vergeben", beschreibung: "Fortlaufende, einmalige Rechnungsnummer.", frage: "VK05", nachweis: "Nummernkreis" },
      { schritt: "Versand", beschreibung: "Rechnung wird auf dem vereinbarten Weg versendet.", frage: "VK07", nachweis: "Versandnachweis" },
      { schritt: "Korrektur", beschreibung: "Storno, Berichtigung oder Gutschrift mit Bezug zur Ursprungsrechnung.", frage: "AR03", rolle: "AR03.freigabe", nachweis: "Korrekturbeleg" },
      { schritt: "Ablage des Doppels", beschreibung: "Rechnungsdoppel wird unverändert archiviert.", frage: "AR04", nachweis: "Archiv" },
    ],
    aufbewahrung: [beleg("Doppel der Ausgangsrechnungen, Gutschriften, Storno- und Korrekturrechnungen")],
    begriffe: [
      ["Gutschrift (umsatzsteuerlich)", "Rechnung, die der Leistungsempfänger ausstellt (§ 14 Abs. 2 Satz 2 UStG)."],
      ["Stornorechnung", "Beleg, der eine fehlerhafte Rechnung mit Bezug auf diese aufhebt."],
    ],
  },
  {
    id: "m05",
    nr: 5,
    titel: "Elektronische Belege und E-Rechnungen",
    kurz: "Empfang, Erstellung, Prüfung, Verarbeitung und Aufbewahrung digitaler Dokumente und strukturierter Rechnungsdaten.",
    inhalt: ["Empfangskanäle", "Formate (PDF, XRechnung, ZUGFeRD)", "Anzeige, Validierung und Prüfung", "Erstellung von E-Rechnungen", "Speicherung der strukturierten Daten", "Konvertierung"],
    teil: 2,
    typ: "betrieb",
    trigger: "erechnung",
    catalogIds: ["E01", "E02", "B04"],
    vorlagen: ["05.2", "09.3"],
    gruppen: [own("Elektronische Belege und E-Rechnungen", ER)],
    hinweis: "Seit 01.01.2025 müssen inländische Unternehmen E-Rechnungen im B2B-Bereich empfangen können. Eine PDF-Datei ist keine E-Rechnung im Sinne des Umsatzsteuergesetzes.",
    prozess: [
      { schritt: "Empfang", beschreibung: "Elektronischer Beleg geht über einen festgelegten Kanal ein.", frage: "ER01", rolle: "ER00.verantwortlich", nachweis: "Postfach, Portal" },
      { schritt: "Anzeige und Prüfung", beschreibung: "Strukturierte Daten werden lesbar gemacht und geprüft.", frage: "ER02", nachweis: "Prüfvermerk" },
      { schritt: "Speicherung", beschreibung: "Original (XML) wird unverändert gespeichert und mit der Buchung verbunden.", frage: "ER04", nachweis: "Archiv mit Beleg-ID" },
      { schritt: "Erstellung", beschreibung: "Eigene E-Rechnungen werden im vereinbarten Format erzeugt.", frage: "ER03", nachweis: "Rechnungsdatei" },
    ],
    aufbewahrung: [
      beleg("Empfangene und Doppel versandter E-Rechnungen im strukturierten Originalformat"),
      brief("E-Mails als empfangene oder abgesandte Handels- oder Geschäftsbriefe"),
    ],
    begriffe: [
      ["E-Rechnung", "Rechnung in einem strukturierten elektronischen Format, das eine elektronische Verarbeitung ermöglicht (z. B. XRechnung, ZUGFeRD ab Profil EN 16931)."],
      ["Strukturierter Datensatz", "Der maschinenlesbare Teil einer E-Rechnung (XML). Er ist das Original."],
    ],
  },
  {
    id: "m06",
    nr: 6,
    titel: "Papierbelege und Digitalisierung",
    kurz: "Annahme, Scannen oder Fotografieren, Qualitätskontrolle, Übergabe ins Archiv, Originalaufbewahrung und gegebenenfalls Vernichtung.",
    inhalt: ["Annahme von Papierbelegen", "Scannen oder Fotografieren", "Qualitätskontrolle", "Übergabe ins Archiv", "Aufbewahrung der Originale", "Vernichtung nach dem Scannen"],
    teil: 2,
    typ: "betrieb",
    trigger: "papier",
    catalogIds: ["C03", "D01"],
    vorlagen: ["06.0", "06.1", "06.2", "06.3", "06.4"],
    gruppen: [own("Digitalisierung und Originale", PB)],
    prozess: [
      { schritt: "Annahme", beschreibung: "Papierbeleg wird entgegengenommen und gekennzeichnet.", frage: "C03", nachweis: "Eingangsstempel oder Vermerk" },
      { schritt: "Scannen", beschreibung: "Beleg wird vollständig und lesbar digitalisiert.", frage: "PB01", rolle: "PB00.verantwortlich", nachweis: "Scanbild" },
      { schritt: "Qualitätskontrolle", beschreibung: "Vollständigkeit und Lesbarkeit werden geprüft.", frage: "PB02", rolle: "PB02.wer", nachweis: "Prüfvermerk" },
      { schritt: "Archiv", beschreibung: "Scanbild wird mit Suchmerkmalen abgelegt.", frage: "PB03", nachweis: "Archiveintrag" },
      { schritt: "Original", beschreibung: "Original wird aufbewahrt oder nach Freigabe vernichtet.", frage: "PB05", nachweis: "Ablage oder Vernichtungsprotokoll" },
    ],
    aufbewahrung: [
      beleg("Papierbelege mit Belegfunktion (Original oder bildliche Wiedergabe nach § 147 Abs. 2 AO)"),
    ],
    begriffe: [["Ersetzendes Scannen", "Digitalisierung mit anschließender Vernichtung des Papieroriginals nach einem beschriebenen Verfahren."]],
  },
  {
    id: "m07",
    nr: 7,
    titel: "Zahlungsverkehr und offene Posten",
    kurz: "Bank, Lastschrift, Kreditkarte, Zahlungsdienstleister; Zahlungsfreigaben, Abgleich, Gebühren, Rückzahlungen und Rückbelastungen.",
    inhalt: ["Konten und Vollmachten", "Zahlungsvorbereitung und Freigabe", "Lastschriften und Kreditkarten", "Zahlungsdienstleister", "Abgleich offener Posten", "Gebühren, Rückzahlungen, Rückbelastungen"],
    teil: 2,
    typ: "regel",
    catalogIds: [],
    vorlagen: [],
    gruppen: [
      { titel: "Bank und Zahlungsfreigabe", bereich: "bank" },
      { titel: "Offene Posten und Mahnwesen", bereich: "verkauf", ids: ["VK09"] },
      own("Zahlungsdienstleister, Rückzahlungen und Abgleich", ZD, { teil: "zahlungsdienstleister" }),
    ],
  },
  {
    id: "m08",
    nr: 8,
    titel: "Bargeld und Kassenführung",
    kurz: "Elektronische Kasse oder offene Ladenkasse, Einzelaufzeichnungen, Kassenaufnahme, Tagesabschluss, Einlagen, Entnahmen, Stornos und Ausfälle.",
    inhalt: ["Kassenart und TSE", "Einzelaufzeichnung und Belegausgabe", "Kassenaufnahme und Tagesabschluss", "Einlagen, Entnahmen, Stornos", "Ausfall der Kasse", "Übergabe an die Buchhaltung"],
    teil: 2,
    typ: "betrieb",
    trigger: "bargeld",
    catalogIds: [],
    vorlagen: [],
    gruppen: [{ titel: "Kassenführung", bereich: "kasse" }],
  },
  {
    id: "m09",
    nr: 9,
    titel: "Buchführung und Abschlüsse",
    kurz: "Belegzuordnung, Kontierung, Buchung, Festschreibung, Korrekturen, Abstimmungen, Abschlussarbeiten und Übergabe an die Kanzlei.",
    inhalt: ["Prüfung, Freigabe und Übergabe zur Buchung", "Kontierung und Buchung", "Festschreibung", "Korrekturbuchungen", "Abstimmungen", "Umsatzsteuer-Voranmeldung", "Abschlussarbeiten", "Übergabe an die Kanzlei"],
    teil: 2,
    typ: "kern",
    catalogIds: ["F01", "F02"],
    vorlagen: ["08.0", "08.1", "08.2", "08.3", "08.4"],
    gruppen: [own("Buchung, Abstimmung und Abschluss", BU)],
    hinweis: "Buchungen und Aufzeichnungen dürfen nicht so verändert werden, dass der ursprüngliche Inhalt nicht mehr feststellbar ist (§ 146 Abs. 4 AO).",
    prozess: [
      { schritt: "Belegzuordnung", beschreibung: "Beleg wird dem Geschäftsvorfall zugeordnet und kontiert.", frage: "BU01", rolle: "BU01.wer", nachweis: "Kontierung im System" },
      { schritt: "Buchung", beschreibung: "Geschäftsvorfall wird zeitgerecht gebucht.", frage: "BU02", nachweis: "Journal" },
      { schritt: "Festschreibung", beschreibung: "Gebuchte Perioden werden festgeschrieben.", frage: "BU02", nachweis: "Festschreibungsprotokoll" },
      { schritt: "Abstimmung", beschreibung: "Konten und Bestände werden abgestimmt.", frage: "BU04", nachweis: "Abstimmungsnachweis" },
      { schritt: "Abschluss und Übergabe", beschreibung: "Abschlussarbeiten und Übergabe an die Kanzlei.", frage: "BU07", nachweis: "Übergabenachweis" },
    ],
    aufbewahrung: [
      buch("Bücher und Aufzeichnungen (Journale, Konten), Inventare, Jahresabschlüsse, Lageberichte, Eröffnungsbilanz"),
      beleg("Buchungsbelege"),
    ],
    begriffe: [
      ["Festschreibung", "Systemfunktion, die gebuchte Daten gegen nachträgliche Änderung sperrt; Korrekturen erfolgen danach nur durch neue Buchungen."],
      ["Kontierung", "Zuordnung eines Belegs zu Konten, Steuerschlüssel und gegebenenfalls Kostenstelle."],
    ],
  },
  {
    id: "m10",
    nr: 10,
    titel: "Warenwirtschaft, Lager und Inventur",
    kurz: "Artikelstamm, Wareneingang und -ausgang, Bestandsführung, Bestandskorrekturen, Inventur und Übergabe an die Buchhaltung.",
    inhalt: ["Artikelstamm und Preise", "Wareneingang und Warenausgang", "Bestandsführung und Korrekturen", "Inventur", "Übergabe an die Buchhaltung"],
    teil: 2,
    typ: "betrieb",
    trigger: "lager",
    catalogIds: [],
    vorlagen: [],
    gruppen: [{ titel: "Warenwirtschaft und Inventur", bereich: "warenwirtschaft" }],
  },
  {
    id: "m11",
    nr: 11,
    titel: "Anlagevermögen",
    kurz: "Anschaffung, Erfassung, Zuordnung, Abschreibung, Verkauf und Aussonderung.",
    inhalt: ["Anlagenverzeichnis", "Zugang und Aktivierung", "Abschreibung", "Kennzeichnung und Bestandsaufnahme", "Abgang, Verkauf und Aussonderung"],
    teil: 2,
    typ: "betrieb",
    trigger: "anlagen",
    catalogIds: [],
    vorlagen: [],
    gruppen: [{ titel: "Anlagenbuchhaltung", bereich: "anlagen" }],
  },
  {
    id: "m12",
    nr: 12,
    titel: "Personal und Lohnabrechnung",
    kurz: "Abrechnungsrelevante Daten, Zeiten, Prüfung, Abrechnung, Zahlung und Übergabe an Dienstleister.",
    inhalt: ["Abrechnungsrelevante Stamm- und Bewegungsdaten", "Arbeitszeiten", "Prüfung und Abrechnung", "Auszahlung", "Übergabe an Lohnbüro und Buchhaltung"],
    teil: 2,
    typ: "betrieb",
    trigger: "personal",
    catalogIds: [],
    vorlagen: [],
    gruppen: [
      { titel: "Lohn- und Gehaltsabrechnung", bereich: "lohn" },
      { titel: "Zeiterfassung", bereich: "zeiterfassung", teil: "zeiterfassung" },
    ],
  },
  {
    id: "m13",
    nr: 13,
    titel: "Onlineshop, Marktplätze und Plattformen",
    kurz: "Bestellungen, Umsätze, Rechnungen, Retouren, Plattformabrechnungen und Abstimmung mit Zahlungsdienstleistern und Buchhaltung.",
    inhalt: ["Verkaufskanäle und Shopsystem", "Bestelldaten und Steuersätze", "Rechnungen an Kunden", "Plattform- und Auszahlungsabrechnungen", "Retouren und Erstattungen", "Aufbewahrung der Rohdaten"],
    teil: 2,
    typ: "betrieb",
    trigger: "online",
    catalogIds: [],
    vorlagen: [],
    gruppen: [
      { titel: "Shop, Marktplätze und Abrechnung", bereich: "ecommerce" },
      { titel: "Retouren und Erstattungen", bereich: "retouren", teil: "retouren" },
    ],
  },
  {
    id: "m14",
    nr: 14,
    titel: "Branchenspezifische Abläufe",
    kurz: "Branchentypische Vorgänge mit ihren steuerlich relevanten Daten und Nachweisen (z. B. Bauprojekte, Vermietung, Praxisabrechnung, Hotel, Taxameter, Produktion).",
    inhalt: ["Branchentypische Vorgänge", "Branchensoftware und Geräte", "Grunddaten und Nachweise", "Abrechnung und besondere Steuerregeln", "Übergabe an die Buchhaltung"],
    teil: 2,
    typ: "betrieb",
    trigger: "branche",
    catalogIds: [],
    vorlagen: [],
    gruppen: [
      own("Branchentypische Vorgänge und Nachweise", BS),
      { titel: "Fach- und Vorsystem der Branche", bereich: "vorsystem" },
    ],
    aufbewahrung: [buch("Aufzeichnungen aus Branchensoftware, soweit Bücher oder Aufzeichnungen")],
  },
  {
    id: "m15",
    nr: 15,
    titel: "Archivierung und Wiederauffindbarkeit",
    kurz: "Welche Originaldaten wo liegen, Suchmerkmale, Belegverknüpfung, Lesbarkeit und Schutz vor unbemerkten Änderungen.",
    inhalt: ["Archivsystem und Ablageorte", "Suchmerkmale", "Verknüpfung Beleg und Buchung", "Lesbarkeit über die Frist", "Schutz vor unbemerkten Änderungen"],
    teil: 3,
    typ: "kern",
    catalogIds: ["G01"],
    vorlagen: ["09.1"],
    gruppen: [own("Archiv und Wiederauffindbarkeit", AW)],
    hinweis: "Unterlagen müssen während der Aufbewahrungsfrist verfügbar, unverzüglich lesbar und maschinell auswertbar sein (§ 147 Abs. 2 AO). Der ursprüngliche Inhalt muss feststellbar bleiben (§ 146 Abs. 4 AO).",
  },
  {
    id: "m16",
    nr: 16,
    titel: "Aufbewahrungsfristen und Löschung",
    kurz: "Fristzuordnung, weitere Aufbewahrungsgründe, Löschfreigabe und Durchführung.",
    inhalt: ["Fristzuordnung je Unterlagenart", "Weitere Aufbewahrungsgründe", "Löschfreigabe", "Durchführung und Protokoll", "Datenschutz und Aufbewahrung"],
    teil: 3,
    typ: "kern",
    catalogIds: ["G05"],
    vorlagen: ["09.2", "09.5"],
    gruppen: [own("Fristen und Löschung", AF)],
    hinweis: "Die Frist beginnt mit dem Schluss des Kalenderjahres, in dem die Unterlage entstanden ist (§ 147 Abs. 4 AO). Sie läuft nicht ab, solange die Unterlagen für Steuern von Bedeutung sind, deren Festsetzungsfrist noch nicht abgelaufen ist (§ 147 Abs. 3 AO).",
    prozess: [
      { schritt: "Frist zuordnen", beschreibung: "Jeder Unterlagenart wird ihre Frist zugeordnet.", frage: "AF01", nachweis: "Fristenliste" },
      { schritt: "Weitere Gründe prüfen", beschreibung: "Vor Löschung: offene Festsetzung, Prüfung, Rechtsstreit.", frage: "AF02", nachweis: "Prüfvermerk" },
      { schritt: "Löschung freigeben", beschreibung: "Freigabe durch die benannte Person.", frage: "AF03", rolle: "AF03.wer", nachweis: "Freigabe" },
      { schritt: "Löschen und protokollieren", beschreibung: "Durchführung mit Protokoll.", frage: "AF04", nachweis: "Löschprotokoll" },
    ],
    aufbewahrung: [
      buch("Bücher, Aufzeichnungen, Inventare, Jahresabschlüsse, Lageberichte, Eröffnungsbilanz sowie Arbeitsanweisungen und Organisationsunterlagen"),
      beleg("Buchungsbelege (z. B. Eingangs- und Ausgangsrechnungen, Kontoauszüge, Kassenbelege)"),
      brief("Empfangene Handels- oder Geschäftsbriefe und Wiedergaben abgesandter Handels- oder Geschäftsbriefe"),
      sonstige("Sonstige Unterlagen, soweit sie für die Besteuerung von Bedeutung sind"),
      { unterlage: "Empfangene Lieferscheine, soweit kein Buchungsbeleg", frist: "bis zum Erhalt der Rechnung", grundlage: "§ 147 Abs. 3 Satz 3 AO" },
      { unterlage: "Abgesandte Lieferscheine, soweit kein Buchungsbeleg", frist: "bis zum Versand der Rechnung", grundlage: "§ 147 Abs. 3 Satz 4 AO" },
    ],
  },
  {
    id: "m17",
    nr: 17,
    titel: "Systeme und Datenübertragung",
    kurz: "Soft- und Hardware, Cloud, Schnittstellen, Importe, Exporte, Konvertierungen sowie individuelle Berechnungen und Automatisierungen.",
    inhalt: ["Systemübersicht", "Hardware und Betriebsumgebung", "Cloud und Anbieter", "Schnittstellen, Importe, Exporte, Konvertierungen", "Eigene Berechnungen und Automatisierungen", "Programmstände"],
    teil: 3,
    typ: "kern",
    catalogIds: ["B01", "B05"],
    vorlagen: ["03.1", "03.2", "03.3"],
    gruppen: [own("Systeme, Schnittstellen und Automatisierungen", SY)],
    hinweis: "Für jedes DV-System, in dem steuerrelevante Daten entstehen oder verarbeitet werden, ist eine Verfahrensdokumentation vorzuhalten (GoBD Rz. 151).",
    aufbewahrung: [buch("Systemdokumentation, Handbücher, Schnittstellenbeschreibungen und Verzeichnis der Programmstände (Organisationsunterlagen)")],
    begriffe: [["Schnittstelle", "Technische Verbindung, über die Daten von einem System in ein anderes übertragen werden."]],
  },
  {
    id: "m18",
    nr: 18,
    titel: "Zugriffsrechte und Datensicherheit",
    kurz: "Rollen, Rechtevergabe und -entzug, Schutzmaßnahmen und Protokollierung.",
    inhalt: ["Rollen und Berechtigungen", "Vergabe und Entzug von Rechten", "Technische Schutzmaßnahmen", "Protokollierung"],
    teil: 3,
    typ: "kern",
    catalogIds: ["G02"],
    vorlagen: ["10.1", "10.2"],
    gruppen: [own("Rechte und Schutz", ZR)],
  },
  {
    id: "m19",
    nr: 19,
    titel: "Sicherung, Wiederherstellung und Notfälle",
    kurz: "Backups, Wiederherstellung, Tests, Ausfälle, Ersatzverfahren und Nachbearbeitung.",
    inhalt: ["Sicherungskonzept", "Wiederherstellung und Tests", "Ausfallszenarien", "Ersatzverfahren", "Nachbearbeitung"],
    teil: 3,
    typ: "kern",
    catalogIds: ["G06", "H04"],
    vorlagen: ["10.3", "10.4"],
    gruppen: [own("Sicherung und Notfall", SN)],
  },
  {
    id: "m20",
    nr: 20,
    titel: "Kontrollen und Fehlerbehandlung",
    kurz: "Vollständigkeit und Richtigkeit, Abstimmungen, Abweichungen, Verantwortliche und Kontrollnachweise.",
    inhalt: ["Vollständigkeitskontrollen", "Richtigkeitskontrollen", "Abweichungen und Fehler", "Kontrollnachweise", "Überwachung"],
    teil: 4,
    typ: "kern",
    catalogIds: ["H01"],
    vorlagen: ["11.1", "11.2", "11.3"],
    gruppen: [own("Internes Kontrollsystem", KF)],
  },
  {
    id: "m21",
    nr: 21,
    titel: "Ausgelagerte Aufgaben",
    kurz: "Steuerkanzlei, Buchhaltungsservice, IT und Cloud; Übergaben, Kontrollen und Verantwortungsgrenzen.",
    inhalt: ["Steuerkanzlei und Leistungsumfang", "Buchhaltungs- und Lohnservice", "IT- und Cloud-Dienstleister", "Übergaben", "Kontrolle der Dienstleister", "Verantwortungsgrenzen"],
    teil: 4,
    typ: "kern",
    catalogIds: ["F05"],
    vorlagen: [],
    gruppen: [own("Dienstleister und Schnittstellen der Verantwortung", AU)],
    hinweis: "Auch wenn Aufgaben ausgelagert sind, bleibt das Unternehmen für die Ordnungsmäßigkeit seiner Bücher und Aufzeichnungen verantwortlich.",
    aufbewahrung: [sonstige("Verträge und Leistungsbeschreibungen mit Dienstleistern, soweit für die Besteuerung von Bedeutung")],
  },
  {
    id: "m22",
    nr: 22,
    titel: "Prüfungszugriff und Datenbereitstellung",
    kurz: "Belege, Daten, Auswertungen, Exportverfahren und Zugriffsmöglichkeiten bei Außenprüfung und Nachschau.",
    inhalt: ["Ansprechpartner", "Unmittelbarer Zugriff (Z1)", "Mittelbarer Zugriff (Z2)", "Datenträgerüberlassung (Z3)", "Bereitstellung von Belegen", "Exporttest und Altdaten"],
    teil: 4,
    typ: "kern",
    catalogIds: [],
    vorlagen: ["09.4"],
    gruppen: [own("Datenzugriff der Finanzverwaltung", PZ)],
    hinweis: "Bei einer Außenprüfung kann die Finanzverwaltung Einsicht in die gespeicherten Daten nehmen und das System nutzen (Z1), Auswertungen nach ihren Vorgaben verlangen (Z2) oder die Überlassung der Daten in maschinell auswertbarer Form verlangen (Z3) (§ 147 Abs. 6 AO).",
    begriffe: [
      ["Z1, Z2, Z3", "Unmittelbarer Zugriff, mittelbarer Zugriff und Datenträgerüberlassung nach § 147 Abs. 6 AO."],
    ],
  },
  {
    id: "m23",
    nr: 23,
    titel: "System- und Prozessänderungen",
    kurz: "Einführung, Updates, Migrationen, Ablaufänderungen und historische Nachvollziehbarkeit.",
    inhalt: ["Einführung neuer Systeme", "Updates und Versionswechsel", "Migration und Datenübernahme", "Steuerrelevante Einstellungen", "Ablaufänderungen", "Historische Nachvollziehbarkeit"],
    teil: 4,
    typ: "kern",
    catalogIds: [],
    vorlagen: ["12.1"],
    gruppen: [own("Änderungsmanagement", AE)],
    aufbewahrung: [buch("Änderungsdokumentation zu Systemen und Abläufen (Organisationsunterlagen)")],
  },
  {
    id: "m24",
    nr: 24,
    titel: "Pflege der Verfahrensdokumentation",
    kurz: "Prüfung der Abläufe, betriebliche Bestätigung, Versionierung, Änderungsverzeichnis und frühere Fassungen.",
    inhalt: ["Zuständigkeit und Anlässe", "Prüfturnus", "Betriebliche Bestätigung", "Versionierung und Änderungsverzeichnis", "Frühere Fassungen", "Mitgeltende Unterlagen"],
    teil: 4,
    typ: "kern",
    catalogIds: ["I01", "I02", "I04", "I05"],
    vorlagen: ["12.2", "12.3", "12.4"],
    gruppen: [own("Pflege und Freigabe", PF)],
    hinweis: "Die Verfahrensdokumentation ist bei Änderungen zu versionieren und eine nachvollziehbare Änderungshistorie vorzuhalten (GoBD Rz. 154).",
    aufbewahrung: [
      { unterlage: "Verfahrensdokumentation einschließlich früherer Fassungen", frist: "10 Jahre, nicht vor Ablauf der Frist für die Unterlagen, zu deren Verständnis sie erforderlich ist", grundlage: "§ 147 Abs. 1 Nr. 1, Abs. 3 AO; GoBD Rz. 154" },
    ],
  },
];

export const MODUL_IDS = MODULE.map((modul) => modul.id);
const BY_ID = new Map(MODULE.map((modul) => [modul.id, modul]));

export function modulById(id: string): ModulDef | undefined {
  return BY_ID.get(id);
}

export function modulByNr(nr: number): ModulDef | undefined {
  return MODULE.find((modul) => modul.nr === nr);
}

export function moduleImTeil(teil: ModulTeil): ModulDef[] {
  return MODULE.filter((modul) => modul.teil === teil);
}

export function isKernModul(id: string): boolean {
  return modulById(id)?.typ === "kern";
}

/** Bereichsfragen einer Gruppe: ohne `ids` die spezifischen Fragen + Rahmen 91/92 (90, 93–96 sind zentral in Modul 1, 15–23 abgedeckt). */
function bereichGruppenFragen(gruppe: ModulGruppe): BereichQuestion[] {
  if (!gruppe.bereich) return [];
  const bereich = bereichById(gruppe.bereich);
  if (gruppe.ids) {
    const byId = new Map(bereich.questions.map((question) => [question.id, question]));
    return gruppe.ids.map((id) => byId.get(id)).filter((question): question is BereichQuestion => Boolean(question));
  }
  return bereich.questions.filter((question) => !question.rahmen || /9[12]$/.test(question.id));
}

export function gruppenFragen(gruppe: ModulGruppe): BereichQuestion[] {
  return gruppe.bereich ? bereichGruppenFragen(gruppe) : (gruppe.questions ?? []);
}

/** Alle eigenen Fragen eines Moduls (ohne Katalogfragen A–I). */
export function modulFragen(modul: ModulDef): BereichQuestion[] {
  return modul.gruppen.flatMap((gruppe) => gruppenFragen(gruppe));
}

export function modulBereiche(modul: ModulDef): Bereich[] {
  return modul.gruppen.filter((gruppe) => gruppe.bereich).map((gruppe) => bereichById(gruppe.bereich));
}

function unique<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const k = key(item);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

const GRUPPEN_KONTROLLEN: Record<string, BereichKontrolle[]> = Object.fromEntries(
  [UO, LE, AR, ER, PB, ZD, BU, BS, AW, AF, SY, ZR, SN, KF, AU, PZ, AE, PF].map((g) => [g.prefix, g.kontrollen]),
);

/** Typische Kontrollen eines Moduls: aus übernommenen Bereichen und eigenen Fragengruppen. */
export function modulKontrollen(modul: ModulDef): Array<BereichKontrolle & { frage: string }> {
  const out: Array<BereichKontrolle & { frage: string }> = [];
  for (const gruppe of modul.gruppen) {
    if (gruppe.bereich) {
      const bereich = bereichById(gruppe.bereich);
      const prefix = bereich.questions[0]?.id.slice(0, 2) ?? "";
      const fragen = gruppenFragen(gruppe).map((question) => question.id);
      if (!fragen.includes(`${prefix}92`)) continue;
      out.push(...bereich.kontrollen.map((item) => ({ ...item, frage: `${prefix}92` })));
    } else {
      const prefix = gruppe.questions?.[0]?.id.slice(0, 2) ?? "";
      out.push(...(GRUPPEN_KONTROLLEN[prefix] ?? []).map((item) => ({ ...item, frage: `${prefix}92` })));
    }
  }
  out.push(...(modul.kontrollen ?? []).map((item) => ({ ...item, frage: "" })));
  return unique(out, (item) => item.name);
}

export function modulAufbewahrung(modul: ModulDef): BereichFrist[] {
  const fromAreas = modulBereiche(modul).flatMap((bereich) => bereich.aufbewahrung.filter((item) => item.unterlage !== FRIST_VD.unterlage));
  return unique([...(modul.aufbewahrung ?? []), ...fromAreas], (item) => item.unterlage);
}

export function modulProzess(modul: ModulDef): BereichSchritt[] {
  if (modul.prozess?.length) return modul.prozess;
  return modulBereiche(modul).flatMap((bereich) => bereich.prozess);
}

export function modulBegriffe(modul: ModulDef): Array<[string, string]> {
  return unique([...(modul.begriffe ?? []), ...modulBereiche(modul).flatMap((bereich) => bereich.begriffe)], ([term]) => term);
}

/** Frage-Id → Modul und Frage (nur eigene Modulfragen, nicht Katalog A–I). */
const QUESTION_INDEX = new Map<string, { modul: ModulDef; question: BereichQuestion; gruppe: ModulGruppe }>();
for (const modul of MODULE) {
  for (const gruppe of modul.gruppen) {
    for (const question of gruppenFragen(gruppe)) {
      if (!QUESTION_INDEX.has(question.id)) QUESTION_INDEX.set(question.id, { modul, question, gruppe });
    }
  }
}

export function modulQuestion(id: string): { modul: ModulDef; question: BereichQuestion; gruppe: ModulGruppe } | null {
  return QUESTION_INDEX.get(id) ?? null;
}

/** Modul, zu dem eine Katalogfrage (A–I) gehört. */
export function modulOfCatalogQuestion(id: string): ModulDef | undefined {
  return MODULE.find((modul) => modul.catalogIds.includes(id));
}

/** Modul, in das ein bisheriger Bereich überführt wird (Hauptmodul). */
export const BEREICH_ZU_MODUL: Record<string, string> = {
  belegfluss: "m03",
  kasse: "m08",
  warenwirtschaft: "m10",
  einkauf: "m03",
  verkauf: "m02",
  retouren: "m13",
  zeiterfassung: "m12",
  lohn: "m12",
  ecommerce: "m13",
  bank: "m07",
  anlagen: "m11",
  vorsystem: "m14",
};

/** Alle Module, in denen Fragen eines Bereichs vorkommen. */
export function moduleOfBereich(bereichId: string): ModulDef[] {
  return MODULE.filter((modul) => modul.gruppen.some((gruppe) => gruppe.bereich === bereichId));
}

/** Template-Abschnitt (Kapitel des Belegfluss-Dokuments) → Modul. */
export const VORLAGE_ZU_MODUL: Map<string, string> = new Map(
  MODULE.flatMap((modul) => modul.vorlagen.map((key) => [key, modul.id] as [string, string])),
);

/** Belegfluss-Kapitel → Modul (für Querverweise „Kapitel N“ und Regeln). */
export const KAPITEL_ZU_MODUL: Record<number, number> = {
  1: 1,
  2: 1,
  3: 17,
  4: 3,
  5: 3,
  6: 6,
  7: 4,
  8: 9,
  9: 15,
  10: 18,
  11: 20,
  12: 24,
};

/** Bundle-Kapitel-Id → Modul-Id (für offene Punkte und Regeln). */
export const BUNDLE_KAPITEL_ZU_MODUL: Record<string, string> = {
  "00-cover-freigabe": "m24",
  "01-zweck-geltung": "m01",
  "02-unternehmen-rollen": "m01",
  "03-systeme-datenfluss": "m17",
  "04-belegarten-kanaele": "m03",
  "05-eingang-erechnung": "m03",
  "06-papier-digitalisierung": "m06",
  "07-ausgangsrechnungen": "m04",
  "08-freigabe-buchung-status": "m09",
  "09-ablage-aufbewahrung": "m15",
  "10-berechtigungen-sicherung": "m18",
  "11-iks": "m20",
  "12-versionspflege": "m24",
  "13-mitgeltende-unterlagen": "m24",
};

export function checkTeilAktiv(check: Partial<Record<CheckKey, string>>, teil: CheckKey | undefined): boolean {
  if (!teil) return true;
  return check[teil] !== "nein";
}

/** Sicherstellen, dass jeder bisherige Bereich in mindestens einem Modul aufgeht. */
export const BEREICHE_OHNE_MODUL = BEREICHE.filter((bereich) => bereich.id !== "belegfluss" && moduleOfBereich(bereich.id).length === 0).map((bereich) => bereich.id);
