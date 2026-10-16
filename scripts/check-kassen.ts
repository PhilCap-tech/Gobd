import { readFileSync } from "node:fs";
import { kassenTeaserSplit } from "@/components/kassen-check-teaser";
import { createAmpelDoiToken, verifyAmpelDoiToken } from "@/lib/ampel";
import { confirmAmpelDoi, requestAmpelConfirmation } from "@/lib/ampel-confirm";
import { AMPEL_QUESTIONS } from "@/lib/ampel-questions";
import { createMemoryAmpelRateStore } from "@/lib/ampel-rate-limit";
import { submitAmpelResult } from "@/lib/ampel-result-send";
import { encodeAmpelAnswers, scoreAmpel, type AmpelAnswerMap } from "@/lib/ampel-score";
import { automatedRunForbidsLiveWrites } from "@/lib/live-write-guard";
import { buildKassenResultMail } from "@/lib/kassen-check-mail";
import {
  KASSEN_CHECK_PATH,
  KASSEN_DISCLAIMER,
  KASSEN_H1,
  KASSEN_INTRO,
  KASSEN_LEAD_STATUS,
  kassenOffersNotApplicable,
  KASSEN_OPT_IN,
  KASSEN_QUESTIONS,
  KASSEN_RESULTS,
  KASSEN_TEASER,
  KASSEN_WEITER,
} from "@/lib/kassen-check-questions";
import { scoreKassen } from "@/lib/kassen-check-score";
import { submitKassenResult } from "@/lib/kassen-check-send";
import { INDEXABLE_STATIC_PATHS } from "@/lib/seo";
import { installSheetsHandler } from "@/lib/sheets-client";
import type { ReadinessLead } from "@/lib/readiness";

const savedSecret = process.env.MAGIC_LINK_SECRET;
if (!process.env.MAGIC_LINK_SECRET?.trim()) {
  process.env.MAGIC_LINK_SECRET = "check-kassen-offline-secret";
}

let failed = 0;
function ok(condition: unknown, label: string) {
  if (condition) {
    console.log(`ok ${label}`);
    return;
  }
  failed += 1;
  console.error(`FAIL ${label}`);
}

function answers(code: string) {
  const map: Record<string, "ja" | "nein" | "nicht_zutreffend"> = {};
  for (let index = 0; index < KASSEN_QUESTIONS.length; index += 1) {
    const mark = code[index];
    map[KASSEN_QUESTIONS[index].id] = mark === "N" ? "nein" : mark === "X" ? "nicht_zutreffend" : "ja";
  }
  return map;
}

function source(path: string) {
  return readFileSync(path, "utf8");
}

installSheetsHandler(async () => {
  throw new Error("kassen-check tried to call Google Sheets");
});

ok(automatedRunForbidsLiveWrites(), "check:kassen keeps live writes closed");
ok((INDEXABLE_STATIC_PATHS as readonly string[]).includes(KASSEN_CHECK_PATH), "sitemap paths include /kassen-check");
ok(source("app/sitemap.ts").includes("INDEXABLE_STATIC_PATHS"), "sitemap is built from the indexable list");
ok(!source("next.config.ts").includes('{ source: "/kassen-check",'), "the check page has no robots header");
ok(
  source("next.config.ts").includes('{ source: "/kassen-check/:path*",'),
  "the confirm path stays noindex",
);
const page = source("app/kassen-check/page.tsx");
ok(page.includes("index: true") && page.includes("follow: true"), "page metadata is index, follow");
ok(!page.includes("noindex") && !page.includes("index: false"), "page metadata has no noindex");

ok(KASSEN_H1 === "Kassen- und TSE-Meldecheck: Sind Ihre Kassen beim Finanzamt gemeldet?", "h1");
ok(KASSEN_INTRO.startsWith("Beantworten Sie 6 Fragen"), "intro");
ok(KASSEN_RESULTS.gruen.headline === "Ihre Kassenmeldungen wirken vollständig.", "green headline");
ok(KASSEN_RESULTS.gelb.headline === "Einzelne Punkte sind offen.", "yellow headline");
ok(KASSEN_RESULTS.rot.headline === "Grundlegende Punkte sind noch offen.", "red headline");
ok(
  KASSEN_DISCLAIMER ===
    "Keine Steuerberatung, keine Zusicherung zu Prüfungsergebnissen. Der Check ist eine allgemeine Orientierung auf Grundlage Ihrer Angaben und ersetzt keine Prüfung durch Ihre Steuerberatung.",
  "disclaimer",
);
ok(KASSEN_OPT_IN.heading === "Ergebnis mit Quellen per E-Mail erhalten", "opt-in heading");
ok(KASSEN_OPT_IN.button === "Ergebnis senden", "opt-in button");
ok(KASSEN_WEITER.includes("Readiness-Check") && KASSEN_WEITER.includes("Ampel-Check"), "weiter text");
ok(KASSEN_TEASER.link === "Zum Kassen- und TSE-Meldecheck", "teaser link");
ok(KASSEN_QUESTIONS.length === 6, "six questions");
ok(KASSEN_QUESTIONS[0].weight === 3 && KASSEN_QUESTIONS[0].applicable === "required", "first question required weight 3");

