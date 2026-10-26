/**
 * Inhaber-Hinweise: eine Mail pro Ereignis an CHECKOUT_NOTICE_TO, keine bei
 * Wiederholung, keine für Testadressen/Testfirmen, keine bei Abo-Verlängerung.
 * Versand gestubbt, Ledger im Temp-Ordner, kein Netzwerk.
 *
 *   npx tsx scripts/check-owner-notices.ts
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

for (const key of [
  "RESEND_API_KEY",
  "EMAIL_FROM",
  "BLOB_READ_WRITE_TOKEN",
  "GOOGLE_SERVICE_ACCOUNT_EMAIL",
  "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY",
  "GOOGLE_SHEETS_SPREADSHEET_ID",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
]) {
  delete process.env[key];
}
const lifecycle = process.env.npm_lifecycle_event ?? "";
if (!lifecycle.startsWith("check:") && lifecycle !== "prebuild" && lifecycle !== "build") {
  process.env.npm_lifecycle_event = "check:owner-notices";
}

// Echte Adressen sind tabu: `.example` ist reserviert und keine Ampel-Testdomain.
const CUSTOMER = "kunde@firma.example";
const TEST_ADDRESS = "test-kunde@example.com";
const LISTED = "48c6805d-3d34-4a80-9747-38ce4edb3eed";

function ok(cond: unknown, msg: string): void {
  assert.ok(cond, msg);
  console.log("ok:", msg);
}

async function main(): Promise<void> {
  const notice = await import("../lib/owner-notice");
  const { flushLeadNoticesForTests } = await import("../lib/lead-notice");
  const { setMailDedupeTestHooks } = await import("../lib/mail-dedupe");
  const { CHECKOUT_NOTICE_TO } = await import("../lib/checkout-notice");
  const { automatedRunForbidsLiveWrites } = await import("../lib/live-write-guard");
  const { createKanzleiDoiToken, createKanzleiUnsubscribeToken } = await import("../lib/kanzlei-token");
  const { KANZLEI_CONSENT_TEXT_VERSION } = await import("../lib/kanzlei-copy");
  const { confirmKanzleiDoi } = await import("../lib/kanzlei-confirm");
  const { withdrawKanzleiMarketing } = await import("../lib/kanzlei-unsubscribe");
  const { toKanzleiReadinessLead } = await import("../lib/kanzlei-lead");
  const { magicLinkUrl } = await import("../lib/auth");
  const { GET: verify } = await import("../app/auth/verify/route");
  type Lead = import("../lib/readiness").ReadinessLead;

  ok(automatedRunForbidsLiveWrites(), "the check runs with live writes forbidden");

  const root = mkdtempSync(path.join(tmpdir(), "gobd-owner-notice-"));
  const sent: { to: string; subject: string; text: string }[] = [];
  const stub = async (input: { to: string; subject: string; text: string }) => {
    sent.push({ to: input.to, subject: input.subject, text: input.text });
    return { stub: false, sent: true, id: `stub-${sent.length}` };
  };

  async function count(work: () => unknown): Promise<number> {
    const before = sent.length;
    await work();
    await flushLeadNoticesForTests();
    return sent.length - before;
  }

  try {
    // Ohne Testmodus sendet ein automatisierter Lauf nie, auch mit Stub nicht.
    setMailDedupeTestHooks({ dir: path.join(root, "guard"), send: stub });
    const guarded = await notice.notifyOwner({ kind: "doc", id: "guard:1", title: "Doku abgeschlossen", email: CUSTOMER });
    ok(guarded.skipped === true && sent.length === 0, "an automated run without test mode sends nothing");

    setMailDedupeTestHooks({ dir: path.join(root, "mail"), send: stub });
    notice.setOwnerNoticeTestMode(true);

    // 1) Doku abgeschlossen: eine Mail pro Version.
    const doc = {
      kind: "doc" as const,
      id: "doc-1:1",
      title: "Doku abgeschlossen",
      email: CUSTOMER,
      company: "Firma Beispiel GmbH",
      entityId: "ent-1",
      mode: "live" as const,
      facts: [["Dokument", "doc-1"], ["Version", "1"]] as [string, string][],
    };
    ok((await count(() => notice.queueOwnerNotice(doc))) === 1, "doc: one notice");
    const docMail = sent.at(-1)!;
    ok(docMail.to === CHECKOUT_NOTICE_TO, "doc: sent to CHECKOUT_NOTICE_TO only");
    ok(docMail.subject === `[GoBD] Doku abgeschlossen: ${CUSTOMER}`, "doc: subject format");
    ok(
      docMail.text.includes(CUSTOMER) && docMail.text.includes("Firma Beispiel GmbH") && docMail.text.includes("doc-1") && docMail.text.includes("Europe/Berlin") && docMail.text.includes("Modus: live"),
      "doc: facts include email, company, ids, Berlin time and mode",
    );
    ok((await count(() => notice.queueOwnerNotice(doc))) === 0, "doc: duplicate sends nothing");
    ok((await count(() => notice.queueOwnerNotice({ ...doc, id: "doc-1:2" }))) === 1, "doc: next version sends one");
    ok((await count(() => notice.queueOwnerNotice({ ...doc, id: "doc-t:1", email: TEST_ADDRESS }))) === 0, "doc: test address sends nothing");
    ok((await count(() => notice.queueOwnerNotice({ ...doc, id: "doc-e:1", entityId: LISTED }))) === 0, "doc: listed test firm sends nothing");
    ok((await count(() => notice.queueOwnerNotice({ ...doc, id: "doc-o:1", email: CHECKOUT_NOTICE_TO }))) === 0, "doc: the owner address itself is skipped");

    // 2) Stripe-Abo: nur echte Änderungen.
    const sub = {
      id: "sub_1",
      status: "active",
      cancel_at_period_end: false,
      cancel_at: null,
      items: { data: [{ price: { id: "price_monthly" } }] },
      metadata: { entity_id: "ent-1" },
    };
    const stripeEvent = (
      id: string,
      type: string,
      object: unknown,
      previous?: Record<string, unknown>,
    ) => ({ id, type, livemode: true, created: 1_790_000_000, data: { object, previous_attributes: previous } });
    const send = (event: ReturnType<typeof stripeEvent>, email = CUSTOMER) => () => {
      const input = notice.ownerNoticeFromStripeEvent(event, { email });
      if (input) notice.queueOwnerNotice(input);
    };

    const renewal = stripeEvent("evt_renew", "customer.subscription.updated", sub, {
      current_period_start: 1, current_period_end: 2, latest_invoice: "in_old",
    });
    ok(notice.ownerNoticeFromStripeEvent(renewal) === null, "subscription: routine renewal is not a notice");
    ok((await count(send(renewal))) === 0, "subscription: routine renewal sends nothing");
    const unchanged = stripeEvent("evt_same", "customer.subscription.updated", sub, { cancel_at_period_end: false, status: "active" });
    ok((await count(send(unchanged))) === 0, "subscription: unchanged attributes send nothing");

    const cancel = stripeEvent("evt_cancel", "customer.subscription.updated", { ...sub, cancel_at_period_end: true }, { cancel_at_period_end: false });
    ok((await count(send(cancel))) === 1 && sent.at(-1)!.text.includes("Kündigung vorgemerkt"), "subscription: cancellation scheduled sends one");
    ok((await count(send(cancel))) === 0, "subscription: retried event sends nothing");
    const revert = stripeEvent("evt_revert", "customer.subscription.updated", sub, { cancel_at_period_end: true });
    ok((await count(send(revert))) === 1 && sent.at(-1)!.text.includes("Kündigung zurückgenommen"), "subscription: revert sends one");
    const pastDue = stripeEvent("evt_status", "customer.subscription.updated", { ...sub, status: "past_due" }, { status: "active" });
    ok((await count(send(pastDue))) === 1 && sent.at(-1)!.text.includes("active → past_due"), "subscription: status change sends one");
    const plan = stripeEvent("evt_plan", "customer.subscription.updated", { ...sub, items: { data: [{ price: { id: "price_new" } }] } }, { items: { data: [{ price: { id: "price_monthly" } }] } });
    ok((await count(send(plan))) === 1 && sent.at(-1)!.text.includes("Tarifwechsel"), "subscription: plan change sends one");
    const deleted = stripeEvent("evt_deleted", "customer.subscription.deleted", { ...sub, status: "canceled" });
    ok((await count(send(deleted))) === 1 && sent.at(-1)!.subject.startsWith("[GoBD] Abo beendet"), "subscription: deletion sends one");
    const listedSub = stripeEvent("evt_listed", "customer.subscription.deleted", { ...sub, metadata: { entity_id: LISTED } });
    ok((await count(send(listedSub))) === 0, "subscription: listed test firm sends nothing");

    // 3) invoice.payment_failed: eine Mail pro Rechnung.
    const invoice = { id: "in_1", customer: "cus_1", customer_email: CUSTOMER, amount_due: 5831, currency: "eur" };
    ok((await count(send(stripeEvent("evt_inv_a", "invoice.payment_failed", invoice), "")))=== 1, "payment_failed: one notice");
    ok(sent.at(-1)!.text.includes(CUSTOMER) && sent.at(-1)!.text.includes("in_1"), "payment_failed: email and invoice id");
    ok((await count(send(stripeEvent("evt_inv_b", "invoice.payment_failed", invoice), "")))=== 0, "payment_failed: second attempt on the same invoice sends nothing");

    // 4) Erstattung und Dispute.
    const charge = { id: "ch_1", amount: 23562, amount_refunded: 23562, currency: "eur", billing_details: { email: CUSTOMER }, customer: "cus_1" };
    ok((await count(send(stripeEvent("evt_ref", "charge.refunded", charge), ""))) === 1, "refund: one notice");
    ok(sent.at(-1)!.text.includes("ch_1") && /235,62/.test(sent.at(-1)!.text), "refund: charge id and amount");
    ok((await count(send(stripeEvent("evt_ref_retry", "charge.refunded", charge), ""))) === 0, "refund: duplicate sends nothing");
    const dispute = { id: "dp_1", amount: 23562, currency: "eur", reason: "fraudulent", charge: "ch_1" };
    ok((await count(send(stripeEvent("evt_dp", "charge.dispute.created", dispute)))) === 1, "dispute: one notice");
    ok(sent.at(-1)!.text.includes("dp_1") && sent.at(-1)!.text.includes("fraudulent"), "dispute: id and reason");
    ok((await count(send(stripeEvent("evt_dp", "charge.dispute.created", dispute)))) === 0, "dispute: duplicate sends nothing");

    // 5) 3-Minuten-Check (Readiness): Schlüssel = Einreichung.
    const readiness = { kind: "readiness" as const, id: "readiness:abc", title: "Neuer 3-Minuten-Check", email: CUSTOMER, company: "Firma" };
    ok((await count(() => notice.queueOwnerNotice(readiness))) === 1, "readiness: one notice");
    ok((await count(() => notice.queueOwnerNotice(readiness))) === 0, "readiness: double submit sends nothing");
    ok((await count(() => notice.queueOwnerNotice({ ...readiness, id: "readiness:t", email: TEST_ADDRESS }))) === 0, "readiness: test address sends nothing");

    // 6) Kanzlei-Merkblatt: Hinweis erst nach DOI-Bestätigung, dann Abmeldung.
    const now = Date.UTC(2026, 9, 26, 9, 0, 0);
    const consentAt = new Date(now).toISOString();
    const leads = new Map<string, Lead>();
    const pending = toKanzleiReadinessLead({
      email: CUSTOMER,
      downloadedAt: consentAt,
      marketingOptIn: "pending",
      consentAt,
      consentIp: "",
      consentTextVersion: KANZLEI_CONSENT_TEXT_VERSION,
      mailStatus: "doi_pending",
    });
    leads.set(pending.leadId, pending);
    const deps = {
      now: () => now,
      listLeads: async () => [...leads.values()],
      saveLead: async (lead: Lead) => {
        leads.set(lead.leadId, { ...lead });
      },
    };
    const doi = await createKanzleiDoiToken({ email: CUSTOMER, consentAt, consentTextVersion: KANZLEI_CONSENT_TEXT_VERSION }, now);
    ok((await count(() => confirmKanzleiDoi(doi ?? "", deps))) === 1, "kanzlei: confirmation sends one notice");
    ok(sent.at(-1)!.subject === `[GoBD] Kanzlei-Merkblatt angemeldet: ${CUSTOMER}`, "kanzlei: confirmation subject");
    ok((await count(() => confirmKanzleiDoi(doi ?? "", deps))) === 0, "kanzlei: second confirmation click sends nothing");
    const unsub = await createKanzleiUnsubscribeToken(CUSTOMER, consentAt);
    const withdrawDeps = { now: () => now + 1000, list: deps.listLeads, save: deps.saveLead };
    ok((await count(() => withdrawKanzleiMarketing(unsub ?? "", withdrawDeps))) === 1, "kanzlei: unsubscribe sends one notice");
    ok(sent.at(-1)!.subject.startsWith("[GoBD] Kanzlei-Merkblatt abgemeldet"), "kanzlei: unsubscribe subject");
    ok((await count(() => withdrawKanzleiMarketing(unsub ?? "", withdrawDeps))) === 0, "kanzlei: repeated unsubscribe sends nothing");

    // 7) Neues Konto: einmal pro Adresse, nicht pro Anmeldung.
    const login = async (email: string) => {
      const url = await magicLinkUrl(email, "/account");
      const token = new URL(url ?? "http://x/").searchParams.get("token") ?? "";
      const response = await verify(new Request(`http://localhost/auth/verify?token=${encodeURIComponent(token)}`));
      assert.ok(response.status >= 300 && response.status < 400);
    };
    ok((await count(() => login(CUSTOMER))) === 1, "account: first login sends one notice");
    ok(sent.at(-1)!.subject === `[GoBD] Neues Konto / erste Anmeldung: ${CUSTOMER}`, "account: subject");
    ok((await count(() => login(CUSTOMER))) === 0, "account: second login sends nothing");
    ok((await count(() => login(TEST_ADDRESS))) === 0, "account: test address sends nothing");

    ok(sent.every((m) => m.to === CHECKOUT_NOTICE_TO), "every notice goes to CHECKOUT_NOTICE_TO only");
    ok(!sent.some((m) => /sdc-ventures/i.test(m.text)), "no real customer address in the check");

    // Verdrahtung.
    const src = (file: string) => readFileSync(file, "utf8");
    const webhook = src("app/api/stripe/webhook/route.ts");
    ok(webhook.includes('case "charge.refunded"') && webhook.includes('case "charge.dispute.created"'), "webhook handles refund and dispute");
    ok((webhook.match(/queueOwnerNotice\(/g) ?? []).length >= 4, "webhook queues subscription, payment_failed, refund and dispute notices");
    ok(src("app/api/intake/route.ts").includes('kind: "doc"'), "intake submit queues the doc notice");
    ok(src("app/api/document/route.ts").includes('kind: "doc"'), "document edit queues the doc notice");
    ok(src("app/api/readiness/route.ts").includes('kind: "readiness"'), "readiness queues its notice");
    ok(src("lib/kanzlei-confirm.ts").includes('kind: "kanzlei-optin"'), "kanzlei confirm queues its notice");
    ok(src("lib/kanzlei-unsubscribe.ts").includes('kind: "kanzlei-optout"'), "kanzlei unsubscribe queues its notice");
    ok(src("app/auth/verify/route.ts").includes('kind: "account"'), "verify queues the account notice");
    ok(!/await queueOwnerNotice/.test(webhook + src("app/api/intake/route.ts")), "callers do not await the notice");
  } finally {
    notice.setOwnerNoticeTestMode(false);
    setMailDedupeTestHooks(null);
    rmSync(root, { recursive: true, force: true });
  }
  console.log("check-owner-notices: ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
