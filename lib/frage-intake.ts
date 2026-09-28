import {
  catalogOpenPoints,
  catalogSummary,
  catalogSuppressesRule,
  hasCatalogAnswers,
  projectCatalogAnswers,
} from "@/lib/intake-catalog";
import type { IntakeAnswers, KontrolleEintrag, VorsystemArt } from "@/lib/types";
import { emptyAnswers } from "@/lib/types";

/** Status captured per MVP question. Only `bestätigt` may become a lived sentence. */
export const FRAGE_STATUSES = [
  "bestätigt",
  "geplant",
  "unbekannt",
  "nicht zutreffend",
] as const;

export type FrageStatus = (typeof FRAGE_STATUSES)[number];

export const MVP_FRAGE_IDS = [
  "A01",
  "A02",
  "A03",
  "A04",
  "B01",
  "B04",
  "B05",
  "C01",
  "C02",
  "C03",
  "D01",
  "D03",
  "D04",
  "E01",
  "E02",
  "E03",
  "E05",
  "F01",
  "F02",
  "F05",
  "G01",
  "G02",
  "G05",
  "G06",
  "H01",
  "H04",
  "I01",
  "I02",
  "I04",
  "I05",
] as const;

export type FrageId = (typeof MVP_FRAGE_IDS)[number];

export type FrageEntry = {
  status: FrageStatus;
  /** Reason when status is „nicht zutreffend“, otherwise unused. */
  text?: string;
  verantwortung?: string;
  datum?: string;
};

export type FragenState = Partial<Record<FrageId, FrageEntry>>;

export type FrageOpenPoint = {
  id: string;
  priority: "hoch" | "mittel" | "niedrig";
  text: string;
  chapter: string;
  /** Legacy rule ids to skip once this question has any status. */
  suppress: string[];
};

