/**
 * Löschhinweis-Mails v3 (Legal, freigegeben 28.10. 18:33 MEZ). Wortlaut in
 * lib/retention-mail-texts.ts (1:1 aus der Legal-Datei). Zuordnung:
 * - a) unbezahlter Entwurf: NUR 7 Tage vorher (a-7), keine 30-Tage-Mail.
 * - b) Option 1 / c) Jahrespaket beendet: 30 und 7 Tage vorher; nach
 *   Widerspruch (offerOptOutAt) die neutrale Fassung (bN/cN).
 * - d) Erstattung: genau eine Mail bei der Erstattung (d-0), keine 30/7-Mails.
 * Schlüssel: HMAC über lib/mail-dedupe (keine Klartext-Mail im Ledger).
 */
import { getAppUrl } from "@/lib/env";
import { formatBerlinDate } from "@/lib/kuendigung";
import { PLAN_REACTIVATE_HREF } from "@/lib/plan";
import { LEGAL_MAIL_FOOTER, LEGAL_MAILS, type LegalMailId } from "@/lib/retention-mail-texts";

export type RetentionNoticeStage = "notice30" | "notice7";

/** Ein Hinweis je Stufe, Mailbox und Frist. Enthält die Adresse, wird also per HMAC gespeichert. */
export function retentionNoticeMailKey(stage: RetentionNoticeStage | "a7", email: string, dueAt: string): string {
  return `retention-notice:${stage}:${email.trim().toLowerCase()}:${dueAt.trim()}`;
}

export function legalMailId(category: "option1" | "annual" | "draft" | "refunded", optedOut: boolean): LegalMailId {
  if (category === "draft") return "a7";
  if (category === "refunded") return "d0";
  if (category === "option1") return optedOut ? "bN" : "b";
  return optedOut ? "cN" : "c";
}

function appUrl(siteUrl?: string): string {
  return (siteUrl || getAppUrl()).replace(/\/$/, "");
}

/** Firmenname für {Firma}; ohne Angabe neutral. */
export function firmLabel(company: string | undefined | null): string {
  const name = (company ?? "").trim();
  return name || "Ihr Unternehmen";
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

export function renderLegalMail(
  id: LegalMailId,
  values: Record<string, string>,
): { subject: string; text: string; html: string } {
  const fill = (template: string) =>
    template.replace(/\{([^{}]+)\}/g, (match, key: string) => (key in values ? values[key]! : match));
  const subject = fill(LEGAL_MAILS[id].subject);
  // Leere Platzhalter ohne doppelte Leerzeichen („Ihr Vertrag {und Ihr Jahrespaket};“).
  const body = fill(LEGAL_MAILS[id].body).replace(/ +([;,.])/g, "$1");
  const footer = fill(LEGAL_MAIL_FOOTER);
  const unresolved = `${subject}\n${body}\n${footer}`.match(/\{[^{}]+\}/);
  if (unresolved) throw new Error("retention_mail_placeholder_open");
  const text = `${body.replace(/\*\*(.+?)\*\*/g, "$1").replace(/^\*(.+)\*$/gm, "$1")}\n\n--\n${footer}\n`;
  const html = [...body.split(/\n\n/), "", footer]
    .map((block) => {
      if (!block) return "<hr>";
      const safe = escapeHtml(block)
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        .replace(/^\*(.+)\*$/gm, "<em>$1</em>")
        .replace(/\n/g, "<br>");
      return `<p>${safe}</p>`;
    })
    .join("");
  return { subject, text, html };
}

function common(siteUrl?: string): Record<string, string> {
  const base = appUrl(siteUrl);
  return {
    "Link Anmeldung": `${base}/login`,
    "Link Reaktivierung": `${base}${PLAN_REACTIVATE_HREF}`,
    "Link Datenschutzerklärung": `${base}/datenschutz`,
  };
}

/** b/c: 30 bzw. 7 Tage vor der Löschung. */
export function buildRetentionNoticeMail(input: {
  stage: RetentionNoticeStage;
  deleteAt: string;
  category: "option1" | "annual";
  company?: string;
  optedOut?: boolean;
  annualEndedAt?: string;
  siteUrl?: string;
}): { subject: string; text: string; html: string } {
  return renderLegalMail(legalMailId(input.category, Boolean(input.optedOut)), {
    ...common(input.siteUrl),
    Firma: firmLabel(input.company),
    "Löschdatum": formatBerlinDate(input.deleteAt),
    "30 | 7": input.stage === "notice30" ? "30" : "7",
    "Ende Jahrespaket": formatBerlinDate(input.annualEndedAt ?? ""),
  });
}

/** a-7: unbezahlter Entwurf, 7 Tage vor der Löschung. */
export function buildDraftNoticeMail(input: {
  deleteAt: string;
  updatedAt: string;
  company?: string;
  siteUrl?: string;
}): { subject: string; text: string; html: string } {
  return renderLegalMail("a7", {
    ...common(input.siteUrl),
    Firma: firmLabel(input.company),
    "Löschdatum": formatBerlinDate(input.deleteAt),
    "Datum letzte Bearbeitung": formatBerlinDate(input.updatedAt),
  });
}

/**
 * d-0: einmal bei voller Erstattung des ersten v3-Kaufs (Löschung sofort,
 * spätestens im nächsten täglichen Lauf; Wortlaut Legal ohne Datum).
 * Option 2 = mit Jahrespaket.
 */
export function buildRefundNoticeMail(input: {
  refundedAt: string;
  option2: boolean;
  company?: string;
  siteUrl?: string;
}): { subject: string; text: string; html: string } {
  return renderLegalMail("d0", {
    ...common(input.siteUrl),
    Firma: firmLabel(input.company),
    "99 € (117,81 € brutto) | 148 € (176,12 € brutto)": input.option2 ? "148 € (176,12 € brutto)" : "99 € (117,81 € brutto)",
    "und Ihr Jahrespaket": input.option2 ? "und Ihr Jahrespaket" : "",
  });
}
