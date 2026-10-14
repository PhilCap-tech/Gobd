import { WIPE_EMAIL_ALLOWLIST } from "@/lib/admin-wipe";

/**
 * Logged-in viewers of the Ampel count. Reuses the fixed admin/owner
 * addresses from the wipe allowlist. The example.com wipe domain stays out:
 * a smoke mailbox must not open this list.
 */
const adminEmails = new Set(WIPE_EMAIL_ALLOWLIST.map((email) => email.toLowerCase()));

export function isAmpelAdminEmail(email: string | null | undefined): boolean {
  const normalized = email?.trim().toLowerCase() ?? "";
  if (!normalized || !normalized.includes("@")) return false;
  return adminEmails.has(normalized);
}

/** Missing or blank env disables the bearer door. Fail closed. */
export function adminStatsToken(envValue: string | undefined): string | null {
  if (typeof envValue !== "string") return null;
  const token = envValue.trim();
  if (!token) return null;
  return token;
}
