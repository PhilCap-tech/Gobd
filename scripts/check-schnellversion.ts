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
import { claimSvSession, creditStillOpen, downloadStillOpen, failSvCommitStepForTest, findSvPurchaseBySession, listAllSvPurchases, purchaseIdForSession, reserveSvCredit, svDownloadAllowed, type SvCommitStep, type SvPurchase } from "../lib/schnellversion-record";
import { schnellversionCheckoutMetadata } from "../lib/schnellversion-checkout";
import {
  buildStandardAnswers,
  kasseCheckAntwort,
  softwareProse,
  statedFibu,
  SV_BRANCHEN,
  SV_BUCHT,
  SV_KASSE,
  SV_SOFTWARE,
  vorlageForBranche,
  type SchnellversionAnswers,
} from "../lib/schnellversion-answers";
import { schnellversionCheckoutPlan, schnellversion49Enabled, schnellversionOffered, schnellversionStubBlocked } from "../lib/schnellversion-flag";
import { svDownloadStillOpen, SV_COVER_TITLE } from "../lib/schnellversion-copy";
import { clientEventAllowed, evaluateSvEvents, parseSvEvent, type SvEventRow } from "../lib/schnellversion-events";
import { BRANCHEN_FREMDE, pflichtBausteine, repeatedSentences, standardFall } from "../lib/schnellversion-bausteine";
import { confirmPaidSession, failNextClaimedPurchaseForTest, openSchnellversionCheckout, paidFromStoredSession } from "../lib/schnellversion-payment";
import { draftFromSchnellversion, mergeEmptyDraftFields } from "../lib/schnellversion-draft";
import { standardPlainText } from "../lib/schnellversion-pdf";
import { failSvPurchaseSinkForTest, readSvEvents, rememberPurchase99Once } from "../lib/schnellversion-store";
import { POST as kontoPost } from "../app/api/schnellversion/konto/route";
import { POST as pdfPost } from "../app/api/schnellversion/pdf/route";
import { generatePdf } from "../lib/delivery";
import { getGesamtMuster } from "../lib/module-muster";
import { generateStandardPdf } from "../lib/schnellversion-pdf";

function ok(cond: unknown, msg: string) {
  assert.ok(cond, msg);
  console.log("ok:", msg);
}

function coverField(text: string, label: string): string {
  const match = text.match(new RegExp(`\\| ${label} \\| ([^\\n|]+)`));
  return (match?.[1] ?? "").replace(/\s+/g, " ").trim();
}

function befundTreffer(plain: string, fall: ReturnType<typeof standardFall>): string[] {
  const hits: string[] = [];
  const always = [
    "Schnittstellen: Schnittstellen:",
    "Buchhaltung laut Betrieb-Export",
    "per Buchhaltung laut Betrieb Upload",
    "Bank an Buchhaltung laut Betrieb",
    "Lohn an Buchhaltung laut Betrieb",
    "in den Aufzeichnungen automatisch",
    "Lohnabrechnung der Buchhaltung",
    "im DMS bzw. die von der Kanzlei",
    ". die von der Kanzlei",
    "Original die von der Kanzlei",
    "in die von der Kanzlei eingesetzte Software",
    "in Excel-Listen bzw. manuelle Aufzeichnungen",
    "täglich über Excel",
    "täglich über DATEV",
    "sevdesk Lohn",
    "lexoffice Lohn",
    "Lexware Lohn",
    "Buchhalter Pro Lohn",
    "Excel-Listen bzw. manuelle Aufzeichnungen Lohn",
    "die von der Kanzlei eingesetzte Software Lohn",
  ];
  for (const item of always) if (plain.includes(item)) hits.push(item);
  if (!fall.datev && plain.includes("DATEV")) hits.push("DATEV");
  if (!(fall.datev && !fall.self) && plain.includes("LODAS")) hits.push("LODAS");
  if (!(fall.datev && !fall.self) && plain.includes("Lohn und Gehalt")) hits.push("Lohn und Gehalt");
  if (fall.self && /Kanzlei|Steuerkanzlei/.test(plain)) hits.push("Kanzlei");
  if (fall.excel && /SEPA|MT940|Hosting Anbieter-Cloud|Eigene Rolle in |PDF-Export in Excel|Upload in Excel|Export\/Upload|Zahlungsvorschlag aus den offenen Posten/.test(plain)) {
    hits.push("Excel-Schnittstelle");
  }
  return hits;
}

