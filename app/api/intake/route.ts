import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import {
  checkoutGrantFromRequest,
  magicLinkUrl,
  sessionEmailFromRequest,
  withoutSessionCookie,
  type CheckoutGrant,
} from "@/lib/auth";
import { sessionOwnerDenial } from "@/lib/checkout-access";
import {
  firmPosition,
  firmStartDecision,
  loadIncludedFirmCoverage,
  type IncludedFirmCoverage,
} from "@/lib/subscription-coverage";
import { isCompAccessEmail } from "@/lib/comp-access";
import { hasDs24Access } from "@/lib/digistore24-access";
import { queueOwnerNotice, type OwnerNoticeInput } from "@/lib/owner-notice";
import { closeDraftForm, normalizeFormId } from "@/lib/draft-closed";
import {
  claimIntakeSubmit,
  markSubmitUnsure,
  normalizeSubmitId,
  readSubmitPlan,
  releaseIntakeSubmit,
  submitDocumentId,
  type SubmitPlan,
} from "@/lib/intake-submit-claim";
import {
  applyCheckoutOwnerSession,
  isStoredPaidEntitlementStatus,
  isTestModeCheckoutSessionId,
  ownerEmailForFirstCompletion,
  rememberCheckoutSessionGrant,
  TEST_MODE_CHECKOUT_COPY,
} from "@/lib/checkout-session";
import { BlobStorageError, blobFailureClass, storePdf } from "@/lib/blob";
import {
  DURABLE_STORE_MESSAGE,
  freitextOverflows,
  intakePersistenceFailure,
} from "@/lib/intake-payload";
import { generatePdf, type DeliveryPlan } from "@/lib/delivery";
import { documentFamilyId, nextVersionNumber } from "@/lib/documents";
import { applyEntityToIdentity } from "@/lib/entities";
import { devCheckoutStubAllowed, isStubCheckoutSessionId } from "@/lib/checkout-stub";
import { getAppUrl } from "@/lib/env";
import { subscriptionWriteDenial } from "@/lib/kuendigung-access";
import { planFirmGate } from "@/lib/plan-access";
import { FIRM_NEEDS_PURCHASE_MESSAGE } from "@/lib/plan-firms";
import { reopenIfActiveCheckout } from "@/lib/kuendigung-stripe";
import { deliverLoginLinkReportingDuplicate } from "@/lib/login-mail";
import type { SubmitLoginMail } from "@/lib/login-mail-shared";
import { normalizeIntakeAnswers } from "@/lib/intake-present";
import { sendDeliveryMail } from "@/lib/ops";
import { isTestEntity } from "@/lib/test-entities";
import { queryIdsEqual } from "@/lib/query";
import { intakeEntityBinding } from "@/lib/session-issue";
import {
  authorizeDeliveredWrite,
  checkoutOwnerEmail,
  lookupDeliveredRows,
  withSessionWriteLock,
  type DeliveryLookup,
} from "@/lib/session-write";
import {
  appendRecord,
  findDocumentById,
  findLatestDocumentByStripeSessionId,
  findLatestStripeCustomerIdByEmail,
  findRowByStripeSessionId,
  getOwnedEntity,
  listDocumentFamily,
  listEntitiesByEmail,
  prepareDurableIntakeRow,
} from "@/lib/store";
import { sheetsOutageResponse } from "@/lib/sheets-http";
import { SHEETS_RETRY_AFTER_SECONDS, SHEETS_RETRY_MESSAGE } from "@/lib/sheets-unavailable";
import { runWithSheetsRoute } from "@/lib/sheets-outage";
import { intakeCheckoutStatus, resolveCheckoutSession } from "@/lib/stripe";
import {
  emailsEqual,
  identityFromSheetRow,
  toSheetRow,
  type CheckoutIdentity,
  type IntakeAnswers,
  type SheetRow,
} from "@/lib/types";
import {
  normalizeVersionChange,
  toVersionPdfMeta,
  versionHistoryEntries,
} from "@/lib/versioning";

export const runtime = "nodejs";
/**
 * Hard cap for one submit. A submit claim older than this plus a margin
 * (CLAIM_STALE_MS) belongs to a request that can no longer run.
 * Keep equal to INTAKE_ROUTE_MAX_DURATION_S (check:intake-idempotent).
 */
export const maxDuration = 60;

function errorDetail(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : "Unbekannter Fehler";
}

function jsonError(error: string, status: number, detail?: string) {
  return NextResponse.json(detail ? { error, detail } : { error }, { status });
}

function isAnswers(value: unknown): value is IntakeAnswers {
  if (!value || typeof value !== "object") return false;
  const v = value as IntakeAnswers;
  return (
    Array.isArray(v.branchen) &&
    typeof v.rechtsform === "string" &&
    typeof v.mitarbeitende === "string" &&
    Array.isArray(v.fibu) &&
    typeof v.weitereSysteme === "string" &&
    Array.isArray(v.eingangsbelege) &&
    Array.isArray(v.ausgangsrechnungen) &&
    typeof v.archiv === "string" &&
    typeof v.hosting === "string" &&
    Array.isArray(v.backup) &&
    typeof v.zugriff === "string" &&
    typeof v.gf === "string" &&
    typeof v.buchhaltung === "string" &&
    typeof v.it === "string" &&
    typeof v.steuerberater === "string"
  );
}

