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
