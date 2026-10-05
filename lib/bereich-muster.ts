import { bereichById, bereichDocTitle } from "@/lib/bereiche";
import type { CheckoutIdentity, IntakeAnswers } from "@/lib/types";
import { emptyAnswers } from "@/lib/types";
import type { VersionHistoryEntry, VersionPdfMeta } from "@/lib/versioning";

/**
 * Muster je Bereich: fiktive Beispielunternehmen mit ausgefülltem Fragebogen.
 *
 * Jede Firma ist frei erfunden und im Firmennamen als „Muster, fiktiv“
 * gekennzeichnet, damit jede PDF-Seite (Kopfzeile) das Muster zeigt.
 * Die meisten Angaben sind als heutige Praxis bestätigt; einzelne Punkte
 * bleiben absichtlich offen, damit Kapitel „Offene Punkte“ gefüllt ist.
 * Version 2.0 mit Vorversion 1.0 zeigt die Änderungshistorie.
 *
 * PDF: GET /muster/<bereich>/pdf. Fragebogen: GET /muster/<bereich>/fragebogen.
 */

type Status = "bestaetigt" | "geplant" | "unbekannt" | "nicht_zutreffend";
type Entry = NonNullable<IntakeAnswers["katalog"]>[string];

const b = (values: Record<string, unknown> = {}): Entry => ({ status: "bestaetigt" as Status, values });
const g = (values: Record<string, unknown> = {}): Entry => ({ status: "geplant" as Status, values });
const u = (values: Record<string, unknown> = {}): Entry => ({ status: "unbekannt" as Status, values });
const n = (reason: string): Entry => ({ status: "nicht_zutreffend" as Status, values: {}, reason } as Entry);

/** Exact control names of an area by index, so the multi-select matches its options. */
function k(bereich: string, indexes: number[]): string[] {
  const list = bereichById(bereich).kontrollen;
  return indexes.map((index) => list[index]?.name).filter((name): name is string => Boolean(name));
}

type System = { name: string; funktion: string; typ: string; nutzer: string; originalOrt: string; hostingArt: string };

type Firma = {
  company: string;
  standort: string;
  branche: string;
  rechtsform: string;
  mitarbeitende: string;
  gf: string;
  buchhaltung: string;
  it: string;
  flags: { kasse: string; shop: string; lager: string; lohn: string; plattformen: string };
  systeme: System[];
  ablage: Array<{ art: string; ort: string; suche: string }>;
  rollen: Array<{ rolle: string; rechte: string[] }>;
  kontrolle: { name: string; turnus: string; wer: string; nachweis: string };
  extern: Array<{ name: string; unterlagenVorhanden: string }>;
};

/** General part (A, B, G, H, I) in the same shape the questionnaire stores. */
function allgemein(firma: Firma): Record<string, Entry> {
  return {
    A01: b({
      company: firma.company,
      standort: firma.standort,
      branchen: [firma.branche],
      rechtsform: firma.rechtsform,
      mitarbeitende: firma.mitarbeitende,
      gf: firma.gf,
    }),
    A03: b(firma.flags),
    A04: b({ gueltigAb: "2026-01-01", keineRueckdatierungBestaetigt: true }),
    B01: b({
      systeme: firma.systeme.map((system) => ({ ...system, belegeRein: [], uebergabe: "" })),
      hosting: firma.systeme.map((system) => `${system.name}: ${system.hostingArt}`).join("; "),
      it: firma.it,
    }),
    B04: b({
      originalJeWeg: firma.systeme.map((system) => ({
        belegweg: system.name,
        originalBeschreibung: `Originaldaten in ${system.originalOrt}`,
      })),
    }),
    B05: b({ externeSysteme: firma.extern }),
    G01: b({
      ablageJeArt: firma.ablage,
      ablage: firma.ablage.map((row) => row.ort).join("; "),
      ordnung: firma.ablage.map((row) => `${row.art}: ${row.suche}`).join("; "),
    }),
    G02: b({
      zugriffRollen: firma.rollen,
      zugriffKurz: firma.rollen.map((row) => `${row.rolle}: ${row.rechte.join(", ")}`).join(". "),
      berechtigungslisteVorhanden: "ja",
    }),
    G05: b({
      rolleFristen: firma.gf,
      verfahren: "Löschung erst nach Fristprüfung und Freigabe durch die Geschäftsführung; Ablaufhemmungen fragt die Kanzlei ab.",
    }),
    G06: b({
      sicherung: ["Anbieter sichert"],
      backupArten: "Sicherung durch die Anbieter; lokale Daten täglich auf NAS",
      wiederherstellungGetestet: "nein",
    }),
    H01: b({
      kontrollen: [
        {
          name: firma.kontrolle.name,
          turnusWahl: firma.kontrolle.turnus,
          turnus: firma.kontrolle.turnus,
          wer: firma.kontrolle.wer,
          nachweis: firma.kontrolle.nachweis,
        },
      ],
    }),
    H04: u({ status: "unbekannt" }),
    I01: b({
      pfleger: firma.buchhaltung,
      ausloeserAuswahl: ["neues oder ersetztes System", "geänderte Zuständigkeit"],
      ausloeser: "neues oder ersetztes System, geänderte Zuständigkeit",
    }),
    I02: b({
      anlagen: [
        { name: "Vertrag mit dem Anbieter", status: "vorhanden" },
        { name: "Leistungsbeschreibung", status: "vorhanden" },
        { name: "Berechtigungskonzept", status: "vorhanden" },
        { name: "Nachweis Aufbewahrung oder Export", status: "offen" },
        { name: "Kontrollnachweise", status: "vorhanden" },
      ],
    }),
    I04: u(),
    I05: b({ gueltigAb: "2026-07-01", speicherortHistorie: "Kundenkonto gobd-doku-erstellen.de, Fassungen 1.0 und 2.0" }),
  };
}

export type BereichMuster = {
  bereich: string;
  identity: CheckoutIdentity;
  answers: IntakeAnswers;
  documentId: string;
  version: number;
  versionMeta: VersionPdfMeta;
  versionHistory: VersionHistoryEntry[];
  /** Short description of the fictional company for the Muster page. */
  steckbrief: string;
  firma: Firma;
};

function muster(bereich: string, firma: Firma, steckbrief: string, area: Record<string, Entry>): BereichMuster {
  const answers: IntakeAnswers = {
    ...emptyAnswers(),
    bereich,
    katalog: { ...allgemein(firma), ...area },
  };
  return {
    bereich,
    identity: {
      email: "muster@beispiel.invalid",
      company: firma.company,
      stripeSessionId: "cs_test_DO_NOT_PUT_IN_PDF",
      stripeCustomerId: "cus_DO_NOT_PUT_IN_PDF",
      stub: false,
    },
    answers,
    documentId: `muster-${bereich}`,
    version: 2,
    versionMeta: {
      validFrom: "01.07.2026",
      validTo: "",
      changeSummary: "Kontrollen, Datenzugriff und Archiv ergänzt; Vertretung neu benannt",
      changedBy: firma.gf,
    },
    versionHistory: [
      {
        version: "1.0",
        validFrom: "01.01.2026",
        validTo: "30.06.2026",
        changeSummary: "Erstfassung aus Kunden-Intake",
        changedBy: firma.gf,
      },
    ],
    steckbrief,
    firma,
  };
}

const NAS = { name: "NAS im Büro", funktion: "Dateiablage und Sicherung", typ: "archiv", nutzer: "Geschäftsführung und Büro", originalOrt: "NAS im Büro", hostingArt: "Lokal" };
const DATEV = { name: "DATEV Unternehmen online", funktion: "FiBu der Kanzlei und Belegablage", typ: "fibu", nutzer: "Büro und Kanzlei", originalOrt: "DATEV Unternehmen online", hostingArt: "Anbieter-Cloud" };
const KANZLEI_EXTERN = { name: "DATEV Unternehmen online", unterlagenVorhanden: "ja" };
const ROLLEN_STANDARD = [
  { rolle: "Geschäftsführung", rechte: ["lesen", "freigeben"] },
  { rolle: "Büro / Buchhaltung", rechte: ["lesen", "ändern"] },
  { rolle: "Kanzlei", rechte: ["lesen"] },
];
const FLAGS_NEIN = { kasse: "nein", shop: "nein", lager: "nein", lohn: "nein", plattformen: "nein" };

