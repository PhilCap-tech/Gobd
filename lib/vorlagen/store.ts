import { getMagnetLeadsSheetsTab, isSheetsConfigured } from "@/lib/env";
import { LiveWriteRefusedError, automatedRunForbidsLiveWrites } from "@/lib/live-write-guard";
import { createSheetsClient } from "@/lib/sheets-client";
import { normalizeAmpelEmail } from "@/lib/ampel-score";
import {
  MAGNET_LEAD_COLUMNS,
  magnetLeadCells,
  magnetLeadFromCells,
  type MagnetLead,
} from "@/lib/vorlagen/lead";

export type MagnetLeadStore = {
  insert(lead: MagnetLead): Promise<void>;
  update(lead: MagnetLead): Promise<void>;
  listByEmail(email: string): Promise<MagnetLead[]>;
  findById(leadId: string): Promise<MagnetLead | null>;
};

export function createMemoryMagnetStore(): MagnetLeadStore & { rows(): MagnetLead[] } {
  const rows: MagnetLead[] = [];
  return {
    rows() {
      return rows.map((row) => ({ ...row }));
    },
    async insert(lead) {
      rows.push({ ...lead });
    },
    async update(lead) {
      const index = rows.findIndex((row) => row.leadId === lead.leadId);
      if (index < 0) throw new Error("magnet-lead-missing");
      rows[index] = { ...lead };
    },
    async listByEmail(email) {
      const normalized = normalizeAmpelEmail(email);
      return rows.filter((row) => row.email === normalized).map((row) => ({ ...row }));
    },
    async findById(leadId) {
      const found = rows.find((row) => row.leadId === leadId);
      return found ? { ...found } : null;
    },
  };
}

type SheetMeta = {
  data: {
    sheets?: Array<{ properties?: { title?: string | null; sheetId?: number | null } | null } | null> | null;
  };
};

type SheetCreated = {
  data: {
    replies?: Array<{ addSheet?: { properties?: { sheetId?: number | null } | null } | null } | null> | null;
  };
};

type SheetClient = {
  get(args: { spreadsheetId: string }): Promise<SheetMeta>;
  batchUpdate(args: {
    spreadsheetId: string;
    requestBody: { requests: Array<{ addSheet: { properties: { title: string } } }> };
  }): Promise<SheetCreated>;
  valuesGet(args: { spreadsheetId: string; range: string }): Promise<{ data: { values?: unknown[][] | null } | null }>;
  valuesAppend(args: {
    spreadsheetId: string;
    range: string;
    valueInputOption: "RAW";
    insertDataOption: "INSERT_ROWS";
    requestBody: { values: string[][] };
  }): Promise<{ data: unknown }>;
  valuesUpdate(args: {
    spreadsheetId: string;
    range: string;
    valueInputOption: "RAW";
    requestBody: { values: string[][] };
  }): Promise<{ data: unknown }>;
};

const COLUMN_END = "O";

function refuseLive(): void {
  if (automatedRunForbidsLiveWrites()) throw new LiveWriteRefusedError("sheets");
}

function sheetClient(): SheetClient {
  const sheets = createSheetsClient();
  return {
    get: (args) => sheets.spreadsheets.get(args),
    batchUpdate: (args) => sheets.spreadsheets.batchUpdate(args),
    valuesGet: (args) => sheets.spreadsheets.values.get(args),
    valuesAppend: (args) => sheets.spreadsheets.values.append(args),
    valuesUpdate: (args) => sheets.spreadsheets.values.update(args),
  } as SheetClient;
}

function sheetIdOf(
  sheets: Array<{ properties?: { title?: string | null; sheetId?: number | null } | null } | null> | null | undefined,
  tab: string,
): number | null {
  const id = sheets?.find((sheet) => sheet?.properties?.title === tab)?.properties?.sheetId;
  return typeof id === "number" ? id : null;
}

