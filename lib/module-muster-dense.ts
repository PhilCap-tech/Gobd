/**
 * Dichte Muster- und Branchenvorlagen-Antworten (fiktiv).
 * Aufbewahrung § 147 AO: Bücher und Abschlüsse 10 Jahre, Buchungsbelege 8 Jahre, Handelsbriefe 6 Jahre;
 * GoBD-Rz. nur wo im Produkt bereits sicher verwendet (151–154).
 */
import { bereichMuster } from "@/lib/bereich-muster";
import { MODULE } from "@/lib/module/katalog";
import {
  AF01_ZUORDNUNG,
  ensureGesamt,
  setModulEintrag,
  setVorlage,
} from "@/lib/module/status";
import type { CheckAntwort, CheckKey } from "@/lib/module/typen";
import type { IntakeAnswers } from "@/lib/types";
import { emptyAnswers } from "@/lib/types";

type Entry = NonNullable<IntakeAnswers["katalog"]>[string];
const b = (values: Record<string, unknown> = {}): Entry => ({ status: "bestaetigt", values });
const u = (values: Record<string, unknown> = {}): Entry => ({ status: "unbekannt", values });

export type DenseFirma = {
  company: string;
  standort: string;
  branche: string;
  rechtsform: string;
  mitarbeitende: string;
  gf: string;
  buchhaltung: string;
  it: string;
  kanzlei: string;
  /** Für Beispiel-E-Mail-Adressen in Texten. */
  domain: string;
};

export type MusterDenseId = "dienstleister" | "handel" | "ecommerce" | "gastro" | "handwerk";

export const MUSTER_FIRMEN: Record<MusterDenseId, DenseFirma> = {
  dienstleister: {
    company: "Nordlicht Beratung GmbH (Muster, fiktiv)",
    standort: "Hamburg",
    branche: "B2B-Unternehmensberatung und Projektleistungen",
    rechtsform: "GmbH",
    mitarbeitende: "6–10",
    gf: "Lea Nordlicht",
    buchhaltung: "Tim Harms",
    it: "Externer IT-Dienstleister (Cloud & Rechte)",
    kanzlei: "Kanzlei Hafensteuer GmbH (fiktiv)",
    domain: "nordlicht-muster.invalid",
  },
  handel: {
    company: "Marktwege Handel GmbH (Muster, fiktiv)",
    standort: "Hannover",
    branche: "Einzel- und Großhandel mit Ladengeschäft und Lager",
    rechtsform: "GmbH",
    mitarbeitende: "11–25",
    gf: "Jonas Marktwege",
    buchhaltung: "Sara Linden",
    it: "IT-Betreuung Kassensystem und WaWi (fiktiv)",
    kanzlei: "Kanzlei Leinetal GmbH (fiktiv)",
    domain: "marktwege-muster.invalid",
  },
  ecommerce: {
    company: "Paketpfad Online GmbH (Muster, fiktiv)",
    standort: "Leipzig",
    branche: "E-Commerce über eigenen Shop und Marktplätze",
    rechtsform: "GmbH",
    mitarbeitende: "6–10",
    gf: "Mira Paketpfad",
    buchhaltung: "Nils Strom",
    it: "Shop- und Marktplatz-Technik (extern, fiktiv)",
    kanzlei: "Kanzlei Elsterbogen GmbH (fiktiv)",
    domain: "paketpfad-muster.invalid",
  },
  gastro: {
    company: "Speicherblick Gastro GmbH (Muster, fiktiv)",
    standort: "Bremen",
    branche: "Restaurant mit Tagesgeschäft und Veranstaltungen",
    rechtsform: "GmbH",
    mitarbeitende: "11–25",
    gf: "Paula Speicherblick",
    buchhaltung: "Keno Bruns",
    it: "Kassenhändler und Küchen-IT (fiktiv)",
    kanzlei: "Kanzlei Weserbogen GmbH (fiktiv)",
    domain: "speicherblick-muster.invalid",
  },
  handwerk: {
    company: "Bauwerk Nord GmbH (Muster, fiktiv)",
    standort: "Oldenburg",
    branche: "Ausbau und Sanierung (Handwerk / Bau)",
    rechtsform: "GmbH",
    mitarbeitende: "11–25",
    gf: "Henrik Bauwerk",
    buchhaltung: "Silke Moor",
    it: "Projekt- und Büro-IT (extern, fiktiv)",
    kanzlei: "Kanzlei Dammstieg GmbH (fiktiv)",
    domain: "bauwerk-nord-muster.invalid",
  },
};

/** Bereichs-Muster, die in die jeweilige Branchenvorlage einfließen. */
export const VORLAGE_BEREICHE: Record<MusterDenseId, string[]> = {
  // Dienstleister: kein Bargeld/Lager/Shop — dafür Personal, Projekte, E-Rechnung, Kanzlei.
  dienstleister: ["verkauf", "einkauf", "bank", "anlagen", "lohn", "zeiterfassung"],
  handel: ["kasse", "warenwirtschaft", "einkauf", "verkauf", "bank", "retouren", "lohn", "zeiterfassung"],
  ecommerce: ["ecommerce", "retouren", "warenwirtschaft", "bank", "verkauf", "einkauf"],
  // Gastro: Kasse/TSE, Wareneinkauf/Lager, Personal, Zahlungsdienstleister.
  gastro: ["kasse", "warenwirtschaft", "einkauf", "verkauf", "bank", "lohn", "zeiterfassung"],
  // Handwerk/Bau: Projekte, Abschläge, Material, Anlagen, Personal — ohne Ladenkasse.
  handwerk: ["verkauf", "einkauf", "bank", "anlagen", "lohn", "zeiterfassung", "warenwirtschaft"],
};

/** Betriebs-Check für Muster: klar ja/nein, damit das PDF keine „unbekannt“-Löcher hat. */
export const MUSTER_CHECK: Record<MusterDenseId, Partial<Record<CheckKey, CheckAntwort>>> = {
  dienstleister: {
    bargeld: "nein", lager: "nein", personal: "ja", zeiterfassung: "ja", online: "nein",
    retouren: "nein", papier: "ja", erechnung: "ja", anlagen: "ja", kanzlei: "ja",
    branche: "nein", zahlungsdienstleister: "ja",
  },
  handel: {
    bargeld: "ja", lager: "ja", personal: "ja", zeiterfassung: "ja", online: "nein",
    retouren: "ja", papier: "ja", erechnung: "ja", anlagen: "nein", kanzlei: "ja",
    branche: "nein", zahlungsdienstleister: "ja",
  },
  ecommerce: {
    bargeld: "nein", lager: "ja", personal: "nein", zeiterfassung: "nein", online: "ja",
    retouren: "ja", papier: "nein", erechnung: "ja", anlagen: "nein", kanzlei: "ja",
    branche: "nein", zahlungsdienstleister: "ja",
  },
  gastro: {
    bargeld: "ja", lager: "ja", personal: "ja", zeiterfassung: "ja", online: "nein",
    retouren: "nein", papier: "ja", erechnung: "ja", anlagen: "nein", kanzlei: "ja",
    branche: "ja", zahlungsdienstleister: "ja",
  },
  handwerk: {
    bargeld: "nein", lager: "ja", personal: "ja", zeiterfassung: "ja", online: "nein",
    retouren: "nein", papier: "ja", erechnung: "ja", anlagen: "ja", kanzlei: "ja",
    branche: "ja", zahlungsdienstleister: "ja",
  },
};

function fill(template: string, f: DenseFirma): string {
  return template
    .replaceAll("{company}", f.company)
    .replaceAll("{standort}", f.standort)
    .replaceAll("{branche}", f.branche)
    .replaceAll("{gf}", f.gf)
    .replaceAll("{buchhaltung}", f.buchhaltung)
    .replaceAll("{it}", f.it)
    .replaceAll("{kanzlei}", f.kanzlei)
    .replaceAll("{company_domain}", f.domain);
}

function fillValues(values: Record<string, unknown>, f: DenseFirma, vorlage: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(values)) {
    if (value === "__KUNDEN__") {
      out[key] =
        vorlage === "dienstleister" || vorlage === "handwerk"
          ? vorlage === "handwerk"
            ? ["Geschäftskunden (B2B)", "Privatkunden (B2C)"]
            : ["Geschäftskunden (B2B)"]
          : vorlage === "ecommerce"
            ? ["Privatkunden (B2C)"]
            : ["Privatkunden (B2C)", "Geschäftskunden (B2B)"];
    } else if (value === "__BRANCHE_ART__") {
      out[key] =
        vorlage === "gastro"
          ? ["Gastronomie / Hotel"]
          : vorlage === "handwerk"
            ? ["Handwerk / Bau"]
            : vorlage === "handel"
              ? ["Handel"]
              : vorlage === "ecommerce"
                ? ["E-Commerce"]
                : ["Dienstleistung"];
    } else if (typeof value === "string") {
      out[key] = fill(value, f);
    } else if (Array.isArray(value)) {
      out[key] = value.map((item) => (typeof item === "string" ? fill(item, f) : item));
    } else if (value && typeof value === "object") {
      out[key] = fillValues(value as Record<string, unknown>, f, vorlage);
    } else {
      out[key] = value;
    }
  }
  return out;
}

