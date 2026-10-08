import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import {
  checkoutGrantFromRequest,
  magicLinkUrl,
  sessionEmailFromRequest,
  withoutSessionCookie,
  type CheckoutGrant,
} from "@/lib/auth";
import { BlobStorageError, blobFailureClass, storePdf } from "@/lib/blob";
import {
  DURABLE_STORE_MESSAGE,
  freitextOverflows,
  intakePersistenceFailure,
} from "@/lib/intake-payload";
import { generatePdf, type DeliveryPlan } from "@/lib/delivery";
import { documentFamilyId, nextVersionNumber } from "@/lib/documents";
import { applyEntityToIdentity } from "@/lib/entities";
import { devCheckoutStubAllowed } from "@/lib/checkout-stub";
import { getAppUrl } from "@/lib/env";
import { deliverLoginLink } from "@/lib/login-mail";
import { normalizeIntakeAnswers } from "@/lib/intake-present";
import { sendDeliveryMail, sendReferralAfterDeliveryMail } from "@/lib/ops";
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
  getOwnedEntity,
  listDocumentFamily,
  listEntitiesByEmail,
  prepareDurableIntakeRow,
} from "@/lib/store";
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
};

type ResolvedIntake = {
  identity: CheckoutIdentity;
  version: number;
  parentDocumentId: string;
  status: string;
  entityId: string;
  /** Mail, die auf der Zeile stehen muss. Kommt nie aus body.email. */
  ownerEmail: string;
  family?: SheetRow[];
};

export type IntakeIo = {
  findDocumentById: DeliveryLookup["findDocumentById"];
  findLatestDocumentByStripeSessionId: DeliveryLookup["findLatestDocumentByStripeSessionId"];
  listDocumentFamily: DeliveryLookup["listDocumentFamily"];
  listEntitiesByEmail: typeof listEntitiesByEmail;
  getOwnedEntity: typeof getOwnedEntity;
  findLatestStripeCustomerIdByEmail: typeof findLatestStripeCustomerIdByEmail;
  resolveCheckoutSession: typeof resolveCheckoutSession;
  prepareDurableIntakeRow: typeof prepareDurableIntakeRow;
  appendRecord: typeof appendRecord;
  generatePdf: typeof generatePdf;
  storePdf: typeof storePdf;
  sendDeliveryMail: typeof sendDeliveryMail;
  sendReferralAfterDeliveryMail: typeof sendReferralAfterDeliveryMail;
  deliverLoginLink: typeof deliverLoginLink;
};

const defaultIntakeIo: IntakeIo = {
  findDocumentById,
  findLatestDocumentByStripeSessionId,
  listDocumentFamily,
  listEntitiesByEmail,
  getOwnedEntity,
  findLatestStripeCustomerIdByEmail,
  resolveCheckoutSession,
  prepareDurableIntakeRow,
  appendRecord,
  generatePdf,
  storePdf,
  sendDeliveryMail,
  sendReferralAfterDeliveryMail,
  deliverLoginLink,
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

  const identity = await io.resolveCheckoutSession(sessionId);
  if ("error" in identity) {
    const message =
      identity.error === "missing"
        ? "Checkout-Session fehlt."
        : identity.error === "not_paid"
          ? "Zahlung noch nicht bestätigt."
          : identity.error === "invalid"
            ? "Checkout-Session ist ungültig."
            : "Session konnte nicht geprüft werden. Bitte erneut versuchen.";
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

  return {
    identity,
    version: 1,
    parentDocumentId: "",
    status: identity.stub ? "intake_submitted_stub" : "intake_submitted",
    entityId: body.entityId?.trim() || identity.entityId || "",
    ownerEmail,
  };
}


async function withStripeCustomerId(
  identity: CheckoutIdentity,
  io: IntakeIo,
): Promise<CheckoutIdentity> {
  if (identity.stub || identity.stripeCustomerId.trim()) {
    return identity;
  }
  if (identity.stripeSessionId) {
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
  const sessionEmail = sessionEmailFromRequest(request);
  const grant = checkoutGrantFromRequest(request);
  const sessionId = body.sessionId?.trim() || grant?.sessionId || "";
  const resolved = await resolveIdentity(body, { sessionEmail, grant, sessionId }, io);
  if ("response" in resolved) {
    return resolved.response;
  }

  const { version, status } = resolved;
  let { identity, parentDocumentId } = resolved;
  identity = await withStripeCustomerId(identity, io);
  identity = { ...identity, email: resolved.ownerEmail };
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
  identity = { ...identity, email: resolved.ownerEmail };

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
  const documentId = randomUUID();
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

  let stored;
  try {
    stored = await io.appendRecord({
      ...rowForStore,
      pdfUrl,
      deliveryStatus: delivery.status,
    });
  } catch (error) {
    console.error(
      "[intake] appendRecord fehlgeschlagen",
      error instanceof Error ? error.name : "error",
    );
    const persistence = intakePersistenceFailure(error);
    if (persistence) return jsonError(persistence.error, persistence.status);
    return jsonError(DURABLE_STORE_MESSAGE, 503);
  }

  const appUrl = getAppUrl();
  const downloadUrl = `${appUrl}/api/docs/${documentId}/download?session_id=${encodeURIComponent(identity.stripeSessionId)}`;
  const successUrl = `${appUrl}/success?session_id=${encodeURIComponent(identity.stripeSessionId)}&document_id=${encodeURIComponent(documentId)}`;
  const magicUrl = identity.email ? magicLinkUrl(identity.email) : undefined;

  try {
    await io.sendDeliveryMail({
      email: identity.email,
      company: identity.company,
      downloadUrl,
      magicLinkUrl: magicUrl,
      successUrl,
      version,
    });
  } catch (error) {
    console.error("[intake] delivery mail fehlgeschlagen", error);
  }

  try {
    await io.sendReferralAfterDeliveryMail({
      email: identity.email,
      company: identity.company,
      documentId,
      sessionId: identity.stripeSessionId,
    });
  } catch (error) {
    console.error("[intake] referral mail fehlgeschlagen", error);
  }

  const loginMail = identity.email
    ? await io.deliverLoginLink(identity.email, "/account")
    : "failed";

  const response = NextResponse.json({
    ok: true,
    store: stored.backend,
    delivery,
    documentId,
    pdfUrl: downloadUrl,
    version,
    loginMail,
  });
  const checkoutGrant =
    identity.email &&
    identity.stripeSessionId &&
    (!identity.stub || devCheckoutStubAllowed())
      ? { sessionId: identity.stripeSessionId, email: identity.email }
      : undefined;
  return withoutSessionCookie(response, checkoutGrant);
}

export async function submitIntake(
  request: Request,
  io: IntakeIo = defaultIntakeIo,
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
    `anon:${sessionEmailFromRequest(request) ?? "none"}`;
  return withSessionWriteLock(lockKey, () => writeIntake(request, body, io));
}

export async function POST(request: Request) {
  try {
    return await submitIntake(request);
  } catch (error) {
    console.error("[intake] POST fehlgeschlagen", error);
    return jsonError("Speichern fehlgeschlagen.", 500, errorDetail(error));
  }
}
