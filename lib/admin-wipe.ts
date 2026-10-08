import { timingSafeEqual } from "node:crypto";
import { intakeDraftBlobPath, intakeDraftHash } from "@/lib/draft-path";
import { intakeAnswersBlobPath } from "@/lib/intake-payload";
import { documentFamilyId } from "@/lib/documents";
import { normalizeDraftKey } from "@/lib/intake-draft-shared";
import { emailsEqual } from "@/lib/types";
import { wipeUploadOwner } from "@/lib/upload-path";

/**
 * Fixed addresses that may be wiped. Comparison is case-insensitive.
 * Any mailbox at the exact domain `example.com` is also allowed
 * (no subdomains, no lookalike hosts). Anything else is rejected
 * before a store is touched.
 */
export const WIPE_EMAIL_ALLOWLIST = [
  "philip.cappelletti@sdc-ventures.com",
  "cappe@gmx.de",
  "delivered@resend.dev",
] as const;

/** Exact documentation host. Subdomains such as `foo.example.com` do not match. */
const WIPE_TEST_DOMAIN = "example.com";

/**
 * Synthetic preview-smoke mailbox. Allowed because its domain is exactly
 * `example.com`, under the same bearer token and dry-run default as every
 * other wipe. `GOBD_BLOB_SMOKE` does not widen or narrow this list.
 */
export const WIPE_SMOKE_EMAIL = "draft-blob-smoke@example.com";

export const ADMIN_WIPE_TOKEN_MIN_LENGTH = 32;

const STRICT_EMAIL_HEADERS = new Set([
  "email",
  "e_mail",
  "user_email",
  "account_email",
  "customer_email",
]);

const FALLBACK_OWNER_HEADERS = new Set(["owner_email", "owner"]);

const SECRET_KEY = /token|secret|password|private_key|authorization|api_key/i;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type StripeSecretMode = "test" | "live" | "missing" | "unknown";

export type AccountRecord = {
  email: string;
  documentId: string;
  parentDocumentId: string;
  entityId: string;
  stripeSessionId: string;
  stripeCustomerId: string;
  leadId: string;
  pdfUrl: string;
  chapterContent: string;
  version: string;
};

export type AccountScope = {
  email: string;
  documentIds: string[];
  familyIds: string[];
  entityIds: string[];
  leadIds: string[];
  stripeSessionIds: string[];
  stripeCustomerIds: string[];
  draftKeys: string[];
  draftHashes: string[];
  uploadOwners: string[];
};

export type WipeCount = {
  matched: number;
  deleted: number;
  skipped?: string;
  error?: string;
};

export type SheetBackupRow = {
  sheetRow: number;
  cells: Record<string, string>;
};

export type SheetWipe = WipeCount & {
  rows: SheetBackupRow[];
};

export type FileJsonWipe = WipeCount & {
  paths: string[];
  rows: unknown[];
};

export type BlobObjectWipe = {
  pathname: string;
  /** ISO time from `head()`. Set when the object was still in the store. */
  uploadedAt?: string;
  /** True only after `head()` throws `BlobNotFoundError`. */
  deleted?: boolean;
  /** Set when this path could not be inspected or was still present after `del()`. */
  error?: string;
};

export type PathWipe = WipeCount & {
  pathnames: string[];
  /** Blob groups only. Local file wipes leave this unset. */
  blobs?: BlobObjectWipe[];
};