type IntakeBody = {
  sessionId?: string;
  answers?: unknown;
  email?: string;
  company?: string;
  documentId?: string;
  entityId?: string;
  areaFromDocumentId?: string;
  validFrom?: unknown;
  validTo?: unknown;
  changeSummary?: unknown;
  changedBy?: unknown;
  /** One id per submit, reused by every retry (UUID). */
  submitId?: string;
  /** Id of the open form page; closes its autosave after the commit. */
  formId?: string;
  draftKey?: string;
};

type ResolvedIntake = {
  identity: CheckoutIdentity;
  version: number;
  parentDocumentId: string;
  status: string;
  entityId: string;
  /** Mail, die auf der Zeile stehen muss. Kommt nie aus body.email. */
  ownerEmail: string;
  /** Erste Fassung dieser Bestellung. Nur dann darf der Checkout eine Session setzen. */
  firstDelivery: boolean;
  /**
   * Paid row already stored for this owner. Stripe is not asked again
   * (a live key cannot read a cs_test_ session).
   */
  fromStoredEntitlement?: boolean;
  /** Allowlist entitlement. No Stripe session and no customer id. */
  compAccess?: boolean;
  /**
   * Digistore24 purchase on the comp path (no Stripe session or customer id).
   * Unlike the allowlist it is a paying customer and gets the delivery mail.
   */
  ds24Access?: boolean;
  family?: SheetRow[];
};

export type IntakeIo = {
  findDocumentById: DeliveryLookup["findDocumentById"];
  findLatestDocumentByStripeSessionId: DeliveryLookup["findLatestDocumentByStripeSessionId"];
  listDocumentFamily: DeliveryLookup["listDocumentFamily"];
  listEntitiesByEmail: typeof listEntitiesByEmail;
  getOwnedEntity: typeof getOwnedEntity;
  findLatestStripeCustomerIdByEmail: typeof findLatestStripeCustomerIdByEmail;
  /** Optional so existing test doubles stay valid. Production wires the store. */
  findRowByStripeSessionId?: typeof findRowByStripeSessionId;
  resolveCheckoutSession: typeof resolveCheckoutSession;
  /**
   * Optional. Production wires the stored paid row plus Stripe subscription
   * status. Test doubles omit it and keep the checkout gate.
   */
  includedFirmCoverage?: (email: string) => Promise<IncludedFirmCoverage>;
  /** Aktiver Digistore24-Zugang (wie Comp, ohne Stripe). */
  ds24Access?: (email: string) => Promise<boolean>;
  prepareDurableIntakeRow: typeof prepareDurableIntakeRow;
  appendRecord: typeof appendRecord;
  generatePdf: typeof generatePdf;
  storePdf: typeof storePdf;
  sendDeliveryMail: typeof sendDeliveryMail;
  deliverLoginLink: typeof deliverLoginLinkReportingDuplicate;
  /** Optional for existing test doubles. Production wires lib/owner-notice. */
  queueOwnerNotice?: (input: OwnerNoticeInput) => void;
  claimSubmit?: typeof claimIntakeSubmit;
  readSubmitPlan?: typeof readSubmitPlan;
  releaseSubmit?: typeof releaseIntakeSubmit;
  markSubmitUnsure?: typeof markSubmitUnsure;
  closeDraftForm?: typeof closeDraftForm;
};

const defaultIntakeIo: IntakeIo = {
  findDocumentById,
  findLatestDocumentByStripeSessionId,
  listDocumentFamily,
  listEntitiesByEmail,
  getOwnedEntity,
  findLatestStripeCustomerIdByEmail,
  findRowByStripeSessionId,
  resolveCheckoutSession,
  includedFirmCoverage: loadIncludedFirmCoverage,
  ds24Access: hasDs24Access,
  prepareDurableIntakeRow,
  appendRecord,
  generatePdf,
  storePdf,
  sendDeliveryMail,
  deliverLoginLink: deliverLoginLinkReportingDuplicate,
  queueOwnerNotice,
  claimSubmit: claimIntakeSubmit,
  readSubmitPlan,
  releaseSubmit: releaseIntakeSubmit,
  markSubmitUnsure,
  closeDraftForm,
};

function deliveryLookup(io: IntakeIo): DeliveryLookup {
  return {
    findDocumentById: io.findDocumentById,
    listDocumentFamily: io.listDocumentFamily,
    findLatestDocumentByStripeSessionId: io.findLatestDocumentByStripeSessionId,
  };
}

function ownedWrite(
  write: ReturnType<typeof authorizeDeliveredWrite>,
): Extract<ReturnType<typeof authorizeDeliveredWrite>, { kind: "owner" }> | { response: NextResponse } {
  if (!write.ok) return { response: jsonError(write.error, write.status) };
  if (write.kind !== "owner") {
    return { response: jsonError("Dokument nicht gefunden.", 404) };
  }
  return write;
}

function checkoutFailureMessage(sessionId: string, error: string): string {
  if (error === "missing") return "Checkout-Session fehlt.";
  if (error === "not_paid") return "Zahlung noch nicht bestätigt.";
  if (error === "invalid") {
    return isTestModeCheckoutSessionId(sessionId)
      ? TEST_MODE_CHECKOUT_COPY
      : "Checkout-Session ist ungültig.";
  }
  return "Session konnte nicht geprüft werden. Bitte erneut versuchen.";
}

/**
 * Stored paid row for this checkout. Authorizes only the logged-in owner,
 * and only when the company on the row or the request belongs to that owner.
 * A cs_test_ id with no such row is not payment. No login falls through
 * so the caller keeps 401. A foreign owner is 403 and Stripe is not asked.
 */
