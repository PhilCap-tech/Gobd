/**
 * Erinnerung 7 Tage vor Ende von Download und Anrechnung.
 * Versand nur mit SCHNELLVERSION_49_REMINDER_SEND=1|true. Sonst keine Mail.
 */

import { escapeHtml, wrapTransactionalText } from "@/lib/mail-layout";
import { formatSvDate, SV_DOWNLOAD_DAYS } from "@/lib/schnellversion-copy";
import type { SvPurchase } from "@/lib/schnellversion-record";

const DAY_MS = 24 * 60 * 60 * 1000;

type FlagEnv = Record<string, string | undefined>;

export function schnellversionReminderSendEnabled(env: FlagEnv = process.env): boolean {
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

export function reminderMail(input: { company: string; purchasedAt: string }): {
  subject: string;
  text: string;
  html: string;
} {
  const until = formatSvDate(new Date(Date.parse(input.purchasedAt) + SV_DOWNLOAD_DAYS * DAY_MS));
  const company = input.company.trim() || "Ihr Unternehmen";
  const subject = `Ihr Download und die Anrechnung enden am ${until}`;
  const body = [
    `Guten Tag,`,
    ``,
    `Für ${company} enden der PDF-Download der Standardfassung und die Anrechnung der 49 € am ${until}.`,
    `Danach ist der Download gesperrt. Die Verfahrensdokumentation aus Ihren eigenen Angaben erstellen Sie im Fragebogen.`,
    ``,
    `Keine Steuer- oder Rechtsberatung.`,
  ].join("\n");
  const text = wrapTransactionalText(body);
  const html = `<p>${escapeHtml(body).replaceAll("\n\n", "</p><p>").replaceAll("\n", "<br>")}</p>`;
  return { subject, text, html };
}

export type ReminderRunResult = { due: number; sent: number; sending: boolean };

type SendMail = (input: { to: string; subject: string; text: string; html: string }) => Promise<void>;

/** Ohne Schalter wird nichts versendet. Der Test übergibt einen Mock. */
export async function runSchnellversionReminder(
  rows: SvPurchase[],
  now: Date,
  send: SendMail | null,
  env: FlagEnv = process.env,
): Promise<ReminderRunResult> {
  const dueRows = rows.filter((row) => reminderDue(row.purchasedAt, now));
  const sending = schnellversionReminderSendEnabled(env);
  if (!sending || !send) return { due: dueRows.length, sent: 0, sending: false };
  let sent = 0;
  for (const row of dueRows) {
    const mail = reminderMail({ company: row.company, purchasedAt: row.purchasedAt });
    await send({ to: row.email, subject: mail.subject, text: mail.text, html: mail.html });
    sent += 1;
  }
  return { due: dueRows.length, sent, sending: true };
}
