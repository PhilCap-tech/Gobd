/**
 * Admin und Lösch-Lauf für Preismodell v2. Nur lesend.
 *
 * - GET /api/admin/plans: Pläne mit Zustand, Fristende, Erstattbarkeit
 *   (Grund und Frist). Mails maskiert. Token: ADMIN_TOKEN wie die
 *   übrigen Admin-Statistiken.
 * - POST /api/ops/retention-run: Lösch-Lauf. In diesem Stand IMMER
 *   Trockenlauf: zählt Kandidaten, sendet keine Mail, löscht nichts. Auch
 *   bei RETENTION_DELETE_ENABLED / RETENTION_NOTICE_ENABLED = true wird nur
 *   gemeldet, dass die Ausführung noch nicht freigegeben ist.
 */
import { adminTokensMatch, bearerTokenFromHeader } from "@/lib/admin-wipe";
import { maskCheckoutEmail } from "@/lib/checkout-session";
import {
  deletionDueAt,
  firstPdfFor,
  planState,
  refundStatus,
  renewalNoticeDue,
  retentionCandidate,
  type PlanRow,
} from "@/lib/plan";
import { cancelMembership, withdrawMembershipCancel, type CancelStripe } from "@/lib/plan-cancel";
import { findPlanByEmailStrict, listPlanRowsStrict, savePlanRow } from "@/lib/plan-store";
import {
  planLifecycleEnabled,
  renewalNoticeEnabled,
  retentionDeleteEnabled,
  retentionNoticeEnabled,
} from "@/lib/pricing-model";
import { emailsEqual } from "@/lib/types";

export type HttpResult = { status: number; body: unknown };

const NO_STORE = { "Cache-Control": "private, no-store" } as const;
export const PLAN_ADMIN_HEADERS = NO_STORE;

function authorized(request: Request, expected: string | undefined): boolean {
  const token = expected?.trim() ?? "";
  if (!token) return false;
  const provided = bearerTokenFromHeader(request.headers.get("authorization"));
  return Boolean(provided && adminTokensMatch(provided, token));
}

type DocLite = { email: string; pdfUrl?: string; timestamp?: string };

export function planAdminRows(rows: readonly PlanRow[], docs: readonly DocLite[], now: Date = new Date()) {
  return rows.map((row) => {
    const own = docs.filter((doc) => emailsEqual(doc.email, row.email));
    const refund = refundStatus(row, own, now);
    return {
      email: maskCheckoutEmail(row.email),
      state: planState(row, now),
      plan: row.plan,
      purchasedAt: row.purchasedAt,
      retentionUntil: row.retentionUntil,
      deletionDueAt: deletionDueAt(row, now),
      memberPeriodEnd: row.memberPeriodEnd,
      memberCancelAt: row.memberCancelAt,
      changeCredits: row.changeCredits,
      refundable: refund.refundable,
      refundReason: refund.reason,
      refundDeadline: refund.deadline,
      refundedAt: row.refundedAt,
      firstPdfAt: firstPdfFor(row),
      memberCancelChannel: row.memberCancelChannel,
      memberCancelReceivedAt: row.memberCancelReceivedAt,
    };
  });
}

export async function handlePlanAdminRequest(
  request: Request,
  deps: {
    token?: string;
    listPlans?: () => Promise<PlanRow[]>;
    listDocs?: () => Promise<DocLite[]>;
    now?: Date;
  } = {},
): Promise<HttpResult> {
  if (!authorized(request, deps.token ?? process.env.ADMIN_TOKEN)) {
    return { status: 401, body: { error: "unauthorized" } };
  }
  try {
    const plans = await (deps.listPlans ?? listPlanRowsStrict)();
    const docs = deps.listDocs
      ? await deps.listDocs()
      : (await import("@/lib/store").then((store) => store.readStoredIntakeRows())).map((row) => ({
          email: row.email,
          pdfUrl: row.pdfUrl,
          timestamp: row.timestamp,
        }));
    return { status: 200, body: { plans: planAdminRows(plans, docs, deps.now) } };
  } catch (error) {
    console.error("[plans-admin] Lesen fehlgeschlagen", error instanceof Error ? error.name : "error");
    return { status: 503, body: { error: "unavailable" } };
  }
}

export type RetentionRunReport = {
  dryRun: true;
  deleteSwitch: boolean;
  noticeSwitch: boolean;
  candidatesNotice30: number;
  candidatesNotice7: number;
  candidatesDelete: number;
  /** Verlängerungs-Erinnerungen, die fällig wären (RENEWAL_NOTICE_ENABLED, Versand nicht gebaut). */
  candidatesRenewal: number;
  renewalSwitch: boolean;
  mailed: 0;
  deleted: 0;
  note: string;
};

