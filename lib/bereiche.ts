/**
 * Bereiche (business areas) for one Verfahrensdokumentation each.
 *
 * One company can keep several Verfahrensdokumentationen, one per area
 * (GoBD 2019 Rz. 151: a Verfahrensdokumentation for every DV-System).
 * Belegfluss is the original product and keeps catalog steps A–I.
 * Every other area shares the general part (A01, B, G, H, I) and adds two
 * area steps built from this file:
 *   1. „Abläufe“: the area-specific questions (prefix + 00…89)
 *   2. „Kontrollen, Zugriff und Archiv“: the frame questions every area gets
 *      (prefix + 90…96: Abgrenzung, Systeme, IKS, Z1–Z3, Änderungen, Ausfall, Archiv)
 *
 * Generator rule (same as the main catalog): only `bestaetigt` becomes a
 * present-tense fact; `geplant` and `unbekannt` become open points;
 * `nicht_zutreffend` prints the stored reason.
 *
 * Legal references are general hints. GoBD Randziffern only where certain.
 */
import { KONTROLLEN_HINWEIS, mitKeineKontrolle } from "@/lib/keine-angaben";

export type BereichField = {
  key: string;
  type: "text" | "textarea" | "enum" | "multi" | "date";
  label: string;
  required?: boolean;
  options?: string[];
};

export type BereichQuestion = {
  id: string;
  /** Short title for the PDF and the review list. */
  title: string;
  prompt: string;
  hint?: string;
  fields: BereichField[];
  /** Open-point text when the answer is geplant or unbekannt. */
  open: string;
  priority?: "hoch" | "mittel" | "niedrig";
  /** Frame question (Kontrollen, Zugriff, Archiv), asked on the second area step. */
  rahmen?: true;
};

export type BereichSection = {
  title: string;
  /** General, non-company hint. Printed as „Allgemeiner Hinweis“. */
  hinweis?: string;
  questions: string[];
};

/** One step of the area's process. `rolle` is `QID.fieldKey` of the person doing it. */
export type BereichSchritt = {
  schritt: string;
  beschreibung: string;
  frage: string;
  rolle?: string;
  nachweis: string;
};

export type BereichKontrolle = { name: string; zweck: string };

export type BereichFrist = { unterlage: string; frist: string; grundlage: string };

export type Bereich = {
  id: string;
  label: string;
  /** Title on the cover: „Verfahrensdokumentation <titel>“. */
  titel: string;
  kurz: string;
  /** Example systems for marketing and the picker. */
  beispiele: string;
  /** General scope paragraph for the overview section. */
  abgrenzung: string;
  questions: BereichQuestion[];
  sections: BereichSection[];
  prozess: BereichSchritt[];
  kontrollen: BereichKontrolle[];
  /** Retention by document type (no flat period for everything). */
  aufbewahrung: BereichFrist[];
  begriffe: Array<[string, string]>;
};

type BereichSpec = Omit<Bereich, "questions"> & { prefix: string; questions: BereichQuestion[] };

export const BELEGFLUSS = "belegfluss";

const text = (key: string, label: string, required = true): BereichField => ({
  key,
  type: "text",
  label,
  required,
});
const area = (key: string, label: string, required = true): BereichField => ({
  key,
  type: "textarea",
  label,
  required,
});
const pick = (key: string, label: string, options: string[]): BereichField => ({
  key,
  type: "enum",
  label,
  options,
});
const many = (key: string, label: string, options: string[]): BereichField => ({
  key,
  type: "multi",
  label,
  options,
});

const JA_NEIN_UNKLAR = ["ja", "nein", "unbekannt"];

const KEINE_PERSONENDATEN =
  "Bitte nur Abläufe, Rollen und Gruppen beschreiben. Keine Namen, Zeiten, Gehälter oder sonstigen Daten einzelner Beschäftigter eintragen.";

function lead(prefix: string, bereich: string): BereichQuestion {
  return {
    id: `${prefix}00`,
    title: "Verantwortung und Vertretung",
    prompt: `Wer ist für den Bereich ${bereich} verantwortlich und wer vertritt?`,
    hint: "Name oder Rolle genügt. Die Vertretung übernimmt bei Urlaub, Krankheit oder Ausscheiden.",
    fields: [text("verantwortlich", "Verantwortlich (Name oder Rolle)"), text("vertretung", "Vertretung", false)],
    open: `Verantwortung und Vertretung für den Bereich ${bereich} sind nicht bestätigt.`,
    priority: "hoch",
  };
}

/** Frame questions every non-Belegfluss area asks (ids prefix + 90…96). */
function rahmenFragen(prefix: string, label: string, kontrollen: BereichKontrolle[]): BereichQuestion[] {
  return [
    {
      id: `${prefix}90`,
      title: "Umfang und Abgrenzung",
      prompt: `Was umfasst diese Verfahrensdokumentation ${label} genau, und was ist ausgenommen?`,
      hint: "Zum Beispiel Standorte, Gesellschaften, Teilprozesse oder Zeiträume. Ausgenommene Teile mit dem Ort ihrer eigenen Dokumentation nennen.",
      fields: [area("umfang", "Umfang (Standorte, Teilprozesse)"), text("ausgenommen", "Ausgenommen und wo dokumentiert", false)],
      open: `Umfang und Abgrenzung der Verfahrensdokumentation ${label} sind nicht bestätigt.`,
      priority: "mittel",
      rahmen: true,
    },
    {
      id: `${prefix}91`,
      title: "Systeme und Schnittstellen",
      prompt: `Welche Systeme und Schnittstellen nutzt der Bereich ${label}?`,
      hint: "Je System: Name, Zweck, Anbieter. Je Schnittstelle: von wo nach wo, Format, Turnus, automatisch oder manuell.",
      fields: [
        area("systeme", "Systeme (Name, Zweck, Anbieter)"),
        area("schnittstellen", "Schnittstellen (von wo nach wo, Format, Turnus)", false),
        pick("betrieb", "Betrieb", ["Lokal installiert", "Cloud / Anbieter", "Gemischt"]),
      ],
      open: `Systeme und Schnittstellen im Bereich ${label} sind nicht bestätigt.`,
      priority: "hoch",
      rahmen: true,
    },
    {
      id: `${prefix}92`,
      title: "Kontrollen im Bereich",
      prompt: `Welche Kontrollen finden im Bereich ${label} heute tatsächlich statt?`,
      hint: KONTROLLEN_HINWEIS,
      fields: [
        many("kontrollen", "Durchgeführte Kontrollen", mitKeineKontrolle(kontrollen.map((item) => item.name))),
        area("details", "Turnus, wer, Nachweis je Kontrolle"),
      ],
      open: `Die Kontrollen im Bereich ${label} (Turnus, Person, Nachweis) sind nicht bestätigt.`,
      priority: "hoch",
      rahmen: true,
    },
    {
      id: `${prefix}93`,
      title: "Datenzugriff der Finanzverwaltung",
      prompt: `Wie kann die Finanzverwaltung bei einer Außenprüfung auf die Daten des Bereichs ${label} zugreifen?`,
      hint: "Z1: unmittelbarer Nur-Lesezugriff im System. Z2: mittelbarer Zugriff, das Unternehmen wertet nach Vorgabe aus. Z3: Überlassung der Daten in maschinell auswertbarer Form (§ 147 Abs. 6 AO).",
      fields: [
        many("arten", "Mögliche Zugriffsarten", [
          "Z1 Nur-Lesezugriff im System",
          "Z2 Auswertung nach Vorgabe",
          "Z3 Datenexport auf Datenträger",
        ]),
        text("format", "Exportformat (z. B. CSV, DATEV-Format)", false),
        pick("getestet", "Export praktisch geprüft", JA_NEIN_UNKLAR),
      ],
      open: `Datenzugriff (Z1–Z3) und Exportformat für den Bereich ${label} sind nicht bestätigt.`,
      priority: "mittel",
      rahmen: true,
    },
    {
      id: `${prefix}94`,
      title: "Änderungsmanagement",
      prompt: `Wer gibt Änderungen an Systemen, Einstellungen und Stammdaten im Bereich ${label} frei, und wie werden sie dokumentiert?`,
      hint: "Dazu zählen Updates, neue Schnittstellen, geänderte Steuersätze, Rechte oder Programmierungen.",
      fields: [
        text("freigabe", "Wer gibt Änderungen frei"),
        area("doku", "Dokumentation der Änderungen"),
        pick("protokoll", "System protokolliert Änderungen", JA_NEIN_UNKLAR),
      ],
      open: `Freigabe und Dokumentation von Änderungen im Bereich ${label} sind nicht bestätigt.`,
      priority: "mittel",
      rahmen: true,
    },
    {
      id: `${prefix}95`,
      title: "Ausfall und Notbetrieb",
      prompt: `Was passiert, wenn ein System im Bereich ${label} ausfällt?`,
      fields: [area("notbetrieb", "Vorgehen bei Ausfall"), text("nacherfassung", "Nacherfassung und Nachweis", false)],
      open: `Vorgehen bei Systemausfall im Bereich ${label} ist nicht bestätigt.`,
      priority: "niedrig",
      rahmen: true,
    },
    {
      id: `${prefix}96`,
      title: "Ablage und Archiv",
      prompt: `Wo und in welcher Form werden Unterlagen und Daten des Bereichs ${label} aufbewahrt, und wer gibt Löschungen frei?`,
      fields: [
        text("ort", "Ablageort"),
        text("form", "Form (Originaldatei, Export, Papier)", false),
        text("loeschung", "Wer gibt Löschungen frei", false),
      ],
      open: `Ablage, Aufbewahrungsform und Löschfreigabe im Bereich ${label} sind nicht bestätigt.`,
      priority: "mittel",
      rahmen: true,
    },
  ];
}

const FRIST_VD: BereichFrist = {
  unterlage: "Diese Verfahrensdokumentation, Arbeitsanweisungen und Organisationsunterlagen",
  frist: "10 Jahre",
  grundlage: "§ 147 Abs. 1 Nr. 1, Abs. 3 AO",
};
const FRIST_BELEG = (unterlage: string): BereichFrist => ({
  unterlage,
  frist: "8 Jahre",
  grundlage: "§ 147 Abs. 1 Nr. 4, Abs. 3 AO",
});
const FRIST_BRIEF = (unterlage: string): BereichFrist => ({
  unterlage,
  frist: "6 Jahre",
  grundlage: "§ 147 Abs. 1 Nr. 2, 3, Abs. 3 AO",
});
const FRIST_AUFZEICHNUNG = (unterlage: string): BereichFrist => ({
  unterlage,
  frist: "10 Jahre",
  grundlage: "§ 147 Abs. 1 Nr. 1, Abs. 3 AO",
});

function defineBereich(spec: BereichSpec): Bereich {
  const { prefix, ...rest } = spec;
  return {
    ...rest,
    questions: [...spec.questions, ...rahmenFragen(prefix, spec.label, spec.kontrollen)],
    aufbewahrung: [...spec.aufbewahrung, FRIST_VD],
  };
}

