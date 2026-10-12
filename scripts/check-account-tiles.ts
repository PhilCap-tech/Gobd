/**
 * Subscribed accounts get „Hilfe & Wissen“ instead of „Kostenlos nutzen“.
 * Accounts without a subscription keep the free tile, including the readiness test.
 * Renders both tiles. Synthetic markup only — no Stripe call.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AccountResourcesCard } from "../components/account-free";

const LINKS = [
  ["/resources/10-offene-punkte", "10 offene Punkte"],
  ["/resources/inhalt-verfahrensdokumentation", "Inhalt einer Verfahrensdokumentation"],
  ["/blog", "Berichte / Bibliothek"],
  ["/faq", "FAQ"],
] as const;

function ok(cond: unknown, msg: string) {
  assert.ok(cond, msg);
  console.log("ok:", msg);
}

function markup(subscribed: boolean): string {
  return renderToStaticMarkup(createElement(AccountResourcesCard, { subscribed }));
}

function hasLink(html: string, href: string, label: string): boolean {
  return html.includes(`href="${href}"`) && html.includes(label);
}

const subscribed = markup(true);
const free = markup(false);

ok(subscribed.includes("Hilfe") && subscribed.includes("Wissen"), "Abo: Kachel Hilfe & Wissen");
ok(!subscribed.includes("Kostenlos nutzen"), "Abo: keine Kachel Kostenlos nutzen");
ok(!subscribed.includes("Test kostenlos machen"), "Abo: kein Button Test kostenlos machen");
ok(!subscribed.includes('href="/readiness"'), "Abo: kein Link zum kostenlosen Test");
for (const [href, label] of LINKS) {
  ok(hasLink(subscribed, href, label), `Abo: Link ${label}`);
}

ok(free.includes("Kostenlos nutzen"), "ohne Abo: Kachel Kostenlos nutzen");
ok(free.includes("Test kostenlos machen"), "ohne Abo: Button Test kostenlos machen");
ok(free.includes('href="/readiness"'), "ohne Abo: Test führt nach /readiness");
ok(!free.includes("help-heading"), "ohne Abo: keine Hilfe-Kachel");
for (const [href, label] of LINKS) {
  ok(hasLink(free, href, label), `ohne Abo: Link ${label} bleibt`);
}

const page = readFileSync("app/account/page.tsx", "utf8");
ok(
  page.includes("<AccountResourcesCard subscribed={stripeBound} />"),
  "Konto schaltet die Kachel über die bestehende Abo-Bindung",
);
ok(!page.includes("<AccountFreeCard"), "Konto rendert die freie Kachel nicht fest");

console.log("check-account-tiles: green");
