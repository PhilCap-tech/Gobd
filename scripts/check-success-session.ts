/**
 * /success with a Checkout Session Stripe cannot resolve shows the notice.
 * A stored, allowed document stays on the paid success view and still
 * resolves Stripe only for the purchase conversion. No mail, no live Stripe.
 *
 *   npx tsx scripts/check-success-session.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  SUCCESS_SESSION_INVALID_HEADING,
  SUCCESS_SESSION_INVALID_LEAD,
  SuccessPending,
  SuccessSessionInvalid,
  successSessionInvalidSentence,
} from "../components/success-status";
import { LEGAL_OPERATOR } from "../lib/legal";
import { checkoutLookupError } from "../lib/stripe";
import { SITE_NAME } from "../lib/seo";
import {
  SUCCESS_CHECKOUT_CHECKED_PARAM,
  SUCCESS_CHECKOUT_PROBE_TTL_MS,
  SUCCESS_DOCUMENT_TITLE,
  SUCCESS_INVALID_TITLE,
  clearSuccessCheckoutProbes,
  isUnresolvableCheckoutSession,
  probeSuccessCheckout,
  shouldProbeSuccessCheckout,
  successPageBody,
  successPageTitle,
  successPendingHref,
  type SuccessCheckoutResult,
} from "../lib/success-session";
import { purchaseSessionIdFromCheckout } from "../lib/tracking";

function ok(cond: unknown, msg: string) {
  assert.ok(cond, msg);
  console.log("ok:", msg);
}

function textOf(html: string): string {
  return html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

const PAID: SuccessCheckoutResult = {
  email: "buyer@example.com",
  company: "Beispiel GmbH",
  stripeSessionId: "cs_live_paid",
  stripeCustomerId: "cus_example",
  stub: false,
  entityId: "firm-buyer",
};

function checkNotice() {
  const sentence = successSessionInvalidSentence();
  ok(
    sentence ===
      "Wenn die Zahlung bereits erfolgt ist, schreiben Sie bitte an info@gobd-doku-erstellen.de.",
    "the notice sentence is the formal contact line",
  );
  ok(sentence.includes(LEGAL_OPERATOR.email), "the sentence uses the site contact address");
  ok(SUCCESS_SESSION_INVALID_LEAD.length > 0 && sentence.startsWith(SUCCESS_SESSION_INVALID_LEAD), "the sentence starts with the lead");

  const html = renderToStaticMarkup(createElement(SuccessSessionInvalid));
  const text = textOf(html);
  ok(text.includes(SUCCESS_SESSION_INVALID_HEADING), "invalid session renders the heading");
  ok(text.includes(sentence), "invalid session renders the one sentence");
  ok(html.includes(`mailto:${LEGAL_OPERATOR.email}`), "the contact path is the existing mailto");
  ok(html.includes(`>${LEGAL_OPERATOR.email}<`), "the contact address is visible");
  ok(!text.includes("Dokument wird bereitgestellt"), "the notice is not the pending state");
  ok(!html.includes("PurchaseConversion") && !html.includes("gtag("), "the notice mounts no conversion");

  const pending = textOf(
    renderToStaticMarkup(
      createElement(SuccessPending, {
        href: "/success?session_id=cs_live_paid",
        sessionId: "cs_live_paid",
      }),
    ),
  );
  ok(pending.includes("Dokument wird bereitgestellt"), "a payable session still shows the pending copy");
  ok(!pending.includes(SUCCESS_SESSION_INVALID_HEADING), "the pending state does not show the invalid heading");
}

function checkBodies() {
  const notFound = checkoutLookupError({
    code: "resource_missing",
    message: "No such checkout.session: cs_missing",
    statusCode: 404,
  });
  ok(notFound === "invalid", "a missing Checkout Session is the invalid error");

  for (const error of ["missing", "invalid", "not_paid"] as const) {
    ok(isUnresolvableCheckoutSession({ error }), `${error} cannot be resolved`);
    ok(
      successPageBody({
        sheetsDown: false,
        hasRow: false,
        allowed: false,
        sessionId: "cs_live_bad",
        sessionInvalid: true,
      }) === "invalid",
      `${error} with no document shows the notice`,
    );
  }
  ok(
    !isUnresolvableCheckoutSession({ error: "lookup_failed" }),
    "a Stripe outage is not an invalid session",
  );
  ok(
    successPageBody({
      sheetsDown: false,
      hasRow: false,
      allowed: false,
      sessionId: "cs_live_paid",
      sessionInvalid: false,
    }) === "pending",
    "a payable session without a document still waits",
  );
  ok(
    successPageBody({
      sheetsDown: false,
      hasRow: true,
      allowed: true,
      sessionId: "cs_live_paid",
      sessionInvalid: false,
    }) === "ready",
    "a paid document stays on the success view",
  );
  ok(
    successPageBody({
      sheetsDown: false,
      hasRow: true,
      allowed: true,
      sessionId: "cs_live_paid",
      sessionInvalid: true,
    }) === "ready",
    "a stored document is not replaced by the invalid notice",
  );
  ok(
    successPageBody({
      sheetsDown: false,
      hasRow: true,
      allowed: false,
      sessionId: "cs_live_paid",
      sessionInvalid: false,
    }) === "denied",
    "a foreign document still hides the draft",
  );
  ok(
    successPageBody({
      sheetsDown: false,
      hasRow: false,
      allowed: false,
      sessionId: "",
      sessionInvalid: false,
    }) === "invalid",
    "no session id shows the same invalid notice",
  );
  ok(
    successPageBody({
      sheetsDown: false,
      hasRow: false,
      allowed: false,
      sessionId: "",
      sessionInvalid: true,
    }) === "invalid",
    "no session id stays invalid even if a probe would fail",
  );
  ok(purchaseSessionIdFromCheckout({ error: "invalid" }) === "", "invalid does not yield a conversion id");
  ok(purchaseSessionIdFromCheckout({ error: "missing" }) === "", "missing does not yield a conversion id");
  ok(purchaseSessionIdFromCheckout({ error: "not_paid" }) === "", "unpaid does not yield a conversion id");
  ok(
    purchaseSessionIdFromCheckout(PAID) === "cs_live_paid",
    "a paid checkout still yields the conversion id",
  );
}

async function checkProbeBudget() {
  clearSuccessCheckoutProbes();
  let calls = 0;
  const resolve = async (): Promise<SuccessCheckoutResult> => {
    calls += 1;
    return { error: "invalid" };
  };
  const now = 1_700_000_000_000;
  ok(
    shouldProbeSuccessCheckout({
      sheetsDown: false,
      hasRow: false,
      sessionId: "cs_live_bad",
      alreadyChecked: false,
    }),
    "a missing document probes once",
  );
  const first = await probeSuccessCheckout("cs_live_bad", resolve, now);
  const second = await probeSuccessCheckout("cs_live_bad", resolve, now + 1_000);
  ok(isUnresolvableCheckoutSession(first) && isUnresolvableCheckoutSession(second), "both reads see the invalid session");
  ok(calls === 1, "the probe does not retrieve the same session twice inside the window");
  await probeSuccessCheckout("cs_live_bad", resolve, now + SUCCESS_CHECKOUT_PROBE_TTL_MS);
  ok(calls === 2, "the probe may retrieve again only after the window");

  ok(
    !shouldProbeSuccessCheckout({
      sheetsDown: false,
      hasRow: true,
      sessionId: "cs_live_paid",
      alreadyChecked: false,
    }),
    "a stored document does not add a Stripe retrieve",
  );
  ok(
    !shouldProbeSuccessCheckout({
      sheetsDown: false,
      hasRow: false,
      sessionId: "cs_live_paid",
      alreadyChecked: true,
    }),
    "the pending reload does not retrieve the session again",
  );
  ok(
    !shouldProbeSuccessCheckout({
      sheetsDown: true,
      hasRow: false,
      sessionId: "cs_live_paid",
      alreadyChecked: false,
    }),
    "a sheets outage does not retrieve the session",
  );
  ok(
    !shouldProbeSuccessCheckout({
      sheetsDown: false,
      hasRow: false,
      sessionId: "",
      alreadyChecked: false,
    }),
    "a visit without a session id does not retrieve Stripe",
  );

  ok(
    successPendingHref({
      sessionId: "cs_live_paid",
      documentId: "doc_1",
      checked: false,
    }) === "/success?session_id=cs_live_paid&document_id=doc_1",
    "an unchecked pending link matches the previous query",
  );
  ok(
    successPendingHref({
      sessionId: "cs_live_paid",
      documentId: "doc_1",
      checked: true,
    }) ===
      `/success?session_id=cs_live_paid&document_id=doc_1&${SUCCESS_CHECKOUT_CHECKED_PARAM}=1`,
    "a checked pending link keeps the session and skips another retrieve",
  );
}

function checkPageSource() {
  const source = readFileSync("app/success/page.tsx", "utf8");
  const pendingSource = readFileSync("components/success-status.tsx", "utf8");
  ok(
    (source.match(/await lookupSuccessPurchase\(sessionId, resolveCheckoutSession\)/g) ?? []).length === 1 &&
      !/await resolveCheckoutSession\(/.test(source),
    "the success page still awaits Stripe once for the purchase conversion, behind the negative cache",
  );
  ok(
    source.includes('showSuccess && sessionId.startsWith("cs_")'),
    "purchase conversion still starts from a paid success view",
  );
  ok(source.includes("Ihr Entwurf ist fertig"), "the paid success heading is unchanged");
  ok(source.includes('body === "invalid"'), "the page has an invalid branch");
  ok(source.includes("<SuccessSessionInvalid"), "the invalid branch renders the notice");
  ok(source.includes('body === "pending"'), "a payable session still reaches the pending view");
  ok(source.includes('body === "ready" && row'), "a stored document still reaches the success view");
  ok(pendingSource.includes("Dokument wird bereitgestellt"), "pending copy is unchanged");
  ok(pendingSource.includes("window.location.replace(href)"), "the pending poll follows the checked link");
  ok(
    pendingSource.includes("return <SuccessNotFound />"),
    "a payable session that times out still says the document was not found",
  );
  ok(source.includes("<SuccessNotFound"), "a hidden document still uses the not-found view");
  ok(source.includes("export async function generateMetadata"), "the invalid title comes from generateMetadata");
  ok(source.includes("title: successPageTitle(model.body)"), "the title follows the same view as the page");

  const invalidAt = source.indexOf('body === "invalid"');
  const pendingAt = source.indexOf("<SuccessPending");
  const readyAt = source.indexOf('body === "ready"');
  const conversionAt = source.indexOf("<PurchaseConversion");
  ok(invalidAt !== -1 && invalidAt < pendingAt && pendingAt < readyAt, "invalid and pending stay before the success view");
  ok(readyAt < conversionAt, "the conversion stays on the success view");
  ok(source.indexOf("<PurchaseConversion", conversionAt + 1) === -1, "the success page mounts one conversion");
  ok(
    !source.slice(invalidAt, pendingAt).includes("PurchaseConversion"),
    "the invalid branch does not mount the conversion",
  );
  ok(
    !source.slice(invalidAt, pendingAt).includes("SuccessNotFound"),
    "the invalid branch does not use the not-found view",
  );
}

function checkTitle() {
  const composed = `${SUCCESS_INVALID_TITLE} | ${SITE_NAME}`;
  ok(SUCCESS_INVALID_TITLE === "Bestell-Sitzung ungültig", "the invalid title segment is fixed");
  ok(SITE_NAME === "GoBD Verfahrensdoku", "the site name in the title template is unchanged");
  ok(
    composed === "Bestell-Sitzung ungültig | GoBD Verfahrensdoku",
    "the invalid document title is the segment plus the site name",
  );
  ok(successPageTitle("invalid") === SUCCESS_INVALID_TITLE, "an invalid view uses the invalid title");
  ok(successPageTitle("ready") === SUCCESS_DOCUMENT_TITLE, "a paid document keeps Dokument bereit");
  ok(successPageTitle("pending") === SUCCESS_DOCUMENT_TITLE, "the pending wait keeps Dokument bereit");
  ok(successPageTitle("denied") === SUCCESS_DOCUMENT_TITLE, "a hidden document keeps Dokument bereit");
  ok(successPageTitle("sheets") === SUCCESS_DOCUMENT_TITLE, "a sheets outage keeps Dokument bereit");
  ok(SUCCESS_DOCUMENT_TITLE === "Dokument bereit", "the paid title segment is unchanged");
  const layout = readFileSync("app/layout.tsx", "utf8");
  ok(layout.includes("template: `%s | ${SITE_NAME}`"), "the root title template still appends the site name");
}

async function main() {
  checkNotice();
  checkBodies();
  await checkProbeBudget();
  checkPageSource();
  checkTitle();
  console.log("check-success-session: ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
