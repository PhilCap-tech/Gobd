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

/**
 * Stripe Tax Rate (`txr_…`) für 19 % USt, Deutschland, exclusive.
 * Leer, wenn die Variable fehlt. Kein Fallback auf eine echte ID:
 * es gibt keine Test-Tax-Rate, und die Live-ID steht nicht im Code.
 * Der Checkout legt die Session dann ohne Steuer an und warnt.
 */
export function getStripeTaxRateId(): string {
  return process.env.STRIPE_TAX_RATE_ID?.trim() ?? "";
}

export function isStripeSecretConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

/**
 * True only when a Stripe key prefix is known to be Test (`sk_test_` / `pk_test_`).
 * Live and unknown prefixes default to false so checkout copy never claims Testmodus
 * on production. Call from the server only — never return the raw key to the client.
 */
export function isStripeTestMode(): boolean {
  const secret = process.env.STRIPE_SECRET_KEY?.trim() ?? "";
  const publishable =
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() ||
    process.env.STRIPE_PUBLISHABLE_KEY?.trim() ||
    "";
  return secret.startsWith("sk_test_") || publishable.startsWith("pk_test_");
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

/** Display name for the account hub. Session identity stays the e-mail. */
export function getProfilesSheetsTab(): string {
  return process.env.GOOGLE_SHEETS_PROFILES_TAB || "profiles";
}

/** Mitgliedschaften Mitwirkende. Dieselbe Tabelle wie die Firmen, eigener Tab. */
export function getMembershipsSheetsTab(): string {
  return process.env.GOOGLE_SHEETS_MEMBERSHIPS_TAB || "memberships";
}

/** Änderungshistorie der Mitwirkung. Dieselbe Tabelle, eigener Tab. */
export function getAuditSheetsTab(): string {
  return process.env.GOOGLE_SHEETS_AUDIT_TAB || "audit_log";
}

/** Abo-Lebenszyklus. Fester Tab-Name, keine zusätzliche Umgebungsvariable. */
export function getLifecycleSheetsTab(): string {
  return "subscription_lifecycle";
}

/** Preismodell v2: ein Plan je Konto. Eigener Tab, dieselbe Tabelle. */
export function getPlansSheetsTab(): string {
  return process.env.GOOGLE_SHEETS_PLANS_TAB || "plans";
}

/** Preismodell v2: eine Zeile je Firma (R1 neu). */
export function getPlanFirmsSheetsTab(): string {
  return process.env.GOOGLE_SHEETS_PLAN_FIRMS_TAB || "plan_firms";
}

/** Ampel rate rows. Same spreadsheet as the leads. No extra env var. */
export function getAmpelRateSheetsTab(): string {
  return "ampel_rate";
}

/** Cookieless Ampel step counts. Same spreadsheet. No extra env var. */
export function getAmpelStepsSheetsTab(): string {
  return "ampel_steps";
}

/** Cookieless homepage CTA counts. Same spreadsheet. */
export function getHomeCtaSheetsTab(): string {
  return process.env.GOOGLE_SHEETS_HOME_CTA_TAB || "home_cta";
}

export function isBlobConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export function isMailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

/**
 * Lokaler Login ohne Resend: der Link darf nur ins Server-Log, nie in die
 * HTTP-Antwort. Produktion und jede Umgebung mit Resend-Zugangsdaten bleiben
 * geschlossen — analog zur harten Abgrenzung von /api/internal/blob-smoke.
 */
export function magicLinkDevFallbackAllowed(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  if (process.env.VERCEL_ENV === "production") return false;
  return !isMailConfigured();
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
