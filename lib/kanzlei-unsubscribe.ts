import { kanzleiLeadId } from "@/lib/kanzlei-lead";
import { queueOwnerNotice } from "@/lib/owner-notice";
import { verifyKanzleiUnsubscribeToken } from "@/lib/kanzlei-token";
import { emptyReadinessLead, type ReadinessLead } from "@/lib/readiness";
import { listKanzleiReadinessLeadsByEmail, upsertReadinessLead } from "@/lib/store";

export type WithdrawKanzleiDeps = {
  now?: () => number;
  list?: (email: string) => Promise<ReadinessLead[]>;
  save?: (lead: ReadinessLead) => Promise<void>;
};

let testDeps: WithdrawKanzleiDeps | null = null;

/** Isolated list and save for the prebuild check. The route itself takes no deps. */
export function setKanzleiWithdrawTestDeps(deps: WithdrawKanzleiDeps | null): void {
  testDeps = deps;
}

function withdrawalCovers(leads: ReadinessLead[], consentAt: string): boolean {
  const consentMs = Date.parse(consentAt);
  if (!Number.isFinite(consentMs)) return false;
  return leads.some((lead) => {
    if (lead.marketingOptIn !== "withdrawn" || !lead.withdrawnAt) return false;
    const withdrawnMs = Date.parse(lead.withdrawnAt);
    return Number.isFinite(withdrawnMs) && withdrawnMs >= consentMs;
  });
}

/**
 * Stops Kanzlei marketing for the consent in this token.
 * A repeat of an older token does not withdraw a consent given afterwards.
 * Withdrawn rows stay stored.
 */
export async function withdrawKanzleiMarketing(
  token: string,
  deps: WithdrawKanzleiDeps = {},
): Promise<{ ok: true } | { ok: false }> {
  const payload = await verifyKanzleiUnsubscribeToken(token);
  if (!payload) return { ok: false };
  const merged: WithdrawKanzleiDeps = { ...testDeps, ...deps };
  const list = merged.list ?? ((email: string) => listKanzleiReadinessLeadsByEmail(email, { fresh: true }));
  const save = merged.save ?? (async (lead: ReadinessLead) => {
    await upsertReadinessLead(lead);
  });
  const withdrawnAt = new Date(merged.now?.() ?? Date.now()).toISOString();
  const leads = await list(payload.email);
  if (withdrawalCovers(leads, payload.consentAt)) return { ok: true };
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
      mailStatus: "doi_revoked",
    });
    noticeWithdrawal(payload.email, payload.consentAt);
    return { ok: true };
  }
  for (const lead of pending) {
    const consentMs = Date.parse(lead.consentAt);
    const tokenMs = Date.parse(payload.consentAt);
    if (Number.isFinite(consentMs) && Number.isFinite(tokenMs) && consentMs > tokenMs) continue;
    await save({
      ...lead,
      marketingOptIn: "withdrawn",
      withdrawnAt,
      mailStatus: "doi_revoked",
    });
  }
  noticeWithdrawal(payload.email, payload.consentAt);
  return { ok: true };
}

/** Ein Hinweis pro Einwilligung. Eine bereits erfasste Abmeldung meldet nicht erneut. */
function noticeWithdrawal(email: string, consentAt: string): void {
  queueOwnerNotice({
    kind: "kanzlei-optout",
    id: kanzleiLeadId(email, consentAt),
    title: "Kanzlei-Merkblatt abgemeldet",
    email,
    facts: [["Einwilligung vom", consentAt]],
  });
}
