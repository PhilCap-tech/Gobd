import { waitUntil } from "@vercel/functions";
import { after } from "next/server";

/**
 * Firm creation and the welcome mail outlive the checkout redirect.
 * One promise is handed to `after` and to `waitUntil`, so the work
 * runs once and the Vercel isolate stays up until it settles.
 * Outside a request the work still starts, without holding the caller.
 */
export function scheduleCheckoutAfterResponse(work: () => Promise<void>): void {
  let task: Promise<void> | undefined;
  const run = (): Promise<void> => {
    task ??= work().catch((error: unknown) => {
      console.error(
        "[checkout] Nacharbeit fehlgeschlagen",
        error instanceof Error ? error.name : "error",
      );
    });
    return task;
  };

  try {
    after(() => run());
  } catch (error) {
    console.error(
      "[checkout] Nacharbeit ohne Anfragekontext",
      error instanceof Error ? error.name : "error",
    );
  }
  try {
    waitUntil(run());
  } catch (error) {
    console.error(
      "[checkout] Nacharbeit ohne waitUntil",
      error instanceof Error ? error.name : "error",
    );
    void run();
  }
}
