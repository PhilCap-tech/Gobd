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