const KASSE_MUSTER = muster(
  "kasse",
  {
    company: "Bäckerei Sonnenkorn GmbH (Muster, fiktiv)",
    standort: "Musterstadt",
    branche: "Bäckerei mit zwei Filialen",
    rechtsform: "GmbH",
    mitarbeitende: "11–25",
    gf: "Clara Sonnenkorn",
    buchhaltung: "Jonas Weber",
    it: "Externer IT-Dienstleister (Kassenhändler)",
    flags: { ...FLAGS_NEIN, kasse: "ja", lohn: "ja" },
    systeme: [
      { name: "Kassensystem KassaPro (fiktiv)", funktion: "Verkauf an der Theke, TSE, Tagesabschluss", typ: "sonstiges", nutzer: "Verkaufspersonal, Filialleitung", originalOrt: "Kassensystem und Cloud-Archiv des Kassenanbieters", hostingArt: "Gemischt" },
      DATEV,
      NAS,
    ],
    ablage: [
      { art: "Kassendaten und Z-Bons", ort: "Cloud-Archiv des Kassenanbieters", suche: "Datum und Kasse" },
      { art: "Zählprotokolle und Einzahlungsquittungen", ort: "DATEV Unternehmen online", suche: "Datum und Filiale" },
    ],
    rollen: [
      { rolle: "Geschäftsführung", rechte: ["lesen", "freigeben"] },
      { rolle: "Filialleitung", rechte: ["lesen", "Tagesabschluss"] },
      { rolle: "Verkaufspersonal", rechte: ["Verkauf erfassen"] },
      { rolle: "Büro / Buchhaltung", rechte: ["lesen", "exportieren"] },
    ],
    kontrolle: { name: "Abgleich Kassenbuch mit Bankeinzahlungen", turnus: "wöchentlich", wer: "Jonas Weber", nachweis: "Abstimmungsliste in DATEV" },
    extern: [{ name: "Kassensystem KassaPro (fiktiv), Cloud-Archiv", unterlagenVorhanden: "ja" }, KANZLEI_EXTERN],
  },
  "Fiktive Bäckerei mit zwei Filialen, elektronisches Kassensystem mit Cloud-TSE, Tagesabschluss mit Zählprotokoll, Übergabe an die Kanzlei über DATEV.",
  {
    KA00: b({ verantwortlich: "Clara Sonnenkorn (Geschäftsführung)", vertretung: "Jonas Weber (Büro)" }),
    KA01: b({ kassenart: "Elektronisches Kassensystem mit TSE", system: "KassaPro (fiktiv) auf Tablet-Kassen", anzahl: "3 Kassen an 2 Standorten" }),
    KA02: b({ tse: "Cloud-TSE des Kassenanbieters", zertifikat: "ja", mitteilung: "ja" }),
    KA03: b({ beleg: ["Papierbon", "Elektronischer Beleg (QR, E-Mail, App)"], befreiung: "nein" }),
    KA04: b({ ablauf: "Filialleitung zählt morgens das Wechselgeld (200 Euro je Kasse) und erfasst den Anfangsbestand im Kassensystem.", bediener: "Eigene Bedienerkennung je Person" }),
    KA05: b({ ablauf: "Nach Ladenschluss zählt die Filialleitung den Bestand mit Zählprotokoll im Kassensystem, erstellt den Z-Bon und vergleicht Soll und Ist.", wer: "Filialleitung je Standort", differenzen: "Differenzen über 5 Euro werden mit Begründung im Kassensystem erfasst und an die Geschäftsführung gemeldet." }),
    KA06: b({ art: "Kassenbuch im Kassensystem", wer: "Filialleitung, Kontrolle durch Jonas Weber", zaehlprotokoll: "ja" }),
    KA07: b({ sonderfaelle: "Storni nur mit Filialleitungs-Kennung und Grund. Entnahmen und Einlagen als eigene Buchung mit Beleg. Trinkgeld getrennt in der Trinkgeldkasse. Gutscheine als Gutscheinverkauf im System.", freigabe: "Filialleitung" }),
    KA08: b({ ablauf: "Abschöpfung über 500 Euro in den Tresor mit Buchung im System. Bankeinzahlung zweimal wöchentlich durch die Geschäftsführung.", beleg: "Einzahlungsquittung der Bank" }),
    KA09: b({ wer: "Clara Sonnenkorn, technische Umsetzung durch den Kassenhändler", protokolliert: "ja", ablage: "Ordner Kasse im NAS: Bedienungsanleitung, Programmierprotokolle, TSE-Zertifikat" }),
    KA10: b({ uebergabe: "Monatlicher DATEV-Export aus dem Kassensystem, Upload in DATEV Unternehmen online.", turnus: "monatlich bis zum 5.", dsfinvk: "unbekannt" }),
    KA11: b({ ansprechpartner: "Filialleitung vor Ort, telefonisch Clara Sonnenkorn", zugriff: "DSFinV-K-Export über das Kassen-Backend" }),
    KA90: b({ umfang: "Beide Filialen (Hauptstraße und Bahnhof) mit allen drei Kassen.", ausgenommen: "Catering-Rechnungen, siehe Verfahrensdokumentation Belegfluss" }),
    KA91: b({ systeme: "KassaPro (fiktiv): Kassensoftware, Anbieter KassaPro GmbH. Cloud-TSE des Anbieters. DATEV Unternehmen online: Übergabe an die Kanzlei.", schnittstellen: "Kassensystem an DATEV: monatlicher DATEV-Export (CSV), manueller Upload.", betrieb: "Gemischt" }),
    KA92: b({ kontrollen: k("kasse", [0, 1, 2, 3, 4]), details: "Kassensturz täglich durch die Filialleitung (Zählprotokoll). Abgleich Z-Bon/Kassenbuch/Einzahlung wöchentlich durch Jonas Weber (Abstimmungsliste). Stornoliste monatlich durch Clara Sonnenkorn. TSE-Signatur auf dem Bon täglich beim ersten Bon. Z-Bon-Folge monatlich beim Export." }),
    KA93: b({ arten: ["Z1 Nur-Lesezugriff im System", "Z3 Datenexport auf Datenträger"], format: "DSFinV-K und DATEV-Format", getestet: "nein" }),
    KA94: g({ freigabe: "Clara Sonnenkorn", doku: "Künftig: Änderungsliste je Programmierung im Ordner Kasse.", protokoll: "ja" }),
    KA95: b({ notbetrieb: "Bei Ausfall des Kassensystems: Notbetrieb mit Quittungsblock und Strichliste, Ausfallzeit wird notiert. Bei TSE-Ausfall meldet die Filialleitung das an Clara Sonnenkorn.", nacherfassung: "Nacherfassung am selben Tag, Quittungsdurchschriften werden aufbewahrt." }),
    KA96: b({ ort: "Cloud-Archiv des Kassenanbieters und jährlicher Export auf das NAS", form: "Originaldaten im System, DSFinV-K-Export als Datei", loeschung: "Clara Sonnenkorn" }),
  },
);

const WAWI_MUSTER = muster(
  "warenwirtschaft",
  {
    company: "Holzhandel Eichenblatt GmbH (Muster, fiktiv)",
    standort: "Musterhausen",
    branche: "Großhandel Holz und Baustoffe",
    rechtsform: "GmbH",
    mitarbeitende: "26–50",
    gf: "Martin Eichenblatt",
    buchhaltung: "Sabine Krämer",
    it: "Interne IT (Tobias Lang)",
    flags: { ...FLAGS_NEIN, lager: "ja", lohn: "ja" },
    systeme: [
      { name: "WaWi Lagerplus (fiktiv)", funktion: "Artikel, Bestände, Wareneingang und -ausgang, Inventur", typ: "sonstiges", nutzer: "Lager, Einkauf, Vertrieb", originalOrt: "Datenbank auf dem Firmenserver", hostingArt: "Lokal" },
      DATEV,
      NAS,
    ],
    ablage: [
      { art: "Inventurunterlagen", ort: "WaWi Lagerplus und Ordner Inventur auf dem NAS", suche: "Geschäftsjahr und Lagerort" },
      { art: "Lieferscheine", ort: "WaWi Lagerplus (Scan am Wareneingang)", suche: "Lieferant und Datum" },
    ],
    rollen: [
      { rolle: "Geschäftsführung", rechte: ["lesen", "freigeben"] },
      { rolle: "Lagerleitung", rechte: ["lesen", "Bestände buchen", "Korrekturen vorschlagen"] },
      { rolle: "Lagerpersonal", rechte: ["Wareneingang und -ausgang buchen"] },
      { rolle: "Buchhaltung", rechte: ["lesen", "Bewertung"] },
    ],
    kontrolle: { name: "Monatlicher Abgleich Bestandswert mit FiBu", turnus: "monatlich", wer: "Sabine Krämer", nachweis: "Abstimmungsprotokoll" },
    extern: [KANZLEI_EXTERN],
  },
  "Fiktiver Holzgroßhandel mit Lager und eigener Warenwirtschaft, laufende Bestandsführung, permanente Inventur, Übergabe der Bestandswerte an die FiBu.",
  {
    WW00: b({ verantwortlich: "Lagerleitung (Peter Holm)", vertretung: "Martin Eichenblatt" }),
    WW01: b({ system: "WaWi Lagerplus (fiktiv), Version 9", vorgaenge: "Artikelstamm, Bestellungen, Wareneingang, Lieferscheine, Warenausgang, Umlagerungen, Bestandskorrekturen, Inventur" }),
    WW02: b({ wer: "Einkauf (Lena Brandt)", freigabe: "Martin Eichenblatt bei Preisänderungen über 10 Prozent", protokolliert: "ja" }),
    WW03: b({ ablauf: "Lagerpersonal prüft Menge und Zustand gegen Lieferschein und Bestellung, scannt den Lieferschein und bucht den Wareneingang auf die Bestellung.", wer: "Lagerpersonal, Kontrolle durch die Lagerleitung" }),
    WW04: b({ ablauf: "Warenausgang wird mit dem Lieferschein aus dem Auftrag gebucht; Eigenverbrauch über eigene Bewegungsart.", wer: "Lagerpersonal" }),
    WW05: b({ fuehrung: "Laufend im System", bewertung: "Gleitender Durchschnitt der Anschaffungskosten" }),
    WW06: b({ lagerorte: "Halle A, Halle B, Freilager", umlagerung: "Umlagerung als eigene Buchung mit Quell- und Ziellagerort." }),
    WW07: b({ wer: "Lagerleitung", freigabe: "Martin Eichenblatt ab 500 Euro", grund: "ja" }),
    WW08: b({ verfahren: "Permanente Inventur", wer: "Zählteams aus zwei Personen, Prüfung durch die Lagerleitung", stichtag: "Jede Lagerzone einmal pro Geschäftsjahr nach Zählplan", zaehllisten: "WaWi Lagerplus und Ordner Inventur auf dem NAS" }),
    WW09: b({ ablauf: "Differenzen über 2 Prozent werden nachgezählt. Ungeklärte Differenzen bucht die Lagerleitung mit Grund.", freigabe: "Martin Eichenblatt" }),
    WW10: b({ uebergabe: "Monatliche Bestandsliste mit Bestandswert als PDF und CSV an die Kanzlei über DATEV Unternehmen online.", turnus: "monatlich" }),
    WW90: b({ umfang: "Alle drei Lagerorte am Standort Musterhausen.", ausgenommen: "Kommissionsware von Lieferanten (eigene Liste)" }),
    WW91: b({ systeme: "WaWi Lagerplus (fiktiv) auf dem Firmenserver; Handscanner im Lager; DATEV Unternehmen online.", schnittstellen: "Handscanner an WaWi: Funk, sofort. WaWi an DATEV: monatliche Bestandsliste CSV, manuell.", betrieb: "Gemischt" }),
    WW92: b({ kontrollen: k("warenwirtschaft", [0, 1, 2, 3, 5]), details: "Wareneingangsabgleich bei jeder Lieferung (Lagerpersonal). Korrekturen über 500 Euro im Vier-Augen-Prinzip. Stichprobenzählung monatlich nach Zählplan. Bestandswert gegen FiBu monatlich durch Sabine Krämer. Negative Bestände wöchentlich durch die Lagerleitung." }),
    WW93: b({ arten: ["Z1 Nur-Lesezugriff im System", "Z2 Auswertung nach Vorgabe", "Z3 Datenexport auf Datenträger"], format: "CSV", getestet: "ja" }),
    WW94: b({ freigabe: "Martin Eichenblatt", doku: "Änderungen an Bewertungsparametern, Bewegungsarten und Rechten im IT-Änderungsprotokoll mit Datum.", protokoll: "ja" }),
    WW95: b({ notbetrieb: "Bei Serverausfall Erfassung auf Papierlieferscheinen, Nacherfassung nach Wiederanlauf.", nacherfassung: "Papierlieferscheine werden zur Nacherfassung abgehakt und aufbewahrt." }),
    WW96: u({ ort: "Firmenserver, Sicherung auf NAS" }),
  },
);

