import { AsyncLocalStorage } from "node:async_hooks";
import {
  isRetryableSheetsStatus,
  sheetsStatusCode,
} from "@/lib/sheets-unavailable";

export {
  isSheetsOutage,
  SHEETS_RETRY_AFTER_SECONDS,
  SHEETS_RETRY_MESSAGE,
  SheetsUnavailableError,
  sheetsStatusCode,
} from "@/lib/sheets-unavailable";

/** One intake read is reused across the request and a short burst of follow-ups. */
export const INTAKE_READ_TTL_MS = 5_000;

const SHEETS_BACKOFF_MS = [250, 700];

const routeStore = new AsyncLocalStorage<string>();

export function currentSheetsRoute(): string {
  return routeStore.getStore() || "store";
}

export function sheetsRouteIsSet(): boolean {
  return routeStore.getStore() !== undefined;
}

export function runWithSheetsRoute<T>(route: string, fn: () => Promise<T>): Promise<T> {
  return routeStore.run(route, fn);
}

export function logSheetsFailure(op: string, status: number, attempt?: number): void {
  console.error(
    "[store] Sheets-Aufruf fehlgeschlagen",
    JSON.stringify({
      route: currentSheetsRoute(),
      op,
      status,
      ...(attempt === undefined ? {} : { attempt }),
    }),
  );
}

export async function retrySheetsCall<T>(
  op: string,
  fn: () => Promise<T>,
  wait: (ms: number) => Promise<void> = (ms) =>
    new Promise((resolve) => setTimeout(resolve, ms)),
): Promise<T> {
  let last: unknown;
  for (let attempt = 0; attempt <= SHEETS_BACKOFF_MS.length; attempt++) {
    try {
      return await fn();
    } catch (error) {
      last = error;
      const status = sheetsStatusCode(error);
      logSheetsFailure(op, status, attempt);
      if (attempt === SHEETS_BACKOFF_MS.length || !isRetryableSheetsStatus(status)) break;
      await wait(SHEETS_BACKOFF_MS[attempt] ?? 0);
    }
  }
  throw last;
}

export function createTtlSingleflight<T>(ttlMs: number) {
  let entry: { at: number; value: T } | null = null;
  let inflight: Promise<T> | null = null;
  return {
    clear() {
      entry = null;
      inflight = null;
    },
    async read(load: () => Promise<T>, fresh = false): Promise<T> {
      const now = Date.now();
      if (!fresh && entry && now - entry.at < ttlMs) return entry.value;
      if (!fresh && inflight) return inflight;
      const run = load().then((value) => {
        entry = { at: Date.now(), value };
        return value;
      });
      const current = run.finally(() => {
        if (inflight === current) inflight = null;
      });
      inflight = current;
      return current;
    },
  };
}
