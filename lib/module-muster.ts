/**
 * Muster-Gesamtdokumente je Branchenvorlage (fiktiv).
 */
import { BEREICH_ZU_MODUL, MODULE } from "@/lib/module/katalog";
import {
  BRANCHEN_VORLAGEN,
  ensureGesamt,
  setVorlage,
} from "@/lib/module/status";
import {
  PARTNER_MUSTER_ANSWERS,
  PARTNER_MUSTER_DOCUMENT_ID,
  PARTNER_MUSTER_IDENTITY,
  PARTNER_MUSTER_VERSION_META,
} from "@/lib/partner-muster";
import type { IntakeAnswers } from "@/lib/types";

export const MUSTER_VORLAGEN = ["dienstleister", "handel", "ecommerce"] as const;
export type MusterVorlageId = (typeof MUSTER_VORLAGEN)[number];

export function isMusterVorlage(id: string): id is MusterVorlageId {
  return (MUSTER_VORLAGEN as readonly string[]).includes(id);
}

/** Legacy Bereich → Gesamtmuster-Vorlage (Redirect-Ziel). */
export const BEREICH_ZU_VORLAGE: Record<string, MusterVorlageId> = {
  belegfluss: "dienstleister",
  kasse: "handel",
  warenwirtschaft: "handel",
  einkauf: "handel",
  verkauf: "dienstleister",
  retouren: "ecommerce",
  zeiterfassung: "dienstleister",
  lohn: "dienstleister",
  ecommerce: "ecommerce",
  bank: "handel",
  anlagen: "dienstleister",
  vorsystem: "dienstleister",
};

export function gesamtMusterPath(vorlage: string): string {
  return `/muster/gesamt/${vorlage}`;
}
export function gesamtMusterPdfPath(vorlage: string): string {
  return `/muster/gesamt/${vorlage}/pdf`;
}
export function gesamtMusterFragebogenPath(vorlage: string): string {
  return `/muster/gesamt/${vorlage}/fragebogen`;
}
export function modulMusterFragebogenPath(modulId: string): string {
  return `/muster/modul/${modulId}/fragebogen`;
}

function baseAnswers(vorlage: MusterVorlageId): IntakeAnswers {
  let answers = ensureGesamt({ ...PARTNER_MUSTER_ANSWERS });
  answers = setVorlage(answers, vorlage);
  // Prefill a few confirmed facts so the Muster PDF has present-tense content.
  const katalog = { ...(answers.katalog ?? {}) };
  const mark = (id: string, values: Record<string, unknown>) => {
    katalog[id] = { status: "bestaetigt", values: { ...(katalog[id]?.values ?? {}), ...values } };
  };
  mark("A01", {
    company: PARTNER_MUSTER_IDENTITY.company,
    gf: PARTNER_MUSTER_ANSWERS.gf,
    branchen: PARTNER_MUSTER_ANSWERS.branchen,
    rechtsform: PARTNER_MUSTER_ANSWERS.rechtsform,
    mitarbeitende: PARTNER_MUSTER_ANSWERS.mitarbeitende,
    standort: "Berlin (fiktiv)",
  });
  mark("UO01", { gesellschaften: `${PARTNER_MUSTER_IDENTITY.company} (fiktiv)`, standorte: "Berlin" });
  mark("UO02", { taetigkeiten: PARTNER_MUSTER_ANSWERS.branchen.join(", "), kunden: ["Geschäftskunden (B2B)"] });
  mark("B01", {
    systeme: [{ name: "DATEV", funktion: "Finanzbuchhaltung", typ: "fibu" }],
    hosting: "Cloud (Anbieter DE/EU)",
    it: PARTNER_MUSTER_ANSWERS.it,
  });
  if (vorlage === "handel") {
    mark("KA01", { art: "Elektronische Registrierkasse / POS (fiktiv)" });
    mark("WW01", { system: "Warenwirtschaft (fiktiv)" });
  }
  if (vorlage === "ecommerce") {
    mark("EC01", { kanaele: ["Eigener Onlineshop", "Marktplatz"] });
    mark("EC02", { system: "Shopify (fiktiv)" });
  }
  return { ...answers, katalog };
}

export function getGesamtMuster(vorlage: string) {
  if (!isMusterVorlage(vorlage)) return undefined;
  const meta = BRANCHEN_VORLAGEN.find((item) => item.id === vorlage)!;
  const answers = baseAnswers(vorlage);
  return {
    vorlage,
    label: meta.label,
    answers,
    identity: PARTNER_MUSTER_IDENTITY,
    documentId: `${PARTNER_MUSTER_DOCUMENT_ID}-gesamt-${vorlage}`,
    version: 1,
    versionMeta: PARTNER_MUSTER_VERSION_META,
    versionHistory: [] as [],
    steckbrief: `Fiktives Gesamtdokument für die Vorlage „${meta.label}“. Betriebs-Check und Module sind beispielhaft vorbelegt.`,
    facts: [
      ["Unternehmen", `${PARTNER_MUSTER_IDENTITY.company} (fiktiv)`],
      ["Vorlage", meta.label],
      ["Module", String(MODULE.length)],
      ["Fassung", "1.0 (Muster)"],
    ] as Array<[string, string]>,
  };
}

/** Redirect target for a legacy Bereich-Muster URL. */
export function redirectForBereichMuster(bereich: string): string {
  const vorlage = BEREICH_ZU_VORLAGE[bereich] ?? "dienstleister";
  const modulId = BEREICH_ZU_MODUL[bereich];
  const base = gesamtMusterPath(vorlage);
  return modulId ? `${base}#${modulId}` : base;
}

export function getModulMuster(modulId: string) {
  const modul = MODULE.find((item) => item.id === modulId);
  if (!modul) return undefined;
  const vorlage: MusterVorlageId =
    modul.trigger === "bargeld" || modul.trigger === "lager"
      ? "handel"
      : modul.trigger === "online"
        ? "ecommerce"
        : "dienstleister";
  const gesamt = getGesamtMuster(vorlage)!;
  return { modul, vorlage, answers: gesamt.answers, identity: gesamt.identity, steckbrief: gesamt.steckbrief, facts: gesamt.facts };
}
