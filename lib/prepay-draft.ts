/**
 * Neues Preismodell, Login zuerst (INTAKE_LOGIN_FIRST_ENABLED): Nach
 * bestätigter Zahlung wird der Login-Entwurf (email:-Schlüssel) in den
 * Entwurf der bezahlten Checkout-Session (session:-Schlüssel) kopiert. Erst
 * dort kann der Fragebogen abgesendet und die Dokumentation erstellt werden
 * (bestehender bezahlter Weg). Nichts wird gelöscht; der Login-Entwurf wird
 * nur als bezahlt markiert (stripeSessionId).
 */
import type { IntakeDraft } from "@/lib/intake-draft-shared";
import { draftIsEmpty, normalizeDraftKey } from "@/lib/intake-draft-shared";
import type { CheckoutIdentity } from "@/lib/types";

export type PrepayDraftIo = {
  load: (key: string) => Promise<IntakeDraft | null>;
  save: (draft: IntakeDraft) => Promise<unknown>;
  remember?: (draft: IntakeDraft) => Promise<unknown>;
};

export type AdoptResult = "copied" | "exists" | "no_draft" | "denied";

export async function adoptPaidDraft(
  input: { sessionEmail: string; identity: CheckoutIdentity; now?: Date },
  io: PrepayDraftIo,
): Promise<AdoptResult> {
  const login = input.sessionEmail.trim().toLowerCase();
  const owner = input.identity.email.trim().toLowerCase();
  const sessionId = input.identity.stripeSessionId.trim();
  const key = input.identity.draftKey?.trim() ?? "";
  if (!login || login !== owner || !sessionId) return "denied";
  if (!key) return "no_draft";
  if (!key.startsWith(`email:${login}:`)) return "denied";
  const source = await io.load(key);
  if (!source || draftIsEmpty(source)) return "no_draft";
  const modus = key.endsWith(":bereich") ? "bereich" : "gesamt";
  const targetKey = normalizeDraftKey({ sessionId, modus });
  const existing = await io.load(targetKey);
  if (!source.stripeSessionId) {
    await io.save({ ...source, stripeSessionId: sessionId });
  }
  if (existing && !draftIsEmpty(existing)) return "exists";
  const copy: IntakeDraft = {
    ...source,
    draftKey: targetKey,
    email: login,
    stripeSessionId: sessionId,
    entityId: source.entityId || input.identity.entityId || "",
    updatedAt: (input.now ?? new Date()).toISOString(),
    pricingModel: "v3",
  };
  await io.save(copy);
  if (io.remember) await io.remember(copy);
  return "copied";
}
