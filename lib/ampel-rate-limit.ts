import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  BlobNotFoundError,
  BlobPreconditionFailedError,
  del,
  get as readBlob,
  put,
} from "@vercel/blob";
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

function firstHeaderIp(value: string | null): string {
  if (!value) return "";
  for (const part of value.split(",")) {
    const ip = part.trim();
    if (ip) return ip.slice(0, 80);
  }
  return "";
}

/**
 * Vercel puts the client in the first `x-forwarded-for` entry and in
 * `x-real-ip`. The Web `Request` used by the route has no `ip` field.
 */
export function ampelClientIp(headers: Headers): string {
  return (
    firstHeaderIp(headers.get("x-forwarded-for")) ||
    firstHeaderIp(headers.get("x-real-ip")) ||
    firstHeaderIp(headers.get("x-vercel-forwarded-for")) ||
    "unknown"
  );
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

export const AMPEL_RATE_BLOB_PREFIX = "gobd/ampel-rate";
/** The Blob SDK rejects a max-age below 60 seconds. Reads pass `useCache: false`. */
export const AMPEL_RATE_BLOB_CACHE_MAX_AGE = 60;

export type AmpelRateIo = {
  get(pathname: string): Promise<string | null>;
  create(pathname: string, body: string): Promise<"created" | "exists">;
  remove(pathname: string): Promise<void>;
};

function rateHash(logicalKey: string): string {
  return createHash("sha256").update(logicalKey).digest("hex").slice(0, 32);
}

export function ampelRateWindowId(now: number, windowMs: number): number {
  return Math.floor(now / windowMs);
}

export function ampelRateSlotPath(
  kind: "ip" | "email",
  logicalKey: string,
  windowId: number,
  slot: number,
): string {
  return `${AMPEL_RATE_BLOB_PREFIX}/${kind}/${rateHash(logicalKey)}/${windowId}/${slot}`;
}

async function readSlots(
  io: AmpelRateIo,
  kind: "ip" | "email",
  logicalKey: string,
  windowId: number,
  limit: number,
): Promise<Array<string | null>> {
  return Promise.all(
    Array.from({ length: limit }, (_, index) =>
      io.get(ampelRateSlotPath(kind, logicalKey, windowId, index + 1)),
    ),
  );
}

async function claimDimension(
  io: AmpelRateIo,
  kind: "ip" | "email",
  logicalKey: string,
  limit: number,
  windowMs: number,
  now: number,
): Promise<{ status: "ok"; path: string } | { status: "limited" }> {
  const windowId = ampelRateWindowId(now, windowMs);
  const keep = Math.max(1, Math.ceil(AMPEL_RATE_RETENTION_MS / windowMs));
  const expired = windowId - keep;
  if (expired >= 0) {
    void Promise.all(
      Array.from({ length: limit }, (_, index) =>
        io.remove(ampelRateSlotPath(kind, logicalKey, expired, index + 1)),
      ),
    ).catch(() => undefined);
  }
  for (let attempt = 0; attempt < limit; attempt += 1) {
    const slots = await readSlots(io, kind, logicalKey, windowId, limit);
    const open = slots.findIndex((slot) => slot == null);
    if (open < 0) return { status: "limited" };
    const path = ampelRateSlotPath(kind, logicalKey, windowId, open + 1);
    const created = await io.create(path, JSON.stringify({ at: now }));
    if (created === "created") return { status: "ok", path };
  }
  return { status: "limited" };
}

/**
 * One private blob per allowed request in the current window.
 * `create` is conditional, so two instances cannot take the same slot.
 */
export function createSlotAmpelRateStore(io: AmpelRateIo): AmpelRateStore {
  return {
    async take({ ipKey, emailKey, now }) {
      const emailWindow = ampelRateWindowId(now, AMPEL_EMAIL_WINDOW_MS);
      const ipWindow = ampelRateWindowId(now, AMPEL_IP_WINDOW_MS);
      const [emailSlots, ipSlots] = await Promise.all([
        readSlots(io, "email", emailKey, emailWindow, AMPEL_EMAIL_LIMIT),
        readSlots(io, "ip", ipKey, ipWindow, AMPEL_IP_LIMIT),
      ]);
      if (emailSlots.every((slot) => slot != null)) return "email";
      if (ipSlots.every((slot) => slot != null)) return "ip";
      const email = await claimDimension(
        io,
        "email",
        emailKey,
        AMPEL_EMAIL_LIMIT,
        AMPEL_EMAIL_WINDOW_MS,
        now,
      );
      if (email.status === "limited") return "email";
      const ip = await claimDimension(
        io,
        "ip",
        ipKey,
        AMPEL_IP_LIMIT,
        AMPEL_IP_WINDOW_MS,
        now,
      );
      if (ip.status === "limited") {
        try {
          await io.remove(email.path);
        } catch {
          // The daily slot may stay occupied. The request still sends no mail.
        }
        return "ip";
      }
      return "ok";
    },
  };
}

function blobToken(): string {
  return process.env.BLOB_READ_WRITE_TOKEN?.trim() ?? "";
}

function blobMissing(error: unknown): boolean {
  if (error instanceof BlobNotFoundError) return true;
  const name = error instanceof Error ? error.constructor?.name ?? error.name : "";
  return name === "BlobNotFoundError";
}

function blobConflict(error: unknown): boolean {
  if (error instanceof BlobPreconditionFailedError) return true;
  const name = error instanceof Error ? error.constructor?.name ?? error.name : "";
  if (name === "BlobPreconditionFailedError") return true;
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return message.includes("already exists") || message.includes("precondition");
}

function blobAmpelRateIo(): AmpelRateIo {
  const token = blobToken();
  return {
    async get(pathname) {
      try {
        const result = await readBlob(pathname, { access: "private", useCache: false, token });
        if (result == null) return null;
        if (result.statusCode !== 200 || !result.stream) throw new Error("ampel-rate-read");
        return await new Response(result.stream).text();
      } catch (error) {
        if (blobMissing(error)) return null;
        throw error;
      }
    },
    async create(pathname, body) {
      try {
        await put(pathname, body, {
          access: "private",
          addRandomSuffix: false,
          allowOverwrite: false,
          cacheControlMaxAge: AMPEL_RATE_BLOB_CACHE_MAX_AGE,
          contentType: "application/json; charset=utf-8",
          token,
        });
        return "created";
      } catch (error) {
        if (blobConflict(error)) return "exists";
        throw error;
      }
    },
    async remove(pathname) {
      try {
        await del(pathname, { token });
      } catch (error) {
        if (blobMissing(error)) return;
        throw error;
      }
    },
  };
}

export function createBlobAmpelRateStore(): AmpelRateStore {
  return createSlotAmpelRateStore(blobAmpelRateIo());
}

/** No shared store. Callers must show the result and send no mail. */
export function createClosedAmpelRateStore(): AmpelRateStore {
  return {
    async take() {
      throw new Error("ampel-rate-unshared");
    },
  };
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

function vercelRuntime(): boolean {
  return process.env.VERCEL === "1" || process.env.VERCEL === "true";
}

export function ampelRateStore(): AmpelRateStore {
  if (!sharedStore) {
    if (blobToken()) sharedStore = createBlobAmpelRateStore();
    else if (vercelRuntime()) sharedStore = createClosedAmpelRateStore();
    else sharedStore = createFileAmpelRateStore(path.join(getFileFallbackDir(), "ampel-rate.json"));
  }
  return sharedStore;
}
