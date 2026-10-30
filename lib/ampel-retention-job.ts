/**
 * Ampel-Löschjob und einmalige Altdaten-Bereinigung (IO + Ablauf).
 * Antworten und Logs enthalten nur Zähler, nie Adressen, IDs oder Werte.
 */
import { put } from "@vercel/blob";
import { defaultBlobIo, readBlobText, type BlobStoreIo } from "@/lib/admin-wipe-blobs";
import { ds24AccessStore } from "@/lib/digistore24-access";
import { getAmpelRateSheetsTab, isSheetsConfigured } from "@/lib/env";
import { assertLiveWriteAllowed } from "@/lib/live-write-guard";
import { createSheetsClient } from "@/lib/sheets-client";
import { findPlanByEmailStrict } from "@/lib/plan-store";
import type { ReadinessLead } from "@/lib/readiness";
import {
  cleanupRow,
  decideAmpelRow,
  decideKanzleiRow,
  leadingExpiredRateRows,
  decideMailLinkBlob,
  isAmpelRetentionRow,
  type AmpelCustomerFacts,
  type MailLinkBody,
} from "@/lib/ampel-retention-rules";
import { listAllReadinessLeadsStrict, listDocumentsByEmail, upsertReadinessLead } from "@/lib/store";

export const AMPEL_MAIL_LINK_PREFIX = "gobd/mail-link/";
export const AMPEL_CLEANUP_BACKUP_PREFIX = "gobd/backup/ampel-cleanup/";

export type AmpelRetentionIo = {
  listRows(): Promise<ReadinessLead[]>;
  saveRow(row: ReadinessLead): Promise<void>;
  customerFacts(email: string): Promise<AmpelCustomerFacts | null>;
  listMailLinks(): Promise<Array<{ pathname: string }>>;
  readMailLink(pathname: string): Promise<MailLinkBody | null>;
  deleteMailLink(pathname: string): Promise<void>;
  /** ampel_rate: Zeit (`at`, ms) der Datenzeilen in Tabellenreihenfolge. */
  listRateAts(): Promise<string[]>;
  /** Löscht die ersten `count` Datenzeilen (unter der Kopfzeile). */
  deleteLeadingRateRows(count: number): Promise<void>;
  writeBackup(name: string, body: string): Promise<void>;
};

export type AmpelRetentionReport = {
  mode: "dry" | "execute";
  rows: { seen: number; ampel: number; redactReport: number; dropUnconfirmed: number; redactProof: number; kept: number };
  kanzlei: { seen: number; redactProof: number; kept: number };
  skipped: Record<string, number>;
  blobs: { seen: number; ampel: number; delete: number; kept: number; skipped: number };
  rate: { rows: number | null; expired: number };
  errors: number;
};

function bump(map: Record<string, number>, key: string) {
  map[key] = (map[key] ?? 0) + 1;
}