const OWN_TEMPLATES: Record<string, Record<string, unknown>> = {
  UO01: { gesellschaften: "{company}, einzige Gesellschaft ohne Tochterunternehmen.", standorte: "Hauptsitz {standort}. Keine weiteren Betriebsstätten." },
  UO02: { taetigkeiten: "{branche}. Steuerrelevante Vorgänge: Aufträge bzw. Verkäufe, Eingangs- und Ausgangsrechnungen, Zahlungen, ggf. Warenbewegungen.", kunden: "__KUNDEN__" },
  UO03: { zustaendigkeiten: "Geschäftsführung und Gesamtverantwortung: {gf}. Interne Buchhaltung und Belegwesen: {buchhaltung}. IT und Benutzerrechte: {it}. Steuerliche Beratung und Abschluss: {kanzlei}. Diese Verfahrensdokumentation: {gf}.", organigramm: "ja" },
  UO04: { vertretung: "Bei Abwesenheit von {gf} übernimmt {buchhaltung} die laufende Belegprüfung und Zahlungsvorbereitung. Verträge und Freigaben über 2.000 Euro bleiben bei {gf}.", schriftlich: "ja" },
  UO05: { befugnisse: "Vertragsabschluss und Ausgangsrechnungen: {gf}. Zahlungsfreigabe bis 2.000 Euro: {buchhaltung}; darüber Vier-Augen mit {gf}. Stammdaten in FiBu und Archiv: {buchhaltung}." },
  UO06: { geltung: "Diese Fassung gilt ab 01.07.2026 für den gesamten Betrieb am Standort {standort}.", ausgenommen: "Keine Bereiche ausgenommen; ältere Fassungen bleiben im Kundenkonto abrufbar." },
  LE01: { ablauf: "Auftragsänderungen nur schriftlich (E-Mail) und mit neuer Auftragsversion. Storno vor Lieferung durch {gf}.", wer: "{gf}" },
  LE02: { nachweis: "Leistung wird durch Lieferschein, Abnahmeprotokoll oder Leistungsnachweis (Stunden/Projekt) dokumentiert.", ablage: "Ablage im DMS bzw. DATEV Unternehmen online. {buchhaltung} prüft die Vollständigkeit vor der Rechnung." },
  LE03: { ablauf: "Bei Projekten Abnahme per E-Mail oder Protokoll; bei Waren Lieferschein mit Empfangsbestätigung. Ablage in DATEV Unternehmen online und im Projektordner auf dem NAS.", protokoll: "ja" },
  LE04: { ablauf: "Wiederkehrende Leistungen aus Wartung, Miete oder Rahmenvertrag rechnet {buchhaltung} zum vereinbarten Termin ab." },
  LE05: { ablauf: "Nach Leistungserbringung bzw. Lieferung erstellt {buchhaltung} die Rechnung. Laufend, spätestens 14 Tage nach Leistung. {buchhaltung} gleicht erbrachte Leistungen mit den Rechnungen ab.", wer: "{buchhaltung}" },
  LE92: { kontrollen: ["Abstimmung offene Aufträge mit Rechnungen", "Stichprobe Leistungsnachweis vor Rechnung"], details: "Monatlich prüft {buchhaltung} offene Aufträge ohne Rechnung. Stichprobe Leistungsnachweise vor Rechnungsversand durch {gf}." },
  AR00: { verantwortlich: "{buchhaltung}", vertretung: "{gf}" },
  AR01: { ablauf: "Abschlags- und Schlussrechnungen bei Projekten; Schlussrechnung stellt den Gesamtbezug her." },
  AR02: { art: ["Korrektur / Rechnungsminderung"], bezeichnung: "Gutschrift, mit eigener Nummer und Verweis auf die Ursprungsrechnung" },
  AR03: { ablauf: "Stornos mit eigener Nummer und Verweis auf die Ursprungsrechnung. Berichtigungen nur über Neurechnung, nie durch Überschreiben.", freigabe: "{buchhaltung} nach Freigabe {gf}" },
  AR04: { ort: "Archiv der Rechnungssoftware bzw. DATEV", format: "PDF und strukturierte Rechnungsdatei" },
  AR92: { kontrollen: ["Nummernkreis lückenlos", "Abstimmung Ausgangsrechnungen mit FiBu"], details: "Monatlich Nummernkreis und Summenabstimmung Ausgang gegen Erlöskonten durch {buchhaltung}." },
  ER00: { verantwortlich: "{buchhaltung}", vertretung: "{gf}" },
  ER01: { postfach: "E-Rechnungen und elektronische PDFs gehen am Funktionspostfach ein; XRechnungen über den vorgesehenen Eingangskanal der Rechnungssoftware. Formate: PDF, ZUGFeRD, XRechnung." },
  ER02: { viewer: "Technische Prüfung (Schema/Validierung) in der Rechnungssoftware; fachliche Prüfung durch {buchhaltung}.", validierung: "ja" },
  ER03: { format: ["XRechnung", "ZUGFeRD"], system: "Ausgangs-E-Rechnungen erzeugt die Rechnungssoftware; Versand als PDF per E-Mail und zusätzlich als E-Rechnung, soweit vom Kunden gefordert." },
  ER04: { ablauf: "Strukturierte Daten und Sichtbeleg (PDF) im Archiv (DATEV / DMS) mit Beleg-ID. Das Original bleibt unverändert.", unveraendert: "ja" },
  ER05: { ablauf: "PDF-Rechnungen, E-Mails mit Belegfunktion und heruntergeladene Belege werden mit Beleg-ID im Archiv abgelegt." },
  ER06: { konvertierung: "nein", original: "Das empfangene Original bleibt unverändert gespeichert." },
  ER92: { kontrollen: ["Validierung E-Rechnung", "Vollständigkeit Eingangsjournal"], details: "Tägliche Sichtung Eingangsjournal; monatliche Stichprobe Validierungsprotokolle durch {buchhaltung}." },
  PB00: { verantwortlich: "{buchhaltung}", vertretung: "{gf}" },
  PB01: { geraet: "Büroscanner (fiktiv)", ablauf: "Papierpost wird zentral geöffnet, mit Eingangsstempel versehen und noch am selben Tag gescannt. Zuständig: {buchhaltung}." },
  PB02: { wer: "{buchhaltung}", kriterien: "Scan in 300 dpi PDF/A; Qualitätskontrolle (Lesbarkeit, Vollständigkeit) vor Übergabe ins Archiv." },
  PB03: { ablauf: "Scan wird mit Beleg-ID in DATEV Unternehmen online abgelegt und der Kanzlei bereitgestellt. Laufend." },
  PB04: { ort: "Solange Papier aufbewahrt wird: Ordner Eingangsbelege im Büro, geordnet nach Monat.", dauer: "bis zur Freigabe der Vernichtung, längstens bis Fristende nach § 147 AO" },
  PB05: { vernichtung: "ja", regel: "Vernichtung nach Checkliste (Frist, keine Betriebsprüfung angekündigt, digitale Lesbarkeit geprüft) durch {buchhaltung} mit Protokoll. Freigabe: {gf}." },
  PB06: { ablauf: "Belege unterwegs werden mit dem Smartphone erfasst. Das Papier bleibt, bis die Aufnahme geprüft und im Archiv abgelegt ist." },
  PB92: { kontrollen: ["Scan-Qualitätskontrolle", "Eingangsstempel und Vollständigkeit"], details: "Jeder Scan wird vor Archivierung geprüft; monatliche Stichprobe Papier zu Digital durch {gf}." },
  ZD01: { anbieter: "Kreditkarte / Online-Zahlungsdienstleister (fiktiv) und SEPA-Lastschrift über die Hausbank. Kundenzahlungen und ggf. Marktplatz-Auszahlungen." },
  ZD02: { ablauf: "Täglicher oder wöchentlicher Abgleich Auszahlungsreport gegen Bank und offene Posten durch {buchhaltung}. Gebühren werden anhand des Reports kontiert." },
  ZD03: { ablauf: "Chargebacks und Rückgaben werden mit Ursprungsbeleg verknüpft und der Forderung nachgeführt.", freigabe: "{buchhaltung}" },
  ZD04: {
    ablauf: "Zahlungseingänge und -ausgänge werden über den Bankabruf den offenen Posten zugeordnet; nicht zuordenbare Zahlungen und Differenzen klärt {buchhaltung}, bei Kundenzahlungen mit Rückfrage beim Kunden. Ungeklärte Posten werden bis zur Klärung als offener Punkt geführt.",
    turnus: "wöchentlich, zusätzlich zum Monatsabschluss",
  },
  BU00: { verantwortlich: "{buchhaltung}", vertretung: "{gf}" },
  BU01: { wer: "{buchhaltung}", regeln: "Interne Vorkontierung in DATEV Unternehmen online; endgültige Buchung durch {kanzlei}. DATEV-Kontenrahmen." },
  BU02: { rhythmus: "zum Periodenabschluss", festschreibung: "Festschreibung nach Abstimmung mit der Kanzlei zum Periodenabschluss; danach nur noch Storno- und Korrekturbuchungen. Freigabe: {kanzlei} nach Freigabe {gf}." },
  BU03: { ablauf: "Korrekturen über Stornobuchung mit Begründung und Verweis; keine Überschreibung festgeschriebener Sätze. Protokoll wird geführt.", freigabe: "{buchhaltung}" },
  BU04: { abstimmungen: ["Bank", "Offene Posten Debitoren", "Offene Posten Kreditoren", "Umsatzsteuer"], turnus: "Monatlich: Bank, Debitoren, Kreditoren, Steuern. Quartalsweise Anlagen und Rückstellungen mit der Kanzlei. {buchhaltung} und {kanzlei}." },
  BU06: { arbeiten: "Jahresabschluss erstellt die Kanzlei; Unterlagenübergabe nach Checkliste bis Ende Februar für das Vorjahr. Übergabe über DATEV und ergänzende Excel/PDF-Listen." },
  BU05: {
    erstellt: "Die Kanzlei erstellt die Umsatzsteuer-Voranmeldung monatlich",
    prueft: "{buchhaltung} prüft die Auswertung vor Übermittlung, {gf} gibt frei",
    rhythmus: "monatlich",
  },
  BU07: {
    ablauf: "Belege laufend über DATEV Unternehmen online, Bankdaten automatisch; Monatsunterlagen bis zum 10. des Folgemonats; Nachweis über das Upload-Protokoll in DATEV",
    nachweis: "Upload-Protokoll in DATEV",
  },
  BU92: { kontrollen: ["Monatsabschluss-Abstimmung", "Belegvollständigkeit"], details: "Checkliste Monatsabschluss durch {buchhaltung}; Freigabe durch {gf}." },
  BS00: { verantwortlich: "{gf}", vertretung: "{buchhaltung}" },
  BS01: { art: "__BRANCHE_ART__", vorgaenge: "Branchentypische Vorgänge mit steuerlicher Bedeutung werden im Vorsystem erfasst und an die FiBu übergeben." },
  BS02: { systeme: "Branchensoftware bzw. Gerät laut Modul Vorsystem (fiktiv); Schnittstelle zu DATEV." },
  BS03: { ablauf: "Grunddaten erfasst fachlich geschultes Personal; Änderungen an Preisen/Stammdaten nur mit Freigabe {gf}." },
  BS04: { nachweise: "Je Vorgang die branchentypischen Nachweise (z. B. Projektnachweis, Leistungsdokumentation) werden mit dem Beleg verknüpft." },
  BS06: { regeln: "Keine besonderen Regeln über die allgemeinen umsatzsteuerlichen Pflichten hinaus." },
  BS07: { weg: "Periodischer Export an DATEV Unternehmen online.", turnus: "Monatlich." },
  BS08: { ablage: "Daten und Nachweise der Branchensoftware liegen im System und als Export auf dem NAS.", auswertbar: "ja" },
  BS92: { kontrollen: ["Summenabstimmung Vorsystem/FiBu", "Rechteprüfung"], details: "Summen des Vorsystems gegen FiBu-Erlöse bzw. Bestände durch {buchhaltung}. Monatliche Abstimmung; jährliche Rechteprüfung." },
  AW01: { elektronisch: "DATEV Unternehmen online (Belege und Buchungen); NAS im Büro (ergänzende Unterlagen und Exports); ggf. Anbieter-Cloud der Vorsysteme. Je Belegweg ist festgelegt, welche Datei als Original gilt (siehe Modul 5/6 und Systemdokumentation)." },
  AW02: { merkmale: "Beleg-ID, Rechnungsnummer, Datum, Kreditor/Debitor, Betrag, Periodenbezug. Über die Suche in DATEV und Dateinamenkonvention JJJJ-MM_BelegID auf dem NAS." },
  AW03: { ablauf: "Buchungssatz, Beleg-ID und ggf. Vorgangsnummer im Vorsystem sind verbunden. Zuständig: {buchhaltung}." },
  AW04: { ablauf: "PDF/A bzw. Originalformat der E-Rechnung; jährliche Stichprobe der Lesbarkeit durch {buchhaltung}. Formate: PDF/A, XML (XRechnung), CSV-Exporte." },
  AW05: { massnahmen: ["Schreibschutz / Unveränderbarkeit im Archiv", "Versionierung mit Protokoll"], details: "Keine Überschreibung archivierter Belege; Änderungen nur durch neue Version mit Protokoll." },
  AW06: { ablauf: "E-Mails mit Rechnung, Bestellung oder Auftragsänderung werden mit Anhang im Archiv abgelegt." },
  AW92: { kontrollen: ["Stichprobe Wiederauffindbarkeit", "Lesbarkeitsprüfung"], details: "Quartalsweise zehn Belege stichprobenartig suchen und öffnen." },
  AF01: { ablauf: AF01_ZUORDNUNG },
  AF02: { pruefung: "Hemmung bei laufender Betriebsprüfung oder Rechtsbehelfsverfahren; Hinweis der Kanzlei wird beachtet. {kanzlei} / {gf}." },
  AF03: { wer: "Löschung erst nach Fristende und schriftlicher Freigabe durch {gf}, Abstimmung mit {kanzlei}. Löschprotokoll mit Datum und Umfang." },
  AF04: { ablauf: "Technische Löschung durch {it} bzw. Anbieter nach Freigabe; Bestätigung wird abgelegt. Systeme: DATEV / NAS / Vorsysteme." },
  AF05: { ablauf: "Personenbezogene Daten mit kürzeren Fristen (z. B. Bewerbungen) nach eigener Liste; steuerliche Fristen haben Vorrang, soweit einschlägig." },
  SY01: { umgebung: "Rechnungssoftware, DATEV Unternehmen online, E-Mail und NAS. IT: {it}.", betrieb: "Gemischt" },
  SY05: { ablauf: "Eingeführte Programmstände werden mit Datum in der Systemliste festgehalten. {it} trägt den Stand nach einem Update ein." },
  SY06: { vorhanden: "ja", ort: "Systemliste im Ordner IT" },
  SY02: { schnittstellen: "Vorsystem → DATEV (Export/Upload). Bank → DATEV (MT940/API). E-Rechnungsein- und -ausgang über Rechnungssoftware. Dokumentiert: ja." },
  SY03: { ablauf: "Importe nur über definierte Formate; Konvertierungen werden protokolliert (Datum, Datei, Ziel). {buchhaltung} / {it}." },
  SY04: { vorhanden: "ja", beschreibung: "Wiederkehrende Exporte und Erinnerungen; keine unprotokollierte Änderung von Buchungsdaten durch Skripte. Freigabe: {gf}." },
  SY92: { kontrollen: ["Schnittstellenprotokoll", "Systemliste aktuell"], details: "Nach jedem Periodenexport Stichprobe; Systemliste jährlich." },
  ZR01: { rollen: "Geschäftsführung (voll), Buchhaltung (Belege, Exporte), Mitarbeitende (eingeschränkt), Kanzlei (lesen im Mandatsumfang), IT-Admin (technisch). {gf} beauftragt, {it} richtet ein." },
  ZR02: { antrag: "{gf} beantragt neue Zugänge", genehmigung: "{gf}; technische Einrichtung durch {it}" },
  ZR03: { ablauf: "Bei Austritt oder Rollenwechsel Entzug am letzten Arbeitstag; Checkliste Offboarding." },
  ZR04: { massnahmen: ["Persönliche Zugänge (keine Sammelkonten)", "Zwei-Faktor-Anmeldung", "Passwortregeln", "Bildschirmsperre"] },
  ZR05: { protokoll: "ja", auswertung: "{gf} bei Bedarf (z. B. Verdacht, Prüfung); Anbieterprotokolle zu Logins und kritischen Änderungen werden gesichert." },
  ZR92: { kontrollen: ["Jährliche Rechteprüfung", "Offboarding-Checkliste"], details: "Protokoll der Rechteprüfung im Ordner IT." },
  SN01: { konzept: "Anbieter-Backups der Cloud-Systeme; NAS mit täglicher Sicherung der lokalen Daten. Täglich (NAS), Anbieter gemäß Vertrag." },
  SN02: { szenarien: ["Systemausfall", "Internetausfall", "Stromausfall", "Ausfall oder Insolvenz eines Anbieters"] },
  SN03: { ablauf: "Bei Ausfall eines Vorsystems Noterfassung auf Papier/Liste und Nacherfassung nach Wiederanlauf am selben oder nächsten Werktag. Zuständig: {buchhaltung}." },
  SN04: { ablauf: "Nach Wiederanlauf Abgleich der nacherfassten Vorgänge mit den Systemnummernkreisen. Zuständig: {buchhaltung}." },
  SN05: { kontakte: "Kontakt: {gf} und {it}" },
  SN92: { kontrollen: ["Backup-Erfolgskontrolle", "Jährlicher Restore-Test"], details: "Wöchentlich Backup-Journal prüfen; Restore-Test mit Protokoll." },
  KF01: { kontrollen: "Vollständigkeit und Richtigkeit der Belege, Abstimmungen Bank/OP, Nummernkreise, Schnittstellen. {buchhaltung}." },
  KF02: { kontrollen: "Vier-Augen-Freigabe von Zahlungen und Storni, monatliche Plausibilitätsprüfung der Erlöse gegen den Vormonat, quartalsweise Stichprobe von zehn Buchungen gegen Beleg." },
  KF03: { ablauf: "Abweichungen werden in einer offenen Liste geführt (Datum, Sachverhalt, Maßnahme, erledigt am). Korrektur über Storno oder Neubuchung mit Beleg. Eskalation an {gf} bei Beträgen über 500 Euro oder wiederholten Fehlern.", wer: "{buchhaltung}" },
  KF04: { nachweis: "Abstimmungsprotokolle, Checklisten zum Monatsabschluss und Stichprobenlisten. Ablage im Ordner Kontrollen auf dem NAS / DATEV." },
  KF05: { wer: "{gf}", turnus: "Jährliche Durchsicht der Kontrollliste; Anpassung bei Prozessänderungen." },
  AU01: { dienstleister: "FiBu und Abschluss: {kanzlei}. IT/Cloud: Anbieter und {it}. Ggf. Lohnabrechnung durch Kanzlei oder Dienstleister. Fachliche Verantwortung und Belegqualität bleiben beim Unternehmen ({gf})." },
  AU02: { dienstleister: "IT- und Cloud-Anbieter mit AV-Vertrag. Speicherort EU/DE, soweit vertraglich zugesichert. Zuständig: {gf} und {it}." },
  AU03: { ablauf: "Belege und Auswertungen über DATEV Unternehmen online; ergänzende Listen per sicherer Übertragung. Laufend / monatlich." },
  AU04: { kontrolle: "Rücklauf der gebuchten Perioden prüfen; offene Klärungspunkte mit der Kanzlei abarbeiten. {buchhaltung}." },
  AU05: { grenzen: "Leistungsabgrenzung und Ansprechpartner in diesem Modul und in Modul 1 festgehalten. Fachliche Verantwortung bleibt beim Unternehmen ({gf}).", vertrag: "ja" },
  AU06: { zugriff: "Exporte und das Archiv bleiben im Unternehmen. Der Zugriff beim Dienstleister ist für die Aufbewahrungsfrist vorgesehen." },
  PZ00: { ansprechpartner: "{gf}", vertretung: "{buchhaltung}" },
  PZ01: { moeglich: "ja", systeme: "Nur-Lesezugriff in DATEV bzw. Vorsystemen nach Einrichtung durch {it} und {kanzlei}." },
  PZ02: { wer: "{buchhaltung} erstellt Auswertungen nach Vorgabe der Prüfer." },
  PZ03: { exporte: "DATEV-Export, CSV, PDF-Belege, ggf. DSFinV-K bei Kasse." },
  PZ04: { ablauf: "Ankündigung, Benennung der Ansprechperson ({gf}), Bereitstellung von Leserecht oder Export, Protokoll der übergebenen Daten. Im Rahmen der gesetzlichen Mitwirkung." },
  PZ05: { datum: "2026-03-15", ergebnis: "Ein Export wurde geöffnet und mit der Buchungsliste abgeglichen." },
  PZ06: { ablauf: "Frühere Fassungen der Verfahrensdokumentation und ältere Exporte bleiben auffindbar. Ablage: Kundenkonto und NAS-Archiv." },
  PZ07: { auswertungen: "Journal, Kontenblätter und Summen- und Saldenliste aus DATEV." },
  AE00: { verantwortlich: "{gf}", vertretung: "{it}" },
  AE01: { ablauf: "Neue Systeme nur nach Freigabe {gf}, mit Eintrag in der Systemliste und Anpassung dieser Dokumentation." },
  AE02: { ablauf: "Updates der Cloud-Anbieter nach deren Release; kritische FiBu-/Kassen-Updates werden vorher getestet und freigegeben. Die Freigabe wird protokolliert." },
  AE03: { ablauf: "Datenmigrationen mit Abgleich vorher/nachher und Archivierung der Altdaten bis Fristende. {it} / {buchhaltung}." },
  AE04: { wer: "{buchhaltung} ändert, {gf} gibt frei", protokoll: "ja" },
  AE05: { ablauf: "Ablaufänderungen werden in der nächsten Fassung der Verfahrensdokumentation nachgezogen (Änderungsverzeichnis), innerhalb von 4 Wochen nach Wirksamkeit." },
  AE06: { ablauf: "Frühere Fassungen bleiben versioniert im Kundenkonto downloadbar. Ort: gobd-doku-erstellen.de Konto." },
  AE92: { kontrollen: ["Änderungsverzeichnis gepflegt", "Systemliste nach Änderung aktualisiert"], details: "Prüfung bei jeder neuen Fassung." },
  PF01: { turnus: "jährlich", wer: "{gf} mit {buchhaltung}. Jährliche Durchsicht aller aktiven Module und nach wesentlichen Prozess- oder Systemänderungen." },
  PF02: { ablauf: "{buchhaltung} meldet geänderte Abläufe an {gf}. {it} meldet Systemänderungen." },
  PF03: { ablauf: "Inhaltliche Freigabe der geänderten Kapitel durch {gf} vor Inkrafttreten, mit dem Gültig-ab der Fassung. Betriebliche Bestätigung der Ist-Beschreibung durch {gf}." },
  C01: { kanaele: ["E-Mail-PDF", "E-Rechnung"], postfach: "rechnungen@{company_domain}" },
  C02: { ablauf: "Tägliche Sichtung des Funktionspostfachs durch {buchhaltung}; Weiterleitung an Prüfung.", wer: "{buchhaltung}", turnus: "täglich" },
  C03: { papier: "ja", annahme: "Zentrale Postannahme, Scan am selben Tag" },
  D01: { scan: "ja", zweck: "Ersetzung der Papierablage nach Qualitätskontrolle", aufbewahrung: "Papier bis Vernichtungsfreigabe" },
  E01: { formate: ["PDF", "ZUGFeRD", "XRechnung"] },
  E02: { ablauf: "Validierung und fachliche Prüfung vor Buchungsübergabe" },
  E03: { pruefung: "sachlich und rechnerisch durch {buchhaltung}", kriterien: "Leistung, Preis, USt, Kreditor" },
  E05: { erstellung: "Rechnungssoftware", versand: "E-Mail/E-Rechnung" },
  F01: { buchhaltung: "{buchhaltung}", ort: "intern mit Übergabe an Kanzlei" },
  F02: { abschluss: "durch {kanzlei}", unterlagen: "DATEV und ergänzende Listen" },
  F05: { kanzleiName: "{kanzlei}", leistungen: "FiBu, USt, Abschluss" },
  G01: { ablage: "DATEV Unternehmen online und NAS", ordnung: "Beleg-ID, Periodenordner" },
  G02: { zugriffKurz: "GF, Buchhaltung, Kanzlei lesen", berechtigungslisteVorhanden: "ja" },
  G05: { rolleFristen: "{gf}", verfahren: "Löschung nach Frist und Freigabe; Hemmungen mit Kanzlei klären. Aufbewahrung Buchungsbelege 8 Jahre (§ 147 Abs. 3 AO)." },
  G06: { sicherung: ["Anbieter sichert", "NAS täglich"], wiederherstellungGetestet: "ja" },
  H01: { kontrollen: [{"name": "Monatsabschluss-Abstimmung", "turnusWahl": "monatlich", "turnus": "monatlich", "wer": "{buchhaltung}", "nachweis": "Checkliste"}] },
  H04: { notfall: "Notbetrieb und Nacherfassung laut Modul 19" },
  I01: { pflege: "{gf}", turnus: "jährlich und bei Änderungen" },
  I02: { bestaetigung: "{gf}" },
  I05: { gueltigAb: "2026-07-01", speicherortHistorie: "Kundenkonto gobd-doku-erstellen.de" },
};


