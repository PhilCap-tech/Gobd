/**
 * Interne Hinweismail an den Inhaber für weitere Ereignisse
 * (Freigabe Philip, 2026-10-26 08:58). Gleicher Empfänger wie der
 * Kaufhinweis ({@link CHECKOUT_NOTICE_TO}), eine Mail pro Ereignis über den
 * Mail-Ledger (`owner-notice:<art>:<id>`), versendet nach der Antwort.
 * Testadressen (Ampel-Regel) und gelistete Testfirmen werden übersprungen.
 * Prebuild und Checks senden nie, außer der Check hat den Versand gestubbt
 * und {@link setOwnerNoticeTestMode} gesetzt. Wirft nie in den Kundenfluss.
 */
import { createHash } from "node:crypto";
import { isAmpelTestEmail } from "@/lib/ampel-stats";
import { CHECKOUT_NOTICE_TO } from "@/lib/checkout-notice";
import { formatBerlinDateTime } from "@/lib/delivery-templates";
import { scheduleLeadNoticeAfterResponse } from "@/lib/lead-notice";
import { automatedRunForbidsLiveWrites } from "@/lib/live-write-guard";
import type { MailResult } from "@/lib/mail";
import { sendDedupedEmail } from "@/lib/mail-dedupe";
import { escapeHtml } from "@/lib/mail-layout";
import { isTestEntity } from "@/lib/test-entities";

export type OwnerNoticeKind =
  | "doc"
  | "subscription"
  | "payment-failed"
  | "refund"
  | "dispute"
  | "readiness"
  | "kanzlei-optin"
  | "kanzlei-optout"
  | "account";

export type OwnerNoticeInput = {
  kind: OwnerNoticeKind;
  /** Eindeutige Ereignis-ID innerhalb der Art, z. B. `<docId>:<version>`. */
  id: string;
  /** Kurzer Titel, z. B. „Doku abgeschlossen“. */
  title: string;
  email?: string | null;
  company?: string | null;
  entityId?: string | null;
  /** `live` oder `test`; leer, wenn unbekannt. */
  mode?: "live" | "test" | "";
  /** Weitere Fakten (Bezeichnung, Wert). */
  facts?: [string, string][];
  /** Unix-Millisekunden. Standard: jetzt. */
  at?: number | null;
};

export type OwnerNoticeResult = MailResult & { skipped?: boolean };

let testMode = false;

/** Nur Checks: erlaubt den (gestubbten) Versand während eines automatisierten Laufs. */
export function setOwnerNoticeTestMode(enabled: boolean): void {
  testMode = enabled;
}

function oneLine(value: string | null | undefined): string {
  return (value ?? "").replace(/[\r\n\u0000]+/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * SHA-256 (hex) der getrimmten, kleingeschriebenen Adresse. Für Ledger-Schlüssel,
 * damit weder Schlüssel noch gespeicherter Dedupe-Eintrag die Adresse enthalten.
 */
export function ownerNoticeEmailHash(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase(), "utf8").digest("hex");
}

export function ownerNoticeMailKey(kind: OwnerNoticeKind, id: string): string {
  return `owner-notice:${kind}:${id.trim()}`;
}

/** Mail-Testdomains, nur für Inhaber-Hinweise (inkl. Subdomains). */
const OWNER_NOTICE_TEST_DOMAINS = ["example.invalid", "resend.dev"];

/** Ampel-Testadressen plus example.invalid und resend.dev (z. B. delivered@resend.dev). */
export function isOwnerNoticeTestEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return false;
  if (isAmpelTestEmail(normalized)) return true;
  const at = normalized.lastIndexOf("@");
  const domain = at >= 0 ? normalized.slice(at + 1) : "";
  return OWNER_NOTICE_TEST_DOMAINS.some((test) => domain === test || domain.endsWith(`.${test}`));
}

export function ownerNoticeDue(input: OwnerNoticeInput): boolean {
  if (!oneLine(input.id)) return false;
  const email = oneLine(input.email).toLowerCase();
  if (email && isOwnerNoticeTestEmail(email)) return false;
  if (email && email === CHECKOUT_NOTICE_TO.toLowerCase()) return false;
  if (isTestEntity(input.entityId)) return false;
  return true;
}

