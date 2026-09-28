import catalogFile from "@/content/intake-catalog/INTAKE-CATALOG-MVP-v1.json";
import type { IntakeAnswers } from "@/lib/types";
import { emptyAnswers } from "@/lib/types";

export const CATALOG_VERSION = catalogFile.version;

export const CATALOG_STATUSES = [
  "bestaetigt",
  "geplant",
  "unbekannt",
  "nicht_zutreffend",
] as const;

export type CatalogStatus = (typeof CATALOG_STATUSES)[number];

export type CatalogField = {
  key: string;
  type: string;
  label?: string;
  required?: boolean;
  options?: string[];
  min?: number;
  item?: Record<string, string | { type: string; options?: string[] }>;
};

export type CatalogWhen = {
  "C01.kanaeleContainsAny"?: string[];
  "E01.formateContainsAny"?: string[];
  orC01?: string[];
};

export type CatalogQuestion = {
  id: string;
  prompt: string;
  fields: CatalogField[];
  statusRequired?: boolean;
  when?: CatalogWhen;
  note?: string;
  output?: string[];
};

export type CatalogStep = {
  id: string;
  title: string;
  when?: CatalogWhen;
  questions: CatalogQuestion[];
};

export type CatalogQuestionState = {
  status?: CatalogStatus;
  reason?: string;
  responsible?: string;
  date?: string;
  values?: Record<string, unknown>;
};

export type CatalogState = Record<string, CatalogQuestionState>;

type CatalogFile = {
  version: string;
  answerStatuses: string[];
  steps: CatalogStep[];
};

const catalog = catalogFile as CatalogFile;

export const CATALOG_STEPS: CatalogStep[] = catalog.steps;

const PAPER_CHANNEL = "Post/Papier";
const EINVOICE_CHANNEL = "E-Rechnung (XRechnung/ZUGFeRD/XML)";

const STATUS_LABEL: Record<CatalogStatus, string> = {
  bestaetigt: "Bestätigt",
  geplant: "Geplant",
  unbekannt: "Unbekannt",
  nicht_zutreffend: "Nicht zutreffend",
};

const SUPPRESS: Record<string, string[]> = {
  A01: ["op-company", "op-gf", "op-branchen", "op-rechtsform", "op-mitarbeitende"],
  B01: ["op-fibu", "op-weitere-systeme"],
  B05: ["op-hosting"],
  C01: ["op-eingangsbelege"],
  C02: ["op-c02-sichtung"],
  E02: ["op-erechnung-validierung"],
  E05: ["op-ausgangsrechnungen"],
  F01: ["op-buchhaltung"],
  F05: ["op-f05-kanzlei-umfang", "op-steuerberater"],
  G01: ["op-archiv"],
  G02: ["op-zugriff", "op-berechtigungsliste"],
  G05: ["op-loeschfrist"],
  G06: ["op-backup"],
  H01: ["op-kontrollprotokoll", "op-iks-kontrollen"],
  H04: ["op-backup-test"],
};

