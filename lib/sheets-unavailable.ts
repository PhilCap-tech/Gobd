/** Shown when Google Sheets is briefly unavailable. Never a missing-document or conflict copy. */
export const SHEETS_RETRY_MESSAGE = "Bitte versuchen Sie es in einem Moment erneut.";

export const SHEETS_RETRY_AFTER_SECONDS = "3";

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
