import { NextResponse } from "next/server";
import { sessionEmailFromRequest } from "@/lib/auth";
import {
  authorizeDraftAccess,
  draftAccessHttpStatus,
  nextStripeSessionId,
  type CheckoutResolver,
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

export type DraftWriteIo = {
  loadIntakeDraft: typeof loadIntakeDraft;
  saveIntakeDraft: typeof saveIntakeDraft;
  clearIntakeDraft: typeof clearIntakeDraft;
  lookup: DeliveryLookup;
  resolveCheckout: CheckoutResolver;
};

const defaultDraftIo: DraftWriteIo = {
  loadIntakeDraft,
  saveIntakeDraft,
  clearIntakeDraft,
  lookup: {
    findDocumentById,
    listDocumentFamily,
    findLatestDocumentByStripeSessionId,
  },
  resolveCheckout: resolveCheckoutSession,
};

function idsFromDraftKey(draftKey: string): {
  documentId?: string;
  areaFromDocumentId?: string;
  sessionId?: string;
} {
  if (draftKey.startsWith("doc:")) return { documentId: draftKey.slice(4) };
  if (draftKey.startsWith("area:")) {
    const body = draftKey.slice("area:".length);
    const split = body.lastIndexOf(":");
    return { areaFromDocumentId: split > 0 ? body.slice(0, split) : body };
  }
  if (draftKey.startsWith("session:")) {
    const body = draftKey.slice("session:".length);
    const split = body.lastIndexOf(":");
    return { sessionId: split > 0 ? body.slice(0, split) : body };
  }
  return {};
}

/** 401/403 bevor ein Entwurf einer gelieferten Fassung gelesen oder geschrieben wird. */
async function deliveredDraftGate(
  request: Request,
  ids: { sessionId?: string; documentId?: string; areaFromDocumentId?: string },
  io: DraftWriteIo,
): Promise<NextResponse | null> {
  const rows = await lookupDeliveredRows(ids, io.lookup);
  if (rows.length === 0) return null;
  const write = authorizeDeliveredWrite({
    sessionEmail: sessionEmailFromRequest(request),
    rows,
  });
  if (!write.ok) return jsonError(write.error, write.status);
  return null;
}

export async function readIntakeDraft(request: Request, io: DraftWriteIo = defaultDraftIo) {
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
    draft = await io.loadIntakeDraft(draftKey);
  } catch (error) {
    const failure = blobStorageResponse(error, "Entwurf konnte nicht geladen werden.");
    if (failure) return failure;
    throw error;
  }
  if (!draft || draftIsEmpty(draft)) {
    return NextResponse.json({ draft: null });
  }
  const fromKey = idsFromDraftKey(draft.draftKey || draftKey);
  const blocked = await deliveredDraftGate(
    request,
    {
      sessionId: url.searchParams.get("sessionId") ?? fromKey.sessionId,
      documentId: draft.documentId || fromKey.documentId,
      areaFromDocumentId: fromKey.areaFromDocumentId,
    },
    io,
  );
  if (blocked) return blocked;
  const access = await authorizeDraftAccess(
    {
      sessionEmail: sessionEmailFromRequest(request),
      sessionId: url.searchParams.get("sessionId") ?? undefined,
      draftKey,
      draft,
    },
    io.resolveCheckout,
  );
  if (!access.ok) return deny(access);
  return NextResponse.json({ draft });
}

export async function putIntakeDraft(request: Request, io: DraftWriteIo = defaultDraftIo) {
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
  const sessionEmail = sessionEmailFromRequest(request);
  if (!body.sessionId?.trim() && !sessionEmail) {
    return jsonError("Kein Zugriff.", 401);
  }
  const fromKey = idsFromDraftKey(draftKey);
  const blocked = await deliveredDraftGate(
    request,
    {
      sessionId: body.sessionId || fromKey.sessionId,
      documentId: body.documentId || fromKey.documentId,
      areaFromDocumentId: body.areaFromDocumentId || fromKey.areaFromDocumentId,
    },
    io,
  );
  if (blocked) return blocked;

  let existing: IntakeDraft | null;
  try {
    existing = await io.loadIntakeDraft(draftKey);
  } catch (error) {
    const failure = blobStorageResponse(error, "Entwurf konnte nicht geladen werden.");
    if (failure) return failure;
    throw error;
  }
  const stored = existing && !draftIsEmpty(existing) ? existing : null;
  const access = await authorizeDraftAccess(
    {
      sessionEmail,
      sessionId: body.sessionId,
      email: body.email,
      draftKey,
      draft: stored,
    },
    io.resolveCheckout,
  );
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
    const { backend } = await io.saveIntakeDraft(draft);
    return NextResponse.json({ ok: true, draft, backend });
  } catch (error) {
    const failure = blobStorageResponse(error, "Entwurf konnte nicht gespeichert werden.");
    if (failure) return failure;
    throw error;
  }
}

export async function deleteIntakeDraft(request: Request, io: DraftWriteIo = defaultDraftIo) {
  const url = new URL(request.url);
  const draftKey = url.searchParams.get("draftKey")?.trim() ?? "";
  if (!draftKey) return jsonError("draftKey fehlt.", 400);
  const fromKey = idsFromDraftKey(draftKey);
  const blocked = await deliveredDraftGate(
    request,
    {
      sessionId: url.searchParams.get("sessionId") ?? fromKey.sessionId,
      documentId: fromKey.documentId,
      areaFromDocumentId: fromKey.areaFromDocumentId,
    },
    io,
  );
  if (blocked) return blocked;

  let existing: IntakeDraft | null;
  try {
    existing = await io.loadIntakeDraft(draftKey);
  } catch (error) {
    const failure = blobStorageResponse(error, "Entwurf konnte nicht geladen werden.");
    if (failure) return failure;
    throw error;
  }
  if (existing && !draftIsEmpty(existing)) {
    const access = await authorizeDraftAccess(
      {
        sessionEmail: sessionEmailFromRequest(request),
        sessionId: url.searchParams.get("sessionId") ?? undefined,
        draftKey,
        draft: existing,
      },
      io.resolveCheckout,
    );
    if (!access.ok) return deny(access);
  }
  try {
    await io.clearIntakeDraft(draftKey);
  } catch (error) {
    const failure = blobStorageResponse(error, "Entwurf konnte nicht gelöscht werden.");
    if (failure) return failure;
    throw error;
  }
  return NextResponse.json({ ok: true });
}

export function GET(request: Request) {
  return readIntakeDraft(request);
}

export function PUT(request: Request) {
  return putIntakeDraft(request);
}

export function DELETE(request: Request) {
  return deleteIntakeDraft(request);
}
