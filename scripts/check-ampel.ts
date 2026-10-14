/**
 * Betriebsprüfungs-Ampel: weighted score, green cap, and the DOI token.
 *
 *   npx tsx scripts/check-ampel.ts
 */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { AMPEL_QUESTIONS, AMPEL_RESULTS, AMPEL_H1, AMPEL_DISCLAIMER, AMPEL_SHARE_KANZLEI, AMPEL_CTA, AMPEL_INTRO, AMPEL_EMAIL_PRIVACY_NOTE, AMPEL_MARKETING_CONSENT, AMPEL_PRIVACY_PARAGRAPHS, AMPEL_PRIVACY_TITLE, AMPEL_CONSENT_TEXT_VERSION, AMPEL_RESULT_REGISTER_LINE, AMPEL_RESULT_MAIL } from "@/lib/ampel-questions";
import {
  AMPEL_CONFIRM_WINDOW_MS,
  AMPEL_DOI_TTL_MS,
  createAmpelDoiToken,
  toAmpelReadinessLead,
  verifyAmpelDoiToken,
} from "@/lib/ampel";
import {
  ampelLightForScore,
  ampelMaxWeight,
  decodeAmpelAnswers,
  encodeAmpelAnswers,
  publicAmpelSource,
  sanitizeAmpelRef,
  scoreAmpel,
  type AmpelAnswerMap,
} from "@/lib/ampel-score";
import type { AmpelAnswer } from "@/lib/ampel-questions";
import { buildAmpelConfirmationMail, buildAmpelResultMail } from "@/lib/ampel-mail";
import { buildAmpelPdfMail, buildAmpelResultPdf } from "@/lib/ampel-pdf";
import {
  AMPEL_EMAIL_LIMIT,
  AMPEL_EMAIL_WINDOW_MS,
  AMPEL_IP_LIMIT,
  AMPEL_IP_WINDOW_MS,
  AMPEL_RATE_RETENTION_DAYS,
  createFileAmpelRateStore,
  createMemoryAmpelRateStore,
  pruneAmpelRateLedger,
} from "@/lib/ampel-rate-limit";
import { AMPEL_PDF_FROM, submitAmpelResult } from "@/lib/ampel-result-send";
import { setMailDedupeTestHooks } from "@/lib/mail-dedupe";
import { AMPEL_RESULT_RETRY_DELAYS_MS, confirmAmpelDoi, requestAmpelConfirmation } from "@/lib/ampel-confirm";
import {
  AMPEL_CHECK_RETENTION_DAYS,
  AMPEL_UNCONFIRMED_OPT_IN_RETENTION_DAYS,
  ampelRecordExpired,
} from "@/lib/ampel-retention";
import { withdrawAmpelMarketing } from "@/lib/ampel-unsubscribe";
import { createAmpelUnsubscribeToken } from "@/lib/ampel";
import { isTransientResendError, MAIL_SEND_RETRY_DELAYS_MS, type MailResult } from "@/lib/mail";
import type { ReadinessLead } from "@/lib/readiness";
import { READINESS_SHEET_COLUMNS } from "@/lib/readiness";
import { INDEXABLE_STATIC_PATHS } from "@/lib/seo";

function fail(message: string): never {
  console.error(`check-ampel: ${message}`);
  process.exit(1);
}

function assertOk(condition: unknown, message: string): void {
  if (!condition) fail(message);
}

function answers(map: Record<string, AmpelAnswer>): AmpelAnswerMap {
  const full: AmpelAnswerMap = {};
  for (const question of AMPEL_QUESTIONS) {
    const value = map[question.id];
    if (value !== "ja" && value !== "nein" && value !== "nicht_zutreffend") {
      fail(`missing answer for ${question.id}`);
    }
    full[question.id] = value;
  }
  return full;
}

function all(answer: AmpelAnswer, overrides: Record<string, AmpelAnswer> = {}): AmpelAnswerMap {
  const map: Record<string, AmpelAnswer> = {};
  for (const question of AMPEL_QUESTIONS) map[question.id] = answer;
  return answers({ ...map, ...overrides });
}

const savedSecret = process.env.MAGIC_LINK_SECRET;
if (!process.env.MAGIC_LINK_SECRET?.trim()) {
  process.env.MAGIC_LINK_SECRET = "check-ampel-offline-secret";
}

