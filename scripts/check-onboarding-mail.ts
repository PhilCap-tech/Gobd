/**
 * Kunden-Onboarding nach dem Kauf (24 Module).
 * Signatur exakt „Ihr Team von gobd-doku-erstellen.de“, kein „GoBD Ops“.
 * Der Plaintext mit Namen liegt als Snapshot unter scripts/fixtures/.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MAIL_ACCOUNT_URL, MAIL_SUPPORT_EMAIL } from "@/lib/mail-layout";
import { buildOnboardingMail, CUSTOMER_ONBOARDING_SIGNATURE } from "@/lib/ops";

const SIGNATURE = "Ihr Team von gobd-doku-erstellen.de";
const REPLY = "info@gobd-doku-erstellen.de";
const ACCOUNT = "https://www.gobd-doku-erstellen.de/account";
const START =
  "https://www.gobd-doku-erstellen.de/auth/verify?token=preview-onboarding&next=%2Fintake";

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
});
const companyOnly = buildOnboardingMail({
  company: "IKAT GmbH",
  contactName: "IKAT GmbH",
  magicLinkUrl: START,
});
const blankName = buildOnboardingMail({
  company: "Muster GmbH",
  contactName: "   \n  ",
  magicLinkUrl: START,
});

assertMail("named", named);
assertMail("company-only", companyOnly);
assertMail("blank-name", blankName);

if (!named.text.startsWith("Guten Tag Philip Cappelletti,")) {
  fail("named greeting drifted");
}
if (!companyOnly.text.startsWith("Guten Tag,")) fail("company-only greeting drifted");
if (!blankName.text.startsWith("Guten Tag,")) fail("blank-name greeting drifted");

const expected = readFileSync(snapshotPath, "utf8");
if (named.text !== expected) {
  fail(
    `snapshot mismatch (${snapshotPath}). Rendered text does not match scripts/fixtures/customer-onboarding.txt`,
  );
}

console.log("check-onboarding-mail: ok");
