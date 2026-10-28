/**
 * Stripe-Webhooks für Preismodell v2. Greift nur bei Metadaten aus dem
 * v2-Checkout (`gobd_kind`, `gobd_plan=member`). Bestehende Abos ohne diese
 * Metadaten laufen unverändert über den alten Lifecycle.
 */
import type Stripe from "stripe";
import {
  addMonthsIso,
  applyChangePurchase,
  applyEntryPurchase,
  applyMemberEnded,
  applyMemberPurchase,
  applyMemberSubscriptionUpdate,
  applyRefund,
  emptyPlanRow,
  sessionAlreadyProcessed,
  type PlanRow,
} from "@/lib/plan";
import {
  PLAN_METADATA_AGB_ACCEPTED_AT,
  PLAN_METADATA_FIRM,
  PLAN_METADATA_KIND,
  PLAN_METADATA_OFFER_OPTOUT,
  PLAN_METADATA_PLAN,
  type PlanCheckoutKind,
} from "@/lib/plan-checkout";
import { findPlanByEmailStrict, findPlanBySubscription, savePlanRow } from "@/lib/plan-store";
import { periodEndIso } from "@/lib/kuendigung-stripe";
import {
  applyFirmChange,
  applyFirmPurchase,
  applyFirmRefund,
  boundFirm,
  boundFirmCount,
  type PlanFirmRow,
} from "@/lib/plan-firms";
import { listPlanFirmsByEmailStrict, savePlanFirmRow } from "@/lib/plan-firm-store";
import { extraFirmsEnabled, memberIncludedFirms, v2FirmPriceIds } from "@/lib/pricing-model";

type Metadata = Record<string, string> | null | undefined;

/** v2-Art aus Session-Metadaten, sonst `null` (alter Checkout). */
export function planKindFromMetadata(metadata: Metadata): PlanCheckoutKind | null {
  const kind = metadata?.[PLAN_METADATA_KIND];
  return kind === "entry" || kind === "change" || kind === "member" || kind === "firm" || kind === "addon" ||
    kind === "reactivate"
    ? kind
    : null;
}

/** Jahresplan-Abo (v2). Alte Monatsabos haben dieses Merkmal nicht. */
export function isAnnualPlanSubscription(subscription: { metadata?: Metadata }): boolean {
  return subscription.metadata?.[PLAN_METADATA_PLAN] === "member";
}

function unixIso(value: number | null | undefined): string {
  return typeof value === "number" && value > 0 ? new Date(value * 1000).toISOString() : "";
}

/** Reiner Übergang für checkout.session.completed (testbar ohne Store). */
export function planAfterCheckout(
  previous: PlanRow | null,
  input: {
    kind: PlanCheckoutKind;
    member: boolean;
    email: string;
    at: string;
    sessionId: string;
    eventId: string;
    customerId: string;
    subscriptionId: string;
    /** Weitere Firma eines Mitglieds (49 €), sonst 99 € einmalig. */
    memberFirm?: boolean;
    /** Einstieg: AGB-Bestätigung aus den Session-Metadaten. */
    agbAcceptedAt?: string;
    /** Widerspruch gegen Angebots-Mails (Checkout-Häkchen). */
    offerOptOut?: boolean;
  },
): PlanRow | null {
  if (input.kind === "entry") {
    return applyEntryPurchase(previous, input);
  }
  // Neues Modell: Reaktivierung = neuer Kauf mit Jahrespaket, Zugang wieder offen (auch ohne Zeile).
  if (input.kind === "reactivate") {
    if (previous && previous.processedSessions.split(",").includes(input.sessionId)) return previous;
    return { ...applyEntryPurchase(previous, { ...input, member: true }), reactivatedAt: input.at };
  }
  // Jahrespaket nachgebucht: dauerhaft (solange das Abo läuft), Jahr ab Erstkauf.
  if (input.kind === "addon") {
    if (!previous || previous.deletedAt) return null;
    return applyMemberPurchase(previous, input);
  }
  // Änderung, Mitgliedschaft und weitere Firma setzen einen bestehenden Plan voraus.
  if (!previous || previous.deletedAt) return null;
  if (input.kind === "change") return applyChangePurchase(previous, input);
  if (input.kind === "firm" && input.memberFirm) {
    // Mitglied: eine bezahlte Firma mehr im Kontingent (Menge am Abo folgt).
    if (previous.processedSessions.split(",").includes(input.sessionId)) return previous;
    return {
      ...applyFirmAccountWindow(previous, input),
      retentionUntil: previous.retentionUntil,
      memberExtraFirms: Math.max(0, previous.memberExtraFirms) + 1,
    };
  }
  if (input.kind === "firm") {
    // Konto-Frist = späteste Firmen-Frist, damit Konto-Prüfungen offen bleiben.
    return applyFirmAccountWindow(previous, input);
  }
  return applyMemberPurchase(previous, input);
}

