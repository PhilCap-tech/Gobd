import { AsyncLocalStorage } from "node:async_hooks";

export type SheetsCall = { op: string; range?: string };

const routeCalls = new AsyncLocalStorage<{ route: string; calls: SheetsCall[] }>();

let measure: SheetsCall[] | null = null;

/** Count one Google Sheets HTTP call. Retries count again. */
export function noteSheetsCall(op: string, range?: string): void {
  const call = { op, ...(range ? { range } : {}) };
  routeCalls.getStore()?.calls.push(call);
  measure?.push(call);
}

export function beginSheetsMeasure(): void {
  measure = [];
}

export function takeSheetsMeasure(): SheetsCall[] {
  const calls = measure ?? [];
  measure = null;
  return calls;
}

export async function runWithSheetsMeasure<T>(route: string, fn: () => Promise<T>): Promise<T> {
  return routeCalls.run({ route, calls: [] }, async () => {
    try {
      return await fn();
    } finally {
      const current = routeCalls.getStore();
      if (current) {
        console.info(
          "[store] Sheets-Aufrufe",
          JSON.stringify({
            route: current.route,
            count: current.calls.length,
            ops: current.calls.map((call) => call.op),
          }),
        );
      }
    }
  });
}
