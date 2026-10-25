import { createHmac } from "node:crypto";
import { getMagicLinkSecret } from "@/lib/env";

/** Domain separation so this HMAC is not a magic link or a session cookie. */
const PREFIX = "magnet-rate:";

/** Keyed HMAC-SHA256. The sheet stores this hex string. No new env var. */
export function magnetRateHmac(kind: "ip" | "email", value: string): string {
  return createHmac("sha256", getMagicLinkSecret()).update(`${PREFIX}${kind}:${value}`).digest("hex");
}

export function magnetRateKeys(ip: string, email: string, now: number): { ip: string; email: string } {
  return {
    ip: magnetRateHmac("ip", ip ? ip : `none:${now}`),
    email: magnetRateHmac("email", email),
  };
}

/** Log prefix of the IP HMAC. Not a second SHA-256, and not the address. */
export function magnetRateLogPrefix(ip: string): string {
  return magnetRateHmac("ip", ip || "none").slice(0, 12);
}
