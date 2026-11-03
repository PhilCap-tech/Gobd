/**
 * Footer „Cookie-Einstellungen“ (Tester FAIL #310 Pkt. 4): erneut geöffneter Banner wird
 * in den Blick gescrollt und fokussiert (reduced motion: ohne Animation), Esc schließt nur
 * den erneut geöffneten Banner und gibt den Fokus zurück. Kein Overlay/fixierter Balken.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

async function main() {
  const src = readFileSync("components/consent-banner.tsx", "utf8");
  const css = readFileSync("app/globals.css", "utf8");
  assert.ok(src.includes("tabIndex={-1}"), "Banner fokussierbar");
  assert.ok(src.includes('event.key !== "Escape" || !reopenTrigger'), "Esc nur beim erneut geöffneten Banner");
  assert.ok(src.includes("reopenTrigger = event.currentTarget") && src.includes("revealConsentBanner()"), "Erstbesuch-Banner offen: Footer-Button scrollt/fokussiert wie bisher");
  // Folge #316 (CoS/Philip 02.11.): nach getroffener Wahl erscheint das Panel im Fluss beim Footer-Button.
  assert.ok(src.includes("reopenInline = true") && src.includes("<ConsentPanel inline />"), "Footer öffnet das Panel inline beim Button");
  assert.ok(src.includes("ready && open && !reopenInline"), "oben wird beim Inline-Öffnen nichts gerendert (kein Sprung)");
  assert.ok(/reopenInline = false;/.test(src.slice(src.indexOf("function returnFocusToTrigger"))), "Fokus-Rückgabe beendet den Inline-Modus");
  assert.ok(css.includes(".footer-links .consent-banner-inline {"), "Inline-Panel-Stil vorhanden");
  const inline = css.slice(css.indexOf(".footer-links .consent-banner-inline {"));
  assert.ok(!inline.slice(0, inline.indexOf("}")).match(/position:\s*(fixed|sticky|absolute)/), "Inline-Panel ist kein Overlay");
  assert.ok((src.match(/returnFocusToTrigger\(\);/g) ?? []).length >= 3, "Fokus zurück nach Esc und Auswahl");
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
  {
    const calls: string[] = [];
    const node = {
      scrollIntoView: (o: { block: string; behavior: string }) => calls.push(`scroll:${o.block}:${o.behavior}`),
      focus: (o: { preventScroll: boolean }) => calls.push(`focus:${o.preventScroll}`),
    };
    (globalThis as Record<string, unknown>).document = { querySelector: (sel: string) => (sel === ".consent-banner-inline" ? node : null) };
    const { revealInlineConsentPanel } = await import("@/components/consent-banner");
    assert.equal(revealInlineConsentPanel(), true);
    assert.deepEqual(calls, ["scroll:nearest:auto", "focus:true"], "inline: nur nearest, ohne Animation, Fokus ohne Scroll");
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
