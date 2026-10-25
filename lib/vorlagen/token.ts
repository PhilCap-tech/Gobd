import { createHmac, timingSafeEqual } from "node:crypto";
import { getMagicLinkSecret } from "@/lib/env";
import { normalizeAmpelEmail } from "@/lib/ampel-score";
import { MAGNET_DOI_TTL_MS, MAGNET_DOWNLOAD_TTL_MS, isMagnetId, type MagnetId } from "@/lib/vorlagen/ids";

export type MagnetDoiPayload = {
  purpose: "magnet-doi";
  leadId: string;
  email: string;
  magnet: MagnetId;
  exp: number;
};

export type MagnetDownloadPayload = {
  purpose: "magnet-download";
  leadId: string;
  email: string;
  magnet: MagnetId;
  exp: number;
};

export type MagnetMarketingPayload = {
  purpose: "magnet-marketing";
  leadId: string;
  email: string;
  magnet: MagnetId;
  consentAt: string;
  consentTextVersion: string;
  exp: number;
};

export type MagnetUnsubscribePayload = {
  purpose: "magnet-unsubscribe";
  leadId: string;
  email: string;
  consentAt: string;
};

const LEAD_ID = /^mg_[A-Za-z0-9_-]{16,80}$/;

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

function encode(payload: unknown): string {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${body}.${signBody(body)}`;
}

function decode(token: string): unknown | null {
  const parts = splitToken(token);
  if (!parts) return null;
  try {
    return JSON.parse(Buffer.from(parts.body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

function leadId(value: unknown): string {
  return typeof value === "string" && LEAD_ID.test(value) ? value : "";
}

export function createMagnetDoiToken(
  input: { leadId: string; email: string; magnet: MagnetId },
  now = Date.now(),
): string | null {
  const email = normalizeAmpelEmail(input.email);
  if (!email || !leadId(input.leadId) || !isMagnetId(input.magnet)) return null;
  const payload: MagnetDoiPayload = {
    purpose: "magnet-doi",
    leadId: input.leadId,
    email,
    magnet: input.magnet,
    exp: now + MAGNET_DOI_TTL_MS,
  };
  return encode(payload);
}

export function readMagnetDoiToken(
  token: string | undefined | null,
  now = Date.now(),
): { payload: MagnetDoiPayload; expired: boolean } | null {
  if (!token) return null;
  const parsed = decode(token) as Partial<MagnetDoiPayload> | null;
  if (!parsed || parsed.purpose !== "magnet-doi") return null;
  if (typeof parsed.exp !== "number" || !Number.isFinite(parsed.exp)) return null;
  const email = normalizeAmpelEmail(parsed.email);
  const id = leadId(parsed.leadId);
  if (!email || !id || !isMagnetId(parsed.magnet)) return null;
  return {
    payload: {
      purpose: "magnet-doi",
      leadId: id,
      email,
      magnet: parsed.magnet,
      exp: parsed.exp,
    },
    expired: parsed.exp < now,
  };
}

export function verifyMagnetDoiToken(token: string | undefined | null, now = Date.now()): MagnetDoiPayload | null {
  const read = readMagnetDoiToken(token, now);
  if (!read || read.expired) return null;
  return read.payload;
}

export function createMagnetDownloadToken(
  input: { leadId: string; email: string; magnet: MagnetId; exp: number },
): string | null {
  const email = normalizeAmpelEmail(input.email);
  if (!email || !leadId(input.leadId) || !isMagnetId(input.magnet)) return null;
  if (!Number.isFinite(input.exp)) return null;
  const payload: MagnetDownloadPayload = {
    purpose: "magnet-download",
    leadId: input.leadId,
    email,
    magnet: input.magnet,
    exp: input.exp,
  };
  return encode(payload);
}

export function readMagnetDownloadToken(
  token: string | undefined | null,
  now = Date.now(),
): { payload: MagnetDownloadPayload; expired: boolean } | null {
  if (!token) return null;
  const parsed = decode(token) as Partial<MagnetDownloadPayload> | null;
  if (!parsed || parsed.purpose !== "magnet-download") return null;
  if (typeof parsed.exp !== "number" || !Number.isFinite(parsed.exp)) return null;
  const email = normalizeAmpelEmail(parsed.email);
  const id = leadId(parsed.leadId);
  if (!email || !id || !isMagnetId(parsed.magnet)) return null;
  return {
    payload: {
      purpose: "magnet-download",
      leadId: id,
      email,
      magnet: parsed.magnet,
      exp: parsed.exp,
    },
    expired: parsed.exp < now,
  };
}

export function createMagnetMarketingToken(
  input: { leadId: string; email: string; magnet: MagnetId; consentAt: string; consentTextVersion: string },
  now = Date.now(),
): string | null {
  const email = normalizeAmpelEmail(input.email);
  const consentAt = input.consentAt.trim();
  const consentTextVersion = input.consentTextVersion.trim();
  if (!email || !leadId(input.leadId) || !isMagnetId(input.magnet)) return null;
  if (!Number.isFinite(Date.parse(consentAt)) || !consentTextVersion) return null;
  const payload: MagnetMarketingPayload = {
    purpose: "magnet-marketing",
    leadId: input.leadId,
    email,
    magnet: input.magnet,
    consentAt,
    consentTextVersion,
    exp: now + MAGNET_DOI_TTL_MS,
  };
  return encode(payload);
}

export function verifyMagnetMarketingToken(
  token: string | undefined | null,
  now = Date.now(),
): MagnetMarketingPayload | null {
  if (!token) return null;
  const parsed = decode(token) as Partial<MagnetMarketingPayload> | null;
  if (!parsed || parsed.purpose !== "magnet-marketing") return null;
  if (typeof parsed.exp !== "number" || !Number.isFinite(parsed.exp) || parsed.exp < now) return null;
  const email = normalizeAmpelEmail(parsed.email);
  const id = leadId(parsed.leadId);
  const consentAt = typeof parsed.consentAt === "string" ? parsed.consentAt.trim() : "";
  const consentTextVersion = typeof parsed.consentTextVersion === "string" ? parsed.consentTextVersion.trim() : "";
  if (!email || !id || !isMagnetId(parsed.magnet)) return null;
  if (!Number.isFinite(Date.parse(consentAt)) || !consentTextVersion) return null;
  return {
    purpose: "magnet-marketing",
    leadId: id,
    email,
    magnet: parsed.magnet,
    consentAt,
    consentTextVersion,
    exp: parsed.exp,
  };
}

export function createMagnetUnsubscribeToken(input: {
  leadId: string;
  email: string;
  consentAt: string;
}): string | null {
  const email = normalizeAmpelEmail(input.email);
  const consentAt = input.consentAt.trim();
  if (!email || !leadId(input.leadId) || !Number.isFinite(Date.parse(consentAt))) return null;
  const payload: MagnetUnsubscribePayload = {
    purpose: "magnet-unsubscribe",
    leadId: input.leadId,
    email,
    consentAt,
  };
  return encode(payload);
}

export function verifyMagnetUnsubscribeToken(token: string | undefined | null): MagnetUnsubscribePayload | null {
  if (!token) return null;
  const parsed = decode(token) as Partial<MagnetUnsubscribePayload> | null;
  if (!parsed || parsed.purpose !== "magnet-unsubscribe") return null;
  const email = normalizeAmpelEmail(parsed.email);
  const id = leadId(parsed.leadId);
  const consentAt = typeof parsed.consentAt === "string" ? parsed.consentAt.trim() : "";
  if (!email || !id || !Number.isFinite(Date.parse(consentAt))) return null;
  return { purpose: "magnet-unsubscribe", leadId: id, email, consentAt };
}

export function downloadExpiry(confirmedAtMs: number): number {
  return confirmedAtMs + MAGNET_DOWNLOAD_TTL_MS;
}
