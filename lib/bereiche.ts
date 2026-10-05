/**
 * Bereiche (business areas) for one Verfahrensdokumentation each.
 *
 * One company can keep several Verfahrensdokumentationen, one per area
 * (GoBD 2019 Rz. 151: a Verfahrensdokumentation for every DV-System).
 * Belegfluss is the original product and keeps catalog steps A–I.
 * Every other area shares the general part (A01, B, G, H, I) and adds one
 * area step built from this file.
 *
 * Generator rule (same as the main catalog): only `bestaetigt` becomes a
 * present-tense fact; `geplant` and `unbekannt` become open points;
 * `nicht_zutreffend` prints the stored reason.
 */

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
};

export type BereichSection = {
  title: string;
  /** General, non-company hint. Printed as „Allgemeiner Hinweis“. */
  hinweis?: string;
  questions: string[];
};

export type Bereich = {
  id: string;
  label: string;
  /** Title on the cover: „Verfahrensdokumentation <titel>“. */
  titel: string;
  kurz: string;
  /** Example systems for marketing and the picker. */
  beispiele: string;
  questions: BereichQuestion[];
  sections: BereichSection[];
  /** General retention hints for this area (no flat period for everything). */
  aufbewahrung: string[];
};

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

function lead(prefix: string, bereich: string): BereichQuestion {
  return {
    id: `${prefix}00`,
    title: "Verantwortung",
    prompt: `Wer ist für den Bereich ${bereich} verantwortlich und wer vertritt?`,
    fields: [text("verantwortlich", "Verantwortlich (Name oder Rolle)"), text("vertretung", "Vertretung", false)],
    open: `Verantwortung und Vertretung für den Bereich ${bereich} sind nicht bestätigt.`,
    priority: "hoch",
  };
}

const RETENTION_ORG =
  "Arbeitsanweisungen, Organisationsunterlagen und diese Verfahrensdokumentation: grundsätzlich zehn Jahre (§ 147 Abs. 1 Nr. 1, Abs. 3 AO).";
const RETENTION_BELEG =
  "Buchungsbelege: grundsätzlich acht Jahre (§ 147 Abs. 1 Nr. 4, Abs. 3 AO).";
const RETENTION_BRIEF =
  "Empfangene und abgesandte Handels- und Geschäftsbriefe: grundsätzlich sechs Jahre (§ 147 Abs. 1 Nr. 2, 3, Abs. 3 AO).";