const copy = [
  source("lib/kassen-check-questions.ts"),
  source("lib/kassen-check-mail.ts"),
  source("app/kassen-check/kassen-check.tsx"),
  source("app/kassen-check/bestaetigen/confirm-panel.tsx"),
].join("\n");
ok(!/automatische Löschung|149 €|Garantie/.test(copy), "no deletion, price, or guarantee claims");
ok(!/\b(Soft-CTA|Primär-CTA|Sekundär-CTA)\b/.test(copy), "no CTA labels");

for (const slug of ["kiosk", "friseure", "einzelhandel"]) {
  const split = kassenTeaserSplit(slug, source(`content/branchen/${slug}.md`));
  ok(split?.variant === "default" && split.before.includes("## Kasse und Bargeld"), `${slug} teaser follows Kasse und Bargeld`);
  ok(split?.after.startsWith("\n"), `${slug} teaser leaves the following section`);
}
const taxi = kassenTeaserSplit("taxi", source("content/branchen/taxi.md"));
ok(taxi?.variant === "taxi" && taxi.before.includes("## Taxameter, TSE und Belege"), "taxi teaser follows the taximeter section");
ok(kassenTeaserSplit("apotheke", source("content/branchen/apotheke.md")) === null, "apotheke has no teaser");
ok(kassenTeaserSplit("verein", source("content/branchen/verein.md")) === null, "verein has no teaser");

const sharedTseNo = scoreAmpel(answers("NJJJJJ"), KASSEN_QUESTIONS);
ok(sharedTseNo?.score === 80 && sharedTseNo.light === "gelb" && sharedTseNo.capped === true, "shared formula still caps a weight-3 no at yellow");
const sharedCurrentNo = scoreAmpel(answers("JJJJJN"), KASSEN_QUESTIONS);
ok(sharedCurrentNo?.score === 87 && sharedCurrentNo.light === "gruen", "shared formula would leave current-data no green");

const green = scoreKassen(answers("JJJJJJ"));
ok(green?.score === 100 && green.light === "gruen" && green.capped === false, "all ja is green 100");
const tseNo = scoreKassen(answers("NJJJJJ"));
ok(tseNo?.score === 80 && tseNo.light === "rot", "TSE no is always red");
const currentNo = scoreKassen(answers("JJJJJN"));
ok(currentNo?.score === 87 && currentNo.light === "gelb" && currentNo.capped === true, "current-data no is at most yellow");
const bothRules = scoreKassen(answers("NJJJJN"));
ok(bothRules?.light === "rot", "TSE no stays red when current data is also no");
const yellow = scoreKassen(answers("JJJNNN"));
ok(yellow?.score === 60 && yellow.light === "gelb" && yellow.capped === false, "score 60 is yellow");
const red = scoreKassen(answers("NNNNNN"));
ok(red?.score === 0 && red.light === "rot", "all no is red 0");
const skipped = scoreKassen(answers("JXXXXX"));
ok(skipped?.score === 100 && skipped.applicableWeight === 3, "trifft nicht zu is not scored");
const optionalPair = scoreKassen(answers("JXJXJJ"));
ok(optionalPair?.score === 100 && optionalPair.light === "gruen" && optionalPair.applicableWeight === 10, "questions 2 and 4 can be skipped");

ok(kassenOffersNotApplicable(KASSEN_QUESTIONS[1]) && KASSEN_QUESTIONS[1].id === "meldung_neu", "question 2 offers Trifft nicht zu");
ok(kassenOffersNotApplicable(KASSEN_QUESTIONS[3]) && KASSEN_QUESTIONS[3].id === "meldung_ausserbetrieb", "question 4 offers Trifft nicht zu");
ok(!kassenOffersNotApplicable(KASSEN_QUESTIONS[0]) && KASSEN_QUESTIONS[0].id === "kasse_tse", "question 1 has no Trifft nicht zu");
const form = source("app/kassen-check/kassen-check.tsx");
ok(form.includes("kassenOffersNotApplicable(question)") && form.includes("Trifft nicht zu"), "the form uses the optional-question rule");

