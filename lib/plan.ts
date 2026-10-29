/**
 * Preismodell v2: Plan je Konto (Mailbox des Käufers), bis zu 5 Firmen in
 * beiden Paketen (CoS 26.10., R1). Reine Funktionen: kein Stripe, kein Sheet.
 *
 * - `member`: Jahresmitgliedschaft aktiv. Alle Änderungen inklusive.
 * - `window`: ohne Mitgliedschaft, innerhalb der 12-Monats-Frist. Lesen,
 *   Download und Entwürfe offen; eine neue Version braucht eine bezahlte
 *   Änderung (49 €, ein Guthaben = eine neue Version, R2).
 * - `expired`: Frist abgelaufen. Download bleibt bis zur Löschung, kein Kauf.
 * - `deleted`: bei uns gelöscht (nur nach Philips Go; der Lauf ist AUS).
 */
import { formatBerlinDate } from "@/lib/kuendigung";
import {
  memberCancelNoticeMonths,
  renewalNoticeDaysBeforeCutoff,
  memberLateCancelEffect,
  PLAN_ACCESS_DAYS,
  PLAN_WINDOW_MONTHS,
  windowAfterMemberMonths,
  type LateCancelEffect,
} from "@/lib/pricing-model";

export type PlanKind = "member" | "single";
export type PlanState = "member" | "window" | "expired" | "refunded" | "deleted";

export type PlanRow = {
  email: string;
  plan: PlanKind;
  stripeCustomerId: string;
  purchasedAt: string;
  /** Ende der Vorhaltefrist ohne Mitgliedschaft (ISO). Bei Mitgliedern Merkwert. */
  retentionUntil: string;
  changeCredits: number;
  lastChangePaidAt: string;
  memberSubscriptionId: string;
  memberStatus: string;
  memberPeriodEnd: string;
  /** Geplantes Ende der Mitgliedschaft (Kündigung), ISO oder leer. */
  memberCancelAt: string;
  memberEndedAt: string;
  /** Bezahlte weitere Firmen am Abo (Menge des 49-€/Jahr-Postens). */
  memberExtraFirms: number;
  /** Stripe Subscription Item des Firmen-Postens, leer wenn keiner. */
  memberFirmItemId: string;
  /**
   * Erste PDF-Erzeugung im Konto je Firma (approvals 14:15, Punkt 1), Beleg
   * für die Geld-zurück-Regel. JSON `{ "<entityId>": "<ISO>" }`, `"_"` ohne
   * Firma. Muster, Vorschau und kostenlose Checks zählen nicht.
   */
  firstPdfAt: string;
  /** Verlängerungs-Erinnerung verschickt für dieses Laufzeitende (ISO), leer = keine. */
  renewalNoticeFor: string;
  /** Kündigung bzw. Rücknahme: Kanal (`konto` | `email`) und Zeitpunkt des Eingangs. */
  memberCancelChannel: string;
  memberCancelReceivedAt: string;
  /** AGB-Bestätigung im v2-Checkout (ISO, aus Stripe-Metadaten `agb_accepted_at`), leer bei Altzeilen. */
  agbAcceptedAt: string;
  notice30At: string;
  notice7At: string;
  deletedAt: string;
  /**
   * Neues Modell (28.10.): Ende des Zugangs ohne Jahrespaket (Kauf + 30 Tage),
   * ISO. Danach ist alles gesperrt (Konto, Einladungen, Änderungen, Download).
   * Leer bei Altzeilen: dann gilt wie bisher `retentionUntil`.
   */
  accessUntil: string;
  /** Modell-Marker: `v3` = neues Modell (28.10.). Leer = Altzeile (v2 26.10.). Legacy/DS24/Comp haben keine Plan-Zeile. */
  pricingModel: string;
  /** Letzte Reaktivierung (ISO), leer = nie. */
  reactivatedAt: string;
  /** Widerspruch gegen Angebots-Mails (ISO), leer = kein Widerspruch. Sperrt die 7-Tage-Mail. */
  offerOptOutAt: string;
  /** Kauf erstattet (R5): Zugang dauerhaft gesperrt wie bei der DS24-Rückgabe. */
  refundedAt: string;
  /** Verarbeitete Checkout-Sessions (Idempotenz), kommagetrennt, die letzten 20. */
  processedSessions: string;
  lastEventId: string;
  updatedAt: string;
};

