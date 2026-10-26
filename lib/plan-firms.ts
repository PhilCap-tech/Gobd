/**
 * Preismodell v2, Firmen (R1 neu, Philip 26.10.2026 14:04). Rein, ohne I/O.
 *
 * Kein Limit von 5 Firmen mehr. Eine Zeile je Firma (Tab `plan_firms`),
 * verknüpft über die E-Mail mit der Konto-Zeile (`plans`). Die Konto-Zeile
 * trägt Mitgliedschaft, Kunde, Erstattung; die Firmen-Zeile trägt Frist,
 * Änderungsguthaben und Erinnerungen.
 *
 * - Mit Mitgliedschaft: 1. und 2. Firma ohne Aufpreis (MEMBER_INCLUDED_FIRMS),
 *   jede weitere 49 €/Jahr als Menge am Firmen-Posten des Mitgliedschafts-Abos.
 *   Alle Firmen offen, solange die Mitgliedschaft läuft; jede neue Version frei.
 * - Ohne Mitgliedschaft: jede weitere Firma 99 € einmalig. Jede Firma hat ihre
 *   eigene 12-Monats-Frist ab Kauf; eine Änderung (49 €) gilt für eine Firma
 *   und verlängert nur deren Frist (Zahlung + 12 Monate).
 * - Ein Kauf (Einstieg oder weitere Firma) legt einen „Platz“ an (entityId
 *   leer). Das erste Dokument einer Firma bindet den Platz an die Firma.
 *   Plätze von Mitgliedern entstehen beim Binden (bis zur Zahl der Firmen
 *   der Mitgliedschaft).
 * - Mitgliedschaft endet: Löschung zum Ende (R3, Default 0 Monate). Eine
 *   eigene, länger laufende Kauf-Frist einer Firma bleibt bestehen.
 * Unter PRICING_MODEL=legacy (ohne PLAN_ACCESS_ENABLED) wird nichts davon
 * gelesen: das Limit von 5 Firmen im Abo bleibt dort unverändert.
 */
import {
  addMonthsIso,
  planState,
  retentionAfterMemberEnd,
  type PlanRow,
  type RefundStatus,
  type RetentionCandidate,
  REFUND_WINDOW_DAYS,
} from "@/lib/plan";
import { memberIncludedFirms, PLAN_WINDOW_MONTHS } from "@/lib/pricing-model";

/** entry: mit dem Einstieg gekauft · extra: weitere Firma 99 € · member: Platz der Mitgliedschaft. */
export type FirmSource = "entry" | "extra" | "member";

export type PlanFirmRow = {
  email: string;
  /** Eindeutig: Checkout-Session des Kaufs, bei Mitglieds-Plätzen `m_<entityId>`. */
  slotId: string;
  /** Leer, solange der Platz noch keiner Firma zugeordnet ist. */
  entityId: string;
  source: FirmSource;
  purchasedAt: string;
  retentionUntil: string;
  changeCredits: number;
  lastChangePaidAt: string;
  notice30At: string;
  notice7At: string;
  deletedAt: string;
  refundedAt: string;
  processedSessions: string;
  updatedAt: string;
};

export const PLAN_FIRM_SHEET_COLUMNS = [
  "email",
  "slot_id",
  "entity_id",
  "source",
  "purchased_at",
  "retention_until",
  "change_credits",
  "last_change_paid_at",
  "notice30_at",
  "notice7_at",
  "deleted_at",
  "refunded_at",
  "processed_sessions",
  "updated_at",
] as const;

const DAY_MS = 24 * 60 * 60 * 1000;

function later(a: string, b: string): string {
  const ta = Date.parse(a);
  const tb = Date.parse(b);
  if (!Number.isFinite(ta)) return Number.isFinite(tb) ? b : "";
  if (!Number.isFinite(tb)) return a;
  return ta >= tb ? a : b;
}

function remember(list: string, id: string): string {
  const items = list.split(",").map((item) => item.trim()).filter(Boolean);
  if (id && !items.includes(id)) items.push(id);
  return items.slice(-20).join(",");
}

function processed(list: string, id: string): boolean {
  return Boolean(id) && list.split(",").map((item) => item.trim()).includes(id);
}

export function liveFirms(firms: readonly PlanFirmRow[]): PlanFirmRow[] {
  return firms.filter((firm) => !firm.deletedAt && !firm.refundedAt);
}

export function boundFirm(firms: readonly PlanFirmRow[], entityId: string): PlanFirmRow | null {
  const id = entityId.trim();
  if (!id) return null;
  return liveFirms(firms).find((firm) => firm.entityId === id) ?? null;
}

