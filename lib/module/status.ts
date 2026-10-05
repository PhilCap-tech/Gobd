/**
 * Statusableitung und Betriebs-Check für die 24 Module.
 */
import type { IntakeAnswers } from "@/lib/types";
import { MODULE, modulById, modulFragen } from "@/lib/module/katalog";
import type {
  CheckAntwort,
  CheckKey,
  ModulEintrag,
  ModulStatus,
  ModulZustand,
  Stammdaten,
} from "@/lib/module/typen";
import { CHECK_KEYS } from "@/lib/module/typen";

export const CHECK_FRAGEN: Array<{ key: CheckKey; label: string; hilfe: string }> = [
  { key: "bargeld", label: "Bargeld oder Kasse", hilfe: "Elektronische Kasse, POS oder offene Ladenkasse." },
  { key: "lager", label: "Lager oder Warenwirtschaft", hilfe: "Bestandsführung, Inventur oder Warenwirtschaftssystem." },
  { key: "personal", label: "Personal und Lohnabrechnung", hilfe: "Eigene Beschäftigte oder Lohnabrechnung (intern oder extern)." },
  { key: "zeiterfassung", label: "Zeiterfassung", hilfe: "Elektronische oder manuelle Erfassung von Arbeitszeiten." },
  { key: "online", label: "Onlineshop, Marktplätze oder Plattformen", hilfe: "Eigener Shop oder Verkauf über Marktplätze." },
  { key: "retouren", label: "Retouren und Erstattungen", hilfe: "Rücksendungen von Kunden oder an Lieferanten." },
  { key: "papier", label: "Papierbelege", hilfe: "Rechnungen oder Belege, die als Papier ankommen." },
  { key: "erechnung", label: "Elektronische Belege und E-Rechnungen", hilfe: "PDF-Rechnungen, XRechnung, ZUGFeRD oder andere strukturierte Formate." },
  { key: "anlagen", label: "Anlagevermögen", hilfe: "Aktive Anlagenbuchhaltung oder AfA-Verzeichnis." },
  { key: "kanzlei", label: "Steuerkanzlei oder Buchhaltungsservice", hilfe: "Externe Kanzlei oder Buchhaltungsdienstleister." },
  { key: "branche", label: "Branchenspezifische Abläufe", hilfe: "Zum Beispiel Bau, Vermietung, Praxis, Gastro, Taxi, Produktion." },
  { key: "zahlungsdienstleister", label: "Zahlungsdienstleister", hilfe: "PayPal, Stripe, Klarna, Kartenterminal oder ähnliche Anbieter." },
];

export const BRANCHEN_VORLAGEN = [
  {
    id: "dienstleister",
    label: "Dienstleister / Freiberufler",
    check: { bargeld: "nein", lager: "nein", personal: "unbekannt", zeiterfassung: "unbekannt", online: "nein", retouren: "nein", papier: "ja", erechnung: "ja", anlagen: "unbekannt", kanzlei: "ja", branche: "nein", zahlungsdienstleister: "unbekannt" } satisfies Partial<Record<CheckKey, CheckAntwort>>,
    moduleHint: ["m02", "m03", "m04", "m05", "m06", "m07", "m09"],
  },
  {
    id: "handel",
    label: "Handel mit Kasse und Lager",
    check: { bargeld: "ja", lager: "ja", personal: "unbekannt", zeiterfassung: "unbekannt", online: "nein", retouren: "ja", papier: "ja", erechnung: "ja", anlagen: "unbekannt", kanzlei: "ja", branche: "nein", zahlungsdienstleister: "ja" },
    moduleHint: ["m02", "m03", "m04", "m05", "m06", "m07", "m08", "m10", "m13"],
  },
  {
    id: "gastro",
    label: "Gastronomie / Hotel",
    check: { bargeld: "ja", lager: "ja", personal: "ja", zeiterfassung: "ja", online: "unbekannt", retouren: "nein", papier: "ja", erechnung: "ja", anlagen: "unbekannt", kanzlei: "ja", branche: "ja", zahlungsdienstleister: "ja" },
    moduleHint: ["m08", "m10", "m12", "m14"],
  },
  {
    id: "handwerk",
    label: "Handwerk / Bau",
    check: { bargeld: "nein", lager: "unbekannt", personal: "ja", zeiterfassung: "ja", online: "nein", retouren: "nein", papier: "ja", erechnung: "ja", anlagen: "ja", kanzlei: "ja", branche: "ja", zahlungsdienstleister: "unbekannt" },
    moduleHint: ["m02", "m04", "m11", "m12", "m14"],
  },
  {
    id: "ecommerce",
    label: "E-Commerce",
    check: { bargeld: "nein", lager: "ja", personal: "unbekannt", zeiterfassung: "unbekannt", online: "ja", retouren: "ja", papier: "unbekannt", erechnung: "ja", anlagen: "unbekannt", kanzlei: "ja", branche: "nein", zahlungsdienstleister: "ja" },
    moduleHint: ["m05", "m10", "m13"],
  },
] as const;

