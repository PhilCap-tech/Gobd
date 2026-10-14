import type { ReadinessLead } from "@/lib/readiness";

/** Check data without a marketing opt-in. [Default, Philip prüft] */
export const AMPEL_CHECK_RETENTION_DAYS = 90;

/** Unconfirmed marketing opt-in. [Default, Philip prüft] */
export const AMPEL_UNCONFIRMED_OPT_IN_RETENTION_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * When the address and answers may be deleted.
 * A confirmed or withdrawn opt-in is kept until a separate decision.
 * Returns null when this row is not deleted on a timer.
 */
export function ampelRetainUntil(lead: Pick<ReadinessLead, "marketingOptIn" | "consentAt" | "timestamp">): number | null {
  if (lead.marketingOptIn === "confirmed" || lead.marketingOptIn === "withdrawn") return null;
  const start = Date.parse(lead.consentAt || lead.timestamp);
  if (!Number.isFinite(start)) return null;
  const days =
    lead.marketingOptIn === "pending"
      ? AMPEL_UNCONFIRMED_OPT_IN_RETENTION_DAYS
      : AMPEL_CHECK_RETENTION_DAYS;
  return start + days * DAY_MS;
}

export function ampelRecordExpired(
  lead: Pick<ReadinessLead, "marketingOptIn" | "consentAt" | "timestamp">,
  now = Date.now(),
): boolean {
  const until = ampelRetainUntil(lead);
  return until != null && now >= until;
}

/** Drops the address, the answers, and the IP. The row id stays so the sheet updates in place. */
export function redactAmpelLead(lead: ReadinessLead): ReadinessLead {
  return {
    ...lead,
    email: "",
    consentIp: "",
    advisorRef: "",
    ampelAnswers: "",
    ampelScore: "",
    ampelLight: "",
    marketingOptIn: "",
    status: "ampel_expired",
  };
}