function applyFirmAccountWindow(
  previous: PlanRow,
  input: { at: string; sessionId: string; eventId: string },
): PlanRow {
  if (previous.processedSessions.split(",").includes(input.sessionId)) return previous;
  const until = addMonthsIso(input.at, 12);
  return {
    ...previous,
    retentionUntil: Date.parse(previous.retentionUntil) >= Date.parse(until) ? previous.retentionUntil : until,
    processedSessions: [...previous.processedSessions.split(",").filter(Boolean), input.sessionId].slice(-20).join(","),
    lastEventId: input.eventId,
    updatedAt: input.at,
  };
}

/**
 * Firmen-Zeile zum Kauf (R1 neu). Einstieg: Platz `entry`. Ein Einstieg auf
 * ein schon laufendes Konto ist wie eine weitere Firma (99 €). Weitere Firma:
 * Platz `extra`. Änderung mit `entity_id`: Guthaben und Frist nur dieser Firma.
 * Rückgabe `null`: keine Firmen-Zeile zu schreiben.
 */
export function firmAfterCheckout(
  firms: readonly PlanFirmRow[],
  input: {
    kind: PlanCheckoutKind;
    accountExisted: boolean;
    memberFirm?: boolean;
    email: string;
    at: string;
    sessionId: string;
    entityId: string;
  },
): PlanFirmRow | null {
  const existing = firms.find((firm) => firm.slotId === input.sessionId) ?? null;
  if (input.kind === "firm" && input.memberFirm) return null; // Kontingent, kein eigener Platz
  if (input.kind === "entry" || input.kind === "firm") {
    if (existing) return null;
    const source = input.kind === "firm" || input.accountExisted ? "extra" : "entry";
    // Schon gebundene Firma nicht doppelt binden: neuer Platz bleibt dann frei.
    const entityId = input.entityId && !boundFirm(firms, input.entityId) ? input.entityId : "";
    return applyFirmPurchase(null, { email: input.email, sessionId: input.sessionId, source, at: input.at, entityId });
  }
  if (input.kind === "change" && input.entityId) {
    const firm = boundFirm(firms, input.entityId);
    if (!firm) return null;
    const next = applyFirmChange(firm, { sessionId: input.sessionId, at: input.at });
    return next === firm ? null : next;
  }
  return null;
}