export const BEREICHE: Bereich[] = [
  {
    id: BELEGFLUSS,
    label: "Belegfluss",
    titel: "zur Belegablage",
    kurz: "Eingangs- und Ausgangsrechnungen, E-Rechnung, Papier und Scan, Freigabe, Übergabe zur Buchung, Ablage.",
    beispiele: "FiBu, DMS, E-Mail-Postfach, Lieferantenportale",
    questions: [],
    sections: [],
    aufbewahrung: [],
  },
  {
    id: "kasse",
    label: "Kasse",
    titel: "Kasse und Kassensystem",
    kurz: "Kassensystem mit TSE oder offene Ladenkasse, Tagesabschluss, Kassenbuch, Übergabe an die Buchhaltung.",
    beispiele: "Registrierkasse, POS-System, Tablet-Kasse, offene Ladenkasse",
    questions: [
      lead("KA", "Kasse"),
      {
        id: "KA01",
        title: "Kassenart",
        prompt: "Welche Kasse wird eingesetzt?",
        fields: [
          pick("kassenart", "Art", [
            "Elektronisches Kassensystem mit TSE",
            "Offene Ladenkasse (ohne Kassensystem)",
            "Beides",
          ]),
          text("system", "Hersteller und Software", false),
          text("anzahl", "Anzahl Kassen und Standorte", false),
        ],
        open: "Art der Kasse, Hersteller und Anzahl sind nicht bestätigt.",
        priority: "hoch",
      },
      {
        id: "KA02",
        title: "TSE und Mitteilung",
        prompt: "Ist eine TSE im Einsatz und wurde das System dem Finanzamt mitgeteilt?",
        hint: "Elektronische Aufzeichnungssysteme brauchen eine zertifizierte technische Sicherheitseinrichtung (§ 146a AO, KassenSichV). Die Mitteilung nach § 146a Abs. 4 AO läuft über ELSTER.",
        fields: [
          text("tse", "TSE-Art (z. B. USB, SD, Cloud-TSE)", false),
          pick("mitteilung", "Mitteilung über ELSTER erfolgt", JA_NEIN_UNKLAR),
        ],
        open: "TSE und Mitteilung des Kassensystems an das Finanzamt sind nicht bestätigt.",
        priority: "hoch",
      },
      {
        id: "KA03",
        title: "Belegausgabe",
        prompt: "Wie wird Kundinnen und Kunden ein Beleg zur Verfügung gestellt?",
        fields: [many("beleg", "Belegausgabe", ["Papierbon", "Elektronischer Beleg (QR, E-Mail, App)", "Kein Beleg (offene Ladenkasse)"])],
        open: "Die Belegausgabe ist nicht bestätigt.",
      },
      {
        id: "KA04",
        title: "Tagesabschluss",
        prompt: "Wie läuft der Tagesabschluss: Z-Bon oder Kassenbericht, Zählung, Differenzen?",
        hint: "Bei der offenen Ladenkasse: täglicher Kassenbericht mit Zählprotokoll. Beim Kassensystem: Tagesabschluss (Z-Bon) und Abgleich mit dem Kassenbestand.",
        fields: [
          area("ablauf", "Ablauf Tagesabschluss"),
          text("wer", "Wer zählt und schließt ab"),
          text("differenzen", "Umgang mit Kassendifferenzen", false),
        ],
        open: "Tagesabschluss, Zählung und Umgang mit Differenzen sind nicht bestätigt.",
        priority: "hoch",
      },
      {
        id: "KA05",
        title: "Einlagen, Entnahmen, Sonderfälle",
        prompt: "Wie werden Einlagen, Entnahmen, Trinkgeld, Gutscheine und Storni erfasst?",
        fields: [area("sonderfaelle", "Erfassung der Sonderfälle")],
        open: "Erfassung von Einlagen, Entnahmen, Trinkgeld, Gutscheinen und Storni ist nicht bestätigt.",
      },
      {
        id: "KA06",
        title: "Änderungen und Organisationsunterlagen",
        prompt: "Wer ändert Artikel, Preise oder Programmierung, und wo liegen Bedienungsanleitung und Programmierprotokolle?",
        fields: [
          text("wer", "Wer darf ändern"),
          pick("protokolliert", "Änderungen werden protokolliert", JA_NEIN_UNKLAR),
          text("ablage", "Ablage der Organisationsunterlagen", false),
        ],
        open: "Änderungen am Kassensystem und die Ablage der Organisationsunterlagen sind nicht bestätigt.",
      },
      {
        id: "KA07",
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
        id: "KA08",
        title: "Kassen-Nachschau",
        prompt: "Wer ist bei einer Kassen-Nachschau ansprechbar und wie wird der Datenzugriff gewährt?",
        fields: [text("ansprechpartner", "Ansprechperson vor Ort"), text("zugriff", "Datenzugriff / Export", false)],
        open: "Ansprechperson und Datenzugriff bei einer Kassen-Nachschau sind nicht bestätigt.",
      },
    ],
    sections: [
      {
        title: "Kassensystem, TSE und Belegausgabe",
        hinweis:
          "Elektronische Aufzeichnungssysteme müssen jede Aufzeichnung einzeln, vollständig, richtig, zeitgerecht und geordnet erfassen und durch eine zertifizierte technische Sicherheitseinrichtung schützen (§ 146 Abs. 1, § 146a AO, KassenSichV).",
        questions: ["KA01", "KA02", "KA03"],
      },
      {
        title: "Tagesabschluss und Kassenführung",
        questions: ["KA04", "KA05"],
      },
      {
        title: "Änderungen und Organisationsunterlagen",
        hinweis:
          "Bedienungsanleitungen, Programmier- und Änderungsprotokolle gehören zu den Organisationsunterlagen des Kassensystems.",
        questions: ["KA06"],
      },
      {
        title: "Übergabe an die Buchhaltung und Nachschau",
        hinweis: "Eine Kassen-Nachschau (§ 146b AO) kann ohne vorherige Ankündigung stattfinden.",
        questions: ["KA07", "KA08"],
      },
    ],
    aufbewahrung: [
      "Kassenbuch und Einzelaufzeichnungen des Kassensystems als Bücher und Aufzeichnungen: grundsätzlich zehn Jahre (§ 147 Abs. 1 Nr. 1, Abs. 3 AO), in maschinell auswertbarer Form.",
      RETENTION_BELEG + " Dazu zählen Tagesabschlüsse (Z-Bons), soweit sie Buchungsbelege sind. Kassenberichte werden je nach Funktion als Aufzeichnung oder als Buchungsbeleg eingeordnet; im Zweifel gilt die längere Frist.",
      RETENTION_ORG + " Dazu zählen Bedienungsanleitungen und Programmierprotokolle.",
    ],
  },
  {
    id: "warenwirtschaft",
    label: "Warenwirtschaft",
    titel: "Warenwirtschaft, Lager und Inventur",
    kurz: "Wareneingang, Bestandsführung, Bestandskorrekturen, Inventur, Übergabe an die Buchhaltung.",
    beispiele: "Warenwirtschaftssystem, ERP, Lagerverwaltung, Excel-Bestandsliste",
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
        title: "Wareneingang",
        prompt: "Wie wird der Wareneingang erfasst und mit dem Lieferschein abgeglichen?",
        fields: [area("ablauf", "Ablauf"), text("wer", "Wer erfasst")],
        open: "Erfassung des Wareneingangs ist nicht bestätigt.",
      },
      {
        id: "WW03",
        title: "Bestandsführung und Bewertung",
        prompt: "Wie werden Bestände geführt und bewertet?",
        fields: [
          pick("fuehrung", "Bestandsführung", ["Laufend im System", "Nur zur Inventur", "Gemischt"]),
          text("bewertung", "Bewertungsverfahren (z. B. Durchschnitt, Einzelbewertung)", false),
        ],
        open: "Bestandsführung und Bewertung sind nicht bestätigt.",
      },
      {
        id: "WW04",
        title: "Inventur",
        prompt: "Welches Inventurverfahren wird angewendet, wer zählt, und wo bleiben die Zähllisten?",
        hint: "Möglich sind Stichtagsinventur, permanente Inventur oder Stichprobeninventur (§§ 240, 241 HGB).",
        fields: [
          pick("verfahren", "Verfahren", ["Stichtagsinventur", "Permanente Inventur", "Stichprobeninventur", "Andere"]),
          text("wer", "Wer zählt und prüft"),
          text("zaehllisten", "Ablage der Zähllisten", false),
        ],
        open: "Inventurverfahren, Zuständigkeit und Ablage der Zähllisten sind nicht bestätigt.",
        priority: "hoch",
      },
      {
        id: "WW05",
        title: "Bestandskorrekturen",
        prompt: "Wer bucht Schwund, Verderb oder Korrekturen und wer gibt sie frei?",
        fields: [text("wer", "Wer bucht"), text("freigabe", "Wer gibt frei", false)],
        open: "Bestandskorrekturen und deren Freigabe sind nicht bestätigt.",
      },
      {
        id: "WW06",
        title: "Übergabe an die Buchhaltung",
        prompt: "Wie gelangen Bestandswerte und Inventurergebnis in die Buchhaltung?",
        fields: [area("uebergabe", "Weg der Übergabe")],
        open: "Übergabe von Bestandswerten an die Buchhaltung ist nicht bestätigt.",
      },
    ],
    sections: [
      { title: "System und Wareneingang", questions: ["WW01", "WW02"] },
      { title: "Bestandsführung und Korrekturen", questions: ["WW03", "WW05"] },
      {
        title: "Inventur",
        hinweis:
          "Das Inventar ist zum Schluss jedes Geschäftsjahres aufzustellen; Vereinfachungsverfahren sind nach § 241 HGB zulässig, wenn sie den Grundsätzen ordnungsmäßiger Buchführung entsprechen.",
        questions: ["WW04"],
      },
      { title: "Übergabe an die Buchhaltung", questions: ["WW06"] },
    ],
    aufbewahrung: [
      "Inventare und Inventurunterlagen: grundsätzlich zehn Jahre (§ 147 Abs. 1 Nr. 1, Abs. 3 AO).",
      "Lieferscheine, die keine Buchungsbelege sind: Die Frist endet mit Erhalt bzw. Versand der Rechnung.",
      RETENTION_BELEG,
    ],
  },
  {
    id: "einkauf",
    label: "Einkauf",
    titel: "Einkauf und Bestellwesen",
    kurz: "Bestellung, Freigabegrenzen, Abgleich Bestellung–Lieferung–Rechnung, Lieferantenstammdaten.",
    beispiele: "ERP-Bestellmodul, Lieferantenportale, E-Mail-Bestellungen",
    questions: [
      lead("EK", "Einkauf"),
      {
        id: "EK01",
        title: "Bestellberechtigung",
        prompt: "Wer darf bestellen, und ab welchem Betrag ist eine Freigabe nötig?",
        fields: [text("wer", "Wer bestellt"), text("grenzen", "Freigabegrenzen", false)],
        open: "Bestellberechtigung und Freigabegrenzen sind nicht bestätigt.",
        priority: "hoch",
      },
      {
        id: "EK02",
        title: "Bestellweg",
        prompt: "Über welche Wege und Systeme wird bestellt?",
        fields: [many("wege", "Bestellwege", ["ERP / Warenwirtschaft", "Lieferantenportal", "E-Mail", "Telefon", "Papier"]), text("system", "System", false)],
        open: "Bestellwege und System sind nicht bestätigt.",
      },
      {
        id: "EK03",
        title: "Abgleich Bestellung, Lieferung, Rechnung",
        prompt: "Wie werden Bestellung, Lieferung und Rechnung abgeglichen, bevor die Rechnung freigegeben wird?",
        fields: [area("ablauf", "Ablauf"), text("wer", "Wer gleicht ab")],
        open: "Der Abgleich von Bestellung, Lieferung und Rechnung ist nicht bestätigt.",
        priority: "hoch",
      },
      {
        id: "EK04",
        title: "Lieferantenstammdaten",
        prompt: "Wer legt Lieferanten an und ändert Bankverbindungen, und gilt dafür ein Vier-Augen-Prinzip?",
        fields: [text("wer", "Wer pflegt"), pick("vierAugen", "Bankdatenänderung im Vier-Augen-Prinzip", JA_NEIN_UNKLAR)],
        open: "Pflege der Lieferantenstammdaten und Kontrolle von Bankdatenänderungen sind nicht bestätigt.",
      },
      {
        id: "EK05",
        title: "Ablage der Einkaufsunterlagen",
        prompt: "Wo werden Bestellungen, Auftragsbestätigungen und Lieferscheine abgelegt?",
        fields: [text("ablage", "Ablageort")],
        open: "Ablage von Bestellungen, Auftragsbestätigungen und Lieferscheinen ist nicht bestätigt.",
      },
    ],
    sections: [
      { title: "Bestellung und Freigabe", questions: ["EK01", "EK02"] },
      { title: "Wareneingang und Rechnungsabgleich", questions: ["EK03"] },
      { title: "Stammdaten und Ablage", questions: ["EK04", "EK05"] },
    ],
    aufbewahrung: [RETENTION_BRIEF + " Dazu zählen Bestellungen und Auftragsbestätigungen.", RETENTION_BELEG, "Lieferscheine, die keine Buchungsbelege sind: Die Frist endet mit Erhalt der Rechnung."],
  },
  {
    id: "verkauf",
    label: "Verkauf",
    titel: "Verkauf und Fakturierung",
    kurz: "Angebot, Auftrag, Lieferung, Rechnung, Nummernkreise, Rechnungsversand, Mahnwesen.",
    beispiele: "Faktura- oder Auftragssoftware, ERP, Rechnungsprogramm der FiBu",
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
        title: "Rechnungsnummern",
        prompt: "Wie werden Rechnungsnummern vergeben, und gibt es mehrere Nummernkreise?",
        hint: "Rechnungen tragen eine fortlaufende Nummer, die einmalig vergeben wird (§ 14 Abs. 4 UStG).",
        fields: [text("vergabe", "Vergabe"), text("kreise", "Nummernkreise", false)],
        open: "Vergabe der Rechnungsnummern ist nicht bestätigt.",
      },
      {
        id: "VK03",
        title: "Rechnungsversand",
        prompt: "In welchem Format und über welchen Weg werden Rechnungen versendet?",
        fields: [many("format", "Format", ["PDF per E-Mail", "XRechnung", "ZUGFeRD", "Papier", "Portal"])],
        open: "Format und Weg des Rechnungsversands sind nicht bestätigt.",
      },
      {
        id: "VK04",
        title: "Kundenstammdaten",
        prompt: "Wer legt Kunden an und ändert Stammdaten?",
        fields: [text("wer", "Wer pflegt")],
        open: "Pflege der Kundenstammdaten ist nicht bestätigt.",
      },
      {
        id: "VK05",
        title: "Offene Posten und Mahnwesen",
        prompt: "Wer überwacht offene Forderungen und mahnt, und in welchem Turnus?",
        fields: [text("wer", "Wer"), text("turnus", "Turnus", false)],
        open: "Überwachung offener Posten und Mahnwesen sind nicht bestätigt.",
      },
      {
        id: "VK06",
        title: "Übergabe an die Buchhaltung",
        prompt: "Wie gelangen Ausgangsrechnungen in die Buchhaltung?",
        fields: [area("uebergabe", "Weg der Übergabe")],
        open: "Übergabe der Ausgangsrechnungen an die Buchhaltung ist nicht bestätigt.",
      },
    ],
    sections: [
      { title: "Auftragsabwicklung", questions: ["VK01", "VK04"] },
      {
        title: "Rechnungsstellung",
        hinweis:
          "Im inländischen B2B-Verkehr wird die E-Rechnung beim Versand schrittweise Pflicht (Übergangsregeln bis 2027/2028). Eine PDF-Datei ist keine E-Rechnung im Sinne des § 14 UStG.",
        questions: ["VK02", "VK03"],
      },
      { title: "Forderungen und Übergabe", questions: ["VK05", "VK06"] },
    ],
    aufbewahrung: [RETENTION_BELEG + " Dazu zählen Ausgangsrechnungen.", RETENTION_BRIEF + " Dazu zählen Angebote und Auftragsbestätigungen, soweit sie Geschäftsbriefe sind."],
  },
  {
    id: "retouren",
    label: "Retouren",
    titel: "Retouren, Rücksendungen und Gutschriften",
    kurz: "Rücksendung, Warenprüfung, Stornorechnung oder Gutschrift, Erstattung, Bestandsbuchung.",
    beispiele: "Shop-Retourenportal, Warenwirtschaft, Fakturierung",
    questions: [
      lead("RT", "Retouren"),
      {
        id: "RT01",
        title: "Retourenkanäle und Erfassung",
        prompt: "Über welche Wege kommen Rücksendungen an, und wo werden sie erfasst?",
        fields: [area("kanaele", "Wege und Erfassung")],
        open: "Retourenkanäle und Erfassung sind nicht bestätigt.",
        priority: "hoch",
      },
      {
        id: "RT02",
        title: "Prüfung und Entscheidung",
        prompt: "Wer prüft die zurückgesandte Ware und entscheidet über Erstattung, Ersatz oder Ablehnung?",
        fields: [text("wer", "Wer prüft und entscheidet"), text("dokumentation", "Wie wird die Entscheidung festgehalten", false)],
        open: "Warenprüfung und Entscheidung über Retouren sind nicht bestätigt.",
      },
      {
        id: "RT03",
        title: "Korrekturbeleg",
        prompt: "Welcher Beleg entsteht bei einer Retoure, und wie verweist er auf die ursprüngliche Rechnung?",
        hint: "Eine Stornorechnung oder Rechnungskorrektur bezieht sich auf die Ursprungsrechnung. Eine Gutschrift im umsatzsteuerlichen Sinn ist eine Abrechnung durch den Leistungsempfänger und nicht dasselbe wie eine kaufmännische Gutschrift.",
        fields: [
          many("beleg", "Beleg", ["Stornorechnung", "Rechnungskorrektur", "Kaufmännische Gutschrift", "Kein eigener Beleg"]),
          text("bezug", "Bezug auf die Ursprungsrechnung"),
        ],
        open: "Korrekturbeleg und Bezug zur Ursprungsrechnung sind nicht bestätigt.",
        priority: "hoch",
      },
      {
        id: "RT04",
        title: "Erstattung",
        prompt: "Wie wird erstattet, und wer gibt die Erstattung frei?",
        fields: [text("weg", "Erstattungsweg"), text("freigabe", "Freigabe")],
        open: "Erstattungsweg und Freigabe sind nicht bestätigt.",
      },
      {
        id: "RT05",
        title: "Bestandsbuchung",
        prompt: "Wie wird die zurückgenommene Ware im Bestand gebucht?",
        fields: [area("bestand", "Bestandsbuchung")],
        open: "Bestandsbuchung von Retouren ist nicht bestätigt.",
      },
      {
        id: "RT06",
        title: "Ablage",
        prompt: "Wo werden Retourenunterlagen (Retourenschein, Prüfprotokoll, Korrekturbeleg) abgelegt?",
        fields: [text("ablage", "Ablageort")],
        open: "Ablage der Retourenunterlagen ist nicht bestätigt.",
      },
    ],
    sections: [
      { title: "Eingang und Prüfung der Retoure", questions: ["RT01", "RT02"] },
      {
        title: "Korrekturbeleg und Erstattung",
        hinweis:
          "Die Änderung der Bemessungsgrundlage ist umsatzsteuerlich zu berichtigen (§ 17 UStG). Eine berichtigte Rechnung muss sich spezifisch und eindeutig auf die ursprüngliche Rechnung beziehen (§ 31 Abs. 5 UStDV).",
        questions: ["RT03", "RT04"],
      },
      { title: "Bestand und Ablage", questions: ["RT05", "RT06"] },
    ],
    aufbewahrung: [RETENTION_BELEG + " Dazu zählen Stornorechnungen, Rechnungskorrekturen und Erstattungsbelege.", RETENTION_BRIEF],
  },
  {
    id: "zeiterfassung",
    label: "Zeiterfassung",
    titel: "Zeiterfassung",
    kurz: "Erfassung der Arbeitszeit, Korrekturen, Übergabe an die Lohnabrechnung, Aufbewahrung.",
    beispiele: "Zeiterfassungs-App, Terminal, Stundenzettel, Excel",
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
        title: "Erfassung",
        prompt: "Wer erfasst die Zeiten und bis wann?",
        fields: [text("wer", "Wer erfasst"), text("frist", "Bis wann (z. B. täglich)", false)],
        open: "Wer Zeiten erfasst und bis wann, ist nicht bestätigt.",
      },
      {
        id: "ZE03",
        title: "Korrekturen",
        prompt: "Wer darf erfasste Zeiten korrigieren, und wird die Korrektur protokolliert?",
        fields: [text("wer", "Wer darf korrigieren"), pick("protokolliert", "Korrekturen werden protokolliert", JA_NEIN_UNKLAR)],
        open: "Korrekturrechte und Protokollierung in der Zeiterfassung sind nicht bestätigt.",
      },
      {
        id: "ZE04",
        title: "Übergabe an die Lohnabrechnung",
        prompt: "Wie gelangen die Zeiten in die Lohnabrechnung?",
        fields: [area("uebergabe", "Weg der Übergabe")],
        open: "Übergabe der Zeiten an die Lohnabrechnung ist nicht bestätigt.",
        priority: "hoch",
      },
      {
        id: "ZE05",
        title: "Aufbewahrung und Export",
        prompt: "Wo werden Zeitnachweise aufbewahrt, und lassen sie sich exportieren?",
        fields: [text("ablage", "Ablage"), pick("export", "Export möglich und geprüft", JA_NEIN_UNKLAR)],
        open: "Aufbewahrung und Export der Zeitnachweise sind nicht bestätigt.",
      },
    ],
    sections: [
      {
        title: "Erfassung der Arbeitszeit",
        hinweis:
          "Steuerlich relevant werden Zeitnachweise, soweit sie Grundlage der Lohnabrechnung sind. Arbeitsrechtliche Aufzeichnungspflichten (z. B. § 16 Abs. 2 ArbZG, § 17 MiLoG) bleiben unberührt.",
        questions: ["ZE01", "ZE02", "ZE03"],
      },
      { title: "Übergabe und Aufbewahrung", questions: ["ZE04", "ZE05"] },
    ],
    aufbewahrung: [
      "Aufzeichnungen nach § 16 Abs. 2 ArbZG und § 17 MiLoG: mindestens zwei Jahre.",
      "Zeitnachweise, die Grundlage der Lohnabrechnung sind, werden wie die zugehörigen Lohnunterlagen aufbewahrt.",
    ],
  },
  {
    id: "lohn",
    label: "Lohn",
    titel: "Lohn- und Gehaltsabrechnung",
    kurz: "Abrechnung intern oder über Kanzlei, Personalstammdaten, Lohnunterlagen, Übergabe an die Buchhaltung.",
    beispiele: "Lohnsoftware, Lohnabrechnung über Kanzlei oder Dienstleister",
    questions: [
      lead("LO", "Lohn"),
      {
        id: "LO01",
        title: "Abrechnung",
        prompt: "Wer rechnet Löhne und Gehälter ab, und mit welchem System?",
        fields: [pick("wer", "Abrechnung durch", ["Intern", "Kanzlei", "Externer Dienstleister"]), text("system", "System", false)],
        open: "Wer die Lohnabrechnung erstellt und mit welchem System, ist nicht bestätigt.",
        priority: "hoch",
      },
      {
        id: "LO02",
        title: "Personalstammdaten und Änderungen",
        prompt: "Wer meldet Eintritte, Austritte und Gehaltsänderungen, und wer gibt sie frei?",
        fields: [text("meldet", "Wer meldet"), text("freigabe", "Wer gibt frei")],
        open: "Meldung und Freigabe von Änderungen der Personalstammdaten sind nicht bestätigt.",
        priority: "hoch",
      },
      {
        id: "LO03",
        title: "Lohnunterlagen",
        prompt: "Wo liegen Lohnkonten, Abrechnungen und Meldungen?",
        fields: [text("ablage", "Ablageort")],
        open: "Ablage von Lohnkonten, Abrechnungen und Meldungen ist nicht bestätigt.",
      },
      {
        id: "LO04",
        title: "Übergabe an die Buchhaltung",
        prompt: "Wie gelangen die Lohnwerte in die Buchhaltung (Lohnjournal, Buchungsliste)?",
        fields: [area("uebergabe", "Weg der Übergabe")],
        open: "Übergabe der Lohnwerte an die Buchhaltung ist nicht bestätigt.",
      },
      {
        id: "LO05",
        title: "Zugriff auf Lohndaten",
        prompt: "Wer hat Zugriff auf Lohndaten?",
        fields: [text("wer", "Zugriffsberechtigte")],
        open: "Zugriffsrechte auf Lohndaten sind nicht bestätigt.",
      },
      {
        id: "LO06",
        title: "Auszahlung",
        prompt: "Wer gibt die Auszahlung der Löhne frei?",
        fields: [text("freigabe", "Freigabe der Auszahlung")],
        open: "Freigabe der Lohnauszahlung ist nicht bestätigt.",
      },
    ],
    sections: [
      { title: "Abrechnung und Stammdaten", questions: ["LO01", "LO02"] },
      {
        title: "Lohnunterlagen und Zugriff",
        hinweis: "Für jeden Arbeitnehmer ist ein Lohnkonto zu führen (§ 41 EStG).",
        questions: ["LO03", "LO05"],
      },
      { title: "Übergabe und Auszahlung", questions: ["LO04", "LO06"] },
    ],
    aufbewahrung: [
      "Lohnkonto: bis zum Ablauf des sechsten Kalenderjahres, das auf die zuletzt eingetragene Lohnzahlung folgt (§ 41 Abs. 1 EStG).",
      RETENTION_BELEG + " Dazu zählen Lohnabrechnungen, soweit sie Buchungsbelege sind.",
      "Entgeltunterlagen für die Sozialversicherung: nach § 28f SGB IV.",
    ],
  },
  {
    id: "ecommerce",
    label: "E-Commerce",
    titel: "E-Commerce, Marktplätze und Zahlungsdienstleister",
    kurz: "Onlineshop, Marktplätze, Zahlungsdienstleister, Bestelldaten, Abstimmung der Auszahlungen.",
    beispiele: "Shopify, Shopware, WooCommerce, Amazon, eBay, PayPal, Stripe, Klarna",
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
        title: "Zahlungsdienstleister",
        prompt: "Welche Zahlungsdienstleister werden genutzt?",
        fields: [area("anbieter", "Zahlungsdienstleister")],
        open: "Zahlungsdienstleister sind nicht bestätigt.",
      },
      {
        id: "EC03",
        title: "Bestelldaten",
        prompt: "Wo liegen die einzelnen Bestellungen, und wie werden sie exportiert?",
        fields: [text("ort", "System"), text("export", "Export und Turnus", false)],
        open: "Speicherort und Export der Bestelldaten sind nicht bestätigt.",
        priority: "hoch",
      },
      {
        id: "EC04",
        title: "Abstimmung der Auszahlungen",
        prompt: "Wer stimmt Auszahlungs- und Gebührenreports der Plattformen und Zahlungsdienstleister mit der Buchhaltung ab, und wie oft?",
        fields: [text("wer", "Wer"), text("turnus", "Turnus")],
        open: "Abstimmung von Auszahlungen und Gebühren ist nicht bestätigt.",
        priority: "hoch",
      },
      {
        id: "EC05",
        title: "Rechnungen an Kunden",
        prompt: "Wie entstehen die Rechnungen an Kundinnen und Kunden?",
        fields: [area("rechnung", "Rechnungserstellung")],
        open: "Rechnungserstellung im Onlinehandel ist nicht bestätigt.",
      },
      {
        id: "EC06",
        title: "Aufbewahrung der Rohdaten",
        prompt: "Wo werden Bestell- und Zahlungsdaten der Plattformen dauerhaft gespeichert?",
        fields: [text("ablage", "Ablage")],
        open: "Dauerhafte Speicherung der Plattform- und Zahlungsdaten ist nicht bestätigt.",
      },
    ],
    sections: [
      { title: "Kanäle und Zahlungswege", questions: ["EC01", "EC02"] },
      {
        title: "Bestelldaten und Rechnungen",
        hinweis: "Einzelne Bestellungen sind einzeln, vollständig und nachvollziehbar aufzuzeichnen (§ 146 Abs. 1 AO).",
        questions: ["EC03", "EC05"],
      },
      { title: "Abstimmung und Aufbewahrung", questions: ["EC04", "EC06"] },
    ],
    aufbewahrung: [RETENTION_BELEG + " Dazu zählen Auszahlungs- und Gebührenabrechnungen.", "Plattform- und Zahlungsdaten liegen oft nur befristet beim Anbieter. Sie werden vor Ablauf in eigene Ablage übernommen."],
  },
  {
    id: "bank",
    label: "Bank",
    titel: "Bank und Zahlungsverkehr",
    kurz: "Konten, Kontoauszüge, Zahlungsfreigabe, Bankabstimmung, Übergabe an die Buchhaltung.",
    beispiele: "Onlinebanking, Banking-Software, Bankschnittstelle der FiBu",
    questions: [
      lead("BA", "Bank"),
      {
        id: "BA01",
        title: "Konten und Zugang",
        prompt: "Welche Geschäftskonten gibt es, und wer hat Zugang?",
        fields: [area("konten", "Konten"), text("zugang", "Zugangsberechtigte")],
        open: "Geschäftskonten und Bankzugänge sind nicht bestätigt.",
        priority: "hoch",
      },
      {
        id: "BA02",
        title: "Kontoauszüge",
        prompt: "Wie werden Kontoauszüge abgerufen und abgelegt?",
        fields: [pick("format", "Format", ["Elektronisch (PDF)", "Elektronisch (Datensatz/Schnittstelle)", "Papier", "Gemischt"]), text("ablage", "Ablage")],
        open: "Abruf und Ablage der Kontoauszüge sind nicht bestätigt.",
      },
      {
        id: "BA03",
        title: "Zahlungsfreigabe",
        prompt: "Wer gibt Zahlungen frei, und gilt ein Vier-Augen-Prinzip oder ein Limit?",
        fields: [text("wer", "Wer gibt frei"), pick("vierAugen", "Vier-Augen-Prinzip", JA_NEIN_UNKLAR), text("limit", "Limits", false)],
        open: "Zahlungsfreigabe und Vier-Augen-Prinzip sind nicht bestätigt.",
        priority: "hoch",
      },
      {
        id: "BA04",
        title: "Bankabstimmung",
        prompt: "Wer stimmt Bank und Buchhaltung ab, und wie oft?",
        fields: [text("wer", "Wer"), text("turnus", "Turnus")],
        open: "Abstimmung von Bank und Buchhaltung ist nicht bestätigt.",
      },
      {
        id: "BA05",
        title: "Übergabe an die Buchhaltung",
        prompt: "Wie gelangen Bankumsätze in die Buchhaltung?",
        fields: [area("uebergabe", "Weg der Übergabe")],
        open: "Übergabe der Bankumsätze an die Buchhaltung ist nicht bestätigt.",
      },
    ],
    sections: [
      { title: "Konten und Kontoauszüge", questions: ["BA01", "BA02"] },
      { title: "Zahlungen und Abstimmung", questions: ["BA03", "BA04", "BA05"] },
    ],
    aufbewahrung: [RETENTION_BELEG + " Dazu zählen Kontoauszüge.", "Elektronisch erhaltene Kontoauszüge werden in der empfangenen Form aufbewahrt."],
  },
  {
    id: "anlagen",
    label: "Anlagen",
    titel: "Anlagenbuchhaltung",
    kurz: "Anlagenverzeichnis, Zugang und Aktivierung, geringwertige Wirtschaftsgüter, Abgang, Abschreibung.",
    beispiele: "Anlagenmodul der FiBu, Anlagenverzeichnis in Excel",
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
        hint: "Geringwertige Wirtschaftsgüter und Sammelposten richten sich nach § 6 Abs. 2 und 2a EStG.",
        fields: [text("wer", "Wer entscheidet"), area("ablauf", "Ablauf", false)],
        open: "Entscheidung über Aktivierung und geringwertige Wirtschaftsgüter ist nicht bestätigt.",
      },
      {
        id: "AN03",
        title: "Abgang",
        prompt: "Wie werden Verkauf, Verschrottung oder Verlust eines Anlageguts festgehalten und freigegeben?",
        fields: [area("ablauf", "Ablauf"), text("freigabe", "Freigabe", false)],
        open: "Erfassung und Freigabe von Anlagenabgängen sind nicht bestätigt.",
      },
      {
        id: "AN04",
        title: "Bestandsaufnahme",
        prompt: "Wird der Anlagenbestand regelmäßig körperlich geprüft?",
        fields: [pick("pruefung", "Bestandsaufnahme", ["Ja, jährlich", "Ja, seltener", "Nein", "unbekannt"]), text("wer", "Wer", false)],
        open: "Bestandsaufnahme des Anlagevermögens ist nicht bestätigt.",
      },
      {
        id: "AN05",
        title: "Abschreibung und Übergabe",
        prompt: "Wie werden Abschreibungen berechnet und in die Buchhaltung übernommen?",
        fields: [area("ablauf", "Ablauf")],
        open: "Berechnung und Übernahme der Abschreibungen sind nicht bestätigt.",
      },
    ],
    sections: [
      { title: "Anlagenverzeichnis und Zugang", questions: ["AN01", "AN02"] },
      { title: "Abgang und Bestandsaufnahme", questions: ["AN03", "AN04"] },
      { title: "Abschreibung", questions: ["AN05"] },
    ],
    aufbewahrung: ["Anlagenverzeichnis als Teil der Bücher bzw. Aufzeichnungen: grundsätzlich zehn Jahre (§ 147 Abs. 1 Nr. 1, Abs. 3 AO).", RETENTION_BELEG + " Dazu zählen Anschaffungs- und Verkaufsrechnungen."],
  },
  {
    id: "vorsystem",
    label: "Sonstiges Vorsystem",
    titel: "Vorsystem",
    kurz: "Jedes weitere System mit steuerrelevanten Daten: Zweck, Daten, Schnittstelle, Archiv, Rechte.",
    beispiele: "Branchensoftware, Praxissoftware, Fahrtenbuch, Reisekosten-App, Projektzeiterfassung",
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
        title: "Steuerrelevante Daten",
        prompt: "Welche steuerrelevanten Daten entstehen oder werden verändert?",
        fields: [area("daten", "Daten")],
        open: "Steuerrelevante Daten des Vorsystems sind nicht bestätigt.",
        priority: "hoch",
      },
      {
        id: "SV03",
        title: "Schnittstelle",
        prompt: "Wie gelangen die Daten in die Buchhaltung?",
        fields: [area("uebergabe", "Weg der Übergabe"), text("turnus", "Turnus", false)],
        open: "Schnittstelle zur Buchhaltung ist nicht bestätigt.",
      },
      {
        id: "SV04",
        title: "Original und Archiv",
        prompt: "Wo bleiben die Originaldaten, und in welcher Form werden sie aufbewahrt?",
        fields: [text("ablage", "Ablage"), pick("auswertbar", "Maschinell auswertbar exportierbar", JA_NEIN_UNKLAR)],
        open: "Aufbewahrung der Originaldaten ist nicht bestätigt.",
      },
      {
        id: "SV05",
        title: "Rechte und Änderungen",
        prompt: "Wer darf Daten ändern, und werden Änderungen protokolliert?",
        fields: [text("wer", "Wer darf ändern"), pick("protokolliert", "Änderungen werden protokolliert", JA_NEIN_UNKLAR)],
        open: "Änderungsrechte und Protokollierung im Vorsystem sind nicht bestätigt.",
      },
    ],
    sections: [
      { title: "System und Daten", questions: ["SV01", "SV02"] },
      { title: "Übergabe, Archiv und Rechte", questions: ["SV03", "SV04", "SV05"] },
    ],
    aufbewahrung: [RETENTION_BELEG, RETENTION_ORG, "Daten aus Vorsystemen werden in maschinell auswertbarer Form aufbewahrt, soweit sie steuerrelevant sind."],
  },
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