export type SoftwarePreset = {
  id: string;
  label: string;
  /** Katalog- und Modulfragen, die vorbelegt werden (nur Werte, kein Status). */
  values: Record<string, Record<string, unknown>>;
  stammdaten?: Partial<Stammdaten>;
};

export const SOFTWARE_PRESETS: SoftwarePreset[] = [
  {
    id: "datev",
    label: "DATEV",
    values: {
      B01: { systeme: [{ name: "DATEV", funktion: "Finanzbuchhaltung", typ: "fibu" }] },
      BU01: { kontenrahmen: "SKR 03" },
    },
    stammdaten: { fibu: "DATEV" },
  },
  {
    id: "lexoffice",
    label: "lexoffice",
    values: {
      B01: { systeme: [{ name: "lexoffice", funktion: "Finanzbuchhaltung und Rechnungen", typ: "fibu" }] },
      E05: { systeme: ["lexoffice"] },
    },
    stammdaten: { fibu: "lexoffice" },
  },
  {
    id: "sevdesk",
    label: "sevDesk",
    values: {
      B01: { systeme: [{ name: "sevDesk", funktion: "Finanzbuchhaltung und Rechnungen", typ: "fibu" }] },
      E05: { systeme: ["sevDesk"] },
    },
    stammdaten: { fibu: "sevDesk" },
  },
  {
    id: "shopify",
    label: "Shopify",
    values: {
      EC02: { system: "Shopify" },
    },
    stammdaten: { shop: "Shopify" },
  },
  {
    id: "pos",
    label: "Kassensystem (POS)",
    values: {
      KA01: { art: "Elektronische Registrierkasse / POS" },
    },
    stammdaten: { kasse: "POS-System" },
  },
];

export const STATUS_LABEL: Record<ModulStatus, string> = {
  tool: "im Tool beschrieben",
  extern: "durch bestehende Dokumentation abgedeckt",
  offen: "noch nicht dokumentiert",
  nicht_vorhanden: "nicht vorhanden",
};

export function emptyModulZustand(): ModulZustand {
  return { version: 1, check: {}, status: {} };
}

export function isGesamt(answers: IntakeAnswers | null | undefined): boolean {
  return Boolean(answers?.module);
}

export function modulZustand(answers: IntakeAnswers): ModulZustand {
  return answers.module ?? emptyModulZustand();
}

const AUTO_REASON: Partial<Record<CheckKey, string>> = {
  bargeld: "Kein Bargeldgeschäft und keine Kasse laut Betriebs-Check.",
  lager: "Keine Warenwirtschaft und kein Lager laut Betriebs-Check.",
  personal: "Keine Personalabrechnung laut Betriebs-Check.",
  online: "Kein Onlineshop und keine Marktplätze laut Betriebs-Check.",
  papier: "Keine Papierbelege laut Betriebs-Check.",
  erechnung: "Keine elektronischen Belege und keine E-Rechnungen laut Betriebs-Check.",
  anlagen: "Kein Anlagevermögen mit eigener Anlagenbuchhaltung laut Betriebs-Check.",
  branche: "Keine branchenspezifischen Abläufe laut Betriebs-Check.",
};

