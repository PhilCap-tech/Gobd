/**
 * Phase 2 neues Preismodell (28.10.): Login zuerst (Schalter + Default),
 * Entwurfs-Marker v3/updatedAt, Limits, Übernahme des Entwurfs erst nach
 * bestätigter Zahlung, eine Firma je v3-Konto, Ein-Klick-Abmeldung von
 * Angebots-Mails (HMAC, kein Klartext, Cron überspringt). Synthetisch:
 * kein Stripe, kein Resend, kein Blob, kein Sheets.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// Schalter-Isolation: echte Build-Umgebung (Prod) darf die Prüfungen nicht beeinflussen.
for (const name of [
  "RETENTION_EXECUTE_ENABLED", "RETENTION_DRY_RUN_ENABLED", "PLAN_ADDON_NOTICE_ENABLED",
  "RETENTION_NOTICE_ENABLED", "RETENTION_DELETE_ENABLED", "RENEWAL_NOTICE_ENABLED",
]) delete process.env[name];

for (const name of ["PRICING_MODEL", "INTAKE_LOGIN_FIRST_ENABLED", "PLAN_ADDON_NOTICE_ENABLED", "RESEND_API_KEY", "BLOB_READ_WRITE_TOKEN", "VERCEL_ENV"]) {
  delete process.env[name];
}
process.env.MAGIC_LINK_SECRET = "check-v3-intake-offline-secret";

let passed = 0;
async function check(name: string, run: () => void | Promise<void>) {
  await run();
  passed += 1;
  console.log(`ok: ${name}`);
}
const read = (p: string) => readFileSync(path.join(process.cwd(), p), "utf8");

async function main() {
  const pm = await import("@/lib/pricing-model");
  const prepay = await import("@/lib/prepay-draft");
  const firm = await import("@/lib/v3-firm-limit");
  const optout = await import("@/lib/offer-optout");
  const notice = await import("@/lib/plan-addon-notice");
  const plan = await import("@/lib/plan");
  const marker = await import("@/lib/blob-marker");

  await check("Login zuerst: Legacy aus, neues Modell Default an, abschaltbar", () => {
    assert.equal(pm.intakeLoginFirstEnabled(), false);
    process.env.PRICING_MODEL = "v3";
    assert.equal(pm.intakeLoginFirstEnabled(), true);
    process.env.INTAKE_LOGIN_FIRST_ENABLED = "false";
    assert.equal(pm.intakeLoginFirstEnabled(), false);
    delete process.env.INTAKE_LOGIN_FIRST_ENABLED;
    delete process.env.PRICING_MODEL;
  });

  await check("Entwurf: v3-Marker, Größenlimit, max. 3 offene unbezahlte Login-Entwürfe", () => {
    const route = read("app/api/intake/draft/route.ts");
    assert.ok(route.includes('pricingModel: "v3"'));
    assert.ok(route.includes("MAX_DRAFT_ANSWER_BYTES") && route.includes("413"));
    assert.ok(route.includes("MAX_OPEN_UNPAID_DRAFTS = 3") && route.includes("DRAFT_LIMIT_MESSAGE, 429"));
    assert.ok(route.includes("(stored.pricingModel ?? \"\") === (next.pricingModel ?? \"\")"), "Marker auch bei unverändertem Inhalt");
    const page = read("app/fragebogen/page.tsx");
    assert.ok(page.includes("LoginForm") && page.includes("PLAN_OFFER_OBJECTION_NOTICE"), "Login + Widerspruch am E-Mail-Feld");
    assert.ok(page.includes("emailNotice={PLAN_OFFER_OBJECTION_NOTICE}"), "Fragebogen-Login: Widerspruch per Prop am Feld, nicht darunter");
    const login = read("app/login/login-form.tsx");
    assert.ok(login.includes('aria-describedby={emailNotice ? "email-objection" : undefined}') && login.includes('id="email-objection"'), "Login: aria-describedby");
    assert.ok(page.includes("prepayHref"), "nach der letzten Frage: Paketwahl");
    // Checkout/Paketwahl: Widerspruchshinweis direkt am E-Mail-Feld, nicht unter dem ganzen Formular (CoS 28.10.).
    const form = read("app/checkout/checkout-form.tsx");
    const emailField = form.slice(form.indexOf('htmlFor="email"'), form.indexOf('name="entrepreneur"'));
    assert.ok(emailField.includes("{PLAN_OFFER_OBJECTION_NOTICE}") && emailField.includes('id="email-objection"'), "Checkout: Widerspruch am E-Mail-Feld");
    assert.ok(!read("components/plan-checkout.tsx").includes("PLAN_OFFER_OBJECTION_NOTICE"), "Checkout: Widerspruch nicht doppelt unter den Paketen");
    const intake = read("app/api/intake/route.ts");
    assert.ok(intake.includes('"Checkout-Session fehlt.", 401'), "Erstellung nur mit bezahlter Session");
  });

  await check("Checkout: nur eigener Login-Entwurf, Rückkehr über /fragebogen/bezahlt", () => {
    const route = read("app/api/checkout/route.ts");
    assert.ok(route.includes("function ownLoginDraftKey") && route.includes("`email:${sessionEmail.trim().toLowerCase()}:`"));
    const pc = read("lib/plan-checkout.ts");
    assert.ok(pc.includes("/fragebogen/bezahlt?session_id={CHECKOUT_SESSION_ID}"));
  });

  await check("Nach Zahlung: Entwurf kopiert, Quelle als bezahlt markiert, fremd = verweigert", async () => {
    const store = new Map<string, import("@/lib/intake-draft-shared").IntakeDraft>();
    const key = "email:k@example.com:gesamt";
    store.set(key, { draftKey: key, email: "k@example.com", answers: { a: 1 } as never, step: 9, updatedAt: "2026-10-01T00:00:00.000Z", pricingModel: "v3" } as never);
    const io = { load: async (k: string) => store.get(k) ?? null, save: async (d: import("@/lib/intake-draft-shared").IntakeDraft) => { store.set(d.draftKey, d); } };
    const identity = { email: "K@example.com", company: "", stripeSessionId: "cs_test_1", stripeCustomerId: "", stub: false, draftKey: key };
    assert.equal(await prepay.adoptPaidDraft({ sessionEmail: "x@example.com", identity }, io), "denied");
    assert.equal(await prepay.adoptPaidDraft({ sessionEmail: "k@example.com", identity: { ...identity, draftKey: "email:x@example.com:gesamt" } }, io), "denied");
    assert.equal(await prepay.adoptPaidDraft({ sessionEmail: "k@example.com", identity }, io), "copied");
    const copied = [...store.values()].find((d) => d.draftKey !== key)!;
    assert.ok(copied.draftKey.startsWith("session:") && copied.stripeSessionId === "cs_test_1" && copied.pricingModel === "v3");
    assert.equal(store.get(key)?.stripeSessionId, "cs_test_1", "Login-Entwurf zählt nicht mehr als unbezahlt");
    assert.equal(store.get(key)?.updatedAt, "2026-10-01T00:00:00.000Z");
    assert.equal(await prepay.adoptPaidDraft({ sessionEmail: "k@example.com", identity }, io), "exists", "idempotent");
  });

  await check("Eine Firma je v3-Konto; Legacy/DS24/Comp unverändert", () => {
    const base = { newModel: true, comp: false, ds24: false, planModel: "", paidCheckout: false };
    assert.equal(firm.v3FirmDenialFrom(base, 0), null, "erste Firma frei");
    assert.equal(firm.v3FirmDenialFrom(base, 1), firm.V3_ONE_FIRM_MESSAGE);
    assert.equal(firm.V3_ONE_FIRM_MESSAGE, "Für jede weitere Firma legen Sie bitte ein eigenes Konto mit einer eigenen E-Mail-Adresse an.");
    assert.equal(firm.v3FirmDenialFrom({ ...base, planModel: "v3", paidCheckout: true }, 1), firm.V3_ONE_FIRM_MESSAGE);
    assert.equal(firm.v3FirmDenialFrom({ ...base, paidCheckout: true }, 3), null, "Legacy-Kunde");
    assert.equal(firm.v3FirmDenialFrom({ ...base, ds24: true }, 3), null, "DS24");
    assert.equal(firm.v3FirmDenialFrom({ ...base, comp: true }, 3), null, "Comp");
    assert.equal(firm.v3FirmDenialFrom({ ...base, newModel: false }, 3), null, "PRICING_MODEL=legacy");
    assert.ok(read("app/api/entities/route.ts").includes("v3FirmDenial"));
    assert.ok(read("app/api/checkout/route.ts").includes("v3FirmDenial"));
    assert.ok(read("app/account/firma/neu/page.tsx").includes("v3FirmDenial"));
  });

  await check("Abmeldung: Token ohne Klartext, Fälschung abgelehnt, Marker + Plan-Spalte, Cron sendet neutral", async () => {
    marker.setBlobMarkerTestDir(mkdtempSync(path.join(tmpdir(), "offer-optout-")));
    const email = "Max.Muster@Example.de";
    const token = optout.offerOptOutToken(email);
    assert.ok(!token.includes("@") && !/muster/i.test(token));
    assert.equal(optout.verifyOfferOptOutToken(token), optout.offerOptOutId("max.muster@example.de"));
    assert.equal(optout.verifyOfferOptOutToken(token.slice(0, -2) + "xx"), null);
    assert.equal(optout.verifyOfferOptOutToken(""), null);
    const headers = optout.offerOptOutHeaders(email);
    assert.equal(headers["List-Unsubscribe-Post"], "List-Unsubscribe=One-Click");
    assert.ok(headers["List-Unsubscribe"].includes("/api/angebote/abmelden?token="));
    const at = "2026-11-01T00:00:00.000Z";
    const row = plan.applyEntryPurchase(null, { email: "max.muster@example.de", at, sessionId: "cs_1", eventId: "e", customerId: "c", member: false, subscriptionId: "" });
    const saved: unknown[] = [];
    const io = { readMarker: marker.readMarker, writeMarker: marker.writeMarker, rows: async () => [row], saveRow: async (r: unknown) => { saved.push(r); } };
    assert.equal(await optout.hasOfferOptOut(row, io), false);
    assert.deepEqual(await optout.recordOfferOptOut("kaputt", new Date(at), io), { ok: false });
    assert.deepEqual(await optout.recordOfferOptOut(token, new Date(at), io), { ok: true });
    assert.equal(saved.length, 1, "offer_opt_out_at gesetzt");
    assert.equal(await optout.hasOfferOptOut(row, io), true, "Marker je HMAC");
    process.env.PRICING_MODEL = "v3";
    process.env.PLAN_ADDON_NOTICE_ENABLED = "true";
    const now = new Date("2026-11-25T12:00:00.000Z");
    const other = plan.applyEntryPurchase(null, { email: "b@example.com", at, sessionId: "cs_2", eventId: "e", customerId: "c", member: false, subscriptionId: "" });
    const sent: { to: string; text: string; headers?: Record<string, string> }[] = [];
    const r = await notice.runAddonNotice(now, {
      rows: async () => [row, other],
      send: async (m) => { sent.push(m); return { stub: true, sent: true }; },
      optedOut: (x) => optout.hasOfferOptOut(x, io),
    });
    assert.equal(r.due, 2);
    const byTo = new Map(sent.map((m) => [m.to, m]));
    const neutral = byTo.get("max.muster@example.de")!;
    assert.ok(neutral.text.includes("Ihre Möglichkeiten nach § 12a unserer AGB") && !neutral.text.includes("€"), "Widerspruch: e-7N, nie Angebot");
    assert.ok(!neutral.headers, "Widerspruch: keine List-Unsubscribe-Header");
    const offer = byTo.get("b@example.com")!;
    assert.ok(offer.text.includes("Zum Jahrespaket: "), "e-7 mit Angebot");
    assert.equal(offer.headers?.["List-Unsubscribe-Post"], "List-Unsubscribe=One-Click");
    const route = read("app/api/angebote/abmelden/route.ts");
    assert.ok(/export async function GET[\s\S]*redirect/.test(route) && !/GET[\s\S]*recordOfferOptOut[\s\S]*export async function POST/.test(route), "GET meldet nicht ab");
    delete process.env.PRICING_MODEL;
    delete process.env.PLAN_ADDON_NOTICE_ENABLED;
    marker.setBlobMarkerTestDir(null);
  });

  await check("Einladen erst nach Zahlung (v3); Legacy/DS24/Comp unverändert; Route + UI", () => {
    const base = { newModel: true, comp: false, ds24: false, planModel: "", paidCheckout: false };
    assert.equal(firm.V3_INVITE_PREPAY_MESSAGE, "Personen einladen können Sie nach dem Abschluss Ihrer Bestellung. Offene Punkte können Sie bis dahin als unbekannt markieren.");
    assert.equal(firm.v3InvitePrepayDenialFrom(base, false), firm.V3_INVITE_PREPAY_MESSAGE, "v3 unbezahlt: gesperrt");
    assert.equal(firm.v3InvitePrepayDenialFrom({ ...base, planModel: "v3" }, true), null, "v3 bezahlt: frei");
    assert.equal(firm.v3InvitePrepayDenialFrom({ ...base, paidCheckout: true }, false), null, "Legacy");
    assert.equal(firm.v3InvitePrepayDenialFrom({ ...base, ds24: true }, false), null, "DS24");
    assert.equal(firm.v3InvitePrepayDenialFrom({ ...base, comp: true }, false), null, "Comp");
    assert.equal(firm.v3InvitePrepayDenialFrom({ ...base, newModel: false }, false), null, "PRICING_MODEL=legacy");
    const route = read("app/api/auth/invite/route.ts");
    assert.ok(route.includes("v3InvitePrepayDenial(email)") && route.includes("jsonError(planDenied, 403)"), "API 403 mit Text");
    const panel = read("app/account/firma/mitwirkende-panel.tsx");
    assert.ok(panel.includes("disabled={pending || Boolean(inviteBlocked)}") && panel.includes("{inviteBlocked}"), "Button deaktiviert + Hinweis");
    assert.ok(read("app/account/firma/[id]/page.tsx").includes("inviteBlocked={inviteBlocked}"));
  });

  await check("FAQ v3 + Optionsbezeichnungen", () => {
    assert.ok(read("content/faq-v3.md").includes("## 8. Bekomme ich mein Geld zurück?"));
    const pc = read("components/plan-checkout.tsx");
    assert.ok(pc.includes("PLAN_OPTION_1_LABEL") && pc.includes("PLAN_OPTION_2_LABEL"));
  });

  console.log(`check:v3-intake: ${passed} ok`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