const OPEN_TEXT: Record<string, { priority: "hoch" | "mittel" | "niedrig"; text: string; chapter: string }> = {
  A01: {
    priority: "hoch",
    text: "Rechtsträger, Standort und Geschäftsführung sind nicht als gelebte Angabe bestätigt.",
    chapter: "00-cover-freigabe",
  },
  A02: {
    priority: "mittel",
    text: "Geltungsbereich (Belegarten und Ausschlüsse) ist nicht bestätigt.",
    chapter: "01-zweck-geltung",
  },
  A03: {
    priority: "mittel",
    text: "Kasse, Shop, Lager, Lohn oder weitere Vorsysteme sind nicht bestätigt.",
    chapter: "01-zweck-geltung",
  },
  A04: {
    priority: "mittel",
    text: "Seit wann der Ablauf so ausgeführt wird, ist nicht bestätigt. Es wird nicht rückdatiert.",
    chapter: "12-versionspflege",
  },
  B01: {
    priority: "hoch",
    text: "Systeme, die Belege erzeugen oder archivieren, sind nicht bestätigt.",
    chapter: "03-systeme-datenfluss",
  },
  B04: {
    priority: "mittel",
    text: "Welche Dateien als Original aufbewahrt werden, ist nicht bestätigt.",
    chapter: "03-systeme-datenfluss",
  },
  B05: {
    priority: "mittel",
    text: "Unterlagen zu externen Systemen oder Anbietern sind nicht bestätigt.",
    chapter: "13-mitgeltende-unterlagen",
  },
  C01: {
    priority: "hoch",
    text: "Eingangswege sind nicht bestätigt.",
    chapter: "04-belegarten-kanaele",
  },
  C02: {
    priority: "mittel",
    text: "Sichtungsturnus der Eingangsbelege (Postfach oder Portal, wer, wie oft) ist nicht bestätigt.",
    chapter: "05-eingang-erechnung",
  },
  C03: {
    priority: "mittel",
    text: "Wer Papier entgegennimmt und wohin es gelangt, ist nicht bestätigt.",
    chapter: "06-papier-digitalisierung",
  },
  D01: {
    priority: "hoch",
    text: "Ob Papier gescannt wird und zu welchem Zweck, ist nicht bestätigt.",
    chapter: "06-papier-digitalisierung",
  },
  E01: {
    priority: "mittel",
    text: "Empfangene Rechnungsformate sind nicht bestätigt. PDF ist damit keine strukturierte E-Rechnung.",
    chapter: "05-eingang-erechnung",
  },
  E02: {
    priority: "hoch",
    text: "Empfang, Prüfung und Aufbewahrung des strukturierten Teils einer E-Rechnung sind nicht bestätigt.",
    chapter: "05-eingang-erechnung",
  },
  E03: {
    priority: "mittel",
    text: "Wer die sachliche Prüfung vor der Freigabe macht, ist nicht bestätigt.",
    chapter: "08-freigabe-buchung-status",
  },
  E05: {
    priority: "mittel",
    text: "System und Nummernkreis der Ausgangsrechnungen sind nicht bestätigt.",
    chapter: "07-ausgangsrechnungen",
  },
  F01: {
    priority: "hoch",
    text: "Wer prüft, freigibt und bucht, ist nicht bestätigt.",
    chapter: "08-freigabe-buchung-status",
  },
  F02: {
    priority: "mittel",
    text: "Welche Beleg-ID Original, Freigabe und Buchung verbindet, ist nicht bestätigt.",
    chapter: "08-freigabe-buchung-status",
  },
  F05: {
    priority: "mittel",
    text: "Leistungsumfang der Kanzlei ist nicht bestätigt. Eine Verbuchung wird nicht als gelebter Prozess angenommen.",
    chapter: "08-freigabe-buchung-status",
  },
  G01: {
    priority: "hoch",
    text: "Ablageort und Suchmerkmale sind nicht bestätigt.",
    chapter: "09-ablage-aufbewahrung",
  },
  G02: {
    priority: "hoch",
    text: "Wer einsehen, ändern oder löschen darf, ist nicht bestätigt.",
    chapter: "10-berechtigungen-sicherung",
  },
  G05: {
    priority: "mittel",
    text: "Wer Fristen zuordnet und eine Löschung freigibt, ist nicht als gelebte Praxis bestätigt.",
    chapter: "09-ablage-aufbewahrung",
  },
  G06: {
    priority: "hoch",
    text: "Sicherung ist nicht bestätigt.",
    chapter: "10-berechtigungen-sicherung",
  },
  H01: {
    priority: "mittel",
    text: "Welche Kontrollen tatsächlich laufen, von wem und in welchem Turnus, ist nicht bestätigt.",
    chapter: "11-iks",
  },
  H04: {
    priority: "hoch",
    text: "Ein dokumentierter Wiederherstellungs- oder Exporttest liegt nicht vor.",
    chapter: "10-berechtigungen-sicherung",
  },
  I01: {
    priority: "mittel",
    text: "Wer die Dokumentation pflegt und wann eine neue Fassung entsteht, ist nicht bestätigt.",
    chapter: "12-versionspflege",
  },
  I02: {
    priority: "mittel",
    text: "Die Liste mitgeltender Unterlagen ist nicht bestätigt.",
    chapter: "13-mitgeltende-unterlagen",
  },
  I04: {
    priority: "hoch",
    text: "Die betriebliche Bestätigung (Name und Datum) liegt nicht vor. Die Generierung setzt sie nicht.",
    chapter: "00-cover-freigabe",
  },
  I05: {
    priority: "niedrig",
    text: "Gültigkeitszeitraum dieser Fassung und der Ablageort älterer Fassungen sind nicht bestätigt.",
    chapter: "12-versionspflege",
  },
};

