/**
 * Document 4ec861e1 is on the intakes tab and in Blob, but /account was empty
 * and the PDF route answered 404. The row is reproduced here exactly.
 * No network and no writes.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AccountCompanyCard } from "../components/account-company-card";
import { sessionOwnerDenial } from "../lib/checkout-access";
import { accountCompanyCards } from "../lib/account-hub";
import { pickStoredDocument } from "../lib/documents";
import { emptyEntity } from "../lib/entities";
import { documentsOwnedByEmail, intakeValuesRange } from "../lib/store";
import {
  SHEET_COLUMNS,
  emailsEqual,
  emptySheetRow,
  parseSheetRow,
  type SheetRow,
} from "../lib/types";

const DOC = "4ec861e1-f37c-4c99-8f11-72af8a819225";
const ENTITY = "23e0c9aa-1fa7-4f13-97b8-4a61ccfe31b8";
const EMAIL = "gobdtest-d-1791815197@maxxspace.com";
const OTHER = "other-buyer@example.com";
const PDF = `gobd/${DOC}/v1.pdf`;
const COMPANY = "Smoke D Test GmbH";

function ok(cond: unknown, msg: string) {
  assert.ok(cond, msg);
  console.log("ok:", msg);
}

/** Column values the CoS read from intakes, around row 58. */
function smokeCells(): Record<string, string> {
  return {
    timestamp: "2026-10-12T14:31:19Z",
    email: EMAIL,
    company: COMPANY,
    status: "intake_submitted",
    delivery_status: "ready",
    document_id: DOC,
    pdf_url: PDF,
    version: "1",
    parent_document_id: DOC,
    entity_id: ENTITY,
  };
}

function rowFrom(header: string[], cells: Record<string, string> = smokeCells()): SheetRow {
  return parseSheetRow(
    header,
    header.map((column) => cells[column] ?? ""),
  );
}

const canonical = rowFrom([...SHEET_COLUMNS]);
ok(canonical.documentId === DOC, "document_id maps onto documentId");
ok(canonical.parentDocumentId === DOC, "parent_document_id maps, including a self-parent");
ok(canonical.pdfUrl === PDF, "pdf_url is the private blob key");
ok(canonical.version === "1", "version 1 is kept");
ok(canonical.email === EMAIL, "email is kept");
ok(canonical.company === COMPANY, "company is kept");
ok(canonical.entityId === ENTITY, "entity_id is kept even when the entities tab has no such row");
ok(canonical.status === "intake_submitted", "intake_submitted is kept");
ok(canonical.deliveryStatus === "ready", "delivery_status ready is kept");
ok(canonical.timestamp === "2026-10-12T14:31:19Z", "timestamp is kept");

const aliased = rowFrom([
  ...SHEET_COLUMNS,
  "documentId",
  "parentDocumentId",
  "pdfUrl",
  "Email",
  "entityId",
]);
ok(aliased.documentId === DOC, "an empty documentId alias does not wipe document_id");
ok(aliased.parentDocumentId === DOC, "an empty parentDocumentId alias does not wipe the parent");
ok(aliased.pdfUrl === PDF, "an empty pdfUrl alias does not wipe pdf_url");
ok(aliased.email === EMAIL, "an empty Email alias does not wipe email");
ok(aliased.entityId === ENTITY, "an empty entityId alias does not wipe entity_id");

const pad = Array.from({ length: 52 }, (_, index) => `extra_${index}`);
const wideHeader = [...pad, ...SHEET_COLUMNS];
const wide = rowFrom(wideHeader);
ok(wide.documentId === DOC, "document_id past column AZ still parses");
ok(wide.pdfUrl === PDF, "pdf_url past column AZ still parses");
const clipped = parseSheetRow(wideHeader.slice(0, 52), wideHeader.slice(0, 52).map(() => ""));
ok(clipped.documentId === "", "the old A2:AZ window never sees that document_id");
const wideRange = intakeValuesRange(wideHeader.length);
ok(wideRange.startsWith("A2:") && !wideRange.endsWith(":AZ"), "the intake read follows the grid, not AZ");
ok(
  intakeValuesRange(SHEET_COLUMNS.length) === "A2:AG",
  "the canonical 33 intake columns end at AG",
);

