import { NextResponse } from "next/server";
import {
  applyCheckoutGrantCookie,
  applySessionCookie,
  safeNextPath,
  type CheckoutGrant,
} from "@/lib/auth";
import {
  checkoutSessionGrant,
  recordCheckoutSessionGrant,
} from "@/lib/checkout-session-grant";
import { isStubCheckoutSessionId } from "@/lib/checkout-stub";
import { loadSessionDraftAnyOwner } from "@/lib/open-drafts";
import { queryIdsEqual } from "@/lib/query";
import { findLatestDocumentByStripeSessionId } from "@/lib/store";
import type { CheckoutIdentity } from "@/lib/types";

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

/**
 * Checkout address for display. The local part is never complete:
 * one character up to length 2, the first two from length 3, and from
 * length 4 also the last character. Same domain and same first letter
 * stay distinguishable without revealing the mailbox.
 */
export function maskCheckoutEmail(email: string): string {
  const normalized = normalizeEmail(email);
  const at = normalized.indexOf("@");
  if (at <= 0) return "";
  const local = normalized.slice(0, at);
  const domain = normalized.slice(at + 1);
  let visible = `${local.slice(0, 1)}•••`;
  if (local.length >= 3) visible = `${local.slice(0, 2)}•••`;
  if (local.length >= 4) visible = `${local.slice(0, 2)}•••${local.slice(-1)}`;
  if (visible.replace(/•/g, "") === local) visible = `${local.slice(0, 1)}•••`;
  return `${visible}@${domain}`;
}

/** Full address only for the logged-in owner. Everyone else sees the mask. */
export function emailShownToViewer(
  ownerEmail: string | null | undefined,
  sessionEmail: string | null | undefined,
): string {
  const owner = normalizeEmail(ownerEmail);
  const session = normalizeEmail(sessionEmail);
  if (!owner) return "";
  if (session && session === owner) return ownerEmail?.trim() ?? owner;
  return maskCheckoutEmail(owner);
}

export type PublicCheckoutSession = {
  paid: true;
  stripeSessionId: string;
  emailMasked: string;
};

/**
 * GET /api/session without the owner cookie. Paid flag, session id, masked
 * mail — nothing else. No firm, no address, no `cus_` id.
 */