export function buildOwnerNoticeMail(input: OwnerNoticeInput): {
  subject: string;
  text: string;
  html: string;
} {
  const email = oneLine(input.email).toLowerCase() || "—";
  const facts: [string, string][] = [["Ereignis", oneLine(input.title)], ["E-Mail", email]];
  const company = oneLine(input.company);
  if (company) facts.push(["Firma", company]);
  const entityId = oneLine(input.entityId);
  if (entityId) facts.push(["Firmen-ID", entityId]);
  for (const [label, value] of input.facts ?? []) {
    const clean = oneLine(value);
    if (clean) facts.push([oneLine(label), clean]);
  }
  if (input.mode) facts.push(["Modus", input.mode]);
  const at = typeof input.at === "number" && Number.isFinite(input.at) ? new Date(input.at) : new Date();
  facts.push(["Zeit (Europe/Berlin)", formatBerlinDateTime(at)]);
  const test = input.mode === "test" ? " [Test]" : "";
  return {
    subject: oneLine(`[GoBD] ${input.title}${test}: ${email}`).slice(0, 180),
    text: [oneLine(input.title), "", ...facts.map(([k, v]) => `${k}: ${v}`)].join("\n"),
    html: `<p>${escapeHtml(oneLine(input.title))}</p><p>${facts
      .map(([k, v]) => `${escapeHtml(k)}: ${escapeHtml(v)}`)
      .join("<br />")}</p>`,
  };
}

/** Sendet den Hinweis oder überspringt ihn. Wirft nicht. */
export async function notifyOwner(input: OwnerNoticeInput): Promise<OwnerNoticeResult> {
  if (!ownerNoticeDue(input)) return { stub: false, sent: false, skipped: true };
  if (automatedRunForbidsLiveWrites() && !testMode) {
    return { stub: false, sent: false, skipped: true };
  }
  try {
    const mail = buildOwnerNoticeMail(input);
    return await sendDedupedEmail({
      dedupeKey: ownerNoticeMailKey(input.kind, input.id),
      to: CHECKOUT_NOTICE_TO,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
    });
  } catch (error) {
    console.error("[owner-notice] Hinweis nicht gesendet", error instanceof Error ? error.name : "error");
    return { stub: false, sent: false };
  }
}

/** Plant den Hinweis nach der Antwort. Testadressen erreichen den Planer nicht. */
export function queueOwnerNotice(input: OwnerNoticeInput): void {
  try {
    if (!ownerNoticeDue(input)) return;
    scheduleLeadNoticeAfterResponse(async () => {
      await notifyOwner(input);
    });
  } catch (error) {
    console.error("[owner-notice] nicht geplant", error instanceof Error ? error.name : "error");
  }
}

/* ---------- Stripe ---------- */

type StripeLikeEvent = {
  id: string;
  type: string;
  livemode?: boolean;
  created?: number;
  data: { object: unknown; previous_attributes?: Record<string, unknown> | null };
};

type SubscriptionLike = {
  id?: string;
  status?: string;
  cancel_at_period_end?: boolean | null;
  cancel_at?: number | null;
  items?: { data?: { price?: { id?: string | null } | null; plan?: { id?: string | null } | null }[] } | null;
  plan?: { id?: string | null } | null;
  metadata?: Record<string, string> | null;
};

function cancelScheduled(sub: SubscriptionLike): boolean {
  return sub.cancel_at_period_end === true || Boolean(sub.cancel_at);
}

function priceIds(sub: SubscriptionLike): string {
  const fromItems = (sub.items?.data ?? [])
    .map((item) => item?.price?.id || item?.plan?.id || "")
    .filter(Boolean);
  const ids = fromItems.length > 0 ? fromItems : [sub.plan?.id || ""].filter(Boolean);
  return [...ids].sort().join(",");
}

/**
 * Nur echte Änderungen aus `previous_attributes`: Kündigung vorgemerkt oder
 * zurückgenommen, Statuswechsel, Tarifwechsel, Abo beendet. Verlängerungen
 * (nur Periodendaten, latest_invoice usw.) ergeben `[]`.
 */
