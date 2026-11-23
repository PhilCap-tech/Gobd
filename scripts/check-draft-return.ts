/**
 * Offline: abort mid-intake, open a new browser (no cookies), return via the
 * magic link, and land in the same server draft. A foreign login cannot read it.
 *
 *   npx tsx scripts/check-draft-return.ts
 *
 * Synthetic @example.com only. No mail is sent. No Stripe.
 */
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { putIntakeDraft, readIntakeDraft, type DraftWriteIo } from "../app/api/intake/draft/route";
import { GET as verifyMagicLink } from "../app/auth/verify/route";
import {
  SESSION_COOKIE,
  createMagicToken,
  createSessionToken,
  safeNextPath,
  verifyMagicToken,
  verifySessionToken,
} from "../lib/auth";
import { fragebogenEntitiesForQuery } from "../lib/fragebogen";
import { accountCompanyCards } from "../lib/account-hub";
import type { Entity } from "../lib/entities";
import { getMagicLinkSecret } from "../lib/env";
import {
  clearIntakeDraft,
  loadIntakeDraft,
  normalizeDraftKey,
  saveIntakeDraft,
  type IntakeDraft,
} from "../lib/intake-draft";
import {
  forgetOpenDraft,
  listOpenDraftsForEmail,
  loadOwnerSessionDraft,
  openDraftContinuePath,
  rememberOpenDraft,
} from "../lib/open-drafts";
import { emptyAnswers, emptySheetRow, type IntakeAnswers } from "../lib/types";

function ok(cond: unknown, msg: string) {
  assert.ok(cond, msg);
  console.log("ok:", msg);
}

const BUYER = "buyer@example.com";
const OTHER = "other@example.com";
const SESSION = "cs_test_owner_draft";
const MARKER = "Ada Entwurf";
const COMPANY = "Entwurf GmbH";

function answers(): IntakeAnswers {
  const base = emptyAnswers();
  base.rechtsform = "GmbH";
  base.gf = MARKER;
  base.katalog = {
    A01: { status: "bestaetigt", values: { company: COMPANY, rechtsform: "GmbH" } },
  };
  return base;
}

function firm(id: string, name: string): Entity {
  return {
    entityId: id,
    userEmail: BUYER,
    name,
    street: "",
    zip: "",
    city: "",
    stnr: "",
    ustId: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    checkoutPrefill: "",
  };
}

function hubDraft(sessionId: string, entityId: string, company: string): IntakeDraft {
  const body = answers();
  body.katalog = {
    A01: { status: "bestaetigt", values: { company, rechtsform: "GmbH" } },
  };
  return {
    draftKey: normalizeDraftKey({ sessionId, modus: "gesamt" }),
    email: BUYER,
    stripeSessionId: sessionId,
    documentId: "",
    entityId,
    step: 2,
    answers: body,
    revision: 1,
    updatedAt: "2026-01-02T00:00:00.000Z",
  };
}

function withPricing<T>(model: string | undefined, flag: string | undefined, run: () => T): T {
  const savedModel = process.env.PRICING_MODEL;
  const savedFlag = process.env.INTAKE_LOGIN_FIRST_ENABLED;
  if (model === undefined) delete process.env.PRICING_MODEL;
  else process.env.PRICING_MODEL = model;
  if (flag === undefined) delete process.env.INTAKE_LOGIN_FIRST_ENABLED;
  else process.env.INTAKE_LOGIN_FIRST_ENABLED = flag;
  try {
    return run();
  } finally {
    if (savedModel === undefined) delete process.env.PRICING_MODEL;
    else process.env.PRICING_MODEL = savedModel;
    if (savedFlag === undefined) delete process.env.INTAKE_LOGIN_FIRST_ENABLED;
    else process.env.INTAKE_LOGIN_FIRST_ENABLED = savedFlag;
  }
}

