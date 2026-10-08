/**
 * Offline check for oversized intake answers.
 * No production credentials: Sheets and Blob are in-memory.
 *
 *   npx tsx scripts/check-intake-payload-storage.ts
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import {
  appendRecord,
  fileFallbackCountsAsSuccess,
  getFileFallbackPath,
  readStoredIntakeRows,
  type IntakeStoreOverrides,
} from "../lib/store";
import type { BlobIo } from "../lib/blob";
import {
  CATALOG_STEPS,
  catalogStepIssues,
  firstFreitextIssue,
} from "../lib/intake-catalog";
import {
  FREITEXT_LIMIT_MESSAGE,
  FREITEXT_MAX_CHARS,
  freitextOverflows,
  intakePayloadLocator,
  intakePersistenceFailure,
  DurableStoreError,
} from "../lib/intake-payload";
import { SHEETS_CELL_SAFE_CHARS } from "../lib/document-content";
import {
  answersFromSheetRow,
  emptyAnswers,
  toSheetRow,
  type IntakeAnswers,
  type SheetRow,
} from "../lib/types";

const TOKEN = "vercel_blob_rw_teststore_abcdefghijklmnopqrstuvwxyz";
const ENV_KEYS = [
  "VERCEL",
  "VERCEL_ENV",
  "GOBD_BLOB_SMOKE",
  "BLOB_READ_WRITE_TOKEN",
  "GOOGLE_SERVICE_ACCOUNT_EMAIL",
  "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY",
  "GOOGLE_SHEETS_SPREADSHEET_ID",
] as const;

function ok(cond: unknown, msg: string) {
  assert.ok(cond, msg);
  console.log("ok:", msg);
}

type Memory = {
  io: BlobIo;
  puts: Array<{ pathname: string; access?: string; allowOverwrite?: boolean; body: string }>;
};

function memory(): Memory {
  const blobs = new Map<string, Buffer>();
  const state: Memory = { io: {} as BlobIo, puts: [] };
  state.io = {
    async put(pathname, body, options) {
      const buffer = Buffer.isBuffer(body) ? body : Buffer.from(body);
      state.puts.push({
        pathname,
        access: options.access,
        allowOverwrite: options.allowOverwrite,
        body: buffer.toString("utf8"),
      });
      blobs.set(pathname, buffer);
      return { url: `https://example.blob.vercel-storage.com/${pathname}`, pathname };
    },
    async get(pathname) {
      const stored = blobs.get(pathname);
      if (!stored) return null;
      return {
        statusCode: 200,
        stream: new Response(new Uint8Array(stored)).body,
        blob: { contentType: "application/json" },
      } as Awaited<ReturnType<BlobIo["get"]>>;
    },
    async del(pathname) {
      blobs.delete(pathname);
    },
  };
  return state;
}

async function withEnv(
  values: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>>,
  run: () => Promise<void>,
) {
  const previous = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
  for (const key of ENV_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(values, key)) continue;
    const value = values[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    await run();
  } finally {
    for (const key of ENV_KEYS) {
      const value = previous[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

const sheetsOn = {
  GOOGLE_SERVICE_ACCOUNT_EMAIL: "sheet@example.com",
  GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: "test-key",
  GOOGLE_SHEETS_SPREADSHEET_ID: "sheet-id",
} as const;

const sheetsOff = {
  GOOGLE_SERVICE_ACCOUNT_EMAIL: undefined,
  GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: undefined,
  GOOGLE_SHEETS_SPREADSHEET_ID: undefined,
} as const;

function answersWithFields(fields: Record<string, string>): IntakeAnswers {
  const answers = emptyAnswers();
  answers.branchen = ["Dienstleistung"];
  answers.rechtsform = "GmbH";
  answers.mitarbeitende = "3";
  answers.fibu = ["DATEV"];
  answers.eingangsbelege = ["E-Mail"];
  answers.ausgangsrechnungen = ["aus Buchhaltungssoftware"];
  answers.archiv = "DATEV";
  answers.hosting = "Cloud (Anbieter DE/EU)";
  answers.backup = ["Automatisch (Anbieter)"];
  answers.zugriff = "Geschäftsführung";
  answers.gf = "Ada Beispiel";
  answers.buchhaltung = "Ada Beispiel";
  answers.it = "Ada Beispiel";
  answers.steuerberater = "Kanzlei Beispiel";
  answers.katalog = { B01: { status: "bestaetigt", values: fields } };
  return answers;
}

function sheetRow(answers: IntakeAnswers, ids: { documentId: string; familyId: string; version?: string }): SheetRow {
  return toSheetRow({
    identity: {
      email: "intake-payload@example.com",
      company: "Beispiel GmbH",
      stripeSessionId: "cs_test_payload",
      stripeCustomerId: "",
      stub: true,
    },
    answers,
    status: "intake_submitted_stub",
    deliveryStatus: "ready",
    documentId: ids.documentId,
    parentDocumentId: ids.familyId,
    version: ids.version ?? "1",
  });
}

function longFields(count: number, each: number): Record<string, string> {
  const fields: Record<string, string> = {};
  for (let index = 0; index < count; index += 1) {
    fields[`feld${index}`] = `START${index}-${"x".repeat(each)}-END${index}`;
  }
  return fields;
}

async function fileContains(documentId: string): Promise<boolean> {
  try {
    const raw = await readFile(getFileFallbackPath(), "utf8");
    return raw.includes(documentId);
  } catch {
    return false;
  }
}

async function forgetFileRow(documentId: string) {
  const file = getFileFallbackPath();
  try {
    const parsed = JSON.parse(await readFile(file, "utf8")) as Array<{ documentId?: string }>;
    if (!Array.isArray(parsed)) return;
    const next = parsed.filter((row) => row.documentId !== documentId);
    await writeFile(file, JSON.stringify(next, null, 2), "utf8");
  } catch {
    // Datei war nicht angelegt.
  }
}

async function checkLimit() {
  const within = answersWithFields({
    kurz: "k".repeat(3_000),
    lang: "l".repeat(6_000),
  });
  ok(freitextOverflows(within).length === 0, "3000 and 6000 characters stay inside the free-text cap");
  ok(6_000 < FREITEXT_MAX_CHARS, "the cap is above the 6000-character fixture");

  const tooLong = answersWithFields({ hinweis: "h".repeat(FREITEXT_MAX_CHARS + 1) });
  const hits = freitextOverflows(tooLong);
  ok(hits.length === 1, "one field over the cap is reported");
  ok(hits[0]?.questionId === "B01" && hits[0]?.fieldKey === "hinweis", "the overflow names the field");
  ok(hits[0]?.message === FREITEXT_LIMIT_MESSAGE, "the overflow message is the Sie text");
  ok(hits[0]?.message.includes("Bitte kürzen Sie"), "the message asks the reader to shorten the text");
  ok(hits[0]?.message.includes("12.000"), "the message states the 12.000-character cap");

  const step = CATALOG_STEPS.findIndex((item) => item.questions.some((question) => question.id === "B01"));
  ok(step >= 0, "B01 has a catalog step");
  const issues = catalogStepIssues(step, tooLong);
  ok(
    issues.some(
      (issue) =>
        issue.questionId === "B01" &&
        issue.fieldKey === "hinweis" &&
        issue.message === FREITEXT_LIMIT_MESSAGE,
    ),
    "the catalog step shows the length message on the field",
  );
  const placed = firstFreitextIssue(tooLong);
  ok(placed?.step === step && placed.issue.fieldKey === "hinweis", "submit can jump back to the long field");
  ok(
    catalogStepIssues(step, within).every((issue) => issue.message !== FREITEXT_LIMIT_MESSAGE),
    "fixtures inside the cap do not raise a length issue",
  );
}

async function checkRoundTrip() {
  const fields = longFields(10, 6_000);
  const original = sheetRow(answersWithFields(fields), {
    documentId: "doc-lt",
    familyId: "fam-lt",
    version: "2",
  });
  ok(original.fragen.length > 50_000, `payload is over 50000 characters (${original.fragen.length})`);
  ok(original.fragen.length > SHEETS_CELL_SAFE_CHARS, "payload exceeds the safe Sheets cell size");
  ok(freitextOverflows(answersFromSheetRow(original)).length === 0, "the stored fixture still passes the field cap");

  const saved: SheetRow[] = [];
  const store = memory();
  await withEnv(
    {
      ...sheetsOn,
      BLOB_READ_WRITE_TOKEN: TOKEN,
      VERCEL: "1",
      VERCEL_ENV: "preview",
      GOBD_BLOB_SMOKE: undefined,
    },
    async () => {
      const overrides: IntakeStoreOverrides = {
        appendSheet: async (row) => {
          saved.push(row);
        },
        blob: store.io,
      };
      const stored = await appendRecord(original, overrides);
      ok(stored.backend === "sheets", "oversized intake is stored as a sheet row");
      ok(saved.length === 1, "the sheet received one row");
      const cell = saved[0]?.fragen ?? "";
      ok(cell.length < 50_000, `the sheet cell stays under 50000 (${cell.length})`);
      ok(cell.includes("__gobdAnswers"), "the sheet cell is a pointer, not the full JSON");
      const ref = intakePayloadLocator(cell);
      ok(ref?.locator === "gobd/fam-lt/doc-lt/v2-answers.json", "blob path uses family, document id and version");
      ok(
        ref?.sha256 === createHash("sha256").update(original.fragen).digest("hex"),
        "the sheet cell carries the sha256 of the full JSON",
      );
      ok(store.puts.length === 1, "the full JSON was written once");
      ok(store.puts[0]?.access === "private", "the answers blob is private");
      ok(store.puts[0]?.allowOverwrite === true, "a repeated version overwrites the same object");
      ok(store.puts[0]?.body === original.fragen, "the blob body is the complete fragen JSON");

      const loaded = await readStoredIntakeRows({
        readSheets: async () => saved,
        blob: store.io,
      });
      ok(loaded.length === 1, "the row can be read back");
      ok(loaded[0]?.fragen === original.fragen, "the read path restores the full fragen JSON");
      const answers = answersFromSheetRow(loaded[0] as SheetRow);
      ok(answers.katalog?.B01?.values?.feld0 === fields.feld0, "field 0 survives the round trip");
      ok(answers.katalog?.B01?.values?.feld9 === fields.feld9, "the last long field survives the round trip");
      ok(String(answers.katalog?.B01?.values?.feld9).endsWith("-END9"), "the end of the long text is not cut");
    },
  );
}

async function checkLegacyInline() {
  const original = sheetRow(answersWithFields({ hinweis: "Bestehende Zeile bleibt im Feld." }), {
    documentId: "doc-alt",
    familyId: "fam-alt",
  });
  const saved = [original];
  await withEnv({ ...sheetsOn, BLOB_READ_WRITE_TOKEN: undefined, VERCEL: undefined }, async () => {
    const store = memory();
    const stored = await appendRecord(original, {
      appendSheet: async (row) => {
        saved[0] = row;
      },
      blob: store.io,
    });
    ok(stored.backend === "sheets", "a short row still goes to Sheets");
    ok(store.puts.length === 0, "a short row does not create an answers blob");
    ok(saved[0]?.fragen === original.fragen, "an existing inline cell is unchanged");
    const loaded = await readStoredIntakeRows({ readSheets: async () => saved });
    ok(loaded[0]?.fragen === original.fragen, "an inline row is read without Blob");
    ok(
      answersFromSheetRow(loaded[0] as SheetRow).katalog?.B01?.values?.hinweis === "Bestehende Zeile bleibt im Feld.",
      "legacy inline answers stay readable",
    );
  });
}

async function checkVercelFailure() {
  const original = sheetRow(answersWithFields(longFields(10, 6_000)), {
    documentId: "doc-vercel-fail",
    familyId: "fam-vercel-fail",
  });
  await withEnv(
    {
      ...sheetsOff,
      BLOB_READ_WRITE_TOKEN: undefined,
      VERCEL: "1",
      VERCEL_ENV: "preview",
      GOBD_BLOB_SMOKE: undefined,
    },
    async () => {
      let caught: unknown;
      try {
        await appendRecord(original);
      } catch (error) {
        caught = error;
      }
      const failure = intakePersistenceFailure(caught);
      ok(caught instanceof DurableStoreError, "Vercel without durable storage throws");
      ok(failure?.status === 503, "the failure is an HTTP 503");
      ok(failure?.status !== 200, "the failure is not a silent 200");
      ok(
        failure?.error.includes("dauerhaft gespeichert") && failure.error.includes("versuchen Sie"),
        "the failure message is in Sie form",
      );
      ok(!(await fileContains(original.documentId)), "the /tmp fallback does not keep the row");
      ok(!fileFallbackCountsAsSuccess(original), "file fallback is not a success on Vercel");
    },
  );

  await withEnv(
    {
      ...sheetsOn,
      BLOB_READ_WRITE_TOKEN: TOKEN,
      VERCEL: "1",
      VERCEL_ENV: "preview",
      GOBD_BLOB_SMOKE: undefined,
    },
    async () => {
      const store = memory();
      let caught: unknown;
      try {
        await appendRecord(original, {
          appendSheet: async () => {
            throw new Error("sheets down");
          },
          blob: store.io,
        });
      } catch (error) {
        caught = error;
      }
      ok(intakePersistenceFailure(caught)?.status === 503, "a failed sheet append on Vercel is a 503");
      ok(!(await fileContains(original.documentId)), "a failed sheet append does not fall back to /tmp");
    },
  );

  await withEnv(
    {
      ...sheetsOff,
      BLOB_READ_WRITE_TOKEN: undefined,
      VERCEL: "1",
      VERCEL_ENV: "production",
      GOBD_BLOB_SMOKE: "1",
    },
    async () => {
      const smokeRow = { ...original, email: "pdf-blob-smoke@example.com" };
      await assert.rejects(appendRecord(smokeRow), "production never accepts the smoke file fallback");
      ok(!(await fileContains(smokeRow.documentId)), "production smoke flag does not write /tmp");
    },
  );
}

async function checkLocalAndSmokeFallback() {
  const original = sheetRow(answersWithFields(longFields(10, 6_000)), {
    documentId: "doc-local-file",
    familyId: "fam-local-file",
  });
  await withEnv(
    {
      ...sheetsOff,
      BLOB_READ_WRITE_TOKEN: undefined,
      VERCEL: undefined,
      VERCEL_ENV: undefined,
      GOBD_BLOB_SMOKE: undefined,
    },
    async () => {
      const stored = await appendRecord(original);
      ok(stored.backend === "file", "local dev still uses the file fallback");
      const loaded = await readStoredIntakeRows();
      const match = loaded.find((row) => row.documentId === original.documentId);
      ok(match?.fragen === original.fragen, "the local file keeps the full fragen JSON");
      await forgetFileRow(original.documentId);
    },
  );

  const smoke = sheetRow(answersWithFields({ hinweis: "kurz" }), {
    documentId: "doc-smoke-file",
    familyId: "fam-smoke-file",
  });
  smoke.email = "pdf-blob-smoke@example.com";
  await withEnv(
    {
      ...sheetsOff,
      BLOB_READ_WRITE_TOKEN: undefined,
      VERCEL: "1",
      VERCEL_ENV: "preview",
      GOBD_BLOB_SMOKE: "1",
    },
    async () => {
      const stored = await appendRecord(smoke);
      ok(stored.backend === "file", "preview smoke for @example.com may use the file fallback");
      await forgetFileRow(smoke.documentId);
      const foreign = { ...smoke, documentId: "doc-smoke-foreign", email: "kunde@example.org" };
      await assert.rejects(
        appendRecord(foreign),
        "preview smoke does not accept a mailbox outside example.com",
      );
      ok(!(await fileContains(foreign.documentId)), "a foreign smoke mailbox is not written to /tmp");
    },
  );
}

async function main() {
  await checkLimit();
  await checkRoundTrip();
  await checkLegacyInline();
  await checkVercelFailure();
  await checkLocalAndSmokeFallback();
  console.log("check-intake-payload-storage: ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