const KASSE = defineBereich({
  id: "kasse",
  prefix: "KA",
  label: "Kasse",
  titel: "Kasse und Kassensystem",
  kurz: "Kassensystem mit TSE oder offene Ladenkasse, Tagesabschluss, Kassenbuch, Übergabe an die Buchhaltung.",
  beispiele: "Registrierkasse, POS-System, Tablet-Kasse, offene Ladenkasse",
  abgrenzung:
    "Erfasst sind alle Bargeschäfte und die an der Kasse erfassten unbaren Zahlungen (z. B. Karte) von der Kassenöffnung bis zur Übergabe an die Buchhaltung. Die Erfassung der Eingangs- und Ausgangsrechnungen beschreibt die Verfahrensdokumentation Belegfluss.",
  questions: [
    lead("KA", "Kasse"),
    {
      id: "KA01",
      title: "Kassenart",
      prompt: "Welche Kasse wird eingesetzt, und an wie vielen Standorten?",
      fields: [
        pick("kassenart", "Art", ["Elektronisches Kassensystem mit TSE", "Offene Ladenkasse (ohne Kassensystem)", "Beides"]),
        text("system", "Hersteller und Software", false),
        text("anzahl", "Anzahl Kassen und Standorte", false),
      ],
      open: "Art der Kasse, Hersteller und Anzahl sind nicht bestätigt.",
      priority: "hoch",
    },
    {
      id: "KA02",
      title: "TSE und Mitteilung",
      prompt: "Ist eine zertifizierte TSE im Einsatz und wurde das System dem Finanzamt mitgeteilt?",
      hint: "Elektronische Aufzeichnungssysteme brauchen eine zertifizierte technische Sicherheitseinrichtung (§ 146a AO, KassenSichV). Die Mitteilung nach § 146a Abs. 4 AO läuft über ELSTER.",
      fields: [
        text("tse", "TSE-Art (z. B. USB, SD, Cloud-TSE)", false),
        pick("zertifikat", "BSI-Zertifikat der TSE liegt vor", JA_NEIN_UNKLAR),
        pick("mitteilung", "Mitteilung über ELSTER erfolgt", JA_NEIN_UNKLAR),
      ],
      open: "TSE, Zertifikat und Mitteilung des Kassensystems an das Finanzamt sind nicht bestätigt.",
      priority: "hoch",
    },
    {
      id: "KA03",
      title: "Belegausgabe",
      prompt: "Wie wird Kundinnen und Kunden ein Beleg zur Verfügung gestellt?",
      hint: "Bei elektronischen Aufzeichnungssystemen besteht eine Belegausgabepflicht (§ 146a Abs. 2 AO). Eine Befreiung ist nur auf Antrag möglich (§ 148 AO).",
      fields: [
        many("beleg", "Belegausgabe", ["Papierbon", "Elektronischer Beleg (QR, E-Mail, App)", "Kein Beleg (offene Ladenkasse)"]),
        pick("befreiung", "Befreiung von der Belegausgabepflicht beantragt", JA_NEIN_UNKLAR),
      ],
      open: "Die Belegausgabe ist nicht bestätigt.",
    },
    {
      id: "KA04",
      title: "Kassenöffnung und Bedienende",
      prompt: "Wie wird die Kasse geöffnet (Anfangsbestand, Wechselgeld), und wie werden Bedienende zugeordnet?",
      fields: [
        area("ablauf", "Ablauf der Kassenöffnung"),
        pick("bediener", "Bedienerkennung", ["Eigene Bedienerkennung je Person", "Gemeinsame Bedienerkennung", "Keine Bedienerkennung"]),
      ],
      open: "Kassenöffnung, Wechselgeld und Bedienerzuordnung sind nicht bestätigt.",
    },
    {
      id: "KA05",
      title: "Tagesabschluss",
      prompt: "Wie läuft der Tagesabschluss: Z-Bon oder Kassenbericht, Zählung, Differenzen?",
      hint: "Bei der offenen Ladenkasse: täglicher Kassenbericht, ein Zählprotokoll erleichtert den Nachweis. Beim Kassensystem: Tagesabschluss (Z-Bon) und Abgleich mit dem gezählten Bestand.",
      fields: [
        area("ablauf", "Ablauf Tagesabschluss"),
        text("wer", "Wer zählt und schließt ab"),
        text("differenzen", "Umgang mit Kassendifferenzen", false),
      ],
      open: "Tagesabschluss, Zählung und Umgang mit Differenzen sind nicht bestätigt.",
      priority: "hoch",
    },
    {
      id: "KA06",
      title: "Kassenbuch oder Kassenbericht",
      prompt: "Wie und von wem wird das Kassenbuch bzw. der Kassenbericht geführt?",
      hint: "Kasseneinnahmen und Kassenausgaben sind täglich festzuhalten (§ 146 Abs. 1 AO).",
      fields: [
        pick("art", "Form", [
          "Kassenbuch im Kassensystem",
          "Kassenbuch in FiBu oder Kassenbuch-Software",
          "Kassenbericht (offene Ladenkasse)",
          "Kassenbuch auf Papier",
        ]),
        text("wer", "Wer führt"),
        pick("zaehlprotokoll", "Zählprotokoll wird erstellt", JA_NEIN_UNKLAR),
      ],
      open: "Form und Führung des Kassenbuchs bzw. Kassenberichts sind nicht bestätigt.",
      priority: "hoch",
    },
    {
      id: "KA07",
      title: "Einlagen, Entnahmen, Sonderfälle",
      prompt: "Wie werden Einlagen, Entnahmen, Trinkgeld, Gutscheine, Storni und Retouren an der Kasse erfasst?",
      fields: [area("sonderfaelle", "Erfassung der Sonderfälle"), text("freigabe", "Wer gibt Storni frei", false)],
      open: "Erfassung von Einlagen, Entnahmen, Trinkgeld, Gutscheinen und Storni ist nicht bestätigt.",
    },
    {
      id: "KA08",
      title: "Bargeldtransfer",
      prompt: "Wie werden Abschöpfungen, Geldtransit und Bankeinzahlungen festgehalten?",
      fields: [area("ablauf", "Ablauf"), text("beleg", "Beleg (z. B. Einzahlungsquittung)", false)],
      open: "Bargeldtransfer und Bankeinzahlungen sind nicht bestätigt.",
    },
    {
      id: "KA09",
      title: "Programmierung und Organisationsunterlagen",
      prompt: "Wer ändert Artikel, Preise, Warengruppen oder Programmierung, und wo liegen Bedienungsanleitung und Programmierprotokolle?",
      hint: "Bedienungsanleitungen, Programmier- und Änderungsprotokolle gehören zu den Organisationsunterlagen des Kassensystems.",
      fields: [
        text("wer", "Wer darf ändern"),
        pick("protokolliert", "Änderungen werden protokolliert", JA_NEIN_UNKLAR),
        text("ablage", "Ablage der Organisationsunterlagen", false),
      ],
      open: "Änderungen am Kassensystem und die Ablage der Organisationsunterlagen sind nicht bestätigt.",
    },
    {
      id: "KA10",
      title: "Übergabe an die Buchhaltung",
      prompt: "Wie gelangen Kassendaten in die Buchhaltung (Export, Kassenbuch, Turnus)?",
      fields: [
        area("uebergabe", "Weg der Übergabe"),
        text("turnus", "Turnus", false),
        pick("dsfinvk", "DSFinV-K-Export ist möglich und getestet", JA_NEIN_UNKLAR),
      ],
      open: "Übergabe der Kassendaten an die Buchhaltung ist nicht bestätigt.",
    },
    {
      id: "KA11",
      title: "Kassen-Nachschau",
      prompt: "Wer ist bei einer Kassen-Nachschau ansprechbar und wie wird der Datenzugriff gewährt?",
      fields: [text("ansprechpartner", "Ansprechperson vor Ort"), text("zugriff", "Datenzugriff / Export", false)],
      open: "Ansprechperson und Datenzugriff bei einer Kassen-Nachschau sind nicht bestätigt.",
    },
  ],
  sections: [
    {
      title: "Kassensystem und TSE",
      hinweis:
        "Elektronische Aufzeichnungssysteme müssen jede Aufzeichnung einzeln, vollständig, richtig, zeitgerecht und geordnet erfassen und durch eine zertifizierte technische Sicherheitseinrichtung schützen (§ 146 Abs. 1, § 146a AO, KassenSichV).",
      questions: ["KA01", "KA02"],
    },
    {
      title: "Belegausgabe",
      questions: ["KA03"],
    },
    {
      title: "Kassenöffnung, Tagesabschluss und Kassenbuch",
      hinweis:
        "Bei einer offenen Ladenkasse ohne elektronisches Aufzeichnungssystem entfällt die Einzelaufzeichnungspflicht beim Verkauf von Waren an eine Vielzahl nicht bekannter Personen gegen Barzahlung (§ 146 Abs. 1 AO); dann ist ein täglicher Kassenbericht zu führen.",
      questions: ["KA04", "KA05", "KA06"],
    },
    {
      title: "Sonderfälle und Bargeldtransfer",
      questions: ["KA07", "KA08"],
    },
    {
      title: "Programmierung und Organisationsunterlagen",
      questions: ["KA09"],
    },
    {
      title: "Übergabe an die Buchhaltung",
      hinweis:
        "Die Digitale Schnittstelle der Finanzverwaltung für Kassensysteme (DSFinV-K) beschreibt den Export der Kassendaten für Außenprüfung und Kassen-Nachschau.",
      questions: ["KA10"],
    },
    {
      title: "Kassen-Nachschau",
      hinweis: "Eine Kassen-Nachschau (§ 146b AO) kann ohne vorherige Ankündigung während der üblichen Geschäftszeiten stattfinden.",
      questions: ["KA11"],
    },
  ],
  prozess: [
    { schritt: "Kassenöffnung", beschreibung: "Anfangsbestand prüfen, Bedienende anmelden", frage: "KA04", nachweis: "Anfangsbestand im System oder Kassenbericht" },
    { schritt: "Verkauf und Erfassung", beschreibung: "Jeder Geschäftsvorfall wird einzeln erfasst und durch die TSE abgesichert", frage: "KA02", nachweis: "Einzelaufzeichnung mit TSE-Signatur" },
    { schritt: "Belegausgabe", beschreibung: "Beleg an Kundin oder Kunden", frage: "KA03", nachweis: "Papierbon oder elektronischer Beleg" },
    { schritt: "Sonderfälle", beschreibung: "Storno, Retoure, Gutschein, Einlage, Entnahme", frage: "KA07", rolle: "KA07.freigabe", nachweis: "Storno- bzw. Einlage-/Entnahmebeleg" },
    { schritt: "Tagesabschluss", beschreibung: "Zählen, Z-Bon oder Kassenbericht, Differenz klären", frage: "KA05", rolle: "KA05.wer", nachweis: "Z-Bon, Zählprotokoll" },
    { schritt: "Kassenbuch", beschreibung: "Tägliche Einnahmen und Ausgaben festhalten", frage: "KA06", rolle: "KA06.wer", nachweis: "Kassenbuch oder Kassenbericht" },
    { schritt: "Bargeldtransfer", beschreibung: "Abschöpfung und Bankeinzahlung", frage: "KA08", nachweis: "Einzahlungsquittung, Kontoauszug" },
    { schritt: "Übergabe an die Buchhaltung", beschreibung: "Export oder Kassenbuch an die Buchhaltung", frage: "KA10", nachweis: "Exportdatei, Buchungsstapel" },
    { schritt: "Archivierung", beschreibung: "Kassendaten maschinell auswertbar aufbewahren", frage: "KA96", nachweis: "Archiv bzw. DSFinV-K-Export" },
  ],
  kontrollen: [
    { name: "Täglicher Kassensturz (Soll-Ist-Abgleich)", zweck: "Kassendifferenzen zeitnah erkennen und klären" },
    { name: "Abgleich Z-Bon mit Kassenbuch und Bankeinzahlung", zweck: "Vollständige Übernahme der Tageseinnahmen" },
    { name: "Durchsicht der Storno- und Retourenliste", zweck: "Fehler und unberechtigte Storni erkennen" },
    { name: "Prüfung der TSE-Funktion (Signatur auf dem Beleg)", zweck: "Ausfall der Sicherheitseinrichtung erkennen" },
    { name: "Prüfung der Z-Bon-Nummernfolge auf Lücken", zweck: "Vollständigkeit der Tagesabschlüsse" },
    { name: "Abgleich Kartenzahlungen mit der Abrechnung des Zahlungsdienstleisters", zweck: "Unbare Umsätze vollständig und richtig übernehmen" },
    { name: "Durchsicht der Bedienerberechtigungen", zweck: "Zurechenbarkeit der Eingaben sichern" },
  ],
  aufbewahrung: [
    FRIST_AUFZEICHNUNG("Einzelaufzeichnungen des Kassensystems einschließlich TSE-Daten, maschinell auswertbar"),
    FRIST_AUFZEICHNUNG("Kassenbuch"),
    {
      unterlage: "Tagesabschlüsse (Z-Bons), Kassenberichte und Zählprotokolle",
      frist: "8 Jahre als Buchungsbeleg; als Aufzeichnung 10 Jahre, im Zweifel die längere Frist",
      grundlage: "§ 147 Abs. 1 Nr. 1, 4, Abs. 3 AO",
    },
    FRIST_AUFZEICHNUNG("Bedienungsanleitungen, Programmier- und Änderungsprotokolle des Kassensystems"),
    FRIST_BELEG("Einzahlungsquittungen, Einlage- und Entnahmebelege"),
  ],
  begriffe: [
    ["TSE", "Technische Sicherheitseinrichtung, die Aufzeichnungen des Kassensystems manipulationssicher protokolliert (§ 146a AO)"],
    ["Z-Bon", "Tagesabschluss des Kassensystems mit Umsatzsummen und Zahlarten"],
    ["Offene Ladenkasse", "Kasse ohne elektronisches Aufzeichnungssystem; Tageseinnahmen werden über den Kassenbericht ermittelt"],
    ["DSFinV-K", "Digitale Schnittstelle der Finanzverwaltung für Kassensysteme (Exportformat)"],
    ["Kassen-Nachschau", "Unangekündigte Prüfung der Kassenführung durch das Finanzamt (§ 146b AO)"],
    ["Kassensturz", "Zählung des Bargeldbestands und Abgleich mit dem rechnerischen Sollbestand"],
  ],
});

const WARENWIRTSCHAFT = defineBereich({
  id: "warenwirtschaft",
  prefix: "WW",
  label: "Warenwirtschaft",
  titel: "Warenwirtschaft, Lager und Inventur",
  kurz: "Artikelstamm, Wareneingang und -ausgang, Bestandsführung, Bestandskorrekturen, Inventur, Übergabe an die Buchhaltung.",
  beispiele: "Warenwirtschaftssystem, ERP, Lagerverwaltung, Excel-Bestandsliste",
  abgrenzung:
    "Erfasst sind Artikelstammdaten, Warenbewegungen, Bestandsführung und Inventur bis zur Übergabe der Bestandswerte an die Buchhaltung. Bestellung und Rechnungsprüfung beschreiben die Verfahrensdokumentationen Einkauf und Belegfluss.",
  questions: [
    lead("WW", "Warenwirtschaft"),
    {
      id: "WW01",
      title: "System",
      prompt: "Welches System führt Artikel und Bestände, und welche Vorgänge werden darin erfasst?",
      fields: [text("system", "System"), area("vorgaenge", "Erfasste Vorgänge")],
      open: "Warenwirtschaftssystem und erfasste Vorgänge sind nicht bestätigt.",
      priority: "hoch",
    },
    {
      id: "WW02",
      title: "Artikelstammdaten und Preise",
      prompt: "Wer legt Artikel an und ändert Einkaufs- und Verkaufspreise, und werden Änderungen protokolliert?",
      fields: [
        text("wer", "Wer pflegt Artikel und Preise"),
        text("freigabe", "Wer gibt Preisänderungen frei", false),
        pick("protokolliert", "Änderungen werden protokolliert", JA_NEIN_UNKLAR),
      ],
      open: "Pflege der Artikelstammdaten und Preisänderungen sind nicht bestätigt.",
    },
    {
      id: "WW03",
      title: "Wareneingang",
      prompt: "Wie wird der Wareneingang erfasst und mit Lieferschein und Bestellung abgeglichen?",
      fields: [area("ablauf", "Ablauf"), text("wer", "Wer erfasst")],
      open: "Erfassung des Wareneingangs ist nicht bestätigt.",
      priority: "hoch",
    },
    {
      id: "WW04",
      title: "Warenausgang",
      prompt: "Wie wird der Warenausgang (Verkauf, Versand, Eigenverbrauch) im Bestand erfasst?",
      fields: [area("ablauf", "Ablauf"), text("wer", "Wer erfasst", false)],
      open: "Erfassung des Warenausgangs ist nicht bestätigt.",
    },
    {
      id: "WW05",
      title: "Bestandsführung und Bewertung",
      prompt: "Wie werden Bestände geführt und bewertet?",
      hint: "Die Bewertung folgt den handels- und steuerrechtlichen Vorgaben (z. B. Anschaffungskosten, Durchschnittsbewertung). Das Verfahren wird hier nur beschrieben, nicht beurteilt.",
      fields: [
        pick("fuehrung", "Bestandsführung", ["Laufend im System", "Nur zur Inventur", "Gemischt"]),
        text("bewertung", "Bewertungsverfahren (z. B. Durchschnitt, Einzelbewertung)", false),
      ],
      open: "Bestandsführung und Bewertung sind nicht bestätigt.",
    },
    {
      id: "WW06",
      title: "Lagerorte und Umlagerungen",
      prompt: "Gibt es mehrere Lagerorte, und wie werden Umlagerungen gebucht?",
      fields: [text("lagerorte", "Lagerorte"), area("umlagerung", "Buchung von Umlagerungen", false)],
      open: "Lagerorte und Umlagerungen sind nicht bestätigt.",
    },
    {
      id: "WW07",
      title: "Bestandskorrekturen",
      prompt: "Wer bucht Schwund, Verderb, Bruch oder Korrekturen, und wer gibt sie frei?",
      fields: [
        text("wer", "Wer bucht"),
        text("freigabe", "Wer gibt frei", false),
        pick("grund", "Korrekturgrund wird erfasst", JA_NEIN_UNKLAR),
      ],
      open: "Bestandskorrekturen und deren Freigabe sind nicht bestätigt.",
      priority: "hoch",
    },
    {
      id: "WW08",
      title: "Inventur",
      prompt: "Welches Inventurverfahren wird angewendet, wer zählt, und wo bleiben die Zähllisten?",
      hint: "Möglich sind Stichtagsinventur, permanente Inventur, vor- oder nachverlegte Inventur oder Stichprobeninventur (§§ 240, 241 HGB).",
      fields: [
        pick("verfahren", "Verfahren", ["Stichtagsinventur", "Permanente Inventur", "Vor- oder nachverlegte Inventur", "Stichprobeninventur", "Andere"]),
        text("wer", "Wer zählt und prüft"),
        text("stichtag", "Stichtag oder Zeitraum", false),
        text("zaehllisten", "Ablage der Zähllisten", false),
      ],
      open: "Inventurverfahren, Zuständigkeit und Ablage der Zähllisten sind nicht bestätigt.",
      priority: "hoch",
    },
    {
      id: "WW09",
      title: "Inventurdifferenzen",
      prompt: "Wie werden Inventurdifferenzen geklärt, freigegeben und gebucht?",
      fields: [area("ablauf", "Ablauf der Klärung"), text("freigabe", "Wer gibt die Differenzbuchung frei")],
      open: "Klärung und Freigabe von Inventurdifferenzen sind nicht bestätigt.",
    },
    {
      id: "WW10",
      title: "Übergabe an die Buchhaltung",
      prompt: "Wie gelangen Bestandswerte und Inventurergebnis in die Buchhaltung?",
      fields: [area("uebergabe", "Weg der Übergabe"), text("turnus", "Turnus", false)],
      open: "Übergabe von Bestandswerten an die Buchhaltung ist nicht bestätigt.",
    },
  ],
  sections: [
    { title: "System und Artikelstammdaten", questions: ["WW01", "WW02"] },
    { title: "Wareneingang und Warenausgang", questions: ["WW03", "WW04"] },
    { title: "Bestandsführung, Lagerorte und Korrekturen", questions: ["WW05", "WW06", "WW07"] },
    {
      title: "Inventur",
      hinweis:
        "Das Inventar ist zum Schluss jedes Geschäftsjahres aufzustellen (§ 240 Abs. 2 HGB). Vereinfachungsverfahren sind nach § 241 HGB zulässig, wenn sie den Grundsätzen ordnungsmäßiger Buchführung entsprechen.",
      questions: ["WW08", "WW09"],
    },
    { title: "Übergabe an die Buchhaltung", questions: ["WW10"] },
  ],
  prozess: [
    { schritt: "Artikelanlage", beschreibung: "Artikel und Preise anlegen oder ändern", frage: "WW02", rolle: "WW02.wer", nachweis: "Artikelstamm, Änderungsprotokoll" },
    { schritt: "Wareneingang", beschreibung: "Ware gegen Lieferschein und Bestellung prüfen und buchen", frage: "WW03", rolle: "WW03.wer", nachweis: "Wareneingangsbuchung, Lieferschein" },
    { schritt: "Einlagerung und Umlagerung", beschreibung: "Lagerort zuordnen, Umlagerungen buchen", frage: "WW06", nachweis: "Lagerbewegung im System" },
    { schritt: "Warenausgang", beschreibung: "Verkauf, Versand oder Entnahme im Bestand buchen", frage: "WW04", rolle: "WW04.wer", nachweis: "Ausgangsbuchung, Lieferschein" },
    { schritt: "Bestandskorrektur", beschreibung: "Schwund, Verderb, Bruch mit Grund erfassen und freigeben", frage: "WW07", rolle: "WW07.freigabe", nachweis: "Korrekturbuchung mit Grund" },
    { schritt: "Inventur", beschreibung: "Bestand zählen und mit dem Buchbestand vergleichen", frage: "WW08", rolle: "WW08.wer", nachweis: "Zählliste, Inventurprotokoll" },
    { schritt: "Differenzklärung", beschreibung: "Inventurdifferenzen klären und freigeben", frage: "WW09", rolle: "WW09.freigabe", nachweis: "Differenzliste mit Freigabe" },
    { schritt: "Bewertung", beschreibung: "Bestände nach dem festgelegten Verfahren bewerten", frage: "WW05", nachweis: "Bewertungsliste" },
    { schritt: "Übergabe an die Buchhaltung", beschreibung: "Bestandswert und Bestandsveränderung übergeben", frage: "WW10", nachweis: "Bestandsliste, Buchungsbeleg" },
  ],
  kontrollen: [
    { name: "Abgleich Wareneingang mit Lieferschein und Bestellung", zweck: "Nur tatsächlich gelieferte Ware wird gebucht" },
    { name: "Freigabe von Bestandskorrekturen im Vier-Augen-Prinzip", zweck: "Unberechtigte Ausbuchungen verhindern" },
    { name: "Unterjährige Stichprobenzählung", zweck: "Bestandsabweichungen früh erkennen" },
    { name: "Abgleich Bestandswert der Warenwirtschaft mit der FiBu", zweck: "Übereinstimmung von Nebenbuch und Hauptbuch" },
    { name: "Durchsicht des Preisänderungsprotokolls", zweck: "Nachvollziehbare Preisänderungen" },
    { name: "Prüfung negativer Bestände", zweck: "Fehlende Wareneingangs- oder Ausgangsbuchungen erkennen" },
  ],
  aufbewahrung: [
    {
      unterlage: "Inventare, Zähllisten und Inventurprotokolle",
      frist: "10 Jahre",
      grundlage: "§ 147 Abs. 1 Nr. 1, Abs. 3 AO; § 257 Abs. 1 Nr. 1, Abs. 4 HGB",
    },
    FRIST_AUFZEICHNUNG("Bestandsaufzeichnungen der Warenwirtschaft (Lagerbuchführung), maschinell auswertbar"),
    FRIST_BELEG("Bestandskorrektur- und Bewertungsbelege, soweit sie Buchungsbelege sind"),
    {
      unterlage: "Lieferscheine, die keine Buchungsbelege sind",
      frist: "bis Erhalt bzw. Versand der Rechnung",
      grundlage: "§ 147 Abs. 3 AO",
    },
    FRIST_AUFZEICHNUNG("Inventuranweisung und sonstige Organisationsunterlagen der Inventur"),
  ],
  begriffe: [
    ["Inventur", "Körperliche Bestandsaufnahme durch Zählen, Messen oder Wiegen"],
    ["Inventar", "Verzeichnis der Vermögensgegenstände und Schulden zum Stichtag (§ 240 HGB)"],
    ["Permanente Inventur", "Bestandsaufnahme verteilt über das Jahr auf Grundlage einer laufenden Bestandsführung (§ 241 Abs. 2 HGB)"],
    ["Stichprobeninventur", "Inventur mit anerkannten mathematisch-statistischen Methoden (§ 241 Abs. 1 HGB)"],
    ["Bestandskorrektur", "Buchung, die den Buchbestand an den tatsächlichen Bestand anpasst"],
    ["Buchbestand", "Rechnerischer Bestand aus Anfangsbestand, Zugängen und Abgängen"],
  ],
});

