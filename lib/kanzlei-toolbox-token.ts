import { createHmac, timingSafeEqual } from "node:crypto";
import { getMagicLinkSecret } from "@/lib/env";
import {
  KANZLEI_TOOLBOX_CONSENT_TEXT_VERSION,
  isKanzleiId,
  isKanzleiSlug,
  normalizeCity,
  normalizeKanzleiEmail,
  normalizeKanzleiName,
  normalizeWebsite,
} from "@/lib/kanzlei-toolbox";

export const KANZLEI_TOOLBOX_DOI_TTL_MS = 48 * 60 * 60 * 1000;

export type KanzleiDoiToken = {
  purpose: "kanzlei-toolbox-doi";
  kanzleiId: string;
  slug: string;
  displayName: string;
  website: string;
  email: string;
  city: string;
  consentAt: string;
  consentText: string;
  consentTextVersion: string;
  reportOptIn: boolean;
  exp: number;
};

function sign(body: string): string {
  return createHmac("sha256", getMagicLinkSecret()).update(`kanzlei-toolbox.${body}`).digest("base64url");
}

function pack(payload: object): string {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${body}.${sign(body)}`;
}

function unpack(token: string): unknown | null {
  const dot = token.indexOf(".");
  if (dot <= 0 || dot !== token.lastIndexOf(".")) return null;
  const body = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  const expected = sign(body);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  try {
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as unknown;
  } catch {
    return null;
  }
}

export function createKanzleiDoiToken(input: Omit<KanzleiDoiToken, "purpose" | "exp">, now = Date.now()): string | null {
  if (!isKanzleiId(input.kanzleiId) || !isKanzleiSlug(input.slug)) return null;
  if (!normalizeKanzleiEmail(input.email) || !normalizeKanzleiName(input.displayName)) return null;
  const payload: KanzleiDoiToken = {
    purpose: "kanzlei-toolbox-doi",
    kanzleiId: input.kanzleiId,
    slug: input.slug,
    displayName: input.displayName,
    website: input.website,
    email: input.email,
    city: input.city,
    consentAt: input.consentAt,
    consentText: input.consentText,
    consentTextVersion: input.consentTextVersion || KANZLEI_TOOLBOX_CONSENT_TEXT_VERSION,
    reportOptIn: input.reportOptIn === true,
    exp: now + KANZLEI_TOOLBOX_DOI_TTL_MS,
  };
  return pack(payload);
}

export function verifyKanzleiDoiToken(token: string, now = Date.now()): KanzleiDoiToken | null {
  const parsed = unpack(token) as Partial<KanzleiDoiToken> | null;
  if (!parsed || parsed.purpose !== "kanzlei-toolbox-doi") return null;
  if (typeof parsed.exp !== "number" || parsed.exp < now) return null;
  if (typeof parsed.kanzleiId !== "string" || !isKanzleiId(parsed.kanzleiId)) return null;
  if (typeof parsed.slug !== "string" || !isKanzleiSlug(parsed.slug)) return null;
  const email = normalizeKanzleiEmail(parsed.email);
  const displayName = normalizeKanzleiName(parsed.displayName);
  const website = normalizeWebsite(parsed.website);
  const city = normalizeCity(parsed.city);
  const consentAt = typeof parsed.consentAt === "string" ? parsed.consentAt : "";
  if (!email || !displayName || !website || !city || !Number.isFinite(Date.parse(consentAt))) return null;
  return {
    purpose: "kanzlei-toolbox-doi",
    kanzleiId: parsed.kanzleiId,
    slug: parsed.slug,
    displayName,
    website,
    email,
    city,
    consentAt,
    consentText: typeof parsed.consentText === "string" ? parsed.consentText : "",
    consentTextVersion: typeof parsed.consentTextVersion === "string" ? parsed.consentTextVersion : "",
    reportOptIn: parsed.reportOptIn === true,
    exp: parsed.exp,
  };
}

export function createKanzleiRevokeToken(kanzleiId: string): string | null {
  if (!isKanzleiId(kanzleiId)) return null;
  return pack({ purpose: "kanzlei-toolbox-revoke", kanzleiId });
}

export function verifyKanzleiRevokeToken(token: string): string | null {
  const parsed = unpack(token) as { purpose?: string; kanzleiId?: string } | null;
  if (!parsed || parsed.purpose !== "kanzlei-toolbox-revoke") return null;
  if (typeof parsed.kanzleiId !== "string" || !isKanzleiId(parsed.kanzleiId)) return null;
  return parsed.kanzleiId;
}

export function createKanzleiReportToken(kanzleiId: string): string | null {
  if (!isKanzleiId(kanzleiId)) return null;
  return pack({ purpose: "kanzlei-toolbox-report", kanzleiId });
}

export function verifyKanzleiReportToken(token: string): string | null {
  const parsed = unpack(token) as { purpose?: string; kanzleiId?: string } | null;
  if (!parsed || parsed.purpose !== "kanzlei-toolbox-report") return null;
  if (typeof parsed.kanzleiId !== "string" || !isKanzleiId(parsed.kanzleiId)) return null;
  return parsed.kanzleiId;
}
