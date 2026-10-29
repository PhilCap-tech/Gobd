/**
 * Start-Schutz Testmodus (Preismodell 2026-11, Philip 26.10.).
 *
 * Stripe-Testkeys dürfen nie gegen echte Daten laufen, Live-Keys nie gegen
 * die Testdaten. Die Test-Umgebung erklärt ihre Daten ausdrücklich:
 *   GOBD_DATA_ENV=test
 *   GOBD_TEST_SPREADSHEET_ID = Wert von GOOGLE_SHEETS_SPREADSHEET_ID
 *   GOBD_TEST_BLOB_STORE_ID  = Store-ID aus BLOB_READ_WRITE_TOKEN
 * Ohne Stripe-Key und ohne diese Variablen ändert sich nichts.
 * Es werden nur IDs verglichen; kein Wert wird geloggt oder zurückgegeben.
 */

export type DataEnvVerdict = { ok: true } | { ok: false; reason: string };

type Env = Record<string, string | undefined>;

function keyMode(env: Env): "live" | "test" | "none" {
  const key = env.STRIPE_SECRET_KEY?.trim() ?? "";
  if (!key) return "none";
  if (key.startsWith("sk_test_") || key.startsWith("rk_test_")) return "test";
  return "live";
}

/** Store-ID aus `vercel_blob_rw_<storeId>_<secret>`. Leer, wenn das Format nicht passt. */
export function blobStoreIdFromToken(token: string | undefined): string {
  const match = /^vercel_blob_rw_([A-Za-z0-9]+)_/.exec(token?.trim() ?? "");
  return match ? match[1] : "";
}

export function dataEnvVerdict(env: Env = process.env): DataEnvVerdict {
  const mode = keyMode(env);
  const declaredTest = env.GOBD_DATA_ENV?.trim().toLowerCase() === "test";
  const sheetId = env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim() ?? "";
  const blobStore = blobStoreIdFromToken(env.BLOB_READ_WRITE_TOKEN);
  const testSheet = env.GOBD_TEST_SPREADSHEET_ID?.trim() ?? "";
  const testBlob = env.GOBD_TEST_BLOB_STORE_ID?.trim() ?? "";
  const deployed = Boolean(env.VERCEL_ENV?.trim());

  if (mode === "test") {
    if (deployed || declaredTest) {
      if (!declaredTest) return { ok: false, reason: "Stripe-Testkey ohne GOBD_DATA_ENV=test" };
      if (!sheetId || !testSheet || sheetId !== testSheet) {
        return { ok: false, reason: "Stripe-Testkey ohne Test-Tabelle (GOBD_TEST_SPREADSHEET_ID)" };
      }
      if (!blobStore || !testBlob || blobStore !== testBlob) {
        return { ok: false, reason: "Stripe-Testkey ohne Test-Blob-Store (GOBD_TEST_BLOB_STORE_ID)" };
      }
      return { ok: true };
    }
    // Lokal: nur Dateiablage erlaubt, oder ausdrücklich erklärte Testdaten.
    if (sheetId && sheetId !== testSheet) {
      return { ok: false, reason: "Stripe-Testkey mit nicht erklärter Tabelle" };
    }
    if (blobStore && blobStore !== testBlob) {
      return { ok: false, reason: "Stripe-Testkey mit nicht erklärtem Blob-Store" };
    }
    return { ok: true };
  }

  // Live-Key (oder kein Key): nie gegen die Testdaten.
  if (declaredTest && mode === "live") {
    return { ok: false, reason: "GOBD_DATA_ENV=test mit Live-Stripe-Key" };
  }
  if (mode === "live" && testSheet && sheetId === testSheet) {
    return { ok: false, reason: "Live-Stripe-Key mit Test-Tabelle" };
  }
  if (mode === "live" && testBlob && blobStore === testBlob) {
    return { ok: false, reason: "Live-Stripe-Key mit Test-Blob-Store" };
  }
  return { ok: true };
}

/** Wirft beim Start (instrumentation.ts) und vor Stripe-Aufrufen. */
export function assertDataEnvironment(env: Env = process.env): void {
  const verdict = dataEnvVerdict(env);
  if (!verdict.ok) {
    throw new Error(`[data-env-guard] Start verweigert: ${verdict.reason}`);
  }
}