async function identityFromStoredEntitlement(
  body: IntakeBody,
  sessionEmail: string | null,
  sessionId: string,
  io: IntakeIo,
): Promise<ResolvedIntake | { response: NextResponse } | null> {
  if (!sessionId || isStubCheckoutSessionId(sessionId) || !io.findRowByStripeSessionId) {
    return null;
  }
  const row = await io.findRowByStripeSessionId(sessionId);
  if (!row || !queryIdsEqual(row.stripeSessionId, sessionId)) return null;
  if (!isStoredPaidEntitlementStatus(row.status)) return null;

  const owner = row.email.trim();
  if (!owner.includes("@")) return null;
  const denial = sessionOwnerDenial(sessionEmail, owner);
  if (denial === 403) {
    return { response: jsonError("Kein Zugriff.", 403) };
  }
  if (denial !== null) return null;

  const requestedEntity = body.entityId?.trim() ?? "";
  const rowEntity = row.entityId.trim();
  for (const entityId of [requestedEntity, rowEntity]) {
    if (!entityId) continue;
    const owned = await io.getOwnedEntity(entityId, owner);
    if (!owned) return { response: jsonError("Kein Zugriff.", 403) };
  }

  const identity = identityFromSheetRow(row);
  identity.email = owner;
  identity.stub = false;
  identity.stripeSessionId = row.stripeSessionId.trim();
  return {
    identity,
    version: 1,
    parentDocumentId: "",
    status: "intake_submitted",
    entityId: requestedEntity || rowEntity,
    ownerEmail: owner,
    firstDelivery: true,
    fromStoredEntitlement: true,
  };
}

function revisionFromOwner(
  write: Extract<ReturnType<typeof authorizeDeliveredWrite>, { ok: true; kind: "owner" }>,
  family: SheetRow[],
  mode: "revision" | "area",
): ResolvedIntake {
  const identity = identityFromSheetRow(write.row);
  identity.email = write.ownerEmail;
  const revising = mode === "revision";
  return {
    identity,
    version: revising ? nextVersionNumber(family) : 1,
    parentDocumentId: revising ? documentFamilyId(write.row) : "",
    status: identity.stub
      ? revising
        ? "intake_resubmitted_stub"
        : "intake_submitted_stub"
      : revising
        ? "intake_resubmitted"
        : "intake_submitted",
    entityId: write.row.entityId,
    ownerEmail: write.ownerEmail,
    firstDelivery: false,
    family: revising ? family : undefined,
  };
}

async function resolveIdentity(
  body: IntakeBody,
  actor: { sessionEmail: string | null; grant: CheckoutGrant | null; sessionId: string },
  io: IntakeIo,
): Promise<ResolvedIntake | { response: NextResponse }> {
  const sessionEmail = actor.sessionEmail;
  const sourceDocumentId = body.documentId?.trim() ?? "";
  const areaFromDocumentId = body.areaFromDocumentId?.trim() ?? "";
  const sessionId = actor.sessionId;
  const lookup = deliveryLookup(io);

  // Weiterer Bereich derselben Firma: neue Dokumentfamilie, gleiche Bestellung.
  // Nach der ersten Lieferung nur mit Login der Inhaber-Mail.
  if (areaFromDocumentId && !sourceDocumentId) {
    const family = await lookupDeliveredRows({ areaFromDocumentId }, lookup);
    if (family.length === 0) {
      return { response: jsonError("Dokument nicht gefunden.", 404) };
    }
    const write = ownedWrite(authorizeDeliveredWrite({ sessionEmail, rows: family }));
    if ("response" in write) return write;
    return revisionFromOwner(write, family, "area");
  }

  if (sourceDocumentId) {
    const family = await lookupDeliveredRows({ documentId: sourceDocumentId }, lookup);
    if (family.length === 0) {
      return { response: jsonError("Dokument nicht gefunden.", 404) };
    }
    const write = ownedWrite(authorizeDeliveredWrite({ sessionEmail, rows: family }));
    if ("response" in write) return write;
    return revisionFromOwner(write, family, "revision");
  }

  if (sessionId) {
    const family = await lookupDeliveredRows({ sessionId }, lookup);
    if (family.length > 0) {
      const write = ownedWrite(authorizeDeliveredWrite({ sessionEmail, rows: family }));
      if ("response" in write) return write;
      return revisionFromOwner(write, family, "revision");
    }
  }

  const entitled = await identityFromStoredEntitlement(body, sessionEmail, sessionId, io);
  if (entitled) return entitled;

  const ds24Entitled =
    !sessionId && sessionEmail && !isCompAccessEmail(sessionEmail) && io.ds24Access
      ? await io.ds24Access(sessionEmail)
      : false;
  if (!sessionId && sessionEmail && (isCompAccessEmail(sessionEmail) || ds24Entitled)) {
    return {
      identity: {
        email: sessionEmail,
        company: "",
        stripeSessionId: "",
        stripeCustomerId: "",
        stub: false,
      },
      version: 1,
      parentDocumentId: "",
      status: "intake_submitted",
      entityId: body.entityId?.trim() || "",
      ownerEmail: sessionEmail,
      firstDelivery: false,
      compAccess: true,
      ds24Access: ds24Entitled === true,
    };
  }

  const requestedEntity = body.entityId?.trim() ?? "";
  if (!sessionId && sessionEmail && requestedEntity && io.includedFirmCoverage) {
    const owned = await io.getOwnedEntity(requestedEntity, sessionEmail);
    const denial = sessionOwnerDenial(sessionEmail, owned?.userEmail ?? "");
    if (!owned || denial) {
      return { response: jsonError("Kein Zugriff.", denial ?? 403) };
    }
    const coverage = await io.includedFirmCoverage(sessionEmail);
    const firms = await io.listEntitiesByEmail(sessionEmail);
    const decision = firmStartDecision({
      sessionEmail,
      entityOwnerEmail: owned.userEmail,
      entityId: owned.entityId,
      firmPosition: firmPosition(firms, owned.entityId),
      coverage,
    });
    if (decision === "denied") {
      return { response: jsonError("Kein Zugriff.", 403) };
    }
    if (decision === "add_firm") {
      return { response: jsonError(FIRM_NEEDS_PURCHASE_MESSAGE, 403) };
    }
    if (decision === "intake") {
      return {
        identity: {
          email: sessionEmail,
          company: owned.name,
          stripeSessionId: "",
          stripeCustomerId: coverage.stripeCustomerId,
          stub: false,
        },
        version: 1,
        parentDocumentId: "",
        status: "intake_submitted",
        entityId: owned.entityId,
        ownerEmail: sessionEmail,
        firstDelivery: false,
        fromStoredEntitlement: true,
      };
    }
  }

  const identity = await io.resolveCheckoutSession(sessionId);
  if ("error" in identity) {
    const message = checkoutFailureMessage(sessionId, identity.error);
    return {
      response: NextResponse.json(
        { error: message, reason: identity.error },
        { status: intakeCheckoutStatus(identity.error) },
      ),
    };
  }

  if (identity.stub && !devCheckoutStubAllowed()) {
    return { response: jsonError("Checkout-Session fehlt.", 401) };
  }

  const ownerEmail = checkoutOwnerEmail({
    stripeEmail: identity.email,
    stripeSessionId: identity.stripeSessionId,
    grantSessionId: actor.grant?.sessionId,
    grantEmail: actor.grant?.email,
  });
  identity.email = ownerEmail;
  const denial = sessionOwnerDenial(sessionEmail, identity.email);
  if (denial) {
    return { response: jsonError("Kein Zugriff.", denial) };
  }

  return {
    identity,
    version: 1,
    parentDocumentId: "",
    status: identity.stub ? "intake_submitted_stub" : "intake_submitted",
    entityId: body.entityId?.trim() || identity.entityId || "",
    ownerEmail,
    firstDelivery: true,
  };
}