export const PLAN_SHEET_COLUMNS = [
  "email",
  "plan",
  "stripe_customer_id",
  "purchased_at",
  "retention_until",
  "change_credits",
  "last_change_paid_at",
  "member_subscription_id",
  "member_status",
  "member_period_end",
  "member_cancel_at",
  "member_ended_at",
  "notice30_at",
  "notice7_at",
  "deleted_at",
  "refunded_at",
  "processed_sessions",
  "last_event_id",
  "updated_at",
  "member_extra_firms",
  "member_firm_item_id",
  "first_pdf_at",
  "renewal_notice_for",
  "member_cancel_channel",
  "member_cancel_received_at",
  // Neu 26.10.: nur ans Ende anhängen, Altzeilen bleiben leer.
  "agb_accepted_at",
  // Neu 28.10. (neues Preismodell): nur ans Ende anhängen.
  "access_until",
  "pricing_model",
  "reactivated_at",
  "offer_opt_out_at",
] as const;

const MEMBER_LIVE_STATUSES = new Set(["active", "trialing", "past_due"]);

export function emptyPlanRow(email: string, at: string): PlanRow {
  return {
    email: email.trim().toLowerCase(),
    plan: "single",
    stripeCustomerId: "",
    purchasedAt: "",
    retentionUntil: "",
    changeCredits: 0,
    lastChangePaidAt: "",
    memberSubscriptionId: "",
    memberStatus: "",
    memberPeriodEnd: "",
    memberCancelAt: "",
    memberEndedAt: "",
    memberExtraFirms: 0,
    memberFirmItemId: "",
    firstPdfAt: "",
    renewalNoticeFor: "",
    memberCancelChannel: "",
    memberCancelReceivedAt: "",
    agbAcceptedAt: "",
    accessUntil: "",
    pricingModel: "",
    reactivatedAt: "",
    offerOptOutAt: "",
    notice30At: "",
    notice7At: "",
    deletedAt: "",
    refundedAt: "",
    processedSessions: "",
    lastEventId: "",
    updatedAt: at,
  };
}

/**
 * Kalendermonate addieren (UTC-Bestandteile), Monatsende geklemmt:
 * 31.01. + 1 Monat = 28./29.02. Negativ für „3 Monate vorher“.
 */
export function addMonthsIso(iso: string, months: number): string {
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return "";
  const date = new Date(time);
  const day = date.getUTCDate();
  const target = new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth() + months,
      1,
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds(),
      date.getUTCMilliseconds(),
    ),
  );
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target.toISOString();
}

function later(a: string, b: string): string {
  const ta = Date.parse(a);
  const tb = Date.parse(b);
  if (!Number.isFinite(ta)) return Number.isFinite(tb) ? b : "";
  if (!Number.isFinite(tb)) return a;
  return ta >= tb ? a : b;
}

/** Frist nach dem Einstiegskauf: Kauftag + 12 Monate (Philip 26.10., Antwort 5). */
export function retentionAfterPurchase(purchasedAt: string): string {
  return addMonthsIso(purchasedAt, PLAN_WINDOW_MONTHS);
}

/** Frist nach einer bezahlten Änderung: Zahlung + 12 Monate (Antwort 6). Nie kürzer als vorher. */
export function retentionAfterChange(previousUntil: string, paidAt: string): string {
  return later(previousUntil, addMonthsIso(paidAt, PLAN_WINDOW_MONTHS));
}

