/**
 * Sechs Pflichtfragen und Zuordnung auf die bestehenden Branchenvorlagen
 * (MUSTER_VORLAGEN). Freiberuf und Sonstiges nutzen dienstleister.
 */

import { MUSTER_FIRMEN } from "@/lib/module-muster-dense";
import { getGesamtMuster, type MusterVorlageId } from "@/lib/module-muster";
import { BRANCHEN_VORLAGEN, setCheckAntwort, setModulEintrag } from "@/lib/module/status";
import { standardFall } from "@/lib/schnellversion-bausteine";
import type { CheckoutIdentity, IntakeAnswers } from "@/lib/types";

export const SV_RECHTSFORMEN = [
  "Einzelunternehmen",
  "GbR",
  "UG",
  "GmbH",
  "AG",
  "Sonstiges",
] as const;

export const SV_BRANCHEN = [
  { id: "handwerk", label: "Handwerk / Bau", vorlage: "handwerk" },
  { id: "handel", label: "Handel mit Ladengeschäft oder Marktstand", vorlage: "handel" },
  { id: "ecommerce", label: "Onlinehandel / Marktplätze", vorlage: "ecommerce" },
  { id: "gastro", label: "Gastronomie", vorlage: "gastro" },
  { id: "dienstleistung", label: "Dienstleistung", vorlage: "dienstleister" },
  { id: "freiberuf", label: "Freiberufliche Tätigkeit", vorlage: "dienstleister" },
  { id: "sonstiges", label: "Sonstiges", vorlage: "dienstleister" },
] as const;

export type SvBrancheId = (typeof SV_BRANCHEN)[number]["id"];

export const SV_MITARBEITENDE = ["1 (nur ich)", "2–5", "6–10", "11–20", "über 20"] as const;

export const SV_SOFTWARE = [
  "DATEV",
  "sevdesk",
  "lexoffice",
  "Excel / manuell",
  "Sonstiges",
  "Weiß ich nicht, macht die Kanzlei",
] as const;

export const SV_KASSE = [
  "Nein, keine Bargeldeinnahmen",
  "Ja, elektronische Kasse",
  "Ja, offene Ladenkasse (ohne elektronisches System)",
  "Unsicher",
] as const;

export const SV_BUCHT = [
  "Wir selbst im Unternehmen",
  "Unsere Steuerkanzlei",
  "Beides: Belege sammeln wir, die Kanzlei bucht",
] as const;

export type SchnellversionAnswers = {
  firma: string;
  rechtsform: (typeof SV_RECHTSFORMEN)[number];
  branche: SvBrancheId;
  mitarbeitende: (typeof SV_MITARBEITENDE)[number];
  software: (typeof SV_SOFTWARE)[number];
  softwareFrei: string;
  kasse: (typeof SV_KASSE)[number];
  bucht: (typeof SV_BUCHT)[number];
};

const ANSWER_KEYS = [
  "firma",
  "rechtsform",
  "branche",
  "mitarbeitende",
  "software",
  "softwareFrei",
  "kasse",
  "bucht",
] as const;

function oneOf<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value);
}

export function parseSchnellversionAnswers(input: unknown): SchnellversionAnswers | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;
  for (const key of Object.keys(raw)) {
    if (!(ANSWER_KEYS as readonly string[]).includes(key)) return null;
  }
  const firma = typeof raw.firma === "string" ? raw.firma.trim() : "";
  if (!firma || firma.length > 120) return null;
  if (!oneOf(raw.rechtsform, SV_RECHTSFORMEN)) return null;
  if (!oneOf(raw.branche, SV_BRANCHEN.map((item) => item.id))) return null;
  if (!oneOf(raw.mitarbeitende, SV_MITARBEITENDE)) return null;
  if (!oneOf(raw.software, SV_SOFTWARE)) return null;
  if (!oneOf(raw.kasse, SV_KASSE)) return null;
  if (!oneOf(raw.bucht, SV_BUCHT)) return null;
  const softwareFrei = typeof raw.softwareFrei === "string" ? raw.softwareFrei.trim() : "";
  if (softwareFrei.length > 80) return null;
  if (raw.software === "Sonstiges" && !softwareFrei) return null;
  return {
    firma,
    rechtsform: raw.rechtsform,
    branche: raw.branche,
    mitarbeitende: raw.mitarbeitende,
    software: raw.software,
    softwareFrei,
    kasse: raw.kasse,
    bucht: raw.bucht,
  };
}

