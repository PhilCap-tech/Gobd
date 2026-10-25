import { verifyAmpelUnsubscribeToken } from "@/lib/ampel";
import { recordAmpelSuppression, type AmpelSuppressionChannel } from "@/lib/ampel-suppression";
import { listAmpelReadinessLeadsByEmail, upsertReadinessLead } from "@/lib/store";
import type { ReadinessLead } from "@/lib/readiness";

export type WithdrawAmpelDeps = {
  now?: () => number;
  list?: (email: string) => Promise<ReadinessLead[]>;
  save?: (lead: ReadinessLead) => Promise<void>;
  channel?: AmpelSuppressionChannel;
  suppress?: (email: string, input: { withdrawnAt: string; consentAt: string; channel: AmpelSuppressionChannel }) => Promise<void>;
};

let testDeps: WithdrawAmpelDeps | null = null;

/** Isolated list and save for the prebuild check. The route itself takes no deps. */
export function setAmpelWithdrawTestDeps(deps: WithdrawAmpelDeps | null): void {
  testDeps = deps;
}

/** Stops marketing for this address and records the suppression list. The requested result PDF is not affected. */
export async function withdrawAmpelMarketing(
  token: string,
  deps: WithdrawAmpelDeps = {},
): Promise<{ ok: true; email: string } | { ok: false }> {
  const payload = await verifyAmpelUnsubscribeToken(token);
  if (!payload) return { ok: false };
  const merged: WithdrawAmpelDeps = { ...testDeps, ...deps };
  const list = merged.list ?? ((email: string) => listAmpelReadinessLeadsByEmail(email, { fresh: true }));
  const save = merged.save ?? (async (lead: ReadinessLead) => {
    await upsertReadinessLead(lead);
  });
  const suppress = merged.suppress ?? recordAmpelSuppression;
  const withdrawnAt = new Date(merged.now?.() ?? Date.now()).toISOString();
  const leads = await list(payload.email);
  for (const lead of leads) {
    if (lead.marketingOptIn !== "pending" && lead.marketingOptIn !== "confirmed") continue;
    await save({
      ...lead,
      marketingOptIn: "withdrawn",
      withdrawnAt,
    });
  }
  await suppress(payload.email, {
    withdrawnAt,
    consentAt: payload.consentAt,
    channel: merged.channel ?? "link",
  });
  return { ok: true, email: payload.email };
}
