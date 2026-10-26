/**
 * POST /api/intake is idempotent per submitId.
 *
 * - The same submit sent again lands on the same document id (server HMAC).
 * - A failure after the row is stored, then a retry: one appendRecord, one
 *   delivery mail, one owner notice „Doku abgeschlossen“, same document.
 * - A parallel request with the same id gets 503 + Retry-After, not a second row.
 * - A failure before the row is stored frees the claim; the retry stores once.
 * - A retry without login (checkout grant only) after the first delivery is
 *   answered, not sent to the login gate.
 * Real lib/ops sendDeliveryMail and lib/owner-notice with the mail ledger in a
 * temp dir and a stubbed provider. No network, no Sheets, no Blob.
 *
 *   npx tsx scripts/check-intake-idempotent.ts
 */
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

for (const key of [
  "RESEND_API_KEY",
  "EMAIL_FROM",
  "BLOB_READ_WRITE_TOKEN",
  "GOOGLE_SERVICE_ACCOUNT_EMAIL",
  "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY",
  "GOOGLE_SHEETS_SPREADSHEET_ID",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
]) {
  delete process.env[key];
}
const lifecycle = process.env.npm_lifecycle_event ?? "";
if (!lifecycle.startsWith("check:") && lifecycle !== "prebuild" && lifecycle !== "build") {
  process.env.npm_lifecycle_event = "check:intake-idempotent";
}

function ok(cond: unknown, msg: string): void {
  assert.ok(cond, msg);
  console.log("ok:", msg);
}

// `.example` is reserved and not an owner-notice test domain, so the notice is due.
const BUYER = "kundin-idem@firma.example";
const SESSION = "cs_test_intake_idempotent";
const COMPANY = "Idem Beispiel GmbH";
const ENTITY = "ent_idem";
const SUBMIT_A = "0f6b1c3e-1111-4a2b-8c3d-000000000001";
const SUBMIT_B = "0f6b1c3e-1111-4a2b-8c3d-000000000002";
const SUBMIT_C = "0f6b1c3e-1111-4a2b-8c3d-000000000003";
const SUBMIT_D = "0f6b1c3e-1111-4a2b-8c3d-000000000004";
const SUBMIT_E = "0f6b1c3e-1111-4a2b-8c3d-000000000005";