export type CatalogOpenPoint = {
  id: string;
  priority: "hoch" | "mittel" | "niedrig";
  text: string;
  chapter: string;
  suppress: string[];
};

export function catalogState(answers: IntakeAnswers): CatalogState {
  return answers.katalog ?? {};
}

export function hasCatalogAnswers(answers: IntakeAnswers): boolean {
  return Object.values(catalogState(answers)).some((entry) => Boolean(entry?.status));
}

function valuesOf(state: CatalogState, id: string): Record<string, unknown> {
  return state[id]?.values ?? {};
}

function asList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value === "string" && value.trim()) {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asRows(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => item && typeof item === "object") as Record<string, unknown>[];
}

function kanaeleOf(state: CatalogState): string[] {
  return asList(valuesOf(state, "C01").kanaele);
}

function formateOf(state: CatalogState): string[] {
  return asList(valuesOf(state, "E01").formate);
}

function whenMatches(when: CatalogWhen | undefined, state: CatalogState): boolean {
  if (!when) return true;
  const channels = kanaeleOf(state);
  const formats = formateOf(state);
  const channelTokens = when["C01.kanaeleContainsAny"];
  if (channelTokens && !channelTokens.some((token) => channels.includes(token))) return false;
  if (when["E01.formateContainsAny"] || when.orC01) {
    const formatHit = (when["E01.formateContainsAny"] ?? []).some((token) => formats.includes(token));
    const channelHit = (when.orC01 ?? []).some((token) => channels.includes(token));
    if (!formatHit && !channelHit) return false;
  }
  return true;
}

export function catalogQuestionApplies(question: CatalogQuestion, answers: IntakeAnswers): boolean {
  return whenMatches(question.when, catalogState(answers));
}

export function catalogStepApplies(step: CatalogStep, answers: IntakeAnswers): boolean {
  if (!whenMatches(step.when, catalogState(answers))) return false;
  return step.questions.some((question) => catalogQuestionApplies(question, answers));
}

export function visibleCatalogQuestions(stepIndex: number, answers: IntakeAnswers): CatalogQuestion[] {
  const step = CATALOG_STEPS[stepIndex];
  if (!step || !catalogStepApplies(step, answers)) return [];
  return step.questions.filter((question) => catalogQuestionApplies(question, answers));
}

function filled(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.length > 0 && value.some((item) => filled(item));
  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).some((item) => filled(item));
  }
  return Boolean(asText(value));
}

function fieldIsRequired(field: CatalogField): boolean {
  if (field.required === false) return false;
  if (field.type === "repeat") return (field.min ?? 1) > 0;
  return true;
}

function repeatReady(field: CatalogField, value: unknown): boolean {
  const min = field.min ?? 1;
  const rows = asRows(value).filter((row) =>
    Object.entries(field.item ?? {}).every(([key, spec]) => {
      const type = typeof spec === "string" ? spec : spec.type;
      if (type === "text") return Boolean(asText(row[key]));
      return filled(row[key]);
    }),
  );
  return rows.length >= min;
}

function fieldReady(field: CatalogField, value: unknown): boolean {
  if (!fieldIsRequired(field)) return true;
  if (field.type === "repeat") return repeatReady(field, value);
  if (field.type === "boolean") return value === true;
  if (field.type === "multi" || field.type === "multi_or_text") return asList(value).length > 0 || Boolean(asText(value));
  return filled(value);
}

export function catalogStepError(stepIndex: number, answers: IntakeAnswers): string {
  const step = CATALOG_STEPS[stepIndex];
  if (!step) return "";
  if (!catalogStepApplies(step, answers)) return "";
  const state = catalogState(answers);
  for (const question of visibleCatalogQuestions(stepIndex, answers)) {
    const entry = state[question.id];
    if (!entry?.status) return `Bitte den Status für ${question.id} wählen.`;
    if (entry.status === "nicht_zutreffend" && !asText(entry.reason)) {
      return `Bitte bei ${question.id} kurz den Grund für „nicht zutreffend“ nennen.`;
    }
    if (entry.status === "bestaetigt" || entry.status === "geplant") {
      for (const field of question.fields) {
        if (!fieldReady(field, entry.values?.[field.key])) {
          return `Bitte die Angabe zu ${question.id} ausfüllen. Geplant ist kein Ist-Prozess.`;
        }
      }
    }
  }
  return "";
}

