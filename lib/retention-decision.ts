/**
 * Löschlauf Preismodell v3: reine Entscheidungen (Datensatz + Zeitpunkt -> Aktion).
 * Kein Store, kein Netz, keine Mail. Freigabe Philip 28.10. 17:50/17:56 CET:
 *
 * - Unbezahlter Entwurf: Löschung 30 Tage nach letzter Bearbeitung (updatedAt).
 * - Option 1 (99 €, 30 Tage Zugang): Dokumentation 12 Monate nach Kauf,
 *   außer vorher reaktiviert (neuer Kauf setzt purchasedAt neu / Jahrespaket aktiv).
 * - Gekündigtes Jahrespaket: 12 Monate nach Ende des Pakets. Laufendes Abo: nie.
 * - Einladungen: mit Ende des Zugangs (Widerruf) bzw. mit Löschung der Dokumentation.
 * - Protokoll (audit_log): 12 Monate nach Widerruf bzw. Ende des Zugangs.
 * - Hinweise 30 und 7 Tage vor der Löschung, je Stufe einmal. Fehlt ein Hinweis,
 *   verschiebt sich die Löschung (AGB § 12a Abs. 5: frühestens 30 Tage nach
 *   nachgeholtem Hinweis; 7-Tage-Hinweis frühestens 7 Tage vorher).
 */
import { addMonthsIso, type PlanRow } from "@/lib/plan";
import { RETENTION_REDACTED_DOMAIN } from "@/lib/retention-guards";

export const DAY_MS = 24 * 60 * 60 * 1000;
export const DRAFT_RETENTION_DAYS = 30;
export const DOC_RETENTION_MONTHS = 12;
export const AUDIT_RETENTION_MONTHS = 12;
export const NOTICE_FIRST_DAYS = 30;
export const NOTICE_SECOND_DAYS = 7;

/** Abo-Status, die als laufend gelten (wie lib/plan.ts). Leer zählt als laufend. */
const LIVE_SUBSCRIPTION = new Set(["", "active", "trialing", "past_due", "incomplete", "unpaid", "paused"]);
/** Nur diese Status gelten als sicher beendet. */
const ENDED_SUBSCRIPTION = new Set(["canceled", "cancelled", "incomplete_expired", "ended"]);

function time(iso: string | undefined | null): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}

/* ---------------- Entwürfe ---------------- */

export type DraftFacts = {
  updatedAt: string;
  /** Bezahlt/gebunden: Session, Dokument oder lebender Plan der Mailbox. */
  paid: boolean;
};

export type DraftAction = "keep" | "delete";

export function draftDeleteAt(draft: Pick<DraftFacts, "updatedAt">): string {
  const t = time(draft.updatedAt);
  return t === null ? "" : new Date(t + DRAFT_RETENTION_DAYS * DAY_MS).toISOString();
}

export function decideDraft(draft: DraftFacts, now: Date): DraftAction {
  if (draft.paid) return "keep";
  const due = time(draftDeleteAt(draft));
  if (due === null) return "keep";
  return now.getTime() >= due ? "delete" : "keep";
}

/* ---------------- Dokumentation (Option 1 / Jahrespaket) ---------------- */

export type DocCategory = "option1" | "annual";
export type DocAction = "keep" | "notice30" | "notice7" | "delete";

export type DocDecision = {
  category: DocCategory | null;
  action: DocAction;
  /** Frist laut Regel (ISO), leer wenn keine. */
  dueAt: string;
  /** Tatsächlicher frühester Löschzeitpunkt nach den Hinweisen (ISO), leer wenn offen. */
  effectiveAt: string;
};

const KEEP: DocDecision = { category: null, action: "keep", dueAt: "", effectiveAt: "" };

/** Ende des Jahrespakets, nur wenn sicher beendet. Sonst "" (= nie löschen). */
export function annualEndedAt(row: PlanRow, now: Date): string {
  const status = row.memberStatus.trim().toLowerCase();
  if (LIVE_SUBSCRIPTION.has(status) || !ENDED_SUBSCRIPTION.has(status)) return "";
  const end = row.memberEndedAt || row.memberCancelAt || row.memberPeriodEnd;
  const t = time(end);
  if (t === null || t > now.getTime()) return "";
  return new Date(t).toISOString();
}

