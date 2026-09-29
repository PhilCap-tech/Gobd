/**
 * Customer-facing labels for the catalog intake.
 * Question ids and field keys stay in the catalog for rules; they are not labels.
 */

export const RECHTSFORMEN = [
  "Einzelunternehmen",
  "GbR",
  "OHG",
  "KG",
  "GmbH & Co. KG",
  "UG",
  "GmbH",
  "AG",
  "e. K.",
  "Freiberufler/sonstige",
] as const;

export const RECHTSFORM_FREITEXT = "Freiberufler/sonstige";

export const MITARBEITENDE_OPTIONS = [
  "nur ich",
  "2–5",
  "6–10",
  "11–20",
  "21–50",
  "über 50",
] as const;

export const TAETIGKEITEN = [
  "Dienstleistung/Beratung",
  "Handwerk",
  "Einzelhandel",
  "Großhandel",
  "Produktion",
  "Gastronomie",
  "Gesundheitsberufe",
  "Vermietung",
  "Onlinehandel",
  "Plattformgeschäft",
  "Bau/Projektgeschäft",
  "gemeinnützige Tätigkeit",
  "Sonstiges",
] as const;

export const TAETIGKEIT_FREITEXT = "Sonstiges";

export const SCOPE_IN_LABEL = "Welche Vorgänge gehören zu dieser Dokumentation?";
export const SCOPE_OUT_LABEL =
  "Welche gibt es im Betrieb, werden hier aber gesondert dokumentiert?";

export type ActivityFollowup = {
  key: string;
  label: string;
  ask: string;
  lived: string;
};

export const ACTIVITY_FOLLOWUPS: Record<string, ActivityFollowup[]> = {
  Onlinehandel: [
    {
      key: "onlineShop",
      label: "Welches Shopsystem?",
      ask: "welches Shopsystem",
      lived: "Shopsystem",
    },
    {
      key: "onlineZahlung",
      label: "Welche Zahlungsanbieter?",
      ask: "welche Zahlungsanbieter",
      lived: "Zahlungsanbieter",
    },
    {
      key: "onlinePlattformen",
      label: "Welche Plattformen?",
      ask: "welche Plattformen",
      lived: "Plattformen",
    },
    {
      key: "onlineRetouren",
      label: "Wie laufen Retouren?",
      ask: "wie Retouren laufen",
      lived: "Retouren",
    },
    {
      key: "onlineWawi",
      label: "Welche Warenwirtschaft?",
      ask: "welche Warenwirtschaft",
      lived: "Warenwirtschaft",
    },
  ],
  Gastronomie: [
    {
      key: "gastroKasse",
      label: "Welches Kassensystem?",
      ask: "welches Kassensystem",
      lived: "Kassensystem",
    },
    {
      key: "gastroTagesabschluss",
      label: "Wie entsteht der Tagesabschluss?",
      ask: "wie der Tagesabschluss entsteht",
      lived: "Tagesabschluss",
    },
    {
      key: "gastroZahlung",
      label: "Welche Zahlungswege?",
      ask: "welche Zahlungswege",
      lived: "Zahlungswege",
    },
  ],
};

