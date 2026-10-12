/**
 * Offline: Muster-PDFs sind als Muster markiert, Kunden-PDFs nicht.
 * /api/delivery ohne Berechtigung liefert 401.
 * Usage: npx tsx scripts/check-muster-mark.ts
 */
import { readFileSync } from "node:fs";
import zlib from "node:zlib";
import { POST } from "../app/api/delivery/route";
import {
  CHECKOUT_GRANT_COOKIE,
  createCheckoutGrantToken,
  createSessionToken,
  SESSION_COOKIE,
} from "../lib/auth";
import {
  generateMarkdownPdf,
  generatePdf,
  KUNDE_COVER_LINE,
  MUSTER_COVER_LINE,
  MUSTER_WATERMARK,
} from "../lib/delivery";
import { MODULE } from "../lib/module/katalog";
import { getGesamtMuster } from "../lib/module-muster";
import {
  GELD_ZURUECK_MICRO,
  PDF_UPSELL_BODY,
  PDF_UPSELL_CTA,
  PDF_UPSELL_DISCLAIMER,
  PDF_UPSELL_FOOTNOTE,
  PDF_UPSELL_HEADLINE,
  PDF_UPSELL_PRICE,
  PDF_UPSELL_URL,
  UPSELL_BULLETS,
  UPSELL_CTA,
  UPSELL_CTA_HREF,
  UPSELL_FOOTNOTE,
  UPSELL_HEADLINE,
  UPSELL_PRICE,
  UPSELL_PRICE_BREAKDOWN,
  UPSELL_SECTION_2_TEXT,
} from "../lib/offer-copy";
import { MONTHLY_EUR, SETUP_EUR, TODAY_EUR } from "../lib/pricing";
import {
  PARTNER_MUSTER_ANSWERS,
  PARTNER_MUSTER_DOCUMENT_ID,
  PARTNER_MUSTER_IDENTITY,
  PARTNER_MUSTER_VERSION_META,
} from "../lib/partner-muster";
import { pixelwerkAnswers } from "./fixtures/pdf-consistency";

const failures: string[] = [];

function expect(cond: boolean, message: string) {
  if (!cond) failures.push(message);
}

const WINANSI_EXTRA: Record<number, string> = {
  0x80: "€",
  0x91: "‘",
  0x92: "’",
  0x93: "“",
  0x94: "”",
  0x95: "•",
  0x96: "–",
  0x97: "—",
  0x99: "™",
};

function winAnsiChar(code: number): string {
  return WINANSI_EXTRA[code] ?? String.fromCharCode(code);
}

function decodePdfLiteral(body: string): string {
  let out = "";
  for (let i = 0; i < body.length; i += 1) {
    const ch = body[i] ?? "";
    if (ch !== "\\") {
      out += winAnsiChar(ch.charCodeAt(0));
      continue;
    }
    const next = body[i + 1] ?? "";
    if (next === "n") {
      out += "\n";
      i += 1;
      continue;
    }
    if (next === "r") {
      out += "\r";
      i += 1;
      continue;
    }
    if (next === "t") {
      out += "\t";
      i += 1;
      continue;
    }
    if (next === "(" || next === ")" || next === "\\") {
      out += next;
      i += 1;
      continue;
    }
    if (/[0-7]/.test(next)) {
      let oct = next;
      let j = i + 2;
      for (let k = 0; k < 2 && j < body.length && /[0-7]/.test(body[j] ?? ""); k += 1, j += 1) {
        oct += body[j];
      }
      out += winAnsiChar(Number.parseInt(oct, 8));
      i = j - 1;
      continue;
    }
  }
  return out;
}

function decodeHex(hex: string): string {
  const bytes = hex.replace(/\s+/g, "");
  let out = "";
  for (let i = 0; i + 1 < bytes.length; i += 2) {
    const code = Number.parseInt(bytes.slice(i, i + 2), 16);
    if (Number.isNaN(code)) continue;
    out += winAnsiChar(code);
  }
  return out;
}

function textFromContent(latin: string): string {
  const parts: string[] = [];
  const hex = /<([0-9A-Fa-f\s]+)>/g;
  let match: RegExpExecArray | null;
  while ((match = hex.exec(latin))) {
    parts.push(decodeHex(match[1] ?? ""));
  }
  const literal = /\((?:\\.|[^\\)])*\)/g;
  while ((match = literal.exec(latin))) {
    parts.push(decodePdfLiteral((match[0] ?? "").slice(1, -1)));
  }
  return parts.join("");
}

