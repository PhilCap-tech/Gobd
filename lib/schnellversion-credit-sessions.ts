/**
 * Offene Upgrade-Checkouts einer Anrechnung.
 * Die Session-IDs stehen am Kauf. Keine Suche über alle Stripe-Sessions.
 * Expire-Fehler (schon abgelaufen oder bezahlt) bleiben ohne die volle ID im Log.
 */
import { createHash } from "node:crypto";
import { createMarker, readMarker, writeMarker } from "@/lib/blob-marker";
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

const OPEN_CHECKOUT = "sv49-credit-open";
const OPEN_GENERATION = "sv49-credit-open-gen";
const USED_CREDIT = "sv49-credit-used";

async function openGeneration(purchaseId: string): Promise<number> {
  const raw = await readMarker(OPEN_GENERATION, purchaseId);
  if (!raw) return 0;
  try {
    const parsed = JSON.parse(raw) as { gen?: unknown };
    return typeof parsed.gen === "number" && Number.isFinite(parsed.gen) ? parsed.gen : 0;
  } catch {
    return 0;
  }
}

function openKey(purchaseId: string, generation: number): string {
  return `${purchaseId}:${generation}`;
}

type OpenCheckout = { sessionId: string; url: string; stub: boolean };

function parseOpen(raw: string | null): OpenCheckout | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<OpenCheckout>;
    const sessionId = typeof parsed.sessionId === "string" ? parsed.sessionId.trim() : "";
    const url = typeof parsed.url === "string" ? parsed.url.trim() : "";
    if (!sessionId || !url) return null;
    return { sessionId, url, stub: parsed.stub === true };
  } catch {
    return null;
  }
}

/**
 * Genau ein offener Anrechnungs-Checkout. Der erste Request gewinnt den Claim.
 * Ein zweiter sieht die Session oder erhält 409, solange sie noch entsteht.
 */
export async function claimOpenCreditCheckout(purchaseId: string): Promise<
  | { state: "won"; key: string }
  | { state: "same"; session: OpenCheckout }
  | { state: "busy" }
> {
  const id = purchaseId.trim();
  if (!id) return { state: "busy" };
  const key = openKey(id, await openGeneration(id));
  const created = await createMarker(OPEN_CHECKOUT, key, JSON.stringify({ sessionId: "", url: "", stub: false }));
  if (created === "created") return { state: "won", key };
  const existing = parseOpen(await readMarker(OPEN_CHECKOUT, key));
  if (existing) return { state: "same", session: existing };
  return { state: "busy" };
}

export async function publishOpenCreditCheckout(key: string, session: OpenCheckout): Promise<void> {
  if (!key.trim() || !session.sessionId.trim() || !session.url.trim()) return;
  await writeMarker(
    OPEN_CHECKOUT,
    key,
    JSON.stringify({ sessionId: session.sessionId.trim(), url: session.url.trim(), stub: session.stub }),
  );
}

/** Gibt den Slot für einen neuen Checkout frei, ohne einen Marker zu löschen. */
export async function releaseOpenCreditCheckout(purchaseId: string): Promise<void> {
  const id = purchaseId.trim();
  if (!id) return;
  const gen = await openGeneration(id);
  await writeMarker(OPEN_GENERATION, id, JSON.stringify({ gen: gen + 1 }));
}

/** Atomar: die Anrechnung gehört genau einer Session. Dieselbe Session darf wiederholen. */
export async function claimCreditUsed(
  purchaseId: string,
  sessionId: string,
): Promise<"won" | "replay" | "lost"> {
  const purchase = purchaseId.trim();
  const session = sessionId.trim();
  if (!purchase || !session) return "lost";
  const body = JSON.stringify({ sessionId: session });
  const created = await createMarker(USED_CREDIT, purchase, body);
  if (created === "created") return "won";
  const raw = await readMarker(USED_CREDIT, purchase);
  try {
    const parsed = JSON.parse(raw ?? "") as { sessionId?: string };
    if (parsed.sessionId?.trim() === session) return "replay";
  } catch {
    /* fremder Claim */
  }
  return "lost";
}

/**
 * Verlierer: Prüfung und eine Notiz, kein Upgrade. Gewinner und Wiederholung: weiter.
 */
export async function settlePaidCreditSession(input: {
  sessionId: string;
  purchaseId: string;
  email: string;
  company: string;
  livemode?: boolean;
}): Promise<"proceed" | "review"> {
  const claim = await claimCreditUsed(input.purchaseId, input.sessionId);
  if (claim !== "lost") return "proceed";
  await flagDuplicateCreditPayment(input);
  return "review";
}

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

function alreadySettled(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return message.includes("complete") || message.includes("expired") || message.includes("paid");
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
      if (alreadySettled(error)) continue;
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
