import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { MAGNET_DOWNLOAD_TTL_MS } from "@/lib/vorlagen/ids";

/** 256-bit id. The mail link carries this and nothing else. */
const TOKEN_BYTES = 32;

export const MAGNET_LINK_PURPOSES = ["doi", "download", "marketing", "unsubscribe"] as const;
export type MagnetLinkPurpose = (typeof MAGNET_LINK_PURPOSES)[number];

type MagnetLinkEntry = { h: string; exp: number };
type MagnetLinkSet = Record<MagnetLinkPurpose, MagnetLinkEntry[]>;

export type MagnetLinkMatch = {
  purpose: MagnetLinkPurpose;
  exp: number;
  expired: boolean;
};

const HASH = /^[a-f0-9]{64}$/;
const MAX_PER_PURPOSE = 30;

export function downloadExpiry(confirmedAtMs: number): number {
  return confirmedAtMs + MAGNET_DOWNLOAD_TTL_MS;
}

export function opaqueMagnetToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

/** Shape only. The id is not decoded and not looked up. */
export function looksLikeMagnetToken(token: string): boolean {
  return token.length >= 22 && token.length <= 128 && /^[A-Za-z0-9_-]+$/.test(token);
}

/** SHA-256 of the opaque id. The raw id is not stored. */
export function hashMagnetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function emptySet(): MagnetLinkSet {
  return { doi: [], download: [], marketing: [], unsubscribe: [] };
}

function parseLinks(raw: string): MagnetLinkSet {
  const links = emptySet();
  if (!raw.trim()) return links;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return emptySet();
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return emptySet();
  const record = parsed as Record<string, unknown>;
  for (const purpose of MAGNET_LINK_PURPOSES) {
    const list = record[purpose];
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      if (!item || typeof item !== "object" || Array.isArray(item)) continue;
      const entry = item as { h?: unknown; exp?: unknown };
      if (typeof entry.h !== "string" || !HASH.test(entry.h)) continue;
      if (typeof entry.exp !== "number" || !Number.isFinite(entry.exp) || entry.exp < 0) continue;
      links[purpose].push({ h: entry.h, exp: entry.exp });
    }
  }
  return links;
}

function sameHash(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function issueMagnetLink(
  linkJson: string,
  purpose: MagnetLinkPurpose,
  exp: number,
): { linkJson: string; token: string } | null {
  if (purpose === "unsubscribe") {
    if (exp !== 0) return null;
  } else if (!Number.isFinite(exp) || exp <= 0) {
    return null;
  }
  const token = opaqueMagnetToken();
  const links = parseLinks(linkJson);
  const list = links[purpose];
  list.push({ h: hashMagnetToken(token), exp });
  if (list.length > MAX_PER_PURPOSE) list.splice(0, list.length - MAX_PER_PURPOSE);
  return { linkJson: JSON.stringify(links), token };
}

export function matchMagnetLink(linkJson: string, token: string, now: number): MagnetLinkMatch | null {
  if (!token || token.length > 128) return null;
  const digest = hashMagnetToken(token);
  const links = parseLinks(linkJson);
  let found: MagnetLinkMatch | null = null;
  for (const purpose of MAGNET_LINK_PURPOSES) {
    for (const entry of links[purpose]) {
      if (!sameHash(entry.h, digest)) continue;
      found = { purpose, exp: entry.exp, expired: entry.exp > 0 && entry.exp < now };
    }
  }
  return found;
}

export function magnetLinkHasHash(linkJson: string, hash: string): boolean {
  if (!HASH.test(hash)) return false;
  const links = parseLinks(linkJson);
  let found = false;
  for (const purpose of MAGNET_LINK_PURPOSES) {
    for (const entry of links[purpose]) {
      if (sameHash(entry.h, hash)) found = true;
    }
  }
  return found;
}