/** Option 1 (28.10.): Zugang bis Kauf + 30 Tage; ab genau diesem Zeitpunkt gesperrt. */
export function accessAfterPurchase(purchasedAt: string): string {
  const time = Date.parse(purchasedAt);
  if (!Number.isFinite(time)) return "";
  return new Date(time + PLAN_ACCESS_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

/**
 * Jahrespaket nachgebucht innerhalb der 30 Tage (Philip 28.10., c): das Jahr
 * läuft ab dem ERSTEN Kauf, endet also bei Erstkauf + 12 Monate.
 */
export function addonYearEnd(firstPurchasedAt: string, bookedAt: string): string {
  return addMonthsIso(firstPurchasedAt || bookedAt, 12) || addMonthsIso(bookedAt, 12);
}

/**
 * Philip 28.10. (3): deaktiviertes Konto ist reaktivierbar bis 12 Monate nach
 * dem Kauf (Option 1) bzw. nach dem Ende des Jahrespakets; danach Löschung
 * (Lauf NICHT gebaut). Reine Berechnung aus gespeicherten Daten, leer wenn
 * nicht bestimmbar oder erstattet.
 */
export function reactivatableUntil(
  row: Pick<PlanRow, "purchasedAt" | "memberEndedAt" | "refundedAt" | "plan"> & Partial<Pick<PlanRow, "reactivatedAt">>,
): string {
  if (row.refundedAt) return "";
  // Nach Reaktivierung zählt der letzte Kauf (reactivated_at), purchased_at bleibt der Erstkauf.
  const lastBuy = [row.purchasedAt, row.reactivatedAt ?? ""].filter((v) => Number.isFinite(Date.parse(v))).sort().pop() ?? "";
  const base = row.plan !== "member" && row.memberEndedAt && Date.parse(row.memberEndedAt) > Date.parse(lastBuy || "0")
    ? row.memberEndedAt
    : lastBuy;
  return base ? addMonthsIso(base, 12) : "";
}

/** R3: Frist nach Ende der Mitgliedschaft, ab dem Ende (konfigurierbar). */
export function retentionAfterMemberEnd(
  endedAt: string,
  months: number = windowAfterMemberMonths(),
): string {
  return addMonthsIso(endedAt, months);
}

function isMemberLive(row: PlanRow): boolean {
  if (row.plan !== "member") return false;
  return MEMBER_LIVE_STATUSES.has(row.memberStatus || "active");
}

export function planState(row: PlanRow, now: Date = new Date()): PlanState {
  if (row.deletedAt) return "deleted";
  if (row.refundedAt) return "refunded";
  if (isMemberLive(row)) return "member";
  // Neues Modell: Zugangsende (Kauf + 30 Tage); Altzeilen ohne Wert: Frist wie bisher.
  // Zeile ohne jedes Datum (nicht aus einem Kauf): nicht sperren, wie „keine Zeile“.
  if (!row.accessUntil && !row.retentionUntil && !row.memberSubscriptionId) return "window";
  const until = Date.parse(row.accessUntil || row.retentionUntil);
  if (Number.isFinite(until) && now.getTime() < until) return "window";
  return "expired";
}

export type PlanAccess = {
  state: PlanState;
  writesOpen: boolean;
  downloadsOpen: boolean;
  newVersionAllowed: boolean;
  canBuyChange: boolean;
  canBecomeMember: boolean;
  /** Zugang abgelaufen (Option 1 nach 30 Tagen bzw. Abo beendet): Reaktivierung anbieten. */
  canReactivate: boolean;
  writeMessage: string;
  versionMessage: string;
  downloadMessage: string;
};

export const PLAN_EXPIRED_WRITE_MESSAGE =
  "Ihr Konto ist deaktiviert."; // growth/landing-v3.md § 5 (H1), 1:1; übriger Platzhaltertext entfernt
/** Knopf zur Reaktivierung (Wortlaut Philip 28.10., exakt). */
export const PLAN_REACTIVATE_LABEL = "Konto jetzt für 99 € netto + 49 €/Jahr wieder komplett aktivieren";
export const PLAN_REACTIVATE_HREF = "/checkout/reaktivieren";
export const PLAN_ADDON_HREF = "/checkout/jahrespaket";
export const PLAN_VERSION_NEEDS_CHANGE_MESSAGE =
  "Für eine neue Version beauftragen Sie bitte zuerst eine Änderung im Konto oder werden Mitglied.";
export const PLAN_REFUNDED_MESSAGE =
  "Der Kauf wurde erstattet. Der Zugang ist damit beendet.";
export const PLAN_DELETED_MESSAGE =
  "Die Dokumentation wurde nach Ablauf der Vorhaltefrist bei uns gelöscht. Ihr PDF haben Sie bereits erhalten.";

export function planAccess(row: PlanRow, now: Date = new Date()): PlanAccess {
  const state = planState(row, now);
  switch (state) {
    case "member":
      return {
        state,
        writesOpen: true,
        downloadsOpen: true,
        newVersionAllowed: true,
        canBuyChange: false,
        canBecomeMember: false,
        canReactivate: false,
        writeMessage: "",
        versionMessage: "",
        downloadMessage: "",
      };
    case "window":
      return {
        state,
        writesOpen: true,
        downloadsOpen: true,
        // Neues Modell: keine 49-€-Einzeländerung; innerhalb der 30 Tage alles offen.
        newVersionAllowed: true,
        canBuyChange: false,
        canBecomeMember: row.plan !== "member",
        canReactivate: false,
        writeMessage: "",
        versionMessage: "",
        downloadMessage: "",
      };
    case "expired":
      return {
        state,
        // Philip 28.10. (a): nach Tag 30 alles gesperrt, auch der PDF-Download.
        writesOpen: false,
        downloadsOpen: false,
        newVersionAllowed: false,
        canBuyChange: false,
        canBecomeMember: false,
        canReactivate: true,
        writeMessage: PLAN_EXPIRED_WRITE_MESSAGE,
        versionMessage: PLAN_EXPIRED_WRITE_MESSAGE,
        downloadMessage: PLAN_EXPIRED_WRITE_MESSAGE,
      };
    case "refunded":
      // Wie die Digistore24-Rückgabe (on_refund): dauerhaft gesperrt, auch Downloads.
      return {
        state,
        writesOpen: false,
        downloadsOpen: false,
        newVersionAllowed: false,
        canBuyChange: false,
        canBecomeMember: false,
        canReactivate: false,
        writeMessage: PLAN_REFUNDED_MESSAGE,
        versionMessage: PLAN_REFUNDED_MESSAGE,
        downloadMessage: PLAN_REFUNDED_MESSAGE,
      };
    case "deleted":
      return {
        state,
        writesOpen: false,
        downloadsOpen: false,
        newVersionAllowed: false,
        canBuyChange: false,
        canBecomeMember: false,
        canReactivate: false,
        writeMessage: PLAN_DELETED_MESSAGE,
        versionMessage: PLAN_DELETED_MESSAGE,
        downloadMessage: PLAN_DELETED_MESSAGE,
      };
  }
}

/* ---------- Kündigung der Mitgliedschaft (Stichtag, R4) ---------- */

export type MemberCancelPlan = {
  /** Letzter Tag für eine Kündigung zum laufenden Ende. */
  deadline: string;
  beforeDeadline: boolean;
  /** Wirksames Ende der Mitgliedschaft. */
  effectiveAt: string;
  /** true: Stripe `cancel_at_period_end`; false: `cancel_at` = effectiveAt. */
  atCurrentPeriodEnd: boolean;
};

/**
 * Stichtag = Periodenende − 3 Monate (konfigurierbar). Bis einschließlich
 * Stichtag wirkt die Kündigung zum laufenden Ende. Danach (R4, Default) zum
 * Ende der folgenden Laufzeit: Periodenende + 12 Monate. Der Button bleibt
 * aktiv; das Konto zeigt das Datum vorher an.
 */
export function memberCancelPlan(
  periodEnd: string,
  now: Date = new Date(),
  options?: { noticeMonths?: number; lateEffect?: LateCancelEffect },
): MemberCancelPlan | null {
  if (!Number.isFinite(Date.parse(periodEnd))) return null;
  const noticeMonths = options?.noticeMonths ?? memberCancelNoticeMonths();
  const lateEffect = options?.lateEffect ?? memberLateCancelEffect();
  const deadline = addMonthsIso(periodEnd, -noticeMonths);
  const beforeDeadline = now.getTime() <= Date.parse(deadline);
  if (beforeDeadline || lateEffect === "current_term") {
    return { deadline, beforeDeadline, effectiveAt: periodEnd, atCurrentPeriodEnd: true };
  }
  return {
    deadline,
    beforeDeadline,
    effectiveAt: addMonthsIso(periodEnd, 12),
    atCurrentPeriodEnd: false,
  };
}

/** Ein Satz fürs Konto, vor dem Klick. */
export function memberCancelPreviewLine(plan: MemberCancelPlan): string {
  const end = formatBerlinDate(plan.effectiveAt);
  const deadline = formatBerlinDate(plan.deadline);
  if (plan.beforeDeadline) {
    return `Wenn Sie bis zum ${deadline} kündigen, endet die Mitgliedschaft zum ${end}.`;
  }
  if (plan.atCurrentPeriodEnd) {
    return `Die Mitgliedschaft endet bei Kündigung zum ${end}.`;
  }
  return `Der Kündigungsstichtag (${deadline}) ist vorbei. Wenn Sie jetzt kündigen, verlängert sich die Mitgliedschaft noch einmal und endet zum ${end}.`;
}

/* ---------- Webhook-Übergänge (rein) ---------- */

export function sessionAlreadyProcessed(row: PlanRow, sessionId: string): boolean {
  const id = sessionId.trim();
  if (!id) return false;
  return row.processedSessions.split(",").map((item) => item.trim()).includes(id);
}

function rememberSession(row: PlanRow, sessionId: string): string {
  const list = row.processedSessions
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  if (sessionId && !list.includes(sessionId)) list.push(sessionId);
  return list.slice(-20).join(",");
}

/** Einstiegskauf (mit oder ohne Mitgliedschaft). Ein Neustart nach Löschung beginnt neu. */
export function applyEntryPurchase(
  previous: PlanRow | null,
  input: {
    email: string;
    at: string;
    sessionId: string;
    eventId: string;
    customerId: string;
    member: boolean;
    subscriptionId: string;
    /** AGB-Bestätigung aus dem Checkout (ISO), leer = unverändert. */
    agbAcceptedAt?: string;
    /** Widerspruch gegen Angebots-Mails im Checkout. */
    offerOptOut?: boolean;
  },
): PlanRow {
  const base = previous && !previous.deletedAt ? previous : emptyPlanRow(input.email, input.at);
  if (previous && sessionAlreadyProcessed(previous, input.sessionId)) return previous;
  return {
    ...base,
    email: input.email.trim().toLowerCase(),
    plan: input.member ? "member" : base.plan === "member" && isMemberLive(base) ? "member" : "single",
    stripeCustomerId: input.customerId || base.stripeCustomerId,
    purchasedAt: input.at,
    retentionUntil: later(base.retentionUntil, retentionAfterPurchase(input.at)),
    // Option 1: 30 Tage ab Kauf; ein weiterer Kauf (weitere Firma, Reaktivierung) verkürzt nie.
    accessUntil:
      base.accessUntil && Date.parse(base.accessUntil) > Date.parse(input.at)
        ? later(base.accessUntil, accessAfterPurchase(input.at))
        : accessAfterPurchase(input.at),
    memberSubscriptionId: input.member ? input.subscriptionId : base.memberSubscriptionId,
    memberStatus: input.member ? "active" : base.memberStatus,
    memberPeriodEnd: input.member
      ? addMonthsIso(input.at, 12)
      : base.memberPeriodEnd,
    memberCancelAt: input.member ? "" : base.memberCancelAt,
    memberEndedAt: input.member ? "" : base.memberEndedAt,
    notice30At: "",
    notice7At: "",
    deletedAt: "",
    // Ein neuer Einstieg ist ein neuer Kauf (wie eine neue DS24-Bestellung).
    refundedAt: "",
    agbAcceptedAt: input.agbAcceptedAt?.trim() || base.agbAcceptedAt,
    pricingModel: "v3",
    offerOptOutAt: input.offerOptOut ? base.offerOptOutAt || input.at : base.offerOptOutAt,
    processedSessions: rememberSession(base, input.sessionId),
    lastEventId: input.eventId,
    updatedAt: input.at,
  };
}

/** Bezahlte Änderung: ein Guthaben, Frist = Zahlung + 12 Monate. */
export function applyChangePurchase(
  previous: PlanRow,
  input: { at: string; sessionId: string; eventId: string },
): PlanRow {
  if (sessionAlreadyProcessed(previous, input.sessionId)) return previous;
  return {
    ...previous,
    changeCredits: Math.max(0, previous.changeCredits) + 1,
    lastChangePaidAt: input.at,
    retentionUntil: retentionAfterChange(previous.retentionUntil, input.at),
    notice30At: "",
    notice7At: "",
    processedSessions: rememberSession(previous, input.sessionId),
    lastEventId: input.eventId,
    updatedAt: input.at,
  };
}

/** Mitgliedschaft nachträglich (nur innerhalb der Frist, R7). Erstes Jahr beim Kauf. */
export function applyMemberPurchase(
  previous: PlanRow,
  input: { at: string; sessionId: string; eventId: string; subscriptionId: string },
): PlanRow {
  if (sessionAlreadyProcessed(previous, input.sessionId)) return previous;
  return {
    ...previous,
    plan: "member",
    memberSubscriptionId: input.subscriptionId,
    memberStatus: "active",
    // Jahrespaket nachgebucht: das Jahr läuft ab dem ersten Kauf (Philip 28.10., c).
    memberPeriodEnd: addonYearEnd(previous.purchasedAt, input.at),
    memberCancelAt: "",
    memberEndedAt: "",
    notice30At: "",
    notice7At: "",
    processedSessions: rememberSession(previous, input.sessionId),
    lastEventId: input.eventId,
    updatedAt: input.at,
  };
}

/** Stripe-Abo aktualisiert (Status, Periodenende, geplante Kündigung). */
export function applyMemberSubscriptionUpdate(
  previous: PlanRow,
  input: {
    at: string;
    eventId: string;
    status: string;
    periodEnd: string;
    cancelAt: string;
    /** Menge des Firmen-Postens, `undefined` = unverändert. */
    extraFirms?: number;
    firmItemId?: string;
  },
): PlanRow {
  return {
    ...previous,
    plan: "member",
    memberExtraFirms: input.extraFirms ?? previous.memberExtraFirms,
    memberFirmItemId: input.firmItemId ?? previous.memberFirmItemId,
    memberStatus: input.status,
    memberPeriodEnd: input.periodEnd || previous.memberPeriodEnd,
    memberCancelAt: input.cancelAt,
    // Kündigung zurückgenommen: Erinnerungen gelten nicht mehr.
    ...(previous.memberCancelAt && !input.cancelAt ? { notice30At: "", notice7At: "" } : {}),
    lastEventId: input.eventId,
    updatedAt: input.at,
  };
}

/**
 * Mitgliedschaft beendet: zurück auf `single`. Frist nach R3 ab dem Ende,
 * Default 0: sofort abgelaufen, Löschung zum Ablauf (Philip 26.10. 13:57).
 * Erinnerungen, die vor dem Ende schon liefen, bleiben stehen.
 */
export function applyMemberEnded(
  previous: PlanRow,
  input: { at: string; eventId: string; endedAt: string; afterMonths?: number },
): PlanRow {
  const endedAt = input.endedAt || input.at;
  return {
    ...previous,
    plan: "single",
    memberStatus: "canceled",
    memberEndedAt: endedAt,
    memberCancelAt: "",
    memberExtraFirms: 0,
    retentionUntil: retentionAfterMemberEnd(endedAt, input.afterMonths),
    // Neues Modell: Zugang endet mit dem Abo (nie vor dem Ende der 30 Tage).
    accessUntil: later(previous.accessUntil, endedAt),
    lastEventId: input.eventId,
    updatedAt: input.at,
  };
}

/** Eine neue Version wurde gespeichert: bei `window` ein Guthaben verbrauchen. */
export function consumeChangeCredit(previous: PlanRow, at: string, now: Date = new Date()): PlanRow {
  if (planState(previous, now) !== "window") return previous;
  if (previous.changeCredits <= 0) return previous;
  return { ...previous, changeCredits: previous.changeCredits - 1, updatedAt: at };
}

/* ---------- Lösch-Lauf (nur Auswahl) ---------- */

export type RetentionCandidate = "notice30" | "notice7" | "delete" | "none";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Was der Lauf für eine Zeile täte. Löschen erst, wenn die Frist vorbei ist
 * und beide Erinnerungen versandt wurden. Mitglieder und gelöschte Zeilen nie.
 */
/**
 * Löschdatum: ohne Mitgliedschaft das Fristende. Bei gekündigter, noch
 * laufender Mitgliedschaft das geplante Ende (+ R3-Monate, Default 0).
 * Laufende Mitgliedschaft ohne Kündigung: kein Löschdatum.
 */
export function deletionDueAt(row: PlanRow, now: Date = new Date()): string {
  const state = planState(row, now);
  if (state === "deleted" || state === "refunded") return "";
  if (state === "member") {
    return row.memberCancelAt ? retentionAfterMemberEnd(row.memberCancelAt) : "";
  }
  return row.retentionUntil;
}

export function retentionCandidate(row: PlanRow, now: Date = new Date()): RetentionCandidate {
  const state = planState(row, now);
  if (state === "deleted" || state === "refunded") return "none";
  const due = deletionDueAt(row, now);
  if (!due) return "none";
  // Eine noch laufende Mitgliedschaft wird nie gelöscht, nur erinnert.
  if (state === "member" && Date.parse(due) <= now.getTime()) return "none";
  const until = Date.parse(due);
  if (!Number.isFinite(until)) return "none";
  const left = until - now.getTime();
  if (left <= 0) {
    // Verspätete Läufe holen die letzte Erinnerung nach und löschen frühestens 7 Tage danach.
    if (!row.notice7At) return "notice7";
    const sent = Date.parse(row.notice7At);
    return Number.isFinite(sent) && now.getTime() - sent >= 7 * DAY_MS ? "delete" : "none";
  }
  if (left <= 7 * DAY_MS) return row.notice7At ? "none" : "notice7";
  if (left <= 30 * DAY_MS) return row.notice30At ? "none" : "notice30";
  return "none";
}

/* ---------- Erste PDF je Firma (Beleg, approvals 14:15 Punkt 1) ---------- */

const NO_FIRM_KEY = "_";

export function firstPdfMap(row: Pick<PlanRow, "firstPdfAt">): Record<string, string> {
  if (!row.firstPdfAt) return {};
  try {
    const parsed = JSON.parse(row.firstPdfAt) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string" && Number.isFinite(Date.parse(entry[1])),
      ),
    );
  } catch {
    return {};
  }
}

