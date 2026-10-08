import { readdir, readFile, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { google } from "googleapis";
import { commitBlobWipe, planAccountBlobs } from "@/lib/admin-wipe-blobs";
import {
  accountRecordFromCells,
  accountRecordFromUnknown,
  cellsMatchEmail,
  collectAccountScope,
  draftPayloadMatchesEmail,
  emptyFileWipe,
  emptyPathWipe,
  isWipeEmailAllowed,
  localChapterNameMatches,
  ownerColumnIndexes,
  localPdfNameMatches,
  redactBackupCells,
  redactForBackup,
  referralKeyMatches,
  safeErrorMessage,
  stripeWipeDecision,
  unknownMatchesEmail,
  type AccountRecord,
  type AccountScope,
  type FileJsonWipe,
  type PathWipe,
  type SheetBackupRow,
  type SheetWipe,
  type WipeAccountResult,
} from "@/lib/admin-wipe";
import { isSheetsConfigured } from "@/lib/env";
import { forgetReferralKeys } from "@/lib/referral-sent";
import { getFileFallbackDir } from "@/lib/store";
import {
  clearStripeLookupCache,
  getStripe,
  isStripeResourceMissingError,
} from "@/lib/stripe";
import { emailsEqual } from "@/lib/types";
import type Stripe from "stripe";

const SHEETS_GET_OPTS = {
  headers: {
    "Cache-Control": "no-cache, no-store",
    Pragma: "no-cache",
  },
} as const;

type SheetTab = {
  title: string;
  sheetId: number;
};

type PreparedSheet = {
  tab: SheetTab;
  wipe: SheetWipe;
  rowNumbers: number[];
};

function dataDirs(): string[] {
  const primary = getFileFallbackDir();
  const tmp = path.join(tmpdir(), "gobd-data");
  return primary === tmp ? [primary] : [primary, tmp];
}

function quoteTab(title: string): string {
  if (/^[A-Za-z0-9_]+$/.test(title)) return title;
  return `'${title.replace(/'/g, "''")}'`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isFileInside(root: string, target: string): boolean {
  const relative = path.relative(path.resolve(root), path.resolve(target));
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function errorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object" || !("code" in error)) return undefined;
  return String((error as { code?: string }).code);
}

function sheetsApi() {
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

async function listSheetTabs(): Promise<SheetTab[]> {
  const { sheets, spreadsheetId } = sheetsApi();
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const tabs: SheetTab[] = [];
  for (const sheet of meta.data.sheets ?? []) {
    const title = sheet.properties?.title?.trim() ?? "";
    const sheetId = sheet.properties?.sheetId;
    if (!title || typeof sheetId !== "number") continue;
    tabs.push({ title, sheetId });
  }
  return tabs;
}

function cellsFromRow(header: string[], values: unknown[]): Record<string, string> {
  const cells: Record<string, string> = {};
  header.forEach((col, index) => {
    const name = col.trim() || `column_${index + 1}`;
    cells[name] = String(values[index] ?? "");
  });
  return cells;
}

async function readSheetHeader(tab: SheetTab): Promise<string[] | null> {
  const { sheets, spreadsheetId } = sheetsApi();
  const result = await sheets.spreadsheets.values.get(
    {
      spreadsheetId,
      range: `${quoteTab(tab.title)}!A1:AZ1`,
    },
    SHEETS_GET_OPTS,
  );
  const header = ((result.data.values?.[0] ?? []) as unknown[]).map((cell) =>
    String(cell ?? ""),
  );
  if (ownerColumnIndexes(header).length === 0) return null;
  return header;
}

async function readMatchingSheet(
  tab: SheetTab,
  email: string,
  header: string[],
): Promise<{ rows: SheetBackupRow[]; records: AccountRecord[]; rowNumbers: number[] }> {
  const { sheets, spreadsheetId } = sheetsApi();
  const result = await sheets.spreadsheets.values.get(
    {
      spreadsheetId,
      range: `${quoteTab(tab.title)}!A2:AZ`,
    },
    SHEETS_GET_OPTS,
  );
  const all = (result.data.values ?? []) as unknown[][];
  const rows: SheetBackupRow[] = [];
  const records: AccountRecord[] = [];
  const rowNumbers: number[] = [];
  if (header.length === 0) {
    return { rows, records, rowNumbers };
  }
  for (let index = 0; index < all.length; index += 1) {
    const values = (all[index] ?? []).map((cell) => String(cell ?? ""));
    if (!values.some((cell) => cell.trim())) continue;
    if (!cellsMatchEmail(header, values, email)) continue;
    const sheetRow = index + 2;
    rows.push({
      sheetRow,
      cells: redactBackupCells(cellsFromRow(header, values)),
    });
    records.push(accountRecordFromCells(header, values));
    rowNumbers.push(sheetRow);
  }
  return { rows, records, rowNumbers };
}

async function deleteSheetRows(tab: SheetTab, rowNumbers: number[]): Promise<void> {
  if (rowNumbers.length === 0) return;
  const { sheets, spreadsheetId } = sheetsApi();
  const ordered = [...new Set(rowNumbers)].sort((a, b) => b - a);
  for (let offset = 0; offset < ordered.length; offset += 100) {
    const chunk = ordered.slice(offset, offset + 100);
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: chunk.map((sheetRow) => ({
          deleteDimension: {
            range: {
              sheetId: tab.sheetId,
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

async function readJsonArray(file: string): Promise<unknown[] | "missing" | "invalid"> {
  try {
    const parsed = JSON.parse(await readFile(file, "utf8")) as unknown;
    return Array.isArray(parsed) ? parsed : "invalid";
  } catch (error) {
    if (errorCode(error) === "ENOENT") return "missing";
    return "invalid";
  }
}

async function wipeJsonFile(
  filename: string,
  email: string,
  dryRun: boolean,
): Promise<{ wipe: FileJsonWipe; records: AccountRecord[] }> {
  const wipe = emptyFileWipe();
  const records: AccountRecord[] = [];
  for (const dir of dataDirs()) {
    const file = path.join(dir, filename);
    const parsed = await readJsonArray(file);
    if (parsed === "missing") continue;
    if (parsed === "invalid") {
      wipe.error = "Datei nicht lesbar — unverändert gelassen";
      wipe.paths.push(file);
      continue;
    }
    const matched = parsed.filter((item) => unknownMatchesEmail(item, email));
    if (matched.length === 0) continue;
    const kept = parsed.filter((item) => !unknownMatchesEmail(item, email));
    wipe.matched += matched.length;
    wipe.paths.push(file);
    wipe.rows.push(...matched.map((item) => redactForBackup(item)));
    for (const item of matched) {
      const record = accountRecordFromUnknown(item);
      if (record) records.push(record);
    }
    if (!dryRun) {
      await writeFile(file, JSON.stringify(kept, null, 2), "utf8");
      wipe.deleted += matched.length;
    }
  }
  return { wipe, records };
}

async function commitJsonFile(
  filename: string,
  email: string,
  preview: FileJsonWipe,
): Promise<FileJsonWipe> {
  try {
    return (await wipeJsonFile(filename, email, false)).wipe;
  } catch (error) {
    const message = safeErrorMessage(error);
    console.error("[admin-wipe] file", filename, message);
    return { ...preview, error: preview.error ?? message };
  }
}

async function listFileNames(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries.filter((entry) => entry.isFile()).map((entry) => entry.name);
  } catch {
    return [];
  }
}

async function listFilesRecursive(dir: string): Promise<string[]> {
  const out: string[] = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await listFilesRecursive(full)));
    } else if (entry.isFile()) {
      out.push(full);
    }
  }
  return out;
}

function chapterFileFromContent(raw: string, roots: string[]): string | null {
  const text = raw.trim();
  if (!text) return null;
  let locator = text;
  try {
    const parsed = JSON.parse(text) as { __gobdContent?: unknown };
    if (parsed && typeof parsed.__gobdContent === "string") {
      locator = parsed.__gobdContent.trim();
    }
  } catch {
    // Plain path or inline chapter JSON.
  }
  if (!locator || locator.startsWith("http://") || locator.startsWith("https://")) {
    return null;
  }
  const resolved = path.resolve(locator);
  return roots.some((root) => isFileInside(root, resolved)) ? resolved : null;
}

async function collectLocalArtifacts(
  scope: AccountScope,
  records: AccountRecord[],
): Promise<{ drafts: string[]; pdfs: string[]; chapters: string[]; uploads: string[] }> {
  const roots = dataDirs();
  const drafts: string[] = [];
  const pdfs: string[] = [];
  const chapters: string[] = [];
  const uploads: string[] = [];

  for (const root of roots) {
    const draftDir = path.join(root, "drafts");
    for (const name of await listFileNames(draftDir)) {
      if (!name.endsWith(".json")) continue;
      const file = path.join(draftDir, name);
      const hash = name.replace(/\.json$/i, "");
      let matched = scope.draftHashes.includes(hash);
      if (!matched) {
        try {
          const payload = JSON.parse(await readFile(file, "utf8")) as unknown;
          matched = draftPayloadMatchesEmail(payload, scope.email);
        } catch {
          matched = false;
        }
      }
      if (matched) drafts.push(file);
    }

    for (const name of await listFileNames(path.join(root, "pdfs"))) {
      if (localPdfNameMatches(name, scope.familyIds)) {
        pdfs.push(path.join(root, "pdfs", name));
      }
    }

    for (const name of await listFileNames(path.join(root, "chapters"))) {
      if (localChapterNameMatches(name, scope.documentIds)) {
        chapters.push(path.join(root, "chapters", name));
      }
    }

    for (const owner of scope.uploadOwners) {
      const uploadsRoot = path.resolve(root, "uploads");
      const dir = path.resolve(uploadsRoot, owner);
      const relative = path.relative(uploadsRoot, dir);
      if (relative.startsWith("..") || path.isAbsolute(relative)) continue;
      uploads.push(...(await listFilesRecursive(dir)));
    }
  }

  for (const record of records) {
    const chapter = chapterFileFromContent(record.chapterContent, roots);
    if (chapter) chapters.push(chapter);
  }

  return {
    drafts: unique(drafts),
    pdfs: unique(pdfs),
    chapters: unique(chapters),
    uploads: unique(uploads),
  };
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

async function unlinkFiles(files: string[], roots: string[]): Promise<number> {
  let deleted = 0;
  for (const file of files) {
    if (!roots.some((root) => isFileInside(root, file))) continue;
    try {
      await unlink(file);
      deleted += 1;
    } catch (error) {
      if (errorCode(error) !== "ENOENT") throw error;
    }
  }
  return deleted;
}

async function readReferralKeys(file: string): Promise<string[] | "missing" | "invalid"> {
  try {
    const parsed = JSON.parse(await readFile(file, "utf8")) as { sent?: unknown };
    if (!Array.isArray(parsed.sent)) return "invalid";
    return parsed.sent.filter((key): key is string => typeof key === "string");
  } catch (error) {
    if (errorCode(error) === "ENOENT") return "missing";
    return "invalid";
  }
}

async function collectReferral(scope: AccountScope): Promise<PathWipe & { keys: string[] }> {
  const keys = new Set<string>();
  const pathnames: string[] = [];
  let error: string | undefined;
  for (const dir of dataDirs()) {
    const file = path.join(dir, "referral-sent.json");
    const sent = await readReferralKeys(file);
    if (sent === "missing") continue;
    if (sent === "invalid") {
      error = "Referral-Datei nicht lesbar — unverändert gelassen";
      continue;
    }
    const matched = sent.filter((key) => referralKeyMatches(key, scope));
    if (matched.length === 0) continue;
    pathnames.push(file);
    for (const key of matched) keys.add(key);
  }
  const wipe: PathWipe & { keys: string[] } = {
    matched: keys.size,
    deleted: 0,
    pathnames,
    keys: [...keys].sort(),
  };
  if (error) wipe.error = error;
  return wipe;
}

async function deleteReferral(scope: AccountScope): Promise<void> {
  await forgetReferralKeys((key) => referralKeyMatches(key, scope));
  for (const dir of dataDirs()) {
    const file = path.join(dir, "referral-sent.json");
    const sent = await readReferralKeys(file);
    if (!Array.isArray(sent)) continue;
    const kept = sent.filter((key) => !referralKeyMatches(key, scope));
    if (kept.length === sent.length) continue;
    await writeFile(file, JSON.stringify({ sent: kept }), "utf8");
  }
}

function isLiveCustomer(
  customer: Stripe.Customer | Stripe.DeletedCustomer,
): customer is Stripe.Customer {
  return !("deleted" in customer && customer.deleted);
}

async function listCustomersByEmail(email: string): Promise<Stripe.Customer[]> {
  const stripe = getStripe();
  const found: Stripe.Customer[] = [];
  let startingAfter: string | undefined;
  for (let page = 0; page < 20; page += 1) {
    const result = await stripe.customers.list({
      email,
      limit: 100,
      starting_after: startingAfter,
    });
    for (const customer of result.data) {
      if (customer.email && emailsEqual(customer.email, email)) {
        found.push(customer);
      }
    }
    if (!result.has_more) break;
    const last = result.data[result.data.length - 1];
    if (!last) break;
    startingAfter = last.id;
  }
  return found;
}

async function listSubscriptions(customerId: string): Promise<Stripe.Subscription[]> {
  const stripe = getStripe();
  const found: Stripe.Subscription[] = [];
  let startingAfter: string | undefined;
  for (let page = 0; page < 20; page += 1) {
    const result = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 100,
      starting_after: startingAfter,
    });
    found.push(...result.data);
    if (!result.has_more) break;
    const last = result.data[result.data.length - 1];
    if (!last) break;
    startingAfter = last.id;
  }
  return found;
}

function subscriptionIsOpen(status: Stripe.Subscription.Status): boolean {
  return status !== "canceled" && status !== "incomplete_expired";
}

async function planStripe(
  email: string,
  customerIds: string[],
  dryRun: boolean,
): Promise<WipeAccountResult["stripe"]> {
  const decision = stripeWipeDecision(process.env.STRIPE_SECRET_KEY);
  const stripe: WipeAccountResult["stripe"] = {
    mode: decision.mode,
    customers: [],
    subscriptionIds: [],
    subscriptionsCanceled: 0,
    customersDeleted: 0,
    skippedCustomers: [],
  };
  if (decision.action === "skip") {
    stripe.skipped = decision.skipped;
    return stripe;
  }

  try {
    const byId = new Map<string, Stripe.Customer>();
    for (const customer of await listCustomersByEmail(email)) {
      byId.set(customer.id, customer);
    }
    for (const id of customerIds) {
      if (byId.has(id)) continue;
      try {
        const customer = await getStripe().customers.retrieve(id);
        if (!isLiveCustomer(customer)) {
          stripe.skippedCustomers.push({ id, reason: "bereits gelöscht" });
          continue;
        }
        if (!customer.email || !emailsEqual(customer.email, email)) {
          stripe.skippedCustomers.push({ id, reason: "E-Mail stimmt nicht überein" });
          continue;
        }
        byId.set(customer.id, customer);
      } catch (error) {
        if (isStripeResourceMissingError(error)) {
          stripe.skippedCustomers.push({ id, reason: "nicht gefunden" });
          continue;
        }
        throw error;
      }
    }

    const customers = [...byId.values()];
    stripe.customers = customers.map((customer) => customer.id).sort();
    for (const customer of customers) {
      const subscriptions = await listSubscriptions(customer.id);
      for (const subscription of subscriptions) {
        if (!subscriptionIsOpen(subscription.status)) continue;
        stripe.subscriptionIds.push(subscription.id);
      }
    }
    stripe.subscriptionIds.sort();

    if (dryRun) return stripe;

    let index = 0;
    for (const customer of customers) {
      if (index > 0) await sleep(150);
      index += 1;
      const subscriptions = await listSubscriptions(customer.id);
      for (const subscription of subscriptions) {
        if (!subscriptionIsOpen(subscription.status)) continue;
        await getStripe().subscriptions.cancel(subscription.id);
        stripe.subscriptionsCanceled += 1;
      }
      await getStripe().customers.del(customer.id);
      stripe.customersDeleted += 1;
    }
  } catch (error) {
    stripe.error = safeErrorMessage(error);
    console.error("[admin-wipe] stripe", stripe.error);
  } finally {
    if (stripe.customersDeleted > 0 || stripe.subscriptionsCanceled > 0) {
      clearStripeLookupCache();
    }
  }
  return stripe;
}

function idsFrom(scope: AccountScope): WipeAccountResult["ids"] {
  return {
    documentIds: scope.documentIds,
    familyIds: scope.familyIds,
    entityIds: scope.entityIds,
    leadIds: scope.leadIds,
    stripeCustomerIds: scope.stripeCustomerIds,
    stripeSessionIds: scope.stripeSessionIds,
    draftKeys: scope.draftKeys,
    uploadOwners: scope.uploadOwners,
  };
}

export async function wipeAccount(input: {
  email: string;
  dryRun?: boolean;
}): Promise<WipeAccountResult> {
  const email = input.email.trim().toLowerCase();
  if (!isWipeEmailAllowed(email)) {
    throw new Error("E-Mail nicht freigegeben");
  }
  const dryRun = input.dryRun !== false;
  const records: AccountRecord[] = [];
  const sheets: Record<string, SheetWipe> = {};
  const prepared: PreparedSheet[] = [];
  let sheetsSkipped: string | undefined;
  const tabsScanned: string[] = [];

  if (!isSheetsConfigured()) {
    sheetsSkipped = "Google Sheets nicht konfiguriert";
  } else {
    try {
      const tabs = await listSheetTabs();
      for (const tab of tabs) {
        try {
          const header = await readSheetHeader(tab);
          if (!header) continue;
          const match = await readMatchingSheet(tab, email, header);
          tabsScanned.push(tab.title);
          sheets[tab.title] = {
            matched: match.rows.length,
            deleted: 0,
            rows: match.rows,
          };
          prepared.push({ tab, wipe: sheets[tab.title]!, rowNumbers: match.rowNumbers });
          records.push(...match.records);
        } catch (error) {
          sheets[tab.title] = {
            matched: 0,
            deleted: 0,
            rows: [],
            error: safeErrorMessage(error),
          };
          console.error("[admin-wipe] sheet", tab.title, sheets[tab.title]?.error);
        }
      }
    } catch (error) {
      sheetsSkipped = safeErrorMessage(error);
      console.error("[admin-wipe] sheets", sheetsSkipped);
    }
  }

  const fileIntakes = await wipeJsonFile("intakes.json", email, true);
  const fileEntities = await wipeJsonFile("entities.json", email, true);
  const fileProfiles = await wipeJsonFile("profiles.json", email, true);
  const fileReadiness = await wipeJsonFile("readiness-leads.json", email, true);
  records.push(
    ...fileIntakes.records,
    ...fileEntities.records,
    ...fileProfiles.records,
    ...fileReadiness.records,
  );

  const scope = collectAccountScope(email, records);
  const local = await collectLocalArtifacts(scope, records);
  const referral = await collectReferral(scope);
  const blob = await planAccountBlobs(scope, records);
  const stripe = await planStripe(email, scope.stripeCustomerIds, dryRun);

  const files: WipeAccountResult["files"] = {
    intakes: fileIntakes.wipe,
    entities: fileEntities.wipe,
    profiles: fileProfiles.wipe,
    readiness_leads: fileReadiness.wipe,
    drafts: { ...emptyPathWipe(), pathnames: local.drafts, matched: local.drafts.length },
    pdfs: { ...emptyPathWipe(), pathnames: local.pdfs, matched: local.pdfs.length },
    chapters: {
      ...emptyPathWipe(),
      pathnames: local.chapters,
      matched: local.chapters.length,
    },
    uploads: {
      ...emptyPathWipe(),
      pathnames: local.uploads,
      matched: local.uploads.length,
    },
    referral,
  };

  if (!dryRun) {
    for (const item of prepared) {
      if (item.rowNumbers.length === 0 || item.wipe.error) continue;
      try {
        await deleteSheetRows(item.tab, item.rowNumbers);
        item.wipe.deleted = item.rowNumbers.length;
      } catch (error) {
        item.wipe.error = safeErrorMessage(error);
        console.error("[admin-wipe] sheet delete", item.tab.title, item.wipe.error);
      }
    }
    files.intakes = await commitJsonFile("intakes.json", email, fileIntakes.wipe);
    files.entities = await commitJsonFile("entities.json", email, fileEntities.wipe);
    files.profiles = await commitJsonFile("profiles.json", email, fileProfiles.wipe);
    files.readiness_leads = await commitJsonFile(
      "readiness-leads.json",
      email,
      fileReadiness.wipe,
    );
    const roots = dataDirs();
    try {
      files.drafts.deleted = await unlinkFiles(local.drafts, roots);
      files.pdfs.deleted = await unlinkFiles(local.pdfs, roots);
      files.chapters.deleted = await unlinkFiles(local.chapters, roots);
      files.uploads.deleted = await unlinkFiles(local.uploads, roots);
      for (const root of roots) {
        for (const owner of scope.uploadOwners) {
          const dir = path.resolve(root, "uploads", owner);
          const uploadsRoot = path.resolve(root, "uploads");
          const relative = path.relative(uploadsRoot, dir);
          if (relative.startsWith("..") || path.isAbsolute(relative)) continue;
          await rm(dir, { recursive: true, force: true });
        }
      }
    } catch (error) {
      const message = safeErrorMessage(error);
      files.drafts.error = message;
      console.error("[admin-wipe] local files", message);
    }
    if (referral.matched > 0 && !referral.error) {
      try {
        await deleteReferral(scope);
        files.referral.deleted = referral.matched;
      } catch (error) {
        files.referral.error = safeErrorMessage(error);
        console.error("[admin-wipe] referral", files.referral.error);
      }
    }
    if (!blob.skipped) {
      try {
        await commitBlobWipe(blob.drafts);
        await commitBlobWipe(blob.documents);
        await commitBlobWipe(blob.uploads);
      } catch (error) {
        blob.error = blob.error ?? safeErrorMessage(error);
        console.error("[admin-wipe] blob", blob.error);
      }
    }
  }

  const result: WipeAccountResult = {
    dryRun,
    email,
    sheets,
    tabsScanned,
    files,
    blob,
    stripe,
    ids: idsFrom(scope),
  };
  if (sheetsSkipped) result.sheetsSkipped = sheetsSkipped;

  console.info("[admin-wipe] fertig", {
    dryRun,
    email,
    sheetTabs: tabsScanned.length,
    blobDrafts: blob.drafts.matched,
    blobDocuments: blob.documents.matched,
    blobUploads: blob.uploads.matched,
    stripeMode: stripe.mode,
  });
  return result;
}
