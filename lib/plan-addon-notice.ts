/**
 * Neues Preismodell (Philip 28.10.): Hinweis-Mail 7 Tage vor dem Ende des
 * 30-Tage-Zugangs (Option 1) mit Angebot Jahrespaket (49 €/Jahr).
 *
 * - Täglicher Vercel-Cron (vercel.json), Schutz über CRON_SECRET (Bearer).
 * - Einmal je Kauf: Dedupe-Schlüssel `addon-notice:<email>:<purchasedAt>`,
 *   gespeichert nur als HMAC (lib/mail-dedupe, Schlüssel mit `@`).
 * - Versand nur mit PLAN_ADDON_NOTICE_ENABLED=true (Default AUS): sonst zählt
 *   der Lauf nur die fälligen Käufe.
 * - Wortlaut: Growth landing-v3.md Abschnitt 6 (1:1). Widerspruchshinweis:
 *   Platzhalter, Text kommt von Legal.
 */
import { formatBerlinDate } from "@/lib/kuendigung";
import { logError } from "@/lib/log-error";
import { escapeHtml, wrapTransactionalHtml, wrapTransactionalText } from "@/lib/mail-layout";
import { sendDedupedEmail } from "@/lib/mail-dedupe";
import { PLAN_ADDON_HREF, planState, type PlanRow } from "@/lib/plan";
import { PLAN_OFFER_OBJECTION_NOTICE } from "@/lib/plan-copy";
import { listPlanRowsStrict } from "@/lib/plan-store";
import { getAppUrl } from "@/lib/env";
import { listEntitiesByEmail } from "@/lib/store";
import { addonNoticeEnabled, isPricingV2, PLAN_ADDON_NOTICE_DAYS_BEFORE } from "@/lib/pricing-model";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Fällig: Option 1 im Zugang, höchstens 7 Tage vor dem Ende, kein Jahrespaket. */
export function addonNoticeDue(row: PlanRow, now: Date = new Date()): boolean {
  if (row.plan === "member" || row.refundedAt || row.deletedAt || !row.accessUntil) return false;
  if (planState(row, now) !== "window") return false;
  const end = Date.parse(row.accessUntil);
  return Number.isFinite(end) && now.getTime() >= end - PLAN_ADDON_NOTICE_DAYS_BEFORE * DAY_MS;
}

/** Ein Hinweis je Kauf. Die Adresse geht nur als HMAC in den Ledger. */
export function addonNoticeMailKey(row: Pick<PlanRow, "email" | "purchasedAt">): string {
  return `addon-notice:${row.email.trim().toLowerCase()}:${row.purchasedAt.trim()}`;
}

export function addonNoticeMail(input: {
  company: string;
  name?: string;
  accessUntil: string;
  purchasedAt: string;
  /** Widerspruch gegen Angebote (AGB § 12a Abs. 2): Hinweis ohne Angebot. */
  offerOptOut?: boolean;
}): {
  subject: string;
  text: string;
  html: string;
} {
  const company = input.company.trim() || "Ihre Firma";
  const date = formatBerlinDate(input.accessUntil);
  const bought = formatBerlinDate(input.purchasedAt);
  const greeting = input.name?.trim() ? `Guten Tag ${input.name.trim()},` : "Guten Tag,";
  const addonUrl = `${getAppUrl()}${PLAN_ADDON_HREF}`;
  const pdfUrl = `${getAppUrl()}/account`;
  const subject = `Ihr Zugang zu ${company} endet am ${date}`;
  const intro = `Ihr 30-Tage-Zugang für ${company} endet am ${date}. Danach wird Ihr Konto deaktiviert: Sie können Ihre Angaben nicht mehr anpassen, keine Personen mehr einladen und Ihre PDFs nicht mehr herunterladen.`;
  const paragraphs = input.offerOptOut
    ? [
        greeting,
        intro,
        `Speichern Sie Ihre PDFs bis zum ${date} auf Ihrem Rechner.`,
        `Zu meinen PDFs: ${pdfUrl}`,
        "Bei Fragen antworten Sie einfach auf diese Mail.",
        "Viele Grüße\nIhr Team von gobd-doku-erstellen.de",
        "---\nSoftware-Hilfe zur Verfahrensdokumentation, keine Steuer- oder Rechtsberatung.",
      ]
    : [
    greeting,
    intro,
    "Zwei Möglichkeiten:",
    `1. Dauerhaft weitermachen: Buchen Sie das Jahrespaket für 49 €/Jahr zzgl. USt dazu. Sie behalten den Zugang, können Änderungen jederzeit einpflegen und neue Versionen erstellen. Das Jahr zählt ab Ihrem ersten Kauf am ${bought}.`,
    `Jahrespaket zubuchen: ${addonUrl}`,
    `2. Ohne Verlängerung: Speichern Sie Ihre PDFs bis zum ${date} auf Ihrem Rechner.`,
    `Zu meinen PDFs: ${pdfUrl}`,
    "Bei Fragen antworten Sie einfach auf diese Mail.",
    "Viele Grüße\nIhr Team von gobd-doku-erstellen.de",
    "---\nSoftware-Hilfe zur Verfahrensdokumentation, keine Steuer- oder Rechtsberatung.",
    PLAN_OFFER_OBJECTION_NOTICE,
  ];
  const html = paragraphs
    .map((p) => {
      if (p.startsWith("Jahrespaket zubuchen: ")) return `<p><a href="${escapeHtml(addonUrl)}">Jahrespaket zubuchen</a></p>`;
      if (p.startsWith("Zu meinen PDFs: ")) return `<p><a href="${escapeHtml(pdfUrl)}">Zu meinen PDFs</a></p>`;
      return `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`;
    })
    .join("");
  return {
    subject,
    text: wrapTransactionalText(paragraphs.join("\n\n")),
    html: wrapTransactionalHtml(html),
  };
}

export type AddonNoticeRunResult = { due: number; sent: number; failed: number; sending: boolean };

type RunIo = {
  rows: () => Promise<PlanRow[]>;
  send: typeof sendDedupedEmail;
  company?: (row: PlanRow) => Promise<string>;
};

async function firstCompany(row: PlanRow): Promise<string> {
  const entities = await listEntitiesByEmail(row.email);
  return entities.length === 1 ? (entities[0]?.name ?? "") : "";
}

/** Ein Lauf. Ohne Schalter nur Zählung, nie Versand. Fehler je Zeile brechen den Lauf nicht ab. */
export async function runAddonNotice(
  now: Date = new Date(),
  io: RunIo = { rows: listPlanRowsStrict, send: sendDedupedEmail, company: firstCompany },
): Promise<AddonNoticeRunResult> {
  const sending = isPricingV2() && addonNoticeEnabled();
  const due = (await io.rows()).filter((row) => addonNoticeDue(row, now));
  let sent = 0;
  let failed = 0;
  if (!sending) return { due: due.length, sent, failed, sending };
  for (const row of due) {
    try {
      const company = io.company ? await io.company(row) : "";
      const mail = addonNoticeMail({
        company,
        accessUntil: row.accessUntil,
        purchasedAt: row.purchasedAt,
        offerOptOut: Boolean(row.offerOptOutAt),
      });
      const result = await io.send({ dedupeKey: addonNoticeMailKey(row), to: row.email, ...mail });
      if (result.sent || result.duplicate) sent += 1;
      else failed += 1;
    } catch (error) {
      failed += 1;
      logError("[addon-notice] Versand fehlgeschlagen", error);
    }
  }
  return { due: due.length, sent, failed, sending };
}