const mail = buildKassenResultMail(answers("JJJJJJ"));
ok(Boolean(mail?.text.includes(KASSEN_RESULTS.gruen.headline)), "result mail includes the green text");
ok(Boolean(mail && !mail.text.includes("von 100") && !mail.html.includes("von 100")), "result mail hides the score");
const tseMail = buildKassenResultMail(answers("NJJJJJ"));
ok(Boolean(tseMail?.text.includes(KASSEN_RESULTS.rot.headline)), "TSE no mail uses the red text");
const currentMail = buildKassenResultMail(answers("JJJJJN"));
ok(Boolean(currentMail?.text.includes(KASSEN_RESULTS.gelb.headline)), "current-data no mail uses the yellow text");
ok(Boolean(mail?.text.includes(KASSEN_QUESTIONS[0].source)), "result mail includes the source");
ok(Boolean(mail && !mail.text.includes("149")), "result mail has no price");

const consentAt = "2026-10-16T08:00:00.000Z";
const kassenToken = createAmpelDoiToken({
  email: "kassen@example.com",
  answers: "JJJJJJ",
  ref: "",
  consentAt,
  check: "kassen-check",
});
const kassenPayload = verifyAmpelDoiToken(kassenToken, Date.parse(consentAt));
ok(kassenPayload?.check === "kassen-check" && kassenPayload.answers === "JJJJJJ", "kassen DOI token verifies");
ok(verifyAmpelDoiToken(createAmpelDoiToken({ email: "kassen@example.com", answers: "JJJJJJ", ref: "", consentAt })) === null, "six answers are not an Ampel token");

const ampelMap: AmpelAnswerMap = {};
for (const question of AMPEL_QUESTIONS) ampelMap[question.id] = "ja";
const ampelCode = encodeAmpelAnswers(ampelMap);
const ampelToken = createAmpelDoiToken({
  email: "ampel@example.com",
  answers: ampelCode ?? "",
  ref: "",
  consentAt,
});
const ampelPayload = verifyAmpelDoiToken(ampelToken, Date.parse(consentAt));
ok(Boolean(ampelPayload) && ampelPayload?.check === undefined, "Ampel DOI token stays unchanged");

