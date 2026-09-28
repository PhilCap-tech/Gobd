/**
 * When Delivery drops bundle 4.0.0 at gobd-delivery-templates/, copy it over
 * content/delivery-templates and rebuild. Until then this script waits.
 *
 *   node scripts/wire-delivery-v4.mjs
 */
import { cpSync, existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const root = process.cwd();
const source = path.join(root, "gobd-delivery-templates");
const versionFile = path.join(source, "VERSION");
const bundleFile = path.join(source, "bundle.json");

if (!existsSync(versionFile) && !existsSync(bundleFile)) {
  console.log(
    "waiting: gobd-delivery-templates/ has no VERSION or bundle.json 4.0.0 yet",
  );
  process.exit(0);
}

function readVersion() {
  if (existsSync(versionFile)) return readFileSync(versionFile, "utf8").trim();
  const bundle = JSON.parse(readFileSync(bundleFile, "utf8"));
  return String(bundle.version ?? "").trim();
}

const version = readVersion();
if (!version.startsWith("4.")) {
  console.log(`waiting: delivery bundle is ${version || "missing"}, need 4.0.0`);
  process.exit(0);
}

const target = path.join(root, "content", "delivery-templates");
cpSync(source, target, { recursive: true });
const build = spawnSync("node", ["content/delivery-templates/build-bundle.mjs"], {
  cwd: root,
  stdio: "inherit",
});
process.exit(build.status ?? 1);