const EINKAUF = defineBereich({
  id: "einkauf",
  prefix: "EK",
  label: "Einkauf",
  titel: "Einkauf und Bestellwesen",
  kurz: "Bedarf, Bestellung, Freigabegrenzen, Auftragsbestätigung, Abgleich Bestellung–Lieferung–Rechnung, Lieferantenstammdaten.",
  beispiele: "ERP-Bestellmodul, Lieferantenportale, E-Mail-Bestellungen",
  abgrenzung:
    "Erfasst ist der Weg vom Bedarf über Bestellung und Lieferung bis zur sachlichen Freigabe der Eingangsrechnung. Eingang, Prüfung und Buchung der Rechnung selbst beschreibt die Verfahrensdokumentation Belegfluss.",
  questions: [
    lead("EK", "Einkauf"),
    {
      id: "EK01",
      title: "Bedarfsmeldung",
      prompt: "Wie entsteht ein Bestellbedarf, und wer meldet ihn?",
      fields: [area("ablauf", "Ablauf"), text("wer", "Wer meldet", false)],
      open: "Entstehung und Meldung des Bestellbedarfs sind nicht bestätigt.",
    },
    {
      id: "EK02",
      title: "Bestellberechtigung",
      prompt: "Wer darf bestellen, und ab welchem Betrag ist eine Freigabe nötig?",
      fields: [text("wer", "Wer bestellt"), text("grenzen", "Freigabegrenzen", false), text("freigabe", "Wer gibt frei", false)],
      open: "Bestellberechtigung und Freigabegrenzen sind nicht bestätigt.",
      priority: "hoch",
    },
    {
      id: "EK03",
      title: "Bestellweg",
      prompt: "Über welche Wege und Systeme wird bestellt?",
      fields: [many("wege", "Bestellwege", ["ERP / Warenwirtschaft", "Lieferantenportal", "E-Mail", "Telefon", "Papier"]), text("system", "System", false)],
      open: "Bestellwege und System sind nicht bestätigt.",
    },
    {
      id: "EK04",
      title: "Auftragsbestätigung",
      prompt: "Wie werden Auftragsbestätigungen geprüft, und wie wird mit Abweichungen umgegangen?",
      fields: [text("wer", "Wer prüft"), area("abweichungen", "Umgang mit Abweichungen", false)],
      open: "Prüfung der Auftragsbestätigungen ist nicht bestätigt.",
    },
    {
      id: "EK05",
      title: "Wareneingang und Leistungsnachweis",
      prompt: "Wie wird bestätigt, dass Ware oder Leistung tatsächlich eingegangen ist?",
      fields: [area("ablauf", "Ablauf"), text("wer", "Wer bestätigt")],
      open: "Bestätigung von Wareneingang und Leistung ist nicht bestätigt.",
    },
    {
      id: "EK06",
      title: "Abgleich Bestellung, Lieferung, Rechnung",
      prompt: "Wie werden Bestellung, Lieferung und Rechnung abgeglichen, bevor die Rechnung freigegeben wird?",
      fields: [area("ablauf", "Ablauf"), text("wer", "Wer gleicht ab")],
      open: "Der Abgleich von Bestellung, Lieferung und Rechnung ist nicht bestätigt.",
      priority: "hoch",
    },
    {
      id: "EK07",
      title: "Lieferantenstammdaten",
      prompt: "Wer legt Lieferanten an und ändert Bankverbindungen, und gilt dafür ein Vier-Augen-Prinzip?",
      hint: "Geänderte Bankverbindungen sind ein häufiger Betrugsweg. Ein Rückruf beim Lieferanten über eine bekannte Nummer ist eine übliche Kontrolle.",
      fields: [text("wer", "Wer pflegt"), pick("vierAugen", "Bankdatenänderung im Vier-Augen-Prinzip", JA_NEIN_UNKLAR)],
      open: "Pflege der Lieferantenstammdaten und Kontrolle von Bankdatenänderungen sind nicht bestätigt.",
      priority: "hoch",
    },
    {
      id: "EK08",
      title: "Rahmenverträge und Abonnements",
      prompt: "Gibt es Rahmenverträge, Abonnements oder Daueraufträge, und wer überwacht Laufzeit und Abrechnung?",
      fields: [area("vertraege", "Verträge und Überwachung"), text("wer", "Wer überwacht", false)],
      open: "Überwachung von Rahmenverträgen und Abonnements ist nicht bestätigt.",
    },
    {
      id: "EK09",
      title: "Anzahlungen",
      prompt: "Wie werden Anzahlungen und Vorkasse an Lieferanten freigegeben und bis zur Schlussrechnung überwacht?",
      fields: [area("ablauf", "Ablauf"), text("freigabe", "Wer gibt frei", false)],
      open: "Freigabe und Überwachung von Anzahlungen sind nicht bestätigt.",
    },
    {
      id: "EK10",
      title: "Ablage der Einkaufsunterlagen",
      prompt: "Wo werden Bestellungen, Auftragsbestätigungen, Lieferscheine und Verträge abgelegt?",
      fields: [text("ablage", "Ablageort"), text("ordnung", "Ordnung (z. B. Bestellnummer)", false)],
      open: "Ablage von Bestellungen, Auftragsbestätigungen und Lieferscheinen ist nicht bestätigt.",
    },
  ],
  sections: [
    { title: "Bedarf, Bestellung und Freigabe", questions: ["EK01", "EK02", "EK03"] },
    { title: "Auftragsbestätigung und Wareneingang", questions: ["EK04", "EK05"] },
    {
      title: "Rechnungsabgleich",
      hinweis:
        "Der Vorsteuerabzug setzt eine Rechnung mit den Angaben nach § 14 Abs. 4 UStG voraus (§ 15 Abs. 1 UStG). Der Abgleich mit Bestellung und Lieferung stützt die sachliche Richtigkeit.",
      questions: ["EK06"],
    },
    { title: "Lieferantenstammdaten", questions: ["EK07"] },
    { title: "Verträge, Anzahlungen und Ablage", questions: ["EK08", "EK09", "EK10"] },
  ],
  prozess: [
    { schritt: "Bedarf", beschreibung: "Bedarf erkennen und melden", frage: "EK01", rolle: "EK01.wer", nachweis: "Bedarfsmeldung" },
    { schritt: "Bestellung", beschreibung: "Bestellung im Rahmen der Freigabegrenzen auslösen", frage: "EK02", rolle: "EK02.wer", nachweis: "Bestellung mit Nummer" },
    { schritt: "Freigabe", beschreibung: "Freigabe oberhalb der Wertgrenze", frage: "EK02", rolle: "EK02.freigabe", nachweis: "Freigabevermerk" },
    { schritt: "Auftragsbestätigung", beschreibung: "Bestätigung mit Bestellung vergleichen", frage: "EK04", rolle: "EK04.wer", nachweis: "Auftragsbestätigung mit Prüfvermerk" },
    { schritt: "Wareneingang", beschreibung: "Lieferung oder Leistung bestätigen", frage: "EK05", rolle: "EK05.wer", nachweis: "Lieferschein, Leistungsnachweis" },
    { schritt: "Rechnungsabgleich", beschreibung: "Bestellung, Lieferung und Rechnung abgleichen", frage: "EK06", rolle: "EK06.wer", nachweis: "Abgleichvermerk" },
    { schritt: "Stammdatenpflege", beschreibung: "Lieferanten und Bankdaten anlegen oder ändern", frage: "EK07", rolle: "EK07.wer", nachweis: "Änderungsprotokoll" },
    { schritt: "Ablage", beschreibung: "Einkaufsunterlagen geordnet ablegen", frage: "EK10", nachweis: "Ablage nach Bestellnummer" },
  ],
  kontrollen: [
    { name: "Freigabe nach Wertgrenzen", zweck: "Bestellungen nur im Rahmen der Berechtigung" },
    { name: "Drei-Wege-Abgleich Bestellung, Lieferung, Rechnung", zweck: "Nur bestellte und gelieferte Leistungen werden bezahlt" },
    { name: "Vier-Augen-Prüfung bei Bankdatenänderungen", zweck: "Zahlungsumleitung verhindern" },
    { name: "Rückruf beim Lieferanten bei geänderter Bankverbindung", zweck: "Betrugsversuche erkennen" },
    { name: "Durchsicht offener Bestellungen", zweck: "Fehlende Lieferungen oder Rechnungen erkennen" },
    { name: "Dublettenprüfung bei Lieferanten und Rechnungen", zweck: "Doppelzahlungen verhindern" },
  ],
  aufbewahrung: [
    {
      unterlage: "Bestellungen und Auftragsbestätigungen (Handels- und Geschäftsbriefe)",
      frist: "6 Jahre",
      grundlage: "§ 147 Abs. 1 Nr. 2, 3, Abs. 3 AO; § 257 Abs. 1 Nr. 2, 3, Abs. 4 HGB",
    },
    FRIST_BELEG("Eingangsrechnungen und Anzahlungsrechnungen"),
    { unterlage: "Lieferscheine, die keine Buchungsbelege sind", frist: "bis Erhalt der Rechnung", grundlage: "§ 147 Abs. 3 AO" },
    {
      unterlage: "Verträge und sonstige Unterlagen, soweit für die Besteuerung von Bedeutung",
      frist: "6 Jahre",
      grundlage: "§ 147 Abs. 1 Nr. 5, Abs. 3 AO",
    },
  ],
  begriffe: [
    ["Drei-Wege-Abgleich", "Vergleich von Bestellung, Lieferung und Rechnung vor der Freigabe"],
    ["Freigabegrenze", "Betrag, ab dem eine weitere Person eine Bestellung freigeben muss"],
    ["Auftragsbestätigung", "Bestätigung der Bestellung durch den Lieferanten"],
    ["Lieferantenstamm", "Stammdaten eines Lieferanten einschließlich Bankverbindung"],
    ["Rahmenvertrag", "Vertrag mit festen Konditionen, aus dem einzelne Abrufe erfolgen"],
  ],
});

