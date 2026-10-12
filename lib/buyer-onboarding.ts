/**
 * Order confirmation and magic link for the buyer named by Stripe.
 * The browser session is never the recipient. A foreign login, a missing
 * cookie, and the mismatch page must not suppress the mail.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { del, get, put, type GetCommandOptions, type PutCommandOptions } from "@vercel/blob";
import { isBlobConfigured, isProductionRuntime } from "@/lib/env";
import { triggerOnboardingMail, type OnboardingAudience } from "@/lib/ops";
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

function writeOptions(token: string): PutCommandOptions {
  return {
    access: "private",
    contentType: "application/json; charset=utf-8",
    addRandomSuffix: false,
    allowOverwrite: true,
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

/**
 * Sends the order mail to `email` (the checkout customer).
 * Does not read cookies or the signed-in account.
 */
export async function deliverBuyerOnboarding(
  input: BuyerOnboardingInput,
): Promise<BuyerOnboardingStatus> {
  const sessionId = input.sessionId.trim();
  const email = input.email.trim().toLowerCase();
  if (!sessionId) return "failed";
  if (!email || !email.includes("@")) return "skipped";
  if (input.enforceWindow && !buyerOnboardingStillDue(input.paidAt)) return "skipped";
  if (await alreadySent(sessionId)) return "skipped";

  const result = await triggerOnboardingMail({
    email,
    company: input.company,
    sessionId,
    audience: input.audience,
    checkoutNames: input.checkoutNames,
    extraCompanyNames: input.extraCompanyNames,
    idempotencyKey: `checkout-onboarding/${sessionHash(sessionId)}`,
  });

  const delivered = result.sent || (result.stub && !isProductionRuntime());
  if (!delivered) return "failed";
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
}): Promise<BuyerOnboardingStatus> {
  let paidAt: string | null = null;
  try {
    const row = await findRowByStripeSessionId(input.sessionId);
    paidAt = row?.timestamp ?? null;
  } catch (error) {
    console.error(
      "[ops] Bezahlte Zeile für die Bestellmail nicht lesbar",
      error instanceof Error ? error.name : "error",
    );
  }
  return deliverBuyerOnboarding({
    ...input,
    paidAt,
    enforceWindow: true,
  });
}