/** Allgemeiner Katalogteil (A/B/G/H/I) in Muster-Tiefe. */
function allgemeinKatalog(f: DenseFirma): Record<string, Entry> {
  return {
    A01: b({
      company: f.company,
      standort: f.standort,
      branchen: [f.branche],
      rechtsform: f.rechtsform,
      mitarbeitende: f.mitarbeitende,
      gf: f.gf,
    }),
    A03: b({
      kasse: "unbekannt",
      shop: "unbekannt",
      lager: "unbekannt",
      lohn: "unbekannt",
      plattformen: "unbekannt",
    }),
    A04: b({ gueltigAb: "2026-07-01", keineRueckdatierungBestaetigt: true }),
    B01: b({
      systeme: [
        {
          name: "DATEV Unternehmen online",
          funktion: "FiBu der Kanzlei und Belegablage",
          typ: "fibu",
          nutzer: `${f.buchhaltung} und Kanzlei`,
          originalOrt: "DATEV Unternehmen online",
          hostingArt: "Anbieter-Cloud",
          belegeRein: [],
          uebergabe: "laufend",
        },
        {
          name: "Rechnungssoftware (fiktiv)",
          funktion: "Ausgangsrechnungen und E-Rechnung",
          typ: "sonstiges",
          nutzer: f.buchhaltung,
          originalOrt: "Rechnungssoftware-Archiv",
          hostingArt: "Anbieter-Cloud",
          belegeRein: [],
          uebergabe: "Export an DATEV",
        },
        {
          name: "NAS im Büro",
          funktion: "Dateiablage und lokale Sicherung",
          typ: "archiv",
          nutzer: `${f.gf} und ${f.buchhaltung}`,
          originalOrt: "NAS",
          hostingArt: "Lokal",
          belegeRein: [],
          uebergabe: "",
        },
      ],
      hosting: "Gemischt: Cloud-Anbieter (DATEV, Rechnungssoftware) und lokales NAS",
      it: f.it,
    }),
    B04: b({
      originalJeWeg: [
        { belegweg: "E-Mail-PDF / E-Rechnung", originalBeschreibung: "Datei im Archiv (DATEV / Rechnungssoftware)" },
        { belegweg: "Ausgangsrechnung", originalBeschreibung: "Strukturierte Datei bzw. PDF in der Rechnungssoftware" },
      ],
    }),
    B05: b({
      externeSysteme: [
        { name: "DATEV Unternehmen online", unterlagenVorhanden: "ja" },
        { name: f.kanzlei, unterlagenVorhanden: "ja" },
      ],
    }),
    G01: b({
      ablageJeArt: [
        { art: "Eingangs- und Ausgangsbelege", ort: "DATEV Unternehmen online", suche: "Beleg-ID, Kreditor/Debitor, Datum" },
        { art: "Ergänzende Unterlagen und Exporte", ort: "NAS im Büro", suche: "JJJJ-MM und Thema" },
      ],
      ablage: "DATEV Unternehmen online; NAS für Exporte",
      ordnung: "Beleg-ID und Periodenbezug",
    }),
    G02: b({
      zugriffRollen: [
        { rolle: "Geschäftsführung", rechte: ["lesen", "freigeben"] },
        { rolle: "Buchhaltung", rechte: ["lesen", "ändern", "exportieren"] },
        { rolle: "Kanzlei", rechte: ["lesen"] },
      ],
      zugriffKurz: `${f.gf}, ${f.buchhaltung}, ${f.kanzlei} (lesen)`,
      berechtigungslisteVorhanden: "ja",
    }),
    G05: b({
      rolleFristen: f.gf,
      verfahren:
        "Löschung erst nach Fristende und Freigabe durch die Geschäftsführung; Ablaufhemmungen klärt die Kanzlei. Buchungsbelege 8 Jahre, Handels- und Geschäftsbriefe 6 Jahre (§ 147 Abs. 1, 3 AO).",
    }),
    G06: b({
      sicherung: ["Anbieter sichert", "NAS täglich"],
      backupArten: "Cloud-Anbieter gemäß Vertrag; NAS mit täglicher Sicherung",
      wiederherstellungGetestet: "ja",
    }),
    H01: b({
      kontrollen: [
        {
          name: "Monatsabschluss-Abstimmung Bank und OP",
          turnusWahl: "monatlich",
          turnus: "monatlich",
          wer: f.buchhaltung,
          nachweis: "Abstimmungscheckliste",
        },
      ],
    }),
    H04: b({ notfall: "Notbetrieb und Nacherfassung nach Modul 19; Eskalation an die Geschäftsführung." }),
    I01: b({ pflege: f.gf, turnus: "jährlich und bei wesentlichen Änderungen" }),
    I02: b({ bestaetigung: f.gf, form: "Betriebliche Bestätigung im Fragebogen" }),
    I04: u({}),
    I05: b({
      gueltigAb: "2026-07-01",
      speicherortHistorie: "Kundenkonto gobd-doku-erstellen.de, Fassungen downloadbar",
    }),
  };
}

