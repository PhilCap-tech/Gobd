/**
 * Löschlauf Preismodell v3: Orchestrierung über eine austauschbare IO.
 * Trockenlauf zählt nur (keine Mail, kein Schreiben). Ausführung nur mit
 * RETENTION_EXECUTE_ENABLED=true. Kein Stripe-Aufruf. Ins Log nur Zähler.
 */
import { createHash } from "node:crypto";
import type { AuditEvent } from "@/lib/audit-log";
import type { IntakeDraft } from "@/lib/intake-draft-shared";
import type { Membership } from "@/lib/memberships";
import type { PlanRow } from "@/lib/plan";
import {
  annualEndedAt,
  decideAudit,
  decideDoc,
  decideDraft,
  decideMembership,
  isRedactedEmail,
  type OwnerAccess,
} from "@/lib/retention-decision";
import {
  EXCLUSION_GROUPS,
  exclusionFor,
  hasNewModelMarker,
  RETENTION_REDACTED_DOMAIN,
  type ExclusionGroup,
} from "@/lib/retention-guards";
import type { RetentionNoticeStage } from "@/lib/retention-mail";

export type DocRowLite = { email: string; stripeSessionId: string; documentId: string; entityId: string };
export type DraftRecord = { pathname: string; draft: IntakeDraft | null };

export type RetentionIo = {
  listPlans(): Promise<PlanRow[]>;
  listDrafts(): Promise<{ drafts: DraftRecord[]; truncated: boolean }>;
  listDocRows(): Promise<DocRowLite[]>;
  /** true, wenn ein Digistore24-Datensatz besteht oder nicht lesbar ist. */
  ds24Known(email: string): Promise<boolean>;
  listMemberships(): Promise<Membership[]>;
  listAudit(): Promise<AuditEvent[]>;
  deleteDraft(record: DraftRecord): Promise<void>;
  deleteDocs(row: PlanRow, docs: readonly DocRowLite[]): Promise<void>;
  savePlan(row: PlanRow): Promise<void>;
  redactMembership(row: Membership): Promise<void>;
  redactAudit(row: AuditEvent): Promise<void>;
  sendNotice(input: {
    stage: RetentionNoticeStage;
    email: string;
    dueAt: string;
    deleteAt: string;
    category: "option1" | "annual" | "refunded";
  }): Promise<"sent" | "duplicate" | "failed">;
};

type GroupCount = { plans: number; drafts: number; memberships: number; audit: number; candidates: 0 };

export type RetentionReport = {
  mode: "dry-run" | "execute";
  at: string;
  seen: { plans: number; drafts: number; memberships: number; audit: number; draftsTruncated: boolean };
  /** Würde bzw. wird bearbeitet (nur neue Modell-Datensätze nach allen Ausschlüssen). */
  candidates: {
    drafts: number;
    docsOption1: number;
    docsAnnual: number;
    /** Nach voller Erstattung, 30 Tage nach refundedAt (ohne Hinweis, RETENTION_REFUND_NOTICE). */
    docsRefunded: number;
    memberships: number;
    audit: number;
    notice30: number;
    notice7: number;
  };
  /** Ausgeschlossene Gruppen: gesehen je Art, Kandidaten immer 0. */
  excluded: Record<ExclusionGroup, GroupCount>;
  done: {
    draftsDeleted: number;
    docsDeleted: number;
    membershipsRedacted: number;
    auditRedacted: number;
    notice30Sent: number;
    notice7Sent: number;
    errors: number;
  };
};

const LABEL = "gobd/retention/redact/v1";

/** Stabiler Platzhalter statt Klartext-Adresse in geschwärzten Zeilen. */
export function redactedEmailFor(email: string): string {
  const value = email.trim().toLowerCase();
  if (isRedactedEmail(value)) return value;
  const digest = createHash("sha256").update(`${LABEL}:${value}`).digest("hex").slice(0, 24);
  return `r-${digest}@${RETENTION_REDACTED_DOMAIN}`;
}

/** Modell-Markierung einer Plans-Zeile: nur `pricingModel === "v3"` (leer = Altzeile v2 26.10. -> nie). */
export function planHasMarker(row: PlanRow): boolean {
  return hasNewModelMarker(row.pricingModel);
}

