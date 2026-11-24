/**
 * Daily run for the existing counters. The log is the Berlin day and the
 * counts only. It does not include marker names.
 */
import { del, get, list } from "@vercel/blob";
import { getAmpelStepsSheetsTab, getHomeCtaSheetsTab, getMeasureSheetsTab, getSchnellversionEventSheetsTab, isBlobConfigured, isSheetsConfigured } from "@/lib/env";
import { assertLiveWriteAllowed, automatedRunForbidsLiveWrites } from "@/lib/live-write-guard";
import { measureDate } from "@/lib/measure-event";
import {
  MEASURE_MARKER_PREFIX,
  countRowsToDelete,
  isMeasureCountTab,
  markerAction,
  markerUnreadable,
  measureRetentionMode,
  type MeasureCountTab,
  type MeasureRetentionMode,
} from "@/lib/measure-retention";
import { createSheetsClient } from "@/lib/sheets-client";

export type MeasureRetentionReport = {
  date: string;
  mode: MeasureRetentionMode;
  markers: number;
  rows: number;
  testRows: number;
  /** Marker under the prefix whose date or body cannot be read. They stay. */
  unreadable: number;
  deleted: boolean;
};

type SheetSnapshot = { title: MeasureCountTab; sheetId: number; values: string[][] };

export type MeasureRetentionIo = {
  sheets: () => Promise<SheetSnapshot[]>;
  deleteRows: (sheetId: number, rows: number[]) => Promise<void>;
  markers: () => Promise<Array<{ pathname: string; body: string }>>;
  deleteMarkers: (pathnames: string[]) => Promise<void>;
};

export function measureRetentionLogLine(report: MeasureRetentionReport): string {
  return `date=${report.date} mode=${report.mode} markers=${report.markers} rows=${report.rows} test_rows=${report.testRows} unreadable=${report.unreadable} deleted=${report.deleted ? 1 : 0}`;
}

function tabsToRead(): MeasureCountTab[] {
  const names = [getHomeCtaSheetsTab(), getMeasureSheetsTab(), getAmpelStepsSheetsTab(), getSchnellversionEventSheetsTab()];
  const tabs: MeasureCountTab[] = [];
  for (const name of names) {
    if (isMeasureCountTab(name) && !tabs.includes(name)) tabs.push(name);
  }
  return tabs;
}

export async function runMeasureRetention(input: {
  now?: Date;
  mode?: MeasureRetentionMode;
  io?: MeasureRetentionIo;
} = {}): Promise<MeasureRetentionReport> {
  const now = input.now ?? new Date();
  const mode = input.mode ?? measureRetentionMode();
  const report: MeasureRetentionReport = {
    date: measureDate(now),
    mode,
    markers: 0,
    rows: 0,
    testRows: 0,
    unreadable: 0,
    deleted: false,
  };
  if (mode === "off") return report;
  const execute = mode === "execute" && !automatedRunForbidsLiveWrites();
  const io = input.io ?? defaultIo();
  const wanted = new Set(tabsToRead());
  for (const sheet of await io.sheets()) {
    if (!wanted.has(sheet.title)) continue;
    const plan = countRowsToDelete({ tab: sheet.title, values: sheet.values, today: report.date });
    report.rows += plan.rows.length;
    report.testRows += plan.testRows;
    if (execute && plan.rows.length > 0) {
      await io.deleteRows(sheet.sheetId, [...plan.rows].sort((a, b) => b - a));
      report.deleted = true;
    }
  }
  const drop: string[] = [];
  for (const marker of await io.markers()) {
    const action = markerAction(marker.pathname, marker.body, report.date);
    if (action === "skip") continue;
    if (action === "keep" && markerUnreadable(marker.pathname, marker.body)) {
      report.unreadable += 1;
      continue;
    }
    if (action !== "delete") continue;
    if (!marker.pathname.startsWith(MEASURE_MARKER_PREFIX) || marker.pathname.includes("/starts/")) continue;
    drop.push(marker.pathname);
  }
  report.markers = drop.length;
  if (execute && drop.length > 0) {
    await io.deleteMarkers(drop);
    report.deleted = true;
  }
  return report;
}

function defaultIo(): MeasureRetentionIo {
  return {
    async sheets() {
      if (!isSheetsConfigured()) return [];
      const id = process.env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim() ?? "";
      if (!id) return [];
      const sheets = createSheetsClient();
      const meta = await sheets.spreadsheets.get({ spreadsheetId: id });
      const found = new Map<string, number>();
      for (const sheet of meta.data.sheets ?? []) {
        const title = sheet.properties?.title ?? "";
        const sheetId = sheet.properties?.sheetId;
        if (typeof sheetId === "number") found.set(title, sheetId);
      }
      const snapshots: SheetSnapshot[] = [];
      for (const title of tabsToRead()) {
        const sheetId = found.get(title);
        if (sheetId == null) continue;
        const result = await sheets.spreadsheets.values.get({ spreadsheetId: id, range: `${title}!A:H` });
        const values = (result.data.values ?? []).map((row) => (row ?? []).map((cell) => String(cell ?? "")));
        snapshots.push({ title, sheetId, values });
      }
      return snapshots;
    },
    async deleteRows(sheetId, rows) {
      assertLiveWriteAllowed("sheets");
      if (rows.length === 0) return;
      const id = process.env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim() ?? "";
      const sheets = createSheetsClient();
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: id,
        requestBody: {
          requests: rows.map((sheetRow) => ({
            deleteDimension: {
              range: { sheetId, dimension: "ROWS", startIndex: sheetRow - 1, endIndex: sheetRow },
            },
          })),
        },
      });
    },
    async markers() {
      if (!isBlobConfigured() || automatedRunForbidsLiveWrites()) return [];
      const token = process.env.BLOB_READ_WRITE_TOKEN?.trim() ?? "";
      const out: Array<{ pathname: string; body: string }> = [];
      let cursor: string | undefined;
      do {
        const page = await list({ prefix: MEASURE_MARKER_PREFIX, cursor, token, limit: 100 });
        for (const blob of page.blobs) {
          if (!blob.pathname.startsWith(MEASURE_MARKER_PREFIX)) continue;
          try {
            const result = await get(blob.pathname, { access: "private", token, useCache: false });
            if (!result || result.statusCode !== 200 || !result.stream) continue;
            out.push({ pathname: blob.pathname, body: await new Response(result.stream).text() });
          } catch {
            // Unreadable markers stay.
          }
        }
        cursor = page.hasMore ? page.cursor : undefined;
      } while (cursor);
      return out;
    },
    async deleteMarkers(pathnames) {
      assertLiveWriteAllowed("blob");
      const safe = pathnames.filter(
        (pathname) => pathname.startsWith(MEASURE_MARKER_PREFIX) && !pathname.includes("..") && !pathname.includes("/starts/"),
      );
      if (safe.length === 0) return;
      await del(safe, { token: process.env.BLOB_READ_WRITE_TOKEN?.trim() ?? "" });
    },
  };
}

/** Called from the daily cron. Failures are a name only. The customer job is unchanged. */
export async function logMeasureRetention(now = new Date()): Promise<void> {
  try {
    const report = await runMeasureRetention({ now });
    console.info("[zaehlung-loeschung]", measureRetentionLogLine(report));
  } catch (error) {
    const name = error instanceof Error && error.name ? error.name : "Error";
    console.error("[zaehlung-loeschung]", name);
  }
}
