/** Ablaufseite für den Magic-Link der Onboarding-Mail. Kein Login. */

export const EXPIRED_LINK_HEADING = "Dieser Anmeldelink ist abgelaufen";

export const EXPIRED_LINK_LEAD =
  "Der Link gilt 20 Minuten. Mit dem Button senden Sie sich einen neuen Link. Danach öffnet er wieder Ihren Entwurf.";

/** Sichtbare Adresse: erstes Zeichen, Rest der Local-Part maskiert. */
export function maskEmailAddress(email: string): string {
  const trimmed = email.trim().toLowerCase();
  const at = trimmed.indexOf("@");
  if (at <= 0 || at >= trimmed.length - 1) return "Ihre E-Mail";
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  if (!domain.includes(".")) return "Ihre E-Mail";
  return `${local.slice(0, 1)}***@${domain}`;
}

export function renewExpiredLinkLabel(maskedEmail: string): string {
  return `Neuen Link an ${maskedEmail} senden`;
}

/** Nur der Intake-Zielpfad der Onboarding-Mail, nach safeNextPath. */
export function isOnboardingIntakeNext(next: string | null | undefined): boolean {
  if (!next) return false;
  return next === "/intake" || next.startsWith("/intake?");
}
