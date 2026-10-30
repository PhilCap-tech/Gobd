/**
 * 7-Tage-Hinweis (neues Preismodell 28.10.): Auswahl, Dedupe-Schlüssel ohne
 * Klartext-Adresse, Versand nur mit PLAN_ADDON_NOTICE_ENABLED, Widerspruch =
 * Mail ohne Angebot, Cron-Route nur mit CRON_SECRET (fail closed), Hinweis je
 * Frage. Synthetisch: kein Resend, kein Blob, kein Sheets.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Schalter-Isolation: echte Build-Umgebung (Prod) darf die Prüfungen nicht beeinflussen.
for (const name of [
  "RETENTION_EXECUTE_ENABLED", "RETENTION_DRY_RUN_ENABLED", "PLAN_ADDON_NOTICE_ENABLED",
  "RETENTION_NOTICE_ENABLED", "RETENTION_DELETE_ENABLED", "RENEWAL_NOTICE_ENABLED", "ADDON_NOTICE_TEST_ONLY",
]) delete process.env[name];

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
    assert.deepEqual(r, { due: 1, sent: 0, failed: 0, sending: false, skippedNonTest: 0 });
    assert.equal(sends, 0);
  });

  await check("Schalter an: Mail mit Angebot und Widerspruchshinweis; Widerspruch = neutraler Hinweis", async () => {
    process.env.PLAN_ADDON_NOTICE_ENABLED = "true";
    const sent: { dedupeKey: string; text: string; subject: string }[] = [];
    const rows = [bought(25, "a@example.com"), { ...bought(24, "b@example.com"), offerOptOutAt: now.toISOString() }];
    const r = await notice.runAddonNotice(now, {
      rows: async () => rows,
      send: async (m) => { sent.push(m); return { stub: true, sent: true }; },
      company: async () => "Muster GmbH",
    });
    // Legal e-7 (Angebot) / e-7N (neutral, nach Widerspruch), 1:1 aus loeschhinweis-mails.md.
    const texts = await import("@/lib/retention-mail-texts");
    assert.equal(r.sent, 2);
    const [offer, neutral] = sent as unknown as { dedupeKey: string; text: string; html: string; subject: string; headers?: Record<string, string> }[];
    assert.ok(offer.subject.startsWith("Ihr Zugang für Muster GmbH endet am "), offer.subject);
    assert.ok(offer.text.startsWith(texts.LEGAL_MAILS.e7.body.split("\n")[0]), "e-7 Wortlaut");
    assert.ok(offer.text.includes("Zum Jahrespaket: ") && offer.text.includes(plan.PLAN_ADDON_HREF) && offer.text.includes("49 € (58,31 € brutto)"));
    assert.ok(offer.text.includes("können Sie jederzeit widersprechen"), "Widerspruchshinweis");
    assert.ok(neutral.text.includes("Ihre Möglichkeiten nach § 12a unserer AGB"), "e-7N Wortlaut");
    for (const part of [neutral.text, neutral.html]) {
      assert.ok(!part.includes("€") && !part.includes(plan.PLAN_ADDON_HREF) && !part.includes("/angebote/abmelden"), "e-7N: kein Preis, kein Angebotslink");
    }
    assert.ok(!neutral.headers, "e-7N: kein Abmeldeblock");
    assert.equal(neutral.dedupeKey, notice.addonNoticeMailKey(rows[1]), "gleicher Dedupe");
    assert.ok(!/\{[^{}]+\}/.test(offer.text + neutral.text), "keine offenen Platzhalter");
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
      [
        { path: "/api/cron/addon-notice", schedule: "0 7 * * *" },
      ],
    );
  });

  await check("Hinweis je Frage: eine Komponente unter jeder Frage, nur im neuen Modell", async () => {
    const src = readFileSync("components/intake-questionnaire.tsx", "utf8");
    assert.equal(src.split("<IntakeQuestionHint />").length - 1, 1, "eine Stelle in der Frage-Schleife");
    const bc = readFileSync("components/betriebs-check.tsx", "utf8");
    assert.equal(bc.split("<IntakeQuestionHint />").length - 1, 3, "Betriebs-Check (je Frage), Verantwortliche, Modulübersicht");
    assert.ok(bc.slice(bc.indexOf("CHECK_FRAGEN.map"), bc.indexOf("Software-Vorlagen")).includes("<IntakeQuestionHint />"), "unter jeder der 12 Check-Fragen");
    const hint = await import("@/components/intake-question-hint");
    assert.equal(hint.intakeQuestionHintEnabled(), false, "Legacy: aus");
    assert.ok(hint.INTAKE_QUESTION_HINT.startsWith("Wissen Sie das nicht genau?"));
    const hintSrc = readFileSync("components/intake-question-hint.tsx", "utf8");
    assert.ok(!hintSrc.includes('"/account"'), "kein Link auf /account (dort kann man vor der Zahlung nicht einladen)");
    assert.ok(hintSrc.includes("{INTAKE_QUESTION_HINT} {V3_INVITE_PREPAY_MESSAGE}"), "vor der Zahlung: freigegebener Satz, kein Link");
    assert.equal(hint.intakeInviteHref("ent_1"), "/account/firma/ent_1#mitwirkende-heading", "nach der Zahlung: Mitwirkende der Firma");
    assert.equal(hint.intakeInviteHref(""), "");
    const form = readFileSync("app/intake/intake-form.tsx", "utf8");
    assert.ok(form.includes("paid: !prepayHref"), "Link nur im bezahlten Zustand");
    assert.ok(readFileSync("app/account/firma/mitwirkende-panel.tsx", "utf8").includes('id="mitwirkende-heading"'), "Anker existiert");
    assert.ok(readFileSync("next.config.ts", "utf8").includes("GOBD_PRICING_NEW_MODEL"));
  });

  await check("Einladungs-Mail mit DSE-Link", async () => {
    const mail = (await import("@/lib/membership-mail")).buildInviteMail({ firmName: "F", street: "", zip: "", city: "", ownerEmail: "o@example.com", inviteUrl: "https://x/i" });
    assert.ok(mail.text.includes("/datenschutz") && mail.html.includes("/datenschutz"));
  });

  await check("Testgrenze: Plus-Adressen gobd-test+<tag>@mail.grokbot.com, sonst nichts Neues", async () => {
    const { isRetentionTestEmail } = await import("@/lib/retention-guards");
    for (const e of ["gobd-test@mail.grokbot.com", "gobd-test+e7n@mail.grokbot.com", "GOBD-Test+E7N@Mail.Grokbot.com", "gobd-test+a-1@mail.grokbot.com", "cappe@gmx.de", "x@resend.dev"]) {
      assert.equal(isRetentionTestEmail(e), true, e);
    }
    for (const e of ["gobd-test+@mail.grokbot.com", "gobd-test+a.b@mail.grokbot.com", "gobd-test+a_b@mail.grokbot.com", "gobd-test+e7n@mail.grokbot.com.evil.de", "gobd-test+e7n@x.mail.grokbot.com", "other+e7n@mail.grokbot.com", "kunde@firma-muster.de"]) {
      assert.equal(isRetentionTestEmail(e), false, e);
    }
  });

  await check("ADDON_NOTICE_TEST_ONLY: an nur bei exakt 'true'; dann nur Testadressen, Rest gezählt", async () => {
    const pm = await import("@/lib/pricing-model");
    process.env.PRICING_MODEL = "v2";
    process.env.PLAN_ADDON_NOTICE_ENABLED = "true";
    for (const v of [undefined, "", "false", "1", "on", "TRUE-ish"]) {
      if (v === undefined) delete process.env.ADDON_NOTICE_TEST_ONLY; else process.env.ADDON_NOTICE_TEST_ONLY = v;
      assert.equal(pm.addonNoticeTestOnly(), false, String(v));
    }
    const rows = [bought(25, "kunde@firma-muster.de"), bought(24, "gobd-test@mail.grokbot.com"), bought(23, "gobd-test+e7n@mail.grokbot.com")];
    const run = async () => {
      const to: string[] = [];
      const r = await notice.runAddonNotice(now, { rows: async () => rows, send: async (m) => { to.push(m.to); return { stub: true, sent: true }; }, company: async () => "" });
      return { r, to };
    };
    process.env.ADDON_NOTICE_TEST_ONLY = "true";
    assert.equal(pm.addonNoticeTestOnly(), true);
    const on = await run();
    assert.deepEqual(on.r, { due: 3, sent: 2, failed: 0, sending: true, skippedNonTest: 1 });
    assert.deepEqual(on.to, ["gobd-test@mail.grokbot.com", "gobd-test+e7n@mail.grokbot.com"], "echte Zeile nicht gesendet");
    delete process.env.ADDON_NOTICE_TEST_ONLY;
    const off = await run();
    assert.deepEqual(off.r, { due: 3, sent: 3, failed: 0, sending: true, skippedNonTest: 0 }, "aus: unverändert");
    assert.equal(off.to.length, 3);
    delete process.env.PLAN_ADDON_NOTICE_ENABLED;
    delete process.env.PRICING_MODEL;
  });

  console.log(`check-addon-notice: ok (${passed} checks)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