const EINKAUF_MUSTER = muster(
  "einkauf",
  {
    company: "Feinmechanik Lindner GmbH (Muster, fiktiv)",
    standort: "Musterbach",
    branche: "Feinmechanik und Lohnfertigung",
    rechtsform: "GmbH",
    mitarbeitende: "26–50",
    gf: "Eva Lindner",
    buchhaltung: "Thomas Brück",
    it: "Externer IT-Dienstleister",
    flags: { ...FLAGS_NEIN, lager: "ja", lohn: "ja" },
    systeme: [
      { name: "ERP Fertigplan (fiktiv)", funktion: "Bestellungen, Wareneingang, Lieferantenstamm", typ: "sonstiges", nutzer: "Einkauf, Lager, Buchhaltung", originalOrt: "ERP-Datenbank beim Anbieter", hostingArt: "Anbieter-Cloud" },
      DATEV,
    ],
    ablage: [
      { art: "Bestellungen und Auftragsbestätigungen", ort: "ERP Fertigplan (fiktiv)", suche: "Bestellnummer" },
      { art: "Lieferscheine", ort: "ERP Fertigplan (fiktiv), Scan", suche: "Bestellnummer" },
    ],
    rollen: [
      { rolle: "Geschäftsführung", rechte: ["lesen", "freigeben"] },
      { rolle: "Einkauf", rechte: ["bestellen", "Lieferanten anlegen"] },
      { rolle: "Buchhaltung", rechte: ["lesen", "Bankdaten bestätigen"] },
    ],
    kontrolle: { name: "Durchsicht offener Bestellungen", turnus: "wöchentlich", wer: "Einkauf", nachweis: "Liste offene Bestellungen" },
    extern: [{ name: "ERP Fertigplan (fiktiv)", unterlagenVorhanden: "ja" }, KANZLEI_EXTERN],
  },
  "Fiktiver Fertigungsbetrieb mit zentralem Einkauf im ERP, Freigabegrenzen, Drei-Wege-Abgleich und Vier-Augen-Prinzip bei Bankdatenänderungen.",
  {
    EK00: b({ verantwortlich: "Einkaufsleitung (Murat Aydin)", vertretung: "Eva Lindner" }),
    EK01: b({ ablauf: "Bedarf entsteht aus Mindestbeständen im ERP und aus Fertigungsaufträgen; Abteilungen melden Sonderbedarf per Formular im ERP.", wer: "Lager und Fertigung" }),
    EK02: b({ wer: "Einkauf", grenzen: "bis 5.000 Euro Einkauf allein; darüber Freigabe", freigabe: "Eva Lindner" }),
    EK03: b({ wege: ["ERP / Warenwirtschaft", "Lieferantenportal", "E-Mail"], system: "ERP Fertigplan (fiktiv)" }),
    EK04: b({ wer: "Einkauf", abweichungen: "Abweichungen bei Preis oder Termin werden im ERP vermerkt und mit dem Lieferanten geklärt." }),
    EK05: b({ ablauf: "Wareneingang im ERP gegen die Bestellung; Dienstleistungen bestätigt die anfordernde Abteilung im ERP.", wer: "Lager bzw. anfordernde Abteilung" }),
    EK06: b({ ablauf: "Rechnung wird im ERP der Bestellung und dem Wareneingang zugeordnet; Abweichungen über 2 Prozent gehen an den Einkauf zurück.", wer: "Thomas Brück" }),
    EK07: b({ wer: "Einkauf legt an, Buchhaltung bestätigt Bankdaten", vierAugen: "ja" }),
    EK08: b({ vertraege: "Rahmenverträge für Rohmaterial und Wartungsverträge, Liste im ERP mit Laufzeit und Kündigungsfrist.", wer: "Einkaufsleitung" }),
    EK09: g({ ablauf: "Künftig: Anzahlungen nur mit Anzahlungsrechnung und Freigabe der Geschäftsführung, Überwachung über eigenes Konto.", freigabe: "Eva Lindner" }),
    EK10: b({ ablage: "ERP Fertigplan (fiktiv), Dokumente am Bestellvorgang", ordnung: "Bestellnummer" }),
    EK90: b({ umfang: "Einkauf von Material, Handelsware und Dienstleistungen am Standort Musterbach.", ausgenommen: "Kleinbeträge über die Firmenkreditkarte, siehe Verfahrensdokumentation Bank" }),
    EK91: b({ systeme: "ERP Fertigplan (fiktiv): Einkauf und Lager, Cloud. Lieferantenportale zweier Großhändler. DATEV Unternehmen online.", schnittstellen: "ERP an DATEV: Kreditorenstamm und Rechnungsbuchungen täglich per Schnittstelle.", betrieb: "Cloud / Anbieter" }),
    EK92: b({ kontrollen: k("einkauf", [0, 1, 2, 3, 4]), details: "Freigabe über 5.000 Euro im ERP durch Eva Lindner. Drei-Wege-Abgleich bei jeder Rechnung durch Thomas Brück. Bankdatenänderung: Rückruf über bekannte Nummer und Bestätigung durch die Buchhaltung. Offene Bestellungen wöchentlich durch den Einkauf." }),
    EK93: b({ arten: ["Z1 Nur-Lesezugriff im System", "Z3 Datenexport auf Datenträger"], format: "CSV und PDF", getestet: "unbekannt" }),
    EK94: b({ freigabe: "Eva Lindner", doku: "Änderungen an Freigabegrenzen und Rollen als Änderungsantrag im ERP-Ticketsystem.", protokoll: "ja" }),
    EK95: b({ notbetrieb: "Bei ERP-Ausfall Bestellungen per E-Mail mit Bestellnummernliste, Nacherfassung im ERP.", nacherfassung: "Nacherfassung innerhalb von zwei Arbeitstagen." }),
    EK96: b({ ort: "ERP Fertigplan (fiktiv) mit jährlichem Export auf das Firmenlaufwerk", form: "Originaldokumente im ERP, Export als CSV und PDF", loeschung: "Eva Lindner" }),
  },
);

