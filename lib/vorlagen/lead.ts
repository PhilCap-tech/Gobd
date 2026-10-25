import { randomBytes } from "node:crypto";
import { isAmpelTestEmail } from "@/lib/ampel-stats";
import { normalizeAmpelEmail } from "@/lib/ampel-score";
import { parseMagnetCalc, type CalcSnapshot } from "@/lib/vorlagen/calc";
import type { MagnetId } from "@/lib/vorlagen/ids";

/**
 * Lead row for /vorlagen/.
 * Calculator inputs for Kostenrechner live in calc_json, keyed by lead_id.
 * Mail links carry a random id. Only its SHA-256 hash is stored in link_json.
 * Retention clears calc_json when the link expires and deletes the row
 * on the clock in MAGNET_RETENTION.
 * Not stored, on purpose, until the privacy policy covers them:
 * utm_*, src, variant, ref, kanzlei_ref, gclid, gbraid, wbraid, has_click_id,
 * consent_ip.
 */
export const MAGNET_LEAD_COLUMNS = [
  "timestamp",
  "lead_id",
  "email",
  "magnet_id",
  "status",
  "doi_sent_at",
  "doi_confirmed_at",
  "first_download_at",
  "download_count",
  "marketing_opt_in",
  "marketing_confirmed_at",
  "consent_text_version",
  "mail_status",
  "withdrawn_at",
  "redacted_at",
  "calc_json",
  "link_json",
] as const;

export type MagnetLeadStatus = "requested" | "confirmed" | "downloaded" | "expired" | "withdrawn";
export type MagnetMarketing = "no" | "pending" | "yes" | "withdrawn";
export type MagnetMailStatus = "" | "doi_sent" | "doi_failed" | "file_sent" | "file_failed";

export type MagnetLead = {
  timestamp: string;
  leadId: string;
  email: string;
  magnetId: MagnetId;
  status: MagnetLeadStatus;
  doiSentAt: string;
  doiConfirmedAt: string;
  firstDownloadAt: string;
  downloadCount: string;
  marketingOptIn: MagnetMarketing;
  marketingConfirmedAt: string;
  consentTextVersion: string;
  mailStatus: MagnetMailStatus;
  withdrawnAt: string;
  redactedAt: string;
  /** Compact calculator JSON, or empty. Never copied into a mail link. */
  calcJson: string;
  /** SHA-256 hashes, purpose, and expiry for mail links. Never the raw id or the address. */
  linkJson: string;
};

const STATUSES = new Set<string>(["requested", "confirmed", "downloaded", "expired", "withdrawn"]);
const MARKETING = new Set<string>(["no", "pending", "yes", "withdrawn"]);
const MAIL = new Set<string>(["", "doi_sent", "doi_failed", "file_sent", "file_failed"]);

export function createMagnetLeadId(): string {
  return `mg_${randomBytes(18).toString("base64url")}`;
}

export function magnetLeadCells(lead: MagnetLead): string[] {
  return [
    lead.timestamp,
    lead.leadId,
    lead.email,
    lead.magnetId,
    lead.status,
    lead.doiSentAt,
    lead.doiConfirmedAt,
    lead.firstDownloadAt,
    lead.downloadCount,
    lead.marketingOptIn,
    lead.marketingConfirmedAt,
    lead.consentTextVersion,
    lead.mailStatus,
    lead.withdrawnAt,
    lead.redactedAt,
    lead.calcJson,
    lead.linkJson,
  ];
}

/** Drops empty defaults so a later parse accepts the cell. */
export function magnetCalcJson(calc: CalcSnapshot | null): string {
  if (!calc) return "";
  const compact: Record<string, number | boolean> = {};
  for (const [key, value] of Object.entries(calc)) {
    if (value == null || value === false) continue;
    compact[key] = value;
  }
  return Object.keys(compact).length === 0 ? "" : JSON.stringify(compact);
}

export function magnetCalcFromJson(raw: string): CalcSnapshot | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    return parseMagnetCalc(JSON.parse(trimmed));
  } catch {
    return null;
  }
}

function cell(raw: string[] | undefined, index: number): string {
  return (raw?.[index] ?? "").trim();
}

export function magnetLeadFromCells(raw: string[]): MagnetLead | null {
  const magnetId = cell(raw, 3);
  const status = cell(raw, 4);
  const marketing = cell(raw, 9);
  const mail = cell(raw, 12);
  if (
    magnetId !== "kostenrechner" &&
    magnetId !== "checkliste-kassen-nachschau" &&
    magnetId !== "gliederung-verfahrensdoku"
  ) {
    return null;
  }
  if (!STATUSES.has(status) || !MARKETING.has(marketing) || !MAIL.has(mail)) return null;
  const leadId = cell(raw, 1);
  const redactedAt = cell(raw, 14);
  const email = normalizeAmpelEmail(cell(raw, 2)) ?? "";
  if (!leadId.startsWith("mg_")) return null;
  if (!email && !redactedAt) return null;
  return {
    timestamp: cell(raw, 0),
    leadId,
    email,
    magnetId,
    status: status as MagnetLeadStatus,
    doiSentAt: cell(raw, 5),
    doiConfirmedAt: cell(raw, 6),
    firstDownloadAt: cell(raw, 7),
    downloadCount: cell(raw, 8) || "0",
    marketingOptIn: marketing as MagnetMarketing,
    marketingConfirmedAt: cell(raw, 10),
    consentTextVersion: cell(raw, 11),
    mailStatus: mail as MagnetMailStatus,
    withdrawnAt: cell(raw, 13),
    redactedAt: cell(raw, 14),
    calcJson: cell(raw, 15),
    linkJson: cell(raw, 16),
  };
}

/** Test and internal addresses stay out of any later evaluation. The row can still exist so the file can be delivered. */
export function magnetLeadExcluded(email: string): boolean {
  return isAmpelTestEmail(email);
}

/**
 * Manual redaction. Nothing in the request path calls this.
 * A withdrawn marketing flag stays, so the block remains visible.
 */
export function redactMagnetLead(lead: MagnetLead, at: string): MagnetLead {
  if (lead.redactedAt) return lead;
  return {
    ...lead,
    email: "",
    marketingOptIn: lead.marketingOptIn === "withdrawn" ? "withdrawn" : "no",
    consentTextVersion: "",
    calcJson: "",
    linkJson: "",
    redactedAt: at,
    status: lead.status === "withdrawn" ? "withdrawn" : "expired",
  };
}
