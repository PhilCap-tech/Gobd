import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { applySessionCookie, getSessionEmail, magicLinkUrl } from "@/lib/auth";
import { storePdf } from "@/lib/blob";
import { generatePdf, type DeliveryPlan } from "@/lib/delivery";
import {
  canAccessDocument,
  documentFamilyId,
  nextVersionNumber,
} from "@/lib/documents";
import { applyEntityToIdentity } from "@/lib/entities";
import { getAppUrl } from "@/lib/env";
import { sendDeliveryMail } from "@/lib/ops";
import {
  appendRecord,
  findLatestDocumentByStripeSessionId,
  findLatestStripeCustomerIdByEmail,
  getOwnedEntity,
  listDocumentFamily,
  listEntitiesByEmail,
  resolveEntityIdForEmail,
} from "@/lib/store";
import { resolveCheckoutSession } from "@/lib/stripe";
import {
  identityFromSheetRow,
  toSheetRow,
  type CheckoutIdentity,
  type IntakeAnswers,
} from "@/lib/types";

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
}): Promise<
  | {
      identity: CheckoutIdentity;
      version: number;
      parentDocumentId: string;
      status: string;
      entityId: string;
    }
  | { response: NextResponse }
> {
  const sourceDocumentId = body.documentId?.trim() ?? "";
  const sessionEmail = await getSessionEmail();

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
      return { response: jsonError("Kein Zugriff.", 401) };
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
    };
  }

  const identity = await resolveCheckoutSession(body.sessionId);
  if ("error" in identity) {
    const message =
      identity.error === "missing"
        ? "Checkout-Session fehlt."
        : identity.error === "not_paid"
          ? "Zahlung noch nicht bestätigt."
          : "Session konnte nicht geprüft werden. Bitte erneut versuchen.";
    return {
      response: NextResponse.json(
        { error: message, reason: identity.error },
        { status: identity.error === "lookup_failed" ? 503 : 401 },
      ),
    };
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
  const requestedEntityId = body.entityId?.trim() || resolved.entityId;
  const entityId = await resolveEntityIdForEmail(identity.email, requestedEntityId);
  if (!parentDocumentId && !entityId) {
    const firms = await listEntitiesByEmail(identity.email);
    if (firms.length > 1) {
      return jsonError("Bitte eine Firma wählen.", 400);
    }
  }
  const entity = entityId ? await getOwnedEntity(entityId, identity.email) : null;
  identity = applyEntityToIdentity(identity, entity);

  if (!isAnswers(body.answers)) {
    return jsonError("Intake unvollständig.", 400);
  }

  const answers = body.answers;
  const documentId = randomUUID();
  if (!parentDocumentId) {
    parentDocumentId = documentId;
  }

  let delivery: DeliveryPlan;
  let pdfUrl = "";

  try {
    const generated = await generatePdf({
      answers,
      identity,
      documentId,
      version,
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
    console.error("[intake] PDF-Erzeugung fehlgeschlagen", error);
    return jsonError("PDF konnte nicht erzeugt werden.", 500, errorDetail(error));
  }

  let stored;
  try {
    stored = await appendRecord(
      toSheetRow({
        identity,
        answers,
        status,
        deliveryStatus: delivery.status,
        documentId,
        parentDocumentId,
        pdfUrl,
        version: String(version),
        entityId,
      }),
    );
  } catch (error) {
    console.error("[intake] appendRecord fehlgeschlagen", error);
    return jsonError("Speichern fehlgeschlagen.", 500, errorDetail(error));
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

  const response = NextResponse.json({
    ok: true,
    store: stored.backend,
    delivery,
    documentId,
    pdfUrl: downloadUrl,
    version,
  });
  if (identity.email) {
    applySessionCookie(response, identity.email);
  }
  return response;
}

export async function POST(request: Request) {
  try {
    return await handleIntake(request);
  } catch (error) {
    console.error("[intake] POST fehlgeschlagen", error);
    return jsonError("Speichern fehlgeschlagen.", 500, errorDetail(error));
  }
}