export function subscriptionChanges(event: StripeLikeEvent): string[] {
  const sub = event.data.object as SubscriptionLike;
  if (event.type === "customer.subscription.deleted") return ["Abo beendet"];
  if (event.type !== "customer.subscription.updated") return [];
  const prev = (event.data.previous_attributes ?? {}) as SubscriptionLike;
  const before: SubscriptionLike = { ...sub, ...prev };
  const changes: string[] = [];
  if (("cancel_at_period_end" in prev || "cancel_at" in prev) && cancelScheduled(before) !== cancelScheduled(sub)) {
    changes.push(cancelScheduled(sub) ? "Kündigung vorgemerkt" : "Kündigung zurückgenommen");
  }
  if ("status" in prev && prev.status && prev.status !== sub.status) {
    changes.push(`Status ${prev.status} → ${sub.status ?? "?"}`);
  }
  if (("items" in prev || "plan" in prev) && priceIds(before) !== priceIds(sub)) {
    changes.push(`Tarifwechsel ${priceIds(before) || "?"} → ${priceIds(sub) || "?"}`);
  }
  return changes;
}

function formatAmount(minor: number | null | undefined, currency: string | null | undefined): string {
  const code = (currency ?? "").toUpperCase();
  if (typeof minor !== "number" || !Number.isFinite(minor) || !/^[A-Z]{3}$/.test(code)) return "unbekannt";
  try {
    return new Intl.NumberFormat("de-DE", { style: "currency", currency: code }).format(minor / 100);
  } catch {
    return `${(minor / 100).toFixed(2)} ${code}`;
  }
}

function idOf(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "id" in value) {
    const id = (value as { id?: unknown }).id;
    return typeof id === "string" ? id : "";
  }
  return "";
}

/**
 * Hinweis für ein Stripe-Ereignis, oder `null` (Routine, unbekannt).
 * `email` kommt vom Aufrufer, wenn das Objekt selbst keine enthält.
 */
export function ownerNoticeFromStripeEvent(
  event: StripeLikeEvent,
  extra: { email?: string | null; entityId?: string | null } = {},
): OwnerNoticeInput | null {
  const mode = event.livemode === true ? "live" : "test";
  const at = (event.created || Math.floor(Date.now() / 1000)) * 1000;
  const object = event.data.object as Record<string, unknown>;
  switch (event.type) {
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const changes = subscriptionChanges(event);
      if (changes.length === 0) return null;
      const sub = object as SubscriptionLike;
      return {
        kind: "subscription",
        id: event.id,
        title: event.type === "customer.subscription.deleted" ? "Abo beendet" : "Abo geändert",
        email: extra.email,
        entityId: extra.entityId ?? sub.metadata?.entity_id ?? "",
        mode,
        at,
        facts: [
          ["Änderung", changes.join("; ")],
          ["Abo", sub.id ?? ""],
        ],
      };
    }
    case "invoice.payment_failed": {
      const invoiceId = idOf(object);
      return {
        kind: "payment-failed",
        id: invoiceId || event.id,
        title: "Zahlung fehlgeschlagen",
        email: extra.email || (object.customer_email as string | undefined),
        entityId: extra.entityId,
        mode,
        at,
        facts: [
          ["Rechnung", invoiceId],
          ["Betrag", formatAmount(object.amount_due as number, object.currency as string)],
          ["Kunde", idOf(object.customer)],
        ],
      };
    }
    case "charge.refunded": {
      const chargeId = idOf(object);
      const refunded = object.amount_refunded as number;
      const billing = (object.billing_details ?? {}) as { email?: string | null };
      return {
        kind: "refund",
        id: `${chargeId || event.id}:${typeof refunded === "number" ? refunded : ""}`,
        title: "Erstattung",
        email: extra.email || billing.email || (object.receipt_email as string | undefined),
        entityId: extra.entityId,
        mode,
        at,
        facts: [
          ["Erstattet", formatAmount(refunded, object.currency as string)],
          ["Zahlung", formatAmount(object.amount as number, object.currency as string)],
          ["Charge", chargeId],
          ["Kunde", idOf(object.customer)],
        ],
      };
    }
    case "charge.dispute.created": {
      const disputeId = idOf(object);
      return {
        kind: "dispute",
        id: disputeId || event.id,
        title: "Rückbuchung (Dispute)",
        email: extra.email,
        entityId: extra.entityId,
        mode,
        at,
        facts: [
          ["Betrag", formatAmount(object.amount as number, object.currency as string)],
          ["Grund", String(object.reason ?? "")],
          ["Dispute", disputeId],
          ["Charge", idOf(object.charge)],
        ],
      };
    }
    default:
      return null;
  }
}
