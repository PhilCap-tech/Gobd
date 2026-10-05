/**
 * Dichte Muster- und Branchenvorlagen-Antworten (fiktiv).
 * Aufbewahrung § 147 AO: Buchungsbelege 10 Jahre, Handelsbriefe 6 Jahre;
 * GoBD-Rz. nur wo im Produkt bereits sicher verwendet (151–154).
 */
import { bereichMuster } from "@/lib/bereich-muster";
import { MODULE, modulFragen } from "@/lib/module/katalog";
import {
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

export const MUSTER_FIRMEN: Record<"dienstleister" | "handel" | "ecommerce", DenseFirma> = {
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
    branche: "Einzel- und Großhandel mit Filiale und Lager",
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
};

/** Bereichs-Muster, die in die jeweilige Branchenvorlage einfließen. */
export const VORLAGE_BEREICHE: Record<"dienstleister" | "handel" | "ecommerce", string[]> = {
  dienstleister: ["verkauf", "einkauf", "bank", "anlagen"],
  handel: ["kasse", "warenwirtschaft", "einkauf", "verkauf", "bank", "retouren"],
  ecommerce: ["ecommerce", "retouren", "warenwirtschaft", "bank", "verkauf"],
};

/** Betriebs-Check für Muster: klar ja/nein, damit das PDF keine „unbekannt“-Löcher hat. */
export const MUSTER_CHECK: Record<"dienstleister" | "handel" | "ecommerce", Partial<Record<CheckKey, CheckAntwort>>> = {
  dienstleister: {
    bargeld: "nein", lager: "nein", personal: "nein", zeiterfassung: "nein", online: "nein",
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
      out[key] = vorlage === "dienstleister" ? ["Geschäftskunden (B2B)"] : vorlage === "ecommerce" ? ["Privatkunden (B2C)"] : ["Privatkunden (B2C)", "Geschäftskunden (B2B)"];
    } else if (value === "__BRANCHE_ART__") {
      out[key] = vorlage === "handel" ? ["Handel"] : vorlage === "ecommerce" ? ["E-Commerce"] : ["Dienstleistung"];
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
  LE01: { ablauf: "Aufträge entstehen aus Angebot oder Bestellung des Kunden. {gf} oder Vertrieb erfasst den Auftrag im System; Änderungen werden mit Versionsstand festgehalten.", system: "Auftragsverwaltung in der Rechnungssoftware bzw. ERP (fiktiv)" },
  LE02: { nachweis: "Leistung wird durch Lieferschein, Abnahmeprotokoll oder Leistungsnachweis (Stunden/Projekt) dokumentiert. Ablage im DMS bzw. DATEV Unternehmen online.", wer: "{buchhaltung} prüft Vollständigkeit vor Rechnung" },
  LE03: { abrechnung: "Nach Leistungserbringung bzw. Lieferung erstellt {buchhaltung} die Rechnung. Abschlagsrechnungen bei Projekten nach Meilenstein.", turnus: "laufend, spätestens 14 Tage nach Leistung" },
  LE04: { aenderungen: "Auftragsänderungen nur schriftlich (E-Mail) und mit neuer Auftragsversion. Storno vor Lieferung durch {gf}.", wer: "{gf}" },
  LE05: { abnahme: "Bei Projekten Abnahme per E-Mail oder Protokoll; bei Waren Lieferschein mit Empfangsbestätigung.", ablage: "DATEV Unternehmen online und Projektordner auf dem NAS" },
  LE92: { kontrollen: ["Abstimmung offene Aufträge mit Rechnungen", "Stichprobe Leistungsnachweis vor Rechnung"], details: "Monatlich prüft {buchhaltung} offene Aufträge ohne Rechnung. Stichprobe Leistungsnachweise vor Rechnungsversand durch {gf}." },
  AR00: { verantwortlich: "{buchhaltung}", vertretung: "{gf}" },
  AR01: { erstellung: "Rechnungen werden in der Rechnungssoftware erzeugt; Nummernvergabe fortlaufend durch das System.", nummernkreis: "Fortlaufend je Geschäftsjahr, keine Lückenpolitik außer Storno mit Beleg" },
  AR02: { versand: "Versand als PDF per E-Mail und zusätzlich als E-Rechnung (XRechnung/ZUGFeRD), soweit vom Kunden gefordert.", original: "Strukturierte Rechnungsdatei bzw. PDF im Archiv gilt als Original" },
  AR03: { korrekturen: "Gutschriften und Stornos mit eigener Nummer und Verweis auf die Ursprungsrechnung. Berichtigungen nur über Gutschrift/Neurechnung.", wer: "{buchhaltung} nach Freigabe {gf}" },
  AR04: { abschlaege: "Abschlags- und Schlussrechnungen bei Projekten; Schlussrechnung stellt den Gesamtbezug her.", system: "Rechnungssoftware" },
  AR92: { kontrollen: ["Nummernkreis lückenlos", "Abstimmung Ausgangsrechnungen mit FiBu"], details: "Monatlich Nummernkreis und Summenabstimmung Ausgang gegen Erlöskonten durch {buchhaltung}." },
  ER00: { verantwortlich: "{buchhaltung}", vertretung: "{gf}" },
  ER01: { empfang: "E-Rechnungen und elektronische PDFs gehen am Funktionspostfach ein; XRechnungen über den vorgesehenen Eingangskanal der Rechnungssoftware.", formate: ["PDF", "ZUGFeRD", "XRechnung"] },
  ER02: { pruefung: "Technische Prüfung (Schema/Validierung) in der Rechnungssoftware; fachliche Prüfung durch {buchhaltung}.", wer: "{buchhaltung}" },
  ER03: { verarbeitung: "Nach Prüfung Übergabe an DATEV Unternehmen online zur Verbuchung durch die Kanzlei.", schnittstelle: "Export/Upload DATEV" },
  ER04: { erstellung: "Ausgangs-E-Rechnungen erzeugt die Rechnungssoftware; Versand über denselben Kanal wie PDF.", format: "ZUGFeRD und XRechnung je Kundenanforderung" },
  ER05: { ablage: "Strukturierte Daten und Sichtbeispiel PDF im Archiv (DATEV / DMS) mit Beleg-ID.", unveranderbar: "ja" },
  ER06: { stoerung: "Bei Validierungsfehlern Ticketsystem; Beleg bleibt im Eingang bis Klärung. Keine Buchung ohne erfolgreiche Prüfung.", wer: "{buchhaltung} / {it}" },
  ER92: { kontrollen: ["Validierung E-Rechnung", "Vollständigkeit Eingangsjournal"], details: "Tägliche Sichtung Eingangsjournal; monatliche Stichprobe Validierungsprotokolle durch {buchhaltung}." },
  PB00: { verantwortlich: "{buchhaltung}", vertretung: "{gf}" },
  PB01: { annahme: "Papierpost wird zentral geöffnet, mit Eingangsstempel versehen und noch amselben Tag gescannt.", wer: "{buchhaltung}" },
  PB02: { scan: "Scan in 300 dpi PDF/A; Qualitätskontrolle (Lesbarkeit, Vollständigkeit) vor Übergabe ins Archiv.", geraet: "Büroscanner (fiktiv)" },
  PB03: { ersetzung: "Nach Scan und Qualitätskontrolle gilt das digitale Bild als führend; Papier wird nach Freigabe vernichtet, soweit keine Aufbewahrungsgründe entgegenstehen.", freigabe: "{gf}" },
  PB04: { original: "Solange Papier aufbewahrt wird: Ordner Eingangsbelege im Büro, geordnet nach Monat.", dauer: "bis zur Freigabe der Vernichtung, längstens bis Fristende nach § 147 AO" },
  PB05: { uebergabe: "Scan wird mit Beleg-ID in DATEV Unternehmen online abgelegt und der Kanzlei bereitgestellt.", turnus: "laufend" },
  PB06: { vernichtung: "Vernichtung nach Checkliste (Frist, keine Betriebsprüfung angekündigt, digitale Lesbarkeit geprüft) durch {buchhaltung} mit Protokoll.", protokoll: "ja" },
  PB92: { kontrollen: ["Scan-Qualitätskontrolle", "Eingangsstempel und Vollständigkeit"], details: "Jeder Scan wird vor Archivierung geprüft; monatliche Stichprobe Papier zu Digital durch {gf}." },
  ZD01: { anbieter: "Kreditkarte / Online-Zahlungsdienstleister (fiktiv) und SEPA-Lastschrift über die Hausbank.", zwecke: "Kundenzahlungen und ggf. Marktplatz-Auszahlungen" },
  ZD02: { abgleich: "Täglicher oder wöchentlicher Abgleich Auszahlungsreport gegen Bank und offene Posten durch {buchhaltung}.", gebuehren: "Gebühren werden anhand des Reports kontiert" },
  ZD03: { rueckbelastungen: "Chargebacks und Rückgaben werden mit Ursprungsbeleg verknüpft und der Forderung nachgeführt.", wer: "{buchhaltung}" },
  ZD04: { ablage: "Auszahlungsreports und Gebührenaufstellungen im Archiv unter Zahlungsdienstleister / Monat.", aufbewahrung: "10 Jahre (§ 147 Abs. 3 AO), soweit Buchungsbeleg" },
  BU00: { verantwortlich: "{buchhaltung}", vertretung: "{gf}" },
  BU01: { kontierung: "Interne Vorkontierung in DATEV Unternehmen online; endgültige Buchung durch {kanzlei}.", plan: "DATEV-Kontenrahmen" },
  BU02: { belegzuordnung: "Jeder Buchungssatz ist mit Beleg-ID verknüpft; fehlende Belege werden als offener Punkt geführt.", wer: "{buchhaltung}" },
  BU03: { festschreibung: "Festschreibung nach Abstimmung mit der Kanzlei zum Periodenabschluss; danach nur noch Storno-/Korrekturbuchungen.", wer: "{kanzlei} nach Freigabe {gf}" },
  BU04: { korrekturen: "Korrekturen über Stornobuchung mit Begründung und Verweis; keine Überschreibung festgeschriebener Sätze.", protokoll: "ja" },
  BU05: { abstimmungen: "Monatlich: Bank, Debitoren, Kreditoren, Steuern. Quartalsweise Anlagen und Rückstellungen mit der Kanzlei.", wer: "{buchhaltung} und {kanzlei}" },
  BU06: { abschluss: "Jahresabschluss erstellt die Kanzlei; Unterlagenübergabe nach Checkliste bis Ende Februar für das Vorjahr.", uebergabe: "DATEV und ergänzende Excel/PDF-Listen" },
  BU07: { kanzlei: "{kanzlei}", umfang: "Laufende FiBu, USt-Voranmeldung, Jahresabschluss, Lohn (soweit beauftragt)" },
  BU92: { kontrollen: ["Monatsabschluss-Abstimmung", "Belegvollständigkeit"], details: "Checkliste Monatsabschluss durch {buchhaltung}; Freigabe durch {gf}." },
  BS00: { verantwortlich: "{gf}", vertretung: "{buchhaltung}" },
  BS01: { art: "__BRANCHE_ART__", vorgaenge: "Branchentypische Vorgänge mit steuerlicher Bedeutung werden im Vorsystem erfasst und an die FiBu übergeben." },
  BS02: { systeme: "Branchensoftware bzw. Gerät laut Modul Vorsystem (fiktiv); Schnittstelle zu DATEV." },
  BS03: { ablauf: "Grunddaten erfasst fachlich geschultes Personal; Änderungen an Preisen/Stammdaten nur mit Freigabe {gf}." },
  BS04: { nachweise: "Je Vorgang die branchentypischen Nachweise (z. B. Projektnachweis, Leistungsdokumentation) werden mit dem Beleg verknüpft." },
  BS05: { uebergabe: "Periodischer Export an DATEV Unternehmen online.", turnus: "monatlich" },
  BS06: { abstimmung: "Summen des Vorsystems gegen FiBu-Erlöse bzw. Bestände durch {buchhaltung}." },
  BS07: { rechte: "Rollenkonzept im Vorsystem; Admin-Rechte nur {gf} und {it}." },
  BS08: { stoerung: "Bei Ausfall Papier-/Listennotbetrieb und Nacherfassung am selben oder nächsten Werktag." },
  BS92: { kontrollen: ["Summenabstimmung Vorsystem/FiBu", "Rechteprüfung"], details: "Monatliche Abstimmung; jährliche Rechteprüfung." },
  AW01: { orte: "DATEV Unternehmen online (Belege und Buchungen); NAS im Büro (ergänzende Unterlagen und Exports); ggf. Anbieter-Cloud der Vorsysteme.", original: "Je Belegweg ist festgelegt, welche Datei als Original gilt (siehe Modul 5/6 und Systemdokumentation)." },
  AW02: { merkmale: "Beleg-ID, Rechnungsnummer, Datum, Kreditor/Debitor, Betrag, Periodenbezug.", suche: "Über die Suche in DATEV und Dateinamenkonvention JJJJ-MM_BelegID auf dem NAS" },
  AW03: { verknuepfung: "Buchungssatz ↔ Beleg-ID ↔ ggf. Vorgangsnummer im Vorsystem.", wer: "{buchhaltung}" },
  AW04: { lesbarkeit: "PDF/A bzw. Originalformat der E-Rechnung; jährliche Stichprobe der Lesbarkeit durch {buchhaltung}.", format: "PDF/A, XML (XRechnung), CSV-Exporte" },
  AW05: { schutz: "Keine Überschreibung archivierter Belege; Änderungen nur durch neue Version mit Protokoll.", protokoll: "ja" },
  AW06: { auslagerung: "Soweit Cloud-Anbieter: AV-Vertrag und Speicherort EU/DE soweit vertraglich zugesichert.", wer: "{gf}" },
  AW92: { kontrollen: ["Stichprobe Wiederauffindbarkeit", "Lesbarkeitsprüfung"], details: "Quartalsweise zehn Belege stichprobenartig suchen und öffnen." },
  AF01: { zuordnung: "Buchungsbelege und Abschlussunterlagen 10 Jahre, Handels- und Geschäftsbriefe 6 Jahre (§ 147 Abs. 1, 3 AO). Empfangene und abgesandte Handelsbriefe 6 Jahre; soweit Buchungsbeleg 10 Jahre.", wer: "{buchhaltung}" },
  AF02: { weitere: "Hemmung bei laufender Betriebsprüfung oder Rechtsbehelfsverfahren; Hinweis der Kanzlei wird beachtet.", wer: "{kanzlei} / {gf}" },
  AF03: { loeschfreigabe: "Löschung erst nach Fristende und schriftlicher Freigabe durch {gf}, Abstimmung mit {kanzlei}.", nachweis: "Löschprotokoll mit Datum und Umfang" },
  AF04: { durchfuehrung: "Technische Löschung durch {it} bzw. Anbieter nach Freigabe; Bestätigung wird abgelegt.", system: "DATEV / NAS / Vorsysteme" },
  AF05: { ausnahmen: "Personenbezogene Daten mit kürzeren Fristen (z. B. Bewerbungen) nach eigener Liste; steuerliche Fristen haben Vorrang, soweit einschlägig." },
  SY01: { landschaft: "Rechnungssoftware, DATEV Unternehmen online, E-Mail, NAS, ggf. Kasse/Shop/WaWi laut Betriebs-Check.", verantwortlich: "{it}" },
  SY02: { schnittstellen: "Vorsystem → DATEV (Export/Upload). Bank → DATEV (MT940/API). E-Rechnungsein- und -ausgang über Rechnungssoftware.", dokumentiert: "ja" },
  SY03: { importe: "Importe nur über definierte Formate; Konvertierungen werden protokolliert (Datum, Datei, Ziel).", wer: "{buchhaltung} / {it}" },
  SY04: { automatisierung: "Wiederkehrende Exporte und Erinnerungen; keine unprotokollierte Änderung von Buchungsdaten durch Skripte.", freigabe: "{gf}" },
  SY05: { cloud: "Anbieter mit AV-Vertrag; Zugriff über personenbezogene Konten.", region: "DE/EU soweit vertraglich vorgesehen" },
  SY06: { inventar: "Systemliste mit Name, Zweck, Anbieter, Verantwortlichem; jährliche Aktualisierung durch {it}.", stand: "01.07.2026" },
  SY92: { kontrollen: ["Schnittstellenprotokoll", "Systemliste aktuell"], details: "Nach jedem Periodenexport Stichprobe; Systemliste jährlich." },
  ZR01: { rollen: "Geschäftsführung (voll), Buchhaltung (Belege, Exporte), Mitarbeitende (eingeschränkt), Kanzlei (lesen im Mandatsumfang), IT-Admin (technisch).", vergabe: "{gf} beauftragt, {it} richtet ein" },
  ZR02: { entzug: "Bei Austritt oder Rollenwechsel Entzug am letzten Arbeitstag; Checkliste Offboarding.", wer: "{gf} / {it}" },
  ZR03: { schutz: "MFA wo verfügbar, Passwortregeln der Anbieter, keine gemeinsamen Kennungen für Buchhaltung.", massnahmen: "MFA, Berechtigungskonzept, Bildschirmsperre" },
  ZR04: { protokoll: "Anbieterprotokolle zu Logins und kritischen Änderungen werden bei Bedarf gesichert.", aufbewahrung: "mindestens 1 Jahr, länger soweit steuerlich relevant" },
  ZR05: { pruefung: "Jährliche Rechteprüfung anhand der Benutzerlisten.", wer: "{gf}" },
  ZR92: { kontrollen: ["Jährliche Rechteprüfung", "Offboarding-Checkliste"], details: "Protokoll der Rechteprüfung im Ordner IT." },
  SN01: { backup: "Anbieter-Backups der Cloud-Systeme; NAS mit täglicher Sicherung der lokalen Daten.", turnus: "täglich (NAS), Anbieter gemäß Vertrag" },
  SN02: { restore: "Wiederherstellungstest mindestens jährlich für NAS und stichprobenartig Cloud-Export.", zuletzt: "2026-03 (NAS-Test)" },
  SN03: { ausfall: "Bei Ausfall eines Vorsystems Noterfassung auf Papier/Liste und Nacherfassung nach Wiederanlauf am selben oder nächsten Werktag.", wer: "{buchhaltung}" },
  SN04: { ersatz: "Ersatzverfahren je Modul beschrieben (Kasse, Shop, Scan); Eskalation an {gf} und {it}.", doku: "Kurzblatt Notbetrieb im Ordner IT" },
  SN05: { nachbearbeitung: "Nach Wiederanlauf Abgleich der nacherfassten Vorgänge mit den Systemnummernkreisen.", wer: "{buchhaltung}" },
  SN92: { kontrollen: ["Backup-Erfolgskontrolle", "Jährlicher Restore-Test"], details: "Wöchentlich Backup-Journal prüfen; Restore-Test mit Protokoll." },
  KF01: { umfang: "Vollständigkeit und Richtigkeit der Belege, Abstimmungen Bank/OP, Nummernkreise, Schnittstellen.", wer: "{buchhaltung}" },
  KF02: { abweichungen: "Abweichungen werden in einer offenen Liste geführt (Datum, Sachverhalt, Maßnahme, erledigt am).", eskalation: "{gf} bei Beträgen über 500 Euro oder wiederholten Fehlern" },
  KF03: { nachweise: "Abstimmungsprotokolle, Checklisten Monatsabschluss, Stichprobenlisten.", ablage: "Ordner Kontrollen auf dem NAS / DATEV" },
  KF04: { fehler: "Erkennung über Abstimmungen und Systemhinweise; Korrektur über Storno/Neubuchung mit Beleg.", wer: "{buchhaltung}" },
  KF05: { wirksamkeit: "Jährliche Durchsicht der Kontrollliste durch {gf}; Anpassung bei Prozessänderungen." },
  AU01: { aufgaben: "FiBu und Abschluss: {kanzlei}. IT/Cloud: Anbieter und {it}. Ggf. Lohnabrechnung durch Kanzlei oder Dienstleister.", grenzen: "Fachliche Verantwortung und Belegqualität bleiben beim Unternehmen ({gf})." },
  AU02: { uebergabe: "Belege und Auswertungen über DATEV Unternehmen online; ergänzende Listen per sicherer Übertragung.", turnus: "laufend / monatlich" },
  AU03: { kontrollen: "Rücklauf der gebuchten Perioden prüfen; offene Klärungspunkte mit der Kanzlei abarbeiten.", wer: "{buchhaltung}" },
  AU04: { vertraege: "Mandatsvereinbarung mit der Kanzlei; AV-Verträge mit IT-/Cloud-Anbietern.", ablage: "Ordner Verträge" },
  AU05: { ausfall: "Bei Ausfall des Dienstleisters interne Notfallkontakte und lokale Exports nutzen; {gf} entscheidet über Ersatz.", kontakt: "{kanzlei} / {it}" },
  AU06: { dokumentation: "Leistungsabgrenzung und Ansprechpartner in diesem Modul und in Modul 1 festgehalten." },
  PZ00: { verantwortlich: "{gf}", vertretung: "{buchhaltung}" },
  PZ01: { umfang: "Bereitstellung von Belegen, Buchungsdaten, Auswertungen und dieser Verfahrensdokumentation für die Außenprüfung.", rechtsgrundlage: "§ 147 Abs. 6 AO (Datenzugriff)" },
  PZ02: { z1: "Nur-Lesezugriff in DATEV bzw. Vorsystemen nach Einrichtung durch {it}/{kanzlei}.", z2: "Auswertungen nach Vorgabe der Prüfer.", z3: "Datenträgerüberlassung (Export) in abgestimmten Formaten" },
  PZ03: { formate: "DATEV-Export, CSV, PDF-Belege, ggf. DSFinV-K bei Kasse.", getestet: "teilweise" },
  PZ04: { ablauf: "Ankündigung → Benennung Ansprechpartner ({gf}) → Bereitstellung Leserecht oder Export → Protokoll der übergebenen Daten.", frist: "im Rahmen der gesetzlichen Mitwirkung" },
  PZ05: { ansprechpartner: "{gf} (organisatorisch), {buchhaltung} (fachlich), {kanzlei} (steuerlich)", vertretung: "{buchhaltung}" },
  PZ06: { historie: "Frühere Fassungen der Verfahrensdokumentation und ältere Exporte bleiben auffindbar.", ort: "Kundenkonto und NAS-Archiv" },
  PZ07: { einschraenkungen: "Keine stillen Lücken: fehlende Module sind als offen oder nicht vorhanden begründet ausgewiesen." },
  AE00: { verantwortlich: "{gf}", vertretung: "{it}" },
  AE01: { einfuehrung: "Neue Systeme nur nach Freigabe {gf}, mit Eintrag in der Systemliste und Anpassung dieser Dokumentation.", wer: "{gf}" },
  AE02: { updates: "Updates der Cloud-Anbieter nach deren Release; kritische FiBu-/Kassen-Updates vorher testen und freigeben.", protokoll: "ja" },
  AE03: { migration: "Datenmigrationen mit Abgleich vorher/nachher und Archivierung der Altdaten bis Fristende.", wer: "{it} / {buchhaltung}" },
  AE04: { prozess: "Ablaufänderungen werden in der nächsten Fassung der Verfahrensdokumentation nachgezogen (Änderungsverzeichnis).", frist: "innerhalb von 4 Wochen nach Wirksamkeit" },
  AE05: { historie: "Frühere Fassungen bleiben versioniert im Kundenkonto downloadbar.", ort: "gobd-doku-erstellen.de Konto" },
  AE06: { freigabe: "Inhaltliche Freigabe der geänderten Kapitel durch {gf} vor Inkrafttreten.", datum: "mit Gültig-ab der Fassung" },
  AE92: { kontrollen: ["Änderungsverzeichnis gepflegt", "Systemliste nach Änderung aktualisiert"], details: "Prüfung bei jeder neuen Fassung." },
  PF01: { pruefung: "Jährliche Durchsicht aller aktiven Module und nach wesentlichen Prozess-/Systemänderungen.", wer: "{gf} mit {buchhaltung}" },
  PF02: { bestaetigung: "Betriebliche Bestätigung der Ist-Beschreibung durch {gf} (keine Steuerberater-Freigabe).", form: "Bestätigung im Intake / Änderungsvermerk" },
  PF03: { versionierung: "Gemeinsame Version je Gesamtdokument mit Gültig-ab, Änderungshistorie und downloadbaren Vorfassungen.", ort: "Kundenkonto" },
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
  G05: { rolleFristen: "{gf}", verfahren: "Löschung nach Frist und Freigabe; Hemmungen mit Kanzlei klären. Aufbewahrung Buchungsbelege 10 Jahre (§ 147 Abs. 3 AO)." },
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
        "Löschung erst nach Fristende und Freigabe durch die Geschäftsführung; Ablaufhemmungen klärt die Kanzlei. Buchungsbelege 10 Jahre, Handels- und Geschäftsbriefe 6 Jahre (§ 147 Abs. 1, 3 AO).",
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
    I02: b({ bestaetigung: f.gf, form: "Betriebliche Bestätigung im Intake" }),
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
  out.PZ03 = { status: "unbekannt", values: { ...(out.PZ03?.values ?? {}), getestet: "unbekannt" } };
  return out;
}

function bereicheKatalog(vorlage: keyof typeof VORLAGE_BEREICHE): Record<string, Entry> {
  const out: Record<string, Entry> = {};
  for (const bereich of VORLAGE_BEREICHE[vorlage]) {
    const muster = bereichMuster(bereich);
    if (!muster) continue;
    // Nur bereichsspezifische Fragen übernehmen (nicht den allgemeinen Teil der anderen Firma).
    for (const [id, entry] of Object.entries(muster.answers.katalog ?? {})) {
      if (/^(A|B|G|H|I)\d/.test(id)) continue;
      out[id] = entry;
    }
  }
  return out;
}

/**
 * Vorgeschlagene Antworten einer Branchenvorlage für das Intake
 * (nur Werte; Status setzt der Kunde).
 */
export function vorlageVorschlaege(vorlageId: string): Record<string, Record<string, unknown>> {
  const firma = MUSTER_FIRMEN[vorlageId as keyof typeof MUSTER_FIRMEN];
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

export function buildDenseGesamtAnswers(vorlage: "dienstleister" | "handel" | "ecommerce"): IntakeAnswers {
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
      answers = setModulEintrag(answers, modul.id, {
        status: "nicht_vorhanden",
        reason: `Laut Betriebs-Check nicht vorhanden (${modul.kurz}).`,
      });
    } else if (modul.id === "m11" && vorlage === "dienstleister") {
      // Beispiel: Anlagen über bestehende Dokumentation abgedeckt
      answers = setModulEintrag(answers, modul.id, {
        status: "extern",
        ref: "Interne Anlagenkartei und AfA-Liste der Kanzlei (Muster, fiktiv)",
        link: "Ablage: Ordner Anlagen auf dem NAS",
      });
    } else {
      answers = setModulEintrag(answers, modul.id, { status: "tool" });
    }
  }

  // Sicherstellen, dass jede tool-Frage mindestens einen Status hat.
  for (const modul of MODULE) {
    if (answers.module!.status[modul.id]?.status !== "tool") continue;
    for (const question of modulFragen(modul)) {
      if (!answers.katalog![question.id]?.status) {
        answers.katalog![question.id] = b(
          Object.fromEntries(
            question.fields.map((field) => [
              field.key,
              field.type === "multi"
                ? []
                : field.type === "enum"
                  ? "ja"
                  : `Angabe zum Musterbetrieb ${firma.company}: siehe Modul ${modul.nr}.`,
            ]),
          ),
        );
      }
    }
  }

  return answers;
}
