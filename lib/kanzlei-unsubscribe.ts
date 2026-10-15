import { kanzleiLeadId } from "@/lib/kanzlei-lead";
import { verifyKanzleiUnsubscribeToken } from "@/lib/kanzlei-token";
import { emptyReadinessLead, type ReadinessLead } from "@/lib/readiness";
import { listKanzleiReadinessLeadsByEmail, upsertReadinessLead } from "@/lib/store";

export type WithdrawKanzleiDeps = {
  now?: () => number;
  list?: (email: string) => Promise<ReadinessLead[]>;
  save?: (lead: ReadinessLead) => Promise<void>;
};

/** Stops Kanzlei-Informationen for this address. The row stays as the blocklist. */
export async function withdrawKanzleiMarketing(
  token: string,
  deps: WithdrawKanzleiDeps = {},
): Promise<{ ok: true } | { ok: false }> {
  const payload = verifyKanzleiUnsubscribeToken(token);
  if (!payload) return { ok: false };
  const list = deps.list ?? ((email: string) => listKanzleiReadinessLeadsByEmail(email, { fresh: true }));
  const save = deps.save ?? (async (lead: ReadinessLead) => {
    await upsertReadinessLead(lead);
  });
  const withdrawnAt = new Date(deps.now?.() ?? Date.now()).toISOString();
  const leads = await list(payload.email);
  const pending = leads.filter(
    (lead) => lead.marketingOptIn === "pending" || lead.marketingOptIn === "confirmed",
  );
  if (pending.length === 0 && !leads.some((lead) => lead.marketingOptIn === "withdrawn")) {
    await save({
      ...emptyReadinessLead(),
      timestamp: withdrawnAt,
      leadId: kanzleiLeadId(payload.email, payload.consentAt),
      email: payload.email,
      status: "kanzlei_download",
      consentAt: payload.consentAt,
      marketingOptIn: "withdrawn",
      withdrawnAt,
    });
    return { ok: true };
  }
  for (const lead of pending) {
    await save({
      ...lead,
      marketingOptIn: "withdrawn",
      withdrawnAt,
    });
  }
  return { ok: true };
}
