/**
 * Durable claim before every Resend send.
 *
 * The ledger is one JSON object per logical mail. With `BLOB_READ_WRITE_TOKEN`
 * it lives in the private Vercel Blob store (`gobd/mail-dedupe/`), the same
 * store as drafts and the onboarding marker. Otherwise it uses the app file
 * fallback (`.data` locally, `/tmp` on Vercel). No new service and no new env.
 *
 * Create is exclusive (`wx` on disk, `allowOverwrite: false` on Blob), so a
 * webhook and the checkout grant cannot both pass the check. The same key is
 * sent as Resend `Idempotency-Key` (characters outside `[A-Za-z0-9_-]` become
 * `-`, because Resend rejects them).
 */

import { createHash } from "node:crypto";
import { mkdir, open, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  BlobNotFoundError,
  BlobPreconditionFailedError,
  del,
  get,
  put,
} from "@vercel/blob";
import { isBlobConfigured, isProductionRuntime } from "@/lib/env";
import { sendEmail, type MailResult } from "@/lib/mail";
import { getFileFallbackDir } from "@/lib/store";

/** User-requested login links may repeat, but not twice inside this window. */
export const MAGIC_LINK_WINDOW_MS = 60_000;

const PENDING_FRESH_MS = 2 * 60 * 1000;
const WAIT_MS = 4_000;

export type DedupedMailInput = {
  /** Logical mail, e.g. `onboarding:${sessionId}` or `delivery:${docId}:${version}`. */
  dedupeKey: string;
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
  from?: string;
  attachments?: Parameters<typeof sendEmail>[0]["attachments"];
  /**
   * When set, a later send with the same key is allowed after this many
   * milliseconds. Magic links pass {@link MAGIC_LINK_WINDOW_MS}.
   */
  windowMs?: number;
};

type DedupeRecord = {
  key: string;
  status: "pending" | "sent";
  at: string;
  expiresAt?: string;
  resendKey: string;
};

type SendMail = (input: Parameters<typeof sendEmail>[0]) => Promise<MailResult>;

let fileRootOverride: string | null = null;
let nowFn: () => number = () => Date.now();
let sendOverride: SendMail | null = null;
const tails = new Map<string, Promise<void>>();

/** Isolated file ledger and clock for the prebuild check. */
export function setMailDedupeTestHooks(
  hooks: {
    dir?: string;
    now?: () => number;
    send?: SendMail;
  } | null,
): void {
  fileRootOverride = hooks?.dir ?? null;
  nowFn = hooks?.now ?? (() => Date.now());
  sendOverride = hooks?.send ?? null;
  tails.clear();
}

export function onboardingMailKey(sessionId: string): string {
  return `onboarding:${sessionId.trim()}`;
}

export function failedPaymentMailKey(anchor: string): string {
  return `failed-payment:${anchor.trim()}`;
}

export function failedJobMailKey(scope: string, job: string): string {
  return `failed-job:${scope.trim()}:${job.trim()}`;
}

export function deliveryMailKey(documentId: string, version: number): string {
  return `delivery:${documentId.trim()}:${version}`;
}

export function magicLinkMailKey(email: string): string {
  return `magic-link:${email.trim().toLowerCase()}`;
}

export function partnerInquiryMailKey(hash: string): string {
  return `partner-inquiry:${hash}`;
}

export function readinessMailKey(hash: string): string {
  return `readiness:${hash}`;
}

/** One readiness mail per distinct submission, including a double click. */
export function readinessDedupeKey(input: {
  email: string;
  name?: string;
  company?: string;
  answers: unknown;
}): string {
  const payload = JSON.stringify({
    email: input.email.trim().toLowerCase(),
    name: (input.name ?? "").trim(),
    company: (input.company ?? "").trim(),
    answers: input.answers ?? null,
  });
  return readinessMailKey(createHash("sha256").update(payload).digest("hex").slice(0, 40));
}

/** Resend allows only letters, digits, hyphen and underscore, at most 256. */
export function resendIdempotencyKey(logicalKey: string): string {
  const safe = logicalKey.replace(/[^A-Za-z0-9_-]/g, "-");
  if (safe.length > 0 && safe.length <= 256) return safe;
  return `mail-${createHash("sha256").update(logicalKey).digest("hex")}`.slice(0, 256);
}

function storageId(key: string): string {
  return createHash("sha256").update(key).digest("hex").slice(0, 40);
}

function blobStoreEnabled(): boolean {
  if (fileRootOverride) return false;
  return isBlobConfigured() && Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
}

function fileRoot(): string {
  if (fileRootOverride) return fileRootOverride;
  return path.join(getFileFallbackDir(), "mail-dedupe");
}

function filePath(key: string): string {
  return path.join(fileRoot(), `${storageId(key)}.json`);
}

function blobPath(key: string): string {
  return `gobd/mail-dedupe/${storageId(key)}.json`;
}

