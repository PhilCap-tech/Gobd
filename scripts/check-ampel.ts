/**
 * Betriebsprüfungs-Ampel: weighted score, green cap, and the DOI token.
 *
 *   npx tsx scripts/check-ampel.ts
 */
import { BlobError, BlobPreconditionFailedError, BlobUnknownError } from "@vercel/blob";
import { automatedRunForbidsLiveWrites } from "@/lib/live-write-guard";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { AMPEL_QUESTIONS, AMPEL_RESULTS, AMPEL_H1, AMPEL_DISCLAIMER, AMPEL_SHARE_KANZLEI, AMPEL_CTA, AMPEL_INTRO, AMPEL_EMAIL_PRIVACY_NOTE, AMPEL_MARKETING_CONSENT, AMPEL_PRIVACY_PARAGRAPHS, AMPEL_PRIVACY_TITLE, AMPEL_CONSENT_TEXT_VERSION, AMPEL_RESULT_REGISTER_LINE, AMPEL_RESULT_MAIL, ampelSendStatusNotice } from "@/lib/ampel-questions";
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
import { buildAmpelConfirmationMail, buildAmpelResultMail, sendAmpelConfirmationMail, sendAmpelResultMail } from "@/lib/ampel-mail";
import { setAmpelMarketingLeadLookup } from "@/lib/ampel-marketing-guard";
import { createMemoryAmpelSuppressionStore, readAmpelSuppression, setAmpelSuppressionTestStore } from "@/lib/ampel-suppression";
import { MAIL_CHECKOUT_URL } from "@/lib/mail-layout";
import { buildAmpelPdfMail, buildAmpelResultPdf } from "@/lib/ampel-pdf";
import {
  AMPEL_EMAIL_LIMIT,
  AMPEL_EMAIL_WINDOW_MS,
  AMPEL_IP_LIMIT,
  AMPEL_IP_WINDOW_MS,
  AMPEL_RATE_RETENTION_DAYS,
  ampelClientIp,
  ampelRateIpKey,
  ampelRateLogLine,
  ampelRateResponseHeader,
  ampelRateSlotPath,
  ampelRateWindowId,
  readAmpelClientIp,
  createBlobPutAmpelRateStore,
  createFileAmpelRateStore,
  createMemoryAmpelRateStore,
  createSlotAmpelRateStore,
  pruneAmpelRateLedger,
  type AmpelRateIo,
} from "@/lib/ampel-rate-limit";
import { ampelMailStatusId, createMemoryAmpelMailStatusStore } from "@/lib/ampel-mail-status";
import { AMPEL_PDF_FROM, AMPEL_SEND_TIMEOUT_MS, completeAmpelResult, deliverAmpelResult, sendAmpelPdfMail, submitAmpelResult, withDeadline } from "@/lib/ampel-result-send";
import { ampelApiResponse } from "@/lib/ampel-api-response";
import { POST as postAmpelErgebnis } from "@/app/api/ampel/ergebnis/route";
import { GET as getAmpelAbmelden, POST as postAmpelAbmelden } from "@/app/api/ampel/abmelden/route";
import { POST as postAmpelErgebnisSenden } from "@/app/api/ampel/ergebnis/senden/route";
import { consumeAmpelSendToken, createBlobPutAmpelSendTokenStore, createMemoryAmpelSendTokenStore, issueAmpelSendToken } from "@/lib/ampel-send-token";
import type { ExclusivePutOptions } from "@/lib/ampel-blob-slot";
import { setMailDedupeTestHooks } from "@/lib/mail-dedupe";
import { AMPEL_RESULT_RETRY_DELAYS_MS, confirmAmpelDoi, requestAmpelConfirmation } from "@/lib/ampel-confirm";
import { setAmpelWithdrawTestDeps, withdrawAmpelMarketing } from "@/lib/ampel-unsubscribe";
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

if (!automatedRunForbidsLiveWrites()) {
  process.env.npm_lifecycle_event = "check:ampel";
}

const savedSecret = process.env.MAGIC_LINK_SECRET;
if (!process.env.MAGIC_LINK_SECRET?.trim()) {
  process.env.MAGIC_LINK_SECRET = "check-ampel-offline-secret";
}

