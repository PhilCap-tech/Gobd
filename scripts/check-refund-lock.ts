/**
 * Erstattung (AGB § 9 Abs. 5): volle Erstattung eines v3-Kaufs sperrt sofort
 * (Option 1 und Jahrespaket, Abo wird gekündigt und hält keinen Zugang);
 * Altkunden, DS24, v2-Altzeilen und fremde Zahlungen bleiben unverändert.
 * Synthetisch: kein Stripe, kein Sheet.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Schalter-Isolation: echte Build-Umgebung (Prod) darf die Prüfungen nicht beeinflussen.
for (const name of [
  "RETENTION_EXECUTE_ENABLED", "RETENTION_DRY_RUN_ENABLED", "PLAN_ADDON_NOTICE_ENABLED",
  "RETENTION_NOTICE_ENABLED", "RETENTION_DELETE_ENABLED", "RENEWAL_NOTICE_ENABLED",
]) delete process.env[name];

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

  async function refund(row: PlanRow | null, charge: { refunded: boolean; metadata: Record<string, string> }, ids: { sessionId?: string; subscriptionId?: string; billingReason?: string } = {}) {
    let saved: PlanRow | null = null;
    const cancelled: string[] = [];
    const mailed: string[] = [];
    store.setPlanStoreForTests({ read: async () => (row ? [row] : []), write: async (next) => { saved = next; } });
    const result = await webhook.recordPlanRefund({
      charge, email: EMAIL, eventId: "evt_r", at: AT, ...ids,
      cancelSubscription: async (id) => void cancelled.push(id),
      onFirstPurchaseRefunded: async (next) => void mailed.push(next.email),
    });
    store.setPlanStoreForTests(null);
    return { result, saved: saved as PlanRow | null, cancelled, mailed };
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
    const out = await refund(member, { refunded: true, metadata: {} }, { subscriptionId: "sub_v3", billingReason: "subscription_create" });
    assert.equal(out.result, "locked");
    assert.deepEqual(out.mailed, [EMAIL]);
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
    out = await refund(base({ plan: "member", memberStatus: "active", memberSubscriptionId: "sub_v3" }), { refunded: true, metadata: {} }, { subscriptionId: "sub_alt_49", sessionId: "cs_alt_149", billingReason: "subscription_cycle" });
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

  await check("Erster Kauf voll erstattet: Kundenmail genau hier; Option 1 auch", async () => {
    const out = await refund(base({ plan: "single" }), { refunded: true, metadata: { gobd_kind: "entry" } });
    assert.deepEqual(out.mailed, [EMAIL]);
    for (const other of [
      await refund(base({ plan: "single" }), { refunded: false, metadata: { gobd_kind: "entry" } }),
      await refund(null, { refunded: true, metadata: {} }),
      await refund(base({ plan: "single", pricingModel: "" }), { refunded: true, metadata: { gobd_kind: "entry" } }),
    ]) assert.deepEqual(other.mailed, []);
  });

  await check("Verlängerung erstattet (subscription_cycle): wie gekündigtes Jahrespaket, kein refundedAt, keine Mail", async () => {
    // Erstkauf vor einem Jahr; die Verlängerung wurde gerade erstattet.
    const member = base({
      plan: "member", memberStatus: "active", memberSubscriptionId: "sub_v3", purchasedAt: "2025-11-02T10:00:00.000Z",
      accessUntil: "2025-12-02T10:00:00.000Z", memberPeriodEnd: "2027-11-02T10:00:00.000Z",
    });
    const out = await refund(member, { refunded: true, metadata: {} }, { subscriptionId: "sub_v3", billingReason: "subscription_cycle" });
    assert.equal(out.result, "deactivated");
    assert.deepEqual(out.cancelled, ["sub_v3"]);
    assert.deepEqual(out.mailed, []);
    assert.equal(out.saved?.refundedAt, "");
    assert.equal(out.saved?.memberEndedAt, AT);
    assert.equal(out.saved?.memberStatus, "canceled");
    const access = plan.planAccess(out.saved!, new Date(AT));
    assert.equal(access.state, "expired", "Konto deaktiviert");
    assert.equal(access.downloadsOpen, false);
    assert.ok(plan.reactivatableUntil(out.saved!), "reaktivierbar");
    // Reaktivierungskauf (eigener Zyklus) erstattet: ebenso deaktiviert, kein § 9 Abs. 5.
    const react = await refund({ ...member, reactivatedAt: "2026-11-04T00:00:00.000Z" }, { refunded: true, metadata: {} }, { subscriptionId: "sub_v3", billingReason: "subscription_create" });
    assert.equal(react.result, "deactivated");
    // Abo-Zahlung ohne bekannten billing_reason: nichts (fail closed).
    const unknown = await refund(member, { refunded: true, metadata: {} }, { subscriptionId: "sub_v3" });
    assert.equal(unknown.result, "ignored");
  });

  await check("Nachgebuchtes Jahrespaket in der ersten Periode (subscription_create) = Teil des ersten Kaufs", () => {
    const row = base({ plan: "member", memberStatus: "active", memberSubscriptionId: "sub_add" });
    assert.equal(webhook.classifyV3Refund(row, { kind: null, subscriptionId: "sub_add", billingReason: "subscription_create" }), "first");
    assert.equal(webhook.classifyV3Refund(row, { kind: null, subscriptionId: "sub_add", billingReason: "subscription_cycle" }), "renewal");
    assert.equal(webhook.classifyV3Refund(row, { kind: "reactivate" }), "renewal");
    assert.equal(webhook.classifyV3Refund(row, { kind: "entry" }), "first");
  });

  await check("Mail d-0: genau eine bei Erstattung des ersten Kaufs; nur mit RETENTION_EXECUTE_ENABLED; HMAC; Legal-Wortlaut", async () => {
    const refundMail = await import("@/lib/refund-mail");
    const dedupe = await import("@/lib/mail-dedupe");
    const row = base({ email: "kunde@example.com", refundedAt: AT });
    const sent: Array<{ dedupeKey: string; to: string; subject: string; text: string }> = [];
    const send = (async (input: { dedupeKey: string; to: string; subject: string; text: string }) => {
      sent.push(input);
      return { stub: false, sent: !sent.slice(0, -1).some((item) => item.dedupeKey === input.dedupeKey) };
    }) as unknown as typeof dedupe.sendDedupedEmail;
    assert.equal(await refundMail.sendRefundMail(row, { option2: false }, send), "skipped", "Schalter aus");
    process.env.RETENTION_EXECUTE_ENABLED = "true";
    assert.equal(await refundMail.sendRefundMail(row, { option2: false, company: "Muster GmbH" }, send), "sent");
    assert.equal(await refundMail.sendRefundMail(row, { option2: false, company: "Muster GmbH" }, send), "skipped", "einmal");
    delete process.env.RETENTION_EXECUTE_ENABLED;
    assert.equal(sent[0]!.subject, "Bestätigung Ihrer Erstattung für Muster GmbH");
    assert.ok(sent[0]!.text.includes("spätestens innerhalb von 24 Stunden"));
    assert.ok(!sent[0]!.text.includes("Jahrespaket;"));
    process.env.MAGIC_LINK_SECRET = "check-refund-lock-offline-secret";
    const stored = dedupe.storedMailDedupeKey(sent[0]!.dedupeKey);
    assert.ok(stored.startsWith("refund-confirm:h1:") && !stored.includes("@"));
    assert.equal(refundMail.refundWasOption2(base({ plan: "member", memberSubscriptionId: "sub" })), true);
    assert.equal(refundMail.refundWasOption2(base({ plan: "single" })), false);
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
    assert.ok(block.includes("billingReason,"));
    assert.ok(block.includes("onFirstPurchaseRefunded"));
    assert.ok(block.includes("ownerNoticeFromStripeEvent(event"));
    assert.ok(!/refunds\.create|charges\.update|invoices\.(update|void|del)/.test(block), "keine Änderung an Stripe-Belegen");
  });

  await check("Reihenfolge: refunded_at wird gespeichert, bevor das Abo gekündigt wird (kein Überschreiben durch subscription.deleted)", async () => {
    const order: string[] = [];
    const row = base({ plan: "member", memberSubscriptionId: "sub_first", memberStatus: "active" });
    store.setPlanStoreForTests({ read: async () => [row], write: async (next) => void order.push(`save:${next.refundedAt ? "refunded" : "plain"}`) });
    const result = await webhook.recordPlanRefund({
      charge: { refunded: true, metadata: {} }, email: EMAIL, eventId: "evt_o", at: AT,
      subscriptionId: "sub_first", billingReason: "subscription_create",
      cancelSubscription: async (id) => void order.push(`cancel:${id}`),
    });
    store.setPlanStoreForTests(null);
    assert.equal(result, "locked");
    assert.deepEqual(order, ["save:refunded", "cancel:sub_first"]);
  });
  console.log(`check:refund-lock ${passed} Prüfungen ok`);
}

main().catch((error) => {
  console.error("check:refund-lock FAIL", error instanceof Error ? error.message : "error");
  process.exit(1);
});
