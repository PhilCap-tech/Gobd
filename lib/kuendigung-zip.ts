import { crc32 as nodeCrc } from "node:zlib";
import { emailsEqual } from "@/lib/types";

export type ZipEntry = {
  name: string;
  data: Buffer;
};

export type ZipRole = "owner" | "mitwirkende";

/** ZIP nur für den Kontoinhaber. Mitwirkende und fremde Mails bleiben draußen. */
export function zipDownloadAllowed(input: {
  sessionEmail: string;
  ownerEmail: string;
  role?: ZipRole;
}): boolean {
  if (input.role === "mitwirkende") return false;
  return emailsEqual(input.sessionEmail, input.ownerEmail);
}

export function documentsForOwnerZip<T extends { email: string }>(
  sessionEmail: string,
  rows: readonly T[],
  role: ZipRole = "owner",
): T[] {
  if (role === "mitwirkende") return [];
  return rows.filter((row) =>
    zipDownloadAllowed({
      sessionEmail,
      ownerEmail: row.email,
      role: "owner",
    }),
  );
}

export type ZipPartMeta = {
  name: string;
  crc: number;
  size: number;
  offset: number;
};

/** ZIP-Namen: Ordner und Datei, ohne Steuerzeichen und ohne `..`. */
export function zipEntryName(name: string): string {
  const cleaned = name
    .replace(/\\/g, "/")
    .split("/")
    .filter((part) => part && part !== "." && part !== "..")
    .map((part) => part.replace(/[^\p{L}\p{N}._-]+/gu, "-").replace(/^-|-$/g, ""))
    .filter(Boolean)
    .join("/");
  return cleaned || "dokument";
}

function crc32(data: Buffer): number {
  return nodeCrc(data) >>> 0;
}

function dosTime(date: Date): { time: number; day: number } {
  const year = Math.max(date.getUTCFullYear(), 1980);
  const time =
    (date.getUTCHours() << 11) | (date.getUTCMinutes() << 5) | Math.floor(date.getUTCSeconds() / 2);
  const day = ((year - 1980) << 9) | ((date.getUTCMonth() + 1) << 5) | date.getUTCDate();
  return { time, day };
}

export type ZipEntryPart = {
  local: Buffer;
  data: Buffer;
  name: string;
  crc: number;
  size: number;
};

/**
 * Ein Eintrag als Local-Header plus Nutzdaten.
 * Die Antwort schreibt diese Stücke nacheinander und hält nicht das ganze Archiv.
 */
export function zipEntryParts(entry: ZipEntry, at = new Date()): ZipEntryPart {
  const stamp = dosTime(at);
  const safeName = zipEntryName(entry.name);
  const name = Buffer.from(safeName, "utf8");
  const crc = crc32(entry.data);
  const local = Buffer.alloc(30 + name.length);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0x0800, 6);
  local.writeUInt16LE(0, 8);
  local.writeUInt16LE(stamp.time, 10);
  local.writeUInt16LE(stamp.day, 12);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(entry.data.length, 18);
  local.writeUInt32LE(entry.data.length, 22);
  local.writeUInt16LE(name.length, 26);
  local.writeUInt16LE(0, 28);
  name.copy(local, 30);
  return { local, data: entry.data, name: safeName, crc, size: entry.data.length };
}

/** Central Directory und End-Header, nach den gestreamten Einträgen. */
export function zipCentralDirectory(entries: ZipPartMeta[], at = new Date()): Buffer {
  const stamp = dosTime(at);
  const centrals: Buffer[] = [];
  let directoryOffset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const central = Buffer.alloc(46 + name.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(stamp.time, 12);
    central.writeUInt16LE(stamp.day, 14);
    central.writeUInt32LE(entry.crc, 16);
    central.writeUInt32LE(entry.size, 20);
    central.writeUInt32LE(entry.size, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(entry.offset, 42);
    name.copy(central, 46);
    centrals.push(central);
    directoryOffset = entry.offset + 30 + name.length + entry.size;
  }
  const centralBuf = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(directoryOffset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([centralBuf, end]);
}

/**
 * ZIP mit Methode Store. PDFs und Bilder sind bereits komprimiert;
 * so bleibt das Archiv ohne Zusatzpaket und ohne Deflate-Puffer.
 */
export function buildStoredZip(entries: ZipEntry[], at = new Date()): Buffer {
  const chunks: Buffer[] = [];
  const metas: ZipPartMeta[] = [];
  let offset = 0;
  for (const entry of entries) {
    const part = zipEntryParts(entry, at);
    chunks.push(part.local, part.data);
    metas.push({ name: part.name, crc: part.crc, size: part.size, offset });
    offset += part.local.length + part.data.length;
  }
  chunks.push(zipCentralDirectory(metas, at));
  return Buffer.concat(chunks);
}

export function collectUploadLocators(value: unknown, out: Set<string>): void {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const item of value) collectUploadLocators(item, out);
    return;
  }
  const record = value as Record<string, unknown>;
  const url = record.uploadUrl;
  if (typeof url === "string" && url.trim()) out.add(url.trim());
  for (const child of Object.values(record)) collectUploadLocators(child, out);
}
