import { NextResponse } from "next/server";
import { sessionEmailFromRequest } from "@/lib/auth";
import { checkoutSessionGrant } from "@/lib/checkout-session-grant";
import { subscriptionWriteDenial } from "@/lib/kuendigung-access";
import {
  authorizeDraftAccess,
  draftAccessHttpStatus,
  emailFromDraftKey,
  nextStripeSessionId,
  sessionOwnerDenial,
  stubCheckoutMayAuthorize,
  type CheckoutResolver,
} from "@/lib/checkout-access";
import {
  clearIntakeDraft,
  draftIsEmpty,
  draftRevision,
  IntakeDraftStorageError,
  loadIntakeDraft,
  normalizeDraftKey,
  parseDraftVersionChange,
  saveIntakeDraft,
  type IntakeDraft,
} from "@/lib/intake-draft";
import { forgetOpenDraft, listOpenDraftsForEmail, rememberOpenDraft } from "@/lib/open-drafts";
import { isPricingV2 } from "@/lib/pricing-model";
import { isDraftFormClosed, normalizeFormId } from "@/lib/draft-closed";
import { normalizeIntakeAnswers, stripEmptyIntakeCards } from "@/lib/intake-present";
import { noteDraftConflict, noteDraftSaved } from "@/lib/audit-record";
import { MODULE_OUTSIDE_MESSAGE } from "@/lib/membership-copy";
import {
  allowedModuleIds,
  answersStayInAssignment,
  changedCatalogModuleIds,
  entityIdFromDraftKey,
  grantMemberDraft,
  revisionDecision,
  storedDraftMatchesMember,
  type MemberDraftGrant,
} from "@/lib/membership-draft";
import { findActiveMembership } from "@/lib/membership-store";
import { ensureGesamt } from "@/lib/module/status";
import {
  authorizeDeliveredWrite,
  lookupDeliveredRows,
  withSessionWriteLock,
  type DeliveryLookup,
} from "@/lib/session-write";
import {
  findDocumentById,
  findLatestDocumentByStripeSessionId,
  listDocumentFamily,
} from "@/lib/store";
import { sheetsOutageResponse } from "@/lib/sheets-http";
import { isSheetsOutage, runWithSheetsRoute } from "@/lib/sheets-outage";
import { resolveCheckoutSession } from "@/lib/stripe";
import { emailsEqual, emptyAnswers, type IntakeAnswers } from "@/lib/types";

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

type MemberResolve =
  | { kind: "skip" }
  | { kind: "deny"; response: NextResponse }
  | { kind: "allow"; grant: MemberDraftGrant };

function documentIdFromDraftKey(draftKey: string): string {
  if (draftKey.startsWith("doc:")) return draftKey.slice("doc:".length).trim();
  if (draftKey.startsWith("area:")) {
    const body = draftKey.slice("area:".length);
    const split = body.lastIndexOf(":");
    return (split > 0 ? body.slice(0, split) : body).trim();
  }
  return "";
}

