import { renderDeliveryDocument } from "@/lib/delivery-templates";
import { evaluateOpenPoints } from "@/lib/open-points";
import {
  PARTNER_MUSTER_ANSWERS,
  PARTNER_MUSTER_DOCUMENT_ID,
  PARTNER_MUSTER_IDENTITY,
  PARTNER_MUSTER_VERSION_META,
} from "@/lib/partner-muster";
import type { IntakeAnswers } from "@/lib/types";

function bodyFor(answers: IntakeAnswers): string {
  const doc = renderDeliveryDocument({
    identity: PARTNER_MUSTER_IDENTITY,
    answers,
    documentId: "check",
    version: 1,
    versionMeta: PARTNER_MUSTER_VERSION_META,
  });
  return [doc.cover, ...doc.chapters.map((chapter) => chapter.body)].join("\n");
}

function ids(answers: IntakeAnswers): string[] {
  return evaluateOpenPoints({
    answers,
    identity: PARTNER_MUSTER_IDENTITY,
  }).map((point) => point.id);
}

const failures: string[] = [];
function expect(cond: boolean, message: string) {
  if (!cond) failures.push(message);
}

const musterDoc = renderDeliveryDocument({
  identity: PARTNER_MUSTER_IDENTITY,
  answers: PARTNER_MUSTER_ANSWERS,
  documentId: "check",
  version: 1,
  versionMeta: PARTNER_MUSTER_VERSION_META,
});
const muster = [musterDoc.cover, ...musterDoc.chapters.map((chapter) => chapter.body)].join("\n");
expect(
  !musterDoc.chapters.some((chapter) => chapter.id === "06-papier-digitalisierung"),
  "digital fixture omits paper chapter",
);
expect(
  musterDoc.chapters.some((chapter) => chapter.id === "00b-dokumentenlenkung"),
  "document control chapter",
);
const musterIds = ids(PARTNER_MUSTER_ANSWERS);
for (const absent of [
  "zeitnah an Arbeitstagen",
  "verbucht im vereinbarten Umfang",
  "vereinbarten Mandatsumfang",
  "frage:",
  "cs_test_DO_NOT_PUT_IN_PDF",
  "cus_DO_NOT_PUT_IN_PDF",
  "rules.json",
  "Papierpost",
  "Scan von Papier",
  "Alle Belege werden zehn",
  "DRAFT / not Philip-final",
  "rechnung@",
  "Köln",
  "fünf Belegen",
]) {
  expect(!muster.includes(absent), `muster contains ${absent}`);
}
for (const present of [
  "acht Jahren",
  "Leistungsumfang zu bestätigen",
  "Mandatsumfang zu bestätigen",
  "soweit die jeweilige Angabe bestätigt ist",
  "Papierweg laut Intake nicht genannt",
  "E-Mail- und PDF-Eingang",
  "Sichtungsturnus",
  "Anna Beispiel",
  "Ben Muster",
  "Gliederung Muster v2",
  "Anhang A Prozessmatrix",
  "Zieltermin",
  "nicht festgelegt",
  "VD-BELEG-(zu vergeben)",
  "Hosting | SaaS / Anbieter-Cloud | Anna Beispiel",
]) {
  expect(muster.includes(present), `muster missing ${present}`);
}
expect(!muster.includes("im vereinbarten Umfang"), "unconfirmed scope is not lived booking");
const partnerIdDoc = renderDeliveryDocument({
  identity: PARTNER_MUSTER_IDENTITY,
  answers: PARTNER_MUSTER_ANSWERS,
  documentId: PARTNER_MUSTER_DOCUMENT_ID,
  version: 1,
  versionMeta: PARTNER_MUSTER_VERSION_META,
});
const partnerIdBody = [partnerIdDoc.cover, ...partnerIdDoc.chapters.map((chapter) => chapter.body)].join("\n");
expect(!partnerIdBody.includes(PARTNER_MUSTER_DOCUMENT_ID), "partner document id stays off the PDF");
expect(musterIds.includes("op-f05-kanzlei-umfang"), "missing f05");
expect(musterIds.includes("op-c02-sichtung"), "missing c02");
expect(!musterIds.includes("op-d-ersetzend-ohne-papier"), "fixture must not get scan contradiction");
expect(!musterIds.some((id) => id.includes("stripe")), "stripe op");

const scanOnly: IntakeAnswers = {
  ...PARTNER_MUSTER_ANSWERS,
  weitereSysteme: "ersetzendes Scannen im Funktionspostfach",
};
expect(ids(scanOnly).includes("op-d-ersetzend-ohne-papier"), "ersetzend without paper");
expect(!bodyFor(scanOnly).includes("Papierpost"), "postfach must not open paper chapter");

const withPaper: IntakeAnswers = {
  ...scanOnly,
  eingangsbelege: ["Papierordner", "E-Mail"],
};
expect(!ids(withPaper).includes("op-d-ersetzend-ohne-papier"), "paper path suppresses hint");
expect(bodyFor(withPaper).includes("Papierpost"), "paper token opens paper section");

const confirmed: IntakeAnswers = {
  ...PARTNER_MUSTER_ANSWERS,
  steuerberater: "Kanzlei Meier",
};
const confirmedBody = bodyFor(confirmed);
expect(confirmedBody.includes("durch Kanzlei Meier im vereinbarten Umfang"), "confirmed books");
expect(
  confirmedBody.includes(
    "Kanzlei Meier übernimmt Tätigkeiten ausschließlich im vereinbarten Mandatsumfang.",
  ),
  "confirmed access",
);
expect(!ids(confirmed).includes("op-f05-kanzlei-umfang"), "confirmed has no f05 op");

const emptyKanzlei: IntakeAnswers = {
  ...PARTNER_MUSTER_ANSWERS,
  steuerberater: "geplant",
};
expect(ids(emptyKanzlei).includes("op-steuerberater"), "geplant is empty");
expect(!ids(emptyKanzlei).includes("op-f05-kanzlei-umfang"), "geplant is not unconfirmedScope");
expect(!bodyFor(emptyKanzlei).includes("verbucht"), "geplant does not book");

const withStatus = {
  ...PARTNER_MUSTER_ANSWERS,
  fibu: ["DATEV"],
  gf: "Anna Beispiel",
  buchhaltung: "Ben Muster",
  steuerberater: "Kanzlei Meier",
  kontrollen: "Monatsabschluss durch Anna Beispiel",
  fragen: {
    A01: { status: "bestätigt" as const },
    B01: { status: "geplant" as const },
    C01: { status: "bestätigt" as const },
    E05: { status: "bestätigt" as const },
    F01: { status: "bestätigt" as const },
    F05: { status: "geplant" as const },
    G01: { status: "bestätigt" as const },
    G02: { status: "bestätigt" as const },
    G06: { status: "bestätigt" as const },
    H01: { status: "bestätigt" as const },
    H04: { status: "unbekannt" as const },
  },
};
const statusBody = bodyFor(withStatus);
const statusIds = ids(withStatus);
expect(
  statusBody.includes("FiBu-/Buchhaltungssystem ist im Intake nicht angegeben"),
  "geplant system is not lived",
);
expect(!statusBody.includes("Kanzlei Meier"), "geplant kanzlei is not lived");
expect(statusBody.includes("Monatsabschluss durch Anna Beispiel"), "confirmed control is lived");
expect(statusIds.includes("op-b01"), "geplant system is an open point");
expect(statusIds.includes("op-h04"), "unknown restore test is an open point");
expect(!statusIds.includes("op-kontrollprotokoll"), "confirmed control clears the generic control point");

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("export checks ok");