function memberLive(account: PlanRow, now: Date): boolean {
  return planState(account, now) === "member";
}

/** Firmen, die die laufende Mitgliedschaft abdeckt: inklusive + bezahlte weitere. */
export function memberFirmAllowance(account: PlanRow): number {
  return memberIncludedFirms() + Math.max(0, account.memberExtraFirms || 0);
}

/** Zugeordnete Firmen (für das Mitglieds-Kontingent). */
export function boundFirmCount(firms: readonly PlanFirmRow[]): number {
  return new Set(liveFirms(firms).filter((firm) => firm.entityId).map((firm) => firm.entityId)).size;
}

/** Eigene Kauf-Frist der Firma offen? Mitglieds-Plätze haben keine eigene Frist. */
function ownWindowOpen(firm: PlanFirmRow, now: Date, account?: PlanRow): boolean {
  if (firm.source === "member") return false;
  const until = Date.parse(firm.retentionUntil);
  if (!Number.isFinite(until) || now.getTime() >= until) return false;
  // In die Mitgliedschaft übergegangene Firmen enden mit ihr (Punkt 4).
  if (account?.memberEndedAt && Date.parse(firm.purchasedAt) <= Date.parse(account.memberEndedAt)) {
    return now.getTime() < Date.parse(retentionAfterMemberEnd(account.memberEndedAt));
  }
  return true;
}

function openUnboundSlot(firms: readonly PlanFirmRow[], now: Date, account?: PlanRow): PlanFirmRow | null {
  return (
    liveFirms(firms)
      .filter((firm) => !firm.entityId && ownWindowOpen(firm, now, account))
      .sort((a, b) => a.purchasedAt.localeCompare(b.purchasedAt))[0] ?? null
  );
}

export const FIRM_NEEDS_PURCHASE_MESSAGE =
  "Für diese Firma ist noch kein Platz gebucht. Bitte buchen Sie die weitere Firma im Konto.";
export const FIRM_NEEDS_MEMBER_SLOT_MESSAGE =
  "Ihre Mitgliedschaft umfasst bereits alle gebuchten Firmen. Bitte ergänzen Sie die weitere Firma im Konto.";
export const FIRM_EXPIRED_MESSAGE =
  "Die Vorhaltefrist dieser Firma ist abgelaufen. Änderungen sind nicht mehr möglich; Ihr PDF haben Sie bereits erhalten.";
export const FIRM_NEEDS_CHANGE_MESSAGE =
  "Für eine neue Version dieser Firma beauftragen Sie bitte zuerst eine Änderung im Konto oder werden Mitglied.";
export const FIRM_REFUNDED_MESSAGE = "Der Kauf wurde erstattet. Der Zugang ist damit beendet.";

export type FirmDecision =
  | { allowed: true; via: "member" | "window"; bind: null | { slotId: string; create: boolean }; consumeCredit: boolean }
  | {
      allowed: false;
      reason: "refunded" | "deleted" | "expired" | "needs_change" | "needs_purchase" | "needs_member_slot";
      message: string;
    };

/**
 * Darf für `entityId` geschrieben werden, und (newVersion) eine weitere
 * Version entstehen? `bind` nennt den Platz, der nach dem Speichern an die
 * Firma gebunden wird; `consumeCredit` das zu verbrauchende Guthaben.
 */