export async function runAmpelRetention(io: AmpelRetentionIo, opts: { execute: boolean; now?: number }): Promise<AmpelRetentionReport> {
  const now = opts.now ?? Date.now();
  const report: AmpelRetentionReport = {
    mode: opts.execute ? "execute" : "dry",
    rows: { seen: 0, ampel: 0, redactReport: 0, dropUnconfirmed: 0, redactProof: 0, kept: 0 },
    skipped: {},
    blobs: { seen: 0, ampel: 0, delete: 0, kept: 0, skipped: 0 },
    kanzlei: { seen: 0, redactProof: 0, kept: 0 },
    rate: { rows: null, expired: 0 },
    errors: 0,
  };
  const rows = await io.listRows();
  const factsCache = new Map<string, AmpelCustomerFacts | null>();
  const facts = async (email: string) => {
    const key = email.trim().toLowerCase();
    if (!factsCache.has(key)) {
      try {
        factsCache.set(key, await io.customerFacts(key));
      } catch {
        factsCache.set(key, null);
      }
    }
    return factsCache.get(key) ?? null;
  };
  const byConsent = new Map<string, ReadinessLead>();
  for (const row of rows) {
    report.rows.seen += 1;
    if (row.leadId.trim().startsWith("kanzlei-")) {
      report.kanzlei.seen += 1;
      const k = decideKanzleiRow(row, now);
      if (k.kind === "redact_proof") {
        report.kanzlei.redactProof += 1;
        if (opts.execute) {
          try {
            await io.saveRow(k.next);
          } catch {
            report.errors += 1;
          }
        }
      } else if (k.kind === "skip") bump(report.skipped, `kanzlei_${k.reason}`);
      else report.kanzlei.kept += 1;
      continue;
    }
    if (!isAmpelRetentionRow(row)) {
      bump(report.skipped, "not_ampel");
      continue;
    }
    report.rows.ampel += 1;
    if (row.email && row.consentAt) byConsent.set(`${row.email.trim().toLowerCase()}\n${row.consentAt.trim()}`, row);
    const action = decideAmpelRow(row, row.email ? await facts(row.email) : null, now);
    if (action.kind === "skip") {
      bump(report.skipped, action.reason);
      continue;
    }
    if (action.kind === "keep") {
      report.rows.kept += 1;
      continue;
    }
    if (action.kind === "redact_report") report.rows.redactReport += 1;
    if (action.kind === "drop_unconfirmed") report.rows.dropUnconfirmed += 1;
    if (action.kind === "redact_proof") report.rows.redactProof += 1;
    if (opts.execute) {
      try {
        await io.saveRow(action.next);
      } catch {
        report.errors += 1;
      }
    }
  }

  for (const blob of await io.listMailLinks()) {
    report.blobs.seen += 1;
    const body = await io.readMailLink(blob.pathname).catch(() => null);
    const email = body && typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const consentAt = body && typeof body.consentAt === "string" ? body.consentAt.trim() : "";
    const customer = email ? await facts(email) : null;
    const excluded = !customer || customer.ds24 !== false || customer.legacy !== false || customer.plan !== false;
    const action = decideMailLinkBlob(body, byConsent.get(`${email}\n${consentAt}`) ?? null, { excluded }, now);
    if (action.kind === "skip") {
      report.blobs.skipped += 1;
      continue;
    }
    report.blobs.ampel += 1;
    if (action.kind === "keep") {
      report.blobs.kept += 1;
      continue;
    }
    report.blobs.delete += 1;
    if (opts.execute) {
      try {
        await io.deleteMailLink(blob.pathname);
      } catch {
        report.errors += 1;
      }
    }
  }
  try {
    const ats = await io.listRateAts();
    report.rate.rows = ats.length;
    report.rate.expired = leadingExpiredRateRows(ats, now);
    if (opts.execute && report.rate.expired > 0) await io.deleteLeadingRateRows(report.rate.expired);
  } catch {
    report.errors += 1;
  }
  return report;
}

export type AmpelCleanupReport = {
  mode: "dry" | "execute";
  rows: number;
  utmRows: number;
  backup: "skipped" | "written" | "failed";
  saved: number;
  errors: number;
};

/** Einmalig: alte UTM-Werte (alle Zeilen) leeren. Backup zuerst. consent_at bleibt unverändert. */
export async function runAmpelCleanup(io: AmpelRetentionIo, opts: { execute: boolean; now?: number }): Promise<AmpelCleanupReport> {
  const rows = await io.listRows();
  const changes = rows.map((row) => ({ row, ...cleanupRow(row) })).filter((item) => item.utm);
  const report: AmpelCleanupReport = {
    mode: opts.execute ? "execute" : "dry",
    rows: rows.length,
    utmRows: changes.length,
    backup: "skipped",
    saved: 0,
    errors: 0,
  };
  if (!opts.execute || changes.length === 0) return report;
  const snapshot = changes.map(({ row }) => ({
    leadId: row.leadId,
    utmSource: row.utmSource,
    utmCampaign: row.utmCampaign,
  }));
  try {
    const stamp = new Date(opts.now ?? Date.now()).toISOString().replace(/[:.]/g, "-");
    await io.writeBackup(`${AMPEL_CLEANUP_BACKUP_PREFIX}${stamp}.json`, JSON.stringify(snapshot));
    report.backup = "written";
  } catch {
    report.backup = "failed";
    return report; // Ohne Backup wird nichts geändert.
  }
  for (const change of changes) {
    try {
      await io.saveRow(change.next);
      report.saved += 1;
    } catch {
      report.errors += 1;
    }
  }
  return report;
}