const FRAGE_OPEN: Record<FrageId, FrageOpenPoint> = {
  A01: {
    id: "op-a01",
    priority: "hoch",
    text: "Rechtsträger, Standort und Geschäftsführung sind nicht als gelebte Angabe bestätigt.",
    chapter: "00-cover-freigabe",
    suppress: ["op-company", "op-gf", "op-branchen", "op-rechtsform", "op-mitarbeitende"],
  },
  A02: {
    id: "op-a02",
    priority: "mittel",
    text: "Geltungsbereich (Belegarten und Gesellschaften) ist nicht bestätigt.",
    chapter: "01-zweck-geltung",
    suppress: [],
  },
  A03: {
    id: "op-a03",
    priority: "mittel",
    text: "Kasse, Shop, Lager, Lohn oder weitere Vorsysteme sind nicht bestätigt.",
    chapter: "01-zweck-geltung",
    suppress: [],
  },
  A04: {
    id: "op-a04",
    priority: "mittel",
    text: "Seit wann der Ablauf so ausgeführt wird, ist nicht bestätigt. Es wird nicht rückdatiert.",
    chapter: "12-versionspflege",
    suppress: [],
  },
  B01: {
    id: "op-b01",
    priority: "hoch",
    text: "Systeme, die Belege erzeugen oder archivieren, sind nicht bestätigt.",
    chapter: "03-systeme-datenfluss",
    suppress: ["op-fibu", "op-weitere-systeme"],
  },
  B04: {
    id: "op-b04",
    priority: "mittel",
    text: "Welche Dateien als Original aufbewahrt werden, ist nicht bestätigt.",
    chapter: "03-systeme-datenfluss",
    suppress: [],
  },
  B05: {
    id: "op-b05",
    priority: "mittel",
    text: "Unterlagen zu externen Systemen oder Anbietern sind nicht bestätigt.",
    chapter: "13-mitgeltende-unterlagen",
    suppress: ["op-hosting"],
  },
  C01: {
    id: "op-c01",
    priority: "hoch",
    text: "Eingangswege sind nicht bestätigt.",
    chapter: "04-belegarten-kanaele",
    suppress: ["op-eingangsbelege"],
  },
  C02: {
    id: "op-c02-sichtung",
    priority: "mittel",
    text: "Sichtungsturnus der Eingangsbelege (Postfach oder Portal, wer, wie oft) ist nicht bestätigt.",
    chapter: "05-eingang-erechnung",
    suppress: ["op-c02-sichtung"],
  },
  C03: {
    id: "op-c03",
    priority: "mittel",
    text: "Wer Papier entgegennimmt und wohin es gelangt, ist nicht bestätigt.",
    chapter: "06-papier-digitalisierung",
    suppress: [],
  },
  D01: {
    id: "op-d01",
    priority: "hoch",
    text: "Ob Papier gescannt wird und zu welchem Zweck, ist nicht bestätigt.",
    chapter: "06-papier-digitalisierung",
    suppress: [],
  },
  D03: {
    id: "op-d03",
    priority: "hoch",
    text: "Ob Papieroriginale nach dem Scan vernichtet oder zusätzlich aufbewahrt werden, ist nicht bestätigt.",
    chapter: "06-papier-digitalisierung",
    suppress: [],
  },
  D04: {
    id: "op-d04",
    priority: "mittel",
    text: "Ort, Ordnung und Zugriff der Papierablage sind nicht bestätigt.",
    chapter: "06-papier-digitalisierung",
    suppress: [],
  },
  E01: {
    id: "op-e01",
    priority: "mittel",
    text: "Empfangene Rechnungsformate sind nicht bestätigt. PDF ist damit keine strukturierte E-Rechnung.",
    chapter: "05-eingang-erechnung",
    suppress: [],
  },
  E02: {
    id: "op-e02",
    priority: "hoch",
    text: "Empfang, Prüfung und Aufbewahrung des strukturierten Teils einer E-Rechnung sind nicht bestätigt.",
    chapter: "05-eingang-erechnung",
    suppress: ["op-erechnung-validierung"],
  },
  E03: {
    id: "op-e03",
    priority: "mittel",
    text: "Wer die sachliche Prüfung vor der Freigabe macht, ist nicht bestätigt.",
    chapter: "08-freigabe-buchung-status",
    suppress: [],
  },
  E05: {
    id: "op-e05",
    priority: "mittel",
    text: "System und Nummernkreis der Ausgangsrechnungen sind nicht bestätigt.",
    chapter: "07-ausgangsrechnungen",
    suppress: ["op-ausgangsrechnungen"],
  },
  F01: {
    id: "op-f01",
    priority: "hoch",
    text: "Wer prüft, freigibt und bucht, ist nicht bestätigt.",
    chapter: "08-freigabe-buchung-status",
    suppress: ["op-buchhaltung"],
  },
  F02: {
    id: "op-f02",
    priority: "mittel",
    text: "Welche Beleg-ID Original, Freigabe und Buchung verbindet, ist nicht bestätigt.",
    chapter: "08-freigabe-buchung-status",
    suppress: [],
  },
  F05: {
    id: "op-f05-kanzlei-umfang",
    priority: "mittel",
    text: "Leistungsumfang der Kanzlei ist nicht bestätigt. Eine Verbuchung oder ein Mandatszugang wird nicht als gelebter Prozess angenommen.",
    chapter: "08-freigabe-buchung-status",
    suppress: ["op-f05-kanzlei-umfang", "op-steuerberater"],
  },
  G01: {
    id: "op-g01",
    priority: "hoch",
    text: "Ablageort und Suchmerkmale sind nicht bestätigt.",
    chapter: "09-ablage-aufbewahrung",
    suppress: ["op-archiv"],
  },
  G02: {
    id: "op-g02",
    priority: "hoch",
    text: "Wer einsehen, ändern oder löschen darf, ist nicht bestätigt.",
    chapter: "10-berechtigungen-sicherung",
    suppress: ["op-zugriff", "op-berechtigungsliste"],
  },
  G05: {
    id: "op-g05",
    priority: "mittel",
    text: "Wer Fristen zuordnet und eine Löschung freigibt, ist nicht als gelebte Praxis bestätigt.",
    chapter: "09-ablage-aufbewahrung",
    suppress: ["op-loeschfrist"],
  },
  G06: {
    id: "op-g06",
    priority: "hoch",
    text: "Sicherung ist nicht bestätigt.",
    chapter: "10-berechtigungen-sicherung",
    suppress: ["op-backup"],
  },
  H01: {
    id: "op-h01",
    priority: "mittel",
    text: "Welche Kontrollen tatsächlich laufen, von wem und in welchem Turnus, ist nicht bestätigt.",
    chapter: "11-iks",
    suppress: ["op-kontrollprotokoll", "op-iks-kontrollen"],
  },
  H04: {
    id: "op-h04",
    priority: "hoch",
    text: "Ein dokumentierter Wiederherstellungs- oder Exporttest liegt nicht vor.",
    chapter: "10-berechtigungen-sicherung",
    suppress: ["op-backup-test"],
  },
  I01: {
    id: "op-i01",
    priority: "mittel",
    text: "Wer die Dokumentation pflegt und wann eine neue Fassung entsteht, ist nicht bestätigt.",
    chapter: "12-versionspflege",
    suppress: [],
  },
  I02: {
    id: "op-i02",
    priority: "mittel",
    text: "Die Liste mitgeltender Unterlagen ist nicht bestätigt.",
    chapter: "13-mitgeltende-unterlagen",
    suppress: [],
  },
  I04: {
    id: "op-i04",
    priority: "hoch",
    text: "Die betriebliche Bestätigung (Name und Datum) liegt nicht vor. Die Generierung setzt sie nicht.",
    chapter: "00-cover-freigabe",
    suppress: [],
  },
  I05: {
    id: "op-i05",
    priority: "niedrig",
    text: "Gültigkeitszeitraum dieser Fassung und der Ablageort älterer Fassungen sind nicht bestätigt.",
    chapter: "12-versionspflege",
    suppress: [],
  },
};