function pageTexts(buffer: Buffer): string[] {
  const raw = buffer.toString("latin1");
  const texts: string[] = [];
  const re = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(raw))) {
    const data = Buffer.from(match[1] ?? "", "latin1");
    let inflated: Buffer;
    try {
      inflated = zlib.inflateSync(data);
    } catch {
      inflated = data;
    }
    const latin = inflated.toString("latin1");
    if (!/\/F\d+ [\d.]+ Tf/.test(latin)) continue;
    texts.push(textFromContent(latin));
  }
  return texts;
}

function pageCount(buffer: Buffer): number {
  return (buffer.toString("latin1").match(/\/Type\s*\/Page(?!s)/g) || []).length;
}

function joined(pages: string[]): string {
  return pages.join("\n");
}

const EXPECTED_PRICE = `heute ${TODAY_EUR} € zzgl. USt, danach ${MONTHLY_EUR} €/Monat, monatlich kündbar, alle 24 Module inklusive`;
const EXPECTED_BREAKDOWN = `${TODAY_EUR} € = ${SETUP_EUR} € Einrichtung + ${MONTHLY_EUR} € erster Monat`;

expect(UPSELL_PRICE === EXPECTED_PRICE, "UPSELL_PRICE matches pricing.ts wording");
expect(PDF_UPSELL_PRICE === UPSELL_PRICE, "PDF price line is the web price line");
expect(UPSELL_PRICE_BREAKDOWN === EXPECTED_BREAKDOWN, "price breakdown matches pricing.ts");
expect(UPSELL_CTA_HREF === "/checkout", "CTA target is /checkout");
expect(
  GELD_ZURUECK_MICRO ===
    "14 Tage Zufriedenheitsgarantie — volle Erstattung, solange noch kein PDF erzeugt wurde",
  "guarantee line stays the landing sentence",
);
expect(
  readFileSync("components/muster-upsell.tsx", "utf8").includes("GELD_ZURUECK_MICRO"),
  "web upsell reuses the guarantee constant",
);
expect(
  readFileSync("lib/delivery.ts", "utf8").includes("GELD_ZURUECK_MICRO"),
  "pdf upsell reuses the guarantee constant",
);
expect(UPSELL_CTA === "Eigene Dokumentation erstellen", "CTA label");
expect(UPSELL_HEADLINE.startsWith("Das Muster zeigt eine fiktive Firma"), "web headline");
expect(UPSELL_SECTION_2_TEXT.includes("¹"), "web footnote marker kept");
expect(UPSELL_FOOTNOTE.startsWith("¹ Vgl. GoBD"), "web footnote kept");
expect(PDF_UPSELL_BODY.includes("¹"), "pdf footnote marker kept");
expect(PDF_UPSELL_FOOTNOTE.startsWith("¹ Vgl. GoBD"), "pdf footnote kept");
expect(PDF_UPSELL_URL === "gobd-doku-erstellen.de/checkout", "pdf url label");
expect(PDF_UPSELL_CTA.includes(PDF_UPSELL_URL), "pdf cta names the checkout url");
expect(
  UPSELL_BULLETS.some((bullet) => bullet.includes("inklusive Uploads")),
  "uploads stay in the upsell because the account flow can store and open them",
);
expect(
  UPSELL_BULLETS.some((bullet) => bullet.includes("früherer Fassungen")),
  "earlier versions stay because each account version has a download",
);
expect(MODULE.length === 24, "catalog still has 24 modules");

const musterRoutes = [
  "app/muster/gesamt/[vorlage]/pdf/route.ts",
  "app/steuerberater/muster/pdf/route.ts",
  "app/muster/gesamt/[vorlage]/fragebogen/route.ts",
  "app/muster/modul/[modul]/fragebogen/route.ts",
];
for (const file of musterRoutes) {
  expect(readFileSync(file, "utf8").includes('variant: "muster"'), `${file} sets variant muster`);
}

const customerRoutes = [
  "app/api/intake/route.ts",
  "app/api/document/route.ts",
  "app/api/docs/[id]/download/route.ts",
  "app/api/internal/blob-smoke/route.ts",
  "lib/blob.ts",
  "scripts/render-sample-delivery-pdf.ts",
];
for (const file of customerRoutes) {
  expect(
    !readFileSync(file, "utf8").includes('variant: "muster"'),
    `${file} does not mark a customer PDF as muster`,
  );
}

