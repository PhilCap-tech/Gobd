/**
 * /cookies: rendert die echte Seite (app/cookies/page.tsx -> lib/legal-content -> LegalMarkdown),
 * nicht nur das Markdown. PRICING_MODEL=v3, Flag AMPEL_NO_EMAIL_ENABLED aus und an.
 * Jeder Fall läuft in einem eigenen Prozess, weil cookiesMarkdown beim Laden des Moduls feststeht.
 * Usage: npx tsx scripts/check-cookies-render.tsx
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

const CHILD = "__COOKIES_RENDER_CHILD";

async function child() {
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { default: CookiesPage } = await import("@/app/cookies/page");
  const { default: DatenschutzPage } = await import("@/app/datenschutz/page");
  const html = renderToStaticMarkup(CookiesPage());
  const privacy = renderToStaticMarkup(DatenschutzPage());
  process.stdout.write(JSON.stringify({ html, privacy }));
}

function render(env: Record<string, string>): { html: string; privacy: string } {
  const out = execFileSync(process.execPath, [...process.execArgv, __filename], {
    env: { ...process.env, ...env, [CHILD]: "1" },
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  return JSON.parse(out.slice(out.indexOf('{"html"'))) as { html: string; privacy: string };
}

function main() {
  const base = { PRICING_MODEL: "v3" };
  const off = render({ ...base, AMPEL_NO_EMAIL_ENABLED: "" });
  const on = render({ ...base, AMPEL_NO_EMAIL_ENABLED: "true" });
  for (const [name, page] of [["off", off], ["on", on]] as const) {
    const { html, privacy } = page;
    assert.ok(html.includes("gobd_consent") && html.includes("gobd_checkout"), `${name}: v3-Cookie-Tabelle gerendert`);
    assert.ok(!html.includes("if:ampel") && !html.includes("endif") && !html.includes("&lt;!--"), `${name}: keine Marker sichtbar`);
    assert.ok((html.match(/<table/g) ?? []).length >= 1, `${name}: Tabelle`);
    assert.ok(
      html.includes('<a href="/datenschutz#messung">Abschnitt 6</a>'),
      `${name}: Abschnitt 6 verlinkt den Anker`,
    );
    assert.ok(
      html.includes("Einzelheiten stehen in der Datenschutzerklärung, <a href=\"/datenschutz#messung\">Abschnitt 6</a>."),
      `${name}: der Satz bleibt, nur der Link kommt dazu`,
    );
    assert.ok(
      privacy.includes('<h2 id="messung">6. Reichweitenmessung und eigene Nutzungsstatistik</h2>'),
      `${name}: die Überschrift von § 6 trägt die id`,
    );
  }
  assert.ok(off.html.includes("gobd_ampel_shown:&lt;Antworten&gt;") || off.html.includes("gobd_ampel_shown:<Antworten>"), "Flag aus: Zeile gobd_ampel_shown sichtbar");
  assert.ok(/<tr>(?:(?!<\/tr>)[^])*gobd_ampel_shown(?:(?!<\/tr>)[^])*<\/tr>/.test(off.html), "Flag aus: Zeile ist eine Tabellenzeile");
  assert.ok(!on.html.includes("gobd_ampel_shown"), "Flag an: Zeile entfällt");
  const rows = (html: string) => (html.match(/<tr>/g) ?? []).length;
  assert.equal(rows(off.html), rows(on.html) + 1, "Flag an: genau eine Zeile weniger, Tabelle sonst gleich");
  console.log(`check-cookies-render: ok (v3, Zeilen aus=${rows(off.html)} an=${rows(on.html)})`);
}

if (process.env[CHILD]) {
  void child().catch((error) => {
    console.error(error);
    process.exit(1);
  });
} else {
  main();
}
