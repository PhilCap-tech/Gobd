/**
 * Owner notices use the Messlücken cohort address list.
 * No mail is sent and no store is opened.
 *
 *   npm run check:owner-notice-testaddr
 */
import assert from "node:assert/strict";

for (const key of [
  "RESEND_API_KEY",
  "EMAIL_FROM",
  "BLOB_READ_WRITE_TOKEN",
  "GOOGLE_SERVICE_ACCOUNT_EMAIL",
  "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY",
  "GOOGLE_SHEETS_SPREADSHEET_ID",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
]) {
  delete process.env[key];
}

function ok(cond: unknown, msg: string): void {
  assert.ok(cond, msg);
  console.log("ok:", msg);
}

async function main(): Promise<void> {
  const { isMeasureTestEmail } = await import("../lib/measure-test");
  const { isOwnerNoticeTestEmail, ownerNoticeDue } = await import("../lib/owner-notice");

  const due = (email: string) =>
    ownerNoticeDue({
      kind: "account",
      id: "addr-check",
      title: "Neues Konto / erste Anmeldung",
      email,
    });

  const cohort = [
    "gobd-test@mail.grokbot.com",
    "gobd-test+r321@mail.grokbot.com",
    "GOBD-TEST+R321@MAIL.GROKBOT.COM",
    "  Gobd-Test+R321@Mail.Grokbot.com  ",
    "delivered+r321@resend.dev",
    "Delivered+Tag@Resend.Dev",
    "cappe@gmx.de",
    "Cappe@GMX.de",
  ];
  for (const email of cohort) {
    ok(isMeasureTestEmail(email), `${JSON.stringify(email)} is a cohort test address`);
    ok(isOwnerNoticeTestEmail(email), `${JSON.stringify(email)} is an owner-notice test address`);
    ok(!due(email), `${JSON.stringify(email)} does not queue an owner notice`);
  }

  const ordinary = [
    "gobd-test+x@mail.grokbot.com.evil.com",
    "xgobd-test@mail.grokbot.com",
    "gobd-testx@mail.grokbot.com",
    "kunde@firma.example",
  ];
  for (const email of ordinary) {
    ok(!isMeasureTestEmail(email), `${email} is not a cohort test address`);
    ok(!isOwnerNoticeTestEmail(email), `${email} is not an owner-notice test address`);
    ok(due(email), `${email} still produces an owner notice`);
  }

  console.log("check-owner-notice-testaddr: ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
