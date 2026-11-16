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
  FeldSync,
  ModulZustand,
  SoftwareBeitrag,
  Stammdaten,
} from "@/lib/module/typen";
import { CHECK_KEYS, MODUL_STATUSES } from "@/lib/module/typen";

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

/** Anzeige in Übersicht und PDF. Enum-Werte (tool, extern, offen, nicht_vorhanden) bleiben. */
export const STATUS_LABEL: Record<ModulStatus, string> = {
  tool: "Im Tool beschreiben",
  extern: "durch bestehende Dokumentation abgedeckt",
  offen: "Später ausfüllen",
  nicht_vorhanden: "nicht vorhanden",
};

/** Bezeichnung in der Status-Auswahl auf „Module und Dokumentationsstatus“. */
export const STATUS_OPTION_LABEL: Record<ModulStatus, string> = {
  tool: "Im Tool beschreiben",
  extern: "bestehende Dokumentation",
  offen: "Später ausfüllen",
  nicht_vorhanden: "nicht vorhanden",
};

/** Ein Satz je Option, Sie-Form, ohne Rechtsanspruch. */
export const STATUS_HILFE: Record<ModulStatus, string> = {
  tool: "Sie beantworten die Fragen zu diesem Modul hier; die Angaben erscheinen im Gesamt-PDF.",
  extern: "Sie haben die Beschreibung schon und verlinken oder laden sie hier hoch.",
  offen: "Sie haben noch nicht genügend Informationen (zum Beispiel, weil der Prozess unklar ist oder ein Mitarbeiter fehlt) und füllen das Modul später aus; es bleibt als offene Aufgabe sichtbar, bis Sie es beschreiben oder auf „nicht vorhanden“ setzen.",
  nicht_vorhanden: "Diesen Ablauf gibt es in Ihrem Betrieb nicht; Sie schließen ihn bewusst aus.",
};

export function emptyModulZustand(): ModulZustand {
  return { version: 1, check: {}, status: {} };
}

export function isGesamt(answers: IntakeAnswers | null | undefined): boolean {
  return Boolean(answers?.module);
}

const MODUL_STATUS_VALUES = new Set<ModulStatus>(MODUL_STATUSES);

function modulStatusMap(value: unknown): Record<string, ModulEintrag> {
  if (!value || typeof value !== "object") return {};
  const out: Record<string, ModulEintrag> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (!entry || typeof entry !== "object") continue;
    const raw = entry as ModulEintrag;
    if (!MODUL_STATUS_VALUES.has(raw.status)) continue;
    out[key] = {
      ...raw,
      uploadAt: typeof raw.uploadAt === "string" ? raw.uploadAt : undefined,
    };
  }
  return out;
}