function blobToken(): string {
  return process.env.BLOB_READ_WRITE_TOKEN?.trim() ?? "";
}

export function defaultAmpelRetentionIo(blobIo: BlobStoreIo = defaultBlobIo): AmpelRetentionIo {
  const token = blobToken();
  return {
    listRows: () => listAllReadinessLeadsStrict(),
    async saveRow(row) {
      await upsertReadinessLead(row);
    },
    async customerFacts(email) {
      const [plan, docs, ds24] = await Promise.all([
        findPlanByEmailStrict(email),
        listDocumentsByEmail(email),
        ds24AccessStore().read(email),
      ]);
      return { plan: plan !== null, legacy: docs.length > 0, ds24: ds24 !== null };
    },
    async listMailLinks() {
      const out: Array<{ pathname: string }> = [];
      let cursor: string | undefined;
      for (let page = 0; page < 50; page += 1) {
        const result = await blobIo.list({ prefix: AMPEL_MAIL_LINK_PREFIX, cursor, limit: 1000, token });
        for (const blob of result.blobs) if (blob.pathname) out.push({ pathname: blob.pathname });
        if (!result.hasMore || !result.cursor) break;
        cursor = result.cursor;
      }
      return out;
    },
    async readMailLink(pathname) {
      const text = await readBlobText(pathname, blobIo, token);
      if (!text) return null;
      try {
        return JSON.parse(text) as MailLinkBody;
      } catch {
        return null;
      }
    },
    async deleteMailLink(pathname) {
      if (!pathname.startsWith(AMPEL_MAIL_LINK_PREFIX)) throw new Error("prefix");
      assertLiveWriteAllowed("blob");
      await blobIo.del(pathname, { token });
    },
    async listRateAts() {
      if (!isSheetsConfigured()) return [];
      const sheets = createSheetsClient();
      const id = process.env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim() ?? "";
      const result = await sheets.spreadsheets.values.get({ spreadsheetId: id, range: `${getAmpelRateSheetsTab()}!C2:C` });
      return (result.data.values ?? []).map((row) => String(row?.[0] ?? ""));
    },
    async deleteLeadingRateRows(count) {
      if (count <= 0 || !isSheetsConfigured()) return;
      assertLiveWriteAllowed("sheets");
      const sheets = createSheetsClient();
      const id = process.env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim() ?? "";
      const meta = await sheets.spreadsheets.get({ spreadsheetId: id });
      const tab = getAmpelRateSheetsTab();
      const sheetId = meta.data.sheets?.find((sheet) => sheet?.properties?.title === tab)?.properties?.sheetId;
      if (sheetId == null) throw new Error("ampel-rate-tab");
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: id,
        requestBody: {
          requests: [{ deleteDimension: { range: { sheetId, dimension: "ROWS", startIndex: 1, endIndex: 1 + count } } }],
        },
      });
    },
    async writeBackup(name, body) {
      if (!name.startsWith(AMPEL_CLEANUP_BACKUP_PREFIX)) throw new Error("prefix");
      assertLiveWriteAllowed("blob");
      await put(name, body, {
        access: "private",
        addRandomSuffix: false,
        allowOverwrite: false,
        contentType: "application/json; charset=utf-8",
        token,
      });
    },
  };
}
