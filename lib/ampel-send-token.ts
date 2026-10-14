import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { mkdir, open, readFile } from "node:fs/promises";
import path from "node:path";
import { get, put } from "@vercel/blob";
import { blobMissing, exclusiveBlobCreate, type ExclusivePut } from "@/lib/ampel-blob-slot";
import { getMagicLinkSecret, isMagicLinkConfigured } from "@/lib/env";
import { AMPEL_EMAIL_LIMIT, AMPEL_IP_LIMIT, AMPEL_RATE_BLOB_CACHE_MAX_AGE } from "@/lib/ampel-rate-limit";
import { getFileFallbackDir } from "@/lib/store";

/** The follow-up send must start within this window. */
export const AMPEL_SEND_TOKEN_TTL_MS = 2 * 60 * 1000;

const PREFIX = "gobd/ampel-send";

export type AmpelSendTokenStore = {
  /** `allowOverwrite: false`. `"exists"` means this slot was already taken. */
  claim(slotId: string, body: string): Promise<"created" | "exists">;
  /** Stores an opaque token when no server secret is configured. */
  putIssue(slotId: string, body: string): Promise<"created" | "exists">;
  readIssue(slotId: string): Promise<string | null>;
};

type TokenBody = {
  eh: string;
  ah: string;
  exp: number;
  is: number;
  es: number;
};

function slotInRange(slot: number, limit: number): boolean {
  return Number.isInteger(slot) && slot >= 1 && slot <= limit;
}

export function ampelSendTokenPresent(token: unknown): token is string {
  return typeof token === "string" && token.length >= 20 && token.length <= 512;
}

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}

function binding(email: string, code: string): TokenBody["eh"] extends string ? { eh: string; ah: string } : never {
  return { eh: digest(`email\n${email}`), ah: digest(`answers\n${code}`) };
}

function safeSlot(slotId: string): boolean {
  return /^[a-z0-9/-]{8,96}$/.test(slotId) && !slotId.includes("..");
}

function sign(payload: string): string {
  return createHmac("sha256", getMagicLinkSecret()).update(payload).digest("base64url");
}

function signaturesMatch(actual: string, expected: string): boolean {
  const left = Buffer.from(actual);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

function parseBody(raw: string): TokenBody | null {
  try {
    const parsed = JSON.parse(raw) as Partial<TokenBody>;
    if (typeof parsed.eh !== "string" || typeof parsed.ah !== "string") return null;
    if (typeof parsed.exp !== "number" || !Number.isFinite(parsed.exp)) return null;
    if (!slotInRange(parsed.is ?? NaN, AMPEL_IP_LIMIT) || !slotInRange(parsed.es ?? NaN, AMPEL_EMAIL_LIMIT)) return null;
    return { eh: parsed.eh, ah: parsed.ah, exp: parsed.exp, is: parsed.is as number, es: parsed.es as number };
  } catch {
    return null;
  }
}

function fresh(exp: number, now: number): boolean {
  return exp >= now && exp <= now + AMPEL_SEND_TOKEN_TTL_MS + 1_000;
}

export function createMemoryAmpelSendTokenStore(): AmpelSendTokenStore {
  const claimed = new Set<string>();
  const issued = new Map<string, string>();
  return {
    async claim(slotId) {
      if (!safeSlot(slotId) || claimed.has(slotId)) return "exists";
      claimed.add(slotId);
      return "created";
    },
    async putIssue(slotId, body) {
      if (!safeSlot(slotId) || issued.has(slotId)) return "exists";
      issued.set(slotId, body);
      return "created";
    },
    async readIssue(slotId) {
      if (!safeSlot(slotId)) return null;
      return issued.get(slotId) ?? null;
    },
  };
}

const blobPut: ExclusivePut = async (pathname, body, options) => {
  const result = await put(pathname, body, options);
  return { pathname: result.pathname };
};

async function readTokenBlob(pathname: string, token: string): Promise<string | null> {
  try {
    const result = await get(pathname, { access: "private", useCache: false, token });
    if (result == null || result.statusCode !== 200 || !result.stream) return null;
    return await new Response(result.stream).text();
  } catch (error) {
    if (blobMissing(error)) return null;
    throw error;
  }
}

export function createBlobPutAmpelSendTokenStore(blob: {
  put: ExclusivePut;
  read: (pathname: string) => Promise<string | null>;
  remove?: (pathname: string) => Promise<void>;
  token?: string;
}): AmpelSendTokenStore {
  const token = blob.token ?? "";
  const pathname = (slotId: string) => `${PREFIX}/${slotId}`;
  return {
    async claim(slotId, body) {
      if (!safeSlot(slotId)) return "exists";
      return exclusiveBlobCreate({
        pathname: pathname(slotId),
        body,
        token,
        cacheControlMaxAge: AMPEL_RATE_BLOB_CACHE_MAX_AGE,
        put: blob.put,
        read: (path) => blob.read(path),
        remove: blob.remove,
      });
    },
    async putIssue(slotId, body) {
      return this.claim(slotId, body);
    },
    async readIssue(slotId) {
      if (!safeSlot(slotId)) return null;
      return blob.read(pathname(slotId));
    },
  };
}

function blobTokenStore(): AmpelSendTokenStore {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim() ?? "";
  return createBlobPutAmpelSendTokenStore({
    token,
    put: blobPut,
    read: (pathname) => readTokenBlob(pathname, token),
  });
}

function fileTokenStore(): AmpelSendTokenStore {
  const dir = path.join(getFileFallbackDir(), "ampel-send-token");
  const fileFor = (slotId: string) => path.join(dir, ...slotId.split("/"));
  return {
    async claim(slotId, body) {
      if (!safeSlot(slotId)) return "exists";
      const file = fileFor(slotId);
      await mkdir(path.dirname(file), { recursive: true });
      let handle;
      try {
        handle = await open(file, "wx");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "EEXIST") return "exists";
        throw error;
      }
      try {
        await handle.writeFile(body, "utf8");
      } finally {
        await handle.close();
      }
      return "created";
    },
    async putIssue(slotId, body) {
      return this.claim(slotId, body);
    },
    async readIssue(slotId) {
      if (!safeSlot(slotId)) return null;
      try {
        return await readFile(fileFor(slotId), "utf8");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw error;
      }
    },
  };
}

