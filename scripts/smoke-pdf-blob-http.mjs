/**
 * HTTP smoke for private PDF and upload blobs.
 * No mail, no Stripe, no Sheets. Session cookies are signed in the preview
 * build. The PDF row stores a legacy public Blob URL; the download route
 * reads it with the token.
 *
 *   PDF_SMOKE_COOKIE_A=… PDF_SMOKE_COOKIE_B=… PDF_SMOKE_COOKIE_OTHER=… \
 *     node scripts/smoke-pdf-blob-http.mjs http://127.0.0.1:3217
 */
import { createHash } from "node:crypto";

const base = (process.argv[2] || "").replace(/\/$/, "");
const cookieA = process.env.PDF_SMOKE_COOKIE_A || "";
const cookieB = process.env.PDF_SMOKE_COOKIE_B || "";
const cookieOther = process.env.PDF_SMOKE_COOKIE_OTHER || "";

if (!base) {
  console.error("PDF_SMOKE_FAIL missing base url");
  process.exit(1);
}
if (!cookieA || !cookieB || !cookieOther) {
  console.error("PDF_SMOKE_FAIL missing synthetic session cookies");
  process.exit(1);
}
if (cookieA === cookieB) {
  console.error("PDF_SMOKE_FAIL owner sessions are not distinct");
  process.exit(1);
}

const created = [];

function ok(cond, msg) {
  if (!cond) throw new Error(`PDF_SMOKE_FAIL ${msg}`);
  console.log("ok:", msg);
}

function cookieHeader(cookie) {
  return cookie ? { Cookie: `gobd_session=${cookie}` } : {};
}