const VERKAUF = defineBereich({
  id: "verkauf",
  prefix: "VK",
  label: "Verkauf",
  titel: "Verkauf und Fakturierung",
  kurz: "Angebot, Auftrag, Lieferung, Rechnung, Nummernkreise, Rechnungsversand, Korrekturen, Mahnwesen.",
  beispiele: "Faktura- oder Auftragssoftware, ERP, Rechnungsprogramm der FiBu",
  abgrenzung:
    "Erfasst ist der Weg vom Angebot über Auftrag und Lieferung bis zur Rechnung, zum Zahlungseingang und zur Übergabe an die Buchhaltung. Rücksendungen beschreibt die Verfahrensdokumentation Retouren, Barverkäufe die Verfahrensdokumentation Kasse.",
  questions: [
    lead("VK", "Verkauf"),
    {
      id: "VK01",
      title: "Ablauf und System",
      prompt: "Wie läuft der Weg von Angebot über Auftrag und Lieferung zur Rechnung, und in welchem System?",
      fields: [area("ablauf", "Ablauf"), text("system", "System")],
      open: "Ablauf und System von Angebot bis Rechnung sind nicht bestätigt.",
      priority: "hoch",
    },
    {
      id: "VK02",
      title: "Angebote und Aufträge",
      prompt: "Wo werden Angebote und Auftragsbestätigungen erstellt und abgelegt?",
      fields: [text("system", "System"), text("ablage", "Ablage", false)],
      open: "Erstellung und Ablage von Angeboten und Auftragsbestätigungen sind nicht bestätigt.",
    },
    {
      id: "VK03",
      title: "Preise und Konditionen",
      prompt: "Wer legt Preise, Rabatte und Zahlungsbedingungen fest und ändert sie?",
      fields: [text("wer", "Wer legt fest"), text("freigabe", "Wer gibt Sonderkonditionen frei", false)],
      open: "Festlegung von Preisen, Rabatten und Zahlungsbedingungen ist nicht bestätigt.",
    },
    {
      id: "VK04",
      title: "Kundenstammdaten",
      prompt: "Wer legt Kunden an und ändert Stammdaten?",
      fields: [text("wer", "Wer pflegt"), pick("protokolliert", "Änderungen werden protokolliert", JA_NEIN_UNKLAR)],
      open: "Pflege der Kundenstammdaten ist nicht bestätigt.",
    },
    {
      id: "VK05",
      title: "Rechnungsnummern",
      prompt: "Wie werden Rechnungsnummern vergeben, und gibt es mehrere Nummernkreise?",
      hint: "Rechnungen tragen eine fortlaufende Nummer, die einmalig vergeben wird (§ 14 Abs. 4 UStG).",
      fields: [text("vergabe", "Vergabe"), text("kreise", "Nummernkreise", false)],
      open: "Vergabe der Rechnungsnummern ist nicht bestätigt.",
      priority: "hoch",
    },
    {
      id: "VK06",
      title: "Pflichtangaben",
      prompt: "Wie wird sichergestellt, dass Rechnungen die Pflichtangaben enthalten?",
      hint: "Die Pflichtangaben ergeben sich aus § 14 Abs. 4 UStG, für Kleinbetragsrechnungen aus § 33 UStDV.",
      fields: [area("ablauf", "Vorlage und Prüfung"), text("wer", "Wer prüft", false)],
      open: "Sicherstellung der Rechnungspflichtangaben ist nicht bestätigt.",
    },
    {
      id: "VK07",
      title: "Rechnungsversand",
      prompt: "In welchem Format und über welchen Weg werden Rechnungen versendet?",
      fields: [
        many("format", "Format", ["PDF per E-Mail", "XRechnung", "ZUGFeRD", "Papier", "Portal"]),
        pick("eRechnung", "E-Rechnungen können versendet werden", JA_NEIN_UNKLAR),
      ],
      open: "Format und Weg des Rechnungsversands sind nicht bestätigt.",
    },
    {
      id: "VK08",
      title: "Korrektur und Storno",
      prompt: "Wie werden fehlerhafte Rechnungen korrigiert oder storniert?",
      hint: "Eine ausgestellte Rechnung wird nicht überschrieben. Korrekturen laufen über eine Stornorechnung oder eine berichtigte Rechnung mit Bezug auf das Original (§ 31 Abs. 5 UStDV).",
      fields: [area("ablauf", "Ablauf"), text("freigabe", "Wer gibt frei", false)],
      open: "Korrektur und Storno von Ausgangsrechnungen sind nicht bestätigt.",
      priority: "hoch",
    },
    {
      id: "VK09",
      title: "Offene Posten und Mahnwesen",
      prompt: "Wer überwacht offene Forderungen und mahnt, und in welchem Turnus?",
      fields: [text("wer", "Wer"), text("turnus", "Turnus", false)],
      open: "Überwachung offener Posten und Mahnwesen sind nicht bestätigt.",
    },
    {
      id: "VK10",
      title: "Übergabe an die Buchhaltung",
      prompt: "Wie gelangen Ausgangsrechnungen in die Buchhaltung?",
      fields: [area("uebergabe", "Weg der Übergabe"), text("turnus", "Turnus", false)],
      open: "Übergabe der Ausgangsrechnungen an die Buchhaltung ist nicht bestätigt.",
    },
  ],
  sections: [
    { title: "Auftragsabwicklung", questions: ["VK01", "VK02"] },
    { title: "Preise und Kundenstammdaten", questions: ["VK03", "VK04"] },
    {
      title: "Rechnungsstellung",
      hinweis:
        "Im inländischen B2B-Verkehr wird die E-Rechnung beim Versand schrittweise Pflicht (Übergangsregeln bis 2027/2028). Eine PDF-Datei ist keine E-Rechnung im Sinne des § 14 UStG.",
      questions: ["VK05", "VK06", "VK07"],
    },
    { title: "Korrekturen", questions: ["VK08"] },
    { title: "Forderungen und Übergabe", questions: ["VK09", "VK10"] },
  ],
  prozess: [
    { schritt: "Angebot", beschreibung: "Angebot erstellen und ablegen", frage: "VK02", nachweis: "Angebot" },
    { schritt: "Auftrag", beschreibung: "Auftrag annehmen und bestätigen", frage: "VK01", nachweis: "Auftragsbestätigung" },
    { schritt: "Lieferung oder Leistung", beschreibung: "Leistung erbringen und dokumentieren", frage: "VK01", nachweis: "Lieferschein, Leistungsnachweis" },
    { schritt: "Rechnung", beschreibung: "Rechnung mit Pflichtangaben und fortlaufender Nummer erstellen", frage: "VK06", rolle: "VK06.wer", nachweis: "Rechnung" },
    { schritt: "Versand", beschreibung: "Rechnung im vereinbarten Format versenden", frage: "VK07", nachweis: "Versandnachweis" },
    { schritt: "Korrektur", beschreibung: "Storno oder berichtigte Rechnung mit Bezug", frage: "VK08", rolle: "VK08.freigabe", nachweis: "Stornorechnung" },
    { schritt: "Zahlungseingang", beschreibung: "Offene Posten überwachen, mahnen", frage: "VK09", rolle: "VK09.wer", nachweis: "OP-Liste, Mahnung" },
    { schritt: "Übergabe an die Buchhaltung", beschreibung: "Ausgangsrechnungen übergeben", frage: "VK10", nachweis: "Exportdatei, Buchungsstapel" },
  ],
  kontrollen: [
    { name: "Lückenprüfung der Rechnungsnummern", zweck: "Vollständigkeit der Ausgangsrechnungen" },
    { name: "Abgleich erbrachter Leistungen mit gestellten Rechnungen", zweck: "Keine Leistung bleibt unberechnet" },
    { name: "Vier-Augen-Prüfung vor Versand ab einem Betrag", zweck: "Fehlerhafte Rechnungen vermeiden" },
    { name: "Rechnungsvorlage mit Pflichtangaben", zweck: "Formell richtige Rechnungen" },
    { name: "Abstimmung der OP-Liste mit den Debitorenkonten", zweck: "Übereinstimmung von Nebenbuch und FiBu" },
    { name: "Freigabe von Storni und Gutschriften", zweck: "Unberechtigte Korrekturen verhindern" },
  ],
  aufbewahrung: [
    {
      unterlage: "Ausgangsrechnungen (Doppel) und Stornorechnungen",
      frist: "8 Jahre",
      grundlage: "§ 147 Abs. 1 Nr. 4, Abs. 3 AO; § 14b UStG",
    },
    FRIST_BRIEF("Angebote, Auftragsbestätigungen und Mahnungen (abgesandte Handels- und Geschäftsbriefe)"),
    { unterlage: "Abgesandte Lieferscheine, die keine Buchungsbelege sind", frist: "bis Versand der Rechnung", grundlage: "§ 147 Abs. 3 AO" },
    FRIST_AUFZEICHNUNG("Debitorenbuchhaltung und OP-Listen als Teil der Bücher"),
  ],
  begriffe: [
    ["E-Rechnung", "Rechnung in einem strukturierten elektronischen Format, das eine elektronische Verarbeitung ermöglicht (§ 14 Abs. 1 UStG)"],
    ["Nummernkreis", "Fortlaufende Folge von Rechnungsnummern, die jede Nummer nur einmal vergibt"],
    ["Offene Posten", "Rechnungen, die noch nicht bezahlt sind"],
    ["Pflichtangaben", "Angaben, die eine Rechnung nach § 14 Abs. 4 UStG enthalten muss"],
    ["Stornorechnung", "Rechnung, die eine frühere Rechnung mit Bezug auf deren Nummer aufhebt"],
  ],
});

const RETOUREN = defineBereich({
  id: "retouren",
  prefix: "RT",
  label: "Retouren",
  titel: "Retouren, Rücksendungen und Gutschriften",
  kurz: "Rücksendung, Warenannahme und Prüfung, Stornorechnung oder Gutschrift, Umsatzsteuerberichtigung, Erstattung, Bestandsbuchung.",
  beispiele: "Shop-Retourenportal, Warenwirtschaft, Fakturierung",
  abgrenzung:
    "Erfasst sind Rücksendungen von Kundinnen und Kunden und Rücksendungen an Lieferanten, von der Anmeldung über Prüfung, Korrekturbeleg und Erstattung bis zur Bestandsbuchung. Die ursprüngliche Rechnungsstellung beschreibt die Verfahrensdokumentation Verkauf.",
  questions: [
    lead("RT", "Retouren"),
    {
      id: "RT01",
      title: "Retourenkanäle und Erfassung",
      prompt: "Über welche Wege kommen Rücksendungen an, und wo werden sie erfasst?",
      fields: [area("kanaele", "Wege und Erfassung"), text("system", "System", false)],
      open: "Retourenkanäle und Erfassung sind nicht bestätigt.",
      priority: "hoch",
    },
    {
      id: "RT02",
      title: "Rückgaberegeln",
      prompt: "Welche Rückgabegründe und Fristen gelten (Widerruf, Gewährleistung, Kulanz), und wo ist das geregelt?",
      fields: [area("regeln", "Regeln und Fristen"), text("quelle", "Wo geregelt (z. B. AGB, Arbeitsanweisung)", false)],
      open: "Rückgaberegeln und Fristen sind nicht bestätigt.",
    },
    {
      id: "RT03",
      title: "Warenannahme und Zuordnung",
      prompt: "Wie wird die zurückgesandte Ware angenommen und dem ursprünglichen Vorgang zugeordnet?",
      fields: [area("ablauf", "Ablauf"), text("zuordnung", "Zuordnung über (z. B. Bestell- oder Rechnungsnummer)")],
      open: "Warenannahme und Zuordnung der Retoure sind nicht bestätigt.",
    },
    {
      id: "RT04",
      title: "Prüfung und Entscheidung",
      prompt: "Wer prüft die zurückgesandte Ware und entscheidet über Erstattung, Ersatz oder Ablehnung?",
      fields: [text("wer", "Wer prüft und entscheidet"), text("dokumentation", "Wie wird die Entscheidung festgehalten", false)],
      open: "Warenprüfung und Entscheidung über Retouren sind nicht bestätigt.",
      priority: "hoch",
    },
    {
      id: "RT05",
      title: "Korrekturbeleg",
      prompt: "Welcher Beleg entsteht bei einer Retoure, und wie verweist er auf die ursprüngliche Rechnung?",
      hint: "Eine Stornorechnung oder Rechnungskorrektur bezieht sich auf die Ursprungsrechnung. Eine Gutschrift im umsatzsteuerlichen Sinn ist eine Abrechnung durch den Leistungsempfänger (§ 14 Abs. 2 UStG) und nicht dasselbe wie eine kaufmännische Gutschrift.",
      fields: [
        many("beleg", "Beleg", ["Stornorechnung", "Rechnungskorrektur", "Kaufmännische Gutschrift", "Kein eigener Beleg"]),
        text("bezug", "Bezug auf die Ursprungsrechnung"),
      ],
      open: "Korrekturbeleg und Bezug zur Ursprungsrechnung sind nicht bestätigt.",
      priority: "hoch",
    },
    {
      id: "RT06",
      title: "Umsatzsteuerberichtigung",
      prompt: "Wie wird die Umsatzsteuer bei Retouren berichtigt, und wer prüft das?",
      hint: "Ändert sich die Bemessungsgrundlage, sind Umsatzsteuer und Vorsteuer zu berichtigen (§ 17 UStG).",
      fields: [area("ablauf", "Ablauf"), text("wer", "Wer prüft", false)],
      open: "Umsatzsteuerberichtigung bei Retouren ist nicht bestätigt.",
    },
    {
      id: "RT07",
      title: "Erstattung",
      prompt: "Wie wird erstattet, und wer gibt die Erstattung frei?",
      fields: [text("weg", "Erstattungsweg"), text("freigabe", "Freigabe"), text("grenze", "Wertgrenze für zusätzliche Freigabe", false)],
      open: "Erstattungsweg und Freigabe sind nicht bestätigt.",
      priority: "hoch",
    },
    {
      id: "RT08",
      title: "Bestandsbuchung",
      prompt: "Wie wird die zurückgenommene Ware im Bestand gebucht?",
      fields: [
        area("bestand", "Bestandsbuchung"),
        many("zustand", "Mögliche Ergebnisse", ["Wieder verkaufbar", "B-Ware", "Reparatur", "Verschrottung", "Rücksendung an Lieferanten"]),
      ],
      open: "Bestandsbuchung von Retouren ist nicht bestätigt.",
    },
    {
      id: "RT09",
      title: "Lieferantenretouren",
      prompt: "Werden Waren an Lieferanten zurückgesandt, und wie wird die Gutschrift des Lieferanten überwacht?",
      fields: [area("ablauf", "Ablauf"), text("wer", "Wer überwacht", false)],
      open: "Lieferantenretouren und Überwachung der Lieferantengutschriften sind nicht bestätigt.",
    },
    {
      id: "RT10",
      title: "Ablage",
      prompt: "Wo werden Retourenunterlagen (Retourenschein, Prüfprotokoll, Korrekturbeleg) abgelegt?",
      fields: [text("ablage", "Ablageort"), text("ordnung", "Ordnung (z. B. Retourennummer)", false)],
      open: "Ablage der Retourenunterlagen ist nicht bestätigt.",
    },
  ],
  sections: [
    { title: "Eingang und Regeln", questions: ["RT01", "RT02"] },
    { title: "Warenannahme und Prüfung", questions: ["RT03", "RT04"] },
    {
      title: "Korrekturbeleg und Umsatzsteuer",
      hinweis:
        "Eine berichtigte Rechnung muss sich spezifisch und eindeutig auf die ursprüngliche Rechnung beziehen (§ 31 Abs. 5 UStDV). Die Änderung der Bemessungsgrundlage ist nach § 17 UStG zu berichtigen.",
      questions: ["RT05", "RT06"],
    },
    { title: "Erstattung", questions: ["RT07"] },
    { title: "Bestand, Lieferantenretouren und Ablage", questions: ["RT08", "RT09", "RT10"] },
  ],
  prozess: [
    { schritt: "Retourenanmeldung", beschreibung: "Rücksendung anmelden und erfassen", frage: "RT01", nachweis: "Retourennummer, Retourenschein" },
    { schritt: "Warenannahme", beschreibung: "Paket annehmen und Vorgang zuordnen", frage: "RT03", nachweis: "Eingangserfassung" },
    { schritt: "Prüfung", beschreibung: "Zustand und Vollständigkeit prüfen", frage: "RT04", rolle: "RT04.wer", nachweis: "Prüfprotokoll" },
    { schritt: "Entscheidung", beschreibung: "Erstattung, Ersatz oder Ablehnung festlegen", frage: "RT04", rolle: "RT04.wer", nachweis: "Entscheidungsvermerk" },
    { schritt: "Korrekturbeleg", beschreibung: "Stornorechnung oder Rechnungskorrektur mit Bezug erstellen", frage: "RT05", nachweis: "Korrekturbeleg" },
    { schritt: "Umsatzsteuer", beschreibung: "Bemessungsgrundlage berichtigen", frage: "RT06", rolle: "RT06.wer", nachweis: "Buchung der Berichtigung" },
    { schritt: "Erstattung", beschreibung: "Betrag erstatten nach Freigabe", frage: "RT07", rolle: "RT07.freigabe", nachweis: "Zahlungsnachweis" },
    { schritt: "Bestandsbuchung", beschreibung: "Ware einlagern, abwerten oder ausbuchen", frage: "RT08", nachweis: "Bestandsbuchung" },
    { schritt: "Ablage", beschreibung: "Retourenunterlagen geordnet ablegen", frage: "RT10", nachweis: "Ablage nach Retourennummer" },
  ],
  kontrollen: [
    { name: "Abgleich Erstattungen mit Korrekturbelegen", zweck: "Keine Erstattung ohne Beleg" },
    { name: "Zusätzliche Freigabe von Erstattungen über einer Wertgrenze", zweck: "Hohe Erstattungen absichern" },
    { name: "Durchsicht offener Retouren", zweck: "Erhaltene Ware ohne Entscheidung erkennen" },
    { name: "Prüfung des Bezugs auf die Ursprungsrechnung", zweck: "Formell richtige Korrekturbelege" },
    { name: "Abgleich des Retourenbestands mit der Warenwirtschaft", zweck: "Bestand vollständig und richtig" },
    { name: "Überwachung ausstehender Lieferantengutschriften", zweck: "Forderungen gegen Lieferanten durchsetzen" },
  ],
  aufbewahrung: [
    FRIST_BELEG("Stornorechnungen, Rechnungskorrekturen und Gutschriften"),
    FRIST_BELEG("Erstattungsbelege und Zahlungsnachweise"),
    FRIST_BRIEF("Schriftverkehr zur Retoure (Handels- und Geschäftsbriefe)"),
    {
      unterlage: "Retourenscheine und Prüfprotokolle, soweit für die Besteuerung von Bedeutung",
      frist: "6 Jahre; als Buchungsbeleg 8 Jahre",
      grundlage: "§ 147 Abs. 1 Nr. 4, 5, Abs. 3 AO",
    },
  ],
  begriffe: [
    ["Retoure", "Rücksendung einer gelieferten Ware"],
    ["Stornorechnung", "Rechnung, die eine frühere Rechnung mit Bezug auf deren Nummer aufhebt"],
    ["Rechnungskorrektur", "Berichtigte Rechnung mit spezifischem und eindeutigem Bezug auf die Ursprungsrechnung (§ 31 Abs. 5 UStDV)"],
    ["Kaufmännische Gutschrift", "Umgangssprachlich für eine Erstattung oder Minderung; keine Gutschrift im umsatzsteuerlichen Sinn"],
    ["Gutschrift (§ 14 Abs. 2 UStG)", "Abrechnung, die der Leistungsempfänger statt des Leistenden ausstellt"],
  ],
});

