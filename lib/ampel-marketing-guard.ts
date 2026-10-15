import { normalizeAmpelEmail } from "@/lib/ampel-score";
import { readAmpelSuppression } from "@/lib/ampel-suppression";
import type { ReadinessLead } from "@/lib/readiness";
import { listAmpelReadinessLeadsByEmail } from "@/lib/store";

let listOverride: ((email: string) => Promise<ReadinessLead[]>) | null = null;

/** Lead lookup for the prebuild check. Production reads the readiness store. */
export function setAmpelMarketingLeadLookup(
  lookup: ((email: string) => Promise<ReadinessLead[]>) | null,
): void {
  listOverride = lookup;
}

/**
 * True when this consent is covered by a withdrawal.
 * A consent given after the withdrawal is not blocked: it still needs its own DOI.
 * A missing or unreadable list blocks (fail closed).
 */
export async function ampelConsentBlocked(email: string, consentAt: string): Promise<boolean> {
  const normalized = normalizeAmpelEmail(email);
  if (!normalized) return true;
  let row: Awaited<ReturnType<typeof readAmpelSuppression>>;
  try {
    row = await readAmpelSuppression(normalized);
  } catch (error) {
    console.error("[ampel] Sperrliste lesen fehlgeschlagen", error instanceof Error ? error.name : "error");
    return true;
  }
  if (!row) return false;
  const consentMs = Date.parse(consentAt);
  const withdrawnMs = Date.parse(row.withdrawnAt);
  if (!Number.isFinite(consentMs) || !Number.isFinite(withdrawnMs)) return true;
  return consentMs <= withdrawnMs;
}

/**
 * Marketing mail is allowed only for this exact consent after a confirmed DOI,
 * and only when that consent is not covered by a later withdrawal.
 */
export async function mayMarket(
  email: string,
  consent: { consentAt: string; answers: string },
): Promise<boolean> {
  const normalized = normalizeAmpelEmail(email);
  if (!normalized) return false;
  if (await ampelConsentBlocked(normalized, consent.consentAt)) return false;
  let leads: ReadinessLead[];
  try {
    leads = listOverride
      ? await listOverride(normalized)
      : await listAmpelReadinessLeadsByEmail(normalized, { fresh: true });
  } catch (error) {
    console.error("[ampel] Einwilligung lesen fehlgeschlagen", error instanceof Error ? error.name : "error");
    return false;
  }
  return leads.some(
    (lead) =>
      lead.email.trim().toLowerCase() === normalized &&
      lead.marketingOptIn === "confirmed" &&
      Boolean(lead.doiConfirmedAt) &&
      lead.consentAt === consent.consentAt &&
      lead.ampelAnswers === consent.answers,
  );
}
