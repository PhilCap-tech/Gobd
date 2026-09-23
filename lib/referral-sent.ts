/**
 * Idempotenz für die Post-Delivery-Referral-Mail.
 * Schlüssel ist die Delivery (documentId, sonst sessionId) — höchstens ein Versand.
 * Datei-Ledger: lokal `.data`, auf Vercel `/tmp` (gleicher Ort wie der Intake-Fallback).
 * Zusätzlich setzt der Versand einen Resend-Idempotency-Key.
 */

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const FILE_NAME = "referral-sent.json";

type Ledger = { sent: string[] };

const sent = new Set<string>();
const inflight = new Set<string>();
let hydratePromise: Promise<void> | null = null;
let ledgerPathOverride: string | null = null;

/** Delivery-Event: Dokument, sonst Checkout-Session. Ohne beides kein Versand. */
export function referralDeliveryKey(input: {
  documentId?: string;
  sessionId?: string;
}): string | null {
  const documentId = input.documentId?.trim() ?? "";
  const sessionId = input.sessionId?.trim() ?? "";
  if (documentId) return `doc-${documentId}`;
  if (sessionId) return `session-${sessionId}`;
  return null;
}

/** Resend erlaubt nur Buchstaben, Ziffern, Bindestrich und Unterstrich (max. 256). */
export function referralIdempotencyKey(eventKey: string): string {
  const safe = eventKey.replace(/[^A-Za-z0-9_-]/g, "-");
  return `referral-after-delivery-${safe}`.slice(0, 256);
}

function dataDir(): string {
  if (process.env.VERCEL === "1" || process.env.VERCEL === "true") {
    return path.join(tmpdir(), "gobd-data");
  }
  return path.join(process.cwd(), ".data");
}

function ledgerPath(): string {
  if (ledgerPathOverride) return ledgerPathOverride;
  return path.join(dataDir(), FILE_NAME);
}

/**
 * Isolierte Ledger-Datei für Preview-Asserts.
 * Produktionsversand lässt den Default (`.data` / `/tmp`).
 */
export function setReferralLedgerFile(filePath: string): void {
  ledgerPathOverride = filePath;
  sent.clear();
  inflight.clear();
  hydratePromise = null;
}

async function hydrate(): Promise<void> {
  if (!hydratePromise) {
    hydratePromise = (async () => {
      try {
        const raw = await readFile(
          /*turbopackIgnore: true*/ ledgerPath(),
          "utf8",
        );
        const parsed = JSON.parse(raw) as Partial<Ledger>;
        if (!Array.isArray(parsed.sent)) return;
        for (const key of parsed.sent) {
          if (typeof key === "string" && key) sent.add(key);
        }
      } catch (error) {
        const code =
          error && typeof error === "object" && "code" in error
            ? (error as { code?: string }).code
            : undefined;
        if (code !== "ENOENT") {
          console.error("[ops] referral ledger lesen fehlgeschlagen", error);
        }
      }
    })();
  }
  await hydratePromise;
}

async function persist(): Promise<void> {
  const file = ledgerPath();
  await mkdir(path.dirname(file), { recursive: true });
  const payload = JSON.stringify({ sent: [...sent] });
  const tmp = `${file}.${process.pid}.tmp`;
  await writeFile(/*turbopackIgnore: true*/ tmp, payload, "utf8");
  await rename(tmp, file);
}

export async function reserveReferralDelivery(
  key: string,
): Promise<"reserved" | "duplicate"> {
  await hydrate();
  if (sent.has(key) || inflight.has(key)) return "duplicate";
  inflight.add(key);
  return "reserved";
}

export async function completeReferralDelivery(key: string): Promise<void> {
  inflight.delete(key);
  sent.add(key);
  try {
    await persist();
  } catch (error) {
    console.error("[ops] referral ledger schreiben fehlgeschlagen", error);
  }
}

export function cancelReferralDelivery(key: string): void {
  inflight.delete(key);
}