const ZEITERFASSUNG = defineBereich({
  id: "zeiterfassung",
  prefix: "ZE",
  label: "Zeiterfassung",
  titel: "Zeiterfassung",
  kurz: "Erfassung der Arbeitszeit, Abwesenheiten, Korrekturen, Monatsabschluss, Übergabe an die Lohnabrechnung, Aufbewahrung.",
  beispiele: "Zeiterfassungs-App, Terminal, Stundenzettel, Excel",
  abgrenzung:
    "Erfasst ist die Erfassung von Arbeitszeiten und Abwesenheiten bis zur Übergabe an die Lohnabrechnung. Die Abrechnung selbst beschreibt die Verfahrensdokumentation Lohn. Diese Dokumentation enthält keine Zeiten oder sonstigen Daten einzelner Beschäftigter.",
  questions: [
    lead("ZE", "Zeiterfassung"),
    {
      id: "ZE01",
      title: "System",
      prompt: "Womit wird die Arbeitszeit erfasst?",
      fields: [pick("art", "Art", ["App / Software", "Terminal / Stempeluhr", "Stundenzettel Papier", "Excel", "Gemischt"]), text("system", "System", false)],
      open: "Art und System der Zeiterfassung sind nicht bestätigt.",
      priority: "hoch",
    },
    {
      id: "ZE02",
      title: "Personenkreis",
      prompt: "Für welche Beschäftigtengruppen wird Arbeitszeit erfasst?",
      hint: KEINE_PERSONENDATEN,
      fields: [area("kreis", "Gruppen (z. B. alle, Minijobs, Aushilfen)")],
      open: "Der erfasste Personenkreis ist nicht bestätigt.",
    },
    {
      id: "ZE03",
      title: "Erfassung",
      prompt: "Wer erfasst die Zeiten, was wird erfasst, und bis wann?",
      hint: "§ 17 MiLoG verlangt für bestimmte Beschäftigte Beginn, Ende und Dauer der täglichen Arbeitszeit spätestens bis zum Ablauf des siebten auf den Arbeitstag folgenden Kalendertages.",
      fields: [
        text("wer", "Wer erfasst"),
        many("inhalt", "Erfasste Angaben", ["Beginn", "Ende", "Pausen", "Dauer", "Projekt / Kostenstelle"]),
        text("frist", "Bis wann (z. B. täglich)", false),
      ],
      open: "Wer Zeiten erfasst, welche Angaben und bis wann, ist nicht bestätigt.",
      priority: "hoch",
    },
    {
      id: "ZE04",
      title: "Abwesenheiten",
      prompt: "Wie werden Urlaub, Krankheit und sonstige Abwesenheiten erfasst und freigegeben?",
      hint: KEINE_PERSONENDATEN,
      fields: [area("ablauf", "Ablauf"), text("freigabe", "Wer gibt frei", false)],
      open: "Erfassung und Freigabe von Abwesenheiten sind nicht bestätigt.",
    },
    {
      id: "ZE05",
      title: "Korrekturen",
      prompt: "Wer darf erfasste Zeiten korrigieren, und wird die Korrektur protokolliert?",
      fields: [text("wer", "Wer darf korrigieren"), pick("protokolliert", "Korrekturen werden protokolliert", JA_NEIN_UNKLAR)],
      open: "Korrekturrechte und Protokollierung in der Zeiterfassung sind nicht bestätigt.",
      priority: "hoch",
    },
    {
      id: "ZE06",
      title: "Monatsabschluss",
      prompt: "Wer prüft und schließt die Zeiten je Abrechnungszeitraum ab?",
      fields: [text("wer", "Wer prüft und schließt ab"), text("termin", "Termin (z. B. 3. Werktag)", false)],
      open: "Prüfung und Abschluss der Zeiten je Abrechnungszeitraum sind nicht bestätigt.",
    },
    {
      id: "ZE07",
      title: "Überstunden und Zuschläge",
      prompt: "Wie werden Überstunden, Zuschläge und Arbeitszeitkonten ermittelt?",
      fields: [area("ablauf", "Ermittlung"), text("freigabe", "Wer gibt Überstunden frei", false)],
      open: "Ermittlung von Überstunden, Zuschlägen und Zeitkonten ist nicht bestätigt.",
    },
    {
      id: "ZE08",
      title: "Übergabe an die Lohnabrechnung",
      prompt: "Wie gelangen die Zeiten in die Lohnabrechnung?",
      fields: [area("uebergabe", "Weg der Übergabe"), text("format", "Format (z. B. Export, Liste)", false)],
      open: "Übergabe der Zeiten an die Lohnabrechnung ist nicht bestätigt.",
      priority: "hoch",
    },
    {
      id: "ZE09",
      title: "Aufbewahrung und Export",
      prompt: "Wo werden Zeitnachweise aufbewahrt, und lassen sie sich exportieren?",
      fields: [text("ablage", "Ablage"), pick("export", "Export möglich und geprüft", JA_NEIN_UNKLAR)],
      open: "Aufbewahrung und Export der Zeitnachweise sind nicht bestätigt.",
    },
  ],
  sections: [
    {
      title: "System und Personenkreis",
      hinweis:
        "Nach dem Beschluss des Bundesarbeitsgerichts vom 13.09.2022 (1 ABR 22/21) sind Arbeitgeber verpflichtet, ein System zur Erfassung der Arbeitszeit einzuführen. Steuerlich relevant werden Zeitnachweise, soweit sie Grundlage der Lohnabrechnung sind.",
      questions: ["ZE01", "ZE02"],
    },
    {
      title: "Erfassung und Abwesenheiten",
      hinweis:
        "Arbeitsrechtliche Aufzeichnungspflichten (z. B. § 16 Abs. 2 ArbZG, § 17 MiLoG) gelten neben den steuerlichen Pflichten.",
      questions: ["ZE03", "ZE04"],
    },
    { title: "Korrekturen und Monatsabschluss", questions: ["ZE05", "ZE06"] },
    { title: "Überstunden und Zuschläge", questions: ["ZE07"] },
    { title: "Übergabe und Aufbewahrung", questions: ["ZE08", "ZE09"] },
  ],
  prozess: [
    { schritt: "Erfassung", beschreibung: "Arbeitszeit erfassen", frage: "ZE03", rolle: "ZE03.wer", nachweis: "Zeitbuchung" },
    { schritt: "Abwesenheit", beschreibung: "Urlaub, Krankheit erfassen und freigeben", frage: "ZE04", rolle: "ZE04.freigabe", nachweis: "Abwesenheitseintrag" },
    { schritt: "Korrektur", beschreibung: "Fehlbuchungen korrigieren", frage: "ZE05", rolle: "ZE05.wer", nachweis: "Korrekturprotokoll" },
    { schritt: "Überstunden", beschreibung: "Überstunden und Zuschläge ermitteln und freigeben", frage: "ZE07", rolle: "ZE07.freigabe", nachweis: "Zeitkonto" },
    { schritt: "Monatsabschluss", beschreibung: "Zeiten prüfen und abschließen", frage: "ZE06", rolle: "ZE06.wer", nachweis: "Abschlussvermerk" },
    { schritt: "Übergabe an die Lohnabrechnung", beschreibung: "Stunden, Zuschläge, Abwesenheiten übergeben", frage: "ZE08", nachweis: "Exportdatei oder Liste" },
    { schritt: "Aufbewahrung", beschreibung: "Zeitnachweise aufbewahren", frage: "ZE09", nachweis: "Archiv bzw. Export" },
  ],
  kontrollen: [
    { name: "Monatliche Plausibilitätsprüfung der Zeiten", zweck: "Fehlbuchungen und Lücken erkennen" },
    { name: "Durchsicht des Korrekturprotokolls", zweck: "Nachträgliche Änderungen nachvollziehen" },
    { name: "Abgleich übergebener Stunden mit der Lohnabrechnung", zweck: "Vollständige und richtige Übernahme" },
    { name: "Prüfung fehlender Buchungen", zweck: "Vollständige Erfassung" },
    { name: "Freigabe von Überstunden", zweck: "Nur genehmigte Mehrarbeit wird vergütet" },
  ],
  aufbewahrung: [
    { unterlage: "Aufzeichnungen der über acht Stunden werktäglich hinausgehenden Arbeitszeit", frist: "mindestens 2 Jahre", grundlage: "§ 16 Abs. 2 ArbZG" },
    { unterlage: "Aufzeichnungen über Beginn, Ende und Dauer der Arbeitszeit nach MiLoG", frist: "mindestens 2 Jahre", grundlage: "§ 17 Abs. 1 MiLoG" },
    {
      unterlage: "Zeitnachweise, die Grundlage der Lohnabrechnung sind",
      frist: "wie die zugehörigen Lohnunterlagen; als Buchungsbeleg 8 Jahre, im Zweifel die längere Frist",
      grundlage: "§ 41 Abs. 1 EStG; § 147 Abs. 1 Nr. 4, Abs. 3 AO",
    },
  ],
  begriffe: [
    ["Arbeitszeitkonto", "Konto, auf dem Mehr- und Minderstunden gegenüber der Sollzeit geführt werden"],
    ["Korrekturprotokoll", "Systemseitige Aufzeichnung, wer welche Zeit wann geändert hat"],
    ["Abrechnungszeitraum", "Zeitraum, für den Zeiten abgeschlossen und abgerechnet werden (meist Kalendermonat)"],
    ["Monatsabschluss", "Prüfung und Sperrung der Zeiten eines Abrechnungszeitraums"],
  ],
});