function touch(
  answers: IntakeAnswers,
  id: string,
  patch: CatalogQuestionState,
): IntakeAnswers {
  const current = catalogState(answers)[id] ?? {};
  return {
    ...answers,
    katalog: {
      ...catalogState(answers),
      [id]: {
        ...current,
        ...patch,
        values: patch.values ?? current.values ?? {},
      },
    },
  };
}

export function setCatalogStatus(
  answers: IntakeAnswers,
  id: string,
  status: CatalogStatus,
): IntakeAnswers {
  return touch(answers, id, { status });
}

export function setCatalogReason(answers: IntakeAnswers, id: string, reason: string): IntakeAnswers {
  return touch(answers, id, { reason });
}

export function setCatalogMeta(
  answers: IntakeAnswers,
  id: string,
  meta: { responsible?: string; date?: string },
): IntakeAnswers {
  return touch(answers, id, meta);
}

export function setCatalogValue(
  answers: IntakeAnswers,
  id: string,
  key: string,
  value: unknown,
): IntakeAnswers {
  const current = catalogState(answers)[id] ?? {};
  return touch(answers, id, {
    values: { ...(current.values ?? {}), [key]: value },
  });
}

function live(state: CatalogState, id: string): boolean {
  return state[id]?.status === "bestaetigt";
}

function completeControls(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return rows.filter(
    (row) => asText(row.name) && asText(row.turnus) && asText(row.wer) && asText(row.nachweis),
  );
}

/**
 * Catalog statuses win. Only `bestaetigt` becomes a lived generator field.
 * `geplant`, `unbekannt` and `nicht_zutreffend` do not. A04/I05 dates never
 * become the document's Gültig-ab. I04 never confirms the cover.
 */
