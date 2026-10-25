/**
 * Pages where a `token` query value must not reach Google, Meta, or the referrer.
 * Prefixes match the path and anything under it. Trailing slashes are ignored.
 */
export const TOKEN_LANDING_PREFIXES = [
  "/ampel-check/bestaetigen",
  "/ampel-check/abmelden",
  "/kassen-check/bestaetigen",
  "/kassen-check/abmelden",
  "/steuerberater/merkblatt/bestaetigen",
  "/steuerberater/merkblatt/abmelden",
  "/auth/abgelaufen",
  "/auth/invite",
  "/auth/verify",
  "/steuerberater/toolbox/",
  "/vorlagen/bestaetigen",
  "/vorlagen/erneut",
  "/vorlagen/datei",
  "/readiness/success",
  "/api/readiness/",
  "/api/ampel/abmelden",
  "/api/ampel/bestaetigen",
  "/api/kanzlei-merkblatt/abmelden",
  "/api/kanzlei-merkblatt/bestaetigen",
  "/api/kassen-check/bestaetigen",
] as const;

const TOKEN_SEGMENTS = new Set(["bestaetigen", "abmelden"]);
const VORLAGEN_TOKEN_SEGMENTS = new Set(["bestaetigen", "erneut", "datei"]);

export function normalizePathname(pathname: string): string {
  const raw = pathname.split("#")[0]?.split("?")[0]?.trim() ?? "";
  if (!raw) return "";
  const withSlash = raw.startsWith("/") ? raw : `/${raw}`;
  if (withSlash.length > 1 && withSlash.endsWith("/")) return withSlash.slice(0, -1);
  return withSlash;
}

export function matchesTokenPrefix(pathname: string, prefix: string): boolean {
  const path = normalizePathname(pathname);
  const base = normalizePathname(prefix);
  if (!path || !base) return false;
  return path === base || path.startsWith(`${base}/`);
}

/** Token landings, every confirm/unsubscribe path, toolbox, and Vorlagen token actions. */
export function isTokenLandingPath(pathname: string): boolean {
  const path = normalizePathname(pathname);
  if (!path) return false;
  if (TOKEN_LANDING_PREFIXES.some((prefix) => matchesTokenPrefix(path, prefix))) return true;
  const segments = path.split("/").filter(Boolean);
  if (segments.some((segment) => TOKEN_SEGMENTS.has(segment))) return true;
  if (path === "/steuerberater/toolbox" || path.startsWith("/steuerberater/toolbox/")) return true;
  if (
    (path === "/vorlagen" || path.startsWith("/vorlagen/")) &&
    segments.some((segment) => VORLAGEN_TOKEN_SEGMENTS.has(segment))
  ) {
    return true;
  }
  return false;
}

export const TOKEN_REFERRER_POLICY = "no-referrer";

/** Next.js header sources. `:path*` also matches the page itself. */
export function tokenLandingHeaderRules(): Array<{
  source: string;
  headers: Array<{ key: string; value: string }>;
}> {
  const seen = new Set<string>();
  const rules = [];
  for (const prefix of TOKEN_LANDING_PREFIXES) {
    const source = `${normalizePathname(prefix)}/:path*`;
    if (seen.has(source)) continue;
    seen.add(source);
    rules.push({
      source,
      headers: [{ key: "Referrer-Policy", value: TOKEN_REFERRER_POLICY }],
    });
  }
  return rules;
}
