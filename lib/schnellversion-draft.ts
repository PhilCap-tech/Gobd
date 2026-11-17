/**
 * Die 6 Angaben der Schnellversion werden in den bestehenden Fragebogen-Entwurf geschrieben.
 */

import { normalizeDraftKey, type IntakeDraft } from "@/lib/intake-draft-shared";
import {
  brancheLabel,
  kanzleiBuchtAntwort,
  kasseHatKapitel,
  softwareLabel,
  vorlageForBranche,
  type SchnellversionAnswers,
} from "@/lib/schnellversion-answers";
import { setCheckAntwort, setVorlage } from "@/lib/module/status";
import { emptyAnswers } from "@/lib/types";

export function draftFromSchnellversion(email: string, input: SchnellversionAnswers): IntakeDraft {
  const mail = email.trim().toLowerCase();
  let answers = setVorlage(emptyAnswers(), vorlageForBranche(input.branche));
  answers.branchen = [brancheLabel(input.branche)];
  answers.rechtsform = input.rechtsform;
  answers.mitarbeitende = input.mitarbeitende;
  answers.fibu = [softwareLabel(input)];
  answers.steuerberater = kanzleiBuchtAntwort(input.bucht) ? "Steuerkanzlei" : "";
  answers = setCheckAntwort(answers, "bargeld", kasseHatKapitel(input.kasse) ? "ja" : "nein");
  answers = setCheckAntwort(answers, "kanzlei", kanzleiBuchtAntwort(input.bucht) ? "ja" : "nein");
  const moduleState = answers.module;
  if (moduleState) {
    answers = {
      ...answers,
      module: {
        ...moduleState,
        stammdaten: { ...moduleState.stammdaten, fibu: softwareLabel(input) },
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
        systeme: [
          {
            name: softwareLabel(input),
            funktion: kanzleiBuchtAntwort(input.bucht) ? "Buchhaltung der Kanzlei" : "Buchhaltung im Unternehmen",
            typ: "fibu",
          },
        ],
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
