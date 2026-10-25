import { createHash, randomBytes } from "node:crypto";
import { mkdir, open, readFile } from "node:fs/promises";
import path from "node:path";
import { get, put } from "@vercel/blob";
import { blobAlreadyExists, blobMissing } from "@/lib/ampel-blob-slot";
import { assertLiveWriteAllowed, automatedRunForbidsLiveWrites } from "@/lib/live-write-guard";
import { getFileFallbackDir } from "@/lib/store";

/** 32 bytes, 256 bit. base64url is 43 characters and never contains `.` or `@`. */
const OPAQUE_BYTES = 32;
const DIR_NAME = "mail-link";
const BLOB_PREFIX = "gobd/mail-link";
/** Blob rejects a max-age below 60 seconds. Reads pass `useCache: false`. */
const CACHE_MAX_AGE = 60;

export type MailLinkTokenStore = {
  write(hash: string, body: string): Promise<"created" | "exists">;
  read(hash: string): Promise<string | null>;
};

function hashKey(hash: string): boolean {
  return /^[a-f0-9]{64}$/.test(hash);
}

export function newOpaqueMailLinkToken(): string {
  return randomBytes(OPAQUE_BYTES).toString("base64url");
}

export function isOpaqueMailLinkToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}

/** SHA-256 of the token string. The store key is this hash, never the token. */
export function mailLinkTokenHash(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function invokedAsRepoScript(): boolean {
  return process.argv.some((arg) => /(?:^|[/\\])scripts[/\\]/.test(arg));
}

/**
 * Production requests use the private Blob. Prebuild, postbuild, preview
 * smokes, and anything launched from `scripts/` stay on the local file store
 * so a check cannot write the production Blob.
 */
export function mailLinkTokenStoreKind(): "file" | "blob" {
  if (!process.env.BLOB_READ_WRITE_TOKEN?.trim()) return "file";
  if (automatedRunForbidsLiveWrites()) return "file";
  if (invokedAsRepoScript()) return "file";
  const event = process.env.npm_lifecycle_event ?? "";
  if (event === "postbuild" || event.startsWith("preview")) return "file";
  return "blob";
}

export function mailLinkTokenFilePath(token: string): string | null {
  if (!isOpaqueMailLinkToken(token) || mailLinkTokenStoreKind() !== "file") return null;
  return path.join(getFileFallbackDir(), DIR_NAME, mailLinkTokenHash(token));
}

function fileStore(): MailLinkTokenStore {
  const dir = path.join(getFileFallbackDir(), DIR_NAME);
  return {
    async write(hash, body) {
      if (!hashKey(hash)) return "exists";
      await mkdir(dir, { recursive: true });
      const file = path.join(dir, hash);
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
    async read(hash) {
      if (!hashKey(hash)) return null;
      try {
        return await readFile(path.join(dir, hash), "utf8");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw error;
      }
    },
  };
}

function blobStore(): MailLinkTokenStore {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim() ?? "";
  const pathname = (hash: string) => `${BLOB_PREFIX}/${hash}`;
  return {
    async write(hash, body) {
      if (!hashKey(hash)) return "exists";
      assertLiveWriteAllowed("blob");
      try {
        await put(pathname(hash), body, {
          access: "private",
          addRandomSuffix: false,
          allowOverwrite: false,
          cacheControlMaxAge: CACHE_MAX_AGE,
          contentType: "application/json; charset=utf-8",
          token,
        });
      } catch (error) {
        if (blobAlreadyExists(error)) return "exists";
        throw error;
      }
      return "created";
    },
    async read(hash) {
      if (!hashKey(hash)) return null;
      try {
        const result = await get(pathname(hash), { access: "private", useCache: false, token });
        if (result == null || result.statusCode !== 200 || !result.stream) return null;
        return await new Response(result.stream).text();
      } catch (error) {
        if (blobMissing(error)) return null;
        throw error;
      }
    },
  };
}

let shared: MailLinkTokenStore | null = null;

export function mailLinkTokenStore(): MailLinkTokenStore {
  if (!shared) shared = mailLinkTokenStoreKind() === "blob" ? blobStore() : fileStore();
  return shared;
}

/**
 * Stores the payload under the SHA-256 of `token`. The raw token is refused
 * if it would land in the body. Unsubscribe records omit `exp`.
 */
export async function saveMailLinkToken(token: string, payload: object): Promise<boolean> {
  if (!isOpaqueMailLinkToken(token)) return false;
  const hash = mailLinkTokenHash(token);
  const body = JSON.stringify({ ...payload, hash });
  if (body.includes(token)) return false;
  const written = await mailLinkTokenStore().write(hash, body);
  return written === "created";
}

export async function readMailLinkTokenBody(token: string): Promise<string | null> {
  if (!isOpaqueMailLinkToken(token)) return null;
  return mailLinkTokenStore().read(mailLinkTokenHash(token));
}

export async function loadMailLinkToken(
  token: string,
): Promise<(Record<string, unknown> & { hash: string }) | null> {
  const raw = await readMailLinkTokenBody(token);
  if (!raw || raw.includes(token)) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (parsed.hash !== mailLinkTokenHash(token)) return null;
    return parsed as Record<string, unknown> & { hash: string };
  } catch {
    return null;
  }
}
