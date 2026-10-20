/**
 * Kanzlei-Merkblatt: download without a mail, DOI only with the checkbox,
 * blocklist, and no automatic deletion.
 *
 *   npx tsx scripts/check-kanzlei-merkblatt.ts
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { AMPEL_CONFIRM_WINDOW_MS } from "@/lib/ampel";
import { AMPEL_PRIVACY_PARAGRAPHS } from "@/lib/ampel-questions";
import {
  KANZLEI_CONSENT_TEXT_VERSION,
  KANZLEI_DOI_PREHEADER,
  KANZLEI_DOI_SUBJECT,
  KANZLEI_EMAIL_HINT,
  KANZLEI_MAIL_FOOTER,
  KANZLEI_MERKBLATT_FILENAME,
  KANZLEI_OPT_IN,
  KANZLEI_OPT_IN_SCOPE,
  KANZLEI_PRIVACY_PARAGRAPHS,
  KANZLEI_SUBMIT_LABEL,
} from "@/lib/kanzlei-copy";
import { confirmKanzleiDoi } from "@/lib/kanzlei-confirm";
import { redactKanzleiLead } from "@/lib/kanzlei-lead";
import { buildKanzleiDoiMail, kanzleiUnsubscribeFooterLine, kanzleiUnsubscribeUrl, sendKanzleiMarketingMail } from "@/lib/kanzlei-mail";
import { submitKanzleiMerkblatt } from "@/lib/kanzlei-submit";
import { createKanzleiDoiToken, createKanzleiUnsubscribeToken, KANZLEI_DOI_TTL_MS, verifyKanzleiDoiToken } from "@/lib/kanzlei-token";
import { setKanzleiWithdrawTestDeps, withdrawKanzleiMarketing } from "@/lib/kanzlei-unsubscribe";
import { GET as getKanzleiAbmelden, POST as postKanzleiAbmelden } from "@/app/api/kanzlei-merkblatt/abmelden/route";
import { createMemoryAmpelRateStore } from "@/lib/ampel-rate-limit";
import { setMailDedupeTestHooks } from "@/lib/mail-dedupe";
import type { MailResult } from "@/lib/mail";
import type { ReadinessLead } from "@/lib/readiness";

function fail(message: string): never {
  console.error(`check-kanzlei-merkblatt: ${message}`);
  process.exit(1);
}

function assertOk(condition: unknown, message: string): asserts condition {
  if (!condition) fail(message);
}

const now = Date.parse("2026-10-15T10:00:00.000Z");
const allowedLiveRecipient = "delivered@resend.dev";

function store(start = now) {
  const leads = new Map<string, ReadinessLead>();
  const sent: string[] = [];
  const tokens: string[] = [];
  let clock = start;
  return {
    leads,
    sent,
    tokens,
    at(next: number) {
      clock = next;
    },
    deps() {
      return {
        now: () => clock,
        store: createMemoryAmpelRateStore(),
        listLeads: async (email: string) =>
          [...leads.values()].filter((lead) => lead.email === email),
        saveLead: async (lead: ReadinessLead) => {
          leads.set(lead.leadId, { ...lead });
        },
        sendDoi: async (input: { email: string; token: string }) => {
          assertOk(input.email === allowedLiveRecipient, "DOI mail stays on the Resend test inbox");
          sent.push(input.email);
          tokens.push(input.token);
          return { stub: false, sent: true, id: "doi" } as MailResult;
        },
      };
    },
  };
}

async function main() {
const plain = await submitKanzleiMerkblatt(
  { email: "Kanzlei@Example.com", optin: false, honeypot: "", ip: "203.0.113.8" },
  store().deps(),
);
assertOk(plain.ok && plain.downloadUrl.endsWith("/pdf") && plain.mailed === false, "without the checkbox there is no mail");

const box = store();
const opted = await submitKanzleiMerkblatt(
  { email: allowedLiveRecipient, optin: true, honeypot: "", ip: "203.0.113.9" },
  box.deps(),
);
assertOk(opted.ok && opted.mailed === true && box.sent.length === 1, "the checkbox sends exactly one DOI mail");
const saved = [...box.leads.values()][0];
assertOk(saved != null, "the opt-in row is stored");
assertOk(saved.marketingOptIn === "pending" && saved.consentAt && saved.consentIp === "203.0.113.9", "consent time and IP are stored");
assertOk(saved.consentTextVersion === KANZLEI_CONSENT_TEXT_VERSION, "consent text version is 2026-10-15");
assertOk(saved.name === "" && saved.company === "" && !("kanzleiName" in saved), "no firm name is stored");
assertOk(saved.leadId.startsWith("kanzlei-"), "the lead id uses the kanzlei prefix");

const form = readFileSync("app/steuerberater/merkblatt-form.tsx", "utf8");
assertOk(form.includes("useState(false)") && !form.includes("defaultChecked"), "the checkbox starts unchecked");
assertOk(!form.includes("required") || form.includes('type="email"'), "email stays required");
assertOk(!/optin[\s\S]{0,80}required/.test(form), "the checkbox is not required");
assertOk(!form.includes("Kanzleiname") && !form.includes("kanzleiName"), "the form has no firm-name field");

const route = readFileSync("app/api/kanzlei-merkblatt/route.ts", "utf8");
assertOk(route.includes("fax_number") && !route.includes("kanzleiName") && !route.includes("Kanzleiname"), "the API schema has no firm name");

const failedSave = store();
const stillDownloads = await submitKanzleiMerkblatt(
  { email: "plain@example.com", optin: false, honeypot: "", ip: "203.0.113.10" },
  {
    ...failedSave.deps(),
    saveLead: async () => {
      throw new Error("sheet");
    },
  },
);
assertOk(stillDownloads.ok && stillDownloads.mailed === false, "a failed save still returns the download");

const token = createKanzleiDoiToken(
  { email: allowedLiveRecipient, consentAt: saved.consentAt, consentTextVersion: KANZLEI_CONSENT_TEXT_VERSION },
  now,
);
assertOk(token, "DOI token");
assertOk(verifyKanzleiDoiToken(token, now + KANZLEI_DOI_TTL_MS + 1) == null, "an expired token is rejected");
assertOk(verifyKanzleiDoiToken(`${token}x`, now) == null, "a tampered token is rejected");
assertOk(KANZLEI_DOI_TTL_MS === 48 * 60 * 60 * 1000, "the DOI link lasts 48 hours");

const confirmed = await confirmKanzleiDoi(token ?? "", {
  now: () => now,
  listLeads: async () => [...box.leads.values()],
  saveLead: async (lead) => {
    box.leads.set(lead.leadId, { ...lead });
  },
});
assertOk(confirmed.ok && box.leads.get(saved.leadId)?.marketingOptIn === "confirmed", "confirmation stores the opt-in");
assertOk(box.leads.get(saved.leadId)?.doiConfirmedAt, "confirmation stores the time");

const unsub = kanzleiUnsubscribeUrl(allowedLiveRecipient, saved.consentAt);
const unsubToken = new URL(unsub).searchParams.get("token") ?? "";
const withdrawn = await withdrawKanzleiMarketing(unsubToken, {
  now: () => now,
  list: async () => [...box.leads.values()],
  save: async (lead) => {
    box.leads.set(lead.leadId, { ...lead });
  },
});
assertOk(withdrawn.ok && box.leads.get(saved.leadId)?.marketingOptIn === "withdrawn", "unsubscribe sets withdrawn");
assertOk(box.leads.get(saved.leadId)?.email === allowedLiveRecipient, "the blocklist row keeps the address");

const revived = await confirmKanzleiDoi(token ?? "", {
  now: () => now + 60_000,
  listLeads: async () => [...box.leads.values()],
  saveLead: async (lead) => {
    box.leads.set(lead.leadId, { ...lead });
  },
});
assertOk(
  revived.ok &&
    "withdrawn" in revived &&
    revived.withdrawn === true &&
    box.leads.get(saved.leadId)?.marketingOptIn === "withdrawn",
  "an old DOI link does not reactivate a revoked consent",
);

const again = store(now + 3_600_000);
again.leads.set(saved.leadId, { ...box.leads.get(saved.leadId)! });
const renewed = await submitKanzleiMerkblatt(
  { email: allowedLiveRecipient, optin: true, honeypot: "", ip: "203.0.113.12" },
  again.deps(),
);
const renewedRow = [...again.leads.values()].find((lead) => lead.consentAt !== saved.consentAt);
const oldStill = again.leads.get(saved.leadId);
assertOk(
  renewed.ok &&
    renewed.mailed === true &&
    again.tokens.length === 1 &&
    renewedRow?.marketingOptIn === "pending" &&
    oldStill?.marketingOptIn === "withdrawn",
  "a new consent after withdrawal receives its own DOI mail",
);
const staleConfirm = await confirmKanzleiDoi(token ?? "", {
  now: () => now + 3_600_000,
  listLeads: async () => [...again.leads.values()],
  saveLead: async (lead) => {
    again.leads.set(lead.leadId, { ...lead });
  },
});
assertOk(
  staleConfirm.ok &&
    "withdrawn" in staleConfirm &&
    staleConfirm.withdrawn === true &&
    again.leads.get(saved.leadId)?.marketingOptIn === "withdrawn",
  "an old DOI link does not reactivate a revoked consent",
);
const freshConfirm = await confirmKanzleiDoi(again.tokens[0] ?? "", {
  now: () => now + 3_600_000,
  listLeads: async () => [...again.leads.values()],
  saveLead: async (lead) => {
    again.leads.set(lead.leadId, { ...lead });
  },
});
assertOk(
  freshConfirm.ok &&
    again.leads.get(renewedRow?.leadId ?? "")?.marketingOptIn === "confirmed" &&
    again.leads.get(saved.leadId)?.marketingOptIn === "withdrawn",
  "a new consent after withdrawal is confirmed only by its own DOI token",
);
const oldUnsubscribe = createKanzleiUnsubscribeToken(allowedLiveRecipient, saved.consentAt) ?? "";
const repeatedWithdraw = await withdrawKanzleiMarketing(oldUnsubscribe, {
  now: () => now + 3_700_000,
  list: async () => [...again.leads.values()],
  save: async (lead) => {
    again.leads.set(lead.leadId, { ...lead });
  },
});
assertOk(
  repeatedWithdraw.ok && again.leads.get(renewedRow?.leadId ?? "")?.marketingOptIn === "confirmed",
  "an old unsubscribe token does not revoke a later consent",
);

const replaced = store(now + 7_200_000);
const firstOpt = await submitKanzleiMerkblatt(
  { email: allowedLiveRecipient, optin: true, honeypot: "", ip: "203.0.113.13" },
  replaced.deps(),
);
const firstId = [...replaced.leads.values()][0]?.leadId ?? "";
replaced.at(now + 7_200_000 + 60_000);
const secondOpt = await submitKanzleiMerkblatt(
  { email: allowedLiveRecipient, optin: true, honeypot: "", ip: "203.0.113.14" },
  replaced.deps(),
);
assertOk(firstOpt.ok && secondOpt.ok && replaced.tokens.length === 2, "a second signup sends a fresh DOI token");
const staleSignup = await confirmKanzleiDoi(replaced.tokens[0] ?? "", {
  now: () => now + 7_200_000 + 60_000,
  listLeads: async () => [...replaced.leads.values()],
  saveLead: async (lead) => {
    replaced.leads.set(lead.leadId, { ...lead });
  },
});
assertOk(
  staleSignup.ok === false && replaced.leads.get(firstId)?.marketingOptIn !== "confirmed",
  "a new signup invalidates the previous DOI token",
);
const currentSignup = await confirmKanzleiDoi(replaced.tokens[1] ?? "", {
  now: () => now + 7_200_000 + 60_000,
  listLeads: async () => [...replaced.leads.values()],
  saveLead: async (lead) => {
    replaced.leads.set(lead.leadId, { ...lead });
  },
});
assertOk(
  currentSignup.ok &&
    [...replaced.leads.values()].some((lead) => lead.marketingOptIn === "confirmed" && lead.leadId !== firstId),
  "only the fresh DOI token confirms the new consent",
);

const mail = buildKanzleiDoiMail({ confirmUrl: "https://www.gobd-doku-erstellen.de/steuerberater/merkblatt/bestaetigen?token=abc" });
assertOk(mail.subject === KANZLEI_DOI_SUBJECT, "DOI subject");
assertOk(mail.preheader === KANZLEI_DOI_PREHEADER, "DOI preheader");
assertOk(mail.text.includes(KANZLEI_MAIL_FOOTER) && mail.html.includes("Sitz der Gesellschaft: Monheim am Rhein"), "mail footer names the registered office");
assertOk(mail.html.includes("datenschutz#kanzlei-merkblatt") && mail.html.includes("Impressum"), "mail footer links impressum and privacy");
assertOk(!mail.html.includes("/abmelden") && !mail.text.includes("Abmelden:"), "the DOI mail has no unsubscribe link");
assertOk(!mail.html.includes("149") && !mail.html.includes("/checkout") && !mail.text.includes("149"), "the DOI mail has no price and no product button");
assertOk(mail.text.includes("Anmeldung bestätigen:"), "plain text spells out the confirm link");
assertOk(mail.text.includes("höchstens zweimal im Monat"), "the mail states the monthly cap");
assertOk(mail.html.includes("bereits direkt auf der Seite heruntergeladen"), "the mail says the download already happened");
assertOk(!mail.html.includes("Webinar") && !mail.text.includes("Webinar"), "the mail says Veranstaltungen, not Webinare");
const footerLine = kanzleiUnsubscribeFooterLine("https://example.test/ab");
assertOk(footerLine.startsWith("Abmelden: Keine Kanzlei-Infos mehr erhalten"), "later mails can use the unsubscribe line");
assertOk(AMPEL_CONFIRM_WINDOW_MS === 15 * 60 * 1000, "DOI dedupe uses the ampel window");

const privacyPage = readFileSync("app/datenschutz/page.tsx", "utf8");
assertOk(privacyPage.includes('id="kanzlei-merkblatt"'), "the privacy heading has the anchor");
const privacy = KANZLEI_PRIVACY_PARAGRAPHS.join("\n");
assertOk(privacy.includes("Einladungen zu Veranstaltungen") && !privacy.includes("Webinar"), "privacy uses Veranstaltungen");
assertOk(privacy.includes(KANZLEI_OPT_IN_SCOPE) && KANZLEI_OPT_IN.includes(KANZLEI_OPT_IN_SCOPE), "checkbox and privacy use the same opt-in scope");
assertOk(mail.text.includes(KANZLEI_OPT_IN_SCOPE) && mail.html.includes(KANZLEI_OPT_IN_SCOPE), "the DOI mail uses the same opt-in scope");
assertOk(
  !KANZLEI_OPT_IN.includes("GoBD-Themen") && !privacy.includes("GoBD-Themen") && !mail.text.includes("GoBD-Themen"),
  "the old opt-in description is gone",
);
assertOk(privacy.includes("Der Bestätigungslink ist 48 Stunden gültig."), "privacy states the 48-hour confirm link");
assertOk(mail.text.includes("Der Link ist 48 Stunden gültig."), "mail b states the 48-hour confirm link");
assertOk(
  privacy.includes(
    "Damit werten wir intern aus, wer das Merkblatt angefordert hat (Reichweite und Interesse aus Kanzleien), schützen das Formular vor Missbrauch und können Ihnen auf Ihren Wunsch Rückfragen zum Merkblatt beantworten. Die Auswertung ist nur intern sichtbar, wir geben die Daten nicht an Dritte weiter. Rechtsgrundlage ist unser berechtigtes Interesse an diesen Zwecken (Art. 6 Abs. 1 lit. f DSGVO). Sie können dieser Verarbeitung jederzeit widersprechen (Art. 21 DSGVO). Ohne Ihre gesonderte Einwilligung senden wir Ihnen keine Werbung.",
  ),
  "the merkblatt section keeps the legitimate-interest sentence",
);
assertOk(
  privacy.includes(
    "Um die Einwilligung nachweisen zu können, speichern wir den Zeitpunkt der Anmeldung und der Bestätigung, die IP-Adresse und den Text der Einwilligung. Rechtsgrundlage ist Ihre Einwilligung (Art. 6 Abs. 1 lit. a DSGVO, § 7 Abs. 2 Nr. 2 UWG), für den Nachweis Art. 6 Abs. 1 lit. c und f DSGVO.",
  ),
  "the merkblatt section keeps the consent-evidence sentence",
);
const sectionNine = readFileSync("content/legal/datenschutz.md", "utf8");
const resendSentence =
  "Für den Versand der E-Mails setzen wir Resend (Plus Five Five, Inc., USA) als Auftragsverarbeiter ein (Art. 28 DSGVO). Grundlage ist ein Auftragsverarbeitungsvertrag. Für die Übermittlung in die USA stützen wir uns auf die Zertifizierung von Resend nach dem EU-U.S. Data Privacy Framework (Angemessenheitsbeschluss der EU-Kommission, Art. 45 DSGVO). Ergänzend sind im Vertrag Standardvertragsklauseln vereinbart (Art. 46 Abs. 2 lit. c DSGVO).";
const sectionTenBody = sectionNine.slice(sectionNine.indexOf("## 10."), sectionNine.indexOf("## 11."));
assertOk(sectionTenBody.includes(resendSentence), "section 10 states the Resend transfer basis");
assertOk(
  KANZLEI_EMAIL_HINT.includes(
    " und um Ihnen auf Wunsch Rückfragen zum Merkblatt zu beantworten. Details in der Datenschutzerklärung.",
  ),
  "the email hint names follow-up questions and the privacy policy",
);
assertOk(
  form.includes('href="/datenschutz#kanzlei-merkblatt"') && form.includes("EmailHint"),
  "the email hint links to the privacy anchor",
);
assertOk(privacy.includes("Eine automatische Löschung nach einer festen Frist findet nicht statt."), "privacy states there is no automatic deletion");
assertOk(!privacy.includes("[") && !KANZLEI_EMAIL_HINT.includes("[") && !KANZLEI_OPT_IN.includes("["), "kanzlei copy has no bracket markers");
assertOk(!AMPEL_PRIVACY_PARAGRAPHS.join("\n").includes("90 Tage"), "the ampel section no longer says 90 days");
assertOk(readFileSync("content/legal/datenschutz.md", "utf8").includes("**Stand:** 20.10.2026"), "the privacy stand date is the PR date");

const pdfRoute = readFileSync("app/steuerberater/merkblatt/pdf/route.ts", "utf8");
assertOk(pdfRoute.includes("X-Robots-Tag") && pdfRoute.includes("noindex"), "the PDF response is noindex");
assertOk(pdfRoute.includes("KANZLEI_MERKBLATT_FILENAME"), "the download name is the public filename");
assertOk(KANZLEI_MERKBLATT_FILENAME === "kanzlei-merkblatt-verfahrensdokumentation.pdf", "public filename");
const pdf = readFileSync("content/kanzlei-merkblatt.pdf");
assertOk(pdf.subarray(0, 5).toString("utf8") === "%PDF-", "the merkblatt PDF exists");
assertOk(!pdf.toString("latin1").includes("(Entwurf)"), "the PDF title is not marked as a draft");
const merkblatt = readFileSync("content/kanzlei-merkblatt.md", "utf8");
assertOk(merkblatt.startsWith("# Kanzlei-Merkblatt: Verfahrensdokumentation nach GoBD"), "merkblatt title");
assertOk(!merkblatt.includes("Webinar") && !merkblatt.includes("[klären"), "merkblatt has no draft marker and no webinar");

const submitSource = readFileSync("lib/kanzlei-submit.ts", "utf8");
assertOk(!submitSource.includes("redactKanzleiLead") && !submitSource.includes("purge"), "submit does not delete leads");
assertOk(!readFileSync("lib/store.ts", "utf8").includes("purgeExpired"), "no store path purges leads");
const redacted = redactKanzleiLead(saved);
assertOk(redacted.email === "" && redacted !== saved, "manual redaction is a separate function");
assertOk(redactKanzleiLead({ ...saved, marketingOptIn: "withdrawn" }).email === saved.email, "a blocklist row is not redacted");

assertOk(KANZLEI_SUBMIT_LABEL === "Merkblatt herunterladen (PDF)", "button label");
assertOk(!readFileSync("app/steuerberater/page.tsx", "utf8").includes("Kanzleiname"), "the partner page has no firm-name field for the magnet");

const marketingLeads = new Map<string, ReadinessLead>();
const marketingConsent = new Date(now).toISOString();
const marketingLead = [...box.leads.values()][0];
assertOk(marketingLead, "marketing test has a confirmed lead");
marketingLeads.set(marketingLead.leadId, {
  ...marketingLead,
  consentAt: marketingConsent,
  doiConfirmedAt: marketingConsent,
  marketingOptIn: "confirmed",
});
const delivered: { headers?: Record<string, string> }[] = [];
setMailDedupeTestHooks({
  dir: mkdtempSync(`${tmpdir()}/kanzlei-marketing-`),
  now: () => now,
  send: async (input) => {
    delivered.push({ headers: input.headers });
    assertOk(!JSON.stringify(input.headers ?? {}).includes(allowedLiveRecipient), "unsubscribe headers omit the address");
    return { stub: false, sent: true, id: "marketing" };
  },
});
const marketing = await sendKanzleiMarketingMail(
  {
    email: allowedLiveRecipient,
    consentAt: marketingConsent,
    subject: "Hinweis für Kanzleien",
    text: "Guten Tag, dies ist eine Information.",
    html: "<p>Guten Tag, dies ist eine Information.</p>",
  },
  { listLeads: async () => [...marketingLeads.values()] },
);
const listHeader = delivered[0]?.headers?.["List-Unsubscribe"] ?? "";
assertOk(
  marketing.sent === true &&
    listHeader.includes("/api/kanzlei-merkblatt/abmelden?token=") &&
    listHeader.includes("<mailto:info@gobd-doku-erstellen.de?subject=Abmelden>") &&
    delivered[0]?.headers?.["List-Unsubscribe-Post"] === "List-Unsubscribe=One-Click",
  "kanzlei marketing mail sets List-Unsubscribe and List-Unsubscribe-Post",
);
setMailDedupeTestHooks(null);
marketingLeads.set(marketingLead.leadId, { ...marketingLeads.get(marketingLead.leadId)!, marketingOptIn: "withdrawn", withdrawnAt: marketingConsent });
const suppressed = await sendKanzleiMarketingMail(
  {
    email: allowedLiveRecipient,
    consentAt: marketingConsent,
    subject: "Hinweis für Kanzleien",
    text: "Guten Tag.",
    html: "<p>Guten Tag.</p>",
  },
  { listLeads: async () => [...marketingLeads.values()] },
);
assertOk(suppressed.sent === false && suppressed.blocked === "suppressed", "a revoked consent gets no marketing mail");

const routeLeads = new Map<string, ReadinessLead>();
const routeConsent = new Date(now).toISOString();
const routeLead = {
  ...marketingLead,
  consentAt: routeConsent,
  doiConfirmedAt: routeConsent,
  marketingOptIn: "confirmed",
  withdrawnAt: "",
  mailStatus: "doi_pending",
};
routeLeads.set(routeLead.leadId, routeLead);
setKanzleiWithdrawTestDeps({
  now: () => now + 120_000,
  list: async () => [...routeLeads.values()],
  save: async (lead) => {
    routeLeads.set(lead.leadId, { ...lead });
  },
});
const routeToken = createKanzleiUnsubscribeToken(allowedLiveRecipient, routeConsent) ?? "";
const scanned = await getKanzleiAbmelden(
  new Request(`https://www.gobd-doku-erstellen.de/api/kanzlei-merkblatt/abmelden?token=${encodeURIComponent(routeToken)}`),
);
assertOk(scanned.status === 303 && routeLeads.get(routeLead.leadId)?.marketingOptIn === "confirmed", "GET does not unsubscribe");
const oneClick = await postKanzleiAbmelden(
  new Request(`https://www.gobd-doku-erstellen.de/api/kanzlei-merkblatt/abmelden?token=${encodeURIComponent(routeToken)}`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: "List-Unsubscribe=One-Click",
  }),
);
const oneClickBody = (await oneClick.json()) as { ok?: boolean };
assertOk(
  oneClick.status === 200 &&
    oneClickBody.ok === true &&
    routeLeads.get(routeLead.leadId)?.marketingOptIn === "withdrawn",
  "one-click POST revokes Kanzlei consent",
);
setKanzleiWithdrawTestDeps(null);

console.log("check-kanzlei-merkblatt: ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