function countText(text: string, needle: string): number {
  if (!needle) return 0;
  let count = 0;
  let from = 0;
  while (from <= text.length) {
    const at = text.indexOf(needle, from);
    if (at < 0) return count;
    count += 1;
    from = at + needle.length;
  }
  return count;
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
    downloadTokenHash: "",
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
  ok(text.includes("Diese Punkte sollten Sie für Ihren Betrieb ergänzen"), "Prüfhinweise im PDF");
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
  const stubUnpaid = {
    SCHNELLVERSION_49_ENABLED: "1",
    STRIPE_PRICE_SCHNELL_49: "price_test_schnell",
    SCHNELLVERSION_49_STRIPE_STUB: "unpaid",
  };
  const stubPaid = { ...stubUnpaid, SCHNELLVERSION_49_STRIPE_STUB: "paid" };
  const unpaid = await openSchnellversionCheckout({
    answers: sample(),
    unternehmer: true,
    bewusst: true,
    email: "inhaber@example.com",
    env: stubUnpaid,
  });
  ok(unpaid.ok && unpaid.sessionId.includes("unpaid"), "unbezahlte Stub-Session");
  ok((await confirmPaidSession(unpaid.ok ? unpaid.sessionId : "")).paid === false, "unbezahlt erzeugt kein PDF");
  ok((await findSvPurchaseBySession(unpaid.ok ? unpaid.sessionId : "stub_sv_unpaid_x")) === null, "unbezahlt speichert keinen Kauf");
  const paidOpen = await openSchnellversionCheckout({
    answers: sample(),
    unternehmer: false,
    bewusst: true,
    email: "inhaber@example.com",
    env: stubPaid,
  });
  ok(!paidOpen.ok, "Zustimmung fehlt serverseitig");
  const flipped = unpaid.ok ? unpaid.sessionId.replace("stub_sv_unpaid_", "stub_sv_paid_") : "stub_sv_paid_fremd";
  ok((await confirmPaidSession(flipped, { env: stubUnpaid })).paid === false, "umgeschriebene Session bleibt unbezahlt");
  ok(paidFromStoredSession({
    requestedId: flipped,
    storedId: unpaid.ok ? unpaid.sessionId : "",
    storedPaid: false,
    env: { ...stubUnpaid, VERCEL: "1" },
  }) === false, "Präfix ist auf Vercel kein Beweis");
  ok(schnellversionStubBlocked({ VERCEL: "1", SCHNELLVERSION_49_STRIPE_STUB: "paid" }), "Stub auf Vercel gesperrt");
  ok(schnellversionStubBlocked({ NODE_ENV: "production", SCHNELLVERSION_49_STRIPE_STUB: "paid" }), "Stub in Produktion gesperrt");
  ok(schnellversionCheckoutPlan({
    SCHNELLVERSION_49_ENABLED: "1",
    STRIPE_PRICE_SCHNELL_49: "price_test_schnell",
    SCHNELLVERSION_49_STRIPE_STUB: "paid",
    VERCEL: "1",
  }) !== "stub", "Vercel legt keine Stub-Session an");
  const paid = await openSchnellversionCheckout({
    answers: sample(),
    unternehmer: true,
    bewusst: true,
    email: "inhaber@example.com",
    arm: "test",
    env: stubPaid,
  });
  ok(paid.ok, "bezahlte Stub-Session");
  const beforePurchases = (await readSvEvents()).filter((row) => row.name === "sv_purchase" && row.value === 49).length;
  const confirmed = await confirmPaidSession(paid.ok ? paid.sessionId : "", { env: stubPaid });
  ok((await confirmPaidSession(paid.ok ? paid.sessionId : "", { env: stubPaid })).paid === confirmed.paid, "zweite Bestätigung");
  const afterPurchases = (await readSvEvents()).filter((row) => row.name === "sv_purchase" && row.value === 49).length;
  ok(afterPurchases === beforePurchases + 1, "49-€-Kauf wird einmal gezählt");
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
  ok(draft.answers.module?.check?.bargeld === "unbekannt", "Kasse Unsicher bleibt offen");
  ok(draft.answers.module?.stammdaten?.fibu === "DATEV", "FiBu-Programm im Betriebs-Check");
  const held = reserveDecision(confirmed.paid ? confirmed.purchase : purchase(), "eins", reserveNow);
  ok(held, "erste Coupon-Reservierung");
  ok(reserveDecision(held!, "zwei", reserveNow) === null, "zweite Reservierung blockiert");
  ok((await confirmPaidSession("")).paid === false, "ohne Session kein Kauf");
  ok((await confirmPaidSession(unpaid.ok ? unpaid.sessionId : "stub_sv_unpaid_x", { env: stubUnpaid })).paid === false, "unbezahlte Session ergibt kein PDF");
  ok((await confirmPaidSession("cs_test_unpaid")).paid === false, "fremde Session ohne paid ergibt kein PDF");
  const hook = readFileSync("app/api/stripe/webhook/route.ts", "utf8");
  ok(hook.includes('metadata?.sv49 === "1"') && hook.includes("paymentFromStatus"), "Webhook nur bei bezahlter Schnellversion");
  ok(!text.includes("Shopify"), "kein fiktiver Shopname");
  const savedModel = process.env.PRICING_MODEL;
  const savedFlag = process.env.SCHNELLVERSION_49_ENABLED;
  process.env.PRICING_MODEL = "v2";
  process.env.SCHNELLVERSION_49_ENABLED = "1";
  ok((await pdfPost()).status === 405, "PDF-POST legt nichts an");
  ok((await kontoPost()).status === 405, "Konto-API legt keinen Kauf an");
  process.env.PRICING_MODEL = "legacy";
  ok((await pdfPost()).status === 404, "Legacy mit Flag: PDF-Route 404");
  ok((await kontoPost()).status === 404, "Legacy mit Flag: Konto-Route 404");
  process.env.SCHNELLVERSION_49_ENABLED = "";
  ok((await kontoPost()).status === 404, "Flag aus: Konto-Route 404");
  if (savedModel === undefined) delete process.env.PRICING_MODEL;
  else process.env.PRICING_MODEL = savedModel;
  if (savedFlag === undefined) delete process.env.SCHNELLVERSION_49_ENABLED;
  else process.env.SCHNELLVERSION_49_ENABLED = savedFlag;
  ok(!schnellversionOffered({ SCHNELLVERSION_49_ENABLED: "1", PRICING_MODEL: "legacy" }), "Legacy bietet die Schnellversion nicht an");
  ok(schnellversionOffered({ SCHNELLVERSION_49_ENABLED: "1", PRICING_MODEL: "v3" }), "v3 bietet die Schnellversion an");
  ok(readFileSync("app/account/schnellversion/page.tsx", "utf8").includes("if (!schnellversionOffered()) notFound()"), "Konto-Seite ohne Angebot 404");
  ok(readFileSync("lib/schnellversion-gate.ts", "utf8").includes("schnellversionOffered()"), "Seiten prüfen das Preismodell");
  ok(readFileSync("app/api/checkout/route.ts", "utf8").includes("creditEmail"), "Anrechnung hängt an der Login-Mail");
  ok(readFileSync("lib/plan-checkout.ts", "utf8").includes("expires_at:"), "Upgrade-Session läuft mit der Reservierung ab");
  ok(readFileSync("components/schnellversion-browser.ts", "utf8").includes("sv49_visit"), "Aufruf wird nur einmal gesendet");
  ok(kasseCheckAntwort("Unsicher") === "unbekannt", "Unsicher ist keine Ja-Antwort");
  const kept = draftFromSchnellversion("inhaber@example.com", sample({ firma: "Bleibt GmbH" }));
  kept.revision = 4;
  if (kept.answers.module?.check) kept.answers.module.check.bargeld = "nein";
  if (kept.answers.katalog?.A01?.values) kept.answers.katalog.A01.values.company = "Bleibt GmbH";
  const merged = mergeEmptyDraftFields(kept, draftFromSchnellversion("inhaber@example.com", sample()));
  ok(merged.answers.katalog?.A01?.values?.company === "Bleibt GmbH", "laufende Firma bleibt");
  ok(merged.answers.module?.check?.bargeld === "nein", "gesetzte Kasse bleibt");
  ok(merged.revision === 4, "Revision des Fragebogens bleibt");
  if (confirmed.paid && paid.ok) {
    const link = new URL(paid.url, "http://local");
    const dl = link.searchParams.get("dl") ?? "";
    const row = confirmed.purchase;
    ok(!svDownloadAllowed(row, { email: "fremd@example.com", token: "", now: reserveNow }), "fremde Session ohne Token bleibt zu");
    ok(svDownloadAllowed(row, { email: "inhaber@example.com", token: "", now: reserveNow }), "Käufer darf laden");
    ok(svDownloadAllowed(row, { email: "", token: dl, now: reserveNow }), "Download-Token darf laden");
    const later = new Date(reserveNow.getTime() + 31 * 24 * 60 * 60 * 1000);
    ok(!svDownloadAllowed(row, { email: "inhaber@example.com", token: dl, now: later }), "Session-Link endet nach 30 Tagen");
  }
  const keptFibu = draftFromSchnellversion("lex@example.com", sample({ software: "lexoffice", firma: "Lex GmbH" }));
  keptFibu.answers.fibu = ["Lexware Eigen"];
  if (keptFibu.answers.module) {
    keptFibu.answers.module = {
      ...keptFibu.answers.module,
      check: { ...keptFibu.answers.module.check, kanzlei: "nein" },
      stammdaten: { ...keptFibu.answers.module.stammdaten, fibu: "Lexware Eigen", gf: "Erika Eigen" },
    };
  }
  keptFibu.answers.gf = "Erika Eigen";
  if (keptFibu.answers.katalog?.A01?.values) keptFibu.answers.katalog.A01.values.company = "";
  const contradictory = mergeEmptyDraftFields(
    keptFibu,
    draftFromSchnellversion("lex@example.com", sample({ software: "DATEV", bucht: "Unsere Steuerkanzlei", firma: "Kauf GmbH" })),
  );
  ok(contradictory.answers.steuerberater !== "Steuerkanzlei", "Kanzlei Nein setzt keinen Steuerberater");
  ok(contradictory.answers.katalog?.F05?.values?.kanzleiBeteiligt !== "ja", "Kanzlei Nein bleibt ohne Beteiligung");
  ok(!contradictory.answers.fibu?.includes("DATEV"), "Lexware Eigen setzt FiBu nicht auf DATEV");
  ok(contradictory.answers.katalog?.A01?.values?.company !== "Kauf GmbH", "ohne Firma bleibt das Feld leer");
  const unclear = draftFromSchnellversion("unklar@example.com", sample());
  if (unclear.answers.module) {
    unclear.answers.module = {
      ...unclear.answers.module,
      check: { ...unclear.answers.module.check, kanzlei: "unbekannt" },
    };
  }
  unclear.answers.steuerberater = "";
  if (unclear.answers.katalog?.F05) {
    const katalog = { ...unclear.answers.katalog };
    delete katalog.F05;
    unclear.answers.katalog = katalog;
  }
  const unclearMerged = mergeEmptyDraftFields(
    unclear,
    draftFromSchnellversion("unklar@example.com", sample({
      software: "Weiß ich nicht, macht die Kanzlei",
      bucht: "Unsere Steuerkanzlei",
      kasse: "Unsicher",
    })),
  );
  ok(unclearMerged.answers.module?.check?.kanzlei === "unbekannt", "Kanzlei unbekannt bleibt unbekannt");
  ok(unclearMerged.answers.steuerberater !== "Steuerkanzlei", "unbekannt setzt keinen Steuerberater");
  ok(unclearMerged.answers.katalog?.F05?.values?.kanzleiBeteiligt !== "ja", "unbekannt setzt keine Kanzlei-Beteiligung");
  ok(!unclearMerged.answers.fibu?.includes("Weiß ich nicht, macht die Kanzlei"), "Unklarheit landet nicht in der FiBu");
  ok(!JSON.stringify(unclearMerged.answers.katalog?.B01 ?? {}).includes("Weiß ich nicht, macht die Kanzlei"), "Unklarheit landet nicht in B01");
  ok(statedFibu(sample({ software: "Weiß ich nicht, macht die Kanzlei" })) === null, "Unklarheit ist kein Programm");
  const broken = await openSchnellversionCheckout({
    answers: sample(),
    unternehmer: true,
    bewusst: true,
    email: "abbruch@example.com",
    arm: "test",
    env: stubPaid,
  });
  ok(broken.ok, "Session für den Abbruch nach der Sperre");
  failNextClaimedPurchaseForTest();
  let failed = false;
  try {
    await confirmPaidSession(broken.ok ? broken.sessionId : "", { env: stubPaid });
  } catch {
    failed = true;
  }
  ok(failed, "Fehler nach der Sperre bricht den Kauf ab");
  ok((await listAllSvPurchases()).filter((row) => row.sessionId === (broken.ok ? broken.sessionId : "x")).length === 0, "nach dem Fehler liegt kein Kauf");
  const repaired = await confirmPaidSession(broken.ok ? broken.sessionId : "", { env: stubPaid });
  const repairedRows = (await listAllSvPurchases()).filter((row) => row.sessionId === (broken.ok ? broken.sessionId : "x"));
  ok(repaired.paid && repairedRows.length === 1, "erneute Zustellung legt genau einen Kauf an");
  for (const step of ["purchase", "index", "event"] as const satisfies readonly SvCommitStep[]) {
    const opened = await openSchnellversionCheckout({
      answers: sample(),
      unternehmer: true,
      bewusst: true,
      email: `${step}@example.com`,
      arm: "test",
      env: stubPaid,
    });
    ok(opened.ok, `Session für fehlendes ${step}`);
    failSvCommitStepForTest(step);
    let threw = false;
    try {
      await confirmPaidSession(opened.ok ? opened.sessionId : "", { env: stubPaid });
    } catch {
      threw = true;
    }
    ok(threw, `${step} antwortet nicht mit einem fertigen Kauf`);
    failSvCommitStepForTest(null);
    const before = (await readSvEvents()).filter((row) => row.name === "sv_purchase").length;
    const again = await confirmPaidSession(opened.ok ? opened.sessionId : "", { env: stubPaid });
    const rows = (await listAllSvPurchases()).filter((row) => row.sessionId === (opened.ok ? opened.sessionId : "x"));
    const after = (await readSvEvents()).filter((row) => row.name === "sv_purchase").length;
    ok(again.paid && rows.length === 1 && rows[0]?.id === purchaseIdForSession(opened.ok ? opened.sessionId : ""), `${step}: Retry ergibt eine Kaufzeile`);
    ok(new Set(rows.map((row) => row.pdfPath)).size === 1, `${step}: ein PDF-Pfad`);
    ok(after === before + 1, `${step}: die Zählung wird nachgeholt`);
  }
  {
    const opened = await openSchnellversionCheckout({
      answers: sample(),
      unternehmer: true,
      bewusst: true,
      email: "sink@example.com",
      arm: "test",
      env: stubPaid,
    });
    ok(opened.ok, "Session für die fehlende Eventsenke");
    failSvPurchaseSinkForTest(true);
    const before = (await readSvEvents()).filter((row) => row.name === "sv_purchase").length;
    let threw = false;
    try {
      await confirmPaidSession(opened.ok ? opened.sessionId : "", { env: stubPaid });
    } catch {
      threw = true;
    }
    const mid = (await readSvEvents()).filter((row) => row.name === "sv_purchase").length;
    ok(threw && mid === before, "fehlende Eventsenke setzt keinen Marker und zählt nicht");
    failSvPurchaseSinkForTest(false);
    const again = await confirmPaidSession(opened.ok ? opened.sessionId : "", { env: stubPaid });
    const after = (await readSvEvents()).filter((row) => row.name === "sv_purchase").length;
    ok(again.paid && after === before + 1, "Retry schreibt das Event genau einmal");
  }
  const race = await openSchnellversionCheckout({
    answers: sample(),
    unternehmer: true,
    bewusst: true,
    email: "rennen@example.com",
    arm: "test",
    env: stubPaid,
  });
  ok(race.ok, "Session für die parallele Bestätigung");
  const beforeRace = (await readSvEvents()).filter((row) => row.name === "sv_purchase").length;
  const parallel = await Promise.all(
    Array.from({ length: 5 }, () => confirmPaidSession(race.ok ? race.sessionId : "", { env: stubPaid })),
  );
  const raceRows = (await listAllSvPurchases()).filter((row) => row.sessionId === (race.ok ? race.sessionId : "x"));
  const afterRace = (await readSvEvents()).filter((row) => row.name === "sv_purchase").length;
  ok(parallel.filter((item) => item.paid).length === 5, "alle parallelen Bestätigungen sehen den Kauf");
  ok(raceRows.length === 1, "parallele Bestätigung legt eine Kaufzeile an");
  ok(new Set(raceRows.map((row) => row.pdfPath)).size === 1, "parallele Bestätigung legt ein PDF an");
  ok(afterRace === beforeRace + 1, "parallele Bestätigung zählt einen 49-€-Kauf");
  const before99 = (await readSvEvents()).filter((row) => row.name === "purchase_99").length;
  const counted99 = await Promise.all(
    Array.from({ length: 5 }, (_, index) =>
      rememberPurchase99Once({ sessionId: "cs_race_99", eventId: `evt_${index}`, arm: "test" }),
    ),
  );
  ok(counted99.filter(Boolean).length === 1, "fünf 99-€-Zustellungen zählen einmal");
  ok((await rememberPurchase99Once({ sessionId: "cs_race_99", eventId: "evt_neu", arm: "test" })) === false, "dieselbe Session zählt nicht erneut");
  const after99 = (await readSvEvents()).filter((row) => row.name === "purchase_99").length;
  ok(after99 === before99 + 1, "purchase_99 steigt um eins");
  ok(await claimSvSession(race.ok ? race.sessionId : "x") === "exists", "zweite Sperre der Session schlägt fehl");
  const alwaysForbidden = [
    "Robert Funke",
    "Ines Wolf",
    "KassaPro",
    "Faktura",
    "ERP Fertigplan",
    "Bei einem realen Betrieb",
    "Präsens-Aussagen",
    "Kundenkonto",
    "Muster, fiktiv",
    "(fiktiv)",
    "Angabe im Intake",
    "Musterbetrieb",
    "Diese Fassung gilt ab",
    "ältere Fassungen",
    "Keine Bereiche ausgenommen; Der Download",
    "in die von der Kanzlei eingesetzte Software",
    "in Excel-Listen bzw. manuelle Aufzeichnungen",
    "täglich über Excel-Listen",
  ];
  const when = new Date("2026-11-17T10:00:00Z");
  for (const branche of SV_BRANCHEN) {
    for (const kasse of SV_KASSE) {
      for (const bucht of SV_BUCHT) {
        for (const software of SV_SOFTWARE) {
          const answers = sample({
            branche: branche.id,
            kasse,
            bucht,
            software,
            softwareFrei: software === "Sonstiges" ? "Buchhalter Pro" : "",
          });
          const plain = standardPlainText(answers, when);
          const label = softwareProse(answers);
          const ausgeschlossen = coverField(plain, "Ausgeschlossen");
          const geltung = coverField(plain, "Geltungsbereich");
          if (ausgeschlossen !== "Keine Bereiche ausgenommen.") {
            ok(false, `Ausgeschlossen ${branche.id}: ${ausgeschlossen}`);
          }
          if (!geltung || /Nachweis und Ablage|Beleg-ID|§ 147/.test(geltung)) {
            ok(false, `Geltungsbereich ${branche.id}: ${geltung}`);
          }
          for (const forbidden of alwaysForbidden) {
            if (plain.includes(forbidden)) ok(false, `${branche.id} ${software} enthält ${forbidden}`);
          }
          if (answers.software === "Weiß ich nicht, macht die Kanzlei") {
            if (plain.includes("Weiß ich nicht, macht die Kanzlei")) {
              ok(false, `${branche.id} nennt die Unklarheit als Programm`);
            }
            const built = buildStandardAnswers(answers);
            if (built.answers.fibu?.length) ok(false, `${branche.id} schreibt die Unklarheit in die FiBu`);
            if (JSON.stringify(built.answers.katalog?.B01 ?? {}).includes("Weiß ich nicht, macht die Kanzlei")) {
              ok(false, `${branche.id} schreibt die Unklarheit in B01`);
            }
          }
          if (answers.software === "Excel / manuell" && plain.includes("Excel / manuell")) {
            ok(false, `${branche.id} lässt Excel / manuell im Fließtext`);
          }
          if (answers.software === "Excel / manuell" && !plain.includes("manuellen Aufzeichnungen")) {
            ok(false, `${branche.id} ohne Dativ bei den Aufzeichnungen`);
          }
          if (answers.software === "Weiß ich nicht, macht die Kanzlei" && bucht !== "Wir selbst im Unternehmen" && !plain.includes("eingesetzten Software")) {
            ok(false, `${branche.id} ohne Dativ bei der Kanzlei-Software`);
          }
          if (answers.software === "Weiß ich nicht, macht die Kanzlei" && bucht === "Wir selbst im Unternehmen" && !plain.includes("Buchhaltungssoftware")) {
            ok(false, `${branche.id} ohne neutrale Software bei Eigenbuchhaltung`);
          }
          const fall = standardFall(answers);
          for (const treffer of befundTreffer(plain, fall)) {
            ok(false, `${branche.id} ${software} ${bucht} enthält ${treffer}`);
          }
          if (bucht === "Unsere Steuerkanzlei" && !fall.datev) {
            const chosen = countText(plain, label);
            if (chosen < 1) ok(false, `${branche.id} ${label} fehlt`);
          }
          for (const fremd of BRANCHEN_FREMDE[branche.id] ?? []) {
            if (plain.includes(fremd)) ok(false, `${branche.id} ${software} enthält ${fremd}`);
          }
          const marker = (plain.match(/bitte prüfen/gi) ?? []).length - (plain.match(/Standardfassung, bitte prüfen/gi) ?? []).length;
          if (marker > 25) ok(false, `${branche.id} ${software} hat ${marker} Markierungen`);
          if (/€/.test(plain) || /Anrechn/i.test(plain)) ok(false, `${branche.id} ${software} enthält Preis oder Anrechnung`);
          const lohnSatz = fall.self
            ? "Die Lohnabrechnung erfolgt extern (z. B. über ein Lohnbüro)."
            : "Die Lohnabrechnung erfolgt extern (z. B. Lohnbüro oder Steuerkanzlei).";
          if (!plain.includes(lohnSatz)) ok(false, `${branche.id} ${software} ohne neutralen Lohnsatz`);
          const repeats = repeatedSentences(plain);
          if (repeats.length) ok(false, `${branche.id} ${software} wiederholt ${repeats[0]}`);
        }
      }
    }
  }
  ok(true, "alle Branchen- und Antwortkombinationen ohne Musterreste");
  const faelle63: Array<Partial<SchnellversionAnswers>> = [
    { software: "Sonstiges", softwareFrei: "Buchhalter Pro", bucht: "Wir selbst im Unternehmen" },
    { software: "Excel / manuell", softwareFrei: "", bucht: "Beides: Belege sammeln wir, die Kanzlei bucht" },
    { software: "Excel / manuell", softwareFrei: "", bucht: "Wir selbst im Unternehmen" },
    { software: "lexoffice", softwareFrei: "", bucht: "Unsere Steuerkanzlei" },
    { software: "Sonstiges", softwareFrei: "Lexware", bucht: "Beides: Belege sammeln wir, die Kanzlei bucht" },
    { software: "sevdesk", softwareFrei: "", bucht: "Wir selbst im Unternehmen" },
    { software: "Weiß ich nicht, macht die Kanzlei", softwareFrei: "", bucht: "Beides: Belege sammeln wir, die Kanzlei bucht" },
    { software: "Weiß ich nicht, macht die Kanzlei", softwareFrei: "", bucht: "Unsere Steuerkanzlei" },
    { software: "Weiß ich nicht, macht die Kanzlei", softwareFrei: "", bucht: "Wir selbst im Unternehmen" },
  ];
  for (const branche of SV_BRANCHEN) {
    for (const fallPatch of faelle63) {
      const answers = sample({ ...fallPatch, branche: branche.id, kasse: "Ja, elektronische Kasse" });
      const plain = standardPlainText(answers, when);
      const fall = standardFall(answers);
      for (const satz of pflichtBausteine(fall)) {
        if (!plain.includes(satz)) ok(false, `${branche.id} ohne Baustein ${satz.slice(0, 48)}`);
      }
      for (const treffer of befundTreffer(plain, fall)) {
        ok(false, `${branche.id} Befund ${treffer}`);
      }
    }
  }
  ok(true, "63 Fälle mit Bausteinen und ohne die Befundmuster");
  const selfNamed = sample({
    bucht: "Wir selbst im Unternehmen",
    software: "Sonstiges",
    softwareFrei: "Buchhalter Pro",
    kasse: "Nein, keine Bargeldeinnahmen",
  });
  const selfPlain = standardPlainText(selfNamed, when);
  ok(selfPlain.includes("Buchhalter Pro"), "genanntes Programm bleibt im Text");
  ok(!/DATEV|kanzlei/i.test(selfPlain), "Eigenbuchhaltung ohne Kanzlei und DATEV");
  ok(readFileSync("lib/schnellversion-copy.ts", "utf8").includes("Sie bestellen als Unternehmer"), "Checkbox in Sie-Form");
  ok(!readFileSync("app/api/schnellversion/pdf/route.ts", "utf8").includes("SV_ARM_COOKIE"), "PDF-Route liest das Zuteilungs-Cookie nicht");
  ok(!readFileSync("app/schnellversion/danke/page.tsx", "utf8").includes("gekauftAm"), "Danke-Seite legt keinen Kauf an");
  ok(!readFileSync("components/schnellversion-danke.tsx", "utf8").includes("gekauftAm"), "Browser legt keinen Kauf an");

  const page = readFileSync("app/page.tsx", "utf8");
  ok(page.includes("SCHNELLVERSION ?"), "Startseite blendet den Button nur mit Flag ein");
  ok(!readFileSync("content/legal/agb.md", "utf8").includes("Schnellversion 49"), "AGB unverändert von diesem Begriff");

  console.log("check-schnellversion: ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