/** Zugangsende des Inhabers: beendetes Jahrespaket, sonst Ende der 30 Tage (Option 1, `accessUntil`). */
export function ownerAccessEnd(row: PlanRow, now: Date): string {
  // Erstattung sperrt sofort: der Zugang endet mit refundedAt.
  const refunded = Date.parse(row.refundedAt);
  if (row.refundedAt && Number.isFinite(refunded) && refunded <= now.getTime()) return new Date(refunded).toISOString();
  const annual = annualEndedAt(row, now);
  if (annual) return annual;
  if (row.plan !== "single" || row.deletedAt || row.refundedAt) return "";
  const until = Date.parse(row.accessUntil);
  return Number.isFinite(until) && until <= now.getTime() ? new Date(until).toISOString() : "";
}

export function draftHasMarker(draft: IntakeDraft): boolean {
  return hasNewModelMarker((draft as IntakeDraft & { pricingModel?: string }).pricingModel);
}

function norm(email: string): string {
  return email.trim().toLowerCase();
}

function emptyGroups(): Record<ExclusionGroup, GroupCount> {
  const out = {} as Record<ExclusionGroup, GroupCount>;
  for (const group of EXCLUSION_GROUPS) out[group] = { plans: 0, drafts: 0, memberships: 0, audit: 0, candidates: 0 };
  return out;
}

