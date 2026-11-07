/**
 * Bounded retry after a draft PUT comes back 409.
 * Each attempt must read the latest local answers itself. This helper
 * never stores a snapshot.
 *
 * Rule: this page view sends its current answers at a revision at least as
 * high as the server just reported. That may replace another tab of the
 * same login. It must not send an older captured body, and it must not
 * lower the revision. After the bound, the caller shows the existing
 * unsaved hint. The next try is that hint's existing slow retry, not
 * another tight loop.
 */

export const DRAFT_CONFLICT_RETRIES = 3;

/** First wait 200 ms, then 400 ms, then 800 ms. */
export function draftConflictBackoffMs(retryIndex: number): number {
  const step = Math.max(0, retryIndex);
  return 200 * 2 ** step;
}

export type DraftConflictAttempt = "saved" | "conflict" | "failed" | "stopped" | "aborted";

export type DraftConflictOutcome = DraftConflictAttempt;

export async function runDraftConflictRetries(input: {
  attempt: () => Promise<DraftConflictAttempt>;
  /** Extra attempts after a 409. Default {@link DRAFT_CONFLICT_RETRIES}. */
  maxRetries?: number;
  wait?: (ms: number) => Promise<void>;
  aborted?: () => boolean;
}): Promise<DraftConflictOutcome> {
  const maxRetries = input.maxRetries ?? DRAFT_CONFLICT_RETRIES;
  const wait = input.wait ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  let conflicts = 0;
  for (;;) {
    const result = await input.attempt();
    if (result !== "conflict") return result;
    if (conflicts >= maxRetries) return "conflict";
    await wait(draftConflictBackoffMs(conflicts));
    conflicts += 1;
    if (input.aborted?.()) return "aborted";
  }
}
