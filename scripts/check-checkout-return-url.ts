/**
 * Stripe success/cancel/return URLs: Produktion (und lokal ohne VERCEL_ENV)
 * kanonische Domain; Preview/Development die Branch-URL der Deployment-Instanz.
 * Synthetisch, kein Stripe-Aufruf.
 */
import assert from "node:assert/strict";

for (const name of ["VERCEL_ENV", "VERCEL_BRANCH_URL", "VERCEL_URL", "NEXT_PUBLIC_APP_URL", "STRIPE_SECRET_KEY"]) delete process.env[name];
let passed = 0;
async function check(name: string, run: () => void | Promise<void>) {
  await run();
  passed += 1;
  console.log(`ok: ${name}`);
}

async function main() {
  const env = await import("@/lib/env");
  const checkout = await import("@/lib/plan-checkout");
  process.env.STRIPE_PRICE_ENTRY_ID = "price_entry_test";
  process.env.STRIPE_PRICE_MEMBER_YEAR_ID = "price_year_test";
  process.env.STRIPE_PRICE_CHANGE_ID = "price_change_test";
  const prod = "https://www.gobd-doku-erstellen.de";

  await check("Produktion: kanonische Domain, auch wenn Branch-URL gesetzt ist", () => {
    process.env.VERCEL_ENV = "production";
    process.env.NEXT_PUBLIC_APP_URL = prod;
    process.env.VERCEL_BRANCH_URL = "gobd-git-x-team.vercel.app";
    assert.equal(env.checkoutReturnBaseUrl(), prod);
    const p = checkout.buildPlanCheckoutParams({ kind: "entry", member: false, email: "k@example.com", company: "F", draftKey: "email:k@example.com:default:gesamt" } as never);
    assert.ok(String(p.success_url).startsWith(`${prod}/`));
    assert.ok(String(p.cancel_url).startsWith(`${prod}/`));
  });

  await check("Preview: Branch-URL statt Prod-Domain (success + cancel, alle Arten)", () => {
    process.env.VERCEL_ENV = "preview";
    process.env.NEXT_PUBLIC_APP_URL = prod;
    process.env.VERCEL_BRANCH_URL = "gobd-git-preismodell-testmodus-team.vercel.app";
    const base = "https://gobd-git-preismodell-testmodus-team.vercel.app";
    assert.equal(env.checkoutReturnBaseUrl(), base);
    for (const kind of ["entry", "addon", "reactivate", "change"] as const) {
      const p = checkout.buildPlanCheckoutParams({ kind, member: kind === "entry", email: "k@example.com", company: "F", draftKey: "email:k@example.com:default:gesamt" } as never);
      assert.ok(String(p.success_url).startsWith(`${base}/`), `${kind} success`);
      assert.ok(String(p.cancel_url).startsWith(`${base}/`), `${kind} cancel`);
    }
  });

  await check("Preview ohne Branch-URL: VERCEL_URL; ungültiger Host fällt auf App-URL zurück", () => {
    process.env.VERCEL_ENV = "preview";
    delete process.env.VERCEL_BRANCH_URL;
    process.env.VERCEL_URL = "gobd-abc-team.vercel.app";
    assert.equal(env.checkoutReturnBaseUrl(), "https://gobd-abc-team.vercel.app");
    process.env.VERCEL_URL = "evil.example/@x";
    assert.equal(env.checkoutReturnBaseUrl(), prod);
  });

  await check("Lokal (kein VERCEL_ENV): unverändert getAppUrl()", () => {
    delete process.env.VERCEL_ENV;
    delete process.env.VERCEL_URL;
    delete process.env.NEXT_PUBLIC_APP_URL;
    assert.equal(env.checkoutReturnBaseUrl(), env.getAppUrl());
  });

  console.log(`check-checkout-return-url: ${passed} ok`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
