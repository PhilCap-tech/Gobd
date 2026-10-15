import { createHmac, timingSafeEqual } from "node:crypto";
import { getMagicLinkSecret } from "@/lib/env";
import { normalizeAmpelEmail } from "@/lib/ampel-score";

/** Signed double-opt-in link lifetime. Same length as the Ampel link. */
export const KANZLEI_DOI_TTL_MS = 48 * 60 * 60 * 1000;

export type KanzleiDoiPayload = {
  purpose: "kanzlei-doi";
  email: string;
  consentAt: string;
  exp: number;
  consentTextVersion: string;
};

export type KanzleiUnsubscribePayload = {
  purpose: "kanzlei-unsubscribe";
  email: string;
  consentAt: string;
};

function signBody(body: string): string {
  return createHmac("sha256", getMagicLinkSecret()).update(body).digest("base64url");
}

function splitToken(token: string): { body: string; signature: string } | null {
  const dot = token.indexOf(".");
  if (dot <= 0 || dot !== token.lastIndexOf(".")) return null;
  const body = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  if (!body || !signature) return null;
  const expected = signBody(body);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  return { body, signature };
}

export function createKanzleiDoiToken(
  input: { email: string; consentAt: string; consentTextVersion: string },
  now = Date.now(),
): string | null {
  const email = normalizeAmpelEmail(input.email);
  const consentAt = input.consentAt.trim();
  const consentTextVersion = input.consentTextVersion.trim();
  if (!email || !Number.isFinite(Date.parse(consentAt)) || !consentTextVersion) return null;
  const payload: KanzleiDoiPayload = {
    purpose: "kanzlei-doi",
    email,
    consentAt,
    exp: now + KANZLEI_DOI_TTL_MS,
    consentTextVersion,
  };
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${body}.${signBody(body)}`;
}

export function verifyKanzleiDoiToken(
  token: string | undefined | null,
  now = Date.now(),
): KanzleiDoiPayload | null {
  if (!token) return null;
  const parts = splitToken(token);
  if (!parts) return null;
  try {
    const parsed = JSON.parse(Buffer.from(parts.body, "base64url").toString("utf8")) as Partial<KanzleiDoiPayload>;
    if (parsed.purpose !== "kanzlei-doi") return null;
    if (typeof parsed.exp !== "number" || !Number.isFinite(parsed.exp) || parsed.exp < now) return null;
    const email = normalizeAmpelEmail(parsed.email);
    const consentAt = typeof parsed.consentAt === "string" ? parsed.consentAt.trim() : "";
    const consentTextVersion =
      typeof parsed.consentTextVersion === "string" ? parsed.consentTextVersion.trim() : "";
    if (!email || !Number.isFinite(Date.parse(consentAt)) || !consentTextVersion) return null;
    return { purpose: "kanzlei-doi", email, consentAt, exp: parsed.exp, consentTextVersion };
  } catch {
    return null;
  }
}

export function createKanzleiUnsubscribeToken(email: string, consentAt: string): string | null {
  const normalized = normalizeAmpelEmail(email);
  const at = consentAt.trim();
  if (!normalized || !Number.isFinite(Date.parse(at))) return null;
  const payload: KanzleiUnsubscribePayload = {
    purpose: "kanzlei-unsubscribe",
    email: normalized,
    consentAt: at,
  };
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${body}.${signBody(body)}`;
}

export function verifyKanzleiUnsubscribeToken(token: string): KanzleiUnsubscribePayload | null {
  const parts = splitToken(token);
  if (!parts) return null;
  try {
    const parsed = JSON.parse(
      Buffer.from(parts.body, "base64url").toString("utf8"),
    ) as Partial<KanzleiUnsubscribePayload>;
    if (parsed.purpose !== "kanzlei-unsubscribe") return null;
    const email = normalizeAmpelEmail(parsed.email);
    const consentAt = typeof parsed.consentAt === "string" ? parsed.consentAt.trim() : "";
    if (!email || !Number.isFinite(Date.parse(consentAt))) return null;
    return { purpose: "kanzlei-unsubscribe", email, consentAt };
  } catch {
    return null;
  }
}
