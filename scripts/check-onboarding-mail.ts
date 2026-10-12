/**
 * Kunden-Onboarding nach dem Kauf (24 Module).
 * Signatur exakt „Ihr Team von gobd-doku-erstellen.de“, kein „GoBD Ops“.
 * Der Plaintext mit Namen liegt als Snapshot unter scripts/fixtures/.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MAGIC_TTL_MS, magicLinkUrl, safeNextPath, verifyMagicToken } from "@/lib/auth";
import { MAIL_ACCOUNT_URL, MAIL_SUPPORT_EMAIL } from "@/lib/mail-layout";
import {
  buildOnboardingMail,
  CUSTOMER_ONBOARDING_CONTINUE_CTA,
  CUSTOMER_ONBOARDING_SIGNATURE,
  customerOnboardingDraftPath,
} from "@/lib/ops";

const SIGNATURE = "Ihr Team von gobd-doku-erstellen.de";
const REPLY = "info@gobd-doku-erstellen.de";
const ACCOUNT = "https://www.gobd-doku-erstellen.de/account";
const START =
  "https://www.gobd-doku-erstellen.de/auth/verify?token=preview-onboarding&next=%2Fintake";
const DRAFT_SESSION = "cs_owner_draft";
const DRAFT_NEXT = `/intake?session_id=${DRAFT_SESSION}`;
const CONTINUE =
  "https://www.gobd-doku-erstellen.de/auth/verify?token=preview-continue&next=%2Fintake%3Fsession_id%3Dcs_owner_draft";
const CONTINUE_LABEL = "Verfahrensdokumentation weiter ausfüllen";

const snapshotPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "fixtures",
  "customer-onboarding.txt",
);

function fail(message: string): never {
  console.error(`check-onboarding-mail: ${message}`);
  process.exit(1);
}

function assertMail(label: string, mail: { text: string; html: string }): void {
  if (!mail.html.includes(`<p>${SIGNATURE}</p>`)) {
    fail(`${label}: HTML signature paragraph missing`);
  }
  if (!mail.text.includes(SIGNATURE)) {
    fail(`${label}: plaintext signature missing`);
  }
  if (/GoBD Ops/i.test(mail.html) || /GoBD Ops/i.test(mail.text)) {
    fail(`${label}: contains GoBD Ops`);
  }
  if (!mail.text.includes("Betriebs-Check") || !mail.html.includes("Betriebs-Check")) {
    fail(`${label}: Betriebs-Check missing`);
  }
  if (!mail.text.includes("Später ausfüllen") || !mail.html.includes("Später ausfüllen")) {
    fail(`${label}: Später ausfüllen missing`);
  }
  if (
    !mail.text.includes("Entwurf wird gespeichert") ||
    !mail.html.includes("Entwurf wird gespeichert")
  ) {
    fail(`${label}: Entwurf wird gespeichert missing`);
  }
  if (!mail.text.includes(`Ihr Konto: ${ACCOUNT}`)) {
    fail(`${label}: Konto line missing`);
  }
  if (!mail.html.includes(`href="${ACCOUNT}"`)) {
    fail(`${label}: Konto href missing`);
  }
  if (
    !mail.text.includes(
      `Ihr Ansprechpartner: ${REPLY}. Antworten auf diese E-Mail erreichen uns unter dieser Adresse.`,
    )
  ) {
    fail(`${label}: Ansprechpartner line missing`);
  }
  if (!mail.html.includes("Ihr Ansprechpartner:") || !mail.html.includes(`href="mailto:${REPLY}"`)) {
    fail(`${label}: Ansprechpartner mailto missing`);
  }
  if (
    !mail.text.includes(CONTINUE_LABEL) ||
    !mail.text.includes(CONTINUE) ||
    !mail.html.includes(`>${CONTINUE_LABEL}</a>`) ||
    !mail.html.includes(`href="${CONTINUE.replaceAll("&", "&amp;")}"`)
  ) {
    fail(`${label}: continue button or plaintext draft link missing`);
  }
  const continueUrl = new URL(CONTINUE);
  if (!continueUrl.pathname.endsWith("/auth/verify")) {
    fail(`${label}: continue link is not the verify route`);
  }
  if (safeNextPath(continueUrl.searchParams.get("next")) !== DRAFT_NEXT) {
    fail(`${label}: continue link does not redirect to the intake draft`);
  }
  if (/\b(du|dich|dir|dein|deine|deinem|deinen|deiner|deines)\b/i.test(`${mail.text}\n${mail.html}`)) {
    fail(`${label}: du-form`);
  }
}

if (CUSTOMER_ONBOARDING_SIGNATURE !== SIGNATURE) {
  fail(`signature constant is ${JSON.stringify(CUSTOMER_ONBOARDING_SIGNATURE)}`);
}
if (MAIL_SUPPORT_EMAIL !== REPLY) fail(`reply address is ${MAIL_SUPPORT_EMAIL}`);
if (MAIL_ACCOUNT_URL !== ACCOUNT) fail(`account url is ${MAIL_ACCOUNT_URL}`);

const named = buildOnboardingMail({
  company: "Muster GmbH",
  contactName: "Philip Cappelletti",
  magicLinkUrl: START,
  continueUrl: CONTINUE,
});
const companyOnly = buildOnboardingMail({
  company: "IKAT GmbH",
  contactName: "IKAT GmbH",
  magicLinkUrl: START,
  continueUrl: CONTINUE,
});
const blankName = buildOnboardingMail({
  company: "Muster GmbH",
  contactName: "   \n  ",
  magicLinkUrl: START,
  continueUrl: CONTINUE,
});

assertMail("named", named);
assertMail("company-only", companyOnly);
assertMail("blank-name", blankName);

if (!named.text.startsWith("Guten Tag Philip Cappelletti,")) {
  fail("named greeting drifted");
}
if (!companyOnly.text.startsWith("Guten Tag,")) fail("company-only greeting drifted");
if (!blankName.text.startsWith("Guten Tag,")) fail("blank-name greeting drifted");

if (CUSTOMER_ONBOARDING_CONTINUE_CTA !== CONTINUE_LABEL) {
  fail(`continue label is ${JSON.stringify(CUSTOMER_ONBOARDING_CONTINUE_CTA)}`);
}
if (customerOnboardingDraftPath(DRAFT_SESSION) !== DRAFT_NEXT) {
  fail(`draft path is ${customerOnboardingDraftPath(DRAFT_SESSION)}`);
}
if (customerOnboardingDraftPath("  ") !== "/intake") {
  fail("blank session must stay on /intake");
}
if (customerOnboardingDraftPath("https://evil.example") !== "/intake") {
  fail("unsafe session must not enter the draft path");
}

const purchaser = "kauf@example.com";
const issuedContinue = magicLinkUrl(purchaser, customerOnboardingDraftPath(DRAFT_SESSION));
const issued = new URL(issuedContinue);
if (!issued.pathname.endsWith("/auth/verify")) fail("issued continue link is not /auth/verify");
const issuedToken = issued.searchParams.get("token") ?? "";
if (verifyMagicToken(issuedToken) !== purchaser) {
  fail("issued continue token does not verify as the purchaser");
}
if (safeNextPath(issued.searchParams.get("next")) !== DRAFT_NEXT) {
  fail("issued continue link does not redirect to the intake draft");
}
const tokenBody = issuedToken.split(".")[0] ?? "";
const tokenPayload = JSON.parse(Buffer.from(tokenBody, "base64url").toString("utf8")) as {
  typ?: string;
  email?: string;
  exp?: number;
};
if (tokenPayload.typ !== "magic" || tokenPayload.email !== purchaser) {
  fail("issued continue token is not a magic token for the purchaser");
}
if (
  typeof tokenPayload.exp !== "number" ||
  Math.abs(tokenPayload.exp - (Date.now() + MAGIC_TTL_MS)) > 5000
) {
  fail("issued continue token does not use the verify expiry");
}
const issuedMail = buildOnboardingMail({
  company: "Muster GmbH",
  contactName: "Käufer",
  magicLinkUrl: START,
  continueUrl: issuedContinue,
});
const issuedHref = issuedContinue.replaceAll("&", "&amp;");
if (
  !issuedMail.html.includes(`>${CONTINUE_LABEL}</a>`) ||
  !issuedMail.html.includes(`href="${issuedHref}"`) ||
  !issuedMail.text.includes(CONTINUE_LABEL) ||
  !issuedMail.text.includes(issuedContinue)
) {
  fail("issued magic link is missing from the button or the plaintext fallback");
}

const expected = readFileSync(snapshotPath, "utf8");
if (named.text !== expected) {
  fail(
    `snapshot mismatch (${snapshotPath}). Rendered text does not match scripts/fixtures/customer-onboarding.txt`,
  );
}

console.log("check-onboarding-mail: ok");
