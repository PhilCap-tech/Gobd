/**
 * Neues Preismodell (Philip 28.10.): zum Start EINE Firma je v3-Konto.
 * Eine weitere Firma braucht ein eigenes Konto mit eigener E-Mail-Adresse.
 * Legacy-, DS24- und Comp-Konten bleiben unverändert (mehrere Firmen wie bisher).
 * Firmenbezogene Fristen/Zugänge kommen später in einem eigenen PR.
 */
import { isCompAccessEmail } from "@/lib/comp-access";
import { hasDs24Access } from "@/lib/digistore24-access";
import { logError } from "@/lib/log-error";
import { findPlanByEmail } from "@/lib/plan-store";
import { isPricingV2 } from "@/lib/pricing-model";
import { findLatestPaidCheckoutByEmail } from "@/lib/store";

import { V3_ONE_FIRM_MESSAGE } from "@/lib/account-labels";
import { V3_INVITE_PREPAY_MESSAGE } from "@/lib/invite-copy";
export { V3_ONE_FIRM_MESSAGE };

export type V3AccountFacts = {
  newModel: boolean;
  comp: boolean;
  ds24: boolean;
  planModel: string;
  /** Bezahlter Checkout vor dem neuen Modell (Legacy-Kunde). */
  paidCheckout: boolean;
};

/** Reine Entscheidung: ist das ein v3-Konto? */
export function isV3AccountFrom(facts: V3AccountFacts): boolean {
  if (!facts.newModel || facts.comp || facts.ds24) return false;
  if (facts.planModel === "v3") return true;
  // Ohne v3-Plan, aber mit bezahltem Checkout: Bestandskunde (Legacy).
  return !facts.paidCheckout;
}

/** Reine Entscheidung: darf eine weitere Firma angelegt/gekauft werden? */
export function v3FirmDenialFrom(facts: V3AccountFacts, existingFirms: number): string | null {
  return isV3AccountFrom(facts) && existingFirms >= 1 ? V3_ONE_FIRM_MESSAGE : null;
}

export async function loadV3AccountFacts(email: string): Promise<V3AccountFacts> {
  const newModel = isPricingV2();
  const base: V3AccountFacts = { newModel, comp: false, ds24: false, planModel: "", paidCheckout: false };
  if (!newModel || !email.trim()) return base;
  const comp = isCompAccessEmail(email);
  if (comp) return { ...base, comp };
  const ds24 = await hasDs24Access(email);
  if (ds24) return { ...base, ds24 };
  let planModel = "";
  let paidCheckout = false;
  try {
    planModel = (await findPlanByEmail(email))?.pricingModel ?? "";
    if (planModel !== "v3") paidCheckout = Boolean(await findLatestPaidCheckoutByEmail(email));
  } catch (error) {
    // Unklar: wie v3 behandeln (fail-closed nur für eine WEITERE Firma).
    logError("[firma] Kontoart nicht geladen", error, { level: "warn" });
  }
  return { ...base, planModel, paidCheckout };
}

/** Meldung, wenn dieses Konto keine weitere Firma anlegen darf; sonst null. */
export async function v3FirmDenial(email: string, existingFirms: number): Promise<string | null> {
  if (!isPricingV2() || existingFirms < 1) return null;
  return v3FirmDenialFrom(await loadV3AccountFacts(email), existingFirms);
}

/** CoS 28.10.: im neuen Modell Einladungen erst nach Abschluss der Bestellung (Wortlaut in lib/invite-copy). */
export { V3_INVITE_PREPAY_MESSAGE };

/** Reine Entscheidung: v3-Konto ohne bezahlten v3-Kauf darf nicht einladen. */
export function v3InvitePrepayDenialFrom(facts: V3AccountFacts, paidV3: boolean): string | null {
  return isV3AccountFrom(facts) && !paidV3 ? V3_INVITE_PREPAY_MESSAGE : null;
}

/** Meldung, wenn dieses v3-Konto noch nichts bezahlt hat; Legacy/DS24/Comp: null. */
export async function v3InvitePrepayDenial(email: string): Promise<string | null> {
  if (!isPricingV2() || !email.trim()) return null;
  const facts = await loadV3AccountFacts(email);
  if (!isV3AccountFrom(facts)) return null;
  let paid = false;
  try {
    const row = await findPlanByEmail(email);
    paid = Boolean(row && row.pricingModel === "v3" && row.purchasedAt && !row.deletedAt);
  } catch (error) {
    logError("[einladung] Plan nicht geladen", error, { level: "warn" });
  }
  return v3InvitePrepayDenialFrom(facts, paid);
}
