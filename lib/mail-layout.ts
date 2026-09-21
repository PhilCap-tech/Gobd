import { CANONICAL_PRODUCTION_APP_URL } from "@/lib/env";
import { LEGAL_OPERATOR } from "@/lib/legal";
import {
  BRAND_GREEN,
  BRAND_HEADER_BG,
  BRAND_INK,
  BRAND_MUTED,
  BRAND_NAME,
  BRAND_RULE,
} from "@/lib/pdf-brand";

/** Production home — logo and footer links always point here, not preview hosts. */
export const MAIL_SITE_URL = CANONICAL_PRODUCTION_APP_URL;
export const MAIL_LOGO_URL = `${MAIL_SITE_URL}/brand/logo-lockup.png`;
export const MAIL_FAQ_URL = `${MAIL_SITE_URL}/faq`;
export const MAIL_IMPRESSUM_URL = `${MAIL_SITE_URL}/impressum`;
export const MAIL_DATENSCHUTZ_URL = `${MAIL_SITE_URL}/datenschutz`;
export const MAIL_CHECKOUT_URL = `${MAIL_SITE_URL}/checkout`;
export const MAIL_BILLING_URL = `${MAIL_SITE_URL}/account/billing`;
export const MAIL_SUPPORT_EMAIL = LEGAL_OPERATOR.email;

const ADDRESS_LINE = `${LEGAL_OPERATOR.name} · ${LEGAL_OPERATOR.street} · ${LEGAL_OPERATOR.zipCity}`;
const NO_ADVICE_LINE = "Keine Steuer- oder Rechtsberatung.";

const FONT_SANS =
  "'Segoe UI', Tahoma, Arial, Helvetica, sans-serif";
const FONT_SERIF = "Georgia, 'Times New Roman', Times, serif";

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function escapeAttr(value: string): string {
  return escapeHtml(value).replaceAll('"', "&quot;");
}

function footerTextLines(): string[] {
  return [
    `${BRAND_NAME} · ${LEGAL_OPERATOR.name}`,
    `Impressum: ${MAIL_IMPRESSUM_URL}`,
    `FAQ: ${MAIL_FAQ_URL}`,
    `Datenschutz: ${MAIL_DATENSCHUTZ_URL}`,
    `Kontakt: ${MAIL_SUPPORT_EMAIL}`,
    ADDRESS_LINE,
    NO_ADVICE_LINE,
  ];
}

/** Plain-text footer appended to every transactional mail. */
export function wrapTransactionalText(bodyText: string): string {
  return `${bodyText.trimEnd()}\n\n${footerTextLines().join("\n")}\n`;
}

function footerLink(href: string, label: string): string {
  return `<a href="${escapeAttr(href)}" style="color:${BRAND_GREEN};text-decoration:underline;">${escapeHtml(label)}</a>`;
}

function withMailLinkColor(html: string): string {
  return html.replaceAll(
    "<a href=",
    `<a style="color:${BRAND_GREEN};text-decoration:underline;" href=`,
  );
}

/**
 * Table-based brand shell (header + footer) around inner body HTML.
 * `bodyHtml` is a fragment (`<p>…</p>`), not a full document.
 */
export function wrapTransactionalHtml(bodyHtml: string): string {
  const home = escapeAttr(MAIL_SITE_URL);
  const logo = escapeAttr(MAIL_LOGO_URL);
  const supportMailto = escapeAttr(`mailto:${MAIL_SUPPORT_EMAIL}`);
  const brand = escapeHtml(BRAND_NAME);
  const operator = escapeHtml(LEGAL_OPERATOR.name);
  const address = escapeHtml(ADDRESS_LINE);
  const noAdvice = escapeHtml(NO_ADVICE_LINE);

  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta http-equiv="x-ua-compatible" content="ie=edge" />
<title>${brand}</title>
<style type="text/css">
  a { color: ${BRAND_GREEN}; }
  .mail-body p { margin: 0 0 14px; }
  .mail-body ol { margin: 0 0 14px; padding-left: 22px; }
  .mail-body p:last-child { margin-bottom: 0; }
</style>
</head>
<body style="margin:0;padding:0;background-color:#f4f5f2;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f5f2;margin:0;padding:0;width:100%;">
  <tr>
    <td align="center" style="padding:24px 12px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background-color:#ffffff;border:1px solid ${BRAND_RULE};">
        <tr>
          <td style="padding:20px 28px;background-color:${BRAND_HEADER_BG};border-bottom:1px solid ${BRAND_RULE};font-family:${FONT_SANS};">
            <a href="${home}" style="text-decoration:none;">
              <img src="${logo}" alt="${brand}" width="106" height="40" style="display:block;border:0;height:40px;width:auto;" />
            </a>
            <p style="margin:10px 0 0;font-size:13px;line-height:1.4;color:${BRAND_MUTED};">${brand}<br /><span style="font-size:12px;">${operator}</span></p>
          </td>
        </tr>
        <tr>
          <td class="mail-body" style="padding:28px;font-family:${FONT_SERIF};font-size:16px;line-height:1.6;color:${BRAND_INK};">
            ${withMailLinkColor(bodyHtml.trim())}
          </td>
        </tr>
        <tr>
          <td style="padding:20px 28px;background-color:${BRAND_HEADER_BG};border-top:1px solid ${BRAND_RULE};font-family:${FONT_SANS};font-size:13px;line-height:1.6;color:${BRAND_MUTED};">
            <p style="margin:0 0 10px;">
              ${footerLink(MAIL_IMPRESSUM_URL, "Impressum")}
              &nbsp;·&nbsp;
              ${footerLink(MAIL_FAQ_URL, "FAQ")}
              &nbsp;·&nbsp;
              ${footerLink(MAIL_DATENSCHUTZ_URL, "Datenschutz")}
              &nbsp;·&nbsp;
              ${footerLink(`mailto:${MAIL_SUPPORT_EMAIL}`, "Kontakt")}
            </p>
            <p style="margin:0 0 10px;">
              <a href="${supportMailto}" style="color:${BRAND_GREEN};text-decoration:underline;">${escapeHtml(MAIL_SUPPORT_EMAIL)}</a>
            </p>
            <p style="margin:0 0 10px;">${address}</p>
            <p style="margin:0;">${noAdvice}</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}
