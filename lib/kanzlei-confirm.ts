import { KANZLEI_CONSENT_TEXT_VERSION } from "@/lib/kanzlei-copy";
import { kanzleiLeadId } from "@/lib/kanzlei-lead";
import { verifyKanzleiDoiToken } from "@/lib/kanzlei-token";
import { emptyReadinessLead, type ReadinessLead } from "@/lib/readiness";
import { findReadinessLeadById, upsertReadinessLead } from "@/lib/store";

export type ConfirmKanzleiDeps = {
  now?: () => number;
  findLead?: (leadId: string) => Promise<ReadinessLead | null>;
  saveLead?: (lead: ReadinessLead) => Promise<void>;
};

export type ConfirmKanzleiResult =
  | { ok: true; withdrawn?: boolean; already?: boolean }
  | { ok: false; status: 400; reason: "invalid" };

export async function confirmKanzleiDoi(
  token: string,
  deps: ConfirmKanzleiDeps = {},
): Promise<ConfirmKanzleiResult> {
  const now = deps.now?.() ?? Date.now();
  const payload = verifyKanzleiDoiToken(token, now);
  if (!payload) return { ok: false, status: 400, reason: "invalid" };
  const leadId = kanzleiLeadId(payload.email, payload.consentAt);
  const find = deps.findLead ?? ((id: string) => findReadinessLeadById(id, { fresh: true }));
  const save = deps.saveLead ?? (async (lead: ReadinessLead) => {
    await upsertReadinessLead(lead);
  });
  let existing: ReadinessLead | null = null;
  try {
    existing = await find(leadId);
  } catch (error) {
    console.error("[kanzlei] Lead lesen fehlgeschlagen", error instanceof Error ? error.name : "error");
  }
  if (existing?.marketingOptIn === "withdrawn") return { ok: true, withdrawn: true };
  if (existing?.marketingOptIn === "confirmed" && existing.doiConfirmedAt) {
    return { ok: true, already: true };
  }
  const confirmedAt = existing?.doiConfirmedAt || new Date(now).toISOString();
  const next: ReadinessLead = {
    ...(existing ?? {
      ...emptyReadinessLead(),
      timestamp: payload.consentAt,
      leadId,
      email: payload.email,
      status: "kanzlei_download",
      consentAt: payload.consentAt,
      marketingOptIn: "pending",
      consentTextVersion: payload.consentTextVersion || KANZLEI_CONSENT_TEXT_VERSION,
    }),
    leadId,
    email: payload.email,
    status: "kanzlei_download",
    consentAt: payload.consentAt,
    doiConfirmedAt: confirmedAt,
    marketingOptIn: "confirmed",
    consentTextVersion: existing?.consentTextVersion || payload.consentTextVersion || KANZLEI_CONSENT_TEXT_VERSION,
    consentIp: existing?.consentIp || "",
  };
  try {
    await save(next);
  } catch (error) {
    console.error("[kanzlei] Bestätigung speichern fehlgeschlagen", error instanceof Error ? error.name : "error");
    return { ok: false, status: 400, reason: "invalid" };
  }
  return { ok: true };
}
