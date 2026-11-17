/**
 * Neutrale Antwortbasis der Standardfassung, je Branche neu formuliert.
 * Nicht aus Musterfirmen oder Musterantworten abgeleitet.
 */

import { ensureGesamt, setModulEintrag } from "@/lib/module/status";
import { emptyAnswers, type CheckoutIdentity, type IntakeAnswers } from "@/lib/types";
import { standardFall } from "@/lib/schnellversion-bausteine";
import type { SchnellversionAnswers } from "@/lib/schnellversion-answers";

const VORLAGE: Record<string, string> = {
  handwerk: "handwerk",
  handel: "handel",
  ecommerce: "ecommerce",
  gastro: "gastro",
  dienstleistung: "dienstleister",
  freiberuf: "dienstleister",
  sonstiges: "dienstleister",
};

type Entry = {
  status: "bestaetigt" | "nicht_zutreffend";
  values: Record<string, unknown>;
  reason?: string;
};

const FEST = "ist im Betrieb festzulegen und hier einzutragen";
const GF = "die Geschäftsführung";
const BUCH = "die Buchhaltung";

function ja(values: Record<string, unknown>): Entry {
  return { status: "bestaetigt", values };
}

function entfaelltOffeneKasse(): Entry {
  return { status: "nicht_zutreffend", values: {}, reason: "offene Ladenkasse" };
}

export const EINZELAUFZEICHNUNG_SATZ =
  "Grundsätzlich wird jeder Geschäftsvorfall einzeln aufgezeichnet (§ 146 Abs. 1 Satz 1 AO). Die Ausnahme nach § 146 Abs. 1 Satz 3 AO (Verkauf an eine Vielzahl nicht bekannter Personen gegen Barzahlung, bei Dienstleistungen nur mit kurzem Bestell- und Bezahlkontakt, AEAO zu § 146 Nr. 2.2.5, 2.2.6) wird genutzt: ja/nein – ist im Betrieb festzulegen. Soweit tatsächlich Einzelaufzeichnungen geführt werden (z. B. Bonblock, Bewirtungsrechnung), sind diese aufzubewahren (bitte prüfen).";

const HANDWERK_RECHNUNG =
  "Rechnungen über Bauleistungen an Privatpersonen enthalten den Hinweis auf deren zweijährige Aufbewahrungspflicht nach § 14 Abs. 4 Satz 1 Nr. 9 UStG (i. V. m. § 14b Abs. 1 Satz 5 UStG) (bitte prüfen). Bei Bauleistungen an andere Bauunternehmen wird geprüft, ob die Steuerschuldnerschaft des Leistungsempfängers nach § 13b UStG greift.";

const HANDWERK_NACHWEIS =
  "Leistungsnachweise: Aufmaß, Stundenzettel, Abnahmeprotokoll – Form und Ablage sind festzulegen.";

function aufbewahrung(): string {
  return "Aufbewahrung: Bücher und Aufzeichnungen 10 Jahre, Buchungsbelege 8 Jahre, Handels- und Geschäftsbriefe 6 Jahre (§ 147 Abs. 3 AO). Die Frist beginnt mit dem Schluss des Kalenderjahres (§ 147 Abs. 4 AO).";
}

const OFFENE_KASSE = "Ja, offene Ladenkasse (ohne elektronisches System)";

export function kassenNotverfahren(kasse: string): string {
  if (kasse === OFFENE_KASSE) {
    return "Bei Verlust oder fehlendem Kassenbericht: nachträgliche Ermittlung dokumentieren (bitte prüfen).";
  }
  return "Bei Ausfall von Kasse oder TSE: Ersatzaufzeichnung (Notbon oder Liste), Ausfallzeit und Grund dokumentieren, Belege kennzeichnen, Nacherfassung festhalten (bitte prüfen).";
}