export function projectCatalogAnswers(answers: IntakeAnswers): IntakeAnswers {
  const state = catalogState(answers);
  const next = emptyAnswers();
  if (live(state, "A01")) {
    const values = valuesOf(state, "A01");
    next.branchen = asList(values.branchen);
    next.rechtsform = asText(values.rechtsform);
    next.mitarbeitende = asText(values.mitarbeitende);
    next.gf = asText(values.gf);
    next.standort = asText(values.standort);
  }
  if (live(state, "A02")) {
    const values = valuesOf(state, "A02");
    const scope = asList(values.belegartenScope);
    const excluded = [...asList(values.ausgeschlossen), asText(values.ausgeschlossenSonstiges)].filter(Boolean);
    next.geltungBelegarten = scope.join(", ");
    next.geltungAusschluss = excluded.join(", ");
    next.geltung = [
      scope.length ? `Belegarten: ${scope.join(", ")}` : "",
      excluded.length ? `Ausschlüsse: ${excluded.join(", ")}` : "",
    ]
      .filter(Boolean)
      .join(". ");
  }
  if (live(state, "A03")) {
    const values = valuesOf(state, "A03");
    const labels: Record<string, string> = {
      kasse: "Kasse",
      shop: "Shop",
      lager: "Lager",
      lohn: "Lohn",
      plattformen: "Plattformen",
    };
    const ja = Object.keys(labels).filter((key) => values[key] === "ja").map((key) => labels[key]);
    const allNein = Object.keys(labels).every((key) => values[key] === "nein");
    next.vorsysteme = ja.length ? ja.join(", ") : allNein ? "Keine weiteren" : "";
    const hint = asText(values.hinweis);
    if (hint && next.vorsysteme) next.vorsysteme = `${next.vorsysteme}. ${hint}`;
  }
  if (live(state, "A04") && valuesOf(state, "A04").keineRueckdatierungBestaetigt === true) {
    next.seitWann = asText(valuesOf(state, "A04").gueltigAb);
  }
  if (live(state, "B01")) {
    const values = valuesOf(state, "B01");
    const systems = asRows(values.systeme);
    next.fibu = systems
      .filter((row) => asText(row.typ) === "fibu")
      .map((row) => asText(row.name))
      .filter(Boolean);
    const rest = systems
      .filter((row) => asText(row.typ) !== "fibu")
      .map((row) => [asText(row.name), asText(row.funktion)].filter(Boolean).join(" — "))
      .filter(Boolean);
    next.weitereSysteme = [...rest, asText(values.weitereFreitext)].filter(Boolean).join("; ");
    next.hosting = asText(values.hosting);
    next.it = asText(values.it);
    next.systeme = systems.map((row) => ({
      name: asText(row.name),
      funktion: asText(row.funktion),
    }));
  }
  if (live(state, "B04")) {
    const rows = asRows(valuesOf(state, "B04").originalJeWeg).filter(
      (row) => asText(row.belegweg) && asText(row.originalBeschreibung),
    );
    next.originalErhalt = rows
      .map((row) => `${asText(row.belegweg)}: ${asText(row.originalBeschreibung)}`)
      .join("; ");
    next.originalJeWeg = rows.map((row) => ({
      weg: asText(row.belegweg),
      original: asText(row.originalBeschreibung),
    }));
  }
  if (live(state, "B05")) {
    next.anbieterUnterlagen = asRows(valuesOf(state, "B05").externeSysteme)
      .filter((row) => asText(row.name))
      .map((row) => `${asText(row.name)}: ${asText(row.unterlagenVorhanden)}`)
      .join("; ");
  }
  if (live(state, "C01")) {
    next.eingangsbelege = kanaeleOf(state);
  }
  if (live(state, "C02")) {
    const values = valuesOf(state, "C02");
    next.postfach = asText(values.postfachOderPortal);
    next.sichtungWer = asText(values.wer);
    next.sichtungTurnus = asText(values.turnus);
    next.sichtung = [next.postfach, next.sichtungWer, next.sichtungTurnus].filter(Boolean).join(", ");
  }
  if (live(state, "C03")) {
    next.papierannahme = asText(valuesOf(state, "C03").schritte);
  }
  if (live(state, "D01")) {
    const zweck = asText(valuesOf(state, "D01").scanZweck);
    next.scanZweck =
      zweck === "nein" ? "nein, kein Scan" : zweck === "ersetzend" ? "ersetzendes Scannen" : zweck;
  }
  if (live(state, "E01")) {
    next.formate = formateOf(state);
  }
  if (live(state, "E02")) {
    const values = valuesOf(state, "E02");
    const validierung = asText(values.validierung);
    const ablauf = asText(values.ablauf);
    if (validierung === "ja_bestaetigt") {
      next.validierung = "ja";
      next.erechnungVerfahren = [ablauf, "Technische Validierung: ja."].filter(Boolean).join(" ");
    } else if (validierung === "nein") {
      next.validierung = "nein";
      next.erechnungVerfahren = [ablauf, "Technische Validierung: nein."].filter(Boolean).join(" ");
    }
  }
  if (live(state, "E03")) {
    const values = valuesOf(state, "E03");
    next.pruefrolle = asText(values.pruefer);
    next.pruefkriterien = asText(values.kriterien);
    next.sachlichePruefung = [next.pruefkriterien, next.pruefrolle].filter(Boolean).join(" — ");
  }
  if (live(state, "E05")) {
    const values = valuesOf(state, "E05");
    next.ausgangsrechnungen = asList(values.systeme);
    const who = asText(values.wer);
    const numbers = asText(values.nummernvergabe);
    if (who || numbers) {
      next.fassungsrahmen = [next.fassungsrahmen, who, numbers].filter(Boolean).join(". ");
    }
  }
  if (live(state, "F01")) {
    const values = valuesOf(state, "F01");
    next.rollePruefen = asText(values.sachlich);
    next.rolleFreigeben = asText(values.freigabe);
    next.rolleBuchen = asText(values.buchung);
    next.buchhaltung = asText(values.buchhaltung) || next.rolleBuchen;
    if (next.rollePruefen || next.rolleFreigeben || next.rolleBuchen) {
      next.rollen = `Prüfen: ${next.rollePruefen}. Freigeben: ${next.rolleFreigeben}. Buchen: ${next.rolleBuchen}.`;
    }
  }
  if (live(state, "F02")) {
    next.belegId = asText(valuesOf(state, "F02").belegIdBeschreibung);
  }
  if (live(state, "F05")) {
    const values = valuesOf(state, "F05");
    if (asText(values.nachweisVorhanden) === "ja" && asText(values.kanzleiName) && asText(values.leistungsumfang)) {
      next.steuerberater = `${asText(values.kanzleiName)}: ${asText(values.leistungsumfang)}`;
    }
  }
  if (live(state, "G01")) {
    const values = valuesOf(state, "G01");
    next.archiv = [asText(values.ablage), asText(values.ordnung)].filter(Boolean).join(" — ");
  }
  if (live(state, "G02")) {
    next.zugriff = asText(valuesOf(state, "G02").zugriffKurz);
  }
  if (live(state, "G05")) {
    const values = valuesOf(state, "G05");
    next.loeschfreigabe = [asText(values.rolleFristen), asText(values.verfahren)].filter(Boolean).join(". ");
  }
  if (live(state, "G06")) {
    const values = valuesOf(state, "G06");
    next.backup = asList(values.backupArten).length ? asList(values.backupArten) : asText(values.backupArten) ? [asText(values.backupArten)] : [];
    const tested = asText(values.wiederherstellungGetestet);
    if (tested === "ja" || tested === "nein" || tested === "unbekannt") next.backupGetestet = tested;
    if (tested === "ja") next.wiederherstellungstest = asText(values.letztesTestdatum);
  }
  if (live(state, "H01")) {
    const rows = completeControls(asRows(valuesOf(state, "H01").kontrollen));
    next.kontrollen = rows
      .map((row) => `| ${asText(row.name)} | ${asText(row.turnus)} | ${asText(row.wer)} | ${asText(row.nachweis)} |`)
      .join("\n");
    next.kontrollenListe = rows.map((row) => ({
      was: asText(row.name),
      turnus: asText(row.turnus),
      wer: asText(row.wer),
      nachweis: asText(row.nachweis),
    }));
  }
  if (live(state, "H04") && asText(valuesOf(state, "H04").status) === "bestaetigt") {
    const values = valuesOf(state, "H04");
    const line = [asText(values.datum), asText(values.ergebnis)].filter(Boolean).join(": ");
    if (line) {
      next.wiederherstellungstest = [next.wiederherstellungstest, line].filter(Boolean).join(". ");
    }
  }
  if (live(state, "I01")) {
    const values = valuesOf(state, "I01");
    next.dokumentenpflege = [asText(values.pfleger), asText(values.ausloeser)].filter(Boolean).join(". ");
  }
  if (live(state, "I02")) {
    next.anlagenliste = asRows(valuesOf(state, "I02").anlagen)
      .filter((row) => asText(row.name))
      .map((row) => `${asText(row.name)} (${asText(row.status)})`)
      .join("; ");
  }
  if (live(state, "I04")) {
    next.bestaetigungName = asText(valuesOf(state, "I04").name);
    next.bestaetigungDatum = asText(valuesOf(state, "I04").datum);
  }
  if (live(state, "I05")) {
    const values = valuesOf(state, "I05");
    const frame = [asText(values.gueltigAb), asText(values.speicherortHistorie)].filter(Boolean).join(" — ");
    next.fassungsrahmen = [frame, next.fassungsrahmen].filter(Boolean).join(". ");
  }
  return next;
}

