/**
 * Server-render the account hub for the fixtures that used to throw:
 * finished document, open draft only, no firm, legacy nulls, missing grant fields.
 * Also the branded not-found page. No network.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AccountCompanyCard } from "../components/account-company-card";
import NotFound from "../app/not-found";
import { accountCompanyCards } from "../lib/account-hub";
import { emptyEntity, type Entity } from "../lib/entities";
import type { IntakeDraft } from "../lib/intake-draft-shared";
import { ensureGesamt } from "../lib/module/status";
import { emptyAnswers, emptySheetRow, toSheetRow, type SheetRow } from "../lib/types";

function ok(cond: unknown, msg: string) {
  assert.ok(cond, msg);
  console.log("ok:", msg);
}

function firm(overrides: Partial<Entity> = {}): Entity {
  return {
    ...emptyEntity(),
    entityId: "ent_nordlicht",
    userEmail: "ada.fertig@example.com",
    name: "Nordlicht Handel GmbH",
    street: "Königstraße 12",
    zip: "50667",
    city: "Köln",
    createdAt: "2026-04-01T10:00:00.000Z",
    updatedAt: "2026-04-01T10:00:00.000Z",
    checkoutPrefill: "done",
    ...overrides,
  };
}

function finishedRow(overrides: Partial<SheetRow> = {}): SheetRow {
  const answers = ensureGesamt(emptyAnswers());
  answers.katalog = {
    ...(answers.katalog ?? {}),
    A01: { status: "bestaetigt", values: { company: "Nordlicht Handel GmbH" } },
  };
  const row = toSheetRow({
    identity: {
      email: "ada.fertig@example.com",
      company: "Nordlicht Handel GmbH",
      stripeSessionId: "cs_test_finished_v1",
      stripeCustomerId: "cus_test_finished",
      stub: false,
      entityId: "ent_nordlicht",
    },
    answers,
    status: "intake_submitted",
    deliveryStatus: "sent",
    documentId: "doc_finished_v1",
    parentDocumentId: "doc_finished_v1",
    version: "1",
    entityId: "ent_nordlicht",
    validFrom: "2026-04-01",
    changeSummary: "Erstfassung",
    changedBy: "ada.fertig@example.com",
  });
  return { ...row, ...overrides };
}

function legacyBereichRow(): SheetRow {
  const row = emptySheetRow();
  row.timestamp = "2025-06-01T08:00:00.000Z";
  row.email = "ada.fertig@example.com";
  row.company = "Alt GmbH";
  row.stripeSessionId = "cs_live_legacy";
  row.documentId = "doc_legacy_v1";
  row.parentDocumentId = "doc_legacy_v1";
  row.version = "1";
  row.status = "intake_submitted";
  row.deliveryStatus = "sent";
  row.entityId = "ent_nordlicht";
  row.branchen = "Handel";
  row.rechtsform = "GmbH";
  return row;
}

function draft(overrides: Partial<IntakeDraft> = {}): IntakeDraft {
  return {
    draftKey: "session:cs_test_open:gesamt",
    email: "ada.fertig@example.com",
    stripeSessionId: "cs_test_open",
    documentId: "",
    entityId: "ent_nordlicht",
    step: 3,
    answers: ensureGesamt(emptyAnswers()),
    updatedAt: "2026-10-01T12:00:00.000Z",
    ...overrides,
  };
}

function renderHub(entities: Entity[], docs: SheetRow[], drafts: IntakeDraft[]): string {
  const hub = accountCompanyCards(entities, docs, drafts);
  return hub.groups
    .map((group) =>
      renderToStaticMarkup(
        createElement(AccountCompanyCard, {
          email: "ada.fertig@example.com",
          group,
          empty: group.families.length === 0 && group.continueDrafts.length === 0,
        }),
      ),
    )
    .join("\n");
}

const entity = firm();
const finished = renderHub([entity], [finishedRow()], []);
ok(finished.includes("Nordlicht Handel GmbH"), "finished document v1.0 renders the firm");
ok(finished.includes("1.0") || finished.includes("Aktuell"), "finished document shows a version");

ok(renderHub([entity], [legacyBereichRow()], []).length > 0, "legacy bereich document renders");
ok(
  renderHub([], [], []).length === 0,
  "no firm and no document does not throw",
);
ok(
  renderHub([firm({ checkoutPrefill: undefined as unknown as Entity["checkoutPrefill"] })], [], []).includes(
    "Nordlicht Handel GmbH",
  ),
  "firm without checkoutPrefill renders",
);

const openOnly = renderHub([entity], [], [draft()]);
ok(openOnly.includes("Weiter ausfüllen"), "open draft only offers continue");

const nullMeta = renderHub(
  [entity],
  [
    finishedRow({
      validFrom: null as unknown as string,
      validTo: null as unknown as string,
      changeSummary: null as unknown as string,
      changedBy: null as unknown as string,
      timestamp: null as unknown as string,
      fragen: null as unknown as string,
      branchen: null as unknown as string,
      version: null as unknown as string,
      stripeSessionId: null as unknown as string,
      entityId: null as unknown as string,
      company: null as unknown as string,
    }),
  ],
  [],
);
ok(nullMeta.includes("Nordlicht Handel GmbH"), "finished row with null meta still renders");

ok(
  renderHub(
    [entity],
    [
      finishedRow({
        fragen: JSON.stringify({
          katalog: { module: { version: 1, check: { bargeld: "nein" } } },
        }),
      }),
    ],
    [],
  ).includes("Nordlicht"),
  "module without status does not throw",
);

ok(
  renderHub(
    [entity],
    [
      finishedRow({
        fragen: JSON.stringify({
          katalog: {
            module: {
              version: 1,
              check: {},
              status: {
                m02: { status: "extern", uploadName: "a.pdf", uploadAt: 1710000000000, ref: "Ordner" },
              },
            },
          },
        }),
      }),
    ],
    [],
  ).includes("Nordlicht"),
  "numeric uploadAt does not throw",
);

ok(
  renderHub(
    [
      firm({
        street: null as unknown as string,
        zip: undefined as unknown as string,
        city: null as unknown as string,
        name: null as unknown as string,
        checkoutPrefill: undefined as unknown as Entity["checkoutPrefill"],
      }),
    ],
    [finishedRow()],
    [],
  ).includes("Firma"),
  "legacy entity with null name and address renders",
);

ok(
  renderHub(
    [entity],
    [],
    [
      draft({
        documentId: undefined as unknown as string,
        stripeSessionId: undefined as unknown as string,
        entityId: undefined as unknown as string,
        updatedAt: undefined as unknown as string,
        answers: { ...emptyAnswers(), katalog: undefined },
      }),
    ],
  ).length >= 0,
  "legacy draft without ids does not throw",
);

const notFound = renderToStaticMarkup(createElement(NotFound));
ok(notFound.includes("Seite nicht gefunden"), "not-found has a heading");
ok(notFound.includes('href="/"'), "not-found links home");
ok(notFound.includes("Zur Startseite"), "not-found uses Sie-form home link");
ok(!/\bdu\b/i.test(notFound), "not-found does not use du");

const accountPage = readFileSync("app/account/page.tsx", "utf8");
const loginPage = readFileSync("app/login/page.tsx", "utf8");
const notFoundSource = readFileSync("app/not-found.tsx", "utf8");
ok(accountPage.includes("getSessionEmail"), "account still reads the session");
ok(!accountPage.includes("cookies().set") && !accountPage.includes("cookies().delete"), "account render does not write cookies");
ok(!loginPage.includes("cookies().set") && !loginPage.includes("cookies().delete"), "login render does not write cookies");
ok(!notFoundSource.includes("cookies("), "not-found does not read cookies");
ok(readFileSync("app/api/auth/logout/route.ts", "utf8").includes("clearSessionCookie"), "logout still clears through the route");

function continueAnchors(html: string): string[] {
  const anchors: string[] = [];
  const re = /<a\b[^>]*>[\s\S]*?Weiter ausfüllen[\s\S]*?<\/a>/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html))) anchors.push(match[0]);
  return anchors;
}

function formDepthBefore(html: string, index: number): number {
  const before = html.slice(0, index);
  const opens = before.match(/<form\b/g)?.length ?? 0;
  const closes = before.match(/<\/form>/g)?.length ?? 0;
  return opens - closes;
}

function assertContinueAnchors(html: string, hrefPart: string, label: string) {
  const anchors = continueAnchors(html);
  ok(anchors.length > 0, `${label} renders Weiter ausfüllen as an anchor`);
  ok(!/<button\b[^>]*>[\s\S]*?Weiter ausfüllen/.test(html), `${label} continue control is not a button`);
  for (const anchor of anchors) {
    const at = html.indexOf(anchor);
    ok(anchor.includes("href="), `${label} continue anchor has an href`);
    ok(anchor.includes(hrefPart), `${label} continue href is ${hrefPart}`);
    ok(!/\sdisabled\b/.test(anchor), `${label} continue anchor is not disabled`);
    ok(!anchor.includes("preventDefault"), `${label} continue anchor does not preventDefault`);
    ok(formDepthBefore(html, at) === 0, `${label} continue anchor is not inside a form`);
  }
}

assertContinueAnchors(openOnly, "/intake?session_id=cs_test_open", "open draft");
assertContinueAnchors(finished, "/intake?document_id=doc_finished_v1", "open module");

function continueTags(source: string): Array<{ tag: string; attrs: string }> {
  const found: Array<{ tag: string; attrs: string }> = [];
  const re = /<(a|Link|button)\b([^>]*)>\s*(?:\{ACCOUNT_CONTINUE_LABEL\}|Weiter ausfüllen)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(source))) found.push({ tag: match[1] ?? "", attrs: match[2] ?? "" });
  return found;
}

const cardSource = readFileSync("components/account-company-card.tsx", "utf8");
const cardTags = continueTags(cardSource);
ok(cardTags.length === 2, "company card has two Weiter ausfüllen controls");
for (const tag of cardTags) {
  ok(tag.tag === "a", "company card continue is a native anchor, not Link");
  ok(tag.attrs.includes("href="), "company card continue anchor has href");
  ok(!tag.attrs.includes("preventDefault") && !/\sdisabled\b/.test(tag.attrs), "company card continue is not disabled and does not preventDefault");
}
ok(
  cardSource.lastIndexOf("ACCOUNT_CONTINUE_LABEL") < cardSource.indexOf("<form"),
  "company card continue controls sit before the bereich form",
);

const looseTags = continueTags(accountPage);
ok(looseTags.length === 1 && looseTags[0]?.tag === "a", "loose draft continue is a native anchor");
ok(looseTags[0]?.attrs.includes("href={openDraftContinuePath(draft)}"), "loose draft continue uses the draft href");
ok(!accountPage.includes("preventDefault"), "account page does not preventDefault on continue");

console.log("check-account-render: ok");