export type WipeAccountResult = {
  dryRun: boolean;
  email: string;
  sheetsSkipped?: string;
  sheets: Record<string, SheetWipe>;
  tabsScanned: string[];
  files: {
    intakes: FileJsonWipe;
    entities: FileJsonWipe;
    profiles: FileJsonWipe;
    readiness_leads: FileJsonWipe;
    drafts: PathWipe;
    pdfs: PathWipe;
    chapters: PathWipe;
    uploads: PathWipe;
    referral: PathWipe & { keys: string[] };
  };
  blob: {
    skipped?: string;
    drafts: PathWipe;
    documents: PathWipe;
    uploads: PathWipe;
    contentChecks: number;
    contentChecksSkipped: number;
    error?: string;
  };
  stripe: {
    mode: StripeSecretMode;
    skipped?: string;
    customers: string[];
    subscriptionIds: string[];
    subscriptionsCanceled: number;
    customersDeleted: number;
    skippedCustomers: Array<{ id: string; reason: string }>;
    error?: string;
  };
  ids: {
    documentIds: string[];
    familyIds: string[];
    entityIds: string[];
    leadIds: string[];
    stripeCustomerIds: string[];
    stripeSessionIds: string[];
    draftKeys: string[];
    uploadOwners: string[];
  };
};