async function ensureTab(client: SheetClient, id: string, tab: string): Promise<void> {
  const meta = await client.get({ spreadsheetId: id });
  let sheetId = sheetIdOf(meta.data.sheets, tab);
  if (sheetId == null) {
    refuseLive();
    const created = await client.batchUpdate({
      spreadsheetId: id,
      requestBody: { requests: [{ addSheet: { properties: { title: tab } } }] },
    });
    sheetId = created.data.replies?.[0]?.addSheet?.properties?.sheetId ?? null;
  }
  if (sheetId == null) throw new Error("magnet-leads-sheet");
  const header = await client.valuesGet({ spreadsheetId: id, range: `${tab}!A1:${COLUMN_END}1` });
  const row = header.data?.values?.[0];
  const cells = Array.isArray(row) ? row.map((cell) => String(cell ?? "").trim()) : [];
  if (cells.length === 0 || cells.every((cell) => cell === "")) {
    refuseLive();
    await client.valuesAppend({
      spreadsheetId: id,
      range: `${tab}!A1`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [[...MAGNET_LEAD_COLUMNS]] },
    });
    return;
  }
  const matches =
    MAGNET_LEAD_COLUMNS.every((column, index) => cells[index] === column) &&
    cells.slice(MAGNET_LEAD_COLUMNS.length).every((cell) => cell === "");
  if (!matches) throw new Error("magnet-leads-header");
}

async function readRows(client: SheetClient, id: string, tab: string): Promise<string[][]> {
  await ensureTab(client, id, tab);
  const result = await client.valuesGet({ spreadsheetId: id, range: `${tab}!A:${COLUMN_END}` });
  const values = result.data?.values;
  if (!Array.isArray(values)) return [];
  return values.map((row) => (Array.isArray(row) ? row.map((cell) => String(cell ?? "")) : []));
}

function liveStore(): MagnetLeadStore {
  return {
    async insert(lead) {
      refuseLive();
      if (!isSheetsConfigured()) throw new Error("sheets-unconfigured");
      const client = sheetClient();
      const id = process.env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim() ?? "";
      const tab = getMagnetLeadsSheetsTab();
      await ensureTab(client, id, tab);
      refuseLive();
      await client.valuesAppend({
        spreadsheetId: id,
        range: `${tab}!A1`,
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values: [magnetLeadCells(lead)] },
      });
    },
    async update(lead) {
      refuseLive();
      if (!isSheetsConfigured()) throw new Error("sheets-unconfigured");
      const client = sheetClient();
      const id = process.env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim() ?? "";
      const tab = getMagnetLeadsSheetsTab();
      const rows = await readRows(client, id, tab);
      const index = rows.findIndex((row, rowIndex) => rowIndex > 0 && (row[1] ?? "").trim() === lead.leadId);
      if (index < 0) throw new Error("magnet-lead-missing");
      refuseLive();
      await client.valuesUpdate({
        spreadsheetId: id,
        range: `${tab}!A${index + 1}:${COLUMN_END}${index + 1}`,
        valueInputOption: "RAW",
        requestBody: { values: [magnetLeadCells(lead)] },
      });
    },
    async listByEmail(email) {
      if (automatedRunForbidsLiveWrites()) return [];
      if (!isSheetsConfigured()) return [];
      const normalized = normalizeAmpelEmail(email);
      if (!normalized) return [];
      const client = sheetClient();
      const id = process.env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim() ?? "";
      const rows = await readRows(client, id, getMagnetLeadsSheetsTab());
      return rows.slice(1).flatMap((row) => {
        const lead = magnetLeadFromCells(row);
        return lead && lead.email === normalized ? [lead] : [];
      });
    },
    async findById(leadId) {
      if (automatedRunForbidsLiveWrites()) return null;
      if (!isSheetsConfigured()) return null;
      const client = sheetClient();
      const id = process.env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim() ?? "";
      const rows = await readRows(client, id, getMagnetLeadsSheetsTab());
      for (const row of rows.slice(1)) {
        const lead = magnetLeadFromCells(row);
        if (lead?.leadId === leadId) return lead;
      }
      return null;
    },
  };
}

let testStore: MagnetLeadStore | null = null;

export function setMagnetLeadStoreForTest(store: MagnetLeadStore | null): void {
  testStore = store;
}

export function magnetLeadStore(): MagnetLeadStore {
  return testStore ?? liveStore();
}
