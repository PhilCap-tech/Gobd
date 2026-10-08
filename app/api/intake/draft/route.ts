import { NextResponse } from "next/server";
import { getSessionEmail } from "@/lib/auth";
import {
  authorizeDraftAccess,
  draftAccessHttpStatus,
  nextStripeSessionId,
} from "@/lib/checkout-access";
import {
  clearIntakeDraft,
  draftIsEmpty,
  draftRevision,
  incomingDraftWins,
  IntakeDraftStorageError,
  loadIntakeDraft,
  normalizeDraftKey,
  parseDraftVersionChange,
  saveIntakeDraft,
  type IntakeDraft,
} from "@/lib/intake-draft";
import { normalizeIntakeAnswers } from "@/lib/intake-present";
import type { IntakeAnswers } from "@/lib/types";

export const runtime = "nodejs";

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

function blobStorageResponse(error: unknown, message: string): NextResponse | null {
  if (!(error instanceof IntakeDraftStorageError)) return null;
  return NextResponse.json({ error: message, backend: "blob" }, { status: 503 });
}

function isAnswers(value: unknown): value is IntakeAnswers {
  return Boolean(value && typeof value === "object");
}

function deny(access: { ok: false; status: 401 | 403 }) {
  return jsonError("Kein Zugriff.", draftAccessHttpStatus(access));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const draftKey =
    url.searchParams.get("draftKey")?.trim() ||
    normalizeDraftKey({
      sessionId: url.searchParams.get("sessionId") ?? undefined,
      documentId: url.searchParams.get("documentId") ?? undefined,
      areaFromDocumentId: url.searchParams.get("areaFromDocumentId") ?? undefined,
      email: url.searchParams.get("email") ?? undefined,
      entityId: url.searchParams.get("entityId") ?? undefined,
      modus: url.searchParams.get("modus") ?? undefined,
    });
  if (!draftKey) return jsonError("draftKey fehlt.", 400);

  let draft: IntakeDraft | null;
  try {
    draft = await loadIntakeDraft(draftKey);
  } catch (error) {
    const failure = blobStorageResponse(error, "Entwurf konnte nicht geladen werden.");
    if (failure) return failure;
    throw error;
  }
  if (!draft || draftIsEmpty(draft)) {
    return NextResponse.json({ draft: null });
  }
  const access = await authorizeDraftAccess({
    sessionEmail: await getSessionEmail(),
    sessionId: url.searchParams.get("sessionId") ?? undefined,
    draftKey,
    draft,
  });
  if (!access.ok) return deny(access);
  return NextResponse.json({ draft });
}

export async function PUT(request: Request) {
  let body: {
    draftKey?: string;
    sessionId?: string;
    documentId?: string;
    areaFromDocumentId?: string;
    email?: string;
    entityId?: string;
    modus?: string;
    step?: number;
    answers?: unknown;
    clientUpdatedAt?: string;
    revision?: number;
    change?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return jsonError("Ungültige Anfrage.", 400);
  }

  const draftKey =
    body.draftKey?.trim() ||
    normalizeDraftKey({
      sessionId: body.sessionId,
      documentId: body.documentId,
      areaFromDocumentId: body.areaFromDocumentId,
      email: body.email,
      entityId: body.entityId,
      modus: body.modus,
    });
  if (!draftKey) return jsonError("draftKey fehlt.", 400);
  if (!isAnswers(body.answers)) return jsonError("answers fehlen.", 400);

  // 401 before any blob read. A storage outage must not turn "no session" into 503.
  const sessionEmail = await getSessionEmail();
  if (!body.sessionId?.trim() && !sessionEmail) {
    return jsonError("Kein Zugriff.", 401);
  }

  let existing: IntakeDraft | null;
  try {
    existing = await loadIntakeDraft(draftKey);
  } catch (error) {
    const failure = blobStorageResponse(error, "Entwurf konnte nicht geladen werden.");
    if (failure) return failure;
    throw error;
  }
  const stored = existing && !draftIsEmpty(existing) ? existing : null;
  const access = await authorizeDraftAccess({
    sessionEmail,
    sessionId: body.sessionId,
    email: body.email,
    draftKey,
    draft: stored,
  });
  if (!access.ok) return deny(access);

  if (
    stored &&
    !incomingDraftWins(
      { revision: body.revision, clientUpdatedAt: body.clientUpdatedAt },
      stored,
    )
  ) {
    return NextResponse.json(
      { error: "Konflikt: Server-Entwurf ist neuer.", draft: stored, conflict: true },
      { status: 409 },
    );
  }

  const draft: IntakeDraft = {
    draftKey,
    email: access.ownerEmail || stored?.email || "",
    stripeSessionId: nextStripeSessionId(body.sessionId, stored?.stripeSessionId),
    documentId: body.documentId?.trim() || stored?.documentId || "",
    entityId: body.entityId?.trim() || stored?.entityId || "",
    step: Number.isFinite(body.step) ? Number(body.step) : 0,
    answers: normalizeIntakeAnswers(body.answers),
    revision: Math.max(draftRevision({ revision: body.revision }), draftRevision(stored)),
    updatedAt: new Date().toISOString(),
    change: parseDraftVersionChange(body.change) ?? stored?.change,
  };

  try {
    const { backend } = await saveIntakeDraft(draft);
    return NextResponse.json({ ok: true, draft, backend });
  } catch (error) {
    const failure = blobStorageResponse(error, "Entwurf konnte nicht gespeichert werden.");
    if (failure) return failure;
    throw error;
  }
}

export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const draftKey = url.searchParams.get("draftKey")?.trim() ?? "";
  if (!draftKey) return jsonError("draftKey fehlt.", 400);

  let existing: IntakeDraft | null;
  try {
    existing = await loadIntakeDraft(draftKey);
  } catch (error) {
    const failure = blobStorageResponse(error, "Entwurf konnte nicht geladen werden.");
    if (failure) return failure;
    throw error;
  }
  if (existing && !draftIsEmpty(existing)) {
    const access = await authorizeDraftAccess({
      sessionEmail: await getSessionEmail(),
      sessionId: url.searchParams.get("sessionId") ?? undefined,
      draftKey,
      draft: existing,
    });
    if (!access.ok) return deny(access);
  }
  try {
    await clearIntakeDraft(draftKey);
  } catch (error) {
    const failure = blobStorageResponse(error, "Entwurf konnte nicht gelöscht werden.");
    if (failure) return failure;
    throw error;
  }
  return NextResponse.json({ ok: true });
}
