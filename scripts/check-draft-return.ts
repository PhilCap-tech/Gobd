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
  verifyMagicToken,
  verifySessionToken,
} from "../lib/auth";
import { getMagicLinkSecret } from "../lib/env";
import {
  clearIntakeDraft,
  loadIntakeDraft,
  normalizeDraftKey,
  saveIntakeDraft,
} from "../lib/intake-draft";
import {
  forgetOpenDraft,
  listOpenDraftsForEmail,
  loadOwnerSessionDraft,
  openDraftContinuePath,
  rememberOpenDraft,
} from "../lib/open-drafts";
import { emptyAnswers, type IntakeAnswers } from "../lib/types";

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
    const saved = await putIntakeDraft(
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
    const intakePage = readFileSync("app/intake/page.tsx", "utf8");
    ok(intakePage.includes("loadOwnerSessionDraft"), "intake resumes the owner draft without a fresh checkout cookie");

    const token = createMagicToken(BUYER);
    ok(verifyMagicToken(token) === BUYER, "magic link uses the existing token");
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
