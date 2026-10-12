/** Shown on the button while a save or download retries a 503. */
export const SAVE_PENDING_LABEL = "Wird gespeichert…";

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

function retryAfterMs(response: Response): number {
  const raw = response.headers.get("Retry-After")?.trim() ?? "";
  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds, 10) * 1000;
  return 3000;
}

/**
 * Repeats a 503 two or three times, waiting for the Retry-After header.
 * Other statuses return immediately.
 */
export async function fetchRetrying503(
  input: RequestInfo | URL,
  init?: RequestInit,
  options?: {
    fetch?: FetchLike;
    wait?: (ms: number) => Promise<void>;
    /** Extra attempts after the first response. */
    retries?: number;
  },
): Promise<Response> {
  const fetchImpl = options?.fetch ?? fetch;
  const wait =
    options?.wait ??
    ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const retries = options?.retries ?? 3;
  let response = await fetchImpl(input, init);
  for (let attempt = 0; attempt < retries && response.status === 503; attempt += 1) {
    await wait(retryAfterMs(response));
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
