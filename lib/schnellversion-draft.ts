/**
 * Die 6 Angaben der Schnellversion werden in den bestehenden Fragebogen-Entwurf geschrieben.
 */

import { draftRevision, normalizeDraftKey, type IntakeDraft } from "@/lib/intake-draft-shared";
import {
  brancheLabel,
  kanzleiBuchtAntwort,
  kasseCheckAntwort,
  statedFibu,
  vorlageForBranche,
  type SchnellversionAnswers,
} from "@/lib/schnellversion-answers";
import { setCheckAntwort, setVorlage } from "@/lib/module/status";
import type { CheckAntwort, ModulZustand } from "@/lib/module/typen";
import { emptyAnswers } from "@/lib/types";

export function draftFromSchnellversion(email: string, input: SchnellversionAnswers): IntakeDraft {
  const mail = email.trim().toLowerCase();
  let answers = setVorlage(emptyAnswers(), vorlageForBranche(input.branche));
  answers.branchen = [brancheLabel(input.branche)];
  answers.rechtsform = input.rechtsform;
  answers.mitarbeitende = input.mitarbeitende;
  const program = statedFibu(input);
  answers.fibu = program ? [program] : [];
  answers.steuerberater = kanzleiBuchtAntwort(input.bucht) ? "Steuerkanzlei" : "";
  answers = setCheckAntwort(answers, "bargeld", kasseCheckAntwort(input.kasse));
  answers = setCheckAntwort(answers, "kanzlei", kanzleiBuchtAntwort(input.bucht) ? "ja" : "nein");
  const moduleState = answers.module;
  if (moduleState) {
    answers = {
      ...answers,
      module: {
        ...moduleState,
        stammdaten: { ...moduleState.stammdaten, fibu: program ?? "" },
      },
    };
  }
  answers.katalog = {
    A01: {
      status: "bestaetigt",
      values: {
        company: input.firma,
        branchen: [brancheLabel(input.branche)],
        rechtsform: input.rechtsform,
        mitarbeitende: input.mitarbeitende,
      },
    },
    B01: {
      status: "bestaetigt",
      values: {
        systeme: program
          ? [
              {
                name: program,
                funktion: kanzleiBuchtAntwort(input.bucht) ? "Buchhaltung der Kanzlei" : "Buchhaltung im Unternehmen",
                typ: "fibu",
              },
            ]
          : [],
      },
    },
    F05: {
      status: "bestaetigt",
      values: { kanzleiBeteiligt: kanzleiBuchtAntwort(input.bucht) ? "ja" : "nein" },
    },
  };
  return {
    draftKey: normalizeDraftKey({ email: mail, modus: "gesamt" }),
    email: mail,
    stripeSessionId: "",
    documentId: "",
    entityId: "",
    step: 0,
    answers,
    updatedAt: new Date().toISOString(),
    revision: 1,
    updatedBy: mail,
    pricingModel: "v3",
  };
}

function knownFibuValue(answers: IntakeDraft["answers"]): string {
  const listed = answers.fibu?.find((item) => item.trim());
  if (listed) return listed;
  return answers.module?.stammdaten?.fibu?.trim() ?? "";
}

function blank(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/** Bestehende Angaben bleiben. Die Schnellversion füllt nur leere Felder. */
export function mergeEmptyDraftFields(existing: IntakeDraft, incoming: IntakeDraft): IntakeDraft {
  const answers = structuredClone(existing.answers);
  const add = incoming.answers;
  if (blank(answers.branchen)) answers.branchen = add.branchen;
  if (blank(answers.rechtsform)) answers.rechtsform = add.rechtsform;
  if (blank(answers.mitarbeitende)) answers.mitarbeitende = add.mitarbeitende;
  const knownFibu = knownFibuValue(answers);
  if (!knownFibu && blank(answers.fibu)) answers.fibu = add.fibu;
  const kanzleiStand = answers.module?.check?.kanzlei;
  if (kanzleiStand !== "nein" && kanzleiStand !== "unbekannt" && blank(answers.steuerberater)) {
    answers.steuerberater = add.steuerberater;
  }
  const currentModule: ModulZustand = answers.module
    ? {
        ...answers.module,
        check: { ...answers.module.check },
        stammdaten: { ...answers.module.stammdaten },
      }
    : { version: 1, check: {}, status: {} };
  const incomingModule = add.module;
  if (blank(currentModule.vorlage) && incomingModule?.vorlage) currentModule.vorlage = incomingModule.vorlage;
  for (const [key, value] of Object.entries(incomingModule?.check ?? {})) {
    const name = key as keyof ModulZustand["check"];
    if (blank(currentModule.check[name])) currentModule.check[name] = value as CheckAntwort;
  }
  if (!knownFibuValue(answers) && blank(currentModule.stammdaten?.fibu) && incomingModule?.stammdaten?.fibu) {
    currentModule.stammdaten = { ...currentModule.stammdaten, fibu: incomingModule.stammdaten.fibu };
  }
  answers.module = currentModule;
  const katalog = { ...(answers.katalog ?? {}) };
  for (const [id, question] of Object.entries(add.katalog ?? {})) {
    const current = katalog[id];
    if (!current) {
      if (id === "F05" && (existing.answers.module?.check?.kanzlei === "nein" || existing.answers.module?.check?.kanzlei === "unbekannt")) continue;
      if (id === "A01" && !blank(existing.answers.gf) && blank(existing.answers.katalog?.A01?.values?.company)) continue;
      katalog[id] = question;
      continue;
    }
    const values = { ...(current.values ?? {}) };
    let filled = false;
    for (const [field, value] of Object.entries(question.values ?? {})) {
      if (!blank(values[field])) continue;
      values[field] = value;
      filled = true;
    }
    if (id === "A01" && blank(existing.answers.katalog?.A01?.values?.company) && !blank(existing.answers.gf)) {
      continue;
    }
    if (id === "F05" && (existing.answers.module?.check?.kanzlei === "nein" || existing.answers.module?.check?.kanzlei === "unbekannt")) continue;
    if (filled) katalog[id] = { ...current, values };
  }
  answers.katalog = katalog;
  if (answers.module?.check?.kanzlei === "nein") {
    answers.steuerberater = "";
    const f05 = answers.katalog?.F05;
    if (f05) {
      answers.katalog = {
        ...answers.katalog,
        F05: { ...f05, values: { ...(f05.values ?? {}), kanzleiBeteiligt: "nein" } },
      };
    }
  }
  const fibu = knownFibuValue(existing.answers);
  if (fibu) {
    answers.fibu = [fibu];
    if (answers.module) {
      answers.module = {
        ...answers.module,
        stammdaten: { ...answers.module.stammdaten, fibu },
      };
    }
  }
  return {
    ...existing,
    answers,
    updatedAt: new Date().toISOString(),
    revision: Math.max(draftRevision(existing), 1),
  };
}
