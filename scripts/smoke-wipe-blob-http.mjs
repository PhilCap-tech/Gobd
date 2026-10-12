/**
 * Preview smoke: synthetic draft → admin wipe → head 404 → dry-run empty.
 * No mail, no Stripe, no customer mailbox. The wipe token is minted for the
 * local next process only (see scripts/run-preview-draft-smoke.mjs).
 *
 *   WIPE_SMOKE_TOKEN=… DRAFT_SMOKE_COOKIE_A=… \
 *     node scripts/smoke-wipe-blob-http.mjs http://127.0.0.1:3217
 */
import { createHash } from "node:crypto";
import { get, head } from "@vercel/blob";

const base = (process.argv[2] || "").replace(/\/$/, "");
const email = "draft-blob-smoke@example.com";
const cookie = process.env.DRAFT_SMOKE_COOKIE_A || "";
const wipeToken = process.env.WIPE_SMOKE_TOKEN || "";
const blobToken = process.env.BLOB_READ_WRITE_TOKEN || "";

if (!base) {
  console.error("WIPE_SMOKE_FAIL missing base url");
  process.exit(1);
}
if (!cookie || !wipeToken || !blobToken.trim()) {
  console.error("WIPE_SMOKE_FAIL missing smoke cookie, wipe token, or blob token");
  process.exit(1);
}
if (/cappelletti|sdc-ventures|gmx\.de/i.test(email)) {
  console.error("WIPE_SMOKE_FAIL refused real mailbox");
  process.exit(1);
}

const gesamtKey = `email:${email}:default:gesamt`;
const bereichKey = `email:${email}:default:bereich`;

function draftPath(draftKey) {
  const hash = createHash("sha256").update(draftKey).digest("hex").slice(0, 40);
  return `gobd/drafts/${hash}.json`;
}

const gesamtPath = draftPath(gesamtKey);
const bereichPath = draftPath(bereichKey);
const answers = { rechtsform: "GmbH", gf: "Ada Beispiel" };

function ok(cond, msg) {
  if (!cond) throw new Error(`WIPE_SMOKE_FAIL ${msg}`);
  console.log("ok:", msg);
}

function isBlobNotFound(error) {
  const name = error && typeof error === "object" ? error.name || error.constructor?.name : "";
  return name === "BlobNotFoundError";
}

function isoTime(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  if (typeof value === "string" && value.includes("T")) return value;
  return "";
}

async function cancelStream(stream) {
  if (!stream || typeof stream.cancel !== "function") return;
  try {
    await stream.cancel();
  } catch {
    // already closed
  }
}

/** head() has no cache bypass. Uncached private get() is null on HTTP 404. */
async function probe(pathname) {
  let headState = "error";
  let headUploadedAt = "";
  try {
    const meta = await head(pathname, { token: blobToken });
    headState = "present";
    headUploadedAt = isoTime(meta?.uploadedAt);
  } catch (error) {
    headState = isBlobNotFound(error) ? "404" : "error";
  }
  let getState = "error";
  let getUploadedAt = "";
  try {
    const result = await get(pathname, { access: "private", token: blobToken, useCache: false });
    if (result?.statusCode === 200 && result.stream) {
      getState = "present";
      getUploadedAt = isoTime(result.blob?.uploadedAt);
      await cancelStream(result.stream);
    } else {
      getState = "404";
    }
  } catch (error) {
    getState = isBlobNotFound(error) ? "404" : "error";
  }
  return {
    present: headState === "present" || getState === "present",
    uploadedAt: headUploadedAt || getUploadedAt,
    headState,
    getState,
  };
}

function wipeDetail(result) {
  const drafts = result?.json?.blob?.drafts;
  const names = Array.isArray(drafts?.pathnames) ? drafts.pathnames.join(",") : "";
  return `status=${result?.status} blobError=${result?.json?.blob?.error || drafts?.error || ""} paths=${names} text=${result?.text || ""}`;
}

