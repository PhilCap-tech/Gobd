/**
 * Preview schreibt Blob und Sheet der Schnellversion nur in der erklärten
 * Testumgebung. Sonst bleibt beides aus. Produktion prüft diese Variablen nicht.
 *
 * Vorhandene Regel (lib/data-env-guard.ts): die aktiven Zugangsdaten sind die
 * Testressourcen, wenn sie den gesetzten Test-IDs entsprechen.
 * Zusätzlich: sind beide Test-IDs gesetzt und beide verschieden von den
 * aktiven IDs, wird genau diese Test-ID genutzt, nicht die aktive.
 * Fehlt eine Angabe, oder trifft nur eine der beiden IDs zu, bleibt es aus.
 */

import { blobStoreIdFromToken } from "@/lib/data-env-guard";

type Env = Record<string, string | undefined>;

export type SvPreviewTestTarget = {
  spreadsheetId: string;
  blobStoreId: string;
  /** token: der gesetzte Blob-Token ist bereits der Test-Store. store: die Test-ID wird selbst gesetzt. */
  mode: "token" | "store";
};

function normStore(id: string): string {
  const trimmed = id.trim();
  return trimmed.startsWith("store_") ? trimmed.slice("store_".length) : trimmed;
}

/** Store aus dem Token, sonst aus BLOB_STORE_ID. Leer, wenn beides fehlt oder sich widerspricht. */
export function activeBlobStoreId(env: Env): string {
  const fromToken = blobStoreIdFromToken(env.BLOB_READ_WRITE_TOKEN);
  const listed = normStore(env.BLOB_STORE_ID ?? "");
  if (fromToken && listed && fromToken !== listed) return "";
  return fromToken || listed;
}

export function svPreviewTestTarget(env: Env = process.env): SvPreviewTestTarget | null {
  if ((env.VERCEL_ENV ?? "").trim() !== "preview") return null;
  if (env.GOBD_DATA_ENV?.trim().toLowerCase() !== "test") return null;
  const testSheet = env.GOBD_TEST_SPREADSHEET_ID?.trim() ?? "";
  const testBlob = normStore(env.GOBD_TEST_BLOB_STORE_ID ?? "");
  if (!testSheet || !testBlob) return null;
  const activeSheet = env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim() ?? "";
  const activeBlob = activeBlobStoreId(env);
  if (!activeSheet || !activeBlob) return null;
  if (activeSheet === testSheet && activeBlob === testBlob) {
    return { spreadsheetId: testSheet, blobStoreId: testBlob, mode: "token" };
  }
  if (activeSheet !== testSheet && activeBlob !== testBlob) {
    return { spreadsheetId: testSheet, blobStoreId: testBlob, mode: "store" };
  }
  return null;
}

/** Ohne die Checksperre. Produktion: Token da. Preview: nur das erklärte Testziel. */
export function svBlobWritesOpen(env: Env): boolean {
  if ((env.VERCEL_ENV ?? "").trim() === "preview") {
    const target = svPreviewTestTarget(env);
    if (!target) return false;
    if (target.mode === "token") return Boolean(env.BLOB_READ_WRITE_TOKEN?.trim());
    return true;
  }
  return Boolean(env.BLOB_READ_WRITE_TOKEN?.trim());
}

/** Ohne die Checksperre. Produktion: Sheet konfiguriert. Preview: zusätzlich das Testziel. */
export function svSheetWritesOpen(env: Env): boolean {
  const configured = Boolean(
    env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
      env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY &&
      env.GOOGLE_SHEETS_SPREADSHEET_ID,
  );
  if (!configured) return false;
  if ((env.VERCEL_ENV ?? "").trim() === "preview") return svPreviewTestTarget(env) !== null;
  return true;
}