function pointFor(id: string): CatalogOpenPoint {
  const meta = OPEN_TEXT[id] ?? {
    priority: "mittel" as const,
    text: `${id} ist nicht bestätigt.`,
    chapter: "14-offene-punkte",
  };
  return {
    id: id === "C02" ? "op-c02-sichtung" : id === "F05" ? "op-f05-kanzlei-umfang" : `op-${id.toLowerCase()}`,
    priority: meta.priority,
    text: meta.text,
    chapter: meta.chapter,
    suppress: SUPPRESS[id] ?? [],
  };
}

export function catalogOpenPoints(answers: IntakeAnswers): CatalogOpenPoint[] {
  if (!hasCatalogAnswers(answers)) return [];
  const state = catalogState(answers);
  const points: CatalogOpenPoint[] = [];
  for (const step of CATALOG_STEPS) {
    if (!catalogStepApplies(step, answers)) continue;
    for (const question of step.questions) {
      if (!catalogQuestionApplies(question, answers)) continue;
      const status = state[question.id]?.status;
      if (status === "unbekannt" || status === "geplant") points.push(pointFor(question.id));
      if (question.id === "H01" && status !== "bestaetigt") {
        if (!points.some((point) => point.id === "op-h01")) points.push(pointFor("H01"));
      }
      if (question.id === "H01" && status === "bestaetigt") {
        const rows = completeControls(asRows(valuesOf(state, "H01").kontrollen));
        if (!rows.length) points.push(pointFor("H01"));
      }
      if (
        question.id === "A03" &&
        status === "bestaetigt" &&
        ["kasse", "shop", "lager", "lohn", "plattformen"].some(
          (key) => valuesOf(state, "A03")[key] === "unbekannt",
        )
      ) {
        points.push(pointFor("A03"));
      }
      if (question.id === "E02" && status === "bestaetigt" && asText(valuesOf(state, "E02").validierung) !== "ja_bestaetigt") {
        points.push(pointFor("E02"));
      }
      if (
        question.id === "G06" &&
        status === "bestaetigt" &&
        asText(valuesOf(state, "G06").wiederherstellungGetestet) !== "ja" &&
        state.H04?.status !== "unbekannt" &&
        state.H04?.status !== "geplant"
      ) {
        points.push({
          id: "op-g06-test",
          priority: "hoch",
          text: "Ein Wiederherstellungstest ist nicht bestätigt.",
          chapter: "10-berechtigungen-sicherung",
          suppress: ["op-backup-test"],
        });
      }
      if (question.id === "H04" && status === "bestaetigt" && asText(valuesOf(state, "H04").status) !== "bestaetigt") {
        points.push(pointFor("H04"));
      }
      if (question.id === "F05" && status === "bestaetigt" && asText(valuesOf(state, "F05").nachweisVorhanden) !== "ja") {
        points.push(pointFor("F05"));
      }
      if (question.id === "G02" && status === "bestaetigt" && asText(valuesOf(state, "G02").berechtigungslisteVorhanden) !== "ja") {
        points.push({
          id: "op-berechtigungsliste",
          priority: "mittel",
          text: "Eine Berechtigungsliste ist nicht bestätigt.",
          chapter: "10-berechtigungen-sicherung",
          suppress: [],
        });
      }
    }
  }
  return points;
}