const STEP_FRAGEN: FrageId[][] = [
  ["A01", "A02", "A03", "A04"],
  ["B01", "B04", "B05"],
  ["C01", "C02", "E01"],
  ["C03", "D01", "D03", "D04"],
  ["E02"],
  ["E03", "E05", "F01", "F02", "F05"],
  ["G01", "G02", "G05", "G06", "H04"],
  ["H01", "I01", "I02", "I04", "I05"],
];

export const INTAKE_QUESTION_STEPS = STEP_FRAGEN.length;

function list(values: string[] | undefined): string[] {
  return values ?? [];
}

function hasToken(values: string[] | undefined, token: string): boolean {
  const needle = token.toLowerCase().replace(/-/g, "");
  return list(values).some((item) => item.toLowerCase().replace(/-/g, "").includes(needle));
}

function hasWord(values: string[] | undefined, word: string): boolean {
  const re = new RegExp(`(^|[^\\p{L}\\p{N}])${word}([^\\p{L}\\p{N}]|$)`, "iu");
  return list(values).some((item) => re.test(item));
}

export function paperSelected(answers: IntakeAnswers): boolean {
  const pools = [answers.eingangsbelege, answers.formate];
  return pools.some(
    (values) =>
      hasToken(values, "Papier") ||
      hasToken(values, "Scan") ||
      hasWord(values, "Post"),
  );
}

export function scanSelected(answers: IntakeAnswers): boolean {
  if (hasToken(answers.eingangsbelege, "Scan")) return true;
  const purpose = (answers.scanZweck || "").toLowerCase();
  return purpose.includes("kopie") || purpose.includes("ersetzend");
}

export function digitalSelected(answers: IntakeAnswers): boolean {
  const values = answers.eingangsbelege;
  return (
    hasToken(values, "E-Mail") ||
    hasToken(values, "Email") ||
    hasToken(values, "PDF") ||
    hasToken(values, "Portal") ||
    hasToken(values, "E-Rechnung")
  );
}

export function structuredInvoiceSelected(answers: IntakeAnswers): boolean {
  const values = [...list(answers.formate), ...list(answers.eingangsbelege)];
  return ["E-Rechnung", "ZUGFeRD", "XRechnung", "EDI"].some((token) =>
    hasToken(values, token),
  );
}

export function externalHosting(answers: IntakeAnswers): boolean {
  const hosting = answers.hosting.trim().toLowerCase();
  if (!hosting) return false;
  return !hosting.includes("nur lokal");
}

export function frageApplies(id: FrageId, answers: IntakeAnswers): boolean {
  const na = (other: FrageId) => answers.fragen?.[other]?.status === "nicht zutreffend";
  switch (id) {
    case "C02":
      return digitalSelected(answers) && !na("C01");
    case "C03":
    case "D01":
    case "D04":
      return paperSelected(answers) && !na("C01");
    case "D03":
      return paperSelected(answers) && !na("C01") && !na("D01") && scanSelected(answers);
    case "E02":
      return structuredInvoiceSelected(answers) && !na("E01");
    case "B05":
      return externalHosting(answers);
    default:
      return true;
  }
}

