import { createHash } from "node:crypto";
import { readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { google } from "googleapis";
import { commitBlobWipe, planAccountBlobs } from "@/lib/admin-wipe-blobs";
import {
  collectAccountScope,
  derivedDocumentPaths,
  derivedDraftPaths,
  type AccountRecord,
} from "@/lib/admin-wipe";
import { deleteStoredBlob } from "@/lib/blob";
import { getEntitiesSheetsTab, getSheetsTab, isSheetsConfigured } from "@/lib/env";
import { contractPurgeAllowsPath } from "@/lib/kuendigung";
import {
  getEntitiesFileFallbackPath,
  getFileFallbackDir,
  getFileFallbackPath,
  listDocumentsByEmail,
  listEntitiesByEmail,
} from "@/lib/store";
import { emailsEqual, type SheetRow } from "@/lib/types";
import type { Entity } from "@/lib/entities";

const SHEETS_GET_OPTS = {
  headers: {
    "Cache-Control": "no-cache, no-store",
    Pragma: "no-cache",
  },
} as const;

export function draftIndexBlobPath(email: string): string {
  const hash = createHash("sha256").update(email.trim().toLowerCase()).digest("hex").slice(0, 40);
  return `gobd/draft-index/${hash}.json`;
}

export function withoutEmailRows(rows: unknown[], email: string): unknown[] {
  return rows.filter((row) => {
    if (!row || typeof row !== "object") return true;
    const record = row as { email?: unknown; userEmail?: unknown; user_email?: unknown };
    const candidates = [record.email, record.userEmail, record.user_email];
    const owned = candidates.some(
      (value) => typeof value === "string" && value.trim() && emailsEqual(value, email),
    );
    return !owned;
  });
}

function recordFromDocument(row: SheetRow): AccountRecord {
  return {
    email: row.email,
    documentId: row.documentId,
    parentDocumentId: row.parentDocumentId,
    entityId: row.entityId,
    stripeSessionId: row.stripeSessionId,
    stripeCustomerId: row.stripeCustomerId,
    leadId: "",
    pdfUrl: row.pdfUrl,
    chapterContent: row.chapterContent,
    version: row.version,
  };
}

function recordFromEntity(entity: Entity): AccountRecord {
  return {
    email: entity.userEmail,
    documentId: "",
    parentDocumentId: "",
    entityId: entity.entityId,
    stripeSessionId: "",
    stripeCustomerId: "",
    leadId: "",
    pdfUrl: "",
    chapterContent: "",
    version: "",
  };
}

function sheetsClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  if (!email || !key || !spreadsheetId) {
    throw new Error("Google Sheets ist unvollständig konfiguriert");
  }
  return {
    spreadsheetId,
    sheets: google.sheets({
      version: "v4",
      auth: new google.auth.JWT({
        email,
        key,
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
      }),
    }),
  };
}

async function deleteEmailRowsFromTab(tab: string, email: string): Promise<void> {
  const { sheets, spreadsheetId } = sheetsClient();
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const sheet = meta.data.sheets?.find((item) => item.properties?.title === tab);
  const sheetId = sheet?.properties?.sheetId;
  if (typeof sheetId !== "number") return;
  const headerResult = await sheets.spreadsheets.values.get(
    { spreadsheetId, range: `${tab}!A1:AZ1` },
    SHEETS_GET_OPTS,
  );
  const header = ((headerResult.data.values?.[0] ?? []) as unknown[]).map((cell) => String(cell ?? ""));
  const emailIndex = header.findIndex((column) => {
    const name = column.trim().toLowerCase();
    return name === "email" || name === "user_email";
  });
  if (emailIndex < 0) return;
  const body = await sheets.spreadsheets.values.get(
    { spreadsheetId, range: `${tab}!A2:AZ` },
    SHEETS_GET_OPTS,
  );
  const rowNumbers: number[] = [];
  for (const [index, values] of (body.data.values ?? []).entries()) {
    const cell = String(values[emailIndex] ?? "");
    if (cell.trim() && emailsEqual(cell, email)) rowNumbers.push(index + 2);
  }
  const ordered = [...new Set(rowNumbers)].sort((a, b) => b - a);
  for (let offset = 0; offset < ordered.length; offset += 80) {
    const chunk = ordered.slice(offset, offset + 80);
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: chunk.map((sheetRow) => ({
          deleteDimension: {
            range: {
              sheetId,
              dimension: "ROWS",
              startIndex: sheetRow - 1,
              endIndex: sheetRow,
            },
          },
        })),
      },
    });
  }
}

