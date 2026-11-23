/**
 * Erinnerung 7 Tage vor Ende von Download und Anrechnung.
 * Versand nur, wenn SCHNELLVERSION_49_REMINDER_SEND und SCHNELLVERSION_49_ENABLED
 * beide 1 oder true sind. Sonst keine Mail.
 */

import { escapeHtml, wrapTransactionalText } from "@/lib/mail-layout";
import { PLAN_OFFER_OBJECTION_NOTICE } from "@/lib/plan-copy";
import { formatSvDate, SV_DOWNLOAD_DAYS } from "@/lib/schnellversion-copy";
import { schnellversion49Enabled } from "@/lib/schnellversion-flag";
import type { SvPurchase } from "@/lib/schnellversion-record";

const DAY_MS = 24 * 60 * 60 * 1000;

type FlagEnv = Record<string, string | undefined>;

export function schnellversionReminderSendEnabled(env: FlagEnv = process.env): boolean {
  if (!schnellversion49Enabled(env)) return false;
  const raw = (env.SCHNELLVERSION_49_REMINDER_SEND ?? "").trim().toLowerCase();
  return raw === "1" || raw === "true";
}

export function reminderDue(purchasedAt: string, now: Date): boolean {
  const bought = Date.parse(purchasedAt);
  if (!Number.isFinite(bought)) return false;
  const end = bought + SV_DOWNLOAD_DAYS * DAY_MS;
  const from = end - 7 * DAY_MS;
  return now.getTime() >= from && now.getTime() < end;
}

export function reminderMail(input: { company: string; purchasedAt: string; optedOut?: boolean }): {
  subject: string;
  text: string;
  html: string;
} {
  const until = formatSvDate(new Date(Date.parse(input.purchasedAt) + SV_DOWNLOAD_DAYS * DAY_MS));
  const company = input.company.trim() || "Ihr Unternehmen";
  const subject = input.optedOut
    ? `Ihr Download endet am ${until}`
    : `Ihr Download und die Anrechnung enden am ${until}`;
  const lines = input.optedOut
    ? [
        `Guten Tag,`,
        ``,
        `Für ${company} endet der PDF-Download der Standardfassung am ${until}.`,
        `Danach ist der Download gesperrt.`,
        ``,
        `Keine Steuer- oder Rechtsberatung.`,
      ]
    : [
        `Guten Tag,`,
        ``,
        `Für ${company} enden der PDF-Download der Standardfassung und die Anrechnung der 49 € am ${until}.`,
        `Danach ist der Download gesperrt. Die Verfahrensdokumentation aus Ihren eigenen Angaben erstellen Sie im Fragebogen.`,
        ``,
        PLAN_OFFER_OBJECTION_NOTICE,
        ``,
        `Keine Steuer- oder Rechtsberatung.`,
      ];
  const body = lines.join("\n");
  const text = wrapTransactionalText(body);
  const html = `<p>${escapeHtml(body).replaceAll("\n\n", "</p><p>").replaceAll("\n", "<br>")}</p>`;
  return { subject, text, html };
}

export type ReminderRunResult = { due: number; sent: number; sending: boolean };

type SendMail = (input: {
  to: string;
  subject: string;
  text: string;
  html: string;
  purchaseId: string;
}) => Promise<void>;

/** Ohne Schalter wird nichts versendet. Der Test übergibt einen Mock. */
export async function runSchnellversionReminder(
  rows: SvPurchase[],
  now: Date,
  send: SendMail | null,
  env: FlagEnv = process.env,
  optedOut: (row: SvPurchase) => Promise<boolean> = async () => false,
): Promise<ReminderRunResult> {
  const dueRows = rows.filter((row) => reminderDue(row.purchasedAt, now));
  const sending = schnellversionReminderSendEnabled(env);
  if (!sending || !send) return { due: dueRows.length, sent: 0, sending: false };
  let sent = 0;
  for (const row of dueRows) {
    const quiet = await optedOut(row);
    const mail = reminderMail({ company: row.company, purchasedAt: row.purchasedAt, optedOut: quiet });
    await send({
      to: row.email,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
      purchaseId: row.id,
    });
    sent += 1;
  }
  return { due: dueRows.length, sent, sending: true };
}
