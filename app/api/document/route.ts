import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getSessionEmail } from "@/lib/auth";
import { subscriptionWriteDenial } from "@/lib/kuendigung-access";
import { BlobStorageError, blobFailureClass, persistChapterContent, storePdf } from "@/lib/blob";
import { DURABLE_STORE_MESSAGE, intakePersistenceFailure } from "@/lib/intake-payload";
import { generatePdf, type DeliveryPlan } from "@/lib/delivery";
import {
  canAccessDocument,
  documentFamilyId,
  nextVersionNumber,
} from "@/lib/documents";
import {
  normalizeDocumentContent,
  serializeDocumentContent,
} from "@/lib/document-content";
import { applyEntityToIdentity } from "@/lib/entities";
import { getAppUrl } from "@/lib/env";
import { sendDeliveryMail } from "@/lib/ops";
import { isTestEntity } from "@/lib/test-entities";
import {
  appendRecord,
  getOwnedEntity,
  listDocumentFamily,
  prepareDurableIntakeRow,
  resolveEntityIdForEmail,
} from "@/lib/store";
import {
  answersFromSheetRow,
  identityFromSheetRow,
  toSheetRow,
} from "@/lib/types";
import { sheetsOutageResponse } from "@/lib/sheets-http";
import { normalizeVersionChange, toVersionPdfMeta } from "@/lib/versioning";

export const runtime = "nodejs";

function errorDetail(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : "Unbekannter Fehler";
}

function jsonError(error: string, status: number, detail?: string) {
  return NextResponse.json(detail ? { error, detail } : { error }, { status });
}

async function handleDocumentEdit(request: Request) {
  const sessionEmail = await getSessionEmail();
  if (!sessionEmail) {
    return jsonError("Bitte anmelden.", 401);
  }
  const closed = await subscriptionWriteDenial(sessionEmail);
  if (closed) return jsonError(closed, 403);

  let body: {
    documentId?: string;
    cover?: unknown;
    chapters?: unknown;
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

  const sourceDocumentId = body.documentId?.trim() ?? "";
  if (!sourceDocumentId) {
    return jsonError("Dokument fehlt.", 400);
  }

  const content = normalizeDocumentContent({
    cover: body.cover,
    chapters: body.chapters,
  });
  if (!content) {
    return jsonError("Bitte mindestens ein Kapitel mit Text speichern.", 400);
  }

  let chapterContent: string;
  try {
    chapterContent = serializeDocumentContent(content);
  } catch (error) {
    return jsonError(errorDetail(error), 400);
  }

  const family = await listDocumentFamily(sourceDocumentId);
  const source =
    family.find((row) => row.documentId === sourceDocumentId) ?? family.at(-1);
  if (!source) {
    return jsonError("Dokument nicht gefunden.", 404);
  }
  if (!canAccessDocument(source, { sessionEmail })) {
    return jsonError("Kein Zugriff.", 403);
  }

  const sourceIdentity = identityFromSheetRow(source);
  const answers = answersFromSheetRow(source);
  const version = nextVersionNumber(family);
  const change = normalizeVersionChange(body, {
    version,
    defaultChangedBy: sessionEmail,
  });
  if ("error" in change) {
    return jsonError(change.error, 400);
  }
  const versionMeta = toVersionPdfMeta(change);
  const parentDocumentId = documentFamilyId(source);
  const documentId = randomUUID();
  const entityId = await resolveEntityIdForEmail(
    sourceIdentity.email,
    source.entityId,
  );
  const entity = entityId
    ? await getOwnedEntity(entityId, sourceIdentity.email)
    : null;
  const identity = {
    ...applyEntityToIdentity(sourceIdentity, entity),
    entityId: entityId || source.entityId || sourceIdentity.entityId || "",
  };
  const skipTestDelivery = isTestEntity(identity.entityId);
  const status = identity.stub ? "document_edited_stub" : "document_edited";

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
    const outage = sheetsOutageResponse(error);
    if (outage) return outage;
    console.error(
      "[document] dauerhafte Speicherung fehlgeschlagen",
      error instanceof Error ? error.name : "error",
    );
    const persistence = intakePersistenceFailure(error);
    if (persistence) return jsonError(persistence.error, persistence.status);
    return jsonError(DURABLE_STORE_MESSAGE, 503);
  }

  let delivery: DeliveryPlan;
  let pdfUrl = "";

  if (skipTestDelivery) {
    console.info("[document] Testfirma: PDF und Liefermail übersprungen");
    delivery = {
      status: "ready",
      chapters: [],
      openItems: [],
      pdf: null,
    };
  } else {
    try {
      const generated = await generatePdf({
        answers,
        identity,
        documentId,
        version,
        content,
        versionMeta,
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
      console.error("[document] PDF-Erzeugung fehlgeschlagen", blobFailureClass(error));
      if (error instanceof BlobStorageError) {
        return jsonError("PDF konnte nicht gespeichert werden.", 503);
      }
      return jsonError("PDF konnte nicht erzeugt werden.", 500, errorDetail(error));
    }
  }

  try {
    chapterContent = await persistChapterContent({
      familyId: parentDocumentId,
      documentId,
      version,
      json: chapterContent,
    });
  } catch (error) {
    console.error("[document] Kapiteltext-Ablage fehlgeschlagen", blobFailureClass(error));
    if (error instanceof BlobStorageError) {
      return jsonError("Kapiteltext konnte nicht gespeichert werden.", 503);
    }
    return jsonError(errorDetail(error), 400);
  }

  let stored;
  try {
    stored = await appendRecord({
      ...rowForStore,
      pdfUrl,
      deliveryStatus: skipTestDelivery ? "" : delivery.status,
      chapterContent,
    });
  } catch (error) {
    const outage = sheetsOutageResponse(error);
    if (outage) return outage;
    console.error(
      "[document] appendRecord fehlgeschlagen",
      error instanceof Error ? error.name : "error",
    );
    const persistence = intakePersistenceFailure(error);
    if (persistence) return jsonError(persistence.error, persistence.status);
    return jsonError(DURABLE_STORE_MESSAGE, 503);
  }

  const appUrl = getAppUrl();
  const downloadUrl = `${appUrl}/api/docs/${documentId}/download`;
  const successUrl = `${appUrl}/account`;

  if (!skipTestDelivery) {
    try {
      await sendDeliveryMail({
        email: identity.email,
        company: identity.company,
        downloadUrl,
        successUrl,
        documentId,
        version,
        entityId: identity.entityId,
      });
    } catch (error) {
      console.error("[document] delivery mail fehlgeschlagen", error);
    }
  }

  return NextResponse.json({
    ok: true,
    store: stored.backend,
    delivery,
    documentId,
    pdfUrl: `/api/docs/${documentId}/download`,
    version,
  });
}

export async function POST(request: Request) {
  try {
    return await handleDocumentEdit(request);
  } catch (error) {
    const outage = sheetsOutageResponse(error);
    if (outage) return outage;
    console.error("[document] POST fehlgeschlagen", error);
    return jsonError("Speichern fehlgeschlagen.", 500, errorDetail(error));
  }
}
