/**
 * Internal lead note: one mail to the operator after a real result mail.
 * A test address or a listed firm is skipped. The dedupe ledger keeps a
 * second submit from sending again. The lead is never the recipient.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AMPEL_QUESTIONS, type AmpelAnswer } from "@/lib/ampel-questions";
import { createMemoryAmpelMailStatusStore } from "@/lib/ampel-mail-status";
import { createMemoryAmpelRateStore } from "@/lib/ampel-rate-limit";
import { ampelPdfDedupeKey, completeAmpelResult, deliverAmpelResult, submitAmpelResult } from "@/lib/ampel-result-send";
import { createMemoryAmpelSendTokenStore } from "@/lib/ampel-send-token";
import { encodeAmpelAnswers, type AmpelAnswerMap } from "@/lib/ampel-score";
import { ampelResultLabel } from "@/lib/ampel-stats";
import { scoreAmpelCheck } from "@/lib/ampel-check-score";
import { CHECKOUT_NOTICE_TO } from "@/lib/checkout-notice";
import { completeKassenResult, submitKassenResult } from "@/lib/kassen-check-send";
import { KASSEN_QUESTIONS } from "@/lib/kassen-check-questions";
import { kassenResultDedupeKey } from "@/lib/kassen-check-mail";
import { scoreKassen } from "@/lib/kassen-check-score";
import {
  assertLeadNoticeRecipient,
  flushLeadNoticesForTests,
  formatLeadNoticeTime,
  leadNoticeDedupeAnchor,
  notifyLeadResult,
  type LeadNoticeInput,
} from "@/lib/lead-notice";
import { leadNoticeMailKey, resendIdempotencyKey, setMailDedupeTestHooks } from "@/lib/mail-dedupe";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const LISTED = "48c6805d-3d34-4a80-9747-38ce4edb3eed";
const FIXED = Date.UTC(2026, 9, 16, 8, 0, 0);
const REAL = "inhaber@firma.de";
const REF = "utm_campaign_herbst";

function fail(message: string): never {
  console.error(`check-lead-notice: ${message}`);
  process.exit(1);
}

function ok(condition: unknown, message: string): void {
  if (!condition) fail(message);
  console.log("ok:", message);
}

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8");
}

function answered(
  questions: readonly { id: string }[],
  patch: Record<string, AmpelAnswer> = {},
): AmpelAnswerMap {
  const answers: AmpelAnswerMap = {};
  for (const question of questions) answers[question.id] = patch[question.id] ?? "ja";
  return answers;
}

type Captured = {
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
  idempotencyKey?: string;
  cc?: unknown;
  bcc?: unknown;
};

function notices(sends: Captured[]): Captured[] {
  return sends.filter((item) => item.to === CHECKOUT_NOTICE_TO);
}

function checkSources(): void {
  const notice = read("lib/lead-notice.ts");
  ok(notice.includes("to: CHECKOUT_NOTICE_TO"), "the send target is the fixed operator address");
  ok(notice.includes("CHECKOUT_NOTICE_TO"), "the note reuses the checkout recipient");
  ok(!notice.includes("to: input.email") && !notice.includes("to: email"), "the lead address is not the send target");
  ok(!notice.includes("cc:") && !notice.includes("bcc:"), "the note has no cc or bcc");
  ok(notice.includes("assertLeadNoticeRecipient"), "the note asserts the lead is not the recipient");
  ok(notice.includes("isAmpelTestEmail"), "test addresses use the ampel stats rule");
  ok(notice.includes("isTestEntity"), "listed firms use isTestEntity");
  ok(notice.includes("leadNoticeMailKey"), "the note is keyed in the mail ledger");
  ok(notice.includes("sendDedupedEmail"), "the note goes through the dedupe helper");
  ok(notice.includes("after(") && notice.includes("waitUntil("), "the note is scheduled with after and waitUntil");
  const queueBody = notice.slice(notice.indexOf("export function queueLeadNotice"));
  ok(queueBody.includes("scheduleLeadNoticeAfterResponse"), "queue schedules the note");
  ok(
    !queueBody.includes("return notifyLeadResult") && !queueBody.includes("return await notifyLeadResult"),
    "queue does not hand the send back to the caller",
  );
  ok(!/process\.env\.NODE_ENV\s*=/.test(notice), "the note does not assign NODE_ENV");

  const send = read("lib/ampel-result-send.ts");
  const sentAt = send.indexOf("if (mail.sent) {");
  const queued = send.indexOf("queueLeadNotice(");
  ok(sentAt > 0 && queued > sentAt, "the note is queued only after the result mail was sent");
  ok(!send.includes("await queueLeadNotice") && !send.includes("await notifyLeadResult"), "the customer flow does not await the note");
  const finishBody = send.slice(send.indexOf("async function finishAmpelResult"), send.indexOf("function sentOutcome"));
  ok(!finishBody.includes("queueLeadNotice") && !finishBody.includes("notifyLeadResult"), "saving the lead does not send the note");
  ok(send.includes('deps.check === "kassen-check" ? "kassen" : "ampel"'), "Kassen and Ampel share the note with their own tool");

  const kassen = read("lib/kassen-check-send.ts");
  ok(kassen.includes('check: "kassen-check"'), "Kassen submits are marked as Kassen");
  ok(kassen.includes("submitAmpelResult") && kassen.includes("completeAmpelResult"), "Kassen uses the shared result send");
  ok(read("app/api/ampel/ergebnis/senden/route.ts").includes("completeAmpelResult"), "Ampel send route completes the result mail");
  ok(read("app/api/kassen-check/ergebnis/senden/route.ts").includes("completeKassenResult"), "Kassen send route completes the result mail");
  ok(read("app/api/ampel/ergebnis/route.ts").includes("submitAmpelResult"), "Ampel submit route starts the check");
  ok(read("app/api/kassen-check/ergebnis/route.ts").includes("submitKassenResult"), "Kassen submit route starts the check");
  ok(read("lib/mail-dedupe.ts").includes("lead-notice:"), "the ledger key starts with lead-notice");
}

async function posted(
  tool: "ampel" | "kassen",
  email: string,
  map: AmpelAnswerMap,
  patch: { marketing?: boolean; ref?: string; ip?: string; now?: number; mailSent?: boolean; duplicate?: boolean },
): Promise<{ mailed: boolean; pending: boolean }> {
  const questions = tool === "kassen" ? KASSEN_QUESTIONS : AMPEL_QUESTIONS;
  const code = encodeAmpelAnswers(map, questions) ?? "";
  const store = createMemoryAmpelRateStore();
  const tokens = createMemoryAmpelSendTokenStore();
  const status = createMemoryAmpelMailStatusStore();
  const now = patch.now ?? FIXED;
  const input = {
    email,
    answers: code,
    ref: patch.ref ?? "",
    marketing: patch.marketing === true,
    honeypot: "",
    ip: patch.ip ?? "203.0.113.80",
  };
  const deps = {
    store,
    tokens,
    status,
    now: () => now,
    saveLead: async () => undefined,
    confirm: async () => ({ ok: true as const, throttled: false }),
    mail: async () => ({
      stub: false as const,
      sent: patch.mailSent !== false && patch.duplicate !== true,
      ...(patch.duplicate ? { duplicate: true as const } : {}),
      id: "result-mail",
    }),
  };
  const submit = tool === "kassen" ? submitKassenResult : submitAmpelResult;
  const complete = tool === "kassen" ? completeKassenResult : completeAmpelResult;
  const handoff = await submit(input, { ...deps, handoff: true });
  await flushLeadNoticesForTests();
  const pending = handoff.ok && !("honeypot" in handoff) && handoff.pending === true;
  const token = handoff.ok && !("honeypot" in handoff) ? handoff.token : "";
  if (!token) return { mailed: false, pending };
  const done = await complete({ ...input, sendToken: token }, deps);
  await flushLeadNoticesForTests();
  const mailed = done.ok && !("honeypot" in done) && done.mailed === true;
  return { mailed, pending };
}

async function main(): Promise<void> {
  checkSources();

  const dir = mkdtempSync(path.join(tmpdir(), "lead-notice-"));
  const sends: Captured[] = [];
  const capture = async (input: {
    to: string;
    subject: string;
    text: string;
    html: string;
    replyTo?: string;
    idempotencyKey?: string;
    cc?: unknown;
    bcc?: unknown;
  }) => {
    sends.push({
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
      replyTo: input.replyTo,
      idempotencyKey: input.idempotencyKey,
      cc: input.cc,
      bcc: input.bcc,
    });
    return { stub: false as const, sent: true, id: "email_lead_notice" };
  };
  setMailDedupeTestHooks({ dir, send: capture });

  try {
    assert.doesNotThrow(() => assertLeadNoticeRecipient(REAL), "a normal lead passes the recipient guard");
    assert.throws(() => assertLeadNoticeRecipient("  CAPPE@gmx.de "), /lead-notice-recipient/);
    ok(true, "the operator address is rejected when it is the lead");

    const ampelMap = answered(AMPEL_QUESTIONS, { vd_vorhanden: "nein" });
    const ampelCode = encodeAmpelAnswers(ampelMap) ?? "";
    const ampelLight = scoreAmpelCheck(ampelMap)?.light ?? "";
    const ampelLabel = ampelResultLabel(ampelLight);
    ok(ampelLabel === "Rot", "the Ampel fixture is red");
    const resultMailId = ampelPdfDedupeKey(REAL, ampelCode);
    const direct: LeadNoticeInput = {
      tool: "ampel",
      email: "Inhaber@Firma.DE",
      light: ampelLight,
      marketingRequested: true,
      ref: REF,
      resultMailId,
      at: FIXED,
    };
    const first = await notifyLeadResult(direct);
    const second = await notifyLeadResult({ ...direct, at: FIXED + 60_000 });
    ok(first.sent === true && first.duplicate !== true, "the first real lead sends once");
    ok(second.duplicate === true && second.sent === false, "a duplicate submit does not send again");
    ok(notices(sends).length === 1, "Resend is called once for one result mail");

    const mail = notices(sends)[0];
    const time = formatLeadNoticeTime(FIXED);
    ok(mail?.to === CHECKOUT_NOTICE_TO && mail.to === "cappe@gmx.de", "the only recipient is cappe@gmx.de");
    ok(mail.to !== REAL && mail.to !== "Inhaber@Firma.DE", "the lead is not the recipient");
    ok(mail.replyTo == null && mail.cc == null && mail.bcc == null, "the lead is not reply-to, cc, or bcc");
    ok(mail.subject === `Neuer Ampel-Lead: ${ampelLabel} \u2013 firma.de`, "the Ampel subject names result and domain");
    ok(mail.text.includes("Tool: Ampel") && mail.html.includes("Tool: Ampel"), "the note names the Ampel tool");
    ok(mail.text.includes(`Ergebnis: ${ampelLabel}`) && mail.html.includes(`Ergebnis: ${ampelLabel}`), "the note names the result");
    ok(mail.text.includes(REAL) && mail.html.includes(REAL), "the note names the lead e-mail");
    ok(mail.text.includes("Marketing angefragt: ja") && mail.html.includes("Marketing angefragt: ja"), "marketing consent was requested");
    ok(mail.text.includes(`Ref/UTM: ${REF}`) && mail.html.includes(`Ref/UTM: ${REF}`), "the note includes the ref");
    ok(mail.text.includes(`Zeit (Europe/Berlin): ${time}`) && mail.html.includes(`Zeit (Europe/Berlin): ${time}`), "the note includes the Europe/Berlin time");
    ok(!/\b(Sie|Ihnen|Ihre|Ihr)\b/.test(mail.text), "the internal note does not address anyone with Sie");
    const dedupeKey = leadNoticeMailKey("ampel", leadNoticeDedupeAnchor({ email: REAL, resultMailId }));
    ok(dedupeKey === `lead-notice:ampel:${REAL}:${resultMailId}`, "the dedupe key is tool, address, and result-mail id");
    ok(mail.idempotencyKey === resendIdempotencyKey(dedupeKey), "Resend gets the Idempotency-Key from that dedupe key");

    const [left, right] = await Promise.all([
      notifyLeadResult({ ...direct, email: "parallel@firma.de", resultMailId: ampelPdfDedupeKey("parallel@firma.de", ampelCode) }),
      notifyLeadResult({ ...direct, email: "parallel@firma.de", resultMailId: ampelPdfDedupeKey("parallel@firma.de", ampelCode) }),
    ]);
    const parallel = sends.filter((item) => item.text.includes("parallel@firma.de"));
    ok(
      parallel.length === 1 && [left, right].filter((item) => item.sent).length === 1 && [left, right].filter((item) => item.duplicate).length === 1,
      "parallel submits of one result mail send one note",
    );

    const leadId = "ampel-11111111111111111111111111111111";
    const byLead = await notifyLeadResult({
      ...direct,
      email: "lead-id@firma.de",
      leadId,
      resultMailId: "",
    });
    ok(byLead.sent === true, "a known lead id can anchor the note");
    const leadMail = sends.find((item) => item.text.includes("lead-id@firma.de"));
    ok(
      leadMail?.idempotencyKey === resendIdempotencyKey(leadNoticeMailKey("ampel", leadId)),
      "a lead id is the dedupe anchor when it is present",
    );

    const quiet: LeadNoticeInput = {
      tool: "kassen",
      email: "still@firma.de",
      light: "gelb",
      marketingRequested: false,
      ref: "",
      resultMailId: "kassen-result:still@firma.de:quiet",
      at: FIXED,
    };
    const withoutRef = await notifyLeadResult(quiet);
    ok(withoutRef.sent === true, "a Kassen lead without a ref still sends");
    const quietMail = sends.find((item) => item.text.includes("still@firma.de"));
    ok(quietMail?.subject === "Neuer Kassen-Lead: Gelb \u2013 firma.de", "the Kassen subject names result and domain");
    ok(quietMail?.text.includes("Tool: Kassen") && quietMail.text.includes("Marketing angefragt: nein"), "Kassen notes consent as no");
    ok(quietMail != null && !quietMail.text.includes("Ref/UTM"), "an empty ref is left out");

    const beforeSkip = sends.length;
    for (const email of ["probe@example.com", "person@ikat-gmbh.de", "gobd16x-probe@gmail.com", "cappe@gmx.de"]) {
      const skipped = await notifyLeadResult({ ...direct, email, resultMailId: `ampel-pdf:${email}:skip` });
      ok(skipped.skipped === true && skipped.sent === false, `${email} is skipped`);
    }
    const listed = await notifyLeadResult({
      ...direct,
      email: "echt@firma.de",
      entityId: LISTED.toUpperCase(),
      resultMailId: "ampel-pdf:echt@firma.de:listed",
    });
    ok(listed.skipped === true && listed.sent === false, "a listed test firm is skipped");
    ok(sends.length === beforeSkip, "test addresses and listed firms do not call Resend");

    const beforeFlow = notices(sends).length;
    const ampelFlow = await posted("ampel", "kanzlei@kanzlei-nord.de", ampelMap, {
      marketing: true,
      ref: REF,
      ip: "203.0.113.81",
    });
    ok(ampelFlow.pending && ampelFlow.mailed, "an Ampel submit sends the result mail");
    ok(notices(sends).length === beforeFlow + 1, "a real Ampel submit sends one operator note");
    const ampelNote = sends.find((item) => item.text.includes("kanzlei@kanzlei-nord.de"));
    ok(
      ampelNote?.to === CHECKOUT_NOTICE_TO &&
        ampelNote.subject === `Neuer Ampel-Lead: ${ampelLabel} \u2013 kanzlei-nord.de` &&
        ampelNote.text.includes("Marketing angefragt: ja") &&
        ampelNote.text.includes(`Ref/UTM: ${REF}`) &&
        ampelNote.text.includes(formatLeadNoticeTime(FIXED)),
      "the Ampel submit note has the operator, subject, and fields",
    );
    ok(ampelNote?.to !== "kanzlei@kanzlei-nord.de", "the Ampel lead is not the note recipient");

    const again = await posted("ampel", "kanzlei@kanzlei-nord.de", ampelMap, {
      marketing: true,
      ref: REF,
      ip: "203.0.113.82",
      now: FIXED + 120_000,
    });
    ok(again.mailed, "a second Ampel submit still reports the result mail");
    ok(notices(sends).length === beforeFlow + 1, "a duplicate Ampel submit sends no second note");

    const kassenMap = answered(KASSEN_QUESTIONS, { meldung_angaben: "nein" });
    const kassenLabel = ampelResultLabel(scoreKassen(kassenMap)?.light ?? "");
    ok(kassenLabel === "Gelb", "the Kassen fixture is yellow");
    const kassenEmail = "kasse@kassen-nord.de";
    const kassenFlow = await posted("kassen", kassenEmail, kassenMap, {
      marketing: false,
      ref: "utm_source_kasse",
      ip: "203.0.113.83",
    });
    ok(kassenFlow.pending && kassenFlow.mailed, "a Kassen submit sends the result mail");
    const kassenNote = sends.find((item) => item.text.includes(kassenEmail));
    const kassenCode = encodeAmpelAnswers(kassenMap, KASSEN_QUESTIONS) ?? "";
    ok(
      kassenNote?.to === CHECKOUT_NOTICE_TO &&
        kassenNote.subject === `Neuer Kassen-Lead: ${kassenLabel} \u2013 kassen-nord.de` &&
        kassenNote.text.includes("Tool: Kassen") &&
        kassenNote.text.includes("Marketing angefragt: nein") &&
        kassenNote.text.includes("Ref/UTM: utm_source_kasse") &&
        kassenNote.idempotencyKey ===
          resendIdempotencyKey(
            leadNoticeMailKey(
              "kassen",
              leadNoticeDedupeAnchor({
                email: kassenEmail,
                resultMailId: kassenResultDedupeKey(kassenEmail, kassenCode),
              }),
            ),
          ),
      "the Kassen submit note has the operator, subject, fields, and dedupe key",
    );
    const afterKassen = notices(sends).length;
    const kassenAgain = await posted("kassen", kassenEmail, kassenMap, {
      marketing: false,
      ref: "utm_source_kasse",
      ip: "203.0.113.84",
      now: FIXED + 180_000,
    });
    ok(kassenAgain.mailed && notices(sends).length === afterKassen, "a duplicate Kassen submit sends no second note");

    const beforeTestFlow = sends.length;
    const testFlow = await posted("ampel", "probe@example.com", ampelMap, { ip: "203.0.113.85" });
    ok(testFlow.mailed && sends.length === beforeTestFlow, "a test address submit sends the result path no operator note");
    const internalFlow = await posted("kassen", "team@ikat-gmbh.de", kassenMap, { ip: "203.0.113.86" });
    ok(internalFlow.mailed && sends.length === beforeTestFlow, "an internal address submit sends no operator note");

    const redAnswers = ampelMap;
    const failedMail = await deliverAmpelResult(
      "fehler@firma.de",
      redAnswers,
      ampelCode,
      { email: "fehler@firma.de", answers: ampelCode, ref: "", marketing: false, honeypot: "", ip: "203.0.113.87" },
      { mail: async () => ({ stub: false, sent: false }), saveLead: async () => undefined },
      FIXED,
    );
    await flushLeadNoticesForTests();
    ok(
      failedMail.ok && !("honeypot" in failedMail) && failedMail.mailed === false && sends.length === beforeTestFlow,
      "a failed result mail does not send a note",
    );

    const stubMail = await deliverAmpelResult(
      "stub@firma.de",
      redAnswers,
      ampelCode,
      { email: "stub@firma.de", answers: ampelCode, ref: "", marketing: false, honeypot: "", ip: "203.0.113.88" },
      { mail: async () => ({ stub: true, sent: false }), saveLead: async () => undefined },
      FIXED,
    );
    await flushLeadNoticesForTests();
    ok(
      stubMail.ok && !("honeypot" in stubMail) && stubMail.mailed === true && sends.length === beforeTestFlow,
      "a stub result mail is not a successful send and does not notify",
    );

    let releaseGate: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      releaseGate = resolve;
    });
    let noteStarted = false;
    setMailDedupeTestHooks({
      dir,
      send: async (input) => {
        noteStarted = true;
        await gate;
        sends.push({
          to: input.to,
          subject: input.subject,
          text: input.text,
          html: input.html,
          idempotencyKey: input.idempotencyKey,
        });
        return { stub: false, sent: true, id: "held" };
      },
    });
    let leadStarted = false;
    const startedAt = Date.now();
    const quick = await Promise.race([
      deliverAmpelResult(
        "schnell-echt@firma.de",
        redAnswers,
        ampelCode,
        { email: "schnell-echt@firma.de", answers: ampelCode, ref: REF, marketing: true, honeypot: "", ip: "203.0.113.89" },
        {
          mail: async () => ({ stub: false, sent: true, id: "result-quick" }),
          saveLead: async () => {
            leadStarted = true;
          },
          scheduleAfterSend: () => undefined,
        },
        FIXED,
      ),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("notice blocked the result")), 1000);
      }),
    ]);
    ok(
      Date.now() - startedAt < 1000 &&
        quick.ok === true &&
        !("honeypot" in quick) &&
        quick.mailed === true &&
        !leadStarted,
      "the result returns before the note and the lead write",
    );
    releaseGate();
    await flushLeadNoticesForTests();
    ok(noteStarted && sends.some((item) => item.to === CHECKOUT_NOTICE_TO && item.text.includes("schnell-echt@firma.de")), "the held note is sent after the result returns");

    setMailDedupeTestHooks({
      dir,
      send: async () => {
        throw new Error("resend down");
      },
    });
    let threw = false;
    try {
      const broken = await deliverAmpelResult(
        "stoerung@firma.de",
        redAnswers,
        ampelCode,
        { email: "stoerung@firma.de", answers: ampelCode, ref: "", marketing: false, honeypot: "", ip: "203.0.113.90" },
        {
          mail: async () => ({ stub: false, sent: true, id: "result-broken" }),
          saveLead: async () => undefined,
        },
        FIXED,
      );
      await flushLeadNoticesForTests();
      ok(broken.ok === true && !("honeypot" in broken) && broken.mailed === true, "a note send error still reports the result mail");
      const failedNote = await notifyLeadResult({
        tool: "ampel",
        email: "direkt-fehler@firma.de",
        light: "rot",
        marketingRequested: false,
        resultMailId: "ampel-pdf:direkt-fehler@firma.de:fail",
        at: FIXED,
      });
      ok(failedNote.sent === false, "a failed notification does not report a send");
    } catch {
      threw = true;
    }
    ok(!threw, "a send error does not throw into the flow");
  } finally {
    setMailDedupeTestHooks(null);
  }

  console.log("check-lead-notice: ok");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