export function normalizeHeaderKey(col: string): string {
  return col.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

export function adminWipeToken(envValue: string | undefined): string | null {
  if (typeof envValue !== "string") return null;
  const token = envValue.trim();
  if (token.length < ADMIN_WIPE_TOKEN_MIN_LENGTH) return null;
  return token;
}

export function bearerTokenFromHeader(authorization: string | null): string | null {
  if (!authorization) return null;
  const match = /^Bearer\s+(\S+)$/i.exec(authorization.trim());
  return match?.[1] ?? null;
}

/** Timing-safe compare. Length mismatches still touch the expected secret once. */
export function adminTokensMatch(provided: string, expected: string): boolean {
  const expectedBuf = Buffer.from(expected, "utf8");
  if (expectedBuf.length === 0) return false;
  if (provided.length > 4096) {
    timingSafeEqual(expectedBuf, Buffer.alloc(expectedBuf.length));
    return false;
  }
  const providedBuf = Buffer.from(provided, "utf8");
  if (providedBuf.length !== expectedBuf.length) {
    timingSafeEqual(expectedBuf, Buffer.alloc(expectedBuf.length));
    return false;
  }
  return timingSafeEqual(providedBuf, expectedBuf);
}

/** One `@`, non-empty local part, domain compared after trim and lowercasing. */
function hasExactEmailDomain(normalized: string, domain: string): boolean {
  const at = normalized.indexOf("@");
  if (at <= 0 || at !== normalized.lastIndexOf("@")) return false;
  return normalized.slice(at + 1) === domain;
}

export function isWipeEmailAllowed(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  if (WIPE_EMAIL_ALLOWLIST.some((item) => item === normalized)) return true;
  return hasExactEmailDomain(normalized, WIPE_TEST_DOMAIN);
}

export function parseWipeEmail(
  value: unknown,
):
  | { ok: true; email: string }
  | { ok: false; reason: "invalid" | "forbidden" } {
  if (typeof value !== "string") return { ok: false, reason: "invalid" };
  const email = value.trim().toLowerCase();
  if (!email || email.length > 320 || !EMAIL_RE.test(email)) {
    return { ok: false, reason: "invalid" };
  }
  if (!isWipeEmailAllowed(email)) return { ok: false, reason: "forbidden" };
  return { ok: true, email };
}

/** Missing or any value other than boolean false stays a dry run. */
export function resolveDryRun(value: unknown): boolean {
  return value !== false;
}

/**
 * Strict email columns win. `owner` is used only when the tab has no email column,
 * so a foreign row is not deleted because a test address appears beside it.
 */
export function ownerColumnIndexes(header: string[]): number[] {
  const strict: number[] = [];
  const fallback: number[] = [];
  header.forEach((col, index) => {
    const key = normalizeHeaderKey(col);
    if (STRICT_EMAIL_HEADERS.has(key)) strict.push(index);
    else if (FALLBACK_OWNER_HEADERS.has(key)) fallback.push(index);
  });
  return strict.length > 0 ? strict : fallback;
}

export function cellsMatchEmail(
  header: string[],
  values: readonly string[],
  email: string,
): boolean {
  const indexes = ownerColumnIndexes(header);
  if (indexes.length === 0) return false;
  return indexes.some((index) => emailsEqual(values[index] ?? "", email));
}

function pickString(raw: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

export function accountRecordFromUnknown(value: unknown): AccountRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const strict = pickString(raw, [
    "email",
    "e_mail",
    "userEmail",
    "user_email",
    "account_email",
    "accountEmail",
    "customer_email",
    "customerEmail",
  ]);
  const fallback = pickString(raw, ["ownerEmail", "owner_email", "owner"]);
  const email = strict || (fallback.includes("@") ? fallback : "");
  return {
    email,
    documentId: pickString(raw, ["documentId", "document_id"]),
    parentDocumentId: pickString(raw, ["parentDocumentId", "parent_document_id"]),
    entityId: pickString(raw, ["entityId", "entity_id"]),
    stripeSessionId: pickString(raw, ["stripeSessionId", "stripe_session_id"]),
    stripeCustomerId: pickString(raw, ["stripeCustomerId", "stripe_customer_id"]),
    leadId: pickString(raw, ["leadId", "lead_id"]),
    pdfUrl: pickString(raw, ["pdfUrl", "pdf_url"]),
    chapterContent: pickString(raw, ["chapterContent", "chapter_content"]),
    version: pickString(raw, ["version"]),
  };
}

export function unknownMatchesEmail(value: unknown, email: string): boolean {
  const record = accountRecordFromUnknown(value);
  if (!record?.email) return false;
  return emailsEqual(record.email, email);
}

export function accountRecordFromCells(
  header: string[],
  values: readonly string[],
): AccountRecord {
  const asObject: Record<string, string> = {};
  header.forEach((col, index) => {
    const key = normalizeHeaderKey(col);
    if (!key || asObject[key]) return;
    asObject[key] = String(values[index] ?? "").trim();
  });
  return (
    accountRecordFromUnknown(asObject) ?? {
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
    }
  );
}

function addId(target: Set<string>, value: string): void {
  const trimmed = value.trim();
  if (!trimmed || trimmed.includes("/") || trimmed.includes("\\") || trimmed.includes("..")) {
    return;
  }
  target.add(trimmed);
}

export function draftKeysForAccount(input: {
  email: string;
  documentIds: readonly string[];
  sessionIds: readonly string[];
  entityIds: readonly string[];
}): string[] {
  const keys = new Set<string>();
  const email = input.email.trim().toLowerCase();
  for (const documentId of input.documentIds) {
    if (!documentId.trim()) continue;
    keys.add(normalizeDraftKey({ documentId }));
    keys.add(normalizeDraftKey({ areaFromDocumentId: documentId, modus: "gesamt" }));
    keys.add(normalizeDraftKey({ areaFromDocumentId: documentId, modus: "bereich" }));
  }
  for (const sessionId of input.sessionIds) {
    if (!sessionId.trim()) continue;
    keys.add(normalizeDraftKey({ sessionId, modus: "gesamt" }));
    keys.add(normalizeDraftKey({ sessionId, modus: "bereich" }));
  }
  if (email) {
    keys.add(normalizeDraftKey({ email, modus: "gesamt" }));
    keys.add(normalizeDraftKey({ email, modus: "bereich" }));
    for (const entityId of input.entityIds) {
      if (!entityId.trim()) continue;
      keys.add(normalizeDraftKey({ email, entityId, modus: "gesamt" }));
      keys.add(normalizeDraftKey({ email, entityId, modus: "bereich" }));
    }
  }
  keys.delete("");
  return [...keys];
}

export function collectAccountScope(
  email: string,
  records: readonly AccountRecord[],
): AccountScope {
  const normalized = email.trim().toLowerCase();
  const documentIds = new Set<string>();
  const familyIds = new Set<string>();
  const entityIds = new Set<string>();
  const leadIds = new Set<string>();
  const stripeSessionIds = new Set<string>();
  const stripeCustomerIds = new Set<string>();

  for (const record of records) {
    addId(documentIds, record.documentId);
    addId(entityIds, record.entityId);
    addId(leadIds, record.leadId);
    addId(stripeSessionIds, record.stripeSessionId);
    addId(stripeCustomerIds, record.stripeCustomerId);
    const family = documentFamilyId({
      documentId: record.documentId,
      parentDocumentId: record.parentDocumentId,
    });
    addId(familyIds, family);
    if (record.leadId.trim()) addId(familyIds, `readiness-${record.leadId.trim()}`);
  }

  const draftKeys = draftKeysForAccount({
    email: normalized,
    documentIds: [...documentIds],
    sessionIds: [...stripeSessionIds],
    entityIds: [...entityIds],
  });
  const draftHashes = draftKeys.map((key) => intakeDraftHash(key));

  const uploadOwners = new Set<string>();
  for (const key of [
    normalized,
    ...documentIds,
    ...entityIds,
    ...stripeSessionIds,
  ]) {
    const owner = wipeUploadOwner(key);
    if (owner) uploadOwners.add(owner);
  }

  return {
    email: normalized,
    documentIds: [...documentIds].sort(),
    familyIds: [...familyIds].sort(),
    entityIds: [...entityIds].sort(),
    leadIds: [...leadIds].sort(),
    stripeSessionIds: [...stripeSessionIds].sort(),
    stripeCustomerIds: [...stripeCustomerIds].sort(),
    draftKeys: [...draftKeys].sort(),
    draftHashes,
    uploadOwners: [...uploadOwners].sort(),
  };
}

export function derivedDraftPaths(scope: AccountScope): string[] {
  return scope.draftKeys.map((key) => intakeDraftBlobPath(key));
}

export function derivedDocumentPaths(records: readonly AccountRecord[]): string[] {
  const paths = new Set<string>();
  for (const record of records) {
    const family = documentFamilyId({
      documentId: record.documentId,
      parentDocumentId: record.parentDocumentId,
    });
    const version = Number.parseInt(record.version, 10);
    const safeVersion = Number.isFinite(version) && version > 0 ? version : 0;
    if (family && safeVersion > 0 && !family.includes("/")) {
      paths.add(`gobd/${family}/v${safeVersion}.pdf`);
      paths.add(`gobd/${family}/v${safeVersion}-chapters.json`);
      const documentId = record.documentId.trim();
      if (documentId && !documentId.includes("/") && !documentId.includes("..")) {
        try {
          paths.add(intakeAnswersBlobPath(family, documentId, safeVersion));
        } catch {
          // Ungültige Id erzeugt keinen Antwort-Pfad.
        }
      }
    }
    if (record.leadId.trim()) {
      paths.add(`gobd/readiness-${record.leadId.trim()}/v1.pdf`);
    }
  }
  return [...paths];
}

export type BlobClass = "draft" | "upload" | "document";

export function classifyBlobPathname(
  pathname: string,
  scope: Pick<AccountScope, "draftHashes" | "uploadOwners" | "familyIds">,
): BlobClass | null {
  const path = pathname.replace(/^\/+/, "");
  if (path.startsWith("gobd/drafts/")) {
    const file = path.slice("gobd/drafts/".length);
    if (!file || file.includes("/")) return null;
    const hash = file.replace(/\.json$/i, "");
    return scope.draftHashes.includes(hash) ? "draft" : null;
  }
  if (path.startsWith("gobd/uploads/")) {
    const parts = path.split("/");
    const owner = parts[2] ?? "";
    if (!owner || owner === ".." || owner === ".") return null;
    return scope.uploadOwners.includes(owner) ? "upload" : null;
  }
  const match = /^gobd\/([^/]+)\//.exec(path);
  if (!match) return null;
  const familyId = match[1] ?? "";
  return scope.familyIds.includes(familyId) ? "document" : null;
}

export function draftPayloadMatchesEmail(payload: unknown, email: string): boolean {
  if (!payload || typeof payload !== "object") return false;
  const draft = payload as { email?: unknown; draftKey?: unknown };
  if (typeof draft.email === "string" && emailsEqual(draft.email, email)) return true;
  if (typeof draft.draftKey !== "string") return false;
  const key = draft.draftKey.trim().toLowerCase();
  const needle = `email:${email.trim().toLowerCase()}`;
  return key === needle || key.startsWith(`${needle}:`);
}

export function localPdfNameMatches(filename: string, familyIds: readonly string[]): boolean {
  for (const familyId of familyIds) {
    if (!familyId || familyId.includes("/") || familyId.includes("..")) continue;
    if (filename === `${familyId}.pdf`) return true;
    if (filename.startsWith(`${familyId}-v`) && filename.endsWith(".pdf")) return true;
  }
  return false;
}

export function localAnswerNameMatches(
  filename: string,
  documentIds: readonly string[],
): boolean {
  for (const documentId of documentIds) {
    if (!documentId || documentId.includes("/") || documentId.includes("..")) continue;
    if (filename.startsWith(`${documentId}-v`) && filename.endsWith("-answers.json")) {
      return true;
    }
  }
  return false;
}

export function localChapterNameMatches(
  filename: string,
  documentIds: readonly string[],
): boolean {
  for (const documentId of documentIds) {
    if (!documentId || documentId.includes("/") || documentId.includes("..")) continue;
    if (filename === `${documentId}.json`) return true;
  }
  return false;
}

export function referralKeyMatches(key: string, scope: AccountScope): boolean {
  for (const id of scope.documentIds) {
    if (key === `doc-${id}`) return true;
  }
  for (const id of scope.stripeSessionIds) {
    if (key === `session-${id}`) return true;
  }
  return false;
}

export function classifyStripeSecret(secret: string | undefined): StripeSecretMode {
  const key = secret?.trim() ?? "";
  if (!key) return "missing";
  if (key.startsWith("sk_test_") || key.startsWith("rk_test_")) return "test";
  if (key.startsWith("sk_live_") || key.startsWith("rk_live_")) return "live";
  return "unknown";
}

export function stripeWipeDecision(secret: string | undefined):
  | { action: "wipe"; mode: "test" }
  | { action: "skip"; mode: Exclude<StripeSecretMode, "test">; skipped: string } {
  const mode = classifyStripeSecret(secret);
  if (mode === "test") return { action: "wipe", mode };
  if (mode === "live") {
    return { action: "skip", mode, skipped: "Live-Key — Stripe übersprungen" };
  }
  if (mode === "missing") {
    return { action: "skip", mode, skipped: "STRIPE_SECRET_KEY fehlt — Stripe übersprungen" };
  }
  return {
    action: "skip",
    mode,
    skipped: "Stripe-Key ist kein Test-Key (sk_test_ oder rk_test_) — Stripe übersprungen",
  };
}

export function redactBackupString(value: string): string {
  if (/^https?:\/\//i.test(value) && /[?&](?:token|sig|signature)=/i.test(value)) {
    return `${value.split("?")[0]}?[redacted]`;
  }
  return value;
}

export function redactBackupCells(cells: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(cells)) {
    out[key] = SECRET_KEY.test(key) ? (value ? "[redacted]" : "") : redactBackupString(value);
  }
  return out;
}

export function redactForBackup(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => redactForBackup(item));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
      if (SECRET_KEY.test(key)) {
        out[key] = inner ? "[redacted]" : "";
      } else if (typeof inner === "string") {
        out[key] = redactBackupString(inner);
      } else {
        out[key] = redactForBackup(inner);
      }
    }
    return out;
  }
  if (typeof value === "string") return redactBackupString(value);
  return value;
}

export function safeErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "Unbekannter Fehler";
  return message
    .replace(/\b(?:sk|rk)_(?:test|live)_[A-Za-z0-9]+\b/g, "[redacted]")
    .replace(/-----BEGIN[\s\S]*?-----END[^\n]*-----/g, "[redacted]")
    .slice(0, 400);
}

export function emptyPathWipe(skipped?: string): PathWipe {
  return skipped ? { matched: 0, deleted: 0, pathnames: [], skipped } : { matched: 0, deleted: 0, pathnames: [] };
}

export function emptyFileWipe(): FileJsonWipe {
  return { matched: 0, deleted: 0, paths: [], rows: [] };
}
