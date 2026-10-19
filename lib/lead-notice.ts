/**
 * Internal note after a real Ampel-Check or Kassen-Check result mail.
 * One recipient, one mail per result mail. The lead is never the recipient.
 * A send failure stays here and does not delay the customer response.
 */
import { waitUntil } from "@vercel/functions";
import { after } from "next/server";
import { isAmpelTestEmail, ampelResultLabel, type AmpelResultLabel } from "@/lib/ampel-stats";
import { normalizeAmpelEmail, sanitizeAmpelRef } from "@/lib/ampel-score";
import { CHECKOUT_NOTICE_TO } from "@/lib/checkout-notice";
import { formatBerlinDateTime } from "@/lib/delivery-templates";
import { leadNoticeMailKey, sendDedupedEmail } from "@/lib/mail-dedupe";
import { escapeHtml } from "@/lib/mail-layout";
import type { MailResult } from "@/lib/mail";
import { isTestEntity } from "@/lib/test-entities";

export type LeadNoticeTool = "ampel" | "kassen";

export type LeadNoticeInput = {
  tool: LeadNoticeTool;
  email: string;
  /** `gruen` / `gelb` / `rot`, or the German label. */
  light: string;
  /** The lead asked for marketing consent. Not whether the DOI click landed. */
  marketingRequested: boolean;
  ref?: unknown;
  /** Logical id of the result mail, for example its dedupe key. */
  resultMailId?: string | null;
  /** Stored lead id when the caller already has one. */
  leadId?: string | null;
  /** Listed test firms are skipped, same as the checkout note. */
  entityId?: string | null;
  /** Unix milliseconds. Defaults to now. */
  at?: number | null;
};

export type LeadNoticeResult = MailResult & { skipped?: boolean };

const pendingNotices = new Set<Promise<void>>();

function oneLine(value: string | null | undefined): string {
  return (value ?? "").replace(/[\r\n\u0000]+/g, " ").replace(/\s+/g, " ").trim();
}

export function leadNoticeToolLabel(tool: LeadNoticeTool): "Ampel" | "Kassen" {
  return tool === "kassen" ? "Kassen" : "Ampel";
}

export function leadNoticeResultLabel(light: string): AmpelResultLabel {
  const compact = light.trim().toLowerCase();
  if (compact === "grün") return ampelResultLabel("gruen");
  if (compact === "rot" || compact === "gelb" || compact === "gruen") return ampelResultLabel(compact);
  return ampelResultLabel(light);
}

export function leadNoticeEmailDomain(email: string): string {
  const at = email.lastIndexOf("@");
  if (at <= 0 || at === email.length - 1) return "unbekannt";
  const domain = email.slice(at + 1);
  if (!domain || domain.includes(" ")) return "unbekannt";
  return domain;
}

/** Lead id when present, otherwise normalized address plus the result-mail id. */
export function leadNoticeDedupeAnchor(input: {
  email: string;
  resultMailId?: string | null;
  leadId?: string | null;
}): string {
  const leadId = input.leadId?.trim() ?? "";
  if (leadId) return leadId;
  const email = normalizeAmpelEmail(input.email) ?? input.email.trim().toLowerCase();
  return `${email}:${(input.resultMailId ?? "").trim()}`;
}

export function formatLeadNoticeTime(at: number | null | undefined): string {
  const ms = typeof at === "number" && Number.isFinite(at) ? at : Number.NaN;
  const date = Number.isFinite(ms) ? new Date(ms) : new Date();
  return formatBerlinDateTime(date);
}

/**
 * The only address this mail may use. Throws when that address is the lead,
 * so the lead is never To. Cc and Bcc are not part of the payload.
 */
export function assertLeadNoticeRecipient(leadEmail: string): void {
  const to: string = CHECKOUT_NOTICE_TO;
  const lead = leadEmail.trim().toLowerCase();
  if (lead.length > 0 && lead === to.toLowerCase()) {
    throw new Error("lead-notice-recipient");
  }
}

export function leadNoticeDue(input: LeadNoticeInput): boolean {
  if (input.tool !== "ampel" && input.tool !== "kassen") return false;
  const email = normalizeAmpelEmail(input.email);
  if (!email) return false;
  if (!(input.leadId?.trim() || input.resultMailId?.trim())) return false;
  if (isAmpelTestEmail(email)) return false;
  if (isTestEntity(input.entityId)) return false;
  return true;
}

