/**
 * Offline: die Checkout-Session schreibt die erste Fassung genau einmal.
 * Danach brauchen neue Fassung, Entwurf und Upload das Login der Inhaber-Mail.
 *
 *   npx tsx scripts/check-session-write-access.ts
 *
 * Gemockter Store und Stripe. Keine Mails, keine Prod-Daten. Nur @example.com.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { submitIntake, type IntakeIo } from "../app/api/intake/route";
import { putIntakeDraft, type DraftWriteIo } from "../app/api/intake/draft/route";
import { postModuleUpload, type UploadIo } from "../app/api/module-upload/route";
import {
  CHECKOUT_GRANT_COOKIE,
  SESSION_COOKIE,
  createCheckoutGrantToken,
  createSessionToken,
} from "../lib/auth";
import { encodeIntakePayloadRef } from "../lib/intake-payload";
import { LOGIN_TO_CHANGE_COPY } from "../lib/session-write";
import { emptyAnswers, emptySheetRow, type IntakeAnswers, type SheetRow } from "../lib/types";

function ok(cond: unknown, msg: string) {
  assert.ok(cond, msg);
  console.log("ok:", msg);
}

const BUYER = "buyer@example.com";
const OTHER = "other@example.com";
const SESSION = "cs_test_buyer_write";
const COMPANY = "Käufer GmbH";

function answers(): IntakeAnswers {
  return {
    ...emptyAnswers(),
    branchen: ["Handel"],
    rechtsform: "GmbH",
    mitarbeitende: "3",
    fibu: ["lexoffice"],
    eingangsbelege: ["mail"],
    ausgangsrechnungen: ["tool"],
    archiv: "cloud",
    hosting: "vercel",
    backup: ["taeglich"],
    zugriff: "gf",
    gf: "Ada Beispiel",
    buchhaltung: "intern",
    it: "extern",
    steuerberater: "Kanzlei Nord",
  };
}

function familyOf(rows: SheetRow[], id: string): SheetRow[] {
  const seed = rows.find((row) => row.documentId === id);
  if (!seed) return [];
  const familyId = (seed.parentDocumentId || seed.documentId).trim();
  return rows.filter((row) => {
    const parent = (row.parentDocumentId || row.documentId).trim();
    return row.documentId === familyId || parent === familyId;
  });
}

function memoryStore() {
  const rows: SheetRow[] = [];
  let delayMs = 0;
  return {
    rows,
    setDelay(ms: number) {
      delayMs = ms;
    },
    async findDocumentById(id: string) {
      return rows.find((row) => row.documentId === id) ?? null;
    },
    async listDocumentFamily(id: string) {
      return familyOf(rows, id);
    },
    async findLatestDocumentByStripeSessionId(sessionId: string) {
      if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
      const matches = rows.filter(
        (row) => row.documentId && row.stripeSessionId === sessionId,
      );
      return matches.at(-1) ?? null;
    },
    async appendRecord(row: SheetRow) {
      const stored = { ...emptySheetRow(), ...row };
      rows.push(stored);
      return { backend: "file" as const, row: stored };
    },
  };
}

type Memory = ReturnType<typeof memoryStore>;

function checkoutCookie(): string {
  return `${CHECKOUT_GRANT_COOKIE}=${createCheckoutGrantToken({
    sessionId: SESSION,
    email: BUYER,
  })}`;
}

function loginCookie(email: string): string {
  return `${SESSION_COOKIE}=${createSessionToken(email)}`;
}

function intakeIo(store: Memory, pdfCalls: { n: number }, prepares?: { n: number }): IntakeIo {
  return {
    findDocumentById: store.findDocumentById,
    listDocumentFamily: store.listDocumentFamily,
    findLatestDocumentByStripeSessionId: store.findLatestDocumentByStripeSessionId,
    listEntitiesByEmail: async () => [],
    getOwnedEntity: async () => null,
    findLatestStripeCustomerIdByEmail: async () => null,
    resolveCheckoutSession: async (sessionId) => {
      if (sessionId === SESSION) {
        return {
          email: BUYER,
          company: COMPANY,
          stripeSessionId: SESSION,
          stripeCustomerId: "cus_test_buyer",
          stub: false,
        };
      }
      if (!sessionId) return { error: "missing" as const };
      return { error: "invalid" as const };
    },
    prepareDurableIntakeRow: async (row) => {
      if (prepares) prepares.n += 1;
      return row;
    },
    appendRecord: store.appendRecord,
    generatePdf: async (input) => {
      pdfCalls.n += 1;
      return {
        buffer: Buffer.from("%PDF-1.4\n"),
        documentId: input.documentId || "pdf",
        plan: { status: "ready", chapters: [], openItems: [], pdf: null },
      };
    },
    storePdf: async () => ({
      url: "",
      pathname: "memory/a.pdf",
      backend: "file" as const,
    }),
    sendDeliveryMail: async () => ({
      stub: true,
      sent: false,
      action: "delivery",
    }),
    sendReferralAfterDeliveryMail: async () => ({
      stub: true,
      sent: false,
      action: "referral_after_delivery",
    }),
    deliverLoginLink: async () => "stub",
  };
}

function postIntake(body: unknown, cookie: string): Request {
  return new Request("http://localhost/api/intake", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie,
    },
    body: JSON.stringify(body),
  });
}

const firstBody = {
  sessionId: SESSION,
  email: OTHER,
  company: "Fremd GmbH",
  changedBy: OTHER,
  answers: answers(),
};

async function jsonOf(response: Response): Promise<{ error?: string; version?: number; documentId?: string }> {
  return (await response.json()) as { error?: string; version?: number; documentId?: string };
}

async function checkIntake() {
  const store = memoryStore();
  const pdfCalls = { n: 0 };
  const prepares = { n: 0 };
  const io = intakeIo(store, pdfCalls, prepares);

  const first = await submitIntake(postIntake(firstBody, checkoutCookie()), io);
  const firstJson = await jsonOf(first);
  ok(first.status === 200, `first checkout submit is 200 (got ${first.status} ${firstJson.error ?? ""})`);
  ok(store.rows.length === 1, "first submit appends exactly one row");
  ok(prepares.n === 1, "first submit prepares durable storage once");
  ok(pdfCalls.n === 1, "first submit generates one PDF");
  ok(store.rows[0]?.email === BUYER, "first row email is the Stripe email, not body.email");
  ok(store.rows[0]?.company === COMPANY, "first row company is the Stripe company, not body.company");
  ok(store.rows[0]?.email !== OTHER, "body.email does not become the owner");

  const again = await submitIntake(postIntake(firstBody, checkoutCookie()), io);
  const againJson = await jsonOf(again);
  ok(again.status === 401, `second submit with only checkout is 401 (got ${again.status})`);
  ok(againJson.error === LOGIN_TO_CHANGE_COPY, "second submit uses the Sie login copy");
  ok(store.rows.length === 1, "second submit writes nothing");
  ok(prepares.n === 1, "second submit does not touch blob storage");
  ok(pdfCalls.n === 1, "second submit does not generate a PDF");

  const cookieOnly = await submitIntake(
    postIntake(
      { email: OTHER, company: "Fremd GmbH", changedBy: OTHER, answers: answers() },
      checkoutCookie(),
    ),
    io,
  );
  ok(cookieOnly.status === 401, "gobd_checkout alone cannot write a second version");
  ok(store.rows.length === 1, "cookie-only second submit writes nothing");

  const documentId = store.rows[0]?.documentId ?? "";
  const revisionBody = {
    ...firstBody,
    documentId,
    validFrom: "2026-10-08",
    changeSummary: "Korrektur der Ablage",
    changedBy: OTHER,
  };
  const revisionDenied = await submitIntake(postIntake(revisionBody, checkoutCookie()), io);
  const revisionDeniedJson = await jsonOf(revisionDenied);
  ok(revisionDenied.status === 401, "revision with only checkout is 401");
  ok(revisionDeniedJson.error === LOGIN_TO_CHANGE_COPY, "revision without login asks to sign in");
  ok(store.rows.length === 1, "denied revision writes nothing");
  ok(prepares.n === 1, "denied revision does not touch blob storage");

  const revision = await submitIntake(
    postIntake(revisionBody, `${loginCookie(BUYER)}; ${checkoutCookie()}`),
    io,
  );
  const revisionJson = await jsonOf(revision);
  ok(revision.status === 200, `owner revision is 200 (got ${revision.status} ${revisionJson.error ?? ""})`);
  ok(revisionJson.version === 2, "owner revision is version 2");
  ok(store.rows.length === 2, "owner revision appends one row");
  ok(store.rows[1]?.email === BUYER, "revision email stays the owner");
  ok(store.rows[1]?.company === COMPANY, "revision company stays the document company");
  ok(
    store.rows[1]?.changedBy === OTHER && store.rows[1]?.email === BUYER,
    "changedBy does not replace the owner email",
  );

  const foreign = await submitIntake(postIntake(revisionBody, loginCookie(OTHER)), io);
  const foreignJson = await jsonOf(foreign);
  ok(foreign.status === 403, `foreign login is 403 (got ${foreign.status})`);
  ok(foreignJson.error === "Kein Zugriff.", "foreign login is forbidden");
  ok(store.rows.length === 2, "foreign login writes nothing");
  ok(prepares.n === 2, "foreign login does not prepare another blob row");
}

async function checkBlobPointerAndFieldLimit() {
  const store = memoryStore();
  store.rows.push({
    ...emptySheetRow(),
    timestamp: "2026-10-08T12:00:00.000Z",
    stripeSessionId: SESSION,
    email: BUYER,
    company: COMPANY,
    status: "intake_submitted",
    documentId: "docpointer01",
    parentDocumentId: "docpointer01",
    version: "1",
    fragen: encodeIntakePayloadRef("gobd/docpointer01/docpointer01/v1-answers.json", "a".repeat(64)),
  });
  const pdfCalls = { n: 0 };
  const prepares = { n: 0 };
  const io = intakeIo(store, pdfCalls, prepares);
  const huge = {
    ...answers(),
    weitereSysteme: "x".repeat(12_001),
  };
  const denied = await submitIntake(
    postIntake(
      { sessionId: SESSION, email: OTHER, company: "Fremd GmbH", changedBy: OTHER, answers: huge },
      checkoutCookie(),
    ),
    io,
  );
  const deniedJson = await jsonOf(denied);
  ok(denied.status === 401, `blob-pointer row blocks a second submit (got ${denied.status})`);
  ok(deniedJson.error === LOGIN_TO_CHANGE_COPY, "blob-pointer denial uses the Sie copy");
  ok(store.rows.length === 1, "blob-pointer denial appends nothing");
  ok(prepares.n === 0, "blob-pointer denial does not prepare storage");
  ok(pdfCalls.n === 0, "blob-pointer denial does not generate a PDF");
  ok(store.rows[0]?.fragen.includes("__gobdAnswers"), "the pointer cell stays untouched");

  const fresh = memoryStore();
  const freshPrepares = { n: 0 };
  const overflow = await submitIntake(
    postIntake(
      { sessionId: SESSION, email: OTHER, company: "Fremd GmbH", answers: huge },
      checkoutCookie(),
    ),
    intakeIo(fresh, { n: 0 }, freshPrepares),
  );
  const overflowJson = await jsonOf(overflow);
  ok(overflow.status === 400, `first submit over the field cap is 400 (got ${overflow.status})`);
  ok(overflowJson.error?.includes("12.000"), "field cap keeps the Sie limit copy");
  ok(fresh.rows.length === 0, "over-long first submit writes nothing");
  ok(freshPrepares.n === 0, "over-long first submit does not prepare storage");
}

async function checkRace() {
  const store = memoryStore();
  store.setDelay(30);
  const pdfCalls = { n: 0 };
  const io = intakeIo(store, pdfCalls);
  const [left, right] = await Promise.all([
    submitIntake(postIntake(firstBody, checkoutCookie()), io),
    submitIntake(postIntake(firstBody, checkoutCookie()), io),
  ]);
  const statuses = [left.status, right.status].sort((a, b) => a - b);
  ok(statuses[0] === 200 && statuses[1] === 401, `parallel first submit is 200 then 401 (got ${statuses.join(",")})`);
  ok(store.rows.length === 1, "parallel first submit appends one row");
  ok(store.rows[0]?.email === BUYER, "the single raced row belongs to the Stripe email");
}

async function checkDraftAndUpload() {
  const store = memoryStore();
  const pdfCalls = { n: 0 };
  await submitIntake(postIntake(firstBody, checkoutCookie()), intakeIo(store, pdfCalls));
  ok(store.rows.length === 1, "draft fixture has the delivered row");
  const documentId = store.rows[0]?.documentId ?? "";

  let saves = 0;
  let savedEmail = "";
  const draftIo: DraftWriteIo = {
    loadIntakeDraft: async () => null,
    saveIntakeDraft: async (draft) => {
      saves += 1;
      savedEmail = draft.email;
      return { backend: "file" };
    },
    clearIntakeDraft: async () => undefined,
    lookup: store,
    resolveCheckout: async () => ({ email: BUYER, stub: false }),
  };
  const draftBody = {
    sessionId: SESSION,
    documentId,
    email: OTHER,
    modus: "gesamt",
    step: 1,
    answers: answers(),
    revision: 1,
  };
  const draftDenied = await putIntakeDraft(
    new Request("http://localhost/api/intake/draft", {
      method: "PUT",
      headers: { "content-type": "application/json", cookie: checkoutCookie() },
      body: JSON.stringify(draftBody),
    }),
    draftIo,
  );
  const draftDeniedJson = await jsonOf(draftDenied);
  ok(draftDenied.status === 401, "draft of a delivered document without login is 401");
  ok(draftDeniedJson.error === LOGIN_TO_CHANGE_COPY, "draft 401 uses the Sie copy");
  ok(saves === 0, "denied draft writes nothing");

  const draftForeign = await putIntakeDraft(
    new Request("http://localhost/api/intake/draft", {
      method: "PUT",
      headers: { "content-type": "application/json", cookie: loginCookie(OTHER) },
      body: JSON.stringify({ ...draftBody, sessionId: undefined }),
    }),
    draftIo,
  );
  ok(draftForeign.status === 403, "draft with a foreign login is 403");
  ok(saves === 0, "foreign draft writes nothing");

  const draftOwner = await putIntakeDraft(
    new Request("http://localhost/api/intake/draft", {
      method: "PUT",
      headers: { "content-type": "application/json", cookie: loginCookie(BUYER) },
      body: JSON.stringify({ ...draftBody, email: BUYER }),
    }),
    draftIo,
  );
  ok(draftOwner.status === 200, `owner draft is 200 (got ${draftOwner.status})`);
  ok(saves === 1 && savedEmail === BUYER, "owner draft stores the login email");

  const fresh = memoryStore();
  let firstSaves = 0;
  const firstDraft: DraftWriteIo = {
    ...draftIo,
    lookup: fresh,
    saveIntakeDraft: async (draft) => {
      firstSaves += 1;
      savedEmail = draft.email;
      return { backend: "file" };
    },
  };
  const created = await putIntakeDraft(
    new Request("http://localhost/api/intake/draft", {
      method: "PUT",
      headers: { "content-type": "application/json", cookie: checkoutCookie() },
      body: JSON.stringify({
        sessionId: SESSION,
        email: BUYER,
        modus: "gesamt",
        step: 1,
        answers: answers(),
        revision: 1,
      }),
    }),
    firstDraft,
  );
  ok(created.status === 200, "first draft before delivery still works with checkout");
  ok(firstSaves === 1 && savedEmail === BUYER, "first draft email is the Stripe email");

  let uploads = 0;
  const uploadIo: UploadIo = {
    lookup: store,
    resolveCheckout: async () => ({ email: BUYER, stub: false }),
    storeCustomerUpload: async () => {
      uploads += 1;
      return {
        url: "/api/module-upload/file?ref=memory",
        pathname: "gobd/uploads/memory.pdf",
        filename: "a.pdf",
        size: 8,
        contentType: "application/pdf",
        backend: "file" as const,
      };
    },
  };
  const form = new FormData();
  form.set("file", new File([Buffer.from("%PDF-1.4\n")], "a.pdf", { type: "application/pdf" }));
  form.set("modulId", "m01");
  form.set("documentId", documentId);
  form.set("sessionId", SESSION);
  const uploadDenied = await postModuleUpload(
    new Request("http://localhost/api/module-upload", {
      method: "POST",
      headers: { cookie: checkoutCookie() },
      body: form,
    }),
    uploadIo,
  );
  ok(uploadDenied.status === 401, "upload onto a delivered document without login is 401");
  ok(uploads === 0, "denied upload stores nothing");

  const formOwner = new FormData();
  formOwner.set("file", new File([Buffer.from("%PDF-1.4\n")], "a.pdf", { type: "application/pdf" }));
  formOwner.set("modulId", "m01");
  formOwner.set("documentId", documentId);
  formOwner.set("sessionId", SESSION);
  const uploadOwner = await postModuleUpload(
    new Request("http://localhost/api/module-upload", {
      method: "POST",
      headers: { cookie: loginCookie(BUYER) },
      body: formOwner,
    }),
    uploadIo,
  );
  ok(uploadOwner.status === 200, `owner upload is 200 (got ${uploadOwner.status})`);
  ok(uploads === 1, "owner upload stores one file");
}

function checkDownloadStaysOnSession() {
  const download = readFileSync("app/api/docs/[id]/download/route.ts", "utf8");
  ok(download.includes("session_id"), "PDF download still accepts session_id");
  ok(download.includes("canAccessDocument"), "PDF download keeps the existing read check");
  const intake = readFileSync("app/api/intake/route.ts", "utf8");
  ok(intake.includes("withoutSessionCookie"), "intake still does not issue a login cookie");
  ok(!intake.includes("applySessionCookie"), "intake source has no session cookie");
  ok(intake.includes("authorizeDeliveredWrite"), "intake gates delivered writes");
  const writeAt = intake.indexOf("async function writeIntake");
  const gateAt = intake.indexOf("resolveIdentity", writeAt);
  const storeAt = intake.indexOf("prepareDurableIntakeRow", writeAt);
  ok(writeAt > 0 && gateAt > writeAt && storeAt > gateAt, "access check runs before durable storage");
}

async function main() {
  if (!process.env.MAGIC_LINK_SECRET?.trim()) {
    process.env.MAGIC_LINK_SECRET = "check-session-write-offline-secret";
  }
  await checkIntake();
  await checkBlobPointerAndFieldLimit();
  await checkRace();
  await checkDraftAndUpload();
  checkDownloadStaysOnSession();
  console.log("check-session-write-access: green");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