export const OFFENE_KASSE_FRIST = [
  "Bei offener Ladenkasse zusätzlich aufbewahren:",
  "– Kassenberichte (Grundaufzeichnung der Bareinnahmen) und, soweit erstellt, die zugehörigen Zählprotokolle: 10 Jahre (§ 147 Abs. 1 Nr. 1, Abs. 3 Satz 1 AO).",
  "– Einzelaufzeichnungen, soweit geführt (z. B. Bonblock, Strichliste): 10 Jahre (§ 147 Abs. 1 Nr. 1, Abs. 3 Satz 1 AO). Werden sie durch die geordnete Sammlung der Barbelege ersetzt, gilt für diese Sammlung ebenfalls 10 Jahre (bitte prüfen).",
  "– Einzahlungsquittungen, Einlage- und Entnahmebelege: 8 Jahre als Buchungsbelege (§ 147 Abs. 1 Nr. 4, Abs. 3 Satz 1 AO).",
  "Ein Zählprotokoll ist nicht vorgeschrieben, erleichtert aber den Nachweis des Auszählens.",
].join("\n");

export const FREIBERUF_EUR =
  "Gewinnermittlung in der Regel durch Einnahmenüberschussrechnung nach § 4 Abs. 3 EStG (Zufluss/Abfluss, § 11 EStG); keine Buchführungspflicht nach HGB oder § 141 AO (bitte prüfen).";

export function mitEinzelaufzeichnung(body: string, chapterId: string, kasse: string | undefined): string {
  if (chapterId !== "modul-m08" || (kasse !== OFFENE_KASSE && kasse !== "Unsicher")) return body;
  const satz = kasse === "Unsicher" ? `Bei offener Ladenkasse: ${EINZELAUFZEICHNUNG_SATZ}` : EINZELAUFZEICHNUNG_SATZ;
  const block = `**Einzelaufzeichnung:** ${satz}`;
  if (body.includes(block)) return body;
  const mark = "**Kassenart:**";
  const at = body.indexOf(mark);
  if (at < 0) return `${body}\n\n${block}`;
  const lineEnd = body.indexOf("\n", at);
  const cut = lineEnd < 0 ? body.length : lineEnd;
  return `${body.slice(0, cut)}\n\n${block}${body.slice(cut)}`;
}