async function withStripeCustomerId(
  identity: CheckoutIdentity,
  io: IntakeIo,
  options?: { skipStripeSession?: boolean },
): Promise<CheckoutIdentity> {
  if (identity.stub || identity.stripeCustomerId.trim()) {
    return identity;
  }
  if (!options?.skipStripeSession && identity.stripeSessionId) {
    const fresh = await io.resolveCheckoutSession(identity.stripeSessionId);
    if (!("error" in fresh) && fresh.stripeCustomerId.trim()) {
      return { ...identity, stripeCustomerId: fresh.stripeCustomerId };
    }
  }
  if (identity.email) {
    const fromStore = await io.findLatestStripeCustomerIdByEmail(identity.email);
    if (fromStore) {
      return { ...identity, stripeCustomerId: fromStore };
    }
  }
  return identity;
}

async function writeIntake(
  request: Request,
  body: IntakeBody,
  io: IntakeIo,
): Promise<NextResponse> {
  const sessionEmail = await sessionEmailFromRequest(request);
  const grant = checkoutGrantFromRequest(request);
  const sessionId = body.sessionId?.trim() || grant?.sessionId || "";
  const ctx = { checkedDocumentIds: new Set<string>(), rowLookedUp: new Set<string>() };
  const submitId = normalizeSubmitId(body.submitId);
  if (submitId) {
    // Retry of a submit that was already stored (its answer got lost). Checked
    // before the checkout gate: after the first delivery the gate would ask
    // for a login the buyer does not have yet.
    for (const email of submitCandidates(sessionEmail, grant)) {
      const id = submitDocumentId(email, submitId);
      ctx.checkedDocumentIds.add(id);
      const earlier = await committedSubmit(id, io, ctx.rowLookedUp);
      if (earlier && emailsEqual(earlier.row.email, email)) {
        return replayCommitted(earlier, email, { io, sessionEmail, grant, body });
      }
    }
  }
  const resolved = await resolveIdentity(body, { sessionEmail, grant, sessionId }, io);
  if ("response" in resolved) {
    return resolved.response;
  }

  const { version, status } = resolved;
  let { identity, parentDocumentId } = resolved;
  if (!resolved.compAccess) {
    identity = await withStripeCustomerId(identity, io, {
      skipStripeSession: resolved.fromStoredEntitlement === true,
    });
  }
  identity = { ...identity, email: resolved.ownerEmail };
  let closed = await subscriptionWriteDenial(identity.email);
  if (closed && identity.stripeSessionId) {
    await reopenIfActiveCheckout(identity.email, identity.stripeSessionId);
    closed = await subscriptionWriteDenial(identity.email);
  }
  if (closed) return jsonError(closed, 403);
  const newVersion = version > 1;
  const loggedInAsBuyer = Boolean(
    sessionEmail && identity.email && emailsEqual(sessionEmail, identity.email),
  );
  const firms = loggedInAsBuyer ? await io.listEntitiesByEmail(identity.email) : [];
  const binding = intakeEntityBinding({
    loggedInAsBuyer,
    requestedEntityId: body.entityId?.trim() || resolved.entityId,
    resolvedEntityId: resolved.entityId,
    revising: Boolean(parentDocumentId || body.areaFromDocumentId?.trim()),
    ownedEntityIds: firms.map((row) => row.entityId),
  });
  if (binding.needsFirmChoice) {
    return jsonError("Bitte eine Firma wählen.", 400);
  }
  const entityId = binding.entityId;
  const entity = entityId ? await io.getOwnedEntity(entityId, identity.email) : null;
  identity = applyEntityToIdentity(identity, entity);
  identity = {
    ...identity,
    email: resolved.ownerEmail,
    entityId: entityId || identity.entityId || "",
  };
  const skipTestDelivery = isTestEntity(identity.entityId);
  // Preismodell v2 (nur mit PLAN_ACCESS_ENABLED): Platz der Firma und, für
  // eine neue Version, Mitgliedschaft oder bezahlte Änderung dieser Firma.
  const planGate = await planFirmGate(identity.email, identity.entityId, newVersion);
  if (planGate.denial) return jsonError(planGate.denial, 403);

  if (!isAnswers(body.answers)) {
    return jsonError("Intake unvollständig.", 400);
  }

  const answers = normalizeIntakeAnswers(body.answers);
  const tooLong = freitextOverflows(answers)[0];
  if (tooLong) {
    return NextResponse.json(
      {
        error: tooLong.message,
        questionId: tooLong.questionId,
        fieldKey: tooLong.fieldKey,
      },
      { status: 400 },
    );
  }
  const change = normalizeVersionChange(body, {
    version,
    defaultChangedBy: identity.email,
  });
  if ("error" in change) {
    return jsonError(change.error, 400);
  }
  const versionMeta = toVersionPdfMeta(change);
  const versionHistory = resolved.family
    ? versionHistoryEntries(resolved.family, { version, validFrom: change.validFrom })
    : [];
  const ownerNotice: SubmitPlan["notice"] = skipTestDelivery
    ? null
    : {
        mode: identity.stub || identity.stripeSessionId.startsWith("cs_test_") ? "test" : "live",
        access: resolved.ds24Access
          ? "Digistore24"
          : resolved.compAccess
            ? "kostenfrei (Comp)"
            : identity.stripeSessionId
              ? "Stripe"
              : "Abo",
      };
  const plan: SubmitPlan = {
    // Comp-Allowlist: keine Liefer-Mail. DS24-Käufer bekommen sie wie Stripe-Käufer.
    deliveryMail: (!resolved.compAccess || resolved.ds24Access === true) && !skipTestDelivery,
    notice: ownerNotice,
    firstDelivery: resolved.firstDelivery,
    stub: identity.stub,
  };

  const documentId = submitId ? submitDocumentId(resolved.ownerEmail, submitId) : randomUUID();
  const replayContext = { io, sessionEmail, grant, body };
  let claimed = false;
  if (submitId) {
    if (!ctx.checkedDocumentIds.has(documentId)) {
      const earlier = await committedSubmit(documentId, io, ctx.rowLookedUp);
      if (earlier) return replayOrDeny(earlier, resolved.ownerEmail, replayContext);
    }
    const claim = await claimSubmitSafely(documentId, plan, io);
    if (claim === "busy") {
      // A parallel request with this submit is writing. Answer its row if it is there.
      const row = await io.findDocumentById(documentId);
      if (row) {
        return replayOrDeny(
          { row, plan: (await readPlanSafely(documentId, io)) ?? plan },
          resolved.ownerEmail,
          replayContext,
        );
      }
      return retryLaterResponse();
    }
    claimed = claim === "claimed";
    // Never a second row for one id, even when the claim marker was missing,
    // expired, released or could not be written: look at the sheet first.
    if (!ctx.rowLookedUp.has(documentId)) {
      const row = await io.findDocumentById(documentId);
      if (row) {
        return replayOrDeny(
          { row, plan: (await readPlanSafely(documentId, io)) ?? plan },
          resolved.ownerEmail,
          replayContext,
        );
      }
    }
  }
  const closeDraftKey = await boundDraftKey(body.draftKey, {
    io,
    ownerEmail: identity.email,
    stripeSessionId: identity.stripeSessionId,
    // resolveIdentity already proved these belong to the owner (404/403 otherwise).
    verifiedDocumentIds: [body.documentId?.trim() || body.areaFromDocumentId?.trim() || ""],
  });
  let committed = false;
  /** Append threw but the row may exist: the id stays reserved. */
  let keepClaim = false;
  try {
    if (!parentDocumentId) {
      parentDocumentId = documentId;
    }

    let rowForStore;
    try {
      rowForStore = await io.prepareDurableIntakeRow(
        toSheetRow({
          identity,
          answers,
          status,
          deliveryStatus: "",
          documentId,
          parentDocumentId,
          version: String(version),
          entityId,
          validFrom: change.validFrom,
          validTo: change.validTo,
          changeSummary: change.changeSummary,
          changedBy: change.changedBy,
        }),
      );
    } catch (error) {
      const outage = sheetsOutageResponse(error);
      if (outage) return outage;
      console.error(
        "[intake] dauerhafte Speicherung fehlgeschlagen",
        error instanceof Error ? error.name : "error",
      );
      const persistence = intakePersistenceFailure(error);
      if (persistence) return jsonError(persistence.error, persistence.status);
      return jsonError(DURABLE_STORE_MESSAGE, 503);
    }

    let delivery: DeliveryPlan;
    let pdfUrl = "";

    if (skipTestDelivery) {
      console.info("[intake] Testfirma: PDF und Liefermail übersprungen");
      delivery = {
        status: "ready",
        chapters: [],
        openItems: [],
        pdf: null,
      };
    } else {
      try {
        const generated = await io.generatePdf({
          answers,
          identity,
          documentId,
          version,
          versionMeta,
          versionHistory,
        });
        const storedPdf = await io.storePdf({
          familyId: parentDocumentId,
          documentId,
          version,
          buffer: generated.buffer,
        });
        pdfUrl = storedPdf.url || storedPdf.pathname;
        delivery = {
          ...generated.plan,
          status: "ready",
          pdf: {
            version,
            documentId,
            url: storedPdf.url,
            pathname: storedPdf.pathname,
            backend: storedPdf.backend,
          },
        };
      } catch (error) {
        console.error("[intake] PDF-Erzeugung fehlgeschlagen", blobFailureClass(error));
        if (error instanceof BlobStorageError) {
          return jsonError("PDF konnte nicht gespeichert werden.", 503);
        }
        return jsonError("PDF konnte nicht erzeugt werden.", 500, errorDetail(error));
      }
    }

    let storeBackend: string;
    try {
      const stored = await io.appendRecord({
        ...rowForStore,
        pdfUrl,
        deliveryStatus: skipTestDelivery ? "" : delivery.status,
      });
      storeBackend = stored.backend;
      committed = true;
      await planGate.commit({ pdfCreated: Boolean(pdfUrl) });
    } catch (error) {
      // A timeout or retried append may still have stored the row.
      const landed = submitId ? await rowAfterFailedAppend(documentId, io) : null;
      if (landed === "unknown") {
        keepClaim = true;
        await (io.markSubmitUnsure ?? markSubmitUnsure)(documentId, plan).catch((markError: unknown) => {
          logAfterCommit("Sperre markieren", markError);
        });
      }
      if (landed && landed !== "unknown") {
        committed = true;
        await planGate.commit({ pdfCreated: Boolean(pdfUrl) });
        storeBackend = "sheets";
      } else {
        const outage = sheetsOutageResponse(error);
        if (outage) return outage;
        console.error(
          "[intake] appendRecord fehlgeschlagen",
          error instanceof Error ? error.name : "error",
        );
        const persistence = intakePersistenceFailure(error);
        if (persistence) return jsonError(persistence.error, persistence.status);
        return jsonError(DURABLE_STORE_MESSAGE, 503);
      }
    }

    // Stored. Nothing below may turn this into an error: the client would retry.
    const loginMail = await afterCommit({
      io,
      plan,
      identity,
      documentId,
      version,
      sendLoginLink: true,
      // Every stored submit has the owner's session. The first delivery after
      // a checkout (session from the checkout grant) and DS24 keep the link;
      // a later submit by the signed-in owner (revision, area, firm) does not.
      ownerLoggedIn:
        !plan.firstDelivery &&
        resolved.ds24Access !== true &&
        Boolean(sessionEmail && identity.email && emailsEqual(sessionEmail, identity.email)),
      formId: body.formId,
      draftKey: closeDraftKey,
    });
    return await finishSubmitResponse({
      payload: {
        ok: true,
        store: storeBackend,
        delivery,
        documentId,
        pdfUrl: deliveryUrls(identity.stripeSessionId, documentId).downloadUrl,
        version,
        loginMail,
      },
      plan,
      grant,
      sessionEmail,
      ownerEmail: identity.email,
      stripeSessionId: identity.stripeSessionId,
    });
  } finally {
    if (claimed && !committed && !keepClaim) {
      await (io.releaseSubmit ?? releaseIntakeSubmit)(documentId).catch((error: unknown) => {
        console.error("[intake] Sperre nicht freigegeben", error instanceof Error ? error.name : "error");
      });
    }
  }
}