/** Erste PDF einer Firma vermerken. Ein späteres PDF ändert den Zeitpunkt nicht. */
export function recordFirstPdf(previous: PlanRow, entityId: string, at: string): PlanRow {
  const key = entityId.trim() || NO_FIRM_KEY;
  const map = firstPdfMap(previous);
  if (map[key]) return previous;
  return { ...previous, firstPdfAt: JSON.stringify({ ...map, [key]: at }), updatedAt: at };
}

/** Erste PDF dieser Firma (oder irgendeiner, ohne entityId), ISO oder leer. */
export function firstPdfFor(row: Pick<PlanRow, "firstPdfAt">, entityId?: string): string {
  const map = firstPdfMap(row);
  if (entityId !== undefined) return map[entityId.trim() || NO_FIRM_KEY] ?? "";
  return Object.values(map).sort()[0] ?? "";
}

/* ---------- Geld-zurück v2 (R5, Philip 26.10. 13:59) ---------- */

export const REFUND_WINDOW_DAYS = 14;

export type RefundStatus = {
  refundable: boolean;
  /** `""` erstattbar, sonst der Grund. */
  reason: "" | "pdf" | "frist" | "erstattet" | "kein_kauf";
  /** Letzter Zeitpunkt (ISO), bis zu dem erstattet werden kann. */
  deadline: string;
};

