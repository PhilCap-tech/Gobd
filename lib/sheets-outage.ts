import { AsyncLocalStorage } from "node:async_hooks";

/** Shown when Google Sheets is briefly unavailable. Never a missing-document or conflict copy. */
export const SHEETS_RETRY_MESSAGE = "Bitte versuchen Sie es in einem Moment erneut.";

export const SHEETS_RETRY_AFTER_SECONDS = "3";

/** One intake read is reused across the request and a short burst of follow-ups. */
export const INTAKE_READ_TTL_MS = 5_000;

const SHEETS_BACKOFF_MS = [250, 700];

const routeStore = new AsyncLocalStorage<string>();

export class SheetsUnavailableError extends Error {
  readonly status = 503;
  readonly sheetsStatus: number;

  constructor(sheetsStatus = 0) {
    super(SHEETS_RETRY_MESSAGE);
    this.name = "SheetsUnavailableError";
    this.sheetsStatus = sheetsStatus;
  }
}

export function isSheetsOutage(error: unknown): error is SheetsUnavailableError {
  return Boolean(
    error &&
      typeof error === "object" &&
      (error as { name?: string }).name === "SheetsUnavailableError",
  );
}

export function sheetsStatusCode(error: unknown): number {
  if (!error || typeof error !== "object") return 0;
  const record = error as {
    status?: unknown;
    code?: unknown;
    response?: { status?: unknown };
    cause?: { status?: unknown; code?: unknown; response?: { status?: unknown } };
  };
  const candidates = [
    record.response?.status,
    record.status,
    record.cause?.response?.status,
    record.cause?.status,
    record.code,
    record.cause?.code,
  ];
  for (const value of candidates) {
    const status = typeof value === "number" ? value : Number(value);
    if (Number.isInteger(status) && status >= 400 && status <= 599) return status;
  }
  return 0;
}

/** 429, 5xx, and transport failures without an HTTP status. A 4xx request is not retried. */
export function isRetryableSheetsStatus(status: number): boolean {
  return status === 0 || status === 429 || status >= 500;
}

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
