/**
 * Order confirmation and magic link for the buyer named by Stripe.
 * The browser session is never the recipient. A foreign login, a missing
 * cookie, and the mismatch page must not suppress the mail.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { del, get, put, type GetCommandOptions, type PutCommandOptions } from "@vercel/blob";
import { isCompAccessEmail } from "@/lib/comp-access";
import { isBlobConfigured, isProductionRuntime } from "@/lib/env";
import { triggerOnboardingMail, type OnboardingAudience } from "@/lib/ops";
import { isTestEntity } from "@/lib/test-entities";
import { findRowByStripeSessionId, getFileFallbackDir } from "@/lib/store";

/** A return visit long after payment must not send a second welcome mail. */
export const BUYER_ONBOARDING_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export type BuyerOnboardingStatus = "sent" | "stub" | "skipped" | "failed";

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

function sessionHash(sessionId: string): string {
  return createHash("sha256").update(sessionId.trim()).digest("hex").slice(0, 40);
}

function markerFile(sessionId: string): string {
  return path.join(getFileFallbackDir(), "onboarding-mail", `${sessionHash(sessionId)}.json`);
}

function markerBlobPath(sessionId: string): string {
  return `gobd/onboarding-mail/${sessionHash(sessionId)}.json`;
}

function blobToken(): string | undefined {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  return token || undefined;
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

async function readMarker(sessionId: string): Promise<boolean> {
  const token = blobToken();
  if (isBlobConfigured() && token) {
    try {
      const result = await get(markerBlobPath(sessionId), readOptions(token));
      if (!result || result.statusCode !== 200 || !result.stream) return false;
      const raw = await new Response(result.stream).text();
      return Boolean(raw.trim());
    } catch (error) {
      const name =
        typeof error === "object" && error !== null
          ? (error as { constructor?: { name?: string } }).constructor?.name
          : "";
      if (name === "BlobNotFoundError") return false;
      throw error;
    }
  }
  try {
    const raw = await readFile(markerFile(sessionId), "utf8");
    return Boolean(raw.trim());
  } catch (error) {
    const code = (error as { code?: unknown }).code;
    if (code === "ENOENT") return false;
    throw error;
  }
}

async function writeMarker(sessionId: string, email: string): Promise<void> {
  const body = JSON.stringify({ email, sentAt: new Date().toISOString() });
  const token = blobToken();
  if (isBlobConfigured() && token) {
    await put(markerBlobPath(sessionId), body, writeOptions(token));
    return;
  }
  const file = markerFile(sessionId);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, body, "utf8");
}

/** Test helper. Not a public route. */
export async function forgetBuyerOnboarding(sessionId: string): Promise<void> {
  const id = sessionId.trim();
  if (!id) return;
  const token = blobToken();
  if (isBlobConfigured() && token) {
    try {
      await del(markerBlobPath(id), { token });
    } catch {
      // already gone
    }
    return;
  }
  try {
    await unlink(markerFile(id));
  } catch {
    // already gone
  }
}

async function alreadySent(sessionId: string): Promise<boolean> {
  try {
    return await readMarker(sessionId);
  } catch (error) {
    console.error(
      "[ops] Onboarding-Nachweis nicht lesbar",
      error instanceof Error ? error.name : "error",
    );
    return false;
  }
}

/** One welcome per checkout. The loser of the claim does not send. */
async function claimOnboardingSend(sessionId: string, email: string): Promise<"claimed" | "done"> {
  const body = JSON.stringify({
    email,
    status: "claiming",
    claimedAt: new Date().toISOString(),
  });
  const token = blobToken();
  if (isBlobConfigured() && token) {
    try {
      await put(markerBlobPath(sessionId), body, writeOptions(token, false));
      return "claimed";
    } catch (error) {
      if (await alreadySent(sessionId)) return "done";
      console.error(
        "[ops] Onboarding-Anspruch nicht gespeichert",
        error instanceof Error ? error.name : "error",
      );
      throw error;
    }
  }
  const file = markerFile(sessionId);
  await mkdir(path.dirname(file), { recursive: true });
  try {
    await writeFile(file, body, { flag: "wx" });
    return "claimed";
  } catch (error) {
    const code = (error as { code?: unknown }).code;
    if (code === "EEXIST") return "done";
    throw error;
  }
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
  if (claim === "done") return "skipped";

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