const VERKAUF_MUSTER = muster(
  "verkauf",
  {
    company: "Agentur Klarblick GmbH (Muster, fiktiv)",
    standort: "Musterfeld",
    branche: "Werbe- und Webagentur",
    rechtsform: "GmbH",
    mitarbeitende: "6–10",
    gf: "Nora Klar",
    buchhaltung: "Felix Hahn",
    it: "Felix Hahn",
    flags: { ...FLAGS_NEIN, lohn: "ja" },
    systeme: [
      { name: "Projekt- und Fakturasoftware Faktura+ (fiktiv)", funktion: "Angebote, Aufträge, Rechnungen, offene Posten", typ: "rechnungssoftware", nutzer: "Geschäftsführung, Projektleitung, Büro", originalOrt: "Faktura+ beim Anbieter", hostingArt: "Anbieter-Cloud" },
      DATEV,
    ],
    ablage: [
      { art: "Ausgangsrechnungen", ort: "Faktura+ (fiktiv) und DATEV Unternehmen online", suche: "Rechnungsnummer" },
      { art: "Angebote und Auftragsbestätigungen", ort: "Faktura+ (fiktiv)", suche: "Projektnummer" },
    ],
    rollen: ROLLEN_STANDARD,
    kontrolle: { name: "Lückenprüfung der Rechnungsnummern", turnus: "monatlich", wer: "Felix Hahn", nachweis: "Vermerk in der Monatsmappe" },
    extern: [{ name: "Faktura+ (fiktiv)", unterlagenVorhanden: "ja" }, KANZLEI_EXTERN],
  },
  "Fiktive Agentur mit Projektgeschäft, Rechnungen aus der Fakturasoftware als PDF und XRechnung, Mahnwesen und Übergabe an DATEV.",
  {
    VK00: b({ verantwortlich: "Nora Klar (Geschäftsführung)", vertretung: "Felix Hahn (Büro)" }),
    VK01: b({ ablauf: "Angebot aus Faktura+, Auftrag per unterschriebenem Angebot oder Bestellung, Leistung im Projekt erfasst, Rechnung aus dem Projekt nach Abnahme oder monatlich.", system: "Faktura+ (fiktiv)" }),
    VK02: b({ system: "Faktura+ (fiktiv)", ablage: "Am Projekt in Faktura+" }),
    VK03: b({ wer: "Nora Klar", freigabe: "Nora Klar bei Rabatten über 10 Prozent" }),
    VK04: b({ wer: "Felix Hahn", protokolliert: "ja" }),
    VK05: b({ vergabe: "Automatisch fortlaufend durch Faktura+, Format RE-Jahr-laufende Nummer", kreise: "Ein Nummernkreis für Rechnungen, einer für Stornorechnungen" }),
    VK06: b({ ablauf: "Rechnungsvorlage in Faktura+ enthält alle Pflichtangaben; Leistungszeitraum wird aus dem Projekt übernommen.", wer: "Felix Hahn" }),
    VK07: b({ format: ["PDF per E-Mail", "XRechnung"], eRechnung: "ja" }),
    VK08: b({ ablauf: "Fehlerhafte Rechnungen werden in Faktura+ storniert (Stornorechnung mit Bezug) und neu ausgestellt; kein Überschreiben.", freigabe: "Nora Klar" }),
    VK09: b({ wer: "Felix Hahn", turnus: "wöchentlich; Mahnung nach 14 Tagen Verzug" }),
    VK10: b({ uebergabe: "Faktura+ überträgt Rechnungen und Debitoren per DATEV-Schnittstelle an DATEV Unternehmen online.", turnus: "täglich automatisch" }),
    VK90: b({ umfang: "Alle Leistungen der Agentur an Geschäftskunden.", ausgenommen: "keine" }),
    VK91: b({ systeme: "Faktura+ (fiktiv): Projekt- und Rechnungssoftware, Cloud. DATEV Unternehmen online: Übergabe an die Kanzlei.", schnittstellen: "Faktura+ an DATEV: Rechnungen und Debitoren täglich automatisch (DATEV-Format).", betrieb: "Cloud / Anbieter" }),
    VK92: b({ kontrollen: k("verkauf", [0, 1, 3, 4, 5]), details: "Lückenprüfung monatlich durch Felix Hahn. Abgleich erfasster Projektzeiten mit Rechnungen monatlich durch die Projektleitung. Vorlage mit Pflichtangaben laufend. OP-Liste gegen Debitorenkonten monatlich. Storni nur mit Freigabe durch Nora Klar." }),
    VK93: b({ arten: ["Z1 Nur-Lesezugriff im System", "Z3 Datenexport auf Datenträger"], format: "CSV, PDF und XRechnung", getestet: "ja" }),
    VK94: b({ freigabe: "Nora Klar", doku: "Änderungen an Rechnungsvorlage, Nummernkreis und Steuersätzen im Änderungsblatt mit Datum.", protokoll: "ja" }),
    VK95: n("Rechnungen können bei Ausfall einen Tag später gestellt werden; es entstehen keine Aufzeichnungen außerhalb des Systems."),
    VK96: u({ ort: "Faktura+ (fiktiv) und DATEV Unternehmen online" }),
  },
);

const RETOUREN_MUSTER = muster(
  "retouren",
  {
    company: "Laufwerk Sportversand GmbH (Muster, fiktiv)",
    standort: "Musterlingen",
    branche: "Onlinehandel Sportartikel",
    rechtsform: "GmbH",
    mitarbeitende: "11–25",
    gf: "Kai Laufer",
    buchhaltung: "Miriam Ost",
    it: "Kai Laufer",
    flags: { ...FLAGS_NEIN, shop: "ja", lager: "ja", plattformen: "ja", lohn: "ja" },
    systeme: [
      { name: "Shopsystem (fiktiv)", funktion: "Bestellungen und Retourenportal", typ: "sonstiges", nutzer: "Kundenservice", originalOrt: "Shopsystem beim Anbieter", hostingArt: "Anbieter-Cloud" },
      { name: "WaWi Lagerplus (fiktiv)", funktion: "Bestände, Retourenbuchung", typ: "sonstiges", nutzer: "Lager", originalOrt: "WaWi-Datenbank", hostingArt: "Anbieter-Cloud" },
      DATEV,
    ],
    ablage: [
      { art: "Retourenvorgänge und Prüfprotokolle", ort: "WaWi Lagerplus (fiktiv)", suche: "Retourennummer" },
      { art: "Stornorechnungen", ort: "Shopsystem und DATEV Unternehmen online", suche: "Rechnungsnummer" },
    ],
    rollen: [
      { rolle: "Geschäftsführung", rechte: ["lesen", "freigeben"] },
      { rolle: "Kundenservice", rechte: ["Retouren anlegen", "Erstattung vorschlagen"] },
      { rolle: "Lager", rechte: ["Retoure prüfen", "Bestand buchen"] },
      { rolle: "Buchhaltung", rechte: ["lesen", "Erstattung ausführen"] },
    ],
    kontrolle: { name: "Abgleich Erstattungen mit Stornorechnungen", turnus: "wöchentlich", wer: "Miriam Ost", nachweis: "Abgleichliste" },
    extern: [{ name: "Shopsystem (fiktiv)", unterlagenVorhanden: "ja" }, KANZLEI_EXTERN],
  },
  "Fiktiver Sportversand mit Retourenportal, Prüfung im Lager, Stornorechnung mit Bezug, Erstattung über den Zahlungsdienstleister und Bestandsbuchung.",
  {
    RT00: b({ verantwortlich: "Leitung Kundenservice (Anja Berg)", vertretung: "Kai Laufer" }),
    RT01: b({ kanaele: "Retourenportal im Shop mit Retourenlabel; Marktplatzretouren über das Marktplatz-Backend.", system: "Shopsystem (fiktiv), Retourenmodul" }),
    RT02: b({ regeln: "Widerruf 14 Tage gesetzlich, freiwilliges Rückgaberecht 30 Tage, Gewährleistung nach Prüfung.", quelle: "AGB des Shops und Arbeitsanweisung Retouren" }),
    RT03: b({ ablauf: "Lager scannt das Retourenlabel, die Retoure wird automatisch der Bestellung zugeordnet.", zuordnung: "Bestell- und Retourennummer" }),
    RT04: b({ wer: "Lager prüft, Kundenservice entscheidet", dokumentation: "Prüfergebnis und Entscheidung im Retourenvorgang mit Foto bei Beschädigung" }),
    RT05: b({ beleg: ["Stornorechnung"], bezug: "Stornorechnung nennt Nummer und Datum der Ursprungsrechnung" }),
    RT06: b({ ablauf: "Stornorechnung mindert Umsatz und Umsatzsteuer im selben Voranmeldungszeitraum; Buchung über die DATEV-Schnittstelle.", wer: "Miriam Ost" }),
    RT07: b({ weg: "Rückzahlung über den ursprünglichen Zahlungsweg (Zahlungsdienstleister)", freigabe: "Kundenservice", grenze: "über 300 Euro zusätzlich Kai Laufer" }),
    RT08: b({ bestand: "Wieder verkaufbare Ware wird zurückgebucht; B-Ware auf eigenen Lagerort; Verschrottung mit Grund.", zustand: ["Wieder verkaufbar", "B-Ware", "Verschrottung"] }),
    RT09: g({ ablauf: "Künftig: Lieferantenretouren mit eigener Retourennummer und Liste ausstehender Gutschriften.", wer: "Einkauf" }),
    RT10: b({ ablage: "WaWi Lagerplus (fiktiv), Retourenvorgang", ordnung: "Retourennummer" }),
    RT90: b({ umfang: "Retouren aus eigenem Shop und Marktplätzen.", ausgenommen: "Reklamationen von Geschäftskunden (Einzelfall per E-Mail)" }),
    RT91: b({ systeme: "Shopsystem (fiktiv) mit Retourenportal; WaWi Lagerplus (fiktiv); Zahlungsdienstleister; DATEV Unternehmen online.", schnittstellen: "Shop an WaWi: Retourenanmeldung sofort. Shop an DATEV: Stornorechnungen täglich. Zahlungsdienstleister an DATEV: Erstattungen über Auszahlungsreport.", betrieb: "Cloud / Anbieter" }),
    RT92: b({ kontrollen: k("retouren", [0, 1, 2, 3, 4]), details: "Erstattung gegen Stornorechnung wöchentlich durch Miriam Ost. Erstattungen über 300 Euro durch Kai Laufer. Offene Retouren älter als 5 Tage täglich durch den Kundenservice. Retourenbestand monatlich gegen WaWi." }),
    RT93: b({ arten: ["Z1 Nur-Lesezugriff im System", "Z3 Datenexport auf Datenträger"], format: "CSV", getestet: "unbekannt" }),
    RT94: b({ freigabe: "Kai Laufer", doku: "Änderungen an Rückgaberegeln, Retourengründen und Erstattungslogik im Änderungsblatt.", protokoll: "ja" }),
    RT95: b({ notbetrieb: "Bei Ausfall des Retourenportals werden Retouren im Lager auf einer Liste erfasst und später angelegt.", nacherfassung: "Liste wird nach Nacherfassung abgehakt und abgelegt." }),
    RT96: b({ ort: "WaWi Lagerplus (fiktiv) und DATEV Unternehmen online", form: "Originaldaten im System, Stornorechnungen als PDF", loeschung: "Kai Laufer" }),
  },
);