async function resolveMemberDraft(
  io: DraftWriteIo,
  input: { sessionEmail: string | null; draftKey: string; entityId?: string },
): Promise<MemberResolve> {
  if (!io.findActiveMembership || !input.sessionEmail) return { kind: "skip" };
  let entityId = input.entityId?.trim() || entityIdFromDraftKey(input.draftKey);
  let document: { email: string; entityId: string } | null = null;
  const documentId = documentIdFromDraftKey(input.draftKey);
  if (documentId) {
    try {
      const row = await io.lookup.findDocumentById(documentId);
      if (row?.documentId) {
        document = { email: row.email, entityId: row.entityId };
        if (!entityId) entityId = row.entityId;
      }
    } catch (error) {
      const outage = sheetsOutageResponse(error);
      if (outage) return { kind: "deny", response: outage };
      throw error;
    }
  }
  // Owner of the stored document (row from the store, session from the cookie)
  // and the company the client names is the one on that row: not a member
  // grant, so no membership read. Any doubt (no company on the row, none or
  // another one in the request) keeps the fresh membership path below.
  const requestedEntity = input.entityId?.trim() ?? "";
  if (
    document &&
    emailsEqual(document.email, input.sessionEmail) &&
    document.entityId.trim() !== "" &&
    requestedEntity === document.entityId.trim()
  ) {
    return { kind: "skip" };
  }
  if (!entityId) return { kind: "skip" };
  let membership: Awaited<ReturnType<typeof findActiveMembership>>;
  try {
    membership = await io.findActiveMembership(input.sessionEmail, entityId);
  } catch (error) {
    const outage = sheetsOutageResponse(error);
    if (outage) return { kind: "deny", response: outage };
    throw error;
  }
  const decision = grantMemberDraft({
    sessionEmail: input.sessionEmail,
    draftKey: input.draftKey,
    entityId,
    membership,
    document,
  });
  if (decision.kind === "deny") return { kind: "deny", response: jsonError("Kein Zugriff.", 403) };
  if (decision.kind === "skip") return { kind: "skip" };
  return { kind: "allow", grant: decision.grant };
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

/**
 * Same content and links as stored: nothing to write (only timestamp and
 * revision would move). Runs after the revision check, so a stale save is
 * still a 409.
 */
function sameDraftContent(stored: IntakeDraft, next: IntakeDraft): boolean {
  return (
    stored.email === next.email &&
    (stored.stripeSessionId ?? "") === (next.stripeSessionId ?? "") &&
    (stored.documentId ?? "") === (next.documentId ?? "") &&
    stableJson(normalizeIntakeAnswers(stored.answers)) === stableJson(next.answers) &&
    Number(stored.step ?? 0) === Number(next.step ?? 0) &&
    stableJson(stored.change ?? null) === stableJson(next.change ?? null) &&
    (stored.entityId ?? "") === (next.entityId ?? "") &&
    (stored.pricingModel ?? "") === (next.pricingModel ?? "")
  );
}

function unchangedResponse(stored: IntakeDraft) {
  return NextResponse.json({ ok: true, draft: stored, unchanged: true });
}

function conflictResponse(stored: IntakeDraft, kind: "stale" | "other") {
  const who = stored.updatedBy?.trim() ?? "";
  const error =
    kind === "other"
      ? `Konflikt: Zwischenzeitlich gespeichert von ${who}.`
      : "Konflikt: Server-Entwurf ist neuer.";
  return NextResponse.json(
    {
      error,
      conflict: true,
      updatedBy: who,
      updatedAt: stored.updatedAt,
      draft: stored,
    },
    { status: 409 },
  );
}

export type DraftWriteIo = {
  loadIntakeDraft: typeof loadIntakeDraft;
  saveIntakeDraft: typeof saveIntakeDraft;
  clearIntakeDraft: typeof clearIntakeDraft;
  rememberOpenDraft?: typeof rememberOpenDraft;
  forgetOpenDraft?: typeof forgetOpenDraft;
  lookup: DeliveryLookup;
  resolveCheckout: CheckoutResolver;
  /** Frische Mitgliedschaft. Fehlt sie, bleibt der Entwurf beim Inhaber. */
  findActiveMembership?: typeof findActiveMembership;
  /** Abgesendete Seite (draftKey + formId). Optional für bestehende Test-Doubles. */
  isDraftFormClosed?: typeof isDraftFormClosed;
  /** Offene Entwürfe der Mail (Limit unbezahlter Entwürfe im neuen Modell). */
  listOpenDrafts?: (email: string) => Promise<IntakeDraft[]>;
};

/** Neues Modell: Obergrenze je Entwurf (JSON der Antworten), sonst 413. */
const MAX_DRAFT_ANSWER_BYTES = 512 * 1024;
/** Neues Modell, Login zuerst: höchstens so viele offene unbezahlte Entwürfe je E-Mail. */
const MAX_OPEN_UNPAID_DRAFTS = 3;
const DRAFT_TOO_LARGE_MESSAGE = "Der Entwurf ist zu groß. Bitte kürzen Sie die Freitexte.";
const DRAFT_LIMIT_MESSAGE =
  "Sie haben bereits 3 offene Entwürfe. Bitte schließen Sie zuerst einen davon ab.";

/** Unbezahlter Login-Entwurf (email:-Schlüssel, keine Checkout-Session). */
function isUnpaidLoginDraft(draft: Pick<IntakeDraft, "draftKey" | "stripeSessionId">): boolean {
  return draft.draftKey.startsWith("email:") && !draft.stripeSessionId?.trim();
}

const defaultDraftIo: DraftWriteIo = {
  loadIntakeDraft,
  saveIntakeDraft,
  clearIntakeDraft,
  rememberOpenDraft,
  forgetOpenDraft,
  isDraftFormClosed,
  lookup: {
    findDocumentById,
    listDocumentFamily,
    findLatestDocumentByStripeSessionId,
  },
  resolveCheckout: resolveCheckoutSession,
  findActiveMembership,
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
    sessionEmail: await sessionEmailFromRequest(request),
    rows,
  });
  if (!write.ok) return jsonError(write.error, write.status);
  return null;
}

