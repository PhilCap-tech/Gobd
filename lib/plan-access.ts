/**
 * Zugang aus dem Plan (Preismodell v2). Ohne PLAN_ACCESS_ENABLED bzw.
 * PRICING_MODEL=v2 wird der Tab nicht gelesen: das bisherige Verhalten
 * bleibt unverändert. Ohne Plan-Zeile (Bestand, DS24, Comp) ebenfalls.
 */
import { planAccess, consumeChangeCredit, type PlanAccess, type PlanRow } from "@/lib/plan";
import { findPlanByEmailStrict, savePlanRow } from "@/lib/plan-store";
import { planAccessEnabled } from "@/lib/pricing-model";
import { SheetsUnavailableError, sheetsStatusCode } from "@/lib/sheets-unavailable";

function logReadFailure(context: string, error: unknown): void {
  console.error(
    "[plans] Zugang lesen fehlgeschlagen",
    JSON.stringify({
      check: context,
      error: error instanceof Error ? error.name || "Error" : typeof error,
      status: sheetsStatusCode(error),
    }),
  );
}

/** Plan und Zugang, oder `null` (Schalter aus / keine Zeile). Wirft bei Lesefehler. */
export async function loadPlanAccess(
  email: string | null | undefined,
  now: Date = new Date(),
): Promise<{ row: PlanRow; access: PlanAccess } | null> {
  const normalized = (email ?? "").trim();
  if (!normalized || !planAccessEnabled()) return null;
  const row = await findPlanByEmailStrict(normalized);
  if (!row) return null;
  return { row, access: planAccess(row, now) };
}

/** Schreibzugriff (Entwurf, Upload, Abgabe). Lesefehler: 503 wie beim Lifecycle. */
export async function planWriteDenial(email: string | null | undefined): Promise<string | null> {
  try {
    const loaded = await loadPlanAccess(email);
    if (!loaded) return null;
    return loaded.access.writesOpen ? null : loaded.access.writeMessage;
  } catch (error) {
    logReadFailure("write", error);
    throw new SheetsUnavailableError(sheetsStatusCode(error));
  }
}

/** Neue Version einer bestehenden Doku: Mitglied oder bezahlte Änderung. */
export async function planVersionDenial(email: string | null | undefined): Promise<string | null> {
  try {
    const loaded = await loadPlanAccess(email);
    if (!loaded) return null;
    return loaded.access.newVersionAllowed ? null : loaded.access.versionMessage;
  } catch (error) {
    logReadFailure("version", error);
    throw new SheetsUnavailableError(sheetsStatusCode(error));
  }
}

/** Downloads: wie bisher offen bei Lesefehler; gesperrt nur nach Löschung. */
export async function planDownloadDenial(email: string): Promise<string | null> {
  try {
    const loaded = await loadPlanAccess(email);
    if (!loaded) return null;
    return loaded.access.downloadsOpen ? null : loaded.access.downloadMessage;
  } catch (error) {
    logReadFailure("download", error);
    return null;
  }
}

/** Nach gespeicherter neuer Version. Fehler werden geloggt, die Version bleibt. */
export async function consumePlanChangeCredit(email: string): Promise<void> {
  try {
    const loaded = await loadPlanAccess(email);
    if (!loaded || loaded.access.state !== "window") return;
    const next = consumeChangeCredit(loaded.row, new Date().toISOString());
    if (next !== loaded.row) await savePlanRow(next);
  } catch (error) {
    console.error(
      "[plans] Änderungsguthaben nicht verbucht",
      error instanceof Error ? error.name : "error",
    );
  }
}
