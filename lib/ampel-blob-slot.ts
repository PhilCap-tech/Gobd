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

/**
 * Conditional create. `@vercel/blob` turns API code `blob_already_exists` into
 * `BlobUnknownError` and drops the message, so that case is occupied only when
 * the pathname is already stored. Any other put error is rethrown (fail closed).
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
    // A 2xx with the same pathname is not proof of a new object. @vercel/blob
    // returns that whenever the API responds 2xx; it does not check the body.
    // If the stored bytes are someone else's, the pathname was already taken.
    let stored: string | null | undefined;
    try {
      stored = await input.read(input.pathname);
    } catch {
      stored = undefined;
    }
    if (typeof stored === "string" && stored !== input.body) return "exists";
    return "created";
  } catch (error) {
    if (blobAlreadyExists(error)) return "exists";
    if (blobUnknown(error)) {
      try {
        const existing = await input.read(input.pathname);
        if (existing != null) return "exists";
      } catch (readError) {
        if (!blobMissing(readError)) throw error;
      }
    }
    throw error;
  }
}
