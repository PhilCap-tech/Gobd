/**
 * Kauf erst nach payment_status=paid. Das Zuteilungs-Cookie berechtigt nicht.
 * Ein Präfix in der Session-ID ist kein Beweis. Es zählt die gespeicherte ID.
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
import { loadIntakeDraft, saveIntakeDraft } from "@/lib/intake-draft";
import { automatedRunForbidsLiveWrites } from "@/lib/live-write-guard";
import { generateStandardPdf } from "@/lib/schnellversion-pdf";
import { draftFromSchnellversion, mergeEmptyDraftFields } from "@/lib/schnellversion-draft";
import { createSchnellversionTestSession } from "@/lib/schnellversion-checkout";
import { getSvJson, putSvJson, svBlobEnabled, svPendingBlobPath, svPendingSessionBlobPath } from "@/lib/schnellversion-persist";
import { claimSvSession, findSvPurchaseBySession, newDownloadToken, releaseSvSession, saveSvPurchase, type SvPurchase } from "@/lib/schnellversion-record";
import { rememberSvEvent } from "@/lib/schnellversion-store";

export type SvPending = {
  id: string;
  answers: SchnellversionAnswers;
  consentAt: string;
  email: string;
  createdAt: string;
  sessionId: string;
  /** Gesetzt beim Anlegen. Ein späteres Umschreiben der ID ändert das nicht. */
  paid: boolean;
  downloadTokenHash: string;
  arm: "" | "control" | "test";
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
  if (svBlobEnabled()) {
    await putSvJson(svPendingBlobPath(row.id), row, true);
    if (row.sessionId.trim()) await putSvJson(svPendingSessionBlobPath(row.sessionId), row.id, true);
  }
}

export async function findPendingBySession(sessionId: string): Promise<SvPending | null> {
  const id = sessionId.trim();
  if (!id) return null;
  for (const row of pendingMemory.values()) {
    if (row.sessionId === id) return row;
  }
  const fromFile = (await readPendingFile()).find((row) => row.sessionId === id);
  if (fromFile) return fromFile;
  if (!svBlobEnabled()) return null;
  const pendingId = await getSvJson<string>(svPendingSessionBlobPath(id));
  if (!pendingId) return null;
  return loadSvPending(pendingId);
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
  arm?: "" | "control" | "test";
  /** Nur der Check übergibt eine eigene Umgebung. Die Route lässt sie weg. */
  env?: Record<string, string | undefined>;
}): Promise<{ ok: false; status: number } | { ok: true; sessionId: string; url: string }> {
  if (input.unternehmer !== true || input.bewusst !== true) return { ok: false, status: 400 };
  const answers = parseSchnellversionAnswers(input.answers);
  if (!answers) return { ok: false, status: 400 };
  const env = input.env ?? process.env;
  const id = randomUUID();
  const download = newDownloadToken();
  const pending: SvPending = {
    id,
    answers,
    consentAt: new Date().toISOString(),
    email: input.email.trim().toLowerCase(),
    createdAt: new Date().toISOString(),
    sessionId: "",
    paid: false,
    downloadTokenHash: download.hash,
    arm: input.arm === "control" || input.arm === "test" ? input.arm : "",
  };
  const plan = schnellversionCheckoutPlan(env);
  if (plan === "refuse") return { ok: false, status: 403 };
  const thanks = (sessionId: string) =>
    `/schnellversion/danke?session_id=${encodeURIComponent(sessionId)}&dl=${encodeURIComponent(download.token)}`;
  if (plan === "test") {
    const created = await createSchnellversionTestSession(
      {
        pendingId: id,
        consentAt: pending.consentAt,
        company: answers.firma,
        downloadToken: download.token,
      },
      env,
    );
    if (!created) return { ok: false, status: 502 };
    pending.sessionId = created.sessionId;
    await saveSvPending(pending);
    return { ok: true, sessionId: created.sessionId, url: created.url };
  }
  const paid = schnellversionStripeStub(env) && stubMarksPaid(env);
  const sessionId = stubSessionId(id, paid);
  pending.paid = paid;
  pending.sessionId = sessionId;
  await saveSvPending(pending);
  return { ok: true, sessionId, url: thanks(sessionId) };
}

/**
 * Bezahlt nur, wenn die angeforderte ID exakt die gespeicherte ist.
 * `stub_sv_paid_` ohne diesen Datensatz zählt nicht. Der Stub gilt nicht auf Vercel und nicht in Produktion.
 */
