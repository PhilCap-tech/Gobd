/**
 * Internal note for a live, paid Checkout. One recipient, one mail per
 * session. The customer is never the recipient. A send failure stays here.
 */
import { formatBerlinDateTime } from "@/lib/delivery-templates";
import { checkoutNoticeMailKey, sendDedupedEmail } from "@/lib/mail-dedupe";
import { escapeHtml } from "@/lib/mail-layout";
import type { MailResult } from "@/lib/mail";
import { isTestEntity } from "@/lib/test-entities";

export const CHECKOUT_NOTICE_TO = "cappe@gmx.de";

const ZERO_DECIMAL = new Set([
  "BIF",
  "CLP",
  "DJF",
  "GNF",
  "JPY",
  "KMF",
  "KRW",
  "MGA",
  "PYG",
  "RWF",
  "UGX",
  "VND",
  "VUV",
  "XAF",
  "XOF",
  "XPF",
]);

const THREE_DECIMAL = new Set(["BHD", "JOD", "KWD", "OMR", "TND"]);

export type CheckoutNoticeInput = {
  livemode: boolean;
  paymentStatus: string;
  entityId?: string | null;
  sessionId: string;
  company?: string | null;
  email?: string | null;
  /** Stripe `amount_total` in minor units. */
  amountTotal?: number | null;
  currency?: string | null;
  /** Stripe `created`, unix seconds. */
  created?: number | null;
};

export type CheckoutNoticeResult = MailResult & { skipped?: boolean };

function oneLine(value: string | null | undefined): string {
  return (value ?? "").replace(/[\r\n\u0000]+/g, " ").replace(/\s+/g, " ").trim();
}

function minorDigits(currency: string): number {
  if (ZERO_DECIMAL.has(currency)) return 0;
  if (THREE_DECIMAL.has(currency)) return 3;
  return 2;
}

/** Amount plus currency. Missing or unknown values stay visible as unknown. */
export function formatCheckoutNoticeAmount(
  amountTotal: number | null | undefined,
  currency: string | null | undefined,
): string {
  const code = oneLine(currency).toUpperCase();
  if (amountTotal == null || !Number.isFinite(amountTotal) || !code || !/^[A-Z]{3}$/.test(code)) {
    return "unbekannt";
  }
  const major = amountTotal / 10 ** minorDigits(code);
  try {
    return new Intl.NumberFormat("de-DE", { style: "currency", currency: code }).format(major);
  } catch {
    return `${major.toFixed(minorDigits(code))} ${code}`;
  }
}

export function formatCheckoutNoticeTime(created: number | null | undefined): string {
  const seconds = typeof created === "number" && Number.isFinite(created) ? created : NaN;
  const date = Number.isFinite(seconds) ? new Date(seconds * 1000) : new Date();
  return formatBerlinDateTime(date);
}

export function checkoutNoticeDue(input: CheckoutNoticeInput): boolean {
  if (input.livemode !== true) return false;
  if (input.paymentStatus !== "paid") return false;
  if (!oneLine(input.sessionId)) return false;
  if (isTestEntity(input.entityId)) return false;
  return true;
}

export function buildCheckoutNoticeMail(input: CheckoutNoticeInput): {
  subject: string;
  text: string;
  html: string;
} {
  const company = oneLine(input.company) || "—";
  const email = oneLine(input.email) || "—";
  const amount = formatCheckoutNoticeAmount(input.amountTotal, input.currency);
  const time = formatCheckoutNoticeTime(input.created);
  const sessionId = oneLine(input.sessionId) || "—";
  const subjectName = company !== "—" ? company : sessionId;
  const text = [
    "Neue Bezahlung",
    "",
    `Firma: ${company}`,
    `E-Mail: ${email}`,
    `Betrag: ${amount}`,
    `Zeit (Europe/Berlin): ${time}`,
    `Stripe-Session: ${sessionId}`,
  ].join("\n");
  const html = [
    "<p>Neue Bezahlung</p>",
    "<p>",
    `Firma: ${escapeHtml(company)}<br />`,
    `E-Mail: ${escapeHtml(email)}<br />`,
    `Betrag: ${escapeHtml(amount)}<br />`,
    `Zeit (Europe/Berlin): ${escapeHtml(time)}<br />`,
    `Stripe-Session: ${escapeHtml(sessionId)}`,
    "</p>",
  ].join("");
  return {
    subject: oneLine(`Neue Bezahlung — ${subjectName}`).slice(0, 180),
    text,
    html,
  };
}

/**
 * Sends the internal note, or skips it. Does not throw.
 * The recipient is {@link CHECKOUT_NOTICE_TO} and nothing else.
 */
export async function notifyCheckoutPaid(input: CheckoutNoticeInput): Promise<CheckoutNoticeResult> {
  if (!checkoutNoticeDue(input)) {
    return { stub: false, sent: false, skipped: true };
  }
  try {
    const mail = buildCheckoutNoticeMail(input);
    const result = await sendDedupedEmail({
      dedupeKey: checkoutNoticeMailKey(input.sessionId),
      to: CHECKOUT_NOTICE_TO,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
    });
    return result;
  } catch (error) {
    console.error(
      "[webhook] Kaufhinweis nicht gesendet",
      error instanceof Error ? error.name : "error",
    );
    return { stub: false, sent: false };
  }
}
