/**
 * Ampel-Löschjob: reine Regeln (ohne Store/Netz). Freigabe Philip 30.10.2026 17:28 MEZ.
 *
 * - Bericht-Leads ohne Werbe-Einwilligung: 6 Monate nach Versand schwärzen.
 * - Unbestätigte Opt-ins: Einwilligungsangaben nach 30 Tagen entfernen
 *   (Zeile bleibt als Bericht-Lead und fällt dann unter die 6 Monate).
 * - Nachweis von Einwilligung und Widerruf: 3 Jahre nach Ende des Jahres des Widerrufs.
 * - Bestätigte, nicht widerrufene Einwilligung: bleibt bis zum Widerruf (Freigabe 17:38).
 * - ampel_rate (Missbrauchsschutz): 30 Tage (Freigabe 17:38).
 * - Kanzlei-Merkblatt: Nachweis von Einwilligung/Widerruf 3 Jahre nach Ende des Jahres des Widerrufs (Freigabe 17:43).
 * - Opt-in- und Sperrlisten-/Widerrufszeilen werden nie vorzeitig gelöscht.
 * - Nur Ampel-Zeilen (lead_id `ampel-`, status `ampel_*`). Nie: Readiness, Kanzlei, Kassen,
 *   Test-, Comp-, Digistore24-, Bestands-/Altkunden- oder Kundenzeilen. Unklar = nicht anfassen.
 */
import { redactAmpelLead } from "@/lib/ampel-retention";
import type { ReadinessLead } from "@/lib/readiness";
import { isRetentionCompEmail, isRetentionTestEmail } from "@/lib/retention-guards";

const DAY_MS = 24 * 60 * 60 * 1000;
export const AMPEL_REPORT_KEEP_MONTHS = 6;
export const AMPEL_UNCONFIRMED_KEEP_DAYS = 30;
export const AMPEL_PROOF_KEEP_YEARS = 3;
export const AMPEL_RATE_KEEP_DAYS = 30;

/** Erste Zeit (ms), ab der eine ampel_rate-Zeile gelöscht werden darf. */
export function rateCutoff(now: number): number {
  return now - AMPEL_RATE_KEEP_DAYS * DAY_MS;
}

/** Anzahl führender (ältester) Zeilen mit `at` < cutoff. Stoppt an der ersten jüngeren/unklaren Zeile. */
export function leadingExpiredRateRows(ats: string[], now: number): number {
  const cutoff = rateCutoff(now);
  let n = 0;
  for (const raw of ats) {
    const at = Number(raw);
    if (!Number.isFinite(at) || at <= 0 || at >= cutoff) break;
    n += 1;
  }
  return n;
}

export type AmpelExclusion = "not_ampel" | "test" | "comp" | "customer" | "unclear";

/** Kundenstatus je Mailbox, vom Lauf gesammelt. Unbekannt/Lesefehler = true (fail closed). */
export type AmpelCustomerFacts = { ds24: boolean; legacy: boolean; plan: boolean };

export function isAmpelRetentionRow(lead: Pick<ReadinessLead, "leadId" | "status" | "tool">): boolean {
  const id = lead.leadId.trim();
  if (!id.startsWith("ampel-")) return false;
  if (!lead.status.trim().startsWith("ampel")) return false;
  const tool = lead.tool.trim();
  return tool === "" || tool === "ampel";
}

export function ampelExclusion(
  lead: Pick<ReadinessLead, "leadId" | "status" | "tool" | "email">,
  facts: AmpelCustomerFacts | null,
): AmpelExclusion | null {
  if (!isAmpelRetentionRow(lead)) return "not_ampel";
  const email = lead.email.trim().toLowerCase();
  if (!email) return "unclear";
  if (isRetentionTestEmail(email)) return "test";
  if (isRetentionCompEmail(email)) return "comp";
  if (!facts) return "unclear";
  if (facts.ds24 !== false || facts.legacy !== false || facts.plan !== false) return "customer";
  return null;
}

function addMonths(ms: number, months: number): number {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes());
}

/** Erstes Datum, ab dem der Nachweis gelöscht werden darf: 1.1. des Jahres Widerruf + 4. */
export function proofDeleteFrom(withdrawnAtMs: number): number {
  return Date.UTC(new Date(withdrawnAtMs).getUTCFullYear() + AMPEL_PROOF_KEEP_YEARS + 1, 0, 1);
}

