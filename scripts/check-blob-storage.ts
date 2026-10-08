/**
 * Private Blob contract for PDFs, chapter text and customer uploads.
 *
 *   npx tsx scripts/check-blob-storage.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  BlobStorageError,
  canAccessCustomerUpload,
  deleteStoredBlob,
  loadDocumentPdf,
  persistChapterContent,
  resolveChapterContent,
  storeCustomerUpload,
  storePdf,
  type BlobIo,
  type UploadAccessDeps,
} from "../lib/blob";
import { blobPathFromLocator, customerUploadHref } from "../lib/blob-ref";
import { encodeChapterContentRef, SHEETS_CELL_SAFE_CHARS } from "../lib/document-content";
import { getFileFallbackDir } from "../lib/store";
import { emptySheetRow } from "../lib/types";

const TOKEN = "vercel_blob_rw_teststore_abcdefghijklmnopqrstuvwxyz";
const MARKER = "GEHEIM-PDF-MARKER";
const LEGACY_HOST = "https://smokestore.public.blob.vercel-storage.com";

function ok(cond: unknown, msg: string) {
  assert.ok(cond, msg);
  console.log("ok:", msg);
}

type PutCall = {
  pathname: string;
  body: Buffer | string;
  access?: string;
  allowOverwrite?: boolean;
  addRandomSuffix?: boolean;
  token?: string;
  contentType?: string;
};

type Memory = {
  io: BlobIo;
  blobs: Map<string, { body: Buffer; contentType: string }>;
  puts: PutCall[];
  gets: { pathname: string; access?: string; useCache?: boolean; token?: string }[];
  failPut?: Error;
  failGet?: Error;
};

function memory(): Memory {
  const blobs = new Map<string, { body: Buffer; contentType: string }>();
  const state: Memory = { io: {} as BlobIo, blobs, puts: [], gets: [] };
  state.io = {
    async put(pathname, body, options) {
      if (state.failPut) throw state.failPut;
      const buffer = Buffer.isBuffer(body) ? body : Buffer.from(body);
      state.puts.push({
        pathname,
        body: buffer,
        access: options.access,
        allowOverwrite: options.allowOverwrite,
        addRandomSuffix: options.addRandomSuffix,
        token: options.token,
        contentType: options.contentType,
      });
      blobs.set(pathname, { body: buffer, contentType: options.contentType ?? "" });
      return { url: `${LEGACY_HOST}/${pathname}`, pathname, contentType: options.contentType };
    },
    async get(pathname, options) {
      if (state.failGet) throw state.failGet;
      state.gets.push({
        pathname,
        access: options.access,
        useCache: options.useCache,
        token: options.token,
      });
      const stored = blobs.get(pathname);
      if (!stored) return null;
      return {
        statusCode: 200,
        stream: new Response(new Uint8Array(stored.body)).body,
        blob: { contentType: stored.contentType },
      } as Awaited<ReturnType<BlobIo["get"]>>;
    },
    async del(pathname) {
      blobs.delete(pathname);
    },
  };
  return state;
}

async function withToken(token: string | undefined, run: () => Promise<void>) {
  const previous = process.env.BLOB_READ_WRITE_TOKEN;
  if (token === undefined) delete process.env.BLOB_READ_WRITE_TOKEN;
  else process.env.BLOB_READ_WRITE_TOKEN = token;
  try {
    await run();
  } finally {
    if (previous === undefined) delete process.env.BLOB_READ_WRITE_TOKEN;
    else process.env.BLOB_READ_WRITE_TOKEN = previous;
  }
}

async function withSheets(enabled: boolean, run: () => Promise<void>) {
  const keys = [
    "GOOGLE_SERVICE_ACCOUNT_EMAIL",
    "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY",
    "GOOGLE_SHEETS_SPREADSHEET_ID",
  ] as const;
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  if (enabled) {
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = "sheet@example.com";
    process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY = "test-key";
    process.env.GOOGLE_SHEETS_SPREADSHEET_ID = "sheet-id";
  } else {
    for (const key of keys) delete process.env[key];
  }
  try {
    await run();
  } finally {
    for (const key of keys) {
      const value = previous[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

async function captureErrors(run: () => Promise<void>): Promise<string[]> {
  const lines: string[] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => {
    lines.push(args.map((part) => String(part)).join(" "));
  };
  try {
    await run();
  } finally {
    console.error = original;
  }
  return lines;
}

class BlobAccessError extends Error {}

function pdfBuffer(text: string): Buffer {
  return Buffer.from(`%PDF-1.4\n${text}\n%%EOF\n`);
}

function throwingDeps(): UploadAccessDeps {
  const fail = async () => {
    throw new Error("store should not be queried");
  };
  return { documentsByEmail: fail, entitiesByEmail: fail, rowBySession: fail };
}

function emptyDeps(): UploadAccessDeps {
  return {
    documentsByEmail: async () => [],
    entitiesByEmail: async () => [],
    rowBySession: async () => null,
  };
}

async function checkLocators() {
  ok(
    blobPathFromLocator(`${LEGACY_HOST}/gobd/parent/v2.pdf`) === "gobd/parent/v2.pdf",
    "public blob URL yields the pathname",
  );
  ok(
    blobPathFromLocator("https://store.private.blob.vercel-storage.com/gobd/readiness-lead/v1.pdf?download=1") ===
      "gobd/readiness-lead/v1.pdf",
    "private blob URL drops the query",
  );
  ok(blobPathFromLocator("gobd/parent/v1-chapters.json") === "gobd/parent/v1-chapters.json", "bare pathname stays");
  ok(blobPathFromLocator("https://evil.example/gobd/parent/v1.pdf") === null, "foreign hosts are not blob paths");
  ok(blobPathFromLocator("gobd/../etc/passwd") === null, "dot segments are rejected");
  const legacyUpload = `${LEGACY_HOST}/gobd/uploads/owner/m01/stamp-datei.pdf`;
  const href = customerUploadHref(legacyUpload, "cs_test_1");
  ok(href.startsWith("/api/module-upload/file?ref="), "legacy upload URL becomes the app route");
  ok(!href.includes("blob.vercel-storage.com"), "app route does not expose the blob host");
  ok(href.includes("session_id="), "optional checkout session is kept on the app route");
  ok(
    customerUploadHref(href, "cs_test_1") === href,
    "an app route is not wrapped a second time",
  );
}

async function checkPdf() {
  await withToken(undefined, async () => {
    const store = memory();
    const stored = await storePdf(
      { familyId: "fam-local", documentId: "doc-local", version: 1, buffer: pdfBuffer("local") },
      store.io,
    );
    ok(stored.backend === "file", "without a token the PDF backend is file");
    ok(store.puts.length === 0, "without a token blob put is not called");
    ok(stored.url === "", "file PDF has no public URL");
    await unlink(stored.pathname).catch(() => undefined);
  });

  await withToken(TOKEN, async () => {
    const store = memory();
    const buffer = pdfBuffer(MARKER);
    const stored = await storePdf(
      { familyId: "fam-1", documentId: "doc-1", version: 2, buffer },
      store.io,
    );
    ok(stored.backend === "blob", "with a token the PDF backend is blob");
    ok(stored.url === "", "blob PDF URL is not returned");
    ok(!stored.pathname.includes("blob.vercel"), "stored pathname is not a host URL");
    ok(stored.pathname === "gobd/fam-1/v2.pdf", "PDF pathname is stable");
    const put = store.puts[0];
    ok(put?.access === "private", "PDF put uses private access");
    ok(put?.allowOverwrite === true, "PDF put overwrites the same version");
    ok(put?.addRandomSuffix === false, "PDF put keeps the pathname");
    ok(put?.token === TOKEN, "PDF put sends the token");
    ok(put?.contentType === "application/pdf", "PDF content type is application/pdf");

    const legacy = `${LEGACY_HOST}/${stored.pathname}`;
    const row = emptySheetRow();
    row.pdfUrl = legacy;
    row.documentId = "doc-1";
    row.version = "2";
    const loaded = await loadDocumentPdf(row, store.io);
    ok(loaded.equals(buffer), "a legacy public URL is read through the private SDK");
    ok(store.gets[0]?.pathname === stored.pathname, "read uses the pathname from the old URL");
    ok(store.gets[0]?.access === "private", "PDF get uses private access");
    ok(store.gets[0]?.useCache === false, "PDF get bypasses the CDN cache");
    ok(store.gets[0]?.token === TOKEN, "PDF get sends the token");

    const pathnameRow = emptySheetRow();
    pathnameRow.pdfUrl = stored.pathname;
    const fromPath = await loadDocumentPdf(pathnameRow, store.io);
    ok(fromPath.equals(buffer), "a stored pathname reads the same PDF");

    await storePdf(
      { familyId: "fam-1", documentId: "doc-1", version: 2, buffer: pdfBuffer("neu") },
      store.io,
    );
    ok(store.puts.at(-1)?.pathname === stored.pathname, "regenerate targets the same pathname");

    store.failPut = new BlobAccessError("denied");
    let writeError: unknown;
    const logs = await captureErrors(async () => {
      try {
        await storePdf(
          { familyId: "fam-fail", documentId: "doc-fail", version: 1, buffer: pdfBuffer(MARKER) },
          store.io,
        );
      } catch (error) {
        writeError = error;
      }
    });
    ok(writeError instanceof BlobStorageError, "PDF write failure is BlobStorageError");
    ok((writeError as BlobStorageError).operation === "write", "PDF write failure stays on write");
    ok((writeError as BlobStorageError).errorClass === "BlobAccessError", "PDF write failure keeps the error class");
    ok(
      logs.some((line) => line.includes("Blob-Schreiben fehlgeschlagen") && line.includes("BlobAccessError")),
      "PDF write failure is logged with its class",
    );
    ok(!logs.some((line) => line.includes(MARKER) || line.includes(TOKEN)), "PDF write log has no contents and no token");
    const leaked = path.join(getFileFallbackDir(), "pdfs", "fam-fail-v1.pdf");
    await assert.rejects(readFile(leaked));
    ok(true, "a failed blob write does not create a local PDF");
  });
}

async function checkChapters() {
  const big = `${MARKER}${"x".repeat(SHEETS_CELL_SAFE_CHARS)}`;
  await withSheets(true, async () => {
    await withToken(undefined, async () => {
      if (process.env.VERCEL === "1" || process.env.VERCEL === "true") {
        await assert.rejects(
          persistChapterContent({
            familyId: "fam-ch",
            documentId: "doc-ch-vercel",
            version: 1,
            json: big,
          }),
          /BLOB_READ_WRITE_TOKEN/,
          "on Vercel a long chapter without a token fails closed",
        );
        return;
      }
      const store = memory();
      const ref = await persistChapterContent(
        { familyId: "fam-ch", documentId: "doc-ch-file", version: 1, json: big },
        store.io,
      );
      ok(store.puts.length === 0, "without a token chapter text is not uploaded");
      const loaded = await resolveChapterContent(ref, store.io);
      ok(loaded === big, "file chapter round-trip keeps the text");
      const locator = ref.includes("doc-ch-file") ? ref : "";
      ok(locator.includes("doc-ch-file"), "file chapter ref points at the local file");
      const file = path.join(getFileFallbackDir(), "chapters", "doc-ch-file.json");
      await unlink(file).catch(() => undefined);
    });

    await withToken(TOKEN, async () => {
      const store = memory();
      const ref = await persistChapterContent(
        { familyId: "fam-ch", documentId: "doc-ch", version: 3, json: big },
        store.io,
      );
      ok(store.puts[0]?.access === "private", "chapter put uses private access");
      ok(store.puts[0]?.allowOverwrite === true, "chapter put overwrites the same version");
      ok(store.puts[0]?.addRandomSuffix === false, "chapter put keeps the pathname");
      ok(store.puts[0]?.pathname === "gobd/fam-ch/v3-chapters.json", "chapter pathname is stable");
      ok(!ref.includes("http"), "chapter ref stores a pathname, not a URL");
      ok(ref.includes("gobd/fam-ch/v3-chapters.json"), "chapter ref contains the pathname");
      ok((await resolveChapterContent(ref, store.io)) === big, "chapter pathname round-trip");

      const legacy = encodeChapterContentRef(`${LEGACY_HOST}/gobd/fam-ch/v3-chapters.json`);
      ok((await resolveChapterContent(legacy, store.io)) === big, "legacy chapter URL round-trip");

      await mkdir(path.join(getFileFallbackDir(), "chapters"), { recursive: true });
      const poison = path.join(getFileFallbackDir(), "chapters", "doc-ch.json");
      await writeFile(poison, "NUR-DATEI", "utf8");
      store.blobs.clear();
      ok((await resolveChapterContent(ref, store.io)) === "", "a missing blob does not fall back to a local chapter file");
      await unlink(poison).catch(() => undefined);

      store.failPut = new BlobAccessError("denied");
      let writeError: unknown;
      const logs = await captureErrors(async () => {
        try {
          await persistChapterContent(
            { familyId: "fam-ch", documentId: "doc-ch-fail", version: 1, json: big },
            store.io,
          );
        } catch (error) {
          writeError = error;
        }
      });
      ok(writeError instanceof BlobStorageError, "chapter write failure is BlobStorageError");
      ok(!logs.some((line) => line.includes(MARKER)), "chapter write log has no document text");
      const leaked = path.join(getFileFallbackDir(), "chapters", "doc-ch-fail.json");
      await assert.rejects(readFile(leaked));
      ok(true, "a failed chapter upload does not create a local file");
    });
  });

  await withSheets(false, async () => {
    await withToken(TOKEN, async () => {
      const store = memory();
      const inline = await persistChapterContent(
        { familyId: "fam", documentId: "doc", version: 1, json: big },
        store.io,
      );
      ok(inline === big && store.puts.length === 0, "without Sheets the long chapter stays inline");
    });
  });
}

async function checkUploads() {
  const bytes = pdfBuffer(MARKER);
  await withToken(undefined, async () => {
    const store = memory();
    const stored = await storeCustomerUpload(
      {
        ownerKey: "pdf-blob-smoke@example.com",
        modulId: "m01",
        filename: "beleg.pdf",
        contentType: "application/pdf",
        buffer: bytes,
      },
      store.io,
    );
    ok(stored.backend === "file", "without a token the upload backend is file");
    ok(store.puts.length === 0, "without a token upload put is not called");
    ok(stored.url.startsWith("/api/module-upload/file?ref="), "file upload href uses the app route");
    await unlink(stored.pathname).catch(() => undefined);
  });

  await withToken(TOKEN, async () => {
    const store = memory();
    const stored = await storeCustomerUpload(
      {
        ownerKey: "pdf-blob-smoke@example.com",
        modulId: "m01",
        filename: "beleg.pdf",
        contentType: "application/pdf",
        buffer: bytes,
      },
      store.io,
    );
    ok(stored.backend === "blob", "with a token the upload backend is blob");
    const put = store.puts[0];
    ok(put?.access === "private", "upload put uses private access");
    ok(put?.allowOverwrite === false, "upload put does not overwrite");
    ok(put?.addRandomSuffix === false, "upload pathname is chosen by the app");
    ok(put?.token === TOKEN, "upload put sends the token");
    ok(stored.pathname.startsWith("gobd/uploads/pdf-blob-smokeexamplecom/m01/"), "upload owner is sanitized");
    ok(!stored.pathname.includes("@") && !stored.pathname.includes("example.com"), "upload path has no raw email");
    ok(stored.url.startsWith("/api/module-upload/file?ref="), "upload URL is the app route");
    ok(!stored.url.includes("blob.vercel-storage.com"), "upload URL hides the blob host");
    ok(!`${stored.url} ${stored.pathname}`.includes(MARKER), "upload metadata has no file contents");

    const owner = "gobd/uploads/pdf-blob-smokeexamplecom/m01/file.pdf";
    ok(
      (await canAccessCustomerUpload(owner, { sessionEmail: "pdf-blob-smoke@example.com" }, throwingDeps())) === "ok",
      "owner session matches the sanitized email without a store lookup",
    );
    ok(
      (await canAccessCustomerUpload(owner, {}, emptyDeps())) === "anonymous",
      "upload without a session is anonymous",
    );
    ok(
      (await canAccessCustomerUpload(owner, { sessionEmail: "other@example.com" }, emptyDeps())) === "forbidden",
      "a foreign session cannot read the upload",
    );
    ok(
      (await canAccessCustomerUpload(
        "gobd/uploads/entity-1/m01/file.pdf",
        { sessionEmail: "owner@example.com" },
        {
          ...emptyDeps(),
          entitiesByEmail: async () => [{ entityId: "entity-1" }],
        },
      )) === "ok",
      "an owned Firma matches the upload owner segment",
    );
    const referenced = "gobd/uploads/other-owner/m02/file.pdf";
    ok(
      (await canAccessCustomerUpload(referenced, { sessionEmail: "owner@example.com" }, {
        ...emptyDeps(),
        documentsByEmail: async () => {
          const row = emptySheetRow();
          row.email = "owner@example.com";
          row.fragen = JSON.stringify({ module: { status: { m02: { uploadUrl: `${LEGACY_HOST}/${referenced}` } } } });
          return [row];
        },
      })) === "ok",
      "a document that still stores the legacy upload URL grants access",
    );

    store.failPut = new BlobAccessError("denied");
    let writeError: unknown;
    const logs = await captureErrors(async () => {
      try {
        await storeCustomerUpload(
          {
            ownerKey: "pdf-blob-smoke@example.com",
            modulId: "m01",
            filename: "beleg.pdf",
            contentType: "application/pdf",
            buffer: bytes,
          },
          store.io,
        );
      } catch (error) {
        writeError = error;
      }
    });
    ok(writeError instanceof BlobStorageError, "upload write failure is BlobStorageError");
    ok(!logs.some((line) => line.includes(MARKER)), "upload write log has no file contents");
  });
}

function checkMusterRoutes() {
  const files = [
    "app/muster/gesamt/[vorlage]/pdf/route.ts",
    "app/muster/[bereich]/pdf/route.ts",
    "app/muster/gesamt/[vorlage]/fragebogen/route.ts",
    "app/muster/modul/[modul]/fragebogen/route.ts",
    "app/steuerberater/muster/pdf/route.ts",
  ];
  for (const file of files) {
    const text = readFileSync(path.join(process.cwd(), file), "utf8");
    ok(!text.includes("@/lib/blob") && !text.includes("@vercel/blob"), `${file} does not use Blob`);
  }
}

async function checkDeleteGuard() {
  await withToken(TOKEN, async () => {
    const store = memory();
    await assert.rejects(
      deleteStoredBlob("../etc/passwd", store.io),
      (error: unknown) => error instanceof BlobStorageError,
      "delete refuses a path outside gobd/",
    );
    await deleteStoredBlob("gobd/smoke-abc/v1.pdf", store.io);
    ok(true, "delete of a missing smoke object is success");
  });
}

async function main() {
  await checkLocators();
  await checkPdf();
  await checkChapters();
  await checkUploads();
  checkMusterRoutes();
  await checkDeleteGuard();
  console.log("check-blob-storage: green");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "check failed");
  process.exit(1);
});
