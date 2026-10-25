import { getMagnetLeadsSheetsTab, getMagnetStepsSheetsTab, isSheetsConfigured } from "@/lib/env";
import { automatedRunForbidsLiveWrites } from "@/lib/live-write-guard";
import { createSheetsClient } from "@/lib/sheets-client";
import { magnetLeadFromCells } from "@/lib/vorlagen/lead";
import {
  planMagnetRetention,
  retentionLeadMutations,
  retentionStepDeleteIndexes,
  type MagnetRetentionCounts,
} from "@/lib/vorlagen/retention";

const EMPTY: MagnetRetentionCounts = {
  deletedUnconfirmed: 0,
  deletedConfirmed: 0,
  deletedMarketingProof: 0,
  clearedCalc: 0,
  deletedSteps: 0,
};

/**
 * Preview deployments share the production spreadsheet.
 * Only a production runtime may read or change magnet rows.
 * Checks, builds, and every other VERCEL_ENV stay out.
 */
export function magnetRetentionSheetAllowed(): boolean {
  if (automatedRunForbidsLiveWrites()) return false;
  return process.env.VERCEL_ENV === "production";
}

type RetentionClient = {
  get(args: { spreadsheetId: string }): Promise<{
    data: { sheets?: Array<{ properties?: { title?: string | null; sheetId?: number | null } | null } | null> | null };
  }>;
  valuesGet(args: { spreadsheetId: string; range: string }): Promise<{ data: { values?: unknown[][] | null } | null }>;
  valuesBatchUpdate(args: {
    spreadsheetId: string;
    requestBody: { valueInputOption: "RAW"; data: Array<{ range: string; values: string[][] }> };
  }): Promise<unknown>;
  batchUpdate(args: {
    spreadsheetId: string;
    requestBody: {
      requests: Array<{
        deleteDimension: {
          range: { sheetId: number; dimension: "ROWS"; startIndex: number; endIndex: number };
        };
      }>;
    };
  }): Promise<unknown>;
};

function client(): RetentionClient {
  const sheets = createSheetsClient();
  return {
    get: (args) => sheets.spreadsheets.get(args),
    valuesGet: (args) => sheets.spreadsheets.values.get(args),
    valuesBatchUpdate: (args) => sheets.spreadsheets.values.batchUpdate(args),
    batchUpdate: (args) => sheets.spreadsheets.batchUpdate(args),
  };
}

function sheetId(
  sheets: Array<{ properties?: { title?: string | null; sheetId?: number | null } | null } | null> | null | undefined,
  title: string,
): number | null {
  const id = sheets?.find((sheet) => sheet?.properties?.title === title)?.properties?.sheetId;
  return typeof id === "number" ? id : null;
}

function cellsOf(row: unknown): string[] {
  return Array.isArray(row) ? row.map((cell) => String(cell ?? "")) : [];
}

async function deleteRows(api: RetentionClient, spreadsheetId: string, sheet: number, indexes: number[]): Promise<void> {
  const ordered = [...indexes].sort((left, right) => right - left);
  for (let offset = 0; offset < ordered.length; offset += 200) {
    const chunk = ordered.slice(offset, offset + 200);
    await api.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: chunk.map((startIndex) => ({
          deleteDimension: {
            range: { sheetId: sheet, dimension: "ROWS", startIndex, endIndex: startIndex + 1 },
          },
        })),
      },
    });
  }
}

/**
 * Reads magnet_leads and magnet_steps, then deletes or clears cells.
 * Does not create a tab. A missing tab is an empty result.
 * Returns null when this process must not touch the sheet.
 */
export async function runProductionMagnetRetention(now: number): Promise<MagnetRetentionCounts | null> {
  if (!magnetRetentionSheetAllowed()) return null;
  if (!isSheetsConfigured()) return { ...EMPTY };
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim() ?? "";
  if (!spreadsheetId) return { ...EMPTY };
  const api = client();
  const leadTab = getMagnetLeadsSheetsTab();
  const stepTab = getMagnetStepsSheetsTab();
  try {
    const meta = await api.get({ spreadsheetId });
    const leadSheet = sheetId(meta.data.sheets, leadTab);
    const stepSheet = sheetId(meta.data.sheets, stepTab);
    const leadValues = leadSheet == null
      ? []
      : (await api.valuesGet({ spreadsheetId, range: `${leadTab}!A2:Q` })).data?.values ?? [];
    const stepValues = stepSheet == null
      ? []
      : (await api.valuesGet({ spreadsheetId, range: `${stepTab}!A2:A` })).data?.values ?? [];
    const located: { leadId: string; sheetIndex: number }[] = [];
    const leads = [];
    for (let index = 0; index < leadValues.length; index += 1) {
      const lead = magnetLeadFromCells(cellsOf(leadValues[index]));
      if (!lead) continue;
      leads.push(lead);
      located.push({ leadId: lead.leadId, sheetIndex: index + 1 });
    }
    const stepDates = stepValues.map((row) => cellsOf(row)[0]?.trim() ?? "");
    const plan = planMagnetRetention({ leads, stepDates, now });
    const leadMutations = retentionLeadMutations(located, plan);
    if (leadSheet != null && leadMutations.clearRows.length > 0) {
      await api.valuesBatchUpdate({
        spreadsheetId,
        requestBody: {
          valueInputOption: "RAW",
          data: leadMutations.clearRows.map((row) => ({ range: `${leadTab}!P${row}`, values: [[""]] })),
        },
      });
    }
    if (leadSheet != null && leadMutations.deleteIndexes.length > 0) {
      await deleteRows(api, spreadsheetId, leadSheet, leadMutations.deleteIndexes);
    }
    if (stepSheet != null && plan.deleteStepIndexes.length > 0) {
      await deleteRows(api, spreadsheetId, stepSheet, retentionStepDeleteIndexes(plan.deleteStepIndexes));
    }
    return {
      deletedUnconfirmed: plan.deletedUnconfirmed,
      deletedConfirmed: plan.deletedConfirmed,
      deletedMarketingProof: plan.deletedMarketingProof,
      clearedCalc: plan.clearedCalc,
      deletedSteps: plan.deletedSteps,
    };
  } catch (error) {
    console.error("[magnet-retention] failed", error instanceof Error ? error.name : "error");
    throw new Error("magnet-retention-failed");
  }
}
