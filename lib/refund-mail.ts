/**
 * Fall d) der Löschhinweis-Mails (Legal, freigegeben 28.10. 18:33 MEZ):
 * genau eine Mail bei voller Erstattung des ERSTEN v3-Kaufs (d-0), keine
 * 30/7-Tage-Mails. Nie bei Verlängerung, Teilerstattung, Altkunden, DS24
 * (der Aufruf kommt nur aus recordPlanRefund = "locked").
 * Versand nur mit RETENTION_EXECUTE_ENABLED=true (Default AUS), weil die Mail
 * die Löschung durch den Löschlauf ankündigt. Einmal je Kauf:
 * Schlüssel `refund-confirm:<email>:<purchasedAt>`, gespeichert nur als HMAC.
 */
import { logError } from "@/lib/log-error";
import { sendDedupedEmail } from "@/lib/mail-dedupe";
import type { PlanRow } from "@/lib/plan";
import { retentionExecuteEnabled } from "@/lib/pricing-model";
import { buildRefundNoticeMail } from "@/lib/retention-mail";

export function refundMailKey(email: string, purchasedAt: string): string {
  return `refund-confirm:${email.trim().toLowerCase()}:${purchasedAt.trim()}`;
}

/** Option 2 = das erstattete Paket enthielt das Jahrespaket (Zeile vor der Erstattung). */
export function refundWasOption2(previous: Pick<PlanRow, "plan" | "memberSubscriptionId">): boolean {
  return previous.plan === "member" || Boolean(previous.memberSubscriptionId.trim());
}

export async function sendRefundMail(
  row: PlanRow,
  context: { option2: boolean; company?: string },
  send = sendDedupedEmail,
): Promise<"sent" | "skipped" | "failed"> {
  if (!retentionExecuteEnabled()) return "skipped";
  if (!row.email || !row.refundedAt) return "skipped";
  try {
    const result = await send({
      dedupeKey: refundMailKey(row.email, row.purchasedAt || row.refundedAt),
      to: row.email,
      replyTo: "info@gobd-doku-erstellen.de",
      ...buildRefundNoticeMail({ refundedAt: row.refundedAt, option2: context.option2, company: context.company }),
    });
    return result.sent ? "sent" : "skipped";
  } catch (error) {
    logError("[refund-mail] Versand fehlgeschlagen", error);
    return "failed";
  }
}
