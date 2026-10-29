/**
 * Start-Schutz: Stripe-Testkeys nur mit erklärten Testdaten, Live-Keys nie
 * mit Testdaten (lib/data-env-guard.ts). Ohne diese Variablen keine Wirkung.
 * Danach (nur Testumgebung, harte Sperre in lib/test-sheet-bootstrap.ts):
 * fehlende Tabs + Kopfzeilen der Test-Tabelle anlegen, ohne den Start zu blockieren.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { assertDataEnvironment } = await import("@/lib/data-env-guard");
  assertDataEnvironment();
  if (process.env.GOBD_DATA_ENV?.trim().toLowerCase() === "test") {
    const { bootstrapTestSheetOnStart } = await import("@/lib/test-sheet-bootstrap");
    void bootstrapTestSheetOnStart();
  }
}
