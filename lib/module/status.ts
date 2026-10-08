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

/** Ein Satz je Option, du-Form, ohne Rechtsanspruch. */
export const STATUS_HILFE: Record<ModulStatus, string> = {
  tool: "Du beantwortest die Fragen zu diesem Modul hier; die Angaben erscheinen im Gesamt-PDF.",
  extern: "Du hast die Beschreibung schon und verlinkst oder lädst sie hier hoch.",
  offen: "Du hast noch nicht genug Infos (zum Beispiel, weil der Prozess unklar ist oder ein Mitarbeiter fehlt) und füllst das Modul später aus; es bleibt als offene Aufgabe sichtbar, bis du es beschreibst oder auf „nicht vorhanden“ setzt.",
  nicht_vorhanden: "Diesen Ablauf gibt es in deinem Betrieb nicht; du schließt ihn bewusst aus.",
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

export function applySoftwarePreset(answers: IntakeAnswers, presetId: string): IntakeAnswers {
  const preset = SOFTWARE_PRESETS.find((item) => item.id === presetId);
  if (!preset) return answers;
  const zustand = modulZustand(answers);
  const software = Array.from(new Set([...(zustand.software ?? []), preset.id]));
  const stamm = { ...(zustand.stammdaten ?? {}) };
  for (const [key, value] of Object.entries(preset.stammdaten ?? {})) {
    const current = stamm[key as keyof Stammdaten];
    if (!String(current ?? "").trim() && value) stamm[key as keyof Stammdaten] = value;
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
        const existing = Array.isArray(merged.systeme)
          ? (merged.systeme as Record<string, unknown>[])
          : [];
        const named = existing.filter((row) => String(row.name ?? "").trim());
        const names = new Set(named.map((row) => String(row.name ?? "").trim()));
        const additions = (value as Record<string, unknown>[]).filter((row) => {
          const name = String(row.name ?? "").trim();
          return name && !names.has(name);
        });
        if (!named.length) merged.systeme = value;
        else if (additions.length) merged.systeme = [...named, ...additions];
        continue;
      }
      if (presetValueEmpty(merged[key])) merged[key] = value;
    }
    katalog[qid] = { ...current, values: merged };
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
        ? [
            eintrag.ref,
            eintrag.link,
            eintrag.uploadName
              ? `Datei: ${eintrag.uploadName}${eintrag.uploadAt ? ` (${eintrag.uploadAt.slice(0, 10)})` : ""}`
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