let shared: AmpelSendTokenStore | null = null;

export function ampelSendTokenStore(): AmpelSendTokenStore {
  if (!shared) {
    shared = process.env.BLOB_READ_WRITE_TOKEN?.trim() ? blobTokenStore() : fileTokenStore();
  }
  return shared;
}

export async function issueAmpelSendToken(
  input: { email: string; code: string; now: number; ipSlot: number; emailSlot: number },
  store: AmpelSendTokenStore = ampelSendTokenStore(),
): Promise<string | null> {
  if (!slotInRange(input.ipSlot, AMPEL_IP_LIMIT) || !slotInRange(input.emailSlot, AMPEL_EMAIL_LIMIT)) return null;
  const bound = binding(input.email, input.code);
  const exp = input.now + AMPEL_SEND_TOKEN_TTL_MS;
  const slots = { is: input.ipSlot, es: input.emailSlot };
  if (isMagicLinkConfigured()) {
    const nonce = randomBytes(16).toString("hex");
    const payload = Buffer.from(JSON.stringify({ p: "ampel-send", ...bound, n: nonce, exp, ...slots })).toString("base64url");
    return `v1.${payload}.${sign(payload)}`;
  }
  const secret = randomBytes(32).toString("base64url");
  const slotId = `open/${digest(secret)}`;
  const created = await store.putIssue(slotId, JSON.stringify({ ...bound, exp, ...slots }));
  if (created !== "created") return null;
  return `v0.${secret}`;
}

export type AmpelSendTokenVerdict = "ok" | "invalid" | "mismatch" | "expired" | "reused";

export type AmpelSendTokenResult = {
  verdict: AmpelSendTokenVerdict;
  ipSlot: number;
  emailSlot: number;
};

function refused(verdict: Exclude<AmpelSendTokenVerdict, "ok">): AmpelSendTokenResult {
  return { verdict, ipSlot: 0, emailSlot: 0 };
}

export async function consumeAmpelSendToken(
  input: { token: unknown; email: string; code: string; now: number },
  store: AmpelSendTokenStore = ampelSendTokenStore(),
): Promise<AmpelSendTokenResult> {
  if (!ampelSendTokenPresent(input.token)) return refused("invalid");
  const bound = binding(input.email, input.code);
  if (input.token.startsWith("v1.")) {
    if (!isMagicLinkConfigured()) return refused("invalid");
    const parts = input.token.split(".");
    if (parts.length !== 3) return refused("invalid");
    const payload = parts[1] ?? "";
    const signature = parts[2] ?? "";
    if (!payload || !signaturesMatch(signature, sign(payload))) return refused("invalid");
    let parsed: { p?: string; eh?: string; ah?: string; n?: string; exp?: number; is?: number; es?: number };
    try {
      parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as typeof parsed;
    } catch {
      return refused("invalid");
    }
    if (parsed.p !== "ampel-send" || typeof parsed.n !== "string" || !/^[a-f0-9]{32}$/.test(parsed.n)) return refused("invalid");
    if (!slotInRange(parsed.is ?? NaN, AMPEL_IP_LIMIT) || !slotInRange(parsed.es ?? NaN, AMPEL_EMAIL_LIMIT)) return refused("invalid");
    if (typeof parsed.exp !== "number" || !fresh(parsed.exp, input.now)) return refused("expired");
    if (parsed.eh !== bound.eh || parsed.ah !== bound.ah) return refused("mismatch");
    const claimed = await store.claim(`used/${parsed.n}`, JSON.stringify({ exp: parsed.exp }));
    return claimed === "created"
      ? { verdict: "ok", ipSlot: parsed.is as number, emailSlot: parsed.es as number }
      : refused("reused");
  }
  if (!input.token.startsWith("v0.")) return refused("invalid");
  const secret = input.token.slice(3);
  if (!secret) return refused("invalid");
  const raw = await store.readIssue(`open/${digest(secret)}`);
  const issued = raw ? parseBody(raw) : null;
  if (!issued) return refused("invalid");
  if (!fresh(issued.exp, input.now)) return refused("expired");
  if (issued.eh !== bound.eh || issued.ah !== bound.ah) return refused("mismatch");
  const claimed = await store.claim(`used/${digest(secret)}`, JSON.stringify({ exp: issued.exp }));
  return claimed === "created"
    ? { verdict: "ok", ipSlot: issued.is, emailSlot: issued.es }
    : refused("reused");
}