/**
 * Volle Erstattung (Einstieg + erstes Mitgliedsjahr) nur, solange kein PDF
 * erzeugt wurde UND weniger als 14 Tage seit dem Kauf vergangen sind.
 * Danach keine Erstattung. Nur Anzeige: Erstattungen bleiben manuell.
 */
export function refundStatus(
  row: Pick<PlanRow, "purchasedAt" | "refundedAt"> & Partial<Pick<PlanRow, "firstPdfAt">>,
  documents: readonly { pdfUrl?: string; timestamp?: string }[],
  now: Date = new Date(),
): RefundStatus {
  const purchased = Date.parse(row.purchasedAt);
  if (!Number.isFinite(purchased)) return { refundable: false, reason: "kein_kauf", deadline: "" };
  const deadline = new Date(purchased + REFUND_WINDOW_DAYS * DAY_MS).toISOString();
  if (row.refundedAt) return { refundable: false, reason: "erstattet", deadline };
  const pdfSincePurchase = documents.some((doc) => {
    if (!doc.pdfUrl?.trim()) return false;
    const at = Date.parse(doc.timestamp ?? "");
    // Ohne Zeitstempel zählt das PDF (fail closed: keine Erstattungszusage).
    return !Number.isFinite(at) || at >= purchased;
  });
  // Beleg aus dem Plan: erste PDF-Erzeugung je Firma seit dem Kauf.
  const logged = Object.values(firstPdfMap({ firstPdfAt: row.firstPdfAt ?? "" })).some(
    (at) => Date.parse(at) >= purchased,
  );
  if (pdfSincePurchase || logged) return { refundable: false, reason: "pdf", deadline };
  if (now.getTime() >= Date.parse(deadline)) return { refundable: false, reason: "frist", deadline };
  return { refundable: true, reason: "", deadline };
}

