import {
  devCheckoutStubAllowed,
  isStubCheckoutSessionId,
} from "@/lib/checkout-stub";
import { isStripeConfigured } from "@/lib/env";
import { resolveCheckoutSession } from "@/lib/stripe";
import { emailsEqual } from "@/lib/types";

export type DraftAccess =
  | { ok: true; ownerEmail: string }
  | { ok: false; status: 401 | 403 };

export type UploadAccess =
  | { ok: true; ownerKey: string }
  | { ok: false; status: 401 | 403 };

/** Erfolg der Draft-Route ist 200, sonst der Status aus authorizeDraftAccess. */
export function draftAccessHttpStatus(access: DraftAccess): 200 | 401 | 403 {
  return access.ok ? 200 : access.status;
}

export function accessDeniedStatus(
  sessionEmail: string | null | undefined,
): 401 | 403 {
  return sessionEmail?.trim() ? 403 : 401;
}

export type CheckoutLookup =
  | { email: string; stub: boolean }
  | { error: "missing" | "not_paid" | "lookup_failed" };

export type CheckoutResolver = (
  sessionId: string | undefined,
) => Promise<CheckoutLookup>;

function normEmail(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

/** Owner aus `email:<adresse>:<entity>:<modus>`. */
export function emailFromDraftKey(draftKey: string | null | undefined): string {
  const key = draftKey?.trim() ?? "";
  if (!key.startsWith("email:")) return "";
  const body = key.slice("email:".length);
  const parts = body.split(":");
  if (parts.length >= 3) return normEmail(parts.slice(0, -2).join(":"));
  return normEmail(parts[0]);
}

function sessionIdFromDraftKey(draftKey: string | null | undefined): string {
  const key = draftKey?.trim() ?? "";
  if (!key.startsWith("session:")) return "";
  const body = key.slice("session:".length);
  const split = body.lastIndexOf(":");
  if (split <= 0) return body;
  return body.slice(0, split);
}

export function draftOwnerEmail(input: {
  draft?: { email?: string; draftKey?: string } | null;
  draftKey?: string;
}): string {
  const fromDraft = normEmail(input.draft?.email);
  if (fromDraft) return fromDraft;
  return emailFromDraftKey(input.draft?.draftKey || input.draftKey);
}

/** Stub-Checkout nur lokal und nur solange Stripe nicht konfiguriert ist. */
export function stubCheckoutMayAuthorize(): boolean {
  return devCheckoutStubAllowed() && !isStripeConfigured();
}

function sameEmail(a: string, b: string): boolean {
  return Boolean(a) && Boolean(b) && emailsEqual(a, b);
}

/**
 * Draft lesen/schreiben.
 * Erlaubt: eingeloggte Session-Mail = Owner (Draft-Mail oder `email:`-Key),
 * oder eine bei Stripe bezahlte Checkout-Session dieser Mail.
 * `mock_`- und andere Stub-IDs gelten in Produktion nie als Nachweis.
 * Ein fehlgeschlagener Lookup gilt nie als Nachweis.
 */
export async function authorizeDraftAccess(
  input: {
    sessionEmail?: string | null;
    sessionId?: string;
    /** Vom Client gewünschte Mail. Allein kein Besitznachweis. */
    email?: string;
    draftKey?: string;
    draft?: { email?: string; draftKey?: string; stripeSessionId?: string } | null;
  },
  resolve: CheckoutResolver = resolveCheckoutSession,
): Promise<DraftAccess> {
  const sessionEmail = normEmail(input.sessionEmail);
  const sessionId = input.sessionId?.trim() ?? "";
  const claimed = normEmail(input.email);
  const draftKey = input.draft?.draftKey || input.draftKey;
  const owner = draftOwnerEmail({ draft: input.draft, draftKey });
  const existing = Boolean(input.draft);
  const keyOwner = emailFromDraftKey(draftKey);
  const keySession = sessionIdFromDraftKey(draftKey);
  const boundSession = (input.draft?.stripeSessionId ?? "").trim() || keySession;

  if (sessionEmail && owner && sameEmail(sessionEmail, owner)) {
    if (claimed && !sameEmail(claimed, sessionEmail)) {
      return { ok: false, status: 403 };
    }
    if (keyOwner && !sameEmail(keyOwner, sessionEmail)) {
      return { ok: false, status: 403 };
    }
    return { ok: true, ownerEmail: owner };
  }

  // Neuer Entwurf ohne gespeicherten Owner: Login gilt nur für den eigenen
  // email:-Schlüssel oder einen doc:/area:-Schlüssel. session:-Schlüssel
  // brauchen die Checkout-Session, sonst lässt sich ein fremder Key belegen.
  if (!existing && sessionEmail && (!claimed || sameEmail(claimed, sessionEmail))) {
    if (!keyOwner && !keySession) {
      return { ok: true, ownerEmail: sessionEmail };
    }
    if (keyOwner && sameEmail(keyOwner, sessionEmail)) {
      return { ok: true, ownerEmail: sessionEmail };
    }
  }

  if (sessionId) {
    const viaCheckout = await checkoutAllowsDraft({
      sessionId,
      ownerEmail: owner,
      claimedEmail: claimed,
      existing,
      boundSession,
      keySession,
      resolve,
    });
    if (viaCheckout) return viaCheckout;
  }

  if (sessionEmail) return { ok: false, status: 403 };
  return { ok: false, status: 401 };
}

async function checkoutAllowsDraft(input: {
  sessionId: string;
  ownerEmail: string;
  claimedEmail: string;
  existing: boolean;
  boundSession: string;
  keySession: string;
  resolve: CheckoutResolver;
}): Promise<DraftAccess | null> {
  const { sessionId, ownerEmail, claimedEmail, existing, boundSession, keySession, resolve } =
    input;

  // Ein session:-Schlüssel nennt genau eine Checkout-Session.
  if (keySession && keySession !== sessionId) return null;

  if (isStubCheckoutSessionId(sessionId)) {
    if (!stubCheckoutMayAuthorize()) return null;
    return { ok: true, ownerEmail: ownerEmail || claimedEmail };
  }

  const resolved = await resolve(sessionId);
  if ("error" in resolved) return null;
  if (resolved.stub) {
    if (!stubCheckoutMayAuthorize()) return null;
    return { ok: true, ownerEmail: normEmail(resolved.email) || claimedEmail || ownerEmail };
  }

  const paidEmail = normEmail(resolved.email);
  if (claimedEmail && paidEmail && !sameEmail(claimedEmail, paidEmail)) return null;
  if (ownerEmail && paidEmail && !sameEmail(ownerEmail, paidEmail)) return null;
  if (existing && ownerEmail && !paidEmail) return null;
  if (existing && !ownerEmail && boundSession !== sessionId) return null;
  return { ok: true, ownerEmail: paidEmail || ownerEmail || claimedEmail };
}

/**
 * Upload ohne documentId. Eine Session-ID erlaubt den Upload nur, wenn Stripe
 * sie als bezahlt auflöst (lokal zusätzlich der Stub). Lookup-Fehler und
 * `mock_`-IDs in Produktion fallen auf die eingeloggte Mail zurück und
 * autorisieren allein nicht.
 */
export async function authorizeUploadSession(
  input: { sessionEmail?: string | null; sessionId?: string },
  resolve: CheckoutResolver = resolveCheckoutSession,
): Promise<UploadAccess> {
  const sessionEmail = normEmail(input.sessionEmail);
  const sessionId = input.sessionId?.trim() ?? "";
  const stubBlocked =
    isStubCheckoutSessionId(sessionId) && !stubCheckoutMayAuthorize();

  if (sessionId && !stubBlocked) {
    if (isStubCheckoutSessionId(sessionId) && stubCheckoutMayAuthorize()) {
      return { ok: true, ownerKey: sessionEmail || sessionId };
    }
    const resolved = await resolve(sessionId);
    if (!("error" in resolved) && !resolved.stub) {
      const paidEmail = normEmail(resolved.email);
      if (sessionEmail && paidEmail && !sameEmail(sessionEmail, paidEmail)) {
        return { ok: false, status: 403 };
      }
      return { ok: true, ownerKey: paidEmail || sessionEmail || sessionId };
    }
    if (!("error" in resolved) && resolved.stub && stubCheckoutMayAuthorize()) {
      return {
        ok: true,
        ownerKey: sessionEmail || normEmail(resolved.email) || sessionId,
      };
    }
  }

  if (sessionEmail) return { ok: true, ownerKey: sessionEmail };
  return { ok: false, status: 401 };
}

/** Produktions-Requests dürfen eine echte Session-ID nicht durch `mock_` ersetzen. */
export function nextStripeSessionId(
  incoming: string | undefined,
  existing: string | undefined,
): string {
  const next = incoming?.trim() ?? "";
  const prev = existing?.trim() ?? "";
  if (!next) return prev;
  if (isStubCheckoutSessionId(next) && !devCheckoutStubAllowed()) return prev;
  return next;
}
