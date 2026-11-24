/**
 * P2-K: /fragebogen darf die Debug-Zeile „Session: … · E-Mail“ nicht mehr rendern.
 *   npx tsx scripts/check-fragebogen-session-zeile.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync("app/intake/intake-form.tsx", "utf8");

assert.ok(!/Session:\s*\{/.test(src), "intake-form darf keine Session:-Zeile rendern");

const hintWithEmail = /<p className="hint"[^>]*>[\s\S]*?\{session\.email\}[\s\S]*?<\/p>/;
assert.ok(!hintWithEmail.test(src), "kein {session.email} in einem hint-Absatz");

console.log("check-fragebogen-session-zeile: ok");
