import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { BlobNotFoundError, get, put } from "@vercel/blob";
import { normalizeAmpelEmail } from "@/lib/ampel-score";
import { assertLiveWriteAllowed, automatedRunForbidsLiveWrites } from "@/lib/live-write-guard";
import { getFileFallbackDir } from "@/lib/store";

/** How the address was withdrawn. No address is stored. */
export type AmpelSuppressionChannel = "link" | "one-click";

export type AmpelSuppressionRecord = {
  withdrawnAt: string;
  channel: AmpelSuppressionChannel;
};

export type AmpelSuppressionStore = {
  write(key: string, row: AmpelSuppressionRecord): Promise<void>;
  read(key: string): Promise<AmpelSuppressionRecord | null>;
};

const PREFIX = "gobd/ampel-suppression";

/** SHA-256 of the normalized address. The store key is this hash, never the address. */
export function ampelSuppressionKey(email: string): string | null {
  const normalized = normalizeAmpelEmail(email);
  if (!normalized) return null;
  return createHash("sha256").update(normalized).digest("hex");
}

function parseRow(raw: string): AmpelSuppressionRecord | null {
  try {
    const parsed = JSON.parse(raw) as Partial<AmpelSuppressionRecord>;
    if (parsed.channel !== "link" && parsed.channel !== "one-click") return null;
    if (typeof parsed.withdrawnAt !== "string" || !Number.isFinite(Date.parse(parsed.withdrawnAt))) return null;
    return { withdrawnAt: parsed.withdrawnAt, channel: parsed.channel };
  } catch {
    return null;
  }
}

export function createMemoryAmpelSuppressionStore(): AmpelSuppressionStore & {
  raw(): ReadonlyMap<string, AmpelSuppressionRecord>;
} {
  const rows = new Map<string, AmpelSuppressionRecord>();
  return {
    async write(key, row) {
      rows.set(key, { ...row });
    },
    async read(key) {
      const row = rows.get(key);
      return row ? { ...row } : null;
    },
    raw() {
      return rows;
    },
  };
}

function fileStore(): AmpelSuppressionStore {
  const dir = path.join(getFileFallbackDir(), "ampel-suppression");
  return {
    async write(key, row) {
      await mkdir(dir, { recursive: true });
      const file = path.join(dir, `${key}.json`);
      const temp = `${file}.${process.pid}.tmp`;
      await writeFile(temp, JSON.stringify(row));
      await rename(temp, file);
    },
    async read(key) {
      try {
        return parseRow(await readFile(path.join(dir, `${key}.json`), "utf8"));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw error;
      }
    },
  };
}

function blobStore(): AmpelSuppressionStore {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim() ?? "";
  const pathname = (key: string) => `${PREFIX}/${key}.json`;
  return {
    async write(key, row) {
      assertLiveWriteAllowed("blob");
      await put(pathname(key), JSON.stringify(row), {
        access: "private",
        addRandomSuffix: false,
        allowOverwrite: true,
        cacheControlMaxAge: 60,
        contentType: "application/json; charset=utf-8",
        token,
      });
    },
    async read(key) {
      try {
        const result = await get(pathname(key), { access: "private", useCache: false, token });
        if (result == null || result.statusCode !== 200 || !result.stream) return null;
        return parseRow(await new Response(result.stream).text());
      } catch (error) {
        if (error instanceof BlobNotFoundError || (error instanceof Error && error.name === "BlobNotFoundError")) {
          return null;
        }
        throw error;
      }
    },
  };
}

let shared: AmpelSuppressionStore | null = null;
let override: AmpelSuppressionStore | null = null;

/** Isolated store for the prebuild check. Production keeps the file or blob store. */
export function setAmpelSuppressionTestStore(store: AmpelSuppressionStore | null): void {
  override = store;
}

export function ampelSuppressionStore(): AmpelSuppressionStore {
  if (override) return override;
  if (!shared) {
    shared =
      process.env.BLOB_READ_WRITE_TOKEN?.trim() && !automatedRunForbidsLiveWrites()
        ? blobStore()
        : fileStore();
  }
  return shared;
}

export async function readAmpelSuppression(email: string): Promise<AmpelSuppressionRecord | null> {
  const key = ampelSuppressionKey(email);
  if (!key) return null;
  return ampelSuppressionStore().read(key);
}

/**
 * Records a withdrawal. A later call for a consent that is already covered
 * does not move `withdrawnAt` forward, so a one-click retry cannot erase a
 * newer consent. A withdrawal of a newer consent replaces the row.
 */
export async function recordAmpelSuppression(
  email: string,
  input: { withdrawnAt: string; consentAt: string; channel: AmpelSuppressionChannel },
): Promise<void> {
  const key = ampelSuppressionKey(email);
  if (!key) return;
  const existing = await ampelSuppressionStore().read(key);
  if (existing) {
    const coveredUntil = Date.parse(existing.withdrawnAt);
    const consentMs = Date.parse(input.consentAt);
    if (Number.isFinite(coveredUntil) && Number.isFinite(consentMs) && coveredUntil >= consentMs) return;
  }
  await ampelSuppressionStore().write(key, {
    withdrawnAt: input.withdrawnAt,
    channel: input.channel,
  });
}
