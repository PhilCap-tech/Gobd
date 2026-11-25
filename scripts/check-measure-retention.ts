/**
 * #321 retention: 30-day markers, 24-month rows, 7-day test rows.
 * starts/ stays. Dry-run does not delete. The switch defaults off.
 * A test cohort does not create a marker. Without MEASURE_HMAC_SECRET
 * the count is written and no marker file is created.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { claimMeasureOnce, setMeasureClaimRootForTest } from "@/lib/measure-claim";
import { recordIntakeStart, setMeasureNowForTest } from "@/lib/measure-record";
import { installMeasureSheetClientForTest, type MeasureSheetClient } from "@/lib/measure-store";
import { setMeasureVercelEnvForTest } from "@/lib/measure-test";
import {
  countRowsToDelete,
  markerAction,
  markerUnreadable,
  measureRetentionMode,
  shiftDays,
  shiftMonths,
} from "@/lib/measure-retention";
import {
  measureRetentionLogLine,
  runMeasureRetention,
  type MeasureRetentionIo,
} from "@/lib/measure-retention-run";

const TODAY = "2026-11-23";

assert.equal(shiftDays(TODAY, -30), "2026-10-24");
assert.equal(shiftDays(TODAY, -7), "2026-11-16");
assert.equal(shiftMonths(TODAY, -24), "2024-11-23");
assert.equal(measureRetentionMode({} as NodeJS.ProcessEnv), "off");
assert.equal(
  measureRetentionMode({
    MEASURE_RETENTION_DRY_RUN_ENABLED: "true",
    MEASURE_RETENTION_EXECUTE_ENABLED: "true",
  } as unknown as NodeJS.ProcessEnv),
  "dry-run",
);

const mess = countRowsToDelete({
  tab: "messluecken",
  today: TODAY,
  values: [
    ["date", "metric", "n", "channel", "cohort"],
    ["2024-11-22", "intake_start", "", "direct", "standard"],
    ["2026-11-20", "intake_start", "", "direct", "standard"],
    ["2026-11-15", "intake_start", "", "direct", "test"],
    ["2026-11-20", "intake_start", "", "direct", "test"],
    ["kein-datum", "intake_start", "", "direct", "standard"],
    ["2020-01-01", "intake_start", "", "direct", "other"],
  ],
});
assert.deepEqual(mess.rows, [2, 4]);
assert.equal(mess.testRows, 1);

const authCounts = countRowsToDelete({
  tab: "messluecken",
  today: TODAY,
  values: [
    ["date", "metric", "n", "channel", "cohort"],
    ["2024-11-22", "link_requested", "", "unknown", "standard"],
    ["2024-11-22", "verify_human", "", "direct", "standard"],
    ["2024-11-22", "verify_scanner", "", "unknown", "standard"],
    ["2026-11-22", "link_requested", "", "unknown", "standard"],
    ["2026-11-22", "verify_human", "", "unknown", "test"],
    ["2026-11-10", "verify_scanner", "", "unknown", "test"],
  ],
});
assert.deepEqual(authCounts.rows, [2, 3, 4, 7], "auth day counts follow the 24-month and 7-day rules");
assert.equal(authCounts.testRows, 1);

const home = countRowsToDelete({
  tab: "home_cta",
  today: TODAY,
  values: [
    ["date", "cta", "device"],
    ["2024-11-22", "hero_muster", "desktop"],
    ["2026-11-01", "home_view", "mobile"],
  ],
});
assert.deepEqual(home.rows, [2]);
assert.equal(home.testRows, 0);

const svVisit = countRowsToDelete({
  tab: "schnellversion_49",
  today: TODAY,
  values: [
    ["name", "arm", "variante", "branche_vorlage", "value", "step", "ziel", "day"],
    ["sv_visit", "test", "b", "", "0", "0", "", "2026-11-15"],
    ["sv_home_view", "test", "b", "", "0", "0", "", "2020-01-01"],
    ["sv_visit", "", "b", "", "0", "0", "", "2024-11-22"],
    ["sv_visit", "", "b", "", "0", "0", "", ""],
  ],
});
assert.deepEqual(svVisit.rows, [4], "sv_visit uses column H and 24 months, not the 7-day test rule");
assert.equal(svVisit.testRows, 0);
assert.equal(svVisit.unparseable, 1);

const hmac = "gobd/measure-claim/" + "a".repeat(64) + ".json";
assert.equal(markerAction(hmac, JSON.stringify({ at: "2026-10-23" }), TODAY), "delete");
assert.equal(markerAction(hmac, JSON.stringify({ at: "2026-11-01" }), TODAY), "keep");
assert.equal(markerAction(hmac, "{", TODAY), "keep");
assert.equal(markerUnreadable(hmac, "{"), true);
assert.equal(markerUnreadable("gobd/measure-claim/starts/test/ampel_result.json", "{"), false);
assert.equal(markerAction("gobd/measure-claim/starts/standard/intake_start.json", JSON.stringify({ date: "2026-11-07" }), TODAY), "skip");
assert.equal(markerAction("gobd/measure-claim/starts/test/ampel_result.json", JSON.stringify({ date: "2026-11-01" }), TODAY), "skip");
assert.equal(markerAction("gobd/intakes/row.json", "{}", TODAY), "skip");

let reads = 0;
let deletes = 0;
const io: MeasureRetentionIo = {
  async sheets() {
    reads += 1;
    return [
      {
        title: "messluecken",
        sheetId: 3,
        values: [
          ["date", "metric", "n", "channel", "cohort"],
          ["2020-01-01", "intake_start", "", "direct", "standard"],
          ["2026-11-01", "intake_start", "", "direct", "test"],
        ],
      },
      {
        title: "home_cta",
        sheetId: 4,
        values: [
          ["date", "cta", "device"],
          ["2026-11-20", "home_view", "desktop"],
        ],
      },
    ];
  },
  async deleteRows() {
    deletes += 1;
  },
  async markers() {
    return [
      { pathname: hmac, body: JSON.stringify({ at: "2026-10-01" }) },
      { pathname: "gobd/measure-claim/starts/standard/intake_start.json", body: JSON.stringify({ date: "2026-11-07" }) },
      { pathname: "gobd/measure-claim/broken.json", body: "{" },
    ];
  },
  async deleteMarkers() {
    deletes += 1;
  },
};

async function main() {
const off = await runMeasureRetention({ now: new Date("2026-11-23T12:00:00.000Z"), mode: "off", io });
assert.equal(off.mode, "off");
assert.equal(off.unreadable, 0);
assert.equal(reads, 0);
assert.equal(deletes, 0);

const dry = await runMeasureRetention({ now: new Date("2026-11-23T12:00:00.000Z"), mode: "dry-run", io });
assert.equal(dry.rows, 2);
assert.equal(dry.testRows, 1);
assert.equal(dry.markers, 1);
assert.equal(dry.unreadable, 1);
assert.equal(dry.deleted, false);
assert.equal(deletes, 0);
const line = measureRetentionLogLine(dry);
assert.match(line, /^date=2026-11-23 mode=dry-run markers=1 rows=2 test_rows=1 unreadable=1 deleted=0$/);
assert.equal(line.includes(hmac), false);
assert.equal(/[0-9a-f]{16,}/.test(line), false);

const savedEvent = process.env.npm_lifecycle_event;
process.env.npm_lifecycle_event = "check:measure-retention";
const blocked = await runMeasureRetention({ now: new Date("2026-11-23T12:00:00.000Z"), mode: "execute", io });
assert.equal(blocked.deleted, false);
assert.equal(deletes, 0);
if (savedEvent === undefined) delete process.env.npm_lifecycle_event;
else process.env.npm_lifecycle_event = savedEvent;

delete process.env.MEASURE_HMAC_SECRET;
const root = mkdtempSync(path.join(tmpdir(), "measure-hmac-"));
setMeasureClaimRootForTest(root);
setMeasureVercelEnvForTest("production");
setMeasureNowForTest(() => new Date("2026-11-23T11:00:00.000Z"));
const written: string[][] = [];
const titles: string[] = [];
const client: MeasureSheetClient = {
  async get() {
    return { data: { sheets: titles.map((title, index) => ({ properties: { title, sheetId: index + 1 } })) } };
  },
  async batchUpdate(args) {
    const title = args.requestBody.requests[0]?.addSheet?.properties.title ?? "";
    if (!title || titles.includes(title)) throw new Error("exists");
    titles.push(title);
    return { data: { replies: [{ addSheet: { properties: { sheetId: titles.length } } }] } };
  },
  async valuesGet(args) {
    if (String(args.range).endsWith("!A:E")) return { data: { values: written.map((row) => [...row]) } };
    return { data: { values: written[0] ? [[...written[0]]] : [] } };
  },
  async valuesAppend(args) {
    for (const row of args.requestBody.values) written.push([...row]);
    return { data: {} };
  },
};
installMeasureSheetClientForTest({ client, configured: true });
assert.equal(await claimMeasureOnce("intake", "email:buyer@example.com:default"), "unkeyed");
await recordIntakeStart({ draftKey: "email:buyer@example.com:default", email: "buyer@example.com" });
await recordIntakeStart({ draftKey: "email:buyer@example.com:default", email: "buyer@example.com" });
assert.equal(written.filter((row) => row[1] === "intake_start").length, 2);
await recordIntakeStart({
  draftKey: "email:delivered@resend.dev:default",
  email: "delivered@resend.dev",
});
assert.equal(readdirSync(root).length, 0);

const privacy = await import("node:fs").then((fs) => fs.readFileSync("content/legal/datenschutz-v3.md", "utf8"));
assert.ok(privacy.includes("löschen ihn 30 Tage nach seiner Anlage."));
assert.ok(privacy.includes("Die Zählwerte löschen wir 24 Monate nach dem jeweiligen Zähltag"));
assert.ok(privacy.includes("spätestens nach 7 Tagen"));
assert.ok(privacy.includes("Ihren Widerspruch prüfen wir und teilen Ihnen das Ergebnis mit. Unabhängig davon löschen wir jeden Messmarker 30 Tage nach seiner Anlage."));
assert.equal(privacy.includes("zählen Ihre weiteren Schritte nicht mehr personenbezogen"), false);
const cookies = await import("node:fs").then((fs) => fs.readFileSync("content/legal/cookies-v3.md", "utf8"));
assert.ok(cookies.includes("## Eigene Schrittzählung"));
assert.ok(cookies.includes("Ohne Einwilligung übermitteln wir über diese Marketing-Dienste keine Daten an Google."));

console.log("check-measure-retention: ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