export function catalogSuppressesRule(ruleId: string, answers: IntakeAnswers): boolean {
  if (!hasCatalogAnswers(answers)) return false;
  const state = catalogState(answers);
  for (const step of CATALOG_STEPS) {
    if (!catalogStepApplies(step, answers)) continue;
    for (const question of step.questions) {
      if (!catalogQuestionApplies(question, answers)) continue;
      const status = state[question.id]?.status;
      if (!status) continue;
      const point = pointFor(question.id);
      if (point.id === ruleId) return true;
      const suppress = [...(SUPPRESS[question.id] ?? [])];
      if (question.id === "G02" && asText(valuesOf(state, "G02").berechtigungslisteVorhanden) !== "ja") {
        const index = suppress.indexOf("op-berechtigungsliste");
        if (index >= 0) suppress.splice(index, 1);
      }
      if (suppress.includes(ruleId)) return true;
    }
  }
  if (ruleId === "op-g06-test") {
    return catalogOpenPoints(answers).some((point) => point.id === "op-g06-test");
  }
  return false;
}

function mapChannels(channels: string[]): string[] {
  const mapped = new Set<string>();
  for (const channel of channels) {
    const value = channel.toLowerCase();
    if (value.includes("papier") || value.includes("post")) mapped.add(PAPER_CHANNEL);
    else if (value.includes("xrechnung") || value.includes("zugferd") || value.includes("e-rechnung") || value.includes("erechnung")) {
      mapped.add(EINVOICE_CHANNEL);
    } else if (value.includes("portal")) mapped.add("Portal");
    else if (value.includes("schnitt")) mapped.add("Schnittstelle");
    else if (value.includes("app") || value.includes("scan")) mapped.add("App");
    else if (value.includes("mail") || value.includes("pdf")) mapped.add("E-Mail-PDF");
  }
  return [...mapped];
}