function loginDraft(entityId: string, modus: "gesamt" | "bereich" = "gesamt"): IntakeDraft {
  return {
    draftKey: normalizeDraftKey({ email: BUYER, entityId, modus }),
    email: BUYER,
    stripeSessionId: "",
    documentId: "",
    entityId,
    step: 2,
    answers: answers(),
    revision: 1,
    updatedAt: "2026-01-02T00:00:00.000Z",
  };
}

function checkContinuePaths() {
  const firms = [firm("firm-a", "Alpha GmbH"), firm("firm-b", "Beta GmbH")];
  withPricing("v3", undefined, () => {
    ok(
      openDraftContinuePath(loginDraft("")) === "/fragebogen?entity_id=default",
      "unpaid default draft opens /fragebogen",
    );
    ok(
      openDraftContinuePath(loginDraft("firm-a")) === "/fragebogen?entity_id=firm-a",
      "unpaid company draft opens /fragebogen?entity_id=",
    );
    ok(
      openDraftContinuePath(loginDraft("firm-a"), { covered: true }) === "/intake?entity_id=firm-a",
      "covered company stays on /intake",
    );
    ok(
      openDraftContinuePath(loginDraft(""), { covered: true }) === "/fragebogen?entity_id=default",
      "coverage does not replace the default draft",
    );
    ok(
      openDraftContinuePath({ ...loginDraft(""), entityId: "firm-a" }, { covered: true }) ===
        "/fragebogen?entity_id=default",
      "the default key wins over a firm id stored beside it",
    );
    ok(
      openDraftContinuePath(loginDraft("firm-a", "bereich")) === "/intake?entity_id=firm-a",
      "unpaid bereich draft stays on /intake",
    );
    const documented: IntakeDraft = {
      ...loginDraft("firm-a"),
      draftKey: "doc:doc-1",
      documentId: "doc-1",
      stripeSessionId: "cs_test_doc",
    };
    ok(
      openDraftContinuePath(documented) === "/intake?document_id=doc-1&session_id=cs_test_doc",
      "document draft stays on /intake",
    );
    ok(
      openDraftContinuePath(hubDraft("cs_test_paid", "firm-a", "Alpha GmbH")) ===
        "/intake?session_id=cs_test_paid",
      "paid session stays on /intake",
    );
  });
  withPricing("v3", "false", () => {
    ok(openDraftContinuePath(loginDraft("")) === "/intake", "login-first off: default draft stays on /intake");
    ok(
      openDraftContinuePath(loginDraft("firm-a")) === "/intake?entity_id=firm-a",
      "login-first off: company draft stays on /intake",
    );
  });
  withPricing(undefined, undefined, () => {
    ok(
      openDraftContinuePath(loginDraft("firm-a")) === "/intake?entity_id=firm-a",
      "legacy model keeps an unpaid draft on /intake",
    );
  });

  const foreign = fragebogenEntitiesForQuery(firms, "firm-other");
  ok(
    foreign.initialEntityId === "firm-a" && foreign.entities.length === 1 && foreign.entities[0]?.entityId === "firm-a",
    "foreign entity_id is ignored",
  );
  ok(!foreign.entities.some((row) => row.entityId === "firm-other"), "foreign entity_id is not passed to the form");
  const marked = fragebogenEntitiesForQuery(firms, "default");
  ok(marked.initialEntityId === "" && marked.entities.length === 0, "entity_id=default keeps the unbound draft");
  ok(
    normalizeDraftKey({ email: BUYER, entityId: marked.initialEntityId, modus: "gesamt" }) ===
      `email:${BUYER}:default:gesamt`,
    "default marker restores the default draft key",
  );
  const owned = fragebogenEntitiesForQuery(firms, "firm-b");
  ok(owned.initialEntityId === "firm-b" && owned.entities[0]?.entityId === "firm-b", "owned entity_id is honoured");
  ok(
    normalizeDraftKey({ email: BUYER, entityId: owned.initialEntityId, modus: "gesamt" }) ===
      normalizeDraftKey({ email: BUYER, entityId: "firm-b", modus: "gesamt" }),
    "owned entity_id restores that company draft",
  );
  ok(fragebogenEntitiesForQuery(firms, "").initialEntityId === "firm-a", "without entity_id the first company stays");

  ok(safeNextPath("/fragebogen?entity_id=default") === "/fragebogen?entity_id=default", "login return keeps the default marker");
  ok(safeNextPath("/fragebogen?entity_id=firm-a") === "/fragebogen?entity_id=firm-a", "login return keeps an entity id");
  ok(
    safeNextPath("/fragebogen?entity_id=firm-a&next=https://evil.example") === "/fragebogen?entity_id=firm-a",
    "login return drops other fragebogen query keys",
  );
  ok(safeNextPath("/fragebogen?entity_id=../admin") === "/fragebogen", "unsafe entity_id is dropped");
  ok(safeNextPath("https://evil.example/fragebogen?entity_id=default") === null, "absolute fragebogen next is rejected");

  const route = readFileSync("app/api/intake/draft/route.ts", "utf8");
  ok(route.includes("isUnpaidLoginDraft"), "draft route uses the shared unpaid-login helper");
  ok(!route.includes("function isUnpaidLoginDraft"), "unpaid-login helper is not duplicated in the route");
  const fragebogen = readFileSync("app/fragebogen/page.tsx", "utf8");
  ok(fragebogen.includes("fragebogenEntitiesForQuery"), "fragebogen validates entity_id against the account");
  ok(!fragebogen.includes("entities.slice(0, 1)"), "fragebogen does not silently take the first company");
  const paket = readFileSync("app/fragebogen/paket/page.tsx", "utf8");
  ok(paket.includes("fragebogenEntitiesForQuery"), "paket uses the same entity rule");
  ok(paket.includes("FRAGEBOGEN_DEFAULT_ENTITY"), "paket keeps the default draft unbound");
  ok(!paket.includes("?? entities[0]"), "paket does not fall back to the first company");
}