const FIELD_LABELS: Record<string, string> = {
  company: "Unternehmen",
  standort: "Standort",
  branchen: "Tätigkeiten",
  rechtsform: "Rechtsform",
  mitarbeitende: "Mitarbeitende",
  gf: "Geschäftsleitung (Name)",
  belegartenScope: SCOPE_IN_LABEL,
  ausgeschlossen: SCOPE_OUT_LABEL,
  ausgeschlossenSonstiges: "Sonstiges, das gesondert dokumentiert wird",
  kasse: "Kasse",
  shop: "Onlineshop",
  lager: "Lager",
  lohn: "Lohn",
  plattformen: "Plattformen",
  hinweis: "Kurzhinweis",
  gueltigAb: "Datum",
  keineRueckdatierungBestaetigt:
    "Verstanden: Erstellungsdatum und Beginn des Ablaufs sind nicht dasselbe.",
  systeme: "System",
  weitereFreitext: "Weitere Systeme",
  hosting: "Wo liegen die Daten?",
  it: "IT-Verantwortung",
  originalJeWeg: "Original je Belegweg",
  externeSysteme: "Externes System",
  kanaele: "Eingangswege",
  postfachOderPortal: "Postfach oder Portal",
  wer: "Wer?",
  turnus: "Wie oft?",
  schritte: "Ablauf",
  scanZweck: "Wird gescannt, und wozu?",
  formate: "Empfangene Formate",
  ablauf: "Ablauf",
  validierung: "Technische Prüfung",
  pruefer: "Wer prüft?",
  kriterien: "Prüfkriterien",
  sachlich: "Sachliche Prüfung",
  freigabe: "Freigabe",
  buchung: "Buchung",
  buchhaltung: "Buchhaltung (Name oder Rolle)",
  belegIdBeschreibung: "Beleg-ID",
  kanzleiName: "Kanzlei",
  leistungsumfang: "Leistungsumfang laut Vereinbarung",
  nachweisVorhanden: "Liegt die Vereinbarung vor?",
  ablage: "Ablageort",
  ordnung: "Suchmerkmale",
  zugriffKurz: "Wer darf einsehen, ändern oder löschen?",
  berechtigungslisteVorhanden: "Gibt es eine Liste der Zugriffsrechte?",
  rolleFristen: "Wer ordnet Fristen zu?",
  verfahren: "Wie läuft die Löschung?",
  backupArten: "Art der Sicherung",
  wiederherstellungGetestet: "Rücksicherung oder Export geprüft?",
  letztesTestdatum: "Datum der letzten Prüfung",
  kontrollen: "Kontrolle",
  datum: "Datum",
  ergebnis: "Ergebnis",
  status: "Stand",
  pfleger: "Wer pflegt die Dokumentation?",
  ausloeser: "Wann entsteht eine neue Fassung?",
  anlagen: "Anlage",
  name: "Name",
  speicherortHistorie: "Wo liegen frühere Fassungen?",
};

const QUESTION_FIELD_LABELS: Record<string, string> = {
  "A04.gueltigAb": "Seit wann läuft der beschriebene Ablauf so?",
  "I05.gueltigAb": "Ab wann gilt diese Fassung?",
  "I04.name": "Name der prüfenden Person",
  "I04.datum": "Datum der Prüfung",
  "H04.status": "Wie ist die Prüfung ausgegangen?",
  "H04.datum": "Datum der Prüfung",
  "H04.ergebnis": "Ergebnis",
  "C02.wer": "Wer sichtet?",
  "C02.turnus": "Wie oft wird gesichtet?",
  "E05.systeme": "Systeme für Ausgangsrechnungen",
  "E05.wer": "Wer erstellt die Rechnungen?",
  "F01.sachlich": "Wer prüft sachlich?",
  "F01.freigabe": "Wer gibt frei?",
  "F01.buchung": "Wer bucht?",
};

const COLUMN_LABELS: Record<string, string> = {
  "systeme.name": "Name des Systems",
  "systeme.funktion": "Wozu dient es?",
  "systeme.typ": "Art des Systems",
  "originalJeWeg.belegweg": "Belegweg",
  "originalJeWeg.originalBeschreibung": "Was gilt als Original?",
  "externeSysteme.name": "Name des Systems",
  "externeSysteme.unterlagenVorhanden": "Unterlagen vorhanden?",
  "kontrollen.name": "Welche Kontrolle?",
  "kontrollen.turnus": "Wie oft?",
  "kontrollen.wer": "Wer führt sie aus?",
  "kontrollen.nachweis": "Woran ist sie erkennbar?",
  "anlagen.name": "Anlage",
  "anlagen.status": "Stand",
};

const OPTION_LABELS: Record<string, string> = {
  ja: "Ja",
  nein: "Nein",
  unbekannt: "Unbekannt",
  fibu: "Buchhaltung",
  postfach: "Postfach",
  portal: "Portal",
  archiv: "Archiv",
  rechnungssoftware: "Rechnungssoftware",
  sonstiges: "Sonstiges",
  ja_bestaetigt: "Ja, geprüft",
  ersetzend: "Ersetzendes Scannen",
  vorhanden: "Vorhanden",
  offen: "Muss ergänzt werden",
  nicht_zutreffend: "Nicht relevant",
  bestaetigt: "Geprüft",
  nie: "Noch nie",
};

const FIELD_OPTION_LABELS: Record<string, string> = {
  "scanZweck.nein": "Nein, es wird nicht gescannt",
  "scanZweck.ersetzend": "Ersetzendes Scannen",
  "scanZweck.Bearbeitungskopie": "Nur als Arbeitskopie",
};

