import { NextResponse } from "next/server";
import { sessionEmailFromRequest } from "@/lib/auth";
import { BlobStorageError, storeCustomerUpload, uploadAllowed } from "@/lib/blob";
import {
  authorizeUploadSession,
  type CheckoutResolver,
} from "@/lib/checkout-access";
import {
  authorizeDeliveredWrite,
  lookupDeliveredRows,
  type DeliveryLookup,
} from "@/lib/session-write";
import {
  findDocumentById,
  findLatestDocumentByStripeSessionId,
  listDocumentFamily,
} from "@/lib/store";
import { resolveCheckoutSession } from "@/lib/stripe";
import { MODULE } from "@/lib/module/katalog";

export const runtime = "nodejs";

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export type UploadIo = {
  lookup: DeliveryLookup;
  resolveCheckout: CheckoutResolver;
  storeCustomerUpload: typeof storeCustomerUpload;
};

const defaultUploadIo: UploadIo = {
  lookup: {
    findDocumentById,
    listDocumentFamily,
    findLatestDocumentByStripeSessionId,
  },
  resolveCheckout: resolveCheckoutSession,
  storeCustomerUpload,
};

async function assertAccess(
  request: Request,
  input: { sessionId?: string; documentId?: string },
  io: UploadIo,
): Promise<{ ok: true; ownerKey: string } | { ok: false; response: NextResponse }> {
  const sessionEmail = sessionEmailFromRequest(request);
  const sessionId = input.sessionId?.trim() ?? "";
  const documentId = input.documentId?.trim() ?? "";
  const rows = await lookupDeliveredRows({ documentId, sessionId }, io.lookup);

  if (documentId && rows.length === 0) {
    return { ok: false, response: jsonError("Dokument nicht gefunden.", 404) };
  }
  if (rows.length > 0) {
    const write = authorizeDeliveredWrite({ sessionEmail, rows });
    if (!write.ok) {
      return { ok: false, response: jsonError(write.error, write.status) };
    }
    if (write.kind !== "owner") {
      return { ok: false, response: jsonError("Dokument nicht gefunden.", 404) };
    }
    const row = write.row;
    return {
      ok: true,
      ownerKey: row.entityId || row.documentId || write.ownerEmail,
    };
  }

  const upload = await authorizeUploadSession({ sessionEmail, sessionId }, io.resolveCheckout);
  if (!upload.ok) {
    const presented = Boolean(sessionId) || Boolean(sessionEmail);
    return {
      ok: false,
      response: jsonError(
        presented ? "Kein Zugriff." : "Anmeldung oder Checkout-Session erforderlich.",
        upload.status,
      ),
    };
  }
  return { ok: true, ownerKey: upload.ownerKey };
}

export async function postModuleUpload(request: Request, io: UploadIo = defaultUploadIo) {
  const form = await request.formData();
  const file = form.get("file");
  const modulId = String(form.get("modulId") ?? "").trim();
  const sessionId = String(form.get("sessionId") ?? "").trim();
  const documentId = String(form.get("documentId") ?? "").trim();

  if (!MODULE.some((modul) => modul.id === modulId)) {
    return jsonError("Unbekanntes Modul.", 400);
  }
  if (!(file instanceof File)) {
    return jsonError("Datei fehlt.", 400);
  }

  const contentType = file.type || "application/octet-stream";
  const allowed = uploadAllowed(contentType, file.size);
  if (allowed) return jsonError(allowed, 400);

  const access = await assertAccess(request, { sessionId, documentId }, io);
  if (!access.ok) return access.response;

  const buffer = Buffer.from(await file.arrayBuffer());
  try {
    const stored = await io.storeCustomerUpload({
      ownerKey: access.ownerKey,
      modulId,
      filename: file.name || "dokument.pdf",
      contentType,
      buffer,
    });
    return NextResponse.json({
      ok: true,
      uploadUrl: stored.url || stored.pathname,
      uploadName: stored.filename,
      uploadAt: new Date().toISOString(),
      uploadSize: stored.size,
      uploadType: stored.contentType,
      backend: stored.backend,
      pathname: stored.pathname,
    });
  } catch (error) {
    if (error instanceof BlobStorageError) {
      console.error("[upload] fehlgeschlagen", error.errorClass);
      return jsonError("Upload fehlgeschlagen.", 503);
    }
    const message = error instanceof Error ? error.message : "Upload fehlgeschlagen.";
    return jsonError(message, 400);
  }
}

export function POST(request: Request) {
  return postModuleUpload(request);
}
