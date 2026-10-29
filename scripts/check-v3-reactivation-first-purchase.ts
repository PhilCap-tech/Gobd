/**
 * Philip 28.10.: purchased_at bleibt bei der Reaktivierung der ERSTE Kauf.
 * reactivated_at bestimmt Zugang, Jahr und Löschfrist (12 Monate ab dem
 * späteren der beiden). Kein neues 14-Tage-Erstattungsfenster, keine erneute
 * Refund-Mail / Einmal-Hinweise (Schlüssel am Erstkauf). Nur die
 * Löschhinweise (30/7) beziehen sich auf die neue Frist. Synthetisch.
 */
import assert from "node:assert/strict";

for (const name of ["STRIPE_SECRET_KEY", "RESEND_API_KEY", "GOOGLE_SHEETS_SPREADSHEET_ID", "BLOB_READ_WRITE_TOKEN"]) delete process.env[name];
let passed = 0;
async function check(name: string, run: () => void | Promise<void>) {
  await run();
  passed += 1;
  console.log(`ok: ${name}`);
}
const DAY = 24 * 60 * 60 * 1000;

async function main() {
  const plan = await import("@/lib/plan");
  const webhook = await import("@/lib/plan-webhook");
  const decision = await import("@/lib/retention-decision");
  const refundMail = await import("@/lib/refund-mail");
  const addon = await import("@/lib/plan-addon-notice");
  const mail = await import("@/lib/retention-mail");

  const FIRST = "2026-01-10T10:00:00.000Z";
  const REACT = "2026-10-28T20:00:00.000Z";
  const base = { email: "kunde@firma-neu.de", sessionId: "", eventId: "", customerId: "cus_1", subscriptionId: "" };
  const first = webhook.planAfterCheckout(null, { ...base, kind: "entry", member: false, at: FIRST, sessionId: "cs_1", eventId: "evt_1" })!;
  assert.equal(first.purchasedAt, FIRST);
  const expired = { ...first, notice30At: "2026-12-11T10:00:00.000Z" };
  const re = webhook.planAfterCheckout(expired, { ...base, kind: "reactivate", member: true, at: REACT, sessionId: "cs_2", eventId: "evt_2", subscriptionId: "sub_2" })!;

  await check("purchased_at bleibt Erstkauf, reactivated_at = Reaktivierung", () => {
    assert.equal(re.purchasedAt, FIRST, "purchased_at wurde überschrieben");
    assert.equal(re.reactivatedAt, REACT);
  });

  await check("Zugang und Jahr ab reactivated_at", () => {
    assert.equal(re.memberPeriodEnd, plan.addMonthsIso(REACT, 12));
    assert.ok(Date.parse(re.accessUntil) >= Date.parse(REACT) + 30 * DAY - 1);
    assert.equal(plan.planState(re, new Date(Date.parse(REACT) + DAY)), "member");
  });

  await check("Kein neues 14-Tage-Erstattungsfenster nach Reaktivierung", () => {
    const status = plan.refundStatus(re, [], new Date(Date.parse(REACT) + DAY));
    assert.equal(status.refundable, false);
    assert.equal(status.deadline, new Date(Date.parse(FIRST) + 14 * DAY).toISOString());
  });

  await check("Refund-Mail und Add-on-Hinweis: Dedupe-Schlüssel bleiben am Erstkauf", () => {
    assert.equal(refundMail.refundMailKey(re.email, re.purchasedAt), refundMail.refundMailKey(first.email, first.purchasedAt));
    assert.equal(addon.addonNoticeMailKey(re), addon.addonNoticeMailKey(first));
  });

  await check("Löschfrist 12 Monate ab dem späteren Datum; Hinweise 30/7 laufen einmal neu", () => {
    // Jahrespaket nach der Reaktivierung wieder beendet → Zeile wie Option 1 ohne laufendes Abo.
    const single = { ...re, plan: "single", memberStatus: "", memberPeriodEnd: "", memberEndedAt: "", retentionUntil: "" } as typeof re;
    const due = plan.addMonthsIso(REACT, 12);
    assert.equal(decision.docDeadline(single, new Date(REACT))?.dueAt, new Date(due).toISOString());
    const old = { ...single, notice30At: "2026-10-01T10:00:00.000Z" };
    assert.equal(decision.decideDoc(old, new Date(Date.parse(due) - 30 * DAY)).action, "notice30", "alter Hinweis zählt nicht");
    assert.notEqual(
      mail.retentionNoticeMailKey("notice30", single.email, plan.addMonthsIso(FIRST, 12)),
      mail.retentionNoticeMailKey("notice30", single.email, new Date(due).toISOString()),
    );
    // Beendetes Jahrespaket nach Reaktivierung: Frist ab Ende, nie früher als Reaktivierung + 12 Monate.
    const ended = { ...re, plan: "single", memberStatus: "canceled", memberEndedAt: "2026-11-30T00:00:00.000Z" } as typeof re;
    const d = decision.docDeadline(ended, new Date("2026-12-01T00:00:00.000Z"));
    assert.ok(d && Date.parse(d.dueAt) >= Date.parse(due));
  });

  await check("Reaktivierbar bis: ab reactivated_at, nicht ab Erstkauf", () => {
    const row = { ...re, plan: "single", memberEndedAt: "" } as typeof re;
    assert.equal(plan.reactivatableUntil(row), plan.addMonthsIso(REACT, 12));
  });

  console.log(`check:v3-reactivation-first-purchase ${passed} ok`);
}
main().catch((error) => {
  console.error(error);
  process.exit(1);
});
