/**
 * 7-Tage-Hinweis (neues Preismodell 28.10.): Auswahl, Dedupe-Schlüssel ohne
 * Klartext-Adresse, Versand nur mit PLAN_ADDON_NOTICE_ENABLED, Widerspruch =
 * Mail ohne Angebot, Cron-Route nur mit CRON_SECRET (fail closed), Hinweis je
 * Frage. Synthetisch: kein Resend, kein Blob, kein Sheets.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

for (const name of ["PRICING_MODEL", "PLAN_ADDON_NOTICE_ENABLED", "CRON_SECRET", "RESEND_API_KEY", "BLOB_READ_WRITE_TOKEN", "VERCEL_ENV"]) {
  delete process.env[name];
}
process.env.MAGIC_LINK_SECRET = "check-addon-notice-offline-secret";

let passed = 0;
async function check(name: string, run: () => void | Promise<void>) {
  await run();
  passed += 1;
  console.log(`ok: ${name}`);
}
const DAY = 24 * 60 * 60 * 1000;

async function main() {
  const plan = await import("@/lib/plan");
  const notice = await import("@/lib/plan-addon-notice");
  const dedupe = await import("@/lib/mail-dedupe");
  const { cronAuthorized } = await import("@/lib/cron-auth");
  const now = new Date("2026-12-01T12:00:00.000Z");
  const bought = (days: number, email = "k@example.com") =>
    plan.applyEntryPurchase(null, {
      email, at: new Date(now.getTime() - days * DAY).toISOString(), sessionId: `cs_${days}`, eventId: "e", customerId: "c", member: false, subscriptionId: "",
    });

  await check("fällig nur in den letzten 7 Tagen des Zugangs, nicht für Jahrespaket/erstattet/abgelaufen", () => {
    assert.equal(notice.addonNoticeDue(bought(22), now), false, "Tag 22: noch nicht");
    assert.equal(notice.addonNoticeDue(bought(23), now), true, "Tag 23: genau 7 Tage vorher");
    assert.equal(notice.addonNoticeDue(bought(29), now), true);
    assert.equal(notice.addonNoticeDue(bought(30), now), false, "Tag 30: abgelaufen");
    assert.equal(notice.addonNoticeDue({ ...bought(25), plan: "member", memberStatus: "active" }, now), false);
    assert.equal(notice.addonNoticeDue({ ...bought(25), refundedAt: now.toISOString() }, now), false);
  });

  await check("Dedupe: einmal je Kauf, gespeicherter Schlüssel ohne Klartext-Adresse", () => {
    const row = bought(25, "Max.Muster@Example.de");
    const key = notice.addonNoticeMailKey(row);
    assert.ok(key.startsWith("addon-notice:"));
    assert.ok(key.includes(row.purchasedAt), "je Kauf");
    const stored = dedupe.storedMailDedupeKey(key);
    assert.ok(stored.startsWith("addon-notice:h1:"), stored);
    assert.ok(!stored.includes("@") && !/muster/i.test(stored));
  });

  await check("Schalter aus (Default): nur zählen, nie senden", async () => {
    let sends = 0;
    process.env.PRICING_MODEL = "v2";
    const r = await notice.runAddonNotice(now, { rows: async () => [bought(25)], send: async () => { sends += 1; return { stub: true, sent: true }; } });
    assert.deepEqual(r, { due: 1, sent: 0, failed: 0, sending: false });
    assert.equal(sends, 0);
  });

  await check("Schalter an: Mail mit Angebot und Widerspruchshinweis; Widerspruch = ohne Angebot", async () => {
    process.env.PLAN_ADDON_NOTICE_ENABLED = "true";
    const sent: { dedupeKey: string; text: string; subject: string }[] = [];
    const rows = [bought(25, "a@example.com"), { ...bought(24, "b@example.com"), offerOptOutAt: now.toISOString() }];
    const r = await notice.runAddonNotice(now, {
      rows: async () => rows,
      send: async (m) => { sent.push(m); return { stub: true, sent: true }; },
      company: async () => "Muster GmbH",
    });
    assert.equal(r.sent, 2);
    const [offer, neutral] = sent;
    assert.ok(offer.subject.startsWith("Ihr Zugang zu Muster GmbH endet am "));
    assert.ok(offer.text.includes("Jahrespaket zubuchen") && offer.text.includes(plan.PLAN_ADDON_HREF));
    assert.ok(offer.text.includes("können Sie jederzeit widersprechen"), "Widerspruchshinweis");
    assert.ok(!neutral.text.includes("Jahrespaket") && !neutral.text.includes("49 €"), "nach Widerspruch kein Angebot");
    delete process.env.PLAN_ADDON_NOTICE_ENABLED;
    delete process.env.PRICING_MODEL;
  });

  await check("Cron: ohne CRON_SECRET zu, nur korrekter Bearer offen; vercel.json täglich", () => {
    const req = (auth?: string) => new Request("http://x/api/cron/addon-notice", { headers: auth ? { authorization: auth } : {} });
    assert.equal(cronAuthorized(req("Bearer x"), ""), false);
    assert.equal(cronAuthorized(req(), "s3cret"), false);
    assert.equal(cronAuthorized(req("Bearer nope"), "s3cret"), false);
    assert.equal(cronAuthorized(req("Bearer s3cret"), "s3cret"), true);
    const vercel = JSON.parse(readFileSync("vercel.json", "utf8")) as { crons: { path: string; schedule: string }[] };
    // Daneben nur der Löschlauf v3 (eigener Schalter, Default aus).
    assert.deepEqual(
      vercel.crons.filter((c) => c.path !== "/api/cron/loeschlauf"),
      [{ path: "/api/cron/addon-notice", schedule: "0 7 * * *" }],
    );
  });

  await check("Hinweis je Frage: eine Komponente unter jeder Frage, nur im neuen Modell", async () => {
    const src = readFileSync("components/intake-questionnaire.tsx", "utf8");
    assert.equal(src.split("<IntakeQuestionHint />").length - 1, 1, "eine Stelle in der Frage-Schleife");
    const hint = await import("@/components/intake-question-hint");
    assert.equal(hint.intakeQuestionHintEnabled(), false, "Legacy: aus");
    assert.ok(hint.INTAKE_QUESTION_HINT.startsWith("Wissen Sie das nicht genau?"));
    assert.ok(readFileSync("next.config.ts", "utf8").includes("GOBD_PRICING_NEW_MODEL"));
  });

  await check("Einladungs-Mail mit DSE-Link", async () => {
    const mail = (await import("@/lib/membership-mail")).buildInviteMail({ firmName: "F", street: "", zip: "", city: "", ownerEmail: "o@example.com", inviteUrl: "https://x/i" });
    assert.ok(mail.text.includes("/datenschutz") && mail.html.includes("/datenschutz"));
  });

  console.log(`check-addon-notice: ok (${passed} checks)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