const LOHN = defineBereich({
  id: "lohn",
  prefix: "LO",
  label: "Lohn",
  titel: "Lohn- und Gehaltsabrechnung",
  kurz: "Abrechnung intern oder über Kanzlei, Stamm- und Bewegungsdaten, Lohnkonto, Meldungen, Auszahlung, Übergabe an die Buchhaltung.",
  beispiele: "DATEV Lohn und Gehalt, LODAS, Lohnsoftware, Lohnabrechnung über Kanzlei oder Dienstleister",
  abgrenzung:
    "Erfasst ist der Weg von Personalstamm- und Bewegungsdaten über Abrechnung, Meldungen und Auszahlung bis zur Buchung in der Finanzbuchhaltung. Die Erfassung der Arbeitszeit beschreibt die Verfahrensdokumentation Zeiterfassung. Diese Dokumentation enthält keine Lohn- oder Personaldaten einzelner Beschäftigter.",
  questions: [
    lead("LO", "Lohn"),
    {
      id: "LO01",
      title: "Abrechnung",
      prompt: "Wer rechnet Löhne und Gehälter ab, und mit welchem Programm?",
      hint: KEINE_PERSONENDATEN,
      fields: [
        pick("wer", "Abrechnung durch", ["Intern", "Kanzlei", "Externer Dienstleister"]),
        text("system", "Lohnprogramm (z. B. DATEV Lohn und Gehalt, LODAS)", false),
        text("termin", "Abrechnungstermin", false),
      ],
      open: "Wer die Lohnabrechnung erstellt und mit welchem Programm, ist nicht bestätigt.",
      priority: "hoch",
    },
    {
      id: "LO02",
      title: "Abrechnungsunterlagen",
      prompt: "Welche Unterlagen liefert die Abrechnung je Monat, und wo kommen sie an?",
      fields: [
        many("unterlagen", "Unterlagen", [
          "Lohnabrechnungen",
          "Lohnjournal",
          "Buchungsliste",
          "Zahlungsliste / SEPA-Datei",
          "Beitragsnachweise",
          "Lohnsteuer-Anmeldung",
        ]),
        text("ort", "Wo kommen sie an"),
      ],
      open: "Monatliche Abrechnungsunterlagen und ihr Eingangsort sind nicht bestätigt.",
    },
    {
      id: "LO03",
      title: "Personalstammdaten und Änderungen",
      prompt: "Wer meldet Eintritte, Austritte und Gehaltsänderungen, und wer gibt sie frei?",
      hint: KEINE_PERSONENDATEN,
      fields: [text("meldet", "Wer meldet"), text("freigabe", "Wer gibt frei"), text("weg", "Meldeweg (z. B. Formular, Portal)", false)],
      open: "Meldung und Freigabe von Änderungen der Personalstammdaten sind nicht bestätigt.",
      priority: "hoch",
    },
    {
      id: "LO04",
      title: "Bewegungsdaten",
      prompt: "Wie werden variable Daten (Stunden, Zuschläge, Prämien, Abwesenheiten) an die Abrechnung übergeben, und bis wann?",
      fields: [area("weg", "Weg der Übergabe"), text("frist", "Frist", false)],
      open: "Übergabe der monatlichen Bewegungsdaten ist nicht bestätigt.",
    },
    {
      id: "LO05",
      title: "Lohnkonto und Lohnunterlagen",
      prompt: "Wo werden Lohnkonten, Abrechnungen und Meldungen geführt und aufbewahrt?",
      hint: "Für jeden Arbeitnehmer ist ein Lohnkonto zu führen (§ 41 EStG, Inhalt nach § 4 LStDV).",
      fields: [text("ablage", "Ablageort"), text("form", "Form (z. B. im Lohnprogramm, Kanzlei-Portal)", false)],
      open: "Führung und Ablage von Lohnkonten, Abrechnungen und Meldungen sind nicht bestätigt.",
      priority: "hoch",
    },
    {
      id: "LO06",
      title: "Meldungen und Anmeldungen",
      prompt: "Wer übermittelt Lohnsteuer-Anmeldung, Sozialversicherungsmeldungen und Beitragsnachweise, und wie wird die Übermittlung kontrolliert?",
      fields: [text("wer", "Wer übermittelt"), area("kontrolle", "Kontrolle der Übermittlung", false)],
      open: "Übermittlung und Kontrolle von Lohnsteuer-Anmeldung und SV-Meldungen sind nicht bestätigt.",
    },
    {
      id: "LO07",
      title: "Übergabe an die Buchhaltung",
      prompt: "Wie gelangen die Lohnwerte in die Finanzbuchhaltung?",
      fields: [
        pick("schnittstelle", "Schnittstelle", [
          "Automatischer Buchungsdatensatz (z. B. DATEV Lohn an DATEV FiBu)",
          "Import-Datei",
          "Manuelle Buchung nach Buchungsliste",
          "Anderer Weg",
        ]),
        area("uebergabe", "Weg der Übergabe", false),
      ],
      open: "Übergabe der Lohnwerte an die Buchhaltung ist nicht bestätigt.",
      priority: "hoch",
    },
    {
      id: "LO08",
      title: "Zugriff auf Lohndaten",
      prompt: "Wer hat Zugriff auf Lohndaten, und wie ist er geschützt?",
      hint: "Lohndaten sind besonders schutzbedürftige Beschäftigtendaten.",
      fields: [text("wer", "Zugriffsberechtigte"), text("schutz", "Schutz (z. B. eigene Rolle, Passwort)", false)],
      open: "Zugriffsrechte auf Lohndaten sind nicht bestätigt.",
    },
    {
      id: "LO09",
      title: "Auszahlung",
      prompt: "Wer gibt die Auszahlung der Löhne frei, und gilt ein Vier-Augen-Prinzip?",
      fields: [text("freigabe", "Freigabe der Auszahlung"), pick("vierAugen", "Vier-Augen-Prinzip", JA_NEIN_UNKLAR)],
      open: "Freigabe der Lohnauszahlung ist nicht bestätigt.",
      priority: "hoch",
    },
    {
      id: "LO10",
      title: "Reisekosten und Sachbezüge",
      prompt: "Wie werden steuerfreie Erstattungen und Sachbezüge (z. B. Reisekosten, Dienstwagen, Gutscheine) erfasst und nachgewiesen?",
      fields: [area("ablauf", "Erfassung und Nachweis")],
      open: "Erfassung und Nachweis von Reisekosten und Sachbezügen sind nicht bestätigt.",
    },
    {
      id: "LO11",
      title: "Lohnsteuer-Außenprüfung",
      prompt: "Kann das Lohnprogramm Daten über die Digitale LohnSchnittstelle (DLS) bereitstellen, und wer ist Ansprechperson bei einer Lohnsteuer-Außenprüfung?",
      hint: "Die Digitale LohnSchnittstelle ist der Standard für die Datenüberlassung bei der Lohnsteuer-Außenprüfung (§ 4 Abs. 2a LStDV).",
      fields: [pick("dls", "DLS-Export möglich", JA_NEIN_UNKLAR), text("ansprechpartner", "Ansprechperson")],
      open: "DLS-Export und Ansprechperson für die Lohnsteuer-Außenprüfung sind nicht bestätigt.",
    },
  ],
  sections: [
    { title: "Abrechnung und Unterlagen", questions: ["LO01", "LO02"] },
    { title: "Stammdaten und Bewegungsdaten", questions: ["LO03", "LO04"] },
    {
      title: "Lohnkonto, Meldungen und Zugriff",
      hinweis:
        "Für jeden Arbeitnehmer ist ein Lohnkonto zu führen (§ 41 EStG). Meldungen zur Sozialversicherung richten sich nach § 28a SGB IV, Entgeltunterlagen nach § 28f SGB IV.",
      questions: ["LO05", "LO06", "LO08"],
    },
    { title: "Übergabe und Auszahlung", questions: ["LO07", "LO09"] },
    { title: "Reisekosten und Sachbezüge", questions: ["LO10"] },
    { title: "Lohnsteuer-Außenprüfung", questions: ["LO11"] },
  ],
  prozess: [
    { schritt: "Stammdatenänderung", beschreibung: "Eintritt, Austritt, Gehaltsänderung melden und freigeben", frage: "LO03", rolle: "LO03.freigabe", nachweis: "Änderungsmeldung mit Freigabe" },
    { schritt: "Bewegungsdaten", beschreibung: "Stunden, Zuschläge, Abwesenheiten übergeben", frage: "LO04", nachweis: "Übergabeliste oder Export" },
    { schritt: "Abrechnung", beschreibung: "Monatliche Lohnabrechnung erstellen", frage: "LO01", nachweis: "Lohnabrechnungen, Lohnjournal" },
    { schritt: "Prüfung", beschreibung: "Abrechnungsunterlagen prüfen", frage: "LO02", nachweis: "Prüfvermerk am Lohnjournal" },
    { schritt: "Meldungen", beschreibung: "Lohnsteuer-Anmeldung, SV-Meldungen, Beitragsnachweise", frage: "LO06", rolle: "LO06.wer", nachweis: "Übermittlungsprotokolle" },
    { schritt: "Auszahlung", beschreibung: "Zahlungsliste freigeben und ausführen", frage: "LO09", rolle: "LO09.freigabe", nachweis: "Freigegebene Zahlungsliste" },
    { schritt: "Buchung", beschreibung: "Lohnwerte in die FiBu übernehmen", frage: "LO07", nachweis: "Buchungsliste, Buchungsstapel" },
    { schritt: "Ablage", beschreibung: "Lohnkonten und Unterlagen aufbewahren", frage: "LO05", nachweis: "Lohnarchiv" },
  ],
  kontrollen: [
    { name: "Abgleich Personalbestand mit der Abrechnung (Ein- und Austritte)", zweck: "Keine Zahlung an ausgeschiedene oder fiktive Beschäftigte" },
    { name: "Plausibilitätsprüfung des Lohnjournals gegen den Vormonat", zweck: "Ungewöhnliche Abweichungen erkennen" },
    { name: "Vier-Augen-Freigabe der Zahlungsliste", zweck: "Fehlerhafte Auszahlungen verhindern" },
    { name: "Abstimmung der Lohnverrechnungskonten in der FiBu", zweck: "Vollständige Buchung und Abführung" },
    { name: "Prüfung der Übermittlungsprotokolle (Lohnsteuer, SV)", zweck: "Fristgerechte Meldungen" },
    { name: "Durchsicht der Zugriffsrechte auf Lohndaten", zweck: "Vertraulichkeit sichern" },
  ],
  aufbewahrung: [
    { unterlage: "Lohnkonto", frist: "bis zum Ablauf des sechsten Kalenderjahres nach der zuletzt eingetragenen Lohnzahlung", grundlage: "§ 41 Abs. 1 EStG" },
    { unterlage: "Entgeltunterlagen für die Sozialversicherung", frist: "bis zum Ablauf des auf die letzte Prüfung folgenden Kalenderjahres", grundlage: "§ 28f Abs. 1 SGB IV" },
    FRIST_BELEG("Lohnjournale, Buchungslisten und Zahlungslisten, soweit Buchungsbelege"),
    FRIST_BELEG("Belege zu Reisekosten und steuerfreien Erstattungen"),
  ],
  begriffe: [
    ["Lohnkonto", "Für jeden Arbeitnehmer zu führende Aufzeichnung der Lohnzahlungen und Abzüge (§ 41 EStG)"],
    ["Lohnjournal", "Monatliche Übersicht aller Abrechnungen mit Summen"],
    ["Bewegungsdaten", "Monatlich wechselnde Angaben wie Stunden, Zuschläge, Prämien oder Abwesenheiten"],
    ["DLS", "Digitale LohnSchnittstelle für die Datenüberlassung bei der Lohnsteuer-Außenprüfung"],
    ["Entgeltunterlagen", "Unterlagen, die der Arbeitgeber für die Sozialversicherung führt (§ 28f SGB IV)"],
  ],
});

const ECOMMERCE = defineBereich({
  id: "ecommerce",
  prefix: "EC",
  label: "E-Commerce",
  titel: "E-Commerce, Marktplätze und Zahlungsdienstleister",
  kurz: "Onlineshop, Marktplätze, Zahlungsdienstleister, Bestelldaten, Steuersätze, Gebühren und Auszahlungen, Abstimmung.",
  beispiele: "Shopify, Shopware, WooCommerce, Amazon, eBay, PayPal, Stripe, Klarna",
  abgrenzung:
    "Erfasst sind Bestellungen über eigene Shops und Marktplätze, Zahlungen über Zahlungsdienstleister, Gebühren- und Auszahlungsabrechnungen sowie deren Abstimmung mit der Buchhaltung. Rücksendungen beschreibt die Verfahrensdokumentation Retouren.",
  questions: [
    lead("EC", "E-Commerce"),
    {
      id: "EC01",
      title: "Verkaufskanäle",
      prompt: "Über welche Shops und Marktplätze wird verkauft?",
      fields: [area("kanaele", "Shops und Marktplätze")],
      open: "Verkaufskanäle sind nicht bestätigt.",
      priority: "hoch",
    },
    {
      id: "EC02",
      title: "Shopsystem und Erweiterungen",
      prompt: "Welches Shopsystem und welche Plugins oder Apps verarbeiten Bestellungen, Preise und Steuern?",
      fields: [text("system", "Shopsystem"), area("plugins", "Plugins und Apps", false)],
      open: "Shopsystem und Erweiterungen sind nicht bestätigt.",
    },
    {
      id: "EC03",
      title: "Zahlungsdienstleister",
      prompt: "Welche Zahlungsdienstleister werden genutzt?",
      fields: [area("anbieter", "Zahlungsdienstleister")],
      open: "Zahlungsdienstleister sind nicht bestätigt.",
    },
    {
      id: "EC04",
      title: "Bestelldaten",
      prompt: "Wo liegen die einzelnen Bestellungen, und wie werden sie exportiert?",
      hint: "Einzelne Bestellungen sind einzeln, vollständig und nachvollziehbar aufzuzeichnen (§ 146 Abs. 1 AO).",
      fields: [text("ort", "System"), text("export", "Export und Turnus", false)],
      open: "Speicherort und Export der Bestelldaten sind nicht bestätigt.",
      priority: "hoch",
    },
    {
      id: "EC05",
      title: "Steuersätze und Länder",
      prompt: "Wie werden Steuersätze je Land und Produkt im Shop gepflegt, und wird das OSS-Verfahren genutzt?",
      hint: "Bei Fernverkäufen an Privatpersonen in andere EU-Staaten kann das One-Stop-Shop-Verfahren genutzt werden (§ 18j UStG).",
      fields: [text("pflege", "Wer pflegt Steuersätze"), pick("oss", "OSS-Verfahren wird genutzt", JA_NEIN_UNKLAR)],
      open: "Pflege der Steuersätze und Nutzung des OSS-Verfahrens sind nicht bestätigt.",
    },
    {
      id: "EC06",
      title: "Rechnungen an Kunden",
      prompt: "Wie entstehen die Rechnungen an Kundinnen und Kunden?",
      fields: [area("rechnung", "Rechnungserstellung"), text("nummernkreis", "Nummernkreis je Kanal", false)],
      open: "Rechnungserstellung im Onlinehandel ist nicht bestätigt.",
    },
    {
      id: "EC07",
      title: "Gebühren- und Auszahlungsabrechnungen",
      prompt: "Wie werden Gebühren-, Provisions- und Auszahlungsabrechnungen der Plattformen abgerufen?",
      fields: [area("abruf", "Abruf"), text("turnus", "Turnus", false)],
      open: "Abruf der Gebühren- und Auszahlungsabrechnungen ist nicht bestätigt.",
    },
    {
      id: "EC08",
      title: "Abstimmung der Auszahlungen",
      prompt: "Wer stimmt Auszahlungs- und Gebührenreports der Plattformen und Zahlungsdienstleister mit der Buchhaltung ab, und wie oft?",
      fields: [text("wer", "Wer"), text("turnus", "Turnus"), text("konto", "Verrechnungskonto in der FiBu", false)],
      open: "Abstimmung von Auszahlungen und Gebühren ist nicht bestätigt.",
      priority: "hoch",
    },
    {
      id: "EC09",
      title: "Gutscheine und Rabatte",
      prompt: "Wie werden Gutscheine, Rabattcodes und Guthaben erfasst und in der Buchhaltung abgebildet?",
      fields: [area("ablauf", "Erfassung und Buchung")],
      open: "Erfassung von Gutscheinen, Rabatten und Guthaben ist nicht bestätigt.",
    },
    {
      id: "EC10",
      title: "Aufbewahrung der Rohdaten",
      prompt: "Wo werden Bestell- und Zahlungsdaten der Plattformen dauerhaft gespeichert?",
      hint: "Plattformen halten Daten oft nur befristet vor. Für die Aufbewahrung ist das Unternehmen selbst verantwortlich.",
      fields: [text("ablage", "Ablage"), text("anbieterfrist", "Wie lange hält der Anbieter die Daten vor", false)],
      open: "Dauerhafte Speicherung der Plattform- und Zahlungsdaten ist nicht bestätigt.",
      priority: "hoch",
    },
  ],
  sections: [
    { title: "Kanäle und Shopsystem", questions: ["EC01", "EC02"] },
    { title: "Zahlungswege", questions: ["EC03"] },
    { title: "Bestelldaten, Steuersätze und Rechnungen", questions: ["EC04", "EC05", "EC06"] },
    { title: "Gebühren, Auszahlungen und Abstimmung", questions: ["EC07", "EC08"] },
    { title: "Gutscheine und Rabatte", questions: ["EC09"] },
    { title: "Aufbewahrung der Rohdaten", questions: ["EC10"] },
  ],
  prozess: [
    { schritt: "Bestellung", beschreibung: "Bestellung im Shop oder auf dem Marktplatz", frage: "EC04", nachweis: "Bestelldatensatz" },
    { schritt: "Zahlung", beschreibung: "Zahlung über den Zahlungsdienstleister", frage: "EC03", nachweis: "Transaktion beim Zahlungsdienstleister" },
    { schritt: "Rechnung", beschreibung: "Rechnung an Kundin oder Kunden", frage: "EC06", nachweis: "Rechnung" },
    { schritt: "Gebühren und Auszahlung", beschreibung: "Abrechnungen der Plattformen abrufen", frage: "EC07", nachweis: "Gebühren- und Auszahlungsreport" },
    { schritt: "Abstimmung", beschreibung: "Auszahlungen, Gebühren und Bankeingang abstimmen", frage: "EC08", rolle: "EC08.wer", nachweis: "Abstimmungsprotokoll" },
    { schritt: "Übergabe an die Buchhaltung", beschreibung: "Umsätze, Gebühren, Auszahlungen buchen", frage: "EC08", nachweis: "Buchungsstapel" },
    { schritt: "Archivierung", beschreibung: "Rohdaten dauerhaft sichern", frage: "EC10", nachweis: "Export im eigenen Archiv" },
  ],
  kontrollen: [
    { name: "Abgleich Bestellungen mit Rechnungen", zweck: "Jede Bestellung wird berechnet" },
    { name: "Abgleich Auszahlungen mit dem Bankeingang", zweck: "Auszahlungen vollständig erhalten" },
    { name: "Prüfung der Gebührenabrechnungen", zweck: "Richtige Gebühren und Provisionen" },
    { name: "Prüfung der Steuersätze nach Änderungen", zweck: "Richtige Umsatzsteuer je Land und Produkt" },
    { name: "Abstimmung des Verrechnungskontos je Zahlungsdienstleister", zweck: "Offene Differenzen erkennen" },
    { name: "Regelmäßiger Export der Rohdaten", zweck: "Daten vor Ablauf der Anbieterfrist sichern" },
  ],
  aufbewahrung: [
    {
      unterlage: "Einzelaufzeichnungen der Bestellungen und Zahlungen",
      frist: "10 Jahre als Aufzeichnung; als Buchungsbeleg 8 Jahre, im Zweifel die längere Frist",
      grundlage: "§ 147 Abs. 1 Nr. 1, 4, Abs. 3 AO",
    },
    FRIST_BELEG("Ausgangsrechnungen sowie Gebühren- und Auszahlungsabrechnungen"),
    FRIST_BRIEF("Schriftverkehr mit Plattformen und Kundinnen und Kunden, soweit Geschäftsbriefe"),
  ],
  begriffe: [
    ["Marktplatz", "Plattform, über die Dritte Waren verkaufen (z. B. Amazon, eBay)"],
    ["Zahlungsdienstleister", "Anbieter, der Zahlungen abwickelt und gesammelt auszahlt (z. B. PayPal, Stripe)"],
    ["Auszahlungsreport", "Abrechnung der Plattform über Umsätze, Gebühren und ausgezahlten Betrag"],
    ["OSS", "One-Stop-Shop: Verfahren zur zentralen Erklärung von EU-Fernverkäufen (§ 18j UStG)"],
    ["Verrechnungskonto", "FiBu-Konto, auf dem Umsätze und Auszahlungen eines Anbieters gegeneinander laufen"],
  ],
});

