/**
 * Start-Schutz: Stripe-Testkeys nur mit erklärten Testdaten, Live-Keys nie
 * mit Testdaten (lib/data-env-guard.ts). Ohne diese Variablen keine Wirkung.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { assertDataEnvironment } = await import("@/lib/data-env-guard");
  assertDataEnvironment();
}
