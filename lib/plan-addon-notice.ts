/**
 * Neues Preismodell (Philip 28.10.): Hinweis-Mail 7 Tage vor dem Ende des
 * 30-Tage-Zugangs (Option 1) mit Angebot Jahrespaket (49 €/Jahr).
 *
 * - Täglicher Vercel-Cron (vercel.json), Schutz über CRON_SECRET (Bearer).
 * - Einmal je Kauf: Dedupe-Schlüssel `addon-notice:<email>:<purchasedAt>`,
 *   gespeichert nur als HMAC (lib/mail-dedupe, Schlüssel mit `@`).
 * - Versand nur mit PLAN_ADDON_NOTICE_ENABLED=true (Default AUS): sonst zählt
 *   der Lauf nur die fälligen Käufe.
 * - Wortlaut: Legal e-7 / e-7N (loeschhinweis-mails.md, 1:1). Früher:
 *   Platzhalter, Text kommt von Legal.
 */
import { formatBerlinDate } from "@/lib/kuendigung";
import { logError } from "@/lib/log-error";
import { sendDedupedEmail } from "@/lib/mail-dedupe";
import { addonYearEnd, PLAN_ADDON_HREF, planState, type PlanRow } from "@/lib/plan";
import { listPlanRowsStrict } from "@/lib/plan-store";
import { hasOfferOptOut, offerOptOutHeaders } from "@/lib/offer-optout";
import { firmLabel, renderLegalMail } from "@/lib/retention-mail";
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

/**
 * Tag 23 (7 Tage vor Ende des 30-Tage-Zugangs): Legal e-7 (mit Angebot) bzw.
 * nach Widerspruch e-7N (neutral), Wortlaut 1:1 aus loeschhinweis-mails.md
 * (lib/retention-mail-texts.ts, erzeugt mit scripts/gen-retention-mail-texts.py).
 */
export function addonNoticeMail(input: {
  company: string;
  accessUntil: string;
  purchasedAt: string;
  /** Widerspruch gegen Angebote: e-7N statt e-7. */
  offerOptOut?: boolean;
  siteUrl?: string;
}): {
  subject: string;
  text: string;
  html: string;
} {
  const base = (input.siteUrl || getAppUrl()).replace(/\/$/, "");
  return renderLegalMail(input.offerOptOut ? "e7N" : "e7", {
    Firma: firmLabel(input.company),
    Zugangsende: formatBerlinDate(input.accessUntil),
    "Löschdatum": formatBerlinDate(addonYearEnd(input.purchasedAt, input.purchasedAt)),
    "Link Anmeldung": `${base}/login`,
    "Link Jahrespaket": `${base}${PLAN_ADDON_HREF}`,
    "Link Datenschutzerklärung": `${base}/datenschutz`,
  });
}

export type AddonNoticeRunResult = { due: number; sent: number; failed: number; sending: boolean };

type RunIo = {
  rows: () => Promise<PlanRow[]>;
  send: typeof sendDedupedEmail;
  company?: (row: PlanRow) => Promise<string>;
  /** Widerspruch gegen Angebote (Marker je HMAC oder Plan-Spalte): dann kein Versand. */
  optedOut?: (row: PlanRow) => Promise<boolean>;
};

async function firstCompany(row: PlanRow): Promise<string> {
  const entities = await listEntitiesByEmail(row.email);
  return entities.length === 1 ? (entities[0]?.name ?? "") : "";
}

/** Ein Lauf. Ohne Schalter nur Zählung, nie Versand. Fehler je Zeile brechen den Lauf nicht ab. */
export async function runAddonNotice(
  now: Date = new Date(),
  io: RunIo = { rows: listPlanRowsStrict, send: sendDedupedEmail, company: firstCompany, optedOut: (row) => hasOfferOptOut(row) },
): Promise<AddonNoticeRunResult> {
  const sending = isPricingV2() && addonNoticeEnabled();
  const due = (await io.rows()).filter((row) => addonNoticeDue(row, now));
  let sent = 0;
  let failed = 0;
  if (!sending) return { due: due.length, sent, failed, sending };
  for (const row of due) {
    try {
      // Widerspruch (CoS 28.10.): kein Angebot, sondern neutraler Hinweis zum Zugangsende (gleicher Dedupe).
      const optedOut = Boolean(row.offerOptOutAt?.trim()) || Boolean(io.optedOut && (await io.optedOut(row)));
      const company = io.company ? await io.company(row) : "";
      const mail = addonNoticeMail({
        company,
        accessUntil: row.accessUntil,
        purchasedAt: row.purchasedAt,
        offerOptOut: optedOut,
      });
      const result = await io.send({
        dedupeKey: addonNoticeMailKey(row),
        to: row.email,
        ...mail,
        ...(optedOut ? {} : { headers: offerOptOutHeaders(row.email) }),
      });
      if (result.sent || result.duplicate) sent += 1;
      else failed += 1;
    } catch (error) {
      failed += 1;
      logError("[addon-notice] Versand fehlgeschlagen", error);
    }
  }
  return { due: due.length, sent, failed, sending };
}
