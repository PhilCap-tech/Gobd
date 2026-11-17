/**
 * Schnellversion: Vorlagenwahl, Deckblatt-Hinweis, Zuteilung ohne Einwilligung,
 * Ereignisse ohne Personenbezogene Daten, Abbruchschwellen ohne Automatik.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { effectiveModulStatus } from "../lib/module/status";
import { pageTexts } from "./pdf-text";
import { decideSvArm } from "../lib/schnellversion-assign";
import { openCredit } from "../lib/schnellversion-credit";
import { SV_BASIS_SATZ } from "../lib/schnellversion-neutral";
import { reminderDue, reminderMail, runSchnellversionReminder } from "../lib/schnellversion-reminder";
import { creditStillOpen, downloadStillOpen, type SvPurchase } from "../lib/schnellversion-record";
import {
  buildStandardAnswers,
  vorlageForBranche,
  type SchnellversionAnswers,
} from "../lib/schnellversion-answers";
import { schnellversionCheckoutPlan, schnellversion49Enabled } from "../lib/schnellversion-flag";
import { svDownloadStillOpen, SV_COVER_TITLE } from "../lib/schnellversion-copy";
import { evaluateSvEvents, parseSvEvent, type SvEventRow } from "../lib/schnellversion-events";
import { generatePdf } from "../lib/delivery";
import { getGesamtMuster } from "../lib/module-muster";
import { generateStandardPdf } from "../lib/schnellversion-pdf";

function ok(cond: unknown, msg: string) {
  assert.ok(cond, msg);
  console.log("ok:", msg);
}

const sample = (patch: Partial<SchnellversionAnswers> = {}): SchnellversionAnswers => ({
  firma: "Malerbetrieb Adler",
  rechtsform: "GmbH",
  branche: "handwerk",
  mitarbeitende: "2–5",
  software: "DATEV",
  softwareFrei: "",
  kasse: "Unsicher",
  bucht: "Unsere Steuerkanzlei",
  ...patch,
});

ok(!schnellversion49Enabled({}), "flag default aus");
ok(schnellversion49Enabled({ SCHNELLVERSION_49_ENABLED: "true" }), "flag true");
ok(!schnellversion49Enabled({ SCHNELLVERSION_49_ENABLED: "ja" }), "nur true oder 1");

ok(vorlageForBranche("handwerk") === "handwerk", "Handwerk → handwerk");
ok(vorlageForBranche("handel") === "handel", "Handel → handel");
ok(vorlageForBranche("ecommerce") === "ecommerce", "Onlinehandel → ecommerce");
ok(vorlageForBranche("gastro") === "gastro", "Gastronomie → gastro");
ok(vorlageForBranche("dienstleistung") === "dienstleister", "Dienstleistung → dienstleister");
ok(vorlageForBranche("freiberuf") === "dienstleister", "Freiberuf → dienstleister");
ok(vorlageForBranche("sonstiges") === "dienstleister", "Sonstiges → dienstleister");

const unsicher = buildStandardAnswers(sample());
ok(effectiveModulStatus(unsicher.answers, "m08").status === "tool", "Kasse Unsicher behält das Kapitel");
const ohne = buildStandardAnswers(sample({ kasse: "Nein, keine Bargeldeinnahmen" }));
ok(effectiveModulStatus(ohne.answers, "m08").status === "nicht_vorhanden", "ohne Kasse kein Kassenkapitel");

ok(decideSvArm({ marketing: false, existing: null, roll: 0.1 }) === null, "ohne Einwilligung kein Arm");
ok(decideSvArm({ marketing: false, existing: "test", roll: 0.1 }) === null, "Widerruf verwirft den Arm");
ok(decideSvArm({ marketing: true, existing: null, roll: 0.1 }) === "control", "unter 0,5 Kontrolle");
ok(decideSvArm({ marketing: true, existing: null, roll: 0.8 }) === "test", "ab 0,5 Test");
ok(decideSvArm({ marketing: true, existing: "test", roll: 0.1 }) === "test", "bestehender Arm bleibt");

const browser = readFileSync("components/schnellversion-browser.ts", "utf8");
const syncAt = browser.indexOf("export function syncSvArm");
const syncBody = browser.slice(syncAt, browser.indexOf("export function onConsentChange"));
ok(syncBody.indexOf("hasMarketingConsent") < syncBody.indexOf("writeArmCookie"), "Cookie erst nach der Einwilligungsfrage");
ok(!browser.includes("gclid"), "kein gclid im Browser-Helfer");

ok(parseSvEvent({ name: "sv_purchase", arm: "test", variante: "b", value: 49, email: "a@b.de" }) === null, "E-Mail wird verworfen");
ok(parseSvEvent({ name: "sv_click", arm: "test", variante: "b", gclid: "x" }) === null, "gclid wird verworfen");
ok(parseSvEvent({ name: "sv_purchase", arm: "test", variante: "b", value: 49 })?.value === 49, "erlaubtes Ereignis");

function views(arm: "control" | "test", n: number, valueName: SvEventRow["name"], value: number, count: number): SvEventRow[] {
  const rows: SvEventRow[] = [];
  for (let i = 0; i < n; i += 1) {
    rows.push({ name: "sv_home_view", arm, variante: "b", branche_vorlage: "", value: 0, step: 0, ziel: "" });
  }
  for (let i = 0; i < count; i += 1) {
    rows.push({ name: valueName, arm, variante: "b", branche_vorlage: "", value, step: 0, ziel: "" });
  }
  return rows;
}

const below = evaluateSvEvents([
  ...views("control", 1000, "purchase_99", 99, 40),
  ...views("test", 1000, "purchase_99", 99, 20),
]);
ok(below.minReached, "Mindestmenge erkannt");
ok(below.rpvAbort, "RPV mehr als 15 % darunter");
ok(below.schaltetAb === false, "keine Abschaltung");

const convOnly = evaluateSvEvents([
  ...views("control", 1000, "purchase_99", 99, 40),
  ...views("test", 1000, "purchase_99", 99, 20),
  ...views("test", 0, "sv_purchase", 49, 29),
]);
ok(!convOnly.rpvAbort, "Rückgang unter 15 % ist kein RPV-Abbruch");
ok(convOnly.conv99Abort, "99-€-Quote mehr als 25 % darunter, ohne dass der Umsatz je Aufruf steigt");

const now = new Date("2026-11-17T12:00:00Z");
ok(svDownloadStillOpen(now.toISOString(), now), "Download am Kauftag");
ok(!svDownloadStillOpen(new Date(now.getTime() - 31 * 24 * 60 * 60 * 1000).toISOString(), now), "nach 30 Tagen zu");

function purchase(patch: Partial<SvPurchase> = {}): SvPurchase {
  return {
    id: "p1",
    email: "inhaber@example.com",
    company: "Malerbetrieb Adler",
    purchasedAt: now.toISOString(),
    documentId: "p1",
    pdfPath: "",
    creditUsedAt: "",
    ...patch,
  };
}
const fresh = purchase();
ok(downloadStillOpen(fresh, now), "Konto-Download am Kauftag");
ok(!downloadStillOpen(purchase({ purchasedAt: new Date(now.getTime() - 31 * 24 * 60 * 60 * 1000).toISOString() }), now), "Konto-Download nach 30 Tagen zu");
ok(creditStillOpen(fresh, "Malerbetrieb Adler", now), "Anrechnung für dieselbe Firma");
ok(!creditStillOpen(fresh, "Andere Firma GmbH", now), "Anrechnung nicht für eine andere Firma");
ok(!creditStillOpen(purchase({ creditUsedAt: now.toISOString() }), "Malerbetrieb Adler", now), "Anrechnung nur einmal");
ok(openCredit([fresh], "Malerbetrieb Adler", now)?.id === "p1", "offene Anrechnung wird gefunden");
ok(reminderDue(now.toISOString(), new Date(now.getTime() + 24 * 24 * 60 * 60 * 1000)), "Erinnerung 7 Tage vor Ende");
ok(!reminderDue(now.toISOString(), now), "Erinnerung nicht am Kauftag");
const mail = reminderMail({ company: "Malerbetrieb Adler", purchasedAt: now.toISOString() });
ok(mail.text.includes("Sie") && !/Minute|fertig|garantiert|Garantie|rechtssicher/i.test(mail.text), "Erinnerung formell und ohne Sperrwörter");

ok(schnellversionCheckoutPlan({}) === "refuse", "ohne Flag kein Checkout");
ok(
  schnellversionCheckoutPlan({ SCHNELLVERSION_49_ENABLED: "1", STRIPE_SECRET_KEY: "sk_live_x" }) === "refuse",
  "ohne Price-ID kein Checkout",
);
ok(
  schnellversionCheckoutPlan({
    SCHNELLVERSION_49_ENABLED: "1",
    STRIPE_PRICE_SCHNELL_49: "price_test_schnell",
    STRIPE_SECRET_KEY: "sk_live_x",
  }) === "refuse",
  "Live-Key legt keine Session an",
);
ok(
  schnellversionCheckoutPlan({
    SCHNELLVERSION_49_ENABLED: "1",
    STRIPE_PRICE_SCHNELL_49: "price_test_schnell",
    SCHNELLVERSION_49_STRIPE_STUB: "1",
    STRIPE_SECRET_KEY: "sk_test_x",
  }) === "stub",
  "Stub ruft Stripe nicht",
);

async function main() {
  let sent = 0;
  const quiet = await runSchnellversionReminder(
    [purchase()],
    new Date(now.getTime() + 24 * 24 * 60 * 60 * 1000),
    async () => {
      sent += 1;
    },
    {},
  );
  ok(quiet.sending === false && sent === 0, "Erinnerung ohne Schalter versendet nichts");
  const loud = await runSchnellversionReminder(
    [purchase()],
    new Date(now.getTime() + 24 * 24 * 60 * 60 * 1000),
    async () => {
      sent += 1;
    },
    { SCHNELLVERSION_49_REMINDER_SEND: "1" },
  );
  ok(loud.sending && loud.sent === 1 && sent === 1, "Erinnerung mit Schalter nutzt nur den Mock");
  const pdf = await generateStandardPdf(sample(), new Date("2026-11-17T10:00:00Z"));
  const text = pageTexts(pdf).join("\n");
  ok(text.includes(SV_COVER_TITLE), "Deckblatt nennt Standardfassung, bitte prüfen");
  ok(text.includes(SV_BASIS_SATZ), "Standardfassung nennt Branche und Größe");
  ok(!text.includes("Kunden-Intake"), "Standardfassung ohne Kunden-Intake");
  ok(!text.includes("bestätigten Angaben"), "Standardfassung ohne bestätigte Angaben");
  ok(!text.includes("01.07.2026"), "Standardfassung ohne festes Geltungsdatum");
  const muster = getGesamtMuster("handwerk");
  ok(muster, "Handwerk-Vorlage liegt");
  const full = await generatePdf({
    answers: muster!.answers,
    identity: muster!.identity,
    documentId: "vollversion-handwerk",
    version: 1,
    versionMeta: muster!.versionMeta,
  });
  const fullText = pageTexts(full.buffer).join("\n");
  ok(fullText.includes("Kunden-Intake"), "Vollversion behält Kunden-Intake");
  ok(fullText.includes("01.07.2026"), "Vollversion behält das Geltungsdatum");
  ok(text.includes("Malerbetrieb Adler"), "Firmenname auf dem PDF");
  ok(text.includes("Mitarbeitende: 2–5"), "Mitarbeitendenzahl aus den 6 Angaben");
  ok(text.includes("Handwerk / Bau"), "Branche aus den 6 Angaben");
  ok(!text.includes("Bauwerk Nord"), "Musterfirma steht nicht im PDF");
  ok(text.includes("Was Sie in der Standardfassung prüfen sollten"), "Prüfhinweise im PDF");
  ok(text.includes("Prüfhinweis aufgenommen"), "Kasse Unsicher im PDF");
  ok(!text.includes("Anhang A — Offene Punkte"), "keine Liste offener Punkte aus eigenen Antworten");

  const page = readFileSync("app/page.tsx", "utf8");
  ok(page.includes("SCHNELLVERSION ?"), "Startseite blendet den Button nur mit Flag ein");
  ok(!readFileSync("content/legal/agb.md", "utf8").includes("Schnellversion 49"), "AGB unverändert von diesem Begriff");

  console.log("check-schnellversion: ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
