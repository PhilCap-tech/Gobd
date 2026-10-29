/**
 * Neues Preismodell (Philip 28.10.), ersetzt den v2-Check vom 27.10.
 * Unter PRICING_MODEL=v2:
 * - Option 1 (99 € einmalig) MUSS ab Kauf + 30 Tage gesperrt sein: kein
 *   Schreiben, keine neue Version, keine Einladung, auch kein Download;
 *   das Konto zeigt „Konto deaktiviert“ mit Reaktivierungs-Knopf.
 * - Option 2 (Jahrespaket) sperrt nie, solange das Abo läuft.
 * - Jahrespaket nachgebucht / Reaktivierung öffnen den Zugang wieder.
 * - Jahrespaket nachgebucht: Jahr ab Erstkauf; Reaktivierung: Jahr ab Reaktivierung.
 * - Randfälle: abgelaufen, erstattet, unbezahlt, ohne Zeile, genau Tag 30.
 * - Legacy (PRICING_MODEL leer) liest keinen Plan.
 * Ohne Netz, ohne Stripe, ohne Sheets.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Schalter-Isolation: echte Build-Umgebung (Prod) darf die Prüfungen nicht beeinflussen.
for (const name of [
  "RETENTION_EXECUTE_ENABLED", "RETENTION_DRY_RUN_ENABLED", "PLAN_ADDON_NOTICE_ENABLED",
  "RETENTION_NOTICE_ENABLED", "RETENTION_DELETE_ENABLED", "RENEWAL_NOTICE_ENABLED",
]) delete process.env[name];

for (const name of [
  "PRICING_MODEL", "PLAN_ACCESS_ENABLED", "PLAN_LIFECYCLE_ENABLED", "PRICING_EXTRA_FIRMS_ENABLED",
  "RETENTION_DELETE_ENABLED", "RETENTION_NOTICE_ENABLED", "RENEWAL_NOTICE_ENABLED", "PLAN_ADDON_NOTICE_ENABLED",
  "STRIPE_SECRET_KEY", "STRIPE_SECRET_KEY_NEW", "GOOGLE_SHEETS_SPREADSHEET_ID", "BLOB_READ_WRITE_TOKEN",
  "VERCEL_ENV", "GOBD_DATA_ENV",
]) delete process.env[name];

let passed = 0;
async function check(name: string, run: () => void | Promise<void>) {
  await run();
  passed += 1;
  console.log(`ok: ${name}`);
}

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date();
const iso = (ms: number) => new Date(ms).toISOString();
const daysAgo = (d: number) => iso(NOW.getTime() - d * DAY);
const FUTURE = "2099-01-01T00:00:00.000Z";
const PAST = "2020-01-01T00:00:00.000Z";

async function main() {
  const plan = await import("@/lib/plan");
  const model = await import("@/lib/pricing-model");
  const store = await import("@/lib/plan-store");
  const access = await import("@/lib/plan-access");
  const lifecycle = await import("@/lib/kuendigung-access");
  const view = await import("@/lib/plan-view");
  const webhook = await import("@/lib/plan-webhook");
  const checkout = await import("@/lib/plan-checkout");
  const invite = await import("@/app/api/auth/invite/route");

  const entryAt = (d: number) => {
    const at = daysAgo(d);
    return plan.applyEntryPurchase(null, {
      email: "x@example.com", at, sessionId: `cs_${d}`, eventId: `evt_${d}`, customerId: "cus_1", member: false, subscriptionId: "",
    });
  };
  const withEmail = (email: string, row: import("@/lib/plan").PlanRow): import("@/lib/plan").PlanRow => ({ ...row, email });

  const rows: Record<string, import("@/lib/plan").PlanRow> = {
    o1_day1: entryAt(1),
    o1_day29: entryAt(29),
    o1_day31: entryAt(31),
    o1_exactly30: { ...entryAt(0), purchasedAt: iso(NOW.getTime() - 30 * DAY), accessUntil: iso(NOW.getTime()) },
    o1_refunded: { ...entryAt(3), refundedAt: daysAgo(2) },
    o2_active: { ...plan.applyEntryPurchase(null, { email: "x@example.com", at: daysAgo(200), sessionId: "cs_o2", eventId: "e", customerId: "c", member: true, subscriptionId: "sub_1" }) },
    o2_past_due: { ...plan.applyEntryPurchase(null, { email: "x@example.com", at: daysAgo(400), sessionId: "cs_pd", eventId: "e", customerId: "c", member: true, subscriptionId: "sub_2" }), memberStatus: "past_due" },
    o2_unpaid: { ...plan.applyEntryPurchase(null, { email: "x@example.com", at: daysAgo(400), sessionId: "cs_up", eventId: "e", customerId: "c", member: true, subscriptionId: "sub_3" }), memberStatus: "unpaid" },
    o2_ended: plan.applyMemberEnded(
      plan.applyEntryPurchase(null, { email: "x@example.com", at: daysAgo(400), sessionId: "cs_en", eventId: "e", customerId: "c", member: true, subscriptionId: "sub_4" }),
      { at: daysAgo(10), eventId: "e2", endedAt: daysAgo(10) },
    ),
    legacy_v2_row_no_access_until: { ...plan.emptyPlanRow("x@example.com", PAST), purchasedAt: PAST, retentionUntil: FUTURE },
  };
  const list = Object.entries(rows).map(([k, r]) => withEmail(`${k}@example.com`, r));
  let writes = 0;
  store.setPlanStoreForTests({ read: async () => list, write: async () => { writes += 1; } });
  lifecycle.setLifecycleReaderForTests(async () => []);

  await check("legacy: Plan wird nicht gelesen, nichts gesperrt", async () => {
    assert.equal(model.pricingModel(), "legacy");
    assert.equal(await access.loadPlanAccess("o1_day31@example.com"), null);
    assert.equal(await lifecycle.subscriptionDownloadDenial("o1_day31@example.com"), null);
    assert.equal(await access.planInviteDenial("o1_day31@example.com"), null);
  });

  process.env.PRICING_MODEL = "v2";

  await check("Schalter: Defaults (Plan an, Firmen aus, Mail aus, Login-zuerst an); v3 ist Alias", () => {
    assert.equal(model.planAccessEnabled(), true);
    assert.equal(model.extraFirmsEnabled(), false);
    assert.equal(model.addonNoticeEnabled(), false);
    assert.equal(model.intakeLoginFirstEnabled(), true, "Login zuerst im neuen Modell Default an");
    assert.equal(model.memberPreselected(), true, "Option 2 vorausgewählt");
    process.env.PRICING_MODEL = "v3";
    assert.equal(model.pricingModel(), "v2");
    process.env.PRICING_MODEL = "v2";
    process.env.PRICING_EXTRA_FIRMS_ENABLED = "true";
    assert.equal(model.extraFirmsEnabled(), false, "weitere Firmen bleiben aus");
    delete process.env.PRICING_EXTRA_FIRMS_ENABLED;
  });

  const open = ["o1_day1", "o1_day29", "o2_active", "o2_past_due", "legacy_v2_row_no_access_until"];
  const locked = ["o1_day31", "o1_exactly30", "o1_refunded", "o2_unpaid", "o2_ended"];

  for (const key of open) {
    await check(`offen: ${key}`, async () => {
      const email = `${key}@example.com`;
      const loaded = await access.loadPlanAccess(email);
      assert.ok(loaded);
      assert.equal(loaded.access.writesOpen, true);
      assert.equal(loaded.access.downloadsOpen, true);
      assert.equal(loaded.access.newVersionAllowed, true);
      assert.equal(loaded.access.canReactivate, false);
      assert.equal(await access.planWriteDenial(email), null);
      assert.equal(await access.planInviteDenial(email), null);
      assert.equal(await lifecycle.subscriptionDownloadDenial(email), null);
      assert.equal((await access.planFirmGate(email, "e1", true)).denial, null);
    });
  }
  for (const key of locked) {
    await check(`gesperrt (auch Download und Einladung): ${key}`, async () => {
      const email = `${key}@example.com`;
      const loaded = await access.loadPlanAccess(email);
      assert.ok(loaded);
      assert.equal(loaded.access.writesOpen, false);
      assert.equal(loaded.access.downloadsOpen, false, "Download nach Tag 30 gesperrt");
      assert.equal(loaded.access.newVersionAllowed, false);
      assert.notEqual(await access.planWriteDenial(email), null);
      assert.notEqual(await access.planInviteDenial(email), null);
      assert.notEqual(await lifecycle.subscriptionWriteDenial(email), null);
      assert.notEqual(await lifecycle.subscriptionDownloadDenial(email), null);
      assert.notEqual((await access.planFirmGate(email, "e1", false)).denial, null);
    });
  }

  await check("ohne Plan-Zeile: nichts gesperrt (Bestand, DS24, Comp)", async () => {
    assert.equal(await access.loadPlanAccess("missing@example.com"), null);
    assert.equal(await access.planWriteDenial("missing@example.com"), null);
    assert.equal(await lifecycle.subscriptionDownloadDenial("missing@example.com"), null);
  });

  await check("Option 1: Zugangsende = Kauf + 30 Tage, im Konto als Datum sichtbar, Jahrespaket buchbar", async () => {
    const row = rows.o1_day1;
    assert.equal(Date.parse(row.accessUntil) - Date.parse(row.purchasedAt), 30 * DAY);
    const v = await view.loadAccountPlanView("o1_day1@example.com", []);
    assert.ok(v && v.accessUntil === row.accessUntil);
    assert.ok(v.lines.some((l) => l.startsWith("Zugang bis ")), "Datum sichtbar");
    assert.equal(v.canAddon, true);
    assert.equal(v.deactivated, false);
  });

  await check("Konto deaktiviert: Zustand mit Reaktivierungs-Knopf (Wortlaut exakt)", async () => {
    for (const key of ["o1_day31", "o1_exactly30", "o2_ended"]) {
      const v = await view.loadAccountPlanView(`${key}@example.com`, []);
      assert.ok(v && v.deactivated, `${key} deaktiviert`);
      assert.equal(v.canAddon, false);
    }
    const refunded = await view.loadAccountPlanView("o1_refunded@example.com", []);
    assert.ok(refunded && !refunded.deactivated, "erstattet: keine Reaktivierung");
    assert.equal(plan.PLAN_REACTIVATE_LABEL, "Konto jetzt für 99 € netto + 49 €/Jahr wieder komplett aktivieren");
    const card = readFileSync("components/account-plan.tsx", "utf8");
    assert.ok(card.includes('kind="reactivate" label={PLAN_REACTIVATE_LABEL}'), "Knopf im Konto");
    const page = readFileSync("app/account/page.tsx", "utf8");
    const i = page.indexOf("if (planView?.deactivated)");
    assert.ok(i > 0 && page.indexOf("<AccountPlanCard", i) < page.indexOf("return (\n    <>", i + 300), "deaktiviert: nur die Karte, kein Dashboard");
  });

  await check("Jahrespaket nachgebucht: dauerhaft offen, Jahr ab ERSTKAUF (Abo trial_end = Erstkauf + 12 Monate)", () => {
    const first = rows.o1_day29;
    const at = daysAgo(1);
    const next = webhook.planAfterCheckout(first, {
      kind: "addon", member: true, email: first.email, at, sessionId: "cs_addon", eventId: "evt_addon", customerId: "c", subscriptionId: "sub_add",
    });
    assert.ok(next);
    assert.equal(next.plan, "member");
    assert.equal(next.memberPeriodEnd, plan.addMonthsIso(first.purchasedAt, 12), "Jahr ab Erstkauf");
    assert.equal(plan.planAccess(next, new Date(NOW.getTime() + 60 * DAY)).writesOpen, true, "nach Tag 30 offen");
    assert.equal(webhook.planAfterCheckout(next, {
      kind: "addon", member: true, email: first.email, at, sessionId: "cs_addon", eventId: "evt_addon", customerId: "c", subscriptionId: "sub_add",
    }), next, "idempotent");
    const trial = checkout.addonTrialEnd(first.purchasedAt, NOW);
    assert.equal(trial, Math.floor(Date.parse(plan.addMonthsIso(first.purchasedAt, 12)) / 1000));
    const params = checkout.buildPlanCheckoutParams({
      kind: "addon", email: "a@example.com", company: "", prices: { entry: "price_e", year: "price_y", addonYear: "price_a" },
      firstPurchasedAt: first.purchasedAt,
    });
    assert.equal(params.mode, "subscription");
    assert.equal(params.subscription_data?.trial_end, trial);
    assert.deepEqual(params.line_items?.map((i) => i.price), ["price_a", "price_y"]);
    assert.equal(params.metadata?.gobd_kind, "addon");
    assert.equal(params.metadata?.gobd_plan, "member");
  });

  await check("Reaktivierung: Zugang wieder offen, Jahr ab Reaktivierung, idempotent", () => {
    const old = rows.o1_day31;
    const at = NOW.toISOString();
    const input = { kind: "reactivate" as const, member: true, email: old.email, at, sessionId: "cs_re", eventId: "evt_re", customerId: "c", subscriptionId: "sub_re" };
    const next = webhook.planAfterCheckout(old, input);
    assert.ok(next);
    assert.equal(plan.planAccess(next, NOW).writesOpen, true);
    assert.equal(plan.planAccess(next, NOW).downloadsOpen, true);
    assert.equal(next.memberPeriodEnd, plan.addMonthsIso(at, 12), "Jahr ab Reaktivierung");
    assert.equal(webhook.planAfterCheckout(next, input), next, "idempotent");
    const params = checkout.buildPlanCheckoutParams({
      kind: "reactivate", email: "a@example.com", company: "", prices: { entry: "price_e", year: "price_y", addonYear: "" },
    });
    assert.equal(params.mode, "subscription");
    assert.equal(params.subscription_data?.trial_end, undefined, "kein trial: Jahr ab heute");
    assert.deepEqual(params.line_items?.map((i) => i.price), ["price_e", "price_y"]);
  });

  await check("Checkout: Option 1 = payment 99 €, Option 2 = subscription 99 € + 49 €/Jahr", () => {
    const prices = { entry: "price_e", year: "price_y", addonYear: "" };
    const o1 = checkout.buildPlanCheckoutParams({ kind: "entry", member: false, email: "a@example.com", company: "A", prices });
    assert.equal(o1.mode, "payment");
    assert.deepEqual(o1.line_items?.map((i) => i.price), ["price_e"]);
    const o2 = checkout.buildPlanCheckoutParams({ kind: "entry", member: true, email: "a@example.com", company: "A", prices });
    assert.equal(o2.mode, "subscription");
    assert.deepEqual(o2.line_items?.map((i) => i.price), ["price_e", "price_y"]);
    assert.equal(model.PLAN_LOOKUP_KEY_ENTRY, "entry_v3");
    assert.equal(model.PLAN_LOOKUP_KEY_YEAR, "year_v3");
    assert.equal(model.PLAN_LOOKUP_KEY_ADDON_YEAR, "addon_year_v3");
  });

  await check("Reaktivierbar bis: 12 Monate nach Kauf bzw. Abo-Ende (nur gespeichert, keine Löschung)", () => {
    assert.equal(plan.reactivatableUntil(rows.o1_day31), plan.addMonthsIso(rows.o1_day31.purchasedAt, 12));
    assert.equal(plan.reactivatableUntil(rows.o2_ended), plan.addMonthsIso(rows.o2_ended.memberEndedAt, 12));
    assert.equal(plan.reactivatableUntil(rows.o1_refunded), "");
    assert.equal(model.retentionDeleteEnabled(), false);
  });

  await check("Einladung: nach Tag 30 403, vorher offen", async () => {
    const io = (email: string) => ({
      sessionEmail: async () => email,
      ownedEntity: async () => ({ entityId: "e1" }) as never,
      invite: (async () => ({ ok: true, membershipId: "m1", throttled: false })) as never,
      planDenial: access.planInviteDenial,
    });
    const req = () => new Request("http://x/api/auth/invite", { method: "POST", body: JSON.stringify({ entityId: "e1", memberEmail: "m@example.com", moduleIds: [] }) });
    assert.equal((await invite.postInvite(req(), io("o1_day31@example.com"))).status, 403);
    assert.equal((await invite.postInvite(req(), io("o1_day1@example.com"))).status, 200);
  });

  await check("Webhook: Jahres-Abo nie über recordSubscriptionEvent; addon/reactivate ohne Onboarding", () => {
    const src = readFileSync("app/api/stripe/webhook/route.ts", "utf8");
    const sub = src.slice(src.indexOf('case "customer.subscription.updated"'));
    assert.ok(sub.indexOf("isAnnualPlanSubscription(") < sub.indexOf("recordSubscriptionEvent("));
    assert.ok(src.indexOf('planKind === "reactivate"') < src.indexOf("deliverBuyerOnboarding("));
  });

  await check("Zugangsprüfungen schreiben nichts", () => assert.equal(writes, 0));

  delete process.env.PRICING_MODEL;
  store.setPlanStoreForTests(null);
  lifecycle.setLifecycleReaderForTests(null);
  console.log(`check-v2-no-lockout: ok (${passed} checks)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