/** Abgeleiteter Status, wenn kein ausdrücklicher Status gesetzt ist. */
export function derivedModulStatus(zustand: ModulZustand, modulId: string): ModulEintrag {
  const modul = modulById(modulId);
  if (!modul) return { status: "offen" };
  if (modul.typ === "kern" || modul.typ === "regel") return { status: "tool" };
  const antwort = modul.trigger ? zustand.check[modul.trigger] : undefined;
  if (antwort === "ja") return { status: "tool" };
  if (antwort === "nein") {
    return { status: "nicht_vorhanden", reason: AUTO_REASON[modul.trigger!] ?? "Laut Betriebs-Check nicht vorhanden." };
  }
  return { status: "offen" };
}

export function effectiveModulStatus(answers: IntakeAnswers, modulId: string): ModulEintrag {
  const zustand = modulZustand(answers);
  return zustand.status[modulId] ?? derivedModulStatus(zustand, modulId);
}

/** Module, die im Gesamtdokument beschrieben werden müssen (nicht „nicht vorhanden“). */
export function activeModules(answers: IntakeAnswers): typeof MODULE {
  if (!isGesamt(answers)) return [];
  return MODULE.filter((modul) => effectiveModulStatus(answers, modul.id).status !== "nicht_vorhanden");
}

/** Module mit Status „tool“ — Fragen werden gestellt. */
export function toolModules(answers: IntakeAnswers): typeof MODULE {
  return activeModules(answers).filter((modul) => effectiveModulStatus(answers, modul.id).status === "tool");
}

export function setCheckAntwort(answers: IntakeAnswers, key: CheckKey, value: CheckAntwort): IntakeAnswers {
  const zustand = { ...modulZustand(answers), check: { ...modulZustand(answers).check, [key]: value } };
  return { ...answers, module: zustand };
}

export function setModulEintrag(answers: IntakeAnswers, modulId: string, eintrag: ModulEintrag | null): IntakeAnswers {
  const status = { ...modulZustand(answers).status };
  if (eintrag) status[modulId] = eintrag;
  else delete status[modulId];
  return { ...answers, module: { ...modulZustand(answers), status } };
}

export function setStammdaten(answers: IntakeAnswers, patch: Partial<Stammdaten>): IntakeAnswers {
  const zustand = modulZustand(answers);
  return {
    ...answers,
    module: { ...zustand, stammdaten: { ...(zustand.stammdaten ?? {}), ...patch } },
  };
}

export function setVorlage(answers: IntakeAnswers, vorlageId: string): IntakeAnswers {
  const vorlage = BRANCHEN_VORLAGEN.find((item) => item.id === vorlageId);
  if (!vorlage) return answers;
  const zustand = modulZustand(answers);
  return {
    ...answers,
    module: {
      ...zustand,
      vorlage: vorlage.id,
      check: { ...zustand.check, ...vorlage.check },
    },
  };
}

export function applySoftwarePreset(answers: IntakeAnswers, presetId: string): IntakeAnswers {
  const preset = SOFTWARE_PRESETS.find((item) => item.id === presetId);
  if (!preset) return answers;
  const zustand = modulZustand(answers);
  const software = Array.from(new Set([...(zustand.software ?? []), preset.id]));
  let next: IntakeAnswers = {
    ...answers,
    module: {
      ...zustand,
      software,
      stammdaten: { ...(zustand.stammdaten ?? {}), ...(preset.stammdaten ?? {}) },
    },
  };
  const katalog = { ...(next.katalog ?? {}) };
  for (const [qid, values] of Object.entries(preset.values)) {
    const current = katalog[qid] ?? {};
    katalog[qid] = { ...current, values: { ...(current.values ?? {}), ...values } };
  }
  next = { ...next, katalog };
  return next;
}