export function retentionRunReport(rows: readonly PlanRow[], now: Date = new Date()): RetentionRunReport {
  let notice30 = 0;
  let notice7 = 0;
  let del = 0;
  let renewal = 0;
  for (const row of rows) {
    if (renewalNoticeDue(row, now)) renewal += 1;
    const candidate = retentionCandidate(row, now);
    if (candidate === "notice30") notice30 += 1;
    if (candidate === "notice7") notice7 += 1;
    if (candidate === "delete") del += 1;
  }
  const deleteSwitch = retentionDeleteEnabled();
  const noticeSwitch = retentionNoticeEnabled();
  return {
    dryRun: true,
    deleteSwitch,
    noticeSwitch,
    candidatesNotice30: notice30,
    candidatesNotice7: notice7,
    candidatesDelete: del,
    candidatesRenewal: renewal,
    renewalSwitch: renewalNoticeEnabled(),
    mailed: 0,
    deleted: 0,
    note:
      deleteSwitch || noticeSwitch || renewalNoticeEnabled()
        ? "Schalter an, Ausführung in diesem Stand nicht gebaut: nur gezählt (wartet auf Philips Go)."
        : "Trockenlauf: nur gezählt.",
  };
}

export async function handleRetentionRunRequest(
  request: Request,
  deps: { token?: string; listPlans?: () => Promise<PlanRow[]>; now?: Date } = {},
): Promise<HttpResult> {
  if (!authorized(request, deps.token ?? process.env.RETENTION_RUN_TOKEN)) {
    return { status: 401, body: { error: "unauthorized" } };
  }
  try {
    const rows = await (deps.listPlans ?? listPlanRowsStrict)();
    const report = retentionRunReport(rows, deps.now);
    // Nur Zähler ins Log: keine IDs, keine Adressen.
    console.info("[retention-run]", JSON.stringify(report));
    return { status: 200, body: report };
  } catch (error) {
    console.error("[retention-run] Lesen fehlgeschlagen", error instanceof Error ? error.name : "error");
    return { status: 503, body: { error: "unavailable" } };
  }
}

/* ---------- Kündigung / Rücknahme per E-Mail erfassen (Admin) ---------- */

/**
 * POST /api/admin/plans: `{ action: "kuendigen" | "zuruecknehmen", email,
 * receivedAt }`. Gleiche Wirkung wie der Klick im Konto, Kanal `email`,
 * Stichtag ab Eingang der E-Mail. Weitere Firmen: erst mit
 * PRICING_EXTRA_FIRMS_ENABLED und Einzelkündigung je Firma (noch offen).
 */
export async function handlePlanAdminAction(
  request: Request,
  deps: {
    token?: string;
    findPlan?: (email: string) => Promise<PlanRow | null>;
    savePlan?: (row: PlanRow) => Promise<void>;
    stripe?: CancelStripe;
    now?: Date;
  } = {},
): Promise<HttpResult> {
  if (!authorized(request, deps.token ?? process.env.ADMIN_TOKEN)) {
    return { status: 401, body: { error: "unauthorized" } };
  }
  // T8 zurückgestellt (CoS 27.10.): ohne PLAN_LIFECYCLE_ENABLED kein Stichtag-Eintrag;
  // E-Mail-Kündigungen werden in Stripe (Portal/Dashboard) umgesetzt.
  if (!planLifecycleEnabled()) {
    return { status: 409, body: { error: "zurückgestellt: PLAN_LIFECYCLE_ENABLED ist aus" } };
  }
  let body: { action?: unknown; email?: unknown; receivedAt?: unknown; target?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return { status: 400, body: { error: "invalid_json" } };
  }
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const action = body.action === "kuendigen" || body.action === "zuruecknehmen" ? body.action : null;
  const receivedAt = typeof body.receivedAt === "string" ? body.receivedAt : "";
  if (!email || !action || !Number.isFinite(Date.parse(receivedAt))) {
    return { status: 400, body: { error: "email, action und receivedAt (ISO) nötig" } };
  }
  if (body.target !== undefined && body.target !== "mitgliedschaft") {
    return { status: 501, body: { error: "Einzelkündigung weiterer Firmen ist noch nicht gebaut" } };
  }
  try {
    const row = await (deps.findPlan ?? findPlanByEmailStrict)(email);
    if (!row) return { status: 404, body: { error: "kein Plan" } };
    const stripe = deps.stripe ?? (await import("@/lib/plan-cancel-stripe")).planCancelStripe();
    const run = action === "kuendigen" ? cancelMembership : withdrawMembershipCancel;
    const outcome = await run(row, { channel: "email", receivedAt, stripe, now: deps.now });
    if (!outcome.ok) return { status: 409, body: { status: outcome.status } };
    if (outcome.row !== row) await (deps.savePlan ?? savePlanRow)(outcome.row);
    return {
      status: 200,
      body: { status: outcome.status, effectiveAt: outcome.effectiveAt, email: maskCheckoutEmail(email) },
    };
  } catch (error) {
    console.error("[plans-admin] Aktion fehlgeschlagen", error instanceof Error ? error.name : "error");
    return { status: 503, body: { error: "unavailable" } };
  }
}