export const FIELD_PLACEHOLDERS: Record<string, string> = {
  belegIdBeschreibung: "Zum Beispiel VD-BELEG-2026-0142",
  zugriffKurz: "Zum Beispiel: Geschäftsführung liest, Buchhaltung ändert",
  branchenFreitext: "Welche Tätigkeit?",
  rechtsformFreitext: "Welche Rechtsform?",
  ausgeschlossenWo: "Zum Beispiel eigene Shop-Dokumentation",
  onlineShop: "Zum Beispiel Shopware oder ein eigener Shop",
  gastroKasse: "Hersteller und Produktname",
  weitereFreitext: "Weitere Systeme, die Belege berühren",
  hosting: "Zum Beispiel Anbieter-Cloud oder eigener Server",
};

const LABEL_OVERRIDE: Record<string, string> = {
  belegartenScope: SCOPE_IN_LABEL,
  ausgeschlossen: SCOPE_OUT_LABEL,
  branchen: "Tätigkeiten",
  keineRueckdatierungBestaetigt:
    "Verstanden: Erstellungsdatum und Beginn des Ablaufs sind nicht dasselbe.",
};

export function fieldLabel(questionId: string, key: string, catalogLabel?: string): string {
  return (
    QUESTION_FIELD_LABELS[`${questionId}.${key}`] ||
    LABEL_OVERRIDE[key] ||
    catalogLabel ||
    FIELD_LABELS[key] ||
    "Angabe"
  );
}

export function columnLabel(parentKey: string, key: string): string {
  return COLUMN_LABELS[`${parentKey}.${key}`] || FIELD_LABELS[key] || "Angabe";
}

export function optionLabel(fieldKey: string, option: string): string {
  return FIELD_OPTION_LABELS[`${fieldKey}.${option}`] || OPTION_LABELS[option] || option;
}

export function activityFollowupsFor(
  selected: string[],
): Array<{ activity: string; fields: ActivityFollowup[] }> {
  return Object.entries(ACTIVITY_FOLLOWUPS)
    .filter(([activity]) => selected.includes(activity))
    .map(([activity, fields]) => ({ activity, fields }));
}

export type ActivityGap = {
  id: string;
  text: string;
};

