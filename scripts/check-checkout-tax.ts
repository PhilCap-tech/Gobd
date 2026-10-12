/**
 * Prebuild: tax rates are passed through when STRIPE_TAX_RATE_ID is set.
 * Does not require the variable in the environment and does not call Stripe.
 * The live-id scan uses Node fs only (no rg). A missing STRIPE_TAX_RATE_ID must not fail.
 *
 *   npx tsx scripts/check-checkout-tax.ts
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  CHECKOUT_SESSION_ROUTE,
  buildCheckoutSessionParams,
  type CheckoutSessionInput,
} from "../lib/stripe";
import {
  MONTHLY_GROSS_LABEL,
  SETUP_GROSS_LABEL,
  TODAY_EUR,
  TODAY_GROSS_LABEL,
} from "../lib/pricing";

function ok(cond: unknown, msg: string) {
  assert.ok(cond, msg);
  console.log("ok:", msg);
}

const SKIP_DIRS = new Set(["node_modules", ".git", ".next", ".data", "coverage", "dist"]);

/** Walk the repo with Node fs only. No rg or other external binaries. */
function filesContaining(root: string, needle: string): string[] {
  const hits: string[] = [];
  const stack = [root];
  while (stack.length > 0) {
    const dir = stack.pop();
    if (!dir) continue;
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (SKIP_DIRS.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
        continue;
      }
      if (!entry.isFile()) continue;
      let bytes: Buffer;
      try {
        bytes = readFileSync(full);
      } catch {
        continue;
      }
      if (bytes.includes(needle)) hits.push(path.relative(root, full));
    }
  }
  return hits;
}

const FIXTURE_TAX_RATE = "txr_prebuild_fixture";

function sample(route = CHECKOUT_SESSION_ROUTE): CheckoutSessionInput {
  return {
    email: "buyer@example.com",
    company: "Beispiel GmbH",
    route,
  };
}

function withWarn(fn: () => void): string[] {
  const warnings: string[] = [];
  const original = console.warn;
  console.warn = (...args: unknown[]) => {
    warnings.push(args.map((part) => String(part)).join(" "));
  };
  try {
    fn();
    return warnings;
  } finally {
    console.warn = original;
  }
}

function lineTaxRates(params: ReturnType<typeof buildCheckoutSessionParams>) {
  return (params.line_items ?? []).map((item) => item.tax_rates);
}

const savedTaxRate = process.env.STRIPE_TAX_RATE_ID;

try {
  delete process.env.STRIPE_TAX_RATE_ID;
  let missingParams: ReturnType<typeof buildCheckoutSessionParams> | undefined;
  const missingWarnings = withWarn(() => {
    missingParams = buildCheckoutSessionParams(sample());
  });
  ok(missingParams, "missing tax rate still builds a session");
  ok(
    missingWarnings.some((line) =>
      line.includes(
        `STRIPE_TAX_RATE_ID fehlt — Checkout ohne Umsatzsteuer (Route ${CHECKOUT_SESSION_ROUTE})`,
      ),
    ),
    "missing tax rate warns with the checkout route",
  );
  ok(
    lineTaxRates(missingParams!).every((rates) => rates === undefined),
    "missing tax rate omits tax_rates on every line item",
  );
  ok(
    missingParams!.subscription_data?.default_tax_rates === undefined,
    "missing tax rate omits subscription_data.default_tax_rates",
  );
  ok(!("automatic_tax" in missingParams!), "automatic_tax stays unset");
  ok(missingParams!.mode === "subscription", "checkout stays in subscription mode");

  process.env.STRIPE_TAX_RATE_ID = "   ";
  const blankWarnings = withWarn(() => {
    buildCheckoutSessionParams(sample());
  });
  ok(
    blankWarnings.some((line) => line.includes(CHECKOUT_SESSION_ROUTE)),
    "blank tax rate is treated as missing and names the route",
  );

  process.env.STRIPE_TAX_RATE_ID = `  ${FIXTURE_TAX_RATE}  `;
  let taxed: ReturnType<typeof buildCheckoutSessionParams> | undefined;
  const taxedWarnings = withWarn(() => {
    taxed = buildCheckoutSessionParams(sample());
  });
  ok(
    taxedWarnings.every((line) => !line.includes("STRIPE_TAX_RATE_ID fehlt")),
    "a set tax rate does not warn",
  );
  const rates = lineTaxRates(taxed!);
  ok(rates.length === 2, "checkout has two line items");
  ok(
    rates.every(
      (item) =>
        Array.isArray(item) &&
        item.length === 1 &&
        item[0] === FIXTURE_TAX_RATE,
    ),
    "both line items receive tax_rates from STRIPE_TAX_RATE_ID",
  );
  ok(
    Array.isArray(taxed!.subscription_data?.default_tax_rates) &&
      taxed!.subscription_data.default_tax_rates.length === 1 &&
      taxed!.subscription_data.default_tax_rates[0] === FIXTURE_TAX_RATE,
    "subscription_data.default_tax_rates receives the same tax rate",
  );
  ok(!("invoice_creation" in taxed!), "subscription invoices do not use invoice_creation");

  const stripeSource = readFileSync("lib/stripe.ts", "utf8");
  ok(stripeSource.includes("tax_rates: taxRates"), "source passes tax_rates onto line items");
  ok(
    stripeSource.includes("default_tax_rates: taxRates"),
    "source passes default_tax_rates onto subscription_data",
  );
  ok(
    stripeSource.includes("buildCheckoutSessionParams(input)"),
    "createCheckoutSession uses the tax-aware params",
  );
  ok(!stripeSource.includes("automatic_tax"), "source does not enable automatic_tax");
  ok(
    (stripeSource.match(/checkout\.sessions\.create/g) ?? []).length === 1,
    "there is one checkout session create",
  );
  ok(
    readFileSync("app/api/checkout/route.ts", "utf8").includes("CHECKOUT_SESSION_ROUTE"),
    "POST /api/checkout names the route used in the warning",
  );

  const tracking = readFileSync("lib/tracking.ts", "utf8");
  const conversionAt = tracking.indexOf('gtag?.("event", "conversion"');
  ok(conversionAt >= 0, "Google Ads conversion call exists");
  const conversionCall = tracking.slice(conversionAt, tracking.indexOf("});", conversionAt));
  ok(!/\bvalue\b/.test(conversionCall), "Google Ads conversion sends no value");
  ok(!conversionCall.includes("235"), "Google Ads conversion does not send the gross total");
  ok(tracking.includes("198 € net"), "conversion comment keeps the 198 € net default");
  ok(TODAY_EUR === 198, "list price today stays 198 net");
  ok(SETUP_GROSS_LABEL === "177,31", "setup gross is 177,31");
  ok(MONTHLY_GROSS_LABEL === "58,31", "monthly gross is 58,31");
  ok(TODAY_GROSS_LABEL === "235,62", "today gross is 235,62");

  const liveHits = filesContaining(process.cwd(), "txr_" + "1");
  ok(
    liveHits.length === 0,
    liveHits.length === 0
      ? "no live tax rate id is hardcoded"
      : `live tax rate id is hardcoded in ${liveHits.join(", ")}`,
  );
} finally {
  if (savedTaxRate === undefined) delete process.env.STRIPE_TAX_RATE_ID;
  else process.env.STRIPE_TAX_RATE_ID = savedTaxRate;
}

console.log("checkout tax check passed");
