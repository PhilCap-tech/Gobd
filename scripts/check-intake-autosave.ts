/**
 * Autosave after submit cannot bring the Entwurf back.
 *
 * Client: one PUT at a time (DraftAutosave), stop() aborts the running PUT
 * and nothing is sent after the submit; capped backoff for retries.
 * Server: the submit closes (draftKey, formId). A late or in-flight PUT from
 * that page is a no-op after submit + DELETE; a new page saves normally.
 * No network, no Sheets, no Blob.
 *
 *   npx tsx scripts/check-intake-autosave.ts
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

for (const key of [
  "RESEND_API_KEY",
  "BLOB_READ_WRITE_TOKEN",
  "GOOGLE_SERVICE_ACCOUNT_EMAIL",
  "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY",
  "GOOGLE_SHEETS_SPREADSHEET_ID",
  "STRIPE_SECRET_KEY",
]) {
  delete process.env[key];
}
const lifecycle = process.env.npm_lifecycle_event ?? "";
if (!lifecycle.startsWith("check:") && lifecycle !== "prebuild" && lifecycle !== "build") {
  process.env.npm_lifecycle_event = "check:intake-autosave";
}

function ok(cond: unknown, msg: string): void {
  assert.ok(cond, msg);
  console.log("ok:", msg);
}

const BUYER = "buyer-autosave@example.com";
const SESSION = "cs_test_intake_autosave";
const ENTITY = "ent_autosave";
const FORM = "formautosave0001";
const NEW_FORM = "formautosave0002";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

async function main(): Promise<void> {
  const { DraftAutosave } = await import("../lib/draft-autosave");
  const { backoffMs, BACKOFF_CAP_MS, fetchRetrying503 } = await import("../lib/fetch-retry");
  const { putIntakeDraft, deleteIntakeDraft } = await import("../app/api/intake/draft/route");
  type DraftWriteIo = import("../app/api/intake/draft/route").DraftWriteIo;
  const { submitIntake } = await import("../app/api/intake/route");
  const { SESSION_COOKIE, createSessionToken } = await import("../lib/auth");
  const { setBlobMarkerTestDir } = await import("../lib/blob-marker");
  const { clearDraftClosedMemory, closeDraftForm } = await import("../lib/draft-closed");
  const { setMailDedupeTestHooks } = await import("../lib/mail-dedupe");
  const { emptyAnswers, emptySheetRow } = await import("../lib/types");
  type IntakeDraft = import("../lib/intake-draft-shared").IntakeDraft;
  type SheetRow = import("../lib/types").SheetRow;

  setBlobMarkerTestDir(mkdtempSync(path.join(tmpdir(), "intake-autosave-markers-")));
  setMailDedupeTestHooks({
    dir: mkdtempSync(path.join(tmpdir(), "intake-autosave-mail-")),
    send: async () => ({ stub: false, sent: true, id: "stub" }),
  });

  try {
    // ---- Client: single flight, stop, resume ----
    {
      let running = 0;
      let peak = 0;
      let sends = 0;
      const gates: Array<ReturnType<typeof deferred>> = [];
      const saver = new DraftAutosave(async () => {
        sends += 1;
        running += 1;
        peak = Math.max(peak, running);
        const gate = deferred();
        gates.push(gate);
        await gate.promise;
        running -= 1;
      });
      saver.request();
      for (let i = 0; i < 5; i += 1) saver.request();
      ok(sends === 1, "five edits while a PUT runs send nothing extra yet");
      gates[0]?.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
      ok(sends === 2, "the queued edits go out as one PUT");
      gates[1]?.resolve();
      await saver.idle();
      ok(peak === 1, "never two PUTs at once");
      ok(sends === 2, "six requests were two PUTs");
    }
    {
      let aborted = false;
      let sends = 0;
      const saver = new DraftAutosave(
        (signal) =>
          new Promise<void>((resolve, reject) => {
            sends += 1;
            signal.addEventListener("abort", () => {
              aborted = true;
              reject(new Error("aborted"));
            });
            void resolve;
          }),
      );
      saver.request();
      saver.request();
      saver.stop();
      await saver.idle();
      ok(aborted, "submit aborts the running PUT");
      ok(sends === 1, "the queued PUT is dropped at submit");
      saver.request();
      await saver.idle();
      ok(sends === 1, "no PUT after submit");
      saver.resume();
      saver.request();
      ok(sends === 2, "after a failed submit saving continues");
      saver.stop();
      await saver.idle();
    }

    // ---- Client: retry wait grows, is capped, and stops on abort ----
    {
      const fixed = () => 0;
      ok(backoffMs(3000, 0, fixed) === 3000, "first retry waits Retry-After");
      ok(backoffMs(3000, 1, fixed) === 6000, "second retry waits twice as long");
      ok(backoffMs(3000, 2, fixed) === 12000, "third retry waits four times as long");
      ok(backoffMs(3000, 5, () => 1) === BACKOFF_CAP_MS, "the wait is capped");
      ok(backoffMs(3000, 0, () => 1) === 3600, "jitter adds at most 20 %");
      const waits: number[] = [];
      let calls = 0;
      await fetchRetrying503("/x", undefined, {
        backoff: true,
        random: fixed,
        wait: async (ms) => {
          waits.push(ms);
        },
        fetch: async () => {
          calls += 1;
          return new Response("{}", { status: 503, headers: { "Retry-After": "3" } });
        },
      });
      ok(calls === 4 && waits.join(",") === "3000,6000,12000", "a POST retries three times with 3, 6 and 12 s");
      const controller = new AbortController();
      let after = 0;
      await assert.rejects(
        fetchRetrying503(
          "/x",
          { signal: controller.signal },
          {
            retries: 1,
            wait: async () => {
              controller.abort();
            },
            fetch: async () => {
              after += 1;
              return new Response("{}", { status: 503 });
            },
          },
        ),
        (error: unknown) => error instanceof Error && error.name === "AbortError",
      );
      ok(after === 1, "an aborted PUT does not retry");
    }

    // ---- Client source: wired the same way in the form ----
    {
      const form = readFileSync("app/intake/intake-form.tsx", "utf8");
      const submitAt = form.indexOf("async function submit()");
      const stopAt = form.indexOf("autosave.stop()", submitAt);
      const postAt = form.indexOf('"/api/intake"', submitAt);
      ok(submitAt > 0 && stopAt > submitAt && stopAt < postAt, "the form stops autosave before the POST");
      ok(form.includes("if (submittingRef.current) return;"), "a second click while submitting does nothing");
      ok(/autosave\.request\(\), 1500\)/.test(form), "autosave waits 1.5 s and goes through the single-flight saver");
      ok(form.includes("submitId: submitIdRef.current.id") && form.includes("formId,"), "the POST sends submitId and formId");
      ok(form.includes("{ retries: 1, backoff: true }"), "a draft PUT retries once with backoff");
    }

    // ---- Server: no resurrected draft ----
    const answers = { ...emptyAnswers(), branchen: ["Handel"], rechtsform: "GmbH" };
    const draftKey = `session:${SESSION}:gesamt`;
    const cookie = `${SESSION_COOKIE}=${createSessionToken(BUYER)}`;
    const drafts = new Map<string, IntakeDraft>();
    let saves = 0;
    let onLoad: (() => Promise<void>) | null = null;
    const draftIo: DraftWriteIo = {
      loadIntakeDraft: async (key) => {
        const hook = onLoad;
        onLoad = null;
        if (hook) await hook();
        return drafts.get(key) ?? null;
      },
      saveIntakeDraft: async (draft) => {
        saves += 1;
        drafts.set(draft.draftKey, draft);
        return { backend: "file" };
      },
      clearIntakeDraft: async (key) => {
        drafts.delete(key);
      },
      rememberOpenDraft: async () => true,
      forgetOpenDraft: async () => {},
      lookup: {
        findDocumentById: async () => null,
        listDocumentFamily: async () => [],
        findLatestDocumentByStripeSessionId: async () => null,
      },
      resolveCheckout: async (sessionId) =>
        sessionId === SESSION ? { email: BUYER, stub: false } : { error: "invalid" as const },
    };
    function put(formId: string, revision: number, text: string) {
      return new Request("http://localhost/api/intake/draft", {
        method: "PUT",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({
          draftKey,
          sessionId: SESSION,
          email: BUYER,
          entityId: ENTITY,
          step: 2,
          revision,
          answers: { ...answers, gf: text },
          formId,
        }),
      });
    }
    function del() {
      const params = new URLSearchParams({ draftKey, sessionId: SESSION });
      return new Request(`http://localhost/api/intake/draft?${params}`, { method: "DELETE", headers: { cookie } });
    }

    const saved = await putIntakeDraft(put(FORM, 1, "Ada"), draftIo);
    ok(saved.status === 200 && drafts.has(draftKey), "an open page saves its Entwurf");
    const same = await putIntakeDraft(put(FORM, 1, "Ada"), draftIo);
    ok(same.status === 200 && saves === 1, "an unchanged PUT writes nothing");

    // Submit through the real POST: it closes this page's formId.
    const rows: SheetRow[] = [];
    const posted = await submitIntake(
      new Request("http://localhost/api/intake", {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({
          sessionId: SESSION,
          email: BUYER,
          entityId: ENTITY,
          answers: { ...emptyAnswers(), ...answers, mitarbeitende: "3", fibu: ["x"], weitereSysteme: "", eingangsbelege: ["mail"], ausgangsrechnungen: ["tool"], archiv: "cloud", hosting: "x", backup: ["t"], zugriff: "gf", gf: "Ada", buchhaltung: "intern", it: "extern", steuerberater: "Nord" },
          submitId: "5d1e0a52-2222-4b3c-9d4e-000000000001",
          formId: FORM,
          draftKey,
        }),
      }),
      {
        findDocumentById: async (id) => rows.find((row) => row.documentId === id) ?? null,
        findLatestDocumentByStripeSessionId: async () => null,
        listDocumentFamily: async () => [],
        listEntitiesByEmail: async () => [],
        getOwnedEntity: async () => null,
        findLatestStripeCustomerIdByEmail: async () => null,
        resolveCheckoutSession: async () => ({
          email: BUYER,
          company: "Autosave GmbH",
          stripeSessionId: SESSION,
          stripeCustomerId: "cus_test_autosave",
          stub: false,
          entityId: ENTITY,
        }),
        prepareDurableIntakeRow: async (row) => row,
        appendRecord: async (row) => {
          const stored = { ...emptySheetRow(), ...row };
          rows.push(stored);
          return { backend: "file", row: stored };
        },
        generatePdf: async (input) => ({
          buffer: Buffer.from("%PDF-1.4\n"),
          documentId: input.documentId || "pdf",
          plan: { status: "ready", chapters: [], openItems: [], pdf: null },
        }),
        storePdf: async () => ({ url: "", pathname: "memory/a.pdf", backend: "file" as const }),
        sendDeliveryMail: async () => ({ stub: true, sent: false, action: "delivery" }),
        deliverLoginLink: async () => "stub" as const,
        queueOwnerNotice: () => {},
      },
    );
    ok(posted.status === 200, `the submit is 200 (got ${posted.status})`);
    const deleted = await deleteIntakeDraft(del(), draftIo);
    ok(deleted.status < 300 && !drafts.has(draftKey), "clearDraft deletes the Entwurf");

    const savesBefore = saves;
    const late = await putIntakeDraft(put(FORM, 2, "Ada spät"), draftIo);
    const lateBody = (await late.json()) as { closed?: boolean };
    ok(late.status === 200 && lateBody.closed === true, "a late PUT from the submitted page is a no-op");
    ok(!drafts.has(draftKey) && saves === savesBefore, "the late PUT does not re-create the Entwurf");

    clearDraftClosedMemory();
    const otherInstance = await putIntakeDraft(put(FORM, 3, "Ada noch später"), draftIo);
    ok(
      ((await otherInstance.json()) as { closed?: boolean }).closed === true && !drafts.has(draftKey),
      "another instance sees the closed page too (stored marker)",
    );

    // In flight: the PUT passed the first check, then the submit landed.
    const inflightForm = "formautosave0003";
    onLoad = async () => {
      await closeDraftForm(draftKey, inflightForm);
    };
    const inflight = await putIntakeDraft(put(inflightForm, 4, "Ada parallel"), draftIo);
    ok(
      ((await inflight.json()) as { closed?: boolean }).closed === true && !drafts.has(draftKey),
      "a PUT in flight while the submit lands writes nothing",
    );

    const fresh = await putIntakeDraft(put(NEW_FORM, 1, "Neue Seite"), draftIo);
    ok(fresh.status === 200 && drafts.has(draftKey), "a newly opened page saves normally");

    console.log("intake autosave checks passed");
  } finally {
    setMailDedupeTestHooks(null);
    setBlobMarkerTestDir(null);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