const webSurfaces = [
  "app/muster/page.tsx",
  "app/muster/gesamt/[vorlage]/page.tsx",
  "app/steuerberater/muster/page.tsx",
  "app/steuerberater/demo/demo-walkthrough.tsx",
];
for (const file of webSurfaces) {
  expect(readFileSync(file, "utf8").includes("MusterUpsell"), `${file} shows the upsell`);
}
expect(
  !readFileSync("app/steuerberater/page.tsx", "utf8").includes("MusterUpsell"),
  "steuerberater overview stays without the checkout upsell",
);
expect(
  !readFileSync("app/steuerberater/page.tsx", "utf8").includes('href="/checkout"'),
  "steuerberater overview has no checkout link",
);

function assertMusterPdf(label: string, pages: string[], buffer: Buffer, requireModules: boolean) {
  const count = pageCount(buffer);
  expect(pages.length === count, `${label} text streams ${pages.length} vs pages ${count}`);
  expect(count > 1, `${label} has more than one page`);
  pages.forEach((page, index) => {
    expect(page.includes(MUSTER_WATERMARK), `${label} page ${index + 1} has the watermark`);
  });
  expect(Boolean(pages[0]?.includes(MUSTER_COVER_LINE)), `${label} cover says ${MUSTER_COVER_LINE}`);
  expect(!pages[0]?.includes(KUNDE_COVER_LINE), `${label} cover is not the customer line`);
  const last = pages.at(-1) ?? "";
  expect(last.includes(PDF_UPSELL_HEADLINE), `${label} last page is the upsell`);
  expect(last.includes(PDF_UPSELL_PRICE), `${label} last page has the price line`);
  expect(
    last.indexOf(GELD_ZURUECK_MICRO) > last.indexOf(PDF_UPSELL_PRICE),
    `${label} guarantee sits under the price line`,
  );
  expect(last.includes(PDF_UPSELL_CTA), `${label} last page has the checkout link text`);
  expect(last.includes(PDF_UPSELL_DISCLAIMER), `${label} last page has the disclaimer`);
  expect(last.includes(PDF_UPSELL_FOOTNOTE), `${label} last page has the footnote`);
  expect(!pages[0]?.includes(PDF_UPSELL_HEADLINE), `${label} upsell is not the cover`);
  const text = joined(pages);
  expect(!text.includes(KUNDE_COVER_LINE), `${label} does not say it is a customer working copy`);
  if (requireModules) {
    for (const modul of MODULE) {
      expect(
        text.includes(modul.titel),
        `${label} still contains module ${modul.nr} ${modul.titel}`,
      );
    }
  }
}

function assertKundePdf(label: string, pages: string[], buffer: Buffer) {
  const count = pageCount(buffer);
  expect(pages.length === count, `${label} text streams ${pages.length} vs pages ${count}`);
  const text = joined(pages);
  expect(!text.includes(MUSTER_WATERMARK), `${label} has no watermark`);
  expect(!text.includes("MUSTER"), `${label} has no MUSTER marker`);
  expect(!text.includes(MUSTER_COVER_LINE), `${label} has no muster cover line`);
  expect(text.includes(KUNDE_COVER_LINE), `${label} keeps the customer cover line`);
  expect(!text.includes(PDF_UPSELL_HEADLINE), `${label} has no upsell headline`);
  expect(!text.includes(PDF_UPSELL_BODY.slice(0, 40)), `${label} has no upsell body`);
  expect(!text.includes(PDF_UPSELL_PRICE), `${label} has no upsell price`);
  expect(!text.includes(GELD_ZURUECK_MICRO), `${label} has no guarantee line`);
  expect(!text.includes(PDF_UPSELL_URL), `${label} has no checkout url`);
  expect(!text.includes(UPSELL_HEADLINE), `${label} has no web upsell headline`);
}