async function main() {
try {
  assertOk(AMPEL_QUESTIONS.length === 10, "ten questions");
  assertOk(ampelMaxWeight() === 22, "weights sum to 22");
  assert.deepEqual(
    AMPEL_QUESTIONS.filter((question) => question.applicable === "optional").map((question) => question.id),
    ["kasse_tse", "scannen"],
    "only cash register and scanning can be excluded",
  );
  assert.deepEqual(
    AMPEL_QUESTIONS.filter((question) => question.weight === 3).map((question) => question.id),
    ["vd_vorhanden", "kasse_tse", "aufbewahrung"],
  );
  assert.deepEqual(AMPEL_RESULTS.gruen.range, [80, 100]);
  assert.deepEqual(AMPEL_RESULTS.gelb.range, [50, 79]);
  assert.deepEqual(AMPEL_RESULTS.rot.range, [0, 49]);
  assertOk(ampelLightForScore(100) === "gruen", "100 is green");
  assertOk(ampelLightForScore(80) === "gruen", "80 is green");
  assertOk(ampelLightForScore(79) === "gelb", "79 is yellow");
  assertOk(ampelLightForScore(50) === "gelb", "50 is yellow");
  assertOk(ampelLightForScore(49) === "rot", "49 is red");
  assertOk(ampelLightForScore(0) === "rot", "0 is red");

  const perfect = scoreAmpel(all("ja"));
  assertOk(perfect?.yesWeight === 22 && perfect.applicableWeight === 22, "all yes uses 22");
  assertOk(perfect?.score === 100 && perfect.light === "gruen" && perfect.capped === false, "all yes is green");

  const excluded = scoreAmpel(all("ja", { kasse_tse: "nicht_zutreffend", scannen: "nicht_zutreffend" }));
  assertOk(
    excluded?.yesWeight === 18 && excluded.applicableWeight === 18 && excluded.score === 100 && excluded.light === "gruen",
    "Trifft nicht zu drops cash register and scanning from the score",
  );

  const scanNo = scoreAmpel(all("ja", { scannen: "nein" }));
  const scanSkip = scoreAmpel(all("ja", { scannen: "nicht_zutreffend" }));
  assertOk(scanNo?.score === 95 && scanNo.applicableWeight === 22, "a no on scanning still counts");
  assertOk(scanSkip?.score === 100 && scanSkip.applicableWeight === 21, "Trifft nicht zu on scanning does not count");

  for (const id of ["vd_vorhanden", "kasse_tse", "aufbewahrung"] as const) {
    const capped = scoreAmpel(all("ja", { [id]: "nein" }));
    assertOk(capped?.score === 86, `${id} no scores 86`);
    assertOk(ampelLightForScore(capped?.score ?? 0) === "gruen", `${id} would be green on the percentage alone`);
    assertOk(capped?.light === "gelb" && capped.capped === true, `${id} no caps green at yellow`);
  }

  const low = scoreAmpel(
    all("nein", { kasse_tse: "ja", aufbewahrung: "ja", scannen: "ja" }),
  );
  assertOk(low?.light === "rot" && low.capped === false, "a weight-3 no does not lift red to yellow");

  const yellowEdge = scoreAmpel(
    all("nein", {
      vd_vorhanden: "ja",
      vd_aktuell: "ja",
      kasse_tse: "ja",
      aufbewahrung: "ja",
    }),
  );
  assertOk(yellowEdge?.yesWeight === 11 && yellowEdge.score === 50 && yellowEdge.light === "gelb", "50 stays yellow");

  const redEdge = scoreAmpel(
    all("nein", { vd_vorhanden: "ja", kasse_tse: "ja", aufbewahrung: "ja", scannen: "ja" }),
  );
  assertOk(redEdge?.yesWeight === 10 && redEdge.score === 45 && redEdge.light === "rot", "45 is red");

  const seventyNine = scoreAmpel(
    all("ja", { kasse_tse: "nicht_zutreffend", vd_aktuell: "nein", unveraenderbarkeit: "nein" }),
  );
  assertOk(
    seventyNine?.applicableWeight === 19 && seventyNine.score === 79 && seventyNine.light === "gelb" && !seventyNine.capped,
    "79 is yellow and an excluded cash register does not cap",
  );

  assertOk(scoreAmpel(all("ja", { vd_vorhanden: "nicht_zutreffend" })) === null, "required questions cannot be excluded");
  assertOk(encodeAmpelAnswers(all("ja", { belegfluss: "nicht_zutreffend" })) === null, "encoder rejects exclusion of a required question");
  assertOk(decodeAmpelAnswers("JJJJJJJJJ") === null, "short codes are rejected");
  assertOk(decodeAmpelAnswers("JJJJJJJJJX") === null, "X on Belegfluss is rejected");
  const roundTrip = encodeAmpelAnswers(all("ja", { kasse_tse: "nicht_zutreffend", scannen: "nein" }));
  assertOk(roundTrip === "JJXJJJJNJJ", "answer code order follows the question list");
  assert.deepEqual(decodeAmpelAnswers("jjxjjjjnjj"), all("ja", { kasse_tse: "nicht_zutreffend", scannen: "nein" }));

  const reviewMarker = "[" + "prüfen" + "]";
  const questionFile = readFileSync("lib/ampel-questions.ts", "utf8");
  assertOk(!questionFile.includes(reviewMarker), "config has no review marker");
  assertOk(!questionFile.includes("TODO(ampel-quellen)"), "review TODOs are removed");
  assertOk(
    questionFile.includes(
      "BMF-Schreiben vom 28.06.2024 (IV D 2 – S 0316-a/19/10011 :009) zur Mitteilungspflicht nach § 146a Abs. 4 AO",
    ),
    "kasse citation is verified",
  );
  assertOk(
    questionFile.includes(
      "§ 147 Abs. 1 und Abs. 3 AO i. d. F. des Vierten Bürokratieentlastungsgesetzes (BGBl. 2024 I Nr. 323); Übergangsregel Art. 97 § 19a Abs. 2 und 3 EGAO; GoBD Rz. 113 ff.",
    ),
    "retention citation is verified",
  );
  assertOk(
    questionFile.includes(
      "GoBD Rz. 158–178 i. d. F. vom 14.07.2025 (Z1 unmittelbarer Datenzugriff: Rz. 165; Z2 mittelbarer Datenzugriff: Rz. 166; Z3 Datenüberlassung: Rz. 167)",
    ),
    "data access citation is verified",
  );
  assertOk(
    questionFile.includes("GoBD Rz. 130 und Rz. 136–141; § 147 Abs. 2 AO; BSI TR-03138 (TR-RESISCAN)"),
    "scanning citation is verified",
  );
  assertOk(
    questionFile.includes(
      "BMF-Schreiben vom 15.10.2024 (BStBl I S. 1320) und vom 15.10.2025 zur E-Rechnung; GoBD Rz. 118, 119 und 131 i. d. F. vom 14.07.2025",
    ),
    "e-invoice citation is verified",
  );
  assertOk(
    questionFile.includes("GoBD Rz. 152, Rz. 67–70 (Belegsicherung); § 146 Abs. 1 AO"),
    "document-flow citation is verified",
  );
  assertOk(
    questionFile.includes("Seit dem 01.01.2025 steht für die Mitteilung an das Finanzamt das Verfahren über „Mein ELSTER“ zur Verfügung."),
    "kasse explanation names Mein ELSTER",
  );
  assertOk(
    questionFile.includes("oder als Datenüberlassung, zum Beispiel auf einem Datenträger?"),
    "data access question names Datenüberlassung",
  );
  assertOk(
    questionFile.includes("Den Bildteil einer hybriden Rechnung bewahren Sie zusätzlich auf"),
    "e-invoice explanation keeps the image part when it carries further tax details",
  );
  const quellenPage = readFileSync("app/ampel-check/quellen/page.tsx", "utf8");
  assertOk(quellenPage.includes("AMPEL_ABBREVIATIONS"), "sources page shows the abbreviations");
  assertOk(quellenPage.includes("AMPEL_SOURCE_ROWS"), "sources page shows the source table");
  assertOk(questionFile.includes("Abkürzungen: GoBD = BMF-Schreiben vom 28.11.2019"), "abbreviations name the 2019 GoBD writing");
  assertOk(questionFile.includes("BMF-Schreiben vom 15.10.2025 (III C 2 – S 7287-a/00019/007/243)"), "2025 e-invoice writing is a source row");
  assertOk(!questionFile.includes(reviewMarker) && !quellenPage.includes(reviewMarker), "sources page has no review marker");
  for (const question of AMPEL_QUESTIONS) {
    const shown = publicAmpelSource(question.source);
    assertOk(!/prüfen/i.test(shown), `public source hides review notes for ${question.id}`);
    assertOk(!shown.includes("["), `public source has no bracket note for ${question.id}`);
    assertOk(question.explanation.trim().length > 0 && question.source.trim().length > 0, `${question.id} has explanation and source`);
  }

  assertOk(sanitizeAmpelRef("  Kanzlei Müller & Partner!! ") === "Kanzlei Müller Partner", "ref keeps a readable kanzlei name");
  assertOk(sanitizeAmpelRef("x".repeat(120)).length === 80, "ref is capped");

  const now = 1_700_000_000_000;
  const token = createAmpelDoiToken(
    {
      email: "Mandant@Kanzlei.example",
      answers: roundTrip ?? "",
      ref: "Kanzlei Müller",
      consentAt: "2026-10-13T08:00:00.000Z",
    },
    now,
  );
  assertOk(token, "token is signed");
  const verified = verifyAmpelDoiToken(token, now + AMPEL_DOI_TTL_MS);
  assertOk(verified?.email === "mandant@kanzlei.example", "token email is normalized");
  assertOk(verified?.answers === roundTrip, "token keeps answers");
  assertOk(verified?.ref === "Kanzlei Müller", "token keeps the ref");
  assertOk(verified?.consentAt === "2026-10-13T08:00:00.000Z", "token keeps the consent time");
  assertOk(verifyAmpelDoiToken(token, now + AMPEL_DOI_TTL_MS + 1) === null, "expired token is rejected");
  assertOk(verifyAmpelDoiToken(`${token}x`, now) === null, "tampered token is rejected");
  assertOk(verifyAmpelDoiToken("not-a-token", now) === null, "garbage token is rejected");
  const [body, sig] = (token ?? "").split(".");
  assertOk(verifyAmpelDoiToken(`${body}.${sig?.slice(1)}`, now) === null, "short signature is rejected");

  const lead = toAmpelReadinessLead({
    email: "mandant@kanzlei.example",
    answers: roundTrip ?? "",
    ref: "Kanzlei Müller",
    consentAt: "2026-10-13T08:00:00.000Z",
    doiConfirmedAt: "2026-10-13T09:00:00.000Z",
    score: 95,
    light: "gruen",
    mailStatus: "sent",
  });
  assertOk(lead.status === "ampel_doi_confirmed", "lead status marks the ampel");
  assertOk(lead.consentAt === "2026-10-13T08:00:00.000Z", "lead stores consent time");
  assertOk(lead.doiConfirmedAt === "2026-10-13T09:00:00.000Z", "lead stores DOI time");
  assertOk(lead.advisorRef === "Kanzlei Müller", "lead stores the ref");
  assertOk(lead.ampelAnswers === roundTrip && lead.ampelScore === "95" && lead.ampelLight === "gruen", "lead stores the result");
  assertOk(lead.leadId.startsWith("ampel-"), "lead id is stable and namespaced");
  assertOk(
    READINESS_SHEET_COLUMNS.includes("consent_at") && READINESS_SHEET_COLUMNS.includes("doi_confirmed_at"),
    "readiness sheet can store both timestamps",
  );

  const payload = verifyAmpelDoiToken(token, now);
  assertOk(payload, "payload for mail");
  const confirmation = buildAmpelConfirmationMail({ confirmUrl: "https://www.gobd-doku-erstellen.de/ampel-check/bestaetigen?token=abc" });
  const resultMail = payload ? buildAmpelResultMail(payload) : null;
  assertOk(resultMail, "result mail");
  assertOk(!confirmation.text.includes(reviewMarker) && !confirmation.html.includes(reviewMarker), "confirmation mail hides review notes");
  assertOk(!resultMail?.text.includes(reviewMarker) && !resultMail?.html.includes(reviewMarker), "result mail hides review notes");
  assertOk(!confirmation.text.includes(AMPEL_RESULTS.gruen.headline), "confirmation mail does not send the result");
  assertOk(resultMail?.text.includes("95 von 100"), "result mail states the score");
  assertOk(confirmation.text.includes("keine weiteren E-Mails"), "confirmation mail is the optional extra consent");
  assertOk(!confirmation.text.includes("erst nach dieser Bestätigung"), "confirmation mail does not withhold the PDF");
  assertOk(AMPEL_CONFIRM_WINDOW_MS === 15 * 60 * 1000, "one confirmation per email per 15 minutes");
  const confirmRoute = readFileSync("app/api/ampel/confirm/route.ts", "utf8");
  assertOk(confirmRoute.includes("AMPEL_CONFIRM_WINDOW_MS") === false, "window constant stays in the mail helper");
  assertOk(confirmRoute.includes("requestAmpelConfirmation"), "confirmation route stores the lead and retries");
  assertOk(confirmRoute.includes("fresh: true"), "confirmation reads the lead past the sheet cache");
  assertOk(!confirmRoute.includes("mail.inflight"), "an in-flight confirmation is not success");
  assertOk(
    confirmRoute.includes("Die Bestätigungsmail konnte gerade nicht gesendet werden."),
    "confirmation failure keeps the same error",
  );
  const mailSource = readFileSync("lib/ampel-mail.ts", "utf8");
  assertOk(mailSource.includes("windowMs: AMPEL_CONFIRM_WINDOW_MS"), "confirmation send is throttled");
  assertOk(!readFileSync("app/ampel-check/bestaetigen/confirm-panel.tsx", "utf8").includes("trackLeadSubmit"), "DOI confirm does not fire the lead event");
  assertOk(
    readFileSync("app/ampel-check/ampel-check.tsx", "utf8").includes('trackLeadSubmit({ value: 1, currency: "EUR" })'),
    "the email step fires the lead event",
  );
  assertOk(INDEXABLE_STATIC_PATHS.includes("/ampel-check"), "sitemap source lists the page");
  assertOk(readFileSync("components/site-footer.tsx", "utf8").includes('href="/ampel-check"'), "footer links the page");
  const page = readFileSync("app/ampel-check/ampel-check.tsx", "utf8");
  const resultView = readFileSync("components/ampel-result.tsx", "utf8");
  assertOk(page.includes("AMPEL_H1") && page.includes("AMPEL_INTRO"), "page renders the Growth H1 and intro");
  assertOk(page.includes("AMPEL_SHARE_KANZLEI") && page.includes("AMPEL_RESULT_MAIL"), "page renders share and DOI copy");
  assertOk(resultView.includes("AMPEL_CTA") && resultView.includes("AMPEL_DISCLAIMER") && resultView.includes("AMPEL_CAP_NOTE"), "result renders CTA, disclaimer and the cap note");
  assertOk(AMPEL_CTA.button.length > 0 && AMPEL_INTRO.length > 0, "CTA and intro are present");
  assertOk(AMPEL_SHARE_KANZLEI.message.includes("{link}"), "share text has a link placeholder");
  assertOk(!page.includes(reviewMarker) && !readFileSync("components/ampel-result.tsx", "utf8").includes(reviewMarker), "pages do not render review markers");

  const doiRoute = readFileSync("app/api/ampel/bestaetigen/route.ts", "utf8");
  assertOk(doiRoute.includes("confirmAmpelDoi"), "confirm route uses the idempotent confirm");
  assertOk(doiRoute.includes("fresh: true"), "confirm reads the lead past the sheet cache");
  assertOk(doiRoute.includes("Das Ergebnis konnte gerade nicht gesendet werden."), "mail failure keeps the same error");
  const panel = readFileSync("app/ampel-check/bestaetigen/confirm-panel.tsx", "utf8");
  assertOk(!panel.includes("trackLeadSubmit"), "DOI confirm does not fire the lead event");
  const submittedAt = page.indexOf("!response.ok || !data.ok || data.honeypot");
  const leadTrackAt = page.indexOf('trackLeadSubmit({ value: 1, currency: "EUR" })');
  assertOk(submittedAt >= 0 && leadTrackAt > submittedAt, "lead event fires only after the email submit succeeds");
  assertOk(!page.includes("KE_4CP3UoZwdENaBzZcC"), "the lead label stays in the environment");
  assertOk(page.includes("/api/ampel/ergebnis") && !page.includes("/api/ampel/confirm"), "the check posts the PDF request");
  assertOk(page.includes("noValidate") && page.includes("fax_number"), "the form validates in page and keeps a honeypot");
  assertOk(page.includes("AMPEL_EMAIL_PRIVACY_NOTE") && page.includes("AMPEL_MARKETING_CONSENT"), "privacy note and checkbox are rendered");
  assertOk(page.includes('href="/datenschutz"'), "the privacy note links to the privacy policy");
  assertOk(!page.includes("TODO") && !page.includes("[klären"), "the check does not show draft markers");
  const privacyPage = readFileSync("app/datenschutz/page.tsx", "utf8");
  assertOk(privacyPage.includes("AMPEL_PRIVACY_TITLE") && privacyPage.includes("AMPEL_PRIVACY_PARAGRAPHS"), "privacy page renders the ampel section");
  assertOk(!privacyPage.includes("TODO") && !privacyPage.includes("[klären"), "privacy page source has no draft marker");
  assertOk(AMPEL_EMAIL_PRIVACY_NOTE.startsWith("Wir senden Ihnen Ihr Ergebnis zusätzlich als PDF"), "email note is the legal text");
  assertOk(AMPEL_MARKETING_CONSENT.startsWith("Ja, ich möchte per E-Mail Informationen"), "checkbox is the legal text");
  assertOk(AMPEL_CONSENT_TEXT_VERSION === "2026-10-14", "checkbox text is versioned");
  assertOk(AMPEL_PRIVACY_TITLE === "Ampel-Check: Versand des Ergebnisses und E-Mail-Informationen", "privacy subsection title");
  const privacyText = AMPEL_PRIVACY_PARAGRAPHS.join("\n");
  const abuseAt = privacyText.indexOf("Schutz vor Missbrauch:");
  const storageAt = privacyText.indexOf("Speicherdauer:");
  assertOk(abuseAt >= 0 && storageAt === privacyText.indexOf("\n", abuseAt) + 1, "abuse paragraph sits directly before the storage paragraph");
  assertOk(privacyText.slice(abuseAt, storageAt).includes("Art. 6 Abs. 1 lit. f DSGVO"), "abuse paragraph is the legal text");
  assertOk(!privacyText.includes("[klären") && !privacyText.includes("7 Tagen"), "open legal items are not published");
  const questionsSource = readFileSync("lib/ampel-questions.ts", "utf8");
  assertOk(questionsSource.includes("[klären:"), "open legal items stay visible in the source");
  assertOk(
    questionsSource.includes("[klären: Frist, z. B. 7 Tagen]"),
    "the open rate-limit period stays in the source",
  );
  assertOk(readFileSync("content/legal/datenschutz.md", "utf8").includes("Resend (Plus Five Five, Inc., USA)"), "processors section names Resend");
  assertOk(readFileSync("app/api/ampel/ergebnis/route.ts", "utf8").includes("submitAmpelResult"), "result route sends the PDF");
  const pdfSource = readFileSync("lib/ampel-pdf.ts", "utf8");
  assertOk(!pdfSource.includes("AMPEL_CTA") && !pdfSource.includes("149"), "the PDF mail has no offer and no price");
  const tracking = readFileSync("lib/tracking.ts", "utf8");
  assertOk(tracking.includes("export function trackAmpelStart") && tracking.includes("export function trackAmpelResult"), "ampel events exist");
  assertOk(tracking.includes('trackAmpelGaEvent("ampel_start")') && tracking.includes('trackAmpelGaEvent("ampel_result")'), "ampel events are GA4 events");
  assertOk(tracking.includes("if (!hasMarketingConsent() || ampelStartTracked) return;"), "ampel start is consent-gated");
  assertOk(tracking.includes("if (!hasMarketingConsent() || ampelResultTracked) return;"), "ampel result is consent-gated");
  assertOk(!tracking.includes("NEXT_PUBLIC_AMPEL"), "ampel tracking adds no env var");
  assertOk(page.includes("trackAmpelStart()") && page.includes("trackAmpelResult()"), "the check tracks the first answer and the result");
  assertOk(page.includes('trackLeadSubmit({ value: 1, currency: "EUR" })'), "the email step fires the lead event");

  const consentAt = "2026-10-13T08:00:00.000Z";
  const confirmNow = 1_700_000_000_000;
  const code = encodeAmpelAnswers(all("ja"));
  const confirmToken = createAmpelDoiToken(
    { email: "Mandant@Kanzlei.example", answers: code ?? "", ref: "Kanzlei", consentAt },
    confirmNow,
  );
  assertOk(confirmToken, "confirm test token");

  function leadStore() {
    const leads = new Map<string, ReadinessLead>();
    const delays: number[] = [];
    return {
      leads,
      delays,
      deps(sendResult: (payload: { email: string }) => Promise<MailResult>) {
        return {
          now: () => confirmNow,
          sleep: async (ms: number) => {
            delays.push(ms);
          },
          findLead: async (leadId: string) => leads.get(leadId) ?? null,
          saveLead: async (lead: ReadinessLead) => {
            leads.set(lead.leadId, { ...lead });
          },
          sendResult,
        };
      },
    };
  }

  const retry = leadStore();
  let retrySends = 0;
  const retried = await confirmAmpelDoi(
    confirmToken ?? "",
    retry.deps(async () => {
      retrySends += 1;
      if (retrySends < 3) return { stub: false, sent: false };
      return { stub: false, sent: true, id: "mail-1" };
    }),
  );
  assertOk(retried.ok && retried.alreadySent === false, "a transient mail failure retries and then succeeds");
  assertOk(retrySends === 3, "result mail retries before the error");
  assert.deepEqual(retry.delays, [400, 1200], "retries wait with backoff");
  const recorded = [...retry.leads.values()][0];
  assertOk(recorded?.doiConfirmedAt && recorded.mailStatus === "sent", "confirmed lead records the sent mail");
  const second = await confirmAmpelDoi(
    confirmToken ?? "",
    retry.deps(async () => {
      retrySends += 1;
      return { stub: false, sent: true };
    }),
  );
  assertOk(second.ok && second.alreadySent, "a sent lead succeeds without another mail");
  assertOk(retrySends === 3, "the second confirm does not send");

  const failed = leadStore();
  let failedSends = 0;
  const failure = await confirmAmpelDoi(
    confirmToken ?? "",
    failed.deps(async () => {
      failedSends += 1;
      return { stub: false, sent: false, duplicate: true, inflight: true };
    }),
  );
  assertOk(!failure.ok && failure.reason === "mail" && failure.status === 503, "an in-flight claim is not success");
  assertOk(failedSends === AMPEL_RESULT_RETRY_DELAYS_MS.length, "in-flight waits through every attempt");
  assertOk([...failed.leads.values()][0]?.mailStatus === "pending", "a failed confirm stays pending");

  const joined = leadStore();
  let joinedSends = 0;
  const joinedDeps = joined.deps(async () => {
    joinedSends += 1;
    return { stub: false, sent: true, id: "mail-2" };
  });
  const [left, right] = await Promise.all([
    confirmAmpelDoi(confirmToken ?? "", joinedDeps),
    confirmAmpelDoi(confirmToken ?? "", joinedDeps),
  ]);
  assertOk(left.ok && right.ok, "a double click shares one confirmation");
  assertOk(joinedSends === 1, "a double click sends one result mail");

  const blind = leadStore();
  let blindSends = 0;
  const blinded = await confirmAmpelDoi(confirmToken ?? "", {
    ...blind.deps(async () => {
      blindSends += 1;
      return { stub: false, sent: true };
    }),
    saveLead: async () => {
      throw new Error("sheets");
    },
  });
  assertOk(blinded.ok && blindSends === 1, "a sheet write error does not hide a sent mail");
  assertOk(await confirmAmpelDoi("not-a-token", blind.deps(async () => ({ stub: false, sent: true }))).then((result) => !result.ok && result.reason === "invalid"), "a bad token does not send");

  assert.deepEqual([...MAIL_SEND_RETRY_DELAYS_MS], [0, 200, 600], "Resend retries a dropped connection with backoff");
  assertOk(isTransientResendError({ statusCode: null }), "an unresolved fetch is retried");
  assertOk(isTransientResendError({ statusCode: 503 }) && isTransientResendError({ statusCode: 429 }), "503 and 429 are retried");
  assertOk(
    !isTransientResendError({ statusCode: 400 }) &&
      !isTransientResendError({ statusCode: 401 }) &&
      !isTransientResendError({ statusCode: 403 }) &&
      !isTransientResendError({ statusCode: 422 }) &&
      !isTransientResendError(null),
    "validation and auth errors are not retried",
  );
  const sender = readFileSync("lib/mail.ts", "utf8");
  assertOk(
    sender.includes(["await resend", "emails", "send(payload, options)"].join(".")),
    "the Resend send is awaited",
  );
  assertOk(!sender.includes("keepalive"), "the Resend request does not set fetch keepalive");
  assertOk(
    sender.includes("input.idempotencyKey ? MAIL_SEND_RETRY_DELAYS_MS.length : 1"),
    "a transient retry reuses the Idempotency-Key",
  );
  const enableStart = tracking.indexOf("function enableGoogleTag");
  const enableBody = tracking.slice(enableStart, tracking.indexOf("function currentPath"));
  assertOk(tracking.includes("process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID"), "GA4 reads NEXT_PUBLIC_GA_MEASUREMENT_ID");
  assertOk(tracking.includes("process.env.NEXT_PUBLIC_GOOGLE_ADS_LEAD_SEND_TO"), "the lead conversion reads NEXT_PUBLIC_GOOGLE_ADS_LEAD_SEND_TO");
  assertOk(tracking.includes("/^AW-\\d+\\//"), "a lead send_to may be AW-<digits>/<label>");
  assertOk(enableBody.includes("getGaMeasurementId()") && enableBody.includes('window.gtag?.("config", gaId)'), "GA4 config runs when the measurement id is set");
  assertOk(!enableBody.includes("getGoogleAdsLeadSendTo"), "GA4 init does not read the lead send_to");

  function confirmationStore() {
    const leads = new Map<string, ReadinessLead>();
    const delays: number[] = [];
    const statuses: string[] = [];
    return {
      leads,
      delays,
      statuses,
      deps(sendConfirmation: (input: { email: string; token: string }) => Promise<MailResult>) {
        return {
          now: () => confirmNow,
          sleep: async (ms: number) => {
            delays.push(ms);
          },
          findLead: async (email: string, answers: string) => {
            const matches = [...leads.values()].filter(
              (row) => row.email === email && row.ampelAnswers === answers,
            );
            return matches.at(-1) ?? null;
          },
          saveLead: async (lead: ReadinessLead) => {
            statuses.push(lead.mailStatus);
            leads.set(lead.leadId, { ...lead });
          },
          sendConfirmation,
        };
      },
    };
  }

  const confirmRetry = confirmationStore();
  let confirmSends = 0;
  const confirmInput = { email: "Mandant@Kanzlei.example", answers: code ?? "", ref: "Kanzlei" };
  const retriedConfirm = await requestAmpelConfirmation(
    confirmInput,
    confirmRetry.deps(async () => {
      confirmSends += 1;
      if (confirmSends < 3) return { stub: false, sent: false };
      return { stub: false, sent: true, id: "confirm-1" };
    }),
  );
  assertOk(retriedConfirm.ok && retriedConfirm.throttled === false, "a transient confirmation failure retries and then succeeds");
  assertOk(confirmSends === 3, "confirmation mail retries before the error");
  assert.deepEqual(confirmRetry.delays, [400, 1200], "confirmation retries wait with backoff");
  assert.deepEqual(confirmRetry.statuses, ["confirm_pending", "confirm_sent"], "the lead is pending before it is marked sent");
  const confirmLead = [...confirmRetry.leads.values()][0];
  assertOk(confirmLead?.status === "ampel_doi_pending" && confirmLead.doiConfirmedAt === "", "confirmation does not consume the DOI");
  const repeatedConfirm = await requestAmpelConfirmation(
    confirmInput,
    confirmRetry.deps(async () => {
      confirmSends += 1;
      return { stub: false, sent: true };
    }),
  );
  assertOk(repeatedConfirm.ok && repeatedConfirm.throttled, "a sent confirmation succeeds without another mail");
  assertOk(confirmSends === 3, "the second click does not send");

  const confirmInflight = confirmationStore();
  let inflightSends = 0;
  const inflightConfirm = await requestAmpelConfirmation(
    confirmInput,
    confirmInflight.deps(async () => {
      inflightSends += 1;
      return { stub: false, sent: false, duplicate: true, inflight: true };
    }),
  );
  assertOk(!inflightConfirm.ok && inflightConfirm.reason === "mail" && inflightConfirm.status === 503, "an in-flight confirmation is not success");
  assertOk(inflightSends === AMPEL_RESULT_RETRY_DELAYS_MS.length, "in-flight confirmation waits through every attempt");
  assertOk(
    [...confirmInflight.leads.values()][0]?.mailStatus === "confirm_pending",
    "a failed confirmation stays pending",
  );

  const confirmJoined = confirmationStore();
  let joinedConfirmSends = 0;
  const joinedConfirmDeps = confirmJoined.deps(async () => {
    joinedConfirmSends += 1;
    return { stub: false, sent: true, id: "confirm-2" };
  });
  const [confirmLeft, confirmRight] = await Promise.all([
    requestAmpelConfirmation(confirmInput, joinedConfirmDeps),
    requestAmpelConfirmation(confirmInput, joinedConfirmDeps),
  ]);
  assertOk(confirmLeft.ok && confirmRight.ok, "a double click shares one confirmation mail");
  assertOk(joinedConfirmSends === 1, "a double click sends one confirmation mail");

  const confirmBlind = confirmationStore();
  let blindConfirmSends = 0;
  const blindedConfirm = await requestAmpelConfirmation(confirmInput, {
    ...confirmBlind.deps(async () => {
      blindConfirmSends += 1;
      return { stub: false, sent: true };
    }),
    saveLead: async () => {
      throw new Error("sheets");
    },
  });
  assertOk(blindedConfirm.ok && blindConfirmSends === 1, "a sheet write error does not hide a sent confirmation");
  const invalidConfirm = await requestAmpelConfirmation(
    { email: "not-an-email", answers: code ?? "", ref: "" },
    confirmBlind.deps(async () => {
      blindConfirmSends += 1;
      return { stub: false, sent: true };
    }),
  );
  assertOk(!invalidConfirm.ok && invalidConfirm.reason === "invalid" && blindConfirmSends === 1, "a bad address does not send");

  const confirmThenResult = confirmationStore();
  let doiToken = "";
  const requested = await requestAmpelConfirmation(
    confirmInput,
    confirmThenResult.deps(async (mail) => {
      doiToken = mail.token;
      return { stub: false, sent: true, id: "confirm-3" };
    }),
  );
  assertOk(requested.ok && doiToken, "confirmation returns a DOI token to the mail");
  let resultAfterConfirm = 0;
  const afterLink = await confirmAmpelDoi(doiToken, {
    now: () => confirmNow,
    sleep: async () => undefined,
    findLead: async (leadId) => confirmThenResult.leads.get(leadId) ?? null,
    saveLead: async (lead) => {
      confirmThenResult.leads.set(lead.leadId, { ...lead });
    },
    sendResult: async () => {
      resultAfterConfirm += 1;
      return { stub: false, sent: true, id: "result-after-confirm" };
    },
  });
  assertOk(afterLink.ok && afterLink.alreadySent === false && resultAfterConfirm === 1, "a confirmation-sent lead still sends the result mail");
  assertOk([...confirmThenResult.leads.values()][0]?.mailStatus === "sent", "the result mail replaces the confirmation status");

  const jaCode = encodeAmpelAnswers(all("ja")) ?? "";
  const neinCode = encodeAmpelAnswers(all("nein")) ?? "";
  const mixedCode = encodeAmpelAnswers(all("ja", { vd_vorhanden: "nein" })) ?? "";
  const optionalCode = encodeAmpelAnswers(all("ja", { kasse_tse: "nicht_zutreffend" })) ?? "";
  assertOk(jaCode && neinCode && mixedCode && optionalCode, "answer codes for the limit tests");
  const pdf = await buildAmpelResultPdf(all("ja"));
  assertOk(pdf.subarray(0, 4).toString() === "%PDF", "pdf header");
  const pdfBytes = pdf.toString("latin1");
  assertOk(pdfBytes.includes("keine Steuerberatung"), "pdf carries the disclaimer");
  assertOk(pdfBytes.includes("GoBD"), "pdf carries a source");
  const pdfMail = buildAmpelPdfMail(all("nein"));
  assertOk(pdfMail?.text.includes("GoBD Rz. 151"), "mail quotes a source");
  assertOk(pdfMail?.text.includes("keine Steuerberatung"), "mail carries the disclaimer");
  assertOk(!pdfMail?.text.includes("149") && !pdfMail?.html.includes("149"), "pdf mail has no price");
  assertOk(pdfMail?.subject === "Ihr Ergebnis der Betriebsprüfungs-Ampel", "pdf mail subject");
  assertOk(pdfMail?.text.includes(AMPEL_RESULT_REGISTER_LINE), "pdf mail carries the register line");
  assertOk(pdfMail?.text.includes("gobd-doku-erstellen.de") && !pdfMail?.html.includes("Jetzt buchen"), "pdf mail has a plain product link and no booking block");
  assertOk(!pdfMail?.text.includes("/checkout") && !pdfMail?.html.includes("abmelden"), "pdf mail is not a marketing mail");
  assertOk(resultMail?.html.includes("/ampel-check/abmelden"), "the marketing mail has an unsubscribe link");

  const mailDir = await mkdtemp(path.join(tmpdir(), "ampel-mail-"));
  const rateDir = await mkdtemp(path.join(tmpdir(), "ampel-rate-"));
  let pdfSends = 0;
  let lastFrom = "";
  let lastFilename = "";
  let lastType = "";
  let lastHeader = "";
  setMailDedupeTestHooks({
    dir: mailDir,
    send: async (input) => {
      pdfSends += 1;
      lastFrom = input.from ?? "";
      const attachment = input.attachments?.[0];
      lastFilename = attachment?.filename ?? "";
      lastType = attachment?.contentType ?? "";
      lastHeader = attachment?.content.subarray(0, 4).toString() ?? "";
      return { stub: false, sent: true, id: `pdf-${pdfSends}` };
    },
  });
  const noConfirm = async () => {
    throw new Error("no-doi");
  };
  try {
    const clock = 1_700_000_000_000;
    const ipStore = createMemoryAmpelRateStore();
    for (let index = 0; index < AMPEL_IP_LIMIT; index += 1) {
      const sent = await submitAmpelResult(
        {
          email: `ip-${index}@example.com`,
          answers: jaCode,
          ref: "",
          marketing: false,
          honeypot: "",
          ip: "203.0.113.10",
        },
        { store: ipStore, now: () => clock, confirm: noConfirm },
      );
      assertOk(sent.ok && !("honeypot" in sent), `ip send ${index + 1} is allowed`);
    }
    const blockedIp = await submitAmpelResult(
      {
        email: "ip-extra@example.com",
        answers: jaCode,
        ref: "",
        marketing: false,
        honeypot: "",
        ip: "203.0.113.10",
      },
      { store: ipStore, now: () => clock, confirm: noConfirm },
    );
    assertOk(
      !blockedIp.ok && blockedIp.status === 429 && blockedIp.scope === "ip",
      "sixth address from one IP is limited",
    );
    const laterIp = await submitAmpelResult(
      {
        email: "ip-later@example.com",
        answers: jaCode,
        ref: "",
        marketing: false,
        honeypot: "",
        ip: "203.0.113.10",
      },
      { store: ipStore, now: () => clock + AMPEL_IP_WINDOW_MS + 1, confirm: noConfirm },
    );
    assertOk(laterIp.ok && !("honeypot" in laterIp), "the IP limit ends after the window");

    const emailStore = createMemoryAmpelRateStore();
    const codes = [jaCode, neinCode, mixedCode];
    for (let index = 0; index < AMPEL_EMAIL_LIMIT; index += 1) {
      const sent = await submitAmpelResult(
        {
          email: "Same.Person@example.com",
          answers: codes[index] ?? "",
          ref: "",
          marketing: false,
          honeypot: "",
          ip: `198.51.100.${index + 1}`,
        },
        { store: emailStore, now: () => clock, confirm: noConfirm },
      );
      assertOk(sent.ok && !("honeypot" in sent), `email send ${index + 1} is allowed`);
    }
    const blockedEmail = await submitAmpelResult(
      {
        email: "same.person@example.com",
        answers: optionalCode,
        ref: "",
        marketing: false,
        honeypot: "",
        ip: "198.51.100.20",
      },
      { store: emailStore, now: () => clock, confirm: noConfirm },
    );
    assertOk(
      !blockedEmail.ok && blockedEmail.status === 429 && blockedEmail.scope === "email",
      "fourth result for one address is limited",
    );
    const laterEmail = await submitAmpelResult(
      {
        email: "same.person@example.com",
        answers: optionalCode,
        ref: "",
        marketing: false,
        honeypot: "",
        ip: "198.51.100.21",
      },
      { store: emailStore, now: () => clock + AMPEL_EMAIL_WINDOW_MS + 1, confirm: noConfirm },
    );
    assertOk(laterEmail.ok && !("honeypot" in laterEmail), "the email limit ends after a day");

    const dupStore = createMemoryAmpelRateStore();
    const beforeDup = pdfSends;
    const firstDup = await submitAmpelResult(
      { email: "dup@example.com", answers: jaCode, ref: "", marketing: false, honeypot: "", ip: "198.51.100.30" },
      { store: dupStore, now: () => clock, confirm: noConfirm },
    );
    const secondDup = await submitAmpelResult(
      { email: "dup@example.com", answers: jaCode, ref: "", marketing: false, honeypot: "", ip: "198.51.100.31" },
      { store: dupStore, now: () => clock, confirm: noConfirm },
    );
    assertOk(firstDup.ok && !("honeypot" in firstDup) && firstDup.duplicate === false, "first result sends");
    assertOk(secondDup.ok && !("honeypot" in secondDup) && secondDup.duplicate === true, "the same result is not sent twice");
    assertOk(pdfSends === beforeDup + 1, "a retry does not send a second PDF");

    const beforeParallel = pdfSends;
    const parallelStore = createMemoryAmpelRateStore();
    const [left, right] = await Promise.all([
      submitAmpelResult(
        { email: "parallel@example.com", answers: neinCode, ref: "", marketing: false, honeypot: "", ip: "198.51.100.32" },
        { store: parallelStore, now: () => clock, confirm: noConfirm },
      ),
      submitAmpelResult(
        { email: "parallel@example.com", answers: neinCode, ref: "", marketing: false, honeypot: "", ip: "198.51.100.32" },
        { store: parallelStore, now: () => clock, confirm: noConfirm },
      ),
    ]);
    assertOk(left.ok && right.ok, "a double click still returns the result");
    assertOk(pdfSends === beforeParallel + 1, "a double click sends one PDF");

    const beforeQuiet = pdfSends;
    const honey = await submitAmpelResult(
      { email: "honey@example.com", answers: jaCode, ref: "", marketing: true, honeypot: "filled", ip: "198.51.100.33" },
      { store: createMemoryAmpelRateStore(), now: () => clock, confirm: noConfirm },
    );
    const invalid = await submitAmpelResult(
      { email: "not-an-email", answers: jaCode, ref: "", marketing: false, honeypot: "", ip: "198.51.100.34" },
      { store: createMemoryAmpelRateStore(), now: () => clock, confirm: noConfirm },
    );
    assertOk(honey.ok && "honeypot" in honey, "honeypot stays quiet");
    assertOk(!invalid.ok && invalid.status === 400 && invalid.error === AMPEL_RESULT_MAIL.invalidEmail, "server rejects a bad address");
    assertOk(pdfSends === beforeQuiet, "honeypot and a bad address do not send");

    let confirmCalls = 0;
    const skipped = await submitAmpelResult(
      { email: "plain@example.com", answers: mixedCode, ref: "Kanzlei", marketing: false, honeypot: "", ip: "198.51.100.35" },
      {
        store: createMemoryAmpelRateStore(),
        now: () => clock,
        confirm: async () => {
          confirmCalls += 1;
          return { ok: true, throttled: false };
        },
      },
    );
    const opted = await submitAmpelResult(
      { email: "opted@example.com", answers: mixedCode, ref: "Kanzlei", marketing: true, honeypot: "", ip: "198.51.100.36" },
      {
        store: createMemoryAmpelRateStore(),
        now: () => clock,
        confirm: async (lead) => {
          confirmCalls += 1;
          assertOk(lead.email === "opted@example.com" && lead.answers === mixedCode, "doi receives the submitted answers");
          assertOk(lead.consentTextVersion === AMPEL_CONSENT_TEXT_VERSION, "doi stores the checkbox version");
          assertOk(lead.consentIp === "198.51.100.36", "doi stores the signup IP");
          return { ok: true, throttled: false };
        },
      },
    );
    assertOk(skipped.ok && !("honeypot" in skipped) && skipped.marketing === "skipped", "without the checkbox there is no marketing mail");
    assertOk(opted.ok && !("honeypot" in opted) && opted.marketing === "started" && confirmCalls === 1, "the checkbox starts the confirmation");

    assertOk(lastFrom === AMPEL_PDF_FROM, "pdf mail comes from info@");
    assertOk(lastFilename === "Betriebspruefungs-Ampel.pdf", "pdf filename");
    assertOk(lastType === "application/pdf", "pdf content type");
    assertOk(lastHeader === "%PDF", "attachment is a pdf");

    const ledgerFile = path.join(rateDir, "ampel-rate.json");
    const fileStore = createFileAmpelRateStore(ledgerFile);
    const filed = await submitAmpelResult(
      { email: "file@example.com", answers: jaCode, ref: "", marketing: false, honeypot: "", ip: "203.0.113.77" },
      { store: fileStore, now: () => clock, confirm: noConfirm },
    );
    assertOk(filed.ok && !("honeypot" in filed), "file ledger accepts the first result");
    const rawLedger = readFileSync(ledgerFile, "utf8");
    assertOk(!rawLedger.includes("203.0.113.77"), "the ledger stores no raw IP");
    const secondStore = createFileAmpelRateStore(ledgerFile);
    for (let index = 0; index < AMPEL_IP_LIMIT - 1; index += 1) {
      const sent = await submitAmpelResult(
        {
          email: `file-${index}@example.com`,
          answers: jaCode,
          ref: "",
          marketing: false,
          honeypot: "",
          ip: "203.0.113.77",
        },
        { store: secondStore, now: () => clock, confirm: noConfirm },
      );
      assertOk(sent.ok && !("honeypot" in sent), "file ledger counts across stores");
    }
    const fileBlocked = await submitAmpelResult(
      { email: "file-blocked@example.com", answers: jaCode, ref: "", marketing: false, honeypot: "", ip: "203.0.113.77" },
      { store: secondStore, now: () => clock, confirm: noConfirm },
    );
    assertOk(
      !fileBlocked.ok && fileBlocked.status === 429 && fileBlocked.scope === "ip",
      "file ledger enforces the IP limit",
    );

    const day = 24 * 60 * 60 * 1000;
    assertOk(AMPEL_RATE_RETENTION_DAYS === 7, "rate records are kept for 7 days by default");
    const pruned = pruneAmpelRateLedger(
      { "ip:old": [clock - 8 * day], "email:fresh": [clock - 6 * day] },
      clock,
    );
    assertOk(!("ip:old" in pruned) && pruned["email:fresh"]?.length === 1, "rate records older than 7 days are dropped");
    const staleFile = path.join(rateDir, "stale-rate.json");
    writeFileSync(staleFile, JSON.stringify({ "ip:stale": [clock - 8 * day], "email:kept": [clock - day] }));
    const staleStore = createFileAmpelRateStore(staleFile);
    const afterPrune = await submitAmpelResult(
      { email: "kept@example.com", answers: neinCode, ref: "", marketing: false, honeypot: "", ip: "203.0.113.88" },
      { store: staleStore, now: () => clock, confirm: noConfirm },
    );
    assertOk(afterPrune.ok && !("honeypot" in afterPrune), "a write still accepts a fresh request");
    const prunedLedger = readFileSync(staleFile, "utf8");
    assertOk(!prunedLedger.includes("ip:stale") && prunedLedger.includes("email:kept"), "a ledger write drops stamps older than 7 days");
  } finally {
    setMailDedupeTestHooks(null);
    await rm(mailDir, { recursive: true, force: true });
    await rm(rateDir, { recursive: true, force: true });
  }

  const day = 24 * 60 * 60 * 1000;
  const signup = "2026-10-14T08:00:00.000Z";
  const baseLead = toAmpelReadinessLead({
    email: "keep@example.com",
    answers: jaCode,
    ref: "",
    consentAt: signup,
    doiConfirmedAt: "",
    score: 100,
    light: "gruen",
    mailStatus: "pdf_sent",
  });
  assertOk(AMPEL_CHECK_RETENTION_DAYS === 90 && AMPEL_UNCONFIRMED_OPT_IN_RETENTION_DAYS === 30, "retention defaults");
  assertOk(
    !ampelRecordExpired(baseLead, Date.parse(signup) + 89 * day) &&
      ampelRecordExpired(baseLead, Date.parse(signup) + 90 * day),
    "check data without opt-in lasts 90 days",
  );
  assertOk(
    ampelRecordExpired(
      { ...baseLead, marketingOptIn: "pending" },
      Date.parse(signup) + 30 * day,
    ),
    "an unconfirmed opt-in lasts 30 days",
  );
  assertOk(
    !ampelRecordExpired(
      { ...baseLead, marketingOptIn: "confirmed" },
      Date.parse(signup) + 400 * day,
    ),
    "a confirmed opt-in is not deleted on the check timer",
  );

  const proofStore = new Map<string, ReadinessLead>();
  const proofInput = { email: "proof@example.com", answers: jaCode, ref: "Kanzlei", consentIp: "203.0.113.50", consentTextVersion: AMPEL_CONSENT_TEXT_VERSION };
  const proofDeps = {
    now: () => Date.parse(signup),
    sleep: async () => undefined,
    findLead: async (leadEmail: string, answers: string) =>
      [...proofStore.values()].find((lead) => lead.email === leadEmail && lead.ampelAnswers === answers) ?? null,
    saveLead: async (lead: ReadinessLead) => {
      proofStore.set(lead.leadId, { ...lead });
    },
    sendConfirmation: async () => ({ stub: false, sent: true, id: "confirm-proof" }) as MailResult,
  };
  const proofRequested = await requestAmpelConfirmation(proofInput, proofDeps);
  const proofLead = [...proofStore.values()][0];
  assertOk(proofRequested.ok && proofLead?.marketingOptIn === "pending" && proofLead.doiConfirmedAt === "", "signup does not mark the address for marketing");
  assertOk(proofLead?.consentTextVersion === "2026-10-14" && proofLead.consentIp === "203.0.113.50", "signup stores the version and the IP");
  const proofToken = createAmpelDoiToken(
    { email: proofInput.email, answers: jaCode, ref: "Kanzlei", consentAt: proofLead?.consentAt ?? signup, consentTextVersion: AMPEL_CONSENT_TEXT_VERSION },
    Date.parse(signup),
  );
  const proofConfirmed = await confirmAmpelDoi(proofToken ?? "", {
    now: () => Date.parse(signup) + 1000,
    sleep: async () => undefined,
    findLead: async (leadId) => proofStore.get(leadId) ?? null,
    saveLead: async (lead) => {
      proofStore.set(lead.leadId, { ...lead });
    },
    sendResult: async () => ({ stub: false, sent: true, id: "marketing-result" }),
  });
  const confirmedLead = [...proofStore.values()][0];
  assertOk(proofConfirmed.ok && confirmedLead?.marketingOptIn === "confirmed" && confirmedLead.doiConfirmedAt !== "", "the DOI click marks the address for marketing");

  const unsubscribeToken = createAmpelUnsubscribeToken(confirmedLead?.email ?? "", confirmedLead?.consentAt ?? "");
  const withdrawn = await withdrawAmpelMarketing(unsubscribeToken ?? "", {
    now: () => Date.parse(signup) + 2000,
    list: async () => [...proofStore.values()],
    save: async (lead) => {
      proofStore.set(lead.leadId, { ...lead });
    },
  });
  assertOk(withdrawn.ok && [...proofStore.values()][0]?.marketingOptIn === "withdrawn", "the unsubscribe link withdraws marketing");
  const afterWithdraw = await confirmAmpelDoi(proofToken ?? "", {
    now: () => Date.parse(signup) + 3000,
    sleep: async () => undefined,
    findLead: async (leadId) => proofStore.get(leadId) ?? null,
    saveLead: async (lead) => {
      proofStore.set(lead.leadId, { ...lead });
    },
    sendResult: async () => {
      throw new Error("withdrawn");
    },
  });
  assertOk(afterWithdraw.ok && [...proofStore.values()][0]?.marketingOptIn === "withdrawn", "a withdrawn address is not marked again");

  console.log("check-ampel: ok");
} finally {
  if (savedSecret === undefined) delete process.env.MAGIC_LINK_SECRET;
  else process.env.MAGIC_LINK_SECRET = savedSecret;
}
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