const ZEIT_MUSTER = muster(
  "zeiterfassung",
  {
    company: "Pflegedienst Lindenhof GmbH (Muster, fiktiv)",
    standort: "Musterdorf",
    branche: "Ambulanter Pflegedienst",
    rechtsform: "GmbH",
    mitarbeitende: "26–50",
    gf: "Sandra Linde",
    buchhaltung: "Oliver Pfeiffer",
    it: "Externer IT-Dienstleister",
    flags: { ...FLAGS_NEIN, lohn: "ja" },
    systeme: [
      { name: "Zeiterfassungs-App Takt (fiktiv)", funktion: "Arbeitszeit, Pausen, Abwesenheiten", typ: "sonstiges", nutzer: "alle Beschäftigten, Pflegedienstleitung", originalOrt: "Cloud des App-Anbieters", hostingArt: "Anbieter-Cloud" },
      DATEV,
    ],
    ablage: [
      { art: "Zeitnachweise", ort: "Zeiterfassungs-App Takt (fiktiv), monatlicher PDF-Export in DATEV", suche: "Monat und Personalnummer" },
    ],
    rollen: [
      { rolle: "Geschäftsführung", rechte: ["lesen", "freigeben"] },
      { rolle: "Pflegedienstleitung", rechte: ["lesen", "korrigieren", "Monatsabschluss"] },
      { rolle: "Beschäftigte", rechte: ["eigene Zeiten erfassen"] },
    ],
    kontrolle: { name: "Abgleich Stunden mit Lohnabrechnung", turnus: "monatlich", wer: "Oliver Pfeiffer", nachweis: "Abgleichvermerk" },
    extern: [{ name: "Zeiterfassungs-App Takt (fiktiv)", unterlagenVorhanden: "ja" }, KANZLEI_EXTERN],
  },
  "Fiktiver Pflegedienst mit App-Zeiterfassung, Korrekturen nur durch die Pflegedienstleitung mit Protokoll, Monatsabschluss und Export an die Lohnabrechnung der Kanzlei.",
  {
    ZE00: b({ verantwortlich: "Pflegedienstleitung (Ute Sommer)", vertretung: "Sandra Linde" }),
    ZE01: b({ art: "App / Software", system: "Zeiterfassungs-App Takt (fiktiv) auf Diensthandys" }),
    ZE02: b({ kreis: "Alle Beschäftigten einschließlich Minijobs und Aushilfen." }),
    ZE03: b({ wer: "Beschäftigte selbst per App", inhalt: ["Beginn", "Ende", "Pausen", "Dauer"], frist: "täglich, spätestens am Folgetag" }),
    ZE04: b({ ablauf: "Urlaub per Antrag in der App, Krankheit meldet die Pflegedienstleitung im System.", freigabe: "Pflegedienstleitung" }),
    ZE05: b({ wer: "Nur Pflegedienstleitung", protokolliert: "ja" }),
    ZE06: b({ wer: "Pflegedienstleitung", termin: "bis zum 2. Werktag des Folgemonats" }),
    ZE07: b({ ablauf: "Die App berechnet Überstunden gegen die Sollzeit und Zuschläge für Nacht-, Sonn- und Feiertagsarbeit nach hinterlegten Regeln.", freigabe: "Pflegedienstleitung" }),
    ZE08: b({ uebergabe: "Monatsexport der Stunden und Zuschläge aus der App, Upload in DATEV Unternehmen online für die Lohnabrechnung der Kanzlei.", format: "CSV-Export im Lohnformat" }),
    ZE09: b({ ablage: "App-Cloud und monatlicher PDF-Export in DATEV Unternehmen online", export: "ja" }),
    ZE90: b({ umfang: "Alle Beschäftigten des Pflegedienstes am Standort Musterdorf.", ausgenommen: "Geschäftsführung" }),
    ZE91: b({ systeme: "Zeiterfassungs-App Takt (fiktiv), Anbieter Takt GmbH (fiktiv), Cloud. DATEV Unternehmen online.", schnittstellen: "App an DATEV: monatlicher CSV-Export, manueller Upload.", betrieb: "Cloud / Anbieter" }),
    ZE92: b({ kontrollen: k("zeiterfassung", [0, 1, 2, 4]), details: "Plausibilitätsprüfung monatlich vor Abschluss durch die Pflegedienstleitung. Korrekturprotokoll monatlich durch Sandra Linde. Abgleich mit der Lohnabrechnung monatlich durch Oliver Pfeiffer. Überstunden werden in der App freigegeben." }),
    ZE93: b({ arten: ["Z1 Nur-Lesezugriff im System", "Z3 Datenexport auf Datenträger"], format: "CSV und PDF", getestet: "ja" }),
    ZE94: b({ freigabe: "Sandra Linde", doku: "Änderungen an Sollzeiten, Zuschlagsregeln und Rechten im Änderungsblatt der App mit Datum.", protokoll: "ja" }),
    ZE95: b({ notbetrieb: "Bei Ausfall der App Stundenzettel auf Papier, Übertrag durch die Pflegedienstleitung.", nacherfassung: "Stundenzettel werden nach Übertrag aufbewahrt." }),
    ZE96: u({ ort: "App-Cloud" }),
  },
);

const LOHN_MUSTER = muster(
  "lohn",
  {
    company: "Elektro Funke GmbH (Muster, fiktiv)",
    standort: "Musterberg",
    branche: "Elektroinstallation (Handwerk)",
    rechtsform: "GmbH",
    mitarbeitende: "11–25",
    gf: "Robert Funke",
    buchhaltung: "Ines Wolf",
    it: "Robert Funke",
    flags: { ...FLAGS_NEIN, lohn: "ja", lager: "ja" },
    systeme: [
      { name: "DATEV Lohn und Gehalt (Kanzlei)", funktion: "Lohnabrechnung, Meldungen, Lohnkonten", typ: "sonstiges", nutzer: "Kanzlei", originalOrt: "Rechenzentrum der DATEV über die Kanzlei", hostingArt: "Anbieter-Cloud" },
      DATEV,
    ],
    ablage: [
      { art: "Lohnunterlagen", ort: "DATEV Unternehmen online (Lohnauswertungen)", suche: "Monat" },
      { art: "Personalakten", ort: "Verschlossener Schrank Büro", suche: "Name" },
    ],
    rollen: [
      { rolle: "Geschäftsführung", rechte: ["lesen", "freigeben"] },
      { rolle: "Büro (Ines Wolf)", rechte: ["lesen Lohnauswertungen", "Bewegungsdaten melden"] },
      { rolle: "Kanzlei", rechte: ["Lohnabrechnung"] },
    ],
    kontrolle: { name: "Plausibilitätsprüfung Lohnjournal", turnus: "monatlich", wer: "Robert Funke", nachweis: "Abzeichnung Lohnjournal" },
    extern: [{ name: "DATEV Lohn und Gehalt über die Kanzlei", unterlagenVorhanden: "ja" }, KANZLEI_EXTERN],
  },
  "Fiktiver Handwerksbetrieb, Lohnabrechnung durch die Kanzlei in DATEV Lohn und Gehalt, Freigabe der Zahlungsliste im Vier-Augen-Prinzip, automatische Übergabe an die FiBu.",
  {
    LO00: b({ verantwortlich: "Robert Funke (Geschäftsführung)", vertretung: "Ines Wolf (Büro)" }),
    LO01: b({ wer: "Kanzlei", system: "DATEV Lohn und Gehalt", termin: "monatlich zum 25." }),
    LO02: b({ unterlagen: ["Lohnabrechnungen", "Lohnjournal", "Buchungsliste", "Zahlungsliste / SEPA-Datei", "Beitragsnachweise", "Lohnsteuer-Anmeldung"], ort: "DATEV Unternehmen online, Bereich Lohnauswertungen" }),
    LO03: b({ meldet: "Ines Wolf", freigabe: "Robert Funke", weg: "Personalfragebogen und Änderungsmeldung per DATEV Upload" }),
    LO04: b({ weg: "Stunden aus den Stundenzetteln, Zuschläge und Abwesenheiten als Monatsliste per DATEV Upload an die Kanzlei.", frist: "bis zum 18. des Monats" }),
    LO05: b({ ablage: "DATEV-Rechenzentrum über die Kanzlei, Auswertungen in DATEV Unternehmen online", form: "Lohnkonten im Lohnprogramm der Kanzlei" }),
    LO06: b({ wer: "Kanzlei", kontrolle: "Kanzlei stellt Übermittlungsprotokolle monatlich in DATEV Unternehmen online bereit; Ines Wolf prüft deren Vollständigkeit." }),
    LO07: b({ schnittstelle: "Automatischer Buchungsdatensatz (z. B. DATEV Lohn an DATEV FiBu)", uebergabe: "Die Kanzlei übernimmt die Lohnbuchungen direkt in die FiBu." }),
    LO08: b({ wer: "Robert Funke, Ines Wolf, Kanzlei", schutz: "Eigene Rolle in DATEV Unternehmen online, Personalakten verschlossen" }),
    LO09: b({ freigabe: "Ines Wolf bereitet vor, Robert Funke gibt im Onlinebanking frei", vierAugen: "ja" }),
    LO10: b({ ablauf: "Reisekosten über Abrechnungsformular mit Belegen, Prüfung durch Robert Funke; Dienstwagen nach 1-Prozent-Regelung, von der Kanzlei abgerechnet." }),
    LO11: u({ ansprechpartner: "Kanzlei" }),
    LO90: b({ umfang: "Alle Beschäftigten einschließlich Auszubildender und Minijobs.", ausgenommen: "keine" }),
    LO91: b({ systeme: "DATEV Lohn und Gehalt (Kanzlei); DATEV Unternehmen online; Onlinebanking.", schnittstellen: "Lohn an FiBu: DATEV-intern automatisch. Lohn an Bank: SEPA-Datei monatlich.", betrieb: "Cloud / Anbieter" }),
    LO92: b({ kontrollen: k("lohn", [0, 1, 2, 3, 4, 5]), details: "Personalbestand gegen Abrechnung monatlich durch Ines Wolf. Lohnjournal gegen Vormonat monatlich durch Robert Funke. Zahlungsliste im Vier-Augen-Prinzip. Lohnverrechnungskonten quartalsweise durch die Kanzlei. Übermittlungsprotokolle monatlich. Zugriffsrechte jährlich." }),
    LO93: b({ arten: ["Z2 Auswertung nach Vorgabe", "Z3 Datenexport auf Datenträger"], format: "DLS über die Kanzlei", getestet: "unbekannt" }),
    LO94: b({ freigabe: "Robert Funke", doku: "Änderungen an Lohnarten, Zuschlagsregeln oder Abrechnungsweg schriftlich mit der Kanzlei abgestimmt und abgelegt.", protokoll: "ja" }),
    LO95: b({ notbetrieb: "Fällt die Abrechnung aus, zahlt die Geschäftsführung Abschläge; Korrektur mit der nächsten Abrechnung.", nacherfassung: "Abschlagsliste wird an die Kanzlei übergeben." }),
    LO96: b({ ort: "DATEV über die Kanzlei, Personalakten im verschlossenen Schrank", form: "Elektronische Originale, Personalakten auf Papier", loeschung: "Robert Funke" }),
  },
);