export async function runRetention(
  io: RetentionIo,
  options: { execute: boolean; now?: Date },
): Promise<RetentionReport> {
  const now = options.now ?? new Date();
  const execute = options.execute === true;
  const report: RetentionReport = {
    mode: execute ? "execute" : "dry-run",
    at: now.toISOString(),
    seen: { plans: 0, drafts: 0, memberships: 0, audit: 0, draftsTruncated: false },
    candidates: { drafts: 0, docsOption1: 0, docsAnnual: 0, docsRefunded: 0, memberships: 0, audit: 0, notice30: 0, notice7: 0 },
    excluded: emptyGroups(),
    done: {
      draftsDeleted: 0,
      docsDeleted: 0,
      membershipsRedacted: 0,
      auditRedacted: 0,
      notice30Sent: 0,
      notice7Sent: 0,
      errors: 0,
    },
  };

  // Lesen. Ein Lesefehler bricht den ganzen Lauf ab (nichts halb gelöscht).
  const plans = await io.listPlans();
  const docRows = await io.listDocRows();
  const memberships = await io.listMemberships();
  const audit = await io.listAudit();
  const draftList = await io.listDrafts();
  report.seen.plans = plans.length;
  report.seen.memberships = memberships.length;
  report.seen.audit = audit.length;
  report.seen.drafts = draftList.drafts.length;
  report.seen.draftsTruncated = draftList.truncated;

  const planByEmail = new Map<string, PlanRow>();
  for (const row of plans) {
    const key = norm(row.email);
    // Doppelte Zeilen je Mailbox: unklar -> Marker-Ausschluss über leere Map-Einträge.
    if (planByEmail.has(key)) planByEmail.set(key, { ...row, pricingModel: "unklar" });
    else planByEmail.set(key, row);
  }
  const docsByEmail = new Map<string, DocRowLite[]>();
  for (const doc of docRows) {
    const key = norm(doc.email);
    if (!key) continue;
    docsByEmail.set(key, [...(docsByEmail.get(key) ?? []), doc]);
  }
  const ds24Cache = new Map<string, boolean>();
  async function ds24(email: string): Promise<boolean> {
    const key = norm(email);
    if (!ds24Cache.has(key)) {
      let known = true;
      try {
        known = await io.ds24Known(key);
      } catch {
        known = true;
      }
      ds24Cache.set(key, known);
    }
    return ds24Cache.get(key)!;
  }

  /** Altkunde: Dokumentzeile mit Stripe-Session, die nicht als Kauf des neuen Modells verbucht ist. */
  function legacyFor(email: string, plan: PlanRow | undefined): boolean {
    const docs = docsByEmail.get(norm(email)) ?? [];
    if (!plan) return docs.length > 0;
    const known = new Set(
      plan.processedSessions
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    );
    return docs.some((doc) => doc.stripeSessionId.trim() && !known.has(doc.stripeSessionId.trim()));
  }

  async function ownerExclusion(email: string, extraEmails: string[], entityIds: string[]) {
    const plan = planByEmail.get(norm(email));
    const docs = docsByEmail.get(norm(email)) ?? [];
    return exclusionFor({
      emails: [email, ...extraEmails],
      entityIds: [...entityIds, ...docs.map((doc) => doc.entityId)],
      ds24: await ds24(email),
      legacy: legacyFor(email, plan),
      marker: plan ? planHasMarker(plan) : false,
    });
  }

  /* ---------- Dokumentation + Hinweise ---------- */
  const ownerAccess = new Map<string, OwnerAccess>();
  for (const plan of plans) {
    const email = norm(plan.email);
    const excluded = await ownerExclusion(email, [], []);
    if (excluded) {
      report.excluded[excluded].plans += 1;
      continue;
    }
    ownerAccess.set(email, { docsDeletedAt: plan.deletedAt, accessEndedAt: ownerAccessEnd(plan, now) });
    const decision = decideDoc(plan, now);
    if (decision.action === "keep" || !decision.category) continue;
    if (decision.action === "notice30" || decision.action === "notice7") {
      report.candidates[decision.action] += 1;
      if (!execute) continue;
      const deleteAt = decision.effectiveAt || decision.dueAt;
      try {
        const result = await io.sendNotice({
          stage: decision.action,
          email,
          dueAt: decision.dueAt,
          deleteAt: laterIso(deleteAt, decision.action === "notice30" ? 30 : 7, now),
          category: decision.category,
        });
        if (result === "failed") {
          report.done.errors += 1;
          continue;
        }
        const field = decision.action === "notice30" ? "notice30At" : "notice7At";
        await io.savePlan({ ...plan, [field]: now.toISOString(), updatedAt: now.toISOString() });
        if (decision.action === "notice30") report.done.notice30Sent += result === "sent" ? 1 : 0;
        else report.done.notice7Sent += result === "sent" ? 1 : 0;
      } catch {
        report.done.errors += 1;
      }
      continue;
    }
    // delete
    if (decision.category === "option1") report.candidates.docsOption1 += 1;
    else if (decision.category === "refunded") report.candidates.docsRefunded += 1;
    else report.candidates.docsAnnual += 1;
    // Für Einladungen/Protokoll: Löschung gilt ab jetzt (auch im Trockenlauf für die Zählung).
    ownerAccess.set(email, { docsDeletedAt: now.toISOString(), accessEndedAt: ownerAccessEnd(plan, now) });
    if (!execute) continue;
    try {
      await io.deleteDocs(plan, docsByEmail.get(email) ?? []);
      await io.savePlan({ ...plan, deletedAt: now.toISOString(), updatedAt: now.toISOString() });
      report.done.docsDeleted += 1;
    } catch {
      report.done.errors += 1;
      ownerAccess.set(email, { docsDeletedAt: plan.deletedAt, accessEndedAt: ownerAccessEnd(plan, now) });
    }
  }

  /* ---------- Unbezahlte Entwürfe ---------- */
  for (const record of draftList.drafts) {
    const draft = record.draft;
    if (!draft || !draft.email?.trim()) {
      report.excluded.marker.drafts += 1;
      continue;
    }
    const group = await draftGroup(draft);
    if (group) {
      report.excluded[group].drafts += 1;
      continue;
    }
    const plan = planByEmail.get(norm(draft.email));
    const paid = Boolean(draft.stripeSessionId?.trim() || draft.documentId?.trim() || (plan && !plan.deletedAt));
    if (decideDraft({ updatedAt: draft.updatedAt, paid }, now) !== "delete") continue;
    report.candidates.drafts += 1;
    if (!execute) continue;
    try {
      await io.deleteDraft(record);
      report.done.draftsDeleted += 1;
    } catch {
      report.done.errors += 1;
    }
  }

  /** Ausschluss eines Entwurfs; die Modell-Markierung steht am Entwurf selbst. */
  async function draftGroup(draft: IntakeDraft): Promise<ExclusionGroup | null> {
    const email = norm(draft.email);
    return exclusionFor({
      emails: [email],
      entityIds: [draft.entityId ?? ""].filter(Boolean),
      ds24: await ds24(email),
      legacy: legacyFor(email, planByEmail.get(email)),
      marker: draftHasMarker(draft),
    });
  }

  /* ---------- Einladungen ---------- */
  for (const m of memberships) {
    const owner = norm(m.ownerEmail);
    if (isRedactedEmail(m.memberEmail)) continue;
    const excluded = await ownerExclusion(owner, [m.memberEmail], [m.entityId]);
    if (excluded) {
      report.excluded[excluded].memberships += 1;
      continue;
    }
    const access = ownerAccess.get(owner) ?? { docsDeletedAt: "", accessEndedAt: "" };
    if (decideMembership(m, access, now) !== "delete") continue;
    report.candidates.memberships += 1;
    if (!execute) continue;
    const ownerGone = Boolean(access.docsDeletedAt) && Date.parse(access.docsDeletedAt) <= now.getTime();
    try {
      await io.redactMembership({
        ...m,
        ownerEmail: ownerGone ? redactedEmailFor(m.ownerEmail) : m.ownerEmail,
        memberEmail: redactedEmailFor(m.memberEmail),
        invitedBy: m.invitedBy ? redactedEmailFor(m.invitedBy) : "",
        status: "revoked",
        tokenHash: "",
        moduleIds: "",
        revokedAt: m.revokedAt || now.toISOString(),
        updatedAt: now.toISOString(),
      });
      report.done.membershipsRedacted += 1;
    } catch {
      report.done.errors += 1;
    }
  }

  /* ---------- Protokoll ---------- */
  for (const event of audit) {
    if (isRedactedEmail(event.ownerEmail) && isRedactedEmail(event.actorEmail)) continue;
    const owner = norm(event.ownerEmail);
    const excluded = isRedactedEmail(owner)
      ? "marker"
      : await ownerExclusion(owner, isRedactedEmail(event.actorEmail) ? [] : [event.actorEmail], [event.entityId]);
    if (excluded) {
      report.excluded[excluded].audit += 1;
      continue;
    }
    const actor = norm(event.actorEmail);
    const revoked = memberships.find(
      (m) =>
        m.entityId === event.entityId &&
        m.status === "revoked" &&
        (norm(m.memberEmail) === actor || m.memberEmail === redactedEmailFor(actor)),
    );
    const access = ownerAccess.get(owner) ?? { docsDeletedAt: "", accessEndedAt: "" };
    const facts = {
      actorEmail: event.actorEmail,
      ownerEmail: event.ownerEmail,
      actorRevokedAt: revoked?.revokedAt ?? "",
      actorIsOwner: actor === owner,
    };
    if (decideAudit(facts, access, now) !== "delete") continue;
    report.candidates.audit += 1;
    if (!execute) continue;
    try {
      await io.redactAudit({
        ...event,
        actorEmail: redactedEmailFor(event.actorEmail),
        ownerEmail: redactedEmailFor(event.ownerEmail),
        moduleIds: "",
        summary: "gelöscht (Löschlauf)",
      });
      report.done.auditRedacted += 1;
    } catch {
      report.done.errors += 1;
    }
  }

  return report;
}

/** Im Hinweis genanntes Datum: nie früher als die Mindestfrist ab heute. */
function laterIso(iso: string, days: number, now: Date): string {
  const min = now.getTime() + days * 24 * 60 * 60 * 1000;
  const t = Date.parse(iso);
  return new Date(Number.isFinite(t) && t > min ? t : min).toISOString();
}

/** Nur Zähler, keine IDs/Adressen: fürs Log und die JSON-Antwort. */
export function retentionLogLine(report: RetentionReport): string {
  return JSON.stringify({
    mode: report.mode,
    seen: report.seen,
    candidates: report.candidates,
    excluded: report.excluded,
    done: report.done,
  });
}