export function firmDecision(input: {
  account: PlanRow;
  firms: readonly PlanFirmRow[];
  entityId: string;
  newVersion: boolean;
  now?: Date;
}): FirmDecision {
  const now = input.now ?? new Date();
  const state = planState(input.account, now);
  if (state === "refunded") return { allowed: false, reason: "refunded", message: FIRM_REFUNDED_MESSAGE };
  if (state === "deleted") return { allowed: false, reason: "deleted", message: FIRM_EXPIRED_MESSAGE };
  const bound = boundFirm(input.firms, input.entityId);
  const refundedOwn = input.firms.find(
    (firm) => firm.entityId === input.entityId.trim() && firm.refundedAt,
  );
  if (!bound && refundedOwn) return { allowed: false, reason: "refunded", message: FIRM_REFUNDED_MESSAGE };

  if (memberLive(input.account, now)) {
    if (bound) return { allowed: true, via: "member", bind: null, consumeCredit: false };
    if (boundFirmCount(input.firms) < memberFirmAllowance(input.account)) {
      // Erst einen schon gekauften, offenen Platz nutzen, sonst einen Mitglieds-Platz anlegen.
      const slot = openUnboundSlot(input.firms, now, input.account);
      return {
        allowed: true,
        via: "member",
        bind: slot ? { slotId: slot.slotId, create: false } : { slotId: `m_${input.entityId.trim()}`, create: true },
        consumeCredit: false,
      };
    }
    const slot = openUnboundSlot(input.firms, now, input.account);
    if (slot) return { allowed: true, via: "window", bind: { slotId: slot.slotId, create: false }, consumeCredit: false };
    return { allowed: false, reason: "needs_member_slot", message: FIRM_NEEDS_MEMBER_SLOT_MESSAGE };
  }

  if (bound) {
    if (!ownWindowOpen(bound, now, input.account)) return { allowed: false, reason: "expired", message: FIRM_EXPIRED_MESSAGE };
    if (input.newVersion && bound.changeCredits <= 0) {
      return { allowed: false, reason: "needs_change", message: FIRM_NEEDS_CHANGE_MESSAGE };
    }
    return { allowed: true, via: "window", bind: null, consumeCredit: input.newVersion };
  }
  const slot = openUnboundSlot(input.firms, now, input.account);
  if (slot && !input.newVersion) {
    return { allowed: true, via: "window", bind: { slotId: slot.slotId, create: false }, consumeCredit: false };
  }
  return { allowed: false, reason: "needs_purchase", message: FIRM_NEEDS_PURCHASE_MESSAGE };
}

/** Nach dem Speichern: Platz binden / anlegen, Guthaben verbrauchen. */
export function applyFirmUse(
  firms: readonly PlanFirmRow[],
  decision: Extract<FirmDecision, { allowed: true }>,
  input: { email: string; entityId: string; at: string },
): PlanFirmRow | null {
  const entityId = input.entityId.trim();
  if (decision.bind) {
    if (decision.bind.create) {
      return { ...emptyFirmRow(input.email, decision.bind.slotId, "member", input.at), entityId };
    }
    const slot = firms.find((firm) => firm.slotId === decision.bind?.slotId);
    return slot ? { ...slot, entityId, updatedAt: input.at } : null;
  }
  if (decision.consumeCredit) {
    const bound = boundFirm(firms, entityId);
    if (!bound || bound.changeCredits <= 0) return null;
    return { ...bound, changeCredits: bound.changeCredits - 1, updatedAt: input.at };
  }
  return null;
}

export function emptyFirmRow(email: string, slotId: string, source: FirmSource, at: string): PlanFirmRow {
  return {
    email: email.trim().toLowerCase(),
    slotId,
    entityId: "",
    source,
    purchasedAt: source === "member" ? "" : at,
    retentionUntil: source === "member" ? "" : addMonthsIso(at, PLAN_WINDOW_MONTHS),
    changeCredits: 0,
    lastChangePaidAt: "",
    notice30At: "",
    notice7At: "",
    deletedAt: "",
    refundedAt: "",
    processedSessions: "",
    updatedAt: at,
  };
}

/** Einstieg oder weitere Firma (99 € einmalig): neuer Platz, Frist Kauf + 12 Monate. Idempotent über slotId. */
export function applyFirmPurchase(
  existing: PlanFirmRow | null,
  input: { email: string; sessionId: string; source: "entry" | "extra"; at: string; entityId?: string },
): PlanFirmRow {
  if (existing) return existing;
  const row = emptyFirmRow(input.email, input.sessionId, input.source, input.at);
  return { ...row, entityId: input.entityId?.trim() ?? "", processedSessions: input.sessionId };
}

/** Änderung (49 €) für eine Firma: ein Guthaben, Frist = Zahlung + 12 Monate, nie kürzer. */
export function applyFirmChange(
  firm: PlanFirmRow,
  input: { sessionId: string; at: string },
): PlanFirmRow {
  if (processed(firm.processedSessions, input.sessionId)) return firm;
  return {
    ...firm,
    changeCredits: Math.max(0, firm.changeCredits) + 1,
    lastChangePaidAt: input.at,
    retentionUntil: later(firm.retentionUntil, addMonthsIso(input.at, PLAN_WINDOW_MONTHS)),
    notice30At: "",
    notice7At: "",
    processedSessions: remember(firm.processedSessions, input.sessionId),
    updatedAt: input.at,
  };
}

/** Erstattung einer weiteren Firma (99 €): nur dieser Platz wird gesperrt. */
export function applyFirmRefund(firm: PlanFirmRow, at: string): PlanFirmRow {
  if (firm.refundedAt) return firm;
  return { ...firm, refundedAt: at, changeCredits: 0, updatedAt: at };
}

