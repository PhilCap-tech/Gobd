/**
 * Offene Upgrade-Checkouts einer Anrechnung.
 * Die Session-IDs stehen am Kauf. Keine Suche über alle Stripe-Sessions.
 * Expire-Fehler (schon abgelaufen oder bezahlt) bleiben ohne die volle ID im Log.
 */
import { createHash } from "node:crypto";
import { isStripeSecretConfigured } from "@/lib/env";
import { notifyOwner } from "@/lib/owner-notice";
import {
  creditCheckoutSessionIds,
  listAllSvPurchases,
  rememberCreditCheckoutSession,
  replaceCreditCheckoutSessions,
} from "@/lib/schnellversion-record";
import { appendRecord, findRowByStripeSessionId } from "@/lib/store";
import { getStripe } from "@/lib/stripe";
import { toSheetRow } from "@/lib/types";

export const CREDIT_REVIEW_STATUS = "anrechnung_pruefen";

let expireForTest: ((sessionId: string) => Promise<void>) | null = null;

type ReviewSheet = {
  find: (sessionId: string) => Promise<{ status: string } | null>;
  append: (row: { sessionId: string; email: string; company: string; status: string }) => Promise<void>;
};

let sheetForTest: ReviewSheet | null = null;

/** Nur der Check. Ersetzt den Stripe-Aufruf. */
export function setCreditSessionExpireForTest(expire: ((sessionId: string) => Promise<void>) | null): void {
  expireForTest = expire;
}

/** Nur der Check. Ersetzt das Intake-Sheet. */
export function setCreditReviewSheetForTest(sheet: ReviewSheet | null): void {
  sheetForTest = sheet;
}

function sessionRef(sessionId: string): string {
  return createHash("sha256").update(sessionId).digest("hex").slice(0, 12);
}

async function expireOne(sessionId: string): Promise<void> {
  if (expireForTest) {
    await expireForTest(sessionId);
    return;
  }
  if (!isStripeSecretConfigured()) return;
  await getStripe().checkout.sessions.expire(sessionId);
}

/** Beendet die gespeicherten Sessions. `keepId` bleibt (die gerade bezahlte). */
export async function expireStoredCreditSessions(purchaseId: string, keepId = ""): Promise<void> {
  const id = purchaseId.trim();
  const keep = keepId.trim();
  if (!id) return;
  const row = (await listAllSvPurchases()).find((item) => item.id === id);
  if (!row) return;
  const ids = creditCheckoutSessionIds(row);
  for (const sessionId of ids) {
    if (sessionId === keep) continue;
    try {
      await expireOne(sessionId);
    } catch (error) {
      console.warn("[schnellversion] Checkout nicht beendet", {
        sessionRef: sessionRef(sessionId),
        name: error instanceof Error ? error.name : "error",
      });
    }
  }
  const left = keep && ids.includes(keep) ? [keep] : [];
  if (left.join("\n") !== ids.join("\n")) await replaceCreditCheckoutSessions(id, left);
}

export async function isDuplicateCreditSession(purchaseId: string, sessionId: string): Promise<boolean> {
  const row = (await listAllSvPurchases()).find((item) => item.id === purchaseId.trim());
  if (!row?.creditUsedAt.trim()) return false;
  const used = row.creditUsedSessionId?.trim() ?? "";
  if (used && used === sessionId.trim()) return false;
  return true;
}

/**
 * Zweite bezahlte Anrechnung. Kein weiteres Upgrade, keine Erstattung.
 * Der Hinweis geht an den Inhaber. Die Zeile im Sheet bleibt zur Prüfung.
 * Eine Wiederholung schreibt und meldet nichts Neues.
 */
export async function flagDuplicateCreditPayment(input: {
  sessionId: string;
  purchaseId: string;
  email: string;
  company: string;
  livemode?: boolean;
}): Promise<void> {
  const sessionId = input.sessionId.trim();
  if (!sessionId) return;
  try {
    if (sheetForTest) {
      const existing = await sheetForTest.find(sessionId);
      if (!existing) {
        await sheetForTest.append({
          sessionId,
          email: input.email,
          company: input.company,
          status: CREDIT_REVIEW_STATUS,
        });
      }
    } else {
      const existing = await findRowByStripeSessionId(sessionId);
      if (!existing) {
        await appendRecord(
          toSheetRow({
            identity: {
              email: input.email,
              company: input.company,
              stripeSessionId: sessionId,
              stripeCustomerId: "",
              stub: false,
            },
            status: CREDIT_REVIEW_STATUS,
            deliveryStatus: "",
            changeSummary: "doppelte Anrechnung",
          }),
        );
      }
    }
  } catch (error) {
    console.warn("[schnellversion] Anrechnung nicht markiert", {
      sessionRef: sessionRef(sessionId),
      name: error instanceof Error ? error.name : "error",
    });
  }
  const notice = await notifyOwner({
    kind: "credit-duplicate",
    id: sessionId,
    title: "Doppelte Anrechnung",
    email: input.email,
    company: input.company,
    mode: input.livemode === false ? "test" : input.livemode === true ? "live" : "",
    facts: [
      ["Kauf", sessionRef(input.purchaseId)],
      ["Session", sessionRef(sessionId)],
    ],
  });
  if (!notice.duplicate) {
    console.warn("[schnellversion] zweite Anrechnung", {
      sessionRef: sessionRef(sessionId),
      purchaseRef: sessionRef(input.purchaseId),
    });
  }
  await expireStoredCreditSessions(input.purchaseId, sessionId);
}

export async function rememberUpgradeCheckout(purchaseId: string, sessionId: string): Promise<void> {
  await rememberCreditCheckoutSession(purchaseId, sessionId);
}