function boundDraftEmail(
  draft: { email?: string; stripeSessionId?: string; draftKey?: string } | null | undefined,
  sessionId: string,
): string {
  if (!draft) return "";
  const stored = draft.stripeSessionId?.trim() ?? "";
  const fromKey = idsFromDraftKey(draft.draftKey ?? "").sessionId ?? "";
  if (stored !== sessionId && fromKey !== sessionId) return "";
  const email = draft.email?.trim().toLowerCase() ?? "";
  return email.includes("@") ? email : "";
}

/**
 * Owner of a checkout session. A missing grant blob is not open access:
 * the document, the stored Entwurf, then the checkout customer are the fallback.
 */
async function ownerForCheckoutSession(
  sessionId: string,
  io: DraftWriteIo,
  draft: { email?: string; stripeSessionId?: string; draftKey?: string } | null | undefined,
): Promise<string> {
  const grant = await checkoutSessionGrant(sessionId);
  if (grant?.email) return grant.email.trim().toLowerCase();
  try {
    const row = await io.lookup.findLatestDocumentByStripeSessionId(sessionId);
    const fromRow = row?.email?.trim().toLowerCase() ?? "";
    if (fromRow.includes("@")) return fromRow;
  } catch (error) {
    if (isSheetsOutage(error)) throw error;
    console.error(
      "[draft] Inhaber zur Session nicht lesbar",
      error instanceof Error ? error.name : "error",
    );
  }
  const fromDraft = boundDraftEmail(draft, sessionId);
  if (fromDraft) return fromDraft;
  try {
    const resolved = await io.resolveCheckout(sessionId);
    if (resolved && !("error" in resolved)) {
      if (resolved.stub && !stubCheckoutMayAuthorize()) return "";
      const email = (resolved.email ?? "").trim().toLowerCase();
      if (email.includes("@")) return email;
    }
  } catch (error) {
    console.error(
      "[draft] Checkout-Inhaber nicht lesbar",
      error instanceof Error ? error.name : "error",
    );
  }
  return "";
}

/**
 * sessionId is not a bearer. gobd_session must match the checkout owner,
 * whether or not a grant blob exists. No session → 401, someone else → 403.
 */
async function sessionOwnerGate(
  request: Request,
  sessionIds: Array<string | undefined | null>,
  io: DraftWriteIo,
  draft?: { email?: string; stripeSessionId?: string; draftKey?: string } | null,
): Promise<NextResponse | null> {
  const ids = [
    ...new Set(sessionIds.map((value) => value?.trim() ?? "").filter((value) => value.length > 0)),
  ];
  if (ids.length === 0) return null;
  const sessionEmail = await sessionEmailFromRequest(request);
  if (!sessionEmail) return jsonError("Kein Zugriff.", 401);
  for (const id of ids) {
    const owner = await ownerForCheckoutSession(id, io, draft);
    const denial = sessionOwnerDenial(sessionEmail, owner);
    if (denial) return jsonError("Kein Zugriff.", denial);
  }
  return null;
}

