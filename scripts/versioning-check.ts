/**
 * Checks the Prüfer versioning rule without Sheets.
 * Usage: npx tsx scripts/versioning-check.ts
 */
import { emptyAnswers, parseSheetRow, toSheetRow } from "@/lib/types";
import { renderDeliveryDocument } from "@/lib/delivery-templates";
import {
  berlinTodayIso,
  dayBeforeIso,
  effectiveValidTo,
  formatValidityRange,
  normalizeVersionChange,
  selectCurrentVersion,
  type VersionIntervalRow,
} from "@/lib/versioning";

function assert(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function row(
  partial: Partial<VersionIntervalRow> & Pick<VersionIntervalRow, "documentId">,
): VersionIntervalRow {
  return {
    version: "1",
    validFrom: "",
    validTo: "",
    ...partial,
  };
}

const today = "2026-09-28";
const v1 = row({
  documentId: "v1",
  version: "1",
  validFrom: "2024-01-01",
});
const v2 = row({
  documentId: "v2",
  version: "2",
  validFrom: "2027-01-01",
});
const v3 = row({
  documentId: "v3",
  version: "3",
  validFrom: "2027-06-30",
});
const family = [v1, v2, v3];

assert(dayBeforeIso("2027-01-01") === "2026-12-31", "day before New Year");
assert(dayBeforeIso("2024-03-01") === "2024-02-29", "leap day before March");
assert(
  effectiveValidTo(v1, family) === "2026-12-31",
  "v1 ends the day before v2",
);
assert(
  effectiveValidTo(v2, family) === "2027-06-29",
  "v2 ends the day before v3",
);
assert(effectiveValidTo(v3, family) === "", "v3 stays open");

assert(
  selectCurrentVersion(family, today)?.row.documentId === "v1",
  "before 2027 the original version is current",
);
assert(
  selectCurrentVersion(family, today)?.fallback === false,
  "v1 covers 2026-09-28",
);
assert(
  selectCurrentVersion(family, "2027-03-01")?.row.documentId === "v2",
  "March 2027 is the bookkeeping version",
);
assert(
  selectCurrentVersion(family, "2027-07-01")?.row.documentId === "v3",
  "after the DATEV switch v3 is current",
);

const legacy = row({ documentId: "old", version: "1" });
const legacyPick = selectCurrentVersion([legacy], today);
assert(legacyPick?.row.documentId === "old", "undated legacy row is current");
assert(legacyPick?.fallback === false, "undated legacy row covers today");
assert(
  formatValidityRange(legacy, [legacy]) === "von — bis offen",
  "legacy range stays open",
);

const future = row({
  documentId: "soon",
  version: "2",
  validFrom: "2027-01-01",
});
const mixed = [legacy, future];
assert(
  effectiveValidTo(legacy, mixed) === "2026-12-31",
  "legacy closes the day before the next Gültig-ab",
);
assert(
  selectCurrentVersion(mixed, today)?.row.documentId === "old",
  "future v2 does not replace an untouched document yet",
);

const expired = [
  row({
    documentId: "a",
    version: "1",
    validFrom: "2020-01-01",
    validTo: "2020-12-31",
  }),
  row({
    documentId: "b",
    version: "2",
    validFrom: "2021-01-01",
    validTo: "2021-12-31",
  }),
];
const expiredPick = selectCurrentVersion(expired, today);
assert(expiredPick?.fallback === true, "expired family uses the fallback");
assert(expiredPick?.row.documentId === "b", "fallback is the latest Gültig-ab");

const backdated = normalizeVersionChange(
  {
    validFrom: "2027-01-01",
    validTo: "",
    changeSummary: "neue Buchhaltungskraft",
    changedBy: "",
  },
  { version: 2, defaultChangedBy: "buchhaltung@firma.de" },
);
assert(!("error" in backdated), "backdated Gültig-ab is accepted");
if (!("error" in backdated)) {
  assert(backdated.changedBy === "buchhaltung@firma.de", "who defaults to email");
}

assert(
  "error" in
    normalizeVersionChange(
      { validFrom: "", changeSummary: "x", changedBy: "a@b.de" },
      { version: 2, defaultChangedBy: "a@b.de" },
    ),
  "a later version requires Gültig-ab",
);
assert(
  "error" in
    normalizeVersionChange(
      { validFrom: "2027-02-31", changeSummary: "x", changedBy: "a@b.de" },
      { version: 2 },
    ),
  "invalid calendar dates are rejected",
);

const first = normalizeVersionChange({}, { version: 1, defaultChangedBy: "a@b.de" });
assert(!("error" in first), "first version fills defaults");
if (!("error" in first)) {
  assert(first.changeSummary === "Erstfassung", "first changelog defaults");
  assert(first.validFrom === berlinTodayIso(), "first Gültig-ab defaults to today");
}

const header = ["document_id", "version", "email", "company"];
const parsed = parseSheetRow(header, ["doc-1", "1", "a@b.de", "Alt GmbH"]);
assert(parsed.validFrom === "", "old sheet rows load with empty valid_from");
assert(parsed.validTo === "", "old sheet rows load with empty valid_to");
assert(parsed.changeSummary === "", "old sheet rows load with empty changelog");
assert(parsed.changedBy === "", "old sheet rows load with empty changed_by");
assert(parsed.documentId === "doc-1", "existing columns still map");

const stored = toSheetRow({
  identity: {
    email: "a@b.de",
    company: "Neu GmbH",
    stripeSessionId: "s",
    stripeCustomerId: "",
    stub: true,
  },
  answers: emptyAnswers(),
  status: "intake_submitted_stub",
  deliveryStatus: "ready",
  documentId: "doc-2",
  version: "2",
  validFrom: "2027-01-01",
  changeSummary: "neue Buchhaltungskraft",
  changedBy: "a@b.de",
});
assert(stored.validFrom === "2027-01-01", "toSheetRow keeps valid_from");
assert(stored.changeSummary === "neue Buchhaltungskraft", "toSheetRow keeps changelog");

const rendered = renderDeliveryDocument({
  identity: {
    email: "a@b.de",
    company: "Neu GmbH",
    stripeSessionId: "s",
    stripeCustomerId: "",
    stub: true,
  },
  answers: emptyAnswers(),
  documentId: "doc-2",
  version: 2,
  versionMeta: {
    validFrom: "01.01.2027",
    validTo: "",
    changeSummary: "neue Buchhaltungskraft",
    changedBy: "a@b.de",
  },
});
assert(rendered.cover.includes("01.01.2027"), "cover includes Gültig ab");
assert(
  rendered.cover.includes("neue Buchhaltungskraft"),
  "cover includes changelog",
);
assert(
  rendered.chapters.some((chapter) => chapter.body.includes("neue Buchhaltungskraft")),
  "history chapter includes changelog",
);
assert(rendered.validFromDisplay === "01.01.2027", "footer date is the display date");

console.log("versioning-check ok");