export async function recordPlanCheckout(input: {
  session: Pick<Stripe.Checkout.Session, "id" | "metadata" | "subscription">;
  kind: PlanCheckoutKind;
  email: string;
  customerId: string;
  eventId: string;
  at: string;
  /** Menge am Firmen-Posten setzen (ohne Anteilsrechnung). Nur mit PRICING_EXTRA_FIRMS_ENABLED. */
  setMemberFirmQuantity?: (input: { subscriptionId: string; itemId: string; quantity: number }) => Promise<void>;
}): Promise<void> {
  const email = input.email.trim().toLowerCase();
  if (!email) throw new Error("v2-Kauf ohne E-Mail");
  const memberFirm = input.kind === "firm" && input.session.metadata?.[PLAN_METADATA_FIRM] === "member";
  const previous = await findPlanByEmailStrict(email);
  const subscription = input.session.subscription;
  const subscriptionId =
    typeof subscription === "string" ? subscription : subscription?.id ?? "";
  const accountLive = Boolean(previous && !previous.deletedAt && !previous.refundedAt);
  const entityId = input.session.metadata?.entity_id?.trim() ?? "";
  const firmsOn = extraFirmsEnabled();
  const firms = firmsOn ? await listPlanFirmsByEmailStrict(email) : [];
  const firm = !firmsOn ? null : firmAfterCheckout(firms, {
    kind: input.kind,
    accountExisted: accountLive && firms.length > 0,
    memberFirm,
    email,
    at: input.at,
    sessionId: input.session.id,
    entityId,
  });
  if (firm) await savePlanFirmRow(firm);
  // Änderung für eine Firma: Konto-Guthaben nicht zusätzlich erhöhen.
  if (input.kind === "change" && entityId && boundFirm(firms, entityId)) {
    if (previous) {
      const until = firm?.retentionUntil ?? "";
      const later = Date.parse(until) > Date.parse(previous.retentionUntil || "0") ? until : previous.retentionUntil;
      if (later !== previous.retentionUntil) {
        await savePlanRow({ ...previous, retentionUntil: later, lastEventId: input.eventId, updatedAt: input.at });
      }
    }
    return;
  }
  const next = planAfterCheckout(previous, {
    kind: input.kind,
    member: input.session.metadata?.[PLAN_METADATA_PLAN] === "member",
    email,
    at: input.at,
    sessionId: input.session.id,
    eventId: input.eventId,
    customerId: input.customerId,
    subscriptionId,
    memberFirm,
    agbAcceptedAt: input.session.metadata?.[PLAN_METADATA_AGB_ACCEPTED_AT] ?? "",
    offerOptOut: input.session.metadata?.[PLAN_METADATA_OFFER_OPTOUT] === "1",
  });
  if (next && next !== previous && firmsOn && input.setMemberFirmQuantity) {
    const quantity = memberFirmQuantityAfter(next, firms, input.kind);
    if (quantity !== null && next.memberSubscriptionId) {
      await input.setMemberFirmQuantity({
        subscriptionId: next.memberSubscriptionId,
        itemId: next.memberFirmItemId,
        quantity,
      });
      next.memberExtraFirms = quantity;
    }
  }
  if (!next) {
    // Bezahlte Änderung ohne Plan: nicht verlieren, sondern als Plan mit Guthaben anlegen.
    console.error("[plans] Kauf ohne bestehenden Plan", { kind: input.kind });
    const fallback = planAfterCheckout(emptyPlanRow(email, input.at), {
      kind: input.kind,
      member: input.kind === "member",
      email,
      at: input.at,
      sessionId: input.session.id,
      eventId: input.eventId,
      customerId: input.customerId,
      subscriptionId,
    });
    if (fallback) await savePlanRow(fallback);
    return;
  }
  if (next !== previous) await savePlanRow(next);
}

function cancelAtIso(subscription: Stripe.Subscription): string {
  if (subscription.cancel_at) return unixIso(subscription.cancel_at);
  if (subscription.cancel_at_period_end) return periodEndIso(subscription);
  return "";
}

/**
 * Neue Menge am Firmen-Posten nach einem Kauf, oder `null` (nichts zu tun).
 * Weitere Firma eines Mitglieds: Zähler wie gespeichert. Mitgliedschaft
 * nachträglich: belegte Firmen über dem Kontingent, ab Verlängerung (Punkt 4).
 */
export function memberFirmQuantityAfter(
  account: PlanRow,
  firms: readonly PlanFirmRow[],
  kind: PlanCheckoutKind,
): number | null {
  if (kind === "firm" && account.plan === "member") return account.memberExtraFirms;
  if (kind === "member") {
    const extra = Math.max(0, boundFirmCount(firms) - memberIncludedFirms());
    return extra > 0 ? extra : null;
  }
  return null;
}

/** Menge des Firmen-Postens (49 €/Jahr) am Abo; ohne Preis-ID unverändert. */
export function memberFirmItem(
  subscription: Pick<Stripe.Subscription, "items">,
): { extraFirms?: number; firmItemId?: string } {
  const priceId = v2FirmPriceIds().memberFirmYear;
  if (!priceId || !extraFirmsEnabled()) return {};
  const item = subscription.items?.data?.find((entry) => entry.price?.id === priceId);
  return item ? { extraFirms: item.quantity ?? 0, firmItemId: item.id } : { extraFirms: 0, firmItemId: "" };
}

