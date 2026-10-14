import { createSheetsClient } from "@/lib/sheets-client";
import { createTtlSingleflight, retrySheetsCall, SheetsUnavailableError } from "@/lib/sheets-outage";

type Cache<T> = ReturnType<typeof createTtlSingleflight<T>>;

const GET_OPTS = {
  headers: {
    "Cache-Control": "no-cache, no-store",
    Pragma: "no-cache",
  },
} as const;

function cells(values: unknown): string[][] {
  if (!Array.isArray(values)) return [];
  return values.map((row) =>
    Array.isArray(row) ? row.map((cell) => String(cell ?? "")) : [],
  );
}

function sheetId(): string {
  const id = process.env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim();
  if (!id) throw new Error("GOOGLE_SHEETS_SPREADSHEET_ID fehlt");
  return id;
}

export async function sheetsValuesGet(range: string, op: string): Promise<string[][]> {
  const sheets = createSheetsClient();
  const result = await retrySheetsCall(op, () =>
    sheets.spreadsheets.values.get(
      {
        spreadsheetId: sheetId(),
        range,
      },
      GET_OPTS,
    ),
  );
  return cells(result.data.values);
}

export async function sheetsBatchGet(ranges: string[], op: string): Promise<string[][][]> {
  const sheets = createSheetsClient();
  const result = await retrySheetsCall(op, () =>
    sheets.spreadsheets.values.batchGet({
      spreadsheetId: sheetId(),
      ranges,
    }),
  );
  const valueRanges = result.data.valueRanges ?? [];
  return ranges.map((_, index) => cells(valueRanges[index]?.values));
}

function usableHeader(header: string[] | null | undefined): string[] | null {
  if (!header || !header.some((cell) => cell.trim())) return null;
  return header;
}

/**
 * Header is read once per instance when the row is non-empty. An empty header
 * is not stored: the header TTL does not expire, and an empty array is
 * truthy, so caching it would parse every later row as blank.
 * Value snapshots are optional. Company reads pass `reuseValues: false`
 * because a 45s snapshot on another instance still shows the grid from
 * before „Firma anlegen“.
 */
type GridSnapshot = { header: string[]; values: string[][] };

const inflightGrids = new Map<string, Promise<GridSnapshot>>();

export async function readCachedGrid(input: {
  tab: string;
  op: string;
  headerRange: string;
  valuesRange: string;
  headerCache: Cache<string[]>;
  valuesCache: Cache<string[][]>;
  materializeHeader?: (header: string[]) => Promise<string[]>;
  reuseValues?: boolean;
}): Promise<GridSnapshot> {
  const key = [input.tab, input.op, input.headerRange, input.valuesRange, input.reuseValues === false ? "fresh" : "cached"].join("\n");
  const current = inflightGrids.get(key);
  if (current) return current;
  const run = loadCachedGrid(input).finally(() => {
    if (inflightGrids.get(key) === run) inflightGrids.delete(key);
  });
  inflightGrids.set(key, run);
  return run;
}

async function loadCachedGrid(input: {
  tab: string;
  op: string;
  headerRange: string;
  valuesRange: string;
  headerCache: Cache<string[]>;
  valuesCache: Cache<string[][]>;
  materializeHeader?: (header: string[]) => Promise<string[]>;
  reuseValues?: boolean;
}): Promise<GridSnapshot> {
  const reuseValues = input.reuseValues !== false;
  const cachedHeader = usableHeader(input.headerCache.peek());
  const cachedValues = reuseValues ? input.valuesCache.peek() : null;
  if (cachedHeader && cachedValues) {
    return { header: cachedHeader, values: cachedValues };
  }
  if (cachedHeader) {
    const values = await sheetsValuesGet(`${input.tab}!${input.valuesRange}`, `${input.op}.values`);
    if (reuseValues) input.valuesCache.remember(values);
    return { header: cachedHeader, values };
  }
  const loaded = await loadGridBatch(input);
  let raw = loaded.raw;
  let values = loaded.values;
  if (!usableHeader(raw) && rowsHaveCells(values)) {
    const again = await loadGridBatch(input);
    raw = again.raw;
    values = again.values;
  }
  const header = input.materializeHeader ? await input.materializeHeader(raw) : raw;
  if (!usableHeader(header) && rowsHaveCells(values)) {
    throw new SheetsUnavailableError(0);
  }
  const filled = usableHeader(header);
  if (filled) input.headerCache.remember(filled);
  if (reuseValues) input.valuesCache.remember(values);
  return { header, values };
}

function rowsHaveCells(values: string[][]): boolean {
  return values.some((row) => row.some((cell) => cell.trim()));
}

async function loadGridBatch(input: {
  tab: string;
  op: string;
  headerRange: string;
  valuesRange: string;
}): Promise<{ raw: string[]; values: string[][] }> {
  const [headerRows, values] = await sheetsBatchGet(
    [`${input.tab}!${input.headerRange}`, `${input.tab}!${input.valuesRange}`],
    `${input.op}.batchGet`,
  );
  return { raw: (headerRows[0] ?? []).map((cell) => String(cell)), values };
}
