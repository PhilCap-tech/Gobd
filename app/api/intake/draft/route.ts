import { NextResponse } from "next/server";
import { getSessionEmail } from "@/lib/auth";
import {
  clearIntakeDraft,
  draftIsEmpty,
  draftIsNewer,
  loadIntakeDraft,
  normalizeDraftKey,
  saveIntakeDraft,
  type IntakeDraft,
} from "@/lib/intake-draft";
import { resolveCheckoutSession } from "@/lib/stripe";
import type { IntakeAnswers } from "@/lib/types";

export const runtime = "nodejs";

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

function isAnswers(value: unknown): value is IntakeAnswers {
  return Boolean(value && typeof value === "object");
}

async function authorize(input: {
  sessionId?: string;
  email?: string;
  draft?: IntakeDraft | null;
}): Promise<boolean> {
  const sessionEmail = (await getSessionEmail())?.toLowerCase() ?? "";
  const sessionId = input.sessionId?.trim() ?? "";
  const email = (input.email ?? input.draft?.email ?? "").trim().toLowerCase();

  if (sessionEmail && email && sessionEmail === email) return true;
  if (sessionEmail && input.draft?.email?.toLowerCase() === sessionEmail) return true;

  if (sessionId) {
    if (input.draft?.stripeSessionId && input.draft.stripeSessionId === sessionId) return true;
    const resolved = await resolveCheckoutSession(sessionId);
    if (!("error" in resolved)) {
      if (!email || email === resolved.email.toLowerCase()) return true;
      if (sessionEmail && sessionEmail === resolved.email.toLowerCase()) return true;
    }
    // Stub-Sessions ohne Stripe: Session-Id reicht als Besitznachweis.
    if (sessionId.startsWith("mock_") || sessionId.startsWith("cs_test_")) return true;
    if ("error" in resolved && resolved.error !== "not_paid") {
      // missing lookup — still allow same session key for demo
      return true;
    }
  }

  return Boolean(sessionEmail);
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

  const draft = await loadIntakeDraft(draftKey);
  if (!draft || draftIsEmpty(draft)) {
    return NextResponse.json({ draft: null });
  }
  if (!(await authorize({ sessionId: url.searchParams.get("sessionId") ?? undefined, draft }))) {
    return jsonError("Kein Zugriff.", 401);
  }
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

  const existing = await loadIntakeDraft(draftKey);
  if (existing && !draftIsEmpty(existing)) {
    if (!(await authorize({ sessionId: body.sessionId, draft: existing, email: body.email }))) {
      return jsonError("Kein Zugriff.", 401);
    }
    if (draftIsNewer(existing.updatedAt, body.clientUpdatedAt ?? "")) {
      return NextResponse.json(
        { error: "Konflikt: Server-Entwurf ist neuer.", draft: existing, conflict: true },
        { status: 409 },
      );
    }
  } else if (!(await authorize({ sessionId: body.sessionId, email: body.email }))) {
    return jsonError("Kein Zugriff.", 401);
  }

  const sessionEmail = (await getSessionEmail()) ?? "";
  const draft: IntakeDraft = {
    draftKey,
    email: (body.email || sessionEmail || existing?.email || "").trim().toLowerCase(),
    stripeSessionId: body.sessionId?.trim() || existing?.stripeSessionId || "",
    documentId: body.documentId?.trim() || existing?.documentId || "",
    entityId: body.entityId?.trim() || existing?.entityId || "",
    step: Number.isFinite(body.step) ? Number(body.step) : 0,
    answers: body.answers,
    updatedAt: new Date().toISOString(),
  };

  const { backend } = await saveIntakeDraft(draft);
  return NextResponse.json({ ok: true, draft, backend });
}

export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const draftKey = url.searchParams.get("draftKey")?.trim() ?? "";
  if (!draftKey) return jsonError("draftKey fehlt.", 400);
  const existing = await loadIntakeDraft(draftKey);
  if (existing && !(await authorize({ sessionId: url.searchParams.get("sessionId") ?? undefined, draft: existing }))) {
    return jsonError("Kein Zugriff.", 401);
  }
  await clearIntakeDraft(draftKey);
  return NextResponse.json({ ok: true });
}