export function paidFromStoredSession(input: {
  requestedId: string;
  storedId: string;
  storedPaid: boolean;
  env: Record<string, string | undefined>;
  stripePaid?: boolean;
}): boolean {
  const requested = input.requestedId.trim();
  if (!requested || requested !== input.storedId) return false;
  if (requested.startsWith("stub_sv_")) return schnellversionStripeStub(input.env) && input.storedPaid;
  return input.stripePaid === true;
}

export type PaidProof = {
  status?: "paid";
  pendingId?: string;
  /** Nur der Check. Die Route lässt das weg und nutzt die Prozess-Umgebung. */
  env?: Record<string, string | undefined>;
};

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
  const remote = await retrieveTestSession(sessionId);
  return remote?.status ?? "unpaid";
}

const sessionQueues = new Map<string, Promise<unknown>>();

function queueSession<T>(sessionId: string, run: () => Promise<T>): Promise<T> {
  const previous = sessionQueues.get(sessionId) ?? Promise.resolve();
  const current = previous.then(run, run);
  sessionQueues.set(
    sessionId,
    current.then(
      () => undefined,
      () => undefined,
    ),
  );
  return current;
}

async function waitForPurchase(sessionId: string): Promise<SvPurchase | null> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const found = await findSvPurchaseBySession(sessionId);
    if (found) return found;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return null;
}

/** Legt den Kauf erst an, wenn die gespeicherte Session bezahlt ist. Unbezahlt bleibt ohne Zeile und ohne PDF. */
let failNextClaimedPurchase = false;

/** Nur der Check. Der nächste bezahlte Claim wirft, bevor die Kaufzeile entsteht. */
export function failNextClaimedPurchaseForTest(): void {
  failNextClaimedPurchase = true;
}

export async function confirmPaidSession(
  sessionId: string,
  proof?: PaidProof,
): Promise<{ paid: false; confirming?: boolean } | { paid: true; purchase: SvPurchase }> {
  const requested = sessionId.trim();
  if (!requested) return { paid: false };
  return queueSession(requested, () => confirmPaidSessionOnce(requested, proof));
}

async function confirmPaidSessionOnce(
  requested: string,
  proof?: PaidProof,
): Promise<{ paid: false; confirming?: boolean } | { paid: true; purchase: SvPurchase }> {
  const env = proof?.env ?? process.env;
  if (requested.startsWith("stub_sv_") && !schnellversionStripeStub(env)) return { paid: false };
  const existing = await findSvPurchaseBySession(requested);
  if (existing) return { paid: true, purchase: existing };
  const pending = await findPendingBySession(requested);
  if (!pending) return { paid: false };
  if (proof?.pendingId && proof.pendingId !== pending.id) return { paid: false };
  let stripePaid = false;
  if (!requested.startsWith("stub_sv_")) {
    if (proof?.status === "paid") stripePaid = true;
    else {
      const remote = await retrieveTestSession(requested);
      stripePaid = remote?.status === "paid" && (!remote.pendingId || remote.pendingId === pending.id);
    }
  }
  if (
    !paidFromStoredSession({
      requestedId: requested,
      storedId: pending.sessionId,
      storedPaid: pending.paid === true,
      env,
      stripePaid,
    })
  ) {
    return { paid: false };
  }
  const claim = await claimSvSession(requested);
  if (claim === "exists") {
    const winner = await waitForPurchase(requested);
    return winner ? { paid: true, purchase: winner } : { paid: false, confirming: true };
  }
  try {
    if (failNextClaimedPurchase) {
      failNextClaimedPurchase = false;
      throw new Error("Kauf nicht gespeichert");
    }
    const pdf = await generateStandardPdf(pending.answers, new Date(pending.createdAt));
    const purchase = await saveSvPurchase({
      email: pending.email,
      company: pending.answers.firma,
      purchasedAt: pending.createdAt,
      pdf,
      consentAt: pending.consentAt,
      sessionId: pending.sessionId,
      answersJson: JSON.stringify(pending.answers),
      downloadTokenHash: pending.downloadTokenHash,
    });
    if (pending.arm === "control" || pending.arm === "test") {
      rememberSvEvent({
        name: "sv_purchase",
        arm: pending.arm,
        variante: "b",
        branche_vorlage: "",
        value: 49,
        step: 0,
        ziel: "",
      });
    }
    if (pending.email && !automatedRunForbidsLiveWrites()) {
      const incoming = draftFromSchnellversion(pending.email, pending.answers);
      const stored = await loadIntakeDraft(incoming.draftKey);
      await saveIntakeDraft(stored ? mergeEmptyDraftFields(stored, incoming) : incoming);
    }
    return { paid: true, purchase };
  } catch (error) {
    await releaseSvSession(requested);
    throw error;
  }
}

export function consentStamp(pending: SvPending): string {
  return pending.consentAt;
}
