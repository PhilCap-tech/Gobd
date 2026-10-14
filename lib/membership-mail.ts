import { CANCELLATION_MAIL_FROM } from "@/lib/kuendigung";
import {
  escapeAttr,
  escapeHtml,
  transactionalPrimaryButton,
  wrapTransactionalHtml,
  wrapTransactionalText,
} from "@/lib/mail-layout";
import { CUSTOMER_MAIL_SIGNATURE } from "@/lib/ops";
import type { TransactionalMailContent } from "@/lib/ops";

/** Dieselbe info@-Adresse wie die übrigen Produktmails. Die Umgebung bleibt unverändert. */
export const INVITE_MAIL_FROM = CANCELLATION_MAIL_FROM;

export function buildInviteMail(input: {
  firmName: string;
  street: string;
  zip: string;
  city: string;
  ownerEmail: string;
  inviteUrl: string;
}): TransactionalMailContent {
  const firm = input.firmName.trim() || "der Firma";
  const place = [input.street.trim(), [input.zip.trim(), input.city.trim()].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");
  const lines = [
    "Guten Tag,",
    "",
    `${input.ownerEmail} lädt Sie ein, als Mitwirkende bei ${firm} Module auszufüllen.`,
  ];
  if (place) lines.push(`Anschrift: ${place}`);
  lines.push(
    "",
    "Sie speichern Entwürfe. Die PDF-Fassung ist für Sie nicht lesbar. Sie bleibt beim Kontoinhaber.",
    "Den Vertrag hält der Kontoinhaber.",
    "",
    "Einladung annehmen:",
    input.inviteUrl,
    "",
    "Der Link ist 20 Minuten gültig. Ein neuer Versand ersetzt ihn.",
    "Wenn Sie diese Einladung nicht erwarten, können Sie diese E-Mail ignorieren.",
    "",
    CUSTOMER_MAIL_SIGNATURE,
  );
  const text = wrapTransactionalText(lines.join("\n"));
  const html = wrapTransactionalHtml(`
    <p>Guten Tag,</p>
    <p>${escapeHtml(input.ownerEmail)} lädt Sie ein, als Mitwirkende bei ${escapeHtml(firm)} Module auszufüllen.</p>
    ${place ? `<p>Anschrift: ${escapeHtml(place)}</p>` : ""}
    <p>Sie speichern Entwürfe. Die PDF-Fassung ist für Sie nicht lesbar. Sie bleibt beim Kontoinhaber.<br />Den Vertrag hält der Kontoinhaber.</p>
    <p>${transactionalPrimaryButton(input.inviteUrl, "Einladung annehmen")}</p>
    <p>Der Link ist 20 Minuten gültig. Ein neuer Versand ersetzt ihn.<br />Wenn Sie diese Einladung nicht erwarten, können Sie diese E-Mail ignorieren.</p>
    <p>${escapeHtml(CUSTOMER_MAIL_SIGNATURE)}</p>
  `);
  return {
    subject: `Einladung als Mitwirkende — ${firm}`,
    text,
    html,
  };
}

/** Der Link steht nur im Body. Der Betreff nennt Firma und Einladung. */
export function inviteUrlInBody(mail: TransactionalMailContent, inviteUrl: string): boolean {
  return mail.text.includes(inviteUrl) && mail.html.includes(escapeAttr(inviteUrl)) && !mail.subject.includes(inviteUrl);
}
