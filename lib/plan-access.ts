/**
 * Zugang aus dem Plan (Preismodell v2). Ohne PLAN_ACCESS_ENABLED bzw.
 * PRICING_MODEL=v2 wird der Tab nicht gelesen: das bisherige Verhalten
 * bleibt unverändert. Ohne Plan-Zeile (Bestand, DS24, Comp) ebenfalls.
 */
import { planAccess, consumeChangeCredit, recordFirstPdf, type PlanAccess, type PlanRow } from "@/lib/plan";
import { findPlanByEmailStrict, savePlanRow } from "@/lib/plan-store";
import { applyFirmUse, firmDecision, type PlanFirmRow } from "@/lib/plan-firms";
import { listPlanFirmsByEmailStrict, savePlanFirmRow } from "@/lib/plan-firm-store";
import { extraFirmsEnabled, isPricingV2, planAccessEnabled, planLifecycleEnabled } from "@/lib/pricing-model";
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
  // Neues Modell (28.10.): die 30-Tage-Sperre gilt immer, unabhängig von
  // PLAN_LIFECYCLE_ENABLED (der Schalter steuert nur noch die zurückgestellte
  // Fristen-/Löschlogik). Mitglied/Zugang offen, abgelaufen/erstattet gesperrt.
  return { row, access: planAccess(row, now) };
}

/**
 * PLAN_LIFECYCLE_ENABLED aus (Default): der Plan sperrt nichts. Schreiben,
 * Downloads und neue Versionen offen, egal ob Frist, Kündigung, Löschung
 * oder Erstattung im Plan stehen; keine Käufe aus dem Konto. `state` bleibt
 * als Merkwert (Einstieg vs. Mitglied) erhalten, steuert aber keinen Zugang.
 */
export function neutralPlanAccess(access: PlanAccess): PlanAccess {
  return {
    ...access,
    writesOpen: true,
    downloadsOpen: true,
    newVersionAllowed: true,
    canBuyChange: false,
    canBecomeMember: false,
    canReactivate: false,
    writeMessage: "",
    versionMessage: "",
    downloadMessage: "",
  };
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

/**
 * Neues Modell (E2E 28.10., G1–G3): Sperre der Firma nach dem Plan des
 * Firmen-INHABERS (entity.userEmail), wie der Download nach row.email.
 * Gesperrt (Tag 30 / erstattet / gelöscht) → „Ihr Konto ist deaktiviert.“;
 * Lesefehler wirft SheetsUnavailableError (503, fail closed). Legacy: null.
 */
export async function v3OwnerLockDenial(ownerEmail: string | null | undefined): Promise<string | null> {
  if (!isPricingV2()) return null;
  return planWriteDenial(ownerEmail);
}

/** Fehler aus einem Entity-Loader: Firma des Inhabers gesperrt (→ 403). */
export class OwnerLockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OwnerLockedError";
  }
}

/** Einladungen (Mitwirkende): wie Schreiben, nach Tag 30 gesperrt. */
export async function planInviteDenial(email: string | null | undefined): Promise<string | null> {
  return planWriteDenial(email);
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
    if (!planLifecycleEnabled()) return;
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

/* ---------- Je Firma (R1 neu, Philip 26.10. 14:04) ---------- */

export type PlanFirmGate = {
  /** Text für 403, oder `null`. */
  denial: string | null;
  /**
   * Nach dem Speichern aufrufen: Platz binden / Guthaben verbrauchen und,
   * wenn ein PDF erzeugt wurde, die erste PDF der Firma vermerken. Wirft nie.
   */
  commit: (options?: { pdfCreated?: boolean }) => Promise<void>;
};

const OPEN_GATE: PlanFirmGate = { denial: null, commit: async () => {} };

/**
 * Prüft Schreiben bzw. neue Version für eine Firma. Ohne Schalter oder ohne
 * Konto-Zeile: offen (altes Verhalten). Konto ohne Firmen-Zeilen oder ohne
 * Firma (entityId leer): Konto-Ebene wie bisher. Lesefehler: 503.
 */
export async function planFirmGate(
  email: string | null | undefined,
  entityId: string | null | undefined,
  newVersion: boolean,
): Promise<PlanFirmGate> {
  let loaded: Awaited<ReturnType<typeof loadPlanAccess>>;
  let firms: PlanFirmRow[];
  try {
    loaded = await loadPlanAccess(email);
    if (!loaded) return OPEN_GATE;
    // Firmen-Plätze nur mit Firmen-Schalter UND Plan-Logik; sonst Konto-Ebene (offen).
    firms =
      extraFirmsEnabled() && planLifecycleEnabled()
        ? await listPlanFirmsByEmailStrict(loaded.row.email)
        : [];
  } catch (error) {
    logReadFailure("firm", error);
    throw new SheetsUnavailableError(sheetsStatusCode(error));
  }
  const account = loaded.row;
  const entity = (entityId ?? "").trim();
  const notePdf = async (options?: { pdfCreated?: boolean }) => {
    if (!options?.pdfCreated) return;
    try {
      const fresh = (await findPlanByEmailStrict(account.email)) ?? account;
      const next = recordFirstPdf(fresh, entity, new Date().toISOString());
      if (next !== fresh) await savePlanRow(next);
    } catch (error) {
      console.error("[plans] erste PDF nicht vermerkt", error instanceof Error ? error.name : "error");
    }
  };
  if (!entity || firms.length === 0) {
    if (!loaded.access.writesOpen) return { denial: loaded.access.writeMessage, commit: OPEN_GATE.commit };
    if (newVersion && !loaded.access.newVersionAllowed) {
      return { denial: loaded.access.versionMessage, commit: OPEN_GATE.commit };
    }
    return {
      denial: null,
      commit: async (options) => {
        if (newVersion) await consumePlanChangeCredit(account.email);
        await notePdf(options);
      },
    };
  }
  const decision = firmDecision({ account, firms, entityId: entity, newVersion });
  if (!decision.allowed) return { denial: decision.message, commit: OPEN_GATE.commit };
  return {
    denial: null,
    commit: async (options) => {
      await notePdf(options);
      try {
        const next = applyFirmUse(firms, decision, {
          email: account.email,
          entityId: entity,
          at: new Date().toISOString(),
        });
        if (next) await savePlanFirmRow(next);
      } catch (error) {
        console.error("[plan_firms] Firma nicht verbucht", error instanceof Error ? error.name : "error");
      }
    },
  };
}
