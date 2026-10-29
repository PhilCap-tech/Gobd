import { accessForRows, type LifecycleAccess } from "@/lib/kuendigung";
import { listLifecycleByEmail, listLifecycleByEmailStrict } from "@/lib/kuendigung-store";
import { planDownloadDenial, planWriteDenial } from "@/lib/plan-access";
import { SheetsUnavailableError, sheetsStatusCode } from "@/lib/sheets-unavailable";

const OPEN: LifecycleAccess = {
  writesOpen: true,
  downloadsOpen: true,
  writeMessage: "",
  downloadMessage: "",
};

type LifecycleReader = (email: string) => Promise<Awaited<ReturnType<typeof listLifecycleByEmail>>>;

let readerOverride: { strict: LifecycleReader; lenient: LifecycleReader } | null = null;

/** Prebuild checks only. `null` restores the store. */
export function setLifecycleReaderForTests(reader: LifecycleReader | null): void {
  readerOverride = reader ? { strict: reader, lenient: reader } : null;
}

/** Error class and HTTP status only: no stack, no spreadsheet id, no address. */
function logReadFailure(context: "write" | "download", error: unknown): void {
  console.error(
    "[kuendigung] Lifecycle lesen fehlgeschlagen",
    JSON.stringify({
      check: context,
      error: error instanceof Error ? error.name || "Error" : typeof error,
      status: sheetsStatusCode(error),
    }),
  );
}

/**
 * Writes need a successful check. A Sheets 429 or outage (after the short
 * retrySheetsCall backoff, 250/700 ms) becomes SheetsUnavailableError; the
 * routes answer it with the existing 503 + Retry-After and retry copy.
 */
async function writeAccessForEmail(email: string): Promise<LifecycleAccess> {
  const normalized = email.trim();
  if (!normalized) return OPEN;
  const read = readerOverride?.strict ?? listLifecycleByEmailStrict;
  try {
    return accessForRows(await read(normalized));
  } catch (error) {
    logReadFailure("write", error);
    throw new SheetsUnavailableError(sheetsStatusCode(error));
  }
}

/** Downloads keep the previous behaviour on a read failure (open). */
async function downloadAccessForEmail(email: string): Promise<LifecycleAccess> {
  const normalized = email.trim();
  if (!normalized) return OPEN;
  const read = readerOverride?.lenient ?? listLifecycleByEmail;
  try {
    return accessForRows(await read(normalized));
  } catch (error) {
    logReadFailure("download", error);
    return OPEN;
  }
}

/**
 * Null when writes are open, the closed-account copy when not. Throws
 * SheetsUnavailableError when the lifecycle could not be read (fail closed).
 */
export async function subscriptionWriteDenial(
  email: string | null | undefined,
): Promise<string | null> {
  const access = await writeAccessForEmail(email ?? "");
  if (!access.writesOpen) return access.writeMessage;
  // Preismodell v2: liest den Plan nur bei PLAN_ACCESS_ENABLED (Default: PRICING_MODEL=v2).
  return planWriteDenial(email);
}

export async function subscriptionDownloadDenial(email: string): Promise<string | null> {
  const access = await downloadAccessForEmail(email);
  if (!access.downloadsOpen) return access.downloadMessage;
  return planDownloadDenial(email);
}
