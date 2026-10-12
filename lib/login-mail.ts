import { magicLinkUrl } from "@/lib/auth";
import { isMailConfigured, magicLinkDevFallbackAllowed } from "@/lib/env";
import { sendMagicLinkMail } from "@/lib/ops";

export const LOGIN_LINK_GENERIC_OK =
  "Wenn ein Konto existiert, ist ein Link unterwegs.";

export const LOGIN_LINK_FAILED_NOTICE =
  "Der Anmeldelink konnte gerade nicht gesendet werden. Bitte versuchen Sie es später erneut.";

export function loginLinkSentNotice(email: string): string {
  const address = email.trim();
  return address
    ? `Wir haben Ihnen einen Anmeldelink an ${address} gesendet.`
    : "Wir haben Ihnen einen Anmeldelink gesendet.";
}

export type LoginMailStatus = "sent" | "stub" | "failed";

export function loginMailState(
  mailStatus: string,
): LoginMailStatus | "unknown" {
  const match = /(?:^|,)login:(sent|failed|stub)(?:,|$)/.exec(mailStatus);
  if (!match) return "unknown";
  if (match[1] === "sent" || match[1] === "failed" || match[1] === "stub") {
    return match[1];
  }
  return "unknown";
}

export function readinessMailStatus(pdf: string, login: LoginMailStatus): string {
  return `pdf:${pdf},login:${login}`;
}

/**
 * Schickt den Anmeldelink per Mail. Der Link steht nie in der Rückgabe.
 * Ohne Resend nur im lokalen Server-Log, und nur wenn der Dev-Fallback offen ist.
 */
export async function deliverLoginLink(
  email: string,
  next?: string | null,
): Promise<LoginMailStatus> {
  const address = email.trim().toLowerCase();
  if (!address || !address.includes("@")) return "failed";

  if (!isMailConfigured()) {
    if (!magicLinkDevFallbackAllowed()) {
      console.error("[auth] Anmeldelink nicht konfiguriert");
      return "failed";
    }
    const url = magicLinkUrl(address, next);
    console.info(
      "[auth] dev fallback Anmeldelink — nur Server-Log, nicht in der Response",
    );
    console.info(url);
    return "stub";
  }

  try {
    const url = magicLinkUrl(address, next);
    const mail = await sendMagicLinkMail({ email: address, magicLinkUrl: url });
    if (mail.sent) return "sent";
    console.error("[auth] Anmeldelink fehlgeschlagen", { stub: mail.stub });
    return "failed";
  } catch (error) {
    console.error(
      "[auth] Anmeldelink fehlgeschlagen",
      error instanceof Error ? error.name : "error",
    );
    return "failed";
  }
}
