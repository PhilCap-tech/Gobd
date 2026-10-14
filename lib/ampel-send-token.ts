import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { mkdir, open, readFile } from "node:fs/promises";
import path from "node:path";
import {
  BlobNotFoundError,
  BlobPreconditionFailedError,
  get,
  put,
} from "@vercel/blob";
import { getMagicLinkSecret, isMagicLinkConfigured } from "@/lib/env";
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
};

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
    return { eh: parsed.eh, ah: parsed.ah, exp: parsed.exp };
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

function blobConflict(error: unknown): boolean {
  if (error instanceof BlobPreconditionFailedError) return true;
  const name = error instanceof Error ? error.name : "";
  if (name === "BlobPreconditionFailedError") return true;
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return message.includes("already exists") || message.includes("precondition");
}

function blobMissing(error: unknown): boolean {
  return error instanceof BlobNotFoundError || (error instanceof Error && error.name === "BlobNotFoundError");
}

function blobTokenStore(): AmpelSendTokenStore {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim() ?? "";
  const pathname = (slotId: string) => `${PREFIX}/${slotId}`;
  return {
    async claim(slotId, body) {
      if (!safeSlot(slotId)) return "exists";
      try {
        await put(pathname(slotId), body, {
          access: "private",
          addRandomSuffix: false,
          allowOverwrite: false,
          cacheControlMaxAge: 60,
          contentType: "application/json; charset=utf-8",
          token,
        });
        return "created";
      } catch (error) {
        if (blobConflict(error)) return "exists";
        throw error;
      }
    },
    async putIssue(slotId, body) {
      return this.claim(slotId, body);
    },
    async readIssue(slotId) {
      if (!safeSlot(slotId)) return null;
      try {
        const result = await get(pathname(slotId), { access: "private", useCache: false, token });
        if (result == null || result.statusCode !== 200 || !result.stream) return null;
        return await new Response(result.stream).text();
      } catch (error) {
        if (blobMissing(error)) return null;
        throw error;
      }
    },
  };
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
  input: { email: string; code: string; now: number },
  store: AmpelSendTokenStore = ampelSendTokenStore(),
): Promise<string | null> {
  const bound = binding(input.email, input.code);
  const exp = input.now + AMPEL_SEND_TOKEN_TTL_MS;
  if (isMagicLinkConfigured()) {
    const nonce = randomBytes(16).toString("hex");
    const payload = Buffer.from(JSON.stringify({ p: "ampel-send", ...bound, n: nonce, exp })).toString("base64url");
    return `v1.${payload}.${sign(payload)}`;
  }
  const secret = randomBytes(32).toString("base64url");
  const slotId = `open/${digest(secret)}`;
  const created = await store.putIssue(slotId, JSON.stringify({ ...bound, exp }));
  if (created !== "created") return null;
  return `v0.${secret}`;
}

export type AmpelSendTokenVerdict = "ok" | "invalid" | "mismatch" | "expired" | "reused";

export async function consumeAmpelSendToken(
  input: { token: unknown; email: string; code: string; now: number },
  store: AmpelSendTokenStore = ampelSendTokenStore(),
): Promise<AmpelSendTokenVerdict> {
  if (typeof input.token !== "string" || input.token.length < 20 || input.token.length > 512) return "invalid";
  const bound = binding(input.email, input.code);
  if (input.token.startsWith("v1.")) {
    if (!isMagicLinkConfigured()) return "invalid";
    const parts = input.token.split(".");
    if (parts.length !== 3) return "invalid";
    const payload = parts[1] ?? "";
    const signature = parts[2] ?? "";
    if (!payload || !signaturesMatch(signature, sign(payload))) return "invalid";
    let parsed: { p?: string; eh?: string; ah?: string; n?: string; exp?: number };
    try {
      parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as typeof parsed;
    } catch {
      return "invalid";
    }
    if (parsed.p !== "ampel-send" || typeof parsed.n !== "string" || !/^[a-f0-9]{32}$/.test(parsed.n)) return "invalid";
    if (typeof parsed.exp !== "number" || !fresh(parsed.exp, input.now)) return "expired";
    if (parsed.eh !== bound.eh || parsed.ah !== bound.ah) return "mismatch";
    const claimed = await store.claim(`used/${parsed.n}`, JSON.stringify({ exp: parsed.exp }));
    return claimed === "created" ? "ok" : "reused";
  }
  if (!input.token.startsWith("v0.")) return "invalid";
  const secret = input.token.slice(3);
  if (!secret) return "invalid";
  const raw = await store.readIssue(`open/${digest(secret)}`);
  const issued = raw ? parseBody(raw) : null;
  if (!issued) return "invalid";
  if (!fresh(issued.exp, input.now)) return "expired";
  if (issued.eh !== bound.eh || issued.ah !== bound.ah) return "mismatch";
  const claimed = await store.claim(`used/${digest(secret)}`, JSON.stringify({ exp: issued.exp }));
  return claimed === "created" ? "ok" : "reused";
}
