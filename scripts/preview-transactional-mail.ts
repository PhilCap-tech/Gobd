/**
 * Writes wrapped transactional mail previews for visual review.
 * Usage: npx tsx scripts/preview-transactional-mail.ts [outdir]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  buildDeliveryMail,
  buildFailedJobMail,
  buildFailedPaymentMail,
  buildMagicLinkMail,
  buildOnboardingMail,
  buildReadinessMail,
} from "@/lib/ops";
import {
  MAIL_CHECKOUT_URL,
  MAIL_FAQ_URL,
  MAIL_HOME_URL,
  MAIL_SUPPORT_EMAIL,
} from "@/lib/mail-layout";

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

const files: Record<string, string> = {
  "magic-link.html": magic.html,
  "readiness.html": readiness.html,
  "onboarding.html": onboarding.html,
  "failed-payment.html": failedPayment.html,
  "failed-job.html": failedJob.html,
  "delivery.html": delivery.html,
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
