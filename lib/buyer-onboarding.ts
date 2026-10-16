/**
 * Order confirmation and magic link for the buyer named by Stripe.
 * The browser session is never the recipient. A foreign login, a missing
 * cookie, and the mismatch page must not suppress the mail.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  BlobNotFoundError,
  BlobPreconditionFailedError,
  del,
  get,
  put,
  type GetCommandOptions,
  type PutCommandOptions,
} from "@vercel/blob";
import { isCompAccessEmail } from "@/lib/comp-access";
import { isBlobConfigured, isProductionRuntime } from "@/lib/env";
import { automatedRunForbidsLiveWrites } from "@/lib/live-write-guard";
import { triggerOnboardingMail, type OnboardingAudience } from "@/lib/ops";
import { isTestEntity } from "@/lib/test-entities";
import { findRowByStripeSessionId, getFileFallbackDir } from "@/lib/store";

/** A return visit long after payment must not send a second welcome mail. */
export const BUYER_ONBOARDING_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * A claiming marker younger than this is an in-flight send.
 * An older marker is an orphan and may be taken over.
 * The wait is longer than the 2-minute mail-dedupe pending window, so the
 * ledger key `onboarding:${sessionId}` and the Resend Idempotency-Key can
 * still refuse a second provider send.
 */
export const ONBOARDING_CLAIM_FRESH_MS = 4 * 60 * 1000;

const CLAIM_ATTEMPTS = 5;

export type BuyerOnboardingStatus = "sent" | "stub" | "skipped" | "failed" | "inflight";

export type BuyerOnboardingInput = {
  email: string;
  company?: string;
  sessionId: string;
  audience?: OnboardingAudience;
  checkoutNames?: string[];
  extraCompanyNames?: string[];
  /** Firm id from checkout metadata or the bound buyer firm. */
  entityId?: string | null;
  /**
   * Paid-row timestamp. With `enforceWindow`, a row older than
   * {@link BUYER_ONBOARDING_WINDOW_MS} is left alone. The webhook omits this
   * so a Stripe retry can still send.
   */
  paidAt?: string | null;
  enforceWindow?: boolean;
};

type OnboardingMarker = {
  email: string;
  status?: "claiming" | "sent" | "stub";
  claimedAt?: string;
  sentAt?: string;
};

type MarkerState = OnboardingMarker | "unreadable" | null;

type LoadedMarker = {
  state: MarkerState;
  /** Wall time of an unreadable body. A young one is still being written. */
  observedAt: number | null;
};

type StoreLocation =
  | { kind: "file"; file: string }
  | { kind: "blob"; path: string; token: string };

let fileRootOverride: string | null = null;
let nowFn: () => number = () => Date.now();

/** Isolated marker directory and clock for the prebuild check. */
export function setBuyerOnboardingTestHooks(
  hooks: { dir?: string; now?: () => number } | null,
): void {
  fileRootOverride = hooks?.dir ?? null;
  nowFn = hooks?.now ?? (() => Date.now());
}

function sessionHash(sessionId: string): string {
  return createHash("sha256").update(sessionId.trim()).digest("hex").slice(0, 40);
}

function generationId(claimedAt: string): string {
  return createHash("sha256").update(claimedAt).digest("hex").slice(0, 16);
}

function markerRoot(): string {
  if (fileRootOverride) return fileRootOverride;
  return path.join(getFileFallbackDir(), "onboarding-mail");
}

function markerFile(sessionId: string): string {
  return path.join(markerRoot(), `${sessionHash(sessionId)}.json`);
}

/** Test helper. Not a public route. */
export function buyerOnboardingMarkerFileForTests(sessionId: string): string {
  return markerFile(sessionId);
}

function markerBlobPath(sessionId: string): string {
  return `gobd/onboarding-mail/${sessionHash(sessionId)}.json`;
}

function lockFile(sessionId: string, claimedAt: string): string {
  return path.join(markerRoot(), `${sessionHash(sessionId)}.claim.${generationId(claimedAt)}.json`);
}

function lockBlobPath(sessionId: string, claimedAt: string): string {
  return `gobd/onboarding-mail/${sessionHash(sessionId)}.claim.${generationId(claimedAt)}.json`;
}

function blobToken(): string | undefined {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  return token || undefined;
}

function blobTokenInUse(): string | null {
  if (fileRootOverride) return null;
  if (automatedRunForbidsLiveWrites()) return null;
  if (!isBlobConfigured()) return null;
  return blobToken() ?? null;
}

