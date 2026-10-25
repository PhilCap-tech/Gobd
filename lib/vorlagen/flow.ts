import { normalizeAmpelEmail } from "@/lib/ampel-score";
import { ampelConsentBlocked } from "@/lib/ampel-marketing-guard";
import { ampelRateStore, type AmpelRateStore } from "@/lib/ampel-rate-limit";
import { recordAmpelSuppression, type AmpelSuppressionChannel } from "@/lib/ampel-suppression";
import type { MailResult } from "@/lib/mail";
import type { DedupedMailInput } from "@/lib/mail-dedupe";
import { emptyCalc, parseMagnetCalc, type CalcSnapshot } from "@/lib/vorlagen/calc";
import {
  MAGNET_CALC_INVALID,
  MAGNET_EMAIL_INVALID,
  MAGNET_INPUT_INVALID,
  MAGNET_LATER,
  MAGNET_RATE_LIMITED,
  MAGNET_SEND_FAILED,
  magnetConsentVersion,
} from "@/lib/vorlagen/copy";
import { renderMagnetFile } from "@/lib/vorlagen/documents";
import {
  MAGNET_DOI_TTL_MS,
  MAGNET_DOWNLOAD_TTL_MS,
  MAGNET_FILENAMES,
  MAGNET_MAIL_DEDUPE_MS,
  isMagnetId,
  magnetStepNumber,
  type MagnetId,
} from "@/lib/vorlagen/ids";
import { createMagnetLeadId, magnetCalcFromJson, magnetCalcJson, type MagnetLead } from "@/lib/vorlagen/lead";
import {
  buildMagnetDoiMail,
  buildMagnetFileMail,
  buildMagnetMarketingMail,
  deliverMagnetMail,
  magnetConfirmUrl,
  magnetDownloadUrl,
  magnetFileLink,
  magnetListUnsubscribeHeaders,
  magnetMarketingUrls,
  magnetTitle,
} from "@/lib/vorlagen/mail";
import { magnetRateKeys, magnetRateLogPrefix } from "@/lib/vorlagen/rate-key";
import { magnetLeadStore, type MagnetLeadStore } from "@/lib/vorlagen/store";
import { recordMagnetStep } from "@/lib/vorlagen/step-store";
import { magnetStepDate, magnetStepDevice } from "@/lib/vorlagen/step-event";
import { berlinTimestamp } from "@/lib/vorlagen/time";
import {
  hashMagnetToken,
  issueMagnetLink,
  matchMagnetLink,
  type MagnetLinkMatch,
  type MagnetLinkPurpose,
} from "@/lib/vorlagen/token";

export type MagnetDeps = {
  now?: () => number;
  store?: MagnetLeadStore;
  rate?: AmpelRateStore;
  send?: (input: DedupedMailInput) => Promise<MailResult>;
  blocked?: (email: string, consentAt: string) => Promise<boolean>;
  suppress?: (email: string, input: { withdrawnAt: string; consentAt: string; channel: AmpelSuppressionChannel }) => Promise<void>;
};

let testDeps: MagnetDeps | null = null;

export function setMagnetDepsForTest(deps: MagnetDeps | null): void {
  testDeps = deps;
}

function useDeps(extra: MagnetDeps = {}): Required<Pick<MagnetDeps, "now" | "store" | "rate" | "send" | "blocked" | "suppress">> {
  const merged = { ...testDeps, ...extra };
  return {
    now: merged.now ?? (() => Date.now()),
    store: merged.store ?? magnetLeadStore(),
    rate: merged.rate ?? ampelRateStore(),
    send: merged.send ?? ((input) => deliverMagnetMail(input)),
    blocked: merged.blocked ?? ((email, consentAt) => ampelConsentBlocked(email, consentAt)),
    suppress: merged.suppress ?? recordAmpelSuppression,
  };
}

function delivered(mail: MailResult): boolean {
  return mail.sent || mail.stub || mail.duplicate === true;
}

function wantsMarketing(value: unknown): boolean {
  return value === true || value === "true" || value === "on";
}

