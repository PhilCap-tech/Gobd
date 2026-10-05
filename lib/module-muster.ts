/**
 * Muster-Gesamtdokumente je Branchenvorlage (fiktiv, angereichert).
 */
import { BEREICH_ZU_MODUL, MODULE } from "@/lib/module/katalog";
import { buildDenseGesamtAnswers, MUSTER_FIRMEN } from "@/lib/module-muster-dense";
import { BRANCHEN_VORLAGEN } from "@/lib/module/status";
import {
  PARTNER_MUSTER_DOCUMENT_ID,
  PARTNER_MUSTER_IDENTITY,
  PARTNER_MUSTER_VERSION_META,
} from "@/lib/partner-muster";
import type { CheckoutIdentity } from "@/lib/types";
import type { VersionHistoryEntry } from "@/lib/versioning";

export const MUSTER_VORLAGEN = [
  "dienstleister",
  "handel",
  "ecommerce",
  "gastro",
  "handwerk",
] as const;
export type MusterVorlageId = (typeof MUSTER_VORLAGEN)[number];

export function isMusterVorlage(id: string): id is MusterVorlageId {
  return (MUSTER_VORLAGEN as readonly string[]).includes(id);
}

/** Legacy Bereich → Gesamtmuster-Vorlage (Redirect-Ziel). */
export const BEREICH_ZU_VORLAGE: Record<string, MusterVorlageId> = {
  belegfluss: "dienstleister",
  kasse: "gastro",
  warenwirtschaft: "handel",
  einkauf: "handel",
  verkauf: "dienstleister",
  retouren: "ecommerce",
  zeiterfassung: "handwerk",
  lohn: "handwerk",
  ecommerce: "ecommerce",
  bank: "handel",
  anlagen: "handwerk",
  vorsystem: "handwerk",
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

export function getGesamtMuster(vorlage: string) {
  if (!isMusterVorlage(vorlage)) return undefined;
  const meta = BRANCHEN_VORLAGEN.find((item) => item.id === vorlage)!;
  const firma = MUSTER_FIRMEN[vorlage];
  const answers = buildDenseGesamtAnswers(vorlage);
  const identity: CheckoutIdentity = {
    ...PARTNER_MUSTER_IDENTITY,
    company: firma.company,
    email: `muster@${firma.domain}`,
  };
  return {
    vorlage,
    label: meta.label,
    answers,
    identity,
    documentId: `${PARTNER_MUSTER_DOCUMENT_ID}-gesamt-${vorlage}`,
    version: 3,
    versionMeta: {
      ...PARTNER_MUSTER_VERSION_META,
      validFrom: "01.07.2026",
      changeSummary:
        "Angereicherte Musterfassung (5 Vorlagen): aktive Module mit Ist-Beschreibung, Kontrollen und Aufbewahrung (§ 147 AO).",
      changedBy: firma.gf,
    },
    versionHistory: [
      {
        version: "1.0",
        validFrom: "01.01.2026",
        validTo: "30.06.2026",
        changeSummary: "Erstfassung Gesamtdokument (dünne Musterantwort)",
        changedBy: firma.gf,
      },
      {
        version: "2.0",
        validFrom: "01.07.2026",
        validTo: "04.10.2026",
        changeSummary: "Anreicherung Dienstleister/Handel/E-Commerce",
        changedBy: firma.gf,
      },
    ] as VersionHistoryEntry[],
    steckbrief: `${firma.company}: fiktives Gesamtdokument zur Vorlage „${meta.label}“ am Standort ${firma.standort}. Betriebs-Check und alle aktiven Module sind beispielhaft ausgefüllt; offene Punkte sind absichtlich enthalten.`,
    facts: [
      ["Unternehmen", firma.company],
      ["Standort", firma.standort],
      ["Vorlage", meta.label],
      ["Branche", firma.branche],
      ["Module", String(MODULE.length)],
      ["Fassung", "3.0 (Muster, angereichert)"],
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
    modul.trigger === "bargeld"
      ? "gastro"
      : modul.trigger === "lager"
        ? "handel"
        : modul.trigger === "personal" || modul.trigger === "branche" || modul.trigger === "anlagen"
          ? "handwerk"
          : modul.trigger === "online"
            ? "ecommerce"
            : "dienstleister";
  const gesamt = getGesamtMuster(vorlage)!;
  return {
    modul,
    vorlage,
    answers: gesamt.answers,
    identity: gesamt.identity,
    steckbrief: gesamt.steckbrief,
    facts: gesamt.facts,
  };
}
