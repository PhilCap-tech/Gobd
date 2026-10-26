/**
 * Kündigungs-Zugriff schließt bei einem Sheets-Ausfall (fail closed).
 *
 * - Lifecycle-Read mit 429: kurzer Backoff (retrySheetsCall 250/700 ms),
 *   dann 503 + Retry-After mit dem bestehenden Text, und kein Schreiben
 *   (Entwurf, Intake, Lieferung).
 * - Die Logzeile nennt nur Fehlerklasse und HTTP-Status: kein Stack, keine
 *   Spreadsheet-ID, keine Adresse.
 * - Ohne Fehler wie bisher: aktives Abo offen, Vertragsende gesperrt.
 * - Die Clients zeigen bei 503 den bestehenden Retry-Text.
 * Kein Netz, Sheets per installSheetsHandler, nur @example.com.
 *
 *   npx tsx scripts/check-kuendigung-failclosed.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function ok(cond: unknown, msg: string): void {
  assert.ok(cond, msg);
  console.log("ok:", msg);
}

const SHEET_ID = "sheet-failclosed-1234567890";
const ACTIVE = "aktiv-failclosed@example.com";
const ENDED = "beendet-failclosed@example.com";
const DOWN = "ausfall-failclosed@example.com";
const SESSION = "cs_test_kuendigung_failclosed";

async function main(): Promise<void> {
  const saved = {
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
    sheet: process.env.GOOGLE_SHEETS_SPREADSHEET_ID,
    blob: process.env.BLOB_READ_WRITE_TOKEN,
    stripe: process.env.STRIPE_SECRET_KEY,
    vercel: process.env.VERCEL,
  };
  process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = "sheets@example.com";
  process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY = "test-key";
  process.env.GOOGLE_SHEETS_SPREADSHEET_ID = SHEET_ID;
  delete process.env.BLOB_READ_WRITE_TOKEN;
  delete process.env.STRIPE_SECRET_KEY;
  process.env.VERCEL = "1";

  const { subscriptionWriteDenial, subscriptionDownloadDenial } = await import("../lib/kuendigung-access");
  const { clearLifecycleReadCache, LIFECYCLE_SHEET_COLUMNS, lifecycleSheetValues } = await import(
    "../lib/kuendigung-store"
  );
  const { emptyLifecycleRow } = await import("../lib/kuendigung");
  const { installSheetsHandler } = await import("../lib/sheets-client");
  const { SHEETS_RETRY_MESSAGE, isSheetsOutage } = await import("../lib/sheets-unavailable");
  const { putIntakeDraft } = await import("../app/api/intake/draft/route");
  type DraftWriteIo = import("../app/api/intake/draft/route").DraftWriteIo;
  const { submitIntake } = await import("../app/api/intake/route");
  type IntakeIo = import("../app/api/intake/route").IntakeIo;
  const { postDelivery } = await import("../app/api/delivery/route");
  const { SESSION_COOKIE, createSessionToken } = await import("../lib/auth");
  const { emptyAnswers, emptySheetRow } = await import("../lib/types");

  const active = emptyLifecycleRow({ email: ACTIVE, subscriptionId: "sub_fc_active", updatedAt: "2026-10-01T00:00:00.000Z" });
  const ended = {
    ...emptyLifecycleRow({ email: ENDED, subscriptionId: "sub_fc_ended", updatedAt: "2026-10-01T00:00:00.000Z" }),
    phase: "restore" as const,
    endedAt: "2026-10-01T00:00:00.000Z",
    restoreUntil: "2026-10-31T00:00:00.000Z",
    purgeAt: "2026-10-31T00:00:00.000Z",
  };

  let down = false;
  let lifecycleReads = 0;
  installSheetsHandler(async ({ op, args }) => {
    const range = typeof args.range === "string" ? args.range : "";
    const ranges = Array.isArray(args.ranges) ? (args.ranges as string[]) : [];
    const lifecycle = [range, ...ranges].some((item) => item.includes("subscription_lifecycle") || item.startsWith("lifecycle"));
    if (lifecycle) lifecycleReads += 1;
    if (down) {
      const error = new Error(`Quota exceeded for spreadsheet ${SHEET_ID} user ${DOWN}`) as Error & {
        response?: { status: number };
        code?: number;
      };
      error.response = { status: 429 };
      error.code = 429;
      throw error;
    }
    const grid = [[...LIFECYCLE_SHEET_COLUMNS], lifecycleSheetValues(active), lifecycleSheetValues(ended)];
    if (op === "values.batchGet") {
      return { data: { valueRanges: ranges.map((item) => ({ values: item.includes("A1:") ? grid.slice(0, 1) : grid.slice(1) })) } };
    }
    if (op === "values.get") return { data: { values: range.includes("A1:") ? grid.slice(0, 1) : grid.slice(1) } };
    if (op === "spreadsheets.get") {
      return { data: { sheets: [{ properties: { title: "subscription_lifecycle", gridProperties: { columnCount: 26 } } }] } };
    }
    throw new Error(`unexpected ${op}`);
  });

  const logged: string[] = [];
  const original = console.error;
  console.error = (...items: unknown[]) => {
    logged.push(
      items
        .map((item) => (item instanceof Error ? `${item.name}: ${item.message}\n${item.stack ?? ""}` : String(item)))
        .join(" "),
    );
  };

  try {
    // ---- Normal behaviour unchanged ----
    clearLifecycleReadCache();
    ok((await subscriptionWriteDenial(ACTIVE)) === null, "an active subscription may write");
    const endedCopy = await subscriptionWriteDenial(ENDED);
    ok(Boolean(endedCopy?.includes("Vertragsende")), "an ended subscription is still blocked with the same copy");
    ok((await subscriptionDownloadDenial(ENDED)) === null, "an ended subscription may still download in the restore window");
    ok((await subscriptionWriteDenial(null)) === null, "no address: nothing to check (as before)");

    // ---- 429: short backoff, then fail closed ----
    clearLifecycleReadCache();
    down = true;
    lifecycleReads = 0;
    logged.length = 0;
    const started = Date.now();
    let thrown: unknown = null;
    try {
      await subscriptionWriteDenial(DOWN);
    } catch (error) {
      thrown = error;
    }
    const took = Date.now() - started;
    ok(isSheetsOutage(thrown), "a 429 on the lifecycle read is a Sheets outage, not an open account");
    ok(lifecycleReads >= 2, `the read was retried (short backoff, ${lifecycleReads} calls)`);
    ok(took < 3000, `the backoff stays short (${took} ms)`);

    const lines = logged.join("\n");
    ok(lines.includes("[kuendigung] Lifecycle lesen fehlgeschlagen"), "the failure is logged");
    const own = logged.filter((line) => line.includes("[kuendigung]"));
    ok(own.every((line) => line.includes('"status":429')), "the log names the HTTP status");
    ok(own.every((line) => /"error":"[A-Za-z]+"/.test(line)), "the log names the error class");
    ok(!lines.includes(SHEET_ID), "no log line contains the spreadsheet id");
    ok(!lines.includes(DOWN), "no log line contains the address");
    ok(!/\n\s+at\s/.test(lines), "no log line contains a stack");

    // ---- Routes: 503 + Retry-After, nothing written ----
    const cookie = `${SESSION_COOKIE}=${createSessionToken(DOWN)}`;
    let draftSaves = 0;
    const draftIo: DraftWriteIo = {
      loadIntakeDraft: async () => null,
      saveIntakeDraft: async () => {
        draftSaves += 1;
        return { backend: "file" };
      },
      clearIntakeDraft: async () => {},
      rememberOpenDraft: async () => true,
      forgetOpenDraft: async () => {},
      lookup: {
        findDocumentById: async () => null,
        listDocumentFamily: async () => [],
        findLatestDocumentByStripeSessionId: async () => null,
      },
      resolveCheckout: async () => ({ email: DOWN, stub: false }),
    };
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
    const draft = await putIntakeDraft(
      new Request("http://localhost/api/intake/draft", {
        method: "PUT",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({ sessionId: SESSION, email: DOWN, step: 1, revision: 1, answers }),
      }),
      draftIo,
    );
    const draftBody = (await draft.json()) as { error?: string };
    ok(draft.status === 503 && draft.headers.get("Retry-After") === "3", `draft PUT is 503 with Retry-After (got ${draft.status})`);
    ok(draftBody.error === SHEETS_RETRY_MESSAGE, "draft PUT uses the existing retry copy");
    ok(draftSaves === 0, "draft PUT writes nothing without a check");

    let appends = 0;
    const intakeIo: IntakeIo = {
      findDocumentById: async () => null,
      findLatestDocumentByStripeSessionId: async () => null,
      listDocumentFamily: async () => [],
      listEntitiesByEmail: async () => [],
      getOwnedEntity: async () => null,
      findLatestStripeCustomerIdByEmail: async () => null,
      resolveCheckoutSession: async () => ({
        email: DOWN,
        company: "Ausfall GmbH",
        stripeSessionId: SESSION,
        stripeCustomerId: "cus_test_fc",
        stub: false,
      }),
      prepareDurableIntakeRow: async (row) => row,
      appendRecord: async (row) => {
        appends += 1;
        return { backend: "file", row: { ...emptySheetRow(), ...row } };
      },
      generatePdf: async () => {
        throw new Error("no PDF expected");
      },
      storePdf: async () => {
        throw new Error("no Blob expected");
      },
      sendDeliveryMail: async () => ({ stub: true, sent: false, action: "delivery" }),
      deliverLoginLink: async () => "stub" as const,
    };
    const intake = await submitIntake(
      new Request("http://localhost/api/intake", {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({ sessionId: SESSION, email: DOWN, answers }),
      }),
      intakeIo,
    );
    const intakeBody = (await intake.json()) as { error?: string };
    ok(intake.status === 503 && intake.headers.get("Retry-After") === "3", `intake POST is 503 with Retry-After (got ${intake.status})`);
    ok(intakeBody.error === SHEETS_RETRY_MESSAGE, "intake POST uses the existing retry copy");
    ok(appends === 0, "intake POST stores nothing without a check");

    const delivery = await postDelivery(
      new Request("http://localhost/api/delivery", {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({ sessionId: SESSION, answers }),
      }),
    );
    const deliveryBody = (await delivery.json()) as { error?: string };
    ok(delivery.status === 503 && delivery.headers.get("Retry-After") === "3", `delivery POST is 503 with Retry-After (got ${delivery.status})`);
    ok(deliveryBody.error === SHEETS_RETRY_MESSAGE, "delivery POST uses the existing retry copy");

    // Back up: the same account writes again (no sticky closed state).
    down = false;
    clearLifecycleReadCache();
    ok((await subscriptionWriteDenial(ACTIVE)) === null, "after the outage an active subscription writes again");

    // ---- Callers and clients ----
    const src = (file: string) => readFileSync(file, "utf8");
    ok(src("app/api/intake/route.ts").includes("sheetsOutageResponse(error)"), "intake route answers an outage with 503");
    ok(src("app/api/intake/draft/route.ts").includes("sheetsOutageResponse(error)"), "draft route answers an outage with 503");
    ok(src("app/api/document/route.ts").includes("sheetsOutageResponse(error)"), "document route answers an outage with 503");
    ok(src("app/api/module-upload/route.ts").includes("sheetsOutageResponse(error)"), "upload route answers an outage with 503");
    const form = src("app/intake/intake-form.tsx");
    ok(
      form.includes('fetchRetrying503("/api/intake"') && form.includes("response.status === 503 ? SHEETS_RETRY_MESSAGE"),
      "the intake form retries a 503 and shows the retry copy",
    );
    ok(form.includes('fetchRetrying503("/api/intake/draft"'), "the draft autosave retries a 503 and keeps the local copy");
    ok(src("app/account/dokument/[id]/document-editor.tsx").includes("setError(data.error"), "the document editor shows the server copy");
    ok(src("components/betriebs-check.tsx").includes("data.error ||"), "the upload shows the server copy");

    console.error = original;
    console.log("kuendigung fail-closed checks passed");
  } finally {
    console.error = original;
    installSheetsHandler(null);
    clearLifecycleReadCache();
    const restore = (name: string, value: string | undefined) => {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    };
    restore("GOOGLE_SERVICE_ACCOUNT_EMAIL", saved.email);
    restore("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY", saved.key);
    restore("GOOGLE_SHEETS_SPREADSHEET_ID", saved.sheet);
    restore("BLOB_READ_WRITE_TOKEN", saved.blob);
    restore("STRIPE_SECRET_KEY", saved.stripe);
    restore("VERCEL", saved.vercel);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
