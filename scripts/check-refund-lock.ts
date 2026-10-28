/**
 * Erstattung (AGB § 9 Abs. 5): volle Erstattung eines v3-Kaufs sperrt sofort
 * (Option 1 und Jahrespaket, Abo wird gekündigt und hält keinen Zugang);
 * Altkunden, DS24, v2-Altzeilen und fremde Zahlungen bleiben unverändert.
 * Synthetisch: kein Stripe, kein Sheet.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

for (const name of [
  "PRICING_MODEL", "PLAN_ACCESS_ENABLED", "PLAN_LIFECYCLE_ENABLED", "STRIPE_SECRET_KEY", "STRIPE_SECRET_KEY_NEW",
  "STRIPE_TEST_SECRET_KEY", "GOOGLE_SHEETS_SPREADSHEET_ID", "BLOB_READ_WRITE_TOKEN", "VERCEL_ENV",
]) delete process.env[name];

let passed = 0;
async function check(name: string, run: () => void | Promise<void>) {
  await run();
  passed += 1;
  console.log(`ok: ${name}`);
}

async function main() {
  const plan = await import("@/lib/plan");
  const store = await import("@/lib/plan-store");
  const webhook = await import("@/lib/plan-webhook");
  type PlanRow = import("@/lib/plan").PlanRow;
  const AT = "2026-11-05T00:00:00.000Z";
  const EMAIL = "kunde@firma-neu.de";
  const base = (extra: Partial<PlanRow>): PlanRow => ({
    ...plan.emptyPlanRow(EMAIL, "2026-11-02T10:00:00.000Z"),
    purchasedAt: "2026-11-02T10:00:00.000Z",
    accessUntil: "2026-12-02T10:00:00.000Z",
    retentionUntil: "2027-11-02T10:00:00.000Z",
    processedSessions: "cs_v3_entry",
    pricingModel: "v3",
    ...extra,
  });

  async function refund(row: PlanRow | null, charge: { refunded: boolean; metadata: Record<string, string> }, ids: { sessionId?: string; subscriptionId?: string } = {}) {
    let saved: PlanRow | null = null;
    const cancelled: string[] = [];
    store.setPlanStoreForTests({ read: async () => (row ? [row] : []), write: async (next) => { saved = next; } });
    const result = await webhook.recordPlanRefund({
      charge, email: EMAIL, eventId: "evt_r", at: AT, ...ids,
      cancelSubscription: async (id) => void cancelled.push(id),
    });
    store.setPlanStoreForTests(null);
    return { result, saved: saved as PlanRow | null, cancelled };
  }

  await check("Option 1 (v3) erstattet: sofort gesperrt inkl. Download", async () => {
    const out = await refund(base({ plan: "single" }), { refunded: true, metadata: { gobd_kind: "entry" } });
    assert.equal(out.result, "locked");
    assert.equal(out.saved?.refundedAt, AT);
    const access = plan.planAccess(out.saved!, new Date(AT));
    assert.equal(access.state, "refunded");
    assert.equal(access.writesOpen, false);
    assert.equal(access.downloadsOpen, false);
    assert.equal(access.newVersionAllowed, false);
  });

  await check("Option 1 (v3) über Session-ID belegt (ohne Metadaten)", async () => {
    const out = await refund(base({ plan: "single" }), { refunded: true, metadata: {} }, { sessionId: "cs_v3_entry" });
    assert.equal(out.result, "locked");
  });

  await check("Jahrespaket (v3) erstattet: Abo gekündigt, kein Zugang, auch nach späterem Abo-Update", async () => {
    const member = base({ plan: "member", memberStatus: "active", memberSubscriptionId: "sub_v3", memberPeriodEnd: "2027-11-02T10:00:00.000Z" });
    const out = await refund(member, { refunded: true, metadata: {} }, { subscriptionId: "sub_v3" });
    assert.equal(out.result, "locked");
    assert.deepEqual(out.cancelled, ["sub_v3"]);
    assert.equal(plan.planAccess(out.saved!, new Date(AT)).downloadsOpen, false);
    // Ein verspätetes subscription.updated (active) darf den Zugang nicht zurückgeben.
    const updated = plan.applyMemberSubscriptionUpdate(out.saved!, {
      at: AT, eventId: "evt_u", status: "active", periodEnd: "2027-11-02T10:00:00.000Z", cancelAt: "",
    } as Parameters<typeof plan.applyMemberSubscriptionUpdate>[1]);
    const after = plan.planAccess(updated, new Date(AT));
    assert.equal(after.state, "refunded");
    assert.equal(after.writesOpen, false);
    assert.equal(after.downloadsOpen, false);
  });

  await check("Nicht v3: Altzeile v2, fremde Zahlung, kein Plan (Alt/DS24), Teilerstattung, Änderung -> unverändert", async () => {
    let out = await refund(base({ plan: "single", pricingModel: "" }), { refunded: true, metadata: { gobd_kind: "entry" } });
    assert.equal(out.result, "ignored");
    assert.equal(out.saved, null);
    out = await refund(base({ plan: "member", memberStatus: "active", memberSubscriptionId: "sub_v3" }), { refunded: true, metadata: {} }, { subscriptionId: "sub_alt_49", sessionId: "cs_alt_149" });
    assert.equal(out.result, "ignored");
    assert.deepEqual(out.cancelled, []);
    out = await refund(null, { refunded: true, metadata: {} });
    assert.equal(out.result, "ignored");
    assert.equal(out.saved, null);
    out = await refund(base({ plan: "single" }), { refunded: false, metadata: { gobd_kind: "entry" } });
    assert.equal(out.result, "ignored");
    out = await refund(base({ plan: "single" }), { refunded: true, metadata: { gobd_kind: "change" } });
    assert.equal(out.result, "ignored");
  });

  await check("Zuordnung rein: refundBelongsToV3Purchase", () => {
    const row = base({ memberSubscriptionId: "sub_v3" });
    assert.equal(webhook.refundBelongsToV3Purchase(row, { kind: null }), false);
    assert.equal(webhook.refundBelongsToV3Purchase(row, { kind: "entry" }), true);
    assert.equal(webhook.refundBelongsToV3Purchase(row, { kind: null, subscriptionId: "sub_v3" }), true);
    assert.equal(webhook.refundBelongsToV3Purchase(row, { kind: null, sessionId: "cs_v3_entry" }), true);
    assert.equal(webhook.refundBelongsToV3Purchase({ ...row, pricingModel: "" }, { kind: "entry", subscriptionId: "sub_v3" }), false);
  });

  await check("Webhook: Legacy-Pfad unverändert (Inhaber-Hinweis, Bedingung), Beleg an recordPlanRefund", () => {
    const src = readFileSync("app/api/stripe/webhook/route.ts", "utf8");
    const start = src.indexOf('case "charge.refunded"');
    const block = src.slice(start, src.indexOf('case "charge.dispute.created"'));
    assert.ok(block.includes("if (planKindFromMetadata(charge.metadata) || planAccessEnabled())"));
    assert.ok(block.includes("subscriptionId,"));
    assert.ok(block.includes("ownerNoticeFromStripeEvent(event"));
    assert.ok(!/refunds\.create|charges\.update|invoices\.(update|void|del)/.test(block), "keine Änderung an Stripe-Belegen");
  });

  console.log(`check:refund-lock ${passed} Prüfungen ok`);
}

main().catch((error) => {
  console.error("check:refund-lock FAIL", error instanceof Error ? error.message : "error");
  process.exit(1);
});