function mergeKatalog(...parts: Array<Record<string, Entry> | undefined>): Record<string, Entry> {
  const out: Record<string, Entry> = {};
  for (const part of parts) {
    if (!part) continue;
    for (const [id, entry] of Object.entries(part)) {
      const prev = out[id];
      if (!prev?.status || prev.status === "unbekannt") out[id] = entry;
      else if (entry.status === "bestaetigt" && prev.status !== "bestaetigt") out[id] = entry;
    }
  }
  return out;
}

function ownKatalog(f: DenseFirma, vorlage: string): Record<string, Entry> {
  const out: Record<string, Entry> = {};
  for (const [id, values] of Object.entries(OWN_TEMPLATES)) {
    out[id] = b(fillValues(values, f, vorlage));
  }
  // Bewusst offene Punkte für das Kapitel „Offene Punkte“
  out.I04 = u({});
  return out;
}

const BEREICH_PERSONEN: Record<string, { namen: string[]; standort: string; kassen?: string }> = {
  kasse: { namen: ["Clara Sonnenkorn", "Jonas Weber"], standort: "Musterstadt", kassen: "Beide Filialen (Hauptstraße und Bahnhof) mit allen drei Kassen" },
  warenwirtschaft: { namen: ["Martin Eichenblatt", "Sabine Krämer", "Tobias Lang"], standort: "Musterhausen" },
  einkauf: { namen: ["Eva Lindner", "Thomas Brück", "Murat Aydin"], standort: "Musterbach" },
  verkauf: { namen: ["Nora Klar", "Felix Hahn"], standort: "Musterfeld" },
  retouren: { namen: ["Kai Laufer", "Miriam Ost"], standort: "Musterlingen" },
  zeiterfassung: { namen: ["Sandra Linde", "Oliver Pfeiffer", "Ute Sommer"], standort: "Musterdorf" },
  lohn: { namen: ["Robert Funke", "Ines Wolf"], standort: "Musterberg" },
  ecommerce: { namen: ["Lea Bohn"], standort: "Musterau" },
  bank: { namen: ["Jana Hellweg", "Paul Richter", "Lukas Berger"], standort: "Musterstein" },
  anlagen: { namen: ["Hannes Papke", "Birgit Kranz"], standort: "Mustertal" },
  vorsystem: { namen: ["Dr. Mia Kern", "Mia Kern", "Tim Kern"], standort: "Musterhain" },
};

function angleichen(value: unknown, bereich: string, firma: DenseFirma): unknown {
  const alt = BEREICH_PERSONEN[bereich];
  if (!alt || typeof value !== "string") {
    if (Array.isArray(value)) return value.map((item) => angleichen(item, bereich, firma));
    if (value && typeof value === "object") {
      return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, angleichen(item, bereich, firma)]));
    }
    return value;
  }
  let text = value;
  if (alt.kassen) text = text.replaceAll(alt.kassen, `Alle Kassen am Standort ${firma.standort}`);
  text = text.replaceAll(alt.standort, firma.standort);
  text = text.replaceAll(`${alt.namen[0]} (Partnerin)`, firma.gf);
  text = text.replaceAll(`${alt.namen[0]} (Geschäftsführung)`, firma.gf);
  for (const [index, name] of alt.namen.entries()) {
    text = text.replaceAll(name, index === 0 ? firma.gf : firma.buchhaltung);
  }
  text = text.replaceAll(" (Partnerin)", "").replaceAll(" (Partner)", "");
  text = text.replaceAll("Partner: Einzelvollmacht", "Geschäftsführung: Einzelvollmacht");
  text = text.replaceAll("durch einen Partner", "durch die Geschäftsführung");
  text = text.replaceAll("Ein Partner, über 10.000 Euro beide Partner", "Die Geschäftsführung, über 10.000 Euro gemeinsam");
  return text;
}

function bereicheKatalog(vorlage: keyof typeof VORLAGE_BEREICHE): Record<string, Entry> {
  const firma = MUSTER_FIRMEN[vorlage];
  const out: Record<string, Entry> = {};
  for (const bereich of VORLAGE_BEREICHE[vorlage]) {
    const muster = bereichMuster(bereich);
    if (!muster) continue;
    for (const [id, entry] of Object.entries(muster.answers.katalog ?? {})) {
      if (/^(A|B|G|H|I)\d/.test(id)) continue;
      out[id] = {
        ...entry,
        values: entry.values ? (angleichen(entry.values, bereich, firma) as Record<string, unknown>) : entry.values,
        reason: entry.reason ? String(angleichen(entry.reason, bereich, firma)) : entry.reason,
      };
    }
  }
  return out;
}

/**
 * Vorgeschlagene Antworten einer Branchenvorlage für das Intake
 * (nur Werte; Status setzt der Kunde).
 */
export function vorlageVorschlaege(vorlageId: string): Record<string, Record<string, unknown>> {
  const firma = MUSTER_FIRMEN[vorlageId as MusterDenseId];
  if (!firma) return {};
  const dense = ownKatalog(firma, vorlageId);
  const out: Record<string, Record<string, unknown>> = {};
  for (const [id, entry] of Object.entries(dense)) {
    if (entry.values && Object.keys(entry.values).length) out[id] = entry.values;
  }
  // Stammdaten-nahe Katalogfelder
  out.A01 = {
    standort: firma.standort,
    branchen: [firma.branche],
    rechtsform: firma.rechtsform,
    mitarbeitende: firma.mitarbeitende,
    gf: firma.gf,
  };
  out.F05 = { kanzleiName: firma.kanzlei };
  out.B01 = { it: firma.it };
  out.F01 = { buchhaltung: firma.buchhaltung };
  return out;
}


/** Zusätzliche, längere Ist-Beschreibungen je Vorlage (Worttiefe). */
function firmaKorrektur(f: DenseFirma): Record<string, Entry> {
  return {
    BA02: b({
      vollmachten: `${f.gf}: Einzelvollmacht. ${f.buchhaltung}: Freigabe bis 2.000 Euro; darüber nur mit ${f.gf} (Vier-Augen).`,
      sperre: `Zugang wird am letzten Arbeitstag durch die Bank gesperrt, Auftrag durch ${f.gf}.`,
    }),
    EK02: b({
      wer: f.buchhaltung,
      grenzen: "Bestellungen bis 2.000 Euro durch die Buchhaltung; darüber Freigabe der Geschäftsführung",
      freigabe: f.gf,
    }),
    BA05: b({
      wer: `${f.buchhaltung} bis 2.000 Euro; darüber Vier-Augen mit ${f.gf}`,
      vierAugen: "ja",
      limit: "bis 2.000 Euro",
    }),
    LO04: b({
      weg: "Stunden und Zuschläge als Monatsexport aus der Zeiterfassungs-App, Abwesenheiten in derselben Liste, per DATEV Upload an die Kanzlei.",
      frist: "bis zum 18. des Monats",
    }),
  };
}

function einkaufSystem(vorlage: MusterDenseId): string {
  if (vorlage === "ecommerce" || vorlage === "handel") return "WaWi Lagerplus (fiktiv)";
  if (vorlage === "handwerk") return "Projektsoftware";
  if (vorlage === "gastro") return "Warenwirtschaft";
  return "Rechnungssoftware";
}

