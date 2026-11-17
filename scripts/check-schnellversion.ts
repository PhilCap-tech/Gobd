/**
 * Schnellversion: Vorlagenwahl, Deckblatt-Hinweis, Zuteilung ohne Einwilligung,
 * Ereignisse ohne Personenbezogene Daten, Abbruchschwellen ohne Automatik.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { effectiveModulStatus } from "../lib/module/status";
import { pageTexts } from "./pdf-text";
import { decideSvArm } from "../lib/schnellversion-assign";
import { openCredit, reserveDecision } from "../lib/schnellversion-credit";
import { SV_BASIS_SATZ } from "../lib/schnellversion-neutral";
import { reminderDue, reminderMail, runSchnellversionReminder } from "../lib/schnellversion-reminder";
import { creditStillOpen, downloadStillOpen, reserveSvCredit, type SvPurchase } from "../lib/schnellversion-record";
import { schnellversionCheckoutMetadata } from "../lib/schnellversion-checkout";
import {
  buildStandardAnswers,
  vorlageForBranche,
  type SchnellversionAnswers,
} from "../lib/schnellversion-answers";
import { schnellversionCheckoutPlan, schnellversion49Enabled } from "../lib/schnellversion-flag";
import { svDownloadStillOpen, SV_COVER_TITLE } from "../lib/schnellversion-copy";
import { clientEventAllowed, evaluateSvEvents, parseSvEvent, type SvEventRow } from "../lib/schnellversion-events";
import { confirmPaidSession, openSchnellversionCheckout } from "../lib/schnellversion-payment";
import { draftFromSchnellversion } from "../lib/schnellversion-draft";
import { POST as kontoPost } from "../app/api/schnellversion/konto/route";
import { POST as pdfPost } from "../app/api/schnellversion/pdf/route";
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
    consentAt: now.toISOString(),
    sessionId: "stub_sv_paid_p1",
    creditReservedAt: "",
    creditReservationId: "",
    answersJson: "{}",
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
  ok(!text.includes("Angabe im Intake"), "kein Angabe im Intake");
  ok(!text.includes("Musterbetrieb"), "kein Musterbetrieb");
  ok(!text.includes("(fiktiv)"), "keine fiktiven Produktnamen");
  ok(!text.includes("bestätigt, ohne nähere Angabe"), "kein bestätigt ohne Angabe");
  ok(!text.includes("Diese Fassung gilt ab"), "keine Geltungsformel");
  ok(!text.includes(".07.2026"), "kein abgeschnittenes Geltungsdatum");
  ok(!text.includes("ältere Fassungen bleiben"), "keine Versionszeile");
  const selfPdf = await generateStandardPdf(
    sample({ bucht: "Wir selbst im Unternehmen", software: "Sonstiges", softwareFrei: "Buchhalter Pro", kasse: "Nein, keine Bargeldeinnahmen" }),
    new Date("2026-11-17T10:00:00Z"),
  );
  const selfText = pageTexts(selfPdf).join("\n");
  ok(!selfText.includes("FiBu der Kanzlei"), "Eigenbuchhaltung ohne Kanzlei-FiBu");
  ok(selfText.includes("Buchhalter Pro"), "Programm aus der Antwort");
  ok(fullText.includes("Angabe im Intake") || fullText.includes("(fiktiv)"), "Vollversion behält Vorlagentext");

  ok(!clientEventAllowed("purchase_99") && !clientEventAllowed("sv_purchase"), "Umsatz nicht vom Browser");
  ok(clientEventAllowed("sv_visit"), "Aufruf ohne Einwilligung ist erlaubt");
  const savedStub = process.env.SCHNELLVERSION_49_STRIPE_STUB;
  process.env.SCHNELLVERSION_49_ENABLED = "1";
  process.env.STRIPE_PRICE_SCHNELL_49 = "price_test_schnell";
  process.env.SCHNELLVERSION_49_STRIPE_STUB = "unpaid";
  const unpaid = await openSchnellversionCheckout({
    answers: sample(),
    unternehmer: true,
    bewusst: true,
    email: "inhaber@example.com",
  });
  ok(unpaid.ok && unpaid.sessionId.includes("unpaid"), "unbezahlte Stub-Session");
  ok((await confirmPaidSession(unpaid.ok ? unpaid.sessionId : "")).paid === false, "unbezahlt erzeugt kein PDF");
  process.env.SCHNELLVERSION_49_STRIPE_STUB = "paid";
  const paidOpen = await openSchnellversionCheckout({
    answers: sample(),
    unternehmer: false,
    bewusst: true,
    email: "inhaber@example.com",
  });
  ok(!paidOpen.ok, "Zustimmung fehlt serverseitig");
  const paid = await openSchnellversionCheckout({
    answers: sample(),
    unternehmer: true,
    bewusst: true,
    email: "inhaber@example.com",
  });
  ok(paid.ok, "bezahlte Stub-Session");
  const confirmed = await confirmPaidSession(paid.ok ? paid.sessionId : "");
  ok(confirmed.paid && confirmed.purchase.consentAt.length > 0, "Zustimmung am Kauf gespeichert");
  const meta = schnellversionCheckoutMetadata({
    pendingId: "p",
    consentAt: confirmed.paid ? confirmed.purchase.consentAt : "",
    company: "Malerbetrieb Adler",
  });
  ok(meta.sv49 === "1" && meta.sv_consent_at === (confirmed.paid ? confirmed.purchase.consentAt : ""), "Zustimmung in den Stripe-Metadaten");
  const purchaseId = confirmed.paid ? confirmed.purchase.id : "";
  const reserveNow = new Date();
  ok(await reserveSvCredit(purchaseId, "eins", reserveNow), "Reservierung am Kauf");
  ok(!(await reserveSvCredit(purchaseId, "zwei", reserveNow)), "zweite Reservierung am selben Kauf");
  const draft = draftFromSchnellversion("inhaber@example.com", sample());
  ok(draft.answers.katalog?.A01?.values?.company === "Malerbetrieb Adler", "Firma im Fragebogen");
  ok(draft.answers.mitarbeitende === "2–5", "Mitarbeitende im Fragebogen");
  ok(draft.answers.fibu?.[0] === "DATEV", "FiBu im Fragebogen");
  ok(draft.answers.module?.vorlage === "handwerk", "Branche als Vorlage im Fragebogen");
  ok(draft.answers.module?.check?.bargeld === "ja", "Kasse im Betriebs-Check");
  ok(draft.answers.module?.stammdaten?.fibu === "DATEV", "FiBu-Programm im Betriebs-Check");
  const held = reserveDecision(confirmed.paid ? confirmed.purchase : purchase(), "eins", reserveNow);
  ok(held, "erste Coupon-Reservierung");
  ok(reserveDecision(held!, "zwei", reserveNow) === null, "zweite Reservierung blockiert");
  ok((await confirmPaidSession("")).paid === false, "ohne Session kein Kauf");
  ok((await confirmPaidSession(unpaid.ok ? unpaid.sessionId : "stub_sv_unpaid_x")).paid === false, "unbezahlte Session ergibt kein PDF");
  ok((await confirmPaidSession("cs_test_unpaid")).paid === false, "fremde Session ohne paid ergibt kein PDF");
  const hook = readFileSync("app/api/stripe/webhook/route.ts", "utf8");
  ok(hook.includes('metadata?.sv49 === "1"') && hook.includes("paymentFromStatus"), "Webhook nur bei bezahlter Schnellversion");
  ok(!text.includes("Shopify"), "kein fiktiver Shopname");
  ok((await pdfPost()).status === 405, "PDF-POST legt nichts an");
  ok((await kontoPost()).status === 405, "Konto-API legt keinen Kauf an");
  ok(readFileSync("lib/schnellversion-copy.ts", "utf8").includes("Sie bestellen als Unternehmer"), "Checkbox in Sie-Form");
  ok(!readFileSync("app/api/schnellversion/pdf/route.ts", "utf8").includes("SV_ARM_COOKIE"), "PDF-Route liest das Zuteilungs-Cookie nicht");
  ok(!readFileSync("app/schnellversion/danke/page.tsx", "utf8").includes("gekauftAm"), "Danke-Seite legt keinen Kauf an");
  ok(!readFileSync("components/schnellversion-danke.tsx", "utf8").includes("gekauftAm"), "Browser legt keinen Kauf an");
  process.env.SCHNELLVERSION_49_STRIPE_STUB = savedStub;

  const page = readFileSync("app/page.tsx", "utf8");
  ok(page.includes("SCHNELLVERSION ?"), "Startseite blendet den Button nur mit Flag ein");
  ok(!readFileSync("content/legal/agb.md", "utf8").includes("Schnellversion 49"), "AGB unverändert von diesem Begriff");

  console.log("check-schnellversion: ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