function blobToken(): string {
  return process.env.BLOB_READ_WRITE_TOKEN?.trim() ?? "";
}

function parseRecord(raw: string): DedupeRecord | null {
  try {
    const parsed = JSON.parse(raw) as Partial<DedupeRecord>;
    if (!parsed || typeof parsed.key !== "string" || !parsed.key) return null;
    if (parsed.status !== "pending" && parsed.status !== "sent") return null;
    if (typeof parsed.at !== "string" || !parsed.at) return null;
    if (typeof parsed.resendKey !== "string" || !parsed.resendKey) return null;
    return {
      key: parsed.key,
      status: parsed.status,
      at: parsed.at,
      resendKey: parsed.resendKey,
      ...(typeof parsed.expiresAt === "string" && parsed.expiresAt
        ? { expiresAt: parsed.expiresAt }
        : {}),
    };
  } catch {
    return null;
  }
}

function isBlobConflict(error: unknown): boolean {
  if (error instanceof BlobPreconditionFailedError) return true;
  const name =
    error instanceof Error ? error.constructor?.name ?? error.name : "";
  if (name === "BlobPreconditionFailedError") return true;
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return message.includes("already exists") || message.includes("precondition");
}

function isBlobMissing(error: unknown): boolean {
  if (error instanceof BlobNotFoundError) return true;
  const name =
    error instanceof Error ? error.constructor?.name ?? error.name : "";
  return name === "BlobNotFoundError";
}

function errorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object" || !("code" in error)) return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
}

async function createRecord(
  key: string,
  record: DedupeRecord,
): Promise<"created" | "exists"> {
  const body = JSON.stringify(record);
  if (blobStoreEnabled()) {
    try {
      await put(blobPath(key), body, {
        access: "private",
        addRandomSuffix: false,
        allowOverwrite: false,
        contentType: "application/json; charset=utf-8",
        token: blobToken(),
      });
      return "created";
    } catch (error) {
      if (isBlobConflict(error)) return "exists";
      throw error;
    }
  }
  const file = filePath(key);
  await mkdir(path.dirname(file), { recursive: true });
  let handle;
  try {
    handle = await open(file, "wx");
  } catch (error) {
    if (errorCode(error) === "EEXIST") return "exists";
    throw error;
  }
  try {
    await handle.writeFile(body, "utf8");
  } finally {
    await handle.close();
  }
  return "created";
}

async function readRecord(key: string): Promise<DedupeRecord | null> {
  if (blobStoreEnabled()) {
    try {
      const result = await get(blobPath(key), {
        access: "private",
        useCache: false,
        token: blobToken(),
      });
      if (!result || result.statusCode !== 200 || !result.stream) return null;
      return parseRecord(await new Response(result.stream).text());
    } catch (error) {
      if (isBlobMissing(error)) return null;
      throw error;
    }
  }
  try {
    return parseRecord(await readFile(filePath(key), "utf8"));
  } catch (error) {
    if (errorCode(error) === "ENOENT") return null;
    throw error;
  }
}

