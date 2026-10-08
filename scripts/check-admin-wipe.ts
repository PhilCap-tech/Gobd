/**
 * Auth and matching for POST /api/admin/wipe-account.
 * Usage: npx tsx scripts/check-admin-wipe.ts
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import * as route from "../app/api/admin/wipe-account/route";
import {
  adminTokensMatch,
  adminWipeToken,
  cellsMatchEmail,
  classifyBlobPathname,
  classifyStripeSecret,
  collectAccountScope,
  draftKeysForAccount,
  draftPayloadMatchesEmail,
  isWipeEmailAllowed,
  localChapterNameMatches,
  localPdfNameMatches,
  parseWipeEmail,
  redactBackupCells,
  redactForBackup,
  referralKeyMatches,
  resolveDryRun,
  stripeWipeDecision,
  unknownMatchesEmail,
  WIPE_EMAIL_ALLOWLIST,
  WIPE_SMOKE_EMAIL,
  type AccountRecord,
  type AccountScope,
} from "../lib/admin-wipe";
import { commitBlobWipe, planAccountBlobs, type BlobStoreIo } from "../lib/admin-wipe-blobs";
import { handleAdminWipeRequest, resetAdminWipeRateLimit } from "../lib/admin-wipe-http";
import { intakeDraftBlobPath, intakeDraftHash } from "../lib/draft-path";
import { uploadOwnerSegment, wipeUploadOwner } from "../lib/upload-path";

function ok(cond: unknown, msg: string) {
  assert.ok(cond, msg);
  console.log("ok:", msg);
}

const ALLOWED = "cappe@gmx.de";
const OTHER = "kunde@example.com";
const TOKEN = `wipe-test-token-${"a".repeat(24)}`;

function post(body: unknown, token?: string, method = "POST"): Request {
  const headers = new Headers({ "content-type": "application/json" });
  if (token !== undefined) headers.set("authorization", `Bearer ${token}`);
  return new Request("https://example.test/api/admin/wipe-account", {
    method,
    headers,
    body: method === "GET" || method === "HEAD" ? undefined : JSON.stringify(body),
  });
}

async function withToken(value: string | undefined, fn: () => Promise<void>) {
  const previous = process.env.ADMIN_WIPE_TOKEN;
  resetAdminWipeRateLimit();
  if (value === undefined) delete process.env.ADMIN_WIPE_TOKEN;
  else process.env.ADMIN_WIPE_TOKEN = value;
  try {
    await fn();
  } finally {
    if (previous === undefined) delete process.env.ADMIN_WIPE_TOKEN;
    else process.env.ADMIN_WIPE_TOKEN = previous;
    resetAdminWipeRateLimit();
  }
}

async function captureLogs(fn: () => Promise<void>): Promise<string> {
  const lines: string[] = [];
  const methods = ["log", "info", "warn", "error", "debug"] as const;
  const previous = methods.map((name) => console[name].bind(console));
  for (const name of methods) {
    const original = previous[methods.indexOf(name)]!;
    console[name] = (...args: unknown[]) => {
      lines.push(
        args
          .map((arg) => (typeof arg === "string" ? arg : JSON.stringify(arg)))
          .join(" "),
      );
      if (name === "log") original(...args);
    };
  }
  try {
    await fn();
  } finally {
    methods.forEach((name, index) => {
      console[name] = previous[index] as (typeof console)[typeof name];
    });
  }
  return lines.join("\n");
}

function emptyRecord(partial: Partial<AccountRecord>): AccountRecord {
  return {
    email: "",
    documentId: "",
    parentDocumentId: "",
    entityId: "",
    stripeSessionId: "",
    stripeCustomerId: "",
    leadId: "",
    pdfUrl: "",
    chapterContent: "",
    version: "",
    ...partial,
  };
}

async function checkAuth() {
  ok(adminWipeToken(undefined) === null, "missing env disables the endpoint");
  ok(adminWipeToken("short") === null, "token shorter than 32 chars disables the endpoint");
  ok(adminWipeToken(` ${"b".repeat(32)} `) === "b".repeat(32), "surrounding whitespace does not count");
  ok(adminTokensMatch(TOKEN, TOKEN), "matching token");
  ok(!adminTokensMatch(`${TOKEN}x`, TOKEN), "longer token does not match");
  ok(!adminTokensMatch(TOKEN.slice(0, -1), TOKEN), "shorter token does not match");
  ok(!adminTokensMatch(`${TOKEN.slice(0, -1)}b`, TOKEN), "same length wrong token does not match");

  await withToken(undefined, async () => {
    const result = await handleAdminWipeRequest(post({ email: ALLOWED }));
    ok(result.status === 404, "404 without env");
    const response = await route.POST(post({ email: ALLOWED }));
    ok(response.status === 404, "route 404 without env");
    ok(!("GET" in route), "route does not export GET");
  });

  await withToken("too-short", async () => {
    const result = await handleAdminWipeRequest(post({ email: ALLOWED }, "too-short"));
    ok(result.status === 404, "404 when env token is shorter than 32 chars");
  });

  await withToken(TOKEN, async () => {
    const logs = await captureLogs(async () => {
      const missing = await handleAdminWipeRequest(post({ email: ALLOWED }));
      ok(missing.status === 401, "401 without Authorization header");
      const wrong = await handleAdminWipeRequest(post({ email: ALLOWED }, `${TOKEN.slice(0, -1)}b`));
      ok(wrong.status === 401, "401 for a wrong token");
      const basic = await handleAdminWipeRequest(
        new Request("https://example.test/api/admin/wipe-account", {
          method: "POST",
          headers: { authorization: `Basic ${TOKEN}` },
          body: JSON.stringify({ email: ALLOWED }),
        }),
      );
      ok(basic.status === 401, "401 for a non-bearer scheme");
      const routeWrong = await route.POST(post({ email: ALLOWED }, "not-the-token-not-the-token-xxxx"));
      ok(routeWrong.status === 401, "route 401 for a wrong token");
      const body = JSON.stringify(await routeWrong.json());
      ok(!body.includes(TOKEN) && !body.includes("not-the-token"), "401 body does not echo a token");
    });
    ok(!logs.includes(TOKEN), "captured logs omit the wipe token");

    let called = false;
    const forbidden = await handleAdminWipeRequest(post({ email: OTHER }, TOKEN), {
      wipe: async () => {
        called = true;
        return {};
      },
    });
    ok(forbidden.status === 403 && !called, "403 for a foreign email and no wipe call");
    const routeForbidden = await route.POST(post({ email: "Foreign.User@example.com" }, TOKEN));
    ok(routeForbidden.status === 403, "route 403 for a foreign email");

    const invalid = await handleAdminWipeRequest(post({ email: "not-an-email" }, TOKEN), {
      wipe: async () => {
        throw new Error("should not run");
      },
    });
    ok(invalid.status === 400, "400 for an invalid email");

    const method = await handleAdminWipeRequest(post({ email: ALLOWED }, TOKEN, "GET"));
    ok(method.status === 405, "GET on the handler is rejected");

    const calls: Array<{ email: string; dryRun: boolean }> = [];
    const dry = await handleAdminWipeRequest(post({ email: "Cappe@GMX.de" }, TOKEN), {
      wipe: async (input) => {
        calls.push(input);
        return { ok: true };
      },
    });
    ok(
      dry.status === 200 && calls[0]?.email === ALLOWED && calls[0]?.dryRun === true,
      "dryRun defaults to true",
    );

    await handleAdminWipeRequest(post({ email: ALLOWED, dryRun: "false" }, TOKEN), {
      wipe: async (input) => {
        calls.push(input);
        return { ok: true };
      },
    });
    ok(calls[1]?.dryRun === true, "string false stays a dry run");

    await handleAdminWipeRequest(post({ email: ALLOWED, dryRun: false }, TOKEN), {
      wipe: async (input) => {
        calls.push(input);
        return { ok: true };
      },
    });
    ok(calls[2]?.dryRun === false, "boolean false deletes");

    const logs500 = await captureLogs(async () => {
      const failed = await handleAdminWipeRequest(post({ email: ALLOWED }, TOKEN), {
        wipe: async () => {
          throw new Error(`provider said ${TOKEN}`);
        },
      });
      ok(failed.status === 500, "wipe errors become 500");
      ok(!JSON.stringify(failed.body).includes(TOKEN), "500 body redacts the token");
    });
    ok(!logs500.includes(TOKEN), "500 log redacts the token");
  });
}

function checkMatching() {
  ok(
    WIPE_EMAIL_ALLOWLIST.length === 2 &&
      isWipeEmailAllowed("Philip.Cappelletti@SDC-Ventures.com") &&
      isWipeEmailAllowed("  cappe@gmx.de "),
    "allowlist is case-insensitive",
  );
  ok(!isWipeEmailAllowed(OTHER), "foreign email is not allowlisted");
  ok(!isWipeEmailAllowed("cappe@gmx.de.example"), "lookalike domain is rejected");
  const foreign = parseWipeEmail(OTHER);
  ok(!foreign.ok && foreign.reason === "forbidden", "parser forbids foreign email");
  ok(resolveDryRun(undefined) && resolveDryRun(true) && !resolveDryRun(false), "only boolean false deletes");

  ok(
    cellsMatchEmail(["email", "changed_by", "document_id"], ["Cappe@GMX.de", "other", "doc-1"], ALLOWED),
    "intake email matches case-insensitively",
  );
  ok(
    !cellsMatchEmail(
      ["email", "changed_by", "document_id"],
      [OTHER, ALLOWED, "doc-x"],
      ALLOWED,
    ),
    "changed_by does not delete someone else's row",
  );
  ok(
    cellsMatchEmail(["user_email", "entity_id"], ["philip.cappelletti@sdc-ventures.com", "e1"], "Philip.Cappelletti@SDC-Ventures.com"),
    "entities user_email matches",
  );
  ok(cellsMatchEmail(["E-Mail"], [ALLOWED], ALLOWED), "E-Mail header matches");
  ok(
    cellsMatchEmail(["owner", "name"], [ALLOWED, "Firma"], ALLOWED),
    "owner column matches when no email column exists",
  );
  ok(
    !cellsMatchEmail(["email", "owner"], [OTHER, ALLOWED], ALLOWED),
    "strict email column wins over owner",
  );
  ok(!cellsMatchEmail(["notes"], [ALLOWED], ALLOWED), "a notes column is not an owner");

  ok(unknownMatchesEmail({ email: "Cappe@GMX.de", documentId: "doc-1" }, ALLOWED), "file intake matches");
  ok(unknownMatchesEmail({ userEmail: ALLOWED, entityId: "ent-1" }, ALLOWED), "file entity matches");
  ok(
    unknownMatchesEmail({ email: ALLOWED, accessToken: "secret-token" }, ALLOWED),
    "readiness lead matches",
  );
  ok(
    !unknownMatchesEmail({ email: OTHER, changedBy: ALLOWED }, ALLOWED),
    "changedBy in a file row does not match",
  );
  ok(
    !unknownMatchesEmail(
      { answers: { contact: ALLOWED }, email: OTHER },
      ALLOWED,
    ),
    "email buried in answers does not match",
  );

  const redacted = redactBackupCells({
    email: ALLOWED,
    access_token: "lead-secret",
    pdf_url: "https://blob.example/gobd/fam/v1.pdf?token=abc",
  });
  ok(redacted.email === ALLOWED, "backup keeps the email");
  ok(redacted.access_token === "[redacted]", "backup redacts access tokens");
  ok(!JSON.stringify(redacted).includes("lead-secret"), "token value is gone");
  ok(!JSON.stringify(redacted).includes("token=abc"), "signed url query is redacted");
  const fileBackup = redactForBackup({ accessToken: "abc", email: ALLOWED });
  ok(
    fileBackup &&
      typeof fileBackup === "object" &&
      (fileBackup as { accessToken?: string }).accessToken === "[redacted]",
    "file backup redacts accessToken",
  );

  const keys = draftKeysForAccount({
    email: "Cappe@GMX.de",
    documentIds: ["doc-1"],
    sessionIds: ["cs_test_1"],
    entityIds: ["ent-1"],
  });
  ok(keys.includes("doc:doc-1"), "draft key from document id");
  ok(keys.includes("session:cs_test_1:gesamt") && keys.includes("session:cs_test_1:bereich"), "session draft keys");
  ok(keys.includes("email:cappe@gmx.de:default:gesamt"), "email draft key");
  ok(keys.includes("email:cappe@gmx.de:ent-1:bereich"), "email plus entity draft key");
  ok(keys.includes("area:doc-1:gesamt"), "area draft key");

  const scope = collectAccountScope(ALLOWED, [
    emptyRecord({
      email: ALLOWED,
      documentId: "doc-2",
      parentDocumentId: "fam-1",
      entityId: "ent-9",
      stripeSessionId: "cs_test_9",
      stripeCustomerId: "cus_test_9",
      version: "2",
    }),
    emptyRecord({
      email: ALLOWED,
      leadId: "lead-1",
    }),
  ]);
  ok(scope.familyIds.includes("fam-1"), "pdf family id comes from the parent");
  ok(scope.familyIds.includes("readiness-lead-1"), "readiness pdf family id");
  ok(scope.documentIds.includes("doc-2") && scope.entityIds.includes("ent-9"), "document and entity ids");
  ok(scope.stripeCustomerIds.includes("cus_test_9"), "stripe customer id from the row");
  ok(scope.draftHashes.length === scope.draftKeys.length, "each draft key has a hash");
  const draftKey = "email:cappe@gmx.de:default:gesamt";
  const hash = createHash("sha256").update(draftKey).digest("hex").slice(0, 40);
  ok(intakeDraftHash(draftKey) === hash, "draft hash is sha256 prefix");
  ok(intakeDraftBlobPath(draftKey) === `gobd/drafts/${hash}.json`, "draft blob path");

  const blobScope: Pick<AccountScope, "draftHashes" | "uploadOwners" | "familyIds"> = {
    draftHashes: [hash],
    uploadOwners: ["cappegmxde", "ent-9"],
    familyIds: ["fam-1", "readiness-lead-1"],
  };
  ok(classifyBlobPathname(`gobd/drafts/${hash}.json`, blobScope) === "draft", "derived draft blob matches");
  ok(classifyBlobPathname("gobd/drafts/other.json", blobScope) === null, "other draft blob does not match");
  ok(classifyBlobPathname("gobd/uploads/cappegmxde/modul/file.pdf", blobScope) === "upload", "upload owner matches");
  ok(classifyBlobPathname("gobd/uploads/other/modul/file.pdf", blobScope) === null, "other upload owner stays");
  ok(classifyBlobPathname("gobd/fam-1/v2.pdf", blobScope) === "document", "family pdf matches");
  ok(classifyBlobPathname("gobd/readiness-lead-1/v1.pdf", blobScope) === "document", "readiness pdf matches");
  ok(classifyBlobPathname("gobd/someone-else/v1.pdf", blobScope) === null, "other family stays");

  ok(
    draftPayloadMatchesEmail({ email: "Cappe@GMX.de", draftKey: "doc:doc-1", answers: {} }, ALLOWED),
    "draft json email matches",
  );
  ok(
    draftPayloadMatchesEmail({ email: "", draftKey: "email:cappe@gmx.de:ent-9:gesamt" }, ALLOWED),
    "draft key email matches",
  );
  ok(
    !draftPayloadMatchesEmail(
      { email: OTHER, draftKey: "doc:doc-1", answers: { note: ALLOWED } },
      ALLOWED,
    ),
    "draft answers do not count as the owner",
  );

  const owner = wipeUploadOwner("philip.cappelletti@sdc-ventures.com");
  ok(owner === "philipcappellettisdc-venturescom", "upload owner keeps the hyphen and drops @ and dots");
  ok(owner === uploadOwnerSegment("philip.cappelletti@sdc-ventures.com"), "wipe owner matches the upload store");
  ok(wipeUploadOwner("@@@") === null, "empty owner does not select the shared anon bucket");
  ok(localPdfNameMatches("fam-1-v2.pdf", ["fam-1"]), "local pdf name matches the family");
  ok(!localPdfNameMatches("other-v2.pdf", ["fam-1"]), "other local pdf stays");
  ok(localChapterNameMatches("doc-2.json", ["doc-2"]), "local chapter file matches the document");
  ok(referralKeyMatches("doc-doc-2", scope), "referral document key");
  ok(referralKeyMatches("session-cs_test_9", scope), "referral session key");
  ok(!referralKeyMatches("doc-other", scope), "foreign referral key stays");

  ok(classifyStripeSecret("sk_test_123") === "test", "sk_test_ is a test key");
  ok(classifyStripeSecret("rk_test_123") === "test", "rk_test_ is a test key");
  ok(classifyStripeSecret("sk_live_123") === "live", "sk_live_ is live");
  ok(classifyStripeSecret("rk_live_123") === "live", "rk_live_ is live");
  ok(classifyStripeSecret("pk_test_123") === "unknown", "publishable test key is not enough");
  ok(classifyStripeSecret("  ") === "missing", "blank stripe key is missing");
  ok(stripeWipeDecision("sk_live_123").action === "skip", "live key skips stripe");
  ok(stripeWipeDecision("sk_test_123").action === "wipe", "test key allows stripe");
  ok(stripeWipeDecision(undefined).action === "skip", "missing key skips stripe");
}

class BlobNotFoundError extends Error {
  constructor() {
    super("not found");
    this.name = "BlobNotFoundError";
  }
}

type StoredBlob = { uploadedAt: string; body: string };

function memoryBlob(initial: Record<string, StoredBlob>, ignoreDel = false) {
  const blobs = new Map(Object.entries(initial));
  const calls: { op: string; target: string | string[]; token?: string }[] = [];
  let listedUploadedAt: string | undefined;
  const io: BlobStoreIo = {
    async list({ prefix } = {}) {
      const found = [...blobs.entries()].filter(([pathname]) => !prefix || pathname.startsWith(prefix));
      return {
        blobs: found.map(([pathname]) => {
          listedUploadedAt = "2000-01-01T00:00:00.000Z";
          return { pathname, uploadedAt: new Date(listedUploadedAt) };
        }),
        hasMore: false,
      };
    },
    async del(target, options) {
      calls.push({ op: "del", target, token: options?.token });
      if (ignoreDel) return;
      const paths = Array.isArray(target) ? target : [target];
      for (const pathname of paths) blobs.delete(pathname);
    },
    async head(target, options) {
      calls.push({ op: "head", target, token: options?.token });
      const found = blobs.get(target);
      if (!found) throw new BlobNotFoundError();
      return { pathname: target, uploadedAt: new Date(found.uploadedAt) };
    },
    async get(pathname) {
      const found = blobs.get(pathname);
      if (!found) throw new BlobNotFoundError();
      return { statusCode: 200, stream: new Response(found.body).body };
    },
  };
  return {
    io,
    blobs,
    calls,
    listedUploadedAt: () => listedUploadedAt,
  };
}

async function withEnv(
  vars: Record<string, string | undefined>,
  fn: () => Promise<void> | void,
) {
  const previous = new Map<string, string | undefined>();
  for (const key of Object.keys(vars)) previous.set(key, process.env[key]);
  try {
    for (const [key, value] of Object.entries(vars)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await fn();
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

async function checkBlobWipe() {
  const incident = "philip.cappelletti@sdc-ventures.com";
  ok(
    (WIPE_EMAIL_ALLOWLIST as readonly string[]).includes(incident),
    "incident mailbox stays on the wipe allowlist",
  );
  const bereichKey = `email:${incident}:default:bereich`;
  const gesamtKey = `email:${incident}:default:gesamt`;
  const bereichPath = intakeDraftBlobPath(bereichKey);
  const gesamtPath = intakeDraftBlobPath(gesamtKey);
  ok(
    intakeDraftHash(bereichKey) === "139fd4eaf09112ddd6f64e2e917dc5b074aa14ba",
    "bereich default hash is the first reported draft",
  );
  ok(
    intakeDraftHash(gesamtKey) === "43e20cbd7ec661b5e01e94a9a80981f2083fd281",
    "gesamt default hash is the second reported draft",
  );
  const emailOnly = collectAccountScope(incident, []);
  ok(
    emailOnly.draftKeys.length === 2 &&
      emailOnly.draftKeys.includes(bereichKey) &&
      emailOnly.draftKeys.includes(gesamtKey),
    "email alone still derives both default draft keys",
  );
  ok(bereichPath.endsWith("/139fd4eaf09112ddd6f64e2e917dc5b074aa14ba.json"), "bereich pathname");
  ok(gesamtPath.endsWith("/43e20cbd7ec661b5e01e94a9a80981f2083fd281.json"), "gesamt pathname");

  const empty = memoryBlob({});
  const absent = await planAccountBlobs(emailOnly, [], empty.io, "blob-token");
  ok(absent.drafts.matched === 0, "missing derived drafts are not matched");
  ok(absent.drafts.pathnames.length === 0, "dry-run omits pathnames head() cannot see");
  ok(absent.drafts.deleted === 0, "dry-run does not count deletes");
  ok(
    !(absent.drafts.blobs ?? []).some((blob) => blob.pathname === bereichPath || blob.pathname === gesamtPath),
    "dry-run blobs omit the two default keys when head is 404",
  );

  const uploadedAt = "2026-10-08T09:30:00.000Z";
  const presentStore = memoryBlob({
    [gesamtPath]: {
      uploadedAt,
      body: JSON.stringify({ email: incident, draftKey: gesamtKey, answers: { rechtsform: "GmbH" } }),
    },
  });
  const present = await planAccountBlobs(emailOnly, [], presentStore.io, "blob-token");
  ok(present.drafts.pathnames.length === 1 && present.drafts.pathnames[0] === gesamtPath, "only the existing draft is listed");
  ok(!present.drafts.pathnames.includes(bereichPath), "unsaved sibling mode is not listed");
  ok(present.drafts.blobs?.[0]?.uploadedAt === uploadedAt, "uploadedAt comes from head(), not from list()");
  ok(presentStore.listedUploadedAt() !== uploadedAt, "list() timestamp differs from head()");

  const foreign = `gobd/drafts/${"ab".repeat(20)}.json`;
  const matchedBody = memoryBlob({
    [foreign]: {
      uploadedAt,
      body: JSON.stringify({ email: incident, draftKey: "doc:not-derived", answers: {} }),
    },
    "gobd/drafts/other.json": {
      uploadedAt,
      body: JSON.stringify({ email: "other@example.com", draftKey: "doc:other", answers: {} }),
    },
  });
  const matched = await planAccountBlobs(emailOnly, [], matchedBody.io, "blob-token");
  ok(matched.drafts.pathnames.includes(foreign), "content match keeps a non-derived draft");
  ok(!matched.drafts.pathnames.includes("gobd/drafts/other.json"), "foreign draft stays");

  const sticky = memoryBlob(
    {
      [gesamtPath]: { uploadedAt, body: "{}" },
    },
    true,
  );
  const planned = await planAccountBlobs(emailOnly, [], sticky.io, "blob-token");
  await commitBlobWipe(planned.drafts, sticky.io, "blob-token");
  ok(planned.drafts.deleted === 0, "del() that leaves the blob does not count as deleted");
  ok(planned.drafts.blobs?.[0]?.error?.includes("noch vorhanden"), "surviving blob is reported per path");
  ok(planned.drafts.blobs?.[0]?.uploadedAt === uploadedAt, "surviving blob keeps uploadedAt");

  const gone = memoryBlob({
    [gesamtPath]: { uploadedAt, body: "{}" },
    [bereichPath]: { uploadedAt: "2026-10-08T09:31:00.000Z", body: "{}" },
  });
  const both = await planAccountBlobs(emailOnly, [], gone.io, "blob-token");
  ok(both.drafts.matched === 2, "both real default drafts are matched");
  await commitBlobWipe(both.drafts, gone.io, "blob-token");
  ok(
    gone.calls.some((call) => call.op === "del" && call.target === gesamtPath && call.token === "blob-token"),
    "del() receives the pathname and the store token",
  );
  ok(both.drafts.deleted === 2, "head() 404 counts both deletes");
  ok(both.drafts.blobs?.every((blob) => blob.deleted === true && !blob.error), "each deleted path is verified");
  const after = await planAccountBlobs(emailOnly, [], gone.io, "blob-token");
  ok(after.drafts.matched === 0 && after.drafts.pathnames.length === 0, "dry-run after a verified delete is empty");

  await withEnv({ GOBD_BLOB_SMOKE: undefined, VERCEL_ENV: "preview" }, () => {
    ok(!isWipeEmailAllowed(WIPE_SMOKE_EMAIL), "smoke mailbox is refused without the smoke flag");
  });
  await withEnv({ GOBD_BLOB_SMOKE: "1", VERCEL_ENV: "production" }, () => {
    ok(!isWipeEmailAllowed(WIPE_SMOKE_EMAIL), "smoke mailbox is refused in production");
  });
  await withEnv({ GOBD_BLOB_SMOKE: "1", VERCEL_ENV: "preview" }, () => {
    ok(isWipeEmailAllowed(WIPE_SMOKE_EMAIL), "smoke mailbox is allowed on a preview smoke");
    ok(!isWipeEmailAllowed("other-smoke@example.com"), "other example.com mailboxes stay refused");
  });
}

async function main() {
  await checkAuth();
  checkMatching();
  await checkBlobWipe();
  console.log("check-admin-wipe: green");
}

void main();
