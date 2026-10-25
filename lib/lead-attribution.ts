/**
 * Tool, src and variant columns on the readiness lead row.
 * utm_source and utm_campaign stay on the sheet and are written empty for a
 * new row. Test addresses and listed firms stay out, same predicates as the
 * lead notice. Click ids are not accepted and are not fields on the row.
 */
import { isAmpelTestEmail } from "@/lib/ampel-stats";
import { normalizeAmpelEmail } from "@/lib/ampel-score";
import { sanitizeUtmValue, sanitizeVariantValue } from "@/lib/campaign-params";
import { isTestEntity } from "@/lib/test-entities";

export type CheckLeadTool = "ampel" | "kassen";

export function storedCheckAttribution(input: {
  email: string;
  entityId?: string | null;
  tool: CheckLeadTool;
  utmSource: unknown;
  utmCampaign: unknown;
  src?: unknown;
  variant?: unknown;
}): { tool: string; utmSource: string; utmCampaign: string; src: string; variant: string } {
  const email = normalizeAmpelEmail(input.email);
  if (!email || isAmpelTestEmail(email) || isTestEntity(input.entityId)) {
    return { tool: "", utmSource: "", utmCampaign: "", src: "", variant: "" };
  }
  return {
    tool: input.tool,
    utmSource: sanitizeUtmValue(input.utmSource),
    utmCampaign: sanitizeUtmValue(input.utmCampaign),
    src: sanitizeVariantValue(input.src),
    variant: sanitizeVariantValue(input.variant),
  };
}

/**
 * Ampel and Kassen rows keep the utm_source and utm_campaign columns and write
 * them empty. This does not read or rewrite an existing sheet row.
 */
export function withoutAmpelUtm<T extends { utmSource: string; utmCampaign: string }>(
  attribution: T,
): T {
  return { ...attribution, utmSource: "", utmCampaign: "" };
}

/**
 * Keep a previously stored source when this write does not carry one.
 * An explicit empty tool (test address or listed firm) stays empty.
 * utm_source and utm_campaign are never taken from this write. A new row
 * stores them empty. An existing row keeps the values already stored.
 */
export function keptCheckAttribution(
  input: { tool?: string; utmSource?: string; utmCampaign?: string; src?: string; variant?: string },
  existing: { tool?: string; utmSource?: string; utmCampaign?: string; src?: string; variant?: string } | null,
): { tool: string; utmSource: string; utmCampaign: string; src: string; variant: string } {
  const tool = input.tool ?? existing?.tool ?? "";
  return {
    tool: tool === "ampel" || tool === "kassen" ? tool : "",
    utmSource: existing?.utmSource ?? "",
    utmCampaign: existing?.utmCampaign ?? "",
    src: input.src !== undefined ? sanitizeVariantValue(input.src) : (existing?.src ?? ""),
    variant: input.variant !== undefined ? sanitizeVariantValue(input.variant) : (existing?.variant ?? ""),
  };
}
