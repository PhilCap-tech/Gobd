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

async function pdfText(url: string): Promise<string> {
  const { GET } = await import("../app/steuerberater/muster/pdf/route");
  const res = await GET(new Request(url));
  assert.equal(res.status, 200, `${url} liefert 200`);
  const buffer = Buffer.from(await res.arrayBuffer());
  return pageTexts(buffer).join("\n");
}

async function main() {
  const muster = await import("../lib/partner-muster");
  const offer = await import("../lib/offer-copy");

  assert.equal(muster.musterPdfShowsGuarantee("ds24", false), true, "legacy: Garantiezeile bleibt");
  assert.equal(muster.musterPdfShowsGuarantee(null, false), true, "legacy ohne Marker: bleibt");
  assert.equal(muster.musterPdfShowsGuarantee("ds24", true), false, "v2 + ds24: ohne Garantiezeile");
  assert.equal(muster.musterPdfShowsGuarantee(" DS24 ", true), false, "Marker robust gegen Schreibweise");
  assert.equal(muster.musterPdfShowsGuarantee(null, true), true, "v2 ohne Marker: mit Garantiezeile");
  assert.equal(muster.musterPdfShowsGuarantee("steuerberater", true), true, "fremder Marker: mit Garantiezeile");
  assert.equal(muster.PARTNER_MUSTER_PDF_DS24_PATH, "/steuerberater/muster/pdf?quelle=ds24");

  const page = readFileSync("app/partner-angebot/page.tsx", "utf8");
  assert.ok(!page.includes("href={PARTNER_MUSTER_PDF_PATH}"), "/partner-angebot verlinkt nie die Muster-URL ohne Marker");
  assert.equal(page.split("href={PARTNER_MUSTER_PDF_DS24_PATH}").length - 1, 2, "/partner-angebot: beide Muster-Links mit ?quelle=ds24");
  for (const file of ["app/page.tsx", "app/steuerberater/page.tsx", "app/steuerberater/muster/page.tsx"]) {
    assert.ok(!readFileSync(file, "utf8").includes("PARTNER_MUSTER_PDF_DS24_PATH"), `${file} nutzt keinen DS24-Marker`);
  }
  const route = readFileSync("app/steuerberater/muster/pdf/route.ts", "utf8");
  assert.ok(!/referer|referrer/i.test(route), "Muster-PDF-Route wertet keinen Referrer aus");

  const micro = offer.GELD_ZURUECK_MICRO;
  assert.ok(micro.startsWith("Volle Erstattung"), "v2-Garantiezeile aktiv im Check");
  const normal = await pdfText("http://localhost/steuerberater/muster/pdf");
  assert.ok(normal.includes(offer.PDF_UPSELL_HEADLINE), "normales Muster hat Upsell-Seite");
  assert.ok(normal.includes(micro), "normales Muster (v2) hat die Garantiezeile");
  const ds24 = await pdfText("http://localhost/steuerberater/muster/pdf?quelle=ds24");
  assert.ok(ds24.includes(offer.PDF_UPSELL_HEADLINE), "DS24-Muster behält die Upsell-Seite");
  assert.ok(!ds24.includes(micro), "DS24-Muster (v2) ohne Garantiezeile");
  assert.ok(!ds24.includes(offer.LEGACY_GELD_ZURUECK_MICRO), "DS24-Muster (v2) auch ohne alte Garantiezeile");
  console.log("check-muster-ds24 OK");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