export function refundStatusLine(status: RefundStatus): string {
  const until = formatBerlinDate(status.deadline);
  switch (status.reason) {
    case "":
      return `Volle Erstattung möglich bis ${until}, solange kein PDF erzeugt wird.`;
    case "pdf":
      return "Keine Erstattung mehr: Es wurde bereits ein PDF erzeugt.";
    case "frist":
      return `Keine Erstattung mehr: Die 14 Tage sind seit ${until} vorbei.`;
    case "erstattet":
      return "Der Kauf wurde erstattet.";
    case "kein_kauf":
      return "";
  }
}

/** Erstattung (charge.refunded): dauerhaft gesperrt, wie DS24 on_refund. */
export function applyRefund(previous: PlanRow, input: { at: string; eventId: string }): PlanRow {
  if (previous.refundedAt) return previous;
  return {
    ...previous,
    refundedAt: input.at,
    changeCredits: 0,
    memberStatus: previous.plan === "member" ? "canceled" : previous.memberStatus,
    memberEndedAt: previous.plan === "member" ? input.at : previous.memberEndedAt,
    plan: "single",
    lastEventId: input.eventId,
    updatedAt: input.at,
  };
}

/* ---------- Erinnerung vor der Verlängerung (nur Auswahl, kein Versand) ---------- */