function textOf(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function listOf(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (typeof value === "string" && value.trim()) {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

/** One concrete open point per selected activity whose process is still undescribed. */
export function activityGaps(values: Record<string, unknown>): ActivityGap[] {
  const selected = listOf(values.branchen);
  const gaps: ActivityGap[] = [];
  for (const [activity, fields] of Object.entries(ACTIVITY_FOLLOWUPS)) {
    if (!selected.includes(activity)) continue;
    const missing = fields.filter((field) => !textOf(values[field.key]));
    if (!missing.length) continue;
    const id =
      activity === "Onlinehandel" ? "op-taetigkeit-onlinehandel" : `op-taetigkeit-${activity.toLowerCase()}`;
    gaps.push({
      id,
      text: `${activity} angegeben — ${missing.map((field) => field.ask).join(", ")}?`,
    });
  }
  return gaps;
}

/**
 * Lived process lines. Only text the user wrote. Selecting Gastronomie or
 * Onlinehandel does not invent a till, a shop system, or any other process.
 */
export function describedActivityLines(values: Record<string, unknown>): string[] {
  const selected = listOf(values.branchen);
  const lines: string[] = [];
  for (const [activity, fields] of Object.entries(ACTIVITY_FOLLOWUPS)) {
    if (!selected.includes(activity)) continue;
    for (const field of fields) {
      const text = textOf(values[field.key]);
      if (text) lines.push(`${field.lived}: ${text}`);
    }
  }
  return lines;
}

export function projectedBranchen(values: Record<string, unknown>): string[] {
  const selected = listOf(values.branchen);
  const names = selected.filter((item) => item !== TAETIGKEIT_FREITEXT);
  const extra = textOf(values.branchenFreitext);
  if (selected.includes(TAETIGKEIT_FREITEXT) && extra) names.push(extra);
  return names;
}

export function projectedRechtsform(values: Record<string, unknown>): string {
  const form = textOf(values.rechtsform);
  const detail = textOf(values.rechtsformFreitext);
  if (form === RECHTSFORM_FREITEXT && detail) return detail;
  return form;
}

export function openPointBeforeUse(priority: string, id: string): boolean {
  if (id.startsWith("op-taetigkeit-")) return true;
  return priority === "hoch";
}

/** Internal keys stay. These three are the only status chips. */
export const PROCESS_STATUSES = ["bestaetigt", "geplant", "unbekannt"] as const;

export type ProcessStatus = "bestaetigt" | "geplant" | "unbekannt" | "nicht_zutreffend";

export const HOSTING_OPTIONS = ["lokal", "eigene Cloud", "Anbieter-Cloud", "unbekannt"] as const;

export const TURNUS_OPTIONS = ["täglich", "mehrmals wöchentlich", "wöchentlich", "anders"] as const;

export const KONTROLL_TURNUS = ["täglich", "wöchentlich", "monatlich", "jährlich", "anders"] as const;

export const BELEG_REIN = [
  "Eingangsrechnungen",
  "Ausgangsrechnungen",
  "Kassenbelege",
  "sonstige Buchungsbelege",
] as const;

export const ANBIETER_UNTERLAGEN = [
  "Vertrag",
  "Leistungsbeschreibung",
  "Berechtigungskonzept",
  "Aufbewahrung/Export",
] as const;

export const ANLAGE_STATUS = [
  { value: "vorhanden", label: "vorhanden" },
  { value: "offen", label: "muss ergänzt" },
  { value: "nicht_zutreffend", label: "nicht relevant" },
] as const;

export const PRUEF_KRITERIEN = [
  "Leistungsbezug",
  "Rechnungsangaben vollständig",
  "Betrag",
  "Steuersatz",
  "richtiger Empfänger",
  "keine offene Unstimmigkeit",
] as const;

export const KANZLEI_AUFGABEN = [
  "Belege verbuchen",
  "Umsatzsteuervoranmeldung",
  "Lohn",
  "Jahresabschluss",
  "Beratung",
  "Sonstiges",
] as const;

export const AENDERUNGSANLAESSE = [
  "neues oder ersetztes System",
  "neuer Belegkanal oder neues Dateiformat",
  "geänderte Zuständigkeit oder Vertretung",
  "Umstellung des Scan- oder Archivverfahrens",
  "Änderung von Aufbewahrung oder Löschung",
  "festgestellte Abweichung",
  "rechtliche Änderung",
  "Sonstiges",
] as const;

export const ANLAGEN_CHECKLISTE = [
  "Vertrag mit dem Anbieter",
  "Leistungsbeschreibung",
  "Berechtigungskonzept",
  "Nachweis Aufbewahrung oder Export",
  "Kontrollnachweise",
] as const;

export const TYPISCHE_KONTROLLEN = [
  "Postfachsichtung",
  "Vollständigkeitsabgleich",
  "Stichprobe",
  "Berechtigungsprüfung",
  "Such- und Lesbarkeitsprobe",
  "Systemprüfung",
] as const;

export const FREIGABE_SCHRITTE = [
  { key: "sachlich", schritt: "Sachliche Prüfung" },
  { key: "freigabe", schritt: "Freigabe" },
  { key: "buchung", schritt: "Buchung" },
] as const;

export const ZUGRIFF_ROLLEN = ["Geschäftsführung", "Buchhaltung", "weitere Mitarbeitende"] as const;

export const ZUGRIFF_RECHTE = ["lesen", "ändern", "exportieren", "löschen"] as const;

export const SICHERUNG_OPTIONS = [
  "Anbieter sichert",
  "Rücksicherung oder Export geprüft",
  "weiß ich nicht",
] as const;

export const DIGITAL_CHANNELS = [
  "E-Mail-PDF",
  "E-Rechnung (XRechnung/ZUGFeRD/XML)",
  "Portal",
  "Schnittstelle",
  "App",
] as const;

export const PAPER_CHANNEL = "Post/Papier";

const PROMPT_OVERRIDE: Record<string, string> = {
  B01: "Welche Software nutzt der Betrieb für Belege?",
  B04: "Welche Datei gilt je Eingangsweg als Original?",
  B05: "Welche Unterlagen liegen zu Systemen beim Anbieter vor?",
  C02: "Wie wird dieser Eingang gesichtet und weitergegeben?",
  C03: "Wie kommt Papier herein?",
  D01: "Wie wird Papier gescannt, und was passiert mit dem Original?",
  E02: "Wie läuft eine strukturierte E-Rechnung?",
  E03: "Wer prüft Eingangsrechnungen, und worauf?",
  E05: "Wie entstehen Ausgangsrechnungen?",
  F01: "Wer prüft, gibt frei und bucht?",
  F02: "Woran erkennt man denselben Beleg in Ablage und Buchung?",
  F05: "Was übernimmt die Kanzlei?",
  G01: "Wo liegt welcher Beleg, und woran findet man ihn?",
  G02: "Wer darf Belege einsehen oder ändern?",
  G05: "Wie werden Fristen geprüft, und wer gibt eine Löschung frei?",
  G06: "Wer sichert, und wurde eine Rücksicherung geprüft?",
  H01: "Welche Kontrollen laufen?",
  H04: "Wurde eine Wiederherstellung oder ein Export geprüft?",
  I01: "Wann wird die Dokumentation angepasst, und wer pflegt sie?",
  I02: "Welche Anlagen liegen vor?",
  I04: "Wer prüft den Entwurf nach der Erstellung?",
  I05: "Ab wann gilt diese Fassung, und wo bleiben frühere Fassungen?",
};

export function customerPrompt(id: string, catalogPrompt: string): string {
  return PROMPT_OVERRIDE[id] ?? catalogPrompt;
}

export type ChannelDetail = {
  ort: string;
  wer: string;
  turnus: string;
  turnusFrei: string;
  uebergabe: string;
  ausnahmen: string;
};

export function emptyChannelDetail(): ChannelDetail {
  return { ort: "", wer: "", turnus: "", turnusFrei: "", uebergabe: "", ausnahmen: "" };
}

export function channelPlaceLabel(channel: string): string {
  if (channel.startsWith("E-Mail")) return "Welches Postfach?";
  if (channel === "Portal") return "Welches Portal?";
  if (channel === "App") return "Welche App?";
  if (channel === "Schnittstelle") return "Welche Schnittstelle?";
  if (channel.startsWith("E-Rechnung")) return "Wo kommt die E-Rechnung an?";
  if (channel === PAPER_CHANNEL) return "Wo kommt die Post an?";
  return "Wo kommt der Beleg an?";
}

export function statusChoiceVisible(id: string, values: Record<string, unknown>): boolean {
  if (id === "A03" || id === "H04") return false;
  if (id === "B05" && values.anbieter !== "ja") return false;
  if (id === "F05" && values.kanzleiBeteiligt !== "ja") return false;
  return true;
}

const A03_KEYS = ["kasse", "shop", "lager", "lohn", "plattformen"] as const;

export function derivedCatalogStatus(
  id: string,
  values: Record<string, unknown>,
): ProcessStatus | undefined {
  if (id === "A03") {
    const picked = A03_KEYS.map((key) => textOf(values[key]));
    if (picked.some((value) => !value)) return undefined;
    if (picked.some((value) => value === "unbekannt")) return "unbekannt";
    return "bestaetigt";
  }
  if (id === "H04") {
    const stand = textOf(values.status);
    if (stand === "bestaetigt" || stand === "nie") return "bestaetigt";
    if (stand === "unbekannt") return "unbekannt";
    return undefined;
  }
  if (id === "B05") {
    if (values.anbieter === "nein") return "nicht_zutreffend";
    if (values.anbieter === "unbekannt") return "unbekannt";
    return undefined;
  }
  if (id === "F05") {
    if (values.kanzleiBeteiligt === "nein") return "nicht_zutreffend";
    if (values.kanzleiBeteiligt === "unbekannt") return "unbekannt";
    return undefined;
  }
  return undefined;
}

export function derivedReason(id: string): string {
  if (id === "B05") return "Systeme liegen nicht bei einem Anbieter.";
  if (id === "F05") return "Keine Kanzlei beteiligt.";
  return "Entfällt nach der Sachangabe.";
}

function rowList(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => item && typeof item === "object") as Record<string, unknown>[];
}

function channelMap(value: unknown): Record<string, ChannelDetail> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, ChannelDetail>;
}

function resolvedTurnus(row: { turnus?: string; turnusFrei?: string } | undefined): string {
  if (!row) return "";
  if (row.turnus === "anders") return textOf(row.turnusFrei);
  return textOf(row.turnus);
}

export function composeCatalogValues(
  id: string,
  values: Record<string, unknown>,
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...values };
  if (id === "B01") {
    const arts = rowList(next.systeme)
      .map((row) => textOf(row.hostingArt))
      .filter(Boolean);
    const unique = [...new Set(arts)];
    if (unique.length) next.hosting = unique.join(", ");
  }
  if (id === "B05") {
    next.externeSysteme = rowList(next.externeSysteme).map((row) => {
      const stand = (row.unterlagenStand ?? {}) as Record<string, string>;
      const picks = Object.values(stand).map((item) => textOf(item)).filter(Boolean);
      let unterlagenVorhanden = textOf(row.unterlagenVorhanden);
      if (picks.length) {
        if (picks.every((item) => item === "vorhanden" || item === "nicht_zutreffend")) {
          unterlagenVorhanden = "ja";
        } else if (picks.some((item) => item === "offen")) unterlagenVorhanden = "nein";
        else unterlagenVorhanden = "unbekannt";
      }
      return { ...row, unterlagenVorhanden };
    });
  }
  if (id === "C02") {
    const rows = Object.values(channelMap(next.kanaeleDetail));
    if (rows.length) {
      next.postfachOderPortal = rows.map((row) => textOf(row.ort)).filter(Boolean).join("; ");
      next.wer = rows.map((row) => textOf(row.wer)).filter(Boolean).join("; ");
      next.turnus = rows.map((row) => resolvedTurnus(row)).filter(Boolean).join("; ");
    }
  }
  if (id === "C03") {
    const row = next.eingang as ChannelDetail | undefined;
    if (row && typeof row === "object") {
      const turnus = resolvedTurnus(row);
      next.schritte = [
        textOf(row.ort),
        textOf(row.wer),
        turnus,
        textOf(row.uebergabe) && `Übergabe: ${textOf(row.uebergabe)}`,
        textOf(row.ausnahmen) && `Ausnahmen: ${textOf(row.ausnahmen)}`,
      ]
        .filter(Boolean)
        .join(". ");
    }
  }
  if (id === "E02") {
    const parts = [textOf(next.empfang), textOf(next.lesbar), textOf(next.pruefung), textOf(next.aufbewahrung)];
    if (parts.some(Boolean)) next.ablauf = parts.filter(Boolean).join(" ");
  }
  if (id === "E03") {
    const selected = listOf(next.kriterienAuswahl);
    const extra = textOf(next.kriterienFrei);
    if (selected.length || extra) next.kriterien = [...selected, extra].filter(Boolean).join(", ");
  }
  if (id === "E05") {
    const selected = listOf(next.systemeAuswahl);
    const extra = textOf(next.systemeFrei);
    if (selected.length || extra) next.systeme = [...selected, extra].filter(Boolean).join(", ");
  }
  if (id === "F05") {
    const tasks = listOf(next.aufgaben).filter((item) => item !== "Sonstiges");
    const extra = textOf(next.aufgabenFrei);
    if (tasks.length || extra) next.leistungsumfang = [...tasks, extra].filter(Boolean).join(", ");
  }
  if (id === "G01") {
    const rows = rowList(next.ablageJeArt).filter((row) => textOf(row.art) || textOf(row.ort));
    if (rows.length) {
      const orte = [...new Set(rows.map((row) => textOf(row.ort)).filter(Boolean))];
      next.ablage = orte.join("; ");
      next.ordnung = rows
        .map((row) => [textOf(row.art), textOf(row.suche)].filter(Boolean).join(": "))
        .filter(Boolean)
        .join("; ");
    }
  }
  if (id === "G02") {
    const rows = rowList(next.zugriffRollen).filter((row) => listOf(row.rechte).length);
    if (rows.length) {
      next.zugriffKurz = rows
        .map((row) => `${textOf(row.rolle)}: ${listOf(row.rechte).join(", ")}`)
        .join(". ");
    }
  }
  if (id === "G06") {
    const chosen = listOf(next.sicherung);
    if (chosen.includes("weiß ich nicht")) {
      next.backupArten = "unklar";
      next.wiederherstellungGetestet = "unbekannt";
    } else if (chosen.length) {
      const parts: string[] = [];
      if (chosen.includes("Anbieter sichert")) parts.push("Sicherung durch den Anbieter");
      if (chosen.includes("Rücksicherung oder Export geprüft")) {
        parts.push("Rücksicherung oder Export von uns geprüft");
        next.wiederherstellungGetestet = "ja";
      } else next.wiederherstellungGetestet = "nein";
      next.backupArten = parts.join(", ");
    }
  }
  if (id === "H01") {
    next.kontrollen = rowList(next.kontrollen).map((row) => ({
      ...row,
      turnus: row.turnusWahl === "anders" ? textOf(row.turnusFrei) : textOf(row.turnusWahl) || textOf(row.turnus),
    }));
  }
  if (id === "I01") {
    const selected = listOf(next.ausloeserAuswahl).filter((item) => item !== "Sonstiges");
    const extra = textOf(next.ausloeserFrei);
    if (selected.length || extra) next.ausloeser = [...selected, extra].filter(Boolean).join(", ");
  }
  return next;
}