/** Stammdaten in bekannte Katalogfelder schreiben (nur leere Felder). */
export function applyStammdatenPrefill(answers: IntakeAnswers): IntakeAnswers {
  const s = modulZustand(answers).stammdaten;
  if (!s) return answers;
  const katalog = { ...(answers.katalog ?? {}) };
  const fill = (id: string, key: string, value: string | undefined) => {
    if (!value?.trim()) return;
    const entry = katalog[id] ?? {};
    const values = { ...(entry.values ?? {}) };
    if (values[key]) return;
    values[key] = value;
    katalog[id] = { ...entry, values };
  };
  fill("A01", "gf", s.gf);
  fill("F01", "buchhaltung", s.buchhaltung);
  fill("B01", "it", s.it);
  fill("F05", "kanzleiName", s.kanzlei);
  fill("G01", "ablage", s.archiv);
  if (s.fibu) {
    const entry = katalog.B01 ?? {};
    const values = { ...(entry.values ?? {}) };
    const systems = Array.isArray(values.systeme) ? (values.systeme as Record<string, unknown>[]) : [];
    if (!systems.some((row) => String(row.name ?? "") === s.fibu)) {
      values.systeme = [...systems, { name: s.fibu, funktion: "Finanzbuchhaltung", typ: "fibu" }];
      katalog.B01 = { ...entry, values };
    }
  }
  return { ...answers, katalog };
}

export function ensureGesamt(answers: IntakeAnswers): IntakeAnswers {
  if (answers.module) return answers;
  return { ...answers, module: emptyModulZustand(), bereich: undefined };
}

export function betriebsCheckVollstaendig(answers: IntakeAnswers): boolean {
  const check = modulZustand(answers).check;
  return CHECK_KEYS.every((key) => check[key] === "ja" || check[key] === "nein" || check[key] === "unbekannt");
}

export function modulStatusError(answers: IntakeAnswers, modulId: string): string {
  const modul = modulById(modulId);
  if (!modul) return "";
  const eintrag = effectiveModulStatus(answers, modulId);
  if (eintrag.status === "nicht_vorhanden") {
    if (modul.typ === "kern") return `Modul ${modul.nr} ist ein Kernmodul und kann nicht auf „nicht vorhanden“ gesetzt werden.`;
    if (!eintrag.reason?.trim()) return `Bitte kurz begründen, warum „${modul.titel}“ nicht vorhanden ist.`;
  }
  if (eintrag.status === "extern" && !eintrag.ref?.trim()) {
    return `Bitte die bestehende Dokumentation für „${modul.titel}“ benennen (Titel oder Ablageort).`;
  }
  return "";
}

export function vollstaendigkeitsZeilen(answers: IntakeAnswers): Array<{
  modul: string;
  nr: number;
  titel: string;
  status: ModulStatus;
  label: string;
  detail: string;
}> {
  return MODULE.map((modul) => {
    const eintrag = effectiveModulStatus(answers, modul.id);
    const detail =
      eintrag.status === "extern"
        ? [eintrag.ref, eintrag.link].filter(Boolean).join(" · ")
        : eintrag.status === "nicht_vorhanden"
          ? eintrag.reason ?? ""
          : eintrag.status === "offen"
            ? "Offener Punkt: Modul noch nicht dokumentiert."
            : "";
    return {
      modul: modul.id,
      nr: modul.nr,
      titel: modul.titel,
      status: eintrag.status,
      label: STATUS_LABEL[eintrag.status],
      detail,
    };
  });
}


/** Bearbeitungsstand eines Moduls: beantwortete / alle Fragen (Modulfragen + Katalogfragen). */
export function modulFortschritt(answers: IntakeAnswers, modulId: string): { beantwortet: number; gesamt: number; offen: number } {
  const modul = modulById(modulId);
  if (!modul) return { beantwortet: 0, gesamt: 0, offen: 0 };
  const state = answers.katalog ?? {};
  const ids = [...new Set([...modulFragen(modul).map((question) => question.id), ...modul.catalogIds])];
  let beantwortet = 0;
  let offen = 0;
  for (const id of ids) {
    const entry = state[id];
    if (entry?.status === "unbekannt") offen += 1;
    const hasValues = Object.values(entry?.values ?? {}).some((value) =>
      Array.isArray(value) ? value.length > 0 : typeof value === "string" ? value.trim() !== "" : value != null,
    );
    if (entry?.status || hasValues) beantwortet += 1;
  }
  return { beantwortet, gesamt: ids.length, offen };
}
