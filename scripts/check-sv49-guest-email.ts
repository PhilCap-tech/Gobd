/**
 * Schnellversion ohne Login: Stripe fragt die E-Mail selbst ab.
 * - Ohne gültige Adresse kein `customer_email` (leer → Stripe email_invalid → 500).
 * - Mit Login-Adresse wird `customer_email` gesetzt.
 * - Echter Routenpfad POST /api/schnellversion/checkout bis zum Stripe-Aufruf.
 *   Ausgehendes Netz ist gesperrt; der Stripe-Request wird lokal abgefangen.
 * - Gastkauf: Kaufzeile bekommt die E-Mail aus customer_details.email der Session.
 */
import { EventEmitter } from "node:events";
import https from "node:https";
import net from "node:net";
import tls from "node:tls";

const GUEST = "gobd-test+sv49guest@mail.grokbot.com";
const LOGIN = "gobd-test+sv49login@mail.grokbot.com";

let failures = 0;
function ok(value: unknown, label: string): void {
  if (value) {
    console.log(`ok  ${label}`);
    return;
  }
  failures += 1;
  console.error(`FAIL ${label}`);
}

// Kein Request verlässt den Prozess.
const captured: string[] = [];
const blocked = () => {
  throw new Error("Netz im Check gesperrt");
};
(net as unknown as { connect: unknown }).connect = blocked;
(net as unknown as { createConnection: unknown }).createConnection = blocked;
(tls as unknown as { connect: unknown }).connect = blocked;
(https as unknown as { request: unknown }).request = (...args: unknown[]) => {
  const req = new EventEmitter() as EventEmitter & Record<string, unknown>;
  let body = "";
  req.setTimeout = () => req;
  req.setHeader = () => undefined;
  req.write = (chunk: string | Buffer) => {
    body += chunk.toString();
    return true;
  };
  req.end = (chunk?: string | Buffer) => {
    if (chunk) body += chunk.toString();
    captured.push(body);
    const params = new URLSearchParams(body);
    const missingEmail = params.has("customer_email") && !params.get("customer_email");
    const res = new EventEmitter() as EventEmitter & Record<string, unknown>;
    res.statusCode = missingEmail ? 400 : 200;
    res.headers = { "content-type": "application/json", "request-id": "req_local" };
    res.setEncoding = () => undefined;
    const payload = missingEmail
      ? { error: { type: "invalid_request_error", code: "email_invalid", param: "customer_email", message: "Invalid email address: " } }
      : { id: "cs_test_local_sv49", object: "checkout.session", url: "https://checkout.stripe.com/c/pay/cs_test_local_sv49" };
    setImmediate(() => {
      req.emit("response", res);
      // Stripe liest den Body erst nach dem Auflösen des Response-Promises.
      setTimeout(() => {
        res.emit("data", JSON.stringify(payload));
        res.emit("end");
      }, 5);
    });
    return req;
  };
  req.destroy = () => req;
  void args;
  // Stripe schreibt erst nach dem socket-Ereignis.
  setImmediate(() => req.emit("socket", { connecting: false }));
  return req;
};

let finished = false;
process.on("beforeExit", () => {
  if (!finished) {
    console.error("check-sv49-guest-email: vorzeitig beendet");
    process.exit(1);
  }
});