async function writeRecord(key: string, record: DedupeRecord): Promise<void> {
  const body = JSON.stringify(record);
  if (blobStoreEnabled()) {
    await put(blobPath(key), body, {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json; charset=utf-8",
      token: blobToken(),
    });
    return;
  }
  const file = filePath(key);
  await mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Math.random().toString(16).slice(2)}.tmp`;
  await writeFile(tmp, body, "utf8");
  await rename(tmp, file);
}

async function removeRecord(key: string): Promise<void> {
  if (blobStoreEnabled()) {
    try {
      await del(blobPath(key), { token: blobToken() });
    } catch (error) {
      if (isBlobMissing(error)) return;
      throw error;
    }
    return;
  }
  try {
    await unlink(filePath(key));
  } catch (error) {
    if (errorCode(error) === "ENOENT") return;
    throw error;
  }
}

/** Exclusive insert used by the prebuild race check. */
export async function tryClaimMailDedupeSlot(
  key: string,
): Promise<"created" | "exists"> {
  const at = new Date(nowFn()).toISOString();
  return createRecord(key, {
    key,
    status: "pending",
    at,
    resendKey: key,
  });
}

function blocks(row: DedupeRecord, now: number, windowMs?: number): boolean {
  if (row.status !== "sent") return false;
  if (!windowMs) return true;
  const expires = row.expiresAt ? Date.parse(row.expiresAt) : Number.NaN;
  return Number.isFinite(expires) && expires > now;
}

function freshPending(row: DedupeRecord, now: number): boolean {
  if (row.status !== "pending") return false;
  const at = Date.parse(row.at);
  return Number.isFinite(at) && now - at < PENDING_FRESH_MS;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

type Acquire =
  | { role: "owner"; resendKey: string; at: string }
  | { role: "duplicate"; inflight: boolean };

async function acquire(logicalKey: string, windowMs?: number): Promise<Acquire> {
  const deadline = nowFn() + WAIT_MS;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const existing = await readRecord(logicalKey);
    const now = nowFn();
    if (existing && blocks(existing, now, windowMs)) {
      return { role: "duplicate", inflight: false };
    }
    if (existing && freshPending(existing, now)) {
      if (nowFn() >= deadline) return { role: "duplicate", inflight: true };
      await sleep(100);
      continue;
    }
    const at = new Date(now).toISOString();
    const resendKey = windowMs ? `${logicalKey}:${at}` : logicalKey;
    const record: DedupeRecord = {
      key: logicalKey,
      status: "pending",
      at,
      resendKey,
      ...(windowMs ? { expiresAt: new Date(now + windowMs).toISOString() } : {}),
    };
    if (!existing) {
      const created = await createRecord(logicalKey, record);
      if (created === "created") return { role: "owner", resendKey, at };
      continue;
    }
    const renewKey = `${logicalKey}\0renew\0${existing.at}`;
    const renew = await createRecord(renewKey, {
      ...record,
      key: renewKey,
      status: "sent",
      resendKey: renewKey,
    });
    if (renew === "exists") {
      await sleep(50);
      continue;
    }
    await writeRecord(logicalKey, record);
    return { role: "owner", resendKey, at };
  }
  return { role: "duplicate", inflight: true };
}

async function finishOwned(
  logicalKey: string,
  ownedAt: string,
  resendKey: string,
  windowMs: number | undefined,
): Promise<void> {
  const current = await readRecord(logicalKey);
  if (current && current.at !== ownedAt) return;
  const now = nowFn();
  await writeRecord(logicalKey, {
    key: logicalKey,
    status: "sent",
    at: ownedAt,
    resendKey,
    ...(windowMs ? { expiresAt: new Date(now + windowMs).toISOString() } : {}),
  });
}

async function releaseOwned(logicalKey: string, ownedAt: string): Promise<void> {
  const current = await readRecord(logicalKey);
  if (!current || current.at !== ownedAt) return;
  await removeRecord(logicalKey);
}

async function deliverMail(input: Parameters<typeof sendEmail>[0]): Promise<MailResult> {
  if (sendOverride) return sendOverride(input);
  return sendEmail(input);
}

function lock<T>(key: string, run: () => Promise<T>): Promise<T> {
  const previous = tails.get(key) ?? Promise.resolve();
  const current = previous.then(run, run);
  const settled = current.then(
    () => undefined,
    () => undefined,
  );
  tails.set(key, settled);
  void settled.then(() => {
    if (tails.get(key) === settled) tails.delete(key);
  });
  return current;
}

async function sendDedupedEmailLocked(input: DedupedMailInput): Promise<MailResult> {
  const dedupeKey = input.dedupeKey.trim();
  if (!dedupeKey) return { stub: false, sent: false };
  const claim = await acquire(dedupeKey, input.windowMs);
  if (claim.role === "duplicate") {
    console.info("[mail] bereits beansprucht", { key: dedupeKey, inflight: claim.inflight });
    return {
      stub: false,
      sent: false,
      duplicate: true,
      ...(claim.inflight ? { inflight: true } : {}),
    };
  }
  const result = await deliverMail({
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
    replyTo: input.replyTo,
    from: input.from,
    attachments: input.attachments,
    idempotencyKey: resendIdempotencyKey(claim.resendKey),
  });
  const keep = result.sent || (result.stub && !isProductionRuntime());
  try {
    if (keep) await finishOwned(dedupeKey, claim.at, claim.resendKey, input.windowMs);
    else await releaseOwned(dedupeKey, claim.at);
  } catch (error) {
    console.error(
      "[mail] Dedupe-Abschluss fehlgeschlagen",
      error instanceof Error ? error.name : "error",
    );
  }
  return result;
}

/** Whether this logical mail was already claimed. Does not send and does not claim. */
export async function lookupMailDedupe(key: string): Promise<"free" | "sent" | "inflight"> {
  const dedupeKey = key.trim();
  if (!dedupeKey) return "free";
  try {
    const row = await readRecord(dedupeKey);
    if (!row) return "free";
    const now = nowFn();
    if (blocks(row, now)) return "sent";
    if (freshPending(row, now)) return "inflight";
    return "free";
  } catch (error) {
    console.error("[mail] Dedupe-Lesung fehlgeschlagen", error instanceof Error ? error.name : "error");
    return "free";
  }
}

export async function sendDedupedEmail(input: DedupedMailInput): Promise<MailResult> {
  try {
    return await lock(input.dedupeKey.trim(), () => sendDedupedEmailLocked(input));
  } catch (error) {
    console.error(
      "[mail] Dedupe fehlgeschlagen",
      error instanceof Error ? error.name : "error",
    );
    return { stub: false, sent: false };
  }
}