function checkHubCards() {
  const alpha = firm("firm-a", "Alpha GmbH");
  const beta = firm("firm-b", "Beta GmbH");
  const open = hubDraft("cs_test_hub_open", "firm-a", "Alpha GmbH");
  const openHub = accountCompanyCards([alpha, beta], [], [open]);
  const openA = openHub.groups.find((group) => group.entity?.entityId === "firm-a");
  const openB = openHub.groups.find((group) => group.entity?.entityId === "firm-b");
  ok(openA?.continueDrafts.length === 1, "an open draft is on its company card");
  ok(
    openDraftContinuePath(openA?.continueDrafts[0] ?? open) ===
      `/intake?session_id=${encodeURIComponent("cs_test_hub_open")}`,
    "the company card continues the open draft",
  );
  ok(openB?.continueDrafts.length === 0 && openB?.families.length === 0, "the other company has no draft");
  ok(openHub.openDrafts.length === 1, "Weiter ausfüllen stays available for the open draft");

  const submitted = emptySheetRow();
  submitted.documentId = "doc-hub-1";
  submitted.email = BUYER;
  submitted.company = "";
  submitted.entityId = "";
  submitted.stripeSessionId = "cs_test_hub_done";
  submitted.status = "intake_submitted";
  submitted.version = "1";
  submitted.timestamp = "2026-02-01T00:00:00.000Z";
  const doneDraft = hubDraft("cs_test_hub_done", "firm-a", "Alpha GmbH");
  const done = accountCompanyCards([alpha, beta], [submitted], [doneDraft]);
  const doneA = done.groups.find((group) => group.entity?.entityId === "firm-a");
  const doneB = done.groups.find((group) => group.entity?.entityId === "firm-b");
  ok(doneA?.families.length === 1, "a submitted document is shown on the company card");
  ok(doneA?.families[0]?.latest.documentId === "doc-hub-1", "the card keeps the document id");
  ok(doneA?.continueDrafts.length === 0, "a submitted intake is not offered as an open draft");
  ok(doneB?.families.length === 0 && doneB?.continueDrafts.length === 0, "the other company stays without that document");

  const bound = emptySheetRow();
  bound.documentId = "doc-hub-2";
  bound.entityId = "firm-b";
  bound.email = BUYER;
  bound.stripeSessionId = "cs_test_hub_bound";
  bound.version = "1";
  bound.timestamp = "2026-03-01T00:00:00.000Z";
  const boundHub = accountCompanyCards([alpha, beta], [bound], []);
  ok(
    boundHub.groups.find((group) => group.entity?.entityId === "firm-b")?.families[0]?.latest.documentId ===
      "doc-hub-2",
    "a document that already names its firm stays on that card",
  );
}