async function readIntakeDraftBody(request: Request, io: DraftWriteIo = defaultDraftIo) {
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

  const sessionEmail = await sessionEmailFromRequest(request);
  const member = await resolveMemberDraft(io, {
    sessionEmail,
    draftKey,
    entityId: url.searchParams.get("entityId") ?? undefined,
  });
  if (member.kind === "deny") return member.response;
  const readKey = member.kind === "allow" ? member.grant.draftKey : draftKey;

  let draft: IntakeDraft | null;
  try {
    draft = await io.loadIntakeDraft(readKey);
  } catch (error) {
    const failure = blobStorageResponse(error, "Entwurf konnte nicht geladen werden.");
    if (failure) return failure;
    throw error;
  }
  if (member.kind === "allow") {
    if (!storedDraftMatchesMember(draft, member.grant)) return jsonError("Kein Zugriff.", 403);
    if (!draft || draftIsEmpty(draft)) return NextResponse.json({ draft: null });
    return NextResponse.json({
      draft: { ...draft, answers: stripEmptyIntakeCards(draft.answers) },
    });
  }
  const fromKey = idsFromDraftKey(draft?.draftKey || draftKey);
  const owned = await sessionOwnerGate(
    request,
    [
      url.searchParams.get("sessionId") ?? undefined,
      fromKey.sessionId,
      draft?.stripeSessionId,
    ],
    io,
    draft,
  );
  if (owned) return owned;
  if (!draft || draftIsEmpty(draft)) {
    return NextResponse.json({ draft: null });
  }
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
      sessionEmail: await sessionEmailFromRequest(request),
      sessionId: url.searchParams.get("sessionId") ?? undefined,
      draftKey,
      draft,
    },
    io.resolveCheckout,
  );
  if (!access.ok) return deny(access);
  return NextResponse.json({
    draft: { ...draft, answers: stripEmptyIntakeCards(draft.answers) },
  });
}

async function saveMemberDraft(
  io: DraftWriteIo,
  body: {
    step?: number;
    answers?: unknown;
    clientUpdatedAt?: string;
    revision?: number;
  },
  grant: MemberDraftGrant,
  sessionEmail: string,
  formId = "",
) {
  if (!isAnswers(body.answers)) return jsonError("answers fehlen.", 400);
  const incoming = body.answers;
  return withSessionWriteLock(`draft:${grant.draftKey}`, async () => {
    let existing: IntakeDraft | null;
    try {
      existing = await io.loadIntakeDraft(grant.draftKey);
    } catch (error) {
      const failure = blobStorageResponse(error, "Entwurf konnte nicht geladen werden.");
      if (failure) return failure;
      throw error;
    }
    const stored = existing && !draftIsEmpty(existing) ? existing : null;
    if (!storedDraftMatchesMember(stored, grant)) return jsonError("Kein Zugriff.", 403);
    if (formId && (await (io.isDraftFormClosed ?? isDraftFormClosed)(grant.draftKey, formId))) {
      return NextResponse.json({ ok: true, closed: true });
    }
    const verdict = revisionDecision({
      sessionEmail,
      incomingRevision: body.revision,
      clientUpdatedAt: body.clientUpdatedAt,
      stored,
    });
    if (verdict !== "ok" && stored) {
      const attempted = normalizeIntakeAnswers(incoming);
      await noteDraftConflict({
        actorEmail: sessionEmail,
        actorRole: "member",
        ownerEmail: grant.ownerEmail,
        entityId: grant.entityId,
        moduleIds: changedCatalogModuleIds(normalizeIntakeAnswers(stored.answers), attempted),
        draftRevision: draftRevision(stored),
      });
      return conflictResponse(stored, verdict);
    }
    const allowed = allowedModuleIds(grant.moduleIds, stored?.answers ?? null);
    const after = normalizeIntakeAnswers(incoming);
    const before = stored ? normalizeIntakeAnswers(stored.answers) : ensureGesamt(emptyAnswers());
    if (!answersStayInAssignment(before, after, allowed)) {
      return jsonError(MODULE_OUTSIDE_MESSAGE, 403);
    }
    const draft: IntakeDraft = {
      draftKey: grant.draftKey,
      email: grant.ownerEmail,
      stripeSessionId: stored?.stripeSessionId || "",
      documentId: stored?.documentId || (grant.draftKey.startsWith("doc:") ? grant.draftKey.slice(4) : ""),
      entityId: grant.entityId,
      step: Number.isFinite(body.step) ? Number(body.step) : (stored?.step ?? 0),
      answers: after,
      revision: Math.max(draftRevision({ revision: body.revision }), draftRevision(stored)),
      updatedAt: new Date().toISOString(),
      updatedBy: sessionEmail,
      change: stored?.change,
    };
    if (stored && sameDraftContent(stored, draft)) return unchangedResponse(stored);
    try {
      const { backend } = await io.saveIntakeDraft(draft);
      try {
        await (io.rememberOpenDraft ?? rememberOpenDraft)(draft);
      } catch (error) {
        console.error(
          "[draft] Index schreiben fehlgeschlagen",
          error instanceof Error ? error.name : "error",
        );
      }
      await noteDraftSaved({
        actorEmail: sessionEmail,
        actorRole: "member",
        ownerEmail: grant.ownerEmail,
        entityId: grant.entityId,
        moduleIds: changedCatalogModuleIds(before, after),
        draftRevision: draftRevision(draft),
      });
      return NextResponse.json({ ok: true, draft, backend });
    } catch (error) {
      const failure = blobStorageResponse(error, "Entwurf konnte nicht gespeichert werden.");
      if (failure) return failure;
      throw error;
    }
  });
}

