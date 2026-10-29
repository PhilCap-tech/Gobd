/**
 * Mail-dedupe keys carry no plain email (privacy fix, Preismodell-PR #282).
 * A logical key with an address is stored as `<prefix>:h1:<HMAC-SHA256>`,
 * keyed from MAGIC_LINK_SECRET with a domain-separation label. Rows under the
 * old plain key are read read-only as fallback: never written, never deleted.
 * Synthetic only: no Resend, no Blob, no Stripe.
 */
import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

for (const name of ["BLOB_READ_WRITE_TOKEN", "RESEND_API_KEY", "VERCEL_ENV"]) delete process.env[name];
const SECRET = "check-mail-dedupe-keys-offline-secret";
process.env.MAGIC_LINK_SECRET = SECRET;

let passed = 0;
async function check(name: string, run: () => void | Promise<void>) {
  await run();
  passed += 1;
  console.log(`ok: ${name}`);
}

const EMAIL = "Max.Muster+tag@Example-Kanzlei.de";
const EMAIL_LOWER = EMAIL.toLowerCase();

function legacyFile(dir: string, key: string): string {
  return path.join(dir, `${createHash("sha256").update(key).digest("hex").slice(0, 40)}.json`);
}

function allLedgerText(dir: string): string {
  return readdirSync(dir)
    .map((name) => readFileSync(path.join(dir, name), "utf8"))
    .join("\n");
}

