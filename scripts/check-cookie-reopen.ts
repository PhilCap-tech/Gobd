/**
 * Footer „Cookie-Einstellungen“ (Tester FAIL #310 Pkt. 4): erneut geöffneter Banner wird
 * in den Blick gescrollt und fokussiert (reduced motion: ohne Animation), Esc schließt nur
 * den erneut geöffneten Banner und gibt den Fokus zurück. Kein Overlay/fixierter Balken.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

async function main() {
  const src = readFileSync("components/consent-banner.tsx", "utf8");
  assert.ok(src.includes("tabIndex={-1}"), "Banner fokussierbar");
  assert.ok(src.includes('event.key !== "Escape" || !reopenTrigger'), "Esc nur beim erneut geöffneten Banner");
  assert.ok(src.includes("reopenTrigger = event.currentTarget") && src.includes("revealConsentBanner()"), "Footer-Button scrollt/fokussiert");
  assert.ok((src.match(/returnFocusToTrigger\(\);/g) ?? []).length >= 3, "Fokus zurück nach Esc und Auswahl");
  const css = readFileSync("app/globals.css", "utf8");
  const banner = css.slice(css.indexOf(".consent-banner {"), css.indexOf("}", css.indexOf(".consent-banner {")));
  assert.ok(banner.includes("position: relative") && !banner.includes("fixed"), "Banner bleibt im Dokumentfluss, überdeckt nichts");

  for (const reduce of [false, true]) {
    const calls: string[] = [];
    const node = {
      scrollIntoView: (o: { block: string; behavior: string }) => calls.push(`scroll:${o.block}:${o.behavior}`),
      focus: (o: { preventScroll: boolean }) => calls.push(`focus:${o.preventScroll}`),
    };
    (globalThis as Record<string, unknown>).document = { querySelector: (sel: string) => (sel === ".consent-banner" ? node : null) };
    (globalThis as Record<string, unknown>).window = { matchMedia: () => ({ matches: reduce }) };
    const { revealConsentBanner } = await import("@/components/consent-banner");
    assert.equal(revealConsentBanner(), true);
    assert.deepEqual(calls, [`scroll:start:${reduce ? "auto" : "smooth"}`, "focus:true"]);
    (globalThis as Record<string, unknown>).document = { querySelector: () => null };
    assert.equal(revealConsentBanner(), false, "ohne Banner: nichts tun");
  }
  const tracking = readFileSync("lib/tracking.ts", "utf8");
  const close = tracking.slice(tracking.indexOf("export function closeReopenedConsentBanner"));
  assert.ok(!close.slice(0, close.indexOf("}")).includes("saveConsent"), "Esc ändert keine Einwilligung");
  console.log("check-cookie-reopen: ok");
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
