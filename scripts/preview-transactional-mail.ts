/**
 * Writes wrapped transactional mail previews for visual review.
 * Usage: npx tsx scripts/preview-transactional-mail.ts [outdir]
 */
import { mkdirSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { loginPath, magicLinkUrl, safeNextPath } from "@/lib/auth";
import {
  buildDeliveryMail,
  buildFailedJobMail,
  buildFailedPaymentMail,
  buildMagicLinkMail,
  buildOnboardingMail,
  buildReadinessMail,
  checkoutContactFromCustomerDetails,
  CUSTOMER_ONBOARDING_CONTINUE_CTA,
  CUSTOMER_ONBOARDING_SIGNATURE,
  customerOnboardingDraftPath,
  customerOnboardingGreeting,
  intakeContactNameFromAnswers,
  PARTNER_ONBOARDING_SIGNATURE,
  pickOnboardingContactName,
  REFERRAL_AFTER_DELIVERY_URL,
  REFERRAL_MICRO,
} from "@/lib/ops";
import { MONTHLY_EUR, TODAY_EUR } from "@/lib/pricing";
import {
  MAIL_ACCOUNT_URL,
  MAIL_CHECKOUT_URL,
  MAIL_FAQ_URL,
  MAIL_HOME_URL,
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
const onboardingStartUrl =
  "https://www.gobd-doku-erstellen.de/auth/verify?token=preview-onboarding&next=%2Fintake";
const onboardingContinueUrl =
  "https://www.gobd-doku-erstellen.de/auth/verify?token=preview-continue&next=%2Fintake%3Fsession_id%3Dcs_owner_draft";
const onboarding = buildOnboardingMail({
  company: "Muster GmbH",
  contactName: "Philip Cappelletti",
  magicLinkUrl: onboardingStartUrl,
  continueUrl: onboardingContinueUrl,
});
const onboardingCompanyOnly = buildOnboardingMail({
  company: "IKAT GmbH",
  contactName: "IKAT GmbH",
  magicLinkUrl: onboardingStartUrl,
  continueUrl: onboardingContinueUrl,
});
const onboardingWhitespace = buildOnboardingMail({
  company: "Muster GmbH",
  contactName: "   \n  ",
  magicLinkUrl: onboardingStartUrl,
  continueUrl: onboardingContinueUrl,
});
const partnerOnboarding = buildOnboardingMail({
  company: "Beispiel Kanzlei",
  audience: "steuerberater",
});
const partnerOnboardingNoCompany = buildOnboardingMail({
  audience: "steuerberater",
});
const failedPayment = buildFailedPaymentMail();
const failedJob = buildFailedJobMail();
const delivery = buildDeliveryMail({
  company: "Muster GmbH",
  contactName: "Anna Berg",
  downloadUrl: "https://www.gobd-doku-erstellen.de/api/docs/preview/download",
  successUrl: "https://www.gobd-doku-erstellen.de/success?session_id=preview",
  magicLinkUrl: "https://www.gobd-doku-erstellen.de/auth/verify?token=delivery-preview",
  version: 1,
});
const deliveryCompanyOnly = buildDeliveryMail({
  company: "IKAT GmbH",
  contactName: "IKAT GmbH",
  downloadUrl: "https://www.gobd-doku-erstellen.de/api/docs/preview/download",
  version: 1,
});

const files: Record<string, string> = {
  "magic-link.html": magic.html,
  "readiness.html": readiness.html,
  "onboarding.html": onboarding.html,
  "onboarding-fallback.html": onboardingCompanyOnly.html,
  "onboarding-steuerberater.html": partnerOnboarding.html,
  "failed-payment.html": failedPayment.html,
  "failed-job.html": failedJob.html,
  "delivery.html": delivery.html,
};

for (const [name, html] of Object.entries(files)) {
  const file = path.join(outDir, name);
  writeFileSync(file, html, "utf8");
  console.log(file);
}
writeFileSync(path.join(outDir, "onboarding.txt"), onboarding.text, "utf8");
writeFileSync(path.join(outDir, "onboarding-fallback.txt"), onboardingCompanyOnly.text, "utf8");
console.log(path.join(outDir, "onboarding.txt"));
console.log(path.join(outDir, "onboarding-fallback.txt"));

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
assert(
  onboarding.subject ===
    "Willkommen — nächste Schritte zu Ihrer Verfahrensdokumentation",
  "Customer onboarding subject uses Sie",
);
assert(
  onboarding.html.includes("vielen Dank für Ihre Bestellung"),
  "Customer onboarding thanks in Sie",
);
assert(
  !onboarding.html.includes("KANZLEI-PILOT"),
  "Customer onboarding must not mention the partner code",
);
function greetingParagraph(html: string): string {
  const match = html.match(/<p>(Guten Tag.*?)<\/p>/);
  return match?.[1] ?? "";
}
const onboardingHref = onboardingStartUrl.replaceAll("&", "&amp;");
assert(
  greetingParagraph(onboarding.html) === "Guten Tag Philip Cappelletti,",
  "Customer onboarding greets the contact name",
);
assert(
  onboarding.text.startsWith("Guten Tag Philip Cappelletti,"),
  "Customer onboarding plaintext greets the contact name",
);
assert(
  !greetingParagraph(onboarding.html).includes("Muster") &&
    !greetingParagraph(onboarding.html).includes("GmbH"),
  "Customer onboarding greeting must not use the company name",
);
assert(
  greetingParagraph(onboardingCompanyOnly.html) === "Guten Tag,",
  "Company-only name falls back to Guten Tag,",
);
assert(
  onboardingCompanyOnly.text.startsWith("Guten Tag,"),
  "Company-only plaintext falls back to Guten Tag,",
);
assert(
  !onboardingCompanyOnly.text.includes("Guten Tag IKAT") &&
    !onboardingCompanyOnly.html.includes("Guten Tag IKAT"),
  "Company name must not appear in the greeting",
);
assert(
  greetingParagraph(onboardingWhitespace.html) === "Guten Tag,",
  "Whitespace contact name falls back to Guten Tag,",
);
assert(
  !onboardingWhitespace.text.includes("Guten Tag ,"),
  "Whitespace contact name must not leave a gap",
);
assert(
  onboarding.html.includes(`href="${onboardingHref}"`),
  "Customer onboarding button links the magic URL",
);
assert(
  onboarding.html.includes("next=%2Fintake"),
  "Customer onboarding button keeps next=/intake",
);
assert(
  onboarding.html.includes("Jetzt starten: Betriebs-Check"),
  "Customer onboarding has the Betriebs-Check button",
);
const onboardingContinueHref = onboardingContinueUrl.replaceAll("&", "&amp;");
assert(
  customerOnboardingDraftPath("cs_owner_draft") === "/intake?session_id=cs_owner_draft",
  "Draft continue path keeps the owner session",
);
assert(
  onboarding.html.includes(`>${CUSTOMER_ONBOARDING_CONTINUE_CTA}</a>`) &&
    onboarding.html.includes(`href="${onboardingContinueHref}"`) &&
    onboarding.text.includes(CUSTOMER_ONBOARDING_CONTINUE_CTA) &&
    onboarding.text.includes(onboardingContinueUrl),
  "Customer onboarding continues into the draft via verify, with a plaintext link",
);
assert(
  onboarding.html.includes(`background:#002050`),
  "Customer onboarding button is a primary CTA",
);
assert(
  onboarding.text.includes(onboardingStartUrl),
  "Customer onboarding plaintext includes the same start URL",
);
assert(
  onboardingCompanyOnly.text.includes(onboardingStartUrl),
  "Fallback plaintext includes the same start URL",
);
const ONBOARDING_SIGNATURE = "Ihr Team von GoBD Verfahrensdoku";
assert(
  CUSTOMER_ONBOARDING_SIGNATURE === ONBOARDING_SIGNATURE,
  "Customer onboarding signature is exactly Ihr Team von GoBD Verfahrensdoku",
);
assert(
  onboarding.html.includes(`<p>${ONBOARDING_SIGNATURE}</p>`),
  "Customer onboarding HTML signature paragraph is exact",
);
assert(
  onboarding.text.includes(ONBOARDING_SIGNATURE),
  "Customer onboarding plaintext signature is exact",
);
assert(
  onboardingCompanyOnly.html.includes(`<p>${ONBOARDING_SIGNATURE}</p>`) &&
    onboardingCompanyOnly.text.includes(ONBOARDING_SIGNATURE) &&
    onboardingWhitespace.html.includes(`<p>${ONBOARDING_SIGNATURE}</p>`) &&
    onboardingWhitespace.text.includes(ONBOARDING_SIGNATURE),
  "Every customer onboarding variant uses the same signature",
);
assert(
  !/GoBD Ops/i.test(onboarding.html) &&
    !/GoBD Ops/i.test(onboarding.text) &&
    !/GoBD Ops/i.test(onboardingCompanyOnly.html) &&
    !/GoBD Ops/i.test(onboardingCompanyOnly.text) &&
    !/GoBD Ops/i.test(onboardingWhitespace.html) &&
    !/GoBD Ops/i.test(onboardingWhitespace.text),
  "Customer onboarding must not contain GoBD Ops",
);
assert(
  onboarding.html.includes("Ihr Ansprechpartner:") &&
    onboarding.text.includes(
      `Ihr Ansprechpartner: ${MAIL_SUPPORT_EMAIL}. Antworten auf diese E-Mail erreichen uns unter dieser Adresse.`,
    ) &&
    onboarding.html.includes(`href="mailto:${MAIL_SUPPORT_EMAIL}"`) &&
    MAIL_SUPPORT_EMAIL === "info@gobd-doku-erstellen.de",
  "Customer onboarding names the Ansprechpartner reply address",
);
assert(
  onboarding.html.includes(`href="${MAIL_ACCOUNT_URL}"`) &&
    onboarding.text.includes(`Ihr Konto: ${MAIL_ACCOUNT_URL}`) &&
    MAIL_ACCOUNT_URL === "https://www.gobd-doku-erstellen.de/account",
  "Customer onboarding links the Konto page",
);
assert(
  onboarding.html.includes("Entwurf wird gespeichert") &&
    onboarding.text.includes("Entwurf wird gespeichert") &&
    onboarding.html.includes("Später ausfüllen") &&
    onboarding.text.includes("Später ausfüllen"),
  "Customer onboarding explains later answers and a saved Entwurf",
);
assert(
  onboarding.html.includes("Betriebs-Check") &&
    onboarding.html.includes("24 Module") &&
    onboarding.html.includes("Später ausfüllen") &&
    onboarding.html.includes("Entwurf wird gespeichert") &&
    onboarding.html.includes("To-dos") &&
    onboarding.html.includes("Gesamt-PDF") &&
    onboarding.html.includes("Vollständigkeitsübersicht"),
  "Customer onboarding describes the 24-module flow",
);
assert(
  onboarding.html.includes(
    "Hinweis: Keine Steuer- oder Rechtsberatung. Die Dokumentation ist eine Arbeitshilfe aus Ihren Angaben.",
  ),
  "Customer onboarding keeps the disclaimer",
);
assert(
  !onboarding.html.includes("Intake ausfüllen (falls noch offen)"),
  "Customer onboarding no longer uses the unlinked intake step",
);
assert(safeNextPath("/intake") === "/intake", "/intake is an allowed next path");
assert(safeNextPath("/intake/extra") === null, "intake subpaths stay blocked");
assert(
  safeNextPath("/intake?session_id=cs_live_abc") === "/intake?session_id=cs_live_abc",
  "intake keeps a checkout session id and cannot redirect elsewhere",
);
assert(
  safeNextPath("/intake?session_id=cs_live_abc&next=https://evil.example") ===
    "/intake?session_id=cs_live_abc",
  "unknown intake query is dropped",
);
assert(
  safeNextPath("/intake?session_id=../admin") === "/intake",
  "unsafe session id is dropped",
);
assert(safeNextPath("https://evil.example/intake") === null, "absolute next is rejected");
assert(safeNextPath("//evil.example/intake") === null, "protocol-relative next is rejected");
assert(
  loginPath("/intake") === "/login?next=%2Fintake",
  "expired magic link falls back to login and keeps next=/intake",
);
assert(loginPath("https://evil.example") === "/login", "unsafe next is dropped on login");
const issuedMagicLink = magicLinkUrl("philip@example.com", "/intake");
assert(issuedMagicLink.includes("/auth/verify?"), "magic link uses /auth/verify");
assert(issuedMagicLink.includes("token="), "magic link carries a token");
assert(issuedMagicLink.includes("next=%2Fintake"), "magic link sets next=/intake");
assert(
  pickOnboardingContactName({
    profileName: "Alex Profil",
    checkoutNames: ["Stripe Name"],
    intakeContactNames: ["Inhaber Intake"],
    companyNames: ["IKAT GmbH"],
  }) === "Alex Profil",
  "profile name wins over checkout and intake",
);
assert(
  pickOnboardingContactName({
    profileName: "  ",
    checkoutNames: ["Philip Cappelletti"],
    companyNames: ["IKAT GmbH"],
  }) === "Philip Cappelletti",
  "checkout person name is used when the profile is empty",
);
assert(
  pickOnboardingContactName({
    checkoutNames: ["IKAT GmbH"],
    companyNames: ["IKAT GmbH"],
  }) === "",
  "checkout name equal to the company is not a greeting",
);
assert(
  pickOnboardingContactName({
    profileName: "muster gmbh",
    checkoutNames: ["  Muster GmbH  "],
    intakeContactNames: ["Muster GmbH"],
    companyNames: ["Muster GmbH"],
  }) === "",
  "company-shaped names in every source fall back",
);
assert(
  pickOnboardingContactName({
    checkoutNames: ["IKAT GmbH"],
    intakeContactNames: ["Anna Berg"],
    companyNames: ["IKAT GmbH"],
  }) === "Anna Berg",
  "intake contact is used when checkout is only the company",
);
assert(
  customerOnboardingGreeting("   ", ["IKAT GmbH"]) === "Guten Tag,",
  "greeting helper falls back on whitespace",
);
assert(
  intakeContactNameFromAnswers({ gf: "  Clara Sonnenkorn  " }) === "Clara Sonnenkorn",
  "intake gf is the contact name",
);
assert(
  intakeContactNameFromAnswers({
    gf: " ",
    bestaetigungName: "",
    katalog: { A01: { values: { gf: "Nora Klar" } } },
  }) === "Nora Klar",
  "catalog A01 gf is the contact when the column is empty",
);
const stripeBusiness = checkoutContactFromCustomerDetails({
  name: "IKAT GmbH",
  business_name: "IKAT GmbH",
  individual_name: "Philip Cappelletti",
});
assert(
  pickOnboardingContactName({
    checkoutNames: stripeBusiness.checkoutNames,
    companyNames: ["IKAT GmbH", ...stripeBusiness.extraCompanyNames],
  }) === "Philip Cappelletti",
  "Stripe individual name wins over the business name",
);
const stripeCompanyOnly = checkoutContactFromCustomerDetails({
  name: "IKAT GmbH",
  business_name: "IKAT GmbH",
});
assert(
  pickOnboardingContactName({
    checkoutNames: stripeCompanyOnly.checkoutNames,
    companyNames: ["IKAT GmbH", ...stripeCompanyOnly.extraCompanyNames],
  }) === "",
  "Stripe business name alone does not greet",
);
function hasCustomerDu(value: string): boolean {
  return /\b(du|dich|dir|dein|deine|deinem|deinen|deiner|deines|euch|euer|eure|eurem|euren|eurer|eures)\b/i.test(
    value,
  );
}
const partnerMail = `${partnerOnboarding.subject}\n${partnerOnboarding.html}\n${partnerOnboarding.text}`;
assert(
  partnerOnboarding.subject ===
    "Willkommen — nächste Schritte zu Ihrer Verfahrensdokumentation",
  "Steuerberater onboarding subject uses Sie",
);
assert(
  partnerOnboarding.html.includes("Guten Tag Beispiel Kanzlei,"),
  "Steuerberater greeting includes the firm",
);
assert(
  partnerOnboarding.html.includes("vielen Dank für Ihre Bestellung im Partner-Pilot"),
  "Steuerberater onboarding thanks in Sie",
);
assert(
  partnerOnboarding.html.includes("KANZLEI-PILOT"),
  "Steuerberater onboarding names the pilot code",
);
assert(partnerOnboarding.html.includes("0 €"), "Steuerberater onboarding states 0 €");
assert(
  partnerOnboarding.html.includes("49 €/Monat"),
  "Steuerberater onboarding states 49 €/Monat",
);
assert(
  partnerOnboarding.html.includes(
    "Sie füllen sie nicht für einen Mandanten aus.",
  ),
  "Steuerberater onboarding keeps the Mandant boundary",
);
assert(!hasCustomerDu(partnerMail), "Steuerberater onboarding must not use du");
assert(
  partnerOnboarding.html.includes(PARTNER_ONBOARDING_SIGNATURE) &&
    partnerOnboarding.text.includes(PARTNER_ONBOARDING_SIGNATURE),
  "Steuerberater signature uses the Sie-form team line",
);
assert(
  !partnerOnboarding.html.includes("GoBD Ops") &&
    !partnerOnboarding.text.includes("GoBD Ops") &&
    !partnerMail.includes("Dein Team"),
  "Steuerberater signature drops GoBD Ops and stays Sie",
);
assert(
  !/weitergeben|Kollege|Soft-Invite|andere Kanzlei/i.test(partnerMail),
  "Steuerberater onboarding must not invite other firms",
);
assert(
  partnerOnboardingNoCompany.text.includes("Guten Tag,"),
  "Empty Steuerberater company renders Guten Tag,",
);
assert(
  !partnerOnboardingNoCompany.text.includes("Guten Tag ,"),
  "Empty Steuerberater company must not leave a gap",
);
assert(!hasPageReadinessHref(delivery.html), "Delivery must not link to /readiness");
assert(
  readiness.html.includes(MAIL_CHECKOUT_URL),
  "Readiness mail must include Checkout upsell",
);
assert(
  readiness.html.includes(
    `Starten für ${TODAY_EUR} € (Einrichtung + 1. Monat), danach ${MONTHLY_EUR} €/Monat, zzgl. USt.`,
  ),
  "Readiness mail must use the start-price Checkout CTA",
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
  delivery.subject === "Ihr Entwurf der Verfahrensdokumentation",
  "Delivery keeps its own subject",
);
assert(
  delivery.text.startsWith("Guten Tag Anna Berg,"),
  "Delivery greets the contact person",
);
assert(
  deliveryCompanyOnly.text.startsWith("Guten Tag,"),
  "Delivery falls back when the only name is the company",
);
assert(
  !delivery.text.includes("Guten Tag Muster GmbH") &&
    !delivery.html.includes("Guten Tag Muster GmbH") &&
    !deliveryCompanyOnly.text.includes("Guten Tag IKAT GmbH") &&
    !deliveryCompanyOnly.html.includes("Guten Tag IKAT GmbH"),
  "Delivery must not greet the company name",
);
const shareHref = REFERRAL_AFTER_DELIVERY_URL.replaceAll("&", "&amp;");
assert(
  delivery.html.includes("<strong>Gern weitergeben</strong>") &&
    delivery.text.includes("Gern weitergeben") &&
    delivery.html.includes(`href="${shareHref}"`) &&
    delivery.text.includes(REFERRAL_AFTER_DELIVERY_URL),
  "Delivery includes one share section with the UTM product URL",
);
assert(
  delivery.html.includes(REFERRAL_MICRO) && delivery.text.includes(REFERRAL_MICRO),
  "Delivery includes the single price line",
);
assert(
  delivery.html.split("149 €").length - 1 === 1 &&
    delivery.text.split("149 €").length - 1 === 1,
  "Delivery states the price once",
);
assert(
  !delivery.html.includes("Betriebs-Check") && !delivery.text.includes("Betriebs-Check"),
  "Delivery does not re-explain the Betriebs-Check",
);
assert(
  delivery.html.includes(`<p>${ONBOARDING_SIGNATURE}</p>`) &&
    delivery.text.includes(ONBOARDING_SIGNATURE) &&
    deliveryCompanyOnly.html.includes(`<p>${ONBOARDING_SIGNATURE}</p>`),
  "Delivery uses the customer signature",
);
assert(
  !/GoBD Ops/i.test(`${delivery.html}\n${delivery.text}\n${deliveryCompanyOnly.html}`),
  "Delivery must not contain GoBD Ops",
);
const customerMails = [
  magic,
  readiness,
  onboarding,
  failedPayment,
  failedJob,
  delivery,
  deliveryCompanyOnly,
];
for (const mail of customerMails) {
  assert(
    !hasCustomerDu(`${mail.subject}\n${mail.html}\n${mail.text}`),
    `Customer mail must use Sie: ${mail.subject}`,
  );
  assert(
    mail.html.includes(`<p>${ONBOARDING_SIGNATURE}</p>`) &&
      mail.text.includes(ONBOARDING_SIGNATURE),
    `Customer mail signature: ${mail.subject}`,
  );
  assert(
    !/GoBD Ops/i.test(`${mail.html}\n${mail.text}`),
    `Customer mail must not contain GoBD Ops: ${mail.subject}`,
  );
}

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
}

assertReferralIdempotency().catch((error) => {
  console.error(error);
  process.exit(1);
});