/* ---------- Löschung und Erinnerungen je Firma ---------- */

/**
 * Löschdatum der Firma. Laufende Mitgliedschaft ohne Kündigung: keins.
 * Mit Kündigung / nach Ende: alle Firmen enden gemeinsam mit der
 * Mitgliedschaft (+ R3, Default 0) — auch vorher einzeln gekaufte Firmen,
 * die in das Mitglieds-Fenster übergegangen sind (approvals 14:15, Punkt 4).
 * Erst nach dem Ende gekaufte Firmen behalten ihre eigene Frist.
 * Ohne Mitgliedschaft: die eigene Frist.
 */
export function firmDeletionDueAt(account: PlanRow, firm: PlanFirmRow, now: Date = new Date()): string {
  if (firm.deletedAt || firm.refundedAt || account.refundedAt || account.deletedAt) return "";
  const own = firm.source === "member" ? "" : firm.retentionUntil;
  if (memberLive(account, now)) {
    if (!account.memberCancelAt) return "";
    return retentionAfterMemberEnd(account.memberCancelAt);
  }
  if (account.memberEndedAt) {
    const memberDue = retentionAfterMemberEnd(account.memberEndedAt);
    const boughtAfter = Date.parse(firm.purchasedAt) > Date.parse(account.memberEndedAt);
    return boughtAfter ? later(own, memberDue) : memberDue;
  }
  return own;
}

export function firmRetentionCandidate(
  account: PlanRow,
  firm: PlanFirmRow,
  now: Date = new Date(),
): RetentionCandidate {
  const due = firmDeletionDueAt(account, firm, now);
  const until = Date.parse(due);
  if (!due || !Number.isFinite(until)) return "none";
  const left = until - now.getTime();
  if (left <= 0) {
    // Laufende (gekündigte) Mitgliedschaft wird nie gelöscht.
    if (memberLive(account, now)) return "none";
    if (!firm.notice7At) return "notice7";
    const sent = Date.parse(firm.notice7At);
    return Number.isFinite(sent) && now.getTime() - sent >= 7 * DAY_MS ? "delete" : "none";
  }
  if (left <= 7 * DAY_MS) return firm.notice7At ? "none" : "notice7";
  if (left <= 30 * DAY_MS) return firm.notice30At ? "none" : "notice30";
  return "none";
}

/* ---------- Geld zurück je Kauf (R5) ---------- */

/**
 * Weitere Firma (99 €): erstattbar, solange für diese Firma kein PDF erzeugt
 * wurde und weniger als 14 Tage seit dem Kauf vergangen sind. Nur Anzeige.
 */
export function firmRefundStatus(
  firm: PlanFirmRow,
  documents: readonly { entityId?: string; pdfUrl?: string; timestamp?: string }[],
  now: Date = new Date(),
): RefundStatus {
  const purchased = Date.parse(firm.purchasedAt);
  if (firm.source === "member" || !Number.isFinite(purchased)) {
    return { refundable: false, reason: "kein_kauf", deadline: "" };
  }
  const deadline = new Date(purchased + REFUND_WINDOW_DAYS * DAY_MS).toISOString();
  if (firm.refundedAt) return { refundable: false, reason: "erstattet", deadline };
  const pdf = documents.some((doc) => {
    if (!firm.entityId || doc.entityId?.trim() !== firm.entityId || !doc.pdfUrl?.trim()) return false;
    const at = Date.parse(doc.timestamp ?? "");
    return !Number.isFinite(at) || at >= purchased;
  });
  if (pdf) return { refundable: false, reason: "pdf", deadline };
  if (now.getTime() >= Date.parse(deadline)) return { refundable: false, reason: "frist", deadline };
  return { refundable: true, reason: "", deadline };
}

/** Was „Weitere Firma hinzufügen“ für dieses Konto bedeutet. */
export type AddFirmOffer =
  | { kind: "member_included"; freeLeft: number }
  | { kind: "member_paid" }
  | { kind: "single_purchase" }
  | { kind: "none" };

export function addFirmOffer(account: PlanRow, firms: readonly PlanFirmRow[], now: Date = new Date()): AddFirmOffer {
  const state = planState(account, now);
  if (state === "refunded" || state === "deleted") return { kind: "none" };
  if (state === "member") {
    const freeLeft = memberFirmAllowance(account) - boundFirmCount(firms);
    return freeLeft > 0 ? { kind: "member_included", freeLeft } : { kind: "member_paid" };
  }
  return { kind: "single_purchase" };
}
