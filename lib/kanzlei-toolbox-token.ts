import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/** 256-bit link secret. Random, not JSON, and it contains no address. */
export function createKanzleiLinkSecret(): string {
  return randomBytes(32).toString("base64url");
}

/** base64url of 32 bytes, without padding or a signature dot. */
export function kanzleiLinkSecretShape(token: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}

export function hashKanzleiToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function hashKanzleiReportToken(token: string): string {
  return hashKanzleiToken(token);
}

export function kanzleiTokenHashEquals(stored: string, actual: string): boolean {
  if (!/^[a-f0-9]{64}$/.test(stored) || !/^[a-f0-9]{64}$/.test(actual)) return false;
  return timingSafeEqual(Buffer.from(stored, "utf8"), Buffer.from(actual, "utf8"));
}

export function kanzleiReportHashEquals(stored: string, actual: string): boolean {
  return kanzleiTokenHashEquals(stored, actual);
}

/** Fresh report secret. Only its hash is stored. */
export function createKanzleiReportSecret(): string {
  return createKanzleiLinkSecret();
}