function bereinigeText(text: string, vorlage: MusterDenseId, f: DenseFirma): string {
  const system = einkaufSystem(vorlage);
  let next = text
    .replaceAll("Lagerleitung (Peter Holm)", "Lagerverantwortliche Person")
    .replaceAll("Einkauf (Lena Brandt)", "Einkauf")
    .replaceAll("Leitung Kundenservice (Anja Berg)", "Kundenservice")
    .replaceAll("Peter Holm", f.gf)
    .replaceAll("Lena Brandt", "Einkauf")
    .replaceAll("Anja Berg", "Kundenservice")
    .replaceAll("ERP Fertigplan (fiktiv)", system)
    .replaceAll("ERP Fertigplan", system)
    .replaceAll("Rohmaterial", vorlage === "ecommerce" ? "Handelsware" : "Material")
    .replaceAll("Faktura+", "Rechnungssoftware")
    .replaceAll("der Agentur", "des Betriebs");
  if (vorlage === "gastro" || vorlage === "handel" || vorlage === "ecommerce") {
    next = next
      .replaceAll("Projektleitung", "Buchhaltung")
      .replaceAll("Bei Projekten Abnahme per E-Mail oder Protokoll; ", "")
      .replaceAll("Abnahmeprotokoll oder ", "")
      .replaceAll("Abschlags- und Schlussrechnungen bei Projekten; ", "Rechnungen zu jeder Leistung; ")
      .replaceAll("im ERP", "im System")
      .replaceAll("ERP an DATEV", `${system} an DATEV`)
      .replaceAll("ERP-Ticketsystem", "Änderungsliste in der WaWi")
      .replaceAll("Lagerleitung", "Lagerverantwortliche Person")
      .replaceAll("Lagerpersonal", "Lagerverantwortliche Person");
  }
  if (vorlage === "ecommerce") {
    next = next
      .replaceAll("Halle A, Halle B, Freilager", "Ein Lager am Standort Leipzig")
      .replaceAll("Handscanner im Lager; ", "")
      .replaceAll("Handscanner an WaWi: Funk, sofort. ", "")
      .replaceAll("auf dem Firmenserver", "in der Cloud");
  }
  if (vorlage === "gastro") {
    next = next
      .replaceAll("Filialleitungs-", "Schichtleitungs-")
      .replaceAll("Filialleitung je Standort", "Schichtleitung")
      .replaceAll("Filialleitung", "Schichtleitung")
      .replaceAll("Halle A, Halle B, Freilager", "Kühlhaus, Trockenlager und Getränkelager")
      .replaceAll("Kommissionsware von Lieferanten (eigene Liste)", "Keine Kommissionsware.")
      .replaceAll("Handscanner im Lager; ", "")
      .replaceAll("Handscanner an WaWi: Funk, sofort. ", "");
  }
  if (vorlage === "handel") {
    next = next
      .replaceAll("Filialleitungs-", "Verkaufsleitungs-")
      .replaceAll("Filialleitung je Standort", "Verkaufsleitung")
      .replaceAll("Filialleitung", "Verkaufsleitung")
      .replaceAll("3 Kassen an 2 Standorten", "3 Kassen am Standort Hannover");
  }
  if (vorlage === "handwerk") {
    next = next
      .replaceAll("Halle A, Halle B, Freilager", "Ein Materiallager am Standort Oldenburg")
      .replaceAll("WaWi Lagerplus (fiktiv)", "Materialliste in der Projektsoftware")
      .replaceAll("WaWi Lagerplus", "Materialliste")
      .replaceAll("Handscanner im Lager; ", "")
      .replaceAll("Handscanner an WaWi: Funk, sofort. ", "")
      .replaceAll("Handscanner", "Projektsoftware");
  }
  return next;
}

function bereinigeWert(value: unknown, vorlage: MusterDenseId, f: DenseFirma): unknown {
  if (typeof value === "string") return bereinigeText(value, vorlage, f);
  if (Array.isArray(value)) return value.map((item) => bereinigeWert(item, vorlage, f));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, bereinigeWert(item, vorlage, f)]),
    );
  }
  return value;
}

function bereinigeKatalog(katalog: Record<string, Entry>, vorlage: MusterDenseId, f: DenseFirma): Record<string, Entry> {
  const out: Record<string, Entry> = {};
  for (const [id, entry] of Object.entries(katalog)) {
    out[id] = {
      ...entry,
      values: entry.values ? (bereinigeWert(entry.values, vorlage, f) as Record<string, unknown>) : entry.values,
      reason: entry.reason ? bereinigeText(entry.reason, vorlage, f) : entry.reason,
    };
  }
  return out;
}

