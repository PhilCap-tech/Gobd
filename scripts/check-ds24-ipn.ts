/**
 * Digistore24 IPN: Signatur, Produktfilter, Zugang anlegen/sperren,
 * genau ein Anmeldelink pro Bestellung, ein Inhaber-Hinweis pro Ereignis.
 * Fake-Passphrase, gestubbter Versand, Datei-Store im Temp-Ordner.
 * Kein Netzwerk, kein Blob, kein Sheet, keine echte Mail.
 *
 *   npx tsx scripts/check-ds24-ipn.ts
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// Vor allen Imports der App: keine Live-Zugänge im Prozess.
for (const key of [
  "RESEND_API_KEY",
  "EMAIL_FROM",
  "BLOB_READ_WRITE_TOKEN",
  "GOOGLE_SERVICE_ACCOUNT_EMAIL",
  "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY",
  "GOOGLE_SHEETS_SPREADSHEET_ID",
  "STRIPE_SECRET_KEY",
  "DIGISTORE24_IPN_PASSPHRASE",
]) {
  delete process.env[key];
}
if (!(process.env.npm_lifecycle_event ?? "").startsWith("check:") && process.env.npm_lifecycle_event !== "prebuild") {
  process.env.npm_lifecycle_event = "check:ds24-ipn";
}

const FAKE_PASSPHRASE = "check-ds24-fake-passphrase";
const BUYER = "ds24-buyer@example.com";
const OTHER = "ds24-other@example.com";

function ok(cond: unknown, msg: string): void {
  assert.ok(cond, msg);
  console.log("ok:", msg);
}

async function main(): Promise<void> {
  const { POST } = await import("../app/api/digistore24/ipn/route");
  const { ds24Signature, ds24ParamMap, buildDs24NoticeMail } = await import("../lib/digistore24-ipn");
  const { hasDs24Access, setDs24AccessTestHooks, ds24AccessStoreKind } = await import(
    "../lib/digistore24-access"
  );
  const { setMailDedupeTestHooks } = await import("../lib/mail-dedupe");
  const { CHECKOUT_NOTICE_TO } = await import("../lib/checkout-notice");
  const { automatedRunForbidsLiveWrites } = await import("../lib/live-write-guard");

  ok(automatedRunForbidsLiveWrites(), "the check runs with live writes forbidden");

  const root = mkdtempSync(path.join(tmpdir(), "gobd-ds24-ipn-"));
  const sent: { to: string; subject: string; text: string }[] = [];
  setDs24AccessTestHooks({ dir: path.join(root, "access") });
  setMailDedupeTestHooks({
    dir: path.join(root, "mail"),
    send: async (input) => {
      sent.push({ to: input.to, subject: input.subject, text: input.text });
      return { stub: false, sent: true, id: `stub-${sent.length}` };
    },
  });
  ok(ds24AccessStoreKind() === "file", "the access store is the temp file store");

  try {
    // Doku-Beispiel (dev.digistore24.com, Events → SHA-Signature).
    const docExample = ds24ParamMap([
      ["buyer_email", "claus@domain-xyz.de"],
      ["payment_id", "PAYID-39-22012"],
      ["order_id", "273732"],
      ["transaction_amount", "17.00"],
      ["transaction_currency", "USD"],
    ]);
    ok(
      ds24Signature("xxxxx", docExample) ===
        "342770076245D14ED7DF4D2E5D82216D7EDF8F9E7969B5964C9C5DCB53E962BBECD545E90422B5329C69554FD8B1A7E7410736615FCA7FB5CBB3624CC016E4BC",
      "signature matches the Digistore24 documentation example",
    );

    function form(fields: Record<string, string>, passphrase = FAKE_PASSPHRASE): string {
      const params = new URLSearchParams(fields);
      const sign = ds24Signature(passphrase, ds24ParamMap(params.entries()));
      params.set("sha_sign", sign);
      return params.toString();
    }

    async function post(body: string): Promise<{ status: number; text: string }> {
      const response = await POST(
        new Request("https://www.gobd-doku-erstellen.de/api/digistore24/ipn", {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body,
        }),
      );
      return { status: response.status, text: await response.text() };
    }

    const payment = {
      event: "on_payment",
      api_mode: "live",
      product_id: "751404",
      order_id: "DS24ORDER1",
      payment_id: "PAYID-1",
      email: BUYER,
      address_first_name: "",
      billing_type: "subscription",
    };

    // 1) Keine Passphrase → 503, nichts passiert.
    let res = await post(form(payment));
    ok(res.status === 503 && res.text === "", "missing passphrase answers 503 without body");
    ok(sent.length === 0 && !(await hasDs24Access(BUYER)), "missing passphrase creates nothing");

    process.env.DIGISTORE24_IPN_PASSPHRASE = FAKE_PASSPHRASE;

    // 2) Falsche Signatur → 403 ohne Detail.
    res = await post(form(payment, "wrong-passphrase"));
    ok(res.status === 403 && res.text === "", "bad signature answers 403 without detail");
    const tampered = new URLSearchParams(form(payment));
    tampered.set("email", OTHER);
    res = await post(tampered.toString());
    ok(res.status === 403, "a changed field breaks the signature");
    ok(sent.length === 0 && !(await hasDs24Access(BUYER)) && !(await hasDs24Access(OTHER)), "bad signature creates nothing");

    // 3) Verbindungstest → OK.
    res = await post(form({ event: "connection_test", api_mode: "test", product_ids: "751404,751419" }));
    ok(res.status === 200 && res.text === "OK", "connection_test answers OK");

    // 4) Fremdes Produkt → OK, ignoriert.
    res = await post(form({ ...payment, product_id: "999999", email: OTHER, order_id: "FOREIGN1" }));
    ok(res.status === 200 && res.text === "OK", "another product answers OK");
    ok(sent.length === 0 && !(await hasDs24Access(OTHER)), "another product creates no access and no mail");

    // 5) Zahlung → Zugang + genau ein Anmeldelink + genau ein Inhaber-Hinweis.
    res = await post(form(payment));
    ok(res.status === 200 && res.text === "OK", "on_payment answers OK");
    ok(await hasDs24Access(BUYER), "on_payment creates access");
    ok(await hasDs24Access("  DS24-Buyer@Example.com "), "the access check is case-insensitive");
    const buyerMails = sent.filter((m) => m.to === BUYER);
    const notices = sent.filter((m) => m.to === CHECKOUT_NOTICE_TO);
    ok(buyerMails.length === 1, "on_payment sends exactly one login mail to the buyer");
    ok(buyerMails[0]?.subject === "Ihr Anmeldelink — GoBD Verfahrensdoku", "the login mail is the existing /login template");
    ok(/\/auth\/verify\?token=/.test(buyerMails[0]?.text ?? ""), "the login mail carries a magic link");
    ok(/Ihr|Sie/.test(buyerMails[0]?.text ?? "") && !/\bdu\b|\bdein/i.test(buyerMails[0]?.text ?? ""), "the login mail uses formal Sie");
    ok(notices.length === 1, "on_payment sends exactly one owner notice");
    const noticeText = notices[0]?.text ?? "";
    ok(
      noticeText.includes(BUYER) &&
        noticeText.includes("751404") &&
        noticeText.includes("DS24ORDER1") &&
        noticeText.includes("on_payment"),
      "the owner notice names email, product, order and event",
    );
    ok(sent.length === 2, "no other mail was sent");

    // 6) Wiederholte IPN → keine zweite Mail.
    res = await post(form(payment));
    ok(res.status === 200 && res.text === "OK", "a repeated on_payment answers OK");
    ok(sent.length === 2, "a repeated on_payment sends no second login mail and no second notice");

    // Zweites Produkt 751419 wird ebenfalls angenommen.
    res = await post(form({ ...payment, product_id: "751419", order_id: "DS24ORDER2", payment_id: "PAYID-2", email: OTHER }));
    ok(res.status === 200 && (await hasDs24Access(OTHER)), "product 751419 is accepted");
    ok(sent.length === 4, "the second order sends one login mail and one notice");

    // Ereignisse ohne Sperre ändern den Zugang nicht.
    res = await post(form({ ...payment, event: "on_rebill_cancelled" }));
    ok(res.status === 200 && (await hasDs24Access(BUYER)), "on_rebill_cancelled keeps access until last_paid_day");
    res = await post(form({ ...payment, event: "on_payment_missed" }));
    ok(res.status === 200 && (await hasDs24Access(BUYER)), "on_payment_missed keeps access");
    ok(sent.length === 4, "non-blocking events send no mail");

    // 7) Erstattung sperrt, ein Hinweis, keine Wiederholung.
    res = await post(form({ ...payment, event: "on_refund" }));
    ok(res.status === 200 && res.text === "OK", "on_refund answers OK");
    ok(!(await hasDs24Access(BUYER)), "on_refund blocks access");
    ok(sent.length === 5 && sent[4]?.to === CHECKOUT_NOTICE_TO && sent[4].text.includes("on_refund"), "on_refund sends one owner notice");
    res = await post(form({ ...payment, event: "on_refund" }));
    ok(sent.length === 5, "a repeated on_refund sends no second notice");

    // Verspätete Wiederholung der alten Zahlung hebt die Sperre nicht auf.
    res = await post(form(payment));
    ok(res.status === 200 && !(await hasDs24Access(BUYER)), "a late retry of the refunded payment keeps the block");
    ok(sent.length === 5, "the late retry sends no mail");

    // Fix 2: Nach Erstattung reaktiviert auch eine neue oder fehlende payment_id nichts.
    res = await post(form({ ...payment, payment_id: "PAYID-NEW-AFTER-REFUND" }));
    ok(res.status === 200 && res.text === "OK", "on_payment after refund with a new payment_id answers OK");
    ok(!(await hasDs24Access(BUYER)), "on_payment after refund with a new payment_id keeps the block");
    const { payment_id: _dropped, ...paymentNoId } = payment;
    void _dropped;
    res = await post(form(paymentNoId));
    ok(res.status === 200 && !(await hasDs24Access(BUYER)), "on_payment after refund without payment_id keeps the block");
    res = await post(form({ ...paymentNoId, transaction_id: "TX-OTHER" }));
    ok(res.status === 200 && !(await hasDs24Access(BUYER)), "on_payment after refund with another transaction_id keeps the block");
    ok(sent.filter((m) => m.to === BUYER).length === 1, "no login mail after refund");
    const sentAfterRefundRetries = sent.length;
    {
      const { readdirSync } = await import("node:fs");
      const raw = readdirSync(path.join(root, "access"))
        .map((f) => readFileSync(path.join(root, "access", f), "utf8"))
        .find((t) => t.includes("DS24ORDER1"));
      ok(raw?.includes('"permanentBlock":"on_refund"'), "the refunded order stores a permanent refund flag");
    }

    // Chargeback und Abo-Ende sperren ebenfalls.
    res = await post(form({ ...payment, product_id: "751419", order_id: "DS24ORDER2", payment_id: "PAYID-2", email: OTHER, event: "on_chargeback" }));
    ok(!(await hasDs24Access(OTHER)), "on_chargeback blocks access");
    ok(sent.length === sentAfterRefundRetries + 1, "on_chargeback sends one owner notice");
    await post(form({ ...payment, product_id: "751419", order_id: "DS24ORDER2", payment_id: "PAYID-CB-NEW", email: OTHER }));
    ok(!(await hasDs24Access(OTHER)), "on_payment after chargeback with a new payment_id keeps the block");
    const third = { ...payment, order_id: "DS24ORDER3", payment_id: "PAYID-3", email: "ds24-third@example.com" };
    await post(form(third));
    ok(await hasDs24Access(third.email), "a third order is active");
    await post(form({ ...third, event: "last_paid_day" }));
    ok(!(await hasDs24Access(third.email)), "last_paid_day blocks access");
    const beforeThird = sent.length;
    ok(sent.filter((m) => m.to === third.email).length === 1, "the third order got one login mail");
    // last_paid_day ist keine dauerhafte Sperre: eine neue Zahlung aktiviert wieder.
    await post(form({ ...third, payment_id: "PAYID-3B" }));
    ok(await hasDs24Access(third.email), "a new payment after last_paid_day reactivates access (unchanged)");
    ok(sent.length > beforeThird, "the reactivation sends an owner notice");
    // Erstattung nach Abo-Ende setzt die dauerhafte Sperre trotzdem.
    await post(form({ ...third, payment_id: "PAYID-3B", event: "last_paid_day" }));
    await post(form({ ...third, payment_id: "PAYID-3B", event: "on_refund" }));
    await post(form({ ...third, payment_id: "PAYID-3C" }));
    ok(!(await hasDs24Access(third.email)), "a refund after last_paid_day blocks permanently");

    // Eine Folgezahlung (neue payment_id) derselben aktiven Bestellung: nur Hinweis.
    const fourth = { ...payment, order_id: "DS24ORDER4", payment_id: "PAYID-4", email: "ds24-fourth@example.com" };
    await post(form(fourth));
    await post(form({ ...fourth, payment_id: "PAYID-4B" }));
    ok(await hasDs24Access(fourth.email), "a rebill keeps access");
    ok(sent.filter((m) => m.to === fourth.email).length === 1, "a rebill sends no second login mail");
    ok(sent.filter((m) => m.to === CHECKOUT_NOTICE_TO && m.text.includes("DS24ORDER4")).length === 2, "each payment of an order gets one notice");

    // Fix 3: gültig signiert, aber ohne Mail oder Bestell-ID → OK + Inhaber-Hinweis, einmal.
    const noticeCount = () => sent.filter((m) => m.to === CHECKOUT_NOTICE_TO).length;
    let before = noticeCount();
    const { email: _e, ...noEmail } = { ...payment, order_id: "DS24ORDER5", payment_id: "PAYID-5" };
    void _e;
    res = await post(form(noEmail));
    ok(res.status === 200 && res.text === "OK", "IPN without email answers OK as before");
    ok(noticeCount() === before + 1, "IPN without email sends one owner notice");
    const incompleteMail = sent[sent.length - 1];
    ok(
      incompleteMail?.to === CHECKOUT_NOTICE_TO &&
        /unvollständig/.test(incompleteMail.subject) &&
        incompleteMail.text.includes("DS24ORDER5") &&
        !incompleteMail.text.includes(FAKE_PASSPHRASE) &&
        !/sha_sign/i.test(incompleteMail.text),
      "the incomplete notice names the order and carries no secret or signature",
    );
    res = await post(form(noEmail));
    ok(noticeCount() === before + 1, "a repeated IPN without email sends no second notice");
    before = noticeCount();
    const { order_id: _o, payment_id: _p, ...noOrder } = { ...payment, email: "ds24-noorder@example.com", invoice_url: "x" };
    void _o;
    void _p;
    res = await post(form(noOrder));
    ok(res.status === 200 && res.text === "OK", "IPN without order_id and payment_id answers OK");
    ok(noticeCount() === before + 1, "IPN without order_id sends one owner notice (param hash dedupe)");
    await post(form(noOrder));
    ok(noticeCount() === before + 1, "a repeated IPN without order_id sends no second notice");
    await post(form({ ...noOrder, invoice_url: "y" }));
    ok(noticeCount() === before + 2, "a different incomplete IPN gets its own notice");
    ok(!(await hasDs24Access("ds24-noorder@example.com")), "an incomplete IPN creates no access");
    res = await post(form(noEmail, "wrong-passphrase"));
    ok(res.status === 403 && noticeCount() === before + 2, "an unsigned incomplete IPN sends no notice");

    ok(!sent.some((m) => m.to.includes("sdc-ventures")), "no real customer mailbox in the check");
    ok(buildDs24NoticeMail({ event: "on_payment", email: BUYER, productId: "751404", orderId: "X", paymentId: "", apiMode: "test", at: 0 }).subject.includes("[Test]"), "test-mode notices are marked");

    // Speicherumfang: keine IP, kein User-Agent, kein IPN-Dump.
    const { readdirSync } = await import("node:fs");
    const files = readdirSync(path.join(root, "access"));
    const stored = files.map((f) => readFileSync(path.join(root, "access", f), "utf8")).join("\n");
    ok(!/address_first_name|billing_type|sha_sign|ip|user_agent/i.test(stored.replace(/paymentId/g, "")), "the store keeps no IPN dump, IP or user agent");

    // Zugangsprüfungen verwenden den DS24-Zugang.
    const src = (file: string) => readFileSync(file, "utf8");
    ok(src("app/intake/page.tsx").includes("hasDs24Access"), "intake page accepts DS24 access");
    ok(src("app/api/intake/route.ts").includes("ds24Access: hasDs24Access"), "intake submit accepts DS24 access");
    ok(src("app/checkout/page.tsx").includes("ds24CheckoutRedirect"), "checkout page sends DS24 buyers to their access");
    ok(src("app/api/checkout/route.ts").includes("ds24CheckoutRedirect"), "checkout API sends DS24 buyers to their access");
    ok(src("app/account/page.tsx").includes("hasDs24Access"), "account hub accepts DS24 access");

    // Fix 1: nur die Comp-Allowlist überspringt Stripe, DS24-Zugang nicht.
    const account = src("app/account/page.tsx");
    ok(/if \(!loadFailed && !compEmail\)/.test(account), "account hub reads the Stripe customer unless comp allowlist");
    ok(/const coverage = compEmail\s*\?/.test(account), "account hub loads Stripe coverage unless comp allowlist");
    const kuend = src("app/account/kuendigung/page.tsx");
    ok(/stripeReady && !compEmail \? await resolveStripeCustomerForEmail/.test(kuend), "Kündigung looks up Stripe unless comp allowlist");
    ok(!/!compAccess \? await resolveStripeCustomerForEmail/.test(kuend), "DS24 access does not skip the Stripe lookup on Kündigung");
    ok(/compAccess && !preview\?\.subscriptionId/.test(kuend), "the DS24-only page shows only without a Stripe subscription");
    ok(/\{ds24Access && \(/.test(kuend), "Kündigung shows the DS24 status next to the Stripe subscription");
    const { createElement } = await import("react");
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { AccountAboCard } = await import("../components/account-abo");
    const both = renderToStaticMarkup(createElement(AccountAboCard, { stripeBound: true, compAccess: true, ds24Access: true }));
    ok(both.includes('href="/account/kuendigung"') && both.includes("Digistore24"), "Stripe + DS24: Abo card keeps Kündigen and names DS24");
    const ds24Only = renderToStaticMarkup(createElement(AccountAboCard, { stripeBound: false, compAccess: true, ds24Access: true }));
    ok(!ds24Only.includes('href="/account/kuendigung"') && ds24Only.includes("Digistore24"), "DS24 only: no Stripe Kündigen button");
  } finally {
    setMailDedupeTestHooks(null);
    setDs24AccessTestHooks(null);
    delete process.env.DIGISTORE24_IPN_PASSPHRASE;
    rmSync(root, { recursive: true, force: true });
  }
  console.log("check-ds24-ipn: ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