async function main() {
  const dedupe = await import("@/lib/mail-dedupe");
  const { ampelPdfDedupeKey } = await import("@/lib/ampel-result-send");
  const { kassenResultDedupeKey } = await import("@/lib/kassen-check-mail");
  const { leadNoticeDedupeAnchor } = await import("@/lib/lead-notice");

  const generated = [
    dedupe.magicLinkMailKey(EMAIL),
    dedupe.leadNoticeMailKey("ampel", leadNoticeDedupeAnchor({ email: EMAIL, resultMailId: "r1" })),
    dedupe.leadNoticeMailKey("kassen", leadNoticeDedupeAnchor({ email: EMAIL })),
    dedupe.failedPaymentMailKey(EMAIL_LOWER),
    dedupe.failedJobMailKey(EMAIL_LOWER, "job"),
    ampelPdfDedupeKey(EMAIL_LOWER, "{}"),
    kassenResultDedupeKey(EMAIL_LOWER, "{}"),
    `kanzlei-doi:${EMAIL_LOWER}`,
    `kanzlei-marketing:${EMAIL_LOWER}:2026-10-26T12:00:00.000Z`,
    "ohne-praefix@example.com",
  ];

  await check("kein generierter Dedupe-Key enthält '@' oder die Adresse", () => {
    for (const logical of generated) {
      assert.ok(logical.includes("@"), `Testeingabe trägt eine Adresse: ${logical}`);
      const stored = dedupe.storedMailDedupeKey(logical);
      assert.ok(!stored.includes("@"), `gespeicherter Key ohne '@': ${stored}`);
      assert.ok(!stored.toLowerCase().includes("max.muster"), "kein Local-Part im Key");
      assert.ok(!stored.toLowerCase().includes("example"), "keine Domain im Key");
      assert.match(stored, /^[A-Za-z0-9_-]+:h1:[0-9a-f]{64}$/, "Form <prefix>:h1:<hex>");
      assert.ok(!dedupe.resendIdempotencyKey(stored).includes("Example"), "Resend-Key ohne Adresse");
    }
    assert.ok(dedupe.storedMailDedupeKey(dedupe.magicLinkMailKey(EMAIL)).startsWith("magic-link:h1:"));
    assert.ok(dedupe.storedMailDedupeKey("ohne-praefix@example.com").startsWith("mail:h1:"));
  });

  await check("HMAC deterministisch, mit Domain-Trennung, abhängig vom Secret", () => {
    const logical = dedupe.magicLinkMailKey(EMAIL);
    const a = dedupe.storedMailDedupeKey(logical);
    assert.equal(a, dedupe.storedMailDedupeKey(` ${logical} `), "gleiche Eingabe, gleicher Key");
    assert.equal(a, dedupe.storedMailDedupeKey(dedupe.magicLinkMailKey(EMAIL_LOWER)), "Groß-/Kleinschreibung egal wie bisher");
    const plain = createHmac("sha256", SECRET).update(logical).digest("hex");
    assert.ok(!a.endsWith(plain), "nicht direkt mit dem Login-Secret gekeyt (Domain-Trennung)");
    const derived = createHmac("sha256", SECRET).update("gobd/mail-dedupe/key/v1").digest();
    assert.equal(a, `magic-link:h1:${createHmac("sha256", derived).update(logical).digest("hex")}`);
    process.env.MAGIC_LINK_SECRET = `${SECRET}-other`;
    try {
      assert.notEqual(dedupe.storedMailDedupeKey(logical), a, "anderes Secret, anderer Key");
    } finally {
      process.env.MAGIC_LINK_SECRET = SECRET;
    }
  });

  await check("Keys ohne Adresse bleiben unverändert (keine Migration)", () => {
    for (const key of [
      dedupe.onboardingMailKey("cs_test_1"),
      dedupe.deliveryMailKey("doc-1", 2),
      dedupe.ds24AccessMailKey("ORDER1"),
      dedupe.inviteMailKey("m-1"),
      dedupe.partnerInquiryMailKey("abc"),
      dedupe.leadNoticeMailKey("ampel", "lead-1"),
    ]) {
      assert.equal(dedupe.storedMailDedupeKey(key), key);
    }
  });

  await check("Ledger, Log-Key und Resend-Idempotency-Key ohne Adresse", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "mail-dedupe-keys-"));
    const sentKeys: string[] = [];
    let now = Date.parse("2026-10-26T12:00:00.000Z");
    dedupe.setMailDedupeTestHooks({
      dir,
      now: () => now,
      send: async (input) => {
        sentKeys.push(input.idempotencyKey ?? "");
        return { stub: false, sent: true, id: "email_test" };
      },
    });
    const logs: string[] = [];
    const origInfo = console.info;
    console.info = (...args: unknown[]) => {
      logs.push(JSON.stringify(args));
    };
    try {
      for (const logical of generated) {
        const first = await dedupe.sendDedupedEmail({
          dedupeKey: logical,
          to: EMAIL,
          subject: "Test",
          text: "Text",
          html: "<p>Text</p>",
          ...(logical.startsWith("magic-link:") ? { windowMs: dedupe.MAGIC_LINK_WINDOW_MS } : {}),
        });
        assert.ok(first.sent, `erste Mail geht raus: ${logical}`);
        const second = await dedupe.sendDedupedEmail({
          dedupeKey: logical,
          to: EMAIL,
          subject: "Test",
          text: "Text",
          html: "<p>Text</p>",
        });
        assert.ok(second.duplicate, `zweite Mail ist Duplikat: ${logical}`);
        assert.equal(await dedupe.lookupMailDedupe(logical), "sent");
        now += 1000;
      }
      const ledger = allLedgerText(dir);
      assert.ok(ledger.length > 0, "Ledger geschrieben");
      assert.ok(!ledger.includes("@"), "kein '@' im Ledger");
      assert.ok(!ledger.toLowerCase().includes("example-kanzlei"), "keine Domain im Ledger");
      for (const key of sentKeys) {
        assert.ok(!key.includes("@") && !key.toLowerCase().includes("example"), "Resend-Key ohne Adresse");
      }
      assert.ok(!logs.join("\n").toLowerCase().includes("example-kanzlei"), "Log ohne Adresse");
    } finally {
      console.info = origInfo;
      dedupe.setMailDedupeTestHooks(null);
      rmSync(dir, { recursive: true, force: true });
    }
  });

  await check("Legacy-Key wird nur gelesen: blockt, wird nie geschrieben oder gelöscht", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "mail-dedupe-legacy-"));
    mkdirSync(dir, { recursive: true });
    let now = Date.parse("2026-10-26T12:00:00.000Z");
    const counter = { sends: 0 };
    const sendCount = (): number => counter.sends;
    dedupe.setMailDedupeTestHooks({
      dir,
      now: () => now,
      send: async () => {
        counter.sends += 1;
        return { stub: false, sent: true, id: "email_test" };
      },
    });
    try {
      // Altbestand ohne Fenster (z. B. lead-notice per Adresse): blockt weiter.
      const leadLegacy = dedupe.leadNoticeMailKey("ampel", leadNoticeDedupeAnchor({ email: EMAIL, resultMailId: "r9" }));
      const leadFile = legacyFile(dir, leadLegacy);
      const leadBody = JSON.stringify({ key: leadLegacy, status: "sent", at: new Date(now - 86_400_000).toISOString(), resendKey: leadLegacy });
      writeFileSync(leadFile, leadBody, "utf8");
      const leadMtime = statSync(leadFile).mtimeMs;
      assert.equal(await dedupe.lookupMailDedupe(leadLegacy), "sent", "Lookup fällt auf Legacy zurück");
      const dup = await dedupe.sendDedupedEmail({ dedupeKey: leadLegacy, to: "intern@example.org", subject: "s", text: "t", html: "h" });
      assert.ok(dup.duplicate && !dup.sent && sendCount() === 0, "Legacy-Zeile verhindert den zweiten Versand");
      assert.equal(readFileSync(leadFile, "utf8"), leadBody, "Legacy-Zeile unverändert");
      assert.equal(statSync(leadFile).mtimeMs, leadMtime, "Legacy-Zeile nicht neu geschrieben");
      assert.equal(readdirSync(dir).length, 1, "kein neuer Eintrag bei Duplikat");

      // Magic-Link-Altbestand im Fenster: blockt; danach neue Zeile, Legacy bleibt liegen.
      const magicLegacy = dedupe.magicLinkMailKey(EMAIL);
      const magicFile = legacyFile(dir, magicLegacy);
      const magicBody = JSON.stringify({
        key: magicLegacy,
        status: "sent",
        at: new Date(now - 10_000).toISOString(),
        expiresAt: new Date(now + 50_000).toISOString(),
        resendKey: `${magicLegacy}:x`,
      });
      writeFileSync(magicFile, magicBody, "utf8");
      const blocked = await dedupe.sendDedupedEmail({
        dedupeKey: magicLegacy,
        windowMs: dedupe.MAGIC_LINK_WINDOW_MS,
        to: EMAIL,
        subject: "s",
        text: "t",
        html: "h",
      });
      assert.ok(blocked.duplicate && sendCount() === 0, "Legacy-Magic-Link im Fenster blockt");
      now += 60_000;
      const after = await dedupe.sendDedupedEmail({
        dedupeKey: magicLegacy,
        windowMs: dedupe.MAGIC_LINK_WINDOW_MS,
        to: EMAIL,
        subject: "s",
        text: "t",
        html: "h",
      });
      assert.ok(after.sent && sendCount() === 1, "nach Ablauf des Fensters wird gesendet");
      assert.equal(readFileSync(magicFile, "utf8"), magicBody, "Legacy-Magic-Link unverändert, nicht gelöscht");
      const stored = dedupe.storedMailDedupeKey(magicLegacy);
      const fresh = JSON.parse(readFileSync(legacyFile(dir, stored), "utf8")) as { key: string };
      assert.equal(fresh.key, stored, "neue Zeile unter dem HMAC-Key");
      assert.equal(readdirSync(dir).length, 3, "Legacy-Zeilen bleiben, eine neue dazu");
    } finally {
      dedupe.setMailDedupeTestHooks(null);
      rmSync(dir, { recursive: true, force: true });
    }
  });

  await check("Quelltext: kein Löschen/Migrieren von Legacy-Zeilen, kein neues Env", () => {
    const source = readFileSync(path.join(process.cwd(), "lib/mail-dedupe.ts"), "utf8");
    assert.ok(source.includes('"gobd/mail-dedupe/key/v1"'), "Domain-Trennungs-Label");
    assert.ok(source.includes("getMagicLinkSecret()"), "Schlüssel aus bestehendem MAGIC_LINK_SECRET");
    assert.ok(!/removeRecord\(legacy/i.test(source) && !/writeRecord\(legacy/i.test(source), "Legacy nie geschrieben/gelöscht");
    assert.ok(!/process\.env\.MAIL_DEDUPE/.test(source), "kein neues Env");
  });

  console.log(`check-mail-dedupe-keys: ${passed} Prüfungen ok`);
}

main().catch((error) => {
  console.error("check-mail-dedupe-keys:", error instanceof Error ? error.message : error);
  process.exit(1);
});