async function main() {
const sent = async () => ({ sent: true, stub: false });
const store = createMemoryAmpelRateStore();
const ip = "203.0.113.40";

const ampelFirst = await submitAmpelResult(
  { email: "ampel@example.com", answers: ampelCode, ref: "", marketing: false, honeypot: "", ip },
  { store, handoff: false, mail: sent, saveLead: async () => {} },
);
ok(ampelFirst.ok && "mailed" in ampelFirst && ampelFirst.mailed === true, "Ampel send does not use the Kassen scope");

let mailed = 0;
for (let index = 0; index < 5; index += 1) {
  const result = await submitKassenResult(
    { email: `kassen-${index}@example.com`, answers: "JJJJJJ", ref: "", marketing: false, honeypot: "", ip },
    { store, handoff: false, mail: async () => { mailed += 1; return { sent: true, stub: false }; }, saveLead: async () => {} },
  );
  ok(result.ok && "mailed" in result && result.mailed === true && result.limited === undefined, `kassen send ${index + 1} allowed`);
}
const blocked = await submitKassenResult(
  { email: "kassen-6@example.com", answers: "JJJJJJ", ref: "", marketing: false, honeypot: "", ip },
  { store, handoff: false, mail: async () => { mailed += 1; return { sent: true, stub: false }; }, saveLead: async () => {} },
);
ok(blocked.ok && "limited" in blocked && blocked.limited === "ip" && blocked.mailed === false, "sixth kassen send from one IP is limited");
ok(mailed === 5, "limited send does not mail");

const emailStore = createMemoryAmpelRateStore();
let emailMails = 0;
for (const code of ["JJJJJJ", "JNNNNN", "JJNNNN"]) {
  const result = await submitKassenResult(
    { email: "same@example.com", answers: code, ref: "", marketing: false, honeypot: "", ip: "203.0.113.41" },
    {
      store: emailStore,
      handoff: false,
      mail: async () => { emailMails += 1; return { sent: true, stub: false }; },
      saveLead: async () => {},
    },
  );
  ok(result.ok && "mailed" in result && result.mailed === true, `email slot for ${code}`);
}
const emailBlocked = await submitKassenResult(
  { email: "same@example.com", answers: "JJJNNN", ref: "", marketing: false, honeypot: "", ip: "203.0.113.41" },
  {
    store: emailStore,
    handoff: false,
    mail: async () => { emailMails += 1; return { sent: true, stub: false }; },
    saveLead: async () => {},
  },
);
ok(emailBlocked.ok && "limited" in emailBlocked && emailBlocked.limited === "email", "fourth address send is limited");
ok(emailMails === 3, "email limit does not mail");

const leads: ReadinessLead[] = [];
let confirms = 0;
const saved = await submitKassenResult(
  { email: "lead@example.com", answers: "JJJJJJ", ref: "", marketing: true, honeypot: "", ip: "203.0.113.42" },
  {
    store: createMemoryAmpelRateStore(),
    handoff: false,
    mail: sent,
    saveLead: async (lead) => { leads.push(lead); },
    confirm: async (input) => {
      confirms += 1;
      ok(input.check === "kassen-check", "DOI uses the kassen check");
      ok(input.answers === "JJJJJJ", "DOI keeps the answer code");
      return { ok: true, throttled: false };
    },
  },
);
ok(saved.ok && "marketing" in saved && saved.marketing === "started", "checked info box starts DOI");
ok(confirms === 1, "DOI runs only when the box is checked");
ok(leads.length === 1 && leads[0].leadId.startsWith("kassen-"), "lead id marks the source");
ok(leads[0]?.status === KASSEN_LEAD_STATUS, "lead status is kassen-check");
ok(leads[0]?.marketingOptIn === "pending", "marketing stays pending until the link");

let quietConfirm = 0;
const quiet = await submitKassenResult(
  { email: "quiet@example.com", answers: "NNNNNN", ref: "", marketing: false, honeypot: "", ip: "203.0.113.43" },
  {
    store: createMemoryAmpelRateStore(),
    handoff: false,
    mail: sent,
    saveLead: async () => {},
    confirm: async () => { quietConfirm += 1; return { ok: true, throttled: false }; },
  },
);
ok(quiet.ok && "marketing" in quiet && quiet.marketing === "skipped", "unchecked box skips DOI");
ok(quietConfirm === 0, "unchecked box does not send a confirmation");

let honeypotMails = 0;
const honeypot = await submitKassenResult(
  { email: "bot@example.com", answers: "JJJJJJ", ref: "", marketing: true, honeypot: "filled", ip: "203.0.113.44" },
  {
    store: createMemoryAmpelRateStore(),
    handoff: false,
    mail: async () => { honeypotMails += 1; return { sent: true, stub: false }; },
    saveLead: async () => {},
  },
);
ok(honeypot.ok && "honeypot" in honeypot, "honeypot is accepted quietly");
ok(honeypotMails === 0, "honeypot does not mail");

const tseLeads: ReadinessLead[] = [];
const tseSaved = await submitKassenResult(
  { email: "tse-nein@example.com", answers: "NJJJJJ", ref: "", marketing: false, honeypot: "", ip: "203.0.113.45" },
  {
    store: createMemoryAmpelRateStore(),
    handoff: false,
    mail: sent,
    saveLead: async (lead) => { tseLeads.push(lead); },
  },
);
ok(tseSaved.ok && tseLeads[0]?.ampelLight === "rot" && tseLeads[0]?.ampelScore === "80", "stored TSE no is red");

const doiLeads: ReadinessLead[] = [];
const doi = await requestAmpelConfirmation(
  { email: "aktuell@example.com", answers: "JJJJJN", ref: "", check: "kassen-check" },
  {
    findLead: async () => null,
    saveLead: async (lead) => { doiLeads.push(lead); },
    sendConfirmation: async () => ({ sent: true, stub: false }),
  },
);
ok(doi.ok === true && doiLeads[0]?.ampelLight === "gelb" && doiLeads[0]?.ampelScore === "87", "DOI stores current-data no as yellow");

const tseToken = createAmpelDoiToken({
  email: "tse-doi@example.com",
  answers: "NJJJJJ",
  ref: "",
  consentAt,
  check: "kassen-check",
});
if (!tseToken) {
  ok(false, "DOI click scores TSE no as red");
} else {
  const tseConfirm = await confirmAmpelDoi(tseToken, {
    findLead: async () => null,
    saveLead: async () => {},
    sendResult: async () => ({ sent: true, stub: false }),
  });
  ok(tseConfirm.ok === true && tseConfirm.light === "rot" && tseConfirm.score === 80, "DOI click scores TSE no as red");
}
}

main()
  .then(() => {
    if (savedSecret === undefined) delete process.env.MAGIC_LINK_SECRET;
    else process.env.MAGIC_LINK_SECRET = savedSecret;
    if (failed > 0) {
      console.error(`${failed} failed`);
      process.exit(1);
    }
    console.log("kassen-check ok");
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
