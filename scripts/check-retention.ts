/**
 * Löschlauf v3: Entscheidungen (Tag vor/an/nach Frist), Ausschlüsse
 * (Altkunden, DS24, Comp, Test, fehlende Markierung), Hinweise genau einmal,
 * Schalter Default AUS, Trockenlauf ohne Schreiben/Mail, kein Stripe, Cron.
 * Synthetisch: kein Netz, kein Blob, kein Sheet, kein Resend, kein Stripe.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

for (const name of [
  "RETENTION_DRY_RUN_ENABLED", "RETENTION_EXECUTE_ENABLED", "CRON_SECRET", "BLOB_READ_WRITE_TOKEN",
  "RESEND_API_KEY", "STRIPE_SECRET_KEY", "STRIPE_SECRET_KEY_NEW", "STRIPE_TEST_SECRET_KEY",
  "GOOGLE_SHEETS_SPREADSHEET_ID", "VERCEL_ENV",
]) delete process.env[name];

let passed = 0;
async function check(name: string, run: () => void | Promise<void>) {
  await run();
  passed += 1;
  console.log(`ok: ${name}`);
}

const DAY = 24 * 60 * 60 * 1000;
const at = (iso: string, deltaDays = 0) => new Date(Date.parse(iso) + deltaDays * DAY);

async function main() {
  const decision = await import("@/lib/retention-decision");
  const guards = await import("@/lib/retention-guards");
  const run = await import("@/lib/retention-run");
  const plan = await import("@/lib/plan");
  const model = await import("@/lib/pricing-model");
  const http = await import("@/lib/retention-http");
  const mail = await import("@/lib/retention-mail");
  const dedupe = await import("@/lib/mail-dedupe");
  const texts = await import("@/lib/retention-mail-texts");

  type PlanRow = import("@/lib/plan").PlanRow;
  const PURCHASE = "2026-11-10T10:00:00.000Z";
  const DUE = "2027-11-10T10:00:00.000Z";
  function single(email: string, extra: Partial<PlanRow> = {}): PlanRow {
    return {
      ...plan.emptyPlanRow(email, PURCHASE),
      plan: "single",
      purchasedAt: PURCHASE,
      retentionUntil: DUE,
      agbAcceptedAt: PURCHASE,
      pricingModel: "v3",
      accessUntil: "2026-12-10T10:00:00.000Z",
      processedSessions: "cs_new_1",
      ...extra,
    };
  }
  const END = "2027-12-01T00:00:00.000Z";
  const ANNUAL_DUE = "2028-12-01T00:00:00.000Z";
  function annual(email: string, extra: Partial<PlanRow> = {}): PlanRow {
    return single(email, {
      plan: "member",
      memberStatus: "canceled",
      memberPeriodEnd: END,
      memberCancelAt: END,
      memberEndedAt: END,
      ...extra,
    });
  }

  await check("Schalter: beide Default AUS", () => {
    assert.equal(model.retentionDryRunEnabled(), false);
    assert.equal(model.retentionExecuteEnabled(), false);
  });

  await check("Fall a: Entwurf nur 7-Tage-Hinweis (kein 30), Löschung Tag 30 bzw. 7 Tage nach Hinweis", () => {
    const updatedAt = "2026-12-01T08:00:00.000Z";
    const seen = new Set<string>();
    for (let day = 0; day <= 40; day += 1) seen.add(decision.decideDraft({ updatedAt, paid: false }, at(updatedAt, day)));
    assert.deepEqual([...seen].sort(), ["keep", "notice7"], "ohne Hinweis nie löschen, nie 30-Tage-Hinweis");
    assert.equal(decision.decideDraft({ updatedAt, paid: false }, at(updatedAt, 22)), "keep");
    assert.equal(decision.decideDraft({ updatedAt, paid: false }, at(updatedAt, 23)), "notice7");
    const noticed = { updatedAt, paid: false, notice7At: at(updatedAt, 23).toISOString() };
    assert.equal(decision.decideDraft(noticed, at(updatedAt, 29)), "keep");
    assert.equal(decision.decideDraft(noticed, at(updatedAt, 30)), "delete");
    assert.equal(decision.decideDraft(noticed, at(updatedAt, 31)), "delete");
    const late = { updatedAt, paid: false, notice7At: at(updatedAt, 28).toISOString() };
    assert.equal(decision.decideDraft(late, at(updatedAt, 34)), "keep");
    assert.equal(decision.decideDraft(late, at(updatedAt, 35)), "delete");
    // Erneute Bearbeitung nach dem Hinweis: Hinweis ungültig, neu rechnen.
    assert.equal(decision.decideDraft({ ...noticed, updatedAt: at(updatedAt, 25).toISOString() }, at(updatedAt, 30)), "keep");
    assert.equal(decision.decideDraft({ updatedAt, paid: true }, at(updatedAt, 400)), "keep");
    assert.equal(decision.decideDraft({ updatedAt: "", paid: false }, at(updatedAt, 400)), "keep");
  });

  for (const [label, make, due] of [
    ["Option 1", single, DUE],
    ["Jahrespaket gekündigt", annual, ANNUAL_DUE],
  ] as const) {
    await check(`${label}: Hinweise 30/7 Tage, Löschung an der Frist (Tag davor/an/nach)`, () => {
      const row = make("kunde@firma-neu.de");
      assert.equal(decision.decideDoc(row, at(due, -31)).action, "keep");
      assert.equal(decision.decideDoc(row, at(due, -30)).action, "notice30");
      const n30 = { ...row, notice30At: at(due, -30).toISOString() };
      assert.equal(decision.decideDoc(n30, at(due, -8)).action, "keep");
      assert.equal(decision.decideDoc(n30, at(due, -7)).action, "notice7");
      const n7 = { ...n30, notice7At: at(due, -7).toISOString() };
      assert.equal(decision.decideDoc(n7, at(due, -1)).action, "keep");
      assert.equal(decision.decideDoc(n7, at(due, 0)).action, "delete");
      assert.equal(decision.decideDoc(n7, at(due, 1)).action, "delete");
      assert.equal(decision.decideDoc(n7, at(due, 1)).dueAt, due);
      // Ohne Hinweis nie löschen, auch lange nach der Frist.
      assert.equal(decision.decideDoc(row, at(due, 200)).action, "notice30");
    });
  }

  await check("Verspäteter Hinweis: Löschung frühestens 30 Tage danach", () => {
    const late = at(DUE, 10).toISOString();
    const row = single("spaet@firma-neu.de", { notice30At: late });
    assert.equal(decision.decideDoc(row, at(late, 22)).action, "keep");
    assert.equal(decision.decideDoc(row, at(late, 23)).action, "notice7");
    const n7 = { ...row, notice7At: at(late, 23).toISOString() };
    assert.equal(decision.decideDoc(n7, at(late, 29)).action, "keep");
    assert.equal(decision.decideDoc(n7, at(late, 30)).action, "delete");
  });

  await check("Option 1 reaktiviert: neue Frist, alte Hinweise zählen nicht", () => {
    const reactivated = single("re@firma-neu.de", {
      purchasedAt: "2027-10-01T10:00:00.000Z",
      notice30At: at(DUE, -30).toISOString(),
      notice7At: at(DUE, -7).toISOString(),
    });
    assert.equal(decision.decideDoc(reactivated, at(DUE, 1)).action, "keep");
    assert.equal(decision.docDeadline(reactivated, at(DUE, 1))?.dueAt, "2028-10-01T10:00:00.000Z");
    const viaField = single("re3@firma-neu.de", { reactivatedAt: "2027-09-01T10:00:00.000Z" });
    assert.equal(decision.decideDoc(viaField, at(DUE, 1)).action, "keep");
    assert.equal(decision.docDeadline(viaField, at(DUE, 1))?.dueAt, "2028-09-01T10:00:00.000Z");
    const member = single("re2@firma-neu.de", { plan: "member", memberStatus: "active" });
    assert.equal(decision.decideDoc(member, at(DUE, 1000)).action, "keep");
  });

  await check("Laufendes Abo nie (active/trialing/past_due/leer/unklar)", () => {
    for (const memberStatus of ["active", "trialing", "past_due", "", "unpaid", "irgendwas"]) {
      const row = annual("abo@firma-neu.de", { memberStatus });
      for (const days of [0, 400, 4000]) assert.equal(decision.decideDoc(row, at(END, days)).action, "keep");
    }
    assert.equal(decision.decideDoc(annual("x@firma-neu.de", { deletedAt: END }), at(END, 999)).action, "keep");
    assert.equal(decision.decideDoc(single("x@firma-neu.de", { refundedAt: END, deletedAt: END }), at(END, 999)).action, "keep");
  });

  await check("Fall d: Erstattung erster Kauf -> sofort fällig (nächster Lauf), keine 30/7-Hinweise", () => {
    assert.equal(decision.RETENTION_REFUND_NOTICE, false);
    assert.equal(decision.REFUND_RETENTION_DAYS, 0);
    const refundedAt = "2026-11-20T12:00:00.000Z";
    for (const make of [single, annual]) {
      const row = make("erstattet@firma-neu.de", { refundedAt });
      assert.equal(decision.decideDoc(row, new Date(Date.parse(refundedAt) - 1)).action, "keep");
      const due = decision.decideDoc(row, new Date(refundedAt));
      assert.equal(due.action, "delete");
      assert.equal(due.category, "refunded");
      assert.equal(decision.decideDoc(row, at(refundedAt, 1)).action, "delete");
    }
    assert.equal(decision.decideDoc(single("e@firma-neu.de", { refundedAt: "kaputt" }), at(refundedAt, 99)).action, "keep");
  });

  await check("Erstattet im Lauf: nur v3 gezählt, Test/Comp/DS24/Alt/Marker 0, keine Hinweis-Mail", async () => {
    const refundedAt = "2026-11-20T12:00:00.000Z";
    const r = (email: string, extra: Partial<PlanRow> = {}) => single(email, { refundedAt, ...extra });
    const fake = fakeIo({
      plans: [
        r("weg@firma-neu.de"),
        r("cappe@gmx.de"),
        r("winkler@winkler-segtrop.de"),
        r("ds24kunde@firma-alt.de"),
        r("altkunde@firma-alt.de"),
        r("v2zeile@firma-neu.de", { pricingModel: "" }),
      ],
      docs: [{ email: "altkunde@firma-alt.de", stripeSessionId: "cs_legacy_149", documentId: "d1", entityId: "" }],
      ds24: ["ds24kunde@firma-alt.de"],
    });
    // Nächster täglicher Lauf (z. B. 15 Stunden nach der Erstattung).
    const dry = await run.runRetention(fake.io, { execute: false, now: new Date(Date.parse(refundedAt) + 15 * 3600 * 1000) });
    assert.equal(dry.candidates.docsRefunded, 1);
    assert.equal(dry.candidates.notice30 + dry.candidates.notice7, 0);
    for (const group of guards.EXCLUSION_GROUPS) assert.equal(dry.excluded[group].plans, 1);
    assert.deepEqual(fake.writes, []);
    const done = await run.runRetention(fake.io, { execute: true, now: new Date(Date.parse(refundedAt) + 15 * 3600 * 1000) });
    assert.equal(done.done.docsDeleted, 1);
    assert.deepEqual(fake.sent, []);
    assert.deepEqual(fake.writes, ["docs:weg@firma-neu.de", "blank:weg@firma-neu.de"]);
    const before = await run.runRetention(fakeIo({ plans: [r("weg@firma-neu.de")] }).io, { execute: false, now: new Date(Date.parse(refundedAt) - 1000) });
    assert.equal(before.candidates.docsRefunded, 0);
  });

  await check("Erstattete Verlängerung = beendetes Jahrespaket: 12 Monate ab Ende, Hinweise 30/7", () => {
    const endedAt = "2028-11-20T12:00:00.000Z";
    // So schreibt recordPlanRefund eine erstattete Verlängerung (applyMemberEnded, kein refundedAt).
    const row = plan.applyMemberEnded(single("verl@firma-neu.de", { plan: "member", memberStatus: "active", memberSubscriptionId: "sub_v3" }), { at: endedAt, eventId: "evt", endedAt });
    assert.equal(row.refundedAt, "");
    const due = "2029-11-20T12:00:00.000Z";
    assert.equal(decision.docDeadline(row, at(due, -100))?.category, "annual");
    assert.equal(decision.docDeadline(row, at(due, -100))?.dueAt, due);
    assert.equal(decision.decideDoc(row, at(due, -31)).action, "keep");
    assert.equal(decision.decideDoc(row, at(due, -30)).action, "notice30");
    const n7 = { ...row, notice30At: at(due, -30).toISOString(), notice7At: at(due, -7).toISOString() };
    assert.equal(decision.decideDoc(n7, at(due, -1)).action, "keep");
    assert.equal(decision.decideDoc(n7, at(due, 0)).action, "delete");
    assert.equal(decision.decideDoc(row, at(endedAt, 30)).action, "keep", "keine 30-Tage-Löschung");
  });

  await check("Leeren ohne Pseudonym: Intake- und Plan-Zeile behalten nur IDs/Status/Daten", async () => {
    const storeMod = await import("@/lib/store");
    const planStore = await import("@/lib/plan-store");
    const sheetRow = { ...Object.fromEntries(Object.keys((await import("@/lib/types")).SHEET_COLUMNS).map((k) => [k, ""])) } as Record<string, string>;
    const full = {
      ...sheetRow, timestamp: "2026-11-02T10:00:00.000Z", stripeSessionId: "cs_1", stripeCustomerId: "cus_1", email: "kunde@firma-neu.de",
      company: "Firma GmbH", gf: "Max Muster", buchhaltung: "Erika", documentId: "doc_1", entityId: "ent_1", version: "1",
      changedBy: "kunde@firma-neu.de", changeSummary: "Ersteinreichung", status: "fertig", pdfUrl: "gobd/x.pdf",
    } as unknown as import("@/lib/types").SheetRow;
    const blank = storeMod.redactedRetentionRow(full, "2027-12-10T00:00:00.000Z");
    const text = JSON.stringify(blank);
    assert.ok(!text.includes("@") && !text.includes("Max") && !text.includes("Firma GmbH") && !text.includes("Erika"));
    assert.equal(blank.documentId, "doc_1");
    assert.equal(blank.stripeCustomerId, "cus_1");
    assert.equal(blank.status, "geloescht");
    assert.equal(blank.changeSummary, "geloescht:2027-12-10T00:00:00.000Z");
    const values = planStore.blankedPlanValues(single("kunde@firma-neu.de", { memberSubscriptionId: "sub_1" }), "2027-12-10T00:00:00.000Z", plan.PLAN_SHEET_COLUMNS);
    assert.ok(!values.join("|").includes("@"));
    assert.ok(values.includes("sub_1") && values.includes("2027-12-10T00:00:00.000Z"));
    assert.equal(planStore.planRowFromSheet([...plan.PLAN_SHEET_COLUMNS], values), null, "Leser verwerfen die geleerte Zeile");
  });

  await check("Nach Löschung (Plan geleert): Einladung/Protokoll über Firmen-Marker, ohne Marker nie", async () => {
    const deletedAt = "2027-11-10T10:00:00.000Z";
    const doc = (entityId: string) => ({ email: "", stripeSessionId: "cs_1", documentId: "d", entityId, status: "geloescht", deletedAt });
    const ev = (eventId: string, entityId: string, actorEmail: string, ownerEmail: string, action = "draft.saved", atIso = "2027-01-01T00:00:00.000Z") => ({
      eventId, at: atIso, actorEmail, actorRole: actorEmail === ownerEmail ? "owner" : "member", ownerEmail, entityId,
      action, moduleIds: "", draftRevision: "", summary: "",
    }) as import("@/lib/audit-log").AuditEvent;
    const fake = fakeIo({
      plans: [],
      docs: [doc("ent_del")],
      audit: [
        ev("a1", "ent_del", "weg@firma-neu.de", "weg@firma-neu.de"),
        ev("a2", "ent_alt", "alt@firma-alt.de", "alt@firma-alt.de"),
        ev("a3", "ent_del", "cappe@gmx.de", "cappe@gmx.de"),
      ],
    });
    let report = await run.runRetention(fake.io, { execute: true, now: new Date("2028-11-09T10:00:00.000Z") });
    assert.equal(report.candidates.audit, 0);
    report = await run.runRetention(fake.io, { execute: true, now: new Date("2028-11-10T10:00:00.000Z") });
    assert.equal(report.done.auditRedacted, 1);
    assert.equal(report.excluded.marker.audit, 1);
    assert.equal(report.excluded.test.audit, 1);
    assert.ok(!JSON.stringify(fake.redacted).includes("@"));
  });

  await check("Protokoll eines geleerten Mitwirkenden: letzter Widerruf der Firma + 12 Monate (nie früher)", async () => {
    const owner = "inh@firma-neu.de";
    const ev = (eventId: string, actorEmail: string, action: string, atIso: string) => ({
      eventId, at: atIso, actorEmail, actorRole: actorEmail === owner ? "owner" : "member", ownerEmail: owner, entityId: "e1",
      action, moduleIds: "", draftRevision: "", summary: "",
    }) as import("@/lib/audit-log").AuditEvent;
    const fake = fakeIo({
      plans: [single(owner, { plan: "member", memberStatus: "active" })],
      audit: [
        ev("x1", "helfer@firma-neu.de", "draft.saved", "2027-01-01T00:00:00.000Z"),
        ev("x2", owner, "invite.revoked", "2027-02-01T00:00:00.000Z"),
      ],
    });
    let report = await run.runRetention(fake.io, { execute: false, now: new Date("2028-01-31T00:00:00.000Z") });
    assert.equal(report.candidates.audit, 0);
    report = await run.runRetention(fake.io, { execute: false, now: new Date("2028-02-01T00:00:00.000Z") });
    assert.equal(report.candidates.audit, 1, "nur die Zeile des Mitwirkenden, nicht die des aktiven Inhabers");
  });

  await check("Einladungen: Widerruf bzw. Löschung der Dokumentation; Protokoll 12 Monate danach", () => {
    const none = { docsDeletedAt: "", accessEndedAt: "" };
    const revokedAt = "2027-01-01T00:00:00.000Z";
    const m = { status: "revoked", revokedAt, memberEmail: "helfer@firma-neu.de" };
    assert.equal(decision.decideMembership(m, none, at(revokedAt, -1)), "keep");
    assert.equal(decision.decideMembership(m, none, at(revokedAt, 0)), "delete");
    const active = { ...m, status: "active", revokedAt: "" };
    assert.equal(decision.decideMembership(active, none, at(revokedAt, 999)), "keep");
    assert.equal(decision.decideMembership(active, { docsDeletedAt: revokedAt, accessEndedAt: "" }, at(revokedAt, 0)), "delete");
    const audit = { actorEmail: "helfer@firma-neu.de", ownerEmail: "o@firma-neu.de", actorRevokedAt: revokedAt, actorIsOwner: false };
    assert.equal(decision.decideAudit(audit, none, new Date("2027-12-31T23:59:59.000Z")), "keep");
    assert.equal(decision.decideAudit(audit, none, new Date("2028-01-01T00:00:00.000Z")), "delete");
    assert.equal(decision.decideAudit({ ...audit, actorRevokedAt: "" }, none, at(revokedAt, 9999)), "keep");
    assert.equal(decision.decideAudit({ ...audit, actorIsOwner: true }, none, at(revokedAt, 9999)), "keep");
  });

  await check("Ausschlüsse: Test-/Philip-Adressen, Comp, DS24, Altkunde, Markierung", () => {
    for (const email of [
      "cappe@gmx.de", "philip.cappelletti@sdc-ventures.com", "jemand@sdc-ventures.com", "a@example.com",
      "delivered@resend.dev", "x@ikat-gmbh.de", "info@gobd-doku-erstellen.de", "gobd16x-1@web.de",
    ]) {
      assert.equal(guards.exclusionFor({ emails: [email], ds24: false, legacy: false, marker: true }), "test", email);
    }
    assert.equal(guards.exclusionFor({ emails: ["winkler@winkler-segtrop.de"], ds24: false, legacy: false, marker: true }), "comp");
    assert.equal(guards.exclusionFor({ emails: ["k@firma-neu.de"], ds24: true, legacy: false, marker: true }), "ds24");
    assert.equal(guards.exclusionFor({ emails: ["k@firma-neu.de"], ds24: false, legacy: true, marker: true }), "legacy");
    assert.equal(guards.exclusionFor({ emails: ["k@firma-neu.de"], ds24: false, legacy: false, marker: false }), "marker");
    assert.equal(guards.exclusionFor({ emails: [""], ds24: false, legacy: false, marker: true }), "marker");
    assert.equal(
      guards.exclusionFor({ emails: ["k@firma-neu.de"], entityIds: ["48c6805d-3d34-4a80-9747-38ce4edb3eed"], ds24: false, legacy: false, marker: true }),
      "test",
    );
    assert.equal(guards.exclusionFor({ emails: ["k@firma-neu.de"], ds24: false, legacy: false, marker: true }), null);
    assert.equal(guards.hasNewModelMarker(""), false);
    assert.equal(guards.hasNewModelMarker("legacy"), false);
    assert.equal(guards.hasNewModelMarker("v2"), false);
    assert.equal(guards.hasNewModelMarker("v3"), true);
  });

  /* ---------- Lauf mit synthetischer IO ---------- */
  type Io = import("@/lib/retention-run").RetentionIo;
  function fakeIo(input: {
    plans: PlanRow[];
    docs?: import("@/lib/retention-run").DocRowLite[];
    ds24?: string[];
    drafts?: import("@/lib/retention-run").DraftRecord[];
    memberships?: import("@/lib/memberships").Membership[];
    audit?: import("@/lib/audit-log").AuditEvent[];
  }) {
    const writes: string[] = [];
    const sent: string[] = [];
    const redacted: unknown[] = [];
    const notices: Array<{ stage: string; optedOut: boolean; category: string }> = [];
    const plans = input.plans.map((row) => ({ ...row }));
    const io: Io = {
      listPlans: async () => plans.map((row) => ({ ...row })),
      listDocRows: async () => input.docs ?? [],
      listDrafts: async () => ({ drafts: input.drafts ?? [], truncated: false }),
      ds24Known: async (email) => (input.ds24 ?? []).includes(email),
      listMemberships: async () => input.memberships ?? [],
      listAudit: async () => input.audit ?? [],
      deleteDraft: async () => void writes.push("draft"),
      deleteDocs: async (row) => void writes.push(`docs:${row.email}`),
      savePlan: async (row) => {
        writes.push(`plan:${row.email}`);
        const index = plans.findIndex((item) => item.email === row.email);
        plans[index] = { ...row };
      },
      blankPlan: async (row, deletedAt) => {
        writes.push(`blank:${row.email}`);
        const index = plans.findIndex((item) => item.email === row.email);
        redacted.push({ ...plans[index], email: "", deletedAt });
        plans.splice(index, 1);
      },
      redactMembership: async (row) => {
        writes.push("membership");
        redacted.push(row);
      },
      redactAudit: async (row) => {
        writes.push("audit");
        redacted.push(row);
      },
      sendNotice: async (n) => {
        const key = mail.retentionNoticeMailKey(n.stage, n.email, n.dueAt);
        if (sent.includes(key)) return "duplicate";
        sent.push(key);
        notices.push({ stage: n.stage, optedOut: n.optedOut, category: n.category });
        return "sent";
      },
      sendDraftNotice: async (n) => {
        const key = mail.retentionNoticeMailKey("a7", n.email, `${n.draftKey}:${n.updatedAt}`);
        if (sent.includes(key)) return "duplicate";
        sent.push(key);
        notices.push({ stage: "a7", optedOut: false, category: "draft" });
        return "sent";
      },
      markDraftNotice: async (record, atIso) => {
        writes.push("draft-notice");
        if (record.draft) (record.draft as unknown as Record<string, string>).retentionNotice7At = atIso;
      },
    };
    return { io, writes, sent, plans, redacted, notices };
  }

  const draftBase = {
    draftKey: "email:neu@firma-neu.de:default:gesamt",
    email: "neu@firma-neu.de",
    stripeSessionId: "",
    documentId: "",
    entityId: "",
    step: 1,
    answers: {} as never,
    updatedAt: "2026-11-01T00:00:00.000Z",
    pricingModel: "v3",
  };
  const n7done = (row: PlanRow) => ({ ...row, notice30At: at(DUE, -30).toISOString(), notice7At: at(DUE, -7).toISOString() });
  const excludedPlans = [
    n7done(single("cappe@gmx.de")),
    n7done(single("philip.cappelletti@sdc-ventures.com")),
    n7done(single("winkler@winkler-segtrop.de")),
    n7done(single("ds24kunde@firma-alt.de")),
    n7done(single("altkunde@firma-alt.de")),
    n7done(single("ohnemarker@firma-neu.de", { pricingModel: "" })),
  ];
  const excludedDocs = [{ email: "altkunde@firma-alt.de", stripeSessionId: "cs_legacy_149", documentId: "d1", entityId: "" }];
  const excludedDrafts = [
    { pathname: "gobd/drafts/a.json", draft: { ...draftBase, email: "cappe@gmx.de" } },
    { pathname: "gobd/drafts/b.json", draft: { ...draftBase, email: "ds24kunde@firma-alt.de" } },
    { pathname: "gobd/drafts/c.json", draft: { ...draftBase, email: "altkunde@firma-alt.de" } },
    { pathname: "gobd/drafts/d.json", draft: { ...draftBase, email: "ohne@firma-neu.de", pricingModel: undefined } },
    { pathname: "gobd/drafts/e.json", draft: { ...draftBase, email: "winkler@winkler-segtrop.de" } },
    { pathname: "gobd/drafts/f.json", draft: null },
  ];

  await check("Lauf: ausgeschlossene Gruppen werden gezählt, Kandidaten 0, keine Schreibzugriffe (auch mit Ausführung)", async () => {
    for (const execute of [false, true]) {
      const fake = fakeIo({ plans: excludedPlans, docs: excludedDocs, ds24: ["ds24kunde@firma-alt.de"], drafts: excludedDrafts as never });
      const report = await run.runRetention(fake.io, { execute, now: at(DUE, 400) });
      assert.deepEqual(fake.writes, []);
      assert.deepEqual(fake.sent, []);
      assert.deepEqual(report.candidates, { drafts: 0, docsOption1: 0, docsAnnual: 0, docsRefunded: 0, draftNotice7: 0, memberships: 0, audit: 0, notice30: 0, notice7: 0 });
      assert.equal(report.excluded.test.plans, 2);
      assert.equal(report.excluded.comp.plans, 1);
      assert.equal(report.excluded.ds24.plans, 1);
      assert.equal(report.excluded.legacy.plans, 1);
      assert.equal(report.excluded.marker.plans, 1);
      assert.equal(report.excluded.test.drafts, 1);
      assert.equal(report.excluded.comp.drafts, 1);
      assert.equal(report.excluded.ds24.drafts, 1);
      assert.equal(report.excluded.legacy.drafts, 1);
      assert.equal(report.excluded.marker.drafts, 2);
      for (const group of guards.EXCLUSION_GROUPS) assert.equal(report.excluded[group].candidates, 0);
    }
  });

  await check("Lauf: Trockenlauf zählt v3-Kandidaten, schreibt und sendet nichts", async () => {
    const fake = fakeIo({
      plans: [n7done(single("weg@firma-neu.de")), single("hinweis@firma-neu.de"), annual("abo@firma-neu.de", { memberStatus: "active" })],
      drafts: [{ pathname: "gobd/drafts/z.json", draft: draftBase as never }],
    });
    const report = await run.runRetention(fake.io, { execute: false, now: at(DUE, 0) });
    assert.equal(report.mode, "dry-run");
    assert.equal(report.candidates.docsOption1, 1);
    assert.equal(report.candidates.notice30, 1);
    assert.equal(report.candidates.drafts, 0);
    assert.equal(report.candidates.draftNotice7, 1, "Entwurf: erst a-7, dann löschen");
    assert.deepEqual(fake.writes, []);
    assert.deepEqual(fake.sent, []);
    const line = run.retentionLogLine(report);
    assert.ok(!line.includes("@"), "Log ohne Adressen");
  });

  await check("Lauf: Hinweise je Stufe genau einmal, dann Löschung", async () => {
    const fake = fakeIo({ plans: [single("once@firma-neu.de")] });
    let report = await run.runRetention(fake.io, { execute: true, now: at(DUE, -30) });
    assert.equal(report.done.notice30Sent, 1);
    report = await run.runRetention(fake.io, { execute: true, now: at(DUE, -29) });
    assert.equal(report.done.notice30Sent + report.done.notice7Sent, 0);
    report = await run.runRetention(fake.io, { execute: true, now: at(DUE, -7) });
    assert.equal(report.done.notice7Sent, 1);
    report = await run.runRetention(fake.io, { execute: true, now: at(DUE, -6) });
    assert.equal(report.done.notice30Sent + report.done.notice7Sent, 0);
    assert.equal(fake.sent.length, 2);
    report = await run.runRetention(fake.io, { execute: true, now: at(DUE, 0) });
    assert.equal(report.done.docsDeleted, 1);
    assert.equal(fake.plans.length, 0, "Plan-Zeile geleert (ohne E-Mail für Leser unsichtbar)");
    assert.ok(JSON.stringify(fake.redacted).includes('"email":""'));
    assert.ok(!JSON.stringify(fake.redacted).includes("once@firma-neu.de"));
    report = await run.runRetention(fake.io, { execute: true, now: at(DUE, 1) });
    assert.equal(report.done.docsDeleted, 0);
    assert.equal(fake.sent.length, 2);
  });

  await check("Mail-Dedupe-Schlüssel: HMAC, keine Klartext-Adresse", () => {
    process.env.MAGIC_LINK_SECRET = "check-retention-offline-secret";
    const key = dedupe.storedMailDedupeKey(mail.retentionNoticeMailKey("notice30", "a@firma-neu.de", DUE));
    assert.ok(key.startsWith("retention-notice:h1:"));
    assert.ok(!key.includes("@"));
  });

  await check("Wortlaut 1:1 wie Legal-Datei (a-7, b, bN, c, cN, d-0, Fußzeile)", () => {
    const file = process.env.LEGAL_MAILS_FILE ?? "/workspace/gobd-ops/preismodell-2026-11/legal/v3/loeschhinweis-mails.md";
    if (!existsSync(file)) {
      console.log("  (Legal-Datei nicht vorhanden, Vergleich übersprungen)");
      return;
    }
    const legal = readFileSync(file, "utf8");
    for (const [id, item] of Object.entries(texts.LEGAL_MAILS)) {
      assert.ok(legal.includes(`**Betreff:** ${item.subject}\n\n${item.body}\n`), `Wortlaut ${id}`);
    }
    assert.ok(legal.includes(`> ${texts.LEGAL_MAIL_FOOTER}\n`), "Fußzeile");
    assert.ok(!texts.LEGAL_MAILS.d0.body.includes("{Löschdatum}"), "d-0 ohne Datum");
    assert.ok(!JSON.stringify(texts).includes("PLATZHALTER"));
  });

  await check("Mails gerendert: Platzhalter gefüllt; nach Widerspruch neutrale Fassung (ohne Preis/Link)", () => {
    const offer = mail.buildRetentionNoticeMail({ stage: "notice30", deleteAt: DUE, category: "option1", company: "Muster GmbH", siteUrl: "https://x.test" });
    assert.ok(offer.subject.includes("Muster GmbH") && offer.subject.includes("10.11.2027"));
    assert.ok(offer.text.includes("(in 30 Tagen)") && offer.text.includes("https://x.test/checkout/reaktivieren") && offer.text.includes("99 €"));
    assert.ok(offer.text.includes("https://x.test/datenschutz") && !/\{[^}]+\}/.test(offer.text));
    const neutral = mail.buildRetentionNoticeMail({ stage: "notice7", deleteAt: DUE, category: "option1", optedOut: true, siteUrl: "https://x.test" });
    assert.ok(neutral.text.includes("nach § 12a Abs. 4 unserer AGB möglich") && neutral.text.includes("(in 7 Tagen)"));
    assert.ok(!neutral.text.includes("99 €") && !neutral.text.includes("reaktivieren") && !neutral.text.includes("widersprechen"));
    const annualN = mail.buildRetentionNoticeMail({ stage: "notice7", deleteAt: ANNUAL_DUE, category: "annual", optedOut: true, annualEndedAt: END, siteUrl: "https://x.test" });
    assert.ok(annualN.text.includes("nach § 12 Abs. 5 unserer AGB möglich") && annualN.text.includes("01.12.2027"));
    const draftMail = mail.buildDraftNoticeMail({ deleteAt: "2026-12-31T08:00:00.000Z", updatedAt: "2026-12-01T08:00:00.000Z", company: "Muster GmbH", siteUrl: "https://x.test" });
    assert.ok(draftMail.subject.startsWith("Ihr unbezahlter Entwurf für Muster GmbH") && draftMail.text.includes("https://x.test/login"));
    const d1 = mail.buildRefundNoticeMail({ refundedAt: DUE, option2: false, siteUrl: "https://x.test" });
    assert.ok(d1.text.includes("99 € (117,81 € brutto)") && d1.text.includes("enden Ihr Vertrag; weitere"));
    assert.ok(d1.text.includes("spätestens innerhalb von 24 Stunden"));
    const d2 = mail.buildRefundNoticeMail({ refundedAt: DUE, option2: true, siteUrl: "https://x.test" });
    assert.ok(d2.text.includes("148 € (176,12 € brutto)") && d2.text.includes("Ihr Vertrag und Ihr Jahrespaket;"));
  });

  await check("Lauf: Widerspruch -> neutrale Stufe; Entwurf bekommt genau einen a-7, dann Löschung", async () => {
    const fake = fakeIo({ plans: [single("opt@firma-neu.de", { offerOptOutAt: PURCHASE })] });
    await run.runRetention(fake.io, { execute: true, now: at(DUE, -30) });
    assert.deepEqual(fake.notices, [{ stage: "notice30", optedOut: true, category: "option1" }]);
    const draft = { ...draftBase, updatedAt: "2026-11-01T00:00:00.000Z" };
    const d = fakeIo({ plans: [], drafts: [{ pathname: "gobd/drafts/q.json", draft: draft as never }] });
    let report = await run.runRetention(d.io, { execute: true, now: at("2026-11-01T00:00:00.000Z", 23) });
    assert.equal(report.done.draftNotice7Sent, 1);
    report = await run.runRetention(d.io, { execute: true, now: at("2026-11-01T00:00:00.000Z", 24) });
    assert.equal(report.done.draftNotice7Sent + report.candidates.draftNotice7, 0, "genau einmal");
    report = await run.runRetention(d.io, { execute: true, now: at("2026-11-01T00:00:00.000Z", 30) });
    assert.equal(report.done.draftsDeleted, 1);
    assert.deepEqual(d.notices.map((n) => n.stage), ["a7"], "kein 30-Tage-Hinweis für Entwürfe");
  });

  await check("Einladungen/Protokoll im Lauf: geschwärzt mit Platzhalter, Test-Inhaber nie", async () => {
    const revokedAt = "2027-01-01T00:00:00.000Z";
    const m = (owner: string) => ({
      membershipId: `m-${owner.length}-${owner.charCodeAt(0)}`, ownerEmail: owner, memberEmail: "helfer@firma-neu.de", entityId: "e1",
      status: "revoked" as const, moduleIds: "", tokenHash: "h", invitedAt: revokedAt, acceptedAt: "",
      revokedAt, invitedBy: owner, updatedAt: revokedAt,
    });
    const fake = fakeIo({
      plans: [single("inhaber@firma-neu.de"), single("cappe@gmx.de")],
      memberships: [m("inhaber@firma-neu.de"), m("cappe@gmx.de"), m("ohneplan@firma-neu.de")],
    });
    const report = await run.runRetention(fake.io, { execute: true, now: at(revokedAt, 1) });
    assert.equal(report.done.membershipsRedacted, 1);
    assert.equal(report.excluded.test.memberships, 1);
    assert.equal(report.excluded.marker.memberships, 1);
    // Vollständig geleert: keine Adresse, kein Pseudonym/Hash (Legal 28.10.).
    const text = JSON.stringify(fake.redacted);
    assert.ok(!text.includes("@"), "keine Adresse");
    assert.ok(!/[0-9a-f]{20,}/.test(text), "kein Hash");
  });

  await check("HTTP: ohne CRON_SECRET 401, Schalter aus = nichts, ?modus=trockenlauf zählt nur", async () => {
    const io = () => fakeIo({ plans: [n7done(single("weg@firma-neu.de"))] }).io;
    const req = (q = "", token = "s3cret") =>
      new Request(`https://x/api/cron/loeschlauf${q}`, { headers: { authorization: `Bearer ${token}` } });
    assert.equal((await http.handleRetentionCron(req(), { secret: "", io })).status, 401);
    assert.equal((await http.handleRetentionCron(req("", "falsch"), { secret: "s3cret", io })).status, 401);
    const off = await http.handleRetentionCron(req(), { secret: "s3cret", io });
    assert.equal((off.body as { mode: string }).mode, "off");
    process.env.RETENTION_EXECUTE_ENABLED = "true";
    const fake = fakeIo({ plans: [n7done(single("weg@firma-neu.de"))] });
    const dry = await http.handleRetentionCron(req("?modus=trockenlauf"), { secret: "s3cret", io: () => fake.io, now: at(DUE, 1) });
    assert.equal((dry.body as { mode: string }).mode, "dry-run");
    assert.equal((dry.body as { candidates: { docsOption1: number } }).candidates.docsOption1, 1);
    assert.deepEqual(fake.writes, []);
    assert.ok(!JSON.stringify(dry.body).includes("@"));
    delete process.env.RETENTION_EXECUTE_ENABLED;
  });

  await check("Kein Stripe im Löschlauf, Cron in vercel.json mit Pfad", () => {
    const root = process.cwd();
    const files = readdirSync(path.join(root, "lib"))
      .filter((name) => name.startsWith("retention-"))
      .map((name) => path.join(root, "lib", name));
    files.push(path.join(root, "app/api/cron/loeschlauf/route.ts"));
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      assert.ok(!/from\s+["'](?:stripe|@\/lib\/stripe[^"']*|@\/lib\/plan-cancel-stripe|@\/lib\/kuendigung-stripe|@\/lib\/admin-wipe-run)["']/.test(text), file);
    }
    const vercel = JSON.parse(readFileSync(path.join(root, "vercel.json"), "utf8")) as { crons?: Array<{ path: string; schedule: string }> };
    assert.ok(vercel.crons?.some((cron) => cron.path === "/api/cron/loeschlauf" && /^\S+ \S+ \* \* \*$/.test(cron.schedule)));
  });

  console.log(`check:retention ${passed} Prüfungen ok`);
}

main().catch((error) => {
  console.error("check:retention FAIL", error instanceof Error ? error.message : "error");
  process.exit(1);
});
