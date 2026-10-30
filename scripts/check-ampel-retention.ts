/**
 * Ampel-Löschjob + einmalige Altdaten-Bereinigung: Regeln, Ausschlüsse, Schalter, Backup zuerst.
 * Usage: npx tsx scripts/check-ampel-retention.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { emptyReadinessLead, type ReadinessLead } from "@/lib/readiness";
import {
  ampelExclusion,
  cleanupRow,
  decideAmpelRow,
  decideKanzleiRow,
  decideMailLinkBlob,
  leadingExpiredRateRows,
  proofDeleteFrom,
  resolveRunMode,
} from "@/lib/ampel-retention-rules";
import { runAmpelCleanup, runAmpelRetention, type AmpelRetentionIo } from "@/lib/ampel-retention-job";
import { handleAmpelJob } from "@/lib/ampel-retention-http";
import { ampelConsentTextVersion } from "@/lib/ampel-result-send";

const NOW = Date.parse("2026-11-15T12:00:00Z");
const clean = { ds24: false, legacy: false, plan: false };
const row = (over: Partial<ReadinessLead>): ReadinessLead => ({
  ...emptyReadinessLead(),
  leadId: "ampel-abc",
  status: "ampel_pdf",
  tool: "ampel",
  email: "kunde@firma-beispiel.de",
  timestamp: "2026-04-01T10:00:00Z",
  consentAt: "2026-04-01T10:00:00Z",
  ...over,
});

// --- Ausschlüsse (nie Nicht-Ampel-Zeilen) ----------------------------------
for (const other of [
  { leadId: "kanzlei-1", status: "kanzlei_doi_pending", tool: "" },
  { leadId: "kassen-1", status: "kassen-check", tool: "kassen" },
  { leadId: "rd-1", status: "pdf_sent", tool: "" },
  { leadId: "ampel-1", status: "readiness", tool: "" },
  { leadId: "ampel-1", status: "ampel_pdf", tool: "kassen" },
]) {
  assert.equal(ampelExclusion(row(other), clean), "not_ampel", JSON.stringify(other));
  assert.equal(decideAmpelRow(row(other), clean, NOW).kind, "skip");
}
assert.equal(ampelExclusion(row({ email: "gobd-test+x1@mail.grokbot.com" }), clean), "test");
assert.equal(ampelExclusion(row({ email: "philip.cappelletti@sdc-ventures.com" }), clean), "test");
assert.equal(ampelExclusion(row({}), { ...clean, ds24: true }), "customer", "DS24");
assert.equal(ampelExclusion(row({}), { ...clean, legacy: true }), "customer", "Legacy/Altkunde");
assert.equal(ampelExclusion(row({}), { ...clean, plan: true }), "customer", "Kunde v3");
assert.equal(ampelExclusion(row({}), null), "unclear", "Kundenstatus unbekannt -> nicht anfassen");
assert.equal(ampelExclusion(row({ email: "" }), clean), "unclear");

// --- Fristen ----------------------------------------------------------------
assert.equal(decideAmpelRow(row({}), clean, NOW).kind, "redact_report", "6 Monate nach Versand");
assert.equal(decideAmpelRow(row({ timestamp: "2026-06-01T10:00:00Z" }), clean, NOW).kind, "keep");
const redacted = decideAmpelRow(row({ utmSource: "x" }), clean, NOW);
assert.ok(redacted.kind === "redact_report" && redacted.next.email === "" && redacted.next.utmSource === "" && redacted.next.leadId === "ampel-abc");
assert.equal(decideAmpelRow(row({ marketingOptIn: "pending", consentAt: "2026-10-01T00:00:00Z" }), clean, NOW).kind, "drop_unconfirmed", "30 Tage");
assert.equal(decideAmpelRow(row({ marketingOptIn: "pending", consentAt: "2026-11-01T00:00:00Z" }), clean, NOW).kind, "keep");
assert.equal(decideAmpelRow(row({ marketingOptIn: "confirmed" }), clean, NOW).kind, "keep", "aktive Einwilligung bleibt");
assert.equal(proofDeleteFrom(Date.parse("2026-03-01T00:00:00Z")), Date.UTC(2030, 0, 1), "3 Jahre nach Jahresende");
assert.equal(decideAmpelRow(row({ marketingOptIn: "withdrawn", withdrawnAt: "2026-03-01T00:00:00Z" }), clean, NOW).kind, "keep");
assert.equal(
  decideAmpelRow(row({ marketingOptIn: "withdrawn", withdrawnAt: "2022-12-31T00:00:00Z" }), clean, NOW).kind,
  "redact_proof",
);

// --- Mail-Link-Blobs: nur Ampel ------------------------------------------
const doi = { purpose: "ampel-doi", email: "kunde@firma-beispiel.de", consentAt: "2026-10-01T00:00:00Z" };
assert.equal(decideMailLinkBlob(doi, null, { excluded: false }, NOW).kind, "delete");
assert.equal(decideMailLinkBlob({ ...doi, check: "kassen-check" }, null, { excluded: false }, NOW).kind, "skip");
for (const purpose of ["kanzlei-doi", "kanzlei-unsubscribe", "magic", "invite"]) {
  assert.equal(decideMailLinkBlob({ ...doi, purpose }, null, { excluded: false }, NOW).kind, "skip", purpose);
}
assert.equal(decideMailLinkBlob(doi, null, { excluded: true }, NOW).kind, "skip", "Kunde/unklar");
assert.equal(decideMailLinkBlob(doi, { marketingOptIn: "confirmed", withdrawnAt: "", email: "" }, { excluded: false }, NOW).kind, "keep");

// --- Schalter + Trockenlauf ---------------------------------------------
assert.equal(resolveRunMode({ forcedDry: false, dryRun: false, execute: false }), "off");
assert.equal(resolveRunMode({ forcedDry: false, dryRun: true, execute: true }), "dry", "Trockenlauf gewinnt");
assert.equal(resolveRunMode({ forcedDry: true, dryRun: false, execute: true }), "dry");
assert.equal(resolveRunMode({ forcedDry: false, dryRun: false, execute: true }), "execute");

function fakeIo(rows: ReadinessLead[]) {
  const saved: ReadinessLead[] = [];
  const rateAts = [String(NOW - 40 * 86400000), String(NOW - 31 * 86400000), String(NOW - 2 * 86400000), String(NOW - 40 * 86400000)];
  const rateDeleted: number[] = [];
  const deleted: string[] = [];
  const backups: string[] = [];
  const io: AmpelRetentionIo = {
    listRows: async () => rows,
    saveRow: async (r) => void saved.push(r),
    customerFacts: async () => clean,
    listMailLinks: async () => [{ pathname: "gobd/mail-link/a" }],
    readMailLink: async () => doi,
    deleteMailLink: async (p) => void deleted.push(p),
    listRateAts: async () => rateAts,
    deleteLeadingRateRows: async (n) => void rateDeleted.push(n),
    writeBackup: async (name) => void backups.push(name),
  };
  return { io, saved, deleted, backups, rateDeleted };
}

async function main() {
  const rows = [row({}), row({ leadId: "kanzlei-x", status: "kanzlei", utmSource: "g" }), row({ leadId: "ampel-t", email: "gobd-test+a@mail.grokbot.com" })];
  const dry = fakeIo(rows);
  const dryReport = await runAmpelRetention(dry.io, { execute: false, now: NOW });
  assert.equal(dryReport.rows.redactReport, 1);
  assert.equal(dry.saved.length + dry.deleted.length, 0, "Trockenlauf schreibt nichts");
  const run = fakeIo(rows);
  await runAmpelRetention(run.io, { execute: true, now: NOW });
  assert.deepEqual(run.saved.map((r) => r.leadId), ["ampel-abc"], "nur die Ampel-Zeile");
  assert.deepEqual(run.deleted, ["gobd/mail-link/a"]);
  assert.deepEqual(run.rateDeleted, [2], "ampel_rate: nur die führenden Zeilen älter als 30 Tage");
  assert.equal(dry.rateDeleted.length, 0);
  assert.equal(leadingExpiredRateRows(["x", String(NOW - 40 * 86400000)], NOW), 0, "unklare Zeile stoppt");

  // Kanzlei-Merkblatt: nur widerrufene Zeilen nach 3 Jahren ab Jahresende.
  const k = (over: Partial<ReadinessLead>) => row({ leadId: "kanzlei-1", status: "kanzlei_doi_confirmed", tool: "", ...over });
  assert.equal(decideKanzleiRow(k({ marketingOptIn: "confirmed" }), NOW).kind, "keep");
  assert.equal(decideKanzleiRow(k({ marketingOptIn: "withdrawn", withdrawnAt: "2026-01-05T00:00:00Z" }), NOW).kind, "keep");
  assert.equal(decideKanzleiRow(k({ marketingOptIn: "withdrawn", withdrawnAt: "2022-06-05T00:00:00Z" }), NOW).kind, "redact_proof");
  assert.equal(decideKanzleiRow(k({ marketingOptIn: "withdrawn", withdrawnAt: "2022-06-05T00:00:00Z", email: "gobd-test+k@mail.grokbot.com" }), NOW).kind, "skip");
  assert.equal(decideKanzleiRow(row({}), NOW).kind, "skip", "Ampel-Zeile ist keine Kanzlei-Zeile");
  // Opt-in- und Sperrlisten-Zeilen nie vorzeitig.
  assert.equal(decideAmpelRow(row({ marketingOptIn: "confirmed", timestamp: "2020-01-01T00:00:00Z" }), clean, NOW).kind, "keep");
  assert.equal(decideAmpelRow(row({ marketingOptIn: "withdrawn", withdrawnAt: "2025-12-31T00:00:00Z" }), clean, NOW).kind, "keep");

  // Bereinigung: Backup zuerst, nur UTM-Spalten. consent_at bleibt.
  const c = fakeIo([row({ utmSource: "g", utmCampaign: "c" }), row({ leadId: "kanzlei-x", status: "kanzlei", consentAt: "2026-01-01T00:00:00Z" }), row({ marketingOptIn: "confirmed", leadId: "ampel-m" })]);
  const cDry = await runAmpelCleanup(c.io, { execute: false, now: NOW });
  assert.equal(cDry.utmRows, 1);
  assert.equal(c.saved.length + c.backups.length, 0);
  const cRun = await runAmpelCleanup(c.io, { execute: true, now: NOW });
  assert.equal(cRun.backup, "written");
  assert.ok(c.backups[0].startsWith("gobd/backup/ampel-cleanup/"));
  assert.equal(c.saved.length, 1);
  const before = row({ utmSource: "g", utmCampaign: "c" });
  const changed = cleanupRow(before).next;
  for (const key of Object.keys(before) as (keyof ReadinessLead)[]) {
    if (key === "utmSource" || key === "utmCampaign") continue;
    assert.equal(changed[key], before[key], `${key} unverändert`);
  }
  const failing = fakeIo([row({ utmSource: "g" })]);
  failing.io.writeBackup = async () => {
    throw new Error("x");
  };
  const noBackup = await runAmpelCleanup(failing.io, { execute: true, now: NOW });
  assert.equal(noBackup.backup, "failed");
  assert.equal(failing.saved.length, 0, "ohne Backup keine Änderung");

  // HTTP: ohne Secret 401, Schalter aus -> off, ?modus=trockenlauf zählt nur.
  for (const name of ["AMPEL_RETENTION_DRY_RUN_ENABLED", "AMPEL_RETENTION_EXECUTE_ENABLED", "AMPEL_CLEANUP_DRY_RUN_ENABLED", "AMPEL_CLEANUP_EXECUTE_ENABLED"]) {
    delete process.env[name];
  }
  const auth = { headers: { authorization: "Bearer s3cret" } };
  assert.equal((await handleAmpelJob(new Request("https://x/api/cron/ampel-loeschlauf"), "retention", { secret: "s3cret" })).status, 401);
  const off = await handleAmpelJob(new Request("https://x/api/cron/ampel-loeschlauf", auth), "retention", { secret: "s3cret", io: () => run.io });
  assert.equal((off.body as { mode: string }).mode, "off", "Default AUS");
  const forced = fakeIo(rows);
  const dryHttp = await handleAmpelJob(new Request("https://x/api/cron/ampel-altdaten?modus=trockenlauf", auth), "cleanup", { secret: "s3cret", io: () => forced.io, now: NOW });
  assert.equal((dryHttp.body as { mode: string }).mode, "dry");
  assert.equal(forced.saved.length + forced.backups.length, 0);

  // Cron: Ampel-Löschlauf ergänzt, addon-test-seed-firm bleibt, Altdaten ohne Cron.
  const vercel = JSON.parse(readFileSync("vercel.json", "utf8")) as { crons: { path: string }[] };
  const paths = vercel.crons.map((cron) => cron.path);
  for (const p of ["/api/cron/addon-notice", "/api/cron/loeschlauf", "/api/cron/addon-test-seed-firm", "/api/cron/ampel-loeschlauf"]) {
    assert.ok(paths.includes(p), p);
  }
  assert.ok(!paths.includes("/api/cron/ampel-altdaten"));

  // Einwilligungsversion: 2026-10-30 nur im Bericht-Ablauf.
  assert.equal(ampelConsentTextVersion("bericht"), "2026-10-30");
  assert.equal(ampelConsentTextVersion(undefined), "2026-10-14");
  assert.equal(ampelConsentTextVersion("bericht", "kassen-check"), "2026-10-14");
  // consent_at: unverändert (lead_id/Opt-in-Logik hängen daran).
  const send = readFileSync("lib/ampel-result-send.ts", "utf8");
  assert.ok(!send.includes('lead.consentAt = ""'), "consent_at wird für neue Zeilen nicht geleert");
  console.log("check-ampel-retention: ok");
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
