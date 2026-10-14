import { verifyAmpelUnsubscribeToken } from "@/lib/ampel";
import { listAmpelReadinessLeadsByEmail, upsertReadinessLead } from "@/lib/store";
import type { ReadinessLead } from "@/lib/readiness";

export type WithdrawAmpelDeps = {
  now?: () => number;
  list?: (email: string) => Promise<ReadinessLead[]>;
  save?: (lead: ReadinessLead) => Promise<void>;
};

/** Stops marketing for this address. The requested result PDF is not affected. */
export async function withdrawAmpelMarketing(
  token: string,
  deps: WithdrawAmpelDeps = {},
): Promise<{ ok: true; email: string } | { ok: false }> {
  const payload = verifyAmpelUnsubscribeToken(token);
  if (!payload) return { ok: false };
  const list = deps.list ?? ((email: string) => listAmpelReadinessLeadsByEmail(email, { fresh: true }));
  const save = deps.save ?? (async (lead: ReadinessLead) => {
    await upsertReadinessLead(lead);
  });
  const withdrawnAt = new Date(deps.now?.() ?? Date.now()).toISOString();
  const leads = await list(payload.email);
  for (const lead of leads) {
    if (lead.marketingOptIn !== "pending" && lead.marketingOptIn !== "confirmed") continue;
    await save({
      ...lead,
      marketingOptIn: "withdrawn",
      withdrawnAt,
    });
  }
  return { ok: true, email: payload.email };
}
