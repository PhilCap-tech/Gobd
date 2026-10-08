/**
 * Draft storage contract: private Blob, file fallback only without a token.
 *
 * Usage:
 *   npx tsx scripts/check-intake-draft-storage.ts
 *   npx tsx scripts/check-intake-draft-storage.ts https://preview.example
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  clearIntakeDraft,
  IntakeDraftStorageError,
  loadIntakeDraft,
  saveIntakeDraft,
  type IntakeDraft,
  type IntakeDraftBlobIo,
} from "../lib/intake-draft";
import { getFileFallbackDir } from "../lib/store";
import { emptyAnswers, type IntakeAnswers } from "../lib/types";

const TOKEN = "vercel_blob_rw_teststore_abcdefghijklmnopqrstuvwxyz";
const MARKER = "GEHEIM-FIRMA-MARKER";

function ok(cond: unknown, msg: string) {
  assert.ok(cond, msg);
  console.log("ok:", msg);
}

function draft(key: string, company: string, revision: number): IntakeDraft {
  const answers: IntakeAnswers = emptyAnswers();
  answers.rechtsform = "GmbH";
  answers.gf = "Ada Beispiel";
  answers.katalog = {
    A01: {
      status: "bestaetigt",
      values: { company, rechtsform: "GmbH", note: "Zeile 1\nZeile 2 äöü" },
    },
    A04: { values: { gueltigAb: "2020-05-01", keineRueckdatierungBestaetigt: true } },
  };
  return {
    draftKey: key,
    email: "draft-smoke@example.com",
    stripeSessionId: "mock_draft_blob_smoke",
    documentId: "",
    entityId: "e2e-blob-check",
    step: 4,
    answers,
    revision,
    updatedAt: "2026-10-08T09:00:00.000Z",
  };
}

function localPath(draftKey: string): string {
  const hash = createHash("sha256").update(draftKey).digest("hex").slice(0, 40);
  return path.join(getFileFallbackDir(), "drafts", `${hash}.json`);
}

type Memory = {
  io: IntakeDraftBlobIo;
  blobs: Map<string, string>;
  puts: { pathname: string; body: string; access?: string; allowOverwrite?: boolean; addRandomSuffix?: boolean; token?: string }[];
  gets: { access?: string; useCache?: boolean; token?: string }[];
  failPut?: Error;
  failGet?: Error;
  failDel?: Error;
};

function memory(): Memory {
  const blobs = new Map<string, string>();
  const state: Memory = { io: {} as IntakeDraftBlobIo, blobs, puts: [], gets: [] };
  state.io = {
    async put(pathname, body, options) {
      if (state.failPut) throw state.failPut;
      state.puts.push({
        pathname,
        body,
        access: options.access,
        allowOverwrite: options.allowOverwrite,
        addRandomSuffix: options.addRandomSuffix,
        token: options.token,
      });
      blobs.set(pathname, body);
    },
    async get(pathname, options) {
      if (state.failGet) throw state.failGet;
      state.gets.push({
        access: options.access,
        useCache: options.useCache,
        token: options.token,
      });
      const body = blobs.get(pathname);
      if (body === undefined) return null;
      return {
        statusCode: 200,
        stream: new Response(body).body,
      } as Awaited<ReturnType<IntakeDraftBlobIo["get"]>>;
    },
    async del(pathname) {
      if (state.failDel) throw state.failDel;
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
class BlobNotFoundError extends Error {}

async function checkLocalContract() {
  const key = "email:draft-smoke@example.com:storage-check:gesamt";

  await withToken(undefined, async () => {
    const store = memory();
    const saved = await saveIntakeDraft(draft(key, "Lokal GmbH", 1), store.io);
    ok(saved.backend === "file", "without a token the backend is file");
    ok(store.puts.length === 0, "without a token blob put is not called");
    const loaded = await loadIntakeDraft(key, store.io);
    ok(loaded?.answers.katalog?.A01?.values?.company === "Lokal GmbH", "file round-trip keeps the company");
    ok(loaded?.answers.katalog?.A04?.values?.keineRueckdatierungBestaetigt === true, "file round-trip keeps the checkbox");
    await clearIntakeDraft(key, store.io);
    ok((await loadIntakeDraft(key, store.io)) === null, "file draft deletes");
  });

  await withToken(TOKEN, async () => {
    const store = memory();
    const first = draft(key, MARKER, 2);
    const saved = await saveIntakeDraft(first, store.io);
    ok(saved.backend === "blob", "with a token the backend is blob");
    ok(store.puts.length === 1, "blob put ran once");
    const put = store.puts[0];
    ok(put?.access === "private", "put uses private access");
    ok(put?.allowOverwrite === true, "put allows overwrite of the same draft key");
    ok(put?.addRandomSuffix === false, "put keeps a stable pathname");
    ok(put?.token === TOKEN, "put sends the read-write token");
    ok(/^gobd\/drafts\/[a-f0-9]{40}\.json$/.test(put?.pathname ?? ""), "pathname is a hash under gobd/drafts");
    ok(!(put?.pathname ?? "").includes("example.com"), "pathname does not contain the email");

    const loaded = await loadIntakeDraft(key, store.io);
    ok(JSON.stringify(loaded?.answers) === JSON.stringify(first.answers), "blob round-trip restores every answer");
    ok(loaded?.step === 4 && loaded.revision === 2, "blob round-trip restores step and revision");
    ok(store.gets[0]?.access === "private", "get uses private access");
    ok(store.gets[0]?.useCache === false, "get bypasses the CDN cache");
    ok(store.gets[0]?.token === TOKEN, "get sends the read-write token");

    const second = draft(key, "Neu GmbH", 3);
    await saveIntakeDraft(second, store.io);
    ok(store.puts[1]?.pathname === put?.pathname, "overwrite targets the same pathname");
    const replaced = await loadIntakeDraft(key, store.io);
    ok(replaced?.answers.katalog?.A01?.values?.company === "Neu GmbH", "overwrite is visible on the next read");

    const poison = draft(key, "Nur Datei", 1);
    await mkdir(path.dirname(localPath(key)), { recursive: true });
    await writeFile(localPath(key), JSON.stringify(poison), "utf8");
    const ignored = await loadIntakeDraft(key, store.io);
    ok(ignored?.answers.katalog?.A01?.values?.company === "Neu GmbH", "a local file is not a fallback while a token is set");

    store.blobs.clear();
    ok((await loadIntakeDraft(key, store.io)) === null, "a missing blob is an empty draft, not the local file");

    store.failPut = new BlobAccessError("denied");
    let writeError: unknown;
    const logs = await captureErrors(async () => {
      try {
        await saveIntakeDraft(draft(key, MARKER, 4), store.io);
      } catch (error) {
        writeError = error;
      }
    });
    ok(writeError instanceof IntakeDraftStorageError, "blob write failure is IntakeDraftStorageError");
    const storage = writeError as IntakeDraftStorageError;
    ok(storage.backend === "blob" && storage.operation === "write", "write failure stays on blob");
    ok(storage.errorClass === "BlobAccessError", "write failure keeps the error class");
    ok(logs.some((line) => line.includes("Blob-Schreiben fehlgeschlagen") && line.includes("BlobAccessError")), "write failure is logged with its class");
    ok(!logs.some((line) => line.includes(MARKER)), "write failure log has no draft contents");
    const localRaw = await readFile(localPath(key), "utf8");
    ok(localRaw.includes("Nur Datei") && !localRaw.includes(MARKER), "a failed blob write does not replace the local file");

    store.failGet = new BlobAccessError("denied");
    let readError: unknown;
    const readLogs = await captureErrors(async () => {
      try {
        await loadIntakeDraft(key, store.io);
      } catch (error) {
        readError = error;
      }
    });
    ok(
      readError instanceof IntakeDraftStorageError && readError.errorClass === "BlobAccessError",
      "blob read failure stays on blob and keeps the error class",
    );
    ok(readLogs.some((line) => line.includes("Blob-Lesen fehlgeschlagen") && line.includes("BlobAccessError")), "read failure is logged with its class");
    ok(!readLogs.some((line) => line.includes(MARKER) || line.includes("Nur Datei")), "read failure log has no draft contents");

    store.failGet = undefined;
    store.failDel = new BlobNotFoundError("missing");
    await clearIntakeDraft(key, store.io);
    ok(true, "deleting a missing blob is success");

    store.failDel = new BlobAccessError("denied");
    let deleteError: unknown;
    const deleteLogs = await captureErrors(async () => {
      try {
        await clearIntakeDraft(key, store.io);
      } catch (error) {
        deleteError = error;
      }
    });
    ok(
      deleteError instanceof IntakeDraftStorageError && deleteError.operation === "delete",
      "blob delete failure is IntakeDraftStorageError",
    );
    ok(deleteLogs.some((line) => line.includes("Blob-Löschen fehlgeschlagen") && line.includes("BlobAccessError")), "delete failure is logged with its class");
    await unlink(localPath(key)).catch(() => undefined);
  });
}

function smokeHttp(baseUrl: string) {
  const result = spawnSync(process.execPath, ["scripts/smoke-draft-blob-http.mjs", baseUrl], {
    stdio: "inherit",
  });
  if (result.status !== 0) {
    throw new Error(`http smoke exited ${result.status ?? "null"}`);
  }
}

async function main() {
  await checkLocalContract();
  const baseUrl = process.argv[2]?.trim();
  if (baseUrl) {
    console.log("http smoke:", baseUrl);
    await smokeHttp(baseUrl);
  }
  console.log("check-intake-draft-storage: green");
}

const entry = process.argv[1] ?? "";
if (entry.endsWith("check-intake-draft-storage.ts") || entry.endsWith("check-intake-draft-storage.js")) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "check failed");
    process.exit(1);
  });
}
