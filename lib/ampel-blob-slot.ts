import { BlobNotFoundError, BlobUnknownError } from "@vercel/blob";
import { logAmpelRateFailure } from "@/lib/ampel-rate-limit";

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
 * A 2xx from `put` is not proof of a new object. Until the pathname is
 * indexed, Blob returns 200 with the same pathname and can replace the bytes.
 * The no-cache read runs first. Bytes already stored mean the slot is taken,
 * so this request does not write over them.
 *
 * After a 2xx, the same read must return these exact bytes to count as
 * `created`. A miss or a thrown confirming read is `unconfirmed`: the slot is
 * not proven, the failure is logged, and the caller still sends the mail.
 * Any other put or read error is rethrown for the same fail-open decision.
 * A 429 happens only when every slot 1..N is proven taken.
 *
 * API code `blob_already_exists` arrives as `BlobUnknownError` with the
 * message dropped. That pathname is occupied even when the follow-up read
 * misses. A read that throws `BlobNotFoundError` is not that proof.
 */
export async function exclusiveBlobCreate(input: {
  pathname: string;
  body: string;
  token: string;
  cacheControlMaxAge: number;
  put: ExclusivePut;
  read: (pathname: string) => Promise<string | null>;
  remove?: (pathname: string) => Promise<void>;
}): Promise<"created" | "exists" | "unconfirmed"> {
  const prior = await readSlot(input.read, input.pathname);
  if (typeof prior === "string") return "exists";

  let result: { pathname: string };
  try {
    result = await input.put(input.pathname, input.body, {
      ...AMPEL_EXCLUSIVE_PUT,
      cacheControlMaxAge: input.cacheControlMaxAge,
      token: input.token,
    });
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
  if (result.pathname !== input.pathname) {
    if (input.remove && result.pathname) {
      try {
        await input.remove(result.pathname);
      } catch {
        // The suffixed object is not a slot. The mail still goes out.
      }
    }
    throw new Error("ampel-blob-suffix");
  }
  try {
    const stored = await readSlot(input.read, input.pathname);
    if (stored === input.body) return "created";
    if (typeof stored === "string") return "exists";
    logAmpelRateFailure("confirm-miss");
    return "unconfirmed";
  } catch (error) {
    logAmpelRateFailure("confirm-read", error);
    return "unconfirmed";
  }
}