async function call(path, { method = "GET", cookieValue = "", body, bearer = "" } = {}) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (cookieValue) headers.Cookie = `gobd_session=${cookieValue}`;
  if (bearer) headers.Authorization = `Bearer ${bearer}`;
  const response = await fetch(`${base}${path}`, {
    method,
    redirect: "manual",
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  if (text.includes("Protected deployment") || text.includes("Protected by Vercel Authentication")) {
    throw new Error("WIPE_SMOKE_FAIL Vercel Deployment Protection answered before the app");
  }
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { status: response.status, json, text: text.slice(0, 240) };
}

async function wipe(dryRun) {
  return call("/api/admin/wipe-account", {
    method: "POST",
    bearer: wipeToken,
    body: { email, dryRun },
  });
}

function draftEntry(body) {
  const blobs = body?.blob?.drafts?.blobs;
  return Array.isArray(blobs) ? blobs.find((blob) => blob?.pathname === gesamtPath) : undefined;
}

try {
  const saved = await call("/api/intake/draft", {
    method: "PUT",
    cookieValue: cookie,
    body: {
      draftKey: gesamtKey,
      email,
      modus: "gesamt",
      step: 1,
      answers,
      revision: 1,
    },
  });
  ok(saved.status === 200 && saved.json?.backend === "blob", `draft save is blob (got ${saved.status} ${saved.json?.error || saved.text})`);

  const beforeProbe = await probe(gesamtPath);
  ok(
    beforeProbe.present,
    `draft is readable before wipe (head=${beforeProbe.headState} get=${beforeProbe.getState})`,
  );

  const dry = await wipe(true);
  ok(dry.status === 200 && dry.json?.dryRun === true, `dry-run status 200 (${wipeDetail(dry)})`);
  const listed = dry.json?.blob?.drafts?.pathnames;
  ok(Array.isArray(listed) && listed.includes(gesamtPath), `dry-run lists the saved draft (${wipeDetail(dry)})`);
  ok(Array.isArray(listed) && !listed.includes(bereichPath), `dry-run omits the unsaved sibling key (${wipeDetail(dry)})`);
  const before = draftEntry(dry.json);
  ok(
    typeof before?.uploadedAt === "string" && before.uploadedAt.includes("T"),
    `dry-run includes uploadedAt (${wipeDetail(dry)})`,
  );
  ok(dry.json?.blob?.drafts?.deleted === 0, "dry-run deletes nothing");

  const wiped = await wipe(false);
  ok(wiped.status === 200 && wiped.json?.dryRun === false, `wipe status 200 (${wipeDetail(wiped)})`);
  const removed = draftEntry(wiped.json);
  ok(removed?.deleted === true && !removed.error, `wipe verifies the delete (${wipeDetail(wiped)} entry=${JSON.stringify(removed)})`);
  ok(
    !(wiped.json?.blob?.drafts?.pathnames ?? []).includes(bereichPath),
    "wipe does not report the unsaved sibling",
  );

  let gone = await probe(gesamtPath);
  for (let attempt = 0; attempt < 8 && gone.present; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    gone = await probe(gesamtPath);
  }
  ok(!gone.present, `draft is gone after wipe (head=${gone.headState} get=${gone.getState})`);
  ok(gone.headState === "404" || gone.getState === "404", "absence is a 404 from head() or uncached get()");

  const after = await wipe(true);
  ok(after.status === 200, `second dry-run status 200 (${wipeDetail(after)})`);
  const again = after.json?.blob?.drafts?.pathnames ?? [];
  ok(!again.includes(gesamtPath) && !again.includes(bereichPath), `dry-run after wipe does not list either default key (${wipeDetail(after)})`);
  ok(after.json?.blob?.drafts?.matched === 0, `dry-run after wipe matches no drafts (${wipeDetail(after)})`);

  const goneVia = gone.headState === "404" ? "head-404" : "get-404";
  console.log(
    `WIPE_SMOKE_OK anlegen=blob dry-run uploadedAt=${before.uploadedAt} wipe deleted=1 gone=${goneVia} dry-run=leer`,
  );
} finally {
  const params = new URLSearchParams({ draftKey: gesamtKey });
  await call(`/api/intake/draft?${params}`, { method: "DELETE", cookieValue: cookie }).catch(() => undefined);
}
