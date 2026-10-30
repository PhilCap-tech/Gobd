/**
 * Feature flag "Ampel ohne E-Mail" (Ergebnis ohne E-Mail, Bericht gegen E-Mail).
 *
 * - `AMPEL_NO_EMAIL_ENABLED=1|true` (server-side env) turns it on. Unset or anything else: OFF.
 * - Non-production only (VERCEL_ENV !== "production"): the query param `?ampel_v2=1`
 *   turns it on for that request so a Preview can be tested without touching env vars.
 * - Production ignores the query param completely.
 */

export const AMPEL_V2_QUERY_PARAM = "ampel_v2";

type FlagEnv = Record<string, string | undefined>;

export function ampelNoEmailEnvEnabled(env: FlagEnv = process.env): boolean {
  const raw = (env.AMPEL_NO_EMAIL_ENABLED ?? "").trim().toLowerCase();
  return raw === "1" || raw === "true";
}

export function isProductionDeployment(env: FlagEnv = process.env): boolean {
  return (env.VERCEL_ENV ?? "").trim() === "production";
}

/** True when the request may use the `?ampel_v2=1` override at all. */
export function ampelV2OverrideAllowed(env: FlagEnv = process.env): boolean {
  return !isProductionDeployment(env);
}

function overrideRequested(query: Record<string, string | string[] | undefined> | undefined): boolean {
  if (!query) return false;
  const value = query[AMPEL_V2_QUERY_PARAM];
  const first = Array.isArray(value) ? value[0] : value;
  return first === "1";
}

export function isAmpelNoEmailEnabled(
  query?: Record<string, string | string[] | undefined>,
  env: FlagEnv = process.env,
): boolean {
  if (ampelNoEmailEnvEnabled(env)) return true;
  if (!ampelV2OverrideAllowed(env)) return false;
  return overrideRequested(query);
}

/** Flag-on path: removes `a=` from a search string and keeps every other key. Null when nothing to strip. */
export function stripAnswerCodeFromSearch(search: string): string | null {
  const params = new URLSearchParams(search);
  if (!params.has("a")) return null;
  params.delete("a");
  const rest = params.toString();
  return rest ? `?${rest}` : "";
}