function channelDetailReady(row: ChannelDetail | undefined): string {
  if (!row || !textOf(row.ort) || !textOf(row.wer) || !textOf(row.turnus) || !textOf(row.uebergabe) || !textOf(row.ausnahmen)) {
    return "Bitte Ort, Person, Turnus, Übergabe und Ausnahmen angeben.";
  }
  if (row.turnus === "anders" && !textOf(row.turnusFrei)) return "Bitte den anderen Turnus benennen.";
  return "";
}

/** Extra completeness for the P1 questions. Empty when the status is not a described process. */
export function p1FieldError(
  id: string,
  status: string | undefined,
  values: Record<string, unknown>,
  channels: string[] = [],
): string {
  if (id === "H04" && status === "bestaetigt" && textOf(values.status) === "bestaetigt") {
    if (!textOf(values.datum) && !textOf(values.ergebnis)) {
      return "Bitte Datum oder Ergebnis der Prüfung angeben.";
    }
  }
  if (status !== "bestaetigt" && status !== "geplant") return "";
  if (id === "B01") {
    const rows = rowList(values.systeme);
    if (!rows.length) return "Bitte mindestens ein System nennen.";
    for (const row of rows) {
      if (!textOf(row.name) || !textOf(row.funktion) || !textOf(row.typ)) {
        return "Bitte Name, Zweck und Art je System nennen.";
      }
      if (!textOf(row.hostingArt)) {
        return "Bitte das Hosting je System wählen.";
      }
      if (!textOf(row.nutzer) || !listOf(row.belegeRein).length || !textOf(row.uebergabe) || !textOf(row.originalOrt)) {
        return "Bitte je System Nutzer, eingehende Belege, Übergabe und den Ort des Originals nennen.";
      }
    }
  }
  if (id === "B05" && values.anbieter === "ja") {
    const rows = rowList(values.externeSysteme).filter((row) => textOf(row.name));
    if (!rows.length) return "Bitte das System beim Anbieter benennen.";
    for (const row of rows) {
      const stand = (row.unterlagenStand ?? {}) as Record<string, string>;
      if (ANBIETER_UNTERLAGEN.some((name) => !textOf(stand[name]))) {
        return "Bitte je Unterlage angeben, ob sie vorhanden ist, ergänzt werden muss oder nicht relevant ist.";
      }
    }
  }
  if (id === "C02") {
    const detail = channelMap(values.kanaeleDetail);
    const digital = new Set<string>(DIGITAL_CHANNELS);
    for (const channel of channels) {
      if (!digital.has(channel)) continue;
      const message = channelDetailReady(detail[channel]);
      if (message) return `${channel}: ${message}`;
    }
  }
  if (id === "C03") {
    const message = channelDetailReady(values.eingang as ChannelDetail | undefined);
    if (message) return message;
  }
  if (id === "D01" && textOf(values.scanZweck) === "nein") {
    if (!textOf(values.eingang) || !textOf(values.originalVerbleib) || !textOf(values.verantwortlich)) {
      return "Bitte Eingang, Verbleib des Originals und die zuständige Person angeben.";
    }
  }
  if (id === "D01" && textOf(values.scanZweck) && textOf(values.scanZweck) !== "nein") {
    if (!textOf(values.eingang) || !textOf(values.scanZeitpunkt) || !textOf(values.vollstaendigkeit) || !textOf(values.originalVerbleib) || !textOf(values.verantwortlich)) {
      return "Bitte Eingang, Zeitpunkt des Scans, Vollständigkeitsprüfung, Verbleib des Originals und die zuständige Person angeben.";
    }
  }
  if (id === "E02") {
    if (!textOf(values.empfang) || !textOf(values.lesbar) || !textOf(values.pruefung) || !textOf(values.aufbewahrung)) {
      return "Bitte Empfang, Lesbarkeit, Prüfung und Aufbewahrung des Originalformats beschreiben.";
    }
  }
  if (id === "E03" && !listOf(values.kriterienAuswahl).length && !textOf(values.kriterienFrei) && !textOf(values.kriterien)) {
    return "Bitte die Prüfkriterien wählen oder kurz beschreiben.";
  }
  if (id === "E05") {
    if (!textOf(values.freigabe) || !textOf(values.versand) || !textOf(values.storno)) {
      return "Bitte Freigabe, Versandweg und den Umgang mit Korrektur oder Storno angeben.";
    }
  }
  if (id === "F01") {
    const systems = (values.schrittSystem ?? {}) as Record<string, string>;
    const proofs = (values.schrittNachweis ?? {}) as Record<string, string>;
    for (const step of FREIGABE_SCHRITTE) {
      if (!textOf(values[step.key]) || !textOf(systems[step.key]) || !textOf(proofs[step.key])) {
        return "Bitte je Schritt Person oder Rolle, System und Nachweis angeben.";
      }
    }
  }
  if (id === "F05" && values.kanzleiBeteiligt === "ja") {
    if (!textOf(values.kanzleiName)) return "Bitte die Kanzlei benennen.";
    if (!listOf(values.aufgaben).length && !textOf(values.aufgabenFrei)) {
      return "Bitte die Aufgaben der Kanzlei auswählen.";
    }
  }
  if (id === "G01") {
    const rows = rowList(values.ablageJeArt).filter((row) => textOf(row.ort) && textOf(row.suche));
    if (!rows.length) return "Bitte je Belegart Ablageort und Suchmerkmale angeben.";
  }
  if (id === "G02") {
    const rows = rowList(values.zugriffRollen).filter((row) => listOf(row.rechte).length);
    if (!rows.length && !textOf(values.zugriffKurz)) return "Bitte die Rechte je Rolle angeben.";
  }
  if (id === "G06" && !listOf(values.sicherung).length && !textOf(values.backupArten)) {
    return "Bitte angeben, ob der Anbieter sichert oder eine Rücksicherung geprüft wurde.";
  }
  if (id === "H01") {
    for (const row of rowList(values.kontrollen)) {
      if (!textOf(row.name)) continue;
      const turnus = textOf(row.turnusWahl) || textOf(row.turnus);
      if (!turnus || !textOf(row.wer) || !textOf(row.nachweis)) {
        return "Bitte zu jeder gewählten Kontrolle angeben, wie oft sie läuft, wer sie macht und woran man sie erkennt.";
      }
      if (row.turnusWahl === "anders" && !textOf(row.turnusFrei)) return "Bitte den anderen Turnus benennen.";
    }
  }
  if (id === "I01" && !listOf(values.ausloeserAuswahl).length && !textOf(values.ausloeser)) {
    return "Bitte mindestens einen Anlass für eine neue Fassung wählen.";
  }
  if (id === "I02") {
    const rows = rowList(values.anlagen);
    if (ANLAGEN_CHECKLISTE.some((name) => !rows.some((row) => textOf(row.name) === name && textOf(row.status)))) {
      return "Bitte jede Anlage als vorhanden, zu ergänzen oder nicht relevant markieren.";
    }
  }
  return "";
}