export function visibleFragen(step: number, answers: IntakeAnswers): FrageId[] {
  return (STEP_FRAGEN[step] ?? []).filter((id) => frageApplies(id, answers));
}

export function hasFrageStatuses(answers: IntakeAnswers): boolean {
  return Object.values(answers.fragen ?? {}).some((entry) => Boolean(entry?.status));
}

export function setFrageStatus(
  answers: IntakeAnswers,
  id: FrageId,
  status: FrageStatus,
): IntakeAnswers {
  return {
    ...answers,
    fragen: {
      ...answers.fragen,
      [id]: { ...answers.fragen?.[id], status, text: answers.fragen?.[id]?.text ?? "" },
    },
  };
}

export function setFrageMeta(
  answers: IntakeAnswers,
  id: FrageId,
  meta: { verantwortung?: string; datum?: string },
): IntakeAnswers {
  const current = answers.fragen?.[id];
  return {
    ...answers,
    fragen: {
      ...answers.fragen,
      [id]: {
        status: current?.status ?? "unbekannt",
        text: current?.text ?? "",
        verantwortung: meta.verantwortung ?? current?.verantwortung ?? "",
        datum: meta.datum ?? current?.datum ?? "",
      },
    },
  };
}

export function setFrageReason(
  answers: IntakeAnswers,
  id: FrageId,
  text: string,
): IntakeAnswers {
  const current = answers.fragen?.[id];
  return {
    ...answers,
    fragen: {
      ...answers.fragen,
      [id]: { status: current?.status ?? "nicht zutreffend", text },
    },
  };
}

function statusOf(answers: IntakeAnswers, id: FrageId): FrageStatus | undefined {
  return answers.fragen?.[id]?.status;
}

function lived(answers: IntakeAnswers, id: FrageId): boolean {
  return statusOf(answers, id) === "bestätigt";
}

function filled(value: string | undefined): boolean {
  return Boolean(value && value.trim());
}

function requirementMet(id: FrageId, answers: IntakeAnswers): boolean {
  switch (id) {
    case "A01":
      return (
        answers.branchen.length > 0 &&
        filled(answers.rechtsform) &&
        filled(answers.mitarbeitende) &&
        filled(answers.gf)
      );
    case "A02":
      return (
        (filled(answers.geltungBelegarten) && filled(answers.geltungAusschluss)) ||
        filled(answers.geltung)
      );
    case "A03":
      return VORSYSTEM_ARTEN.every((art) => Boolean(answers.vorsystemAntwort?.[art])) || filled(answers.vorsysteme);
    case "A04":
      return filled(answers.seitWann);
    case "B01":
      return answers.fibu.length > 0 || (answers.systeme ?? []).some((row) => filled(row.name));
    case "B04":
      return (
        (answers.originalJeWeg ?? []).some((row) => filled(row.weg) && filled(row.original)) ||
        filled(answers.originalErhalt)
      );
    case "B05":
      return filled(answers.anbieterUnterlagen) || filled(answers.hosting);
    case "C01":
      return answers.eingangsbelege.length > 0;
    case "C02":
      return (
        (filled(answers.postfach) && filled(answers.sichtungWer) && filled(answers.sichtungTurnus)) ||
        filled(answers.sichtung)
      );
    case "C03":
      return filled(answers.papierannahme);
    case "D01":
      return filled(answers.scanZweck);
    case "D03":
      return filled(answers.scanAufbewahrung);
    case "D04":
      return filled(answers.papierlager);
    case "E01":
      return list(answers.formate).length > 0;
    case "E02":
      return (
        answers.validierung === "ja" ||
        answers.validierung === "nein" ||
        answers.validierung === "unbekannt" ||
        filled(answers.erechnungVerfahren)
      );
    case "E03":
      return (
        (filled(answers.pruefkriterien) && filled(answers.pruefrolle)) ||
        filled(answers.sachlichePruefung)
      );
    case "E05":
      return answers.ausgangsrechnungen.length > 0;
    case "F01": {
      const split =
        filled(answers.rollePruefen) || filled(answers.rolleFreigeben) || filled(answers.rolleBuchen);
      if (split) {
        return filled(answers.rollePruefen) && filled(answers.rolleFreigeben) && filled(answers.rolleBuchen);
      }
      return filled(answers.gf) && filled(answers.buchhaltung);
    }
    case "F02":
      return filled(answers.belegId);
    case "F05":
      return filled(answers.steuerberater);
    case "G01":
      return filled(answers.archiv);
    case "G02":
      return filled(answers.zugriff);
    case "G05":
      return filled(answers.loeschfreigabe);
    case "G06":
      return (
        answers.backup.length > 0 &&
        (answers.backupGetestet === "ja" ||
          answers.backupGetestet === "nein" ||
          answers.backupGetestet === "unbekannt")
      );
    case "H01":
      return completeKontrollen(answers).length > 0 || filled(answers.kontrollen);
    case "I04":
      return filled(answers.bestaetigungName) && filled(answers.bestaetigungDatum);
    case "H04":
      return filled(answers.wiederherstellungstest);
    case "I01":
      return filled(answers.dokumentenpflege);
    case "I02":
      return filled(answers.anlagenliste);
    case "I05":
      return filled(answers.fassungsrahmen);
    default:
      return false;
  }
}

