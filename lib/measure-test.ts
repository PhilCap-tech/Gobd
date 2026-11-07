/**
 * Verified test signals for Messlücken. These leave the standard counts
 * and are stored only as the cohort `test`.
 *
 * Addresses: gobd-test@mail.grokbot.com, gobd-test+<tag>@mail.grokbot.com
 * (tag is [a-z0-9-]+), any local part at resend.dev, and cappe@gmx.de.
 * Referrer host grokbot.com (and its subdomains) is a test signal.
 * There is no IP or user-agent allowlist in this repo. A generic bot
 * user-agent is not a test signal.
 */

const GROK_PLUS = /^gobd-test\+[a-z0-9-]+@mail\.grokbot\.com$/;

export function isMeasureTestEmail(email: string | null | undefined): boolean {
  const value = (email ?? "").trim().toLowerCase();
  if (!value || value.includes(" ")) return false;
  if (value === "gobd-test@mail.grokbot.com") return true;
  if (GROK_PLUS.test(value)) return true;
  if (value === "cappe@gmx.de") return true;
  const at = value.lastIndexOf("@");
  if (at <= 0 || at !== value.indexOf("@")) return false;
  return value.slice(at + 1) === "resend.dev";
}

export function referrerHostname(referrer: string | null | undefined): string {
  const raw = (referrer ?? "").trim();
  if (!raw) return "";
  try {
    return new URL(raw).hostname.toLowerCase().replace(/\.$/, "");
  } catch {
    return "";
  }
}

export function isMeasureTestReferrer(referrer: string | null | undefined): boolean {
  const host = referrerHostname(referrer);
  return host === "grokbot.com" || host.endsWith(".grokbot.com");
}

/**
 * No agent IP or user-agent allowlist is configured. Always false.
 * Callers pass the values so a future allowlist has one place to grow.
 */
export function measureTestFromAgent(input: { ip?: string | null; userAgent?: string | null }): boolean {
  void input.ip;
  void input.userAgent;
  return false;
}

export function isMeasureTestSignal(signal: unknown): boolean {
  return signal === "grokbot";
}

/**
 * `?gobd_test=1` on the event request, or the same flag forwarded in that
 * request body. Any other value is ignored. The flag can only mark a test.
 */
export function isExplicitTestMarker(value: unknown): boolean {
  return value === "1" || value === 1 || value === true;
}

export function searchHasExplicitTest(search: string | null | undefined): boolean {
  const raw = search ?? "";
  const params = new URLSearchParams(raw.startsWith("?") ? raw.slice(1) : raw);
  return params.get("gobd_test") === "1";
}

export function referrerHasExplicitTest(referrer: string | null | undefined): boolean {
  const raw = (referrer ?? "").trim();
  if (!raw) return false;
  try {
    return searchHasExplicitTest(new URL(raw).search);
  } catch {
    return false;
  }
}

const UNSET_ENV = Symbol("measure-vercel-env");
let vercelEnvOverride: string | undefined | typeof UNSET_ENV = UNSET_ENV;

/** Checks pass `null` to read `VERCEL_ENV` again. No new environment variable. */
export function setMeasureVercelEnvForTest(value: string | undefined | null): void {
  vercelEnvOverride = value === null ? UNSET_ENV : value;
}

export function measureVercelEnv(): string | undefined {
  if (vercelEnvOverride !== UNSET_ENV) return vercelEnvOverride || undefined;
  const env = process.env.VERCEL_ENV?.trim();
  return env || undefined;
}

export function isProductionMeasureEnv(vercelEnv: string | undefined = measureVercelEnv()): boolean {
  return vercelEnv === "production";
}

export function measureCohort(input: {
  vercelEnv?: string | undefined;
  email?: string | null;
  referrer?: string | null;
  signal?: unknown;
  gobdTest?: unknown;
  ip?: string | null;
  userAgent?: string | null;
}): "standard" | "test" {
  const env = "vercelEnv" in input ? input.vercelEnv : measureVercelEnv();
  if (env !== "production") return "test";
  if (isExplicitTestMarker(input.gobdTest) || referrerHasExplicitTest(input.referrer)) return "test";
  if (isMeasureTestEmail(input.email)) return "test";
  if (isMeasureTestReferrer(input.referrer)) return "test";
  if (isMeasureTestSignal(input.signal)) return "test";
  if (measureTestFromAgent({ ip: input.ip, userAgent: input.userAgent })) return "test";
  return "standard";
}