async function putIntakeDraftBody(request: Request, io: DraftWriteIo = defaultDraftIo) {
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
    formId?: string;
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
  // A delivered document keeps its own 401 copy, so that gate runs first.
  const sessionEmail = await sessionEmailFromRequest(request);
  const fromKey = idsFromDraftKey(draftKey);
  if (!body.sessionId?.trim() && !fromKey.sessionId && !sessionEmail) {
    return jsonError("Kein Zugriff.", 401);
  }
  const formId = normalizeFormId(body.formId);
  const closed = await subscriptionWriteDenial(sessionEmail);
  if (closed) return jsonError(closed, 403);
  const member = await resolveMemberDraft(io, {
    sessionEmail,
    draftKey,
    entityId: body.entityId,
  });
  if (member.kind === "deny") return member.response;
  if (member.kind === "allow") {
    return saveMemberDraft(io, body, member.grant, sessionEmail ?? "", formId);
  }
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
  if (!sessionEmail && (body.sessionId?.trim() || fromKey.sessionId)) {
    return jsonError("Kein Zugriff.", 401);
  }

  let existing: IntakeDraft | null;
  try {
    existing = await io.loadIntakeDraft(draftKey);
  } catch (error) {
    const failure = blobStorageResponse(error, "Entwurf konnte nicht geladen werden.");
    if (failure) return failure;
    throw error;
  }
  const stored = existing && !draftIsEmpty(existing) ? existing : null;
  const owned = await sessionOwnerGate(
    request,
    [body.sessionId, fromKey.sessionId, stored?.stripeSessionId],
    io,
    stored,
  );
  if (owned) return owned;
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
  // Only after the access check: an unauthenticated request gets 401/403, not "closed".
  if (formId && (await (io.isDraftFormClosed ?? isDraftFormClosed)(draftKey, formId))) {
    // This page already submitted. A late save must not restore the Entwurf.
    return NextResponse.json({ ok: true, closed: true });
  }

  // Neues Preismodell (28.10.): Größe je Entwurf und höchstens 3 offene unbezahlte Login-Entwürfe.
  const newModel = isPricingV2();
  if (newModel && Buffer.byteLength(JSON.stringify(body.answers), "utf8") > MAX_DRAFT_ANSWER_BYTES) {
    return jsonError(DRAFT_TOO_LARGE_MESSAGE, 413);
  }
  if (newModel && !stored && draftKey.startsWith("email:") && sessionEmail) {
    const open = await (io.listOpenDrafts ?? listOpenDraftsForEmail)(sessionEmail);
    const unpaid = open.filter((d) => isUnpaidLoginDraft(d) && d.draftKey !== draftKey);
    if (unpaid.length >= MAX_OPEN_UNPAID_DRAFTS) return jsonError(DRAFT_LIMIT_MESSAGE, 429);
  }

  const verdict = revisionDecision({
    sessionEmail: sessionEmail ?? "",
    incomingRevision: body.revision,
    clientUpdatedAt: body.clientUpdatedAt,
    stored,
  });
  if (verdict !== "ok" && stored) {
    const auditEntity = (body.entityId?.trim() || stored.entityId || entityIdFromDraftKey(draftKey)).trim();
    if (sessionEmail && auditEntity) {
      await noteDraftConflict({
        actorEmail: sessionEmail,
        actorRole: "owner",
        ownerEmail: access.ownerEmail || sessionEmail,
        entityId: auditEntity,
        moduleIds: changedCatalogModuleIds(
          normalizeIntakeAnswers(stored.answers),
          normalizeIntakeAnswers(body.answers),
        ),
        draftRevision: draftRevision(stored),
      });
    }
    return conflictResponse(stored, verdict);
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
    updatedBy: sessionEmail || stored?.updatedBy || "",
    change: parseDraftVersionChange(body.change) ?? stored?.change,
    ...(newModel ? { pricingModel: "v3" } : stored?.pricingModel ? { pricingModel: stored.pricingModel } : {}),
  };
  if (stored && sameDraftContent(stored, draft)) return unchangedResponse(stored);
  // Checked again right before the write: the submit may have landed while
  // this request waited for Sheets.
  if (formId && (await (io.isDraftFormClosed ?? isDraftFormClosed)(draftKey, formId))) {
    return NextResponse.json({ ok: true, closed: true });
  }

  try {
    const { backend } = await io.saveIntakeDraft(draft);
    try {
      await (io.rememberOpenDraft ?? rememberOpenDraft)(draft);
    } catch (error) {
      console.error(
        "[draft] Index schreiben fehlgeschlagen",
        error instanceof Error ? error.name : "error",
      );
    }
    const auditEntity = (draft.entityId || entityIdFromDraftKey(draftKey)).trim();
    if (sessionEmail && auditEntity) {
      const before = stored ? normalizeIntakeAnswers(stored.answers) : ensureGesamt(emptyAnswers());
      await noteDraftSaved({
        actorEmail: sessionEmail,
        actorRole: "owner",
        ownerEmail: draft.email || sessionEmail,
        entityId: auditEntity,
        moduleIds: changedCatalogModuleIds(before, draft.answers),
        draftRevision: draftRevision(draft),
      });
    }
    return NextResponse.json({ ok: true, draft, backend });
  } catch (error) {
    const failure = blobStorageResponse(error, "Entwurf konnte nicht gespeichert werden.");
    if (failure) return failure;
    throw error;
  }
}