function deliveryUrls(stripeSessionId: string, documentId: string) {
  const appUrl = getAppUrl();
  return {
    downloadUrl: stripeSessionId
      ? `${appUrl}/api/docs/${documentId}/download?session_id=${encodeURIComponent(stripeSessionId)}`
      : `${appUrl}/api/docs/${documentId}/download`,
    successUrl: stripeSessionId
      ? `${appUrl}/success?session_id=${encodeURIComponent(stripeSessionId)}&document_id=${encodeURIComponent(documentId)}`
      : `${appUrl}/success?document_id=${encodeURIComponent(documentId)}`,
  };
}

function retryLaterResponse(): NextResponse {
  return NextResponse.json(
    { error: SHEETS_RETRY_MESSAGE },
    {
      status: 503,
      headers: {
        "Cache-Control": "private, no-store",
        "Retry-After": SHEETS_RETRY_AFTER_SECONDS,
      },
    },
  );
}

function logAfterCommit(step: string, error: unknown): void {
  console.error(`[intake] ${step} fehlgeschlagen`, error instanceof Error ? error.name : "error");
}

/**
 * Owner notice, delivery mail and login link after the row is stored. The
 * notice and the delivery mail use the mail ledger keys (doc:<id>:<version>,
 * delivery:<id>:<version>), so a replay of the same document sends neither twice.
 */
