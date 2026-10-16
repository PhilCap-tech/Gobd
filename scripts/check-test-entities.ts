/**
 * Listed test firms skip PDF delivery, post-purchase customer mail, and metrics.
 * A normal firm id is left alone. Nothing here sends mail or writes Sheets.
 * There is no cron sender; subscription follow-up mail is the webhook path.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "../app/api/document/route";
import { downloadPdf } from "../app/api/docs/[id]/download/route";
import "../app/api/intake/route";
import { SESSION_COOKIE, createSessionToken } from "../lib/auth";
import { sanitizeAnalyticsEvent } from "../lib/analytics-url";
import {
  deliverBuyerOnboarding,
  forgetBuyerOnboarding,
} from "../lib/buyer-onboarding";
import { enqueueDelivery, generatePdf } from "../lib/delivery";
import {
  handleFailedJob,
  handleFailedPayment,
  sendDeliveryMail,
  triggerOnboardingMail,
} from "../lib/ops";
import {
  TEST_ENTITY_IDS,
  TestEntityDeliverySkipped,
  countsInReporting,
  isTestEntity,
  omitTestEntities,
} from "../lib/test-entities";
import { emptyAnswers, type CheckoutIdentity, type SheetRow } from "../lib/types";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const LISTED = "48c6805d-3d34-4a80-9747-38ce4edb3eed";
const NORMAL = "11111111-1111-4111-8111-111111111111";

function fail(message: string): never {
  console.error(`check-test-entities: ${message}`);
  process.exit(1);
}

function ok(condition: unknown, message: string): void {
  if (!condition) fail(message);
  console.log("ok:", message);
}

function read(rel: string): string {
  return readFileSync(path.join(root, rel), "utf8");
}

function between(source: string, start: string, end: string): string {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  ok(from >= 0 && to > from, `${start} is present`);
  return source.slice(from, to);
}

const identity = (entityId: string): CheckoutIdentity => ({
  email: "buyer.normal@example.com",
  company: "Normale GmbH",
  stripeSessionId: "cs_test_entity_guard",
  stripeCustomerId: "",
  stub: true,
  entityId,
});

const MAIL_ENV = ["RESEND_API_KEY", "EMAIL_FROM", "BLOB_READ_WRITE_TOKEN", "VERCEL_ENV"] as const;

function withoutLiveSideEffects<T>(run: () => Promise<T>): Promise<T> {
  const env = process.env as Record<string, string | undefined>;
  const saved: Record<string, string | undefined> = {};
  for (const key of MAIL_ENV) saved[key] = env[key];
  for (const key of MAIL_ENV) delete env[key];
  if (env.NODE_ENV === "production") env.NODE_ENV = "development";
  return run().finally(() => {
    for (const key of MAIL_ENV) {
      if (saved[key] === undefined) delete env[key];
      else env[key] = saved[key];
    }
  });
}

async function checkPredicate(): Promise<void> {
  ok(TEST_ENTITY_IDS.includes(LISTED), "the refunded test purchase is listed");
  ok(isTestEntity(LISTED), "the listed id is a test firm");
  ok(isTestEntity(`  ${LISTED.toUpperCase()}  `), "match trims and ignores case");
  ok(!isTestEntity(NORMAL), "a normal firm id is not listed");
  ok(!isTestEntity(""), "a blank id is not listed");
  ok(!isTestEntity(null), "a missing id is not listed");
  ok(!countsInReporting(LISTED), "the listed id stays out of reporting");
  ok(countsInReporting(NORMAL), "a normal id still counts");
  ok(countsInReporting(""), "a blank id is not treated as a test firm");
  const rows = omitTestEntities([
    { entityId: LISTED, name: "R4 Mystery Test GmbH" },
    { entityId: NORMAL, name: "Echte GmbH" },
    { entityId: "", name: "Ohne Firma" },
  ]);
  ok(rows.length === 2 && rows.every((row) => row.entityId !== LISTED), "reporting drops only the listed firm");
}

async function checkMails(): Promise<void> {
  const listedOnboarding = await triggerOnboardingMail({
    email: "buyer.normal@example.com",
    company: "R4 Mystery Test GmbH",
    sessionId: "cs_test_entity_guard_listed",
    entityId: LISTED,
  });
  ok(
    listedOnboarding.skipped === true && listedOnboarding.sent === false,
    "onboarding does not send for the listed firm",
  );

  const normalOnboarding = await triggerOnboardingMail({
    email: "buyer.normal@example.com",
    company: "Normale GmbH",
    sessionId: "cs_test_entity_guard_normal",
    entityId: NORMAL,
  });
  ok(normalOnboarding.skipped !== true, "onboarding is not skipped for a normal firm");
  ok(normalOnboarding.action === "onboarding", "a normal firm still reaches the onboarding mailer");

  const listedWelcome = await deliverBuyerOnboarding({
    email: "buyer.normal@example.com",
    company: "R4 Mystery Test GmbH",
    sessionId: "cs_test_entity_guard_listed_buyer",
    entityId: LISTED,
  });
  ok(listedWelcome === "skipped", "the checkout welcome mail skips the listed firm");

  const normalSession = "cs_test_entity_guard_normal_buyer";
  await forgetBuyerOnboarding(normalSession);
  try {
    const normalWelcome = await deliverBuyerOnboarding({
      email: "buyer.normal@example.com",
      company: "Normale GmbH",
      sessionId: normalSession,
      entityId: NORMAL,
    });
    ok(normalWelcome !== "skipped", "the checkout welcome mail still runs for a normal firm");
  } finally {
    await forgetBuyerOnboarding(normalSession);
  }

  const listedDelivery = await sendDeliveryMail({
    email: "buyer.normal@example.com",
    company: "R4 Mystery Test GmbH",
    downloadUrl: "https://www.gobd-doku-erstellen.de/api/docs/listed/download",
    documentId: "doc-listed",
    version: 1,
    entityId: LISTED,
  });
  ok(listedDelivery.skipped === true && listedDelivery.sent === false, "delivery mail skips the listed firm");

  const normalDelivery = await sendDeliveryMail({
    email: "",
    downloadUrl: "https://www.gobd-doku-erstellen.de/api/docs/normal/download",
    entityId: NORMAL,
  });
  ok(normalDelivery.skipped !== true, "delivery mail is not skipped for a normal firm");

  const listedPayment = await handleFailedPayment({
    email: "buyer.normal@example.com",
    invoiceId: "in_listed",
    eventId: "evt_listed",
    entityId: LISTED,
  });
  ok(listedPayment.skipped === true && listedPayment.sent === false, "payment-failed mail skips the listed firm");

  const normalPayment = await handleFailedPayment({
    email: "buyer.normal@example.com",
    invoiceId: "in_normal",
    eventId: "evt_normal",
    entityId: NORMAL,
  });
  ok(normalPayment.skipped !== true, "payment-failed mail is not skipped for a normal firm");

  const listedJob = await handleFailedJob({
    email: "buyer.normal@example.com",
    sessionId: "cs_test_entity_guard_listed",
    job: "stripe-webhook:checkout.session.completed",
    entityId: LISTED,
  });
  ok(listedJob.skipped === true && listedJob.sent === false, "failed-job mail skips the listed firm");

  const normalJob = await handleFailedJob({
    email: "buyer.normal@example.com",
    sessionId: "cs_test_entity_guard_normal",
    job: "stripe-webhook:checkout.session.completed",
    entityId: NORMAL,
  });
  ok(normalJob.skipped !== true, "failed-job mail is not skipped for a normal firm");
}

async function checkDelivery(): Promise<void> {
  let thrown = false;
  try {
    await generatePdf({
      answers: emptyAnswers(),
      identity: identity(LISTED),
      documentId: "doc-listed",
      version: 1,
    });
  } catch (error) {
    thrown = error instanceof TestEntityDeliverySkipped;
  }
  ok(thrown, "PDF generation throws for the listed firm before a file is built");

  const skippedPlan = await enqueueDelivery({
    sessionId: "cs_test_entity_guard_listed",
    answers: emptyAnswers(),
    entityId: LISTED,
  });
  ok(skippedPlan.pdf === null && skippedPlan.chapters.length === 0, "the delivery plan is empty for the listed firm");

  const normalPlan = await enqueueDelivery({
    sessionId: "cs_test_entity_guard_normal",
    answers: emptyAnswers(),
    entityId: NORMAL,
  });
  ok(normalPlan.chapters.length > 0, "a normal firm still gets a delivery plan");

  const row = {
    email: "buyer.normal@example.com",
    entityId: LISTED,
    documentId: "doc-listed",
    pdfUrl: "https://example.invalid/listed.pdf",
  } as SheetRow;
  const response = await downloadPdf(
    new Request("http://localhost/api/docs/doc-listed/download", {
      headers: { cookie: `${SESSION_COOKIE}=${createSessionToken(row.email)}` },
    }),
    "doc-listed",
    async () => row,
  );
  ok(response.status === 403, "the download route does not hand out the listed firm's PDF");
  const body = (await response.json()) as { error?: string };
  ok(body.error === "Kein Zugriff.", "the download refusal reuses the existing access copy");
}

function checkSources(): void {
  const guarded: Array<[string, string]> = [
    ["lib/buyer-onboarding.ts", "isTestEntity"],
    ["lib/ops.ts", "isTestEntity"],
    ["lib/delivery.ts", "isTestEntity"],
    ["lib/blob.ts", "TestEntityDeliverySkipped"],
    ["lib/kuendigung-stripe.ts", "isTestEntity"],
    ["lib/kuendigung-apply.ts", "suppressCustomerMail"],
    ["lib/analytics-url.ts", "urlMentionsTestEntity"],
    ["app/api/stripe/webhook/route.ts", "isTestEntity"],
    ["app/api/checkout/grant/route.ts", "matchingTestEntityId"],
    ["app/intake/page.tsx", "entityId: firstQueryValue(params.entity_id)"],
    ["app/api/ops/route.ts", "entityId: body.entityId"],
    ["app/api/intake/route.ts", "skipTestDelivery"],
    ["app/api/document/route.ts", "skipTestDelivery"],
    ["app/api/docs/[id]/download/route.ts", "isTestEntity"],
    ["app/api/delivery/route.ts", "isTestEntity"],
    ["app/api/auth/checkout-handoff/route.ts", "isTestEntity"],
    ["app/api/account/kuendigung/route.ts", "suppressCustomerMail"],
    ["app/api/account/export/route.ts", "isTestEntity"],
    ["app/success/page.tsx", "countsInReporting"],
  ];
  for (const [rel, needle] of guarded) {
    ok(read(rel).includes(needle), `${rel} guards with ${needle}`);
  }

  const ops = read("lib/ops.ts");
  for (const [start, end] of [
    ["export async function triggerOnboardingMail", "export async function handleFailedPayment"],
    ["export async function handleFailedPayment", "export async function handleFailedJob"],
    ["export async function handleFailedJob", "export async function sendDeliveryMail"],
    ["export async function sendDeliveryMail", "export type PartnerInquiryMailInput"],
  ] as const) {
    const body = between(ops, start, end);
    ok(body.indexOf("isTestEntity") < body.indexOf("sendDedupedEmail"), `${start} returns before the send`);
  }

  const buyer = between(
    read("lib/buyer-onboarding.ts"),
    "export async function deliverBuyerOnboarding",
    "export async function notifyBuyerOfCheckout",
  );
  ok(buyer.indexOf("isTestEntity") < buyer.indexOf("claimOnboardingSend"), "welcome mail returns before the claim");

  const pdf = between(read("lib/delivery.ts"), "export async function generatePdf", "export async function generateMarkdownPdf");
  ok(pdf.indexOf("isTestEntity") < pdf.indexOf("new PDFDocument"), "PDF generation checks the firm before building a file");
  ok(pdf.includes("isMuster"), "sample PDFs stay available");

  const webhook = read("app/api/stripe/webhook/route.ts");
  ok(webhook.indexOf("await appendRecord") < webhook.indexOf("Testfirma"), "the paid row is still stored");
  ok(webhook.includes("entityId: invoiceEntityId"), "payment-failed reads the firm id");
  ok(!existsSync(path.join(root, "app/api/cron/lifecycle/route.ts")), "there is no cron mailer");
  ok(!read("vercel.json").includes("crons"), "vercel.json has no cron");

  const intake = read("app/api/intake/route.ts");
  ok(intake.indexOf("skipTestDelivery") < intake.indexOf("io.generatePdf"), "intake checks the firm before the PDF");
  ok(intake.includes("deliveryStatus: skipTestDelivery ? \"\""), "a skipped intake does not mark the row delivered");
  const documentRoute = read("app/api/document/route.ts");
  ok(documentRoute.indexOf("skipTestDelivery") < documentRoute.indexOf("await generatePdf"), "revision checks the firm before the PDF");
}

function checkMetrics(): void {
  const dropped = sanitizeAnalyticsEvent({
    type: "pageview",
    url: `https://www.gobd-doku-erstellen.de/intake?entity_id=${LISTED}`,
  });
  ok(dropped === null, "a pageview for the listed firm is dropped from analytics");
  const kept = sanitizeAnalyticsEvent({
    type: "pageview",
    url: `https://www.gobd-doku-erstellen.de/intake?entity_id=${NORMAL}`,
  });
  ok(kept !== null && kept.url.includes(NORMAL), "a pageview for a normal firm is kept");
  const success = read("app/success/page.tsx");
  ok(success.includes('showSuccess && sessionId.startsWith("cs_")'), "purchase conversion still starts from a paid success view");
  ok(success.includes("countsInReporting(row.entityId)"), "purchase conversion skips the listed firm on the document");
  ok(success.includes("countsInReporting(purchaseLookup.entityId)"), "purchase conversion skips the listed firm on the checkout");
}

async function main(): Promise<void> {
  await withoutLiveSideEffects(async () => {
    await checkPredicate();
    await checkMails();
    await checkDelivery();
    checkSources();
    checkMetrics();
  });
  console.log("check-test-entities: ok");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