function vorlageExtras(f: DenseFirma, vorlage: MusterDenseId): Record<string, Entry> {
  const baseDienst: Record<string, Entry> = {
    LE01: b({
      ablauf: `${f.gf} oder die Projektleitung hält Änderungen (Scope, Zeit, Honorar) schriftlich (E-Mail) und mit neuer Versionsnummer fest.`,
      wer: f.gf,
    }),
    LE02: b({
      nachweis: "Leistungsnachweis je Monat bzw. Meilenstein (Stundenübersicht oder Deliverable-Liste), Freigabe durch die Kundenansprechperson per E-Mail.",
      ablage: `Ablage unter Projektnummer in DATEV und auf dem NAS. ${f.buchhaltung} prüft die Vollständigkeit vor der Rechnung; fachlich ${f.gf}.`,
    }),
    LE05: b({
      ablauf: "Nach Leistungsnachweis erstellt die Buchhaltung die Rechnung in der Rechnungssoftware. Laufend, spätestens 14 Tage nach Meilenstein bzw. Monatsende.",
      wer: f.buchhaltung,
    }),
    AR01: b({
      ablauf: "Abschlagsrechnungen bei Mehrphasen-Projekten; Schlussrechnung stellt den Gesamtbezug her und listet bisherige Abschläge. Nummernkreis fortlaufend je Geschäftsjahr.",
    }),
    AR03: b({
      ablauf: "Stornos mit eigener Nummer und Verweis auf die Ursprungsrechnung. Berichtigungen nur über Neurechnung, nie durch Überschreiben.",
      freigabe: `${f.buchhaltung} nach Freigabe ${f.gf}`,
    }),
    BU06: b({
      arbeiten: `Jahresabschluss erstellt ${f.kanzlei}; Unterlagenübergabe nach Checkliste bis Ende Februar für das Vorjahr, inkl. OP-Listen, Anlagenbewegungen und offener Punkte. Übergabe über DATEV Unternehmen online und ergänzende PDF/CSV-Listen.`,
    }),
    PZ01: b({
      moeglich: "ja",
      systeme: "Nur-Lesezugriff in DATEV bzw. Vorsystemen nach Einrichtung durch IT und die Kanzlei.",
    }),
    LO00: b({ verantwortlich: f.buchhaltung, vertretung: f.gf }),
    ZE00: b({ verantwortlich: f.buchhaltung, vertretung: f.gf }),
  };

  if (vorlage === "dienstleister") {
    return {
      ...firmaKorrektur(f),
      ...baseDienst,
      UO01: b({
        gesellschaften: `${f.company}, einzige Gesellschaft ohne Tochterunternehmen.`,
        standorte: `Hauptsitz ${f.standort}. Homeoffice der Mitarbeitenden ohne eigene Betriebsstätte; keine Filialen.`,
      }),
      UO03: b({
        zustaendigkeiten: `Geschäftsführung und Gesamtverantwortung: ${f.gf}. Interne Buchhaltung und Belegwesen: ${f.buchhaltung}. IT und Benutzerrechte: ${f.it}. Steuerliche Beratung und Abschluss: ${f.kanzlei}. Projektleitung für Auftragsänderungen, Abnahme, Abschlagsrechnung und Schlussrechnung. Diese Verfahrensdokumentation: ${f.gf}.`,
        organigramm: "ja",
      }),
      VK92: b({
        kontrollen: ["Lückenprüfung der Rechnungsnummern", "Abgleich Projektzeiten mit Rechnungen", "OP-Liste"],
        details: `Lückenprüfung monatlich durch ${f.buchhaltung}. Abgleich erfasster Projektzeiten mit Rechnungen monatlich durch die Projektleitung. Vorlage mit Pflichtangaben laufend. OP-Liste gegen Debitorenkonten monatlich durch ${f.buchhaltung}. Storni nur mit Freigabe durch ${f.gf}.`,
      }),
      UO02: b({
        taetigkeiten: `${f.branche}. Typische Vorfälle: Projektaufträge, Zeit- und Leistungsnachweise, Eingangsrechnungen (Software, Reise, Freelancer), Ausgangsrechnungen inkl. Abschläge/Schluss, SEPA-Zahlungen, Lohn für angestellte Beraterinnen und Berater. Keine Ladenkasse, kein Warenlager, kein Onlineshop.`,
        kunden: ["Geschäftskunden (B2B)"],
      }),
      ER01: b({
        postfach: "E-Rechnungen und PDF-Rechnungen am Funktionspostfach; XRechnung über den Eingangskanal der Rechnungssoftware. Freelancer-Rechnungen werden wie Lieferantenrechnungen geprüft. Formate: PDF, ZUGFeRD, XRechnung.",
      }),
      PB01: b({
        ablauf: `Papierpost (selten) wird zentral geöffnet, mit Eingangsstempel versehen und noch am selben Tag gescannt. Reisebelege der Mitarbeitenden werden digital eingereicht. Zuständig: ${f.buchhaltung}.`,
      }),
      BU01: b({
        wer: f.buchhaltung,
        regeln: "Interne Vorkontierung in DATEV Unternehmen online mit Projekt- und Kostenstellenbezug; endgültige Buchung durch die Kanzlei. DATEV-Kontenrahmen mit Projektlogik.",
      }),
      BU04: b({
        abstimmungen: ["Bank", "Offene Posten Debitoren", "Offene Posten Kreditoren", "Umsatzsteuer"],
        turnus: `Monatlich: Bank, Debitoren, Kreditoren, USt. Quartalsweise Anlagen und Rückstellungen mit der Kanzlei. Projekt-OP gegen offene Abschläge. ${f.buchhaltung} und ${f.kanzlei}.`,
      }),
      AW01: b({
        elektronisch: "DATEV Unternehmen online (Belege und Buchungen); NAS (Projektunterlagen, Leistungsnachweise, Exporte); Zeiterfassungssystem (Originalzeiten). Je Belegweg ist festgelegt, welche Datei als Original gilt (E-Rechnung strukturiert, Scan nach Qualitätskontrolle, Ausgangsrechnung in der Rechnungssoftware).",
      }),
      AU01: b({
        dienstleister: `FiBu und Abschluss: ${f.kanzlei}. Lohnabrechnung: ${f.kanzlei}. IT/Cloud: Anbieter und ${f.it}. Fachliche Verantwortung und Belegqualität bleiben beim Unternehmen (${f.gf}). Keine Entscheidung über steuerliche Wahlrechte ohne Rückfrage an die Kanzlei.`,
      }),
      SY01: b({
        umgebung: `Rechnungssoftware, DATEV Unternehmen online, Zeiterfassung (fiktiv), E-Mail, NAS. Kein Kassensystem, keine Warenwirtschaft. IT: ${f.it}.`,
        betrieb: "Gemischt",
      }),
      KF01: b({
        kontrollen: `Vollständigkeit Leistungsnachweis vor Rechnung, Nummernkreise Ausgang, Bank/OP, Schnittstelle DATEV, Rechte Zeiterfassung. ${f.buchhaltung}.`,
      }),
    };
  }

  if (vorlage === "gastro") {
    return {
      ...firmaKorrektur(f),
      SY01: b({
        umgebung: `Kassensystem mit TSE, Warenwirtschaft, DATEV Unternehmen online, E-Mail und NAS. IT: ${f.it}.`,
        betrieb: "Gemischt",
      }),
      BS00: b({ verantwortlich: f.gf, vertretung: f.buchhaltung }),
      BS01: b({
        art: ["Gastronomie / Hotel"],
        vorgaenge: "Tagesgeschäft an der Theke/Kasse mit TSE, Wareneinkauf Küche, Inventur Kühlung/Lager, Personalzeiten und Trinkgeld, Kartenzahlungen und Tagesabschluss, Übergabe Kassendaten und Wareneinsatz an die FiBu.",
      }),
      BS02: b({
        systeme: "Elektronisches Kassensystem mit Cloud-TSE (fiktiv); ggf. Küchen-/Bestellmonitor; DATEV Unternehmen online; Zahlungsdienstleister für Karten.",
      }),
      BS03: b({
        ablauf: "Artikel und Preise pflegt die Geschäftsführung; Bedienerkennungen vergibt die Schichtleitung. Wareneingang Küche gegen Lieferschein; Inventur stichprobenartig wöchentlich und vollständig monatlich.",
      }),
      BS04: b({
        nachweise: "Z-Bons und Zählprotokolle, TSE-Signaturen, Wareneingangsscheine, Inventurlisten, Schichtpläne/Zeiten, Kartenzahlungsabrechnungen — jeweils mit Datum und Belegbezug.",
      }),
      BS05: b({ ablauf: "Der Tagesumsatz wird über den Z-Bon abgerechnet. Speisen und Getränke tragen die in der Kasse hinterlegten Steuersätze." }),
      BS06: b({ regeln: "Speisen vor Ort und Getränke werden in der Kasse mit den jeweils zutreffenden Steuersätzen erfasst; Kassenpflichten nach § 146a AO." }),
      BS07: b({ weg: "Monatlicher DATEV-Export aus dem Kassensystem sowie Wareneinsatzlisten; Upload in DATEV Unternehmen online.", turnus: "Monatlich bis zum 5." }),
      BS08: b({ ablage: "Z-Bons, Zählprotokolle und Exporte liegen im Kassensystem und werden monatlich nach DATEV übernommen.", auswertbar: "ja" }),
      BS92: b({
        kontrollen: ["Kassensturz", "Abgleich Z-Bon/Bank", "Wareneinsatz"],
        details: `Summen der Z-Bons und Kartenzahlungen gegen Bank und FiBu-Erlöse durch ${f.buchhaltung}. Täglicher Kassensturz durch die Schichtleitung.`,
      }),
      SV00: b({ verantwortlich: f.gf, vertretung: f.buchhaltung }),
      SV01: b({ name: "Kassensystem", zweck: "Verkauf, Tagesabschluss und Zahlarten", anbieter: "Kassenanbieter" }),
      SV02: b({ rollen: `${f.gf} und die Schichtleitung` }),
      SV03: b({ daten: "Umsätze, Zahlarten, Stornos und Tagesabschlüsse" }),
      SV04: b({ ablauf: "Der Verkauf wird an der Kasse erfasst.", pruefung: "Die Schichtleitung prüft den Tagesabschluss." }),
      SV05: b({ stammdaten: "Artikel und Preise", wer: f.gf }),
      SV06: b({ uebergabe: "Monatlicher Export nach DATEV", turnus: "monatlich" }),
      SV07: b({ ablauf: "Die Exportsumme wird mit dem Z-Bon abgeglichen.", wer: f.buchhaltung }),
      SV08: b({ ablage: "Kassensystem und DATEV", auswertbar: "ja" }),
      SV09: b({
        wer: "Abgeschlossene Tagesabschlüsse und Einzelaufzeichnungen können nicht geändert werden; Korrekturen nur als Storno mit Begründung, protokolliert in Kasse und TSE.",
        protokolliert: "ja",
      }),
      SV10: b({ ablauf: "Ein Systemwechsel ist nicht vorgesehen. Die vorhandenen Exporte bleiben im Archiv lesbar." }),
      UO03: b({
        zustaendigkeiten: `Geschäftsführung und Gesamtverantwortung: ${f.gf}. Interne Buchhaltung und Belegwesen: ${f.buchhaltung}. IT und Benutzerrechte: ${f.it}. Steuerliche Beratung und Abschluss: ${f.kanzlei}. Schichtleitung im Tagesgeschäft. Küchenchef für den Wareneingang. Diese Verfahrensdokumentation: ${f.gf}.`,
        organigramm: "ja",
      }),
      VK01: b({ ablauf: "Angebot für die Veranstaltung, Anzahlungsrechnung, Rechnung nach der Veranstaltung.", system: "Kassensystem und Rechnungssoftware" }),
      VK02: b({ system: "Rechnungssoftware", ablage: "Beim Veranstaltungsauftrag" }),
      VK05: b({ vergabe: "Automatisch fortlaufend in der Rechnungssoftware", kreise: "Ein Nummernkreis für Rechnungen, einer für Stornorechnungen" }),
      VK06: b({ ablauf: "Die Rechnungsvorlage enthält die Pflichtangaben; der Leistungszeitraum kommt aus der Veranstaltung.", wer: f.buchhaltung }),
      VK08: b({ ablauf: "Fehlerhafte Rechnungen werden storniert (Stornorechnung mit Bezug) und neu ausgestellt; kein Überschreiben.", freigabe: f.gf }),
      VK10: b({ uebergabe: "Rechnungen und Debitoren gehen per DATEV-Schnittstelle an DATEV Unternehmen online.", turnus: "monatlich" }),
      VK90: b({ umfang: "Tagesgeschäft an der Kasse und Veranstaltungen.", ausgenommen: "Kein Projektgeschäft." }),
      VK91: b({ systeme: "Kassensystem und DATEV Unternehmen online.", schnittstellen: "Monatlicher Export nach DATEV", betrieb: "Gemischt" }),
      VK92: b({
        kontrollen: ["Abgleich Veranstaltungsrechnungen", "OP-Liste"],
        details: `Abgleich der Veranstaltungs- und Catering-Rechnungen mit den Bankettbestellungen monatlich durch ${f.buchhaltung}; Freigabe Storni durch ${f.gf}. OP-Liste gegen Debitorenkonten monatlich durch ${f.buchhaltung}.`,
      }),
      LE02: b({ nachweis: "Lieferschein oder Auftragsbestätigung zur Veranstaltung.", ablage: `Ablage in DATEV Unternehmen online. ${f.buchhaltung} prüft die Vollständigkeit vor der Rechnung.` }),
      LE03: b({ ablauf: "Die Veranstaltung gilt mit der erbrachten Leistung und der Rechnung. Ablage in DATEV Unternehmen online.", protokoll: "ja" }),
      AR01: b({ ablauf: "Anzahlungsrechnung zur Veranstaltung; die Rechnung danach stellt den Gesamtbezug her." }),
      WW00: b({ verantwortlich: "Lagerverantwortliche Person", vertretung: f.buchhaltung }),
      WW01: b({ system: "Warenwirtschaft der Küche (fiktiv)", vorgaenge: "Wareneingang, Verbrauch, Inventur" }),
      WW02: b({ wer: "Küchenchef bzw. Schichtleitung", freigabe: f.gf, protokolliert: "ja" }),
      WW03: b({ ablauf: "Wareneingang wird gegen den Lieferschein geprüft und in der Warenwirtschaft gebucht.", wer: "Küchenchef bzw. Schichtleitung" }),
      WW04: b({ ablauf: "Verbrauch ergibt sich aus Kassenverkäufen und Inventurdifferenz; Personal- und Eigenverbrauch auf eigener Liste.", wer: "Schichtleitung" }),
      WW05: b({ fuehrung: "Bestand aus der Monatsinventur", bewertung: "bewertet zu Einkaufspreisen laut Rechnung." }),
      WW06: b({ lagerorte: "Kühlhaus, Trockenlager und Getränkelager am Standort Bremen", umlagerung: "Umlagerungen zwischen diesen Lagern werden in der Warenwirtschaft gebucht." }),
      WW07: b({ wer: "Küchenchef bzw. Schichtleitung", freigabe: f.gf, grund: "ja" }),
      WW08: b({ verfahren: "Inventur monatlich", wer: `Zählung Schichtleitung, Prüfung ${f.gf}`, stichtag: "monatlich", zaehllisten: "Zählliste als PDF auf dem NAS" }),
      WW09: b({ ablauf: "Differenzen klärt die Schichtleitung; Freigabe durch die Geschäftsführung.", freigabe: f.gf }),
      WW90: b({ umfang: "Kühlhaus, Trockenlager und Getränkelager am Standort Bremen; Inventur monatlich.", ausgenommen: "Keine Waren auf Kommission." }),
      WW91: b({ systeme: "Warenwirtschaft und DATEV Unternehmen online", schnittstellen: "Monatliche Bestandsliste an DATEV", betrieb: "Gemischt" }),
      WW92: b({
        kontrollen: ["Wareneingang gegen Lieferschein", "Bestand gegen FiBu"],
        details: `Wareneingang gegen Lieferschein durch die Schichtleitung. Bestand gegen FiBu durch ${f.buchhaltung}.`,
      }),
      WW95: b({ notbetrieb: "Bei Ausfall Zählliste auf Papier, Nacherfassung", nacherfassung: "Nacherfassung in der Warenwirtschaft." }),
      SV91: b({ systeme: "Kassensystem und DATEV Unternehmen online", schnittstellen: "Monatlicher Export nach DATEV", betrieb: "Gemischt" }),
      SV92: b({ kontrollen: ["Abstimmung der übergebenen Summen mit der FiBu"], details: `${f.buchhaltung} gleicht die Exportsumme mit dem Z-Bon ab.` }),
      KA01: b({
        kassenart: "Elektronisches Kassensystem mit TSE",
        system: "KassaPro Gastro (fiktiv) auf Stationen Theke und Service",
        anzahl: "2 Stationen am Standort Bremen",
      }),
      ZD01: b({
        anbieter: "Kartenterminal über Zahlungsdienstleister (fiktiv) und SEPA über die Hausbank. Kartenzahlungen im Tagesgeschäft; Auszahlungsreport gegen Kassenabschluss.",
      }),
    };
  }

  if (vorlage === "handwerk") {
    return {
      ...firmaKorrektur(f),
      ...baseDienst,
      SY01: b({
        umgebung: `Projektsoftware, Rechnungssoftware, DATEV Unternehmen online, Zeiterfassung, E-Mail und NAS. IT: ${f.it}.`,
        betrieb: "Gemischt",
      }),
      UO03: b({
        zustaendigkeiten: `Geschäftsführung und Gesamtverantwortung: ${f.gf}. Interne Buchhaltung und Belegwesen: ${f.buchhaltung}. IT und Benutzerrechte: ${f.it}. Steuerliche Beratung und Abschluss: ${f.kanzlei}. Projektleitung für Auftragsänderungen, Abnahme, Abschlagsrechnung und Schlussrechnung. Diese Verfahrensdokumentation: ${f.gf}.`,
        organigramm: "ja",
      }),
      VK92: b({
        kontrollen: ["Lückenprüfung der Rechnungsnummern", "Abgleich Projektzeiten mit Rechnungen", "OP-Liste"],
        details: `Lückenprüfung monatlich durch ${f.buchhaltung}. Abgleich erfasster Projektzeiten mit Rechnungen monatlich durch die Projektleitung. OP-Liste gegen Debitorenkonten monatlich durch ${f.buchhaltung}. Storni nur mit Freigabe durch ${f.gf}.`,
      }),
      BS00: b({ verantwortlich: f.gf, vertretung: f.buchhaltung }),
      BS01: b({
        art: ["Handwerk / Bau"],
        vorgaenge: "Bauprojekte und Sanierungen mit Aufmaß, Materialeinkauf, Nachunternehmer, Bautagebuch/Stunden, Abschlags- und Schlussrechnungen, Gewährleistungseinbehalte, Übergabe an die FiBu.",
      }),
      BS02: b({
        systeme: "Projekt- und Aufmaßsoftware (fiktiv); Rechnungssoftware mit Abschlags-/Schlusslogik; DATEV Unternehmen online; Zeiterfassung auf Baustellen.",
      }),
      BS03: b({
        ablauf: "Projektstammdaten und Nachträge erfasst die Projektleitung; Materialbedarf aus Stückliste; Freigabe größerer Bestellungen durch die Geschäftsführung.",
      }),
      BS04: b({
        nachweise: "Aufmaß, Bautagebuch bzw. Stundenzettel, Lieferscheine Material, Nachunternehmerrechnungen, Abnahmeprotokolle, Abschlags- und Schlussrechnungen mit Bezug zur Auftragsnummer.",
      }),
      BS05: b({ ablauf: "Abschlags- und Schlussrechnungen mit Bezug zur Auftragsnummer." }),
      BS06: b({ regeln: "Bei Bauleistungen an andere Bauunternehmer wird die Steuerschuldnerschaft des Leistungsempfängers geprüft (§ 13b Abs. 2 Nr. 4 UStG); die Rechnung enthält dann den Hinweis „Steuerschuldnerschaft des Leistungsempfängers“ (§ 14a Abs. 5 UStG)." }),
      BS07: b({ weg: "Periodischer DATEV-Export der Ausgangsrechnungen und Eingangsbelege; Projektauswertung als PDF/CSV an die Kanzlei.", turnus: "Monatlich." }),
      BS08: b({ ablage: "Aufmaß, Stundenzettel und Projektunterlagen liegen in der Projektsoftware und als PDF auf dem NAS.", auswertbar: "ja" }),
      BS92: b({
        kontrollen: ["Abschläge gegen Aufmaß", "Material gegen Lieferschein", "Stunden gegen Lohn"],
        details: `Projektumsätze und Materialaufwand gegen FiBu durch ${f.buchhaltung}. Vor jeder Abschlagsrechnung prüft ${f.buchhaltung} Aufmaß und bisherige Abschläge.`,
      }),
      AR01: b({
        ablauf: "Abschlagsrechnungen nach Baufortschritt bzw. Aufmaß; Schlussrechnung mit Auflistung aller Abschläge und Einbehalten. Nummernkreis fortlaufend, Verweis auf Auftrags-/Projektnummer.",
      }),
      SV00: b({ verantwortlich: f.gf, vertretung: f.buchhaltung }),
      SV01: b({ name: "Projektsoftware", zweck: "Aufmaß, Stunden und Abschläge", anbieter: "Anbieter der Projektsoftware" }),
      SV02: b({ rollen: `${f.gf}, die Projektleitung und ${f.buchhaltung}` }),
      SV03: b({ daten: "Aufmaß, Stunden, Material und Abschläge" }),
      SV04: b({ ablauf: "Die Projektleitung erfasst Aufmaß und Stunden in der Projektsoftware.", pruefung: f.gf }),
      SV05: b({ stammdaten: "Projekte, Preise und Leistungsverzeichnis", wer: f.gf }),
      SV06: b({ uebergabe: "Monatlicher DATEV-Export", turnus: "monatlich" }),
      SV07: b({ ablauf: "Die Projektauswertung wird mit der FiBu abgeglichen.", wer: f.buchhaltung }),
      SV08: b({ ablage: "Projektsoftware und NAS", auswertbar: "ja" }),
      SV09: b({ wer: f.gf, protokolliert: "ja" }),
      SV10: b({ ablauf: "Ein Systemwechsel ist nicht vorgesehen. Exporte bleiben auf dem NAS lesbar." }),
      SV91: b({ systeme: "Projektsoftware und DATEV Unternehmen online", schnittstellen: "Monatlicher DATEV-Export", betrieb: "Gemischt" }),
      SV92: b({ kontrollen: ["Abstimmung der übergebenen Summen mit der FiBu"], details: `${f.buchhaltung} gleicht die Projektauswertung mit der FiBu ab.` }),
      WW00: b({ verantwortlich: f.gf, vertretung: "Projektleitung" }),
      WW01: b({
        system: "Einfache Materialliste je Projekt (fiktiv), kein Voll-WaWi-Filialbetrieb",
        vorgaenge: "Materialeinkauf auf Projekt, Wareneingang gegen Lieferschein, Verbrauch auf Baustelle, Restmaterialrücknahme",
      }),
      WW02: b({ wer: "Projektleitung", freigabe: f.gf, protokolliert: "ja" }),
      WW03: b({ ablauf: "Material wird auf der Baustelle oder im Lager gegen Lieferschein geprüft und dem Projekt zugeordnet.", wer: "Projektleitung" }),
      WW04: b({ ablauf: "Verbrauch auf der Baustelle wird dem Projekt zugeordnet.", wer: "Projektleitung" }),
      WW05: b({ fuehrung: "Liste je Projekt", bewertung: "Einkaufspreis laut Rechnung" }),
      WW06: b({ lagerorte: "Ein Materiallager am Standort Oldenburg; Baustellenbestände werden nicht geführt.", umlagerung: "Umlagerungen werden nicht geführt." }),
      WW07: b({ wer: "Projektleitung", freigabe: f.gf, grund: "ja" }),
      WW08: b({ verfahren: "Stichtagsinventur des Lagers zum Geschäftsjahresende; Zählliste als PDF auf dem NAS.", wer: f.gf, stichtag: "Geschäftsjahresende", zaehllisten: "PDF auf dem NAS" }),
      WW09: b({ ablauf: "Differenzen werden nachgezählt und mit Grund dem Projekt zugeordnet.", freigabe: f.gf }),
      WW10: b({ uebergabe: "Bestand der Materialliste mit der Projektauswertung an DATEV.", turnus: "monatlich" }),
      WW90: b({ umfang: "Materiallager am Standort Oldenburg.", ausgenommen: "Kein Voll-WaWi." }),
      WW91: b({ systeme: "Materialliste in der Projektsoftware; Übergabe an DATEV mit der Projektauswertung.", schnittstellen: "Monatlicher DATEV-Export mit der Projektauswertung", betrieb: "Gemischt" }),
      WW92: b({ kontrollen: ["Wareneingang gegen Lieferschein", "Bestand gegen FiBu"], details: `Wareneingang gegen Lieferschein und Projekt. Bestand gegen FiBu durch ${f.buchhaltung}.` }),
    };
  }

  if (vorlage === "handel") {
    return {
      ...firmaKorrektur(f),
      SY01: b({
        umgebung: `Kassensystem, Warenwirtschaft, Handscanner im Lager, DATEV Unternehmen online, E-Mail und NAS. IT: ${f.it}.`,
        betrieb: "Gemischt",
      }),
      UO03: b({
        zustaendigkeiten: `Geschäftsführung und Gesamtverantwortung: ${f.gf}. Interne Buchhaltung und Belegwesen: ${f.buchhaltung}. IT und Benutzerrechte: ${f.it}. Steuerliche Beratung und Abschluss: ${f.kanzlei}. Verkaufsleitung an der Kasse. Lagerverantwortliche Person für das Lager. Diese Verfahrensdokumentation: ${f.gf}.`,
        organigramm: "ja",
      }),
      VK01: b({ ablauf: "Auftrag in der WaWi Lagerplus, Lieferschein, Rechnung an den Geschäftskunden.", system: "WaWi Lagerplus (fiktiv)" }),
      VK02: b({ system: "WaWi Lagerplus (fiktiv)", ablage: "Am Auftrag in der WaWi" }),
      VK05: b({ vergabe: "Automatisch fortlaufend in der WaWi Lagerplus", kreise: "Ein Nummernkreis für Rechnungen, einer für Stornorechnungen" }),
      VK06: b({ ablauf: "Die Rechnungsvorlage in der WaWi enthält die Pflichtangaben; der Leistungszeitraum kommt aus dem Lieferschein.", wer: f.buchhaltung }),
      VK08: b({ ablauf: "Fehlerhafte Rechnungen werden in der WaWi storniert (Stornorechnung mit Bezug) und neu ausgestellt; kein Überschreiben.", freigabe: f.gf }),
      VK10: b({ uebergabe: "Die WaWi Lagerplus übergibt Rechnungen und Debitoren an DATEV Unternehmen online.", turnus: "täglich" }),
      VK90: b({ umfang: "Verkauf im Ladengeschäft und an Geschäftskunden.", ausgenommen: "Keine weiteren Verkaufswege." }),
      VK91: b({ systeme: "WaWi Lagerplus (fiktiv): Aufträge, Lieferscheine, Rechnungen. DATEV Unternehmen online.", schnittstellen: "WaWi an DATEV: Rechnungen und Debitoren.", betrieb: "Cloud / Anbieter" }),
      VK92: b({
        kontrollen: ["Abgleich Lieferscheine mit Rechnungen", "OP-Liste"],
        details: `Abgleich der Lieferscheine aus WaWi Lagerplus mit den Rechnungen an Geschäftskunden monatlich durch ${f.buchhaltung}. OP-Liste gegen Debitorenkonten monatlich durch ${f.buchhaltung}.`,
      }),
      LE02: b({ nachweis: "Lieferschein mit Empfangsbestätigung.", ablage: `Ablage in DATEV Unternehmen online. ${f.buchhaltung} prüft die Vollständigkeit vor der Rechnung.` }),
      LE03: b({ ablauf: "Lieferschein mit Empfangsbestätigung. Ablage in DATEV Unternehmen online.", protokoll: "ja" }),
      AR01: b({ ablauf: "Jede Lieferung wird einzeln berechnet." }),
      WW06: b({
        lagerorte: "Lager (Halle A, Halle B) und Verkaufsfläche im Ladengeschäft am Standort Hannover",
        umlagerung: "Umlagerungen Lager → Laden als Umbuchung in WaWi Lagerplus.",
      }),
      WW90: b({ umfang: "Lager und Verkaufsfläche am Standort Hannover.", ausgenommen: "Keine Waren auf Kommission." }),
      WW91: b({
        systeme: "WaWi Lagerplus (fiktiv), Cloud; Kassensystem KassaPro übergibt Verkäufe an die WaWi; Handscanner im Lager",
        schnittstellen: "KassaPro an WaWi: Verkäufe laufend. Handscanner an WaWi. WaWi an DATEV: monatliche Bestandsliste.",
        betrieb: "Cloud / Anbieter",
      }),
      KA01: b({
        kassenart: "Elektronisches Kassensystem mit TSE",
        system: "KassaPro (fiktiv) auf Tablet-Kassen",
        anzahl: "3 Kassen am Standort Hannover",
      }),
    };
  }
  if (vorlage === "ecommerce") {
    return {
      ...firmaKorrektur(f),
      SY01: b({
        umgebung: `Onlineshop, Warenwirtschaft, DATEV Unternehmen online, E-Mail und NAS. IT: ${f.it}.`,
        betrieb: "Gemischt",
      }),
      UO03: b({
        zustaendigkeiten: `Geschäftsführung und Gesamtverantwortung: ${f.gf}. Interne Buchhaltung und Belegwesen: ${f.buchhaltung}. IT und Benutzerrechte: ${f.it}. Steuerliche Beratung und Abschluss: ${f.kanzlei}. Lagerverantwortliche Person für das Lager. Diese Verfahrensdokumentation: ${f.gf}.`,
        organigramm: "ja",
      }),
      BS06: b({
        regeln: `Fernverkäufe an Privatpersonen in Österreich werden mit dem österreichischen Steuersatz berechnet und über das OSS-Verfahren erklärt (§ 3c, § 18j UStG); Steuersätze je Land pflegt ${f.gf} im Shop.`,
      }),
      EC05: b({
        pflege: `Fernverkäufe an Privatpersonen in Österreich werden mit dem österreichischen Steuersatz berechnet und über das OSS-Verfahren erklärt (§ 3c, § 18j UStG); Steuersätze je Land pflegt ${f.gf} im Shop.`,
        oss: "ja",
      }),
      VK01: b({ ablauf: "Bestellung im Shop oder auf dem Marktplatz, Versand, Rechnung aus der Bestellung.", system: "Onlineshop" }),
      VK02: b({ system: "Onlineshop", ablage: "An der Bestellung" }),
      VK05: b({ vergabe: "Automatisch fortlaufend im Shop", kreise: "Ein Nummernkreis für Rechnungen, einer für Stornorechnungen" }),
      VK06: b({ ablauf: "Die Rechnungsvorlage im Shop enthält die Pflichtangaben; der Leistungszeitraum ist das Versanddatum.", wer: f.buchhaltung }),
      VK08: b({ ablauf: "Fehlerhafte Rechnungen werden im Shop storniert (Stornorechnung mit Bezug) und neu ausgestellt; kein Überschreiben.", freigabe: f.gf }),
      VK10: b({ uebergabe: "Der Shop übergibt Rechnungen an DATEV Unternehmen online.", turnus: "täglich" }),
      VK90: b({ umfang: "Verkauf ausschließlich über Shop und Marktplatz an Privatpersonen, siehe Bereich E-Commerce", ausgenommen: "Kein Projektgeschäft." }),
      VK91: b({ systeme: "Onlineshop und Marktplatz; DATEV Unternehmen online.", schnittstellen: "Shop an DATEV: Rechnungen.", betrieb: "Cloud / Anbieter" }),
      VK92: b({
        kontrollen: ["Abgleich Bestellungen mit Rechnungen", "Verrechnungskonten"],
        details: `Abgleich versendeter Bestellungen aus Shop und Marktplatz mit den erstellten Rechnungen monatlich durch ${f.buchhaltung}. OP-Liste bzw. Verrechnungskonten je Zahlungsdienstleister monatlich durch ${f.buchhaltung}.`,
      }),
      LE02: b({ nachweis: "Versandbestätigung und Rechnung zur Bestellung.", ablage: `Ablage in DATEV Unternehmen online. ${f.buchhaltung} prüft die Vollständigkeit vor der Rechnung.` }),
      LE03: b({ ablauf: "Kein Projektgeschäft; der Verkauf läuft über Shop und Marktplatz. Der Versandbeleg liegt bei der Bestellung.", protokoll: "ja" }),
      AR01: b({ ablauf: "Jede Bestellung wird einzeln berechnet." }),
      EK00: b({ verantwortlich: `${f.gf} (Einkauf)`, vertretung: f.buchhaltung }),
      EK01: b({ ablauf: "Bedarf entsteht aus dem Bestand im Onlineshop und aus Nachbestellungen in der WaWi Lagerplus.", wer: f.buchhaltung }),
      EK02: b({
        wer: f.buchhaltung,
        grenzen: "Bestellungen bis 2.000 Euro durch die Buchhaltung; darüber Freigabe der Geschäftsführung",
        freigabe: f.gf,
      }),
      EK03: b({ wege: ["Warenwirtschaft", "Lieferantenportal", "E-Mail"], system: "Bestellungen über WaWi Lagerplus (fiktiv) und Lieferantenportale" }),
      EK04: b({ wer: "Einkauf", abweichungen: "Abweichungen bei Preis oder Termin werden in der WaWi vermerkt und mit dem Lieferanten geklärt." }),
      EK05: b({ ablauf: "Wareneingang in der WaWi Lagerplus gegen die Bestellung.", wer: "Lagerverantwortliche Person" }),
      EK06: b({ ablauf: "Die Rechnung wird in der WaWi der Bestellung und dem Wareneingang zugeordnet.", wer: f.buchhaltung }),
      EK08: b({ vertraege: "Rahmenverträge mit Lieferanten und Versanddienstleister, Liste in der WaWi.", wer: f.gf }),
      EK10: b({ ablage: "WaWi Lagerplus (fiktiv), Dokumente am Bestellvorgang", ordnung: "Bestellnummer" }),
      EK90: b({ umfang: "Einkauf von Handelsware für den Onlineshop am Standort Leipzig.", ausgenommen: "Nur Handelsware für den Onlineshop." }),
      EK91: b({ systeme: "WaWi Lagerplus (fiktiv) und DATEV Unternehmen online.", schnittstellen: "WaWi an DATEV: Kreditoren und Rechnungsbuchungen.", betrieb: "Cloud / Anbieter" }),
      EK95: b({ notbetrieb: "Bei Ausfall der WaWi Bestellungen per E-Mail, Nacherfassung in der WaWi.", nacherfassung: "Nacherfassung innerhalb von zwei Arbeitstagen." }),
      EK96: b({ ort: "WaWi Lagerplus (fiktiv) mit jährlichem Export", form: "Originaldokumente in der WaWi, Export als CSV und PDF", loeschung: f.buchhaltung }),
      WW00: b({ verantwortlich: "Lagerverantwortliche Person", vertretung: f.buchhaltung }),
      WW06: b({
        lagerorte: "Ein Lager am Standort Leipzig mit Regal- und Versandbereich",
        umlagerung: "Keine Umlagerungen zwischen Lagerorten; Lagerplatzwechsel ohne Buchung.",
      }),
      WW08: b({
        verfahren: "Inventur zum Geschäftsjahresende",
        wer: `${f.buchhaltung} zählt mit einer zweiten Person, Prüfung ${f.gf}`,
        stichtag: "Geschäftsjahresende",
        zaehllisten: "Zählliste in der WaWi",
      }),
      WW90: b({ umfang: "Lager am Standort Leipzig.", ausgenommen: "Keine Kommissionsware." }),
      WW91: b({
        systeme: "WaWi Lagerplus (fiktiv), Cloud; Shopsystem und Marktplatz übergeben Bestellungen an die WaWi; DATEV Unternehmen online.",
        schnittstellen: "Shop an WaWi: Bestellungen laufend; WaWi an DATEV: monatliche Bestandsliste.",
        betrieb: "Cloud / Anbieter",
      }),
      RT00: b({ verantwortlich: "Kundenservice", vertretung: f.buchhaltung }),
    };
  }
  return {};
}