async function afterCommit(input: {
  io: IntakeIo;
  plan: SubmitPlan;
  identity: Pick<CheckoutIdentity, "email" | "company" | "entityId" | "stripeSessionId">;
  documentId: string;
  version: number;
  sendLoginLink: boolean;
  /** Signed in as the owner: the delivery mail goes out, a login link does not. */
  ownerLoggedIn?: boolean;
  formId?: string;
  draftKey?: string;
}): Promise<SubmitLoginMail> {
  const { io, plan, identity, documentId, version } = input;
  const formId = normalizeFormId(input.formId);
  const draftKey = input.draftKey?.trim() ?? "";
  if (formId && draftKey) {
    try {
      await (io.closeDraftForm ?? closeDraftForm)(draftKey, formId);
    } catch (error) {
      logAfterCommit("Entwurf schließen", error);
    }
  }
  if (plan.notice) {
    (io.queueOwnerNotice ?? queueOwnerNotice)({
      kind: "doc",
      id: `${documentId}:${version}`,
      title: "Doku abgeschlossen",
      email: identity.email,
      company: identity.company,
      entityId: identity.entityId,
      mode: plan.notice.mode,
      facts: [
        ["Dokument", documentId],
        ["Version", String(version)],
        ["Zugang", plan.notice.access],
      ],
    });
  }
  if (!plan.deliveryMail) return "skipped";
  const { downloadUrl, successUrl } = deliveryUrls(identity.stripeSessionId, documentId);
  let magicUrl: string | undefined;
  try {
    magicUrl = identity.email ? ((await magicLinkUrl(identity.email)) ?? undefined) : undefined;
  } catch (error) {
    logAfterCommit("Anmeldelink", error);
  }
  try {
    await io.sendDeliveryMail({
      email: identity.email,
      company: identity.company,
      downloadUrl,
      magicLinkUrl: magicUrl,
      successUrl,
      documentId,
      version,
      entityId: identity.entityId,
    });
  } catch (error) {
    console.error("[intake] delivery mail fehlgeschlagen", error);
  }
  if (!input.sendLoginLink) return "skipped";
  if (input.ownerLoggedIn) return "loggedIn";
  if (!identity.email) return "failed";
  try {
    return await io.deliverLoginLink(identity.email, "/account");
  } catch (error) {
    logAfterCommit("Login-Mail", error);
    return "failed";
  }
}

