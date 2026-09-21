/**
 * Writes wrapped Magic-Link + Delivery preview HTML for visual review.
 * Usage: npx tsx scripts/preview-transactional-mail.ts [outdir]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { escapeAttr, wrapTransactionalHtml } from "@/lib/mail-layout";

const outDir = path.resolve(process.argv[2] || "/tmp/gobd-mail-preview");
mkdirSync(outDir, { recursive: true });

const magicLinkUrl = "https://www.gobd-doku-erstellen.de/auth/verify?token=preview";
const magicHtml = wrapTransactionalHtml(`
    <p>Hallo,</p>
    <p>hier ist dein Anmeldelink für GoBD Verfahrensdoku (20 Minuten gültig):</p>
    <p><a href="${escapeAttr(magicLinkUrl)}">Anmelden</a></p>
    <p>Wenn du das nicht angefordert hast, kannst du diese Mail ignorieren.</p>
  `);

const downloadUrl = "https://www.gobd-doku-erstellen.de/api/docs/preview/download";
const successUrl = "https://www.gobd-doku-erstellen.de/success?session_id=preview";
const deliveryMagic = "https://www.gobd-doku-erstellen.de/auth/verify?token=delivery-preview";
const deliveryHtml = wrapTransactionalHtml(`
    <p>Hallo Muster GmbH,</p>
    <p>dein Entwurf der Verfahrensdokumentation (Version 1) ist fertig.</p>
    <p><a href="${escapeAttr(downloadUrl)}">PDF herunterladen</a></p>
    <p><a href="${escapeAttr(successUrl)}">Zur Übersicht</a></p>
    <p><a href="${escapeAttr(deliveryMagic)}">Anmelden (Magic Link, 20 Minuten gültig)</a></p>
    <p>Fragen zu Ablauf, Lieferumfang, Updates und Rückgabe:<br /><a href="https://www.gobd-doku-erstellen.de/faq">https://www.gobd-doku-erstellen.de/faq</a></p>
    <p>Keine Steuerberatung. Das PDF ist ein Entwurf zur Abstimmung mit deinem Steuerberater.</p>
    <p>GoBD Verfahrensdoku</p>
  `);

const files = {
  "magic-link.html": magicHtml,
  "delivery.html": deliveryHtml,
};

for (const [name, html] of Object.entries(files)) {
  const file = path.join(outDir, name);
  writeFileSync(file, html, "utf8");
  console.log(file);
}

if (!magicHtml.includes("logo-lockup.png") || !magicHtml.includes("/faq")) {
  throw new Error("Magic-Link preview missing brand logo or FAQ footer");
}
if (deliveryHtml.includes('href="') && /href="[^"]*\/readiness/.test(deliveryHtml)) {
  throw new Error("Delivery preview must not link to /readiness");
}
if (!deliveryHtml.includes("Impressum") || !deliveryHtml.includes("Datenschutz")) {
  throw new Error("Delivery preview missing legal footer links");
}
