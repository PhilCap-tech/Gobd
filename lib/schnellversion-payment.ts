/**
 * Kauf erst nach payment_status=paid. Das Zuteilungs-Cookie berechtigt nicht.
 * Der Stub spricht Stripe nicht an: die Session-ID trägt paid oder unpaid.
 */

import { randomUUID } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import {
  parseSchnellversionAnswers,
  type SchnellversionAnswers,
} from "@/lib/schnellversion-answers";
import { schnellversionCheckoutPlan, schnellversionStripeStub } from "@/lib/schnellversion-flag";
import { saveIntakeDraft } from "@/lib/intake-draft";
import { automatedRunForbidsLiveWrites } from "@/lib/live-write-guard";
import { generateStandardPdf } from "@/lib/schnellversion-pdf";
import { draftFromSchnellversion } from "@/lib/schnellversion-draft";
import { createSchnellversionTestSession } from "@/lib/schnellversion-checkout";
import { getSvJson, putSvJson, svBlobEnabled, svPendingBlobPath } from "@/lib/schnellversion-persist";
import { findSvPurchaseBySession, saveSvPurchase, type SvPurchase } from "@/lib/schnellversion-record";

export type SvPending = {
  id: string;
  answers: SchnellversionAnswers;
  consentAt: string;
  email: string;
  createdAt: string;
  sessionId: string;
};

const pendingMemory = new Map<string, SvPending>();

function pendingFile(): string {
  return path.join(tmpdir(), "gobd-sv49-pending.json");
}

function writesFiles(): boolean {
  const event = process.env.npm_lifecycle_event ?? "";
  if (event === "prebuild" || event === "build" || event.startsWith("check:")) return false;
  return (process.env.VERCEL_ENV ?? "").trim() !== "production";
}