export function buildLeadNoticeMail(input: LeadNoticeInput & { email: string }): {
  subject: string;
  text: string;
  html: string;
} {
  const email = normalizeAmpelEmail(input.email) ?? oneLine(input.email).toLowerCase();
  const tool = leadNoticeToolLabel(input.tool);
  const result = leadNoticeResultLabel(input.light);
  const domain = leadNoticeEmailDomain(email);
  const marketing = input.marketingRequested ? "ja" : "nein";
  const ref = sanitizeAmpelRef(input.ref);
  const time = formatLeadNoticeTime(input.at);
  const lines = [
    `Neuer ${tool}-Lead`,
    "",
    `Tool: ${tool}`,
    `Ergebnis: ${result}`,
    `E-Mail: ${email || "—"}`,
    `Marketing angefragt: ${marketing}`,
  ];
  if (ref) lines.push(`Ref/UTM: ${ref}`);
  lines.push(`Zeit (Europe/Berlin): ${time}`);
  const text = lines.join("\n");
  const html = [
    `<p>Neuer ${escapeHtml(tool)}-Lead</p>`,
    "<p>",
    `Tool: ${escapeHtml(tool)}<br />`,
    `Ergebnis: ${escapeHtml(result)}<br />`,
    `E-Mail: ${escapeHtml(email || "—")}<br />`,
    `Marketing angefragt: ${escapeHtml(marketing)}<br />`,
    ...(ref ? [`Ref/UTM: ${escapeHtml(ref)}<br />`] : []),
    `Zeit (Europe/Berlin): ${escapeHtml(time)}`,
    "</p>",
  ].join("");
  return {
    subject: oneLine(`Neuer ${tool}-Lead: ${result} \u2013 ${domain}`).slice(0, 180),
    text,
    html,
  };
}

/**
 * Sends the internal note, or skips it. Does not throw.
 * The recipient is {@link CHECKOUT_NOTICE_TO} and nothing else.
 */
export async function notifyLeadResult(input: LeadNoticeInput): Promise<LeadNoticeResult> {
  const email = normalizeAmpelEmail(input.email);
  if (!email || !leadNoticeDue(input)) {
    return { stub: false, sent: false, skipped: true };
  }
  try {
    assertLeadNoticeRecipient(email);
    const mail = buildLeadNoticeMail({ ...input, email });
    const dedupeKey = leadNoticeMailKey(
      input.tool,
      leadNoticeDedupeAnchor({ email, resultMailId: input.resultMailId, leadId: input.leadId }),
    );
    const result = await sendDedupedEmail({
      dedupeKey,
      to: CHECKOUT_NOTICE_TO,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
    });
    return result;
  } catch (error) {
    console.error(
      "[lead-notice] Hinweis nicht gesendet",
      error instanceof Error ? error.name : "error",
    );
    return { stub: false, sent: false };
  }
}

/**
 * Runs after the response. One promise is handed to `after` and to `waitUntil`,
 * so the work runs once and the isolate stays up until it settles.
 * Outside a request the work still starts, without holding the caller.
 */
export function scheduleLeadNoticeAfterResponse(work: () => Promise<void>): void {
  let task: Promise<void> | undefined;
  const run = (): Promise<void> => {
    task ??= work().catch((error: unknown) => {
      console.error(
        "[lead-notice] Nacharbeit fehlgeschlagen",
        error instanceof Error ? error.name : "error",
      );
    });
    pendingNotices.add(task);
    const current = task;
    void current.finally(() => {
      pendingNotices.delete(current);
    });
    return task;
  };

  try {
    after(() => run());
  } catch (error) {
    console.error(
      "[lead-notice] Nacharbeit ohne Anfragekontext",
      error instanceof Error ? error.name : "error",
    );
  }
  try {
    waitUntil(run());
  } catch (error) {
    console.error(
      "[lead-notice] Nacharbeit ohne waitUntil",
      error instanceof Error ? error.name : "error",
    );
    void run();
  }
}

/** Schedules the note. A test address or a listed firm never reaches the scheduler. */
export function queueLeadNotice(input: LeadNoticeInput): void {
  if (!leadNoticeDue(input)) return;
  scheduleLeadNoticeAfterResponse(async () => {
    await notifyLeadResult(input);
  });
}

/** Settles notes started during the prebuild check. */
export async function flushLeadNoticesForTests(): Promise<void> {
  while (pendingNotices.size > 0) {
    await Promise.all([...pendingNotices]);
  }
}
