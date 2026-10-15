import { createHash } from "node:crypto";
import { normalizeAmpelEmail } from "@/lib/ampel-score";
import { ampelRateIpKey, ampelRateStore, type AmpelRateStore } from "@/lib/ampel-rate-limit";
import { KANZLEI_CONSENT_TEXT_VERSION, KANZLEI_EMAIL_INVALID, KANZLEI_MERKBLATT_PDF_PATH } from "@/lib/kanzlei-copy";
import { toKanzleiReadinessLead } from "@/lib/kanzlei-lead";
import { sendKanzleiDoiMail } from "@/lib/kanzlei-mail";
import { createKanzleiDoiToken } from "@/lib/kanzlei-token";
import type { MailResult } from "@/lib/mail";
import type { ReadinessLead } from "@/lib/readiness";
import { listKanzleiReadinessLeadsByEmail, upsertReadinessLead } from "@/lib/store";

export type SubmitKanzleiInput = {
  email: unknown;
  optin: unknown;
  honeypot: unknown;
  ip: string;
};

export type SubmitKanzleiDeps = {
  now?: () => number;
  store?: AmpelRateStore;
  saveLead?: (lead: ReadinessLead) => Promise<void>;
  listLeads?: (email: string) => Promise<ReadinessLead[]>;
  sendDoi?: (input: { email: string; token: string }) => Promise<MailResult>;
};

export type SubmitKanzleiResult =
  | { ok: true; downloadUrl: string; mailed: boolean; limited?: boolean; honeypot?: boolean }
  | { ok: false; status: 400; error: string };

function honeypotTripped(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function wantsOptIn(value: unknown): boolean {
  return value === true || value === "true" || value === "kanzlei-infos" || value === "on";
}

function rateLog(slot: number, ip: string): string {
  const hash = createHash("sha256").update(ip || "none").digest("hex").slice(0, 12);
  const safeSlot = Number.isInteger(slot) && slot > 0 ? slot : 0;
  return `[kanzlei] rate slot=${safeSlot} ip=${hash}`;
}

function delivered(mail: MailResult): boolean {
  return mail.sent || mail.stub || (mail.duplicate === true && mail.inflight !== true);
}

export async function submitKanzleiMerkblatt(
  input: SubmitKanzleiInput,
  deps: SubmitKanzleiDeps = {},
): Promise<SubmitKanzleiResult> {
  const downloadUrl = KANZLEI_MERKBLATT_PDF_PATH;
  if (honeypotTripped(input.honeypot)) {
    return { ok: true, downloadUrl, mailed: false, honeypot: true };
  }
  const email = normalizeAmpelEmail(typeof input.email === "string" ? input.email : "");
  if (!email) return { ok: false, status: 400, error: KANZLEI_EMAIL_INVALID };

  const now = deps.now?.() ?? Date.now();
  const optin = wantsOptIn(input.optin);
  const ip = input.ip.trim();
  let limited = false;
  let rateFailed = false;
  try {
    const store = deps.store ?? ampelRateStore();
    const decision = await store.take({
      ipKey: ip ? `kanzlei:${ampelRateIpKey(ip)}` : `kanzlei:ip:none:${now}`,
      emailKey: `kanzlei:em:${email}`,
      now,
    });
    console.info(rateLog(0, ip));
    if (decision === "ip" || decision === "email") limited = true;
  } catch (error) {
    console.error("[kanzlei] Rate-Limit fehlgeschlagen", error instanceof Error ? error.name : "error");
    rateFailed = true;
  }

  if (limited) return { ok: true, downloadUrl, mailed: false, limited: true };

  const downloadedAt = new Date(now).toISOString();
  const list = deps.listLeads ?? ((address: string) => listKanzleiReadinessLeadsByEmail(address, { fresh: true }));
  let blocked = false;
  try {
    const existing = await list(email);
    blocked = existing.some((lead) => lead.marketingOptIn === "withdrawn");
  } catch (error) {
    console.error("[kanzlei] Sperrliste lesen fehlgeschlagen", error instanceof Error ? error.name : "error");
  }

  const recordOptIn = optin && !blocked && !rateFailed;
  const lead = toKanzleiReadinessLead({
    email,
    downloadedAt,
    marketingOptIn: recordOptIn ? "pending" : "",
    consentAt: recordOptIn ? downloadedAt : "",
    consentIp: recordOptIn ? ip : "",
    consentTextVersion: recordOptIn ? KANZLEI_CONSENT_TEXT_VERSION : "",
    mailStatus: recordOptIn ? "doi_pending" : "",
  });
  const save = deps.saveLead ?? (async (row: ReadinessLead) => {
    await upsertReadinessLead(row);
  });
  try {
    await save(lead);
  } catch (error) {
    console.error("[kanzlei] Speichern fehlgeschlagen", error instanceof Error ? error.name : "error");
  }

  if (!recordOptIn) return { ok: true, downloadUrl, mailed: false };

  const token = createKanzleiDoiToken(
    { email, consentAt: downloadedAt, consentTextVersion: KANZLEI_CONSENT_TEXT_VERSION },
    now,
  );
  if (!token) return { ok: true, downloadUrl, mailed: false };
  try {
    const send = deps.sendDoi ?? sendKanzleiDoiMail;
    const mail = await send({ email, token });
    return { ok: true, downloadUrl, mailed: delivered(mail) };
  } catch (error) {
    console.error("[kanzlei] DOI-Mail fehlgeschlagen", error instanceof Error ? error.name : "error");
    return { ok: true, downloadUrl, mailed: false };
  }
}
