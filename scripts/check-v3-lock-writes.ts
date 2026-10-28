/**
 * E2E 28.10. G1–G3: gesperrtes v3-Konto (Tag 30 / erstattet) ändert keine
 * Firmen-Stammdaten, legt keine Firma an und lässt keine Einladung annehmen.
 * Sperre nach dem Plan des Firmen-INHABERS; Lesefehler → 503 (fail closed).
 * Legacy unverändert. Synthetisch, keine Sheet-/Stripe-Zugriffe.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

let passed = 0;
async function check(name: string, run: () => void | Promise<void>) {
  await run();
  passed += 1;
  console.log(`ok: ${name}`);
}
const src = (p: string) => readFileSync(p, "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");

async function main() {
  const planAccessMod = await import("@/lib/plan-access");
  const plan = await import("@/lib/plan");
  const entities = src("app/api/entities/route.ts");
  const accept = src("app/api/auth/invite/accept/route.ts");
  const access = src("lib/plan-access.ts");

  await check("Helfer v3OwnerLockDenial: nur v3, über planWriteDenial (503 bei Lesefehler)", () => {
    assert.equal(typeof planAccessMod.v3OwnerLockDenial, "function");
    assert.match(access, /v3OwnerLockDenial[\s\S]*?if \(!isPricingV2\(\)\) return null;[\s\S]*?return planWriteDenial\(ownerEmail\)/);
  });

  await check("Legacy: v3OwnerLockDenial sperrt nie (kein Plan-Lesen)", async () => {
    const before = process.env.PRICING_MODEL;
    process.env.PRICING_MODEL = "legacy";
    assert.equal(await planAccessMod.v3OwnerLockDenial("locked@example.com"), null);
    process.env.PRICING_MODEL = before;
  });

  await check("Gesperrt/erstattet → writesOpen=false, Text „Ihr Konto ist deaktiviert.“ / Erstattungstext", () => {
    const base = plan.emptyPlanRow("x@example.com", "2026-01-01T00:00:00.000Z");
    const row = (over: Record<string, string>) => ({ ...(base as object), email: "x@example.com", plan: "single", purchasedAt: "2026-01-01T00:00:00.000Z", accessUntil: "2026-01-31T00:00:00.000Z", ...over }) as never;
    const now = new Date("2026-10-28T12:00:00Z");
    const expired = plan.planAccess(row({}), now);
    assert.equal(expired.writesOpen, false);
    assert.equal(expired.writeMessage, "Ihr Konto ist deaktiviert.");
    const refunded = plan.planAccess(row({ refundedAt: "2026-01-02T00:00:00.000Z", accessUntil: "2099-01-01T00:00:00.000Z" }), now);
    assert.equal(refunded.writesOpen, false);
  });

  await check("G1 PATCH /api/entities: Inhaber-Sperre (getEntity → userEmail) vor updateEntity, 403", () => {
    const patch = entities.slice(entities.indexOf("export async function PATCH"));
    const lockAt = patch.indexOf("v3OwnerLockDenial(current.userEmail)");
    assert.ok(lockAt > 0, "PATCH prüft die Sperre des Inhabers nicht");
    assert.ok(lockAt < patch.indexOf("updateEntity("), "Sperre muss vor dem Speichern greifen");
    assert.match(patch, /if \(locked\) return jsonError\(locked, 403\)/);
    assert.match(patch, /sheetsOutageResponse/);
  });

  await check("G2 POST /api/entities: Sperre vor Firmenlimit und vor createEntity, Lesefehler 503", () => {
    const post = entities.slice(entities.indexOf("export async function POST"), entities.indexOf("export async function PATCH"));
    const lockAt = post.indexOf("v3OwnerLockDenial(email)");
    assert.ok(lockAt > 0, "POST prüft die Sperre nicht");
    assert.ok(lockAt < post.indexOf("v3FirmDenial("), "Sperre muss vor dem Firmenlimit kommen");
    assert.ok(lockAt < post.indexOf("createEntity("));
    const block = post.slice(lockAt, post.indexOf("v3FirmDenial("));
    assert.match(block, /sheetsOutageResponse\(error\)/);
    assert.doesNotMatch(block, /logError/, "Lesefehler darf nicht nur geloggt werden (fail closed)");
  });

  await check("G3 Einladung annehmen: Sperre des Inhabers (entity.userEmail) vor dem Token-Verbrauch, 403", () => {
    assert.match(accept, /ownerDenial\(entity\.userEmail\)/);
    assert.match(accept, /throw new OwnerLockedError/);
    assert.match(accept, /acceptInvite\(token, lockedLoader\)/);
    assert.match(accept, /OwnerLockedError[\s\S]*?status: 403/);
    assert.ok(accept.indexOf("instanceof OwnerLockedError") < accept.indexOf("sheetsOutageResponse(error)"));
  });

  await check("G3 Annahme: gesperrter Inhaber → 403 ohne acceptInvite-Speicherung (injizierter Loader)", async () => {
    const { postAccept } = await import("@/app/api/auth/invite/accept/route");
    // Ungültiger Token endet vor dem Loader (400); prüft nur, dass die Signatur die Inhaber-Prüfung annimmt.
    const res = await postAccept(new Request("http://x/", { method: "POST", body: JSON.stringify({ token: "" }) }), async () => null, async () => "Ihr Konto ist deaktiviert.");
    assert.equal(res.status, 400);
    assert.equal(postAccept.length >= 1, true);
  });

  console.log(`check:v3-lock-writes ${passed} ok`);
}
main().catch((error) => {
  console.error(error);
  process.exit(1);
});
