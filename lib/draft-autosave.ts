/**
 * Autosave for the intake form: one PUT at a time, at most one queued behind
 * it, and a hard stop for submit. No React here so a prebuild check can run it.
 *
 * - request(): save soon. While a PUT runs, the next one waits and only the
 *   latest state is sent (the sender reads the current answers itself).
 * - stop(): submit starts. The running PUT is aborted, nothing queued is sent,
 *   and request() does nothing until resume().
 * - resume(): submit failed; saving continues.
 */
export type DraftSend = (signal: AbortSignal) => Promise<void>;

export class DraftAutosave {
  private running: Promise<void> | null = null;
  private queued = false;
  private stopped = false;
  private controller: AbortController | null = null;

  private send: DraftSend | null;

  constructor(send?: DraftSend) {
    this.send = send ?? null;
  }

  /** The form sets it once mounted and again when its save function changes. */
  setSend(send: DraftSend): void {
    this.send = send;
  }

  get isStopped(): boolean {
    return this.stopped;
  }

  get isBusy(): boolean {
    return this.running !== null;
  }

  request(): void {
    if (this.stopped) return;
    if (this.running) {
      this.queued = true;
      return;
    }
    this.running = this.loop();
  }

  /** Resolves when the current and queued saves are done. */
  async idle(): Promise<void> {
    while (this.running) await this.running;
  }

  stop(): void {
    this.stopped = true;
    this.queued = false;
    this.controller?.abort();
  }

  resume(): void {
    this.stopped = false;
  }

  private async loop(): Promise<void> {
    try {
      do {
        this.queued = false;
        if (this.stopped || !this.send) break;
        const controller = new AbortController();
        this.controller = controller;
        try {
          await this.send(controller.signal);
        } catch {
          // Offline or aborted: localStorage keeps the answers.
        } finally {
          if (this.controller === controller) this.controller = null;
        }
      } while (this.queued && !this.stopped);
    } finally {
      this.running = null;
    }
  }
}
