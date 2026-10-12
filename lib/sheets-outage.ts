import { AsyncLocalStorage } from "node:async_hooks";
import { runWithSheetsMeasure } from "@/lib/sheets-meter";
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

/** Module-level intake snapshot. Long enough to stay under the per-minute read quota. */
export const INTAKE_READ_TTL_MS = 45_000;

/** Header and column width stay for the life of the instance. Writes do not re-read them. */
export const SHEETS_HEADER_TTL_MS = Number.POSITIVE_INFINITY;

const SHEETS_BACKOFF_MS = [250, 700];

const routeStore = new AsyncLocalStorage<string>();

export function currentSheetsRoute(): string {
  return routeStore.getStore() || "store";
}

export function sheetsRouteIsSet(): boolean {
  return routeStore.getStore() !== undefined;
}

export function runWithSheetsRoute<T>(route: string, fn: () => Promise<T>): Promise<T> {
  return routeStore.run(route, () => runWithSheetsMeasure(route, fn));
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
  const freshEnough = (at: number) => Date.now() - at < ttlMs;
  return {
    clear() {
      entry = null;
      inflight = null;
    },
    peek(): T | null {
      if (!entry || !freshEnough(entry.at)) return null;
      return entry.value;
    },
    remember(value: T) {
      entry = { at: Date.now(), value };
    },
    async read(load: () => Promise<T>, fresh = false): Promise<T> {
      if (!fresh && entry && freshEnough(entry.at)) return entry.value;
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
