import { createHmac, timingSafeEqual } from "node:crypto";
import { getMagicLinkSecret } from "@/lib/env";
import { normalizeAmpelEmail } from "@/lib/ampel-score";
import { KANZLEI_DOI_HOURS } from "@/lib/kanzlei-copy";
import {
  loadMailLinkToken,
  newOpaqueMailLinkToken,
  saveMailLinkToken,
} from "@/lib/mail-link-token-store";

/** Signed double-opt-in link lifetime. Same length as the Ampel link. */
export const KANZLEI_DOI_TTL_MS = KANZLEI_DOI_HOURS * 60 * 60 * 1000;

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

type KanzleiDoiInput = { email: string; consentAt: string; consentTextVersion: string };

function signBody(body: string): string {
  return createHmac("sha256", getMagicLinkSecret()).update(body).digest("base64url");
}

function legacySigned(payload: object): string {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${body}.${signBody(body)}`;
}

function legacyBody(token: string): string | null {
  const dot = token.indexOf(".");
  if (dot <= 0 || dot !== token.lastIndexOf(".")) return null;
  const body = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  if (!body || !signature) return null;
  const expected = signBody(body);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  return body;
}

function kanzleiDoiPayload(input: KanzleiDoiInput, now: number): KanzleiDoiPayload | null {
  const email = normalizeAmpelEmail(input.email);
  const consentAt = input.consentAt.trim();
  const consentTextVersion = input.consentTextVersion.trim();
  if (!email || !Number.isFinite(Date.parse(consentAt)) || !consentTextVersion) return null;
  return {
    purpose: "kanzlei-doi",
    email,
    consentAt,
    exp: now + KANZLEI_DOI_TTL_MS,
    consentTextVersion,
  };
}

function kanzleiDoiFromParsed(parsed: Partial<KanzleiDoiPayload>, now: number): KanzleiDoiPayload | null {
  if (parsed.purpose !== "kanzlei-doi") return null;
  if (typeof parsed.exp !== "number" || !Number.isFinite(parsed.exp) || parsed.exp < now) return null;
  const email = normalizeAmpelEmail(parsed.email);
  const consentAt = typeof parsed.consentAt === "string" ? parsed.consentAt.trim() : "";
  const consentTextVersion =
    typeof parsed.consentTextVersion === "string" ? parsed.consentTextVersion.trim() : "";
  if (!email || !Number.isFinite(Date.parse(consentAt)) || !consentTextVersion) return null;
  return { purpose: "kanzlei-doi", email, consentAt, exp: parsed.exp, consentTextVersion };
}

function kanzleiUnsubscribePayload(email: string, consentAt: string): KanzleiUnsubscribePayload | null {
  const normalized = normalizeAmpelEmail(email);
  const at = consentAt.trim();
  if (!normalized || !Number.isFinite(Date.parse(at))) return null;
  return { purpose: "kanzlei-unsubscribe", email: normalized, consentAt: at };
}

function kanzleiUnsubscribeFromParsed(parsed: Partial<KanzleiUnsubscribePayload>): KanzleiUnsubscribePayload | null {
  if (parsed.purpose !== "kanzlei-unsubscribe") return null;
  const email = normalizeAmpelEmail(parsed.email);
  const consentAt = typeof parsed.consentAt === "string" ? parsed.consentAt.trim() : "";
  if (!email || !Number.isFinite(Date.parse(consentAt))) return null;
  return { purpose: "kanzlei-unsubscribe", email, consentAt };
}

/** Signed DOI link already sent. New mail uses `createKanzleiDoiToken`. */
export function legacyKanzleiDoiToken(input: KanzleiDoiInput, now = Date.now()): string | null {
  const payload = kanzleiDoiPayload(input, now);
  if (!payload) return null;
  return legacySigned(payload);
}

/** Opaque id. The address stays in the private store. The link expires after 48 hours. */
export async function createKanzleiDoiToken(input: KanzleiDoiInput, now = Date.now()): Promise<string | null> {
  const payload = kanzleiDoiPayload(input, now);
  if (!payload) return null;
  const token = newOpaqueMailLinkToken();
  const saved = await saveMailLinkToken(token, payload);
  return saved ? token : null;
}

export async function verifyKanzleiDoiToken(
  token: string | undefined | null,
  now = Date.now(),
): Promise<KanzleiDoiPayload | null> {
  if (!token) return null;
  if (token.includes(".")) {
    const body = legacyBody(token);
    if (!body) return null;
    try {
      return kanzleiDoiFromParsed(
        JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Partial<KanzleiDoiPayload>,
        now,
      );
    } catch {
      return null;
    }
  }
  const record = await loadMailLinkToken(token);
  if (!record || record.purpose !== "kanzlei-doi") return null;
  return kanzleiDoiFromParsed(record as Partial<KanzleiDoiPayload>, now);
}

/** Signed unsubscribe link already sent. It has no expiry. */
export function legacyKanzleiUnsubscribeToken(email: string, consentAt: string): string | null {
  const payload = kanzleiUnsubscribePayload(email, consentAt);
  if (!payload) return null;
  return legacySigned(payload);
}

/** Opaque id stored with the address and consent time, and no expiry. */
export async function createKanzleiUnsubscribeToken(email: string, consentAt: string): Promise<string | null> {
  const payload = kanzleiUnsubscribePayload(email, consentAt);
  if (!payload) return null;
  const token = newOpaqueMailLinkToken();
  const saved = await saveMailLinkToken(token, payload);
  return saved ? token : null;
}

export async function verifyKanzleiUnsubscribeToken(token: string): Promise<KanzleiUnsubscribePayload | null> {
  if (!token) return null;
  if (token.includes(".")) {
    const body = legacyBody(token);
    if (!body) return null;
    try {
      return kanzleiUnsubscribeFromParsed(
        JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Partial<KanzleiUnsubscribePayload>,
      );
    } catch {
      return null;
    }
  }
  const record = await loadMailLinkToken(token);
  if (!record) return null;
  return kanzleiUnsubscribeFromParsed(record as Partial<KanzleiUnsubscribePayload>);
}
