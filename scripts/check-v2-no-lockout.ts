/**
 * Preismodell v2, schlanker Kern (CoS 27.10.): Unter PRICING_MODEL=v2 mit
 * PLAN_LIFECYCLE_ENABLED aus (Default) sperrt keine Plan-Kombination den
 * Zugang (Einstieg/Mitglied, Frist abgelaufen, gekündigt, beendet, gelöscht,
 * erstattet, keine Plan-Zeile, Löschdaten in der Vergangenheit). Weitere
 * Firmen sind per Default aus, Konto-Käufe und eigener Stichtag sind aus,
 * das Konto zeigt nur einen schlichten Hinweis. Der Webhook verbucht Käufe
 * weiter. Ohne Netz, ohne Stripe, ohne Sheets.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

for (const name of [
  "PRICING_MODEL", "PLAN_ACCESS_ENABLED", "PLAN_LIFECYCLE_ENABLED", "PRICING_EXTRA_FIRMS_ENABLED",
  "RETENTION_DELETE_ENABLED", "RETENTION_NOTICE_ENABLED", "RENEWAL_NOTICE_ENABLED",
  "STRIPE_SECRET_KEY", "STRIPE_SECRET_KEY_NEW", "GOOGLE_SHEETS_SPREADSHEET_ID", "BLOB_READ_WRITE_TOKEN",
  "VERCEL_ENV", "GOBD_DATA_ENV",
]) delete process.env[name];

let passed = 0;
async function check(name: string, run: () => void | Promise<void>) {
  await run();
  passed += 1;
  console.log(`ok: ${name}`);
}

const PAST = "2020-01-01T00:00:00.000Z";
const PAST2 = "2021-06-01T00:00:00.000Z";
const FUTURE = "2099-01-01T00:00:00.000Z";

async function main() {
  const plan = await import("@/lib/plan");
  const model = await import("@/lib/pricing-model");
  const store = await import("@/lib/plan-store");
  const firmStore = await import("@/lib/plan-firm-store");
  const firmsLib = await import("@/lib/plan-firms");
  const access = await import("@/lib/plan-access");
  const lifecycle = await import("@/lib/kuendigung-access");
  const coverage = await import("@/lib/subscription-coverage");
  const view = await import("@/lib/plan-view");

  const base = (email: string, patch: Partial<import("@/lib/plan").PlanRow>) => ({
    ...plan.emptyPlanRow(email, "2019-01-01T00:00:00.000Z"),
    purchasedAt: "2019-01-01T00:00:00.000Z",
    ...patch,
  });
  const scenarios: Record<string, Partial<import("@/lib/plan").PlanRow>> = {
    single_window: { plan: "single", retentionUntil: FUTURE },
    single_expired: { plan: "single", retentionUntil: PAST },
    single_expired_no_credits: { plan: "single", retentionUntil: PAST, changeCredits: 0 },
    single_deleted: { plan: "single", retentionUntil: PAST, deletedAt: PAST2, notice30At: PAST, notice7At: PAST },
    single_refunded: { plan: "single", retentionUntil: FUTURE, refundedAt: PAST2 },
    member_active: { plan: "member", memberStatus: "active", memberSubscriptionId: "sub_a", memberPeriodEnd: FUTURE },
    member_period_end_past: { plan: "member", memberStatus: "active", memberSubscriptionId: "sub_b", memberPeriodEnd: PAST },
    member_cancelled: { plan: "member", memberStatus: "canceled", memberSubscriptionId: "sub_c", memberPeriodEnd: PAST, memberCancelAt: PAST, memberEndedAt: PAST2, retentionUntil: PAST },
    member_deleted_sub: { plan: "member", memberStatus: "canceled", memberSubscriptionId: "sub_d", memberEndedAt: PAST, retentionUntil: PAST, deletedAt: PAST2 },
    member_past_due: { plan: "member", memberStatus: "past_due", memberSubscriptionId: "sub_e", memberPeriodEnd: PAST, retentionUntil: PAST },
    member_unpaid: { plan: "member", memberStatus: "unpaid", memberSubscriptionId: "sub_f", memberPeriodEnd: PAST },
    member_refunded: { plan: "member", memberStatus: "canceled", memberSubscriptionId: "sub_g", refundedAt: PAST2, memberEndedAt: PAST2 },
  };
  const rows = Object.entries(scenarios).map(([key, patch]) => base(`${key}@example.com`, patch));
  const emails = [...Object.keys(scenarios).map((k) => `${k}@example.com`), "missing_row@example.com"];
  let planWrites = 0;
  let firmWrites = 0;
  store.setPlanStoreForTests({ read: async () => rows, write: async () => { planWrites += 1; } });
  // Firmen-Zeilen, die mit Plan-Logik sperren würden (Frist vorbei, fremde Firma gebunden).
  const firmRows = Object.keys(scenarios).flatMap((k) => [
    { ...firmsLib.emptyFirmRow(`${k}@example.com`, `cs_${k}`, "entry", "2019-01-01T00:00:00.000Z"), entityId: "e_other", retentionUntil: PAST },
  ]);
  firmStore.setPlanFirmStoreForTests({ read: async () => firmRows, write: async () => { firmWrites += 1; } });
  lifecycle.setLifecycleReaderForTests(async () => []);

  await check("Sanity: mit Plan-Logik würden diese Zeilen sperren (Testdaten greifen)", () => {
    const denied = rows.filter((r) => !plan.planAccess(r, new Date()).writesOpen);
    assert.ok(denied.length >= 6, `erwartet mehrere gesperrte Zustände, waren ${denied.length}`);
    assert.ok(rows.some((r) => !plan.planAccess(r, new Date()).downloadsOpen), "gelöscht sperrt Downloads");
  });

  await check("legacy: Schalter aus, Plan wird nicht gelesen", async () => {
    assert.equal(model.pricingModel(), "legacy");
    assert.equal(model.planLifecycleEnabled(), false);
    assert.equal(model.extraFirmsEnabled(), false);
    assert.equal(await access.loadPlanAccess("single_expired@example.com"), null);
  });

  process.env.PRICING_MODEL = "v2";

  await check("v2 Default: Plan wird gebucht/gelesen, Plan-Logik und weitere Firmen aus", () => {
    assert.equal(model.planAccessEnabled(), true);
    assert.equal(model.planLifecycleEnabled(), false);
    assert.equal(model.extraFirmsEnabled(), false);
    assert.equal(model.retentionDeleteEnabled(), false);
    assert.equal(model.retentionNoticeEnabled(), false);
  });

  const assertNoLockout = async (label: string) => {
    for (const email of emails) {
      const loaded = await access.loadPlanAccess(email);
      if (email.startsWith("missing_row")) {
        assert.equal(loaded, null, `${label}: ohne Zeile kein Plan`);
      } else {
        assert.ok(loaded, `${label}: ${email} gelesen`);
        assert.equal(loaded.access.writesOpen, true, `${label}: ${email} schreiben`);
        assert.equal(loaded.access.downloadsOpen, true, `${label}: ${email} Download`);
        assert.equal(loaded.access.newVersionAllowed, true, `${label}: ${email} neue Version`);
        assert.equal(loaded.access.canBuyChange, false, `${label}: ${email} kein Konto-Kauf`);
        assert.equal(loaded.access.canBecomeMember, false, `${label}: ${email} kein Konto-Kauf`);
      }
      assert.equal(await access.planWriteDenial(email), null, `${label}: ${email} planWriteDenial`);
      assert.equal(await access.planVersionDenial(email), null, `${label}: ${email} planVersionDenial`);
      assert.equal(await access.planDownloadDenial(email), null, `${label}: ${email} planDownloadDenial`);
      assert.equal(await lifecycle.subscriptionWriteDenial(email), null, `${label}: ${email} subscriptionWriteDenial`);
      assert.equal(await lifecycle.subscriptionDownloadDenial(email), null, `${label}: ${email} subscriptionDownloadDenial`);
      for (const entity of ["", "e1", "e_other"]) {
        for (const newVersion of [false, true]) {
          const gate = await access.planFirmGate(email, entity, newVersion);
          assert.equal(gate.denial, null, `${label}: ${email} planFirmGate(${entity || "-"}, ${newVersion})`);
          await gate.commit({ pdfCreated: false });
        }
      }
      if (!email.startsWith("missing_row")) {
        const cov = await coverage.loadIncludedFirmCoverage(email);
        assert.equal(cov.planOpen, true, `${label}: ${email} Firmen-Abdeckung offen`);
        assert.equal("planFirms" in cov, false, `${label}: ${email} keine Firmen-Plätze`);
      }
    }
  };

  await check("v2 Default: kein Zustand sperrt (Plan, Lifecycle, Firmen-Gate, Abdeckung)", async () => {
    await assertNoLockout("v2");
  });

  await check("v2 + PRICING_EXTRA_FIRMS_ENABLED=true allein: weiterhin keine Sperre", async () => {
    process.env.PRICING_EXTRA_FIRMS_ENABLED = "true";
    await assertNoLockout("v2+firms");
    delete process.env.PRICING_EXTRA_FIRMS_ENABLED;
  });

  await check("v2 Default: keine Plan-Schreibzugriffe aus Zugangsprüfungen (Änderungsguthaben, Firmen-Plätze)", async () => {
    assert.equal(planWrites, 0);
    assert.equal(firmWrites, 0);
  });

  await check("v2 Default: Konto zeigt nur schlichten Hinweis (keine Frist, kein Kauf, kein Stichtag)", async () => {
    for (const r of rows) {
      const v = await view.loadAccountPlanView(r.email, [{ pdfUrl: "x", timestamp: PAST }]);
      assert.ok(v && v.simple, `${r.email}: schlichte Ansicht`);
      assert.deepEqual(v.lines, []);
      assert.equal(v.refundLine, "");
      assert.equal(v.cancelPreview, "");
      assert.equal(v.canBuyChange || v.canBecomeMember || v.canCancel || v.canWithdrawCancel, false);
      assert.ok(["Jahresmitgliedschaft", "Einstieg"].includes(v.title), `${r.email}: Titel ${v.title}`);
    }
    const card = readFileSync("components/account-plan.tsx", "utf8");
    const start = card.indexOf("if (view.simple)");
    const simple = card.slice(start, card.indexOf("\n  }\n  return (", start));
    assert.ok(start > 0 && simple.length > 100, "schlichter Zweig gefunden");
    assert.ok(simple.includes("/api/account/kuendigung/portal"), "Kündigen über Stripe-Portal");
    assert.ok(!simple.includes("PlanBuyButton") && !simple.includes("jahresplan"), "keine Käufe, kein eigener Stichtag");
  });

  await check("v2 Default: Routen für Konto-Kauf, eigenen Stichtag und Admin-Stichtag sind abgeschaltet", () => {
    const checkout = readFileSync("app/api/checkout/route.ts", "utf8");
    const fn = checkout.slice(checkout.indexOf("async function accountPlanCheckout"));
    assert.ok(fn.indexOf("if (!planLifecycleEnabled())") > 0 && fn.indexOf("if (!planLifecycleEnabled())") < fn.indexOf("loadPlanAccess("));
    const jahresplan = readFileSync("app/api/account/jahresplan/kuendigung/route.ts", "utf8");
    assert.ok(jahresplan.indexOf("if (!planLifecycleEnabled())") < jahresplan.indexOf("formData()"));
    const legacyCancel = readFileSync("app/api/account/kuendigung/route.ts", "utf8");
    assert.ok(legacyCancel.includes("const wantsPortal = annualPlan ||"), "Jahres-Abo immer ins Portal, kein Lifecycle-Eintrag");
    const admin = readFileSync("lib/plan-admin.ts", "utf8");
    assert.ok(admin.indexOf("if (!planLifecycleEnabled())") < admin.indexOf("cancelMembership :"));
  });

  await check("Webhook: Kauf wird verbucht, Jahres-Abo nie über recordSubscriptionEvent", () => {
    const src = readFileSync("app/api/stripe/webhook/route.ts", "utf8");
    assert.ok(src.includes('if (planKind === "entry")') && src.includes('kind: "entry"'), "Einstieg verbucht");
    assert.ok(src.indexOf('kind: "entry"') < src.indexOf("await recordCheckoutSubscription("), "Einstieg vor Alt-Lifecycle");
    const sub = src.slice(src.indexOf('case "customer.subscription.updated"'));
    assert.ok(sub.indexOf("isAnnualPlanSubscription(") < sub.indexOf("recordSubscriptionEvent("));
    assert.ok(sub.indexOf("recordPlanSubscriptionEvent(") < sub.indexOf("} else {"));
    assert.ok(!src.includes("planLifecycleEnabled"), "Buchung hängt nicht am neuen Schalter");
  });

  await check("Gegenprobe: PLAN_LIFECYCLE_ENABLED=true aktiviert die alte Plan-Logik (Code bleibt)", async () => {
    process.env.PLAN_LIFECYCLE_ENABLED = "true";
    assert.notEqual(await access.planWriteDenial("single_expired@example.com"), null);
    assert.notEqual(await access.planDownloadDenial("single_deleted@example.com"), null);
    const v = await view.loadAccountPlanView("single_window@example.com", []);
    assert.ok(v && !v.simple);
    delete process.env.PLAN_LIFECYCLE_ENABLED;
  });

  delete process.env.PRICING_MODEL;
  store.setPlanStoreForTests(null);
  firmStore.setPlanFirmStoreForTests(null);
  lifecycle.setLifecycleReaderForTests(null);
  console.log(`check-v2-no-lockout: ok (${passed} checks)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