export function modulZustand(answers: IntakeAnswers | null | undefined): ModulZustand {
  const raw = answers?.module;
  if (!raw || typeof raw !== "object") return emptyModulZustand();
  const check =
    raw.check && typeof raw.check === "object" ? raw.check : emptyModulZustand().check;
  return {
    ...emptyModulZustand(),
    ...raw,
    check,
    status: modulStatusMap(raw.status),
  };
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

/** Schlanke Branchenvorlagen-Vorschläge für das Intake (ohne Muster-PDF-Volumen). */
const VORLAGE_VALUES: Record<string, Record<string, Record<string, unknown>>> = {
  dienstleister: {
    UO02: { kunden: ["Geschäftskunden (B2B)"], taetigkeiten: "B2B-Beratung und Projektleistungen, Abschläge/Schluss, keine Kasse/Lager" },
    UO03: { organigramm: "ja" },
    AR01: { nummernkreis: "Fortlaufend je Geschäftsjahr" },
    AR04: { abschlaege: "Abschläge bei Projekten, Schlussrechnung mit Bezug" },
    ER01: { formate: ["PDF", "ZUGFeRD", "XRechnung"] },
    BU07: { umfang: "FiBu, USt-Voranmeldung, Jahresabschluss, Lohn" },
    AF01: { zuordnung: "Buchungsbelege 10 Jahre, Handelsbriefe 6 Jahre (§ 147 Abs. 1, 3 AO)" },
  },
  handel: {
    UO02: { kunden: ["Privatkunden (B2C)", "Geschäftskunden (B2B)"], taetigkeiten: "Einzel-/Großhandel mit Kasse und Lager" },
    KA01: { kassenart: "Elektronisches Kassensystem mit TSE" },
    WW01: { system: "Warenwirtschaft (fiktiv)" },
    AF01: { zuordnung: "Buchungsbelege 10 Jahre, Handelsbriefe 6 Jahre (§ 147 Abs. 1, 3 AO)" },
  },
  ecommerce: {
    UO02: { kunden: ["Privatkunden (B2C)"], taetigkeiten: "Onlineshop und Marktplätze" },
    EC01: { kanaele: ["Eigener Onlineshop", "Marktplatz"] },
    EC02: { system: "Shopify (fiktiv)" },
    ZD01: { anbieter: "Zahlungsdienstleister / Kreditkarte (fiktiv)" },
    AF01: { zuordnung: "Buchungsbelege 10 Jahre, Handelsbriefe 6 Jahre (§ 147 Abs. 1, 3 AO)" },
  },
  gastro: {
    UO02: { kunden: ["Privatkunden (B2C)"], taetigkeiten: "Gastronomie / Hotel mit Tagesgeschäft und Veranstaltungen" },
    KA01: { kassenart: "Elektronisches Kassensystem mit TSE", system: "Kassensystem mit Cloud-TSE (fiktiv)" },
    BS01: { art: ["Gastronomie / Hotel"], vorgaenge: "Kasse/TSE, Wareneinkauf Küche, Personalzeiten, Kartenzahlung" },
    ZD01: { anbieter: "Kartenterminal / Zahlungsdienstleister (fiktiv)" },
    AF01: { zuordnung: "Buchungsbelege 10 Jahre, Handelsbriefe 6 Jahre (§ 147 Abs. 1, 3 AO)" },
  },
  handwerk: {
    UO02: { kunden: ["Geschäftskunden (B2B)", "Privatkunden (B2C)"], taetigkeiten: "Handwerk / Bau mit Projekten, Abschlägen und Material" },
    BS01: { art: ["Handwerk / Bau"], vorgaenge: "Bauprojekte, Aufmaß, Abschläge/Schluss, Material, Nachunternehmer" },
    AR04: { abschlaege: "Abschläge nach Fortschritt, Schlussrechnung mit Bezug" },
    AN01: { system: "Anlagenverzeichnis (fiktiv)" },
    AF01: { zuordnung: "Buchungsbelege 10 Jahre, Handelsbriefe 6 Jahre (§ 147 Abs. 1, 3 AO)" },
  },
};

export function setVorlage(answers: IntakeAnswers, vorlageId: string): IntakeAnswers {
  const vorlage = BRANCHEN_VORLAGEN.find((item) => item.id === vorlageId);
  if (!vorlage) return answers;
  const zustand = modulZustand(answers);
  let next: IntakeAnswers = {
    ...answers,
    module: {
      ...zustand,
      vorlage: vorlage.id,
      check: { ...zustand.check, ...vorlage.check },
    },
  };
  const vorschlaege = VORLAGE_VALUES[vorlage.id];
  if (vorschlaege) next = applyVorlageVorschlaege(next, vorschlaege);
  return next;
}

/** Branchenvorlagen-Vorschläge in leere Katalogfelder schreiben (ohne Status zu setzen). */
export function applyVorlageVorschlaege(
  answers: IntakeAnswers,
  vorschlaege: Record<string, Record<string, unknown>>,
): IntakeAnswers {
  if (!Object.keys(vorschlaege).length) return answers;
  const katalog = { ...(answers.katalog ?? {}) };
  for (const [qid, values] of Object.entries(vorschlaege)) {
    const current = katalog[qid] ?? {};
    const merged = { ...(current.values ?? {}) };
    for (const [key, value] of Object.entries(values)) {
      const existing = merged[key];
      const empty =
        existing == null ||
        existing === "" ||
        (Array.isArray(existing) && existing.length === 0);
      if (empty) merged[key] = value;
    }
    katalog[qid] = { ...current, values: merged };
  }
  return { ...answers, katalog };
}

function presetValueEmpty(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/**
 * Kopien, die der Klick danach über die Stammdaten in den Katalog schreibt.
 * Steht der Text noch genauso da, geht er mit dem Stammdatenwert wieder weg.
 */
const STAMM_KATALOG_KOPIEN: Partial<Record<keyof Stammdaten, Array<[string, string]>>> = {
  shop: [["A01", "onlineShop"]],
  kasse: [
    ["KA01", "system"],
    ["A01", "gastroKasse"],
  ],
};

function stableValue(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableValue).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([key, item]) => `${key}:${stableValue(item)}`).join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

function sameToken(left: unknown, right: unknown): boolean {
  if (typeof left === "string" && typeof right === "string") return left.trim() === right.trim();
  if (left && right && typeof left === "object" && typeof right === "object" && !Array.isArray(left) && !Array.isArray(right)) {
    const preset = right as Record<string, unknown>;
    const row = left as Record<string, unknown>;
    for (const key of Object.keys(preset)) {
      if (!sameToken(row[key], preset[key])) return false;
    }
    for (const [key, item] of Object.entries(row)) {
      if (key in preset) continue;
      if (item == null || item === "" || (Array.isArray(item) && item.length === 0)) continue;
      return false;
    }
    return true;
  }
  return stableValue(left) === stableValue(right);
}

function insertedTokens(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [value];
}

function blankValue(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/** Nimmt ein unverändertes Vorlagen-Token aus einem Text, einer Liste oder einer Kommaliste. */
function withoutToken(stored: unknown, token: unknown): unknown {
  if (Array.isArray(stored)) return stored.filter((item) => !sameToken(item, token));
  if (typeof stored === "string" && typeof token === "string") {
    const parts = stored.split(",");
    if (parts.length > 1) {
      const kept = parts.map((part) => part.trim()).filter((part) => part && part !== token.trim());
      if (!parts.some((part) => part.trim() === token.trim())) return stored;
      return kept.join(", ");
    }
    if (stored.trim() === token.trim()) return "";
    return stored;
  }
  if (sameToken(stored, token)) return "";
  return stored;
}

function beitragFromPreset(preset: SoftwarePreset): SoftwareBeitrag {
  return {
    stammdaten: { ...(preset.stammdaten ?? {}) },
    katalog: Object.fromEntries(
      Object.entries(preset.values).map(([qid, fields]) => [qid, { ...fields }]),
    ),
  };
}

function fieldTokens(value: unknown): unknown[] {
  return insertedTokens(value).filter((token) => !blankValue(token));
}

function otherPresetProvides(
  remaining: SoftwarePreset[],
  qid: string | null,
  key: string,
  token: unknown,
): boolean {
  for (const preset of remaining) {
    if (!qid) {
      const value = preset.stammdaten?.[key as keyof Stammdaten];
      if (typeof value === "string" && sameToken(value, token)) return true;
      continue;
    }
    const field = preset.values[qid]?.[key];
    if (field == null) continue;
    if (fieldTokens(field).some((item) => sameToken(item, token))) return true;
  }
  return false;
}

function rememberToken(
  map: Record<string, SoftwareBeitrag>,
  presetId: string,
  qid: string | null,
  key: string,
  token: unknown,
): void {
  const current = map[presetId] ?? {};
  if (!qid) {
    const stamm = { ...(current.stammdaten ?? {}) };
    const stammKey = key as keyof Stammdaten;
    if (!stamm[stammKey]) stamm[stammKey] = String(token);
    map[presetId] = { ...current, stammdaten: stamm };
    return;
  }
  const katalog = { ...(current.katalog ?? {}) };
  const fields = { ...(katalog[qid] ?? {}) };
  fields[key] = storeToken(fields[key], token);
  katalog[qid] = fields;
  map[presetId] = { ...current, katalog };
}

function storeToken(current: unknown, token: unknown): unknown {
  if (blankValue(current)) return typeof token === "object" && token ? [token] : token;
  if (Array.isArray(current)) {
    if (current.some((item) => sameToken(item, token))) return current;
    return [...current, token];
  }
  if (sameToken(current, token)) return current;
  return current;
}

function readKatalogField(katalog: IntakeAnswers["katalog"], qid: string, key: string): unknown {
  return katalog?.[qid]?.values?.[key];
}

function writeKatalogField(
  katalog: NonNullable<IntakeAnswers["katalog"]>,
  qid: string,
  key: string,
  value: unknown,
): void {
  const entry = katalog[qid] ?? {};
  const values = { ...(entry.values ?? {}) };
  if (blankValue(value)) delete values[key];
  else values[key] = value;
  katalog[qid] = { ...entry, values };
}

function stripTokenFromField(stored: unknown, token: unknown): unknown {
  return withoutToken(stored, token);
}

/**
 * Vorlage wählen oder, wenn sie schon gewählt ist, wieder abwählen.
 * Abwählen entfernt nur, was diese Vorlage selbst eingetragen hat und
 * was noch unverändert dasteht. Ein bearbeiteter Text und fremde Einträge
 * in derselben Liste bleiben. Liefert eine andere noch gewählte Vorlage
 * denselben Wert, bleibt er stehen.
 */
export function toggleSoftwarePreset(answers: IntakeAnswers, presetId: string): IntakeAnswers {
  const preset = SOFTWARE_PRESETS.find((item) => item.id === presetId);
  if (!preset) return answers;
  const zustand = modulZustand(answers);
  const current = zustand.software ?? [];
  if (current.includes(preset.id)) return removeSoftwarePreset(answers, preset);
  return applySoftwarePreset(answers, preset.id);
}

function removeSoftwarePreset(answers: IntakeAnswers, preset: SoftwarePreset): IntakeAnswers {
  const zustand = modulZustand(answers);
  const remainingIds = (zustand.software ?? []).filter((id) => id !== preset.id);
  const remaining = SOFTWARE_PRESETS.filter((item) => remainingIds.includes(item.id));
  const beitraege: Record<string, SoftwareBeitrag> = { ...(zustand.softwareBeitraege ?? {}) };
  const known = Object.prototype.hasOwnProperty.call(beitraege, preset.id);
  const contribution = known ? (beitraege[preset.id] ?? {}) : beitragFromPreset(preset);
  const stamm = { ...(zustand.stammdaten ?? {}) };
  const katalog = { ...(answers.katalog ?? {}) };

  const dropOrKeep = (qid: string | null, key: string, token: unknown, read: () => unknown, write: (value: unknown) => void) => {
    const stored = read();
    if (blankValue(stored) || blankValue(token)) return;
    const next = stripTokenFromField(stored, token);
    if (stableValue(next) === stableValue(stored)) return;
    if (otherPresetProvides(remaining, qid, key, token)) {
      const owner = remaining[0];
      if (owner) rememberToken(beitraege, owner.id, qid, key, token);
      return;
    }
    write(next);
  };

  for (const [key, value] of Object.entries(contribution.stammdaten ?? {})) {
    if (typeof value !== "string") continue;
    dropOrKeep(
      null,
      key,
      value,
      () => stamm[key as keyof Stammdaten],
      (next) => {
        const stammKey = key as keyof Stammdaten;
        if (blankValue(next)) {
          const successor = remaining.find((item) => item.stammdaten?.[stammKey]?.trim());
          const replacement = successor?.stammdaten?.[stammKey]?.trim() ?? "";
          if (replacement && successor) {
            stamm[stammKey] = replacement;
            rememberToken(beitraege, successor.id, null, stammKey, replacement);
          } else {
            delete stamm[stammKey];
          }
          for (const [copyId, field] of STAMM_KATALOG_KOPIEN[stammKey] ?? []) {
            const stored = readKatalogField(katalog, copyId, field);
            if (!sameToken(stored, value)) continue;
            writeKatalogField(katalog, copyId, field, replacement);
          }
        } else {
          stamm[stammKey] = String(next);
        }
      },
    );
  }

  for (const [qid, fields] of Object.entries(contribution.katalog ?? {})) {
    for (const [key, value] of Object.entries(fields)) {
      for (const token of fieldTokens(value)) {
        dropOrKeep(
          qid,
          key,
          token,
          () => readKatalogField(katalog, qid, key),
          (next) => writeKatalogField(katalog, qid, key, next),
        );
      }
    }
  }

  delete beitraege[preset.id];
  return {
    ...answers,
    katalog,
    module: {
      ...zustand,
      software: remainingIds,
      stammdaten: stamm,
      softwareBeitraege: Object.keys(beitraege).length ? beitraege : undefined,
    },
  };
}

export function applySoftwarePreset(answers: IntakeAnswers, presetId: string): IntakeAnswers {
  const preset = SOFTWARE_PRESETS.find((item) => item.id === presetId);
  if (!preset) return answers;
  const zustand = modulZustand(answers);
  const software = Array.from(new Set([...(zustand.software ?? []), preset.id]));
  const stamm = { ...(zustand.stammdaten ?? {}) };
  const written: SoftwareBeitrag = { stammdaten: {}, katalog: {} };
  for (const [key, value] of Object.entries(preset.stammdaten ?? {})) {
    const current = stamm[key as keyof Stammdaten];
    if (!String(current ?? "").trim() && value) {
      stamm[key as keyof Stammdaten] = value;
      written.stammdaten![key as keyof Stammdaten] = value;
    }
  }
  let next: IntakeAnswers = {
    ...answers,
    module: { ...zustand, software, stammdaten: stamm },
  };
  const katalog = { ...(next.katalog ?? {}) };
  for (const [qid, values] of Object.entries(preset.values)) {
    const current = katalog[qid] ?? {};
    const merged = { ...(current.values ?? {}) };
    for (const [key, value] of Object.entries(values)) {
      if (key === "systeme" && Array.isArray(value)) {
        if (value.every((item) => typeof item === "string")) {
          const wanted = value.map((item) => item.trim()).filter(Boolean);
          const existing = merged.systeme;
          const currentTokens = Array.isArray(existing)
            ? existing.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean)
            : typeof existing === "string"
              ? existing.split(",").map((item) => item.trim()).filter(Boolean)
              : [];
          const additions = wanted.filter((item) => !currentTokens.includes(item));
          if (!currentTokens.length) {
            if (wanted.length) {
              merged.systeme = wanted;
              written.katalog![qid] = { ...(written.katalog![qid] ?? {}), systeme: wanted };
            }
          } else if (additions.length) {
            const combined = [...currentTokens, ...additions];
            merged.systeme = typeof existing === "string" ? combined.join(", ") : combined;
            written.katalog![qid] = { ...(written.katalog![qid] ?? {}), systeme: additions };
          }
          continue;
        }
        const existing = Array.isArray(merged.systeme)
          ? (merged.systeme as Record<string, unknown>[])
          : [];
        const named = existing.filter((row) => String(row.name ?? "").trim());
        const names = new Set(named.map((row) => String(row.name ?? "").trim()));
        const additions = (value as Record<string, unknown>[]).filter((row) => {
          const rowName = String(row.name ?? "").trim();
          return rowName && !names.has(rowName);
        });
        if (!named.length) {
          merged.systeme = value;
          written.katalog![qid] = { ...(written.katalog![qid] ?? {}), systeme: value };
        } else if (additions.length) {
          merged.systeme = [...named, ...additions];
          written.katalog![qid] = { ...(written.katalog![qid] ?? {}), systeme: additions };
        }
        continue;
      }
      if (presetValueEmpty(merged[key])) {
        merged[key] = value;
        written.katalog![qid] = { ...(written.katalog![qid] ?? {}), [key]: value };
      }
    }
    katalog[qid] = { ...current, values: merged };
  }
  const beitraege = { ...(zustand.softwareBeitraege ?? {}), [preset.id]: written };
  next = {
    ...next,
    katalog,
    module: { ...next.module!, softwareBeitraege: beitraege },
  };
  return next;
}

/**
 * True when a catalog field may still receive a Stammdaten value: it is empty,
 * or it still holds the previous automatic text. A different stored value was
 * typed or saved and stays.
 */
function untouchedPrefill(current: unknown, prior: string | undefined): boolean {
  if (current == null) return true;
  if (typeof current !== "string") return false;
  const text = current.trim();
  if (!text) return true;
  const before = prior?.trim() ?? "";
  return Boolean(before) && text === before;
}

/** Markierung der B01-Karte, die das FiBu-Feld selbst angelegt hat. */
const FIBU_FELD_KARTE = "fibu";

const STAMM_TEXT_FELDER: Array<{ key: keyof FeldSync; fields: Array<[string, string]> }> = [
  { key: "kasse", fields: [["KA01", "system"], ["A01", "gastroKasse"]] },
  { key: "shop", fields: [["EC02", "system"], ["A01", "onlineShop"]] },
  { key: "lohn", fields: [["LO01", "system"]] },
  { key: "warenwirtschaft", fields: [["WW01", "system"], ["A01", "onlineWawi"]] },
  { key: "bank", fields: [["BA01", "konten"]] },
];

/**
 * Die Karte des FiBu-Felds anlegen, umbenennen oder entfernen.
 * Vorlagen- und Handkarten (ohne Markierung) bleiben stehen.
 * Trifft der Text den Namen einer solchen Karte, entfällt die eigene Karte,
 * damit nichts doppelt steht. Gibt null zurück, wenn nichts zu ändern ist.
 */
export function syncFibuSystems(
  systems: Record<string, unknown>[],
  name: string,
  defaults: { funktion: string; typ: string } = { funktion: "Finanzbuchhaltung", typ: "fibu" },
): Record<string, unknown>[] | null {
  const trimmed = name.trim();
  const owned = systems.filter((row) => row.vonFeld === FIBU_FELD_KARTE);
  const nameTaken = (target: string) =>
    systems.some((row) => row.vonFeld !== FIBU_FELD_KARTE && String(row.name ?? "").trim() === target);

  if (!trimmed) {
    if (!owned.length) return null;
    return systems.filter((row) => row.vonFeld !== FIBU_FELD_KARTE);
  }
  if (nameTaken(trimmed)) {
    if (!owned.length) return null;
    return systems.filter((row) => row.vonFeld !== FIBU_FELD_KARTE);
  }
  const last = owned.length ? owned[owned.length - 1] : undefined;
  if (last) {
    if (String(last.name ?? "").trim() === trimmed && owned.length === 1) return null;
    return systems.flatMap((row) => {
      if (row.vonFeld !== FIBU_FELD_KARTE) return [row];
      if (row !== last) return [];
      return [{ ...row, name: trimmed, vonFeld: FIBU_FELD_KARTE }];
    });
  }
  return [...systems, { name: trimmed, funktion: defaults.funktion, typ: defaults.typ, vonFeld: FIBU_FELD_KARTE }];
}

function catalogText(katalog: IntakeAnswers["katalog"], qid: string, key: string): string {
  const value = katalog?.[qid]?.values?.[key];
  return typeof value === "string" ? value.trim() : "";
}

function writeCatalogText(
  katalog: NonNullable<IntakeAnswers["katalog"]>,
  qid: string,
  key: string,
  value: string,
): void {
  const entry = katalog[qid] ?? {};
  const values = { ...(entry.values ?? {}) };
  if (!value) delete values[key];
  else values[key] = value;
  katalog[qid] = { ...entry, values };
}

/** Kasse, Shop, Lohn, Warenwirtschaft und Bank in ihre Textfelder spiegeln. */
function syncStammTexts(
  katalog: NonNullable<IntakeAnswers["katalog"]>,
  stamm: Partial<Stammdaten>,
  previous: FeldSync | undefined,
): FeldSync {
  const sync: FeldSync = {};
  for (const { key, fields } of STAMM_TEXT_FELDER) {
    const trimmed = stamm[key]?.trim() ?? "";
    const recorded = previous?.[key] ?? {};
    const nextRecord: Record<string, string> = {};
    for (const [qid, field] of fields) {
      const id = `${qid}.${field}`;
      const entry = katalog[qid];
      const current = catalogText(katalog, qid, field);
      const written = recorded[id];
      if (current === trimmed && trimmed) {
        nextRecord[id] = trimmed;
        continue;
      }
      if (written === undefined) {
        if (!trimmed || current) continue;
        if (entry?.cleared?.includes(field)) continue;
        writeCatalogText(katalog, qid, field, trimmed);
        nextRecord[id] = trimmed;
        continue;
      }
      if (current && current !== written) continue;
      if (!current && entry?.cleared?.includes(field) && written === trimmed) continue;
      writeCatalogText(katalog, qid, field, trimmed);
      if (trimmed) nextRecord[id] = trimmed;
    }
    if (Object.keys(nextRecord).length) sync[key] = nextRecord;
  }
  return sync;
}

/** Stammdaten in leere oder noch unveränderte Katalogfelder schreiben. */
export function applyStammdatenPrefill(
  answers: IntakeAnswers,
  previous?: Partial<Stammdaten>,
): IntakeAnswers {
  const s = modulZustand(answers).stammdaten;
  if (!s) return answers;
  const katalog = { ...(answers.katalog ?? {}) };
  const fill = (id: string, key: string, value: string | undefined, prior?: string) => {
    const trimmed = value?.trim() ?? "";
    if (!trimmed) return;
    const entry = katalog[id] ?? {};
    const values = { ...(entry.values ?? {}) };
    if (entry.cleared?.includes(key)) return;
    if (!untouchedPrefill(values[key], prior)) return;
    if (typeof values[key] === "string" && values[key].trim() === trimmed) return;
    values[key] = trimmed;
    katalog[id] = { ...entry, values };
  };
  fill("A01", "gf", s.gf, previous?.gf);
  fill("F01", "buchhaltung", s.buchhaltung, previous?.buchhaltung);
  fill("B01", "it", s.it, previous?.it);
  fill("F05", "kanzleiName", s.kanzlei, previous?.kanzlei);
  fill("G01", "ablage", s.archiv, previous?.archiv);
  const entry = katalog.B01 ?? {};
  const values = { ...(entry.values ?? {}) };
  const systems = Array.isArray(values.systeme) ? (values.systeme as Record<string, unknown>[]) : [];
  const nextSystems = syncFibuSystems(systems, s.fibu ?? "");
  if (nextSystems) {
    values.systeme = nextSystems;
    katalog.B01 = { ...entry, values };
  }
  const feldSync = syncStammTexts(katalog, s, modulZustand(answers).feldSync);
  return {
    ...answers,
    katalog,
    module: {
      ...modulZustand(answers),
      feldSync: Object.keys(feldSync).length ? feldSync : undefined,
    },
  };
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
        ? [
            eintrag.ref,
            eintrag.link,
            eintrag.uploadName
              ? `Datei: ${eintrag.uploadName}${
                  typeof eintrag.uploadAt === "string" && eintrag.uploadAt
                    ? ` (${eintrag.uploadAt.slice(0, 10)})`
                    : ""
                }`
              : "",
          ]
            .filter(Boolean)
            .join(" · ")
        : eintrag.status === "nicht_vorhanden"
          ? eintrag.reason ?? ""
          : eintrag.status === "offen"
            ? `Offener Punkt: Status „${STATUS_LABEL.offen}“.`
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
