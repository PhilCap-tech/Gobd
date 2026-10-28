/** Test-Tabelle selbst anlegen: harte Sperre, leere Tabelle, Idempotenz. Gemockter Sheets-Client. */
import assert from "node:assert/strict";
import { installSheetsHandler } from "@/lib/sheets-client";
import { bootstrapTestSheet, testSheetBootstrapGate, testSheetTabs } from "@/lib/test-sheet-bootstrap";

const TEST_ID = "test-sheet-id-123";
const baseEnv = {
  GOBD_DATA_ENV: "test",
  GOOGLE_SHEETS_SPREADSHEET_ID: TEST_ID,
  GOBD_TEST_SPREADSHEET_ID: TEST_ID,
  VERCEL_ENV: "preview",
  STRIPE_SECRET_KEY: "sk_test_dummy",
  BLOB_READ_WRITE_TOKEN: "vercel_blob_rw_TestStore1_x",
  GOBD_TEST_BLOB_STORE_ID: "TestStore1",
};

type Mock = { tabs: Map<string, string[][]>; calls: string[] };
function unquote(range: string): string {
  const tab = range.split("!")[0];
  return tab.startsWith("'") ? tab.slice(1, -1).replace(/''/g, "'") : tab;
}
function install(mock: Mock): void {
  installSheetsHandler(async ({ op, args }) => {
    mock.calls.push(op);
    assert.equal(args.spreadsheetId, TEST_ID, "nur die Test-Tabelle");
    if (op === "spreadsheets.get") return { data: { sheets: [...mock.tabs.keys()].map((title) => ({ properties: { title } })) } };
    if (op === "spreadsheets.batchUpdate") {
      const body = args.requestBody as { requests: Array<{ addSheet: { properties: { title: string } } }> };
      for (const r of body.requests) {
        assert.ok(!mock.tabs.has(r.addSheet.properties.title), "kein doppelter Tab");
        mock.tabs.set(r.addSheet.properties.title, []);
      }
      return { data: {} };
    }
    if (op === "values.batchGet") {
      const ranges = args.ranges as string[];
      return { data: { valueRanges: ranges.map((range) => ({ range, values: (mock.tabs.get(unquote(range)) ?? []).slice(0, 1) })) } };
    }
    if (op === "values.batchUpdate") {
      const body = args.requestBody as { data: Array<{ range: string; values: string[][] }> };
      for (const d of body.data) {
        const rows = mock.tabs.get(unquote(d.range));
        assert.ok(rows, "Tab existiert");
        assert.ok(!rows[0] || rows[0].every((c) => c === ""), "keine vorhandene Kopfzeile überschreiben");
        rows[0] = d.values[0];
      }
      return { data: {} };
    }
    throw new Error(`unerwartete Operation ${op}`);
  });
}

async function main(): Promise<void> {
  // Sperre
  for (const [name, env] of [
    ["GOBD_DATA_ENV fehlt", { ...baseEnv, GOBD_DATA_ENV: "" }],
    ["GOBD_DATA_ENV=prod", { ...baseEnv, GOBD_DATA_ENV: "prod" }],
    ["IDs verschieden", { ...baseEnv, GOOGLE_SHEETS_SPREADSHEET_ID: "prod-sheet" }],
    ["Test-ID fehlt", { ...baseEnv, GOBD_TEST_SPREADSHEET_ID: "" }],
    ["Produktion", { ...baseEnv, VERCEL_ENV: "production" }],
    ["Live-Key", { ...baseEnv, STRIPE_SECRET_KEY: "sk_live_dummy" }],
    ["falscher Blob", { ...baseEnv, BLOB_READ_WRITE_TOKEN: "vercel_blob_rw_ProdStore_x" }],
  ] as const) {
    assert.equal(testSheetBootstrapGate(env).ok, false, `Sperre: ${name}`);
    const mock: Mock = { tabs: new Map(), calls: [] };
    install(mock);
    const result = await bootstrapTestSheet(env);
    assert.equal(result.ran, false, `läuft nicht: ${name}`);
    assert.equal(mock.calls.length, 0, `keine Sheets-Anfrage: ${name}`);
  }
  assert.equal(testSheetBootstrapGate(baseEnv).ok, true);

  // Leere Tabelle (nur Standard-Tab "Tabellenblatt1")
  const mock: Mock = { tabs: new Map([["Tabellenblatt1", []]]), calls: [] };
  install(mock);
  const first = await bootstrapTestSheet(baseEnv);
  assert.equal(first.ran, true);
  const expected = testSheetTabs();
  const titles = expected.map((t) => t.title);
  for (const name of ["intakes", "readiness_leads", "entities", "profiles", "memberships", "audit_log", "subscription_lifecycle", "plans", "plan_firms", "ampel_rate", "ampel_steps", "home_cta"]) {
    assert.ok(titles.includes(name), `Tab ${name} vorgesehen`);
  }
  for (const tab of expected) {
    assert.deepEqual(mock.tabs.get(tab.title)?.[0], [...tab.header], `Kopfzeile ${tab.title}`);
    assert.equal(mock.tabs.get(tab.title)?.length, 1, `keine Datenzeilen ${tab.title}`);
    assert.ok(tab.header.length > 0, `Kopf nicht leer ${tab.title}`);
  }
  assert.deepEqual(mock.tabs.get("Tabellenblatt1"), [], "fremder Tab unberührt");
  if (first.ran) assert.equal(first.createdTabs.length, expected.length);

  // Idempotent
  mock.calls = [];
  const second = await bootstrapTestSheet(baseEnv);
  assert.ok(second.ran && second.createdTabs.length === 0 && second.headerTabs.length === 0, "zweiter Lauf ändert nichts");
  assert.deepEqual(mock.calls, ["spreadsheets.get", "values.batchGet"], "zweiter Lauf nur lesen");

  // Vorhandene Kopfzeile bleibt, auch wenn sie abweicht
  const partial: Mock = { tabs: new Map([["plans", [["email", "eigene_spalte"]]]]), calls: [] };
  install(partial);
  const third = await bootstrapTestSheet(baseEnv);
  assert.deepEqual(partial.tabs.get("plans")?.[0], ["email", "eigene_spalte"], "vorhandene Kopfzeile unberührt");
  assert.ok(third.ran && !third.createdTabs.includes("plans") && !third.headerTabs.includes("plans"));

  installSheetsHandler(null);
  console.log("check-test-bootstrap: ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