async function callJson(path, { method = "GET", cookie = "", body } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    redirect: "manual",
    headers: {
      ...cookieHeader(cookie),
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  if (text.includes("Protected deployment") || text.includes("Protected by Vercel Authentication")) {
    throw new Error("PDF_SMOKE_FAIL Vercel Deployment Protection answered before the app");
  }
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { status: response.status, json, text: text.slice(0, 240) };
}

async function callBytes(path, cookie) {
  const response = await fetch(`${base}${path}`, {
    method: "GET",
    redirect: "manual",
    headers: cookieHeader(cookie),
  });
  const bytes = Buffer.from(await response.arrayBuffer());
  return {
    status: response.status,
    type: response.headers.get("content-type") || "",
    bytes,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}

function remember(pathname) {
  if (pathname) created.push(pathname);
}

async function cleanup() {
  if (created.length === 0) return;
  await callJson("/api/internal/blob-smoke", {
    method: "POST",
    cookie: cookieA,
    body: { action: "delete", pathnames: created },
  }).catch(() => undefined);
}

try {
  const denied = await callJson("/api/internal/blob-smoke", {
    method: "POST",
    body: { action: "pdf" },
  });
  ok(denied.status === 401, `PDF create without session is 401 (got ${denied.status})`);

  const foreignCreate = await callJson("/api/internal/blob-smoke", {
    method: "POST",
    cookie: cookieOther,
    body: { action: "pdf" },
  });
  ok(foreignCreate.status === 403, `PDF create with a foreign session is 403 (got ${foreignCreate.status})`);

  const createdPdf = await callJson("/api/internal/blob-smoke", {
    method: "POST",
    cookie: cookieA,
    body: { action: "pdf" },
  });
  ok(createdPdf.status === 200, `PDF create status 200 (got ${createdPdf.status} ${createdPdf.json?.error || createdPdf.text})`);
  ok(createdPdf.json?.backend === "blob", `PDF storage is blob (got ${String(createdPdf.json?.backend)})`);
  ok(createdPdf.json?.reference === "legacy-url", "sheet reference is the legacy public URL form");
  ok(
    typeof createdPdf.json?.pathname === "string" && createdPdf.json.pathname.startsWith("gobd/smoke-"),
    "PDF pathname is a stable smoke path",
  );
  ok(
    !JSON.stringify(createdPdf.json).includes("blob.vercel-storage.com"),
    "PDF create response does not expose a blob host",
  );
  const pdfPath = `/api/docs/${createdPdf.json.documentId}/download`;
  const pdfSha = createdPdf.json.sha256;
  remember(createdPdf.json.pathname);

  const ownerDownload = await callBytes(pdfPath, cookieA);
  ok(ownerDownload.status === 200, `owner PDF download is 200 (got ${ownerDownload.status})`);
  ok(ownerDownload.type.includes("application/pdf"), `owner PDF content type (got ${ownerDownload.type})`);
  ok(ownerDownload.bytes.subarray(0, 4).toString() === "%PDF", "owner download starts with %PDF");
  ok(ownerDownload.sha256 === pdfSha, "owner download matches the stored PDF");

  const anonDownload = await callBytes(pdfPath, "");
  ok(anonDownload.status === 401, `PDF download without session is 401 (got ${anonDownload.status})`);

  const foreignDownload = await callBytes(pdfPath, cookieOther);
  ok(
    foreignDownload.status === 401 || foreignDownload.status === 403,
    `foreign PDF download is 401 or 403 (got ${foreignDownload.status})`,
  );

  const secondDownload = await callBytes(pdfPath, cookieB);
  ok(secondDownload.status === 200, `second owner session PDF download is 200 (got ${secondDownload.status})`);
  ok(secondDownload.sha256 === pdfSha, "second owner session receives the same PDF");

  const uploadBytes = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
  const form = new FormData();
  form.set("file", new Blob([uploadBytes], { type: "application/pdf" }), "smoke.pdf");
  form.set("modulId", "m01");
  const uploadResponse = await fetch(`${base}/api/module-upload`, {
    method: "POST",
    headers: cookieHeader(cookieA),
    body: form,
  });
  const uploadText = await uploadResponse.text();
  let uploadJson = null;
  try {
    uploadJson = JSON.parse(uploadText);
  } catch {
    uploadJson = null;
  }
  ok(uploadResponse.status === 200, `upload status 200 (got ${uploadResponse.status} ${uploadJson?.error || uploadText.slice(0, 160)})`);
  ok(uploadJson?.backend === "blob", `upload storage is blob (got ${String(uploadJson?.backend)})`);
  ok(
    typeof uploadJson?.uploadUrl === "string" && uploadJson.uploadUrl.startsWith("/api/module-upload/file?ref="),
    "upload URL is the app route",
  );
  ok(!uploadText.includes("blob.vercel-storage.com"), "upload response does not expose a blob host");
  ok(typeof uploadJson?.pathname === "string" && uploadJson.pathname.startsWith("gobd/uploads/"), "upload pathname is stored");
  remember(uploadJson.pathname);
  const uploadSha = createHash("sha256").update(uploadBytes).digest("hex");

  const ownerFile = await callBytes(uploadJson.uploadUrl, cookieA);
  ok(ownerFile.status === 200, `owner upload download is 200 (got ${ownerFile.status})`);
  ok(ownerFile.type.includes("application/pdf"), `owner upload content type (got ${ownerFile.type})`);
  ok(ownerFile.sha256 === uploadSha, "owner upload download matches the stored file");

  const anonFile = await callBytes(uploadJson.uploadUrl, "");
  ok(anonFile.status === 401, `upload download without session is 401 (got ${anonFile.status})`);

  const foreignFile = await callBytes(uploadJson.uploadUrl, cookieOther);
  ok(
    foreignFile.status === 401 || foreignFile.status === 403,
    `foreign upload download is 401 or 403 (got ${foreignFile.status})`,
  );

  const secondFile = await callBytes(uploadJson.uploadUrl, cookieB);
  ok(secondFile.status === 200, `second owner session upload download is 200 (got ${secondFile.status})`);
  ok(secondFile.sha256 === uploadSha, "second owner session receives the same upload");

  const deleted = await callJson("/api/internal/blob-smoke", {
    method: "POST",
    cookie: cookieA,
    body: { action: "delete", pathnames: created.slice() },
  });
  ok(deleted.status === 200 && deleted.json?.ok === true, `synthetic blobs deleted (got ${deleted.status})`);
  created.length = 0;

  console.log("PDF_SMOKE_OK backend=blob owner=200 foreign=denied second-session=same upload=blob delete=ok email=synthetic");
} catch (error) {
  console.error(error instanceof Error ? error.message : "PDF_SMOKE_FAIL");
  process.exitCode = 1;
} finally {
  await cleanup();
  if (process.exitCode) process.exit(process.exitCode);
}