function nachAufbewahrung(body: string, block: string): string {
  const lines = body.split("\n");
  const head = lines.findIndex((line) => /^## \S+ Aufbewahrung\s*$/u.test(line));
  if (head < 0) return `${body.trim()}\n\n${block}\n`;
  let index = head + 1;
  let lastTable = -1;
  while (index < lines.length && !/^## /u.test(lines[index] ?? "")) {
    if ((lines[index] ?? "").startsWith("|")) lastTable = index;
    index += 1;
  }
  const at = lastTable >= 0 ? lastTable + 1 : head + 1;
  lines.splice(at, 0, "", block, "");
  return lines.join("\n");
}

/** Unsicher: Fristliste unter die Tabelle 8.4, elektronische Angaben an die Bedingung binden. */
export function mitKassenNotverfahren(body: string, chapterId: string, kasse: string | undefined): string {
  if (chapterId !== "modul-m08" || !kasse || kasse === "Nein, keine Bargeldeinnahmen") return body;
  let next = body;
  if (kasse === "Unsicher") {
    next = next
      .replaceAll(
        "| Einzelaufzeichnungen des Kassensystems einschließlich TSE-Daten, maschinell auswertbar |",
        "| Bei elektronischem System: Einzelaufzeichnungen des Kassensystems einschließlich TSE-Daten, maschinell auswertbar |",
      )
      .replaceAll(
        "| Bedienungsanleitungen, Programmier- und Änderungsprotokolle des Kassensystems |",
        "| Bei elektronischem System: Bedienungsanleitungen, Programmier- und Änderungsprotokolle des Kassensystems |",
      )
      .replaceAll("**TSE und Mitteilung:**", "Bei elektronischem System: **TSE und Mitteilung:**")
      .replaceAll("| TSE und Mitteilung |", "| Bei elektronischem System: TSE und Mitteilung |");
    next = next.replace(/\n+Bei offener Ladenkasse zusätzlich aufbewahren:[\s\S]*?(?=\n## |\n# |$)/g, "\n");
    if (!next.includes("Bei offener Ladenkasse zusätzlich aufbewahren:")) {
      next = nachAufbewahrung(next, OFFENE_KASSE_FRIST);
    }
  }
  return `${next}\n\n## Notverfahren bei Kassenausfall\n\n${kassenNotverfahren(kasse)}`;
}

export function mitFreiberuf(body: string, chapterId: string, branche: string | undefined): string {
  if (chapterId !== "modul-m09" || branche !== "freiberuf" || body.includes(FREIBERUF_EUR)) return body;
  return `${body}\n\n**Gewinnermittlung:** ${FREIBERUF_EUR}`;
}

function kasseAntworten(kasse: SchnellversionAnswers["kasse"]): Record<string, Entry> {
  const offen = kasse === OFFENE_KASSE;
  const unsicher = kasse === "Unsicher";
  const kassenart = offen
    ? "Offene Ladenkasse mit täglichem Kassenbericht"
    : unsicher
      ? "elektronisch mit TSE oder offene Ladenkasse – ist im Betrieb festzulegen"
      : "Elektronisches Aufzeichnungssystem mit TSE";
  const ablauf = offen
    ? "Täglicher Kassenbericht, retrograd ab gezähltem Endbestand, mit Zählprotokoll (nicht vorgeschrieben, aber empfohlen als Nachweis des Auszählens)."
    : unsicher
      ? "Bei offener Ladenkasse: täglicher Kassenbericht, retrograd ab gezähltem Endbestand, mit Zählprotokoll (nicht vorgeschrieben, aber empfohlen als Nachweis des Auszählens). Beim Kassensystem: Tagesabschluss und Abgleich mit dem gezählten Bestand."
      : "Tagesabschluss des Kassensystems und Abgleich mit dem gezählten Bestand.";
  const out: Record<string, Entry> = {
    KA01: ja({
      kassenart,
      system: offen
        ? "entfällt (offene Ladenkasse)"
        : unsicher
          ? "Bei elektronischem System: Hersteller, Modell und Seriennummer sind im Betrieb festzulegen und hier einzutragen"
          : "Hersteller, Modell und Seriennummer sind im Betrieb festzulegen und hier einzutragen",
      anzahl: offen
        ? "entfällt (offene Ladenkasse)"
        : "Anzahl der Kassen ist im Betrieb festzulegen und hier einzutragen",
    }),
    KA05: ja({
      ablauf,
      wer: "die Geschäftsführung oder eine benannte Person im Betrieb",
    }),
    KA06: ja({
      art: offen
        ? "Kassenbericht (offene Ladenkasse)"
        : unsicher
          ? "Kassenbuch (elektronisches System) oder Kassenbericht (offene Ladenkasse) – ist im Betrieb festzulegen"
          : "Kassenbuch im Kassensystem",
      wer: "die Geschäftsführung oder eine benannte Person im Betrieb",
    }),
    KA08: ja({
      ablauf: "Abschöpfung und Bankeinzahlung werden mit Beleg festgehalten. Beträge und Wege sind im Betrieb festzulegen und hier einzutragen.",
    }),
    KA95: ja({
      notbetrieb: kassenNotverfahren(kasse),
      nacherfassung: FEST,
    }),
  };
  if (offen) {
    out.KA02 = entfaelltOffeneKasse();
    out.KA03 = entfaelltOffeneKasse();
    out.KA09 = ja({
      wer: "entfällt (offene Ladenkasse)",
      ablage: "z. B. Kassenbericht-Vordruck und Zählanweisung – ist im Betrieb festzulegen und hier einzutragen",
    });
  } else if (unsicher) {
    out.KA02 = ja({
      zertifikat: "unbekannt",
      mitteilung: "unbekannt",
    });
    out.KA03 = ja({
      beleg: "Bei elektronischem System: ist im Betrieb festzulegen und hier einzutragen",
    });
    out.KA09 = ja({
      wer: "Bei elektronischem System: ist im Betrieb festzulegen und hier einzutragen",
      ablage: "Bei elektronischem System: ist im Betrieb festzulegen und hier einzutragen",
    });
  } else {
    out.KA02 = ja({
      tse: "Zertifizierte TSE. TSE-Art und TSE-Seriennummer sind im Betrieb festzulegen und hier einzutragen",
      zertifikat: "unbekannt",
      mitteilung: "unbekannt",
    });
  }
  return out;
}

function bankAntworten(input: SchnellversionAnswers): Record<string, Entry> {
  const fall = standardFall(input);
  const kanzlei = input.bucht !== "Wir selbst im Unternehmen";
  let uebergabe = "Bankabruf oder Erfassung nach Kontoauszug; wer die Umsätze erfasst, ist festzulegen (bitte prüfen).";
  let weg = "";
  if (fall.excel) {
    weg = "Manuelle Erfassung nach Kontoauszug";
    uebergabe = "Manuelle Erfassung der Kontoumsätze anhand der Kontoauszüge (bitte prüfen).";
  } else if (fall.kind === "lexoffice") {
    uebergabe = "Bankanbindung in Lexware Office, Abruf der Kontoumsätze (bitte prüfen).";
  } else if (fall.datev && kanzlei) {
    weg = "Über die Kanzlei";
    uebergabe = "Bankdatenabruf in DATEV, Buchung durch die Kanzlei (bitte prüfen).";
  } else if (fall.datev) {
    uebergabe = "Bankabruf oder Erfassung nach Kontoauszug in DATEV (bitte prüfen).";
  }
  return {
    BA03: ja({
      format: "Gemischt",
      ablage: "Elektronische Kontoauszüge werden im empfangenen Format aufbewahrt, nicht nur im Bankportal.",
    }),
    BA05: ja(
      input.mitarbeitende === "1 (nur ich)"
        ? {
            wer: "Freigabe durch die Inhaberin bzw. den Inhaber. Ein Vier-Augen-Prinzip ist personell nicht möglich; Ausgleich durch nachgelagerte Selbstkontrolle (z. B. monatlicher Abgleich Bank–Buchhaltung–Belege) und, soweit beauftragt, durch die Steuerberatung (bitte prüfen).",
            limit: FEST,
          }
        : {
            wer: `${GF}; ab einer im Betrieb festzulegenden Wertgrenze zusätzlich eine zweite Person, soweit personell möglich`,
            vierAugen: "unbekannt",
            limit: FEST,
          },
    ),
    BA08: ja(weg ? { weg, uebergabe } : { uebergabe }),
  };
}

function gemein(input: SchnellversionAnswers): Record<string, Entry> {
  const kanzlei = input.bucht !== "Wir selbst im Unternehmen";
  return {
    UO02: ja({
      taetigkeiten: "Die Tätigkeit ergibt sich aus der Branchenangabe. Einzelne Vorgänge sind im Betrieb festzulegen und hier einzutragen.",
      kunden: [],
    }),
    A01: ja({
      company: input.firma,
      branchen: [],
      rechtsform: input.rechtsform,
      mitarbeitende: input.mitarbeitende,
      gf: GF,
      standort: "Betriebssitz",
    }),
    UO06: ja({
      geltung: "Der gesamte Betrieb im beschriebenen Umfang.",
      ausgenommen: "Keine Bereiche ausgenommen.",
    }),
    AF01: ja({
      zuordnung: "Bücher und Aufzeichnungen 10 Jahre, Buchungsbelege 8 Jahre, Handels- und Geschäftsbriefe 6 Jahre (§ 147 Abs. 1, 3 AO).",
    }),
    ER04: ja({
      ablauf: "Bei E-Rechnungen (XRechnung, ZUGFeRD) ist der strukturierte Datensatz im empfangenen Format maßgeblich. Bei sonstigen Rechnungen die empfangene Datei (z. B. PDF-Anhang) bzw. das Papierdokument. Ablageort: ist im Betrieb festzulegen und hier einzutragen.",
    }),
    VK08: ja({
      eRechnung: "unbekannt",
      hinweis: "Ausstellung von E-Rechnungen: ist im Betrieb festzulegen. Übergangsregeln für die Ausstellung beachten.",
    }),
    AU01: ja({
      aufgaben: kanzlei
        ? "Die Buchhaltung kann bei der Kanzlei liegen. Die Verantwortung für die Ordnungsmäßigkeit bleibt beim Betrieb."
        : "Die Buchhaltung liegt im Unternehmen. Die Verantwortung für die Ordnungsmäßigkeit bleibt beim Betrieb.",
      grenzen: FEST,
    }),
    ...bankAntworten(input),
  };
}

function gastro(): Record<string, Entry> {
  return {
    EK01: ja({
      ablauf: "Bedarf an Lebensmitteln, Getränken und Verbrauchsmaterial meldet die Küchenleitung bzw. die Inhaberin oder der Inhaber.",
      wer: "Küchenleitung bzw. Inhaberin oder Inhaber",
    }),
    EK03: ja({
      wege: "z. B. E-Mail, Telefon oder Portal des Großhändlers – ist im Betrieb festzulegen",
      system: "Das Bestellsystem ist im Betrieb festzulegen und hier einzutragen.",
    }),
    EK05: ja({
      ablauf: "Küchen- bzw. Schichtleitung oder die Inhaberin bzw. der Inhaber prüft die Lieferung bei Annahme gegen den Lieferschein (Menge, Qualität, Kühlkette) und zeichnet den Lieferschein ab. Abweichungen werden auf dem Lieferschein vermerkt.",
      wer: "Küchen- bzw. Schichtleitung oder die Inhaberin bzw. der Inhaber",
    }),
    WW01: ja({
      system: "Name und Version sind im Betrieb festzulegen und hier einzutragen",
      vorgaenge: "Lagerorte: Kühlraum bzw. Kühlzellen, Tiefkühlung, Trockenlager, Getränkelager.",
    }),
    WW08: ja({
      verfahren: "Stichtagsinventur",
      wer: "Geschäftsführung bzw. Küchenleitung",
      stichtag: "Zum Geschäftsjahresende, unterjährig Bestandszählungen zur Wareneinsatzkontrolle",
      zaehllisten: "Zählliste je Lagerort. Bestandskorrekturen (Verderb, Bruch, Personalverzehr, Eigenverbrauch) werden mit Grund erfasst.",
    }),
    VK01: ja({
      ablauf: "Bewirtung über das Kassensystem. Veranstaltungen und Catering mit Angebot bzw. Auftrag und gesonderter Rechnung.",
      system: FEST,
    }),
    BS01: ja({
      art: ["Gastronomie / Hotel"],
      vorgaenge: "Bestellungen, Zwischenrechnungen, Tischwechsel und Splitten laufen vollständig über das Kassensystem. Speisen und Getränke bzw. Verzehr im Haus und Außer-Haus werden mit dem jeweils zutreffenden Steuersatz erfasst (bitte prüfen). Bewirtungsrechnungen werden aus dem Kassensystem erstellt. Trinkgeld wird getrennt erfasst.",
    }),
    ZE01: ja({
      verantwortlich: "Schichtleitung bzw. Geschäftsführung",
      system: "Stundenzettel, Zeiterfassungs-App oder Kassensystem: ist im Betrieb festzulegen und hier einzutragen",
    }),
  };
}

function handwerk(): Record<string, Entry> {
  return {
    VK01: ja({
      ablauf: `Aufträge entstehen aus Angebot bzw. Kostenvoranschlag und schriftlicher Auftragsbestätigung. Nachträge werden vor Ausführung schriftlich angeboten und beauftragt. ${HANDWERK_NACHWEIS}`,
      system: FEST,
    }),
    VK05: ja({
      vergabe: "Fortlaufend je Auftrag, im Betrieb festzulegen und hier einzutragen",
      kreise: FEST,
    }),
    VK06: ja({
      ablauf: HANDWERK_RECHNUNG,
    }),
    AR04: ja({
      ort: FEST,
      format: FEST,
    }),
    BS06: ja({
      regeln: HANDWERK_RECHNUNG,
    }),
    EK05: ja({
      ablauf: "Wareneingang von Material wird gegen Lieferschein geprüft. Abweichungen werden auf dem Lieferschein vermerkt.",
      wer: "Bauleitung bzw. die Geschäftsführung",
    }),
    ZE01: ja({
      verantwortlich: "Bauleitung bzw. Meister",
      system: "Stundenzettel bzw. App: ist im Betrieb festzulegen und hier einzutragen",
    }),
    BS01: ja({
      art: ["Handwerk / Bau"],
      vorgaenge: `Bauprojekte mit Material, Abschlags- und Schlussrechnung. ${HANDWERK_NACHWEIS}`,
    }),
  };
}

function handel(): Record<string, Entry> {
  return {
    EK05: ja({
      ablauf: "Wareneingang wird gegen Bestellung und Lieferschein geprüft. Abweichungen werden vermerkt.",
      wer: "die Geschäftsführung oder eine benannte Person im Betrieb",
    }),
    WW01: ja({
      system: "Warenwirtschaft laut Betrieb. Name und Version sind im Betrieb festzulegen und hier einzutragen.",
    }),
    WW08: ja({
      verfahren: "Stichtagsinventur",
      wer: GF,
      stichtag: "Zum Geschäftsjahresende",
      zaehllisten: "Zählliste je Lagerort",
    }),
    VK01: ja({
      ablauf: "Verkauf über die Kasse (z. B. Ladengeschäft). Der konkrete Ablauf ist im Betrieb festzulegen und hier einzutragen.",
      system: FEST,
    }),
  };
}

function ecommerce(): Record<string, Entry> {
  return {
    EC01: ja({
      kanaele: "Eigener Onlineshop und/oder Marktplatz – vom Betrieb zu bestätigen",
    }),
    EC02: ja({
      system: "Warenwirtschaft bzw. Shop-Backend laut Betrieb. Name und Version sind im Betrieb festzulegen und hier einzutragen.",
      laender: "Lieferländer sind im Betrieb festzulegen und hier einzutragen. OSS-Verfahren: ist im Betrieb festzulegen.",
    }),
    WW01: ja({
      system: "Warenwirtschaft bzw. Shop-Backend laut Betrieb. Name und Version sind im Betrieb festzulegen und hier einzutragen.",
    }),
    VK01: ja({
      ablauf: "Bestellungen entstehen im Shop bzw. auf dem Marktplatz. Zahlung, Gebühren und Auszahlung werden je Anbieter abgestimmt.",
      system: FEST,
    }),
    EC05: ja({
      export: "Rohdaten (Bestell-, Zahlungs- und Gebührenreports) werden regelmäßig exportiert und im eigenen Archiv aufbewahrt, da Plattformen Daten nur befristet bereitstellen.",
    }),
  };
}

function dienstleister(): Record<string, Entry> {
  return {
    VK01: ja({
      ablauf: "Aufträge entstehen aus Angebot oder Vertrag. Änderungen von Umfang, Zeit oder Honorar werden vor Ausführung festgehalten. Der konkrete Weg ist im Betrieb festzulegen und hier einzutragen.",
      system: FEST,
    }),
    VK05: ja({
      nachweis: "Leistungsnachweis je Auftrag oder Zeitraum, Freigabe durch den Auftraggeber, Ablage unter der Auftragsnummer.",
      wer: BUCH,
    }),
    ZE01: ja({
      verantwortlich: GF,
      system: "Das System der Zeiterfassung ist im Betrieb festzulegen und hier einzutragen",
    }),
  };
}

const NACH_BRANCHE: Record<string, () => Record<string, Entry>> = {
  gastro,
  handwerk,
  handel,
  ecommerce,
  dienstleister,
};

/** Antwortgerüst der Standardfassung. Die 6 Angaben setzt der Aufrufer darüber. */
export function standardBasis(input: SchnellversionAnswers): { answers: IntakeAnswers; identity: CheckoutIdentity } {
  const vorlage = VORLAGE[input.branche] ?? "dienstleister";
  const kanzlei = input.bucht !== "Wir selbst im Unternehmen";
  const kasse = input.kasse !== "Nein, keine Bargeldeinnahmen";
  let answers = ensureGesamt(emptyAnswers());
  answers = {
    ...answers,
    branchen: [],
    rechtsform: input.rechtsform,
    mitarbeitende: input.mitarbeitende,
    gf: GF,
    buchhaltung: BUCH,
    it: "die IT-Betreuung",
    steuerberater: kanzlei ? "die Kanzlei" : "",
    standort: "Betriebssitz",
    geltung: "Der gesamte Betrieb im beschriebenen Umfang.",
    geltungAusschluss: "Keine Bereiche ausgenommen.",
    katalog: {
      ...(NACH_BRANCHE[vorlage]?.() ?? dienstleister()),
      ...(kasse ? kasseAntworten(input.kasse) : {}),
      ...gemein(input),
    },
  };
  if (vorlage === "gastro" && input.kasse === OFFENE_KASSE && answers.katalog) {
    answers.katalog.VK01 = ja({
      ablauf: "Bewirtung mit Barzahlung über die offene Ladenkasse; Veranstaltungen und Catering mit Angebot bzw. Auftrag und gesonderter Rechnung.",
      system: FEST,
    });
    answers.katalog.BS01 = ja({
      art: ["Gastronomie / Hotel"],
      vorgaenge: "Speisen und Getränke bzw. Verzehr im Haus und Außer-Haus werden mit dem jeweils zutreffenden Steuersatz erfasst (bitte prüfen). Bewirtungsrechnungen werden manuell erstellt (Vordruck oder Rechnungsprogramm – festzulegen). Trinkgeld wird getrennt erfasst.",
    });
  }
  const status: Record<string, { status: "tool" | "offen" | "nicht_vorhanden"; reason?: string }> = {
    m05: { status: "tool" },
    m08: kasse
      ? { status: "tool" }
      : { status: "nicht_vorhanden", reason: "Keine Bargeldeinnahmen in den 6 Angaben." },
    m10:
      input.branche === "freiberuf"
        ? { status: "nicht_vorhanden", reason: "bitte prüfen" }
        : vorlage === "dienstleister"
          ? { status: "offen" }
          : { status: "tool" },
    m11: { status: "offen" },
    m12:
      input.mitarbeitende === "1 (nur ich)"
        ? { status: "nicht_vorhanden", reason: "keine Beschäftigten laut Angabe (bitte prüfen)" }
        : { status: "offen" },
    m13: vorlage === "ecommerce" ? { status: "tool" } : { status: "offen" },
    m14: { status: "tool" },
  };
  for (const [id, eintrag] of Object.entries(status)) {
    answers = setModulEintrag(answers, id, eintrag);
  }
  const identity: CheckoutIdentity = {
    company: input.firma,
    email: "",
    stripeSessionId: "",
    stripeCustomerId: "",
    stub: true,
  };
  return { answers, identity };
}

export { aufbewahrung };