export function checkoutSessionForViewer(
  identity: CheckoutIdentity,
  sessionEmail: string | null | undefined,
): CheckoutIdentity | PublicCheckoutSession {
  const session = normalizeEmail(sessionEmail);
  const owner = normalizeEmail(identity.email);
  if (session && owner && session === owner) return identity;
  return {
    paid: true,
    stripeSessionId: identity.stripeSessionId,
    emailMasked: maskCheckoutEmail(identity.email),
  };
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

export type CheckoutAttachDecision = "session" | "same" | "mismatch" | "login" | "skip";

/**
 * Ob die Rückkehr aus dem Checkout ein Login setzen darf.
 * Eine bestehende Anmeldung wird nie ersetzt. Nach dem ersten Login
 * für diese Session reicht die Session-ID allein nicht mehr.
 */
export function decideCheckoutAttach(input: {
  existingSessionEmail?: string | null;
  customerEmail?: string | null;
  sessionOwnerEmail?: string | null;
  alreadyGranted: boolean;
  /** A delivered document already exists for this checkout. */
  submitted?: boolean;
  stub?: boolean;
}): CheckoutAttachDecision {
  const existing = normalizeEmail(input.existingSessionEmail);
  const customer = normalizeEmail(input.customerEmail);
  const sessionOwner = normalizeEmail(input.sessionOwnerEmail);
  if (existing && customer && existing !== customer && !input.stub) return "mismatch";
  if (!sessionOwner) {
    if (!existing && input.submitted && !input.stub) return "login";
    return "skip";
  }
  if (existing && existing === sessionOwner) return "same";
  if (existing && existing !== sessionOwner) return "mismatch";
  if (input.alreadyGranted || input.submitted) return "login";
  return "session";
}

/**
 * Seite, wenn die Anmeldung und der Kauf verschiedenen Adressen gehören.
 * Setzt kein Cookie und öffnet den fremden Entwurf nicht.
 */
export function intakeCheckoutGate(input: {
  sessionEmail?: string | null;
  customerEmail?: string | null;
  grantRecorded: boolean;
  /** Grant record, delivered document, or a saved Entwurf. */
  alreadyUsed?: boolean;
}): "mismatch" | "login" | "proceed" {
  const session = normalizeEmail(input.sessionEmail);
  const customer = normalizeEmail(input.customerEmail);
  if (session && customer && session !== customer) return "mismatch";
  if (!session && (input.grantRecorded || input.alreadyUsed)) return "login";
  return "proceed";
}

/**
 * What /intake does with a session_id before the form.
 * `grant=set` does not reopen a checkout that was already used.
 */
export function intakeEntryDecision(input: {
  sessionEmail?: string | null;
  ownerEmail?: string | null;
  alreadyUsed: boolean;
  checkoutCookieMatches: boolean;
  grantFlag?: string | null;
  hasSessionQuery: boolean;
}): "login" | "mismatch" | "grant" | "proceed" {
  const gate = intakeCheckoutGate({
    sessionEmail: input.sessionEmail,
    customerEmail: input.ownerEmail,
    grantRecorded: input.alreadyUsed,
  });
  if (gate !== "proceed") return gate;
  if (input.alreadyUsed) return "proceed";
  const flag = (input.grantFlag ?? "").trim();
  if (flag === "skip" || flag === "set") return "proceed";
  if (input.checkoutCookieMatches) return "proceed";
  if (input.hasSessionQuery) return "grant";
  return "proceed";
}

/**
 * The checkout was already handed to a browser: a grant was stored, a document
 * was delivered, or a server draft holds answers. A later bare session_id
 * must not mint another login.
 */
export async function checkoutAlreadyGranted(sessionId: string): Promise<{
  granted: boolean;
  ownerEmail: string;
}> {
  const id = sessionId.trim();
  if (!id || isStubCheckoutSessionId(id)) return { granted: false, ownerEmail: "" };
  try {
    const recorded = await checkoutSessionGrant(id);
    if (recorded) return { granted: true, ownerEmail: normalizeEmail(recorded.email) };
  } catch (error) {
    console.error(
      "[checkout] Sitzungsnachweis nicht lesbar",
      error instanceof Error ? error.name : "error",
    );
  }
  try {
    const row = await findLatestDocumentByStripeSessionId(id);
    if (row?.documentId?.trim()) {
      return { granted: true, ownerEmail: normalizeEmail(row.email) };
    }
  } catch (error) {
    console.error(
      "[checkout] Dokument zur Session nicht lesbar",
      error instanceof Error ? error.name : "error",
    );
  }
  try {
    const draft = await loadSessionDraftAnyOwner(id);
    if (draft) return { granted: true, ownerEmail: normalizeEmail(draft.email) };
  } catch (error) {
    console.error(
      "[checkout] Entwurf zur Session nicht lesbar",
      error instanceof Error ? error.name : "error",
    );
  }
  return { granted: false, ownerEmail: "" };
}

export function checkoutOwnerMismatchCopy(signedInEmail: string, ownerEmail: string): string {
  return `Sie sind als ${maskCheckoutEmail(signedInEmail)} angemeldet. Dieser Kauf gehört zu ${maskCheckoutEmail(ownerEmail)}.`;
}

export function checkoutHandoffButtonCopy(ownerEmail: string): string {
  return `Abmelden und Anmeldelink an ${maskCheckoutEmail(ownerEmail)} senden`;
}

export const CHECKOUT_BACK_TO_ACCOUNT = "Zurück zum Konto";

/** Link nur an die Kauf-Adresse, und nur wenn sie nicht die aktuelle Anmeldung ist. */
export function checkoutHandoffPlan(input: {
  currentEmail?: string | null;
  ownerEmail?: string | null;
}): "send" | "ignore" {
  const current = normalizeEmail(input.currentEmail);
  const owner = normalizeEmail(input.ownerEmail);
  if (!current || !owner || current === owner) return "ignore";
  return "send";
}

/** Dokument-Mail, sonst die Kundenmail des Checkouts. Leer bleibt leer. */
export function loginCheckoutEmail(input: {
  documentEmail?: string | null;
  checkoutCustomerEmail?: string | null;
}): string {
  return normalizeEmail(input.documentEmail) || normalizeEmail(input.checkoutCustomerEmail);
}

/**
 * Kundenmail einer Checkout-Session. Fehler und eine leere Stub-Mail liefern "".
 * Eine gesetzte Stub-Mail bleibt für die lokale Erklärung nutzbar.
 */
export async function checkoutCustomerEmail(
  sessionId: string,
  resolve: (
    sessionId: string,
  ) => Promise<{ email?: string; error?: string } | { error: string }>,
): Promise<string> {
  const id = sessionId.trim();
  if (!id) return "";
  try {
    const resolved = await resolve(id);
    if (!resolved) return "";
    const failure = "error" in resolved ? resolved.error : "";
    const email = "email" in resolved ? resolved.email : "";
    if (failure) return "";
    return normalizeEmail(email);
  } catch {
    return "";
  }
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

/** Merkt sich die erste Ausstellung. Ein Schreibfehler hält die Rückkehr nicht auf. */
export async function rememberCheckoutSessionGrant(sessionId: string, email: string): Promise<void> {
  const id = sessionId.trim();
  const owner = normalizeEmail(email);
  if (!id || !owner) return;
  try {
    const existing = await checkoutSessionGrant(id);
    if (existing) return;
    await recordCheckoutSessionGrant({ sessionId: id, email: owner });
  } catch (error) {
    console.error(
      "[checkout] Sitzungsnachweis konnte nicht gespeichert werden",
      error instanceof Error ? error.name : "error",
    );
  }
}

/**
 * Rückkehr aus Stripe. Eine bestehende Anmeldung bleibt unverändert.
 * Das Login wird nur gesetzt, wenn noch keins da ist und diese Session
 * noch keins bekommen hat. Danach führt dieselbe Session-ID zum Login.
 */
export async function finishCheckoutReturn(
  response: NextResponse,
  input: {
    stub: boolean;
    customerEmail: string;
    stripeSessionId: string;
    existingSessionEmail?: string | null;
  },
  lookupDocumentOwner: (sessionId: string) => Promise<string | null>,
): Promise<CheckoutAttachDecision> {
  const sessionId = input.stripeSessionId.trim();
  const email = input.customerEmail.trim();
  if (!sessionId || !email) return "skip";

  let documentOwnerEmail: string | null = null;
  let lookupFailed = false;
  try {
    documentOwnerEmail = await lookupDocumentOwner(sessionId);
  } catch {
    lookupFailed = true;
  }
  const owner = lookupFailed
    ? null
    : ownerEmailForCheckoutReturn({
        paid: true,
        stub: input.stub,
        customerEmail: email,
        documentOwnerEmail,
      });
  const recorded = input.stub ? null : await checkoutSessionGrant(sessionId);
  const submitted = !input.stub && !lookupFailed && documentOwnerEmail !== null;
  let draftUsed = false;
  if (!input.stub && !recorded && !submitted) {
    try {
      draftUsed = Boolean(await loadSessionDraftAnyOwner(sessionId));
    } catch {
      draftUsed = false;
    }
  }
  const decision = decideCheckoutAttach({
    existingSessionEmail: input.existingSessionEmail,
    customerEmail: email,
    sessionOwnerEmail: owner,
    alreadyGranted: Boolean(recorded) || submitted || draftUsed,
    submitted,
    stub: input.stub,
  });

  if (decision === "mismatch" || decision === "login") return decision;

  if (decision === "session" || decision === "same") {
    if (owner && !recorded) await rememberCheckoutSessionGrant(sessionId, owner);
    applyCheckoutGrantCookie(response, { sessionId, email });
    if (decision === "session" && owner) applyCheckoutOwnerSession(response, owner);
    return decision;
  }

  applyCheckoutGrantCookie(response, { sessionId, email });
  return decision;
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

/** Button on the session-bound login. The mask is the only address the browser sees. */
export function loginLinkButtonLabel(masked: string): string {
  const hint = masked.trim();
  return hint ? `Link an ${hint} senden` : "Anmeldelink senden";
}

/**
 * What the login form may receive. A next path with session_id and no
 * matching gobd_session does not include the owner address at all.
 */
export function loginClientFields(input: {
  next: string | null | undefined;
  checkoutEmail?: string | null;
  sessionEmail?: string | null;
}): { explain: boolean; masked: string; resolveOwner: boolean } {
  const offer = answersLoginOffer({
    next: input.next,
    checkoutEmail: input.checkoutEmail,
  });
  const target = intakeTargetFromNext(input.next);
  const session = normalizeEmail(input.sessionEmail);
  const owner = normalizeEmail(input.checkoutEmail);
  const matching = Boolean(target?.sessionId && session && owner && session === owner);
  if (target?.sessionId && !matching) {
    return {
      explain: offer.explain,
      masked: offer.masked,
      resolveOwner: Boolean(offer.masked),
    };
  }
  return { explain: offer.explain, masked: "", resolveOwner: false };
}

type LoginOwnerRow = {
  documentId?: string;
  stripeSessionId?: string;
  email?: string;
};

/**
 * Owner address for a login next path. Stays on the server: the page only
 * forwards the mask, and the magic-link route sends to this address.
 */
export async function ownerEmailForLoginNext(
  next: string | null | undefined,
  deps: {
    findDocumentById: (id: string) => Promise<LoginOwnerRow | null | undefined>;
    findLatestBySession: (id: string) => Promise<LoginOwnerRow | null | undefined>;
    resolveCheckout: (
      sessionId: string,
    ) => Promise<{ email?: string; error?: string } | { error: string }>;
    grantEmail: (sessionId: string) => Promise<string | null>;
  },
): Promise<string> {
  try {
    const target = intakeTargetFromNext(safeNextPath(next));
    if (!target || (!target.documentId && !target.sessionId)) return "";
    const row = target.documentId
      ? await deps.findDocumentById(target.documentId)
      : await deps.findLatestBySession(target.sessionId);
    const documentEmail = emailForAnswersLogin(row, target);
    if (documentEmail) return documentEmail;
    if (!target.sessionId) return "";
    const fromCheckout = await checkoutCustomerEmail(target.sessionId, deps.resolveCheckout);
    if (fromCheckout) return fromCheckout;
    return normalizeEmail(await deps.grantEmail(target.sessionId));
  } catch (error) {
    console.error(
      "[login] Checkout-Adresse nicht geladen",
      error instanceof Error ? error.name : "error",
    );
    return "";
  }
}