const hiddenEmail = rowFrom([...SHEET_COLUMNS], {
  ...smokeCells(),
  email: `${EMAIL}\u200b`,
});
ok(emailsEqual(hiddenEmail.email, EMAIL), "a zero-width character in the sheet email still matches");
ok(
  emailsEqual(hiddenEmail.email, EMAIL.toUpperCase()),
  "email case does not hide the row",
);

const owned = documentsOwnedByEmail([aliased, hiddenEmail], EMAIL);
ok(owned.length === 2, "intake_submitted and ready stay on the owner's account");
ok(
  documentsOwnedByEmail([aliased], OTHER).length === 0,
  "another mailbox does not receive the document",
);

const sameFirmForeignOwner = {
  ...emptySheetRow(),
  documentId: "foreign-doc",
  parentDocumentId: "foreign-doc",
  email: OTHER,
  entityId: ENTITY,
  company: COMPANY,
  status: "intake_submitted",
  deliveryStatus: "ready",
  timestamp: "2026-10-12T15:00:00Z",
};
ok(
  documentsOwnedByEmail([aliased, sameFirmForeignOwner], EMAIL).every((row) =>
    emailsEqual(row.email, EMAIL),
  ),
  "a foreign row with the same entity id is not listed",
);

const paidOnly = {
  ...emptySheetRow(),
  email: EMAIL,
  stripeSessionId: "cs_test_paid_only",
  status: "paid",
  timestamp: "2026-10-12T14:00:00Z",
};
ok(
  documentsOwnedByEmail([paidOnly], EMAIL).length === 0,
  "a paid checkout without a document is not listed as one",
);

const wipedId = { ...aliased, documentId: "" };
const recovered = documentsOwnedByEmail([wipedId], EMAIL);
ok(recovered.length === 1 && recovered[0]?.documentId === DOC, "a PDF key restores a wiped document id");
ok(
  pickStoredDocument([wipedId], DOC)?.documentId === DOC,
  "lookup by id finds the row from gobd/<id>/v1.pdf",
);

const decoy = {
  ...emptySheetRow(),
  documentId: "decoy-doc",
  parentDocumentId: DOC,
  pdfUrl: "gobd/decoy-doc/v1.pdf",
  email: OTHER,
  entityId: ENTITY,
  status: "intake_submitted",
  deliveryStatus: "ready",
  timestamp: "2026-10-12T16:00:00Z",
};
ok(
  pickStoredDocument([aliased, decoy], DOC)?.email === EMAIL,
  "a self-parent matches the exact row, not a later foreign parent",
);
ok(
  pickStoredDocument([aliased], DOC.toUpperCase())?.documentId === DOC,
  "lookup ignores document-id case",
);

ok(sessionOwnerDenial(null, EMAIL) === 401, "no session is 401");
ok(sessionOwnerDenial(OTHER, EMAIL) === 403, "another mailbox is 403");
ok(sessionOwnerDenial(EMAIL, hiddenEmail.email) === null, "the owner session may read the row");

const hub = accountCompanyCards([], owned, []);
ok(hub.groups.length === 1 && hub.groups[0]?.entity === null, "a missing entities-tab row does not drop the document");
const html = renderToStaticMarkup(
  createElement(AccountCompanyCard, {
    email: EMAIL,
    group: hub.groups[0]!,
    empty: false,
  }),
);
ok(html.includes(COMPANY), "the account card shows Smoke D Test GmbH");
ok(html.includes(`/api/docs/${DOC}/download`), "the account card links the stored PDF");

const otherFirm = {
  ...emptyEntity(),
  entityId: "firm-other",
  userEmail: EMAIL,
  name: "Andere GmbH",
};
const withFirm = accountCompanyCards([otherFirm], documentsOwnedByEmail([canonical], EMAIL), []);
ok(
  withFirm.groups.some((group) => group.families.some((family) => family.latest.documentId === DOC)),
  "an unknown entity id still leaves the document on the account",
);

const store = readFileSync("lib/store.ts", "utf8");
ok(store.includes("intakeColumnCount"), "intake reads ask the sheet for its column count");
ok(!store.includes("getSheetsTab()}!A2:AZ"), "intake values are not requested as A2:AZ");

console.log("document lookup checks passed");
