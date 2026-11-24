/**
 * Kaufmail der Schnellversion. Versand nur mit
 * SCHNELLVERSION_49_PURCHASE_MAIL=1|true. Sonst keine Mail.
 */

import { checkoutReturnBaseUrl } from "@/lib/env";
import { automatedRunForbidsLiveWrites } from "@/lib/live-write-guard";
import { escapeHtml, wrapTransactionalText } from "@/lib/mail-layout";
import { addSvDays, formatSvDate, SV_DOWNLOAD_DAYS, SV_OFFER_OBJECTION_NOTICE } from "@/lib/schnellversion-copy";

type FlagEnv = Record<string, string | undefined>;

export function schnellversionPurchaseMailEnabled(env: FlagEnv = process.env): boolean {
  const raw = (env.SCHNELLVERSION_49_PURCHASE_MAIL ?? "").trim().toLowerCase();
  return raw === "1" || raw === "true";
}

export function purchaseMail(input: {
  company: string;
  purchasedAt: string;
  sessionId: string;
  downloadToken?: string;
}): { subject: string; text: string; html: string } {
  const bought = new Date(input.purchasedAt);
  const until = formatSvDate(addSvDays(bought, SV_DOWNLOAD_DAYS));
  const company = input.company.trim() || "Ihr Unternehmen";
  const origin = checkoutReturnBaseUrl().replace(/\/$/, "");
  const token = input.downloadToken?.trim() ?? "";
  // Ohne Download-Token kein Checkout-Parameter: die Seite erwartet die Anmeldung.
  // Mit Token ist `dl` der bestehende opake Nachweis, nicht die Checkout-Session.
  const download = token
    ? `${origin}/api/schnellversion/pdf?dl=${encodeURIComponent(token)}`
    : `${origin}/schnellversion/danke`;
  void input.sessionId;
  const agb = `${origin}/agb`;
  const subject = `Ihre Standardfassung für ${company}`;
  const body = [
    `Guten Tag,`,
    ``,
    `Ihre Zahlung ist bestätigt. Ihre Bestellung der Schnellversion für ${company} ist damit abgeschlossen. Der Vertrag kommt mit der erfolgreichen Zahlungsbestätigung zustande.`,
    `Ihre Verfahrensdokumentation (Standardfassung, PDF) steht zum Download bereit. Sie wurde aus einer Branchenvorlage und Ihren 6 Angaben erzeugt und beschreibt nicht Ihre tatsächlichen Abläufe. Bitte prüfen, ergänzen und geben Sie sie vor der Verwendung frei. Keine Steuer- oder Rechtsberatung.`,
    ``,
    `Download: ${download}`,
    `Melden Sie sich dazu mit der E-Mail-Adresse dieser Bestellung an. Den Link aus der Zahlungsseite geben Sie bitte nicht weiter.`,
    `Download-Ende: ${until}. Bitte speichern Sie das PDF selbst.`,
    `Anrechnung: bis ${until}, einmal, nur für ${company} in diesem Kundenkonto, keine Barauszahlung.`,
    ``,
    `Die AGB können Sie speichern: ${agb}`,
    ``,
    SV_OFFER_OBJECTION_NOTICE,
  ].join("\n");
  const text = wrapTransactionalText(body);
  const html = `<p>${escapeHtml(body).replaceAll("\n\n", "</p><p>").replaceAll("\n", "<br>")}</p>`;
  return { subject, text, html };
}

/** Ohne Schalter und in automatisierten Läufen geht keine Mail raus. */
export async function maybeSendSchnellversionPurchaseMail(input: {
  to: string;
  company: string;
  purchasedAt: string;
  sessionId: string;
  downloadToken?: string;
  env?: FlagEnv;
}): Promise<boolean> {
  const env = input.env ?? process.env;
  if (!schnellversionPurchaseMailEnabled(env) || automatedRunForbidsLiveWrites()) return false;
  const mail = purchaseMail(input);
  const { sendDedupedEmail, svPurchaseMailKey } = await import("@/lib/mail-dedupe");
  await sendDedupedEmail({
    dedupeKey: svPurchaseMailKey(input.sessionId),
    to: input.to,
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
  });
  return true;
}
