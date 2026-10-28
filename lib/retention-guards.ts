/**
 * Löschlauf Preismodell v3: Ausschlüsse (rein, ohne Store/Netz).
 *
 * Gelöscht werden nur Datensätze des neuen Modells. Nie: Bestands-/Altkunden
 * (149 € + 49 €/Monat), Digistore24, Comp/Allowlist, Testkonten. Fehlt die
 * Modell-Markierung oder ist sie unklar: nicht löschen (fail closed).
 */
import { WIPE_EMAIL_ALLOWLIST } from "@/lib/admin-wipe";
import { isAmpelTestEmail } from "@/lib/ampel-stats";
import { CHECKOUT_NOTICE_TO } from "@/lib/checkout-notice";
import { COMP_ACCESS_EMAILS } from "@/lib/comp-access";
import { isOwnerNoticeTestEmail } from "@/lib/owner-notice";
import { PILOT_PAYMENT_FAILED_EXEMPT_EMAILS } from "@/lib/pilot-exemptions";
import { isTestEntity } from "@/lib/test-entities";

/** Werte der Modell-Markierung, die der neue Flow schreibt (Code-Name `v2` = Angebot v3). */
export const RETENTION_MODEL_MARKERS = ["v3", "v2"] as const;

/** Testdomains (exakt oder Subdomain). Ergänzt die Listen aus admin-wipe, ampel-stats, owner-notice. */
export const RETENTION_TEST_DOMAINS = [
  "example.com",
  "example.invalid",
  "resend.dev",
  "sdc-ventures.com",
  "ikat-gmbh.de",
  "gobd-doku-erstellen.de",
  "maxxspace.com",
  "mail.tm",
] as const;

/** Philips Adressen (zusätzlich zu den Domains oben). */
export const RETENTION_TEST_EMAILS = ["cappe@gmx.de", "philip.cappelletti@sdc-ventures.com"] as const;

/** Platzhalter, mit dem der Löschlauf Sheet-Zeilen markiert (keine echte Domain). */
export const RETENTION_REDACTED_DOMAIN = "loeschlauf.invalid";

export type ExclusionGroup = "test" | "comp" | "ds24" | "legacy" | "marker";
export const EXCLUSION_GROUPS: readonly ExclusionGroup[] = ["test", "comp", "ds24", "legacy", "marker"];

function norm(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export function isRetentionTestEmail(email: string | null | undefined): boolean {
  const value = norm(email);
  if (!value) return false;
  const at = value.lastIndexOf("@");
  const domain = at >= 0 ? value.slice(at + 1) : "";
  if (RETENTION_TEST_EMAILS.some((item) => item === value)) return true;
  if (WIPE_EMAIL_ALLOWLIST.some((item) => item.toLowerCase() === value)) return true;
  if (value === norm(CHECKOUT_NOTICE_TO)) return true;
  if (domain && RETENTION_TEST_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`))) return true;
  if (domain === RETENTION_REDACTED_DOMAIN) return true;
  return isAmpelTestEmail(value) || isOwnerNoticeTestEmail(value);
}

export function isRetentionCompEmail(email: string | null | undefined): boolean {
  const value = norm(email);
  if (!value) return false;
  return (
    COMP_ACCESS_EMAILS.some((item) => item.toLowerCase() === value) ||
    PILOT_PAYMENT_FAILED_EXEMPT_EMAILS.some((item) => item.toLowerCase() === value)
  );
}

export function hasNewModelMarker(value: string | null | undefined): boolean {
  const marker = norm(value);
  return (RETENTION_MODEL_MARKERS as readonly string[]).includes(marker);
}

/** Fakten zu einer Mailbox, vom Lauf gesammelt. Unbekannt = true (fail closed). */
export type AccountFacts = {
  /** Mailbox(en), die betroffen wären (Inhaber; bei Einladungen auch die eingeladene Person). */
  emails: readonly string[];
  entityIds?: readonly string[];
  /** Digistore24-Datensatz vorhanden (aktiv oder gesperrt) oder nicht lesbar. */
  ds24: boolean;
  /** Altkunde: Dokument-/Kaufzeile mit Stripe-Session außerhalb des neuen Modells, oder nicht lesbar. */
  legacy: boolean;
  /** Eindeutige Markierung des neuen Modells. */
  marker: boolean;
};

/** Erster zutreffender Ausschluss, sonst null (= darf geprüft werden). Reihenfolge fest. */
export function exclusionFor(facts: AccountFacts): ExclusionGroup | null {
  const emails = facts.emails.map(norm);
  if (emails.length === 0 || emails.some((email) => !email)) return "marker";
  if (emails.some(isRetentionTestEmail)) return "test";
  if ((facts.entityIds ?? []).some((id) => isTestEntity(id))) return "test";
  if (emails.some(isRetentionCompEmail)) return "comp";
  if (facts.ds24 !== false) return "ds24";
  if (facts.legacy !== false) return "legacy";
  if (facts.marker !== true) return "marker";
  return null;
}