export function intakeFrageStepError(step: number, answers: IntakeAnswers): string {
  if (!hasFrageStatuses(answers) && step < INTAKE_QUESTION_STEPS) {
    return "Bitte je Frage einen Status wählen: bestätigt, geplant, unbekannt oder nicht zutreffend.";
  }
  for (const id of visibleFragen(step, answers)) {
    const status = statusOf(answers, id);
    if (!status) return `Bitte den Status für ${id} wählen.`;
    if ((status === "bestätigt" || status === "geplant") && !requirementMet(id, answers)) {
      return `Bitte die Angabe zu ${id} ausfüllen. Geplant ist kein Ist-Prozess, die Angabe wird aber gebraucht.`;
    }
    if (status === "nicht zutreffend" && !filled(answers.fragen?.[id]?.text)) {
      return `Bitte bei ${id} kurz den Grund für „nicht zutreffend“ nennen.`;
    }
  }
  return "";
}

export const VORSYSTEM_ARTEN: VorsystemArt[] = ["Kasse", "Shop", "Lager", "Lohn", "Plattform"];

function completeKontrollen(answers: IntakeAnswers): KontrolleEintrag[] {
  return (answers.kontrollenListe ?? []).filter(
    (row) => filled(row.was) && filled(row.turnus) && filled(row.wer) && filled(row.nachweis),
  );
}

function copyLived<T>(take: boolean, value: T, empty: T): T {
  return take ? value : empty;
}

/**
 * Legacy intakes without a status map stay unchanged.
 * With statuses, only `bestätigt` reaches the generator fields. `geplant`,
 * `unbekannt` and `nicht zutreffend` do not become present-tense facts.
 */