async function main(): Promise<void> {
  const { schnellversionSessionParams } = await import("../lib/schnellversion-checkout");
  const env = {
    SCHNELLVERSION_49_ENABLED: "1",
    STRIPE_PRICE_SCHNELL_49: "price_test_schnell",
    STRIPE_SECRET_KEY: "sk_live_localfake",
    STRIPE_TAX_RATE_ID: "txr_existing",
  };
  const base = { pendingId: "p", consentAt: "t", company: "Firma", downloadToken: "tok" };
  for (const empty of ["", "   ", "keine-adresse"]) {
    const params = schnellversionSessionParams({ ...base, email: empty }, env);
    ok(params && !("customer_email" in params), `ohne gültige E-Mail kein customer_email (${JSON.stringify(empty)})`);
  }
  const withMail = schnellversionSessionParams({ ...base, email: ` ${LOGIN} ` }, env);
  ok(withMail?.customer_email === LOGIN, "mit gültiger E-Mail customer_email gesetzt");

  // Echter Routenpfad, ohne und mit Login.
  process.env.SCHNELLVERSION_49_ENABLED = "1";
  process.env.PRICING_MODEL = "v3";
  process.env.STRIPE_PRICE_SCHNELL_49 = "price_test_schnell";
  process.env.STRIPE_SECRET_KEY = "sk_test_localfake";
  delete process.env.SCHNELLVERSION_49_STRIPE_STUB;
  const { NextRequest } = await import("next/server");
  const { POST } = await import("../app/api/schnellversion/checkout/route");
  const { SESSION_COOKIE, createSessionToken } = await import("../lib/auth");
  const answers = {
    firma: "Muster SV49 GmbH",
    rechtsform: "GmbH",
    branche: "handwerk",
    mitarbeitende: "2–5",
    software: "DATEV",
    softwareFrei: "",
    kasse: "Unsicher",
    bucht: "Unsere Steuerkanzlei",
  };
  const post = (cookie: string) =>
    POST(
      new NextRequest("http://localhost/api/schnellversion/checkout", {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({ answers, unternehmer: true, bewusst: true, agb: true }),
      }),
    );
  captured.length = 0;
  const guest = await post("sv49_arm=test");
  ok(guest.status === 200, `Route ohne Login antwortet 200 (ist ${guest.status})`);
  ok(captured.length === 1 && !new URLSearchParams(captured[0]).has("customer_email"), "Route ohne Login sendet kein customer_email");
  captured.length = 0;
  const logged = await post(`sv49_arm=test; ${SESSION_COOKIE}=${createSessionToken(LOGIN)}`);
  ok(logged.status === 200, `Route mit Login antwortet 200 (ist ${logged.status})`);
  ok(captured.length === 1 && new URLSearchParams(captured[0]).get("customer_email") === LOGIN, "Route mit Login setzt customer_email");

  // Lieferung beim Gastkauf: E-Mail aus customer_details.email (Webhook-Nachweis).
  const { openSchnellversionCheckout, confirmPaidSession } = await import("../lib/schnellversion-payment");
  const stubPaid = {
    SCHNELLVERSION_49_ENABLED: "1",
    STRIPE_PRICE_SCHNELL_49: "price_test_schnell",
    SCHNELLVERSION_49_STRIPE_STUB: "paid",
  };
  const opened = await openSchnellversionCheckout({ answers, unternehmer: true, bewusst: true, agb: true, email: "", arm: "test", env: stubPaid });
  ok(opened.ok, "Gast-Checkout (Stub) öffnet");
  const confirmed = await confirmPaidSession(opened.ok ? opened.sessionId : "", { env: stubPaid, email: GUEST });
  ok(confirmed.paid && confirmed.purchase.email === GUEST, "Gastkauf speichert die E-Mail aus customer_details.email");
  const loginOpened = await openSchnellversionCheckout({ answers, unternehmer: true, bewusst: true, agb: true, email: LOGIN, arm: "test", env: stubPaid });
  const loginConfirmed = await confirmPaidSession(loginOpened.ok ? loginOpened.sessionId : "", { env: stubPaid, email: GUEST });
  ok(loginConfirmed.paid && loginConfirmed.purchase.email === LOGIN, "Login-Adresse hat Vorrang vor customer_details.email");

  const webhook = (await import("node:fs")).readFileSync("app/api/stripe/webhook/route.ts", "utf8");
  ok(/confirmPaidSession\(session\.id, \{[\s\S]{0,200}email/.test(webhook), "Webhook übergibt customer_details.email an confirmPaidSession");

  const kauf = (await import("node:fs")).readFileSync("components/schnellversion-kauf.tsx", "utf8");
  const buy = kauf.slice(kauf.indexOf("async function buy()"), kauf.indexOf("if (!answers)"));
  ok(/if \(!response\.ok\)[\s\S]{0,80}setError\(SV_CHECKOUT_START_FAILED\)/.test(buy) && buy.indexOf("!response.ok") < buy.indexOf("response.json()"), "Kaufseite zeigt bei non-2xx einen Hinweis");
  ok(/catch \{\s*setError\(SV_CHECKOUT_START_FAILED\)/.test(buy), "Kaufseite zeigt bei Netzfehler einen Hinweis");

  finished = true;
  if (failures) {
    console.error(`check-sv49-guest-email: ${failures} Fehler`);
    process.exit(1);
  }
  finished = true;
  console.log("check-sv49-guest-email: ok");
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