async function main(): Promise<void> {
  const { submitIntake } = await import("../app/api/intake/route");
  type IntakeIo = import("../app/api/intake/route").IntakeIo;
  const { SESSION_COOKIE, CHECKOUT_GRANT_COOKIE, createSessionToken, createCheckoutGrantToken } =
    await import("../lib/auth");
  const { setBlobMarkerTestDir } = await import("../lib/blob-marker");
  const { claimIntakeSubmit, readSubmitPlan, submitDocumentId, CLAIM_STALE_MS, INTAKE_ROUTE_MAX_DURATION_S } =
    await import("../lib/intake-submit-claim");
  const { MARKER_TTL_MS } = await import("../lib/blob-marker");
  const { isDraftFormClosed } = await import("../lib/draft-closed");
  const { readdirSync, readFileSync } = await import("node:fs");
  const { setMailDedupeTestHooks } = await import("../lib/mail-dedupe");
  const { flushLeadNoticesForTests } = await import("../lib/lead-notice");
  const notice = await import("../lib/owner-notice");
  const { sendDeliveryMail } = await import("../lib/ops");
  const { SheetsUnavailableError, SHEETS_RETRY_MESSAGE } = await import("../lib/sheets-unavailable");
  const { emptyAnswers, emptySheetRow } = await import("../lib/types");
  type SheetRow = import("../lib/types").SheetRow;

  const markerDir = mkdtempSync(path.join(tmpdir(), "intake-idem-markers-"));
  const mailDir = mkdtempSync(path.join(tmpdir(), "intake-idem-mail-"));
  setBlobMarkerTestDir(markerDir);
  const sent: { to: string; subject: string }[] = [];
  setMailDedupeTestHooks({
    dir: mailDir,
    send: async (input) => {
      sent.push({ to: input.to, subject: input.subject });
      return { stub: false, sent: true, id: `stub-${sent.length}` };
    },
  });
  notice.setOwnerNoticeTestMode(true);

  const answers = {
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

  type World = {
    rows: SheetRow[];
    appends: number;
    /** Next appendRecord stores the row, then throws (lost answer). */
    failAfterAppend: boolean;
    /** Next appendRecord throws without storing. */
    failAppend: boolean;
    /** findDocumentById throws while set (Sheets down). */
    lookupDown: boolean;
    /** Next generatePdf throws (before the row). */
    failPdf: boolean;
  };

  function world(): World {
    return { rows: [], appends: 0, failAfterAppend: false, failAppend: false, lookupDown: false, failPdf: false };
  }

  function io(w: World): IntakeIo {
    const family = (sessionId: string) => w.rows.filter((row) => row.stripeSessionId === sessionId);
    return {
      findDocumentById: async (id) => {
        if (w.lookupDown) throw new SheetsUnavailableError(429);
        return w.rows.find((row) => row.documentId === id) ?? null;
      },
      findLatestDocumentByStripeSessionId: async (sessionId) => family(sessionId).at(-1) ?? null,
      listDocumentFamily: async (familyId) =>
        w.rows.filter((row) => (row.parentDocumentId || row.documentId) === familyId),
      listEntitiesByEmail: async () => [],
      getOwnedEntity: async () => null,
      findLatestStripeCustomerIdByEmail: async () => null,
      resolveCheckoutSession: async (sessionId) =>
        sessionId === SESSION
          ? {
              email: BUYER,
              company: COMPANY,
              stripeSessionId: SESSION,
              stripeCustomerId: "cus_test_idem",
              stub: false,
              entityId: ENTITY,
            }
          : { error: "invalid" as const },
      prepareDurableIntakeRow: async (row) => row,
      appendRecord: async (row) => {
        w.appends += 1;
        if (w.failAppend) {
          w.failAppend = false;
          throw new SheetsUnavailableError(429);
        }
        const stored = { ...emptySheetRow(), ...row };
        w.rows.push(stored);
        if (w.failAfterAppend) {
          w.failAfterAppend = false;
          // The row is in the sheet, the answer is lost, and the lookup fails too.
          w.lookupDown = true;
          throw new SheetsUnavailableError(503);
        }
        return { backend: "file", row: stored };
      },
      generatePdf: async (input) => {
        if (w.failPdf) {
          w.failPdf = false;
          throw new Error("pdf down");
        }
        return {
          buffer: Buffer.from("%PDF-1.4\n"),
          documentId: input.documentId || "pdf",
          plan: { status: "ready", chapters: [], openItems: [], pdf: null },
        };
      },
      storePdf: async (input) => ({
        url: "",
        pathname: `memory/${input.documentId}.pdf`,
        backend: "file" as const,
      }),
      sendDeliveryMail,
      deliverLoginLink: async () => "stub" as const,
    };
  }

  function post(submitId: string, cookie: string, extra: Record<string, string> = {}) {
    return new Request("http://localhost/api/intake", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({
        sessionId: SESSION,
        email: BUYER,
        company: COMPANY,
        entityId: ENTITY,
        answers,
        validFrom: "2026-10-26",
        changeSummary: "Idempotenz-Check",
        submitId,
        ...extra,
      }),
    });
  }

  const login = `${SESSION_COOKIE}=${createSessionToken(BUYER)}`;
  const grantOnly = `${CHECKOUT_GRANT_COOKIE}=${createCheckoutGrantToken({ sessionId: SESSION, email: BUYER })}`;

  async function send(w: World, submitId: string, cookie = login, extra: Record<string, string> = {}) {
    const response = await submitIntake(post(submitId, cookie, extra), io(w));
    const body = (await response.json()) as { documentId?: string; error?: string; version?: number };
    await flushLeadNoticesForTests();
    return { status: response.status, body, retryAfter: response.headers.get("Retry-After") };
  }

  const deliveryMails = () => sent.filter((mail) => !mail.subject.includes("Doku abgeschlossen")).length;
  const ownerNotices = () => sent.filter((mail) => mail.subject.includes("Doku abgeschlossen")).length;

  try {
    // 1) Plain double submit: same id, one row, one mail each.
    {
      const w = world();
      const before = { mail: deliveryMails(), notice: ownerNotices() };
      const first = await send(w, SUBMIT_A);
      ok(first.status === 200, `the first submit is 200 (got ${first.status} ${first.body.error ?? ""})`);
      ok(first.body.documentId === submitDocumentId(BUYER, SUBMIT_A), "the document id comes from the server HMAC");
      const second = await send(w, SUBMIT_A);
      ok(second.status === 200, "the same submit again is 200");
      ok(second.body.documentId === first.body.documentId, "the same submit again answers the same document");
      ok(second.body.version === first.body.version, "the same submit again keeps the version");
      ok(w.appends === 1 && w.rows.length === 1, "the same submit twice is one appendRecord");
      ok(deliveryMails() - before.mail === 1, "the same submit twice is one delivery mail");
      ok(ownerNotices() - before.notice === 1, "the same submit twice is one owner notice „Doku abgeschlossen“");
      const other = await send(w, SUBMIT_B);
      ok(other.status === 200 && other.body.documentId !== first.body.documentId, `a new submit id is a new document (got ${other.status} ${other.body.error ?? ""})`);
    }

    // 2) Failure after appendRecord (row stored, answer lost, lookup down): 503,
    //    then retry: same document, one row, one delivery mail, one owner notice.
    {
      const w = world();
      const before = { mail: deliveryMails(), notice: ownerNotices() };
      w.failAfterAppend = true;
      const lost = await send(w, SUBMIT_C);
      ok(lost.status === 503 && lost.retryAfter === "3", `the lost answer is 503 with Retry-After (got ${lost.status})`);
      ok(lost.body.error === SHEETS_RETRY_MESSAGE, "the lost answer asks to retry in a moment");
      ok(w.rows.length === 1, "the row was stored before the failure");
      w.lookupDown = false;
      const retry = await send(w, SUBMIT_C);
      ok(retry.status === 200, `the retry after commit is 200 (got ${retry.status} ${retry.body.error ?? ""})`);
      ok(retry.body.documentId === w.rows[0]?.documentId, "the retry answers the stored document");
      ok(retry.body.documentId === submitDocumentId(BUYER, SUBMIT_C), "same documentId as the first attempt");
      const again = await send(w, SUBMIT_C);
      ok(again.status === 200 && again.body.documentId === retry.body.documentId, "a third attempt answers the same document");
      ok(w.appends === 1 && w.rows.length === 1, "retry after commit: exactly one appendRecord");
      ok(deliveryMails() - before.mail === 1, "retry after commit: exactly one delivery mail");
      ok(ownerNotices() - before.notice === 1, "retry after commit: exactly one owner notice „Doku abgeschlossen“");
    }

    // 2b) The full first request ran (mails sent), only the answer was lost.
    {
      const w = world();
      const first = await send(w, SUBMIT_D);
      ok(first.status === 200, "a complete submit is 200");
      const before = { mail: deliveryMails(), notice: ownerNotices() };
      const retry = await send(w, SUBMIT_D, grantOnly);
      ok(retry.status === 200, `a retry with only the checkout grant is answered (got ${retry.status} ${retry.body.error ?? ""})`);
      ok(retry.body.documentId === first.body.documentId, "the grant-only retry answers the same document");
      ok(w.appends === 1, "the grant-only retry stores nothing");
      ok(deliveryMails() === before.mail, "the retry sends no second delivery mail");
      ok(ownerNotices() === before.notice, "the retry sends no second owner notice");
    }

    // 3) Parallel request on another instance holds the claim: 503, no second row.
    {
      const w = world();
      const id = submitDocumentId(BUYER, SUBMIT_E);
      const plan = { deliveryMail: true, notice: null, firstDelivery: true, stub: false };
      ok((await claimIntakeSubmit(id, plan)) === "claimed", "another instance claims the submit");
      const busy = await send(w, SUBMIT_E);
      ok(busy.status === 503 && busy.retryAfter === "3", `a parallel submit is 503 with Retry-After (got ${busy.status})`);
      ok(busy.body.error === SHEETS_RETRY_MESSAGE, "a parallel submit uses the existing retry copy");
      ok(w.appends === 0, "a parallel submit stores nothing");
      ok((await claimIntakeSubmit(id, plan)) === "busy", "the claim stays exclusive (allowOverwrite: false)");
      const stale = await claimIntakeSubmit(id, plan, Date.now() + 3 * 60 * 1000);
      ok(stale === "claimed", "a claim of a dead request can be taken over after two minutes");
    }

    // 4) Failure before the row (PDF): the claim is freed, the retry stores once.
    {
      const w = world();
      const submitId = "0f6b1c3e-1111-4a2b-8c3d-000000000006";
      w.failPdf = true;
      const failed = await send(w, submitId);
      ok(failed.status >= 500, `a PDF failure is an error (got ${failed.status})`);
      ok((await readSubmitPlan(submitDocumentId(BUYER, submitId))) === null, "a failure before the row frees the claim");
      const retry = await send(w, submitId);
      ok(retry.status === 200 && w.appends === 1, "the retry after a pre-commit failure stores once");
    }

    // 5) appendRecord fails and nothing was stored (lookup works): claim freed, retry stores once.
    {
      const w = world();
      const submitId = "0f6b1c3e-1111-4a2b-8c3d-000000000007";
      w.failAppend = true;
      const failed = await send(w, submitId);
      ok(failed.status === 503, `a failed append is 503 (got ${failed.status})`);
      const retry = await send(w, submitId);
      ok(retry.status === 200 && w.rows.length === 1, "the retry after a failed append stores once");
    }

    // 5b) appendRecord fails, nothing stored, lookup down: id kept as "unsure";
    //     the retry finds no row, takes over and stores once.
    {
      const w = world();
      const submitId = "0f6b1c3e-1111-4a2b-8c3d-000000000009";
      const real = io(w);
      const unsure = await submitIntake(post(submitId, login), {
        ...real,
        appendRecord: async () => {
          w.appends += 1;
          w.lookupDown = true;
          throw new SheetsUnavailableError(503);
        },
      });
      ok(unsure.status === 503, `an append with unknown outcome is 503 (got ${unsure.status})`);
      ok((await readSubmitPlan(submitDocumentId(BUYER, submitId))) !== null, "an unknown outcome keeps the id reserved");
      w.lookupDown = false;
      const retry = await send(w, submitId);
      ok(retry.status === 200 && w.rows.length === 1, "the retry after an unknown outcome stores once");
    }

    // 6) Append stored, lookup works: answered at once, no 503.
    {
      const w = world();
      const submitId = "0f6b1c3e-1111-4a2b-8c3d-000000000008";
      const real = io(w);
      const landed = await submitIntake(post(submitId, login), {
        ...real,
        appendRecord: async (row) => {
          await real.appendRecord(row);
          throw new SheetsUnavailableError(503);
        },
      });
      ok(landed.status === 200, `an append that threw but stored is answered 200 (got ${landed.status})`);
      ok(w.rows.length === 1, "and stored one row");
    }

    // 8) Claim missing (other Blob root = marker gone) but the row exists:
    //    no second appendRecord, no second delivery mail, no second notice.
    {
      const w = world();
      const submitId = "0f6b1c3e-1111-4a2b-8c3d-00000000000a";
      const first = await send(w, submitId);
      ok(first.status === 200 && w.appends === 1, "a stored submit");
      const before = { mail: deliveryMails(), notice: ownerNotices() };
      setBlobMarkerTestDir(mkdtempSync(path.join(tmpdir(), "intake-idem-markers-empty-")));
      const retry = await send(w, submitId);
      ok(retry.status === 200 && retry.body.documentId === first.body.documentId, "missing claim: the retry answers the stored document");
      ok(w.appends === 1, "missing claim + existing row: no second appendRecord");
      ok(deliveryMails() === before.mail, "missing claim + existing row: no second delivery mail");
      ok(ownerNotices() === before.notice, "missing claim + existing row: no second owner notice");

      // Expired claim marker (older than 7 days) with the row present: same result.
      setBlobMarkerTestDir(mkdtempSync(path.join(tmpdir(), "intake-idem-markers-old-")));
      const id = submitDocumentId(BUYER, submitId);
      const plan = { deliveryMail: true, notice: null, firstDelivery: true, stub: false };
      ok((await claimIntakeSubmit(id, plan, Date.now() - MARKER_TTL_MS - 60_000)) !== "busy", "an old claim is written");
      ok((await readSubmitPlan(id)) === null, "a claim older than 7 days is ignored when read");
      const again = await send(w, submitId);
      ok(again.status === 200 && w.appends === 1, "expired claim + existing row: still one appendRecord");
      ok(deliveryMails() === before.mail && ownerNotices() === before.notice, "expired claim: no second mail or notice");
      setBlobMarkerTestDir(markerDir);
    }

    // 9) Takeover only after the route's maxDuration has run out.
    {
      const route = readFileSync("app/api/intake/route.ts", "utf8");
      const declared = Number(/export const maxDuration = (\d+);/.exec(route)?.[1] ?? "0");
      ok(declared === INTAKE_ROUTE_MAX_DURATION_S, `the intake route sets maxDuration = ${INTAKE_ROUTE_MAX_DURATION_S} (got ${declared})`);
      ok(CLAIM_STALE_MS > declared * 1000, "the takeover threshold is above maxDuration");
      const id = submitDocumentId(BUYER, "0f6b1c3e-1111-4a2b-8c3d-00000000000b");
      const plan = { deliveryMail: true, notice: null, firstDelivery: true, stub: false };
      const t0 = Date.now();
      ok((await claimIntakeSubmit(id, plan, t0)) === "claimed", "a claim");
      ok((await claimIntakeSubmit(id, plan, t0 + declared * 1000 + 1000)) === "busy", "no takeover while the holder may still run");
      ok((await claimIntakeSubmit(id, plan, t0 + CLAIM_STALE_MS + 1000)) === "claimed", "takeover after the threshold");
    }

    // 10) Release does not delete: the marker stays, marked released.
    {
      const before = readdirSync(path.join(markerDir, "intake-submit")).length;
      const w = world();
      const submitId = "0f6b1c3e-1111-4a2b-8c3d-00000000000c";
      w.failPdf = true;
      await send(w, submitId);
      const after = readdirSync(path.join(markerDir, "intake-submit")).length;
      ok(after === before + 1, "a released claim stays on disk (nothing deleted)");
      ok((await readSubmitPlan(submitDocumentId(BUYER, submitId))) === null, "a released claim reads as free");
    }

    // 11) The Entwurf key closed by the submit belongs to the owner.
    {
      const w = world();
      const own = `session:${SESSION}:gesamt`;
      const foreign = "email:fremd-idem@firma.example:ent_fremd:gesamt";
      const foreignDoc = "doc:doc-fremd-idem";
      await send(w, "0f6b1c3e-1111-4a2b-8c3d-00000000000d", login, { formId: "formidemown01", draftKey: own });
      ok(await isDraftFormClosed(own, "formidemown01"), "the owner's session draft is closed after the submit");
      await send(w, "0f6b1c3e-1111-4a2b-8c3d-00000000000e", login, { formId: "formidemfrd01", draftKey: foreign });
      ok(!(await isDraftFormClosed(foreign, "formidemfrd01")), "another mailbox's draft key from the body is not closed");
      await send(w, "0f6b1c3e-1111-4a2b-8c3d-00000000000f", login, { formId: "formidemfrd02", draftKey: foreignDoc });
      ok(!(await isDraftFormClosed(foreignDoc, "formidemfrd02")), "an unknown document's draft key is not closed");
      const otherSession = "session:cs_test_fremd:gesamt";
      await send(w, "0f6b1c3e-1111-4a2b-8c3d-000000000010", login, { formId: "formidemfrd03", draftKey: otherSession });
      ok(!(await isDraftFormClosed(otherSession, "formidemfrd03")), "another checkout session's draft key is not closed");
    }

    // 7) Another owner cannot hit someone's submit id.
    {
      const w = world();
      await send(w, SUBMIT_A);
      const otherLogin = `${SESSION_COOKIE}=${createSessionToken("fremd-idem@firma.example")}`;
      const foreign = await send(w, SUBMIT_A, otherLogin);
      ok(foreign.body.documentId !== submitDocumentId(BUYER, SUBMIT_A), "another login never gets the buyer's document");
    }

    console.log("intake idempotent checks passed");
  } finally {
    notice.setOwnerNoticeTestMode(false);
    setMailDedupeTestHooks(null);
    setBlobMarkerTestDir(null);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
