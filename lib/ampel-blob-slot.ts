import { BlobNotFoundError, BlobUnknownError } from "@vercel/blob";

/**
 * Options for one exclusive slot. `addRandomSuffix` must stay false: the Blob
 * default appends a new pathname, `allowOverwrite: false` never sees a conflict,
 * and every slot looks free.
 */
export const AMPEL_EXCLUSIVE_PUT = {
  access: "private" as const,
  addRandomSuffix: false as const,
  allowOverwrite: false as const,
  contentType: "application/json; charset=utf-8",
};

export type ExclusivePutOptions = {
  access: "private";
  addRandomSuffix: false;
  allowOverwrite: false;
  cacheControlMaxAge: number;
  contentType: string;
  token?: string;
};

export type ExclusivePut = (
  pathname: string,
  body: string,
  options: ExclusivePutOptions,
) => Promise<{ pathname: string }>;

/** Only an existing pathname is occupied. ETag and other failures are not. */
export function blobAlreadyExists(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return message.includes("already exists");
}

export function blobMissing(error: unknown): boolean {
  if (error instanceof BlobNotFoundError) return true;
  const name = error instanceof Error ? error.constructor?.name ?? error.name : "";
  return name === "BlobNotFoundError";
}

function blobUnknown(error: unknown): boolean {
  if (error instanceof BlobUnknownError) return true;
  const name = error instanceof Error ? error.constructor?.name ?? error.name : "";
  return name === "BlobUnknownError";
}

async function readSlot(
  read: (pathname: string) => Promise<string | null>,
  pathname: string,
): Promise<string | null> {
  try {
    return await read(pathname);
  } catch (error) {
    if (blobMissing(error)) return null;
    throw error;
  }
}

/**
 * Conditional create of one write-once slot.
 *
 * A 2xx from `put` is not a claim. Until the pathname is indexed, Blob returns
 * 200 with the same pathname and can replace the bytes; the SDK does not look
 * at the body. Reading only after that put then sees this request's bytes, or
 * nothing (CDN, fetch cache, or a per-lambda miss), and the slot is taken
 * again. Prod kept `x-ampel-rl` at `slot=1` for that reason.
 *
 * The no-cache read happens first. Bytes already stored mean the slot is
 * taken, so this request must not put over them. After a 2xx, the same read
 * has to return these exact bytes. A miss or a thrown read is
 * `ampel-blob-unconfirmed`: the caller logs it and sends no mail.
 *
 * API code `blob_already_exists` arrives as `BlobUnknownError` with the
 * message dropped. That pathname is occupied even when the follow-up read
 * misses — a hidden write is not a free slot. A read that throws
 * `BlobNotFoundError` means the error was not "already exists"; that still
 * fails closed. Any other put error is rethrown (fail closed).
 */
export async function exclusiveBlobCreate(input: {
  pathname: string;
  body: string;
  token: string;
  cacheControlMaxAge: number;
  put: ExclusivePut;
  read: (pathname: string) => Promise<string | null>;
  remove?: (pathname: string) => Promise<void>;
}): Promise<"created" | "exists"> {
  const prior = await readSlot(input.read, input.pathname);
  if (typeof prior === "string") return "exists";

  try {
    const result = await input.put(input.pathname, input.body, {
      ...AMPEL_EXCLUSIVE_PUT,
      cacheControlMaxAge: input.cacheControlMaxAge,
      token: input.token,
    });
    if (result.pathname !== input.pathname) {
      if (input.remove && result.pathname) {
        try {
          await input.remove(result.pathname);
        } catch {
          // The suffixed object is not a slot. The request still sends no mail.
        }
      }
      throw new Error("ampel-blob-suffix");
    }
    const stored = await readSlot(input.read, input.pathname);
    if (stored === input.body) return "created";
    if (typeof stored === "string") return "exists";
    throw new Error("ampel-blob-unconfirmed");
  } catch (error) {
    if (blobAlreadyExists(error)) return "exists";
    if (blobUnknown(error)) {
      try {
        const existing = await input.read(input.pathname);
        if (typeof existing === "string") return "exists";
      } catch (readError) {
        if (blobMissing(readError)) throw error;
        return "exists";
      }
      // Null is not proof of absence. The conflict error is the proof.
      return "exists";
    }
    throw error;
  }
}