function writeOptions(token: string, allowOverwrite = true): PutCommandOptions {
  return {
    access: "private",
    contentType: "application/json; charset=utf-8",
    addRandomSuffix: false,
    allowOverwrite,
    token,
  };
}

function readOptions(token: string): GetCommandOptions {
  return { access: "private", useCache: false, token };
}

function markerLocation(sessionId: string): StoreLocation {
  const token = blobTokenInUse();
  if (token) return { kind: "blob", path: markerBlobPath(sessionId), token };
  return { kind: "file", file: markerFile(sessionId) };
}

function lockLocation(sessionId: string, claimedAt: string): StoreLocation {
  const token = blobTokenInUse();
  if (token) return { kind: "blob", path: lockBlobPath(sessionId, claimedAt), token };
  return { kind: "file", file: lockFile(sessionId, claimedAt) };
}

function errorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object" || !("code" in error)) return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
}

function errorLabel(error: unknown): string {
  if (!(error instanceof Error)) return "error";
  const code = errorCode(error);
  if (code && code !== error.name) return `${error.name}:${code}`;
  return error.name;
}

function isBlobConflict(error: unknown): boolean {
  if (error instanceof BlobPreconditionFailedError) return true;
  const name = error instanceof Error ? error.constructor?.name ?? error.name : "";
  if (name === "BlobPreconditionFailedError") return true;
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return message.includes("already exists") || message.includes("precondition");
}

function isBlobMissing(error: unknown): boolean {
  if (error instanceof BlobNotFoundError) return true;
  const name = error instanceof Error ? error.constructor?.name ?? error.name : "";
  return name === "BlobNotFoundError";
}

function logDeleteFailure(error: unknown): void {
  console.error("[ops] Onboarding-Nachweis nicht gelöscht", errorLabel(error));
}

export function buyerOnboardingStillDue(
  paidAt: string | null | undefined,
  now = Date.now(),
): boolean {
  const stamp = typeof paidAt === "string" ? paidAt.trim() : "";
  if (!stamp) return true;
  const parsed = Date.parse(stamp);
  if (!Number.isFinite(parsed)) return true;
  return now - parsed <= BUYER_ONBOARDING_WINDOW_MS;
}

function parseMarker(raw: string): MarkerState {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed) as Partial<OnboardingMarker>;
    if (!parsed || typeof parsed !== "object") return "unreadable";
    const status =
      parsed.status === "claiming" || parsed.status === "sent" || parsed.status === "stub"
        ? parsed.status
        : undefined;
    return {
      email: typeof parsed.email === "string" ? parsed.email : "",
      ...(status ? { status } : {}),
      ...(typeof parsed.claimedAt === "string" ? { claimedAt: parsed.claimedAt } : {}),
      ...(typeof parsed.sentAt === "string" ? { sentAt: parsed.sentAt } : {}),
    };
  } catch {
    return "unreadable";
  }
}

function classifyMarker(loaded: LoadedMarker, now: number): "free" | "sent" | "inflight" | "orphaned" {
  const marker = loaded.state;
  if (marker === null) return "free";
  if (marker === "unreadable") {
    const at = loaded.observedAt;
    if (at == null || !Number.isFinite(at)) return "orphaned";
    if (now - at < ONBOARDING_CLAIM_FRESH_MS) return "inflight";
    return "orphaned";
  }
  if (marker.sentAt || marker.status === "sent" || marker.status === "stub") return "sent";
  if (marker.status !== "claiming") return "sent";
  const at = Date.parse(marker.claimedAt ?? "");
  if (!Number.isFinite(at)) return "orphaned";
  if (now - at < ONBOARDING_CLAIM_FRESH_MS) return "inflight";
  return "orphaned";
}

function claimingBody(email: string, at: string): string {
  return JSON.stringify({ email, status: "claiming", claimedAt: at });
}

function claimedAtOf(loaded: LoadedMarker): string {
  if (!loaded.state || loaded.state === "unreadable") return "";
  return loaded.state.claimedAt ?? "";
}

async function readText(loc: StoreLocation): Promise<string | null> {
  if (loc.kind === "blob") {
    try {
      const result = await get(loc.path, readOptions(loc.token));
      if (!result || result.statusCode !== 200 || !result.stream) return null;
      return await new Response(result.stream).text();
    } catch (error) {
      if (isBlobMissing(error)) return null;
      throw error;
    }
  }
  try {
    return await readFile(loc.file, "utf8");
  } catch (error) {
    if (errorCode(error) === "ENOENT") return null;
    throw error;
  }
}