const BANK = defineBereich({
  id: "bank",
  prefix: "BA",
  label: "Bank",
  titel: "Bank und Zahlungsverkehr",
  kurz: "Konten und Vollmachten, Kontoauszüge, Zahlungsvorbereitung und -freigabe, Lastschriften, Bankabstimmung, Übergabe an die Buchhaltung.",
  beispiele: "Onlinebanking, Banking-Software, Bankschnittstelle der FiBu",
  abgrenzung:
    "Erfasst sind alle Geschäftskonten, Kreditkarten und der Zahlungsverkehr von der Zahlungsvorbereitung bis zur Abstimmung mit der Buchhaltung. Bargeld an der Kasse beschreibt die Verfahrensdokumentation Kasse.",
  questions: [
    lead("BA", "Bank"),
    {
      id: "BA01",
      title: "Konten",
      prompt: "Welche Geschäftskonten und Kreditkarten gibt es?",
      fields: [area("konten", "Konten (Bank, Zweck)"), text("karten", "Kreditkarten", false)],
      open: "Geschäftskonten und Kreditkarten sind nicht bestätigt.",
      priority: "hoch",
    },
    {
      id: "BA02",
      title: "Vollmachten und Zugänge",
      prompt: "Wer hat welche Vollmacht, und wie werden Zugänge bei Austritt gesperrt?",
      fields: [area("vollmachten", "Vollmachten (Einzel- oder Gemeinschaftsvollmacht)"), text("sperre", "Sperre bei Austritt", false)],
      open: "Bankvollmachten und Sperre von Zugängen sind nicht bestätigt.",
      priority: "hoch",
    },
    {
      id: "BA03",
      title: "Kontoauszüge",
      prompt: "Wie werden Kontoauszüge abgerufen und abgelegt?",
      hint: "Elektronisch erhaltene Kontoauszüge werden in der empfangenen Form aufbewahrt. Ein Ausdruck allein genügt nicht.",
      fields: [pick("format", "Format", ["Elektronisch (PDF)", "Elektronisch (Datensatz/Schnittstelle)", "Papier", "Gemischt"]), text("ablage", "Ablage")],
      open: "Abruf und Ablage der Kontoauszüge sind nicht bestätigt.",
    },
    {
      id: "BA04",
      title: "Zahlungsvorbereitung",
      prompt: "Wie werden Zahlungen vorbereitet (Zahlungsvorschlag, SEPA-Datei, Einzelüberweisung)?",
      fields: [area("ablauf", "Ablauf"), text("wer", "Wer bereitet vor")],
      open: "Zahlungsvorbereitung ist nicht bestätigt.",
    },
    {
      id: "BA05",
      title: "Zahlungsfreigabe",
      prompt: "Wer gibt Zahlungen frei, und gilt ein Vier-Augen-Prinzip oder ein Limit?",
      fields: [text("wer", "Wer gibt frei"), pick("vierAugen", "Vier-Augen-Prinzip", JA_NEIN_UNKLAR), text("limit", "Limits", false)],
      open: "Zahlungsfreigabe und Vier-Augen-Prinzip sind nicht bestätigt.",
      priority: "hoch",
    },
    {
      id: "BA06",
      title: "Lastschriften und Daueraufträge",
      prompt: "Welche Lastschriftmandate und Daueraufträge bestehen, und wer überwacht sie?",
      fields: [area("ueberwachung", "Überwachung"), text("wer", "Wer überwacht", false)],
      open: "Überwachung von Lastschriften und Daueraufträgen ist nicht bestätigt.",
    },
    {
      id: "BA07",
      title: "Bankabstimmung",
      prompt: "Wer stimmt Bank und Buchhaltung ab, und wie oft?",
      fields: [text("wer", "Wer"), text("turnus", "Turnus")],
      open: "Abstimmung von Bank und Buchhaltung ist nicht bestätigt.",
      priority: "hoch",
    },
    {
      id: "BA08",
      title: "Übergabe an die Buchhaltung",
      prompt: "Wie gelangen Bankumsätze in die Buchhaltung?",
      fields: [
        pick("weg", "Weg", ["Automatischer Abruf in die FiBu", "Import-Datei", "Manuelle Erfassung nach Kontoauszug", "Über die Kanzlei"]),
        area("uebergabe", "Beschreibung", false),
      ],
      open: "Übergabe der Bankumsätze an die Buchhaltung ist nicht bestätigt.",
    },
    {
      id: "BA09",
      title: "Kreditkarten und Barauslagen",
      prompt: "Wie werden Kreditkartenabrechnungen und Barauslagen belegt und abgerechnet?",
      fields: [area("ablauf", "Ablauf")],
      open: "Belegung von Kreditkartenabrechnungen und Barauslagen ist nicht bestätigt.",
    },
    {
      id: "BA10",
      title: "Ungeklärte Posten",
      prompt: "Wie werden ungeklärte Zahlungseingänge und -ausgänge geklärt?",
      fields: [area("ablauf", "Ablauf"), text("wer", "Wer klärt", false)],
      open: "Klärung ungeklärter Zahlungen ist nicht bestätigt.",
    },
  ],
  sections: [
    { title: "Konten, Vollmachten und Kontoauszüge", questions: ["BA01", "BA02", "BA03"] },
    { title: "Zahlungsvorbereitung und Freigabe", questions: ["BA04", "BA05", "BA06"] },
    { title: "Übernahme und Abstimmung", questions: ["BA08", "BA07", "BA10"] },
    { title: "Kreditkarten und Barauslagen", questions: ["BA09"] },
  ],
  prozess: [
    { schritt: "Umsatzabruf", beschreibung: "Kontoauszüge und Umsätze abrufen", frage: "BA03", nachweis: "Kontoauszug" },
    { schritt: "Zahlungsvorschlag", beschreibung: "Fällige Zahlungen zusammenstellen", frage: "BA04", rolle: "BA04.wer", nachweis: "Zahlungsvorschlag, SEPA-Datei" },
    { schritt: "Freigabe", beschreibung: "Zahlungen freigeben", frage: "BA05", rolle: "BA05.wer", nachweis: "Freigabeprotokoll der Bank" },
    { schritt: "Übernahme in die FiBu", beschreibung: "Bankumsätze übernehmen", frage: "BA08", nachweis: "Buchungsstapel" },
    { schritt: "Zuordnung und Klärung", beschreibung: "Umsätze Belegen zuordnen, ungeklärte Posten klären", frage: "BA10", rolle: "BA10.wer", nachweis: "Klärungsliste" },
    { schritt: "Bankabstimmung", beschreibung: "Saldo Bank und FiBu abstimmen", frage: "BA07", rolle: "BA07.wer", nachweis: "Abstimmungsprotokoll" },
    { schritt: "Ablage", beschreibung: "Kontoauszüge in empfangener Form ablegen", frage: "BA03", nachweis: "Archiv" },
  ],
  kontrollen: [
    { name: "Vier-Augen-Freigabe von Zahlungen", zweck: "Fehlerhafte oder unberechtigte Zahlungen verhindern" },
    { name: "Monatliche Abstimmung Saldo Bank und FiBu", zweck: "Vollständige Übernahme der Bankumsätze" },
    { name: "Durchsicht der Daueraufträge und Lastschriften", zweck: "Nicht mehr berechtigte Zahlungen erkennen" },
    { name: "Überprüfung der Bankvollmachten", zweck: "Nur berechtigte Personen verfügen über Konten" },
    { name: "Klärung ungeklärter Posten innerhalb einer Frist", zweck: "Offene Differenzen begrenzen" },
    { name: "Abgleich der Kreditkartenabrechnung mit den Einzelbelegen", zweck: "Jede Kartenzahlung ist belegt" },
  ],
  aufbewahrung: [
    FRIST_BELEG("Kontoauszüge und Kreditkartenabrechnungen"),
    {
      unterlage: "Elektronisch erhaltene Kontoauszüge",
      frist: "8 Jahre, in der empfangenen elektronischen Form",
      grundlage: "§ 147 Abs. 1 Nr. 4, Abs. 2, 3 AO",
    },
    {
      unterlage: "Zahlungsfreigaben und Bankprotokolle, soweit für die Besteuerung von Bedeutung",
      frist: "6 Jahre",
      grundlage: "§ 147 Abs. 1 Nr. 5, Abs. 3 AO",
    },
  ],
  begriffe: [
    ["Zahlungsvorschlag", "Liste fälliger Zahlungen, die zur Freigabe vorbereitet ist"],
    ["SEPA-Datei", "Datei mit Sammelüberweisungen im SEPA-Format"],
    ["Bankabstimmung", "Abgleich des Kontosaldos der Bank mit dem Bankkonto in der FiBu"],
    ["Lastschriftmandat", "Ermächtigung, Beträge per Lastschrift vom Konto einzuziehen"],
    ["Ungeklärter Posten", "Bankumsatz, der noch keinem Beleg zugeordnet ist"],
  ],
});

