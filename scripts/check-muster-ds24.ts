/**
 * Muster-PDF für DS24-Besucher (CoS 26.10.): unter v2 ohne Garantiezeile
 * GELD_ZURUECK_MICRO, wenn /partner-angebot mit ?quelle=ds24 verlinkt.
 * Legacy unverändert. Kein Referrer.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pageTexts } from "./pdf-text";

for (const name of ["PRICING_EXTRA_FIRMS_ENABLED", "PLAN_ACCESS_ENABLED"]) delete process.env[name];
process.env.PRICING_MODEL = "v2";

async function pdf(url: string): Promise<{ text: string; raw: string }> {
  const { GET } = await import("../app/steuerberater/muster/pdf/route");
  const res = await GET(new Request(url));
  assert.equal(res.status, 200, `${url} liefert 200`);
  const buffer = Buffer.from(await res.arrayBuffer());
  return { text: pageTexts(buffer).join("\n"), raw: buffer.toString("latin1") };
}

async function main() {
  const muster = await import("../lib/partner-muster");
  const offer = await import("../lib/offer-copy");

  assert.equal(muster.musterPdfIsDs24("ds24", false), false, "legacy: Upsell-Seite unverändert");
  assert.equal(muster.musterPdfIsDs24(null, false), false, "legacy ohne Marker: unverändert");
  assert.equal(muster.musterPdfIsDs24("ds24", true), true, "v2 + ds24: DS24-Fassung");
  assert.equal(muster.musterPdfIsDs24(" DS24 ", true), true, "Marker robust gegen Schreibweise");
  assert.equal(muster.musterPdfIsDs24(null, true), false, "v2 ohne Marker: normale Fassung");
  assert.equal(muster.musterPdfIsDs24("steuerberater", true), false, "fremder Marker: normale Fassung");
  assert.equal(muster.PARTNER_MUSTER_PDF_DS24_PATH, "/steuerberater/muster/pdf?quelle=ds24");

  const page = readFileSync("app/partner-angebot/page.tsx", "utf8");
  assert.ok(!page.includes("href={PARTNER_MUSTER_PDF_PATH}"), "/partner-angebot verlinkt das Muster nur über ds24MusterPdfHref");
  assert.equal(page.split("href={ds24MusterPdfHref(isPricingV2())}").length - 1, 2, "/partner-angebot: beide Muster-Links über ds24MusterPdfHref");
  assert.equal(muster.ds24MusterPdfHref(true), "/steuerberater/muster/pdf?quelle=ds24", "v2: mit Marker");
  assert.equal(muster.ds24MusterPdfHref(false), "/steuerberater/muster/pdf", "Legacy: Link wie main");
  for (const file of ["app/page.tsx", "app/steuerberater/page.tsx", "app/steuerberater/muster/page.tsx"]) {
    const src = readFileSync(file, "utf8");
    assert.ok(!src.includes("PARTNER_MUSTER_PDF_DS24_PATH") && !src.includes("ds24MusterPdfHref"), `${file} nutzt keinen DS24-Marker`);
  }
  const route = readFileSync("app/steuerberater/muster/pdf/route.ts", "utf8");
  assert.ok(!/referer|referrer/i.test(route), "Muster-PDF-Route wertet keinen Referrer aus");

  const micro = offer.GELD_ZURUECK_MICRO;
  // Neues Modell (28.10.): keine 14-Tage-Garantie mehr, Faktenzeile (Growth MARKER 1).
  assert.ok(micro.includes("ab 99 € je Firma"), "v2-Faktenzeile aktiv im Check");
  const { text: normal, raw: normalRaw } = await pdf("http://localhost/steuerberater/muster/pdf");
  assert.ok(normal.includes(offer.PDF_UPSELL_HEADLINE), "normales Muster hat Upsell-Seite");
  assert.ok(normal.includes(micro), "normales Muster (v2) hat die Garantiezeile");
  assert.ok(normal.includes(offer.PDF_UPSELL_PRICE), "normales Muster (v2) hat die v2-Preiszeile");
  assert.ok(normal.includes(offer.PDF_UPSELL_CTA), "normales Muster hat den /checkout-Hinweis");
  assert.ok(normalRaw.includes("/checkout"), "normales Muster hat den /checkout-Link");
  const { text: ds24, raw: ds24Raw } = await pdf("http://localhost/steuerberater/muster/pdf?quelle=ds24");
  assert.ok(ds24.includes(offer.PDF_UPSELL_HEADLINE), "DS24-Muster behält die Upsell-Seite");
  assert.ok(!ds24.includes(micro), "DS24-Muster (v2) ohne Garantiezeile");
  assert.ok(!ds24.includes(offer.LEGACY_GELD_ZURUECK_MICRO), "DS24-Muster (v2) auch ohne alte Garantiezeile");
  assert.ok(!ds24.includes(offer.PDF_UPSELL_PRICE), "DS24-Muster (v2) ohne v2-Preiszeile");
  assert.ok(!ds24.includes(offer.LEGACY_UPSELL_PRICE), "DS24-Muster (v2) ohne alte Preiszeile");
  assert.ok(!ds24.includes(offer.PDF_UPSELL_CTA) && !ds24.includes(offer.PDF_UPSELL_URL), "DS24-Muster ohne /checkout-Text");
  assert.ok(!ds24Raw.includes("/checkout"), "DS24-Muster ohne /checkout-Link (Link-Annotation)");
  console.log("check-muster-ds24 OK");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