async function readMarker(sessionId: string): Promise<LoadedMarker> {
  const loc = markerLocation(sessionId);
  if (loc.kind === "blob") {
    try {
      const result = await get(loc.path, readOptions(loc.token));
      if (!result || result.statusCode !== 200 || !result.stream) {
        return { state: null, observedAt: null };
      }
      const raw = await new Response(result.stream).text();
      const uploadedAt = result.blob?.uploadedAt;
      const observedAt = uploadedAt instanceof Date ? uploadedAt.getTime() : null;
      return { state: parseMarker(raw), observedAt };
    } catch (error) {
      if (isBlobMissing(error)) return { state: null, observedAt: null };
      throw error;
    }
  }
  try {
    const raw = await readFile(loc.file, "utf8");
    const state = parseMarker(raw);
    if (state !== "unreadable") return { state, observedAt: null };
    const stamp = await stat(loc.file);
    return { state, observedAt: stamp.mtimeMs };
  } catch (error) {
    if (errorCode(error) === "ENOENT") return { state: null, observedAt: null };
    throw error;
  }
}

async function putBody(
  loc: StoreLocation,
  body: string,
  exclusive: boolean,
): Promise<"created" | "exists"> {
  if (loc.kind === "blob") {
    try {
      await put(loc.path, body, writeOptions(loc.token, !exclusive));
      return "created";
    } catch (error) {
      if (exclusive && isBlobConflict(error)) return "exists";
      throw error;
    }
  }
  await mkdir(path.dirname(loc.file), { recursive: true });
  if (!exclusive) {
    await writeFile(loc.file, body, "utf8");
    return "created";
  }
  try {
    await writeFile(loc.file, body, { flag: "wx" });
    return "created";
  } catch (error) {
    if (errorCode(error) === "EEXIST") return "exists";
    throw error;
  }
}

async function removeBody(loc: StoreLocation): Promise<void> {
  if (loc.kind === "blob") {
    try {
      await del(loc.path, { token: loc.token });
    } catch (error) {
      if (isBlobMissing(error)) return;
      logDeleteFailure(error);
    }
    return;
  }
  try {
    await unlink(loc.file);
  } catch (error) {
    if (errorCode(error) === "ENOENT") return;
    logDeleteFailure(error);
  }
}

async function readLock(loc: StoreLocation): Promise<{ at: string } | null> {
  const raw = await readText(loc);
  if (raw === null || !raw.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as { at?: unknown };
    return { at: typeof parsed.at === "string" ? parsed.at : "" };
  } catch {
    return { at: "" };
  }
}

function lockIsStale(lock: { at: string } | null, now: number): boolean {
  if (!lock) return true;
  const at = Date.parse(lock.at);
  if (!Number.isFinite(at)) return true;
  return now - at >= ONBOARDING_CLAIM_FRESH_MS;
}

/** Test helper. Not a public route. */
export async function forgetBuyerOnboarding(sessionId: string): Promise<void> {
  const id = sessionId.trim();
  if (!id) return;
  await removeBody(markerLocation(id));
}

/** Test helper. Not a public route. Plants a marker without sending. */
export async function plantBuyerOnboardingMarker(
  sessionId: string,
  marker: { email: string; status: "claiming" | "sent"; at: string },
): Promise<void> {
  const id = sessionId.trim();
  if (!id) return;
  const body =
    marker.status === "sent"
      ? JSON.stringify({ email: marker.email, status: "sent", sentAt: marker.at })
      : claimingBody(marker.email, marker.at);
  await putBody(markerLocation(id), body, false);
}

async function writeMarker(sessionId: string, email: string): Promise<void> {
  const body = JSON.stringify({
    email,
    status: "sent",
    sentAt: new Date(nowFn()).toISOString(),
  });
  await putBody(markerLocation(sessionId), body, false);
}

