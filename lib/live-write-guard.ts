/**
 * Prebuild runs `check:ampel` on Vercel with the production Sheet and Blob
 * credentials. That check submits fixtures such as `blob-*@example.com`,
 * `cross-*@example.com`, `dup@example.com` and `file-*@example.com` at the
 * fixed clock `1_700_000_000_000` (2023-11-14) and used to persist them
 * through the real readiness upsert. Automated runs must not do that.
 */
export class LiveWriteRefusedError extends Error {
  constructor(backend: "sheets" | "blob") {
    super(`Live ${backend} write refused during ${process.env.npm_lifecycle_event || "check"}`);
    this.name = "LiveWriteRefusedError";
  }
}

export function automatedRunForbidsLiveWrites(): boolean {
  const event = process.env.npm_lifecycle_event ?? "";
  return event === "prebuild" || event === "build" || event.startsWith("check:");
}

export function assertLiveWriteAllowed(backend: "sheets" | "blob"): void {
  if (!automatedRunForbidsLiveWrites()) return;
  throw new LiveWriteRefusedError(backend);
}