const ECOMMERCE_MUSTER = muster(
  "ecommerce",
  {
    company: "Kaffeerösterei Bohnenglück UG (Muster, fiktiv)",
    standort: "Musterau",
    branche: "Onlinehandel Kaffee",
    rechtsform: "UG (haftungsbeschränkt)",
    mitarbeitende: "2–5",
    gf: "Lea Bohn",
    buchhaltung: "Lea Bohn",
    it: "Lea Bohn",
    flags: { ...FLAGS_NEIN, shop: "ja", plattformen: "ja", lager: "ja" },
    systeme: [
      { name: "Shopsystem (fiktiv)", funktion: "Onlineshop, Bestellungen, Rechnungen", typ: "sonstiges", nutzer: "Lea Bohn, Aushilfe", originalOrt: "Shopsystem beim Anbieter", hostingArt: "Anbieter-Cloud" },
      { name: "Marktplatz (fiktiv)", funktion: "Verkauf über Marktplatz", typ: "portal", nutzer: "Lea Bohn", originalOrt: "Marktplatz-Backend", hostingArt: "Anbieter-Cloud" },
      { name: "Zahlungsdienstleister (fiktiv)", funktion: "Kartenzahlung, Wallet, Auszahlungen", typ: "portal", nutzer: "Lea Bohn", originalOrt: "Händlerkonto beim Zahlungsdienstleister", hostingArt: "Anbieter-Cloud" },
      DATEV,
    ],
    ablage: [
      { art: "Bestell- und Zahlungsdaten", ort: "Monatsexporte im Cloud-Laufwerk, Ordner E-Commerce", suche: "Monat und Kanal" },
      { art: "Ausgangsrechnungen", ort: "Shopsystem und DATEV Unternehmen online", suche: "Rechnungsnummer" },
    ],
    rollen: [
      { rolle: "Geschäftsführung", rechte: ["lesen", "ändern", "freigeben"] },
      { rolle: "Aushilfe", rechte: ["Bestellungen bearbeiten"] },
      { rolle: "Kanzlei", rechte: ["lesen"] },
    ],
    kontrolle: { name: "Abgleich Auszahlungen mit Bankeingang", turnus: "monatlich", wer: "Lea Bohn", nachweis: "Abstimmungstabelle" },
    extern: [{ name: "Shopsystem (fiktiv)", unterlagenVorhanden: "ja" }, { name: "Marktplatz (fiktiv)", unterlagenVorhanden: "unbekannt" }, KANZLEI_EXTERN],
  },
  "Fiktive Kaffeerösterei mit eigenem Shop und einem Marktplatz, Zahlungsdienstleister mit Sammelauszahlungen, monatlicher Abstimmung und Export der Rohdaten.",
  {
    EC00: b({ verantwortlich: "Lea Bohn (Geschäftsführung)", vertretung: "Steuerkanzlei für Abstimmung, Aushilfe für Bestellungen" }),
    EC01: b({ kanaele: "Eigener Onlineshop (fiktiv) und ein Marktplatz (fiktiv), Verkauf an Privatpersonen in Deutschland und Österreich." }),
    EC02: b({ system: "Shopsystem (fiktiv)", plugins: "Rechnungs-Plugin des Shopanbieters, Versandlabel-App" }),
    EC03: b({ anbieter: "Zahlungsdienstleister (fiktiv) für Karte und Wallet; Marktplatz zahlt selbst aus." }),
    EC04: b({ ort: "Shopsystem und Marktplatz-Backend", export: "Monatlicher CSV-Export je Kanal bis zum 5." }),
    EC05: b({ pflege: "Lea Bohn; Steuersätze im Shop je Land hinterlegt", oss: "ja" }),
    EC06: b({ rechnung: "Shop erstellt die Rechnung automatisch bei Versand als PDF; Marktplatzrechnungen über den Rechnungsdienst des Marktplatzes.", nummernkreis: "Shop: RS-…, Marktplatz: MP-…" }),
    EC07: b({ abruf: "Gebühren- und Auszahlungsreports monatlich als CSV und PDF aus dem Marktplatz-Backend und dem Händlerkonto.", turnus: "monatlich" }),
    EC08: b({ wer: "Lea Bohn", turnus: "monatlich", konto: "Je Anbieter ein Verrechnungskonto" }),
    EC09: u({ ablauf: "Gutscheine werden im Shop verkauft; Buchung mit der Kanzlei zu klären." }),
    EC10: b({ ablage: "Cloud-Laufwerk, Ordner E-Commerce, monatliche Exporte", anbieterfrist: "Marktplatz: Berichte ca. 2 Jahre abrufbar" }),
    EC90: b({ umfang: "Onlineshop und Marktplatz.", ausgenommen: "Verkauf auf Wochenmärkten, siehe Verfahrensdokumentation Kasse" }),
    EC91: b({ systeme: "Shopsystem (fiktiv), Marktplatz (fiktiv), Zahlungsdienstleister (fiktiv), DATEV Unternehmen online.", schnittstellen: "Shop an DATEV: Rechnungsexport monatlich (DATEV-Format). Zahlungsdienstleister an DATEV: Auszahlungsreport monatlich (CSV).", betrieb: "Cloud / Anbieter" }),
    EC92: b({ kontrollen: k("ecommerce", [0, 1, 2, 4, 5]), details: "Bestellungen gegen Rechnungen monatlich, Auszahlungen gegen Bankeingang monatlich, Gebührenabrechnungen stichprobenweise, Verrechnungskonten monatlich, Rohdatenexport bis zum 5. des Folgemonats; alles durch Lea Bohn mit Abstimmungstabelle." }),
    EC93: b({ arten: ["Z3 Datenexport auf Datenträger"], format: "CSV aus Shop, Marktplatz und Zahlungsdienstleister", getestet: "ja" }),
    EC94: g({ freigabe: "Lea Bohn", doku: "Künftig: Plugin-Updates und Steuersatzänderungen im Änderungsblatt.", protokoll: "unbekannt" }),
    EC95: b({ notbetrieb: "Bei Shopausfall werden keine Bestellungen angenommen; Marktplatz läuft weiter.", nacherfassung: "entfällt" }),
    EC96: b({ ort: "Cloud-Laufwerk, Ordner E-Commerce", form: "Originalexporte CSV und PDF", loeschung: "Lea Bohn" }),
  },
);