function honeypotTripped(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function rateLine(slot: number, ip: string): string {
  const hash = magnetRateLogPrefix(ip);
  const safe = Number.isInteger(slot) && slot > 0 ? slot : 0;
  return `[magnet] rate slot=${safe} ip=${hash}`;
}

async function limited(ip: string, email: string, deps: ReturnType<typeof useDeps>): Promise<boolean> {
  const now = deps.now();
  const keys = magnetRateKeys(ip, email, now);
  try {
    const decision = await deps.rate.take({
      ipKey: keys.ip,
      emailKey: keys.email,
      now,
      hmacReady: true,
    });
    console.info(rateLine(0, ip));
    return decision === "ip" || decision === "email";
  } catch (error) {
    console.error("[magnet] Rate-Limit fehlgeschlagen", error instanceof Error ? error.name : "error");
    return false;
  }
}

function pendingRecent(leads: MagnetLead[], magnet: MagnetId, now: number): MagnetLead | null {
  let found: MagnetLead | null = null;
  for (const lead of leads) {
    if (lead.redactedAt || lead.magnetId !== magnet || lead.status !== "requested") continue;
    const at = Date.parse(lead.timestamp);
    if (!Number.isFinite(at) || now - at >= MAGNET_MAIL_DEDUPE_MS) continue;
    if (!found || Date.parse(found.timestamp) < at) found = lead;
  }
  return found;
}

function pdfCalc(lead: MagnetLead) {
  if (lead.magnetId !== "kostenrechner") return null;
  return magnetCalcFromJson(lead.calcJson) ?? emptyCalc();
}

function attachLink(
  lead: MagnetLead,
  purpose: MagnetLinkPurpose,
  exp: number,
): { lead: MagnetLead; token: string } | null {
  const issued = issueMagnetLink(lead.linkJson, purpose, exp);
  if (!issued) return null;
  return { lead: { ...lead, linkJson: issued.linkJson }, token: issued.token };
}

async function lookupLink(
  token: string,
  now: number,
  deps: ReturnType<typeof useDeps>,
): Promise<{ lead: MagnetLead; match: MagnetLinkMatch } | null> {
  let lead: MagnetLead | null = null;
  try {
    lead = await deps.store.findByLinkHash(hashMagnetToken(token));
  } catch (error) {
    console.error("[magnet] Lesen fehlgeschlagen", error instanceof Error ? error.name : "error");
    return null;
  }
  if (!lead || lead.redactedAt) return null;
  const match = matchMagnetLink(lead.linkJson, token, now);
  if (!match) return null;
  return { lead, match };
}

async function sendDoi(lead: MagnetLead, token: string, deps: ReturnType<typeof useDeps>): Promise<boolean> {
  const mail = buildMagnetDoiMail({ title: magnetTitle(lead.magnetId), confirmUrl: magnetConfirmUrl(token) });
  const result = await deps.send({
    dedupeKey: `magnet-doi:${lead.leadId}`,
    to: lead.email,
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
    windowMs: MAGNET_MAIL_DEDUPE_MS,
  });
  return delivered(result);
}

async function sendFile(lead: MagnetLead, token: string, exp: number, deps: ReturnType<typeof useDeps>): Promise<boolean> {
  const url = magnetFileLink(token);
  if (!url) return false;
  const mail = buildMagnetFileMail({ title: magnetTitle(lead.magnetId), downloadUrl: url });
  const result = await deps.send({
    dedupeKey: `magnet-file:${lead.leadId}:${exp}`,
    to: lead.email,
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
    windowMs: MAGNET_MAIL_DEDUPE_MS,
  });
  return delivered(result);
}

async function sendMarketing(
  lead: MagnetLead,
  confirmToken: string,
  unsubscribeToken: string,
  deps: ReturnType<typeof useDeps>,
): Promise<boolean> {
  const links = magnetMarketingUrls(confirmToken, unsubscribeToken);
  if (!links) return false;
  const mail = buildMagnetMarketingMail(links);
  const result = await deps.send({
    dedupeKey: `magnet-marketing:${lead.leadId}:${lead.timestamp}`,
    to: lead.email,
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
    headers: magnetListUnsubscribeHeaders(links.unsubscribeUrl),
    windowMs: MAGNET_MAIL_DEDUPE_MS,
  });
  return delivered(result);
}

export type MagnetRequestResult = { ok: true } | { ok: false; status: 400 | 429 | 500; error: string };

export async function requestMagnet(
  input: {
    email?: unknown;
    magnet?: unknown;
    marketing?: unknown;
    fax_number?: unknown;
    calc?: unknown;
    ip?: string;
    skipRate?: boolean;
  },
  extra: MagnetDeps = {},
): Promise<MagnetRequestResult> {
  if (honeypotTripped(input.fax_number)) return { ok: true };
  const email = normalizeAmpelEmail(typeof input.email === "string" ? input.email : "");
  if (!email) return { ok: false, status: 400, error: MAGNET_EMAIL_INVALID };
  if (!isMagnetId(input.magnet)) return { ok: false, status: 400, error: MAGNET_INPUT_INVALID };
  const magnet = input.magnet;
  let calc: CalcSnapshot | null = null;
  if (magnet === "kostenrechner") {
    const parsed = input.calc == null ? emptyCalc() : parseMagnetCalc(input.calc);
    if (!parsed) return { ok: false, status: 400, error: MAGNET_CALC_INVALID };
    calc = parsed;
  }
  const deps = useDeps(extra);
  const ip = (input.ip ?? "").trim();
  if (!ip || ip.toLowerCase() === "unknown") return { ok: false, status: 400, error: MAGNET_LATER };
  if (!input.skipRate && (await limited(ip, email, deps))) return { ok: false, status: 429, error: MAGNET_RATE_LIMITED };

  const now = deps.now();
  const stamp = berlinTimestamp(new Date(now));
  const marketingWanted = wantsMarketing(input.marketing);
  let blocked = false;
  if (marketingWanted) {
    try {
      blocked = await deps.blocked(email, stamp);
    } catch (error) {
      console.error("[magnet] Sperrliste fehlgeschlagen", error instanceof Error ? error.name : "error");
      blocked = true;
    }
  }
  let existing: MagnetLead[] = [];
  try {
    existing = await deps.store.listByEmail(email);
  } catch (error) {
    console.error("[magnet] Lesen fehlgeschlagen", error instanceof Error ? error.name : "error");
    return { ok: false, status: 500, error: MAGNET_SEND_FAILED };
  }
  const recent = pendingRecent(existing, magnet, now);
  if (recent && recent.mailStatus === "doi_sent") return { ok: true };
  if (recent) {
    const issued = attachLink(
      {
        ...recent,
        calcJson: magnet === "kostenrechner" ? magnetCalcJson(calc) : recent.calcJson,
        doiSentAt: berlinTimestamp(new Date(now)),
      },
      "doi",
      now + MAGNET_DOI_TTL_MS,
    );
    if (!issued) return { ok: false, status: 500, error: MAGNET_SEND_FAILED };
    const next = issued.lead;
    try {
      await deps.store.update(next);
    } catch (error) {
      console.error("[magnet] Speichern fehlgeschlagen", error instanceof Error ? error.name : "error");
      return { ok: false, status: 500, error: MAGNET_SEND_FAILED };
    }
    const sent = await sendDoi(next, issued.token, deps);
    next.mailStatus = sent ? "doi_sent" : "doi_failed";
    try {
      await deps.store.update(next);
    } catch (error) {
      console.error("[magnet] Speichern fehlgeschlagen", error instanceof Error ? error.name : "error");
    }
    return sent ? { ok: true } : { ok: false, status: 500, error: MAGNET_SEND_FAILED };
  }

  const lead: MagnetLead = {
    timestamp: stamp,
    leadId: createMagnetLeadId(),
    email,
    magnetId: magnet,
    status: "requested",
    doiSentAt: stamp,
    doiConfirmedAt: "",
    firstDownloadAt: "",
    downloadCount: "0",
    marketingOptIn: marketingWanted && !blocked ? "pending" : "no",
    marketingConfirmedAt: "",
    consentTextVersion: magnetConsentVersion(marketingWanted && !blocked),
    mailStatus: "doi_failed",
    withdrawnAt: "",
    redactedAt: "",
    calcJson: magnet === "kostenrechner" ? magnetCalcJson(calc) : "",
    linkJson: "",
  };
  const doi = attachLink(lead, "doi", now + MAGNET_DOI_TTL_MS);
  if (!doi) return { ok: false, status: 500, error: MAGNET_SEND_FAILED };
  let storedLead = doi.lead;
  let marketingToken = "";
  let unsubscribeToken = "";
  if (storedLead.marketingOptIn === "pending") {
    const marketing = attachLink(storedLead, "marketing", now + MAGNET_DOI_TTL_MS);
    const unsubscribe = marketing ? attachLink(marketing.lead, "unsubscribe", 0) : null;
    if (!marketing || !unsubscribe) storedLead.marketingOptIn = "no";
    else {
      storedLead = unsubscribe.lead;
      marketingToken = marketing.token;
      unsubscribeToken = unsubscribe.token;
    }
  }
  try {
    await deps.store.insert(storedLead);
  } catch (error) {
    console.error("[magnet] Speichern fehlgeschlagen", error instanceof Error ? error.name : "error");
    return { ok: false, status: 500, error: MAGNET_SEND_FAILED };
  }
  const sent = await sendDoi(storedLead, doi.token, deps);
  storedLead.mailStatus = sent ? "doi_sent" : "doi_failed";
  if (sent && storedLead.marketingOptIn === "pending") {
    const marketed = await sendMarketing(storedLead, marketingToken, unsubscribeToken, deps);
    if (!marketed) storedLead.marketingOptIn = "no";
  }
  try {
    await deps.store.update(storedLead);
  } catch (error) {
    console.error("[magnet] Speichern fehlgeschlagen", error instanceof Error ? error.name : "error");
  }
  return sent ? { ok: true } : { ok: false, status: 500, error: MAGNET_SEND_FAILED };
}

export type MagnetConfirmResult =
  | { ok: true; downloadToken: string; filename: string; magnet: MagnetId }
  | { ok: false; status: 400; reason: "invalid" | "expired"; magnet?: MagnetId };

export async function confirmMagnet(token: string, extra: MagnetDeps = {}): Promise<MagnetConfirmResult> {
  const deps = useDeps(extra);
  const now = deps.now();
  const found = await lookupLink(token, now, deps);
  if (!found || found.match.purpose !== "doi") return { ok: false, status: 400, reason: "invalid" };
  if (found.match.expired) return { ok: false, status: 400, reason: "expired", magnet: found.lead.magnetId };
  let lead = found.lead;
  if (lead.status === "expired" || lead.status === "withdrawn") {
    return { ok: false, status: 400, reason: "expired", magnet: lead.magnetId };
  }
  const already = lead.status === "confirmed" || lead.status === "downloaded";
  const confirmedMs = already ? Date.parse(lead.doiConfirmedAt) : now;
  if (!Number.isFinite(confirmedMs)) return { ok: false, status: 400, reason: "invalid" };
  if (confirmedMs + MAGNET_DOWNLOAD_TTL_MS < now) return { ok: false, status: 400, reason: "expired", magnet: lead.magnetId };
  const issued = attachLink(lead, "download", confirmedMs + MAGNET_DOWNLOAD_TTL_MS);
  if (!issued) return { ok: false, status: 400, reason: "invalid" };
  lead = issued.lead;
  if (!already) {
    lead.doiConfirmedAt = berlinTimestamp(new Date(confirmedMs));
    lead.status = "confirmed";
    try {
      await deps.store.update(lead);
    } catch (error) {
      console.error("[magnet] Speichern fehlgeschlagen", error instanceof Error ? error.name : "error");
      return { ok: false, status: 400, reason: "invalid" };
    }
    const sent = await sendFile(lead, issued.token, confirmedMs + MAGNET_DOWNLOAD_TTL_MS, deps);
    lead.mailStatus = sent ? "file_sent" : "file_failed";
    try {
      await deps.store.update(lead);
    } catch (error) {
      console.error("[magnet] Speichern fehlgeschlagen", error instanceof Error ? error.name : "error");
    }
  } else {
    try {
      await deps.store.update(lead);
    } catch (error) {
      console.error("[magnet] Speichern fehlgeschlagen", error instanceof Error ? error.name : "error");
      return { ok: false, status: 400, reason: "invalid" };
    }
  }
  return { ok: true, downloadToken: issued.token, filename: MAGNET_FILENAMES[lead.magnetId], magnet: lead.magnetId };
}

export async function renewMagnet(token: string, input: { ip?: string; fax_number?: unknown }, extra: MagnetDeps = {}): Promise<MagnetRequestResult> {
  if (honeypotTripped(input.fax_number)) return { ok: true };
  const deps = useDeps(extra);
  const now = deps.now();
  const found = await lookupLink(token, now, deps);
  if (!found || (found.match.purpose !== "doi" && found.match.purpose !== "download")) {
    return { ok: false, status: 400, error: MAGNET_LATER };
  }
  const lead = found.lead;
  const ip = (input.ip ?? "").trim();
  if (!ip || ip.toLowerCase() === "unknown") return { ok: false, status: 400, error: MAGNET_LATER };
  if (await limited(ip, lead.email, deps)) return { ok: false, status: 429, error: MAGNET_RATE_LIMITED };
  const confirmedMs = Date.parse(lead.doiConfirmedAt);
  const downloadOpen =
    (lead.status === "confirmed" || lead.status === "downloaded") &&
    Number.isFinite(confirmedMs) &&
    confirmedMs + MAGNET_DOWNLOAD_TTL_MS >= now;
  if (downloadOpen) {
    const issued = attachLink(lead, "download", confirmedMs + MAGNET_DOWNLOAD_TTL_MS);
    if (!issued) return { ok: false, status: 500, error: MAGNET_SEND_FAILED };
    try {
      await deps.store.update(issued.lead);
    } catch (error) {
      console.error("[magnet] Speichern fehlgeschlagen", error instanceof Error ? error.name : "error");
      return { ok: false, status: 500, error: MAGNET_SEND_FAILED };
    }
    const sent = await sendFile(issued.lead, issued.token, confirmedMs + MAGNET_DOWNLOAD_TTL_MS, deps);
    return sent ? { ok: true } : { ok: false, status: 500, error: MAGNET_SEND_FAILED };
  }
  if (lead.status === "confirmed" || lead.status === "downloaded") {
    try {
      await deps.store.update({ ...lead, status: "expired" });
    } catch (error) {
      console.error("[magnet] Speichern fehlgeschlagen", error instanceof Error ? error.name : "error");
    }
  }
  return requestMagnet(
    {
      email: lead.email,
      magnet: lead.magnetId,
      marketing: false,
      calc: lead.magnetId === "kostenrechner" ? (magnetCalcFromJson(lead.calcJson) ?? emptyCalc()) : undefined,
      ip,
      skipRate: true,
    },
    extra,
  );
}

export async function confirmMagnetMarketing(token: string, extra: MagnetDeps = {}): Promise<
  { ok: true; already?: boolean; withdrawn?: boolean } | { ok: false; status: 400; reason: "invalid" }
> {
  const deps = useDeps(extra);
  const found = await lookupLink(token, deps.now(), deps);
  if (!found || found.match.purpose !== "marketing" || found.match.expired) {
    return { ok: false, status: 400, reason: "invalid" };
  }
  const lead = found.lead;
  let blocked = false;
  try {
    blocked = await deps.blocked(lead.email, lead.timestamp);
  } catch (error) {
    console.error("[magnet] Sperrliste fehlgeschlagen", error instanceof Error ? error.name : "error");
    blocked = true;
  }
  if (lead.marketingOptIn === "withdrawn" || blocked) return { ok: true, withdrawn: true };
  if (lead.marketingOptIn === "yes") return { ok: true, already: true };
  if (lead.marketingOptIn !== "pending") return { ok: false, status: 400, reason: "invalid" };
  lead.marketingOptIn = "yes";
  lead.marketingConfirmedAt = berlinTimestamp(new Date(deps.now()));
  try {
    await deps.store.update(lead);
  } catch (error) {
    console.error("[magnet] Speichern fehlgeschlagen", error instanceof Error ? error.name : "error");
    return { ok: false, status: 400, reason: "invalid" };
  }
  return { ok: true };
}

export async function withdrawMagnetMarketing(
  token: string,
  channel: AmpelSuppressionChannel,
  extra: MagnetDeps = {},
): Promise<{ ok: true } | { ok: false }> {
  const deps = useDeps(extra);
  const found = await lookupLink(token, deps.now(), deps);
  if (!found || found.match.purpose !== "unsubscribe" || found.match.expired || !found.lead.email) return { ok: false };
  const withdrawnAt = berlinTimestamp(new Date(deps.now()));
  let leads: MagnetLead[] = [];
  try {
    leads = await deps.store.listByEmail(found.lead.email);
  } catch (error) {
    console.error("[magnet] Lesen fehlgeschlagen", error instanceof Error ? error.name : "error");
    return { ok: false };
  }
  for (const lead of leads) {
    if (lead.marketingOptIn !== "pending" && lead.marketingOptIn !== "yes") continue;
    try {
      await deps.store.update({ ...lead, marketingOptIn: "withdrawn", withdrawnAt });
    } catch (error) {
      console.error("[magnet] Speichern fehlgeschlagen", error instanceof Error ? error.name : "error");
      return { ok: false };
    }
  }
  await deps.suppress(found.lead.email, { withdrawnAt, consentAt: found.lead.timestamp, channel });
  return { ok: true };
}

export type MagnetDownloadResult =
  | { ok: true; filename: string; pdf: Buffer }
  | { ok: false; status: 404 | 410; token: string };

export async function downloadMagnet(
  token: string,
  input: { userAgent?: string } = {},
  extra: MagnetDeps = {},
): Promise<MagnetDownloadResult> {
  const deps = useDeps(extra);
  const now = deps.now();
  const found = await lookupLink(token, now, deps);
  if (!found || found.match.purpose !== "download") return { ok: false, status: 404, token };
  if (found.match.expired) return { ok: false, status: 410, token };
  const lead = found.lead;
  if (lead.status !== "confirmed" && lead.status !== "downloaded") return { ok: false, status: 404, token };
  const file = await renderMagnetFile(lead.magnetId, pdfCalc(lead));
  const count = Number(lead.downloadCount);
  const nextCount = Number.isFinite(count) && count >= 0 ? count + 1 : 1;
  const stamp = berlinTimestamp(new Date(now));
  try {
    await deps.store.update({
      ...lead,
      status: "downloaded",
      downloadCount: String(nextCount),
      firstDownloadAt: lead.firstDownloadAt || stamp,
    });
  } catch (error) {
    console.error("[magnet] Download zählen fehlgeschlagen", error instanceof Error ? error.name : "error");
  }
  const n = Number(magnetStepNumber(lead.magnetId));
  await recordMagnetStep({
    date: magnetStepDate(new Date(now)),
    event: "magnet_download",
    n: String(n),
    status: "ok",
    choice: "",
    valid: "",
    v: "default",
    device: magnetStepDevice(input.userAgent ?? ""),
  });
  return { ok: true, filename: file.filename, pdf: file.pdf };
}

export function magnetRenewPath(token: string): string {
  return `/vorlagen/erneut?token=${encodeURIComponent(token)}`;
}

export function magnetDownloadUrlFromToken(token: string): string {
  return magnetDownloadUrl(token);
}
