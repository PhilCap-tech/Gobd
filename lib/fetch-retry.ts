/** Shown on the button while a save or download retries a 503. */
export const SAVE_PENDING_LABEL = "Wird gespeichert…";

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

function retryAfterMs(response: Response): number {
  const raw = response.headers.get("Retry-After")?.trim() ?? "";
  const seconds = Number(raw);
  // Missing, empty, invalid or <= 0 (Number("") is 0): default base, so the
  // backoff still grows instead of retrying at once.
  if (raw !== "" && Number.isFinite(seconds) && seconds > 0) return Math.min(seconds, 10) * 1000;
  return DEFAULT_RETRY_MS;
}

/** Base wait when a 503 carries no usable Retry-After. */
export const DEFAULT_RETRY_MS = 3000;

/** Longest single wait with `backoff`. */
export const BACKOFF_CAP_MS = 15_000;

/**
 * Wait before retry `attempt` (0-based): Retry-After, doubled per attempt,
 * plus up to 20 % jitter, capped. Spreads retries out under a quota burst.
 */
export function backoffMs(baseMs: number, attempt: number, random: () => number = Math.random): number {
  const grown = baseMs * 2 ** attempt;
  const jitter = grown * 0.2 * random();
  return Math.min(BACKOFF_CAP_MS, Math.round(grown + jitter));
}

function abortError(): Error {
  const error = new Error("aborted");
  error.name = "AbortError";
  return error;
}

/**
 * Repeats a 503 two or three times, waiting for the Retry-After header.
 * Other statuses return immediately. `signal` (from init) also stops the
 * wait between attempts.
 */
export async function fetchRetrying503(
  input: RequestInfo | URL,
  init?: RequestInit,
  options?: {
    fetch?: FetchLike;
    wait?: (ms: number) => Promise<void>;
    /** Extra attempts after the first response. */
    retries?: number;
    /** Grow the wait per attempt with jitter (see backoffMs). Default: fixed Retry-After. */
    backoff?: boolean;
    random?: () => number;
  },
): Promise<Response> {
  const fetchImpl = options?.fetch ?? fetch;
  const wait =
    options?.wait ??
    ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const retries = options?.retries ?? 3;
  const signal = init?.signal ?? null;
  let response = await fetchImpl(input, init);
  for (let attempt = 0; attempt < retries && response.status === 503; attempt += 1) {
    const base = retryAfterMs(response);
    await wait(options?.backoff ? backoffMs(base, attempt, options.random) : base);
    if (signal?.aborted) throw abortError();
    response = await fetchImpl(input, init);
  }
  return response;
}

/** A download may be saved only when the body is a PDF. JSON stays on the page. */
export function isPdfResponse(response: Pick<Response, "ok" | "headers">): boolean {
  if (!response.ok) return false;
  const type = response.headers.get("content-type") ?? "";
  return type.toLowerCase().includes("application/pdf");
}

/** Final save before the package choice: more attempts than the autosave. */
export const FINAL_SAVE_RETRIES = 4;

export const FINAL_SAVE_FAILED_MESSAGE =
  "Ihre Angaben konnten nicht gespeichert werden. Bitte versuchen Sie es erneut.";

/** Inline hint (no overlay) after an autosave did not reach the server. */
export const SERVER_SAVE_FAILED_HINT =
  "Lokal gesichert – Speichern auf dem Server fehlgeschlagen. Wir versuchen es erneut.";

/**
 * Redirect to the package choice only when the server confirmed the draft.
 * After payment the draft is read from the server; a 503 must not redirect.
 */
export function prepayRedirectAllowed(serverConfirmed: boolean, saveBlocked: boolean): boolean {
  return serverConfirmed && !saveBlocked;
}

/** Autosave retry while the server hint shows: 5 s, doubled, capped at 60 s. */
export const AUTOSAVE_RETRY_BASE_MS = 5000;
export const AUTOSAVE_RETRY_CAP_MS = 60_000;
export function autosaveRetryDelayMs(failures: number): number {
  const attempt = Math.max(0, failures - 1);
  return Math.min(AUTOSAVE_RETRY_CAP_MS, AUTOSAVE_RETRY_BASE_MS * 2 ** attempt);
}

/** Consecutive autosave failures; a confirmed save resets to 0 (hint hidden). */
export function nextSaveFailures(previous: number, saved: boolean): number {
  return saved ? 0 : previous + 1;
}