async function finishSubmitResponse(input: {
  payload: Record<string, unknown>;
  plan: SubmitPlan;
  grant: CheckoutGrant | null;
  sessionEmail: string | null;
  ownerEmail: string;
  stripeSessionId: string;
}): Promise<NextResponse> {
  const response = NextResponse.json(input.payload);
  const sessionOwner = input.plan.firstDelivery
    ? ownerEmailForFirstCompletion({
        grant: input.grant,
        ownerEmail: input.ownerEmail,
        stripeSessionId: input.stripeSessionId,
        stub: input.plan.stub,
      })
    : null;
  if (sessionOwner && !input.sessionEmail) applyCheckoutOwnerSession(response, sessionOwner);
  if (sessionOwner && (!input.sessionEmail || emailsEqual(input.sessionEmail, sessionOwner))) {
    try {
      await rememberCheckoutSessionGrant(input.stripeSessionId, sessionOwner);
    } catch (error) {
      logAfterCommit("Checkout-Freigabe", error);
    }
  }
  const checkoutGrant =
    input.ownerEmail &&
    input.stripeSessionId &&
    (!input.plan.stub || devCheckoutStubAllowed())
      ? { sessionId: input.stripeSessionId, email: input.ownerEmail }
      : undefined;
  return withoutSessionCookie(response, checkoutGrant);
}

async function rowAfterFailedAppend(documentId: string, io: IntakeIo): Promise<SheetRow | null | "unknown"> {
  try {
    return await io.findDocumentById(documentId);
  } catch {
    return "unknown";
  }
}

type CommittedSubmit = { row: SheetRow; plan: SubmitPlan | null };

async function readPlanSafely(documentId: string, io: IntakeIo): Promise<SubmitPlan | null | undefined> {
  try {
    return await (io.readSubmitPlan ?? readSubmitPlan)(documentId);
  } catch (error) {
    console.error("[intake] Sperre nicht gelesen", error instanceof Error ? error.name : "error");
    return undefined;
  }
}

/**
 * Row already stored for this submit. The claim marker is written before any
 * row, so no marker means no row and the Sheets lookup is skipped.
 */
async function committedSubmit(
  documentId: string,
  io: IntakeIo,
  lookedUp?: Set<string>,
): Promise<CommittedSubmit | null> {
  const plan = await readPlanSafely(documentId, io);
  if (plan === null) return null;
  const row = await io.findDocumentById(documentId);
  lookedUp?.add(documentId);
  return row ? { row, plan: plan ?? null } : null;
}

/**
 * The Entwurf key from the body, only when it belongs to this owner:
 * `session:` the owner's checkout session, `email:` the owner's address,
 * `doc:` / `area:` a document of the owner. Anything else closes nothing.
 */
