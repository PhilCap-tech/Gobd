/**
 * Neues Preismodell (v3): Kein sichtbarer Platzhalter ("[TODO", "PLATZHALTER")
 * auf Kundenseiten oder in Kundenmails. Synthetisch, kein Netz.
 *
 * Bewusst intern (nicht kundensichtbar) und deshalb ausgenommen:
 * - lib/plan-copy.ts: die Konstanten TODO_GROWTH / TODO_LEGAL selbst
 *   (nur Marker-Quelle für interne Warnungen, nicht gerendert)
 * - Code-Kommentare (JSDoc, //) in allen Dateien
 * - lib/tracking.ts (Kommentar zum Conversion-Wert)
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

for (const name of ["RESEND_API_KEY", "VERCEL_ENV"]) delete process.env[name];
process.env.PRICING_MODEL = "v3";
process.env.GOBD_PRICING_NEW_MODEL = "1";

const BAD = /\[TODO|PLATZHALTER/;
const INTERNAL_EXPORTS = new Set(["TODO_GROWTH", "TODO_LEGAL"]);
let passed = 0;
async function check(name: string, run: () => void | Promise<void>) {
  await run();
  passed += 1;
  console.log(`ok: ${name}`);
}

function stringsIn(value: unknown, depth = 0): string[] {
  if (typeof value === "string") return [value];
  if (depth > 3 || !value || typeof value !== "object") return [];
  return Object.values(value as Record<string, unknown>).flatMap((v) => stringsIn(v, depth + 1));
}

function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'`])\/\/.*$/gm, "$1")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(tsx?|mjs)$/.test(entry)) out.push(full);
  }
  return out;
}

async function main() {
  await check("v3: exportierte Kundentexte ohne [TODO/PLATZHALTER", async () => {
    const modules = {
      "plan-copy": await import("@/lib/plan-copy"),
      plan: await import("@/lib/plan"),
      "offer-copy": await import("@/lib/offer-copy"),
      "account-labels": await import("@/lib/account-labels"),
      "v3-firm-limit": await import("@/lib/v3-firm-limit"),
    };
    const hits: string[] = [];
    for (const [mod, exports] of Object.entries(modules)) {
      for (const [key, value] of Object.entries(exports)) {
        if (INTERNAL_EXPORTS.has(key) || typeof value === "function") continue;
        for (const text of stringsIn(value)) if (BAD.test(text)) hits.push(`${mod}.${key}`);
      }
    }
    assert.deepEqual(hits, [], `Platzhalter sichtbar: ${hits.join(", ")}`);
  });

  await check("v3: Kundenmails (Onboarding Kunde + Partner) ohne Platzhalter", async () => {
    const ops = await import("@/lib/ops");
    for (const audience of ["kunde", "steuerberater"] as const) {
      const mail = ops.buildOnboardingMail({ company: "Firma", audience, magicLinkUrl: "https://example.invalid/x" });
      for (const text of stringsIn(mail)) assert.ok(!BAD.test(text), `Mail ${audience}: Platzhalter`);
    }
  });

  await check("Quelltext app/ + components/: kein [TODO-Literal außerhalb von Kommentaren", () => {
    const root = process.cwd();
    const hits: string[] = [];
    for (const dir of ["app", "components"]) {
      for (const file of walk(path.join(root, dir))) {
        if (BAD.test(stripComments(readFileSync(file, "utf8")))) hits.push(path.relative(root, file));
      }
    }
    assert.deepEqual(hits, [], `Platzhalter im Quelltext: ${hits.join(", ")}`);
  });

  await check("lib/: [TODO nur in Kommentaren bzw. den internen Marker-Konstanten", () => {
    const root = process.cwd();
    const hits: string[] = [];
    for (const file of walk(path.join(root, "lib"))) {
      let src = stripComments(readFileSync(file, "utf8"));
      if (file.endsWith(path.join("lib", "plan-copy.ts"))) {
        src = src.replace(/export const TODO_(GROWTH|LEGAL) = "\[TODO-(GROWTH|LEGAL)\]";/g, "");
      }
      if (BAD.test(src)) hits.push(path.relative(root, file));
    }
    assert.deepEqual(hits, [], `Platzhalter in lib: ${hits.join(", ")}`);
  });

  console.log(`check-v3-placeholders: ${passed} ok`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