export type AmpelRowAction =
  | { kind: "keep"; reason: string }
  | { kind: "skip"; reason: AmpelExclusion }
  | { kind: "redact_report"; next: ReadinessLead }
  | { kind: "drop_unconfirmed"; next: ReadinessLead }
  | { kind: "redact_proof"; next: ReadinessLead };

function fullRedaction(lead: ReadinessLead): ReadinessLead {
  return {
    ...lead,
    email: "",
    consentIp: "",
    advisorRef: "",
    ampelAnswers: "",
    ampelScore: "",
    ampelLight: "",
    marketingOptIn: "",
    consentAt: "",
    consentTextVersion: "",
    utmSource: "",
    utmCampaign: "",
    status: "ampel_expired",
  };
}

export function decideAmpelRow(lead: ReadinessLead, facts: AmpelCustomerFacts | null, now: number): AmpelRowAction {
  const excluded = ampelExclusion(lead, facts);
  if (excluded) return { kind: "skip", reason: excluded };
  if (lead.status === "ampel_expired") return { kind: "keep", reason: "already_redacted" };
  const optIn = lead.marketingOptIn.trim();
  if (optIn === "withdrawn") {
    const withdrawn = Date.parse(lead.withdrawnAt);
    if (!Number.isFinite(withdrawn)) return { kind: "keep", reason: "withdrawn_no_date" };
    if (now >= proofDeleteFrom(withdrawn)) return { kind: "redact_proof", next: fullRedaction(lead) };
    return { kind: "keep", reason: "proof_period" };
  }
  if (optIn === "confirmed") return { kind: "keep", reason: "active_consent" };
  if (optIn === "pending") {
    const at = Date.parse(lead.consentAt || lead.timestamp);
    if (!Number.isFinite(at)) return { kind: "keep", reason: "pending_no_date" };
    if (lead.doiConfirmedAt.trim()) return { kind: "keep", reason: "pending_confirmed_marker" };
    if (now - at >= AMPEL_UNCONFIRMED_KEEP_DAYS * DAY_MS) {
      return {
        kind: "drop_unconfirmed",
        next: { ...lead, marketingOptIn: "", consentIp: "", consentTextVersion: "" },
      };
    }
    return { kind: "keep", reason: "pending_window" };
  }
  if (optIn !== "") return { kind: "keep", reason: "unknown_opt_in" };
  const sent = Date.parse(lead.timestamp || lead.consentAt);
  if (!Number.isFinite(sent)) return { kind: "keep", reason: "no_date" };
  if (now >= addMonths(sent, AMPEL_REPORT_KEEP_MONTHS)) {
    return { kind: "redact_report", next: { ...redactAmpelLead(lead), consentAt: "", utmSource: "", utmCampaign: "" } };
  }
  return { kind: "keep", reason: "report_period" };
}

/** Kanzlei-Merkblatt: nur widerrufene Zeilen nach Ablauf der Nachweisfrist schwärzen. Alles andere bleibt. */
export function decideKanzleiRow(lead: ReadinessLead, now: number): AmpelRowAction {
  if (!lead.leadId.trim().startsWith("kanzlei-")) return { kind: "skip", reason: "not_ampel" };
  const email = lead.email.trim().toLowerCase();
  if (!email) return { kind: "keep", reason: "already_redacted" };
  if (isRetentionTestEmail(email)) return { kind: "skip", reason: "test" };
  if (isRetentionCompEmail(email)) return { kind: "skip", reason: "comp" };
  if (lead.marketingOptIn.trim() !== "withdrawn") return { kind: "keep", reason: "not_withdrawn" };
  const withdrawn = Date.parse(lead.withdrawnAt);
  if (!Number.isFinite(withdrawn) || now < proofDeleteFrom(withdrawn)) return { kind: "keep", reason: "proof_period" };
  return {
    kind: "redact_proof",
    next: { ...lead, email: "", consentIp: "", consentAt: "", consentTextVersion: "", company: "", name: "", status: "kanzlei_expired" },
  };
}

