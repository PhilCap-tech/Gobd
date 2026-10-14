import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { BlobNotFoundError, get, put } from "@vercel/blob";
import { assertLiveWriteAllowed, automatedRunForbidsLiveWrites } from "@/lib/live-write-guard";
import { getFileFallbackDir } from "@/lib/store";

export type AmpelMailStatusState = "sending" | "sent" | "failed";

export type AmpelMailStatusRow = {
  state: AmpelMailStatusState;
  notice: string;
};

export type AmpelMailStatusStore = {
  write(key: string, row: AmpelMailStatusRow): Promise<void>;
  read(key: string): Promise<AmpelMailStatusRow | null>;
};

const PREFIX = "gobd/ampel-mail-status";

export function ampelMailStatusId(email: string, code: string): string {
  return createHash("sha256").update(`${email}\n${code}`).digest("hex").slice(0, 32);
}

function parseRow(raw: string): AmpelMailStatusRow | null {
  try {
    const parsed = JSON.parse(raw) as Partial<AmpelMailStatusRow>;
    if (parsed.state !== "sending" && parsed.state !== "sent" && parsed.state !== "failed") return null;
    if (typeof parsed.notice !== "string") return null;
    return { state: parsed.state, notice: parsed.notice };
  } catch {
    return null;
  }
}

export function createMemoryAmpelMailStatusStore(): AmpelMailStatusStore {
  const rows = new Map<string, AmpelMailStatusRow>();
  return {
    async write(key, row) {
      rows.set(key, { ...row });
    },
    async read(key) {
      const row = rows.get(key);
      return row ? { ...row } : null;
    },
  };
}

function fileStore(): AmpelMailStatusStore {
  const dir = path.join(getFileFallbackDir(), "ampel-mail-status");
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

function blobStore(): AmpelMailStatusStore {
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

let shared: AmpelMailStatusStore | null = null;

export function ampelMailStatusStore(): AmpelMailStatusStore {
  if (!shared) {
    shared =
      process.env.BLOB_READ_WRITE_TOKEN?.trim() && !automatedRunForbidsLiveWrites()
        ? blobStore()
        : fileStore();
  }
  return shared;
}
