/** Canonical production origin: www, https, no trailing slash. */
export const CANONICAL_PRODUCTION_APP_URL =
  "https://www.gobd-doku-erstellen.de";

const PRODUCTION_HOST = "www.gobd-doku-erstellen.de";
const PRODUCTION_APEX_HOST = "gobd-doku-erstellen.de";

function fallbackAppUrl(): string {
  if (process.env.VERCEL_ENV === "production") {
    return CANONICAL_PRODUCTION_APP_URL;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "http://localhost:3000";
}

/**
 * Stripe success/cancel URLs must use the www host. Apex
 * (`gobd-doku-erstellen.de`) 308s to www; that hop can drop `session_id`.
 */
export function canonicalizeAppUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    return fallbackAppUrl();
  }

  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.toLowerCase();
    if (host === PRODUCTION_APEX_HOST || host === PRODUCTION_HOST) {
      return CANONICAL_PRODUCTION_APP_URL;
    }
    return parsed.origin;
  } catch {
    return trimmed.replace(/\/+$/, "");
  }
}

export function getAppUrl(): string {
  return canonicalizeAppUrl(process.env.NEXT_PUBLIC_APP_URL || fallbackAppUrl());
}

export function isStripeConfigured(): boolean {
  return Boolean(
    process.env.STRIPE_SECRET_KEY &&
      process.env.STRIPE_PRICE_SETUP_ID &&
      process.env.STRIPE_PRICE_MONTHLY_ID,
  );
}

export function isStripeSecretConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

/** Signing secret from `stripe listen` or Dashboard → Webhooks. Never invent one. */
export function getStripeWebhookSecret(): string | null {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  return secret || null;
}

export function isProductionRuntime(): boolean {
  if (process.env.VERCEL_ENV) {
    return process.env.VERCEL_ENV === "production";
  }
  return process.env.NODE_ENV === "production";
}

export function isSheetsConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
      process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY &&
      process.env.GOOGLE_SHEETS_SPREADSHEET_ID,
  );
}

export function getSheetsTab(): string {
  return process.env.GOOGLE_SHEETS_TAB || "intakes";
}

/** Separate tab for free Readiness leads — do not mix with paid intake rows. */
export function getReadinessSheetsTab(): string {
  return process.env.GOOGLE_SHEETS_READINESS_TAB || "readiness_leads";
}

/** Separate tab for Account-Hub Firmen — do not mix with intakes. */
export function getEntitiesSheetsTab(): string {
  return process.env.GOOGLE_SHEETS_ENTITIES_TAB || "entities";
}

export function isBlobConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export function isMailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export function isMagicLinkConfigured(): boolean {
  return Boolean(process.env.MAGIC_LINK_SECRET);
}

/**
 * Signing secret for magic links and session cookies.
 * Without MAGIC_LINK_SECRET a documented dev fallback is used so the local
 * demo path still works — do not rely on that in production.
 */
export function getMagicLinkSecret(): string {
  const secret = process.env.MAGIC_LINK_SECRET?.trim();
  if (secret) return secret;
  if (process.env.VERCEL_ENV === "production") {
    console.error(
      "[auth] MAGIC_LINK_SECRET fehlt in Produktion — unsicherer Fallback",
    );
  } else {
    console.warn(
      "[auth] MAGIC_LINK_SECRET fehlt — nutze Dev-Fallback. Setze MAGIC_LINK_SECRET.",
    );
  }
  return "gobd-dev-magic-link-secret";
}
