/**
 * Fragebogen reload: several autosaves keep the last Geschäftsführung,
 * a reload returns that value, and the draft metric counts once.
 * No network, no Blob, no mail.
 *
 *   npm run check:intake-draft-reload
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { putIntakeDraft, readIntakeDraft, type DraftWriteIo } from "../app/api/intake/draft/route";
import { SESSION_COOKIE, createSessionToken } from "../lib/auth";
import { prefillKnownFacts, prefillStammdatenInput, withCatalogDraft } from "../lib/intake-catalog";
import {
  draftRevision,
  normalizeDraftKey,
  preferIntakeSnapshot,
  resolveDraftAfterLoad,
  type IntakeDraft,
  type IntakeDraftSnapshot,
} from "../lib/intake-draft-shared";
import { shouldCountIntakeStart } from "../lib/measure-event";
import {
  DRAFT_CONFLICT_RETRIES,
  draftConflictBackoffMs,
  runDraftConflictRetries,
} from "../lib/draft-conflict-retry";
import { SERVER_SAVE_FAILED_HINT, autosaveHintVisible } from "../lib/fetch-retry";
import { ensureGesamt } from "../lib/module/status";
import { emptyAnswers, type IntakeAnswers } from "../lib/types";

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
  process.env.npm_lifecycle_event = "check:intake-draft-reload";
}

function ok(cond: unknown, msg: string): void {
  assert.ok(cond, msg);
  console.log("ok:", msg);
}

const PLUS = "gobd-test+r321@mail.grokbot.com";
const KEY = normalizeDraftKey({ email: PLUS, modus: "gesamt" });
const VALUES = ["Testperson R321", "A", "B", "C"] as const;

function gfOf(answers: IntakeAnswers | null | undefined): string {
  return answers?.module?.stammdaten?.gf ?? "";
}

function withGf(base: IntakeAnswers, value: string): IntakeAnswers {
  return prefillStammdatenInput(base, { gf: value }, { name: "" });
}

function snapshot(answers: IntakeAnswers, revision: number, savedAt: string): IntakeDraftSnapshot {
  return { answers, step: 0, revision, savedAt, change: { validFrom: "2026-11-07", validTo: "", changeSummary: "", changedBy: PLUS } };
}

function memoryIo(drafts: Map<string, IntakeDraft>, onLoad?: () => void): DraftWriteIo {
  return {
    loadIntakeDraft: async (key) => {
      onLoad?.();
      return drafts.get(key) ?? null;
    },
    saveIntakeDraft: async (draft) => {
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
    resolveCheckout: async () => ({ error: "invalid" }),
  };
}

function put(cookie: string, revision: number, answers: IntakeAnswers) {
  return new Request("http://localhost/api/intake/draft", {
    method: "PUT",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({
      draftKey: KEY,
      email: PLUS,
      modus: "gesamt",
      step: 0,
      revision,
      answers,
      change: { validFrom: "2026-11-07", validTo: "", changeSummary: "", changedBy: PLUS },
      formId: "formreload0001",
      gobd_test: "1",
    }),
  });
}

async function main(): Promise<void> {
  ok(KEY === `email:${PLUS}:default:gesamt`, "a plus-tag login uses one email draft key");
  ok(!KEY.includes("gobd_test"), "gobd_test is not part of the draft key");

  const form = readFileSync("app/intake/intake-form.tsx", "utf8");
  const keyAt = form.indexOf("const draftKey = normalizeDraftKey");
  const keyBlock = form.slice(keyAt, form.indexOf(");", keyAt));
  ok(keyAt > 0 && !keyBlock.includes("gobd_test"), "the form does not build the draft key from gobd_test");
  ok(form.includes('fetch(`/api/intake/draft?${params}`, { cache: "no-store" })'), "the reload read bypasses the browser cache");
  ok(form.includes("localEdited: !untouched"), "an untouched form restores the saved draft");
  ok(form.includes("savingLabelVisible") && form.includes("SERVER_SAVE_FAILED_HINT"), "the existing save hint stays in place");

  const start = prefillKnownFacts(ensureGesamt(withCatalogDraft(emptyAnswers(), "")), { name: "" });
  ok(gfOf(start) === "", "Geschäftsführung starts empty");

  const cookie = `${SESSION_COOKIE}=${createSessionToken(PLUS)}`;
  const drafts = new Map<string, IntakeDraft>();
  const io = memoryIo(drafts);
  let previous: IntakeDraft | null = null;
  let starts = 0;
  let answers = start;
  for (let index = 0; index < VALUES.length; index += 1) {
    if (shouldCountIntakeStart(previous)) starts += 1;
    answers = withGf(answers, VALUES[index]);
    const response = await putIntakeDraft(put(cookie, index + 1, answers), io);
    ok(response.status === 200, `save ${VALUES[index]} is 200 (got ${response.status})`);
    previous = drafts.get(KEY) ?? null;
    ok(gfOf(previous?.answers) === VALUES[index], `the store keeps ${VALUES[index]}`);
  }
  ok(starts === 1, "the draft metric counts the first create once");
  ok(drafts.size === 1, "later autosaves overwrite the same draft");

  const params = new URLSearchParams({ draftKey: KEY });
  const read = new Request(`http://localhost/api/intake/draft?${params}`, { headers: { cookie } });
  ok(new URL(read.url).searchParams.get("draftKey") === KEY, "a plus in the draft key survives the query string");
  const loaded = await readIntakeDraft(read, io);
  ok(loaded.headers.get("cache-control") === "private, no-store", "the draft read is not cacheable");
  const body = (await loaded.json()) as { draft?: { answers: IntakeAnswers; step: number; revision?: number; updatedAt: string } };
  ok(loaded.status === 200 && gfOf(body.draft?.answers) === "C", "reload returns the last Geschäftsführung");

  const saved: IntakeDraftSnapshot = snapshot(body.draft!.answers, draftRevision(body.draft), body.draft!.updatedAt);
  const initial = snapshot(start, 0, "");
  const reloaded = resolveDraftAfterLoad({
    saved,
    localEdited: false,
    localRevision: 0,
    current: { answers: start, step: 0, change: initial.change! },
  });
  ok(reloaded.restored && gfOf(reloaded.answers) === "C", "hydration puts the last value back into the empty form");
  const shown = prefillKnownFacts(reloaded.answers, { name: "" });
  ok(gfOf(shown) === "C", "reloading the field still shows C");

  const typedDuringLoad = resolveDraftAfterLoad({
    saved,
    localEdited: true,
    localRevision: 5,
    current: { answers: withGf(start, "gerade getippt"), step: 0, change: initial.change! },
  });
  ok(!typedDuringLoad.restored && gfOf(typedDuringLoad.answers) === "gerade getippt", "text typed on this view is not replaced");

  const local = snapshot(withGf(start, "C"), 4, "2026-11-07T21:22:00.000Z");
  const olderServer = snapshot(withGf(start, "Testperson R321"), 1, "2026-11-07T21:20:00.000Z");
  ok(gfOf(preferIntakeSnapshot(olderServer, local)?.answers) === "C", "a newer local autosave wins over the first server save");

  const raced = new Map<string, IntakeDraft>();
  const first = drafts.get(KEY)!;
  raced.set(KEY, { ...first, answers: withGf(start, "Testperson R321"), revision: 1 });
  let loads = 0;
  const raceIo = memoryIo(raced, () => {
    loads += 1;
    if (loads === 2) {
      raced.set(KEY, { ...first, answers: withGf(start, "C"), revision: 4, updatedAt: "2026-11-07T21:22:00.000Z" });
    }
  });
  const stale = await putIntakeDraft(put(cookie, 2, withGf(start, "A")), raceIo);
  ok(stale.status === 409, `an older autosave does not overwrite a newer one (got ${stale.status})`);
  ok(gfOf(raced.get(KEY)?.answers) === "C", "the last saved Geschäftsführung stays C");

  ok(DRAFT_CONFLICT_RETRIES === 3, "a 409 is retried three times");
  ok(
    draftConflictBackoffMs(0) === 200 && draftConflictBackoffMs(1) === 400 && draftConflictBackoffMs(2) === 800,
    "conflict backoff stays short",
  );
  ok(
    SERVER_SAVE_FAILED_HINT === "Lokal gesichert – Speichern auf dem Server fehlgeschlagen. Wir versuchen es erneut.",
    "the unsaved notice keeps the existing sentence",
  );
  ok(form.includes("runDraftConflictRetries"), "the form retries a 409 through the bounded helper");
  ok(form.includes("answersRef.current"), "each attempt reads the latest answers ref");
  ok(form.includes('outcome === "conflict"'), "exhausted conflicts surface the unsaved hint");
  ok(autosaveHintVisible({ failures: 1, finalSaveFailed: false }), "the existing hint shows after the bound");

  {
    let latest = "A";
    const sent: string[] = [];
    const saved = await runDraftConflictRetries({
      attempt: async () => {
        sent.push(latest);
        if (sent.length === 1) return "conflict";
        return "saved";
      },
      wait: async () => {
        latest = "C";
      },
    });
    ok(saved === "saved" && sent.join(",") === "A,C", "after one 409 the retry stores the value edited during the wait");
  }
  {
    let n = 0;
    const stopped = await runDraftConflictRetries({
      attempt: async () => {
        n += 1;
        return "conflict";
      },
      wait: async () => {},
    });
    ok(stopped === "conflict" && n === 1 + DRAFT_CONFLICT_RETRIES, "repeated 409 stops after the bound");
  }
  ok(shouldCountIntakeStart(previous) === false, "a 409 retry against an existing draft does not count intake_start again");

  console.log("check-intake-draft-reload: ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
