/**
 * Betriebsprüfungs-Ampel: weighted score, green cap, and the DOI token.
 *
 *   npx tsx scripts/check-ampel.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { AMPEL_QUESTIONS, AMPEL_RESULTS, AMPEL_H1, AMPEL_DISCLAIMER, AMPEL_SHARE_KANZLEI, AMPEL_CTA, AMPEL_INTRO } from "@/lib/ampel-questions";
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
import { AMPEL_RESULT_RETRY_DELAYS_MS, confirmAmpelDoi, requestAmpelConfirmation } from "@/lib/ampel-confirm";
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
  assertOk(confirmation.text.includes("erst nach dieser Bestätigung"), "result is withheld until confirmation");
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
  assertOk(readFileSync("app/ampel-check/bestaetigen/confirm-panel.tsx", "utf8").includes("trackLeadSubmit()"), "DOI confirm fires the lead event");
  assertOk(!readFileSync("app/ampel-check/ampel-check.tsx", "utf8").includes("trackLeadSubmit"), "the check itself does not fire the lead event");
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
  const confirmedAt = panel.indexOf("if (!response.ok || !data.ok)");
  const leadTrackAt = panel.indexOf("trackLeadSubmit()");
  assertOk(confirmedAt >= 0 && leadTrackAt > confirmedAt, "lead event fires only after the confirm request succeeds");
  const tracking = readFileSync("lib/tracking.ts", "utf8");
  assertOk(tracking.includes("export function trackAmpelStart") && tracking.includes("export function trackAmpelResult"), "ampel events exist");
  assertOk(tracking.includes('trackAmpelGaEvent("ampel_start")') && tracking.includes('trackAmpelGaEvent("ampel_result")'), "ampel events are GA4 events");
  assertOk(tracking.includes("if (!hasMarketingConsent() || ampelStartTracked) return;"), "ampel start is consent-gated");
  assertOk(tracking.includes("if (!hasMarketingConsent() || ampelResultTracked) return;"), "ampel result is consent-gated");
  assertOk(!tracking.includes("NEXT_PUBLIC_AMPEL"), "ampel tracking adds no env var");
  assertOk(page.includes("trackAmpelStart()") && page.includes("trackAmpelResult()"), "the check tracks the first answer and the result");
  assertOk(!page.includes("trackLeadSubmit"), "the check itself does not fire the lead event");

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