/** Mail-Link-Blob (gobd/mail-link/<hash>): nur `ampel-doi` (ohne Kassen) und `ampel-unsubscribe`. */
export type MailLinkBody = { purpose?: unknown; email?: unknown; consentAt?: unknown; check?: unknown };

export type BlobAction = { kind: "keep" | "delete" | "skip"; reason: string };

export function decideMailLinkBlob(
  body: MailLinkBody | null,
  row: Pick<ReadinessLead, "marketingOptIn" | "withdrawnAt" | "email"> | null,
  facts: { excluded: boolean },
  now: number,
): BlobAction {
  if (!body) return { kind: "skip", reason: "unreadable" };
  const purpose = body.purpose;
  if (purpose !== "ampel-doi" && purpose !== "ampel-unsubscribe") return { kind: "skip", reason: "not_ampel" };
  if (body.check !== undefined) return { kind: "skip", reason: "not_ampel" };
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email || facts.excluded || isRetentionTestEmail(email) || isRetentionCompEmail(email)) {
    return { kind: "skip", reason: "excluded" };
  }
  const at = typeof body.consentAt === "string" ? Date.parse(body.consentAt) : NaN;
  if (!Number.isFinite(at)) return { kind: "skip", reason: "no_date" };
  const optIn = row?.marketingOptIn.trim() ?? "";
  if (optIn === "withdrawn") {
    const withdrawn = Date.parse(row?.withdrawnAt ?? "");
    if (Number.isFinite(withdrawn) && now >= proofDeleteFrom(withdrawn)) return { kind: "delete", reason: "proof_expired" };
    return { kind: "keep", reason: "proof_period" };
  }
  if (optIn === "confirmed") return { kind: "keep", reason: "active_consent" };
  if (purpose === "ampel-doi") {
    // Unbestätigter Opt-in (Link 48 h gültig): 30 Tage nach Anmeldung löschen.
    if (now - at >= AMPEL_UNCONFIRMED_KEEP_DAYS * DAY_MS) return { kind: "delete", reason: "unconfirmed" };
    return { kind: "keep", reason: "unconfirmed_window" };
  }
  // Abmeldelink ohne bestätigte Einwilligung: wie der Bericht-Lead nach 6 Monaten.
  if (now >= addMonths(at, AMPEL_REPORT_KEEP_MONTHS)) return { kind: "delete", reason: "no_consent" };
  return { kind: "keep", reason: "report_period" };
}

/**
 * Einmalige Bereinigung: nur UTM-Spalten leeren (alle Zeilen). consent_at wird NICHT angefasst
 * (lead_id, mayMarket, Dedupe-Keys, Abmelde-Token, DOI-Fenster und Sperrliste hängen daran).
 */
export function cleanupRow(lead: ReadinessLead): { next: ReadinessLead; utm: boolean } {
  const utm = Boolean(lead.utmSource.trim() || lead.utmCampaign.trim());
  return { next: utm ? { ...lead, utmSource: "", utmCampaign: "" } : lead, utm };
}

function boolEnv(name: string): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  return raw === "true" || raw === "1" || raw === "ja" || raw === "on";
}

/** Schalter, alle Default AUS. Trockenlauf gewinnt immer. */
export const AMPEL_RETENTION_SWITCHES = {
  dryRun: "AMPEL_RETENTION_DRY_RUN_ENABLED",
  execute: "AMPEL_RETENTION_EXECUTE_ENABLED",
  cleanupDryRun: "AMPEL_CLEANUP_DRY_RUN_ENABLED",
  cleanupExecute: "AMPEL_CLEANUP_EXECUTE_ENABLED",
} as const;

export function ampelSwitch(name: keyof typeof AMPEL_RETENTION_SWITCHES): boolean {
  return boolEnv(AMPEL_RETENTION_SWITCHES[name]);
}

/** Gleiches Muster wie der Löschlauf: `?modus=trockenlauf` zählt immer nur; Trockenlauf-Schalter gewinnt. */
export function resolveRunMode(input: { forcedDry: boolean; dryRun: boolean; execute: boolean }): "off" | "dry" | "execute" {
  if (input.forcedDry) return "dry";
  if (input.dryRun) return "dry";
  if (input.execute) return "execute";
  return "off";
}
