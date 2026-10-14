import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { getFileFallbackDir } from "@/lib/store";

export const AMPEL_IP_LIMIT = 5;
export const AMPEL_IP_WINDOW_MS = 60 * 60 * 1000;
export const AMPEL_EMAIL_LIMIT = 3;
export const AMPEL_EMAIL_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Hashed IP, timestamps, and request counts. [Default, Philip prüft] */
export const AMPEL_RATE_RETENTION_DAYS = 7;
export const AMPEL_RATE_RETENTION_MS = AMPEL_RATE_RETENTION_DAYS * 24 * 60 * 60 * 1000;

export type AmpelRateDecision = "ok" | "ip" | "email";

export type AmpelRateStore = {
  take(input: { ipKey: string; emailKey: string; now: number }): Promise<AmpelRateDecision>;
};

type Ledger = Record<string, number[]>;

export function ampelClientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  const raw = first || headers.get("x-real-ip")?.trim() || "unknown";
  return raw.slice(0, 80);
}

/** Stores a hash, never the raw address. */
export function ampelRateIpKey(ip: string): string {
  return `ip:${createHash("sha256").update(ip).digest("hex").slice(0, 32)}`;
}

export function pruneAmpelRateLedger(
  ledger: Ledger,
  now: number,
  retentionMs = AMPEL_RATE_RETENTION_MS,
): Ledger {
  const next: Ledger = {};
  for (const [key, stamps] of Object.entries(ledger)) {
    const fresh = stamps.filter((at) => now - at < retentionMs);
    if (fresh.length > 0) next[key] = fresh;
  }
  return next;
}

export function judgeAmpelRate(
  hits: { ip: number[]; email: number[] },
  now: number,
): { decision: AmpelRateDecision; ip: number[]; email: number[] } {
  const ipWindow = Math.min(AMPEL_IP_WINDOW_MS, AMPEL_RATE_RETENTION_MS);
  const emailWindow = Math.min(AMPEL_EMAIL_WINDOW_MS, AMPEL_RATE_RETENTION_MS);
  const ip = hits.ip.filter((at) => now - at < ipWindow);
  const email = hits.email.filter((at) => now - at < emailWindow);
  if (ip.length >= AMPEL_IP_LIMIT) return { decision: "ip", ip, email };
  if (email.length >= AMPEL_EMAIL_LIMIT) return { decision: "email", ip, email };
  ip.push(now);
  email.push(now);
  return { decision: "ok", ip, email };
}

export function createMemoryAmpelRateStore(): AmpelRateStore {
  const hits = new Map<string, number[]>();
  return {
    async take({ ipKey, emailKey, now }) {
      const judged = judgeAmpelRate(
        { ip: hits.get(ipKey) ?? [], email: hits.get(emailKey) ?? [] },
        now,
      );
      hits.set(ipKey, judged.ip);
      hits.set(emailKey, judged.email);
      return judged.decision;
    },
  };
}

async function loadLedger(file: string): Promise<Ledger> {
  try {
    const parsed = JSON.parse(await readFile(file, "utf8")) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const ledger: Ledger = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (!Array.isArray(value)) continue;
      ledger[key] = value.filter((item): item is number => typeof item === "number");
    }
    return ledger;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw error;
  }
}

async function saveLedger(file: string, ledger: Ledger): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  await writeFile(temp, JSON.stringify(ledger));
  await rename(temp, file);
}

export function createFileAmpelRateStore(file: string): AmpelRateStore {
  let chain: Promise<unknown> = Promise.resolve();
  return {
    take(input) {
      const run = chain.then(async () => {
        const ledger = pruneAmpelRateLedger(await loadLedger(file), input.now);
        const judged = judgeAmpelRate(
          { ip: ledger[input.ipKey] ?? [], email: ledger[input.emailKey] ?? [] },
          input.now,
        );
        if (judged.ip.length > 0) ledger[input.ipKey] = judged.ip;
        else delete ledger[input.ipKey];
        if (judged.email.length > 0) ledger[input.emailKey] = judged.email;
        else delete ledger[input.emailKey];
        await saveLedger(file, ledger);
        return judged.decision;
      }, async () => {
        throw new Error("ampel-rate-chain");
      });
      chain = run.then(
        () => undefined,
        () => undefined,
      );
      return run;
    },
  };
}

let sharedStore: AmpelRateStore | null = null;

export function ampelRateStore(): AmpelRateStore {
  sharedStore ??= createFileAmpelRateStore(path.join(getFileFallbackDir(), "ampel-rate.json"));
  return sharedStore;
}