async function filterJsonFile(file: string, email: string): Promise<void> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(file, "utf8")) as unknown;
  } catch {
    return;
  }
  if (!Array.isArray(parsed)) return;
  const next = withoutEmailRows(parsed, email);
  if (next.length === parsed.length) return;
  await writeFile(file, JSON.stringify(next, null, 2), "utf8");
}

async function listFiles(dir: string): Promise<string[]> {
  const found: string[] = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return found;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...(await listFiles(full)));
    } else if (entry.isFile()) {
      found.push(full);
    }
  }
  return found;
}

/**
 * Löscht Vertragsdaten dieser Mail: Intake, Firmen, PDFs, Entwürfe, Uploads.
 * Profil, Readiness, Stripe-Kunde und der Ordner `anon` bleiben.
 */
export async function purgeContractData(email: string): Promise<void> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return;
  const documents = await listDocumentsByEmail(normalized);
  const entities = await listEntitiesByEmail(normalized);
  const records = [
    ...documents.map(recordFromDocument),
    ...entities.map(recordFromEntity),
  ];
  const scope = collectAccountScope(normalized, records);
  scope.familyIds = scope.familyIds.filter((id) => !id.startsWith("readiness-"));
  scope.leadIds = [];
  const paths = new Set<string>([
    ...derivedDraftPaths(scope),
    ...derivedDocumentPaths(records).filter((item) => contractPurgeAllowsPath(item)),
    draftIndexBlobPath(normalized),
  ]);
  try {
    const plan = await planAccountBlobs(scope, records);
    for (const group of [plan.drafts, plan.documents, plan.uploads]) {
      group.pathnames = group.pathnames.filter((pathname) => contractPurgeAllowsPath(pathname));
      for (const pathname of group.pathnames) paths.add(pathname);
    }
    await commitBlobWipe(plan.drafts);
    await commitBlobWipe(plan.documents);
    await commitBlobWipe(plan.uploads);
  } catch (error) {
    console.error("[kuendigung] Blob-Plan fehlgeschlagen", error);
  }
  for (const pathname of paths) {
    if (!contractPurgeAllowsPath(pathname)) continue;
    await deleteStoredBlob(pathname);
  }

  const root = getFileFallbackDir();
  const localTargets = [
    path.join(root, "draft-index", `${draftIndexBlobPath(normalized).split("/").pop()}`),
  ];
  for (const owner of scope.uploadOwners) {
    if (!owner || owner === "anon") continue;
    localTargets.push(path.join(root, "uploads", owner));
  }
  for (const familyId of scope.familyIds) {
    if (!familyId || familyId.includes("..") || familyId.includes("/")) continue;
    localTargets.push(path.join(root, familyId));
  }
  for (const target of localTargets) {
    await rm(target, { recursive: true, force: true });
  }
  const pdfDir = path.join(root, "pdfs");
  for (const file of await listFiles(pdfDir)) {
    const base = path.basename(file);
    if (scope.familyIds.some((familyId) => base.startsWith(familyId))) {
      await rm(file, { force: true });
    }
  }

  if (isSheetsConfigured()) {
    await deleteEmailRowsFromTab(getSheetsTab(), normalized);
    await deleteEmailRowsFromTab(getEntitiesSheetsTab(), normalized);
  }
  await filterJsonFile(getFileFallbackPath(), normalized);
  await filterJsonFile(getEntitiesFileFallbackPath(), normalized);
}