async function readPendingFile(): Promise<SvPending[]> {
  try {
    const parsed = JSON.parse(await readFile(pendingFile(), "utf8")) as SvPending[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writePendingFile(rows: SvPending[]): Promise<void> {
  if (!writesFiles()) return;
  await mkdir(path.dirname(pendingFile()), { recursive: true });
  await writeFile(pendingFile(), JSON.stringify(rows), "utf8");
}

export function resetSvPendingForTest(): void {
  pendingMemory.clear();
}

export async function saveSvPending(row: SvPending): Promise<void> {
  pendingMemory.set(row.id, row);
  const all = (await readPendingFile()).filter((item) => item.id !== row.id);
  all.push(row);
  await writePendingFile(all);
  if (svBlobEnabled()) await putSvJson(svPendingBlobPath(row.id), row, true);
}

export async function loadSvPending(id: string): Promise<SvPending | null> {
  const memory = pendingMemory.get(id);
  if (memory) return memory;
  const found = (await readPendingFile()).find((item) => item.id === id) ?? null;
  if (found) {
    pendingMemory.set(found.id, found);
    return found;
  }
  if (!svBlobEnabled()) return null;
  const blob = await getSvJson<SvPending>(svPendingBlobPath(id));
  if (blob) pendingMemory.set(blob.id, blob);
  return blob;
}

/** Nur `paid` zählt. Alles andere, auch leer, ist unbezahlt. */
export function paymentFromStatus(status: string | null | undefined): "paid" | "unpaid" {
  return status === "paid" ? "paid" : "unpaid";
}

/**
 * Stub-Sessions heißen `stub_sv_paid_…` oder `stub_sv_unpaid_…`.
 * Andere IDs sind keine Stub-Sessions.
 */
export function stubSessionPayment(sessionId: string): "paid" | "unpaid" | null {
  if (!sessionId.startsWith("stub_sv_")) return null;
  if (sessionId.startsWith("stub_sv_paid_")) return "paid";
  if (sessionId.startsWith("stub_sv_unpaid_")) return "unpaid";
  return "unpaid";
}

export function pendingIdFromSession(sessionId: string): string {
  return sessionId.replace(/^stub_sv_(?:paid|unpaid)_/, "");
}

export function stubSessionId(pendingId: string, paid: boolean): string {
  return `stub_sv_${paid ? "paid" : "unpaid"}_${pendingId}`;
}

export function stubMarksPaid(env: Record<string, string | undefined> = process.env): boolean {
  const raw = (env.SCHNELLVERSION_49_STRIPE_STUB ?? "").trim().toLowerCase();
  return raw === "paid";
}

export async function openSchnellversionCheckout(input: {
  answers: unknown;
  unternehmer: boolean;
  bewusst: boolean;
  email: string;
}): Promise<{ ok: false; status: number } | { ok: true; sessionId: string; url: string }> {
  if (input.unternehmer !== true || input.bewusst !== true) return { ok: false, status: 400 };
  const answers = parseSchnellversionAnswers(input.answers);
  if (!answers) return { ok: false, status: 400 };
  const id = randomUUID();
  const pending: SvPending = {
    id,
    answers,
    consentAt: new Date().toISOString(),
    email: input.email.trim().toLowerCase(),
    createdAt: new Date().toISOString(),
    sessionId: "",
  };
  const plan = schnellversionCheckoutPlan();
  if (plan === "refuse") return { ok: false, status: 403 };
  if (plan === "test") {
    const created = await createSchnellversionTestSession({
      pendingId: id,
      consentAt: pending.consentAt,
      company: answers.firma,
    });
    if (!created) return { ok: false, status: 502 };
    pending.sessionId = created.sessionId;
    await saveSvPending(pending);
    return { ok: true, sessionId: created.sessionId, url: created.url };
  }
  const sessionId = stubSessionId(id, schnellversionStripeStub() ? stubMarksPaid() : false);
  pending.sessionId = sessionId;
  await saveSvPending(pending);
  return { ok: true, sessionId, url: `/schnellversion/danke?session_id=${encodeURIComponent(sessionId)}` };
}

export type PaidProof = { status: "paid"; pendingId?: string };

/**
 * Bezahlte Stub-Session oder, außerhalb von Check und Stub, eine
 * `sk_test_`-Session mit payment_status=paid. Der Webhook übergibt den Status.
 */
async function retrieveTestSession(
  sessionId: string,
): Promise<{ status: "paid" | "unpaid"; pendingId: string } | null> {
  if (!sessionId.startsWith("cs_")) return null;
  if (automatedRunForbidsLiveWrites() || schnellversionStripeStub()) return null;
  const secret = (process.env.STRIPE_SECRET_KEY ?? "").trim();
  if (!secret.startsWith("sk_test_")) return null;
  try {
    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(secret);
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const pending = session.metadata?.sv_pending;
    return {
      status: paymentFromStatus(session.payment_status),
      pendingId: typeof pending === "string" ? pending.trim() : "",
    };
  } catch {
    return { status: "unpaid", pendingId: "" };
  }
}

export async function resolvePaymentStatus(sessionId: string): Promise<"paid" | "unpaid"> {
  const stub = stubSessionPayment(sessionId);
  if (stub) return stub;
  const remote = await retrieveTestSession(sessionId);
  return remote?.status ?? "unpaid";
}

/** Legt den Kauf erst an, wenn die Session bezahlt ist. Unbezahlt bleibt ohne Zeile und ohne PDF. */
export async function confirmPaidSession(
  sessionId: string,
  proof?: PaidProof,
): Promise<{ paid: false } | { paid: true; purchase: SvPurchase }> {
  let status: "paid" | "unpaid" | undefined = proof?.status;
  let pendingId = proof?.pendingId?.trim() ?? "";
  if (!status || (!pendingId && sessionId.startsWith("cs_"))) {
    const stub = stubSessionPayment(sessionId);
    if (stub) {
      status = status ?? stub;
      pendingId = pendingId || pendingIdFromSession(sessionId);
    } else {
      const remote = await retrieveTestSession(sessionId);
      status = status ?? remote?.status ?? "unpaid";
      pendingId = pendingId || remote?.pendingId || "";
    }
  }
  if (paymentFromStatus(status) !== "paid") return { paid: false };
  const existing = await findSvPurchaseBySession(sessionId);
  if (existing) return { paid: true, purchase: existing };
  if (!pendingId) pendingId = pendingIdFromSession(sessionId);
  const pending = await loadSvPending(pendingId);
  if (!pending) return { paid: false };
  const pdf = await generateStandardPdf(pending.answers, new Date(pending.createdAt));
  const purchase = await saveSvPurchase({
    email: pending.email,
    company: pending.answers.firma,
    purchasedAt: pending.createdAt,
    pdf,
    consentAt: pending.consentAt,
    sessionId,
    answersJson: JSON.stringify(pending.answers),
  });
  if (pending.email && !automatedRunForbidsLiveWrites()) {
    await saveIntakeDraft(draftFromSchnellversion(pending.email, pending.answers));
  }
  return { paid: true, purchase };
}

export function consentStamp(pending: SvPending): string {
  return pending.consentAt;
}
