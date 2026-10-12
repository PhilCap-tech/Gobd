import { google, type sheets_v4 } from "googleapis";
import { noteSheetsCall } from "@/lib/sheets-meter";

type Handler = (call: { op: string; args: Record<string, unknown> }) => Promise<unknown>;

let handler: Handler | null = null;

/** Tests substitute the Google client. Production leaves this unset. */
export function installSheetsHandler(next: Handler | null): void {
  handler = next;
}

function sheetsAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!email || !key) throw new Error("Google-Service-Account unvollständig");
  return new google.auth.JWT({
    email,
    key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

function rangeOf(args: Record<string, unknown>): string | undefined {
  if (typeof args.range === "string") return args.range;
  if (Array.isArray(args.ranges)) return args.ranges.join(" | ");
  return undefined;
}

async function dispatch<T>(op: string, args: Record<string, unknown>, live: () => Promise<T>): Promise<T> {
  noteSheetsCall(op, rangeOf(args));
  if (handler) return (await handler({ op, args })) as T;
  return live();
}

/** One instrumented Sheets client. Every method counts as one read or write. */
export function createSheetsClient(): sheets_v4.Sheets {
  const live = handler ? null : google.sheets({ version: "v4", auth: sheetsAuth() });
  const values = live?.spreadsheets.values;
  const spreadsheets = live?.spreadsheets;
  return {
    spreadsheets: {
      get: ((args: sheets_v4.Params$Resource$Spreadsheets$Get) =>
        dispatch("spreadsheets.get", args as unknown as Record<string, unknown>, () =>
          spreadsheets!.get(args),
        )) as sheets_v4.Resource$Spreadsheets["get"],
      batchUpdate: ((args: sheets_v4.Params$Resource$Spreadsheets$Batchupdate) =>
        dispatch("spreadsheets.batchUpdate", args as unknown as Record<string, unknown>, () =>
          spreadsheets!.batchUpdate(args),
        )) as sheets_v4.Resource$Spreadsheets["batchUpdate"],
      values: {
        get: ((args: sheets_v4.Params$Resource$Spreadsheets$Values$Get, options?: unknown) =>
          dispatch("values.get", args as unknown as Record<string, unknown>, () =>
            values!.get(args, options as never),
          )) as sheets_v4.Resource$Spreadsheets$Values["get"],
        batchGet: ((args: sheets_v4.Params$Resource$Spreadsheets$Values$Batchget) =>
          dispatch("values.batchGet", args as unknown as Record<string, unknown>, () =>
            values!.batchGet(args),
          )) as sheets_v4.Resource$Spreadsheets$Values["batchGet"],
        append: ((args: sheets_v4.Params$Resource$Spreadsheets$Values$Append) =>
          dispatch("values.append", args as unknown as Record<string, unknown>, () =>
            values!.append(args),
          )) as sheets_v4.Resource$Spreadsheets$Values["append"],
        update: ((args: sheets_v4.Params$Resource$Spreadsheets$Values$Update) =>
          dispatch("values.update", args as unknown as Record<string, unknown>, () =>
            values!.update(args),
          )) as sheets_v4.Resource$Spreadsheets$Values["update"],
        batchUpdate: ((args: sheets_v4.Params$Resource$Spreadsheets$Values$Batchupdate) =>
          dispatch("values.batchUpdate", args as unknown as Record<string, unknown>, () =>
            values!.batchUpdate(args),
          )) as sheets_v4.Resource$Spreadsheets$Values["batchUpdate"],
      },
    },
  } as sheets_v4.Sheets;
}
