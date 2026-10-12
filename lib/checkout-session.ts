import { NextResponse } from "next/server";
import {
  applyCheckoutGrantCookie,
  applySessionCookie,
  type CheckoutGrant,
} from "@/lib/auth";
import { queryIdsEqual } from "@/lib/query";

/**
 * Shown when Angaben can no longer be changed without a login
 * (checkout proof missing or expired).
 */
export const LOGIN_FOR_ANSWERS_COPY =
  "Zum Schutz Ihrer Angaben bitten wir Sie, sich kurz anzumelden.";

function normalizeEmail(value: string | null | undefined): string {
  const email = (value ?? "").trim().toLowerCase();
  if (!email || !email.includes("@") || /\s/.test(email)) return "";
  return email;
}

/** Checkout address for display. The local part stays hidden except its first character. */
export function maskCheckoutEmail(email: string): string {
  const normalized = normalizeEmail(email);
  const at = normalized.indexOf("@");
  if (at <= 0) return "";
  return `${normalized.slice(0, 1)}•••@${normalized.slice(at + 1)}`;
}

/**
 * Session on checkout return. The Stripe session is already verified and paid.
 * A stub is not that proof. If a document already exists, its owner email must
 * match the paying customer. No document yet: the paying customer is the owner.
 */
export function ownerEmailForCheckoutReturn(input: {
  paid: boolean;
  stub: boolean;
  customerEmail: string;
  /** null: no document yet. A string means a document exists. */
  documentOwnerEmail: string | null;
}): string | null {
  if (!input.paid || input.stub) return null;
  const customer = normalizeEmail(input.customerEmail);
  if (!customer) return null;
  if (input.documentOwnerEmail !== null) {
    const owner = normalizeEmail(input.documentOwnerEmail);
    if (!owner || owner !== customer) return null;
  }
  return customer;
}

/**
 * Session on the first delivery. Proof is the signed `gobd_checkout` cookie
 * (same session, same email as the document owner). A stub checkout does not
 * count. A mismatch or a missing cookie yields no session.
 */
export function ownerEmailForFirstCompletion(input: {
  grant: CheckoutGrant | null;
  ownerEmail: string;
  stripeSessionId: string;
  stub: boolean;
}): string | null {
  if (input.stub) return null;
  const grant = input.grant;
  if (!grant) return null;
  const sessionId = input.stripeSessionId.trim();
  if (!sessionId || grant.sessionId.trim() !== sessionId) return null;
  const owner = normalizeEmail(input.ownerEmail);
  const grantEmail = normalizeEmail(grant.email);
  if (!owner || !grantEmail || owner !== grantEmail) return null;
  return owner;
}

/**
 * Lookup throws when the document owner cannot be read. That is not proof,
 * so no session is issued. `null` means no document exists yet.
 */
export async function ownerEmailAfterVerifiedCheckout(
  input: { stub: boolean; customerEmail: string; stripeSessionId: string },
  lookupDocumentOwner: (sessionId: string) => Promise<string | null>,
): Promise<string | null> {
  let documentOwnerEmail: string | null;
  try {
    documentOwnerEmail = await lookupDocumentOwner(input.stripeSessionId);
  } catch {
    return null;
  }
  return ownerEmailForCheckoutReturn({
    paid: true,
    stub: input.stub,
    customerEmail: input.customerEmail,
    documentOwnerEmail,
  });
}

/** Checkout cookie plus, when the payer is the owner, the same login cookie as /auth/verify. */
export async function attachVerifiedCheckoutCookies(
  response: NextResponse,
  input: { stub: boolean; customerEmail: string; stripeSessionId: string },
  lookupDocumentOwner: (sessionId: string) => Promise<string | null>,
): Promise<void> {
  const sessionId = input.stripeSessionId.trim();
  const email = input.customerEmail.trim();
  if (!sessionId || !email) return;
  applyCheckoutGrantCookie(response, { sessionId, email });
  const owner = await ownerEmailAfterVerifiedCheckout(input, lookupDocumentOwner);
  if (owner) applyCheckoutOwnerSession(response, owner);
}

/** Same signer and cookie attributes as the magic-link verify route. */
export function applyCheckoutOwnerSession(response: NextResponse, email: string): void {
  const address = normalizeEmail(email);
  if (!address) return;
  applySessionCookie(response, address);
}

export function intakeTargetFromNext(
  next: string | null | undefined,
): { documentId: string; sessionId: string } | null {
  if (!next?.startsWith("/intake")) return null;
  try {
    const parsed = new URL(next, "http://safe.invalid");
    if (parsed.origin !== "http://safe.invalid" || parsed.pathname !== "/intake") return null;
    return {
      documentId: parsed.searchParams.get("document_id")?.trim() ?? "",
      sessionId: parsed.searchParams.get("session_id")?.trim() ?? "",
    };
  } catch {
    return null;
  }
}

/** Email only when the document is the one named by the login return path. */
export function emailForAnswersLogin(
  row: { documentId?: string; stripeSessionId?: string; email?: string } | null | undefined,
  target: { documentId: string; sessionId: string },
): string {
  if (!row) return "";
  if (!target.documentId && !target.sessionId) return "";
  if (target.documentId && (row.documentId ?? "").trim() !== target.documentId) return "";
  if (target.sessionId && !queryIdsEqual(row.stripeSessionId ?? "", target.sessionId)) return "";
  return normalizeEmail(row.email);
}

export function answersLoginOffer(input: {
  next: string | null | undefined;
  checkoutEmail?: string | null;
}): { explain: boolean; email: string; masked: string } {
  const explain = intakeTargetFromNext(input.next) !== null;
  const email = explain ? normalizeEmail(input.checkoutEmail) : "";
  return {
    explain,
    email,
    masked: email ? maskCheckoutEmail(email) : "",
  };
}