/** Prefill catalog values from an old short intake. Does not mark them bestätigt. */
export function draftCatalogFromLegacy(answers: IntakeAnswers, company = ""): CatalogState {
  const systems = answers.fibu.map((name) => ({ name, funktion: "FiBu", typ: "fibu" }));
  return {
    A01: {
      values: {
        company,
        standort: answers.standort ?? "",
        branchen: answers.branchen,
        rechtsform: answers.rechtsform,
        mitarbeitende: answers.mitarbeitende,
        gf: answers.gf,
      },
    },
    B01: {
      values: {
        systeme: systems,
        weitereFreitext: answers.weitereSysteme,
        hosting: answers.hosting,
        it: answers.it === "nicht angegeben" ? "" : answers.it,
      },
    },
    C01: { values: { kanaele: mapChannels(answers.eingangsbelege) } },
    E01: { values: { formate: answers.formate ?? [] } },
    E05: { values: { systeme: answers.ausgangsrechnungen } },
    F01: { values: { buchhaltung: answers.buchhaltung } },
    F05: { values: { kanzleiName: answers.steuerberater } },
    G01: { values: { ablage: answers.archiv } },
    G02: { values: { zugriffKurz: answers.zugriff } },
    G06: { values: { backupArten: answers.backup.join(", ") } },
  };
}

export function withCatalogDraft(answers: IntakeAnswers, company = ""): IntakeAnswers {
  if (hasCatalogAnswers(answers) || Object.keys(catalogState(answers)).length > 0) return answers;
  return { ...answers, katalog: draftCatalogFromLegacy(answers, company) };
}

export function statusLabel(status: CatalogStatus): string {
  return STATUS_LABEL[status];
}

/** Beispiel GmbH: only facts already in the short partner fixture are bestätigt. */
export function beispielGmbHKatalog(answers: IntakeAnswers, company: string): CatalogState {
  const draft = draftCatalogFromLegacy(answers, company);
  const mark = (id: string, status: CatalogStatus, values?: Record<string, unknown>): CatalogQuestionState => ({
    status,
    reason: status === "nicht_zutreffend" ? "entfällt" : "",
    values: { ...(draft[id]?.values ?? {}), ...(values ?? {}) },
  });
  const unknown = (id: string, values?: Record<string, unknown>) => mark(id, "unbekannt", values);
  return {
    A01: unknown("A01"),
    A02: unknown("A02"),
    A03: unknown("A03"),
    A04: unknown("A04"),
    B01: mark("B01", "bestaetigt"),
    B04: unknown("B04"),
    B05: unknown("B05"),
    C01: mark("C01", "bestaetigt", { kanaele: ["E-Mail-PDF"] }),
    C02: unknown("C02"),
    E01: unknown("E01"),
    E03: unknown("E03"),
    E05: unknown("E05"),
    F01: unknown("F01"),
    F02: unknown("F02"),
    F05: unknown("F05"),
    G01: unknown("G01"),
    G02: mark("G02", "bestaetigt", { berechtigungslisteVorhanden: "unbekannt" }),
    G05: unknown("G05"),
    G06: mark("G06", "bestaetigt", { wiederherstellungGetestet: "unbekannt" }),
    H01: unknown("H01"),
    H04: unknown("H04"),
    I01: unknown("I01"),
    I02: unknown("I02"),
    I04: unknown("I04"),
    I05: unknown("I05"),
  };
}

export function catalogSummary(answers: IntakeAnswers): Array<[string, string]> {
  const state = catalogState(answers);
  const rows: Array<[string, string]> = [];
  for (const step of CATALOG_STEPS) {
    for (const question of step.questions) {
      if (!catalogQuestionApplies(question, answers) && !state[question.id]?.status) continue;
      const entry = state[question.id];
      const status = entry?.status ? STATUS_LABEL[entry.status] : "offen";
      const bits = question.fields.map((field) => {
        const value = entry?.values?.[field.key];
        if (Array.isArray(value)) {
          if (value.every((item) => item && typeof item === "object")) {
            return value
              .map((item) =>
                Object.values(item as Record<string, unknown>)
                  .map((part) => asText(part))
                  .filter(Boolean)
                  .join(" "),
              )
              .filter(Boolean)
              .join("; ");
          }
          return value.map((item) => asText(item)).filter(Boolean).join(", ");
        }
        if (typeof value === "boolean") return value ? "ja" : "";
        return asText(value);
      });
      rows.push([`${question.id} ${status}`, bits.filter(Boolean).join(" · ") || "—"]);
    }
  }
  return rows;
}