function sessionCandidateFromDraftKey(draftKey: string): string {
  const parsed = idsFromDraftKey(draftKey).sessionId?.trim() ?? "";
  if (parsed) return parsed;
  if (
    draftKey.startsWith("doc:") ||
    draftKey.startsWith("area:") ||
    draftKey.startsWith("email:")
  ) {
    return "";
  }
  return draftKey;
}

/**
 * DELETE may remove only an Entwurf the caller owns.
 * A missing or foreign key is not deleted. Submitted documents are untouched.
 */
async function draftDeleteDenial(
  sessionEmail: string,
  draftKey: string,
  existing: IntakeDraft | null,
  io: DraftWriteIo,
): Promise<403 | null> {
  const ownerOnDraft = existing?.email?.trim() ?? "";
  if (ownerOnDraft && !emailsEqual(ownerOnDraft, sessionEmail)) return 403;
  const keyOwner = emailFromDraftKey(draftKey);
  if (keyOwner && !emailsEqual(keyOwner, sessionEmail)) return 403;
  if (keyOwner && emailsEqual(keyOwner, sessionEmail)) return null;

  const fromKey = idsFromDraftKey(draftKey);
  const documentId = fromKey.documentId || fromKey.areaFromDocumentId || "";
  if (documentId) {
    const row = await io.lookup.findDocumentById(documentId);
    if (!row || !emailsEqual(row.email, sessionEmail)) return 403;
    return null;
  }

  const sessionId = sessionCandidateFromDraftKey(draftKey);
  if (!sessionId) return ownerOnDraft ? null : 403;
  const owner = await ownerForCheckoutSession(sessionId, io, existing);
  if (!owner || !emailsEqual(owner, sessionEmail)) return 403;
  return null;
}