/** customer.subscription.updated / deleted für Jahrespläne (Verlängerung kommt als updated). */
export async function recordPlanSubscriptionEvent(input: {
  subscription: Stripe.Subscription;
  eventId: string;
  at: string;
  deleted: boolean;
}): Promise<void> {
  const row = await findPlanBySubscription(input.subscription.id);
  if (!row) {
    console.warn("[plans] Jahresplan-Abo ohne Plan-Zeile");
    return;
  }
  if (row.lastEventId === input.eventId) return;
  const next = input.deleted || input.subscription.status === "canceled"
    ? applyMemberEnded(row, {
        at: input.at,
        eventId: input.eventId,
        endedAt: unixIso(input.subscription.ended_at) || input.at,
      })
    : applyMemberSubscriptionUpdate(row, {
        at: input.at,
        eventId: input.eventId,
        status: input.subscription.status,
        periodEnd: periodEndIso(input.subscription),
        cancelAt: cancelAtIso(input.subscription),
        ...memberFirmItem(input.subscription),
      });
  await savePlanRow(next);
}

/** Kaufarten des neuen Modells, deren volle Erstattung den Zugang sperrt (AGB § 9 Abs. 5). */
const V3_REFUND_KINDS = new Set<PlanCheckoutKind>(["entry", "member", "addon", "reactivate"]);

/**
 * Gehört die erstattete Zahlung zu einem Kauf des neuen Modells (v3)?
 * Nur wenn die Plan-Zeile `pricingModel = v3` trägt UND die Zahlung belegbar
 * dazugehört: Checkout-Session in `processedSessions`, Abo = Jahrespaket der
 * Zeile, oder v3-Metadaten der Einmalzahlung. Sonst nein (Altkunden, DS24,
 * v2-Altzeilen bleiben wie bisher).
 */
export function refundBelongsToV3Purchase(
  row: PlanRow,
  charge: { kind: PlanCheckoutKind | null; sessionId?: string; subscriptionId?: string },
): boolean {
  if (row.pricingModel.trim().toLowerCase() !== "v3") return false;
  const sessionId = charge.sessionId?.trim() ?? "";
  if (sessionId && sessionAlreadyProcessed(row, sessionId)) return true;
  const subscriptionId = charge.subscriptionId?.trim() ?? "";
  if (subscriptionId && subscriptionId === row.memberSubscriptionId.trim()) return true;
  return Boolean(charge.kind && V3_REFUND_KINDS.has(charge.kind));
}

export type V3RefundClass = "first" | "renewal" | "none";

/**
 * Art der erstatteten v3-Zahlung (Philip 28.10.):
 * - `first`: erster Kauf der Plan-Zeile, d. h. Einmalzahlung des Einstiegs
 *   (Option 1, Metadaten entry/member) oder die erste Rechnung des Jahrespakets
 *   (billing_reason `subscription_create`, auch das nachgebuchte Jahrespaket in
 *   seiner ersten Periode). Folge: AGB § 9 Abs. 5 (sofort sperren, Löschung 30 Tage).
 * - `renewal`: Verlängerungsrechnung (`subscription_cycle`) oder sonstige spätere
 *   Abo-Rechnung, sowie die Reaktivierung (eigener Zyklus, kein erster Kauf).
 *   Folge: wie gekündigtes Jahrespaket (Konto deaktiviert, reaktivierbar,
 *   Löschung 12 Monate nach Ende mit Hinweisen), kein refundedAt.
 * - `none`: kein v3-Kauf belegbar (Alt/DS24/v2/fremd) -> unverändert.
 * Abo-Zahlung ohne bekannten billing_reason: `none` (fail closed).
 */
export function classifyV3Refund(
  row: PlanRow,
  charge: { kind: PlanCheckoutKind | null; sessionId?: string; subscriptionId?: string; billingReason?: string },
): V3RefundClass {
  if (!refundBelongsToV3Purchase(row, charge)) return "none";
  const reason = charge.billingReason?.trim() ?? "";
  const subscriptionId = charge.subscriptionId?.trim() ?? "";
  if (charge.kind === "reactivate") return "renewal";
  if (subscriptionId) {
    if (!reason) return "none";
    if (reason !== "subscription_create") return "renewal";
    // Erste Rechnung des aktuellen Abos nach einer Reaktivierung = Reaktivierungskauf.
    if (row.reactivatedAt && subscriptionId === row.memberSubscriptionId.trim()) return "renewal";
    return "first";
  }
  return "first";
}

