import { createHash } from "node:crypto";
import { emptyReadinessLead, type ReadinessLead } from "@/lib/readiness";
import { normalizeAmpelEmail } from "@/lib/ampel-score";

export function kanzleiLeadId(email: string, at: string): string {
  const hash = createHash("sha256").update(`${email}\n${at}`).digest("hex").slice(0, 32);
  return `kanzlei-${hash}`;
}

export function toKanzleiReadinessLead(input: {
  email: string;
  downloadedAt: string;
  marketingOptIn?: string;
  consentAt?: string;
  doiConfirmedAt?: string;
  consentIp?: string;
  consentTextVersion?: string;
  withdrawnAt?: string;
  mailStatus?: string;
}): ReadinessLead {
  const email = normalizeAmpelEmail(input.email) ?? "";
  const at = input.downloadedAt.trim();
  return {
    ...emptyReadinessLead(),
    timestamp: at,
    leadId: kanzleiLeadId(email, input.consentAt?.trim() || at),
    email,
    status: "kanzlei_download",
    mailStatus: input.mailStatus ?? "",
    consentAt: input.consentAt?.trim() ?? "",
    doiConfirmedAt: input.doiConfirmedAt?.trim() ?? "",
    marketingOptIn: input.marketingOptIn ?? "",
    consentIp: input.consentIp?.trim() ?? "",
    consentTextVersion: input.consentTextVersion?.trim() ?? "",
    withdrawnAt: input.withdrawnAt?.trim() ?? "",
  };
}

/**
 * Manual redaction only. No request, cron, or read path calls this.
 * A withdrawn row stays intact: it is the blocklist.
 */
export function redactKanzleiLead(lead: ReadinessLead): ReadinessLead {
  if (lead.marketingOptIn === "withdrawn") return lead;
  return {
    ...lead,
    email: "",
    consentIp: "",
    status: "kanzlei_redacted",
  };
}