/** Kategorie und Frist. Laufendes Abo, gelöscht, erstattet, unklar: keine Frist. */
export function docDeadline(row: PlanRow, now: Date): { category: DocCategory; dueAt: string } | null {
  if (row.deletedAt || row.refundedAt) return null;
  if (row.plan === "member") {
    const ended = annualEndedAt(row, now);
    if (!ended) return null;
    const due = addMonthsIso(ended, DOC_RETENTION_MONTHS);
    return due ? { category: "annual", dueAt: due } : null;
  }
  if (row.plan !== "single") return null;
  if (time(row.purchasedAt) === null) return null;
  // Reaktivierung = neuer Kauf (purchasedAt neu). Nie früher als eine längere gespeicherte Frist.
  const fromPurchase = addMonthsIso(row.purchasedAt, DOC_RETENTION_MONTHS);
  const stored = time(row.retentionUntil);
  const purchase = time(fromPurchase);
  if (purchase === null) return null;
  const due = stored !== null && stored > purchase ? row.retentionUntil : fromPurchase;
  return { category: "option1", dueAt: new Date(time(due)!).toISOString() };
}

/** Hinweis gilt nur, wenn er nach dem maßgeblichen Kauf/Ende verschickt wurde. */
function noticeTime(sentAt: string, notBefore: number | null): number | null {
  const t = time(sentAt);
  if (t === null) return null;
  if (notBefore !== null && t < notBefore) return null;
  return t;
}

export function decideDoc(row: PlanRow, now: Date): DocDecision {
  const deadline = docDeadline(row, now);
  if (!deadline) return KEEP;
  const due = time(deadline.dueAt)!;
  const anchor =
    deadline.category === "annual" ? time(annualEndedAt(row, now)) : time(row.purchasedAt);
  const n30 = noticeTime(row.notice30At, anchor);
  const n7 = noticeTime(row.notice7At, anchor);
  const at = now.getTime();
  const base = { category: deadline.category, dueAt: deadline.dueAt };

  if (n30 === null) {
    if (at >= due - NOTICE_FIRST_DAYS * DAY_MS) return { ...base, action: "notice30", effectiveAt: "" };
    return { ...base, action: "keep", effectiveAt: "" };
  }
  let effective = Math.max(due, n30 + NOTICE_FIRST_DAYS * DAY_MS);
  if (n7 === null || n7 < n30) {
    if (at >= effective - NOTICE_SECOND_DAYS * DAY_MS) return { ...base, action: "notice7", effectiveAt: "" };
    return { ...base, action: "keep", effectiveAt: new Date(effective).toISOString() };
  }
  effective = Math.max(effective, n7 + NOTICE_SECOND_DAYS * DAY_MS);
  const effectiveAt = new Date(effective).toISOString();
  return { ...base, action: at >= effective ? "delete" : "keep", effectiveAt };
}

/* ---------------- Einladungen und Protokoll ---------------- */

export type OwnerAccess = {
  /** Dokumentation der Inhaber-Mailbox gelöscht (Zeitpunkt ISO) oder in diesem Lauf fällig. */
  docsDeletedAt: string;
  /** Ende des Zugangs des Inhabers (gekündigtes Jahrespaket), sonst "". */
  accessEndedAt: string;
};

export type MembershipFacts = {
  status: string;
  revokedAt: string;
  memberEmail: string;
};

export function isRedactedEmail(email: string): boolean {
  return email.trim().toLowerCase().endsWith(`@${RETENTION_REDACTED_DOMAIN}`);
}

export function decideMembership(m: MembershipFacts, owner: OwnerAccess, now: Date): "keep" | "delete" {
  if (isRedactedEmail(m.memberEmail)) return "keep";
  const at = now.getTime();
  const docs = time(owner.docsDeletedAt);
  if (docs !== null && docs <= at) return "delete";
  const ended = time(owner.accessEndedAt);
  if (ended !== null && ended <= at) return "delete";
  if (m.status === "revoked") {
    const revoked = time(m.revokedAt);
    if (revoked !== null && revoked <= at) return "delete";
  }
  return "keep";
}

export type AuditFacts = {
  actorEmail: string;
  ownerEmail: string;
  /** Widerruf der Einladung der handelnden Person für diese Firma (ISO) oder "". */
  actorRevokedAt: string;
  /** Handelnde Person ist Inhaber. */
  actorIsOwner: boolean;
};

export function auditDeleteAt(row: AuditFacts, owner: OwnerAccess): string {
  const candidates: number[] = [];
  const ended = time(owner.accessEndedAt);
  const docs = time(owner.docsDeletedAt);
  if (ended !== null) candidates.push(ended);
  if (docs !== null) candidates.push(docs);
  if (!row.actorIsOwner) {
    const revoked = time(row.actorRevokedAt);
    if (revoked !== null) candidates.push(revoked);
  }
  if (candidates.length === 0) return "";
  return addMonthsIso(new Date(Math.min(...candidates)).toISOString(), AUDIT_RETENTION_MONTHS);
}

export function decideAudit(row: AuditFacts, owner: OwnerAccess, now: Date): "keep" | "delete" {
  if (isRedactedEmail(row.ownerEmail) && isRedactedEmail(row.actorEmail)) return "keep";
  const due = time(auditDeleteAt(row, owner));
  if (due === null) return "keep";
  return now.getTime() >= due ? "delete" : "keep";
}
