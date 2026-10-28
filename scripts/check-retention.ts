/**
 * Löschlauf v3: Entscheidungen (Tag vor/an/nach Frist), Ausschlüsse
 * (Altkunden, DS24, Comp, Test, fehlende Markierung), Hinweise genau einmal,
 * Schalter Default AUS, Trockenlauf ohne Schreiben/Mail, kein Stripe, Cron.
 * Synthetisch: kein Netz, kein Blob, kein Sheet, kein Resend, kein Stripe.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
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

  await check("Entwurf: Tag 29 behalten, Tag 30 und 31 löschen, bezahlt nie", () => {
    const updatedAt = "2026-12-01T08:00:00.000Z";
    assert.equal(decision.decideDraft({ updatedAt, paid: false }, at(updatedAt, 29)), "keep");
    assert.equal(decision.decideDraft({ updatedAt, paid: false }, at(updatedAt, 30)), "delete");
    assert.equal(decision.decideDraft({ updatedAt, paid: false }, at(updatedAt, 31)), "delete");
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

  await check("Erstattet (v3): Löschung 30 Tage nach refundedAt (Tag 29/30/31), ohne Hinweis", () => {
    assert.equal(decision.RETENTION_REFUND_NOTICE, false);
    const refundedAt = "2026-11-20T12:00:00.000Z";
    for (const make of [single, annual]) {
      const row = make("erstattet@firma-neu.de", { refundedAt });
      assert.equal(decision.decideDoc(row, at(refundedAt, 29)).action, "keep");
      const due = decision.decideDoc(row, at(refundedAt, 30));
      assert.equal(due.action, "delete");
      assert.equal(due.category, "refunded");
      assert.equal(decision.decideDoc(row, at(refundedAt, 31)).action, "delete");
      // Mit Hinweis-Flag (Legal) gälten die 30/7-Tage-Hinweise.
      assert.equal(decision.decideDoc(row, at(refundedAt, 30), { refundNotice: true }).action, "notice30");
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
    const dry = await run.runRetention(fake.io, { execute: false, now: at(refundedAt, 30) });
    assert.equal(dry.candidates.docsRefunded, 1);
    assert.equal(dry.candidates.notice30 + dry.candidates.notice7, 0);
    for (const group of guards.EXCLUSION_GROUPS) assert.equal(dry.excluded[group].plans, 1);
    assert.deepEqual(fake.writes, []);
    const done = await run.runRetention(fake.io, { execute: true, now: at(refundedAt, 30) });
    assert.equal(done.done.docsDeleted, 1);
    assert.deepEqual(fake.sent, []);
    assert.deepEqual(fake.writes, ["docs:weg@firma-neu.de", "plan:weg@firma-neu.de"]);
    const before = await run.runRetention(fakeIo({ plans: [r("weg@firma-neu.de")] }).io, { execute: false, now: at(refundedAt, 29) });
    assert.equal(before.candidates.docsRefunded, 0);
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
      redactMembership: async () => void writes.push("membership"),
      redactAudit: async () => void writes.push("audit"),
      sendNotice: async (n) => {
        const key = mail.retentionNoticeMailKey(n.stage, n.email, n.dueAt);
        if (sent.includes(key)) return "duplicate";
        sent.push(key);
        return "sent";
      },
    };
    return { io, writes, sent, plans };
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
      assert.deepEqual(report.candidates, { drafts: 0, docsOption1: 0, docsAnnual: 0, docsRefunded: 0, memberships: 0, audit: 0, notice30: 0, notice7: 0 });
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
    assert.equal(report.candidates.drafts, 1);
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
    assert.ok(fake.plans[0]!.deletedAt);
    report = await run.runRetention(fake.io, { execute: true, now: at(DUE, 1) });
    assert.equal(report.done.docsDeleted, 0);
    assert.equal(fake.sent.length, 2);
  });

  await check("Mail-Dedupe-Schlüssel: HMAC, keine Klartext-Adresse", () => {
    process.env.MAGIC_LINK_SECRET = "check-retention-offline-secret";
    const key = dedupe.storedMailDedupeKey(mail.retentionNoticeMailKey("notice30", "a@firma-neu.de", DUE));
    assert.ok(key.startsWith("retention-notice:h1:"));
    assert.ok(!key.includes("@"));
    const text = mail.buildRetentionNoticeMail({ stage: "notice7", deleteAt: DUE, category: "option1", siteUrl: "https://x" });
    assert.ok(text.subject.includes("PLATZHALTER"));
    assert.ok(text.text.includes("Sie"));
  });

  await check("Einladungen/Protokoll im Lauf: geschwärzt mit Platzhalter, Test-Inhaber nie", async () => {
    const revokedAt = "2027-01-01T00:00:00.000Z";
    const m = (owner: string) => ({
      membershipId: `m-${owner}`, ownerEmail: owner, memberEmail: "helfer@firma-neu.de", entityId: "e1",
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
    assert.ok(run.redactedEmailFor("a@b.de").endsWith("@loeschlauf.invalid"));
    assert.ok(guards.isRetentionTestEmail(run.redactedEmailFor("a@b.de")));
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