/**
 * Fällig, wenn eine laufende, nicht gekündigte Mitgliedschaft das Fenster
 * „Stichtag − N Tage“ erreicht hat, der Stichtag noch nicht vorbei ist und
 * für dieses Laufzeitende noch keine Erinnerung vermerkt ist.
 */
export function renewalNoticeDue(
  row: PlanRow,
  now: Date = new Date(),
  options?: { daysBeforeCutoff?: number; noticeMonths?: number },
): boolean {
  if (planState(row, now) !== "member" || row.memberCancelAt) return false;
  if (!Number.isFinite(Date.parse(row.memberPeriodEnd))) return false;
  if (row.renewalNoticeFor === row.memberPeriodEnd) return false;
  const cutoff = Date.parse(addMonthsIso(row.memberPeriodEnd, -(options?.noticeMonths ?? memberCancelNoticeMonths())));
  const from = cutoff - (options?.daysBeforeCutoff ?? renewalNoticeDaysBeforeCutoff()) * DAY_MS;
  return now.getTime() >= from && now.getTime() <= cutoff;
}

/**
 * Kündigung bzw. Rücknahme vermerken (Konto-Klick oder per E-Mail im Admin).
 * Gleiche Wirkung, nur Kanal und Eingang unterscheiden sich.
 */
export function applyMemberCancelRecord(
  previous: PlanRow,
  input: { effectiveAt: string; channel: "konto" | "email"; receivedAt: string; at: string },
): PlanRow {
  return {
    ...previous,
    memberCancelAt: input.effectiveAt,
    memberCancelChannel: input.channel,
    memberCancelReceivedAt: input.receivedAt,
    ...(input.effectiveAt ? {} : { notice30At: "", notice7At: "" }),
    updatedAt: input.at,
  };
}
