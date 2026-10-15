import type { ReadinessLead } from "@/lib/readiness";

/**
 * Manual redaction of an Ampel row. Nothing in the request path calls this.
 * Withdrawn rows stay unchanged: they are the blocklist.
 */
export function redactAmpelLead(lead: ReadinessLead): ReadinessLead {
  if (lead.marketingOptIn === "withdrawn") return lead;
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