export function documentAnswers(answers: IntakeAnswers): IntakeAnswers {
  if (hasCatalogAnswers(answers)) return projectCatalogAnswers(answers);
  if (!hasFrageStatuses(answers)) return answers;
  const base = emptyAnswers();
  const next: IntakeAnswers = {
    ...base,
    branchen: copyLived(lived(answers, "A01"), answers.branchen, []),
    rechtsform: copyLived(lived(answers, "A01"), answers.rechtsform, ""),
    mitarbeitende: copyLived(lived(answers, "A01"), answers.mitarbeitende, ""),
    gf: copyLived(lived(answers, "A01") || lived(answers, "F01"), answers.gf, ""),
    standort: copyLived(lived(answers, "A01"), answers.standort ?? "", ""),
    geltung: copyLived(lived(answers, "A02"), answers.geltung ?? "", ""),
    vorsysteme: copyLived(lived(answers, "A03"), answers.vorsysteme ?? "", ""),
    seitWann: copyLived(lived(answers, "A04"), answers.seitWann ?? "", ""),
    fibu: copyLived(lived(answers, "B01"), answers.fibu, []),
    weitereSysteme: copyLived(lived(answers, "B01"), answers.weitereSysteme, ""),
    originalErhalt: copyLived(lived(answers, "B04"), answers.originalErhalt ?? "", ""),
    hosting: copyLived(lived(answers, "B05"), answers.hosting, ""),
    anbieterUnterlagen: copyLived(lived(answers, "B05"), answers.anbieterUnterlagen ?? "", ""),
    eingangsbelege: copyLived(lived(answers, "C01"), answers.eingangsbelege, []),
    sichtung: copyLived(lived(answers, "C02"), answers.sichtung ?? "", ""),
    papierannahme: copyLived(lived(answers, "C03"), answers.papierannahme ?? "", ""),
    scanZweck: copyLived(lived(answers, "D01"), answers.scanZweck ?? "", ""),
    scanAufbewahrung: copyLived(lived(answers, "D03"), answers.scanAufbewahrung ?? "", ""),
    papierlager: copyLived(lived(answers, "D04"), answers.papierlager ?? "", ""),
    formate: copyLived(lived(answers, "E01"), answers.formate ?? [], []),
    erechnungVerfahren: copyLived(lived(answers, "E02"), answers.erechnungVerfahren ?? "", ""),
    sachlichePruefung: copyLived(lived(answers, "E03"), answers.sachlichePruefung ?? "", ""),
    ausgangsrechnungen: copyLived(lived(answers, "E05"), answers.ausgangsrechnungen, []),
    buchhaltung: copyLived(lived(answers, "F01"), answers.buchhaltung, ""),
    belegId: copyLived(lived(answers, "F02"), answers.belegId ?? "", ""),
    steuerberater: copyLived(lived(answers, "F05"), answers.steuerberater, ""),
    archiv: copyLived(lived(answers, "G01"), answers.archiv, ""),
    zugriff: copyLived(lived(answers, "G02"), answers.zugriff, ""),
    loeschfreigabe: copyLived(lived(answers, "G05"), answers.loeschfreigabe ?? "", ""),
    backup: copyLived(lived(answers, "G06"), answers.backup, []),
    wiederherstellungstest: copyLived(
      lived(answers, "H04"),
      answers.wiederherstellungstest ?? "",
      "",
    ),
    kontrollen: copyLived(lived(answers, "H01"), answers.kontrollen ?? "", ""),
    dokumentenpflege: copyLived(lived(answers, "I01"), answers.dokumentenpflege ?? "", ""),
    anlagenliste: copyLived(lived(answers, "I02"), answers.anlagenliste ?? "", ""),
    fassungsrahmen: copyLived(lived(answers, "I05"), answers.fassungsrahmen ?? "", ""),
    it: copyLived(lived(answers, "B05") || lived(answers, "F01"), answers.it, ""),
    bestaetigungName: "",
    bestaetigungDatum: "",
  };
  if (lived(answers, "A02")) {
    const parts = [
      filled(answers.geltungBelegarten) ? `Belegarten: ${answers.geltungBelegarten}` : "",
      filled(answers.geltungAusschluss) ? `Ausschlüsse: ${answers.geltungAusschluss}` : "",
    ].filter(Boolean);
    if (parts.length) next.geltung = parts.join(". ");
  }
  if (lived(answers, "A03") && answers.vorsystemAntwort && Object.keys(answers.vorsystemAntwort).length) {
    const ja = VORSYSTEM_ARTEN.filter((art) => answers.vorsystemAntwort?.[art] === "ja");
    const entschieden = VORSYSTEM_ARTEN.every((art) => {
      const value = answers.vorsystemAntwort?.[art];
      return value === "ja" || value === "nein";
    });
    next.vorsysteme = ja.length ? ja.join(", ") : entschieden ? "Keine weiteren" : "";
  }
  if (lived(answers, "B01")) {
    const names = (answers.systeme ?? []).map((row) => row.name.trim()).filter(Boolean);
    if (names.length) {
      next.weitereSysteme = [answers.weitereSysteme, ...names].filter(Boolean).join("; ");
    }
  }
  if (lived(answers, "B04")) {
    const rows = (answers.originalJeWeg ?? []).filter((row) => filled(row.weg) && filled(row.original));
    if (rows.length) {
      next.originalErhalt = rows.map((row) => `${row.weg}: ${row.original}`).join("; ");
    }
  }
  if (lived(answers, "C02")) {
    const parts = [answers.postfach, answers.sichtungWer, answers.sichtungTurnus]
      .map((part) => (part ?? "").trim())
      .filter(Boolean);
    if (parts.length === 3) next.sichtung = parts.join(", ");
  }
  if (lived(answers, "E01")) {
    const extra = list(answers.formate).filter(
      (item) => hasToken([item], "Papier") || hasToken([item], "Scan") || hasWord([item], "Post"),
    );
    next.eingangsbelege = [...new Set([...next.eingangsbelege, ...extra])];
  }
  if (lived(answers, "E02")) {
    if (answers.validierung === "ja") next.erechnungVerfahren = "Technische Validierung: ja.";
    else if (answers.validierung === "nein") next.erechnungVerfahren = "Technische Validierung: nein.";
    else if (answers.validierung === "unbekannt") next.erechnungVerfahren = "";
  }
  if (lived(answers, "E03") && filled(answers.pruefkriterien) && filled(answers.pruefrolle)) {
    next.sachlichePruefung = `${answers.pruefkriterien} (${answers.pruefrolle})`;
  }
  if (lived(answers, "F01") && filled(answers.rollePruefen) && filled(answers.rolleFreigeben) && filled(answers.rolleBuchen)) {
    next.rollen = `Prüfen: ${answers.rollePruefen}. Freigeben: ${answers.rolleFreigeben}. Buchen: ${answers.rolleBuchen}.`;
    if (!filled(next.buchhaltung)) next.buchhaltung = answers.rolleBuchen ?? "";
  }
  if (lived(answers, "H04") && answers.backupGetestet && answers.backupGetestet !== "ja") {
    next.wiederherstellungstest = "";
  }
  if (lived(answers, "H01")) {
    const rows = completeKontrollen(answers);
    if (rows.length) {
      next.kontrollen = rows
        .map((row) => `| ${row.was} | ${row.turnus} | ${row.wer} | ${row.nachweis} |`)
        .join("\n");
    }
  }
  if (lived(answers, "I04")) {
    next.bestaetigungName = answers.bestaetigungName ?? "";
    next.bestaetigungDatum = answers.bestaetigungDatum ?? "";
  }
  if (lived(answers, "D01") && (answers.scanZweck ?? "").toLowerCase().includes("ersetzend")) {
    const paper =
      hasToken(next.eingangsbelege, "Papier") || hasWord(next.eingangsbelege, "Post");
    if (!paper) {
      next.weitereSysteme = [next.weitereSysteme, "ersetzendes Scannen"]
        .filter(Boolean)
        .join("; ");
    }
  }
  return next;
}