const ANLAGEN = defineBereich({
  id: "anlagen",
  prefix: "AN",
  label: "Anlagen",
  titel: "Anlagenbuchhaltung",
  kurz: "Anlagenverzeichnis, Zugang und Aktivierung, geringwertige Wirtschaftsgüter, Abschreibung, Bestandsaufnahme, Abgang.",
  beispiele: "Anlagenmodul der FiBu, Anlagenverzeichnis in Excel",
  abgrenzung:
    "Erfasst sind Anschaffung, Aktivierung, Kennzeichnung, Abschreibung, Bestandsaufnahme und Abgang von Anlagegütern. Die Eingangsrechnung selbst durchläuft den Belegfluss.",
  questions: [
    lead("AN", "Anlagen"),
    {
      id: "AN01",
      title: "Anlagenverzeichnis",
      prompt: "Wo wird das Anlagenverzeichnis geführt, und von wem?",
      fields: [text("system", "System"), text("wer", "Wer führt es")],
      open: "Führung des Anlagenverzeichnisses ist nicht bestätigt.",
      priority: "hoch",
    },
    {
      id: "AN02",
      title: "Zugang und Aktivierung",
      prompt: "Wer entscheidet über Aktivierung, geringwertige Wirtschaftsgüter oder Sammelposten?",
      hint: "Geringwertige Wirtschaftsgüter bis 800 Euro netto (§ 6 Abs. 2 EStG) und Sammelposten für Wirtschaftsgüter über 250 bis 1.000 Euro (§ 6 Abs. 2a EStG).",
      fields: [text("wer", "Wer entscheidet"), area("ablauf", "Ablauf", false)],
      open: "Entscheidung über Aktivierung und geringwertige Wirtschaftsgüter ist nicht bestätigt.",
      priority: "hoch",
    },
    {
      id: "AN03",
      title: "Anschaffungskosten",
      prompt: "Wie werden Anschaffungs- oder Herstellungskosten ermittelt (Nebenkosten, Zuschüsse, Skonti)?",
      fields: [area("ablauf", "Ermittlung")],
      open: "Ermittlung der Anschaffungs- und Herstellungskosten ist nicht bestätigt.",
    },
    {
      id: "AN04",
      title: "Kennzeichnung und Standort",
      prompt: "Erhalten Anlagegüter eine Inventarnummer, und wo ist der Standort vermerkt?",
      fields: [
        pick("kennzeichnung", "Kennzeichnung", ["Inventarnummer mit Etikett", "Inventarnummer nur im Verzeichnis", "Keine"]),
        text("standort", "Standortvermerk", false),
      ],
      open: "Kennzeichnung und Standortvermerk der Anlagegüter sind nicht bestätigt.",
    },
    {
      id: "AN05",
      title: "Abschreibung",
      prompt: "Nach welchen Methoden und Nutzungsdauern wird abgeschrieben, und wer legt sie fest?",
      hint: "Die Absetzung für Abnutzung richtet sich nach § 7 EStG; die amtlichen AfA-Tabellen geben Anhaltspunkte für die Nutzungsdauer.",
      fields: [text("methode", "Methode (z. B. linear)"), text("wer", "Wer legt Nutzungsdauern fest")],
      open: "Abschreibungsmethode und Festlegung der Nutzungsdauern sind nicht bestätigt.",
    },
    {
      id: "AN06",
      title: "Anzahlungen und Anlagen im Bau",
      prompt: "Wie werden Anzahlungen auf Anlagen und Anlagen im Bau erfasst und umgebucht?",
      fields: [area("ablauf", "Ablauf")],
      open: "Erfassung von Anzahlungen und Anlagen im Bau ist nicht bestätigt.",
    },
    {
      id: "AN07",
      title: "Abgang",
      prompt: "Wie werden Verkauf, Verschrottung oder Verlust eines Anlageguts festgehalten und freigegeben?",
      fields: [area("ablauf", "Ablauf"), text("freigabe", "Freigabe")],
      open: "Erfassung und Freigabe von Anlagenabgängen sind nicht bestätigt.",
    },
    {
      id: "AN08",
      title: "Bestandsaufnahme",
      prompt: "Wird der Anlagenbestand regelmäßig körperlich geprüft?",
      fields: [pick("pruefung", "Bestandsaufnahme", ["Ja, jährlich", "Ja, seltener", "Nein", "unbekannt"]), text("wer", "Wer", false)],
      open: "Bestandsaufnahme des Anlagevermögens ist nicht bestätigt.",
    },
    {
      id: "AN09",
      title: "Leasing und Miete",
      prompt: "Welche Leasing- oder Mietverträge über Anlagen bestehen, und wo werden sie geführt?",
      fields: [area("vertraege", "Verträge und Ablage")],
      open: "Leasing- und Mietverträge über Anlagen sind nicht bestätigt.",
    },
    {
      id: "AN10",
      title: "Übernahme in die Buchhaltung",
      prompt: "Wie werden Zugänge, Abschreibungen und Abgänge in die Buchhaltung übernommen?",
      fields: [area("ablauf", "Ablauf"), text("turnus", "Turnus (z. B. monatlich, zum Jahresabschluss)", false)],
      open: "Übernahme von Zugängen, Abschreibungen und Abgängen ist nicht bestätigt.",
    },
  ],
  sections: [
    { title: "Anlagenverzeichnis", questions: ["AN01"] },
    { title: "Zugang, Aktivierung und Anschaffungskosten", questions: ["AN02", "AN03", "AN06"] },
    { title: "Kennzeichnung und Bestandsaufnahme", questions: ["AN04", "AN08"] },
    { title: "Abschreibung und Übernahme", questions: ["AN05", "AN10"] },
    { title: "Abgang", questions: ["AN07"] },
    { title: "Leasing und Miete", questions: ["AN09"] },
  ],
  prozess: [
    { schritt: "Anschaffung", beschreibung: "Rechnung über ein Anlagegut geht ein", frage: "AN03", nachweis: "Eingangsrechnung" },
    { schritt: "Aktivierungsentscheidung", beschreibung: "Anlagegut, GWG oder Sammelposten festlegen", frage: "AN02", rolle: "AN02.wer", nachweis: "Vermerk" },
    { schritt: "Erfassung", beschreibung: "Anlagegut im Verzeichnis anlegen", frage: "AN01", rolle: "AN01.wer", nachweis: "Eintrag im Anlagenverzeichnis" },
    { schritt: "Kennzeichnung", beschreibung: "Inventarnummer und Standort vergeben", frage: "AN04", nachweis: "Etikett, Standortvermerk" },
    { schritt: "Abschreibung", beschreibung: "AfA berechnen", frage: "AN05", rolle: "AN05.wer", nachweis: "AfA-Lauf" },
    { schritt: "Übernahme in die FiBu", beschreibung: "Zugänge, AfA und Abgänge buchen", frage: "AN10", nachweis: "Buchungsbeleg" },
    { schritt: "Bestandsaufnahme", beschreibung: "Bestand körperlich prüfen", frage: "AN08", rolle: "AN08.wer", nachweis: "Bestandsliste" },
    { schritt: "Abgang", beschreibung: "Verkauf, Verschrottung, Verlust freigeben und buchen", frage: "AN07", rolle: "AN07.freigabe", nachweis: "Abgangsbeleg" },
  ],
  kontrollen: [
    { name: "Abgleich Anlagenverzeichnis mit den Anlagenkonten", zweck: "Übereinstimmung von Nebenbuch und FiBu" },
    { name: "Durchsicht der Aufwandskonten auf aktivierungspflichtige Zugänge", zweck: "Vollständige Aktivierung" },
    { name: "Jährliche körperliche Bestandsaufnahme", zweck: "Vorhandensein der Anlagegüter" },
    { name: "Freigabe von Abgängen", zweck: "Nachvollziehbare Abgänge" },
    { name: "Prüfung der GWG- und Sammelpostengrenzen", zweck: "Richtige Zuordnung" },
    { name: "Plausibilisierung des AfA-Laufs", zweck: "Richtige Abschreibung" },
  ],
  aufbewahrung: [
    FRIST_AUFZEICHNUNG("Anlagenverzeichnis als Teil der Bücher bzw. Aufzeichnungen"),
    FRIST_BELEG("Anschaffungs-, Herstellungs- und Verkaufsrechnungen, Abgangsbelege"),
    {
      unterlage: "Leasing- und Mietverträge, soweit für die Besteuerung von Bedeutung",
      frist: "6 Jahre",
      grundlage: "§ 147 Abs. 1 Nr. 5, Abs. 3 AO",
    },
    FRIST_AUFZEICHNUNG("Bestandslisten der körperlichen Aufnahme (Inventar)"),
  ],
  begriffe: [
    ["AfA", "Absetzung für Abnutzung, steuerliche Abschreibung (§ 7 EStG)"],
    ["GWG", "Geringwertiges Wirtschaftsgut, sofort abschreibbar bis 800 Euro netto (§ 6 Abs. 2 EStG)"],
    ["Sammelposten", "Pool für Wirtschaftsgüter über 250 bis 1.000 Euro, über fünf Jahre aufgelöst (§ 6 Abs. 2a EStG)"],
    ["Anlagenverzeichnis", "Verzeichnis aller Anlagegüter mit Zugang, Abschreibung und Buchwert"],
    ["Inventarnummer", "Eindeutige Kennung eines Anlageguts"],
  ],
});

const VORSYSTEM = defineBereich({
  id: "vorsystem",
  prefix: "SV",
  label: "Sonstiges Vorsystem",
  titel: "Vorsystem",
  kurz: "Jedes weitere System mit steuerrelevanten Daten: Zweck, Nutzer, Daten, Stammdaten, Schnittstelle, Abstimmung, Archiv, Rechte.",
  beispiele: "Branchensoftware, Praxissoftware, Fahrtenbuch, Reisekosten-App, Projektzeiterfassung",
  abgrenzung:
    "Erfasst ist ein einzelnes Vorsystem, in dem steuerrelevante Daten entstehen oder verändert werden, von der Datenentstehung bis zur Übergabe an die Buchhaltung und zur Aufbewahrung. Für jedes weitere Vorsystem wird eine eigene Verfahrensdokumentation angelegt.",
  questions: [
    lead("SV", "Vorsystem"),
    {
      id: "SV01",
      title: "System",
      prompt: "Welches System wird beschrieben, wofür wird es genutzt, und wer ist der Anbieter?",
      fields: [text("name", "System"), area("zweck", "Zweck"), text("anbieter", "Anbieter", false)],
      open: "System, Zweck und Anbieter sind nicht bestätigt.",
      priority: "hoch",
    },
    {
      id: "SV02",
      title: "Nutzer und Rollen",
      prompt: "Wer arbeitet mit dem System, und mit welchen Rollen?",
      fields: [area("rollen", "Nutzer und Rollen")],
      open: "Nutzer und Rollen im Vorsystem sind nicht bestätigt.",
    },
    {
      id: "SV03",
      title: "Steuerrelevante Daten",
      prompt: "Welche steuerrelevanten Daten entstehen oder werden verändert?",
      fields: [area("daten", "Daten")],
      open: "Steuerrelevante Daten des Vorsystems sind nicht bestätigt.",
      priority: "hoch",
    },
    {
      id: "SV04",
      title: "Datenentstehung und Eingabeprüfung",
      prompt: "Wie entstehen die Daten (Eingabe, Import, automatisch), und wie werden Eingaben geprüft?",
      fields: [area("ablauf", "Entstehung"), text("pruefung", "Eingabeprüfung", false)],
      open: "Datenentstehung und Eingabeprüfung im Vorsystem sind nicht bestätigt.",
    },
    {
      id: "SV05",
      title: "Stammdaten",
      prompt: "Welche Stammdaten (z. B. Preise, Kunden, Leistungen, Steuerschlüssel) werden im System gepflegt, und von wem?",
      fields: [area("stammdaten", "Stammdaten"), text("wer", "Wer pflegt")],
      open: "Pflege der Stammdaten im Vorsystem ist nicht bestätigt.",
    },
    {
      id: "SV06",
      title: "Schnittstelle",
      prompt: "Wie gelangen die Daten in die Buchhaltung?",
      fields: [area("uebergabe", "Weg der Übergabe"), text("turnus", "Turnus", false)],
      open: "Schnittstelle zur Buchhaltung ist nicht bestätigt.",
      priority: "hoch",
    },
    {
      id: "SV07",
      title: "Abstimmung",
      prompt: "Wie wird geprüft, dass alle Daten vollständig in der Buchhaltung angekommen sind?",
      fields: [area("ablauf", "Abstimmung"), text("wer", "Wer stimmt ab", false)],
      open: "Abstimmung zwischen Vorsystem und Buchhaltung ist nicht bestätigt.",
    },
    {
      id: "SV08",
      title: "Original und Archiv",
      prompt: "Wo bleiben die Originaldaten, und in welcher Form werden sie aufbewahrt?",
      fields: [text("ablage", "Ablage"), pick("auswertbar", "Maschinell auswertbar exportierbar", JA_NEIN_UNKLAR)],
      open: "Aufbewahrung der Originaldaten ist nicht bestätigt.",
    },
    {
      id: "SV09",
      title: "Unveränderbarkeit",
      prompt: "Können abgeschlossene Datensätze nachträglich geändert werden, und wird das protokolliert?",
      hint: "Eine Buchung oder Aufzeichnung darf nicht so verändert werden, dass der ursprüngliche Inhalt nicht mehr feststellbar ist (§ 146 Abs. 4 AO).",
      fields: [text("wer", "Wer darf ändern"), pick("protokolliert", "Änderungen werden protokolliert", JA_NEIN_UNKLAR)],
      open: "Änderungsrechte und Protokollierung im Vorsystem sind nicht bestätigt.",
      priority: "hoch",
    },
    {
      id: "SV10",
      title: "Systemwechsel und Altdaten",
      prompt: "Gab es einen Systemwechsel, und wo sind Altdaten aus dem Vorgängersystem lesbar aufbewahrt?",
      fields: [area("ablauf", "Systemwechsel und Altdaten")],
      open: "Systemwechsel und Lesbarkeit von Altdaten sind nicht bestätigt.",
    },
  ],
  sections: [
    { title: "System, Nutzer und Daten", questions: ["SV01", "SV02", "SV03"] },
    { title: "Datenentstehung und Stammdaten", questions: ["SV04", "SV05"] },
    { title: "Schnittstelle und Abstimmung", questions: ["SV06", "SV07"] },
    {
      title: "Archiv, Unveränderbarkeit und Altdaten",
      hinweis:
        "Bei einem Systemwechsel bleiben die Daten des Vorgängersystems für die Dauer der Aufbewahrungsfrist lesbar und maschinell auswertbar (§ 147 Abs. 2, 6 AO).",
      questions: ["SV08", "SV09", "SV10"],
    },
  ],
  prozess: [
    { schritt: "Datenentstehung", beschreibung: "Daten werden eingegeben, importiert oder erzeugt", frage: "SV04", nachweis: "Datensatz im Vorsystem" },
    { schritt: "Stammdatenpflege", beschreibung: "Stammdaten anlegen und ändern", frage: "SV05", rolle: "SV05.wer", nachweis: "Änderungsprotokoll" },
    { schritt: "Abschluss", beschreibung: "Datensätze abschließen oder festschreiben", frage: "SV09", rolle: "SV09.wer", nachweis: "Status im System" },
    { schritt: "Übergabe an die Buchhaltung", beschreibung: "Daten über die Schnittstelle übergeben", frage: "SV06", nachweis: "Exportdatei, Buchungsstapel" },
    { schritt: "Abstimmung", beschreibung: "Vollständigkeit der Übergabe prüfen", frage: "SV07", rolle: "SV07.wer", nachweis: "Abstimmungsprotokoll" },
    { schritt: "Archivierung", beschreibung: "Originaldaten maschinell auswertbar aufbewahren", frage: "SV08", nachweis: "Archiv bzw. Export" },
  ],
  kontrollen: [
    { name: "Abstimmung der übergebenen Summen mit der FiBu", zweck: "Vollständige Übergabe" },
    { name: "Prüfung des Schnittstellenprotokolls auf Fehler", zweck: "Abgebrochene Übertragungen erkennen" },
    { name: "Durchsicht der Änderungsprotokolle", zweck: "Nachträgliche Änderungen nachvollziehen" },
    { name: "Überprüfung der Benutzerrechte", zweck: "Nur berechtigte Personen ändern Daten" },
    { name: "Test des Datenexports", zweck: "Daten bleiben maschinell auswertbar" },
  ],
  aufbewahrung: [
    FRIST_AUFZEICHNUNG("Steuerrelevante Daten des Vorsystems, soweit Aufzeichnungen, maschinell auswertbar"),
    FRIST_BELEG("Daten und Belege des Vorsystems, soweit Buchungsbelege"),
    FRIST_AUFZEICHNUNG("Handbücher, Konfigurations- und Schnittstellenbeschreibungen des Vorsystems"),
  ],
  begriffe: [
    ["Vorsystem", "System, in dem steuerrelevante Daten vor der Buchhaltung entstehen oder verarbeitet werden"],
    ["Schnittstelle", "Technischer Weg, über den Daten zwischen Systemen übertragen werden"],
    ["Festschreibung", "Sperre eines Datensatzes gegen nachträgliche Änderung"],
    ["Maschinelle Auswertbarkeit", "Daten lassen sich mit Software sortieren, filtern und auswerten"],
  ],
});

export const BEREICHE: Bereich[] = [
  {
    id: BELEGFLUSS,
    label: "Belegfluss",
    titel: "zur Belegablage",
    kurz: "Eingangs- und Ausgangsrechnungen, E-Rechnung, Papier und Scan, Freigabe, Übergabe zur Buchung, Ablage.",
    beispiele: "FiBu, DMS, E-Mail-Postfach, Lieferantenportale",
    abgrenzung: "",
    questions: [],
    sections: [],
    prozess: [],
    kontrollen: [],
    aufbewahrung: [],
    begriffe: [],
  },
  KASSE,
  WARENWIRTSCHAFT,
  EINKAUF,
  VERKAUF,
  RETOUREN,
  ZEITERFASSUNG,
  LOHN,
  ECOMMERCE,
  BANK,
  ANLAGEN,
  VORSYSTEM,
];

const BY_ID = new Map(BEREICHE.map((bereich) => [bereich.id, bereich]));

export function bereichById(id: string | undefined | null): Bereich {
  return BY_ID.get((id ?? "").trim()) ?? BY_ID.get(BELEGFLUSS)!;
}

export function isBereichId(id: string | undefined | null): boolean {
  return BY_ID.has((id ?? "").trim());
}

/** Rows without a stored area are Belegfluss documents. */
export function bereichIdOf(answers: { bereich?: string } | null | undefined): string {
  const id = answers?.bereich?.trim() ?? "";
  return BY_ID.has(id) ? id : BELEGFLUSS;
}

export function isBelegfluss(answers: { bereich?: string } | null | undefined): boolean {
  return bereichIdOf(answers) === BELEGFLUSS;
}

export function bereichLabel(id: string | undefined | null): string {
  return bereichById(id).label;
}

/** „Verfahrensdokumentation zur Belegablage“, „Verfahrensdokumentation Kasse und Kassensystem“. */
export function bereichDocTitle(id: string | undefined | null): string {
  return `Verfahrensdokumentation ${bereichById(id).titel}`;
}

export function bereichQuestion(id: string): { bereich: Bereich; question: BereichQuestion } | null {
  for (const bereich of BEREICHE) {
    const question = bereich.questions.find((item) => item.id === id);
    if (question) return { bereich, question };
  }
  return null;
}

export function bereichChapterId(id: string): string {
  return `bereich-${id}`;
}

export function bereichMatrixChapterId(id: string): string {
  return `bereich-${id}-matrix`;
}

/** Catalog ids that belong to the shared general part and are carried into a new area. */
export const ALLGEMEINER_TEIL_IDS = [
  "A01",
  "A03",
  "B01",
  "B04",
  "B05",
  "G01",
  "G02",
  "G05",
  "G06",
  "H01",
  "H04",
  "I01",
  "I02",
] as const;