async function main() {
try {
  setAmpelSuppressionTestStore(createMemoryAmpelSuppressionStore());
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
  const consentSentence =
    "Sie haben zugestimmt, per E-Mail Informationen zu GoBD-Themen und Angeboten von gobd-doku-erstellen.de (IKAT GmbH) zu erhalten. Bitte bestätigen Sie das über den folgenden Link.";
  assertOk(
    confirmation.text.includes(consentSentence) && confirmation.html.includes(consentSentence),
    "confirmation mail matches the checkbox scope",
  );
  assertOk(
    !confirmation.text.includes("weitere E-Mails zur Betriebsprüfungs-Ampel") &&
      !confirmation.html.includes("weitere E-Mails zur Betriebsprüfungs-Ampel"),
    "confirmation mail no longer narrows the consent",
  );
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
  const blockedAt = page.indexOf("response.status === 429");
  const duplicateAt = page.indexOf("data.duplicate");
  const leadTrackAt = page.indexOf('trackLeadSubmit({ value: 1, currency: "EUR" })');
  const sendingAt = page.indexOf("AMPEL_RESULT_MAIL.sending");
  const postAt = page.indexOf('fetch("/api/ampel/ergebnis"');
  assertOk(sendingAt >= 0 && postAt > sendingAt, "the result is shown before the mail request returns");
  assertOk(blockedAt >= 0 && leadTrackAt > blockedAt, "a rate limit does not fire the lead event");
  assertOk(duplicateAt >= 0 && leadTrackAt > duplicateAt, "a duplicate does not fire the lead event");
  assertOk(page.slice(blockedAt, blockedAt + 180).includes("showResult"), "a rate limit still shows the result");
  assertOk(page.includes('fetch("/api/ampel/ergebnis/senden"'), "the mail is sent in a second request");
  assertOk(page.includes("send_token: data.token"), "the follow-up send carries the one-time token");
  const sendenAt = page.indexOf('fetch("/api/ampel/ergebnis/senden"');
  const statusAt = page.indexOf("ampelSendStatusNotice({");
  assertOk(sendenAt >= 0 && statusAt > sendenAt, "the status updates after the send response");
  assertOk(page.includes('error.name === "AbortError"'), "a timeout or abort replaces the sending line");
  const sendRoute = readFileSync("app/api/ampel/ergebnis/senden/route.ts", "utf8");
  assertOk(sendRoute.includes("sendToken: value.send_token"), "the send route requires the one-time token");
  assertOk(
    sendRoute.indexOf("ampelSendTokenPresent") >= 0 && sendRoute.indexOf("ampelSendTokenPresent") < sendRoute.indexOf("value.email"),
    "a missing token is rejected before the email is validated",
  );
  const sendSource = readFileSync("lib/ampel-result-send.ts", "utf8");
  const completeAt = sendSource.indexOf("export async function completeAmpelResult");
  const completeBody = sendSource.slice(completeAt, sendSource.indexOf("export function submitAmpelResult"));
  assertOk(
    completeBody.indexOf("ampelSendTokenPresent") >= 0 &&
      completeBody.indexOf("ampelSendTokenPresent") < completeBody.indexOf("normalizeAmpelEmail"),
    "the send function checks the token before the email",
  );
  assertOk(
    completeBody.indexOf("consumeAmpelSendToken") >= 0 &&
      completeBody.indexOf(".confirm(") > completeBody.indexOf("consumeAmpelSendToken") &&
      completeBody.indexOf(".confirm(") < completeBody.indexOf("deliverAmpelResult") &&
      completeBody.indexOf("lookupMailDedupe") < completeBody.indexOf("deliverAmpelResult"),
    "the send route checks the token, the IP slot, and the duplicate slot before mail",
  );
  assertOk(
    sendSource.indexOf('if (decision !== "ok") return limited(decision);') < sendSource.indexOf("await issueAmpelSendToken"),
    "the send token is issued only after the limit check",
  );
  assertOk(page.includes("AbortSignal.timeout(20_000)"), "the form does not wait forever");
  assertOk(
    AMPEL_RESULT_MAIL.rateLimitedEmail ===
      "Sie haben das Ergebnis heute bereits mehrfach angefordert. Ihr Ergebnis sehen Sie unten; eine weitere E-Mail ist morgen wieder möglich.",
    "the daily limit message is the Sie sentence",
  );
  assertOk(
    AMPEL_RESULT_MAIL.rateLimitedIp.endsWith("eine weitere E-Mail ist in Kürze wieder möglich."),
    "the hourly limit message says the mail can be requested again shortly",
  );
  assertOk(
    AMPEL_RESULT_MAIL.alreadySent === "Das Ergebnis wurde bereits an diese Adresse gesendet.",
    "the duplicate message is the Sie sentence",
  );
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
  const resultAt = privacyText.indexOf("Wenn Sie den Ampel-Check nutzen");
  const abuseAt = privacyText.indexOf("Schutz vor Missbrauch:");
  const internal =
    "Interne Auswertung: Damit wir den Ampel-Check verbessern und den Versand überwachen können, werten wir die Einträge intern aus. Dabei geht es um die Anzahl der Checks, den Zeitpunkt, das Ergebnis (Ampelfarbe), ob die Ergebnis-E-Mail versendet wurde und ob Sie in E-Mail-Informationen eingewilligt haben. Die Auswertung ist nur für uns auf einer geschützten Admin-Seite sichtbar. Wir geben diese Daten nicht an Dritte weiter und verwenden sie nicht für Werbung. Kampagnenparameter (UTM) speichern wir dabei nicht. Rechtsgrundlage ist unser berechtigtes Interesse an der Verbesserung unseres Angebots und an einem zuverlässigen Versand (Art. 6 Abs. 1 lit. f DSGVO). Die Einträge löschen wir manuell, sobald sie für die Auswertung nicht mehr erforderlich sind, oder auf Ihren Wunsch. Sie können der Auswertung jederzeit widersprechen (Art. 21 DSGVO), per Nachricht an info@gobd-doku-erstellen.de.";
  const internalAt = privacyText.indexOf(internal);
  const storageAt = privacyText.indexOf("Speicherdauer:");
  assertOk(resultAt >= 0 && internalAt > resultAt, "internal evaluation follows the result paragraph");
  assertOk(abuseAt >= 0 && internalAt === privacyText.indexOf("\n", abuseAt) + 1, "internal evaluation follows the abuse paragraph");
  assertOk(storageAt === privacyText.indexOf("\n", internalAt) + 1, "internal evaluation sits directly before the storage paragraph");
  assertOk(privacyText.slice(abuseAt, internalAt).includes("Art. 6 Abs. 1 lit. f DSGVO"), "abuse paragraph is the legal text");
  assertOk(
    privacyPage.includes('const BOLD_LABELS = ["Interne Auswertung:", "Speicherdauer:", "Widerruf und Ihre Rechte:"]') &&
      privacyPage.includes("<strong>{label}</strong>"),
    "the internal evaluation label is bold",
  );
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
  assertOk(
    pdfMail != null && !pdfMail.text.includes(MAIL_CHECKOUT_URL) && !pdfMail.html.includes(MAIL_CHECKOUT_URL),
    "pdf mail has no checkout link",
  );
  assertOk(
    pdfMail != null && !pdfMail.text.includes(AMPEL_CTA.price) && !pdfMail.html.includes(AMPEL_CTA.price),
    "pdf mail has no price",
  );
  assertOk(
    resultMail != null &&
      resultMail.text.includes(AMPEL_RESULT_REGISTER_LINE) &&
      resultMail.html.includes(AMPEL_RESULT_REGISTER_LINE),
    "price mail carries the register line",
  );
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
      blockedIp.ok && !("honeypot" in blockedIp) && blockedIp.limited === "ip" && blockedIp.mailed === false && blockedIp.notice === AMPEL_RESULT_MAIL.rateLimitedIp,
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
      blockedEmail.ok && !("honeypot" in blockedEmail) && blockedEmail.limited === "email" && blockedEmail.mailed === false && blockedEmail.notice === AMPEL_RESULT_MAIL.rateLimitedEmail,
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
    assertOk(
      secondDup.ok && !("honeypot" in secondDup) && secondDup.duplicate === true && secondDup.mailed === false && secondDup.notice === AMPEL_RESULT_MAIL.alreadySent,
      "a duplicate is not reported as a new mail",
    );
    assertOk(pdfSends === beforeDup + 1, "a retry does not send a second PDF");

    const asyncTokens = createMemoryAmpelSendTokenStore();
    const asyncStatus = createMemoryAmpelMailStatusStore();
    let asyncSends = 0;
    let markStarted: () => void = () => undefined;
    const mailStarted = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    let releaseMail: (value: { stub: false; sent: true; id: string }) => void = () => undefined;
    const asyncInput = {
      email: "async@example.com",
      answers: mixedCode,
      ref: "",
      marketing: false,
      honeypot: "",
      ip: "203.0.113.40",
    };
    const asyncMail = () => {
      asyncSends += 1;
      markStarted();
      return new Promise<{ stub: false; sent: true; id: string }>((resolve) => {
        releaseMail = resolve;
      });
    };
    const asyncStore = createMemoryAmpelRateStore();
    const handoff = await submitAmpelResult(asyncInput, {
      store: asyncStore,
      now: () => clock,
      confirm: noConfirm,
      handoff: true,
      status: asyncStatus,
      tokens: asyncTokens,
      mail: asyncMail,
    });
    const handoffToken = handoff.ok && !("honeypot" in handoff) ? handoff.token : "";
    assertOk(
      handoff.ok && !("honeypot" in handoff) && handoff.pending === true && handoff.mailed === false && asyncSends === 0 && handoffToken?.startsWith("v1.") === true,
      "the page can show the result before the mail is sent",
    );
    const queued = await asyncStatus.read(ampelMailStatusId(asyncInput.email, mixedCode));
    assertOk(queued?.state === "sending" && queued.notice === AMPEL_RESULT_MAIL.sending, "the mail status starts as sending");
    const completing = completeAmpelResult(
      { ...asyncInput, sendToken: handoffToken },
      {
        now: () => clock,
        confirm: noConfirm,
        status: asyncStatus,
        tokens: asyncTokens,
        store: asyncStore,
        mail: asyncMail,
        sendTimeoutMs: 1_000,
      },
    );
    await mailStarted;
    assertOk(asyncSends === 1, "the follow-up request sends once");
    releaseMail({ stub: false, sent: true, id: "async-1" });
    const completed = await completing;
    assertOk(completed.ok && !("honeypot" in completed) && completed.mailed === true, "the follow-up request reports the sent mail");
    const finished = await asyncStatus.read(ampelMailStatusId(asyncInput.email, mixedCode));
    assertOk(finished?.state === "sent", "the mail status finishes as sent");
    let straySends = 0;
    const unsolicited = await completeAmpelResult(
      { ...asyncInput, email: "stray@example.com", answers: neinCode },
      {
        now: () => clock,
        confirm: noConfirm,
        status: asyncStatus,
        mail: async () => {
          straySends += 1;
          return { stub: false, sent: true, id: "stray" };
        },
      },
    );
    assertOk(!unsolicited.ok && unsolicited.status === 403 && straySends === 0, "a send without a token is forbidden and sends no mail");

    const beforeDirect = pdfSends;
    const direct = await postAmpelErgebnisSenden(
      new Request("http://localhost/api/ampel/ergebnis/senden", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "delivered@resend.dev",
          answers: jaCode,
          ref: "",
          marketing: false,
          fax_number: "",
        }),
      }),
    );
    const directBody = (await direct.json()) as { error?: string };
    assertOk(direct.status === 403 && directBody.error === AMPEL_RESULT_MAIL.sendUnauthorized, "direct POST without a token is forbidden");
    assertOk(
      direct.headers.get("x-ampel-rl")?.startsWith("src=none;slot=0;win=") === true,
      "a token rejection still returns the rate header",
    );
    assertOk(pdfSends === beforeDirect, "direct POST without a token sends no mail");
    const invalidWithoutToken = await postAmpelErgebnisSenden(
      new Request("http://localhost/api/ampel/ergebnis/senden", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "not-an-email", answers: "x", fax_number: "" }),
      }),
    );
    assertOk(invalidWithoutToken.status === 403, "a missing token is rejected before the email is validated");

    const foreignToken = await issueAmpelSendToken(
      { email: "owner@example.com", code: jaCode, now: clock, ipSlot: 1, emailSlot: 1 },
      createMemoryAmpelSendTokenStore(),
    );
    const foreign = await postAmpelErgebnisSenden(
      new Request("http://localhost/api/ampel/ergebnis/senden", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "delivered@resend.dev",
          answers: jaCode,
          ref: "",
          marketing: false,
          fax_number: "",
          send_token: foreignToken,
        }),
      }),
    );
    assertOk(foreign.status === 403, "a token for a different email is forbidden");
    assertOk(pdfSends === beforeDirect, "a token for a different email sends no mail");

    const reuseTokens = createMemoryAmpelSendTokenStore();
    const reuseStatus = createMemoryAmpelMailStatusStore();
    const reuseInput = {
      email: "reuse@example.com",
      answers: optionalCode,
      ref: "",
      marketing: false,
      honeypot: "",
      ip: "203.0.113.50",
    };
    let reuseSends = 0;
    const reuseMail = async () => {
      reuseSends += 1;
      return { stub: false as const, sent: true as const, id: "reuse-1" };
    };
    const reuseStore = createMemoryAmpelRateStore();
    const reuseHandoff = await submitAmpelResult(reuseInput, {
      store: reuseStore,
      now: () => clock,
      confirm: noConfirm,
      handoff: true,
      status: reuseStatus,
      tokens: reuseTokens,
      mail: reuseMail,
    });
    const reuseToken = reuseHandoff.ok && !("honeypot" in reuseHandoff) ? reuseHandoff.token : "";
    const wrongEmail = await completeAmpelResult(
      { ...reuseInput, email: "other@example.com", sendToken: reuseToken },
      { now: () => clock, confirm: noConfirm, status: reuseStatus, tokens: reuseTokens, store: reuseStore, mail: reuseMail },
    );
    assertOk(!wrongEmail.ok && wrongEmail.status === 403 && reuseSends === 0, "a token does not send to a different email");
    const reuseOnce = await completeAmpelResult(
      { ...reuseInput, sendToken: reuseToken },
      { now: () => clock, confirm: noConfirm, status: reuseStatus, tokens: reuseTokens, store: reuseStore, mail: reuseMail },
    );
    assertOk(reuseOnce.ok && !("honeypot" in reuseOnce) && reuseOnce.mailed === true && reuseSends === 1, "the first token use sends one mail");
    const reuseTwice = await completeAmpelResult(
      { ...reuseInput, sendToken: reuseToken },
      { now: () => clock, confirm: noConfirm, status: reuseStatus, tokens: reuseTokens, store: reuseStore, mail: reuseMail },
    );
    assertOk(!reuseTwice.ok && reuseTwice.status === 403 && reuseSends === 1, "reusing the token sends no second mail");

    const dupTokens = createMemoryAmpelSendTokenStore();
    const dupStatus = createMemoryAmpelMailStatusStore();
    await dupStatus.write(ampelMailStatusId("dup@example.com", jaCode), {
      state: "sending",
      notice: AMPEL_RESULT_MAIL.sending,
    });
    const dupRate = createMemoryAmpelRateStore();
    const dupHold = { ipSlot: 0, emailSlot: 0 };
    await dupRate.take({
      ipKey: ampelRateIpKey("203.0.113.51"),
      emailKey: "em:dup@example.com",
      now: clock,
      hold: dupHold,
    });
    const dupToken = await issueAmpelSendToken(
      { email: "dup@example.com", code: jaCode, now: clock, ipSlot: dupHold.ipSlot, emailSlot: dupHold.emailSlot },
      dupTokens,
    );
    let dupExtra = 0;
    const dupAgain = await completeAmpelResult(
      {
        email: "dup@example.com",
        answers: jaCode,
        ref: "",
        marketing: false,
        honeypot: "",
        ip: "203.0.113.51",
        sendToken: dupToken,
      },
      {
        now: () => clock,
        confirm: noConfirm,
        status: dupStatus,
        tokens: dupTokens,
        store: dupRate,
        mail: async () => {
          dupExtra += 1;
          return { stub: false, sent: true, id: "dup-extra" };
        },
      },
    );
    assertOk(
      dupAgain.ok && !("honeypot" in dupAgain) && dupAgain.duplicate === true && dupAgain.mailed === false && dupExtra === 0,
      "a valid token still does not send a second copy",
    );

    const capTokens = createMemoryAmpelSendTokenStore();
    const capStatus = createMemoryAmpelMailStatusStore();
    const capStore = createMemoryAmpelRateStore();
    for (const answers of [jaCode, neinCode, mixedCode]) {
      const allowed = await submitAmpelResult(
        { email: "cap@example.com", answers, ref: "", marketing: false, honeypot: "", ip: "203.0.113.77" },
        { store: capStore, now: () => clock, confirm: noConfirm, handoff: true, tokens: capTokens, status: capStatus },
      );
      assertOk(allowed.ok && !("honeypot" in allowed) && allowed.pending === true && typeof allowed.token === "string", "a request inside the limit receives a token");
    }
    const capped = await submitAmpelResult(
      { email: "cap@example.com", answers: optionalCode, ref: "", marketing: false, honeypot: "", ip: "203.0.113.77" },
      { store: capStore, now: () => clock, confirm: noConfirm, handoff: true, tokens: capTokens, status: capStatus },
    );
    assertOk(
      capped.ok && !("honeypot" in capped) && capped.limited === "email" && capped.token === undefined && capped.pending !== true,
      "a limited request does not issue a send token",
    );

    const savedMagic = process.env.MAGIC_LINK_SECRET;
    delete process.env.MAGIC_LINK_SECRET;
    try {
      const opaqueStore = createMemoryAmpelSendTokenStore();
      const opaque = await issueAmpelSendToken(
        { email: "opaque@example.com", code: jaCode, now: clock, ipSlot: 1, emailSlot: 1 },
        opaqueStore,
      );
      assertOk(opaque?.startsWith("v0."), "without the server secret the token is stored as an opaque slot");
      const opaqueMismatch = await consumeAmpelSendToken(
        { token: opaque, email: "other@example.com", code: jaCode, now: clock },
        opaqueStore,
      );
      assertOk(opaqueMismatch.verdict === "mismatch", "an opaque token stays bound to its email");
      const opaqueOk = await consumeAmpelSendToken(
        { token: opaque, email: "opaque@example.com", code: jaCode, now: clock },
        opaqueStore,
      );
      assertOk(opaqueOk.verdict === "ok", "an opaque token can be used once");
      const opaqueReuse = await consumeAmpelSendToken(
        { token: opaque, email: "opaque@example.com", code: jaCode, now: clock },
        opaqueStore,
      );
      assertOk(opaqueReuse.verdict === "reused", "an opaque token cannot be used twice");
    } finally {
      if (savedMagic === undefined) delete process.env.MAGIC_LINK_SECRET;
      else process.env.MAGIC_LINK_SECRET = savedMagic;
    }

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
      fileBlocked.ok && !("honeypot" in fileBlocked) && fileBlocked.limited === "ip" && fileBlocked.mailed === false,
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

    function memoryBlob(): AmpelRateIo {
      const objects = new Map<string, string>();
      return {
        async get(pathname) {
          return objects.has(pathname) ? (objects.get(pathname) ?? null) : null;
        },
        async create(pathname, body) {
          if (objects.has(pathname)) return "exists";
          objects.set(pathname, body);
          return "created";
        },
        async remove(pathname) {
          objects.delete(pathname);
        },
      };
    }

    const shared = memoryBlob();
    const instanceA = createSlotAmpelRateStore(shared);
    const instanceB = createSlotAmpelRateStore(shared);
    const isolated = createSlotAmpelRateStore(memoryBlob());
    for (let index = 0; index < AMPEL_IP_LIMIT; index += 1) {
      const decision = await (index % 2 === 0 ? instanceA : instanceB).take({
        ipKey: "ip:shared",
        emailKey: `em:slot-${index}@example.com`,
        now: clock,
      });
      assertOk(decision === "ok", `shared slot ${index + 1} is allowed`);
    }
    assertOk(
      (await instanceB.take({ ipKey: "ip:shared", emailKey: "em:slot-extra@example.com", now: clock })) === "ip",
      "a second instance sees the IP limit",
    );
    assertOk(
      (await isolated.take({ ipKey: "ip:shared", emailKey: "em:alone@example.com", now: clock })) === "ok",
      "a fresh instance does not keep the other counter in memory",
    );

    const emailBlob = memoryBlob();
    const emailA = createSlotAmpelRateStore(emailBlob);
    const emailB = createSlotAmpelRateStore(emailBlob);
    for (let index = 0; index < AMPEL_EMAIL_LIMIT; index += 1) {
      const decision = await (index % 2 === 0 ? emailA : emailB).take({
        ipKey: `ip:mail-${index}`,
        emailKey: "em:same@example.com",
        now: clock,
      });
      assertOk(decision === "ok", `shared email slot ${index + 1} is allowed`);
    }
    assertOk(
      (await emailA.take({ ipKey: "ip:mail-extra", emailKey: "em:same@example.com", now: clock })) === "email",
      "a second instance sees the daily address limit",
    );
    assertOk(
      (await emailB.take({
        ipKey: "ip:mail-later",
        emailKey: "em:same@example.com",
        now: clock + AMPEL_EMAIL_WINDOW_MS,
      })) === "ok",
      "the address limit starts again in the next window",
    );

    const parallelBlob = memoryBlob();
    const parallelA = createSlotAmpelRateStore(parallelBlob);
    const parallelB = createSlotAmpelRateStore(parallelBlob);
    const raced = await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        (index % 2 === 0 ? parallelA : parallelB).take({
          ipKey: "ip:race",
          emailKey: `em:race-${index}@example.com`,
          now: clock,
        }),
      ),
    );
    assertOk(
      raced.filter((decision) => decision === "ok").length === AMPEL_IP_LIMIT,
      "parallel instances take five IP slots",
    );
    assertOk(raced.filter((decision) => decision === "ip").length === 3, "parallel instances refuse the rest");

    const submitBlob = memoryBlob();
    const submitA = createSlotAmpelRateStore(submitBlob);
    const submitB = createSlotAmpelRateStore(submitBlob);
    let slotSends = 0;
    const slotMail = async () => {
      slotSends += 1;
      return { stub: false, sent: true, id: `slot-${slotSends}` };
    };
    for (let index = 0; index < AMPEL_IP_LIMIT; index += 1) {
      const sent = await submitAmpelResult(
        {
          email: `cross-${index}@example.com`,
          answers: jaCode,
          ref: "",
          marketing: false,
          honeypot: "",
          ip: "203.0.113.60",
        },
        { store: index % 2 === 0 ? submitA : submitB, now: () => clock, confirm: noConfirm, mail: slotMail },
      );
      assertOk(sent.ok && !("honeypot" in sent) && sent.mailed === true, `cross-instance send ${index + 1}`);
    }
    const crossBlocked = await submitAmpelResult(
      {
        email: "cross-blocked@example.com",
        answers: jaCode,
        ref: "",
        marketing: false,
        honeypot: "",
        ip: "203.0.113.60",
      },
      { store: submitA, now: () => clock, confirm: noConfirm, mail: slotMail },
    );
    assertOk(
      crossBlocked.ok && !("honeypot" in crossBlocked) && crossBlocked.limited === "ip" && crossBlocked.mailed === false && crossBlocked.notice === AMPEL_RESULT_MAIL.rateLimitedIp,
      "the sixth cross-instance submit is a 429",
    );
    assertOk(slotSends === AMPEL_IP_LIMIT, "the sixth submit sends no mail");

    assertOk(
      ampelClientIp(new Headers({ "x-forwarded-for": "203.0.113.8, 10.0.0.4" })) === "203.0.113.8",
      "the first forwarded address is the client",
    );
    assertOk(ampelClientIp(new Headers({ "x-real-ip": "198.51.100.9" })) === "198.51.100.9", "x-real-ip is the fallback");
    assertOk(
      ampelClientIp(new Headers({ "x-vercel-forwarded-for": "192.0.2.4" })) === "192.0.2.4",
      "the vercel forwarded header is the client address when it is the only one",
    );
    assertOk(ampelClientIp(new Headers()) === "", "a missing address is not a shared bucket");
    assertOk(
      readAmpelClientIp(
        new Headers({
          "x-forwarded-for": "198.51.100.20, 10.0.0.1",
          "x-real-ip": "198.51.100.21",
          "x-vercel-forwarded-for": "203.0.113.8",
        }),
      ).source === "x-real-ip" &&
        readAmpelClientIp(
          new Headers({
            "x-forwarded-for": "198.51.100.20, 10.0.0.1",
            "x-real-ip": "198.51.100.21",
            "x-vercel-forwarded-for": "203.0.113.8",
          }),
        ).ip === "198.51.100.21",
      "ipAddress reads x-real-ip before the forwarded headers",
    );
    assertOk(
      ampelClientIp(new Headers({ "x-forwarded-for": "198.51.100.20", "x-real-ip": "198.51.100.9" })) === "198.51.100.9",
      "x-real-ip wins over x-forwarded-for",
    );
    assertOk(
      ampelClientIp(new Headers({ "x-forwarded-for": " , 203.0.113.15" })) === "",
      "an empty first forwarded value is not an address",
    );
    assertOk(
      ampelClientIp(new Headers({ "x-vercel-forwarded-for": "unknown", "x-real-ip": "198.51.100.9" })) === "198.51.100.9",
      "the label unknown is not an address",
    );
    assertOk(ampelClientIp(new Headers({ "x-forwarded-for": "unknown" })) === "", "unknown alone is not a bucket");
    const stableLeft = ampelRateIpKey(
      readAmpelClientIp(
        new Headers({ "x-real-ip": "104.28.218.14", "x-vercel-forwarded-for": "203.0.113.1", "x-forwarded-for": "10.1.1.1" }),
      ).ip,
    );
    const stableRight = ampelRateIpKey(
      readAmpelClientIp(
        new Headers({ "x-real-ip": "104.28.218.14", "x-vercel-forwarded-for": "203.0.113.2", "x-forwarded-for": "10.2.2.2" }),
      ).ip,
    );
    assertOk(stableLeft === stableRight, "a rotating forwarded hop does not open a new IP bucket");
    const forwardedBuckets = new Set(
      Array.from({ length: 8 }, (_, index) => ampelRateIpKey(`203.0.113.${index + 1}`)),
    );
    assertOk(forwardedBuckets.size === 8, "eight different forwarded hops would be eight IP buckets");
    const hour = ampelRateWindowId(clock, AMPEL_IP_WINDOW_MS);
    const hourStart = hour * AMPEL_IP_WINDOW_MS;
    assertOk(ampelRateWindowId(hourStart + AMPEL_IP_WINDOW_MS - 1, AMPEL_IP_WINDOW_MS) === hour, "the IP window stays open for the hour");
    assertOk(ampelRateWindowId(hourStart + AMPEL_IP_WINDOW_MS, AMPEL_IP_WINDOW_MS) === hour + 1, "the next hour is a new IP window");
    assertOk(AMPEL_IP_LIMIT === 5, "the IP limit is five per hour");
    const slotPath = ampelRateSlotPath("ip", ampelRateIpKey("203.0.113.8"), hour, 1);
    assertOk(/\/ip-[a-f0-9]{32}-\d+-1$/.test(slotPath), "an IP slot is named ip-hash-window-n");
    const logLine = ampelRateLogLine("x-vercel-forwarded-for", 3, "203.0.113.8");
    assertOk(
      /^\[ampel\] rate src=x-vercel-forwarded-for slot=3 ip=[a-f0-9]{12}$/.test(logLine) && !logLine.includes("203.0.113.8"),
      "the rate log is one hashed line",
    );
    assertOk(
      ampelSendStatusNotice({ email: "delivered@resend.dev", status: 200, ok: true, mailed: true }) ===
        "Das Ergebnis wurde an delivered@resend.dev gesendet.",
      "a sent mail replaces the sending line",
    );
    assertOk(
      ampelSendStatusNotice({
        email: "delivered@resend.dev",
        status: 500,
        ok: false,
        error: "Das Ergebnis konnte gerade nicht gesendet werden.",
      }) === "Das Ergebnis konnte gerade nicht gesendet werden.",
      "a failed follow-up shows the error",
    );
    assertOk(
      ampelSendStatusNotice({ email: "delivered@resend.dev", status: 0, ok: false, aborted: true }) ===
        AMPEL_RESULT_MAIL.sendInterrupted,
      "a timeout replaces the sending line",
    );

    const blindObjects = new Map<string, string>();
    const blindStore = createSlotAmpelRateStore({
      async get() {
        return null;
      },
      async create(pathname, body) {
        if (blindObjects.has(pathname)) return "exists";
        blindObjects.set(pathname, body);
        return "created";
      },
      async remove(pathname) {
        blindObjects.delete(pathname);
      },
    });
    for (let index = 0; index < AMPEL_IP_LIMIT; index += 1) {
      const decision = await blindStore.take({
        ipKey: "ip:blind",
        emailKey: `em:blind-${index}@example.com`,
        now: clock,
      });
      assertOk(decision === "ok", `a blind read still reserves IP slot ${index + 1}`);
    }
    assertOk(
      (await blindStore.take({ ipKey: "ip:blind", emailKey: "em:blind-extra@example.com", now: clock })) === "ip",
      "five occupied IP slots are a 429 even when reads miss them",
    );
    const blindIpSlots = [...blindObjects.keys()].filter((key) => key.includes("/ip-"));
    assertOk(blindIpSlots.length === AMPEL_IP_LIMIT, "the IP limit keeps five slots");
    assertOk(
      blindIpSlots.every((key) => /\/ip-[a-f0-9]{32}-\d+-[1-5]$/.test(key)),
      "occupied IP slots use deterministic names",
    );

    let missingTakes = 0;
    const missingStore = createMemoryAmpelRateStore();
    const wrappedMissing = {
      async take(input: { ipKey: string; emailKey: string; now: number }) {
        missingTakes += 1;
        return missingStore.take(input);
      },
      confirm: missingStore.confirm.bind(missingStore),
    };
    const missingIp = await submitAmpelResult(
      { email: "missing-ip@example.com", answers: jaCode, ref: "", marketing: false, honeypot: "", ip: "" },
      { store: wrappedMissing, now: () => clock, confirm: noConfirm, handoff: true },
    );
    const unknownIp = await submitAmpelResult(
      { email: "unknown-ip@example.com", answers: neinCode, ref: "", marketing: false, honeypot: "", ip: "unknown" },
      { store: wrappedMissing, now: () => clock, confirm: noConfirm, handoff: true },
    );
    assertOk(
      missingIp.ok && !("honeypot" in missingIp) && missingIp.mailed === false && missingIp.pending !== true &&
        unknownIp.ok && !("honeypot" in unknownIp) && unknownIp.mailed === false && missingTakes === 0,
      "an empty or unknown address does not share a bucket and sends no mail",
    );

    const heldObjects = new Map<string, string>();
    const heldStore = createSlotAmpelRateStore({
      async get() {
        return null;
      },
      async create(pathname, body) {
        if (heldObjects.has(pathname)) return "exists";
        heldObjects.set(pathname, body);
        return "created";
      },
      async remove(pathname) {
        heldObjects.delete(pathname);
      },
    });
    const heldTokens = createMemoryAmpelSendTokenStore();
    const heldStatus = createMemoryAmpelMailStatusStore();
    let heldSends = 0;
    const heldInput = {
      email: "held@example.com",
      answers: jaCode,
      ref: "",
      marketing: false,
      honeypot: "",
      ip: "203.0.113.70",
    };
    const heldHandoff = await submitAmpelResult(heldInput, {
      store: heldStore,
      now: () => clock,
      confirm: noConfirm,
      handoff: true,
      status: heldStatus,
      tokens: heldTokens,
      mail: async () => {
        heldSends += 1;
        return { stub: false as const, sent: true as const, id: "held" };
      },
    });
    const heldIpSlots = [...heldObjects.keys()].filter((key) => key.includes("/ip-")).length;
    const heldDone = await completeAmpelResult(
      { ...heldInput, sendToken: heldHandoff.ok && !("honeypot" in heldHandoff) ? heldHandoff.token : "" },
      {
        store: heldStore,
        now: () => clock,
        confirm: noConfirm,
        status: heldStatus,
        tokens: heldTokens,
        mail: async () => {
          heldSends += 1;
          return { stub: false, sent: true, id: "held-2" };
        },
      },
    );
    assertOk(
      heldDone.ok && !("honeypot" in heldDone) && heldDone.mailed === true && heldSends === 1 &&
        [...heldObjects.keys()].filter((key) => key.includes("/ip-")).length === heldIpSlots,
      "senden confirms the reserved IP slot and does not open another",
    );

    const rateSource = readFileSync("lib/ampel-rate-limit.ts", "utf8");
    const factory = rateSource.slice(rateSource.indexOf("export function ampelRateStore"));
    const slotSource = readFileSync("lib/ampel-blob-slot.ts", "utf8");
    const tokenSource = readFileSync("lib/ampel-send-token.ts", "utf8");
    assertOk(rateSource.includes("useCache: false"), "blob rate reads bypass the cache");
    assertOk(
      slotSource.includes("addRandomSuffix: false") && slotSource.includes("allowOverwrite: false"),
      "exclusive blob slots disable the random suffix",
    );
    assertOk(
      rateSource.includes("exclusiveBlobCreate") && tokenSource.includes("exclusiveBlobCreate"),
      "IP, email, and token slots share the exclusive put",
    );
    const submitSource = readFileSync("lib/ampel-result-send.ts", "utf8");
    const takeAt = submitSource.indexOf("await store.take(");
    const issueAt = submitSource.indexOf("issueAmpelSendToken(");
    assertOk(takeAt !== -1 && issueAt !== -1 && takeAt < issueAt, "the IP slot is occupied before the send token is issued");
    assertOk(
      rateSource.includes("cacheControlMaxAge: AMPEL_RATE_BLOB_CACHE_MAX_AGE"),
      "rate blobs set the shortest cache lifetime",
    );
    assertOk(rateSource.includes('AMPEL_RATE_BLOB_PREFIX = "gobd/ampel-rate"'), "each window has its own slot keys");
    assertOk(
      factory.indexOf("createBlobAmpelRateStore") < factory.indexOf("createFileAmpelRateStore"),
      "the shared store is blob before any local file",
    );
    assertOk(factory.includes("createClosedAmpelRateStore"), "vercel without blob does not count in /tmp");
    assertOk(AMPEL_SEND_TIMEOUT_MS === 8_000, "mail and pdf steps time out after 8 seconds");

    let hungSends = 0;
    const hung = await submitAmpelResult(
      { email: "hung@example.com", answers: jaCode, ref: "", marketing: true, honeypot: "", ip: "203.0.113.50" },
      {
        store: createSlotAmpelRateStore(memoryBlob()),
        now: () => clock,
        sendTimeoutMs: 40,
        confirm: async () => {
          throw new Error("should-not-confirm");
        },
        mail: () =>
          new Promise<Awaited<ReturnType<typeof slotMail>>>(() => {
            hungSends += 1;
          }),
      },
    );
    assertOk(
      hung.ok && !("honeypot" in hung) && hung.mailed === false && hung.notice === AMPEL_RESULT_MAIL.shownWithoutMail,
      "a hung send still returns the result without a mail",
    );
    assertOk(hungSends === 1, "the hung send was started once");

    let closedSends = 0;
    const closed = await submitAmpelResult(
      { email: "closed@example.com", answers: neinCode, ref: "", marketing: true, honeypot: "", ip: "203.0.113.51" },
      {
        store: {
          async take() {
            throw new Error("blob-down");
          },
          async confirm() {
            throw new Error("blob-down");
          },
        },
        now: () => clock,
        confirm: async () => {
          throw new Error("should-not-confirm");
        },
        mail: async () => {
          closedSends += 1;
          return { stub: false, sent: true, id: "nope" };
        },
      },
    );
    assertOk(
      closed.ok && !("honeypot" in closed) && closed.mailed === false && closedSends === 0,
      "an unreadable limit store sends no mail",
    );

    let timedOut = false;
    try {
      await withDeadline(new Promise(() => undefined), 30);
    } catch (error) {
      timedOut = error instanceof Error && error.message === "ampel-timeout";
    }
    assertOk(timedOut, "the deadline rejects a step that does not finish");

    type BlobMode = "sdk" | "unknown" | "suspended" | "precondition" | "suffix";
    function blobLike(
      mode: BlobMode,
      objects = new Map<string, string>(),
    ) {
      const calls: { pathname: string; addRandomSuffix?: boolean; allowOverwrite?: boolean }[] = [];
      let suffix = 0;
      return {
        objects,
        calls,
        async put(pathname: string, body: string, options: Partial<ExclusivePutOptions> = {}) {
          calls.push({
            pathname,
            addRandomSuffix: options.addRandomSuffix,
            allowOverwrite: options.allowOverwrite,
          });
          if (mode === "suspended") throw new BlobError("This store has been suspended.");
          if (mode === "precondition") throw new BlobPreconditionFailedError();
          const suffixOn = options.addRandomSuffix !== false || mode === "suffix";
          const stored = suffixOn ? `${pathname}-rand${++suffix}` : pathname;
          if (!suffixOn && objects.has(stored)) {
            if (mode === "unknown") throw new BlobUnknownError();
            throw new BlobError("The blob already exists, use allowOverwrite: true to overwrite it.");
          }
          objects.set(stored, body);
          return { pathname: stored };
        },
        async read(pathname: string) {
          return objects.get(pathname) ?? null;
        },
        async remove(pathname: string) {
          objects.delete(pathname);
        },
      };
    }

    const loose = blobLike("sdk");
    const looseFirst = await loose.put("gobd/ampel-rate/ip-demo-1-1", "{}");
    const looseSecond = await loose.put("gobd/ampel-rate/ip-demo-1-1", "{}");
    assertOk(
      looseFirst.pathname !== "gobd/ampel-rate/ip-demo-1-1" &&
        looseSecond.pathname !== looseFirst.pathname &&
        loose.objects.size === 2,
      "the Blob default adds a suffix, so an existing pathname never conflicts",
    );

    const sameAddress = "104.28.218.14";
    const seenIps = Array.from({ length: 8 }, (_, index) =>
      readAmpelClientIp(
        new Headers({
          "x-real-ip": sameAddress,
          "x-vercel-forwarded-for": `203.0.113.${index + 1}`,
          "x-forwarded-for": `198.51.100.${index + 1}`,
        }),
      ),
    );
    assertOk(
      seenIps.every((item) => item.source === "x-real-ip" && item.ip === sameAddress) &&
        new Set(seenIps.map((item) => ampelRateIpKey(item.ip))).size === 1,
      "eight requests with one x-real-ip share one bucket",
    );

    const live = blobLike("sdk");
    const liveStore = createBlobPutAmpelRateStore(live);
    const windowId = ampelRateWindowId(clock, AMPEL_IP_WINDOW_MS);
    let liveSends = 0;
    for (let index = 0; index < 8; index += 1) {
      const sent = await submitAmpelResult(
        {
          email: `blob-${index}@example.com`,
          answers: index % 2 === 0 ? jaCode : neinCode,
          ref: "",
          marketing: false,
          honeypot: "",
          ip: seenIps[index]?.ip ?? "",
          ipSource: seenIps[index]?.source ?? "",
        },
        {
          store: liveStore,
          now: () => clock,
          confirm: noConfirm,
          mail: async () => {
            liveSends += 1;
            return { stub: false, sent: true, id: `live-${liveSends}` };
          },
        },
      );
      assertOk(sent.ok && !("honeypot" in sent), `blob-backed submit ${index + 1} answers`);
      if (!sent.ok || "honeypot" in sent) fail("blob-backed submit");
      if (index < AMPEL_IP_LIMIT) {
        assertOk(
          sent.mailed === true && sent.trace?.src === "x-real-ip" && sent.trace.slot === index + 1 && sent.trace.win === windowId,
          `request ${index + 1} takes the next IP slot in the same window`,
        );
      } else {
        assertOk(
          sent.limited === "ip" && sent.mailed === false && sent.trace?.slot === 0 && sent.trace?.win === windowId,
          `request ${index + 1} is limited in the same window`,
        );
      }
    }
    assertOk(liveSends === AMPEL_IP_LIMIT, "the sixth blob-backed submit sends no mail");
    assertOk(
      live.calls.length > 0 && live.calls.every((call) => call.addRandomSuffix === false && call.allowOverwrite === false),
      "rate slots pass addRandomSuffix false and allowOverwrite false",
    );
    const liveIpSlots = [...live.objects.keys()].filter((key) => key.includes("/ip-"));
    assertOk(
      liveIpSlots.length === AMPEL_IP_LIMIT && liveIpSlots.every((key) => new RegExp(`/ip-[a-f0-9]{32}-${windowId}-[1-5]$`).test(key)),
      "five IP slots keep the requested pathname",
    );

    const exclusiveEmail = blobLike("sdk");
    const exclusiveEmailStore = createBlobPutAmpelRateStore(exclusiveEmail);
    for (let index = 0; index < AMPEL_EMAIL_LIMIT; index += 1) {
      const decision = await exclusiveEmailStore.take({
        ipKey: ampelRateIpKey(`198.51.100.${index + 1}`),
        emailKey: "em:same@example.com",
        now: clock,
      });
      assertOk(decision === "ok", `email slot ${index + 1} is free`);
    }
    assertOk(
      (await exclusiveEmailStore.take({
        ipKey: ampelRateIpKey("198.51.100.40"),
        emailKey: "em:same@example.com",
        now: clock,
      })) === "email",
      "the fourth email slot is occupied",
    );
    assertOk(
      [...exclusiveEmail.objects.keys()].filter((key) => key.includes("/email-")).length === AMPEL_EMAIL_LIMIT,
      "email slots use the same exclusive pathname",
    );

    const unknownBlob = blobLike("unknown");
    const unknownStore = createBlobPutAmpelRateStore(unknownBlob);
    let unknownSends = 0;
    for (let index = 0; index < AMPEL_IP_LIMIT + 1; index += 1) {
      const sent = await submitAmpelResult(
        {
          email: `unknown-blob-${index}@example.com`,
          answers: jaCode,
          ref: "",
          marketing: false,
          honeypot: "",
          ip: sameAddress,
          ipSource: "x-real-ip",
        },
        {
          store: unknownStore,
          now: () => clock,
          confirm: noConfirm,
          mail: async () => {
            unknownSends += 1;
            return { stub: false, sent: true, id: `unknown-${unknownSends}` };
          },
        },
      );
      assertOk(sent.ok && !("honeypot" in sent), "unknown-blob submit");
      if (!sent.ok || "honeypot" in sent) fail("unknown-blob submit");
      if (index < AMPEL_IP_LIMIT) assertOk(sent.mailed === true, `swallowed already-exists still fills slot ${index + 1}`);
      else assertOk(sent.limited === "ip" && sent.mailed === false, "a swallowed already-exists error is occupied, not free");
    }
    assertOk(unknownSends === AMPEL_IP_LIMIT, "BlobUnknownError on an existing pathname sends no sixth mail");

    async function closedPut(mode: "suspended" | "precondition", label: string) {
      const blob = blobLike(mode);
      let sends = 0;
      const sent = await submitAmpelResult(
        {
          email: `${label}@example.com`,
          answers: jaCode,
          ref: "",
          marketing: false,
          honeypot: "",
          ip: sameAddress,
          ipSource: "x-real-ip",
        },
        {
          store: createBlobPutAmpelRateStore(blob),
          now: () => clock,
          confirm: noConfirm,
          mail: async () => {
            sends += 1;
            return { stub: false, sent: true, id: label };
          },
        },
      );
      assertOk(
        sent.ok && !("honeypot" in sent) && sent.mailed === false && sent.limited !== "ip" && sent.limited !== "email" && sends === 0,
        `${label} fails closed and sends no mail`,
      );
    }
    await closedPut("suspended", "suspended-store");
    await closedPut("precondition", "etag-mismatch");

    const suffixed = blobLike("suffix");
    let suffixSends = 0;
    const suffixSent = await submitAmpelResult(
      {
        email: "suffix@example.com",
        answers: jaCode,
        ref: "",
        marketing: false,
        honeypot: "",
        ip: sameAddress,
        ipSource: "x-real-ip",
      },
      {
        store: createBlobPutAmpelRateStore(suffixed),
        now: () => clock,
        confirm: noConfirm,
        mail: async () => {
          suffixSends += 1;
          return { stub: false, sent: true, id: "suffix" };
        },
      },
    );
    assertOk(
      suffixSent.ok && !("honeypot" in suffixSent) && suffixSent.mailed === false && suffixSends === 0 && suffixed.objects.size === 0,
      "a suffixed pathname is not a free slot and sends no mail",
    );

    const paired = blobLike("sdk");
    const pairedStore = createBlobPutAmpelRateStore(paired);
    const pairedTokens = createBlobPutAmpelSendTokenStore(paired);
    const pairedStatus = createMemoryAmpelMailStatusStore();
    const pairedInput = {
      email: "paired@example.com",
      answers: jaCode,
      ref: "",
      marketing: false,
      honeypot: "",
      ip: sameAddress,
      ipSource: "x-real-ip",
    };
    const pairedHandoff = await submitAmpelResult(pairedInput, {
      store: pairedStore,
      now: () => clock,
      confirm: noConfirm,
      handoff: true,
      status: pairedStatus,
      tokens: pairedTokens,
    });
    assertOk(pairedHandoff.ok && !("honeypot" in pairedHandoff) && pairedHandoff.pending === true, "the paired handoff reserves a slot");
    if (!pairedHandoff.ok || "honeypot" in pairedHandoff) fail("paired handoff");
    const ratePuts = paired.calls.filter((call) => call.pathname.includes("/ampel-rate/")).length;
    assertOk(ratePuts >= 2 && paired.calls.every((call) => !call.pathname.includes("/ampel-send/")), "the slot is occupied before the token is stored");
    let pairedSends = 0;
    const pairedDone = await completeAmpelResult(
      { ...pairedInput, sendToken: pairedHandoff.token },
      {
        store: pairedStore,
        now: () => clock,
        confirm: noConfirm,
        status: pairedStatus,
        tokens: pairedTokens,
        mail: async () => {
          pairedSends += 1;
          return { stub: false, sent: true, id: "paired" };
        },
      },
    );
    assertOk(
      pairedDone.ok && !("honeypot" in pairedDone) && pairedDone.mailed === true && pairedSends === 1 &&
        pairedHandoff.trace?.win === windowId && pairedDone.trace?.win === windowId &&
        pairedHandoff.trace?.slot === 1 && pairedDone.trace?.slot === 1,
      "submit and senden use the same window and the reserved slot",
    );
    assertOk(
      [...paired.objects.keys()].filter((key) => key.includes("/ip-")).length === 1,
      "senden does not open a second IP slot",
    );
    const tokenPuts = paired.calls.filter((call) => call.pathname.includes("/ampel-send/"));
    assertOk(
      tokenPuts.length === 1 && tokenPuts.every((call) => call.addRandomSuffix === false && call.allowOverwrite === false),
      "the token slot is an exclusive pathname",
    );
    const reused = await consumeAmpelSendToken(
      { token: pairedHandoff.token, email: pairedInput.email, code: jaCode, now: clock },
      pairedTokens,
    );
    assertOk(reused.verdict === "reused", "a second consume of the same token slot sends nothing");

    const header = ampelRateResponseHeader("x-real-ip", 2, windowId);
    assertOk(header === `src=x-real-ip;slot=2;win=${windowId}` && !header.includes(sameAddress), "the rate header has no address");
    assertOk(ampelRateResponseHeader(sameAddress, 9, -1) === "src=none;slot=0;win=0", "a raw address cannot be a rate header source");
    const shaped = ampelApiResponse({ ok: true }, 200, "x-real-ip", { src: "x-real-ip", slot: 2, win: windowId }, clock);
    assertOk(shaped.headers.get("x-ampel-rl") === header, "the submit response sets x-ampel-rl");
    const badJson = await postAmpelErgebnis(
      new Request("http://localhost/api/ampel/ergebnis", {
        method: "POST",
        headers: { "x-real-ip": sameAddress, "x-vercel-forwarded-for": "203.0.113.8" },
        body: "{",
      }),
    );
    const badHeader = badJson.headers.get("x-ampel-rl") ?? "";
    assertOk(
      badJson.status === 400 && badHeader.startsWith("src=x-real-ip;slot=0;win=") && !badHeader.includes(sameAddress),
      "submit sets x-ampel-rl from ipAddress",
    );
    const denied = await postAmpelErgebnisSenden(
      new Request("http://localhost/api/ampel/ergebnis/senden", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-real-ip": sameAddress,
          "x-vercel-forwarded-for": "203.0.113.9",
        },
        body: JSON.stringify({ email: "not-an-email", answers: "x" }),
      }),
    );
    const deniedHeader = denied.headers.get("x-ampel-rl") ?? "";
    assertOk(
      denied.status === 403 && deniedHeader.startsWith("src=x-real-ip;slot=0;win=") && !deniedHeader.includes(sameAddress),
      "senden sets x-ampel-rl before it validates the email",
    );

    const indexDelayMs = 5_000;
    const indexed = new Map<string, { body: string; writtenAt: number }>();
    let indexNow = clock;
    let indexPuts = 0;
    const indexedBlob = {
      objects: indexed,
      puts: () => indexPuts,
      setNow(value: number) {
        indexNow = value;
      },
      async put(pathname: string, body: string, options: Partial<ExclusivePutOptions> = {}) {
        indexPuts += 1;
        assertOk(options.addRandomSuffix === false && options.allowOverwrite === false, "the indexed put keeps both flags");
        const current = indexed.get(pathname);
        if (current && indexNow - current.writtenAt >= indexDelayMs) {
          throw new BlobUnknownError();
        }
        if (!current) indexed.set(pathname, { body, writtenAt: indexNow });
        return { pathname };
      },
      async read(pathname: string) {
        const current = indexed.get(pathname);
        return current ? current.body : null;
      },
      async remove(pathname: string) {
        indexed.delete(pathname);
      },
    };
    const indexedStore = createBlobPutAmpelRateStore(indexedBlob);
    const freshPath = "gobd/ampel-rate/ip-index-demo";
    indexedBlob.setNow(clock);
    const firstPut = await indexedBlob.put(freshPath, "{\"n\":\"a\"}", { addRandomSuffix: false, allowOverwrite: false });
    indexedBlob.setNow(clock + 100);
    let secondThrew = false;
    let secondPath = "";
    try {
      secondPath = (await indexedBlob.put(freshPath, "{\"n\":\"b\"}", { addRandomSuffix: false, allowOverwrite: false })).pathname;
    } catch (error) {
      secondThrew = error instanceof BlobUnknownError;
    }
    assertOk(
      firstPut.pathname === freshPath && !secondThrew && secondPath === freshPath &&
        !(new BlobUnknownError().message.toLowerCase().includes("already exists")),
      "a re-put before the index catches up returns 200 with the same pathname, and BlobUnknownError drops the exists message",
    );
    indexed.delete(freshPath);
    let indexedSends = 0;
    const indexedTokens = createMemoryAmpelSendTokenStore();
    const indexedStatus = createMemoryAmpelMailStatusStore();
    for (let index = 0; index < 8; index += 1) {
      const at = clock + index * indexDelayMs;
      indexedBlob.setNow(at);
      const input = {
        email: `indexed-${index}@example.com`,
        answers: index % 2 === 0 ? jaCode : neinCode,
        ref: "",
        marketing: false,
        honeypot: "",
        ip: sameAddress,
        ipSource: "x-real-ip",
      };
      const handoff = await submitAmpelResult(input, {
        store: indexedStore,
        now: () => at,
        confirm: noConfirm,
        handoff: true,
        tokens: indexedTokens,
        status: indexedStatus,
      });
      assertOk(handoff.ok && !("honeypot" in handoff), `indexed submit ${index + 1}`);
      if (!handoff.ok || "honeypot" in handoff) fail("indexed submit");
      if (index >= AMPEL_IP_LIMIT) {
        assertOk(handoff.limited === "ip" && handoff.pending !== true && handoff.trace?.slot === 0 && handoff.trace?.win === windowId, "the sixth indexed submit is a 429 in the same window");
        continue;
      }
      assertOk(handoff.pending === true && handoff.trace?.slot === index + 1, `indexed submit ${index + 1} takes a new slot`);
      const putsBeforeSend = indexPuts;
      indexedBlob.setNow(at + 100);
      const sent = await completeAmpelResult(
        { ...input, sendToken: handoff.token },
        {
          store: indexedStore,
          now: () => at + 100,
          confirm: noConfirm,
          tokens: indexedTokens,
          status: indexedStatus,
          mail: async () => {
            indexedSends += 1;
            return { stub: false, sent: true, id: `indexed-${indexedSends}` };
          },
        },
      );
      assertOk(
        sent.ok && !("honeypot" in sent) && sent.mailed === true && indexPuts === putsBeforeSend &&
          sent.trace?.slot === index + 1 && sent.trace?.win === windowId,
        `senden ${index + 1} mails without putting the slot again`,
      );
    }
    assertOk(indexedSends === AMPEL_IP_LIMIT, "five indexed reservations send, the rest do not");
    assertOk(
      [...indexed.keys()].filter((key) => key.includes("/ip-")).length === AMPEL_IP_LIMIT,
      "a follow-up send does not delete the reserved IP slots",
    );
    const conflict = await indexedBlob.put(
      [...indexed.keys()].find((key) => key.includes("/ip-")) ?? freshPath,
      "{\"n\":\"late\"}",
      { addRandomSuffix: false, allowOverwrite: false },
    ).then(
      () => "created",
      (error: unknown) => (error instanceof BlobUnknownError ? "unknown" : "other"),
    );
    assertOk(conflict === "unknown", "an indexed pathname makes put throw BlobUnknownError");

    const flakyBase = createMemoryAmpelRateStore();
    const flakyStore = {
      take: flakyBase.take.bind(flakyBase),
      async confirm() {
        throw new Error("blob-index");
      },
    };
    const flakyTokens = createMemoryAmpelSendTokenStore();
    const flakyStatus = createMemoryAmpelMailStatusStore();
    const flakyInput = {
      email: "flaky-confirm@example.com",
      answers: jaCode,
      ref: "",
      marketing: false,
      honeypot: "",
      ip: sameAddress,
      ipSource: "x-real-ip",
    };
    const flakyHandoff = await submitAmpelResult(flakyInput, {
      store: flakyStore,
      now: () => clock,
      confirm: noConfirm,
      handoff: true,
      tokens: flakyTokens,
      status: flakyStatus,
    });
    assertOk(flakyHandoff.ok && !("honeypot" in flakyHandoff) && flakyHandoff.token, "a passed limit still issues a token");
    let flakySends = 0;
    const flakyDone = await completeAmpelResult(
      { ...flakyInput, sendToken: flakyHandoff.ok && !("honeypot" in flakyHandoff) ? flakyHandoff.token : "" },
      {
        store: flakyStore,
        now: () => clock,
        confirm: noConfirm,
        tokens: flakyTokens,
        status: flakyStatus,
        mail: async () => {
          flakySends += 1;
          return { stub: false, sent: true, id: "flaky" };
        },
      },
    );
    assertOk(
      flakyDone.ok && !("honeypot" in flakyDone) && flakyDone.mailed === true && flakySends === 1,
      "a confirm error still sends the token-bound mail",
    );
  } finally {
    setMailDedupeTestHooks(null);
    await rm(mailDir, { recursive: true, force: true });
    await rm(rateDir, { recursive: true, force: true });
  }

  assertOk(!privacyText.includes("90 Tage"), "the published ampel text names no 90-day deletion");
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
  const storeSource = readFileSync("lib/store.ts", "utf8");
  const resultSendSource = readFileSync("lib/ampel-result-send.ts", "utf8");
  const retentionSource = readFileSync("lib/ampel-retention.ts", "utf8");
  assertOk(!storeSource.includes("purgeExpiredAmpelLeads") && !storeSource.includes("ampelRecordExpired"), "stored leads are not purged on read");
  assertOk(!resultSendSource.includes("purgeExpired"), "sending a result does not purge leads");
  assertOk(!retentionSource.includes("RETENTION_DAYS") && !retentionSource.includes("ampelRecordExpired"), "the lead timer is gone");
  assertOk(baseLead.email === "keep@example.com" && day > 0, "an old lead row is left intact");

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

  const guardEmail = "delivered@resend.dev";
  const guardLeads = new Map<string, ReadinessLead>();
  const guardStore = createMemoryAmpelSuppressionStore();
  setAmpelSuppressionTestStore(guardStore);
  setAmpelMarketingLeadLookup(async (address) =>
    [...guardLeads.values()].filter((lead) => lead.email === address),
  );
  const guardMailDir = await mkdtemp(path.join(tmpdir(), "ampel-guard-"));
  const savedResend = process.env.RESEND_API_KEY;
  const savedFrom = process.env.EMAIL_FROM;
  process.env.RESEND_API_KEY = "re_test_ampel_guard";
  process.env.EMAIL_FROM = "GoBD Verfahrensdoku <info@gobd-doku-erstellen.de>";
  const logged: string[] = [];
  const previousInfo = console.info;
  const previousError = console.error;
  const remember = (args: unknown[]) => {
    logged.push(args.map((part) => (typeof part === "string" ? part : JSON.stringify(part))).join(" "));
  };
  console.info = (...args: unknown[]) => {
    remember(args);
    previousInfo(...args);
  };
  console.error = (...args: unknown[]) => {
    remember(args);
    previousError(...args);
  };
  let providerSends = 0;
  const deliveredMails: { subject: string; headers?: Record<string, string>; text: string }[] = [];
  try {
    setMailDedupeTestHooks({
      dir: guardMailDir,
      send: async (input) => {
        providerSends += 1;
        deliveredMails.push({ subject: input.subject, headers: input.headers, text: input.text });
        return { stub: false, sent: true, id: `guard-${providerSends}` };
      },
    });
    const t0 = Date.parse("2026-10-14T10:00:00.000Z");
    const bareToken = createAmpelDoiToken(
      { email: guardEmail, answers: jaCode, ref: "", consentAt: new Date(t0).toISOString() },
      t0,
    );
    const barePayload = verifyAmpelDoiToken(bareToken, t0);
    const blockedBare = barePayload ? await sendAmpelResultMail(barePayload) : null;
    assertOk(
      blockedBare?.sent === false && blockedBare.blocked === "no-confirmed-doi" && providerSends === 0,
      "sendAmpelResultMail without a confirmed DOI does not send",
    );

    const findGuardLead = async (leadEmail: string, answersCode: string) => {
      const rows = [...guardLeads.values()].filter(
        (lead) => lead.email === leadEmail && lead.ampelAnswers === answersCode,
      );
      rows.sort((a, b) => Date.parse(a.consentAt) - Date.parse(b.consentAt));
      return rows.at(-1) ?? null;
    };
    const saveGuardLead = async (lead: ReadinessLead) => {
      guardLeads.set(lead.leadId, { ...lead });
    };
    const doiTokens: string[] = [];
    const sendConfirmation = async (input: { email: string; token: string }) => {
      doiTokens.push(input.token);
      return sendAmpelConfirmationMail(input);
    };
    const guardDeps = {
      sleep: async () => undefined,
      findLead: findGuardLead,
      saveLead: saveGuardLead,
      sendConfirmation,
    };
    const requested = await requestAmpelConfirmation(
      { email: guardEmail, answers: jaCode, ref: "", consentTextVersion: AMPEL_CONSENT_TEXT_VERSION },
      { ...guardDeps, now: () => t0 },
    );
    assertOk(requested.ok === true && requested.blocked !== "suppressed" && providerSends === 1, "the DOI mail is sent for a new checkbox");
    const doiHeaders = deliveredMails[0]?.headers;
    const confirmed = await confirmAmpelDoi(doiTokens[0] ?? "", {
      now: () => t0 + 1000,
      sleep: async () => undefined,
      findLead: async (leadId) => guardLeads.get(leadId) ?? null,
      saveLead: saveGuardLead,
      sendResult: (payload) => sendAmpelResultMail(payload),
    });
    assertOk(confirmed.ok === true && providerSends === 2, "a confirmed DOI sends the price mail");
    const ctaHeaders = deliveredMails[1]?.headers;
    const headerOk = (headers: Record<string, string> | undefined) => {
      const list = headers?.["List-Unsubscribe"] ?? "";
      return (
        list.includes("/api/ampel/abmelden?token=") &&
        list.includes("<mailto:info@gobd-doku-erstellen.de?subject=Abmelden>") &&
        !list.includes(guardEmail) &&
        headers?.["List-Unsubscribe-Post"] === "List-Unsubscribe=One-Click"
      );
    };
    assertOk(headerOk(doiHeaders) && headerOk(ctaHeaders), "DOI and price mails set both unsubscribe headers");
    assertOk(
      deliveredMails[0]?.text.includes(consentSentence) === true,
      "the sent DOI mail uses the checkbox scope",
    );

    const firstLead = [...guardLeads.values()][0];
    const unsubscribeToken = createAmpelUnsubscribeToken(guardEmail, firstLead?.consentAt ?? "");
    const withdrawnGuard = await withdrawAmpelMarketing(unsubscribeToken ?? "", {
      now: () => t0 + 60_000,
      list: async () => [...guardLeads.values()],
      save: saveGuardLead,
    });
    const suppression = await readAmpelSuppression(guardEmail);
    assertOk(
      withdrawnGuard.ok === true &&
        firstLead &&
        guardLeads.get(firstLead.leadId)?.marketingOptIn === "withdrawn" &&
        suppression?.withdrawnAt === new Date(t0 + 60_000).toISOString(),
      "withdrawal writes the suppression list",
    );
    assertOk(
      [...guardStore.raw().values()].every((row) => !JSON.stringify(row).includes("@")),
      "the suppression record stores no address",
    );
    const sendsAfterWithdraw = providerSends;
    const oldAgain = await confirmAmpelDoi(doiTokens[0] ?? "", {
      now: () => t0 + 61_000,
      sleep: async () => undefined,
      findLead: async (leadId) => guardLeads.get(leadId) ?? null,
      saveLead: saveGuardLead,
      sendResult: (payload) => sendAmpelResultMail(payload),
    });
    const oldPayload = verifyAmpelDoiToken(doiTokens[0], t0 + 1000);
    const oldSend = oldPayload ? await sendAmpelResultMail(oldPayload) : null;
    assertOk(
      oldAgain.ok === true && oldSend?.blocked === "no-confirmed-doi" && providerSends === sendsAfterWithdraw,
      "a withdrawn consent does not send the price mail",
    );

    const tNew = t0 + 120_000;
    const renewed = await requestAmpelConfirmation(
      { email: guardEmail, answers: jaCode, ref: "", consentTextVersion: AMPEL_CONSENT_TEXT_VERSION },
      { ...guardDeps, now: () => tNew },
    );
    assertOk(
      renewed.ok === true && renewed.blocked !== "suppressed" && doiTokens.length === 2 && providerSends === sendsAfterWithdraw + 1,
      "a new checkbox after withdrawal still receives the DOI mail",
    );
    const pendingPayload = verifyAmpelDoiToken(doiTokens[1], tNew);
    const pendingSend = pendingPayload ? await sendAmpelResultMail(pendingPayload) : null;
    assertOk(
      pendingSend?.blocked === "no-confirmed-doi" && providerSends === sendsAfterWithdraw + 1,
      "without the new DOI click no price mail goes out",
    );
    const renewedConfirm = await confirmAmpelDoi(doiTokens[1] ?? "", {
      now: () => tNew + 1000,
      sleep: async () => undefined,
      findLead: async (leadId) => guardLeads.get(leadId) ?? null,
      saveLead: saveGuardLead,
      sendResult: (payload) => sendAmpelResultMail(payload),
    });
    const renewedRow = [...guardLeads.values()].find((lead) => lead.consentAt === pendingPayload?.consentAt);
    assertOk(
      renewedConfirm.ok === true &&
        renewedRow?.marketingOptIn === "confirmed" &&
        Boolean(renewedRow?.doiConfirmedAt) &&
        providerSends === sendsAfterWithdraw + 2,
      "a DOI confirmed after withdrawal sends the price mail",
    );

    const staleConsent = new Date(t0).toISOString();
    const stale = toAmpelReadinessLead({
      email: guardEmail,
      answers: neinCode,
      ref: "",
      consentAt: staleConsent,
      doiConfirmedAt: "",
      score: 10,
      light: "rot",
      mailStatus: "confirm_sent",
      marketingOptIn: "pending",
    });
    guardLeads.set(stale.leadId, stale);
    const sendsBeforeFresh = providerSends;
    const freshAfterSuppression = await requestAmpelConfirmation(
      { email: guardEmail, answers: neinCode, ref: "", consentTextVersion: AMPEL_CONSENT_TEXT_VERSION },
      { ...guardDeps, now: () => tNew + 10_000 },
    );
    assertOk(
      freshAfterSuppression.ok === true &&
        freshAfterSuppression.blocked !== "suppressed" &&
        providerSends === sendsBeforeFresh + 1,
      "a suppressed pending consent does not block a new checkbox",
    );

    const pdfBefore = providerSends;
    const transactional = await deliverAmpelResult(
      guardEmail,
      all("ja"),
      jaCode,
      { email: guardEmail, answers: jaCode, ref: "", marketing: false, honeypot: "", ip: "203.0.113.50" },
      {
        purge: async () => undefined,
        saveLead: async () => undefined,
        confirm: async () => {
          throw new Error("marketing");
        },
      },
    );
    const transactionalMail = deliveredMails.at(-1);
    assertOk(
      transactional.ok === true &&
        !("honeypot" in transactional) &&
        transactional.mailed === true &&
        transactional.marketing === "skipped" &&
        providerSends === pdfBefore + 1 &&
        transactionalMail?.subject === "Ihr Ergebnis der Betriebsprüfungs-Ampel" &&
        !transactionalMail.text.includes(AMPEL_CTA.price) &&
        transactionalMail.headers?.["List-Unsubscribe"] == null,
      "Ergebnis-Mail ohne Opt-in wird gesendet",
    );
    assertOk(
      (await readAmpelSuppression(guardEmail)) != null && transactional.ok === true && !("honeypot" in transactional) && transactional.mailed === true,
      "Ergebnis-Mail nach Widerruf wird gesendet",
    );
    const directPdf = await sendAmpelPdfMail({ email: guardEmail, answers: all("nein"), code: neinCode });
    assertOk(directPdf.sent === true && directPdf.blocked == null, "sendAmpelPdfMail ignores DOI and the suppression list");

    const routeLeads = new Map<string, ReadinessLead>();
    const routeStore = createMemoryAmpelSuppressionStore();
    setAmpelSuppressionTestStore(routeStore);
    let routeNow = Date.parse("2026-10-14T12:00:00.000Z");
    setAmpelWithdrawTestDeps({
      now: () => routeNow,
      list: async () => [...routeLeads.values()],
      save: async (lead) => {
        routeLeads.set(lead.leadId, { ...lead });
      },
    });
    const routeConsent = new Date(routeNow).toISOString();
    const routeLead = toAmpelReadinessLead({
      email: guardEmail,
      answers: jaCode,
      ref: "",
      consentAt: routeConsent,
      doiConfirmedAt: routeConsent,
      score: 100,
      light: "gruen",
      mailStatus: "sent",
      marketingOptIn: "confirmed",
    });
    routeLeads.set(routeLead.leadId, routeLead);
    const routeToken = createAmpelUnsubscribeToken(guardEmail, routeConsent) ?? "";
    const scanned = await getAmpelAbmelden(
      new Request(`https://www.gobd-doku-erstellen.de/api/ampel/abmelden?token=${encodeURIComponent(routeToken)}`),
    );
    assertOk(scanned.status === 303, "GET does not unsubscribe");
    const location = scanned.headers.get("location") ?? "";
    assertOk(
      location.includes("/ampel-check/abmelden") && location.includes("token="),
      "GET opens the confirmation page",
    );
    assertOk(
      routeLeads.get(routeLead.leadId)?.marketingOptIn === "confirmed" && (await readAmpelSuppression(guardEmail)) == null,
      "GET leaves the consent and the suppression list unchanged",
    );
    const wrong = await postAmpelAbmelden(
      new Request("https://www.gobd-doku-erstellen.de/api/ampel/abmelden?token=not-a-token", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: "List-Unsubscribe=One-Click",
      }),
    );
    assertOk(wrong.status === 400 && routeLeads.get(routeLead.leadId)?.marketingOptIn === "confirmed", "a wrong token is rejected");
    const oneClick = await postAmpelAbmelden(
      new Request(`https://www.gobd-doku-erstellen.de/api/ampel/abmelden?token=${encodeURIComponent(routeToken)}`, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: "List-Unsubscribe=One-Click",
      }),
    );
    const oneClickBody = (await oneClick.json()) as { ok?: boolean };
    const oneClickRow = await readAmpelSuppression(guardEmail);
    assertOk(
      oneClick.status === 200 &&
        oneClickBody.ok === true &&
        routeLeads.get(routeLead.leadId)?.marketingOptIn === "withdrawn" &&
        oneClickRow?.channel === "one-click",
      "one-click POST withdraws once and records the list",
    );
    routeNow += 60_000;
    const repeated = await postAmpelAbmelden(
      new Request(`https://www.gobd-doku-erstellen.de/api/ampel/abmelden?token=${encodeURIComponent(routeToken)}`, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: "List-Unsubscribe=One-Click",
      }),
    );
    const repeatedBody = (await repeated.json()) as { ok?: boolean };
    assertOk(
      repeated.status === 200 &&
        repeatedBody.ok === true &&
        (await readAmpelSuppression(guardEmail))?.withdrawnAt === oneClickRow?.withdrawnAt,
      "a second unsubscribe POST stays successful without moving the withdrawal",
    );
    assertOk(
      [...routeStore.raw().values()].every((row) => !JSON.stringify(row).includes("@")),
      "unsubscribe storage does not keep the address",
    );
    const laterConsent = new Date(routeNow + 120_000).toISOString();
    const laterLead = toAmpelReadinessLead({
      email: guardEmail,
      answers: jaCode,
      ref: "",
      consentAt: laterConsent,
      doiConfirmedAt: laterConsent,
      score: 100,
      light: "gruen",
      mailStatus: "sent",
      marketingOptIn: "confirmed",
    });
    routeLeads.set(laterLead.leadId, laterLead);
    routeNow = Date.parse(laterConsent) + 1000;
    const jsonToken = createAmpelUnsubscribeToken(guardEmail, laterConsent) ?? "";
    const jsonPost = await postAmpelAbmelden(
      new Request("https://www.gobd-doku-erstellen.de/api/ampel/abmelden", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: jsonToken }),
      }),
    );
    const jsonBody = (await jsonPost.json()) as { ok?: boolean };
    const jsonRow = await readAmpelSuppression(guardEmail);
    assertOk(
      jsonPost.status === 200 &&
        jsonBody.ok === true &&
        routeLeads.get(laterLead.leadId)?.marketingOptIn === "withdrawn" &&
        jsonRow?.channel === "link" &&
        jsonRow.withdrawnAt === new Date(routeNow).toISOString(),
      "the confirmation page can withdraw with a JSON token",
    );
    assertOk(!logged.some((line) => line.includes(guardEmail)), "logs omit the address");
  } finally {
    console.info = previousInfo;
    console.error = previousError;
    setMailDedupeTestHooks(null);
    setAmpelMarketingLeadLookup(null);
    setAmpelWithdrawTestDeps(null);
    if (savedResend === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = savedResend;
    if (savedFrom === undefined) delete process.env.EMAIL_FROM;
    else process.env.EMAIL_FROM = savedFrom;
    await rm(guardMailDir, { recursive: true, force: true });
  }

  console.log("check-ampel: ok");
} finally {
  setAmpelSuppressionTestStore(null);
  setAmpelMarketingLeadLookup(null);
  setAmpelWithdrawTestDeps(null);
  if (savedSecret === undefined) delete process.env.MAGIC_LINK_SECRET;
  else process.env.MAGIC_LINK_SECRET = savedSecret;
}
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