export function suppressRuleForFragen(ruleId: string, answers: IntakeAnswers): boolean {
  if (hasCatalogAnswers(answers)) return catalogSuppressesRule(ruleId, answers);
  if (!hasFrageStatuses(answers)) return false;
  for (const id of MVP_FRAGE_IDS) {
    const entry = answers.fragen?.[id];
    if (!entry?.status || !frageApplies(id, answers)) continue;
    if (FRAGE_OPEN[id].suppress.includes(ruleId) || FRAGE_OPEN[id].id === ruleId) return true;
  }
  return false;
}

export function openPointsFromFragen(answers: IntakeAnswers): FrageOpenPoint[] {
  if (hasCatalogAnswers(answers)) return catalogOpenPoints(answers);
  if (!hasFrageStatuses(answers)) return [];
  const points: FrageOpenPoint[] = [];
  for (const id of MVP_FRAGE_IDS) {
    if (!frageApplies(id, answers)) continue;
    const status = statusOf(answers, id);
    if (status === "unbekannt" || status === "geplant") points.push(FRAGE_OPEN[id]);
    if (id === "H01" && status === "nicht zutreffend") points.push(FRAGE_OPEN.H01);
    if (id === "E02" && status === "bestätigt" && answers.validierung === "unbekannt") {
      points.push(FRAGE_OPEN.E02);
    }
    if (
      id === "A03" &&
      status === "bestätigt" &&
      VORSYSTEM_ARTEN.some((art) => answers.vorsystemAntwort?.[art] === "unbekannt")
    ) {
      points.push(FRAGE_OPEN.A03);
    }
    if (
      id === "G06" &&
      status === "bestätigt" &&
      answers.backupGetestet &&
      answers.backupGetestet !== "ja" &&
      statusOf(answers, "H04") !== "unbekannt" &&
      statusOf(answers, "H04") !== "geplant"
    ) {
      points.push({
        id: "op-g06-test",
        priority: "hoch",
        text: "Ein Wiederherstellungstest ist nicht bestätigt.",
        chapter: "10-berechtigungen-sicherung",
        suppress: ["op-backup-test"],
      });
    }
  }
  return points;
}