/** One welcome per checkout. The loser of a fresh claim does not send. */
async function claimOnboardingSend(
  sessionId: string,
  email: string,
): Promise<"claimed" | "sent" | "inflight"> {
  for (let attempt = 0; attempt < CLAIM_ATTEMPTS; attempt += 1) {
    const marker = await readMarker(sessionId);
    const kind = classifyMarker(marker, nowFn());
    if (kind === "sent") return "sent";
    if (kind === "inflight") return "inflight";
    if (kind === "free") {
      const at = new Date(nowFn()).toISOString();
      const created = await putBody(markerLocation(sessionId), claimingBody(email, at), true);
      if (created === "created") return "claimed";
      continue;
    }

    const claimedAt = claimedAtOf(marker);
    const lockLoc = lockLocation(sessionId, claimedAt);
    const locked = await putBody(
      lockLoc,
      JSON.stringify({ at: new Date(nowFn()).toISOString(), claimedAt }),
      true,
    );
    if (locked === "exists") {
      if (lockIsStale(await readLock(lockLoc), nowFn())) {
        await removeBody(lockLoc);
        continue;
      }
      const again = classifyMarker(await readMarker(sessionId), nowFn());
      if (again === "sent") return "sent";
      if (again === "free") continue;
      return "inflight";
    }

    const current = await readMarker(sessionId);
    const currentKind = classifyMarker(current, nowFn());
    if (currentKind !== "orphaned" || claimedAtOf(current) !== claimedAt) {
      await removeBody(lockLoc);
      if (currentKind === "sent") return "sent";
      if (currentKind === "inflight") return "inflight";
      continue;
    }

    const at = new Date(nowFn()).toISOString();
    try {
      await putBody(markerLocation(sessionId), claimingBody(email, at), false);
    } catch (error) {
      await removeBody(lockLoc);
      throw error;
    }
    await removeBody(lockLoc);
    return "claimed";
  }
  return "inflight";
}

/**
 * Sends the order mail to `email` (the checkout customer).
 * Does not read cookies or the signed-in account.
 */
export async function deliverBuyerOnboarding(
  input: BuyerOnboardingInput,
): Promise<BuyerOnboardingStatus> {
  const sessionId = input.sessionId.trim();
  const email = input.email.trim().toLowerCase();
  if (isTestEntity(input.entityId)) {
    console.info("[ops] Onboarding übersprungen — Testfirma");
    return "skipped";
  }
  if (!sessionId) return "failed";
  if (!email || !email.includes("@")) return "skipped";
  if (isCompAccessEmail(email)) return "skipped";
  if (input.enforceWindow && !buyerOnboardingStillDue(input.paidAt)) return "skipped";
  const claim = await claimOnboardingSend(sessionId, email);
  if (claim === "sent") return "skipped";
  if (claim === "inflight") return "inflight";

  let result;
  try {
    result = await triggerOnboardingMail({
      email,
      company: input.company,
      sessionId,
      audience: input.audience,
      checkoutNames: input.checkoutNames,
      extraCompanyNames: input.extraCompanyNames,
      entityId: input.entityId,
      idempotencyKey: `checkout-onboarding/${sessionHash(sessionId)}`,
    });
  } catch (error) {
    await forgetBuyerOnboarding(sessionId);
    throw error;
  }

  const delivered = result.sent || (result.stub && !isProductionRuntime());
  if (!delivered) {
    if (result.duplicate) {
      if (result.inflight) return "inflight";
      try {
        await writeMarker(sessionId, email);
      } catch (error) {
        console.error(
          "[ops] Onboarding-Nachweis nicht gespeichert",
          error instanceof Error ? error.name : "error",
        );
      }
      return "skipped";
    }
    await forgetBuyerOnboarding(sessionId);
    return "failed";
  }
  try {
    await writeMarker(sessionId, email);
  } catch (error) {
    console.error(
      "[ops] Onboarding-Nachweis nicht gespeichert",
      error instanceof Error ? error.name : "error",
    );
  }
  return result.sent ? "sent" : "stub";
}

/**
 * Browser return, including a foreign session. Looks up the paid row only
 * for the age window. The recipient stays the checkout email.
 */
export async function notifyBuyerOfCheckout(input: {
  email: string;
  company?: string;
  sessionId: string;
  audience?: OnboardingAudience;
  checkoutNames?: string[];
  extraCompanyNames?: string[];
  entityId?: string | null;
}): Promise<BuyerOnboardingStatus> {
  let paidAt: string | null = null;
  let rowEntityId = "";
  try {
    const row = await findRowByStripeSessionId(input.sessionId);
    paidAt = row?.timestamp ?? null;
    rowEntityId = row?.entityId ?? "";
  } catch (error) {
    console.error(
      "[ops] Bezahlte Zeile für die Bestellmail nicht lesbar",
      error instanceof Error ? error.name : "error",
    );
  }
  return deliverBuyerOnboarding({
    ...input,
    entityId: input.entityId || rowEntityId,
    paidAt,
    enforceWindow: true,
  });
}