async function boundDraftKey(
  raw: string | undefined,
  input: {
    io: IntakeIo;
    ownerEmail: string;
    stripeSessionId: string;
    verifiedDocumentIds: string[];
  },
): Promise<string> {
  const key = raw?.trim() ?? "";
  if (!key || !input.ownerEmail.trim()) return "";
  const parts = key.split(":");
  const kind = parts[0] ?? "";
  if (kind === "session") {
    const sid = input.stripeSessionId.trim();
    return sid && parts.length === 3 && parts[1] === sid ? key : "";
  }
  if (kind === "email") {
    return parts.length === 4 && emailsEqual(parts[1] ?? "", input.ownerEmail) ? key : "";
  }
  if (kind === "doc" || kind === "area") {
    const id = (parts[1] ?? "").trim();
    if (!id || parts.length !== (kind === "doc" ? 2 : 3)) return "";
    if (input.verifiedDocumentIds.includes(id)) return key;
    try {
      const row = await input.io.findDocumentById(id);
      return row && emailsEqual(row.email, input.ownerEmail) ? key : "";
    } catch (error) {
      logAfterCommit("Entwurfsschlüssel prüfen", error);
      return "";
    }
  }
  return "";
}

async function claimSubmitSafely(
  documentId: string,
  plan: SubmitPlan,
  io: IntakeIo,
): Promise<"claimed" | "busy" | "unclaimed"> {
  try {
    return await (io.claimSubmit ?? claimIntakeSubmit)(documentId, plan);
  } catch (error) {
    // Blob down: the PDF step needs Blob too, so this request fails there.
    console.error("[intake] Sperre nicht gesetzt", error instanceof Error ? error.name : "error");
    return "unclaimed";
  }
}

async function replayOrDeny(
  earlier: CommittedSubmit,
  ownerEmail: string,
  context: { io: IntakeIo; sessionEmail: string | null; grant: CheckoutGrant | null; body: IntakeBody },
): Promise<NextResponse> {
  if (!emailsEqual(earlier.row.email, ownerEmail)) return jsonError("Kein Zugriff.", 403);
  return replayCommitted(earlier, ownerEmail, context);
}

/**
 * The same submit was stored before (the answer got lost). Same document,
 * same version; mails go through the same ledger keys, so none is sent twice.
 * No second login link.
 */
async function replayCommitted(
  earlier: CommittedSubmit,
  ownerEmail: string,
  context: { io: IntakeIo; sessionEmail: string | null; grant: CheckoutGrant | null; body: IntakeBody },
): Promise<NextResponse> {
  const { row } = earlier;
  const documentId = row.documentId.trim();
  const version = Number.parseInt(row.version, 10) || 1;
  const stripeSessionId = row.stripeSessionId.trim();
  // Without the stored plan nothing is sent again: no second mail is the safe side.
  const plan: SubmitPlan = earlier.plan ?? {
    deliveryMail: false,
    notice: null,
    firstDelivery: false,
    stub: false,
  };
  const identity = {
    email: ownerEmail,
    company: row.company,
    entityId: row.entityId,
    stripeSessionId,
  };
  const loginMail = await afterCommit({
    io: context.io,
    plan,
    identity,
    documentId,
    version,
    sendLoginLink: false,
    formId: context.body.formId,
    draftKey: await boundDraftKey(context.body.draftKey, {
      io: context.io,
      ownerEmail,
      stripeSessionId,
      verifiedDocumentIds: [],
    }),
  });
  console.info("[intake] Wiederholung beantwortet", JSON.stringify({ version }));
  return finishSubmitResponse({
    payload: {
      ok: true,
      store: "existing",
      delivery: {
        status: row.deliveryStatus.trim() || "ready",
        chapters: [],
        openItems: [],
        pdf: null,
      },
      documentId,
      pdfUrl: deliveryUrls(stripeSessionId, documentId).downloadUrl,
      version,
      loginMail,
      replay: true,
    },
    plan,
    grant: context.grant,
    sessionEmail: context.sessionEmail,
    ownerEmail,
    stripeSessionId,
  });
}

/** Addresses this request is signed in as (session cookie, checkout grant). */
function submitCandidates(sessionEmail: string | null, grant: CheckoutGrant | null): string[] {
  const out: string[] = [];
  for (const email of [sessionEmail, grant?.email]) {
    const value = email?.trim().toLowerCase() ?? "";
    if (value.includes("@") && !out.includes(value)) out.push(value);
  }
  return out;
}

export async function submitIntake(
  request: Request,
  io: IntakeIo = defaultIntakeIo,
): Promise<NextResponse> {
  return runWithSheetsRoute("POST /api/intake", async () => {
    try {
      return await submitIntakeBody(request, io);
    } catch (error) {
      const outage = sheetsOutageResponse(error);
      if (outage) return outage;
      throw error;
    }
  });
}

async function submitIntakeBody(
  request: Request,
  io: IntakeIo,
): Promise<NextResponse> {
  let body: IntakeBody;
  try {
    body = await request.json();
  } catch {
    return jsonError("Ungültige Anfrage", 400);
  }
  const grant = checkoutGrantFromRequest(request);
  const sessionId = body.sessionId?.trim() || grant?.sessionId || "";
  const lockKey =
    sessionId ||
    body.documentId?.trim() ||
    body.areaFromDocumentId?.trim() ||
    `anon:${await sessionEmailFromRequest(request) ?? "none"}`;
  return withSessionWriteLock(lockKey, () => writeIntake(request, body, io));
}

export async function POST(request: Request) {
  try {
    return await submitIntake(request);
  } catch (error) {
    const outage = sheetsOutageResponse(error);
    if (outage) return outage;
    console.error("[intake] POST fehlgeschlagen", error);
    return jsonError("Speichern fehlgeschlagen.", 500, errorDetail(error));
  }
}
