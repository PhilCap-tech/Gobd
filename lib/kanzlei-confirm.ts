import { KANZLEI_CONSENT_TEXT_VERSION } from "@/lib/kanzlei-copy";
import { kanzleiLeadId } from "@/lib/kanzlei-lead";
import { verifyKanzleiDoiToken } from "@/lib/kanzlei-token";
import { emptyReadinessLead, type ReadinessLead } from "@/lib/readiness";
import { listKanzleiReadinessLeadsByEmail, upsertReadinessLead } from "@/lib/store";

export type ConfirmKanzleiDeps = {
  now?: () => number;
  listLeads?: (email: string) => Promise<ReadinessLead[]>;
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
  const list = deps.listLeads ?? ((email: string) => listKanzleiReadinessLeadsByEmail(email, { fresh: true }));
  const save = deps.saveLead ?? (async (lead: ReadinessLead) => {
    await upsertReadinessLead(lead);
  });
  let leads: ReadinessLead[];
  try {
    leads = await list(payload.email);
  } catch (error) {
    console.error("[kanzlei] Lead lesen fehlgeschlagen", error instanceof Error ? error.name : "error");
    return { ok: false, status: 400, reason: "invalid" };
  }
  const existing = leads.find((lead) => lead.leadId === leadId) ?? null;
  const consentMs = Date.parse(payload.consentAt);
  const coveredByWithdrawal = leads.some((lead) => {
    if (lead.marketingOptIn !== "withdrawn" || !lead.withdrawnAt) return false;
    const withdrawnMs = Date.parse(lead.withdrawnAt);
    return Number.isFinite(withdrawnMs) && Number.isFinite(consentMs) && consentMs <= withdrawnMs;
  });
  if (existing?.marketingOptIn === "withdrawn" || coveredByWithdrawal) {
    return { ok: true, withdrawn: true };
  }
  const replaced = existing?.mailStatus === "doi_replaced";
  const newerConsent = leads.some((lead) => {
    const at = Date.parse(lead.consentAt);
    if (!Number.isFinite(at) || at <= consentMs) return false;
    return lead.marketingOptIn === "pending" || lead.marketingOptIn === "confirmed";
  });
  if (replaced || newerConsent) return { ok: false, status: 400, reason: "invalid" };
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