export function vorlageForBranche(id: SvBrancheId): MusterVorlageId {
  const row = SV_BRANCHEN.find((item) => item.id === id);
  return row?.vorlage ?? "dienstleister";
}

export function brancheLabel(id: SvBrancheId): string {
  return SV_BRANCHEN.find((item) => item.id === id)?.label ?? "";
}

export function vorlageLabel(id: MusterVorlageId): string {
  return BRANCHEN_VORLAGEN.find((item) => item.id === id)?.label ?? id;
}

export function softwareLabel(answers: Pick<SchnellversionAnswers, "software" | "softwareFrei">): string {
  if (answers.software === "Sonstiges") return answers.softwareFrei;
  return answers.software;
}

/** Kein Programmname: die Antwort nennt kein konkretes System. */
export function statedFibu(answers: Pick<SchnellversionAnswers, "software" | "softwareFrei">): string | null {
  if (answers.software === "Weiß ich nicht, macht die Kanzlei") return null;
  return softwareLabel(answers);
}

/** Fließtext. Die Rohantwort „Weiß ich nicht …“ und „Excel / manuell“ stehen so nicht im PDF. */
export function softwareProse(
  answers: Pick<SchnellversionAnswers, "software" | "softwareFrei"> & { bucht?: SchnellversionAnswers["bucht"] },
): string {
  return standardFall({
    software: answers.software,
    softwareFrei: answers.softwareFrei,
    bucht: answers.bucht ?? "Unsere Steuerkanzlei",
  }).name;
}

export function kasseHatKapitel(kasse: SchnellversionAnswers["kasse"]): boolean {
  return kasse !== "Nein, keine Bargeldeinnahmen";
}

/** Unsicher bleibt offen. Nur eine genannte Kasse ist Ja. */
export function kasseCheckAntwort(kasse: SchnellversionAnswers["kasse"]): "ja" | "nein" | "unbekannt" {
  if (kasse === "Nein, keine Bargeldeinnahmen") return "nein";
  if (kasse === "Unsicher") return "unbekannt";
  return "ja";
}

export function kanzleiBuchtAntwort(bucht: SchnellversionAnswers["bucht"]): boolean {
  return bucht !== "Wir selbst im Unternehmen";
}

function replaceToken(answers: IntakeAnswers, from: string, to: string): IntakeAnswers {
  if (!from || from === to) return answers;
  const encodedFrom = JSON.stringify(from).slice(1, -1);
  const encodedTo = JSON.stringify(to).slice(1, -1);
  return JSON.parse(JSON.stringify(answers).split(encodedFrom).join(encodedTo)) as IntakeAnswers;
}