export function presentationBits(id: string, values: Record<string, unknown> | undefined): string[] {
  if (!values) return [];
  if (id === "B01") {
    return rowList(values.systeme).map((row) => {
      const belege = listOf(row.belegeRein).join(", ");
      return [
        textOf(row.name),
        textOf(row.funktion),
        textOf(row.nutzer) && `Nutzer ${textOf(row.nutzer)}`,
        belege && `Belege ${belege}`,
        textOf(row.uebergabe) && `Übergabe ${textOf(row.uebergabe)}`,
        textOf(row.originalOrt) && `Original ${textOf(row.originalOrt)}`,
        textOf(row.hostingArt) && `Hosting ${textOf(row.hostingArt)}`,
      ]
        .filter(Boolean)
        .join(", ");
    });
  }
  if (id === "C02") {
    return Object.entries(channelMap(values.kanaeleDetail)).map(([channel, row]) => {
      const turnus = resolvedTurnus(row);
      return [channel, textOf(row.ort), textOf(row.wer), turnus, textOf(row.uebergabe), textOf(row.ausnahmen)]
        .filter(Boolean)
        .join(", ");
    });
  }
  if (id === "G01") {
    return rowList(values.ablageJeArt).map((row) =>
      [textOf(row.art), textOf(row.ort), textOf(row.suche)].filter(Boolean).join(", "),
    );
  }
  return [];
}
