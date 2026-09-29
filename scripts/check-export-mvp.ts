import minCatalog from "@/content/intake-catalog/INTAKE-CATALOG-MVP-MIN.json";
import { renderDeliveryDocument } from "@/lib/delivery-templates";
import { intakeFrageStepError } from "@/lib/frage-intake";
import { demoBeispielAnswers } from "@/lib/demo-beispiel";
import { CATALOG_STEPS, catalogStepError, statusLabel, visibleCatalogQuestions } from "@/lib/intake-catalog";
import { openPointBeforeUse } from "@/lib/intake-present";
import { evaluateOpenPoints } from "@/lib/open-points";
import {
  PARTNER_MUSTER_ANSWERS,
  PARTNER_MUSTER_DOCUMENT_ID,
  PARTNER_MUSTER_IDENTITY,
  PARTNER_MUSTER_VERSION_META,
} from "@/lib/partner-muster";
import { emptyAnswers, type IntakeAnswers } from "@/lib/types";

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

/** Short-intake checks keep the legacy bridge; the public muster uses the catalog. */
function withoutCatalog(answers: IntakeAnswers): IntakeAnswers {
  return { ...answers, katalog: undefined };
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
  "DATEV",
  "ausstehend",
  "Gliederung Muster v2",
  "Anhang A Prozessmatrix",
  "Zieltermin",
  "nicht festgelegt",
  "VD-BELEG-(zu vergeben)",
  "SaaS / Anbieter-Cloud",
  "keine konkrete Kontrollroutine bestätigt",
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
expect(musterIds.includes("op-i04"), "cover confirmation stays open");
expect(musterIds.includes("op-h01"), "empty controls stay open");
expect(!musterDoc.chapters.some((chapter) => chapter.id === "06-papier-digitalisierung"), "catalog muster omits paper");
expect(!musterIds.includes("op-d-ersetzend-ohne-papier"), "fixture must not get scan contradiction");
expect(!musterIds.some((id) => id.includes("stripe")), "stripe op");

const scanOnly: IntakeAnswers = {
  ...withoutCatalog(PARTNER_MUSTER_ANSWERS),
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
  ...withoutCatalog(PARTNER_MUSTER_ANSWERS),
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
  ...withoutCatalog(PARTNER_MUSTER_ANSWERS),
  steuerberater: "geplant",
};
expect(ids(emptyKanzlei).includes("op-steuerberater"), "geplant is empty");
expect(!ids(emptyKanzlei).includes("op-f05-kanzlei-umfang"), "geplant is not unconfirmedScope");
expect(!bodyFor(emptyKanzlei).includes("verbucht"), "geplant does not book");

const withStatus = {
  ...withoutCatalog(PARTNER_MUSTER_ANSWERS),
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

const structured = {
  ...withoutCatalog(PARTNER_MUSTER_ANSWERS),
  gf: "Anna Beispiel",
  buchhaltung: "",
  fibu: [] as string[],
  eingangsbelege: ["E-Mail", "E-Rechnung"],
  formate: ["PDF", "XRechnung"],
  geltungBelegarten: "Eingangsrechnungen",
  geltungAusschluss: "Lohn",
  vorsystemAntwort: { Kasse: "ja" as const, Shop: "nein" as const, Lager: "nein" as const, Lohn: "unbekannt" as const, Plattform: "nein" as const },
  seitWann: "2024-03-01",
  systeme: [{ name: "Warenwirtschaft Nord", funktion: "erzeugt Belege" }],
  originalJeWeg: [
    { weg: "E-Mail", original: "empfangene PDF" },
    { weg: "E-Rechnung", original: "XML" },
  ],
  postfach: "rechnung@beispiel.de",
  sichtungWer: "Ben Muster",
  sichtungTurnus: "arbeitstäglich",
  validierung: "unbekannt" as const,
  pruefkriterien: "Leistungsbezug und Betrag",
  pruefrolle: "Anna Beispiel",
  rollePruefen: "Ben Muster",
  rolleFreigeben: "Anna Beispiel",
  rolleBuchen: "Kanzlei Meier",
  backupGetestet: "nein" as const,
  kontrollenListe: [] as { was: string; turnus: string; wer: string; nachweis: string }[],
  bestaetigungName: "Anna Beispiel",
  bestaetigungDatum: "2026-09-01",
  fragen: {
    A01: { status: "bestätigt" as const },
    A02: { status: "bestätigt" as const },
    A03: { status: "bestätigt" as const },
    A04: { status: "bestätigt" as const },
    B01: { status: "bestätigt" as const },
    B04: { status: "bestätigt" as const },
    C01: { status: "bestätigt" as const },
    C02: { status: "bestätigt" as const },
    E01: { status: "bestätigt" as const },
    E02: { status: "bestätigt" as const },
    E03: { status: "bestätigt" as const },
    E05: { status: "bestätigt" as const },
    F01: { status: "bestätigt" as const },
    F05: { status: "geplant" as const },
    G01: { status: "bestätigt" as const },
    G06: { status: "bestätigt" as const },
    H01: { status: "unbekannt" as const },
    H04: { status: "bestätigt" as const },
    I04: { status: "bestätigt" as const },
  },
};
const structuredBody = bodyFor(structured);
const structuredIds = ids(structured);
expect(structuredBody.includes("Belegarten: Eingangsrechnungen"), "A02 scope is lived");
expect(structuredBody.includes("Ausschlüsse: Lohn"), "A02 exclusion is lived");
expect(structuredBody.includes("Einbezogene Vorsysteme: Kasse"), "A03 yes is lived");
expect(!structuredBody.includes("Einbezogene Vorsysteme: Kasse, Lohn"), "A03 unknown is not lived");
expect(structuredIds.includes("op-a03"), "A03 unknown stays an open point");
expect(structuredBody.includes("2024-03-01"), "A04 date is lived");
expect(structuredBody.includes("Warenwirtschaft Nord"), "B01 repeatable system is lived");
expect(structuredBody.includes("E-Mail: empfangene PDF"), "B04 original per path");
expect(structuredBody.includes("rechnung@beispiel.de, Ben Muster, arbeitstäglich"), "C02 mailbox");
expect(!structuredBody.includes("Technische Validierung: ja"), "unknown validation is not lived");
expect(structuredIds.includes("op-e02"), "unknown validation stays an open point");
expect(structuredBody.includes("Prüfen: Ben Muster. Freigeben: Anna Beispiel. Buchen: Kanzlei Meier."), "F01 roles");
expect(!structuredBody.includes("Kanzlei Meier übernimmt"), "planned kanzlei scope is not lived");
expect(structuredBody.includes("keine konkrete Kontrollroutine bestätigt"), "empty controls leave IKS empty");
expect(structuredIds.includes("op-h01"), "empty controls stay an open point");
expect(structuredIds.includes("op-g06-test"), "untested backup is an open point");
expect(structuredBody.includes("| ausstehend |") || structuredBody.includes("| ausstehend"), "I04 does not confirm the cover");
expect(structuredBody.includes("Anna Beispiel") && structuredBody.includes("2026-09-01"), "I04 name and date are shown");
expect(!structuredBody.includes("Gültig ab 2024-03-01"), "A04 does not backdate the version");
expect(
  intakeFrageStepError(0, emptyAnswers()).includes("Status"),
  "fresh intake requires a status before continuing",
);

const minIds = minCatalog.questions.map((question) => question.id);
const liveQuestions = CATALOG_STEPS.flatMap((step) => step.questions);
expect(minIds.length === 19, "acceptance floor is 19 questions");
expect(liveQuestions.length === 28, "productive catalog stays the 28-question v1");
for (const question of minCatalog.questions) {
  const live = liveQuestions.find((item) => item.id === question.id);
  expect(Boolean(live), `${question.id} is in the productive catalog`);
  if (!live) continue;
  const minShape = question.fields.map((field) => `${field.key}:${field.type}`).join(",");
  const liveShape = live.fields.map((field) => `${field.key}:${field.type}`).join(",");
  expect(minShape === liveShape, `${question.id} fields match the minimum`);
  expect(question.prompt === live.prompt, `${question.id} prompt matches the minimum`);
}
function asked(answers: IntakeAnswers): Set<string> {
  const ids = new Set<string>();
  for (let step = 0; step < CATALOG_STEPS.length; step += 1) {
    for (const question of visibleCatalogQuestions(step, answers)) ids.add(question.id);
  }
  return ids;
}
const openIntake = asked(emptyAnswers());
for (const id of ["A01", "A02", "A03", "A04", "B01", "B04", "C01", "E01", "E03", "F01", "F02", "F05", "G05", "G06", "H01", "I04"]) {
  expect(openIntake.has(id), `${id} is asked before any branch`);
}
expect(!openIntake.has("D01"), "D01 is not asked without paper");
expect(!openIntake.has("C02"), "C02 waits for a digital channel");
expect(!openIntake.has("E02"), "E02 waits for a structured e-invoice");
const paperIntake = asked({
  ...emptyAnswers(),
  katalog: { C01: { values: { kanaele: ["Post/Papier"] } } },
});
expect(paperIntake.has("D01"), "D01 is asked when Post/Papier is chosen");
const mailIntake = asked({
  ...emptyAnswers(),
  katalog: { C01: { values: { kanaele: ["E-Mail-PDF"] } } },
});
expect(mailIntake.has("C02"), "C02 is asked for E-Mail-PDF");
expect(!mailIntake.has("D01"), "E-Mail-PDF does not open the scan question");
const invoiceIntake = asked({
  ...emptyAnswers(),
  katalog: { E01: { values: { formate: ["XRechnung"] } } },
});
expect(invoiceIntake.has("E02"), "E02 is asked for XRechnung");

const gastroOnly: IntakeAnswers = {
  ...emptyAnswers(),
  katalog: {
    A01: {
      status: "bestaetigt",
      values: {
        company: "Bistro Beispiel",
        standort: "Musterstadt",
        branchen: ["Gastronomie"],
        rechtsform: "GmbH",
        gf: "Anna Beispiel",
      },
    },
  },
};
const gastroBody = bodyFor(gastroOnly);
expect(!gastroBody.includes("Einbezogene Vorsysteme"), "gastronomy alone does not list a lived upstream system");
expect(!gastroBody.includes("Bargeldkasse"), "gastronomy alone does not invent an exclusion");
expect(!/Kassensystem:\s+\S/.test(gastroBody), "gastronomy alone does not name a till");
expect(ids(gastroOnly).includes("op-taetigkeit-gastronomie"), "undescribed gastronomy is an open point");
expect(
  evaluateOpenPoints({ answers: gastroOnly, identity: PARTNER_MUSTER_IDENTITY }).some((point) =>
    point.text.includes("welches Kassensystem"),
  ),
  "gastronomy gap names the missing till",
);

const shopFilled: IntakeAnswers = {
  ...emptyAnswers(),
  katalog: {
    A01: {
      status: "bestaetigt",
      values: {
        company: "Shop Beispiel",
        standort: "Musterstadt",
        branchen: ["Onlinehandel"],
        rechtsform: "GmbH",
        gf: "Anna Beispiel",
        onlineShop: "Shopware",
        onlineZahlung: "PayPal",
        onlinePlattformen: "keine",
        onlineRetouren: "im Shop",
        onlineWawi: "keine eigene",
      },
    },
  },
};
const shopBody = bodyFor(shopFilled);
expect(shopBody.includes("Shopsystem: Shopware"), "described shop is lived");
expect(!shopBody.includes("Kassensystem"), "online trade does not invent a till");
expect(!ids(shopFilled).includes("op-taetigkeit-onlinehandel"), "filled shop follow-ups clear the gap");

const shopEmpty: IntakeAnswers = {
  ...emptyAnswers(),
  katalog: {
    A01: {
      status: "bestaetigt",
      values: {
        company: "Shop Beispiel",
        standort: "Musterstadt",
        branchen: ["Onlinehandel"],
        rechtsform: "GmbH",
        gf: "Anna Beispiel",
      },
    },
  },
};
expect(
  ids(shopEmpty).includes("op-taetigkeit-onlinehandel"),
  "empty online trade asks which shop system",
);
expect(!bodyFor(shopEmpty).includes("Shopsystem:"), "undescribed shop is not lived");

expect(statusLabel("bestaetigt") === "So läuft es heute", "status is today's practice");
expect(statusLabel("geplant") === "Soll künftig so laufen", "status is the future practice");
expect(statusLabel("unbekannt") === "Muss ich klären", "status is still to clarify");
expect(statusLabel("nicht_zutreffend") === "Entfällt", "not applicable follows the fact");

const beispiel = demoBeispielAnswers();
for (let step = 0; step < CATALOG_STEPS.length; step += 1) {
  const message = catalogStepError(step, beispiel);
  expect(message === "", `beispiel step ${step}: ${message}`);
}
const beispielPoints = evaluateOpenPoints({
  answers: beispiel,
  identity: PARTNER_MUSTER_IDENTITY,
});
expect(
  beispielPoints.some((point) => openPointBeforeUse(point.priority, point.id)),
  "beispiel keeps points to clarify before use",
);
expect(
  beispielPoints.some((point) => !openPointBeforeUse(point.priority, point.id)),
  "beispiel keeps points to add later",
);
const noKanzlei = demoBeispielAnswers();
noKanzlei.katalog = {
  ...noKanzlei.katalog,
  F05: {
    status: "nicht_zutreffend",
    reason: "Keine Kanzlei beteiligt.",
    values: { kanzleiBeteiligt: "nein" },
  },
};
expect(!ids(noKanzlei).includes("op-f05-kanzlei-umfang"), "no kanzlei omits the kanzlei point");
const testedRestore = demoBeispielAnswers();
testedRestore.katalog = {
  ...testedRestore.katalog,
  H04: {
    status: "bestaetigt",
    values: { status: "bestaetigt", datum: "2026-01-15", ergebnis: "Export lesbar" },
  },
};
const restoreStep = CATALOG_STEPS.findIndex((step) => step.id === "step-H");
expect(catalogStepError(restoreStep, testedRestore) === "", "tested restore with a result passes");
const restoreWithoutResult = demoBeispielAnswers();
restoreWithoutResult.katalog = {
  ...restoreWithoutResult.katalog,
  H04: { status: "bestaetigt", values: { status: "bestaetigt" } },
};
expect(
  catalogStepError(restoreStep, restoreWithoutResult) !== "",
  "tested restore asks for date or result",
);

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("export checks ok");
