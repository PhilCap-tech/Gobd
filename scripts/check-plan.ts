/**
 * Preismodell v2: Fristen, Stichtag (R4), Löschung (R3), Erinnerungen,
 * Geld zurück (R5), Erstattungssperre, Checkout-Parameter, Webhook-Übergänge,
 * Firmen (R1 neu, Schalter), Start-Schutz Testmodus, Rechtstext-Schalter
 * und „ohne Variable = altes Verhalten“. Ohne Netz, ohne Stripe, ohne Sheets.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
for (const name of [
  "PRICING_MODEL", "PLAN_ACCESS_ENABLED", "PLAN_LIFECYCLE_ENABLED", "PRICING_EXTRA_FIRMS_ENABLED", "RETENTION_DELETE_ENABLED",
  "RETENTION_NOTICE_ENABLED", "RENEWAL_NOTICE_ENABLED", "STRIPE_SECRET_KEY", "STRIPE_SECRET_KEY_NEW",
  "GOOGLE_SHEETS_SPREADSHEET_ID", "BLOB_READ_WRITE_TOKEN", "VERCEL_ENV", "GOBD_DATA_ENV",
  "PLAN_WINDOW_AFTER_MEMBER_MONTHS", "MEMBER_LATE_CANCEL_EFFECT", "STRIPE_TAX_RATE_ID",
]) delete process.env[name];

let passed = 0;
async function check(name: string, run: () => void | Promise<void>) {
  await run();
  passed += 1;
  console.log(`ok: ${name}`);
}

async function main() {
  const plan = await import("@/lib/plan");
  const model = await import("@/lib/pricing-model");
  const firms = await import("@/lib/plan-firms");
  const store = await import("@/lib/plan-store");
  const firmStore = await import("@/lib/plan-firm-store");
  const access = await import("@/lib/plan-access");
  const webhook = await import("@/lib/plan-webhook");
  const checkout = await import("@/lib/plan-checkout");
  const guard = await import("@/lib/data-env-guard");
  const admin = await import("@/lib/plan-admin");
  const cancel = await import("@/lib/plan-cancel");
  const legal = await import("@/lib/legal-content");
  const offer = await import("@/lib/offer-copy");
  const pricing = await import("@/lib/pricing");
  const tracking = await import("@/lib/tracking");
  const planCopy = await import("@/lib/plan-copy");

  const row = (patch: Partial<import("@/lib/plan").PlanRow> = {}) => ({
    ...plan.emptyPlanRow("kunde@example.com", "2026-11-02T10:00:00.000Z"),
    ...patch,
  });

  /* ---------- ohne Variable: altes Verhalten ---------- */
  await check("Default ist legacy, Plan-Zugang und Firmen aus", () => {
    assert.equal(model.pricingModel(), "legacy");
    assert.equal(model.planAccessEnabled(), false);
    assert.equal(model.extraFirmsEnabled(), false);
    assert.equal(model.retentionDeleteEnabled(), false);
    assert.equal(model.retentionNoticeEnabled(), false);
    assert.equal(model.renewalNoticeEnabled(), false);
    assert.equal(model.memberPreselected(), true);
  });
  await check("legacy: kein Lesen des Tabs plans (Zugang, Firmen-Prüfung)", async () => {
    let reads = 0;
    store.setPlanStoreForTests({ read: async () => { reads += 1; throw new Error("darf nicht lesen"); }, write: async () => {} });
    assert.equal(await access.loadPlanAccess("kunde@example.com"), null);
    assert.equal(await access.planWriteDenial("kunde@example.com"), null);
    assert.equal(await access.planVersionDenial("kunde@example.com"), null);
    const gate = await access.planFirmGate("kunde@example.com", "ent_1", true);
    assert.equal(gate.denial, null);
    assert.equal(reads, 0);
    store.setPlanStoreForTests(null);
  });
  await check("legacy: Preissätze wörtlich wie bisher", () => {
    assert.equal(offer.START_PRICE_LINE, offer.LEGACY_START_PRICE_LINE);
    assert.equal(offer.PRICE_INCLUSION_LINE, offer.LEGACY_PRICE_INCLUSION_LINE);
    assert.equal(offer.ALL_AREAS_DETAIL, offer.LEGACY_ALL_AREAS_DETAIL);
    assert.equal(offer.GELD_ZURUECK_MICRO, offer.LEGACY_GELD_ZURUECK_MICRO);
    assert.match(offer.START_PRICE_LINE, /198 € zum Start/);
    assert.equal(pricing.SETUP_EUR, 149);
    assert.equal(pricing.MONTHLY_EUR, 49);
    assert.equal(pricing.netWithGross(149), "149 € netto (177,31 € brutto)");
    assert.equal(tracking.PURCHASE_CONVERSION_VALUE_EUR, 198);
    assert.equal(tracking.conversionValueFromEnv("198,90"), 198.9);
  });
  await check("DS24 und Kanzlei: feste Werte", () => {
    assert.equal(pricing.DS24_SETUP_EUR, 149);
    assert.equal(pricing.DS24_TODAY_EUR, 198);
    assert.equal(pricing.KANZLEI_MONTHLY_EUR, 49);
    assert.equal(pricing.KANZLEI_PILOT_MONTHLY_EUR, 49);
  });
  await check("Rechtstexte: legacy behält Text, Marker fallen weg", () => {
    const src = "A <!-- if:legacy -->für bis zu fünf Firmen je Abo; <!-- endif -->B<!-- if:v2 -->V2<!-- endif --><!-- if:retention-delete -->L<!-- endif -->";
    assert.equal(legal.applyLegalConditions(src, legal.legalFlagsFor(false, false)), "A für bis zu fünf Firmen je Abo; B");
    assert.equal(legal.applyLegalConditions(src, legal.legalFlagsFor(true, false)), "A BV2");
    assert.equal(legal.applyLegalConditions(src, legal.legalFlagsFor(true, true)), "A BV2L");
    assert.match(legal.produktDisclaimerMarkdown, /für bis zu fünf Firmen je Abo; 24 Module/);
    assert.doesNotMatch(legal.agbMarkdown, /TODO-LEGAL|<!-- if:/);
  });

  await check("Rechtstexte v2 (Legal 26.10.): Wortlaut, Löschtexte sichtbar, § 12c neu nur mit Firmen-Schalter, legacy unverändert", async () => {
    const { readFileSync } = await import("node:fs");
    const read = (file: string) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
    const render = (file: string, v2: boolean, del: boolean, firms = false) =>
      legal.applyLegalConditions(read(file), legal.legalFlagsFor(v2, del, firms));
    for (const file of ["content/legal/agb-v2.md", "content/faq-v2.md"]) {
      for (const del of [true, false]) {
        for (const firms of [true, false]) {
          const text = render(file, true, del, firms);
          assert.doesNotMatch(text, /<!--|TODO-LEGAL/, `${file}: vollständiger Wortlaut`);
          assert.match(text, /30 (Tage|und 7 Tage)/, `${file}: Löschhinweis sichtbar (Builder-Hinweis 5 neu)`);
        }
      }
    }
    const agbOff = render("content/legal/agb-v2.md", true, false, false);
    const agbOn = render("content/legal/agb-v2.md", true, false, true);
    assert.match(agbOff, /Die \*\*zweite Firma\*\* ist ohne zusätzliches Entgelt enthalten/, "ohne Freigabe: § 12c Fassung 14:24");
    assert.doesNotMatch(agbOff, /Abrechnung nach aktiven Firmen/);
    assert.match(agbOn, /\(2\) \*\*Mit Mitgliedschaft: Abrechnung nach aktiven Firmen\.\*\*/);
    for (const text of [agbOff, agbOn]) {
      assert.match(text, /„Jahresmitgliedschaft“ → „Mitgliedschaft kündigen“/);
    }
    const faqOff = render("content/faq-v2.md", true, false, false);
    assert.match(faqOff, /## 4\. Ist das Steuerberatung\?\n/);
    assert.match(faqOff, /Nach erfolgreicher Zahlung und abgeschlossenem Intake/);
    assert.doesNotMatch(faqOff, /abgerechnet nach der Zahl der aktiven Firmen/);
    assert.match(render("content/faq-v2.md", true, false, true), /197,90 € zzgl\. USt pro Jahr/);
    assert.match(render("content/legal/datenschutz.md", true, false), /\*\*Speicherdauer Ihrer Dokumentationsdaten\.\*\*/, "DSE nennt die Speicherdauer auch ohne Lösch-Lauf");
    const dseLegacy = render("content/legal/datenschutz.md", false, true);
    assert.doesNotMatch(dseLegacy, /<!--|30\.10\.2026|Speicherdauer Ihrer Dokumentationsdaten/);
    assert.match(dseLegacy, /\*\*Stand:\*\* 26\.10\.2026/);
    assert.match(dseLegacy, /Nach Vertragsende können Sie bereits erzeugte PDFs noch 30 Tage herunterladen; danach löschen wir sie/);
    assert.match(render("content/legal/datenschutz.md", true, false), /\*\*Stand:\*\* 30\.10\.2026/);
    assert.match(render("content/legal/produkt-disclaimer.md", true, false), /Lohn\) je Firma; 24 Module, alle inklusive\./);
    const texts = planCopy.planPackageTexts();
    assert.match(texts.member, /^beim Kauf 198,90 € netto \(236,69 € brutto\)/);
    assert.match(texts.member, /Nach einer Kündigung löschen wir Ihre Dokumentation/);
    assert.match(texts.entry, /Danach löschen wir sie nach Vorab-Hinweis/);
    assert.ok(texts.member.includes(`${pricing.netWithGrossCents(9990)} pro Jahr`));
    assert.ok(texts.entry.startsWith(`${pricing.netWithGrossCents(9900)} einmalig`));
    const { headingId } = await import("@/lib/legal-markdown");
    const ids = render("content/faq-v2.md", true, false).split("\n").filter((l) => l.startsWith("## ")).map((l) => headingId(l.slice(3).trim())).filter(Boolean);
    assert.deepEqual(ids, ["erstattung", "mitgliedschaft", "loeschung", "aufbewahrung", "kuendigung", "mehrere-firmen"]);
    const legacyIds = read("content/faq.md").split("\n").filter((l) => l.startsWith("## ")).map((l) => headingId(l.slice(3).trim())).filter(Boolean);
    assert.deepEqual(legacyIds, ["erstattung"]);
  });

  /* ---------- Preise ---------- */
  await check("v2-Preise netto mit brutto", () => {
    assert.equal(pricing.netWithGrossCents(9900), "99 € netto (117,81 € brutto)");
    assert.equal(pricing.netWithGrossCents(9990), "99,90 € netto (118,88 € brutto)");
    assert.equal(pricing.netWithGrossCents(4900), "49 € netto (58,31 € brutto)");
    // Neues Modell (28.10.): Jahrespaket 49 €, im ersten Jahr 148 €.
    assert.equal(pricing.V2_ENTRY_WITH_MEMBER_CENTS, 14800);
    assert.equal(pricing.V3_ENTRY_WITH_YEAR_CENTS, 14800);
    assert.equal(pricing.netWithGross(99.9), "99,90 € netto (118,88 € brutto)");
  });

  /* ---------- Fristen ---------- */
  await check("Frist: Kauf + 12 Monate, Monatsende geklemmt", () => {
    assert.equal(plan.retentionAfterPurchase("2026-11-02T10:00:00.000Z"), "2027-11-02T10:00:00.000Z");
    assert.equal(plan.addMonthsIso("2027-01-31T00:00:00.000Z", 1), "2027-02-28T00:00:00.000Z");
    assert.equal(plan.addMonthsIso("2028-02-29T00:00:00.000Z", 12), "2029-02-28T00:00:00.000Z");
  });
  await check("Änderung: Zahlung + 12 Monate, nie kürzer", () => {
    assert.equal(plan.retentionAfterChange("2027-11-02T10:00:00.000Z", "2027-06-01T00:00:00.000Z"), "2028-06-01T00:00:00.000Z");
    assert.equal(plan.retentionAfterChange("2029-01-01T00:00:00.000Z", "2027-06-01T00:00:00.000Z"), "2029-01-01T00:00:00.000Z");
  });
  await check("Zugang (neues Modell): Altzeile nach Frist offen, danach alles gesperrt inkl. Download", () => {
    const now = new Date("2027-03-01T00:00:00.000Z");
    const open = row({ purchasedAt: "2026-11-02T10:00:00.000Z", retentionUntil: "2027-11-02T10:00:00.000Z" });
    assert.equal(plan.planAccess(open, now).writesOpen, true);
    assert.equal(plan.planAccess(open, now).newVersionAllowed, true, "keine 49-€-Änderung mehr");
    const expired = plan.planAccess(open, new Date("2027-11-03T00:00:00.000Z"));
    assert.equal(expired.state, "expired");
    assert.equal(expired.writesOpen, false);
    assert.equal(expired.downloadsOpen, false);
    assert.equal(expired.canReactivate, true);
  });

  /* ---------- Stichtag R4 ---------- */
  await check("Kündigung bis Stichtag (inkl.) zum Laufzeitende", () => {
    const end = "2027-11-02T10:00:00.000Z";
    const onDeadline = plan.memberCancelPlan(end, new Date("2027-08-02T10:00:00.000Z"), { noticeMonths: 3, lateEffect: "following_term" });
    assert.ok(onDeadline?.atCurrentPeriodEnd);
    assert.equal(onDeadline?.effectiveAt, end);
    assert.equal(onDeadline?.deadline, "2027-08-02T10:00:00.000Z");
  });
  await check("Kündigung 1 Tag nach Stichtag: Ende der folgenden Laufzeit (R4)", () => {
    const late = plan.memberCancelPlan("2027-11-02T10:00:00.000Z", new Date("2027-08-03T10:00:00.000Z"), { noticeMonths: 3, lateEffect: "following_term" });
    assert.equal(late?.atCurrentPeriodEnd, false);
    assert.equal(late?.effectiveAt, "2028-11-02T10:00:00.000Z");
    assert.match(plan.memberCancelPreviewLine(late!), /verlängert sich die Mitgliedschaft noch einmal/);
  });
  await check("R4 konfigurierbar: current_term", () => {
    const late = plan.memberCancelPlan("2027-11-02T10:00:00.000Z", new Date("2027-10-01T00:00:00.000Z"), { noticeMonths: 3, lateEffect: "current_term" });
    assert.equal(late?.effectiveAt, "2027-11-02T10:00:00.000Z");
  });

  /* ---------- R3: Löschung zum Ablauf ---------- */
  await check("R3 Default 0: nach Ende der Mitgliedschaft sofort abgelaufen", () => {
    assert.equal(model.windowAfterMemberMonths(), 0);
    const member = row({ plan: "member", memberStatus: "active", memberSubscriptionId: "sub_1", memberPeriodEnd: "2027-11-02T10:00:00.000Z" });
    const ended = plan.applyMemberEnded(member, { at: "2027-11-02T10:00:00.000Z", eventId: "evt", endedAt: "2027-11-02T10:00:00.000Z" });
    assert.equal(ended.retentionUntil, "2027-11-02T10:00:00.000Z");
    assert.equal(plan.planState(ended, new Date("2027-11-02T10:00:01.000Z")), "expired");
    assert.equal(plan.applyMemberEnded(member, { at: "x", eventId: "e", endedAt: "2027-11-02T10:00:00.000Z", afterMonths: 12 }).retentionUntil, "2028-11-02T10:00:00.000Z");
  });
  await check("Erinnerung 30/7 vor Löschung, auch nach Kündigung; Mitglied nie gelöscht", () => {
    const cancelled = row({ plan: "member", memberStatus: "active", memberSubscriptionId: "sub_1", memberPeriodEnd: "2027-11-02T10:00:00.000Z", memberCancelAt: "2027-11-02T10:00:00.000Z" });
    assert.equal(plan.deletionDueAt(cancelled), "2027-11-02T10:00:00.000Z");
    assert.equal(plan.retentionCandidate(cancelled, new Date("2027-10-10T00:00:00.000Z")), "notice30");
    assert.equal(plan.retentionCandidate({ ...cancelled, notice30At: "x" }, new Date("2027-10-30T00:00:00.000Z")), "notice7");
    assert.equal(plan.retentionCandidate({ ...cancelled, notice30At: "x", notice7At: "y" }, new Date("2027-11-05T00:00:00.000Z")), "none");
    const single = row({ retentionUntil: "2027-11-02T10:00:00.000Z", notice30At: "a", notice7At: "2027-10-27T00:00:00.000Z" });
    assert.equal(plan.retentionCandidate(single, new Date("2027-11-03T00:00:00.000Z")), "delete");
    assert.equal(plan.retentionCandidate({ ...single, notice7At: "" }, new Date("2027-11-03T00:00:00.000Z")), "notice7");
  });
  await check("Lösch-Lauf: immer Trockenlauf, 0 gelöscht, 0 Mails", async () => {
    process.env.RETENTION_DELETE_ENABLED = "true";
    process.env.RETENTION_NOTICE_ENABLED = "true";
    const rows = [row({ retentionUntil: "2027-11-02T10:00:00.000Z", notice30At: "a", notice7At: "2027-10-01T00:00:00.000Z" })];
    const report = admin.retentionRunReport(rows, new Date("2027-11-10T00:00:00.000Z"));
    assert.equal(report.dryRun, true);
    assert.equal(report.candidatesDelete, 1);
    assert.equal(report.deleted, 0);
    assert.equal(report.mailed, 0);
    const res = await admin.handleRetentionRunRequest(new Request("http://x", { method: "POST", headers: { authorization: "Bearer t0ken-abcdefghijklmnop" } }), {
      token: "t0ken-abcdefghijklmnop", listPlans: async () => rows, now: new Date("2027-11-10T00:00:00.000Z"),
    });
    assert.equal(res.status, 200);
    const denied = await admin.handleRetentionRunRequest(new Request("http://x", { method: "POST" }), { token: "t0ken-abcdefghijklmnop", listPlans: async () => rows });
    assert.equal(denied.status, 401);
    delete process.env.RETENTION_DELETE_ENABLED;
    delete process.env.RETENTION_NOTICE_ENABLED;
  });
  await check("Verlängerungs-Erinnerung: Fenster vor dem Stichtag, einmal je Laufzeit", () => {
    const member = row({ plan: "member", memberStatus: "active", memberSubscriptionId: "sub_1", memberPeriodEnd: "2027-11-02T10:00:00.000Z" });
    assert.equal(plan.renewalNoticeDue(member, new Date("2027-06-01T00:00:00.000Z")), false);
    assert.equal(plan.renewalNoticeDue(member, new Date("2027-07-10T00:00:00.000Z")), true);
    assert.equal(plan.renewalNoticeDue(member, new Date("2027-08-03T00:00:00.000Z")), false);
    assert.equal(plan.renewalNoticeDue({ ...member, renewalNoticeFor: member.memberPeriodEnd }, new Date("2027-07-10T00:00:00.000Z")), false);
    assert.equal(plan.renewalNoticeDue({ ...member, memberCancelAt: member.memberPeriodEnd }, new Date("2027-07-10T00:00:00.000Z")), false);
  });

  /* ---------- R5: Geld zurück ---------- */
  await check("erstattbar: kein PDF und < 14 Tage", () => {
    const bought = row({ purchasedAt: "2026-11-02T10:00:00.000Z" });
    const ok = plan.refundStatus(bought, [], new Date("2026-11-10T00:00:00.000Z"));
    assert.equal(ok.refundable, true);
    assert.equal(ok.deadline, "2026-11-16T10:00:00.000Z");
    assert.equal(plan.refundStatus(bought, [], new Date("2026-11-16T10:00:00.000Z")).reason, "frist");
    assert.equal(plan.refundStatus(bought, [{ pdfUrl: "x", timestamp: "2026-11-03T00:00:00.000Z" }], new Date("2026-11-05T00:00:00.000Z")).reason, "pdf");
    assert.equal(plan.refundStatus(bought, [{ pdfUrl: "x" }], new Date("2026-11-05T00:00:00.000Z")).reason, "pdf");
    assert.equal(plan.refundStatus(bought, [{ pdfUrl: "x", timestamp: "2026-10-01T00:00:00.000Z" }], new Date("2026-11-05T00:00:00.000Z")).refundable, true);
  });
  await check("erste PDF je Firma vermerkt und sperrt die Erstattung", () => {
    const bought = row({ purchasedAt: "2026-11-02T10:00:00.000Z" });
    const logged = plan.recordFirstPdf(bought, "ent_1", "2026-11-03T00:00:00.000Z");
    assert.equal(plan.firstPdfFor(logged, "ent_1"), "2026-11-03T00:00:00.000Z");
    assert.equal(plan.recordFirstPdf(logged, "ent_1", "2026-11-04T00:00:00.000Z"), logged);
    assert.equal(plan.refundStatus(logged, [], new Date("2026-11-05T00:00:00.000Z")).reason, "pdf");
  });
  await check("Erstattung sperrt Zugang und kündigt das Abo; Änderung und Teilerstattung nie", async () => {
    const member = row({ plan: "member", memberStatus: "active", memberSubscriptionId: "sub_1", purchasedAt: "2026-11-02T10:00:00.000Z", retentionUntil: "2027-11-02T10:00:00.000Z", pricingModel: "v3" });
    let saved: import("@/lib/plan").PlanRow | null = null;
    const cancelled: string[] = [];
    store.setPlanStoreForTests({ read: async () => [member], write: async (next) => { saved = next; } });
    const base = { email: member.email, eventId: "evt_r", at: "2026-11-05T00:00:00.000Z", cancelSubscription: async (id: string) => { cancelled.push(id); } };
    assert.equal(await webhook.recordPlanRefund({ ...base, charge: { refunded: true, metadata: { gobd_kind: "change" } } }), "ignored");
    assert.equal(await webhook.recordPlanRefund({ ...base, charge: { refunded: false, metadata: { gobd_kind: "entry" } } }), "ignored");
    assert.equal(await webhook.recordPlanRefund({ ...base, charge: { refunded: true, metadata: { gobd_kind: "entry" } } }), "locked");
    assert.deepEqual(cancelled, ["sub_1"]);
    assert.ok(saved);
    const locked = plan.planAccess(saved!);
    assert.equal(locked.state, "refunded");
    assert.equal(locked.writesOpen, false);
    assert.equal(locked.downloadsOpen, false);
    store.setPlanStoreForTests(null);
  });

  /* ---------- Checkout ---------- */
  await check("Checkout mit Mitgliedschaft: eine Session, subscription, Einstieg + Jahrespreis", () => {
    process.env.STRIPE_PRICE_ENTRY_ID = "price_entry_test";
    process.env.STRIPE_PRICE_MEMBER_YEAR_ID = "price_year_test";
    process.env.STRIPE_PRICE_CHANGE_ID = "price_change_test";
    const params = checkout.buildPlanCheckoutParams({ kind: "entry", member: true, email: "kunde@example.com", company: "Firma" });
    assert.equal(params.mode, "subscription");
    assert.deepEqual(params.line_items?.map((item) => item.price), ["price_entry_test", "price_year_test"]);
    assert.equal(params.metadata?.gobd_kind, "entry");
    assert.equal(params.metadata?.gobd_plan, "member");
    assert.equal(params.allow_promotion_codes, true);
    assert.equal(params.subscription_data?.metadata?.gobd_plan, "member");
  });
  await check("Checkout ohne Mitgliedschaft: payment mit Rechnung", () => {
    const params = checkout.buildPlanCheckoutParams({ kind: "entry", member: false, email: "kunde@example.com", company: "Firma" });
    assert.equal(params.mode, "payment");
    assert.equal(params.invoice_creation?.enabled, true);
    assert.equal(params.customer_creation, "always");
    assert.deepEqual(params.line_items?.map((item) => item.price), ["price_entry_test"]);
    assert.equal(checkout.buildPlanCheckoutParams({ kind: "change", email: "k@example.com", company: "" }).mode, "payment");
    assert.equal(checkout.memberFromPackage(undefined, true), true);
    assert.equal(checkout.memberFromPackage("einstieg", true), false);
    assert.deepEqual(checkout.missingPlanPriceIds("entry", true), []);
    delete process.env.STRIPE_PRICE_MEMBER_YEAR_ID;
    assert.deepEqual(checkout.missingPlanPriceIds("entry", true), ["STRIPE_PRICE_MEMBER_YEAR_ID"]);
  });

  await check("Partner-Checkout v2: gleiche Preise wie normal, Aktionscodes erlaubt, kein alter Listenpreis", async () => {
    process.env.STRIPE_PRICE_MEMBER_YEAR_ID = "price_year_test";
    const base = { kind: "entry" as const, member: true, email: "k@kanzlei.example", company: "Firma" };
    const kunde = checkout.buildPlanCheckoutParams({ ...base, audience: "kunde" });
    const partner = checkout.buildPlanCheckoutParams({ ...base, audience: "steuerberater" });
    assert.deepEqual(partner.line_items?.map((item) => item.price), kunde.line_items?.map((item) => item.price));
    assert.equal(partner.allow_promotion_codes, true);
    const { readFileSync } = await import("node:fs");
    const page = readFileSync(new URL("../app/checkout/page.tsx", import.meta.url), "utf8");
    const v2Branch = page.slice(page.indexOf("{v2 ? ("), page.indexOf(") : partner ? ("));
    assert.ok(v2Branch.length > 0, "v2-Zweig gefunden");
    assert.ok(!/149|MONTHLY_EUR|Einrichtung/.test(v2Branch), "kein alter Listenpreis");
    // Neues Modell (28.10.): Listenpreis aus den Konstanten (99 € einmalig, optional Jahrespaket 49 €/Jahr).
    assert.ok(v2Branch.includes("`Listenpreis: ${PLAN_ENTRY_PRICE_LINE}, optional Jahrespaket ${PLAN_MEMBER_PRICE_LINE}."), "Listenpreis neues Modell");
    assert.ok(!v2Branch.includes("99,90"), "kein 99,90 € mehr");
    assert.ok(!v2Branch.includes("SETUP_EUR"), "keine Einrichtungsgebühr");
  });

  /* ---------- Webhook-Übergänge ---------- */
  await check("Einstieg idempotent; Änderung braucht Plan; Mitgliedschaft nachträglich", () => {
    const input = { kind: "entry" as const, member: false, email: "Kunde@Example.com", at: "2026-11-02T10:00:00.000Z", sessionId: "cs_1", eventId: "evt_1", customerId: "cus_1", subscriptionId: "" };
    const first = webhook.planAfterCheckout(null, input)!;
    assert.equal(first.email, "kunde@example.com");
    assert.equal(first.retentionUntil, "2027-11-02T10:00:00.000Z");
    assert.equal(webhook.planAfterCheckout(first, input), first);
    assert.equal(webhook.planAfterCheckout(null, { ...input, kind: "change" }), null);
    const changed = webhook.planAfterCheckout(first, { ...input, kind: "change", sessionId: "cs_2", at: "2027-10-01T00:00:00.000Z" })!;
    assert.equal(changed.changeCredits, 1);
    assert.equal(changed.retentionUntil, "2028-10-01T00:00:00.000Z");
    const member = webhook.planAfterCheckout(changed, { ...input, kind: "member", sessionId: "cs_3", subscriptionId: "sub_9" })!;
    assert.equal(member.plan, "member");
    assert.equal(member.memberSubscriptionId, "sub_9");
  });

  /* ---------- Kündigung, Rücknahme, Admin per E-Mail ---------- */
  await check("Kündigung per E-Mail: Stichtag ab Eingang, Kanal email, Rücknahme bis Ablauf", async () => {
    const member = row({ plan: "member", memberStatus: "active", memberSubscriptionId: "sub_1", memberPeriodEnd: "2027-11-02T10:00:00.000Z" });
    const calls: string[] = [];
    const stripe = { scheduleCancel: async (id: string) => { calls.push(`cancel:${id}`); }, clearCancel: async (id: string) => { calls.push(`clear:${id}`); } };
    const done = await cancel.cancelMembership(member, { channel: "email", receivedAt: "2027-08-01T08:00:00.000Z", stripe, now: new Date("2027-08-05T00:00:00.000Z") });
    assert.ok(done.ok);
    assert.equal(done.ok && done.effectiveAt, "2027-11-02T10:00:00.000Z");
    assert.equal(done.ok && done.row.memberCancelChannel, "email");
    const back = await cancel.withdrawMembershipCancel(done.ok ? done.row : member, { channel: "email", receivedAt: "2027-10-01T00:00:00.000Z", stripe, now: new Date("2027-10-01T00:00:00.000Z") });
    assert.ok(back.ok && back.row.memberCancelAt === "");
    assert.deepEqual(calls, ["cancel:sub_1", "clear:sub_1"]);
    const tooLate = await cancel.withdrawMembershipCancel({ ...member, memberCancelAt: "2027-11-02T10:00:00.000Z" }, { channel: "email", receivedAt: "2027-11-03T00:00:00.000Z", stripe, now: new Date("2027-11-01T00:00:00.000Z") });
    assert.equal(tooLate.ok, false);
    const adminRequest = () =>
      new Request("http://x", { method: "POST", headers: { authorization: "Bearer t0ken-abcdefghijklmnop" }, body: JSON.stringify({ action: "kuendigen", email: member.email, receivedAt: "2027-08-01T08:00:00.000Z" }) });
    const adminDeps = { token: "t0ken-abcdefghijklmnop", findPlan: async () => member, savePlan: async () => {}, stripe, now: new Date("2027-08-05T00:00:00.000Z") };
    // Zurückgestellt (CoS 27.10.): ohne PLAN_LIFECYCLE_ENABLED kein Stichtag-Eintrag per Admin.
    process.env.PRICING_MODEL = "v2";
    const before = calls.length;
    assert.equal((await admin.handlePlanAdminAction(adminRequest(), adminDeps)).status, 409);
    assert.equal(calls.length, before, "kein Stripe-Aufruf ohne Plan-Logik");
    process.env.PLAN_LIFECYCLE_ENABLED = "true";
    const res = await admin.handlePlanAdminAction(adminRequest(), adminDeps);
    delete process.env.PLAN_LIFECYCLE_ENABLED;
    delete process.env.PRICING_MODEL;
    assert.equal(res.status, 200);
  });

  /* ---------- Firmen (R1 neu) ---------- */
  await check("Firmen: Mitglied 2 inklusive, dann weitere Firma nötig", () => {
    const member = row({ plan: "member", memberStatus: "active", memberSubscriptionId: "sub_1", memberPeriodEnd: "2027-11-02T10:00:00.000Z" });
    const f = (entityId: string, slot: string) => ({ ...firms.emptyFirmRow(member.email, slot, "member", "2026-11-02T10:00:00.000Z"), entityId });
    const two = [f("e1", "m_e1"), f("e2", "m_e2")];
    assert.equal(firms.firmDecision({ account: member, firms: [f("e1", "m_e1")], entityId: "e2", newVersion: false }).allowed, true);
    const third = firms.firmDecision({ account: member, firms: two, entityId: "e3", newVersion: false });
    assert.equal(third.allowed, false);
    assert.equal(!third.allowed && third.reason, "needs_member_slot");
    assert.equal(firms.firmDecision({ account: { ...member, memberExtraFirms: 1 }, firms: two, entityId: "e3", newVersion: false }).allowed, true);
    assert.equal(firms.addFirmOffer(member, two).kind, "member_paid");
  });
  await check("Firmen ohne Mitgliedschaft: eigene Frist, Änderung je Firma", () => {
    const single = row({ retentionUntil: "2027-11-02T10:00:00.000Z" });
    const slot = firms.applyFirmPurchase(null, { email: single.email, sessionId: "cs_a", source: "entry", at: "2026-11-02T10:00:00.000Z" });
    const bind = firms.firmDecision({ account: single, firms: [slot], entityId: "e1", newVersion: false, now: new Date("2027-01-01T00:00:00.000Z") });
    assert.ok(bind.allowed && bind.bind?.slotId === "cs_a");
    const bound = { ...slot, entityId: "e1" };
    const v2 = firms.firmDecision({ account: single, firms: [bound], entityId: "e1", newVersion: true, now: new Date("2027-01-01T00:00:00.000Z") });
    assert.equal(!v2.allowed && v2.reason, "needs_change");
    const other = firms.firmDecision({ account: single, firms: [bound], entityId: "e2", newVersion: false, now: new Date("2027-01-01T00:00:00.000Z") });
    assert.equal(!other.allowed && other.reason, "needs_purchase");
    const changed = firms.applyFirmChange(bound, { sessionId: "cs_c", at: "2027-10-01T00:00:00.000Z" });
    assert.equal(changed.retentionUntil, "2028-10-01T00:00:00.000Z");
    assert.equal(changed.changeCredits, 1);
  });
  await check("Firmen enden mit der Mitgliedschaft; danach gekaufte behalten eigene Frist", () => {
    const ended = row({ plan: "single", memberStatus: "canceled", memberEndedAt: "2027-11-02T10:00:00.000Z" });
    const before = { ...firms.applyFirmPurchase(null, { email: ended.email, sessionId: "cs_old", source: "extra", at: "2027-06-01T00:00:00.000Z" }), entityId: "e1" };
    const after = { ...firms.applyFirmPurchase(null, { email: ended.email, sessionId: "cs_new", source: "extra", at: "2027-12-01T00:00:00.000Z" }), entityId: "e2" };
    assert.equal(firms.firmDeletionDueAt(ended, before), "2027-11-02T10:00:00.000Z");
    assert.equal(firms.firmDeletionDueAt(ended, after), "2028-12-01T00:00:00.000Z");
  });
  await check("Firmen-Menge ohne Anteilsrechnung", () => {
    const params = checkout.memberFirmQuantityParams({ itemId: "si_1", quantity: 2, priceId: "price_f", taxRateId: "" });
    assert.equal(params.proration_behavior, "none");
    assert.deepEqual(params.items, [{ id: "si_1", quantity: 2 }]);
  });
  await check("Firmen-Schalter aus: kein Lesen von plan_firms", async () => {
    process.env.PRICING_MODEL = "v2";
    let firmReads = 0;
    firmStore.setPlanFirmStoreForTests({ read: async () => { firmReads += 1; return []; }, write: async () => {} });
    store.setPlanStoreForTests({ read: async () => [row({ retentionUntil: "2099-01-01T00:00:00.000Z", purchasedAt: "2026-11-02T10:00:00.000Z" })], write: async () => {} });
    const gate = await access.planFirmGate("kunde@example.com", "e1", false);
    assert.equal(gate.denial, null);
    assert.equal(firmReads, 0);
    store.setPlanStoreForTests(null);
    firmStore.setPlanFirmStoreForTests(null);
    delete process.env.PRICING_MODEL;
  });

  /* ---------- Legal 15:20: AGB-Checkbox, DSE-Link, Konto-Satz ---------- */
  await check("Checkout v2: AGB-Pflichtbox (Wortlaut Legal), DSE nur Link, Zeitpunkt in Metadaten", async () => {
    assert.equal(
      `${planCopy.PLAN_TERMS_LABEL_BEFORE}${planCopy.PLAN_TERMS_LINK}${planCopy.PLAN_TERMS_LABEL_AFTER}`,
      "Ich akzeptiere die Allgemeinen Geschäftsbedingungen der IKAT GmbH.",
    );
    assert.equal(planCopy.PLAN_TERMS_LINK, "Allgemeinen Geschäftsbedingungen");
    assert.equal(planCopy.PLAN_TERMS_HREF, "/agb");
    assert.equal(
      `${planCopy.PLAN_PRIVACY_BEFORE}${planCopy.PLAN_PRIVACY_LINK}${planCopy.PLAN_PRIVACY_AFTER}`,
      "Informationen zur Verarbeitung Ihrer Daten finden Sie in der Datenschutzerklärung.",
    );
    assert.equal(planCopy.PLAN_PRIVACY_HREF, "/datenschutz");
    for (const route of ["app/agb/page.tsx", "app/datenschutz/page.tsx"]) assert.ok(readFileSync(route, "utf8").length > 0, route);
    const form = readFileSync("app/checkout/checkout-form.tsx", "utf8");
    assert.ok(form.includes("useState(false);") && /\[acceptedTerms, setAcceptedTerms\] = useState\(false\)/.test(form), "AGB-Box nicht vorangekreuzt");
    assert.ok(form.includes("Ich bestelle als Unternehmer (§ 14 BGB)"), "Unternehmer-Box unverändert daneben");
    const privacyBlock = form.slice(form.indexOf("{PLAN_PRIVACY_BEFORE}") - 200, form.indexOf("{PLAN_PRIVACY_AFTER}"));
    assert.ok(!privacyBlock.includes("checkbox"), "Datenschutz: keine Checkbox");
    const api = readFileSync("app/api/checkout/route.ts", "utf8");
    assert.ok(api.includes("if (v2 && body.acceptedTerms !== true)"), "Server erzwingt AGB-Box");
    assert.ok(api.indexOf("body.acceptedTerms !== true") < api.indexOf("const agbAcceptedAt"), "Zeitpunkt erst nach Prüfung");
    const at = "2026-11-02T10:00:00.000Z";
    const params = checkout.buildPlanCheckoutParams({ kind: "entry", member: true, email: "k@example.com", company: "Firma", agbAcceptedAt: at });
    assert.equal(params.metadata?.agb_accepted_at, at);
    assert.equal(params.subscription_data?.metadata?.agb_accepted_at, at);
    const single = checkout.buildPlanCheckoutParams({ kind: "entry", member: false, email: "k@example.com", company: "Firma", agbAcceptedAt: at });
    assert.equal(single.payment_intent_data?.metadata?.agb_accepted_at, at);
    assert.equal(single.invoice_creation?.invoice_data?.metadata?.agb_accepted_at, at);
    assert.equal(checkout.buildPlanCheckoutParams({ kind: "entry", member: true, email: "k@example.com", company: "" }).metadata?.agb_accepted_at, undefined);
  });

  await check("Plans-Zeile: agb_accepted_at als letzte Spalte, Altzeilen leer, Einstieg setzt den Zeitpunkt", () => {
    // Neues Modell (28.10.): vier weitere Spalten nur am Ende angehängt.
    const all = [...plan.PLAN_SHEET_COLUMNS];
    assert.deepEqual(all.slice(-4), ["access_until", "pricing_model", "reactivated_at", "offer_opt_out_at"]);
    const cols = all.slice(0, -4);
    assert.equal(cols.at(-1), "agb_accepted_at", "neue Spalte nur am Ende");
    assert.equal(cols.at(-2), "member_cancel_received_at", "bisherige Reihenfolge unverändert");
    const oldHeader = cols.slice(0, -1);
    const oldValues = oldHeader.map((c) => (c === "email" ? "alt@example.com" : c === "plan" ? "single" : ""));
    const oldRow = store.planRowFromSheet(oldHeader, oldValues);
    assert.ok(oldRow);
    assert.equal(oldRow?.agbAcceptedAt, "", "Altzeile ohne Spalte: leer");
    assert.equal(store.planRowFromSheet(cols, [...oldValues, ""])?.agbAcceptedAt, "", "leerer Wert toleriert");
    assert.deepEqual(store.planSheetValues(oldRow!, oldHeader).length, oldHeader.length, "Schreiben mit altem Kopf: keine Zusatzzelle");
    const at = "2026-11-02T10:00:00.000Z";
    const entry = webhook.planAfterCheckout(null, { kind: "entry", member: true, email: "k@example.com", at, sessionId: "cs_1", eventId: "evt_1", customerId: "cus_1", subscriptionId: "sub_1", agbAcceptedAt: at });
    assert.equal(entry?.agbAcceptedAt, at);
    const values = store.planSheetValues(entry!, cols);
    assert.equal(values.at(-1), at, "Wert landet in der letzten (alten) Spalte");
    assert.equal(entry?.pricingModel, "v3", "Modell-Marker neues Modell");
    assert.equal(store.planRowFromSheet(cols, values)?.agbAcceptedAt, at, "Rundlauf");
    const change = webhook.planAfterCheckout(entry, { kind: "change", member: false, email: "k@example.com", at: "2026-12-01T10:00:00.000Z", sessionId: "cs_2", eventId: "evt_2", customerId: "cus_1", subscriptionId: "" });
    assert.equal(change?.agbAcceptedAt, at, "Änderung behält den Zeitpunkt");
    const webhookSrc = readFileSync("lib/plan-webhook.ts", "utf8");
    assert.ok(webhookSrc.includes("agbAcceptedAt: input.session.metadata?.[PLAN_METADATA_AGB_ACCEPTED_AT]"), "Webhook übernimmt Metadaten");
  });

  await check("Konto: Satz zur Kündigung/Rücknahme per E-Mail (Wortlaut Legal), ohne Platzhalter", () => {
    assert.equal(
      planCopy.PLAN_CANCEL_EMAIL_NOTE,
      "Sie können die Mitgliedschaft auch per E-Mail an info@gobd-doku-erstellen.de kündigen (bis 3 Monate vor Ablauf) und eine Kündigung bis zum Ablauf ebenso per E-Mail zurücknehmen.",
    );
    const card = readFileSync("components/account-plan.tsx", "utf8");
    assert.ok(card.includes("{PLAN_CANCEL_EMAIL_NOTE}") && !card.includes("TODO_LEGAL"));
    for (const t of [planCopy.PLAN_CANCEL_EMAIL_NOTE, planCopy.PLAN_TERMS_LABEL_AFTER, planCopy.PLAN_PRIVACY_BEFORE]) {
      assert.ok(!t.includes("TODO"), "Legal-Wortlaut ohne TODO-Marker (besteht auch mit PLAN_COPY_DRAFT=false)");
    }
  });

  await check("Kanzlei-Probedurchlauf: v2 ohne Platzhalter und ohne Pilot-Konditionen (Mail + Checkout), Legacy unverändert", async () => {
    const ops = await import("@/lib/ops");
    process.env.PRICING_MODEL = "v2";
    const v2Mail = ops.buildOnboardingMail({ company: "Kanzlei", audience: "steuerberater" });
    assert.ok(!v2Mail.text.includes("Mit dem Code KANZLEI-PILOT sind") && !v2Mail.text.includes("Bestellung im Partner-Pilot"));
    assert.ok(!v2Mail.html.includes("[TODO") && !v2Mail.text.includes("[TODO"));
    delete process.env.PRICING_MODEL;
    const legacyMail = ops.buildOnboardingMail({ company: "Kanzlei", audience: "steuerberater" });
    assert.ok(legacyMail.text.includes("vielen Dank für Ihre Bestellung im Partner-Pilot."));
    assert.ok(legacyMail.text.includes("Mit dem Code KANZLEI-PILOT sind Setup und die ersten zwei Monatsbeiträge 0 €."));
    assert.ok(!legacyMail.text.includes("TODO"));
    const form = readFileSync("app/checkout/checkout-form.tsx", "utf8");
    assert.ok(form.includes("{partner && !planOffer && ("), "Pilot-Satz nur Legacy");
    assert.ok(form.includes("{partner && planOffer && PARTNER_PROBE_CHECKOUT_NOTE_V2 && <p className=\"prose\">{PARTNER_PROBE_CHECKOUT_NOTE_V2}</p>}"));
    for (const t of [planCopy.PARTNER_PROBE_MAIL_INTRO_V2, planCopy.PARTNER_PROBE_MAIL_OFFER_V2, planCopy.PARTNER_PROBE_CHECKOUT_NOTE_V2]) {
      assert.equal(t, "", "kein freigegebener Text: Zeile entfällt");
    }
  });

  /* ---------- Start-Schutz Testmodus ---------- */
  await check("Start-Schutz: Testkey nur mit erklärten Testdaten, Livekey nie gegen Testdaten", () => {
    const testKey = ["sk", "test", "x"].join("_");
    const liveKey = ["sk", "live", "x"].join("_");
    const blob = "vercel_blob_rw_STORE1_abc";
    assert.equal(guard.dataEnvVerdict({}).ok, true);
    assert.equal(guard.dataEnvVerdict({ STRIPE_SECRET_KEY: testKey, VERCEL_ENV: "preview" }).ok, false);
    assert.equal(guard.dataEnvVerdict({ STRIPE_SECRET_KEY: testKey, VERCEL_ENV: "preview", GOBD_DATA_ENV: "test", GOOGLE_SHEETS_SPREADSHEET_ID: "s1", GOBD_TEST_SPREADSHEET_ID: "s1", BLOB_READ_WRITE_TOKEN: blob, GOBD_TEST_BLOB_STORE_ID: "STORE1" }).ok, true);
    assert.equal(guard.dataEnvVerdict({ STRIPE_SECRET_KEY: testKey, VERCEL_ENV: "preview", GOBD_DATA_ENV: "test", GOOGLE_SHEETS_SPREADSHEET_ID: "prod", GOBD_TEST_SPREADSHEET_ID: "s1", BLOB_READ_WRITE_TOKEN: blob, GOBD_TEST_BLOB_STORE_ID: "STORE1" }).ok, false);
    assert.equal(guard.dataEnvVerdict({ STRIPE_SECRET_KEY: liveKey, GOBD_DATA_ENV: "test" }).ok, false);
    assert.equal(guard.dataEnvVerdict({ STRIPE_SECRET_KEY: liveKey, GOOGLE_SHEETS_SPREADSHEET_ID: "s1", GOBD_TEST_SPREADSHEET_ID: "s1" }).ok, false);
    assert.equal(guard.blobStoreIdFromToken(blob), "STORE1");
  });

  console.log(`check-plan: ok (${passed} checks)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