const BANK_MUSTER = muster(
  "bank",
  {
    company: "Architekturbüro Hellweg PartG (Muster, fiktiv)",
    standort: "Musterstein",
    branche: "Architektur und Planung",
    rechtsform: "Partnerschaftsgesellschaft",
    mitarbeitende: "6–10",
    gf: "Jana Hellweg",
    buchhaltung: "Paul Richter",
    it: "Externer IT-Dienstleister",
    flags: { ...FLAGS_NEIN, lohn: "ja" },
    systeme: [
      { name: "Banking-Software (fiktiv)", funktion: "Kontoauszüge, Zahlungsverkehr", typ: "sonstiges", nutzer: "Partner, Büro", originalOrt: "Banking-Software und Bankportal", hostingArt: "Lokal" },
      DATEV,
    ],
    ablage: [
      { art: "Kontoauszüge", ort: "DATEV Unternehmen online (Bankdaten) und PDF-Kontoauszüge im Bankportal", suche: "Konto und Datum" },
    ],
    rollen: [
      { rolle: "Partner", rechte: ["lesen", "Zahlungen freigeben"] },
      { rolle: "Büro", rechte: ["Zahlungen vorbereiten", "lesen"] },
      { rolle: "Kanzlei", rechte: ["lesen Bankdaten"] },
    ],
    kontrolle: { name: "Monatliche Bankabstimmung", turnus: "monatlich", wer: "Paul Richter", nachweis: "Abstimmungsvermerk" },
    extern: [{ name: "Bankportal der Hausbank", unterlagenVorhanden: "ja" }, KANZLEI_EXTERN],
  },
  "Fiktives Architekturbüro mit zwei Geschäftskonten, Zahlungsvorschlag aus DATEV, Freigabe im Vier-Augen-Prinzip, automatischem Umsatzabruf und monatlicher Abstimmung.",
  {
    BA00: b({ verantwortlich: "Jana Hellweg (Partnerin)", vertretung: "Lukas Berger (Partner)" }),
    BA01: b({ konten: "Geschäftskonto Hausbank (laufender Zahlungsverkehr), Tagesgeldkonto Hausbank (Rücklagen).", karten: "Eine Firmenkreditkarte (Jana Hellweg)" }),
    BA02: b({ vollmachten: "Partner: Einzelvollmacht bis 10.000 Euro, darüber gemeinsam. Büro: Erfassungsrecht ohne Freigabe.", sperre: "Zugang wird am letzten Arbeitstag durch die Bank gesperrt, Auftrag durch einen Partner." }),
    BA03: b({ format: "Elektronisch (Datensatz/Schnittstelle)", ablage: "DATEV Unternehmen online (Bankdaten), zusätzlich PDF-Kontoauszug im Bankportal" }),
    BA04: b({ ablauf: "Zahlungsvorschlag aus den offenen Posten in DATEV, Export als SEPA-Datei in die Banking-Software.", wer: "Paul Richter" }),
    BA05: b({ wer: "Ein Partner, über 10.000 Euro beide Partner", vierAugen: "ja", limit: "Einzelfreigabe bis 10.000 Euro" }),
    BA06: b({ ueberwachung: "Liste der Lastschriftmandate und Daueraufträge im Ordner Bank, jährliche Durchsicht.", wer: "Paul Richter" }),
    BA07: b({ wer: "Paul Richter", turnus: "monatlich" }),
    BA08: b({ weg: "Automatischer Abruf in die FiBu", uebergabe: "Kontoumsätze werden täglich über DATEV Bankdaten abgerufen." }),
    BA09: g({ ablauf: "Künftig: Kreditkartenbelege per App zur Abrechnung hochladen; heute Papierbelege in der Monatsmappe." }),
    BA10: b({ ablauf: "Ungeklärte Posten auf Verrechnungskonto, Klärung innerhalb von 14 Tagen durch Rückfrage.", wer: "Paul Richter" }),
    BA90: b({ umfang: "Beide Bankkonten und die Firmenkreditkarte.", ausgenommen: "keine" }),
    BA91: b({ systeme: "Banking-Software (fiktiv), lokal; Bankportal der Hausbank; DATEV Unternehmen online (Bankdaten).", schnittstellen: "Bank an DATEV: täglicher Umsatzabruf. DATEV an Banking: SEPA-Datei bei Zahlungslauf.", betrieb: "Gemischt" }),
    BA92: b({ kontrollen: k("bank", [0, 1, 2, 3, 4]), details: "Vier-Augen-Freigabe über 10.000 Euro in der Banking-Software. Bankabstimmung monatlich durch Paul Richter. Daueraufträge und Lastschriften jährlich. Bankvollmachten jährlich durch Jana Hellweg. Ungeklärte Posten wöchentlich." }),
    BA93: b({ arten: ["Z1 Nur-Lesezugriff im System", "Z3 Datenexport auf Datenträger"], format: "DATEV-Format und CAMT", getestet: "unbekannt" }),
    BA94: b({ freigabe: "Jana Hellweg", doku: "Änderungen an Vollmachten und Limits mit Bankformular und Kopie im Ordner Bank.", protokoll: "ja" }),
    BA95: b({ notbetrieb: "Bei Ausfall der Banking-Software Freigabe direkt im Bankportal.", nacherfassung: "Zahlungen werden beim nächsten Abruf automatisch übernommen." }),
    BA96: b({ ort: "DATEV Unternehmen online und Bankportal", form: "Elektronische Kontoauszüge in empfangener Form (PDF und Datensatz)", loeschung: "Jana Hellweg" }),
  },
);

const ANLAGEN_MUSTER = muster(
  "anlagen",
  {
    company: "Druckerei Papierwerk GmbH (Muster, fiktiv)",
    standort: "Mustertal",
    branche: "Druckerei",
    rechtsform: "GmbH",
    mitarbeitende: "11–25",
    gf: "Hannes Papke",
    buchhaltung: "Birgit Kranz",
    it: "Externer IT-Dienstleister",
    flags: { ...FLAGS_NEIN, lager: "ja", lohn: "ja" },
    systeme: [
      { name: "DATEV Anlagenbuchführung (Kanzlei)", funktion: "Anlagenverzeichnis, AfA", typ: "fibu", nutzer: "Kanzlei, Birgit Kranz", originalOrt: "DATEV über die Kanzlei", hostingArt: "Anbieter-Cloud" },
      DATEV,
    ],
    ablage: [
      { art: "Anschaffungsrechnungen", ort: "DATEV Unternehmen online", suche: "Inventarnummer" },
      { art: "Inventurlisten Anlagen", ort: "Ordner Anlagen auf dem NAS", suche: "Geschäftsjahr" },
    ],
    rollen: ROLLEN_STANDARD,
    kontrolle: { name: "Abgleich Anlagenverzeichnis mit Anlagenkonten", turnus: "jährlich", wer: "Kanzlei", nachweis: "Abschlussunterlagen" },
    extern: [KANZLEI_EXTERN],
  },
  "Fiktive Druckerei mit Maschinenpark, Anlagenverzeichnis in der DATEV-Anlagenbuchführung der Kanzlei, Inventarnummern, jährlicher Bestandsaufnahme und Leasing.",
  {
    AN00: b({ verantwortlich: "Birgit Kranz (Buchhaltung)", vertretung: "Hannes Papke" }),
    AN01: b({ system: "DATEV Anlagenbuchführung über die Kanzlei", wer: "Kanzlei nach Meldung durch Birgit Kranz" }),
    AN02: b({ wer: "Birgit Kranz nach Rücksprache mit der Kanzlei", ablauf: "Rechnungen über 250 Euro netto werden auf Anlagegut, GWG oder Sammelposten geprüft und im Formular Anlagenzugang an die Kanzlei gemeldet." }),
    AN03: b({ ablauf: "Anschaffungspreis zuzüglich Fracht und Montage, abzüglich Skonti und Zuschüsse; Nachweise am Anlagenzugang." }),
    AN04: b({ kennzeichnung: "Inventarnummer mit Etikett", standort: "Halle und Raum im Anlagenverzeichnis" }),
    AN05: b({ methode: "linear", wer: "Kanzlei nach amtlicher AfA-Tabelle, Abweichungen mit Hannes Papke abgestimmt" }),
    AN06: n("Keine Anlagen im Bau; Anzahlungen kommen nicht vor."),
    AN07: b({ ablauf: "Verkauf oder Verschrottung mit Abgangsformular, Verkaufsrechnung bzw. Entsorgungsnachweis.", freigabe: "Hannes Papke" }),
    AN08: b({ pruefung: "Ja, jährlich", wer: "Birgit Kranz mit Produktionsleitung" }),
    AN09: b({ vertraege: "Leasing für eine Digitaldruckmaschine und zwei Fahrzeuge; Verträge im Ordner Verträge, Liste mit Laufzeiten." }),
    AN10: u({ turnus: "Jahresabschluss" }),
    AN90: b({ umfang: "Gesamtes Sachanlagevermögen am Standort Mustertal.", ausgenommen: "Geleaste Güter (nur Vertragsliste)" }),
    AN91: b({ systeme: "DATEV Anlagenbuchführung (Kanzlei); DATEV Unternehmen online.", schnittstellen: "Anlagenbuchführung an FiBu: DATEV-intern zum Monats- oder Jahresabschluss.", betrieb: "Cloud / Anbieter" }),
    AN92: b({ kontrollen: k("anlagen", [0, 1, 2, 3, 4]), details: "Abgleich Verzeichnis mit Konten jährlich durch die Kanzlei. Aufwandskonten auf Anlagenzugänge quartalsweise durch Birgit Kranz. Bestandsaufnahme jährlich mit Liste. Abgänge nur mit Formular. GWG-Grenzen bei jeder Meldung." }),
    AN93: b({ arten: ["Z2 Auswertung nach Vorgabe", "Z3 Datenexport auf Datenträger"], format: "DATEV-Format über die Kanzlei", getestet: "unbekannt" }),
    AN94: b({ freigabe: "Hannes Papke", doku: "Änderungen an Nutzungsdauern oder Methoden schriftlich mit der Kanzlei abgestimmt.", protokoll: "ja" }),
    AN95: n("Kein eigenes System im Betrieb; Meldungen an die Kanzlei können nachgeholt werden."),
    AN96: b({ ort: "DATEV Unternehmen online und Ordner Anlagen auf dem NAS", form: "Elektronische Rechnungen, Formulare als PDF", loeschung: "Hannes Papke" }),
  },
);