function signRaw(payload: Record<string, unknown>): string {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = createHmac("sha256", getMagicLinkSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

async function main() {
  const savedBlob = process.env.BLOB_READ_WRITE_TOKEN;
  const savedSecret = process.env.MAGIC_LINK_SECRET;
  delete process.env.BLOB_READ_WRITE_TOKEN;
  if (!process.env.MAGIC_LINK_SECRET?.trim()) {
    process.env.MAGIC_LINK_SECRET = "check-draft-return-offline-secret";
  }

  const draftKey = normalizeDraftKey({ sessionId: SESSION, modus: "gesamt" });
  const io: DraftWriteIo = {
    loadIntakeDraft,
    saveIntakeDraft,
    clearIntakeDraft,
    rememberOpenDraft,
    forgetOpenDraft,
    lookup: {
      findDocumentById: async () => null,
      listDocumentFamily: async () => [],
      findLatestDocumentByStripeSessionId: async () => null,
    },
    resolveCheckout: async (sessionId) => {
      if (sessionId === SESSION) return { email: BUYER, stub: false };
      return { error: "invalid" };
    },
  };

  try {
    checkContinuePaths();
    const anonSave = await putIntakeDraft(
      new Request("http://localhost/api/intake/draft", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionId: SESSION,
          modus: "gesamt",
          step: 2,
          revision: 1,
          answers: answers(),
        }),
      }),
      io,
    );
    ok(anonSave.status === 401, `mid-intake save without gobd_session is 401 (got ${anonSave.status})`);

    const saved = await putIntakeDraft(
      new Request("http://localhost/api/intake/draft", {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          cookie: `${SESSION_COOKIE}=${createSessionToken(BUYER)}`,
        },
        body: JSON.stringify({
          sessionId: SESSION,
          modus: "gesamt",
          step: 2,
          revision: 1,
          answers: answers(),
        }),
      }),
      io,
    );
    const savedJson = (await saved.json()) as { ok?: boolean; draft?: { email?: string; answers?: IntakeAnswers } };
    ok(saved.status === 200 && savedJson.ok === true, `mid-intake save is 200 (got ${saved.status})`);
    ok(savedJson.draft?.email === BUYER, "stored draft email is the paying customer");
    ok(savedJson.draft?.answers?.gf === MARKER, "abort keeps the typed answer");

    const listed = await listOpenDraftsForEmail(BUYER);
    const open = listed.find((draft) => draft.draftKey === draftKey);
    ok(Boolean(open), "account index lists the open draft for the owner");
    ok(open?.answers.gf === MARKER, "listed draft still has the answer");
    ok(open?.answers.katalog?.A01?.values?.company === COMPANY, "listed draft still has the company");
    const next = openDraftContinuePath(open!);
    ok(next === `/intake?session_id=${encodeURIComponent(SESSION)}`, "Weiter ausfüllen opens this checkout draft");
    ok((await listOpenDraftsForEmail(OTHER)).length === 0, "foreign account does not list the draft");

    const account = readFileSync("app/account/page.tsx", "utf8");
    ok(account.includes("Weiter ausfüllen"), "hub renders Weiter ausfüllen");
    ok(account.includes("listOpenDraftsForEmail"), "hub reads the owner's open drafts");
    ok(account.includes("accountCompanyCards"), "hub places drafts and documents on the company cards");
    ok(
      account.includes("group.families.length === 0 && group.continueDrafts.length === 0"),
      "Noch kein Entwurf is only the card with neither a draft nor a document",
    );
    checkHubCards();
    const intakePage = readFileSync("app/intake/page.tsx", "utf8");
    ok(intakePage.includes("loadOwnerSessionDraft"), "intake resumes the owner draft without a fresh checkout cookie");

    const token = await createMagicToken(BUYER);
    ok(Boolean(token) && (await verifyMagicToken(token)) === BUYER, "magic link uses the existing token");
    if (!token) throw new Error("magic token");
    const expiredMagic = signRaw({
      typ: "magic",
      email: BUYER,
      exp: Date.now() - 1_000,
    });
    const expiredLogin = await verifyMagicLink(
      new Request(`http://localhost/auth/verify?token=${encodeURIComponent(expiredMagic)}&next=${encodeURIComponent(next)}`),
    );
    ok(expiredLogin.status >= 300 && expiredLogin.status < 400, "expired magic link does not log in");
    ok(!expiredLogin.headers.getSetCookie().some((line) => line.startsWith(`${SESSION_COOKIE}=`)), "expired magic link sets no session");

    const login = await verifyMagicLink(
      new Request(
        `http://localhost/auth/verify?token=${encodeURIComponent(token)}&next=${encodeURIComponent(next)}`,
      ),
    );
    const location = login.headers.get("location") ?? "";
    ok(location.includes(next), `magic link returns into the draft (${location})`);
    const sessionValue = login.cookies.get(SESSION_COOKIE)?.value ?? "";
    ok(verifySessionToken(sessionValue) === BUYER, "magic link sets the owner session");

    const freshBrowser = await readIntakeDraft(
      new Request(`http://localhost/api/intake/draft?draftKey=${encodeURIComponent(draftKey)}`, {
        headers: { cookie: `${SESSION_COOKIE}=${sessionValue}` },
      }),
      io,
    );
    const freshJson = (await freshBrowser.json()) as {
      draft?: { answers?: IntakeAnswers; email?: string } | null;
    };
    ok(freshBrowser.status === 200, `new browser with only the session reads the draft (got ${freshBrowser.status})`);
    ok(freshJson.draft?.answers?.gf === MARKER, "answers are intact after the new browser returns");
    ok(freshJson.draft?.answers?.rechtsform === "GmbH", "rechtsform is intact");
    ok(freshJson.draft?.answers?.katalog?.A01?.values?.company === COMPANY, "company is intact");
    ok(freshJson.draft?.email === BUYER, "draft still belongs to the owner");

    const resumed = await loadOwnerSessionDraft(BUYER, SESSION);
    ok(resumed?.answers.gf === MARKER, "intake resume loads the same server draft");
    ok((await loadOwnerSessionDraft(OTHER, SESSION)) === null, "foreign login cannot resume the draft");

    const anon = await readIntakeDraft(
      new Request(`http://localhost/api/intake/draft?draftKey=${encodeURIComponent(draftKey)}`),
      io,
    );
    ok(anon.status === 401, `no cookies cannot read the draft (got ${anon.status})`);

    const foreign = await readIntakeDraft(
      new Request(`http://localhost/api/intake/draft?draftKey=${encodeURIComponent(draftKey)}`, {
        headers: { cookie: `${SESSION_COOKIE}=${createSessionToken(OTHER)}` },
      }),
      io,
    );
    ok(foreign.status === 403, `foreign session cannot read the draft (got ${foreign.status})`);

    console.log("check-draft-return: green");
  } finally {
    await clearIntakeDraft(draftKey).catch(() => undefined);
    await forgetOpenDraft(BUYER, draftKey).catch(() => undefined);
    if (savedBlob === undefined) delete process.env.BLOB_READ_WRITE_TOKEN;
    else process.env.BLOB_READ_WRITE_TOKEN = savedBlob;
    if (savedSecret === undefined) delete process.env.MAGIC_LINK_SECRET;
    else process.env.MAGIC_LINK_SECRET = savedSecret;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
