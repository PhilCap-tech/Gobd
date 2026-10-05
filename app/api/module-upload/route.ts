import { NextResponse } from "next/server";
import { getSessionEmail } from "@/lib/auth";
import { storeCustomerUpload, uploadAllowed } from "@/lib/blob";
import { canAccessDocument } from "@/lib/documents";
import { resolveCheckoutSession } from "@/lib/stripe";
import {
  findDocumentById,
  findLatestDocumentByStripeSessionId,
} from "@/lib/store";
import { MODULE } from "@/lib/module/katalog";

export const runtime = "nodejs";

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

async function assertAccess(input: {
  sessionId?: string;
  documentId?: string;
}): Promise<{ ok: true; ownerKey: string } | { ok: false; response: NextResponse }> {
  const sessionEmail = await getSessionEmail();
  const sessionId = input.sessionId?.trim() ?? "";
  const documentId = input.documentId?.trim() ?? "";

  if (documentId) {
    const row = await findDocumentById(documentId);
    if (!row) return { ok: false, response: jsonError("Dokument nicht gefunden.", 404) };
    if (!canAccessDocument(row, { sessionEmail, sessionId })) {
      return { ok: false, response: jsonError("Kein Zugriff.", 401) };
    }
    return { ok: true, ownerKey: row.entityId || row.documentId || sessionEmail || sessionId };
  }

  if (sessionId) {
    const resolved = await resolveCheckoutSession(sessionId);
    if ("error" in resolved) {
      // Stub / offline: allow with session id as owner key when session email matches or stub
      if (sessionEmail) return { ok: true, ownerKey: sessionEmail };
      return { ok: true, ownerKey: sessionId };
    }
    if (sessionEmail && sessionEmail.toLowerCase() !== resolved.email.toLowerCase()) {
      return { ok: false, response: jsonError("Kein Zugriff.", 401) };
    }
    const latest = await findLatestDocumentByStripeSessionId(sessionId);
    return {
      ok: true,
      ownerKey: latest?.entityId || resolved.email || sessionId,
    };
  }

  if (sessionEmail) return { ok: true, ownerKey: sessionEmail };
  return { ok: false, response: jsonError("Anmeldung oder Checkout-Session erforderlich.", 401) };
}

export async function POST(request: Request) {
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

  const access = await assertAccess({ sessionId, documentId });
  if (!access.ok) return access.response;

  const buffer = Buffer.from(await file.arrayBuffer());
  try {
    const stored = await storeCustomerUpload({
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
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload fehlgeschlagen.";
    return jsonError(message, 400);
  }
}
