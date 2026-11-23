/**
 * Schnellversion: Vorlagenwahl, Deckblatt-Hinweis, Zuteilung ohne Einwilligung,
 * Ereignisse ohne Personenbezogene Daten, Abbruchschwellen ohne Automatik.
 */
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { effectiveModulStatus } from "../lib/module/status";
import { pageTexts } from "./pdf-text";
import { decideSvArm } from "../lib/schnellversion-assign";
import { creditHintVisible, openCredit, reserveDecision } from "../lib/schnellversion-credit";
import { SV_BASIS_SATZ, SV_SOLO_MITARBEITENDE } from "../lib/schnellversion-neutral";
import { reminderDue, reminderMail, runSchnellversionReminder } from "../lib/schnellversion-reminder";
import { claimSvSession, creditStillOpen, downloadStillOpen, failSvCommitStepForTest, failSvCountedMarkerForTest, findSvPurchaseBySession, hashDownloadToken, isSvPdfPath, listAllSvPurchases, purchaseIdForSession, reserveSvCredit, svDownloadAllowed, svLocalPdfDir, type SvCommitStep, type SvPurchase } from "../lib/schnellversion-record";
import { schnellversionCheckoutMetadata, schnellversionSessionParams } from "../lib/schnellversion-checkout";
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
import { svDownloadStillOpen, svHeaderLine, SV_COVER_TITLE, SV_FOOTER, SV_PDF_FAILED, SV_PURGE_AFTER_DAYS } from "../lib/schnellversion-copy";
import { clientEventAllowed, evaluateSvEvents, parseSvEvent, type SvEventRow } from "../lib/schnellversion-events";
import { BRANCHEN_FREMDE, limitIdenticalSentences, LOHN_SATZ, pflichtBausteine, repeatedSentences, standardFall } from "../lib/schnellversion-bausteine";
import { confirmPaidSession, failNextClaimedPurchaseForTest, failNextSvPdfForTest, isSvPdfFailed, openSchnellversionCheckout, paidFromStoredSession, resetSvPdfBuildsForTest, saveSvPending, svPdfBuildsForTest } from "../lib/schnellversion-payment";
import { draftFromSchnellversion, mergeEmptyDraftFields } from "../lib/schnellversion-draft";
import { standardPlainText } from "../lib/schnellversion-pdf";
import { svBlobWritesOpen, svPreviewTestTarget, svSheetWritesOpen } from "../lib/schnellversion-data-env";
import { adaptSvSheetClient, failSvPurchaseSinkForTest, installSvEventSheetForTest, readSvEvents, rememberPurchase99Once, rememberSvEvent, SV_EVENT_COLUMNS } from "../lib/schnellversion-store";
import { maybeSendSchnellversionPurchaseMail, purchaseMail } from "../lib/schnellversion-purchase-mail";
import { runScheduledSvPurge, runSvPurge, svRecordPurgeDue } from "../lib/schnellversion-purge";
import { addMonthsIso } from "../lib/plan";
import { DOC_RETENTION_MONTHS } from "../lib/retention-decision";
import { PLAN_OFFER_OBJECTION_NOTICE } from "../lib/plan-copy";
import { agbMarkdown, applyLegalConditions, legalFlagsFor } from "../lib/legal-content";
import { buildLlmsTxt } from "../lib/llms-txt";
import { markdownH2Section } from "../lib/markdown-section";
import { isPricingV2 } from "../lib/pricing-model";
import { POST as kontoPost } from "../app/api/schnellversion/konto/route";
import { GET as pdfGet, POST as pdfPost } from "../app/api/schnellversion/pdf/route";
import { GET as statusGet } from "../app/api/schnellversion/status/route";
import { buildPlanCheckoutParams } from "../lib/plan-checkout";
import { checkoutReturnBaseUrl } from "../lib/env";
import { SV_HIDDEN_TITLE, schnellversionPageMetadata } from "../lib/schnellversion-meta";
import { DL_REQUEST_LOG_IGNORE, installDlLogRedaction, redactDlTokenText } from "../lib/log-redaction";
import { ignoreLoggingIncomingRequests } from "next/dist/server/dev/log-requests.js";
import nextConfig from "../next.config";
import { NextRequest } from "next/server";
import { noteSchnellversionPurchase } from "../app/api/stripe/webhook/route";
import { generatePdf } from "../lib/delivery";
import { renderGesamtChapters } from "../lib/gesamt-document";
import { getGesamtMuster } from "../lib/module-muster";
import { MUSTER_FIRMEN } from "../lib/module-muster-dense";
import { generateStandardPdf } from "../lib/schnellversion-pdf";

function ok(cond: unknown, msg: string) {
  assert.ok(cond, msg);
  console.log("ok:", msg);
}