const DATEV_FELDER = new Set(["AW02.merkmale"]);

function istRollenfeld(key: string): boolean {
  return key === "wer" || key.startsWith("rolle") || key === "freigabe" || key === "verantwortlich" || key === "vertretung";
}

/** Hängt den DATEV-Zusatz an die sichtbaren Archivfelder, nicht an Rollenfelder. */
function deepenPass(katalog: Record<string, Entry>, f: DenseFirma): Record<string, Entry> {
  const suffix = ` Nachweis und Ablage unter Beleg-ID in DATEV Unternehmen online; fachlich ${f.buchhaltung}, Freigabe ${f.gf}. Aufbewahrung der Buchungsbelege 8 Jahre (§ 147 Abs. 1 Nr. 4, Abs. 3 Satz 1 AO).`;
  const out: Record<string, Entry> = { ...katalog };
  for (const [id, entry] of Object.entries(katalog)) {
    if (entry.status !== "bestaetigt" || !entry.values) continue;
    const values: Record<string, unknown> = { ...entry.values };
    let changed = false;
    for (const [key, value] of Object.entries(values)) {
      if (!DATEV_FELDER.has(`${id}.${key}`) || istRollenfeld(key)) continue;
      if (typeof value !== "string" || value.length === 0 || value.length >= 450) continue;
      if (/§ 147\b/.test(value)) continue;
      values[key] = `${value}${suffix}`;
      changed = true;
    }
    if (changed) out[id] = { ...entry, values };
  }
  return out;
}