/**
 * charge.refunded unter v2 (R5): volle Erstattung eines Einstiegs beendet die
 * Mitgliedschaft (Abo sofort kündigen, ohne Anteilsrechnung) und sperrt den
 * Zugang dauerhaft, wie die DS24-Rückgabe (on_refund → permanentBlock).
 * Erstattungen selbst bleiben manuell; hier wird nie erstattet.
 */
export async function recordPlanRefund(input: {
  charge: Pick<Stripe.Charge, "refunded" | "metadata">;
  email: string;
  eventId: string;
  at: string;
  cancelSubscription: (subscriptionId: string) => Promise<void>;
  /** Checkout-Session der Zahlung (für weitere Firmen = Platz-ID). */
  sessionId?: string;
  /** Abo der Rechnung zur Zahlung (Jahrespaket), leer wenn keins. */
  subscriptionId?: string;
  /** billing_reason der Rechnung (subscription_create / subscription_cycle …), leer bei Einmalzahlung. */
  billingReason?: string;
  /** Nur bei "locked" (erster v3-Kauf voll erstattet): Kundenmail (lib/refund-mail). */
  onFirstPurchaseRefunded?: (row: PlanRow, previous: PlanRow) => Promise<unknown>;
}): Promise<"locked" | "locked_firm" | "deactivated" | "ignored"> {
  if (input.charge.refunded !== true) return "ignored"; // Teilerstattung: nur Inhaber-Hinweis.
  if (input.charge.metadata?.[PLAN_METADATA_KIND] === "change") return "ignored";
  const email = input.email.trim().toLowerCase();
  if (!email) return "ignored";
  if (input.charge.metadata?.[PLAN_METADATA_KIND] === "firm" && extraFirmsEnabled()) {
    // Weitere Firma (99 €) erstattet: nur dieser Platz wird gesperrt.
    const sessionId = input.sessionId?.trim() ?? "";
    const firms = await listPlanFirmsByEmailStrict(email);
    const slot = firms.find((firm) => firm.slotId === sessionId);
    if (!slot) {
      console.error("[plans] Erstattung einer weiteren Firma ohne Platz");
      return "ignored";
    }
    if (slot.refundedAt) return "ignored";
    await savePlanFirmRow(applyFirmRefund(slot, input.at));
    return "locked_firm";
  }
  const row = await findPlanByEmailStrict(email);
  if (!row || row.refundedAt) return "ignored";
  // Nur Käufe des neuen Modells (Philip 28.10.): erster Kauf -> AGB § 9 Abs. 5,
  // Verlängerung/Reaktivierung -> wie gekündigtes Jahrespaket.
  const kind = classifyV3Refund(row, {
    kind: planKindFromMetadata(input.charge.metadata),
    sessionId: input.sessionId,
    subscriptionId: input.subscriptionId,
    billingReason: input.billingReason,
  });
  if (kind === "none") return "ignored";
  // Erst die Zeile speichern, dann das Abo kündigen: die Kündigung löst
  // customer.subscription.deleted aus, das sonst die alte Zeile (ohne
  // refunded_at) zurückschreiben kann (E2E Fall 6, 28.10.).
  if (kind === "renewal") {
    await savePlanRow(applyMemberEnded(row, { at: input.at, eventId: input.eventId, endedAt: input.at }));
    if (row.memberSubscriptionId && row.memberStatus !== "canceled") {
      await input.cancelSubscription(row.memberSubscriptionId);
    }
    return "deactivated";
  }
  const refunded = applyRefund(row, { at: input.at, eventId: input.eventId });
  await savePlanRow(refunded);
  if (row.memberSubscriptionId && row.plan === "member" && row.memberStatus !== "canceled") {
    await input.cancelSubscription(row.memberSubscriptionId);
  }
  await input.onFirstPurchaseRefunded?.(refunded, row);
  return "locked";
}