async function deleteIntakeDraftBody(request: Request, io: DraftWriteIo = defaultDraftIo) {
  const url = new URL(request.url);
  const draftKey = url.searchParams.get("draftKey")?.trim() ?? "";
  if (!draftKey) return jsonError("draftKey fehlt.", 400);
  const sessionEmail = await sessionEmailFromRequest(request);
  if (!sessionEmail) return jsonError("Kein Zugriff.", 401);
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
  const sessionIds = [
    url.searchParams.get("sessionId") ?? undefined,
    fromKey.sessionId,
  ];

  let existing: IntakeDraft | null;
  try {
    existing = await io.loadIntakeDraft(draftKey);
  } catch (error) {
    const failure = blobStorageResponse(error, "Entwurf konnte nicht geladen werden.");
    if (failure) return failure;
    throw error;
  }
  if (existing && !draftIsEmpty(existing)) {
    const owned = await sessionOwnerGate(
      request,
      [...sessionIds, existing.stripeSessionId],
      io,
      existing,
    );
    if (owned) return owned;
    const access = await authorizeDraftAccess(
      {
        sessionEmail: await sessionEmailFromRequest(request),
        sessionId: url.searchParams.get("sessionId") ?? undefined,
        draftKey,
        draft: existing,
      },
      io.resolveCheckout,
    );
    if (!access.ok) return deny(access);
  } else {
    const access = await authorizeDraftAccess(
      {
        sessionEmail,
        sessionId: url.searchParams.get("sessionId") ?? fromKey.sessionId,
        draftKey,
        draft: existing,
      },
      io.resolveCheckout,
    );
    if (!access.ok) return deny(access);
  }
  const denial = await draftDeleteDenial(sessionEmail, draftKey, existing, io);
  if (denial) return jsonError("Kein Zugriff.", denial);
  try {
    await io.clearIntakeDraft(draftKey);
  } catch (error) {
    const failure = blobStorageResponse(error, "Entwurf konnte nicht gelöscht werden.");
    if (failure) return failure;
    throw error;
  }
  const ownerEmail = existing && !draftIsEmpty(existing) ? existing.email : "";
  if (ownerEmail) {
    try {
      await (io.forgetOpenDraft ?? forgetOpenDraft)(ownerEmail, draftKey);
    } catch (error) {
      console.error(
        "[draft] Index löschen fehlgeschlagen",
        error instanceof Error ? error.name : "error",
      );
    }
  }
  return NextResponse.json({ ok: true });
}

function guardDraft(
  route: string,
  run: () => Promise<NextResponse>,
): Promise<NextResponse> {
  return runWithSheetsRoute(route, async () => {
    try {
      return await run();
    } catch (error) {
      const outage = sheetsOutageResponse(error);
      if (outage) return outage;
      throw error;
    }
  });
}

export function readIntakeDraft(request: Request, io?: DraftWriteIo) {
  return guardDraft("GET /api/intake/draft", () => readIntakeDraftBody(request, io));
}

export function putIntakeDraft(request: Request, io?: DraftWriteIo) {
  return guardDraft("PUT /api/intake/draft", () => putIntakeDraftBody(request, io));
}

export function deleteIntakeDraft(request: Request, io?: DraftWriteIo) {
  return guardDraft("DELETE /api/intake/draft", () => deleteIntakeDraftBody(request, io));
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
