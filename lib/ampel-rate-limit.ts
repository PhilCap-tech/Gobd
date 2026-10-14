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

export type AmpelRateHold = {
  ipSlot: number;
  emailSlot: number;
};

export type AmpelRateConfirm = "ok" | "ip" | "email" | "missing";

export type AmpelRateStore = {
  take(input: { ipKey: string; emailKey: string; now: number; hold?: AmpelRateHold }): Promise<AmpelRateDecision>;
  /** Checks the slot reserved by `take`. Does not open a second slot. */
  confirm(input: {
    ipKey: string;
    emailKey: string;
    now: number;
    ipSlot: number;
    emailSlot: number;
  }): Promise<AmpelRateConfirm>;
};

type Ledger = Record<string, number[]>;

const IP_HEADER_SOURCES = ["x-vercel-forwarded-for", "x-real-ip", "x-forwarded-for"] as const;

export type AmpelIpSource = (typeof IP_HEADER_SOURCES)[number] | "";

function firstHeaderValue(value: string | null): string {
  if (!value) return "";
  const first = value.split(",")[0]?.trim() ?? "";
  if (!first || first.length > 80 || first.toLowerCase() === "unknown") return "";
  return first;
}

/**
 * On Vercel the client address is `x-vercel-forwarded-for`. The first
 * `x-forwarded-for` hop is only a fallback: it can be empty or a proxy.
 * An empty or `unknown` value is not an address.
 */
export function readAmpelClientIp(headers: Headers): { ip: string; source: AmpelIpSource } {
  for (const source of IP_HEADER_SOURCES) {
    const ip = firstHeaderValue(headers.get(source));
    if (ip) return { ip, source };
  }
  return { ip: "", source: "" };
}

export function ampelClientIp(headers: Headers): string {
  return readAmpelClientIp(headers).ip;
}

/** One PII-free line: header source, slot number, and a hash of the address. */
export function ampelRateLogLine(source: string, slot: number, ip: string): string {
  const hash = createHash("sha256").update(ip || "none").digest("hex").slice(0, 12);
  const safeSlot = Number.isInteger(slot) && slot > 0 ? slot : 0;
  const safeSource = (IP_HEADER_SOURCES as readonly string[]).includes(source) ? source : "none";
  return `[ampel] rate src=${safeSource} slot=${safeSlot} ip=${hash}`;
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

/** `gobd/ampel-rate/ip-<hash>-<window>-<n>`. The index is the slot, not a list cursor. */
export function ampelRateSlotPath(
  kind: "ip" | "email",
  logicalKey: string,
  windowId: number,
  slot: number,
): string {
  return `${AMPEL_RATE_BLOB_PREFIX}/${kind}-${rateHash(logicalKey)}-${windowId}-${slot}`;
}

async function claimDimension(
  io: AmpelRateIo,
  kind: "ip" | "email",
  logicalKey: string,
  limit: number,
  windowMs: number,
  now: number,
): Promise<{ status: "ok"; path: string; slot: number } | { status: "limited"; path: ""; slot: 0 }> {
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
  for (let slot = 1; slot <= limit; slot += 1) {
    const path = ampelRateSlotPath(kind, logicalKey, windowId, slot);
    const created = await io.create(path, JSON.stringify({ at: now }));
    if (created === "created") return { status: "ok", path, slot };
  }
  return { status: "limited", path: "", slot: 0 };
}

async function slotHeld(io: AmpelRateIo, pathname: string, now: number): Promise<boolean> {
  const created = await io.create(pathname, JSON.stringify({ at: now }));
  if (created === "created") {
    try {
      await io.remove(pathname);
    } catch {
      // The probe slot may remain. The request still sends no mail.
    }
    return false;
  }
  return true;
}

/**
 * One private blob per allowed request in the current window.
 * `create` is conditional, so two instances cannot take the same slot.
 */
export function createSlotAmpelRateStore(io: AmpelRateIo): AmpelRateStore {
  return {
    async take({ ipKey, emailKey, now, hold }) {
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
      if (hold) {
        hold.ipSlot = ip.slot;
        hold.emailSlot = email.slot;
      }
      return "ok";
    },
    async confirm({ ipKey, emailKey, now, ipSlot, emailSlot }) {
      if (ipSlot < 1 || ipSlot > AMPEL_IP_LIMIT || emailSlot < 1 || emailSlot > AMPEL_EMAIL_LIMIT) return "missing";
      const ipPath = ampelRateSlotPath("ip", ipKey, ampelRateWindowId(now, AMPEL_IP_WINDOW_MS), ipSlot);
      const emailPath = ampelRateSlotPath("email", emailKey, ampelRateWindowId(now, AMPEL_EMAIL_WINDOW_MS), emailSlot);
      if (!(await slotHeld(io, ipPath, now))) return "missing";
      if (!(await slotHeld(io, emailPath, now))) return "missing";
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
    async confirm() {
      throw new Error("ampel-rate-unshared");
    },
  };
}

function ledgerConfirm(
  hits: { ip: number[]; email: number[] },
  now: number,
  ipSlot: number,
  emailSlot: number,
): AmpelRateConfirm {
  if (ipSlot < 1 || ipSlot > AMPEL_IP_LIMIT || emailSlot < 1 || emailSlot > AMPEL_EMAIL_LIMIT) return "missing";
  const ipWindow = Math.min(AMPEL_IP_WINDOW_MS, AMPEL_RATE_RETENTION_MS);
  const emailWindow = Math.min(AMPEL_EMAIL_WINDOW_MS, AMPEL_RATE_RETENTION_MS);
  const ip = hits.ip.filter((at) => now - at < ipWindow);
  const email = hits.email.filter((at) => now - at < emailWindow);
  if (ip.length === 0 || email.length === 0) return "missing";
  if (ip.length > AMPEL_IP_LIMIT) return "ip";
  if (email.length > AMPEL_EMAIL_LIMIT) return "email";
  return "ok";
}

export function createMemoryAmpelRateStore(): AmpelRateStore {
  const hits = new Map<string, number[]>();
  return {
    async take({ ipKey, emailKey, now, hold }) {
      const judged = judgeAmpelRate(
        { ip: hits.get(ipKey) ?? [], email: hits.get(emailKey) ?? [] },
        now,
      );
      hits.set(ipKey, judged.ip);
      hits.set(emailKey, judged.email);
      if (hold && judged.decision === "ok") {
        hold.ipSlot = judged.ip.length;
        hold.emailSlot = judged.email.length;
      }
      return judged.decision;
    },
    async confirm({ ipKey, emailKey, now, ipSlot, emailSlot }) {
      return ledgerConfirm(
        { ip: hits.get(ipKey) ?? [], email: hits.get(emailKey) ?? [] },
        now,
        ipSlot,
        emailSlot,
      );
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
        if (input.hold && judged.decision === "ok") {
          input.hold.ipSlot = judged.ip.length;
          input.hold.emailSlot = judged.email.length;
        }
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
    async confirm(input) {
      const ledger = await loadLedger(file);
      return ledgerConfirm(
        { ip: ledger[input.ipKey] ?? [], email: ledger[input.emailKey] ?? [] },
        input.now,
        input.ipSlot,
        input.emailSlot,
      );
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
