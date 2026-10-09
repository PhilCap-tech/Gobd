import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getSessionEmail, magicLinkUrl, withoutSessionCookie } from "@/lib/auth";
import { BlobStorageError, blobFailureClass, storePdf } from "@/lib/blob";
import {
  DURABLE_STORE_MESSAGE,
  freitextOverflows,
  intakePersistenceFailure,
} from "@/lib/intake-payload";
import { generatePdf, type DeliveryPlan } from "@/lib/delivery";
import {
  canAccessDocument,
  documentFamilyId,
  nextVersionNumber,
} from "@/lib/documents";
import { applyEntityToIdentity } from "@/lib/entities";
import { devCheckoutStubAllowed } from "@/lib/checkout-stub";
import { getAppUrl } from "@/lib/env";
import { deliverLoginLink } from "@/lib/login-mail";
import { sendDeliveryMail, sendReferralAfterDeliveryMail } from "@/lib/ops";
import { intakeEntityBinding } from "@/lib/session-issue";
import {
  appendRecord,
  findLatestDocumentByStripeSessionId,
  findLatestStripeCustomerIdByEmail,
  getOwnedEntity,
  listDocumentFamily,
  listEntitiesByEmail,
  prepareDurableIntakeRow,
} from "@/lib/store";
import { normalizeIntakeAnswers } from "@/lib/intake-present";
import { intakeCheckoutStatus, resolveCheckoutSession } from "@/lib/stripe";
import {
  emailsEqual,
  identityFromSheetRow,
  toSheetRow,
  type CheckoutIdentity,
  type IntakeAnswers,
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

async function resolveIdentity(body: {
  sessionId?: string;
  answers?: unknown;
  email?: string;
  company?: string;
  documentId?: string;
  entityId?: string;
  areaFromDocumentId?: string;
}): Promise<
  | {
      identity: CheckoutIdentity;
      version: number;
      parentDocumentId: string;
      status: string;
      entityId: string;
      /** Earlier versions of this document family (for the Änderungshistorie). */
      family?: Awaited<ReturnType<typeof listDocumentFamily>>;
    }
  | { response: NextResponse }
> {
  const sourceDocumentId = body.documentId?.trim() ?? "";
  const areaFromDocumentId = body.areaFromDocumentId?.trim() ?? "";
  const sessionEmail = await getSessionEmail();

  // Weiterer Bereich derselben Firma: neue Dokumentfamilie, gleiche Bestellung.
  // Alle Bereiche sind im Preis je Firma enthalten, daher kein neuer Checkout.
  if (areaFromDocumentId && !sourceDocumentId) {
    const family = await listDocumentFamily(areaFromDocumentId);
    const source =
      family.find((row) => row.documentId === areaFromDocumentId) ??
      family.at(-1);
    if (!source) {
      return { response: jsonError("Dokument nicht gefunden.", 404) };
    }
    if (
      !canAccessDocument(source, {
        sessionEmail,
        sessionId: body.sessionId,
      })
    ) {
      return { response: jsonError("Kein Zugriff.", sessionEmail ? 403 : 401) };
    }
    const identity = identityFromSheetRow(source);
    return {
      identity,
      version: 1,
      parentDocumentId: "",
      status: identity.stub ? "intake_submitted_stub" : "intake_submitted",
      entityId: source.entityId,
    };
  }

  if (sourceDocumentId) {
    const family = await listDocumentFamily(sourceDocumentId);
    const source =
      family.find((row) => row.documentId === sourceDocumentId) ??
      family.at(-1);
    if (!source) {
      return { response: jsonError("Dokument nicht gefunden.", 404) };
    }
    if (
      !canAccessDocument(source, {
        sessionEmail,
        sessionId: body.sessionId,
      })
    ) {
      return { response: jsonError("Kein Zugriff.", sessionEmail ? 403 : 401) };
    }

    const identity = identityFromSheetRow(source);
    return {
      identity,
      version: nextVersionNumber(family),
      parentDocumentId: documentFamilyId(source),
      status: identity.stub
        ? "intake_resubmitted_stub"
        : "intake_resubmitted",
      entityId: source.entityId,
      family,
    };
  }

  const existing = body.sessionId
    ? await findLatestDocumentByStripeSessionId(body.sessionId)
    : null;
  if (
    existing &&
    canAccessDocument(existing, {
      sessionEmail,
      sessionId: body.sessionId,
    })
  ) {
    const family = await listDocumentFamily(existing.documentId);
    const identity = identityFromSheetRow(existing);
    return {
      identity,
      version: nextVersionNumber(family),
      parentDocumentId: documentFamilyId(existing),
      status: identity.stub
        ? "intake_resubmitted_stub"
        : "intake_resubmitted",
      entityId: existing.entityId,
      family,
    };
  }

  const identity = await resolveCheckoutSession(body.sessionId);
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

  if (identity.stub) {
    identity.email = body.email?.trim() || identity.email;
    identity.company = body.company?.trim() || identity.company;
  }

  return {
    identity,
    version: 1,
    parentDocumentId: "",
    status: identity.stub ? "intake_submitted_stub" : "intake_submitted",
    entityId: body.entityId?.trim() || identity.entityId || "",
  };
}

async function withStripeCustomerId(
  identity: CheckoutIdentity,
): Promise<CheckoutIdentity> {
  if (identity.stub || identity.stripeCustomerId.trim()) {
    return identity;
  }
  if (identity.stripeSessionId) {
    const fresh = await resolveCheckoutSession(identity.stripeSessionId);
    if (!("error" in fresh) && fresh.stripeCustomerId.trim()) {
      return { ...identity, stripeCustomerId: fresh.stripeCustomerId };
    }
  }
  if (identity.email) {
    const fromStore = await findLatestStripeCustomerIdByEmail(identity.email);
    if (fromStore) {
      return { ...identity, stripeCustomerId: fromStore };
    }
  }
  return identity;
}

async function handleIntake(request: Request) {
  let body: {
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
  try {
    body = await request.json();
  } catch {
    return jsonError("Ungültige Anfrage", 400);
  }

  const resolved = await resolveIdentity(body);
  if ("response" in resolved) {
    return resolved.response;
  }

  const { version, status } = resolved;
  let { identity, parentDocumentId } = resolved;
  identity = await withStripeCustomerId(identity);
  const sessionEmail = await getSessionEmail();
  const loggedInAsBuyer = Boolean(
    sessionEmail && identity.email && emailsEqual(sessionEmail, identity.email),
  );
  const firms = loggedInAsBuyer ? await listEntitiesByEmail(identity.email) : [];
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
  const entity = entityId ? await getOwnedEntity(entityId, identity.email) : null;
  identity = applyEntityToIdentity(identity, entity);

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
    rowForStore = await prepareDurableIntakeRow(
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
    const generated = await generatePdf({
      answers,
      identity,
      documentId,
      version,
      versionMeta,
      versionHistory,
    });
    const storedPdf = await storePdf({
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
    stored = await appendRecord({
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
    await sendDeliveryMail({
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
    await sendReferralAfterDeliveryMail({
      email: identity.email,
      company: identity.company,
      documentId,
      sessionId: identity.stripeSessionId,
    });
  } catch (error) {
    console.error("[intake] referral mail fehlgeschlagen", error);
  }

  const loginMail = identity.email
    ? await deliverLoginLink(identity.email, "/account")
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
  const grant =
    identity.email &&
    identity.stripeSessionId &&
    (!identity.stub || devCheckoutStubAllowed())
      ? { sessionId: identity.stripeSessionId, email: identity.email }
      : undefined;
  return withoutSessionCookie(response, grant);
}

export async function POST(request: Request) {
  try {
    return await handleIntake(request);
  } catch (error) {
    console.error("[intake] POST fehlgeschlagen", error);
    return jsonError("Speichern fehlgeschlagen.", 500, errorDetail(error));
  }
}