/** „X: X:“, auch wenn das erste Label in Markdown fett steht. */
function doppeltesLabel(text: string): string {
  const plain = text.replaceAll("*", "");
  return plain.match(/([A-ZÄÖÜa-zäöü][^:\n]{1,80}?): \1:/)?.[0] ?? "";
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
    "Die Lohnabrechnung erfolgt extern",
    "Weg: Import-Datei",
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
  }) === "live",
  "live mit Flag und Preis ist erlaubt",
);
ok(
  schnellversionCheckoutPlan({
    STRIPE_PRICE_SCHNELL_49: "price_test_schnell",
    STRIPE_SECRET_KEY: "sk_live_x",
  }) === "refuse",
  "live ohne Flag bleibt zu",
);
ok(
  schnellversionCheckoutPlan({
    SCHNELLVERSION_49_ENABLED: "1",
    STRIPE_SECRET_KEY: "sk_live_x",
  }) === "refuse",
  "live ohne Preis bleibt zu",
);
ok(
  schnellversionCheckoutPlan({
    SCHNELLVERSION_49_ENABLED: "1",
    STRIPE_PRICE_SCHNELL_49: "price_test_schnell",
    SCHNELLVERSION_49_STRIPE_STUB: "paid",
    STRIPE_SECRET_KEY: "sk_test_x",
    NODE_ENV: "production",
  }) !== "stub",
  "Stub in Produktion bleibt aus",
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
  const onlyReminder = await runSchnellversionReminder(
    [purchase()],
    new Date(now.getTime() + 24 * 24 * 60 * 60 * 1000),
    async () => {
      sent += 1;
    },
    { SCHNELLVERSION_49_REMINDER_SEND: "true" },
  );
  ok(onlyReminder.sending === false && sent === 0, "Erinnerung nur mit REMINDER_SEND versendet nichts");
  const loud = await runSchnellversionReminder(
    [purchase()],
    new Date(now.getTime() + 24 * 24 * 60 * 60 * 1000),
    async () => {
      sent += 1;
    },
    { SCHNELLVERSION_49_REMINDER_SEND: "1", SCHNELLVERSION_49_ENABLED: "true" },
  );
  ok(loud.sending && loud.sent === 1 && sent === 1, "Erinnerung mit beiden Schaltern nutzt nur den Mock");
  const pdf = await generateStandardPdf(sample(), new Date("2026-11-17T10:00:00Z"));
  const text = pageTexts(pdf).join("\n");
  ok(text.includes(SV_COVER_TITLE), "Deckblatt nennt Standardfassung, bitte prüfen");
  ok(!svHeaderLine("Firma", "01.01.2026").includes("bitte prüfen"), "Kopfzeile ohne Marker");
  ok(
    svHeaderLine("Firma", "01.01.2026") === "Verfahrensdokumentation · Firma · Standardfassung vom 01.01.2026",
    "Kopfzeile im Wortlaut",
  );
  ok(text.includes("Verfahrensdokumentation · Malerbetrieb Adler · Standardfassung vom"), "PDF-Kopfzeile ohne Marker");
  ok(!text.includes("Standardfassung, bitte prüfen ·"), "PDF-Kopfzeile trägt den Marker nicht");
  ok(text.includes(SV_FOOTER), "Fußzeile mit Hinweis");
  ok(text.includes("Seite 1 von"), "Fußzeile mit Seitenzahl");
  ok(!text.includes("Standardfassung, bitte prüfen. Keine Steuer- oder Rechtsberatung."), "alter Fußtext ist weg");
  ok(!text.includes("Dieses Dokument beschreibt"), "Deckblatt ohne zusätzlichen Absatz");
  ok(!text.includes("Intake"), "kein Intake im Beispiel-PDF");
  ok(!text.includes("Eine eigene Verfahrensdokumentation können Sie auf gobd-doku-erstellen.de"), "Schnellversion ohne den Muster-Schlusssatz");
  ok(!text.includes("Anhang A"), "kein Anhang A im Beispiel-PDF");
  ok(text.includes("§ 13b"), "Handwerk-PDF nennt § 13b");
  ok(text.includes(LOHN_SATZ), "Lohnsatz im Beispiel-PDF");
  const bzwProbe = limitIdenticalSentences(
    [
      "Zuständig ist die Bauleitung bzw. der Meister.",
      "Wareneingang wird geprüft. Bauleitung bzw. die Geschäftsführung.",
    ].join("\n"),
    1,
  );
  ok(bzwProbe.includes("Bauleitung bzw. die Geschäftsführung"), "kein Satzbruch nach bzw.");
  ok(text.includes("auf Basis der Angaben zu Branche und Größe"), "Standardfassung nennt Branche und Größe");
  ok(text.includes("wurde am"), "Deckblattzeile ist ein Satz");
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
  ok(fullText.includes("Fragebogen"), "Vollversion sagt Fragebogen");
  ok(!fullText.includes("Intake"), "Vollversion ohne Intake");
  ok(fullText.includes("01.07.2026"), "Vollversion behält das Geltungsdatum");
  ok(text.includes("Malerbetrieb Adler"), "Firmenname auf dem PDF");
  ok(text.includes("Mitarbeitende: 2–5"), "Mitarbeitendenzahl aus den 6 Angaben");
  ok(text.includes("Handwerk / Bau"), "Branche aus den 6 Angaben");
  ok(!text.includes("Bauwerk Nord"), "Musterfirma steht nicht im PDF");
  ok(text.includes("Vom Betrieb zu ergänzende Punkte"), "Prüfhinweise im PDF");
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
    agb: true,
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
    agb: true,
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
    agb: true,
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
  const browserSource = readFileSync("components/schnellversion-browser.ts", "utf8");
  ok(!browserSource.includes("sv49_visit") && browserSource.includes('name: "sv_visit"'), "Aufruf ohne Sitzungsspeicher");
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
    ok(!paid.url.includes("dl="), "Danke-URL ohne Download-Token");
    const dl = paid.downloadToken;
    const row = confirmed.purchase;
    ok(!svDownloadAllowed(row, { email: "fremd@example.com", token: "", now: reserveNow }), "fremde Session ohne Token bleibt zu");
    ok(svDownloadAllowed(row, { email: "inhaber@example.com", token: "", now: reserveNow }), "Käufer darf laden");
    ok(svDownloadAllowed(row, { email: "", token: dl, now: reserveNow }), "Download-Token darf laden");
    const later = new Date(reserveNow.getTime() + 31 * 24 * 60 * 60 * 1000);
    ok(!svDownloadAllowed(row, { email: "inhaber@example.com", token: dl, now: later }), "Session-Link endet nach 30 Tagen");
  }
  const keptFibu = draftFromSchnellversion("lex@example.com", sample({ software: "Lexware Office", firma: "Lex GmbH" }));
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
    agb: true,
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
    agb: true,
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
    agb: true,
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
    agb: true,
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
          if (/Buchungsbelege\s+(10|zehn)\s+Jahre/i.test(plain)) ok(false, `${branche.id} Buchungsbelege mit 10 Jahren`);
          if (/: ja(?!\/nein)\b/.test(plain)) ok(false, `${branche.id} ${software} enthält : ja`);
          if (plain.includes("Intake")) ok(false, `${branche.id} ${software} enthält Intake`);
          if (plain.includes("Anhang A")) ok(false, `${branche.id} ${software} enthält Anhang A`);
          if (
            plain.includes("Küchen- bzw. der Inhaber") ||
            plain.includes("bzw. Wer bestätigt") ||
            plain.includes("Über die Kanzlei. im eigenen Archiv")
          ) {
            ok(false, `${branche.id} ${software} bricht den Satz nach bzw.`);
          }
          if (!plain.includes(LOHN_SATZ)) ok(false, `${branche.id} ${software} ohne Lohnsatz`);
          if (plain.includes("Die Lohnabrechnung erfolgt extern")) ok(false, `${branche.id} alter Lohnsatz`);
          if (plain.includes("| Rolle | Lesen |") && !plain.includes("Vorschlag – vom Betrieb zu bestätigen")) {
            ok(false, `${branche.id} Rechtetabelle ohne Vorschlag`);
          }
          if (!plain.includes("strukturierte Datensatz") || !plain.includes("maßgeblich")) {
            ok(false, `${branche.id} ohne E-Rechnungs-Original`);
          }
          if (plain.includes("Hinweis: Diese Verfahrensdokumentation")) {
            ok(false, `${branche.id} Deckblatt-Absatz noch da`);
          }
          if (plain.includes("**Kassenart:** Art:") || plain.includes("**System:** System:")) {
            ok(false, `${branche.id} doppeltes Label`);
          }
          if (kasse === "Ja, offene Ladenkasse (ohne elektronisches System)") {
            if (/\bTSE\b/.test(plain)) ok(false, `${branche.id} ${software} offene Ladenkasse nennt TSE`);
            if (!plain.includes("Kassenbericht") || !plain.includes("Zählprotokoll")) {
              ok(false, `${branche.id} offene Ladenkasse ohne Kassenbericht`);
            }
            if (!plain.includes("Einzelaufzeichnung") || !plain.includes("§ 146 Abs. 1 Satz 1 AO")) {
              ok(false, `${branche.id} ohne Einzelaufzeichnung`);
            }
            if (!plain.includes("Werden Einzelaufzeichnungen geführt oder wird die Ausnahme genutzt?")) {
              ok(false, `${branche.id} Checkliste ohne Einzelaufzeichnung`);
            }
            if (plain.includes("Bewirtung über das Kassensystem") || plain.includes("aus dem Kassensystem")) {
              ok(false, `${branche.id} offene Kasse nennt ein Kassensystem`);
            }
            if (!plain.includes("entfällt (offene Ladenkasse)")) ok(false, `${branche.id} ohne entfällt offene Ladenkasse`);
            if (!plain.includes("nachträgliche Ermittlung dokumentieren")) ok(false, `${branche.id} Notverfahren offene Kasse`);
            if (plain.includes("Z-Bons") || plain.includes("Programmier- und Änderungsprotokolle des Kassensystems")) {
              ok(false, `${branche.id} Kassensystem-Zeile in der Aufbewahrung`);
            }
          }
          if (kasse !== "Nein, keine Bargeldeinnahmen" && kasse !== "Ja, offene Ladenkasse (ohne elektronisches System)" && !plain.includes("Ersatzaufzeichnung")) {
            ok(false, `${branche.id} ${software} ohne Notverfahren`);
          }
          if (!plain.includes("§ 147 Abs. 3 Satz 3 AO") || !plain.includes("§ 147 Abs. 3 Satz 5 AO")) {
            ok(false, `${branche.id} ohne Satzangabe zu § 147 Abs. 3 AO`);
          }
          if (branche.id === "freiberuf" && (plain.includes("§ 257") || !plain.includes("§ 4 Abs. 3 EStG") || !plain.includes("soweit vorhanden"))) {
            ok(false, "Freiberuf ohne EÜR oder mit HGB");
          }
          if (kasse === "Unsicher" && plain.includes("Kassenbuch im Kassensystem")) {
            ok(false, `${branche.id} unsichere Kasse setzt das Kassenbuch`);
          }
          if (branche.id === "handwerk" && (!plain.includes("§ 13b") || !plain.includes("§ 14 Abs. 4 Satz 1 Nr. 9 UStG") || !plain.includes("Aufmaß"))) {
            ok(false, `${branche.id} ${software} ohne § 14 Abs. 4 Satz 1 Nr. 9 oder Aufmaß`);
          }
          if (branche.id === "gastro" && (plain.includes("Bestellwege: E-Mail.") || plain.includes("**Bestellweg:** Bestellwege:"))) {
            ok(false, "Gastro setzt E-Mail als Bestellweg");
          }
          if ((software === "Excel / manuell" || branche.id === "gastro") && !plain.includes("Teil III: Technische Systemdokumentation")) {
            ok(false, `${branche.id} ${software} ohne Teil III`);
          }
          const bodyStart = plain.indexOf("# ");
          const listAt = plain.indexOf("# Vom Betrieb zu ergänzende Punkte");
          const body = plain.slice(bodyStart < 0 ? 0 : bodyStart, listAt < 0 ? plain.length : listAt);
          if (/\b(Sie|Ihre|Ihrer|Ihnen)\b/.test(body)) ok(false, `${branche.id} ${software} spricht den Leser im Text an`);
          for (const firma of Object.values(MUSTER_FIRMEN)) {
            for (const name of [firma.company, firma.gf, firma.buchhaltung, firma.kanzlei, firma.standort]) {
              if (name && plain.includes(name)) ok(false, `${branche.id} enthält Musterangabe ${name}`);
            }
          }
          if (!plain.includes(LOHN_SATZ)) ok(false, `${branche.id} ${software} ohne neutralen Lohnsatz`);
          const repeats = repeatedSentences(plain);
          if (repeats.length) ok(false, `${branche.id} ${software} wiederholt ${repeats[0]}`);
        }
      }
    }
  }
  ok(true, "alle Branchen- und Antwortkombinationen ohne Musterreste");
  const allein = standardPlainText(sample({
    mitarbeitende: "1 (nur ich)",
    rechtsform: "Einzelunternehmen",
    bucht: "Wir selbst im Unternehmen",
    kasse: "Nein, keine Bargeldeinnahmen",
    software: "DATEV",
    branche: "dienstleistung",
  }), when);
  ok(!allein.includes("zweite Person"), "Ein-Personen ohne zweite Person");
  ok(allein.includes("Selbstkontrolle"), "Ein-Personen mit Selbstkontrolle");
  ok(allein.includes("keine Beschäftigten laut Angabe"), "Modul 12 entfällt");
  ok(!allein.includes("Andere Beschäftigte"), "keine Beschäftigtenzeile");
  ok(!allein.includes("Geschäftsführung"), "Einzelunternehmen ohne Geschäftsführung");
  ok(!allein.includes("1 (nur ich)") && allein.includes(SV_SOLO_MITARBEITENDE), "Ich-Form wird dritte Person");
  ok(allein.includes("Gibt es Beschäftigte"), "Lohnfrage bei einer Person");
  const unsichereKasse = standardPlainText(sample({ kasse: "Unsicher", branche: "handel", software: "sevdesk", bucht: "Unsere Steuerkanzlei" }), when);
  ok(unsichereKasse.includes("Kassenbuch (elektronisches System) oder Kassenbericht (offene Ladenkasse)"), "unsichere Kassenform");
  ok(!unsichereKasse.includes("TSE-Art"), "unsicher ohne TSE-Art");
  ok(unsichereKasse.includes("Bei offener Ladenkasse zusätzlich aufbewahren"), "unsicher nennt beide Aufbewahrungen");
  const aufbewahrung = unsichereKasse.indexOf("Aufbewahrung");
  const liste = unsichereKasse.indexOf("Bei offener Ladenkasse zusätzlich aufbewahren");
  const notverfahren = unsichereKasse.indexOf("Notverfahren");
  ok(aufbewahrung >= 0 && liste > aufbewahrung && (notverfahren < 0 || liste < notverfahren), "Fristliste steht nicht unter Notverfahren");
  ok(unsichereKasse.includes("Bei elektronischem System:"), "elektronische Angaben mit Bedingung");
  ok(unsichereKasse.includes("Bei elektronischem System: TSE und Mitteilung"), "Prozessschritt TSE mit Bedingung");
  ok(
    unsichereKasse.replaceAll("*", "").includes("Belegausgabe: Bei elektronischem System:"),
    "unsichere Belegausgabe ohne doppeltes Label",
  );
  ok(doppeltesLabel("Belegausgabe: Belegausgabe: ist festzulegen") === "Belegausgabe: Belegausgabe:", "Negativtest doppeltes Label");
  const beispiele: SchnellversionAnswers[] = [
    { firma: "Beispiel Holz GmbH", branche: "handwerk", software: "DATEV", bucht: "Unsere Steuerkanzlei", kasse: "Nein, keine Bargeldeinnahmen", rechtsform: "GmbH", mitarbeitende: "2–5", softwareFrei: "" },
    { firma: "Beispiel Shop GmbH", branche: "ecommerce", software: "Lexware Office", bucht: "Unsere Steuerkanzlei", kasse: "Nein, keine Bargeldeinnahmen", rechtsform: "GmbH", mitarbeitende: "2–5", softwareFrei: "" },
    { firma: "Beispiel Küche GmbH", branche: "gastro", software: "Excel / manuell", bucht: "Wir selbst im Unternehmen", kasse: "Ja, elektronische Kasse", rechtsform: "GmbH", mitarbeitende: "2–5", softwareFrei: "" },
    { firma: "Beispiel Laden GmbH", branche: "handel", software: "sevdesk", bucht: "Unsere Steuerkanzlei", kasse: "Ja, elektronische Kasse", rechtsform: "GmbH", mitarbeitende: "2–5", softwareFrei: "" },
    { firma: "Beispiel Beratung GmbH", branche: "dienstleistung", software: "DATEV", bucht: "Wir selbst im Unternehmen", kasse: "Ja, elektronische Kasse", rechtsform: "GmbH", mitarbeitende: "2–5", softwareFrei: "" },
    { firma: "Beispiel Küche GmbH", branche: "gastro", software: "Excel / manuell", bucht: "Wir selbst im Unternehmen", kasse: "Ja, offene Ladenkasse (ohne elektronisches System)", rechtsform: "GmbH", mitarbeitende: "2–5", softwareFrei: "" },
    { firma: "Beispiel Allein GmbH", branche: "dienstleistung", software: "DATEV", bucht: "Wir selbst im Unternehmen", kasse: "Nein, keine Bargeldeinnahmen", rechtsform: "Einzelunternehmen", mitarbeitende: "1 (nur ich)", softwareFrei: "" },
    { firma: "Beispiel Unsicher GmbH", branche: "handel", software: "sevdesk", bucht: "Unsere Steuerkanzlei", kasse: "Unsicher", rechtsform: "GmbH", mitarbeitende: "2–5", softwareFrei: "" },
    { firma: "Beispiel Freiberuf", branche: "freiberuf", software: "DATEV", bucht: "Wir selbst im Unternehmen", kasse: "Nein, keine Bargeldeinnahmen", rechtsform: "Einzelunternehmen", mitarbeitende: "1 (nur ich)", softwareFrei: "" },
  ];
  for (const beispiel of beispiele) {
    const hit = doppeltesLabel(standardPlainText(beispiel, when));
    ok(!hit, `${beispiel.firma} ohne doppeltes Label${hit ? `: ${hit}` : ""}`);
  }
  const faelle63: Array<Partial<SchnellversionAnswers>> = [
    { software: "Sonstiges", softwareFrei: "Buchhalter Pro", bucht: "Wir selbst im Unternehmen" },
    { software: "Excel / manuell", softwareFrei: "", bucht: "Beides: Belege sammeln wir, die Kanzlei bucht" },
    { software: "Excel / manuell", softwareFrei: "", bucht: "Wir selbst im Unternehmen" },
    { software: "Lexware Office", softwareFrei: "", bucht: "Unsere Steuerkanzlei" },
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
  ok(
  readFileSync("lib/schnellversion-copy.ts", "utf8").includes(
    "Ich bestelle als Unternehmer (§ 14 BGB) für meine gewerbliche oder selbstständige berufliche Tätigkeit.",
  ),
  "Unternehmer-Checkbox wie § 1 Abs. 2",
);
  ok(!readFileSync("app/api/schnellversion/pdf/route.ts", "utf8").includes("SV_ARM_COOKIE"), "PDF-Route liest das Zuteilungs-Cookie nicht");
  ok(!readFileSync("app/schnellversion/danke/page.tsx", "utf8").includes("gekauftAm"), "Danke-Seite legt keinen Kauf an");
  ok(!readFileSync("components/schnellversion-danke.tsx", "utf8").includes("gekauftAm"), "Browser legt keinen Kauf an");

  const page = readFileSync("app/page.tsx", "utf8");
  ok(page.includes("SCHNELLVERSION ?"), "Startseite blendet den Button nur mit Flag ein");
  ok(!readFileSync("content/legal/agb.md", "utf8").includes("Schnellversion 49"), "AGB unverändert von diesem Begriff");
  const sessionParams = schnellversionSessionParams(
    { pendingId: "p", consentAt: "t", company: "Firma", downloadToken: "tok", email: "a@b.de" },
    {
      SCHNELLVERSION_49_ENABLED: "1",
      STRIPE_PRICE_SCHNELL_49: "price_test_schnell",
      STRIPE_SECRET_KEY: "sk_test_x",
      STRIPE_TAX_RATE_ID: "txr_existing",
    },
  );
  const line = sessionParams?.line_items?.[0];
  ok(sessionParams?.invoice_creation?.enabled === true, "49-€-Session erzeugt eine Rechnung");
  ok(sessionParams?.billing_address_collection === "required", "49-€-Session verlangt die Rechnungsadresse");
  ok(sessionParams?.tax_id_collection?.enabled === true, "49-€-Session fragt die USt-IdNr. ab");
  ok(line && "tax_rates" in line && line.tax_rates?.[0] === "txr_existing", "49-€-Session nutzt die vorhandene Tax Rate");
  const kaufmail = purchaseMail({ company: "Malerbetrieb Adler", purchasedAt: now.toISOString(), sessionId: "cs_test" });
  ok(kaufmail.text.includes("Ihre Zahlung ist bestätigt"), "Kaufmail bestätigt die Zahlung");
  ok(kaufmail.text.includes("ist damit abgeschlossen"), "Kaufmail schließt die Bestellung ab");
  ok(kaufmail.text.includes("Der Vertrag kommt mit der erfolgreichen Zahlungsbestätigung zustande."), "Kaufmail entspricht § 12d Abs. 3");
  ok(kaufmail.text.includes("Ihre Verfahrensdokumentation (Standardfassung, PDF)"), "Kaufmail nennt den Lieferumfang");
  ok(
    !/Minute|fertig|garantiert|Garantie|rechtssicher|gobd-konform|prüfungssicher|anerkannt|ersetzt/i.test(kaufmail.text + kaufmail.subject),
    "Kaufmail ohne Sperrwörter",
  );
  ok(kaufmail.text.includes("/agb") && kaufmail.text.includes("Download-Ende"), "Kaufmail verlinkt die AGB und nennt das Datum");
  ok(
    kaufmail.text.includes(PLAN_OFFER_OBJECTION_NOTICE) &&
      kaufmail.html.includes(PLAN_OFFER_OBJECTION_NOTICE) &&
      kaufmail.text.indexOf(PLAN_OFFER_OBJECTION_NOTICE) < kaufmail.text.indexOf("Impressum:"),
    "Kaufmail enthält PLAN_OFFER_OBJECTION_NOTICE vor dem Impressumsfuß",
  );
  ok(kaufmail.text.includes("Anrechnung:"), "Kaufmail behält den Anrechnungshinweis");
  ok((await maybeSendSchnellversionPurchaseMail({
    to: "inhaber@example.com",
    company: "Malerbetrieb Adler",
    purchasedAt: now.toISOString(),
    sessionId: "cs_test",
    env: {},
  })) === false, "Kaufmail bleibt aus");
  const alt = purchase();
  alt.purchasedAt = new Date(now.getTime() - (SV_PURGE_AFTER_DAYS + 1) * 24 * 60 * 60 * 1000).toISOString();
  alt.pdfPath = "/tmp/gobd-sv49-nicht-loeschen.pdf";
  alt.downloadTokenHash = "ab".repeat(32);
  const purge = await runSvPurge([alt], now, {});
  ok(purge.dryRun && purge.deleted === 0 && purge.due === 1, "Löschlauf bleibt Dry-Run");
  ok(SV_PURGE_AFTER_DAYS === 30, "Löschfrist steht auf 30 Tage");
  const freshRow = purchase({ id: "frisch", pdfPath: "", downloadTokenHash: "cd".repeat(32) });
  const dueFile = path.join(svLocalPdfDir(), "faellig.pdf");
  await mkdir(svLocalPdfDir(), { recursive: true });
  await writeFile(dueFile, "pdf");
  const foreign = path.join(svLocalPdfDir(), "..", "gobd-nicht-sv.pdf");
  await writeFile(foreign, "fremd");
  const dueRow = purchase({
    id: "faellig",
    pdfPath: dueFile,
    downloadTokenHash: "ab".repeat(32),
    purchasedAt: alt.purchasedAt,
  });
  const foreignRow = purchase({
    id: "fremd",
    pdfPath: foreign,
    downloadTokenHash: "ef".repeat(32),
    purchasedAt: alt.purchasedAt,
  });
  let listed = 0;
  ok((await runScheduledSvPurge(now, {}, async () => {
    listed += 1;
    return [];
  })) === null && listed === 0, "Löschlauf ohne Schalter liest nichts");
  const sharp = await runSvPurge([dueRow, freshRow, foreignRow], now, { SCHNELLVERSION_49_PURGE: "1", SCHNELLVERSION_49_ENABLED: "" });
  ok(isSvPdfPath(dueFile) && !isSvPdfPath(foreign), "nur der Schnellversion-Pfad gilt als PDF");
  ok(sharp.dryRun === false && sharp.deleted === 1 && sharp.due === 2, "nur PURGE gesetzt bei Flag aus: Löschlauf läuft");
  const cleared = (await listAllSvPurchases()).find((row) => row.id === "faellig");
  ok(cleared?.pdfPath === "" && cleared.downloadTokenHash === "", "PDF und Token der fälligen Zeile sind leer");
  ok(
    cleared?.email === "inhaber@example.com" && cleared.company === "Malerbetrieb Adler" && !creditStillOpen(cleared, cleared.company, now),
    "nach 31 Tagen bleibt der Datensatz, die Anrechnung ist zu",
  );
  ok(freshRow.downloadTokenHash === "cd".repeat(32) && freshRow.pdfPath === "", "nicht fällige Zeile bleibt");
  ok(foreignRow.pdfPath === foreign && foreignRow.downloadTokenHash === "ef".repeat(32), "fremder Pfad bleibt");
  await assert.rejects(unlink(dueFile), "lokale Schnellversion-Datei ist weg");
  ok((await readFileSync(foreign, "utf8")) === "fremd", "fremde Datei bleibt");
  await unlink(foreign);
  ok(readFileSync("app/api/cron/loeschlauf/route.ts", "utf8").includes("schnellversionPurgeEnabled()"), "Cron löscht nur mit dem Schalter");
  const yearStart = "2025-01-15T12:00:00.000Z";
  const yearLater = new Date(Date.parse(addMonthsIso(yearStart, DOC_RETENTION_MONTHS)) + 24 * 60 * 60 * 1000);
  const yearRow = purchase({
    id: "altjahr",
    email: "altjahr@example.com",
    company: "Altjahr GmbH",
    purchasedAt: yearStart,
    pdfPath: "",
    downloadTokenHash: "",
    answersJson: "{\"firma\":\"Altjahr\"}",
    sessionId: "cs_altjahr",
    consentAt: yearStart,
  });
  ok(svRecordPurgeDue(yearStart, yearLater) && !svRecordPurgeDue(now.toISOString(), now), "12 Monate sind die Dokumentenfrist");
  const openedYear = await openSchnellversionCheckout({
    answers: sample({ firma: "Altjahr GmbH" }),
    unternehmer: true,
    bewusst: true,
    agb: true,
    email: "altjahr@example.com",
    arm: "test",
    env: stubPaid,
  });
  const paidYear = await confirmPaidSession(openedYear.ok ? openedYear.sessionId : "", { env: stubPaid });
  ok(paidYear.paid, "Kauf für die 12-Monats-Löschung");
  const aged = paidYear.paid ? { ...paidYear.purchase, purchasedAt: yearStart } : yearRow;
  const yearPurge = await runSvPurge([aged], yearLater, { SCHNELLVERSION_49_PURGE: "1" });
  ok(yearPurge.recordsDeleted === 1 && yearPurge.dryRun === false, "Kaufdatensatz nach 12 Monaten und einem Tag gelöscht");
  ok(!(await listAllSvPurchases()).some((row) => row.id === aged.id), "gelöschter Datensatz ist weg");
  ok(!(await reserveSvCredit(aged.id, "danach", yearLater)), "nach der Löschung keine Anrechnung");
  const reminderText = reminderMail({ company: "Malerbetrieb Adler", purchasedAt: now.toISOString() });
  ok(
    reminderText.subject.startsWith("Ihr Download und die Anrechnung enden am ") &&
      reminderText.text.includes("enden der PDF-Download der Standardfassung und die Anrechnung der 49 €") &&
      reminderText.text.includes("Danach ist der Download gesperrt.") &&
      reminderText.text.includes("Keine Steuer- oder Rechtsberatung."),
    "Erinnerung behält den bestehenden Text",
  );
  ok(reminderText.text.includes(PLAN_OFFER_OBJECTION_NOTICE), "Erinnerung nutzt PLAN_OFFER_OBJECTION_NOTICE");
  const quietReminder = reminderMail({ company: "Malerbetrieb Adler", purchasedAt: now.toISOString(), optedOut: true });
  ok(
    quietReminder.subject.startsWith("Ihr Download endet am ") &&
      !quietReminder.text.includes("Anrechnung") &&
      !quietReminder.text.includes("Fragebogen") &&
      !quietReminder.text.includes(PLAN_OFFER_OBJECTION_NOTICE),
    "nach Widerspruch nur der Download-Hinweis",
  );
  ok(
    readFileSync("app/api/cron/addon-notice/route.ts", "utf8").includes("sv49-reminder:${mail.purchaseId}"),
    "Erinnerung wird je Kauf gezählt",
  );
  ok(
    readFileSync("app/api/cron/addon-notice/route.ts", "utf8").includes("schnellversionReminderSendEnabled()"),
    "Erinnerung hängt am Versand-Schalter",
  );
  const openedCount = await openSchnellversionCheckout({
    answers: sample(),
    unternehmer: true,
    bewusst: true,
    agb: true,
    email: "zaehlung@example.com",
    arm: "test",
    env: stubPaid,
  });
  ok(openedCount.ok, "Session für die doppelte Zählung");
  const countSession = openedCount.ok ? openedCount.sessionId : "";
  const beforeDedupe = (await readSvEvents()).filter((row) => row.name === "sv_purchase").length;
  failSvCountedMarkerForTest(true);
  let markerThrew = false;
  try {
    await confirmPaidSession(countSession, { env: stubPaid });
  } catch {
    markerThrew = true;
  }
  const midDedupe = (await readSvEvents()).filter((row) => row.name === "sv_purchase").length;
  failSvCountedMarkerForTest(false);
  const countedAgain = await confirmPaidSession(countSession, { env: stubPaid });
  const afterDedupe = (await readSvEvents()).filter((row) => row.name === "sv_purchase").length;
  ok(markerThrew && midDedupe === beforeDedupe + 1, "fehlender Zählmarker schreibt sv_purchase einmal");
  ok(countedAgain.paid && afterDedupe === midDedupe, "erneute Zustellung schreibt sv_purchase nicht noch einmal");
  const openedPdf = await openSchnellversionCheckout({
    answers: sample(),
    unternehmer: true,
    bewusst: true,
    agb: true,
    email: "pdf-fehler@example.com",
    arm: "test",
    env: stubPaid,
  });
  ok(openedPdf.ok, "Session für die PDF-Meldung");
  const previousEnv = {
    enabled: process.env.SCHNELLVERSION_49_ENABLED,
    model: process.env.PRICING_MODEL,
    stub: process.env.SCHNELLVERSION_49_STRIPE_STUB,
    price: process.env.STRIPE_PRICE_SCHNELL_49,
    nodeEnv: process.env.NODE_ENV,
    vercel: process.env.VERCEL,
  };
  process.env.SCHNELLVERSION_49_ENABLED = "1";
  process.env.PRICING_MODEL = "v3";
  process.env.SCHNELLVERSION_49_STRIPE_STUB = "paid";
  process.env.STRIPE_PRICE_SCHNELL_49 = "price_test_schnell";
  const runtimeEnv = process.env as Record<string, string | undefined>;
  if (runtimeEnv.NODE_ENV === "production") runtimeEnv.NODE_ENV = "test";
  delete process.env.VERCEL;
  failNextSvPdfForTest();
  let pdfThrew = false;
  try {
    await confirmPaidSession(openedPdf.ok ? openedPdf.sessionId : "", { env: stubPaid });
  } catch (error) {
    pdfThrew = isSvPdfFailed(error);
  }
  const pdfResponse = await pdfGet(
    new NextRequest(`http://local/api/schnellversion/pdf?session_id=${encodeURIComponent(openedPdf.ok ? openedPdf.sessionId : "")}`),
  );
  ok(pdfThrew && pdfResponse.status === 401, "PDF-Fehler ist keine 500");
  ok(
    readFileSync("app/api/schnellversion/pdf/route.ts", "utf8").includes("SV_PDF_FAILED") &&
      readFileSync("app/api/schnellversion/pdf/route.ts", "utf8").includes("status: 409"),
    "PDF-Fehler verwendet die bestehende Meldung",
  );
  process.env.SCHNELLVERSION_49_ENABLED = "";
  const hiddenEnv = { SCHNELLVERSION_49_ENABLED: "", PRICING_MODEL: "v3" };
  const offeredEnv = { SCHNELLVERSION_49_ENABLED: "1", PRICING_MODEL: "v3" };
  ok(
    schnellversionPageMetadata("Schnellversion", hiddenEnv).title === SV_HIDDEN_TITLE &&
      schnellversionPageMetadata("Schnellversion kaufen", hiddenEnv).title === SV_HIDDEN_TITLE &&
      schnellversionPageMetadata("Standardfassung", hiddenEnv).title === SV_HIDDEN_TITLE,
    "bei Flag aus steht der 404-Titel",
  );
  ok(schnellversionPageMetadata("Schnellversion", offeredEnv).title === "Schnellversion", "bei Flag an bleibt der Seitentitel");
  for (const page of [
    "app/schnellversion/page.tsx",
    "app/schnellversion/kauf/page.tsx",
    "app/schnellversion/danke/page.tsx",
    "app/account/schnellversion/page.tsx",
  ]) {
    const source = readFileSync(page, "utf8");
    ok(source.includes("export function generateMetadata") && source.includes("schnellversionPageMetadata"), `${page} nutzt generateMetadata`);
    ok(!source.includes("export const metadata"), `${page} ohne festes Metadaten-Objekt`);
  }
  const restoreEnv = (name: string, value: string | undefined) => {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  };
  restoreEnv("SCHNELLVERSION_49_ENABLED", previousEnv.enabled);
  restoreEnv("PRICING_MODEL", previousEnv.model);
  restoreEnv("SCHNELLVERSION_49_STRIPE_STUB", previousEnv.stub);
  restoreEnv("STRIPE_PRICE_SCHNELL_49", previousEnv.price);
  restoreEnv("NODE_ENV", previousEnv.nodeEnv);
  restoreEnv("VERCEL", previousEnv.vercel);
  const freiUnsicher = standardPlainText(
    sample({ branche: "freiberuf", kasse: "Unsicher", rechtsform: "Einzelunternehmen", mitarbeitende: "1 (nur ich)" }),
    when,
  );
  ok(!freiUnsicher.includes("| Belegausgabe | Belegausgabe:"), "Freiberuf ohne doppeltes Belegausgabe-Label");
  ok(freiUnsicher.includes("| Belegausgabe | Bei elektronischem System:"), "Freiberuf behält den Belegsatz");
  const liveParams = schnellversionSessionParams(
    { pendingId: "p", consentAt: "t", company: "Firma", downloadToken: "tok-live", email: "a@b.de" },
    {
      SCHNELLVERSION_49_ENABLED: "1",
      STRIPE_PRICE_SCHNELL_49: "price_test_schnell",
      STRIPE_SECRET_KEY: "sk_live_localfake",
      STRIPE_TAX_RATE_ID: "txr_existing",
    },
  );
  ok(liveParams?.line_items?.[0] && "price" in liveParams.line_items[0] && liveParams.line_items[0].price === "price_test_schnell", "Live-Session nutzt die Price-ID aus der Umgebung");
  ok(typeof liveParams?.success_url === "string" && !liveParams.success_url.includes("dl="), "Stripe-Rücksprung ohne Download-Token");
  const savedReturnEnv = process.env.VERCEL_ENV;
  const savedBranchUrl = process.env.VERCEL_BRANCH_URL;
  process.env.VERCEL_ENV = "preview";
  process.env.VERCEL_BRANCH_URL = "gobd-git-preismodell-testmodus-philcap-tech.vercel.app";
  const previewReturn = schnellversionSessionParams(
    { pendingId: "p", consentAt: "t", company: "Firma", downloadToken: "tok", email: "a@b.de" },
    { SCHNELLVERSION_49_ENABLED: "1", STRIPE_PRICE_SCHNELL_49: "price_test_schnell", STRIPE_SECRET_KEY: "sk_test_x" },
  );
  const previewMail = purchaseMail({
    company: "Sandbox GmbH",
    purchasedAt: now.toISOString(),
    sessionId: "cs_test_sv_sandbox",
    downloadToken: "tok-mail",
  });
  ok(
    previewReturn?.success_url?.startsWith("https://gobd-git-preismodell-testmodus-philcap-tech.vercel.app/schnellversion/danke") &&
      previewReturn.cancel_url?.startsWith("https://gobd-git-preismodell-testmodus-philcap-tech.vercel.app/"),
    "Preview-Rücksprung bleibt auf der Preview",
  );
  ok(
    previewMail.text.includes("https://gobd-git-preismodell-testmodus-philcap-tech.vercel.app/api/schnellversion/pdf?dl=tok-mail"),
    "Kaufmail-Link bleibt auf der Preview und trägt das Token",
  );
  process.env.VERCEL_ENV = "production";
  delete process.env.VERCEL_BRANCH_URL;
  const prodReturn = schnellversionSessionParams(
    { pendingId: "p", consentAt: "t", company: "Firma", downloadToken: "tok", email: "a@b.de" },
    { SCHNELLVERSION_49_ENABLED: "1", STRIPE_PRICE_SCHNELL_49: "price_test_schnell", STRIPE_SECRET_KEY: "sk_live_localfake" },
  );
  ok(
    typeof prodReturn?.success_url === "string" &&
      prodReturn.success_url.startsWith(`${checkoutReturnBaseUrl()}/schnellversion/danke`) &&
      !prodReturn.success_url.includes(".vercel.app"),
    "Produktion bleibt auf der kanonischen Basis",
  );
  if (savedReturnEnv === undefined) delete process.env.VERCEL_ENV;
  else process.env.VERCEL_ENV = savedReturnEnv;
  if (savedBranchUrl === undefined) delete process.env.VERCEL_BRANCH_URL;
  else process.env.VERCEL_BRANCH_URL = savedBranchUrl;
  ok(
    schnellversionSessionParams(
      { pendingId: "p", consentAt: "t", company: "Firma", downloadToken: "tok", email: "a@b.de" },
      { SCHNELLVERSION_49_ENABLED: "1", STRIPE_PRICE_SCHNELL_49: "price_test_schnell", STRIPE_SECRET_KEY: "sk_test_x" },
    )?.mode === "payment",
    "Test-Session bleibt payment",
  );
  const token = "dl-token-nicht-loggen";
  const logged = `GET /schnellversion/danke?session_id=cs_test&dl=${token} 200`;
  ok(DL_REQUEST_LOG_IGNORE.test(logged) && !redactDlTokenText(logged).includes(token), "Server-Log enthält kein dl-Token");
  ok(!DL_REQUEST_LOG_IGNORE.test("GET /agb 200"), "Seiten ohne dl bleiben im Log");
  const devRequest = (url: string) => ({ url }) as Parameters<typeof ignoreLoggingIncomingRequests>[0];
  const devLogging = nextConfig.logging === false ? undefined : nextConfig.logging;
  ok(
    ignoreLoggingIncomingRequests(devRequest(`/schnellversion/danke?session_id=cs_test&dl=${token}`), devLogging) &&
      !ignoreLoggingIncomingRequests(devRequest("/agb"), devLogging),
    "next dev protokolliert keine dl-Tokens",
  );
  const stdout = process.stdout.write.bind(process.stdout);
  const captured: string[] = [];
  process.stdout.write = ((chunk: unknown) => {
    captured.push(String(chunk));
    return true;
  }) as typeof process.stdout.write;
  installDlLogRedaction();
  process.stdout.write(`GET /api/schnellversion/pdf?dl=${token}\n`);
  process.stdout.write = stdout;
  ok(!captured.join("").includes(token) && captured.join("").includes("dl=[redacted]"), "Server-stdout schwärzt dl-Tokens");
  const agb = readFileSync("content/legal/agb-v3.md", "utf8");
  const agbSection = (start: string, end: string) => agb.slice(agb.indexOf(start), agb.indexOf(end, agb.indexOf(start)));
  ok(createHash("sha256").update(agbSection("## § 9a ", "## § 10 ")).digest("hex") === "e20dec0e400b806781786247891ee5d6fccba9129538179ace33040dee528511", "Digistore-Abschnitt unverändert");
  ok(createHash("sha256").update(agbSection("## § 15 ", "**Stand:**")).digest("hex") === "77c1058b3757abe18b5f321a1f6fc1182ef904cfa5cdb01f78d3e217844c2f7d", "Altvertrags-Abschnitt unverändert");
  ok(agb.includes("## § 12d Schnellversion (Standard-PDF)"), "AGB enthalten § 12d");
  ok(!readFileSync("content/legal/agb.md", "utf8").includes("§ 12d"), "Legacy-AGB ohne § 12d");
  const agbWoerter = [
    "Im Bestellprozess bestätigen Sie vor der Zahlung ausdrücklich, dass Sie als Unternehmer (§ 14 BGB) für Ihre gewerbliche oder selbstständige berufliche Tätigkeit bestellen.",
    "Daneben bieten wir die Schnellversion an, eine Standardfassung als PDF aus einer Branchenvorlage; für sie gilt vorrangig § 12d.",
    "e) Schnellversion (§ 12d): einmalig 49 € (58,31 € brutto) je Firma für eine Standardfassung als PDF mit 30 Tagen Download.",
    "f) Upgrade aus der Schnellversion (§ 12d Abs. 6): innerhalb von 30 Tagen nach dem Kauf der Schnellversion für dieselbe Firma Option 1 für 50 € (59,50 € brutto) oder Option 2 für 99 € (117,81 € brutto) mit dem Kauf, danach 49 € (58,31 € brutto) pro Jahr.",
    "Das gilt auch für die Schnellversion (§ 12d) und für ein Upgrade nach § 12d Abs. 6.",
    "bei der Schnellversion 49 € zzgl. USt; bei einem Upgrade nach § 12d Abs. 6 den für das Upgrade gezahlten Betrag",
    "Für die Schnellversion gilt dieser § 9 mit der Maßgabe des § 12d Abs. 7.",
    "Das gilt insbesondere für eine Verwendung der Standardfassung der Schnellversion ohne Prüfung, Anpassung, Ergänzung und Freigabe nach § 12d Abs. 2. Abs. 1 und 2 bleiben unberührt.",
    "Bestellen Sie Option 1 als Upgrade aus der Schnellversion (§ 12d Abs. 6), beginnen die 30 Tage mit der Zahlung des Upgrades; maßgeblicher Kauf für Abs. 5 ist das Upgrade.",
    "Eine Anrechnung nach § 12d Abs. 6 findet bei der Reaktivierung nicht statt.",
    "Geben Sie den Firmennamen beim Upgrade so an wie bei der Schnellversion.",
    "Der Preis beträgt einmalig 49 € (58,31 € brutto) je Firma. Ein Abonnement entsteht nicht.",
    "im Kundenkonto (Anmeldung per Magic-Link mit der E-Mail-Adresse der Bestellung).",
    "Eine Standardfassung, die Ihre tatsächlichen Abläufe nicht wiedergibt, ist keine fehlgeschlagene Erstellung im Sinne von § 9 Abs. 2 (Abs. 2).",
  ];
  const agbAn = applyLegalConditions(agb, legalFlagsFor(true, false, false, false, true));
  for (const satz of agbWoerter) ok(agbAn.includes(satz), `AGB 1:1: ${satz.slice(0, 48)}`);
  ok(!agb.includes("[klären") && !agb.includes("[klaeren") && !agb.includes("[Vorschlag"), "AGB ohne Klärvermerk");
  ok(
    !agb.includes("Wird ein Upgrade nach § 12d Abs. 6 nach Abs. 2 erstattet, steht Ihnen die Anrechnung bis zum Ende der ursprünglichen 30 Tage erneut zur Verfügung."),
    "§ 9 Abs. 4 Satz 2 zur Anrechnung bleibt weg",
  );
  ok(readFileSync("components/schnellversion-kauf.tsx", "utf8").includes("PLAN_TERMS_LABEL_BEFORE"), "Checkout bestätigt die AGB");
  ok(readFileSync("components/schnellversion-kauf.tsx", "utf8").includes("{PLAN_OFFER_OBJECTION_NOTICE}"), "Kaufseite zeigt den Widerspruchshinweis");
  ok(readFileSync("components/schnellversion-ui.module.css", "utf8").includes("position: static"), "Hinweis liegt im Textfluss");
  rememberSvEvent({ name: "sv_visit", arm: "", variante: "b", branche_vorlage: "", value: 0, step: 0, ziel: "" });
  const stamped = (await readSvEvents()).find((row) => row.name === "sv_visit" && row.day);
  ok(/^\d{4}-\d{2}-\d{2}$/.test(stamped?.day ?? ""), "Zählzeile trägt einen Tag");
  ok(
    SV_EVENT_COLUMNS.join(",") === "name,arm,variante,branche_vorlage,value,step,ziel,day",
    "Zählspalten ohne Personen-, Kauf- oder Session-Kennung",
  );
  const dse = readFileSync("content/legal/datenschutz-v3.md", "utf8");
  const cookies = readFileSync("content/legal/cookies-v3.md", "utf8");
  const off = legalFlagsFor(true, false);
  const on = legalFlagsFor(true, false, false, false, true);
  ok(!applyLegalConditions(dse, off).includes("Speicherdauer Schnellversion"), "DSE ohne Flag ohne Schnellversion");
  ok(applyLegalConditions(dse, on).includes("löschen wir 12 Monate nach dem Kauf automatisch"), "DSE mit Flag nennt 12 Monate");
  ok(!dse.includes("Rücksprungadresse"), "DSE ohne Satz zur Rücksprungadresse");
  ok(
    dse.includes("Zu den Systemnachrichten gehören auch Hinweise zu einem gespeicherten, noch nicht abgeschlossenen Fragebogen-Entwurf"),
    "Abschnitt 10 behält den Satz zu gespeicherten Fragebogen-Entwürfen",
  );
  ok(applyLegalConditions(cookies, off).includes("laden wir erst") && !applyLegalConditions(cookies, off).includes("sv49_arm"), "Cookies ohne Flag wie bisher");
  ok(applyLegalConditions(cookies, on).includes("sv49_arm") && applyLegalConditions(cookies, on).includes("sv49_answers"), "Cookies mit Flag nennen die Schnellversion");
  const agbOff = applyLegalConditions(agb, off);
  const agbOn = applyLegalConditions(agb, on);
  const mainAgb = execSync("git show 2f44180:content/legal/agb-v3.md", { encoding: "utf8" });
  ok(agbOff === mainAgb, "AGB ohne Flag wie main");
  const verborgen = ["Schnellversion", "§ 12d", "Standardfassung"];
  const llms = llmsOhneSchnellversion(agbOff);
  for (const fund of verborgen) {
    ok(!agbOff.includes(fund), `AGB ohne Flag ohne ${fund}`);
    ok(!applyLegalConditions(dse, off).includes(fund), `Datenschutz ohne Flag ohne ${fund}`);
    ok(!applyLegalConditions(cookies, off).includes(fund), `Cookies ohne Flag ohne ${fund}`);
    ok(!llms.includes(fund), `llms.txt ohne Flag ohne ${fund}`);
  }
  ok(agbOn.includes("Daneben bieten wir die Schnellversion an, eine Standardfassung als PDF aus einer Branchenvorlage; für sie gilt vorrangig § 12d."), "AGB mit Flag behält den freigegebenen Satz");
  ok(!agbOn.includes("[klären"), "AGB mit Flag ohne Klärvermerk");
  const llmsNote = /\[klären|\[klaeren|\[Vorschlag|\bTODO\b/;
  ok(!llmsNote.test(llms), "llms.txt ohne Vermerk");
  ok(llmsNote.test(`${llms}\n[klären: Gegentest]\n`), "Gegentest erkennt einen Vermerk in llms.txt");
  const ohneArm = await openSchnellversionCheckout({
    answers: sample({ firma: "Anrechnung Ohne Arm GmbH" }),
    unternehmer: true,
    bewusst: true,
    agb: true,
    email: "ohne-arm@example.com",
    arm: "test",
    env: stubPaid,
  });
  ok(ohneArm.ok, "Kauf für die Anrechnung ohne Arm");
  const ohneArmPaid = await confirmPaidSession(ohneArm.ok ? ohneArm.sessionId : "", { env: stubPaid });
  ok(ohneArmPaid.paid, "Kauf ohne Arm ist bezahlt");
  const purchase99Before = (await readSvEvents()).filter((row) => row.name === "purchase_99").length;
  if (ohneArmPaid.paid) {
    await noteSchnellversionPurchase(
      { id: "cs_upgrade_ohne_arm", metadata: { sv_purchase_id: ohneArmPaid.purchase.id } },
      "ohne-arm@example.com",
      "evt_ohne_arm",
    );
    await noteSchnellversionPurchase(
      { id: "cs_upgrade_fremd", metadata: { sv_arm: "weder", sv_purchase_id: ohneArmPaid.purchase.id } },
      "ohne-arm@example.com",
      "evt_weder",
    );
  }
  const used = (await listAllSvPurchases()).find((row) => row.id === (ohneArmPaid.paid ? ohneArmPaid.purchase.id : ""));
  ok(Boolean(used?.creditUsedAt.trim()), "Anrechnung ohne Arm setzt creditUsedAt");
  const afterWindow = new Date(Date.now() + 31 * 60 * 1000);
  ok(
    used ? !(await reserveSvCredit(used.id, "zweite-nach-30-min", afterWindow)) : false,
    "zweite Reservierung nach 30 Minuten schlägt fehl",
  );
  const purchase99After = (await readSvEvents()).filter((row) => row.name === "purchase_99").length;
  ok(purchase99After === purchase99Before, "ohne Arm bleibt die Testarm-Verbuchung aus");

  await checkSandboxCheckout();
  checkPreviewDataGate();
  console.log("check-schnellversion: ok");
}

async function checkSandboxCheckout(): Promise<void> {
  const raw = {
    spreadsheets: {
      get: async () => ({ data: { sheets: [{ properties: { title: "schnellversion_49" } }] } }),
      batchUpdate: async () => undefined,
      values: {
        get: async () => ({ data: { values: [["name"]] } }),
        append: async () => undefined,
      },
    },
  };
  let thrown = "";
  try {
    (raw as { get?: () => void }).get?.();
    (raw as unknown as { get: () => void }).get();
  } catch (error) {
    thrown = error instanceof Error ? error.message : "";
  }
  ok(/get is not a function/.test(thrown), "Google-Client: get is not a function");
  ok(typeof adaptSvSheetClient(raw).get === "function", "Adapter ruft spreadsheets.get");

  const token = "tok-sandbox";
  const session = {
    id: "cs_test_sv_sandbox",
    payment_status: "paid" as const,
    metadata: {
      sv49: "1",
      sv_pending: "pending-sandbox",
      company: "Sandbox GmbH",
      product: "schnellversion-49",
    },
  };
  await saveSvPending({
    id: session.metadata.sv_pending,
    answers: sample({ firma: "Sandbox GmbH" }),
    consentAt: now.toISOString(),
    email: "buyer@example.com",
    createdAt: now.toISOString(),
    sessionId: session.id,
    paid: false,
    downloadTokenHash: hashDownloadToken(token),
    downloadToken: token,
    arm: "test",
  });
  installSvEventSheetForTest({ client: adaptSvSheetClient(raw), configured: true });
  resetSvPdfBuildsForTest();
  const savedFlag = process.env.SCHNELLVERSION_49_ENABLED;
  const savedModel = process.env.PRICING_MODEL;
  process.env.SCHNELLVERSION_49_ENABLED = "1";
  process.env.PRICING_MODEL = "v3";
  const proof = { status: "paid" as const, pendingId: session.metadata.sv_pending };
  const first = await confirmPaidSession(session.id, proof);
  const second = await confirmPaidSession(session.id, proof);
  ok(first.paid && second.paid && first.paid && second.paid && first.purchase.id === second.purchase.id, "Webhook-Wiederholung verbucht den Kauf einmal");
  ok(svPdfBuildsForTest() === 1, "PDF wird einmal erzeugt");
  const status = await statusGet(new NextRequest(`http://local/api/schnellversion/status?session_id=${session.id}`));
  const body = await status.json() as { state?: string };
  ok(status.status === 200 && body.state === "paid" && svPdfBuildsForTest() === 1, "Status-Poll schreibt kein PDF");
  const onlySession = await pdfGet(new NextRequest(`http://local/api/schnellversion/pdf?session_id=${session.id}`));
  ok(onlySession.status === 401, "session_id allein gibt kein PDF frei");
  const withToken = await pdfGet(new NextRequest(`http://local/api/schnellversion/pdf?dl=${token}`));
  ok(withToken.status !== 500, "PDF-Route fängt Fehler ab");
  installSvEventSheetForTest(null);
  const upgraded = buildPlanCheckoutParams({
    kind: "entry",
    member: false,
    email: "buyer@example.com",
    company: "Sandbox GmbH",
    svCoupon: "schnell_49_anrechnung",
    svPurchaseId: first.paid ? first.purchase.id : "",
    prices: { entry: "price_test_entry", year: "price_test_year", addonYear: "price_test_addon" },
  });
  ok(upgraded.discounts?.[0]?.coupon === "schnell_49_anrechnung", "Upgrade-Checkout setzt den Anrechnungs-Coupon");
  const hintRow = first.paid ? first.purchase : null;
  ok(hintRow ? !creditHintVisible(hintRow, hintRow.company, now, {}) : false, "ohne Coupon-ID kein Anrechnungs-Hinweis");
  ok(
    hintRow ? creditHintVisible(hintRow, hintRow.company, now, { STRIPE_COUPON_SCHNELL_49_ANRECHNUNG: "schnell_49_anrechnung" }) : false,
    "Hinweis nur mit Coupon für dieselbe Firma",
  );
  if (savedFlag === undefined) delete process.env.SCHNELLVERSION_49_ENABLED;
  else process.env.SCHNELLVERSION_49_ENABLED = savedFlag;
  if (savedModel === undefined) delete process.env.PRICING_MODEL;
  else process.env.PRICING_MODEL = savedModel;
}

/** buildLlmsTxt liest die AGB beim Import aus process.env. Hier gilt das explizit ausgeschaltete Flag. */
function llmsOhneSchnellversion(agbQuiet: string): string {
  let text = buildLlmsTxt();
  if (!isPricingV2()) return text;
  const headings = [
    "§ 8 Kein Widerrufsrecht (B2B)",
    "§ 9 Erstattung",
    "§ 12 Jahrespaket (Option 2): Inhalt, Laufzeit und Kündigung",
  ];
  for (const heading of headings) {
    text = text.replace(markdownH2Section(agbMarkdown, heading), markdownH2Section(agbQuiet, heading));
  }
  return text;
}

function checkPreviewDataGate(): void {
  const sheets = {
    GOOGLE_SERVICE_ACCOUNT_EMAIL: "sheets@example.com",
    GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: "key",
    GOOGLE_SHEETS_SPREADSHEET_ID: "sheet-prod",
  };
  const prodBlob = {
    BLOB_READ_WRITE_TOKEN: "vercel_blob_rw_prodstore_secret",
    BLOB_STORE_ID: "store_prodstore",
  };
  const prod = { VERCEL_ENV: "production", ...prodBlob, ...sheets };
  ok(svBlobWritesOpen(prod) && svSheetWritesOpen(prod) && svPreviewTestTarget(prod) === null, "Prod: Blob und Sheet an wie bisher");

  const preview = { VERCEL_ENV: "preview", ...prodBlob, ...sheets };
  ok(!svBlobWritesOpen(preview) && !svSheetWritesOpen(preview), "Preview ohne GOBD_DATA_ENV: aus");

  const testBase = { ...preview, GOBD_DATA_ENV: "test", GOBD_TEST_BLOB_STORE_ID: "teststore", GOBD_TEST_SPREADSHEET_ID: "sheet-test" };
  ok(!svBlobWritesOpen({ ...testBase, GOBD_TEST_BLOB_STORE_ID: "" }), "Preview mit test, Test-Store fehlt: aus");
  ok(!svBlobWritesOpen({ ...testBase, GOBD_TEST_SPREADSHEET_ID: " " }), "Preview mit test, Test-Sheet fehlt: aus");
  ok(
    !svBlobWritesOpen({ ...testBase, GOBD_TEST_SPREADSHEET_ID: "sheet-prod" }) &&
      !svSheetWritesOpen({ ...testBase, GOBD_TEST_BLOB_STORE_ID: "prodstore" }),
    "Preview mit test und Test-ID gleich der Prod-ID: aus",
  );

  const distinct = svPreviewTestTarget(testBase);
  ok(
    svBlobWritesOpen(testBase) &&
      svSheetWritesOpen(testBase) &&
      distinct?.mode === "store" &&
      distinct.spreadsheetId === "sheet-test" &&
      distinct.blobStoreId === "teststore",
    "Preview mit test und gültigen, verschiedenen Test-IDs: an",
  );

  const declared = {
    ...sheets,
    VERCEL_ENV: "preview",
    GOBD_DATA_ENV: "test",
    GOOGLE_SHEETS_SPREADSHEET_ID: "sheet-test",
    GOBD_TEST_SPREADSHEET_ID: "sheet-test",
    GOBD_TEST_BLOB_STORE_ID: "teststore",
    BLOB_READ_WRITE_TOKEN: "vercel_blob_rw_teststore_secret",
    BLOB_STORE_ID: "store_teststore",
  };
  const declaredTarget = svPreviewTestTarget(declared);
  ok(
    svBlobWritesOpen(declared) &&
      svSheetWritesOpen(declared) &&
      declaredTarget?.mode === "token" &&
      declaredTarget.spreadsheetId === "sheet-test" &&
      declaredTarget.blobStoreId === "teststore",
    "Preview mit test, aktive Zugangsdaten sind die Test-IDs: an",
  );
  ok(
    !svBlobWritesOpen({ ...declared, BLOB_STORE_ID: "store_prodstore" }),
    "Preview mit test und widersprüchlichem Blob-Store: aus",
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