const VORSYSTEM_MUSTER = muster(
  "vorsystem",
  {
    company: "Physiotherapie Bewegt GbR (Muster, fiktiv)",
    standort: "Musterhain",
    branche: "Physiotherapiepraxis",
    rechtsform: "GbR",
    mitarbeitende: "6–10",
    gf: "Dr. Mia Kern",
    buchhaltung: "Tim Kern",
    it: "Externer IT-Dienstleister",
    flags: { ...FLAGS_NEIN, lohn: "ja" },
    systeme: [
      { name: "Praxissoftware TheraPlan (fiktiv)", funktion: "Termine, Leistungserfassung, Abrechnung Privat und Kasse", typ: "sonstiges", nutzer: "Therapeuten, Empfang", originalOrt: "Praxissoftware auf dem Praxisserver", hostingArt: "Lokal" },
      DATEV,
    ],
    ablage: [
      { art: "Leistungs- und Abrechnungsdaten", ort: "Praxissoftware TheraPlan (fiktiv)", suche: "Rechnungsnummer und Datum" },
    ],
    rollen: [
      { rolle: "Inhaberin", rechte: ["lesen", "ändern", "freigeben"] },
      { rolle: "Empfang", rechte: ["Leistungen erfassen", "Rechnungen erstellen"] },
      { rolle: "Therapeuten", rechte: ["eigene Leistungen erfassen"] },
    ],
    kontrolle: { name: "Abstimmung Abrechnungssummen mit FiBu", turnus: "monatlich", wer: "Tim Kern", nachweis: "Abstimmungsliste" },
    extern: [{ name: "Praxissoftware TheraPlan (fiktiv), Wartungsvertrag", unterlagenVorhanden: "ja" }, KANZLEI_EXTERN],
  },
  "Fiktive Physiotherapiepraxis mit Praxissoftware als Vorsystem für Leistungserfassung und Abrechnung, monatlichem Export an DATEV und Abstimmung der Summen.",
  {
    SV00: b({ verantwortlich: "Dr. Mia Kern (Inhaberin)", vertretung: "Tim Kern (Büro)" }),
    SV01: b({ name: "Praxissoftware TheraPlan (fiktiv)", zweck: "Terminplanung, Erfassung erbrachter Leistungen, Rechnungen an Privatpatienten, Abrechnung mit Krankenkassen", anbieter: "TheraPlan GmbH (fiktiv)" }),
    SV02: b({ rollen: "Empfang: Termine, Rechnungen. Therapeuten: Leistungserfassung. Inhaberin: Freigabe, Stammdaten. Tim Kern: Export und Abstimmung." }),
    SV03: b({ daten: "Leistungen je Behandlung, Privatrechnungen, Kassenabrechnungen, Zahlungseingänge Privatpatienten." }),
    SV04: b({ ablauf: "Therapeuten erfassen Leistungen nach jeder Behandlung; Rechnungen entstehen aus den erfassten Leistungen.", pruefung: "Empfang prüft Leistungen gegen Verordnung vor Rechnungslauf" }),
    SV05: b({ stammdaten: "Preislisten für Privatleistungen, Heilmittelpositionen der Kassen, Patientenstammdaten.", wer: "Dr. Mia Kern" }),
    SV06: b({ uebergabe: "Monatlicher Export der Rechnungen und Zahlungen im DATEV-Format, Upload in DATEV Unternehmen online.", turnus: "monatlich bis zum 5." }),
    SV07: b({ ablauf: "Summe der Rechnungen laut Praxissoftware wird mit den Erlöskonten in der FiBu verglichen.", wer: "Tim Kern" }),
    SV08: b({ ablage: "Praxisserver mit täglicher Sicherung; jährlicher Gesamtexport", auswertbar: "ja" }),
    SV09: b({ wer: "Rechnungen nach Druck nicht mehr änderbar, nur Storno; Stammdaten nur Inhaberin", protokolliert: "ja" }),
    SV10: u({ ablauf: "Wechsel von Altsoftware 2023; Lesbarkeit der Altdaten ist zu klären." }),
    SV90: b({ umfang: "Praxissoftware am Standort Musterhain.", ausgenommen: "Lohn, siehe Verfahrensdokumentation Lohn" }),
    SV91: b({ systeme: "Praxissoftware TheraPlan (fiktiv) auf dem Praxisserver; DATEV Unternehmen online.", schnittstellen: "Praxissoftware an DATEV: monatlicher Export (DATEV-Format), manueller Upload.", betrieb: "Lokal installiert" }),
    SV92: b({ kontrollen: k("vorsystem", [0, 1, 2, 3]), details: "Summenabstimmung monatlich durch Tim Kern. Schnittstellenprotokoll bei jedem Export. Änderungsprotokolle quartalsweise durch Dr. Mia Kern. Benutzerrechte jährlich." }),
    SV93: b({ arten: ["Z1 Nur-Lesezugriff im System", "Z3 Datenexport auf Datenträger"], format: "CSV und DATEV-Format", getestet: "nein" }),
    SV94: b({ freigabe: "Dr. Mia Kern", doku: "Updates spielt der Dienstleister nach Freigabe ein; Updateprotokolle im Ordner IT.", protokoll: "ja" }),
    SV95: b({ notbetrieb: "Bei Serverausfall Leistungserfassung auf Papierliste je Therapeut, Nacherfassung nach Wiederanlauf.", nacherfassung: "Papierlisten werden aufbewahrt." }),
    SV96: b({ ort: "Praxisserver, Sicherung auf externem Datenträger", form: "Originaldaten in der Datenbank, jährlicher Export", loeschung: "Dr. Mia Kern" }),
  },
);

export const BEREICH_MUSTER: BereichMuster[] = [
  KASSE_MUSTER,
  WAWI_MUSTER,
  EINKAUF_MUSTER,
  VERKAUF_MUSTER,
  RETOUREN_MUSTER,
  ZEIT_MUSTER,
  LOHN_MUSTER,
  ECOMMERCE_MUSTER,
  BANK_MUSTER,
  ANLAGEN_MUSTER,
  VORSYSTEM_MUSTER,
];

export function bereichMuster(bereich: string): BereichMuster | undefined {
  return BEREICH_MUSTER.find((item) => item.bereich === bereich);
}

export const MUSTER_INDEX_PATH = "/muster";

export function musterPath(bereich: string): string {
  return `${MUSTER_INDEX_PATH}/${bereich}`;
}

export function musterPdfPath(bereich: string): string {
  return `${MUSTER_INDEX_PATH}/${bereich}/pdf`;
}

export function musterFragebogenPath(bereich: string): string {
  return `${MUSTER_INDEX_PATH}/${bereich}/fragebogen`;
}

function fileSlug(text: string): string {
  return text
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/Ä/g, "Ae")
    .replace(/Ö/g, "Oe")
    .replace(/Ü/g, "Ue")
    .replace(/ß/g, "ss")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function musterPdfFilename(bereich: string): string {
  return `Muster-${fileSlug(bereichDocTitle(bereich))}.pdf`;
}

export function musterFragebogenFilename(bereich: string): string {
  return `Muster-Fragebogen-${fileSlug(bereichById(bereich).label)}.pdf`;
}

/** Everything a Muster route needs, for every area including Belegfluss. */
export type MusterFall = {
  bereich: string;
  identity: CheckoutIdentity;
  answers: IntakeAnswers;
  documentId: string;
  version: number;
  versionMeta: VersionPdfMeta;
  versionHistory: VersionHistoryEntry[];
  steckbrief: string;
  facts: Array<[string, string]>;
};

export function musterFall(bereich: string, belegfluss: Omit<MusterFall, "bereich" | "facts" | "steckbrief"> & { facts: Array<[string, string]>; steckbrief: string }): MusterFall | undefined {
  if (bereich === "belegfluss") return { bereich, ...belegfluss };
  const item = bereichMuster(bereich);
  if (!item) return undefined;
  return {
    bereich,
    identity: item.identity,
    answers: item.answers,
    documentId: item.documentId,
    version: item.version,
    versionMeta: item.versionMeta,
    versionHistory: item.versionHistory,
    steckbrief: item.steckbrief,
    facts: [
      ["Unternehmen", item.firma.company],
      ["Branche", item.firma.branche],
      ["Rechtsform", item.firma.rechtsform],
      ["Mitarbeitende", item.firma.mitarbeitende],
      ["Geschäftsführung", item.firma.gf],
      ["Bereich", bereichById(bereich).label],
      ["Fassung", `2.0 gültig ab ${item.versionMeta.validFrom}, Vorversion 1.0`],
    ],
  };
}