async function main() {
  const muster = getGesamtMuster("dienstleister");
  expect(Boolean(muster), "dienstleister muster exists");
  if (!muster) return;

  const generatedMuster = await generatePdf({
    answers: muster.answers,
    identity: muster.identity,
    documentId: muster.documentId,
    version: muster.version,
    versionMeta: muster.versionMeta,
    variant: "muster",
  });
  assertMusterPdf("Gesamt-Muster", pageTexts(generatedMuster.buffer), generatedMuster.buffer, true);

  const omitted = await generatePdf({
    answers: pixelwerkAnswers(),
    identity: {
      email: "kunde@example.com",
      company: "TEST Pixelwerk Webdesign Jana Probst",
      stripeSessionId: "cs_test_example",
      stripeCustomerId: "cus_example",
      stub: true,
    },
    documentId: "kunde-fixture",
    version: 1,
  });
  assertKundePdf("Kunden-PDF ohne Flag", pageTexts(omitted.buffer), omitted.buffer);

  const explicitKunde = await generatePdf({
    answers: pixelwerkAnswers(),
    identity: {
      email: "kunde@example.com",
      company: "TEST Pixelwerk Webdesign Jana Probst",
      stripeSessionId: "cs_test_example",
      stripeCustomerId: "cus_example",
      stub: true,
    },
    documentId: "kunde-fixture-explicit",
    version: 1,
    variant: "kunde",
  });
  assertKundePdf("Kunden-PDF variant kunde", pageTexts(explicitKunde.buffer), explicitKunde.buffer);

  const partner = await generatePdf({
    answers: PARTNER_MUSTER_ANSWERS,
    identity: PARTNER_MUSTER_IDENTITY,
    documentId: PARTNER_MUSTER_DOCUMENT_ID,
    version: 1,
    versionMeta: PARTNER_MUSTER_VERSION_META,
    variant: "muster",
  });
  assertMusterPdf("Steuerberater-Muster", pageTexts(partner.buffer), partner.buffer, false);

  const fragebogen = await generateMarkdownPdf({
    markdown: "# Muster-Fragebogen\n\nEine fiktive Frage.",
    company: "Nordlicht Beratung GmbH (Muster, fiktiv)",
    title: "Muster-Fragebogen",
    footer: "Muster · fiktiv · keine Steuerberatung",
    variant: "muster",
  });
  const fragePages = pageTexts(fragebogen);
  expect(fragePages.length === pageCount(fragebogen), "Fragebogen streams match pages");
  fragePages.forEach((page, index) => {
    expect(page.includes(MUSTER_WATERMARK), `Fragebogen page ${index + 1} has the watermark`);
  });
  expect(
    Boolean(fragePages.at(-1)?.includes(PDF_UPSELL_HEADLINE)),
    "Fragebogen last page is the upsell",
  );
  expect(
    Boolean(fragePages.at(-1)?.includes(GELD_ZURUECK_MICRO)),
    "Fragebogen last page has the guarantee",
  );
  expect(!joined(fragePages).includes(KUNDE_COVER_LINE), "Fragebogen is not a customer working copy");

  const plain = await generateMarkdownPdf({
    markdown: "# Intern\n\nKein Muster.",
    company: "Kunde GmbH",
    title: "Intern",
    footer: "Arbeitsfassung",
  });
  const plainText = joined(pageTexts(plain));
  expect(!plainText.includes(MUSTER_WATERMARK), "markdown default has no watermark");
  expect(!plainText.includes(PDF_UPSELL_HEADLINE), "markdown default has no upsell");
  expect(!plainText.includes(GELD_ZURUECK_MICRO), "markdown default has no guarantee line");

  const denied = await POST(
    new Request("http://localhost/api/delivery", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ answers: { gf: "Unberechtigt" } }),
    }),
  );
  expect(denied.status === 401, `/api/delivery without auth is 401 (got ${denied.status})`);
  const deniedBody = (await denied.json()) as { delivery?: unknown; error?: string };
  expect(!deniedBody.delivery, "unauthorised delivery response has no plan");

  const session = await POST(
    new Request("http://localhost/api/delivery", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: `${SESSION_COOKIE}=${createSessionToken("inhaber@example.com")}`,
      },
      body: "{}",
    }),
  );
  expect(session.status === 200, `gobd_session may read the plan (got ${session.status})`);

  const grant = await POST(
    new Request("http://localhost/api/delivery", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: `${CHECKOUT_GRANT_COOKIE}=${createCheckoutGrantToken({
          sessionId: "cs_test_example",
          email: "kauf@example.com",
        })}`,
      },
      body: "{}",
    }),
  );
  expect(grant.status === 200, `checkout grant may read the plan (got ${grant.status})`);

  if (failures.length) {
    for (const failure of failures) console.error(`FAIL ${failure}`);
    process.exit(1);
  }
  console.log("check-muster-mark: ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
