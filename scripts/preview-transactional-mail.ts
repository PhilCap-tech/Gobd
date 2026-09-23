/**
 * Writes wrapped transactional mail previews for visual review.
 * Usage: npx tsx scripts/preview-transactional-mail.ts [outdir]
 */
import { mkdirSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { isMailConfigured } from "@/lib/env";
import {
  buildDeliveryMail,
  buildFailedJobMail,
  buildFailedPaymentMail,
  buildMagicLinkMail,
  buildOnboardingMail,
  buildReadinessMail,
  buildReferralAfterDeliveryMail,
  REFERRAL_AFTER_DELIVERY_SUBJECT,
  REFERRAL_AFTER_DELIVERY_URL,
  REFERRAL_MICRO,
  sendReferralAfterDeliveryMail,
} from "@/lib/ops";
import {
  MAIL_CHECKOUT_URL,
  MAIL_FAQ_URL,
  MAIL_HOME_URL,
  MAIL_LOGIN_URL,
  MAIL_SUPPORT_EMAIL,
} from "@/lib/mail-layout";
import {
  referralDeliveryKey,
  reserveReferralDelivery,
  setReferralLedgerFile,
} from "@/lib/referral-sent";

const outDir = path.resolve(process.argv[2] || "/tmp/gobd-mail-preview");
mkdirSync(outDir, { recursive: true });

const magic = buildMagicLinkMail({
  magicLinkUrl: "https://www.gobd-doku-erstellen.de/auth/verify?token=preview",
});
const readiness = buildReadinessMail({
  name: "Alex",
  brancheLabel: "Handwerk",
  downloadUrl:
    "https://www.gobd-doku-erstellen.de/api/readiness/preview/download?token=preview",
  magicLinkUrl: "https://www.gobd-doku-erstellen.de/auth/verify?token=readiness-preview",
});
const onboarding = buildOnboardingMail({ company: "Muster GmbH" });
const failedPayment = buildFailedPaymentMail();
const failedJob = buildFailedJobMail();
const delivery = buildDeliveryMail({
  company: "Muster GmbH",
  downloadUrl: "https://www.gobd-doku-erstellen.de/api/docs/preview/download",
  successUrl: "https://www.gobd-doku-erstellen.de/success?session_id=preview",
  magicLinkUrl: "https://www.gobd-doku-erstellen.de/auth/verify?token=delivery-preview",
  version: 1,
});
const referral = buildReferralAfterDeliveryMail({ company: "Muster GmbH" });
const referralNoCompany = buildReferralAfterDeliveryMail({ company: "  " });

const files: Record<string, string> = {
  "magic-link.html": magic.html,
  "readiness.html": readiness.html,
  "onboarding.html": onboarding.html,
  "failed-payment.html": failedPayment.html,
  "failed-job.html": failedJob.html,
  "delivery.html": delivery.html,
  "referral-after-delivery.html": referral.html,
};

for (const [name, html] of Object.entries(files)) {
  const file = path.join(outDir, name);
  writeFileSync(file, html, "utf8");
  console.log(file);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function hasPageReadinessHref(html: string): boolean {
  return /href="https?:\/\/[^/"]+\/readiness(?:\/|\?|"|#)/.test(html);
}

for (const [name, html] of Object.entries(files)) {
  assert(html.includes("logo-lockup.png"), `${name}: missing logo`);
  assert(html.includes(MAIL_HOME_URL), `${name}: logo must link to site home`);
  assert(html.includes("/impressum"), `${name}: missing Impressum`);
  assert(html.includes("/faq"), `${name}: missing FAQ`);
  assert(html.includes("/datenschutz"), `${name}: missing Datenschutz`);
  assert(html.includes("mailto:info@gobd-doku-erstellen.de"), `${name}: missing Kontakt`);
  assert(html.includes("Gartzenweg 1a"), `${name}: missing IKAT address`);
  assert(!/unsubscribe/i.test(html), `${name}: transactional mail must not include unsubscribe`);
}

assert(!hasPageReadinessHref(onboarding.html), "Onboarding must not link to /readiness");
assert(!hasPageReadinessHref(delivery.html), "Delivery must not link to /readiness");
assert(
  readiness.html.includes(MAIL_CHECKOUT_URL),
  "Readiness mail must include Checkout upsell",
);
assert(
  readiness.html.includes("Jetzt Verfahrensdokumentation erstellen — 149 € + 49 €/Mo"),
  "Readiness mail must use Growth Checkout CTA",
);
assert(
  !hasPageReadinessHref(readiness.html),
  "Readiness upsell must not loop to /readiness",
);
assert(
  failedPayment.html.includes("https://www.gobd-doku-erstellen.de/account"),
  "Failed Payment must point to /account",
);
assert(
  !failedPayment.html.includes("/account/billing"),
  "Failed Payment must use /account, not /account/billing",
);
assert(
  failedJob.subject === "Technisches Problem bei der Erstellung — wir kümmern uns",
  "Failed Job subject must match Ops copy",
);
assert(
  failedJob.html.includes(MAIL_FAQ_URL),
  "Failed Job must link to FAQ",
);
assert(
  failedJob.html.includes(`mailto:${MAIL_SUPPORT_EMAIL}`),
  "Failed Job must link to support",
);
assert(
  failedJob.html.includes(MAIL_SUPPORT_EMAIL),
  "Failed Job must include support email",
);
assert(
  failedJob.text.includes(MAIL_FAQ_URL),
  "Failed Job plain text must include FAQ",
);
assert(
  failedJob.text.includes(MAIL_SUPPORT_EMAIL),
  "Failed Job plain text must include support email",
);
assert(
  !/unsubscribe/i.test(failedJob.text),
  "Failed Job plain text must not include unsubscribe",
);
assert(
  !/Philip|Wiederholte Failures/i.test(`${failedJob.html}\n${failedJob.text}`),
  "Failed Job must not include internal Ops notes",
);
assert(
  readiness.text.includes("Keine Steuerberatung"),
  "Readiness plain text must include Steuerberatung disclaimer",
);
assert(
  referral.subject === REFERRAL_AFTER_DELIVERY_SUBJECT,
  "Referral subject must match Ops copy",
);
assert(
  referral.subject ===
    "Dein Entwurf ist fertig — gern an Steuerberater oder Kollegen weitergeben",
  "Referral subject must be exact",
);
const referralHref = REFERRAL_AFTER_DELIVERY_URL.replaceAll("&", "&amp;");
assert(
  referral.html.includes(`href="${referralHref}"`),
  "Referral HTML must link the exact UTM product URL",
);
assert(
  referral.text.includes(REFERRAL_AFTER_DELIVERY_URL),
  "Referral plain text must include the exact UTM product URL",
);
assert(
  referral.html.includes("utm_source=referral") &&
    referral.html.includes("utm_medium=email") &&
    referral.html.includes("utm_campaign=post_delivery"),
  "Referral HTML must include the post_delivery UTM campaign",
);
assert(referral.html.includes(MAIL_FAQ_URL), "Referral HTML must link to FAQ");
assert(
  referral.text.includes(MAIL_FAQ_URL),
  "Referral plain text must include FAQ",
);
assert(
  referral.html.includes(MAIL_LOGIN_URL),
  "Referral HTML must link to login",
);
assert(
  referral.text.includes(MAIL_LOGIN_URL),
  "Referral plain text must include login",
);
assert(
  referral.html.includes(REFERRAL_MICRO),
  "Referral HTML must include the pricing micro line",
);
assert(
  referral.html.includes("149 €"),
  "Referral HTML must keep the 149 € setup price",
);
assert(
  referral.html.includes("49 €/Monat"),
  "Referral HTML must keep the 49 €/Monat price",
);
assert(
  !/unsubscribe/i.test(referral.html),
  "Referral HTML must not include unsubscribe",
);
assert(
  !/unsubscribe/i.test(referral.text),
  "Referral plain text must not include unsubscribe",
);
assert(
  !referral.html.includes("/api/docs/"),
  "Referral must not attach or link a second PDF",
);
assert(
  !/PDF herunterladen/i.test(referral.html),
  "Referral must not repeat the delivery download CTA",
);
assert(
  referral.html.includes("Hallo Muster GmbH,"),
  "Referral greeting must include the company",
);
assert(
  referralNoCompany.text.startsWith("Hallo,"),
  "Empty company must render as Hallo,",
);
assert(
  !referralNoCompany.text.includes("Hallo ,"),
  "Empty company must not leave a gap in the greeting",
);

async function assertReferralIdempotency(): Promise<void> {
  const referralLedgerFile = path.join(outDir, "referral-ledger.json");
  try {
    unlinkSync(referralLedgerFile);
  } catch {
    // fresh preview dir
  }
  setReferralLedgerFile(referralLedgerFile);
  const sameDelivery = referralDeliveryKey({
    documentId: "ledger-doc",
    sessionId: "ledger-session",
  });
  const nextDelivery = referralDeliveryKey({
    documentId: "ledger-doc-v2",
    sessionId: "ledger-session",
  });
  assert(sameDelivery, "document id must produce a referral key");
  assert(nextDelivery && nextDelivery !== sameDelivery, "a new version is a new delivery key");
  assert(
    referralDeliveryKey({ sessionId: "ledger-session-only" }) === "session-ledger-session-only",
    "session id is the fallback key",
  );
  assert(referralDeliveryKey({}) === null, "missing delivery ids have no key");
  assert((await reserveReferralDelivery(sameDelivery)) === "reserved", "first reserve claims the delivery");
  assert(
    (await reserveReferralDelivery(sameDelivery)) === "duplicate",
    "a second reserve of the same delivery skips",
  );
  const raceKey = referralDeliveryKey({ documentId: "race-doc" });
  assert(raceKey, "race fixture needs a key");
  const [raceA, raceB] = await Promise.all([
    reserveReferralDelivery(raceKey),
    reserveReferralDelivery(raceKey),
  ]);
  assert(
    [raceA, raceB].filter((result) => result === "reserved").length === 1 &&
      [raceA, raceB].filter((result) => result === "duplicate").length === 1,
    "parallel reserves of one delivery must claim only once",
  );
  assert((await reserveReferralDelivery(nextDelivery)) === "reserved", "new version can reserve");

  if (isMailConfigured()) {
    console.info(
      "[preview] Mail-Env gesetzt — Idempotenz nur über das Ledger, kein Live-Versand",
    );
  } else {
    const first = await sendReferralAfterDeliveryMail({
      email: "preview@example.com",
      company: "Muster GmbH",
      documentId: "preview-doc",
      sessionId: "preview-session",
    });
    const duplicate = await sendReferralAfterDeliveryMail({
      email: "preview@example.com",
      company: "Muster GmbH",
      documentId: "preview-doc",
      sessionId: "preview-session",
    });
    const nextVersion = await sendReferralAfterDeliveryMail({
      email: "preview@example.com",
      company: "Muster GmbH",
      documentId: "preview-doc-v2",
      sessionId: "preview-session",
    });
    const missingEmail = await sendReferralAfterDeliveryMail({
      email: "  ",
      documentId: "preview-doc-v2",
      sessionId: "preview-session",
    });
    const missingId = await sendReferralAfterDeliveryMail({
      email: "preview@example.com",
    });
    const sessionFirst = await sendReferralAfterDeliveryMail({
      email: "preview@example.com",
      sessionId: "preview-session-only",
    });
    const sessionDuplicate = await sendReferralAfterDeliveryMail({
      email: "preview@example.com",
      sessionId: "preview-session-only",
    });
    assert(first.skipped === false && first.stub === true && first.sent === false, "First referral stub must run once");
    assert(first.action === "referral_after_delivery", "Referral action must be distinct");
    assert(duplicate.skipped === true && duplicate.sent === false, "Duplicate delivery must skip referral");
    assert(nextVersion.skipped === false, "A new document version is a new delivery event");
    assert(missingEmail.skipped === true && missingEmail.sent === false, "Missing email must skip");
    assert(missingId.skipped === true && missingId.sent === false, "Missing delivery id must skip");
    assert(sessionFirst.skipped === false, "Session-only delivery sends once");
    assert(sessionDuplicate.skipped === true, "Same session without a new document skips");
  }
}

assertReferralIdempotency().catch((error) => {
  console.error(error);
  process.exit(1);
});