export function intakeSummary(answers: IntakeAnswers): Array<[string, string]> {
  if (hasCatalogAnswers(answers) || Object.keys(answers.katalog ?? {}).length > 0) {
    return catalogSummary(answers);
  }
  const systems = (answers.systeme ?? [])
    .map((row) => [row.name, row.funktion].filter(Boolean).join(" — "))
    .filter(Boolean);
  const vorsystem = VORSYSTEM_ARTEN.map((art) =>
    answers.vorsystemAntwort?.[art] ? `${art}: ${answers.vorsystemAntwort[art]}` : "",
  ).filter(Boolean);
  const original = (answers.originalJeWeg ?? [])
    .filter((row) => filled(row.original))
    .map((row) => `${row.weg}: ${row.original}`);
  const kontrollen = completeKontrollen(answers).map(
    (row) => `${row.was} (${row.turnus}, ${row.wer}, ${row.nachweis})`,
  );
  const sichtung = [answers.postfach, answers.sichtungWer, answers.sichtungTurnus]
    .map((part) => (part ?? "").trim())
    .filter(Boolean);
  return [
    ["Branche", answers.branchen.join(", ") || "—"],
    ["Rechtsform", answers.rechtsform || "—"],
    ["Mitarbeitende", answers.mitarbeitende || "—"],
    ["Belegarten", answers.geltungBelegarten || answers.geltung || "—"],
    ["Ausschlüsse", answers.geltungAusschluss || "—"],
    ["Vorsysteme", vorsystem.join(", ") || answers.vorsysteme || "—"],
    ["Wirksamkeitsdatum", answers.seitWann || "—"],
    ["Systeme", [...answers.fibu, ...systems].filter(Boolean).join(", ") || answers.weitereSysteme || "—"],
    ["Original je Weg", original.join("; ") || answers.originalErhalt || "—"],
    ["Eingangsbelege", answers.eingangsbelege.join(", ") || "—"],
    ["Formate", (answers.formate ?? []).join(", ") || "—"],
    ["Postfach / Turnus", sichtung.join(", ") || answers.sichtung || "—"],
    ["Validierung", answers.validierung || "—"],
    ["Prüfkriterien", answers.pruefkriterien || answers.sachlichePruefung || "—"],
    ["Ausgangsrechnungen", answers.ausgangsrechnungen.join(", ") || "—"],
    [
      "Prüfen / Freigeben / Buchen",
      [answers.rollePruefen, answers.rolleFreigeben, answers.rolleBuchen].filter(Boolean).join(" / ") ||
        "—",
    ],
    ["GF / Inhaber", answers.gf || "—"],
    ["Buchhaltung", answers.buchhaltung || "—"],
    ["Steuerberater", answers.steuerberater || "—"],
    ["Archiv", answers.archiv || "—"],
    ["Hosting", answers.hosting || "—"],
    ["Backup", answers.backup.join(", ") || "—"],
    ["Backup getestet", answers.backupGetestet || "—"],
    ["Kontrollen", kontrollen.join("; ") || answers.kontrollen || "—"],
    [
      "Betriebliche Bestätigung",
      [answers.bestaetigungName, answers.bestaetigungDatum].filter(Boolean).join(", ") || "—",
    ],
  ];
}

/** Demo starts from the partner fixture and marks filled groups as bestätigt. */
export function seedDemoFragen(answers: IntakeAnswers): IntakeAnswers {
  const fragen: FragenState = {};
  const set = (id: FrageId, status: FrageStatus) => {
    fragen[id] = { status, text: status === "nicht zutreffend" ? "entfällt" : "" };
  };
  set("A01", "bestätigt");
  set("A02", "unbekannt");
  set("A03", "unbekannt");
  set("A04", "unbekannt");
  set("B01", "bestätigt");
  set("B04", "unbekannt");
  set("B05", "bestätigt");
  set("C01", "bestätigt");
  set("C02", "unbekannt");
  set("E01", "unbekannt");
  set("E03", "unbekannt");
  set("E05", "bestätigt");
  set("F01", "bestätigt");
  set("F02", "unbekannt");
  set("F05", "unbekannt");
  set("G01", "bestätigt");
  set("G02", "bestätigt");
  set("G05", "unbekannt");
  set("G06", "bestätigt");
  set("H01", "unbekannt");
  set("H04", "unbekannt");
  set("I01", "unbekannt");
  set("I02", "unbekannt");
  set("I04", "unbekannt");
  set("I05", "unbekannt");
  return { ...answers, fragen, formate: answers.formate ?? [] };
}
