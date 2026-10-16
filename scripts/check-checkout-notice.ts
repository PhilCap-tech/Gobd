/**
 * Internal paid-checkout note: one mail to the operator, never the customer.
 * Live and paid only. A listed test firm is skipped. The dedupe ledger
 * keeps a second delivery, including a parallel one, from sending again.
 */
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import {
  CHECKOUT_NOTICE_TO,
  formatCheckoutNoticeAmount,
  formatCheckoutNoticeTime,
  notifyCheckoutPaid,
  type CheckoutNoticeInput,
} from "../lib/checkout-notice";
import { setMailDedupeTestHooks } from "../lib/mail-dedupe";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const LISTED = "48c6805d-3d34-4a80-9747-38ce4edb3eed";
const NORMAL = "11111111-1111-4111-8111-111111111111";
const CUSTOMER = "buyer.notice@example.com";

function fail(message: string): never {
  console.error(`check-checkout-notice: ${message}`);
  process.exit(1);
}

function ok(condition: unknown, message: string): void {
  if (!condition) fail(message);
  console.log("ok:", message);
}

function paid(sessionId: string, patch: Partial<CheckoutNoticeInput> = {}): CheckoutNoticeInput {
  return {
    livemode: true,
    paymentStatus: "paid",
    entityId: NORMAL,
    sessionId,
    company: "Echte GmbH",
    email: CUSTOMER,
    amountTotal: 19900,
    currency: "eur",
    created: 1760630400,
    ...patch,
  };
}

type Captured = { to: string; subject: string; text: string; html: string };

async function main(): Promise<void> {
  const dir = mkdtempSync(path.join(tmpdir(), "checkout-notice-"));
  const sends: Captured[] = [];
  setMailDedupeTestHooks({
    dir,
    send: async (input) => {
      sends.push({
        to: input.to,
        subject: input.subject,
        text: input.text,
        html: input.html,
      });
      return { stub: false, sent: true, id: "email_notice" };
    },
  });

  try {
    const sessionId = "cs_live_notice_once";
    const input = paid(sessionId);
    const first = await notifyCheckoutPaid(input);
    const second = await notifyCheckoutPaid(input);
    ok(first.sent === true && first.duplicate !== true, "the first live payment sends once");
    ok(second.duplicate === true && second.sent === false, "a retry of the same session does not send again");
    ok(sends.length === 1, "Resend is called once for one session");

    const mail = sends[0];
    ok(mail?.to === CHECKOUT_NOTICE_TO && mail.to === "cappe@gmx.de", "the only recipient is cappe@gmx.de");
    ok(mail.to !== CUSTOMER, "the customer is not the recipient");
    ok(mail.text.includes("Echte GmbH") && mail.html.includes("Echte GmbH"), "the note names the company");
    ok(mail.text.includes(CUSTOMER) && mail.html.includes(CUSTOMER), "the note names the customer e-mail");
    ok(
      mail.text.includes(formatCheckoutNoticeAmount(19900, "eur")) &&
        mail.html.includes(formatCheckoutNoticeAmount(19900, "eur")),
      "the note includes the amount and currency",
    );
    ok(
      mail.text.includes(formatCheckoutNoticeTime(input.created)) &&
        mail.html.includes(formatCheckoutNoticeTime(input.created)),
      "the note includes the Europe/Berlin time",
    );
    ok(mail.text.includes(sessionId) && mail.html.includes(sessionId), "the note includes the Stripe session id");
    ok(mail.text.includes("Europe/Berlin"), "the time is labeled Europe/Berlin");

    const [left, right] = await Promise.all([
      notifyCheckoutPaid(paid("cs_live_notice_parallel")),
      notifyCheckoutPaid(paid("cs_live_notice_parallel")),
    ]);
    const parallelSends = sends.filter((item) => item.text.includes("cs_live_notice_parallel"));
    const parallelSent = [left, right].filter((item) => item.sent).length;
    const parallelDuplicate = [left, right].filter((item) => item.duplicate).length;
    ok(
      parallelSends.length === 1 && parallelSent === 1 && parallelDuplicate === 1,
      "parallel deliveries of one session send one mail",
    );

    const beforeSkip = sends.length;
    const listed = await notifyCheckoutPaid(
      paid("cs_live_notice_listed", { entityId: LISTED.toUpperCase() }),
    );
    ok(listed.skipped === true && listed.sent === false, "a listed test firm is skipped");
    ok(sends.length === beforeSkip, "a listed test firm does not call Resend");

    const testMode = await notifyCheckoutPaid(paid("cs_test_notice_mode", { livemode: false }));
    ok(testMode.skipped === true && testMode.sent === false, "a non-live session is skipped");
    const unpaid = await notifyCheckoutPaid(paid("cs_live_notice_unpaid", { paymentStatus: "unpaid" }));
    ok(unpaid.skipped === true && unpaid.sent === false, "an unpaid session is skipped");
    const notCharged = await notifyCheckoutPaid(
      paid("cs_live_notice_free", { paymentStatus: "no_payment_required" }),
    );
    ok(notCharged.skipped === true && notCharged.sent === false, "a session that is not paid is skipped");
    ok(sends.length === beforeSkip, "non-live and unpaid sessions do not call Resend");

    setMailDedupeTestHooks({
      dir,
      send: async () => {
        throw new Error("resend down");
      },
    });
    const failed = await notifyCheckoutPaid(paid("cs_live_notice_fail"));
    ok(failed.sent === false, "a failed notification does not report a send");
  } finally {
    setMailDedupeTestHooks(null);
  }

  const notice = readFileSync(path.join(root, "lib/checkout-notice.ts"), "utf8");
  ok(notice.includes('to: CHECKOUT_NOTICE_TO'), "the send target is the fixed operator address");
  ok(!notice.includes("to: input.email"), "the customer address is not the send target");
  const webhook = readFileSync(path.join(root, "app/api/stripe/webhook/route.ts"), "utf8");
  ok(webhook.includes("notifyCheckoutPaid"), "checkout completion calls the internal note");
  ok(webhook.includes("livemode: session.livemode"), "the note sees livemode from the session");
  ok(webhook.includes("paymentStatus: session.payment_status"), "the note sees payment_status from the session");
  ok(webhook.includes("entityId: checkoutEntityId"), "the note sees the checkout firm");
  const call = webhook.indexOf("await notifyCheckoutPaid");
  const caught = webhook.indexOf("[webhook] Kaufhinweis nicht gesendet", call);
  ok(call > 0 && caught > call, "a failing note is caught inside the checkout handler");
  ok(webhook.includes("deliverBuyerOnboarding"), "the customer welcome mail stays on its own path");

  console.log("check-checkout-notice: ok");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