export function buildStandardAnswers(input: SchnellversionAnswers): {
  answers: IntakeAnswers;
  identity: CheckoutIdentity;
  vorlage: MusterVorlageId;
} {
  const vorlage = vorlageForBranche(input.branche);
  const muster = getGesamtMuster(vorlage);
  if (!muster) {
    throw new Error("Branchenvorlage fehlt");
  }
  const firma = MUSTER_FIRMEN[vorlage];
  let answers = structuredClone(muster.answers);
  const self = !kanzleiBuchtAntwort(input.bucht);
  const tokens: Array<[string, string]> = [
    [firma.company, input.firma],
    [firma.gf, "die Geschäftsführung"],
    [firma.buchhaltung, "die Buchhaltung"],
    [firma.it, "die IT-Betreuung"],
    [firma.kanzlei, self ? "die Buchhaltung" : "die Kanzlei"],
    [firma.standort, "der Betriebssitz"],
    [firma.domain, "bitte-pruefen.invalid"],
  ];
  tokens.sort((a, b) => b[0].length - a[0].length);
  for (const [from, to] of tokens) answers = replaceToken(answers, from, to);
  answers.rechtsform = input.rechtsform;
  answers.mitarbeitende = input.mitarbeitende;
  answers.branchen = [brancheLabel(input.branche)];
  const program = statedFibu(input);
  const fall = standardFall(input);
  answers.fibu = program ? [fall.name] : [];
  const a01 = answers.katalog?.A01;
  if (a01) {
    answers.katalog = {
      ...answers.katalog,
      A01: {
        ...a01,
        values: {
          ...(a01.values ?? {}),
          company: input.firma,
          branchen: [brancheLabel(input.branche)],
          rechtsform: input.rechtsform,
          mitarbeitende: input.mitarbeitende,
          gf: "die Geschäftsführung",
          standort: "der Betriebssitz",
        },
      },
    };
  }
  const b01 = answers.katalog?.B01;
  const systeme = b01?.values?.systeme;
  if (b01 && Array.isArray(systeme) && systeme.length > 0) {
    const [first, ...rest] = systeme;
    const self = !kanzleiBuchtAntwort(input.bucht);
    const renamed =
      first && typeof first === "object"
        ? {
            ...(first as Record<string, unknown>),
            name: fall.name,
            funktion: self ? "Buchhaltung im Unternehmen" : "Buchhaltung der Kanzlei",
            originalOrt: fall.excel ? "Belegablage im Betrieb" : fall.kind === "unbekannt" && fall.self ? "im Unternehmen" : fall.kind === "unbekannt" ? "bei der Kanzlei" : fall.name,
            nutzer: "der Betrieb",
          }
        : first;
    answers.katalog = {
      ...answers.katalog,
      B01: { ...b01, values: { ...(b01.values ?? {}), systeme: [renamed, ...rest] } },
    };
  }
  answers.gf = "die Geschäftsführung";
  answers.buchhaltung = "die Buchhaltung";
  answers.it = "die IT-Betreuung";
  answers.steuerberater = self ? "" : "die Kanzlei";
  answers.geltung = "Der gesamte Betrieb im beschriebenen Umfang.";
  answers.geltungAusschluss = "Keine Bereiche ausgenommen.";
  const uo = answers.katalog?.UO06;
  answers.katalog = {
    ...answers.katalog,
    UO06: {
      status: "bestaetigt",
      values: {
        ...(uo?.values ?? {}),
        geltung: "Der gesamte Betrieb im beschriebenen Umfang.",
        ausgenommen: "Keine Bereiche ausgenommen.",
      },
    },
  };
  if (kasseHatKapitel(input.kasse)) {
    answers = setCheckAntwort(answers, "bargeld", kasseCheckAntwort(input.kasse));
    answers = setModulEintrag(answers, "m08", { status: "tool" });
  } else {
    answers = setCheckAntwort(answers, "bargeld", "nein");
    answers = setModulEintrag(answers, "m08", {
      status: "nicht_vorhanden",
      reason: "Keine Bargeldeinnahmen in den 6 Angaben.",
    });
  }
  if (!kanzleiBuchtAntwort(input.bucht)) {
    answers = setCheckAntwort(answers, "kanzlei", "nein");
    answers = replaceToken(answers, "FiBu der Kanzlei und Belegablage", "Buchhaltung im Unternehmen");
    answers = replaceToken(answers, "Abrechnung durch: Kanzlei", "Abrechnung im Unternehmen");
  }
  const identity: CheckoutIdentity = {
    ...muster.identity,
    company: input.firma,
    email: "",
    stripeSessionId: "",
    stripeCustomerId: "",
    stub: true,
  };
  delete identity.entityId;
  return { answers, identity, vorlage };
}