export function buildDenseGesamtAnswers(vorlage: MusterDenseId): IntakeAnswers {
  const firma = MUSTER_FIRMEN[vorlage];
  let answers = ensureGesamt({
    ...emptyAnswers(),
    branchen: [firma.branche],
    rechtsform: firma.rechtsform,
    mitarbeitende: firma.mitarbeitende,
    gf: firma.gf,
    buchhaltung: firma.buchhaltung,
    it: firma.it,
    steuerberater: firma.kanzlei,
    fibu: ["DATEV"],
    archiv: "DATEV Unternehmen online",
    hosting: "Gemischt",
    backup: ["Anbieter-Backup", "NAS"],
    zugriff: `${firma.gf}; ${firma.buchhaltung}; Kanzlei lesen`,
  });
  answers = setVorlage(answers, vorlage);
  answers = {
    ...answers,
    module: {
      ...answers.module!,
      check: { ...answers.module!.check, ...MUSTER_CHECK[vorlage] },
      stammdaten: {
        gf: firma.gf,
        buchhaltung: firma.buchhaltung,
        it: firma.it,
        kanzlei: firma.kanzlei,
        fibu: "DATEV Unternehmen online",
        archiv: "DATEV Unternehmen online / NAS",
      },
    },
  };

  const katalog = mergeKatalog(
    allgemeinKatalog(firma),
    bereicheKatalog(vorlage),
    ownKatalog(firma, vorlage),
  );
  answers = { ...answers, katalog };

  // Alle nicht „nicht vorhanden“ Module ausdrücklich auf tool; ein Modul als extern-Beispiel.
  for (const modul of MODULE) {
    const check = answers.module!.check;
    const trigger = modul.trigger;
    const antwort = trigger ? check[trigger] : undefined;
    if (modul.typ === "betrieb" && antwort === "nein") {
      const grund: Partial<Record<string, string>> = {
        bargeld: "Keine Kasse und kein Bargeldverkehr.",
        lager: "Kein Warenlager.",
        personal: "Keine angestellten Mitarbeitenden.",
        zeiterfassung: "Keine Zeiterfassung.",
        online: "Kein Onlineshop.",
        retouren: "Keine Warenretouren.",
        papier: "Keine Papierbelege.",
        erechnung: "Keine E-Rechnungen.",
        anlagen: "Keine eigene Anlagenbuchhaltung.",
        branche: "Keine Branchensoftware.",
        zahlungsdienstleister: "Kein Zahlungsdienstleister.",
      };
      answers = setModulEintrag(answers, modul.id, {
        status: "nicht_vorhanden",
        reason: grund[trigger ?? ""] ?? `${modul.kurz} kommt in diesem Betrieb nicht vor.`,
      });
    } else if (modul.id === "m11" && (vorlage === "dienstleister" || vorlage === "handwerk")) {
      answers = setModulEintrag(answers, modul.id, {
        status: "extern",
        ref: "Anlagenkartei und AfA-Liste der Kanzlei (Muster, fiktiv)",
        link: "Ablage: Ordner Anlagen auf dem NAS",
      });
    } else if (modul.id === "m14" && (vorlage === "gastro" || vorlage === "handwerk")) {
      answers = setModulEintrag(answers, modul.id, { status: "tool" });
    } else {
      answers = setModulEintrag(answers, modul.id, { status: "tool" });
    }
  }

  // Branchenspezifische Vertiefung (Modul 14 und typische Prozessantworten).
  answers = {
    ...answers,
    // Extras überschreiben bewusst die kürzeren Standardantworten.
    katalog: (() => {
      let katalog = { ...(answers.katalog ?? {}), ...vorlageExtras(firma, vorlage) };
      if (vorlage === "dienstleister" || vorlage === "ecommerce") {
        katalog = deepenPass(katalog, firma);
      }
      return bereinigeKatalog(katalog, vorlage, firma);
    })(),
    module: {
      ...answers.module!,
      branchenArt:
        vorlage === "gastro"
          ? ["Gastronomie / Hotel"]
          : vorlage === "handwerk"
            ? ["Handwerk / Bau"]
            : answers.module!.branchenArt,
    },
  };

  return answers;
}
