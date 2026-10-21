import { createHash, randomBytes } from "node:crypto";

/** Per instance, one minute. The hash stays in this map and is never stored. */
export const AMPEL_STEP_RATE_LIMIT = 60;
export const AMPEL_STEP_RATE_WINDOW_MS = 60_000;

const salt = randomBytes(16);

type Bucket = { windowStart: number; count: number };

const buckets = new Map<string, Bucket>();

function bucketKey(ip: string): string {
  return createHash("sha256").update(salt).update(ip).digest("hex");
}

export function clearAmpelStepRateForTest(): void {
  buckets.clear();
}

/**
 * Allows the event when the address is under the limit.
 * An empty address is not hashed and is not limited.
 * Expired windows are dropped here. The address and the hash are not logged.
 */
export function takeAmpelStepRate(ip: string, now = Date.now()): boolean {
  for (const [key, bucket] of buckets) {
    if (now - bucket.windowStart >= AMPEL_STEP_RATE_WINDOW_MS) buckets.delete(key);
  }
  const trimmed = ip.trim();
  if (!trimmed || trimmed.toLowerCase() === "unknown") return true;
  const key = bucketKey(trimmed);
  const current = buckets.get(key);
  if (!current || now - current.windowStart >= AMPEL_STEP_RATE_WINDOW_MS) {
    buckets.set(key, { windowStart: now, count: 1 });
    return true;
  }
  if (current.count >= AMPEL_STEP_RATE_LIMIT) return false;
  current.count += 1;
  return true;
}
